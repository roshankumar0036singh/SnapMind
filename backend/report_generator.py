import os
from docx import Document
from docx.shared import Inches
from search import get_mistral_client
from database import get_db_pool
from psycopg.rows import dict_row

class ReportGenerator:
    def __init__(self, api_keys):
        self.api_keys = api_keys
        self.client = get_mistral_client(api_keys)

    def generate(self, session_id, query):
        """
        Synthesize a full research report for a given session.
        Fetches ALL relevant blocks without character capping.
        """
        print(f"[ReportGenerator] Generating report for session {session_id} - Query: {query}")
        
        # 1. Fetch all blocks for this session from the DB
        pool = get_db_pool()
        blocks = []
        try:
            with pool.connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    cur.execute(
                        "SELECT source_url, content FROM documents WHERE metadata->>'session_id' = %s",
                        (session_id,)
                    )
                    blocks = cur.fetchall()
                    
                    # Also fetch bookmarks for this session
                    cur.execute(
                        "SELECT source_url, content FROM bookmarks WHERE metadata->>'session_id' = %s",
                        (session_id,)
                    )
                    bookmarks = cur.fetchall()
        except Exception as e:
            print(f"[ReportGenerator] Error fetching session data: {e}")

        if not blocks and not bookmarks:
            print("[ReportGenerator] No data found in DB for this session.")
            return "INGESTION_PENDING"

        # 2. Prepare Context (Unlimited)
        context_parts = []
        if blocks:
            context_parts.append("### WEB SEARCH EVIDENCE")
            for b in blocks:
                context_parts.append(f"Source: {b['source_url']}\nContent: {b['content']}")
        
        if bookmarks:
            context_parts.append("### USER-SAVED KEY HIGHLIGHTS")
            for bm in bookmarks:
                context_parts.append(f"Source: {bm['source_url']}\nContent: {bm['content']}")
        
        full_context = "\n\n---\n\n".join(context_parts)
        
        # 3. Synthesize via Mistral
        prompt = f"""You are a professional academic research scientist. 
Synthesize a formal **Systematic Research Paper** based on the following web search data.

User Query/Topic: {query}

Analytical Context:
{full_context}

The paper MUST follow this professional academic structure:
1. **Title Page** (Derived from query)
2. **Abstract** (A concise summary of findings)
3. **Introduction** (Problem statement and research objectives)
4. **Literature Review & Current Landscape** (Synthesis of the provided source data)
5. **Methodology** (Overview of how the data was gathered via automated web research)
6. **Core Analysis & Findings** (Broken down into logical, thematic sub-sections)
7. **Discussion & Implications** (Critical analysis of the gathered data)
8. **Conclusion** (Summary and future outlook)
9. **References** (Comprehensive list of URLs with source titles)

Instruction: 
- Use a formal, objective, academic tone.
- Be exhaustive and detailed. This should feel like a high-quality peer-reviewed publication.
- Use Markdown headers (#, ##, ###) for structure; these will be converted to Docx styles.
- Do not use placeholders; if information is missing from context, focus on interpreting what *is* available.
"""
        try:
            response = self.client.chat.complete(
                model='mistral-large-latest',
                messages=[{"role": "user", "content": prompt}]
            )
            report_text = response.choices[0].message.content
        except Exception as e:
            print(f"[ReportGenerator] LLM Error: {e}")
            return None

        # 4. Create Docx
        doc = Document()
        doc.add_heading(f"Research Report: {query}", 0)
        
        # Simple Markdown-to-Docx conversion (headers and paragraphs)
        lines = report_text.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if line.startswith('###'):
                doc.add_heading(line.lstrip('#').strip(), 3)
            elif line.startswith('##'):
                doc.add_heading(line.lstrip('#').strip(), 2)
            elif line.startswith('#'):
                doc.add_heading(line.lstrip('#').strip(), 1)
            else:
                # Basic bullet point detection
                if line.startswith('- ') or line.startswith('* '):
                    doc.add_paragraph(line[2:], style='List Bullet')
                else:
                    doc.add_paragraph(line)

        # 5. Save to temporary file
        import tempfile
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, f"report_{session_id}.docx")
        doc.save(file_path)
        return file_path
