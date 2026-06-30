import asyncio
import time
import json
import uuid
import concurrent.futures
from typing import List, Dict, Any, Optional, Tuple
from fastapi import UploadFile

from models.dtos import IngestRequestDTO, IngestResponseDTO, JobStatusDTO
from repositories.document_repository import DocumentRepository
# Remove top-level RepoIngester import to prevent circular dependency
from api_clients import check_connectivity, get_gemini_client, get_mistral_client
from services.llm_service import LLMService
from services.crawler_service import CrawlerService
from utils import pad_embedding, normalize_url, is_mostly_non_ascii
from chunking import chunk_text
from agentic_chunking import run_agentic_chunking
from youtube_parser import get_youtube_transcript
from evolution_tracker import EvolutionTracker
from audio_transcriber import AudioTranscriber
from config import settings

class IngestService:
    """
    Core service for multi-source data ingestion and indexing.
    Part of the SnapMind intelligence layer.
    """
    """
    Service layer for SnapMind Data Ingestion.
    Handles scraping, embedding, and vector storage indexing.
    """
    
    _JOB_STATUS: Dict[str, Dict[str, Any]] = {}

    def __init__(self, api_keys: dict = None):
        self.doc_repo = DocumentRepository()
        self.llm_service = LLMService(api_keys=api_keys)
        self.crawler_service = CrawlerService()
        self.evolution_tracker = EvolutionTracker(api_keys=api_keys)
        self.audio_transcriber = AudioTranscriber(api_keys=api_keys)
        self.api_keys = api_keys

    @classmethod
    async def subscribe_job_status(cls, session_id: str, user_id: str = None):       
        """SSE generator for job progress with user validation."""
        last_status = None
        last_progress = -1
        await asyncio.sleep(0.5)
        
        while True:
            status_dto = cls.get_job_status(session_id, user_id)
            if status_dto.status != last_status or status_dto.progress != last_progress:
                yield f"data: {json.dumps(status_dto.model_dump())}\n\n"
                last_status = status_dto.status
                last_progress = status_dto.progress
            
            if status_dto.status in ["completed", "failed"]:
                yield f"data: {json.dumps(status_dto.model_dump())}\n\n"
                break
            await asyncio.sleep(1.0)

    @classmethod
    def update_job_status(cls, session_id: str, status: str, message: str, progress: int = 0, user_id: str = None):
        if not session_id: return
        cls._JOB_STATUS[session_id] = {
            "status": status,
            "message": message,
            "progress": progress,
            "timestamp": time.time(),
            "session_id": session_id,
            "user_id": user_id
        }

    @classmethod
    def get_job_status(cls, session_id: str, user_id: str = None) -> JobStatusDTO:
        data = cls._JOB_STATUS.get(session_id)
        
        # Security Check: Ensure session belongs to user
        if data and user_id and data.get("user_id") and data.get("user_id") != user_id:
            return JobStatusDTO(
                status="forbidden", 
                message="Access denied to this session.", 
                progress=0, 
                session_id=session_id, 
                timestamp=time.time()
            )
            
        if not data:
            data = {
                "status": "unknown", "message": "No active job found.", "progress": 0,
                "session_id": session_id, "timestamp": time.time()
            }
        return JobStatusDTO(**data)
            
    def process_sync_queue(self):
        """
        Polls 'pending_embeddings' and processes them if online.
        Used by the main background task.
        """
        if not check_connectivity():
            return

        query = "SELECT id, content, source_url, metadata, workspace_id, user_id FROM pending_embeddings LIMIT 50"
        try:
            with self.doc_repo.pool.connection() as conn:
                from psycopg.rows import dict_row
                with conn.cursor(row_factory=dict_row) as cur:
                    cur.execute(query)
                    pending_items = cur.fetchall()
                    
                if not pending_items:
                    return

                print(f"[SYNC] Processing {len(pending_items)} pending embeddings...")
                
                for item in pending_items:
                    success = self._process_pending_item(item)
                    if success:
                        with conn.cursor() as cur:
                            cur.execute("DELETE FROM pending_embeddings WHERE id = %s", (item['id'],))
                        conn.commit()
        except Exception as e:
            print(f"[SYNC] Error in process_sync_queue: {e}")

    def _process_pending_item(self, item: Dict[str, Any]) -> bool:
        """Helper to process a single pending embedding item."""
        try:
            content = item['content']
            source_url = item['source_url']
            metadata = item['metadata'] or {}
            workspace_id = str(item.get('workspace_id'))
            user_id = str(item.get('user_id'))
            
            # Simple embedding and storage
            embedded_chunks = self._batch_embed(
                [{'content': content, 'metadata': metadata}],
                source_url=source_url,
                api_keys=self.api_keys
            )
            
            if embedded_chunks:
                # Attach IDs to chunks for multi-tenant storage
                for chunk in embedded_chunks:
                    chunk['workspace_id'] = workspace_id
                    chunk['user_id'] = user_id
                
                self.doc_repo.bulk_insert(embedded_chunks)
                return True
            return False
        except Exception as e:
            print(f"[SYNC] Failed to process item {item.get('id')}: {e}")
            return False

    def _notify(self, session_id: str, status: str, message: str, progress: int = 0, user_id: str = None):
        self.update_job_status(session_id, status, message, progress, user_id)

    async def ingest_url(
        self,
        request: IngestRequestDTO,
        api_keys: Dict[str, str],
        crawl_mode: str = "single",
        max_pages: int = 50,
        max_depth: int = 3
    ) -> IngestResponseDTO:
        """Orchestrate a URL ingestion job with high concurrency."""
        url = request.url
        session_id = request.session_id
        self._notify(session_id, "processing", f"Initiating ingestion for {url}...", 5, request.user_id)
        
        try:
            norm_url = normalize_url(url)
            
            # 1. Scrape/Crawl
            self._notify(session_id, "processing", "Analyzing source type...", 10, request.user_id)
            
            is_video = any(k in url.lower() for k in ["youtube.com", "youtu.be", "vimeo.com"])
            
            if is_video and crawl_mode != "crawl":
                self._notify(session_id, "processing", "Extracting video transcript...", 15, request.user_id)
                success, content, err, title = get_youtube_transcript(url, api_keys)
                if success:
                    pages = [{"url": url, "content": content, "title": title}]
                else:
                    print(f"[IngestService] Video parsing failed: {err}. Falling back to web scraping.")
                    content, title = await self.crawler_service.scrape_url(url, api_keys)
                    pages = [{"url": url, "content": content, "title": title}] if content else []
            elif crawl_mode == "crawl":
                self._notify(session_id, "processing", "Crawling site nodes...", 15, request.user_id)
                pages = await self.crawler_service.crawl_site(url, max_pages, max_depth, api_keys)
            else:
                self._notify(session_id, "processing", "Scraping web content...", 15, request.user_id)
                content, title = await self.crawler_service.scrape_url(url, api_keys)
                pages = [{"url": url, "content": content, "title": title}] if content else []

            if not pages:
                self._notify(session_id, "failed", "No content found", 100, request.user_id)
                return IngestResponseDTO(success=False, url=url, message="No content found.")

            # 2. Parallel Processing across all pages
            self._notify(session_id, "processing", f"Analyzing {len(pages)} pages in parallel...", 30, request.user_id)
            
            tasks = [self._process_single_page(p, request, api_keys) for p in pages]
            pages_chunks = await asyncio.gather(*tasks)
            
            all_chunks = [chunk for p_chunks in pages_chunks for chunk in p_chunks]

            if not all_chunks:
                self._notify(session_id, "failed", "No valid content extracted from pages", 100)
                return IngestResponseDTO(success=False, url=url, message="Processing yielded no content.")

            # 3. Neural Embeddings (Batch Async)
            self._notify(session_id, "processing", f"Generating {len(all_chunks)} neural embeddings...", 60)
            embedded = await self._batch_embed_async(all_chunks, norm_url, api_keys)

            # 4. Persistence
            self._notify(session_id, "processing", "Storing knowledge to vault...", 90)
            insert_data = [
                {
                    "id": str(uuid.uuid4()), "content": d["content"], "source_url": d["source_url"],
                    "embedding": d["embedding"], "metadata": d["metadata"], 
                    "user_id": request.user_id, "workspace_id": request.workspace_id
                } for d in embedded
            ]
            self.doc_repo.bulk_insert(insert_data)

            self._notify(session_id, "completed", f"Ingested {len(insert_data)} nodes successfully.", 100)
            return IngestResponseDTO(success=True, url=norm_url, message=f"Ingested {len(insert_data)} chunks.")

        except Exception as e:
            import traceback
            traceback.print_exc()
            self._notify(session_id, "failed", str(e), 100)
            return IngestResponseDTO(success=False, url=url, message=str(e))

    async def _process_single_page(self, page: Dict[str, Any], request: IngestRequestDTO, api_keys: dict) -> List[dict]:
        """Helper to process a single page's metadata and chunking concurrently."""
        p_url = page["url"]
        p_content = page["content"]
        p_title = page.get("title")

        # [EVOLUTION] Track changes before chunking
        try:
            evolution = await self.evolution_tracker.track_change(
                url=p_url,
                content=p_content,
                user_id=request.user_id,
                workspace_id=request.workspace_id,
                title=p_title
            )
            print(f"[IngestService] Evolution status for {p_url}: {evolution.get('status')}")
        except Exception as ee:
            print(f"[IngestService] Evolution tracking failed: {ee}")

        # Concurrent Analysis: Extract tags and translate in parallel
        # Note: Optimization - only translate if mostly non-English
        is_foreign = is_mostly_non_ascii(p_content[:500])
        
        async def mock_translate():
            return (p_content, "en", False)

        analysis_tasks = [
            self.llm_service.extract_tags(p_content),
            self.llm_service.translate_lingo(p_content, "en") if is_foreign else mock_translate()
        ]

        res = await asyncio.gather(*analysis_tasks)
        tags = res[0]
        translated, lang, is_trans = res[1]

        # Auto-detect Agentic Chunking
        # Use it for code or medium-length text, but auto-disable for massive texts (>15000 chars) to prevent severe slowdowns.
        is_structured = "```" in translated
        is_medium_length = len(translated) > 3000
        is_too_massive = len(translated) > 15000
        
        use_agentic = settings.agentic_chunking_enabled and (is_structured or is_medium_length) and not is_too_massive
        
        # [NEW] Knowledge Graph Extraction (Fire and Forget)
        if settings.graphrag_enabled:
            from graph_logic import extract_graph_data, insert_graph_data
            def run_graph_extraction():
                try:
                    g_data = extract_graph_data(translated, api_keys)
                    if g_data.get("nodes") or g_data.get("edges"):
                        insert_graph_data(
                            g_data, 
                            source_url=p_url, 
                            user_id=request.user_id, 
                            workspace_id=request.workspace_id,
                            session_id=request.session_id
                        )
                except Exception as ge:
                    print(f"[IngestService] Graph extraction failed for {p_url}: {ge}")
            
            # Dispatch to a dedicated background thread pool so it doesn't block FastAPI's thread pool
            if not hasattr(self, '_graph_executor'):
                self._graph_executor = concurrent.futures.ThreadPoolExecutor(max_workers=5, thread_name_prefix="GraphExt")
            asyncio.get_running_loop().run_in_executor(self._graph_executor, run_graph_extraction)

        if use_agentic:
            chunks = await run_agentic_chunking(
                translated, 
                api_keys=api_keys, 
                target_chunk_size=settings.chunking.target_size
            )
            for c in chunks:
                if "metadata" not in c: c["metadata"] = {}
                c["metadata"]["source_url"] = p_url
                c["metadata"]["chunk_strategy"] = "agentic"
        else:
            chunks = chunk_text(
                translated, 
                max_chars=settings.chunking.target_size,
                source_url=p_url,
                use_semantic=settings.chunking.enabled
            )

        # [FIX] Determine source type for metadata tagging
        # Default to 'automated' for URL scraping; IngestRequest might override with 'local' for syncs
        source_type = request.metadata.get("source_type", "automated")

        # Enrich chunks
        for c in chunks:
            c["metadata"].update({
                "tags": tags, "original_lang": lang, "translated": is_trans,
                "session_id": request.session_id, "tenant_id": request.tenant_id,
                "title": p_title, "user_id": request.user_id,
                "workspace_id": request.workspace_id,
                "source_type": source_type
            })
        return chunks

    async def _batch_embed_async(self, chunks: List[dict], source_url: str, api_keys: dict) -> List[dict]:
        """Async version of batch embedding using Gemini with robust retries."""
        if not chunks: return []
        
        from api_clients import get_gemini_client
        client = get_gemini_client(api_keys)
        texts = [c["content"] for c in chunks]
        
        # [FIX] Reduce batch size from 100 to 32 for better SSL stability
        BATCH_SIZE = 32
        all_embeddings = []
        
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i:i+BATCH_SIZE]
            
            # [FIX] Exponential Backoff for SSL/Connection errors
            max_retries = 3
            last_err = None
            for attempt in range(max_retries):
                try:
                    res = await client.aio.models.embed_content(model="gemini-embedding-001", contents=batch)
                    all_embeddings.extend([pad_embedding(e.values) for e in res.embeddings])
                    break
                except Exception as e:
                    last_err = e
                    print(f"[IngestService] Batch {i//BATCH_SIZE + 1} embedding attempt {attempt+1} failed: {e}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(2 ** attempt) # Backoff
            else:
                print(f"[IngestService] Batch {i//BATCH_SIZE + 1} failed after {max_retries} attempts: {last_err}. Falling back to sync.")
                return self._batch_embed(chunks, source_url, api_keys)
        
        results = []
        for chunk, emb in zip(chunks, all_embeddings):
            results.append({
                "content": chunk["content"], "embedding": emb,
                "source_url": chunk.get("metadata", {}).get("source_url", source_url),
                "metadata": chunk["metadata"]
            })
        return results

    def _batch_embed(self, chunks: List[dict], source_url: str, api_keys: dict) -> List[dict]:
        """Runs batch embedding across chunks using Gemini's batch API."""
        if not chunks:
            return []
            
        client = get_gemini_client(api_keys)
        texts = [c["content"] for c in chunks]
        
        # Batch size for Gemini is 100
        BATCH_SIZE = 100
        all_embeddings = []
        
        try:
            for i in range(0, len(texts), BATCH_SIZE):
                batch = texts[i:i+BATCH_SIZE]
                res = client.models.embed_content(model="gemini-embedding-001", contents=batch)
                all_embeddings.extend([pad_embedding(e.values) for e in res.embeddings])
            
            results = []
            for chunk, emb in zip(chunks, all_embeddings):
                results.append({
                    "content": chunk["content"],
                    "embedding": emb,
                    "source_url": source_url,
                    "metadata": chunk["metadata"]
                })
            return results
        except Exception as e:
            print(f"[IngestService] Batch embedding failed: {e}. Falling back to individual processing...")
            # Fallback to single if batch fails
            results = []
            for c in chunks:
                try:
                    res = client.models.embed_content(model="gemini-embedding-001", contents=c["content"])
                    emb = pad_embedding(res.embeddings[0].values)
                    results.append({
                        "content": c["content"], "embedding": emb,
                        "source_url": source_url, "metadata": c["metadata"]
                    })
                except Exception as ex:
                    print(f"[IngestService] Individual fallback failed for chunk: {ex}")
            return results

    async def ingest_text(self, request: IngestRequestDTO, api_keys: Dict[str, str]) -> IngestResponseDTO:
        """Orchestrate raw text ingestion asynchronously."""
        from credibility import CredibilityScorer
        scorer = CredibilityScorer()
        
        session_id = request.session_id
        text = request.text
        url = request.url or f"text://{uuid.uuid4().hex[:8]}"
        self._notify(session_id, "processing", "Processing text nodes...", 10, request.user_id)
        
        if not text or len(text.strip()) < 10:
            return IngestResponseDTO(success=False, url=url, message="Insufficient content.")

        # [OPTIMIZATION] Skip translation if mostly English
        if not is_mostly_non_ascii(text[:500]):
            translated, lang, is_trans = text, "en", False
        else:
            translated, lang, is_trans = await self.llm_service.translate_lingo(text, "en")
            
        tags = await self.llm_service.extract_tags(translated)
        
        # [CREDIBILITY] Score source
        cred = scorer.score(url, text)

        # [FIX] Tag manual text ingestion as 'local' (Gold Standard)
        source_type = request.metadata.get("source_type", "local")
        
        chunks = chunk_text(translated, max_chars=settings.chunking.target_size, source_url=url, use_semantic=True)
        for c in chunks:
            c["metadata"].update({
                "tags": tags, "original_lang": lang, "translated": is_trans,
                "session_id": session_id, "tenant_id": request.tenant_id,
                "title": request.title or "Text Snippet", "user_id": request.user_id,
                "credibility_score": cred["score"],
                "credibility_tier": cred["tier"],
                "source_type": source_type
            })

        # 3. Embed & Persist (Async)
        self._notify(session_id, "processing", f"Embedding {len(chunks)} chunks...", 60, request.user_id)
        embedded = await self._batch_embed_async(chunks, url, api_keys)
        
        insert_data = [
            {
                "id": str(uuid.uuid4()), "content": d["content"], "source_url": d["source_url"],
                "embedding": d["embedding"], "metadata": d["metadata"], "user_id": request.user_id,
                "workspace_id": request.workspace_id
            } for d in embedded
        ]
        self.doc_repo.bulk_insert(insert_data)

        self._notify(session_id, "completed", "Text ingestion complete.", 100)
        return IngestResponseDTO(success=True, url=url, message=f"Ingested {len(embedded)} chunks.")

    async def ingest_file(self, file: UploadFile, api_keys: Dict[str, str], target_lang: str = "auto", session_id: str = None, tenant_id: str = "default", user_id: str = None) -> IngestResponseDTO:
        session_id = session_id or str(uuid.uuid4())
        self._notify(session_id, "processing", f"Extracting file: {file.filename}...", 5)
        
        content = ""
        ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ""
        
        try:
            file_bytes = await file.read()
            
            # Check for Audio/Video (Media Hub)
            from audio_transcriber import is_audio_file, is_video_file
            if is_audio_file(file.filename) or is_video_file(file.filename):
                self._notify(session_id, "processing", "Audio/Video detected. Transcribing via Groq...", 10)
                trans_result = self.audio_transcriber.transcribe(file_bytes, file.filename)
                if trans_result["success"]:
                    content = trans_result["text"]
                    self._notify(session_id, "processing", "Transcription complete.", 30)
                else:
                    raise Exception(f"Transcription failed: {trans_result.get('error')}")
            elif ext == "pdf":
                import io
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(file_bytes))
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        content += text + "\n"
            elif ext in ["docx", "doc"]:
                import io
                from docx import Document
                doc = Document(io.BytesIO(file_bytes))
                content = "\n".join([p.text for p in doc.paragraphs])
            else:
                content = file_bytes.decode('utf-8', errors='replace')
        except Exception as e:
            self._notify(session_id, "failed", f"Failed to parse file: {e}", user_id=user_id)
            return IngestResponseDTO(success=False, url=f"file://{file.filename}", message=f"Parse error: {str(e)}")
            
        if not content.strip():
            self._notify(session_id, "failed", f"No readable text found in {file.filename}", user_id=user_id)
            return IngestResponseDTO(success=False, url=f"file://{file.filename}", message="No textual content extracted.")
            
        req = IngestRequestDTO(
            url=f"file://{file.filename}",
            text=content,
            title=file.filename,
            session_id=session_id,
            tenant_id=tenant_id,
        )
        req.user_id = user_id
        
        return await self.ingest_text(req, api_keys)

    async def ingest_bytes(self, data: bytes, filename: str, api_keys: Dict[str, str], session_id: str = None, user_id: str = None, workspace_id: str = None) -> IngestResponseDTO:
        """Process raw bytes (e.g. from a direct download) without requiring an UploadFile."""
        session_id = session_id or str(uuid.uuid4())
        self._notify(session_id, "processing", f"Processing research material: {filename}...", 5, user_id=user_id)
        
        content = ""
        ext = filename.split('.')[-1].lower() if '.' in filename else ""
        
        try:
            if ext == "pdf":
                import io
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(data))
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        content += text + "\n"
            else:
                content = data.decode('utf-8', errors='replace')
        except Exception as e:
            self._notify(session_id, "failed", f"Failed to parse research material: {e}", user_id=user_id)
            return IngestResponseDTO(success=False, url=f"bytes://{filename}", message=f"Parse error: {str(e)}")
            
        if not content.strip():
            return IngestResponseDTO(success=False, url=f"bytes://{filename}", message="No textual content extracted.")
            
        req = IngestRequestDTO(
            url=f"research://{filename}",
            text=content,
            title=filename,
            session_id=session_id,
        )
        req.user_id = user_id
        req.workspace_id = workspace_id
        
        return await self.ingest_text(req, api_keys)

    async def ingest_repo(self, repo_url: str, api_keys: Dict[str, str], target_lang: str = "auto", session_id: str = None, user_id: str = None, workspace_id: str = None, **kwargs) -> IngestResponseDTO:
        """Handles repository ingestion by calling repo_ingester logic."""
        from repo_ingester import ingest_repository
        
        # This will now be awaited as ingest_repository is async
        result = await ingest_repository(
            repo_url=repo_url,
            target_lang=target_lang,
            api_keys=api_keys,
            session_id=session_id,
            user_id=user_id,
            workspace_id=workspace_id
        )
        
        if result.get("success"):
            return IngestResponseDTO(success=True, url=repo_url, message=result.get("message", "Repo ingested."))
        else:
            return IngestResponseDTO(success=False, url=repo_url, message=result.get("message", "Repo ingestion failed."))

    def get_embedding(self, text: str, api_keys: dict = None) -> List[float]:
        """Provides a single embedding for a string."""
        client = get_gemini_client(api_keys or self.api_keys)
        res = client.models.embed_content(model="gemini-embedding-001", contents=text)
        return pad_embedding(res.embeddings[0].values)
