"""
SnapMind MCP Server
Exposes the SnapMind RAG backend as MCP tools, resources, and prompts.
Transport: stdio (JSON-RPC 2.0)
"""
import anyio
import traceback
from mcp.server.stdio import stdio_server
from mcp.server import Server
from mcp.types import (
    Resource,
    Tool,
    Prompt,
    PromptArgument,
    TextContent,
    GetPromptResult,
    PromptMessage,
)
import httpx

# --- Tool Handlers (modular) ---
from snapmind_mcp.tools.search import handle_search
from snapmind_mcp.tools.chat import handle_chat
from snapmind_mcp.tools.ingest import handle_ingest_url, handle_ingest_file, handle_ingest_repo, handle_ingest_status
from snapmind_mcp.tools.research import handle_web_research, handle_deep_research, handle_generate_report, handle_live_scrape, handle_person_intelligence, handle_agent_debate, handle_cross_lingual_research
from snapmind_mcp.tools.personas import handle_list_personas, handle_get_analytics
from snapmind_mcp.tools.bookmarks import handle_create_bookmark, handle_list_bookmarks, handle_delete_bookmark
from snapmind_mcp.tools.graph import handle_knowledge_graph
from snapmind_mcp.tools.sites import handle_list_sites, handle_delete_site
from snapmind_mcp.tools.translate import handle_translate
from snapmind_mcp.tools.vision import handle_analyze_image, handle_see_screen
from snapmind_mcp.tools.export import handle_export_site, handle_export_session

# --- Resource Handlers (modular) ---
from snapmind_mcp.resources.kb import read_kb_stats, read_kb_tags, read_kb_sites
from snapmind_mcp.resources.sessions import read_session_history
from snapmind_mcp.resources.graph import read_graph_full, read_graph_sessions

# --- Config ---
from snapmind_mcp.config import close_client, BACKEND_URL, API_PREFIX, get_headers, get_client

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Server Instance
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
server = Server("snapmind")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Tool Definitions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@server.list_tools()
async def handle_list_tools():
    return [
        Tool(
            name="snapmind_search",
            description="Semantic search across the entire SnapMind RAG knowledge base (documents, bookmarks, chat history).",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query"},
                    "limit": {"type": "number", "description": "Max results (default 10)", "default": 10}
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="snapmind_chat",
            description="Ask a question with full RAG context from your SnapMind knowledge base. Supports persona selection.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The question to ask"},
                    "site_id": {"type": "string", "description": "Optional: restrict to a specific site UUID"},
                    "session_id": {"type": "string", "description": "Optional: continue a conversation session"},
                    "persona_id": {"type": "string", "description": "Optional: use a custom persona (UUID)"}
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="snapmind_ingest_url",
            description="Index a website URL into the SnapMind knowledge base for future retrieval.",
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The URL to index"},
                    "crawl_mode": {"type": "string", "enum": ["single", "multi"], "default": "single"},
                    "max_pages": {"type": "number", "description": "Max pages to crawl (multi mode)", "default": 20}
                },
                "required": ["url"]
            }
        ),
        Tool(
            name="snapmind_ingest_file",
            description="Index a local file (PDF, DOCX, CSV, TXT) into the SnapMind knowledge base.",
            inputSchema={
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Absolute path to the local file"}
                },
                "required": ["file_path"]
            }
        ),
        Tool(
            name="snapmind_ingest_repo",
            description="Clone and index an entire GitHub repository into the knowledge base.",
            inputSchema={
                "type": "object",
                "properties": {
                    "repo_url": {"type": "string", "description": "GitHub repository URL"}
                },
                "required": ["repo_url"]
            }
        ),
        Tool(
            name="snapmind_ingest_status",
            description="Poll the status of a background repository ingestion job started by snapmind_ingest_repo.",
            inputSchema={
                "type": "object",
                "properties": {
                    "job_id": {"type": "string", "description": "Job ID returned by snapmind_ingest_repo"}
                },
                "required": ["job_id"]
            }
        ),
        Tool(
            name="snapmind_web_research",
            description="Deep multi-agent web research on a topic using SnapMind browser agents. Returns a synthesized report with citations.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The topic to research"},
                    "session_id": {"type": "string", "description": "Optional session ID"}
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="snapmind_deep_research",
            description="Multi-hop reasoning chain across web and local sources.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The research query"},
                    "session_id": {"type": "string", "description": "Optional session ID"},
                    "target_language": {"type": "string", "description": "Optional target language"}
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="snapmind_generate_report",
            description="Generate a comprehensive research report (DOCX) spanning multiple sessions.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Report title/query"},
                    "session_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of session IDs to include"
                    },
                    "workspace_id": {"type": "string", "description": "Optional workspace ID"}
                },
                "required": ["query", "session_ids"]
            }
        ),
        Tool(
            name="snapmind_list_personas",
            description="List all available AI personas in your SnapMind account.",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="snapmind_get_analytics",
            description="Get SnapMind knowledge base statistics: document count, bookmarks, sessions, storage usage.",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="snapmind_create_bookmark",
            description="Save a research snippet as a bookmark with semantic search support.",
            inputSchema={
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "Text content to save"},
                    "source_url": {"type": "string", "description": "Source URL"},
                    "metadata": {"type": "object", "description": "Optional metadata"},
                    "workspace_id": {"type": "string", "description": "Optional workspace ID"}
                },
                "required": ["content"]
            }
        ),
        Tool(
            name="snapmind_list_bookmarks",
            description="List all saved bookmarks.",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="snapmind_delete_bookmark",
            description="Delete a specific bookmark by ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "bookmark_id": {"type": "string", "description": "ID of the bookmark to delete"}
                },
                "required": ["bookmark_id"]
            }
        ),
        Tool(
            name="snapmind_knowledge_graph",
            description="Get a summary of the full knowledge graph (nodes + edges).",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="snapmind_list_sites",
            description="List all indexed sites from unique source URLs.",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="snapmind_delete_site",
            description="Delete an indexed site and all its documents.",
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "Source URL of the site"}
                },
                "required": ["url"]
            }
        ),
        Tool(
            name="snapmind_translate",
            description="Translate text between languages using the configured translation model.",
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Text to translate"},
                    "target_lang": {"type": "string", "description": "Target language (e.g. 'French', 'Spanish')", "default": "English"}
                },
                "required": ["text"]
            }
        ),
        Tool(
            name="snapmind_analyze_image",
            description="Analyze an image (QA or OCR) via the Vision model.",
            inputSchema={
                "type": "object",
                "properties": {
                    "image_path": {"type": "string", "description": "Absolute path to local image"},
                    "prompt": {"type": "string", "description": "Prompt or question for the image", "default": "Describe this image."},
                    "mode": {"type": "string", "description": "'qa' or 'ocr'", "default": "qa"},
                    "target_lang": {"type": "string", "description": "Optional target language"}
                },
                "required": ["image_path"]
            }
        ),
        Tool(
            name="snapmind_see_screen",
            description="Take a local screenshot of the user's screen and return it to the AI. Use this when the user asks you to 'look' at their screen.",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="snapmind_export_site",
            description="Export all indexed content for a given source URL as text or json.",
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The source URL to export"},
                    "format": {"type": "string", "description": "'text' or 'json'", "default": "text"}
                },
                "required": ["url"]
            }
        ),
        Tool(
            name="snapmind_export_session",
            description="Export all knowledge (chat, sources, graph) from a specific session.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID to export"},
                    "format": {"type": "string", "description": "'json', 'markdown', or 'csv'", "default": "markdown"}
                },
                "required": ["session_id"]
            }
        ),
        Tool(
            name="snapmind_live_scrape",
            description="Instantly scrape a URL into clean markdown without saving it to the database. Useful for reading live news or one-off pages.",
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The URL to scrape"}
                },
                "required": ["url"]
            }
        ),
        Tool(
            name="snapmind_person_intelligence",
            description="Use autonomous OSINT agents to profile a person by name. Automatically scrapes LinkedIn and other sources, bypassing basic walls.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The name or query of the person to profile (e.g. 'Profile Sarthak Chandekar')"},
                    "session_id": {"type": "string", "description": "Optional session ID to store the OSINT data", "default": "mcp-osint"}
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="snapmind_agent_debate",
            description="Adversarial RAG Mode: Spin up two independent AI agents to research and debate a topic from opposing viewpoints.",
            inputSchema={
                "type": "object",
                "properties": {
                    "topic": {"type": "string", "description": "The controversial topic to debate"},
                    "session_id": {"type": "string", "description": "Optional session ID", "default": "mcp-debate"}
                },
                "required": ["topic"]
            }
        ),
        Tool(
            name="snapmind_cross_lingual_research",
            description="The Babel Fish: Autonomously research a topic strictly in a foreign language (e.g. Mandarin Chinese) and translate the synthesized findings back to English.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The topic to research"},
                    "search_lang": {"type": "string", "description": "The language to search and scrape in", "default": "Mandarin Chinese"},
                    "target_lang": {"type": "string", "description": "The language to return the final answer in", "default": "English"},
                    "session_id": {"type": "string", "description": "Optional session ID", "default": "mcp-babel"}
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="snapmind_health_check",
            description="Check connectivity to the SnapMind backend.",
            inputSchema={"type": "object", "properties": {}}
        ),
    ]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Resource Definitions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@server.list_resources()
async def handle_list_resources():
    return [
        Resource(uri="snapmind://kb/stats", name="Knowledge Base Statistics", mimeType="application/json"),
        Resource(uri="snapmind://kb/tags", name="Knowledge Base Tags", mimeType="application/json"),
        Resource(uri="snapmind://kb/sites", name="Indexed Sites", mimeType="application/json"),
        Resource(uri="snapmind://sessions/{id}/history", name="Session Chat History", mimeType="application/json"),
        Resource(uri="snapmind://graph/full", name="Full Knowledge Graph", mimeType="application/json"),
        Resource(uri="snapmind://graph/sessions", name="Sessions with Graph Data", mimeType="application/json"),
    ]


@server.read_resource()
async def handle_read_resource(uri: str):
    try:
        if uri == "snapmind://kb/stats":
            return await read_kb_stats()
        elif uri == "snapmind://kb/tags":
            return await read_kb_tags()
        elif uri == "snapmind://kb/sites":
            return await read_kb_sites()
        elif uri == "snapmind://graph/full":
            return await read_graph_full()
        elif uri == "snapmind://graph/sessions":
            return await read_graph_sessions()
        elif uri.startswith("snapmind://sessions/") and uri.endswith("/history"):
            session_id = uri.split("/")[2]
            return await read_session_history(session_id)
        else:
            raise ValueError(f"Unknown resource: {uri}")
    except Exception as e:
        return f"Error reading resource: {str(e)}"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Prompt Templates
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@server.list_prompts()
async def handle_list_prompts():
    return [
        Prompt(
            name="research_topic",
            description="Deep research on a specific topic using SnapMind agents.",
            arguments=[
                PromptArgument(name="topic", description="The topic to research", required=True)
            ]
        ),
        Prompt(
            name="code_review",
            description="Review a codebase against SnapMind's indexed best practices and documentation.",
            arguments=[
                PromptArgument(name="context", description="What to review (e.g. recent changes, a specific module)", required=True)
            ]
        ),
        Prompt(
            name="summarize_notebook",
            description="Summarize your research notebook or saved bookmarks on a topic.",
            arguments=[
                PromptArgument(name="topic", description="The topic to summarize", required=False)
            ]
        ),
        Prompt(
            name="deep_dive",
            description="Use deep multi-hop reasoning on a complex topic.",
            arguments=[
                PromptArgument(name="topic", description="The complex topic to research deeply", required=True)
            ]
        ),
        Prompt(
            name="compare_sources",
            description="Compare and contrast two specific indexed sites.",
            arguments=[
                PromptArgument(name="site1_url", description="First site URL", required=True),
                PromptArgument(name="site2_url", description="Second site URL", required=True)
            ]
        ),
        Prompt(
            name="export_knowledge",
            description="Export data for a site and summarize the contents.",
            arguments=[
                PromptArgument(name="url", description="Site URL to export and summarize", required=True)
            ]
        ),
    ]


@server.get_prompt()
async def handle_get_prompt(name: str, arguments: dict):
    if name == "research_topic":
        topic = arguments.get("topic")
        return GetPromptResult(
            description=f"Deep research on {topic}",
            messages=[
                PromptMessage(
                    role="user",
                    content=TextContent(
                        type="text",
                        text=(
                            f"Please use the `snapmind_web_research` tool to perform a deep investigation into '{topic}'. "
                            f"Then, search my existing knowledge base with `snapmind_search` to see if we have any prior context. "
                            f"Finally, synthesize a comprehensive report combining both new and existing knowledge."
                        )
                    )
                )
            ]
        )
    elif name == "code_review":
        context = arguments.get("context")
        return GetPromptResult(
            description=f"Code review for {context}",
            messages=[
                PromptMessage(
                    role="user",
                    content=TextContent(
                        type="text",
                        text=(
                            f"Using the context of '{context}', please search my knowledge base for relevant architectural patterns "
                            f"or best practices using the `snapmind_search` tool. Then, provide a detailed review of the code "
                            f"based on those findings."
                        )
                    )
                )
            ]
        )
    elif name == "summarize_notebook":
        topic = arguments.get("topic", "general")
        return GetPromptResult(
            description=f"Summarizing research on {topic}",
            messages=[
                PromptMessage(
                    role="user",
                    content=TextContent(
                        type="text",
                        text=(
                            f"Please list my bookmarks using the `snapmind_list_bookmarks` tool or search with query '{topic}'. "
                            f"Summarize the key findings, trends, and top sources saved in my notebook."
                        )
                    )
                )
            ]
        )
    elif name == "deep_dive":
        topic = arguments.get("topic")
        return GetPromptResult(
            description=f"Deep dive into {topic}",
            messages=[
                PromptMessage(
                    role="user",
                    content=TextContent(
                        type="text",
                        text=(
                            f"Use the `snapmind_deep_research` tool to perform multi-hop reasoning on '{topic}'. "
                            f"Provide a detailed, step-by-step reasoning chain and a final comprehensive answer."
                        )
                    )
                )
            ]
        )
    elif name == "compare_sources":
        site1 = arguments.get("site1_url")
        site2 = arguments.get("site2_url")
        return GetPromptResult(
            description=f"Compare {site1} and {site2}",
            messages=[
                PromptMessage(
                    role="user",
                    content=TextContent(
                        type="text",
                        text=(
                            f"First, use `snapmind_chat` to ask about '{site1}' specifically by setting site_id. "
                            f"Then, do the same for '{site2}'. "
                            f"Compare and contrast the information from both sources."
                        )
                    )
                )
            ]
        )
    elif name == "export_knowledge":
        url = arguments.get("url")
        return GetPromptResult(
            description=f"Export and summarize {url}",
            messages=[
                PromptMessage(
                    role="user",
                    content=TextContent(
                        type="text",
                        text=(
                            f"Use `snapmind_export_site` to get the content of '{url}'. "
                            f"Then, analyze the exported data and provide a concise summary of its main points."
                        )
                    )
                )
            ]
        )
    else:
        raise ValueError(f"Unknown prompt: {name}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Tool Dispatcher
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async def handle_health_check(arguments: dict):
    """Check connectivity to the SnapMind backend."""
    try:
        async with get_client(timeout=10.0) as client:
            response = await client.get(f"{BACKEND_URL}/api/v1/health")
            if response.status_code == 200:
                data = response.json()
                return [TextContent(type="text", text=f"SnapMind Backend is healthy. Status: {data.get('status')} at {BACKEND_URL}")]
            else:
                return [TextContent(type="text", text=f"Backend unreachable. HTTP {response.status_code}: {response.text}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Connection failed: {str(e)}")]

TOOL_HANDLERS = {
    "snapmind_search": handle_search,
    "snapmind_chat": handle_chat,
    "snapmind_ingest_url": handle_ingest_url,
    "snapmind_ingest_file": handle_ingest_file,
    "snapmind_ingest_repo": handle_ingest_repo,
    "snapmind_ingest_status": handle_ingest_status,
    "snapmind_web_research": handle_web_research,
    "snapmind_deep_research": handle_deep_research,
    "snapmind_generate_report": handle_generate_report,
    "snapmind_list_personas": handle_list_personas,
    "snapmind_get_analytics": handle_get_analytics,
    "snapmind_create_bookmark": handle_create_bookmark,
    "snapmind_list_bookmarks": handle_list_bookmarks,
    "snapmind_delete_bookmark": handle_delete_bookmark,
    "snapmind_knowledge_graph": handle_knowledge_graph,
    "snapmind_list_sites": handle_list_sites,
    "snapmind_delete_site": handle_delete_site,
    "snapmind_translate": handle_translate,
    "snapmind_analyze_image": handle_analyze_image,
    "snapmind_see_screen": handle_see_screen,
    "snapmind_export_site": handle_export_site,
    "snapmind_export_session": handle_export_session,
    "snapmind_live_scrape": handle_live_scrape,
    "snapmind_person_intelligence": handle_person_intelligence,
    "snapmind_agent_debate": handle_agent_debate,
    "snapmind_cross_lingual_research": handle_cross_lingual_research,
    "snapmind_health_check": handle_health_check,
}


@server.call_tool()
async def handle_call_tool(name: str, arguments: dict):
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        raise ValueError(f"Unknown tool: {name}")
        
    try:
        return await handler(arguments)
    except httpx.TimeoutException:
        return [TextContent(type="text", text=f"Error: Connection to SnapMind backend timed out.")]
    except httpx.RequestError as e:
        return [TextContent(type="text", text=f"Error connecting to SnapMind backend: {str(e)}")]
    except Exception as e:
        # Catch all to prevent server crash
        error_trace = traceback.format_exc()
        return [TextContent(type="text", text=f"Unexpected error executing {name}: {str(e)}\n\nTraceback:\n{error_trace}")]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Entry Point
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async def async_main():
    try:
        async with stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream,
                write_stream,
                server.create_initialization_options()
            )
    finally:
        await close_client()

def main():
    import asyncio
    asyncio.run(async_main())

if __name__ == "__main__":
    main()
