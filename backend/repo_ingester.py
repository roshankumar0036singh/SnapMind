import tempfile
import subprocess
import os
import shutil
from typing import Dict, Any
from models.dtos import IngestRequestDTO

def _update_job_status(job_id, status: str, message: str, files_processed: int = 0, chunks_count: int = 0, session_id: str = None, progress: int = 0, user_id: str = None):
    """Helper to update the ingestion_jobs table row and broadcast SSE status."""
    if job_id:
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
        except Exception as e:
            print(f"[REPO_INGEST] Warning: Could not update job status in DB: {e}")

    # [NEW] Broadcast to SSE subscribers for real-time UI updates
    if session_id:
        try:
            from services.ingest_service import IngestService
            IngestService.update_job_status(session_id, status, message, progress=progress, user_id=user_id)
        except Exception as e:
            print(f"[REPO_INGEST] Warning: Could not broadcast SSE status: {e}")
            
    print(f"[REPO_INGEST] Job {job_id or 'unknown'} status updated to '{status}': {message}")

async def ingest_repository(repo_url: str, target_lang: str = "auto", api_keys: dict = None, job_id=None, session_id: str = None, user_id: str = None, workspace_id: str = None) -> Dict[str, Any]:
    """
    Clones a GitHub repository, reads valid text/code files, translates 
    comments/docs into the target language, and ingests them into the RAG system.
    Updates the job row (if job_id is provided) when finished.
    """
    # [FIX] Quick sanity check to catch non-repo URLs before cloning
    if not repo_url or "docs.github.com" in repo_url.lower() or "/site-policy/" in repo_url.lower():
        msg = f"Rejected non-repository URL: {repo_url}. Only base GitHub repository URLs are supported for repo ingestion."
        print(f"[REPO_INGEST] {msg}")
        _update_job_status(job_id, "failed", msg, user_id=user_id)
        return {"success": False, "message": msg}

    try:
        # 1. Clone repository
        with tempfile.TemporaryDirectory() as temp_dir:
            print(f"[REPO_INGEST] Cloning {repo_url} into {temp_dir}...")
            _update_job_status(job_id, "cloning", "Establishing neural link to repository...", session_id=session_id, user_id=user_id)
            try:
                git_path = shutil.which('git') or 'git'
                result = subprocess.run(
                    [git_path, "clone", "--depth", "1", repo_url, temp_dir], 
                    capture_output=True, 
                    text=True,
                    timeout=180  # increased timeout
                )
                if result.returncode != 0:
                    stderr_output = result.stderr.strip()
                    msg = f"Git clone failed: {stderr_output}"
                    _update_job_status(job_id, "failed", msg, session_id=session_id, user_id=user_id)
                    return {"success": False, "message": msg}
            except Exception as e:
                msg = f"Failed to clone repository: {str(e)}"
                _update_job_status(job_id, "failed", msg, session_id=session_id, user_id=user_id)
                return {"success": False, "message": msg}
                
            _update_job_status(job_id, "processing", "Cloning complete. Mapping file structure...", session_id=session_id, progress=5, user_id=user_id)
            
            # 2. Walk directory & Count Files for better progress
            ignore_dirs = {'.git', 'node_modules', 'venv', 'env', '__pycache__', 'dist', 'build', '.idea', '.vscode'}
            valid_extensions = {
                '.py', '.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt', 
                '.java', '.go', '.cpp', '.c', '.h', '.html', '.css', '.sql', '.rs', '.php'
            }
            
            all_files_to_process = []
            for root, dirs, files in os.walk(temp_dir):
                dirs[:] = [d for d in dirs if d not in ignore_dirs]
                for file in files:
                    ext = os.path.splitext(file)[1].lower()
                    if ext in valid_extensions:
                        all_files_to_process.append(os.path.join(root, file))
            
            total_file_count = len(all_files_to_process)
            print(f"[REPO_INGEST] Found {total_file_count} valid files.")
            
            total_files_processed = 0
            total_chunks = 0
            
            for file_path in all_files_to_process:
                rel_path = os.path.relpath(file_path, temp_dir)
                source_url = f"{repo_url}/blob/main/{rel_path.replace(os.sep, '/')}"
                
                try:
                    # Granular progress reporting
                    total_files_processed += 1
                    current_progress = 5 + int((total_files_processed / total_file_count) * 90)
                    
                    if total_files_processed % 2 == 0 or total_files_processed == total_file_count:
                        _update_job_status(
                            job_id, 
                            "processing", 
                            f"Neural Indexing: {rel_path}", 
                            files_processed=total_files_processed, 
                            chunks_count=total_chunks,
                            session_id=session_id,
                            progress=current_progress,
                            user_id=user_id
                        )

                    with open(file_path, 'r', encoding='utf-8') as f:
                        file_content = f.read()
                        
                    if not file_content.strip() or len(file_content) > 200000: 
                        continue
                        
                    header = f"File Path: {rel_path}\nRepository: {repo_url}\n---\n"
                    full_text = header + file_content
                    
                    from services.ingest_service import IngestService
                    ingest_svc = IngestService(api_keys=api_keys)
                    dto = IngestRequestDTO(
                        url=source_url,
                        text=full_text,
                        session_id=session_id,
                        user_id=user_id,
                        workspace_id=workspace_id,
                        metadata={"target_lang": target_lang}
                    )
                    # For compatibility with existing repo loop, we'll call ingest_text
                    res_dto = await ingest_svc.ingest_text(dto, api_keys)
                    if res_dto.success:
                        # Estimate chunks based on text length since DTO doesn't return count directly for now
                        total_chunks += len(full_text) // 2000 + 1
                        
                except UnicodeDecodeError:
                    pass
                except Exception as e:
                    print(f"[REPO_INGEST] Error processing {file_path}: {e}")
            
            success_msg = f"Knowledge synthesis complete. Integrated {total_files_processed} files ({total_chunks} neural nodes)."
            _update_job_status(job_id, "completed", success_msg, total_files_processed, total_chunks, session_id=session_id, progress=100, user_id=user_id)
            return {
                "success": True, 
                "message": success_msg,
                "files_processed": total_files_processed,
                "chunks_count": total_chunks,
                "source_url": repo_url
            }
    except Exception as e:
        error_msg = f"Neural Collapse: {str(e)}"
        print(f"[REPO_INGEST] {error_msg}")
        _update_job_status(job_id, "failed", error_msg, session_id=session_id, user_id=user_id)
        return {"success": False, "message": error_msg}
