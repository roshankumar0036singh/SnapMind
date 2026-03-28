import tempfile
import subprocess
import os
import shutil
from typing import Dict, Any
from rag_pipeline import ingest_text_logic

def _update_job_status(job_id, status: str, message: str, files_processed: int = 0, chunks_count: int = 0):
    """Helper to update the ingestion_jobs table row."""
    if job_id is None:
        return
    try:
        from database import get_db_pool
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE ingestion_jobs
                    SET status = %s, message = %s, files_processed = %s, chunks_count = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE job_id = %s
                    """,
                    (status, message, files_processed, chunks_count, job_id)
                )
            conn.commit()
        print(f"[REPO_INGEST] Job {job_id} status updated to '{status}'.")
    except Exception as e:
        print(f"[REPO_INGEST] Warning: Could not update job status: {e}")

def ingest_repository(repo_url: str, target_lang: str = "auto", api_keys: dict = None, job_id=None, session_id: str = None) -> Dict[str, Any]:
    """
    Clones a GitHub repository, reads valid text/code files, translates 
    comments/docs into the target language, and ingests them into the RAG system.
    Updates the job row (if job_id is provided) when finished.
    """
    # [FIX] Quick sanity check to catch non-repo URLs before cloning
    if "docs.github.com" in repo_url.lower() or "/site-policy/" in repo_url.lower():
        msg = f"Rejected non-repository URL: {repo_url}. Only base GitHub repository URLs are supported for repo ingestion."
        print(f"[REPO_INGEST] {msg}")
        _update_job_status(job_id, "failed", msg)
        return {"success": False, "message": msg}

    try:
        # 1. Clone repository
        with tempfile.TemporaryDirectory() as temp_dir:
            print(f"[REPO_INGEST] Cloning {repo_url} into {temp_dir}...")
            try:
                # Resolve full git path so it works even when uvicorn's PATH differs from user PATH
                git_path = shutil.which('git') or 'git'
                print(f"[REPO_INGEST] Using git at: {git_path}")
                
                # Shallow clone with a timeout to prevent hanging
                result = subprocess.run(
                    [git_path, "clone", "--depth", "1", repo_url, temp_dir], 
                    capture_output=True, 
                    text=True,
                    timeout=120  # 2-minute timeout for the clone
                )
                if result.returncode != 0:
                    stderr_output = result.stderr.strip()
                    msg = f"Git clone failed (exit {result.returncode}): {stderr_output}"
                    print(f"[REPO_INGEST] {msg}")
                    _update_job_status(job_id, "failed", msg)
                    return {"success": False, "message": msg}
            except FileNotFoundError:
                msg = f"Git not found. Tried path: '{git_path}'. Please ensure git is installed and in PATH."
                print(f"[REPO_INGEST] {msg}")
                _update_job_status(job_id, "failed", msg)
                return {"success": False, "message": msg}
            except subprocess.TimeoutExpired:
                msg = "Git clone timed out after 2 minutes."
                _update_job_status(job_id, "failed", msg)
                return {"success": False, "message": msg}
            except Exception as e:
                msg = f"Failed to clone repository: {str(e)}"
                _update_job_status(job_id, "failed", msg)
                return {"success": False, "message": msg}
                
            print(f"[REPO_INGEST] Clone successful. Walking files...")
            
            # 2. Walk directory
            ignore_dirs = {'.git', 'node_modules', 'venv', 'env', '__pycache__', 'dist', 'build', '.idea', '.vscode'}
            valid_extensions = {
                '.py', '.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt', 
                '.java', '.go', '.cpp', '.c', '.h', '.html', '.css', '.sql', '.rs', '.php'
            }
            
            total_files = 0
            total_chunks = 0
            
            for root, dirs, files in os.walk(temp_dir):
                # Mutate dirs in place to skip ignored directories entirely
                dirs[:] = [d for d in dirs if d not in ignore_dirs]
                
                for file in files:
                    ext = os.path.splitext(file)[1].lower()
                    if ext not in valid_extensions:
                        continue
                        
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, temp_dir)
                    source_url = f"{repo_url}/blob/main/{rel_path.replace(os.sep, '/')}"
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            file_content = f.read()
                            
                        if not file_content.strip() or len(file_content) > 150000: 
                            # Skip empty or huge minified files
                            continue
                            
                        # 3. Create a header so the LLM context is clear
                        header = f"File Path: {rel_path}\nRepository: {repo_url}\n---\n"
                        full_text = header + file_content
                        
                        # 4. Process text (This automatically chunks, translates via Lingo.dev, and embeds)
                        print(f"[REPO_INGEST] Processing {rel_path} ({len(file_content)} chars)")
                        res = ingest_text_logic(source_url, full_text, target_lang=target_lang, api_keys=api_keys, session_id=session_id)
                        
                        if res.get("success"):
                            total_chunks += res.get("chunks_count", 0)
                            total_files += 1
                            
                    except UnicodeDecodeError:
                        # Binary file or strange encoding, skip safely
                        pass
                    except Exception as e:
                        print(f"[REPO_INGEST] Error processing {file_path}: {e}")
                    
                    # 5. [NEW] Periodically update job status for progress tracking
                    if total_files > 0 and total_files % 5 == 0:
                        _update_job_status(job_id, "processing", f"Indexing in progress... ({total_files} files processed)", total_files, total_chunks)
            
            success_msg = f"Ingested Github repository. Processed {total_files} files into {total_chunks} embeddings."
            _update_job_status(job_id, "completed", success_msg, total_files, total_chunks)
            return {
                "success": True, 
                "message": success_msg,
                "files_processed": total_files,
                "chunks_count": total_chunks,
                "source_url": repo_url
            }
    except Exception as e:
        error_msg = f"Unexpected error during repo ingestion: {str(e)}"
        print(f"[REPO_INGEST] {error_msg}")
        _update_job_status(job_id, "failed", error_msg)
        return {"success": False, "message": error_msg}
