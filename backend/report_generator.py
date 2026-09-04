import os
import tempfile
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from api_clients import get_mistral_client
from database import get_db_pool
from config import settings
from psycopg.rows import dict_row
from graph_logic import get_graph_context
from utils import LANG_MAP

class ReportGenerator:
    def __init__(self, api_keys):
        self.api_keys = api_keys
        self.client = get_mistral_client(api_keys, task="utility")

    def generate(self, session_ids: list, query: str, workspace_id: str = None, source_urls=None, output_lang: str = "auto", user_id: str = None):
        """
        Synthesize a comprehensive research report spanning multiple sessions.
        Includes graph context and respects multi-tenant isolation.
        """
        print(f"[ReportGenerator] Generating multi-session report for {len(session_ids)} sessions in workspace {workspace_id}")
        
        # 1. Fetch data for all sessions
        pool = get_db_pool()
        blocks = []
        bookmarks = []
        try:
            with pool.connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    # Document Blocks
                    sql_docs = "SELECT source_url, content FROM documents WHERE metadata->>'session_id' = ANY(%s)"
                    params_docs = [session_ids]
                    if workspace_id:
                        sql_docs += " AND workspace_id = %s"
                        params_docs.append(workspace_id)
                    if source_urls:
                        sql_docs += " AND source_url = ANY(%s)"
                        params_docs.append(source_urls)
                    
                    cur.execute(sql_docs, tuple(params_docs))
                    blocks = cur.fetchall()
                    
                    # Bookmarks
                    sql_bm = "SELECT source_url, content FROM bookmarks WHERE metadata->>'session_id' = ANY(%s)"
                    params_bm = [session_ids]
                    if workspace_id:
                        sql_bm += " AND workspace_id = %s"
                        params_bm.append(workspace_id)
                    if source_urls:
                        sql_bm += " AND source_url = ANY(%s)"
                        params_bm.append(source_urls)
                        
                    cur.execute(sql_bm, tuple(params_bm))
                    bookmarks = cur.fetchall()
        except Exception as e:
            print(f"[ReportGenerator] Error fetching session data: {e}")

        if not blocks and not bookmarks:
            print("[ReportGenerator] No data found for specified filters.")
            return "INGESTION_PENDING"

        # 2. Extract Graph Context for the Query - correctly scope to user_id
        graph_text = get_graph_context(query, api_keys=self.api_keys, user_id=user_id, workspace_id=workspace_id)

        # 3. Prepare Lang-Aware Synthesis
        lang_name = LANG_MAP.get(output_lang, output_lang) if output_lang != "auto" else "English"
        
        context_parts = []
        if graph_text:
            context_parts.append(f"### ENTITY RELATIONSHIP MAPPINGS (GRAPH)\n{graph_text}")
            
        if blocks:
            context_parts.append("### WEB SEARCH EVIDENCE")
            for b in blocks[:50]: # Limit for LLM context window
                context_parts.append(f"Source: {b['source_url']}\nContent: {b['content']}")
        
        if bookmarks:
            context_parts.append("### USER-SAVED KEY HIGHLIGHTS")
            for bm in bookmarks:
                context_parts.append(f"Source: {bm['source_url']}\nContent: {bm['content']}")
        
        full_context = "\n\n---\n\n".join(context_parts)
        
        prompt = f"""You are a professional academic research scientist. 
Synthesize a formal **Systematic Research Paper** in {lang_name} based on the following multi-session evidence.

User Query/Topic: {query}

Analytical Context (including Knowledge Graph and Search Evidence):
{full_context}

The paper MUST follow this professional academic structure:
1. **Title Page** (Derived from query)
2. **Abstract** (A concise summary of findings)
3. **Introduction** (Problem statement and research objectives)
4. **Literature Review & Current Landscape** (Synthesis of the provided source data and graph entities)
5. **Methodology** (Overview of how the data was gathered via automated multi-session research)
6. **Core Analysis & Findings** (Broken down into logical, thematic sub-sections)
7. **Discussion & Implications** (Critical analysis of the gathered data)
8. **Conclusion** (Summary and future outlook)
9. **References** (Comprehensive list of URLs)

Instruction: 
- Use a formal, objective, academic tone.
- Be exhaustive and detailed. 
- Use Markdown headers (#, ##, ###) for structure.
"""
        try:
            response = self.client.chat.complete(
                model=settings.models.mistral_large,
                messages=[{"role": "user", "content": prompt}]
            )
            report_text = response.choices[0].message.content
        except Exception as e:
            print(f"[ReportGenerator] LLM Error: {e}")
            return None

        # 4. Create Styled Docx
        doc = Document()
        
        # Title
        title = doc.add_heading(f"Research Report: {query}", 0)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        # Simple Markdown-to-Docx conversion
        lines = report_text.split('\n')
        for line in lines:
            line = line.strip()
            if not line: continue
            
            if line.startswith('###'):
                doc.add_heading(line.lstrip('#').strip(), 3)
            elif line.startswith('##'):
                doc.add_heading(line.lstrip('#').strip(), 2)
            elif line.startswith('#'):
                doc.add_heading(line.lstrip('#').strip(), 1)
            else:
                if line.startswith('- ') or line.startswith('* '):
                    doc.add_paragraph(line[2:], style='List Bullet')
                elif line.startswith('1. ') or line.startswith('2. '):
                    doc.add_paragraph(line[3:], style='List Number')
                else:
                    doc.add_paragraph(line)

        # 5. Save
        file_path = os.path.join(tempfile.gettempdir(), f"report_{session_ids[0]}.docx")
        doc.save(file_path)
        return file_path
