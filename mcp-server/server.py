"""
SnapMind MCP Server
Exposes the SnapMind RAG backend as MCP tools, resources, and prompts.
Transport: stdio (JSON-RPC 2.0)
"""
import anyio
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

# --- Tool Handlers (modular) ---
from tools.search import handle_search
from tools.chat import handle_chat
from tools.ingest import handle_ingest_url, handle_ingest_file, handle_ingest_repo, handle_ingest_status
from tools.research import handle_web_research
from tools.personas import handle_list_personas, handle_get_analytics

# --- Resource Handlers (modular) ---
from resources.kb import read_kb_stats, read_kb_tags
from resources.sessions import read_session_history

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
    ]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Resource Definitions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@server.list_resources()
async def handle_list_resources():
    return [
        Resource(uri="snapmind://kb/stats", name="Knowledge Base Statistics", mimeType="application/json"),
        Resource(uri="snapmind://kb/tags", name="Knowledge Base Tags", mimeType="application/json"),
        Resource(uri="snapmind://sessions/{id}/history", name="Session Chat History", mimeType="application/json"),
    ]


@server.read_resource()
async def handle_read_resource(uri: str):
    if uri == "snapmind://kb/stats":
        return await read_kb_stats()
    elif uri == "snapmind://kb/tags":
        return await read_kb_tags()
    elif uri.startswith("snapmind://sessions/") and uri.endswith("/history"):
        session_id = uri.split("/")[2]
        return await read_session_history(session_id)
    else:
        raise ValueError(f"Unknown resource: {uri}")


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
                            f"Please search my research notebook using the `snapmind_search` tool with query '{topic}'. "
                            f"Summarize the key findings, trends, and top sources saved in my notebook."
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
TOOL_HANDLERS = {
    "snapmind_search": handle_search,
    "snapmind_chat": handle_chat,
    "snapmind_ingest_url": handle_ingest_url,
    "snapmind_ingest_file": handle_ingest_file,
    "snapmind_ingest_repo": handle_ingest_repo,
    "snapmind_web_research": handle_web_research,
    "snapmind_list_personas": handle_list_personas,
    "snapmind_get_analytics": handle_get_analytics,
    "snapmind_ingest_status": handle_ingest_status,
}


@server.call_tool()
async def handle_call_tool(name: str, arguments: dict):
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        raise ValueError(f"Unknown tool: {name}")
    return await handler(arguments)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Entry Point
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
