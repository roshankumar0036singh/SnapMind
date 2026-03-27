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
    ImageContent,
    EmbeddedResource,
)
import httpx
import json
import os

from config import BACKEND_URL, get_headers

# Create the server
server = Server("snapmind")

@server.list_tools()
async def handle_list_tools():
    return [
        Tool(
            name="search",
            description="Performs a semantic search across the entire RAG knowledge base (documents, bookmarks, and chat history).",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query"},
                    "limit": {"type": "number", "description": "Maximum number of results (default 10)", "default": 10}
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="chat",
            description="Ask a question to the SnapMind RAG knowledge base. Uses indexed data to provide cited answers.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The question to ask"},
                    "site_id": {"type": "string", "description": "Optional: Restrict answer to a specific site UUID or URL"},
                    "session_id": {"type": "string", "description": "Optional: Continue a specific conversation session"},
                    "persona_id": {"type": "string", "description": "Optional: UUID of a custom persona to use"}
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="ingest_url",
            description="Index a website URL into the SnapMind knowledge base.",
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The URL to index"},
                    "crawl_mode": {"type": "string", "enum": ["single", "multi"], "default": "single"},
                    "max_pages": {"type": "number", "default": 20}
                },
                "required": ["url"]
            }
        ),
        Tool(
            name="ingest_file",
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
            name="ingest_repo",
            description="Clone and index an entire GitHub repository into the knowledge base.",
            inputSchema={
                "type": "object",
                "properties": {
                    "repo_url": {"type": "string", "description": "GitHub repository URL (ending in .git)"}
                },
                "required": ["repo_url"]
            }
        ),
        Tool(
            name="web_research",
            description="Perform deep multi-agent research on a topic using the SnapMind browser agents.",
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
            name="list_personas",
            description="List all available AI personas in your SnapMind account.",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="get_analytics",
            description="Get library statistics.",
            inputSchema={"type": "object", "properties": {}}
        )
    ]

@server.list_resources()
async def handle_list_resources():
    return [
        Resource(uri="snapmind://kb/stats", name="Knowledge Base Statistics", mimeType="application/json"),
        Resource(uri="snapmind://kb/tags", name="Knowledge Base Tags", mimeType="application/json")
    ]

@server.read_resource()
async def handle_read_resource(uri: str):
    async with httpx.AsyncClient(timeout=30.0) as client:
        headers = get_headers()
        if uri == "snapmind://kb/stats":
            resp = await client.get(f"{BACKEND_URL}/admin/analytics", headers=headers)
            return resp.text
        elif uri == "snapmind://kb/tags":
            resp = await client.get(f"{BACKEND_URL}/tags", headers=headers)
            return resp.text
        else:
            raise ValueError(f"Unknown resource: {uri}")

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
            description="Review a codebase or specific file against SnapMind's indexed best practices.",
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
        )
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
                        text=f"Please use the `web_research` tool to perform a deep investigation into '{topic}'. Then, search my existing knowledge base with `search` to see if we have any prior context. Finally, synthesize a comprehensive report."
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
                        text=f"Using the context of '{context}', please search my knowledge base for relevant architectural patterns or best practices using the `search` tool. Then, provide a detailed review of the code based on those findings."
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
                        text=f"Please search my research notebook (bookmarks) using the `search` tool with query '{topic}' and filter for bookmarks. Summarize the key findings, trends, and top sources saved in my notebook."
                    )
                )
            ]
        )
    else:
        raise ValueError(f"Unknown prompt: {name}")

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict):
    async with httpx.AsyncClient(timeout=60.0) as client:
        headers = get_headers()
        
        if name == "search":
            query = arguments.get("query")
            limit = arguments.get("limit", 10)
            
            response = await client.post(
                f"{BACKEND_URL}/search/global",
                json={"query": query, "limit": limit},
                headers=headers
            )
            data = response.json()
            if not data.get("success"):
                return [TextContent(type="text", text=f"Search failed: {data.get('error', 'Unknown error')}")]
            
            results = data.get("results", [])
            if not results:
                return [TextContent(type="text", text="No results found in your knowledge base.")]
                
            formatted = "\n\n".join([
                f"[{r['type'].upper()}] {r['url']}\nScore: {r['score']:.2f}\nContent: {r['content'][:300]}..."
                for r in results
            ])
            return [TextContent(type="text", text=f"Found {len(results)} matches:\n\n{formatted}")]

        elif name == "chat":
            response = await client.post(
                f"{BACKEND_URL}/chat",
                json={
                    "query": arguments.get("query"),
                    "site_id": arguments.get("site_id"),
                    "session_id": arguments.get("session_id"),
                    "persona_id": arguments.get("persona_id")
                },
                headers=headers
            )
            data = response.json()
            if "error" in data:
                return [TextContent(type="text", text=f"Chat error: {data['error']}")]
            
            return [TextContent(type="text", text=data.get("answer", ""))]

        elif name == "ingest_url":
            response = await client.post(
                f"{BACKEND_URL}/ingest",
                json={
                    "url": arguments.get("url"),
                    "crawl_mode": arguments.get("crawl_mode", "single"),
                    "max_pages": arguments.get("max_pages", 20)
                },
                headers=headers
            )
            data = response.json()
            if not data.get("success"):
                return [TextContent(type="text", text=f"Ingestion failed: {data.get('error', 'Unknown error')}")]
            return [TextContent(type="text", text=f"✅ Successfully queued: {arguments['url']}")]

        elif name == "ingest_file":
            path = arguments.get("file_path")
            if not os.path.exists(path):
                return [TextContent(type="text", text=f"Error: File '{path}' not found.")]
            
            with open(path, "rb") as f:
                files = {"file": (os.path.basename(path), f)}
                response = await client.post(
                    f"{BACKEND_URL}/ingest/file",
                    files=files,
                    headers={k: v for k, v in headers.items() if k.lower() != "content-type"}
                )
            data = response.json()
            if not data.get("success"):
                return [TextContent(type="text", text=f"File ingestion failed: {data.get('error', 'Unknown error')}")]
            return [TextContent(type="text", text=f"✅ Successfully indexed file: {os.path.basename(path)}")]

        elif name == "ingest_repo":
            response = await client.post(
                f"{BACKEND_URL}/ingest/github",
                json={"repo_url": arguments.get("repo_url")},
                headers=headers
            )
            data = response.json()
            if not data.get("success"):
                return [TextContent(type="text", text=f"Repo ingestion failed: {data.get('error', 'Unknown error')}")]
            return [TextContent(type="text", text=f"🚀 Started indexing repo: {arguments['repo_url']}\nJob ID: {data.get('job_id')}")]

        elif name == "web_research":
            response = await client.post(
                f"{BACKEND_URL}/browser/research",
                json={"query": arguments.get("query"), "session_id": arguments.get("session_id")},
                headers=headers
            )
            data = response.json()
            if "error" in data:
                return [TextContent(type="text", text=f"Research error: {data['error']}")]
            return [TextContent(type="text", text=data.get("answer", ""))]

        elif name == "list_personas":
            response = await client.get(f"{BACKEND_URL}/personas", headers=headers)
            data = response.json()
            if not data.get("success"):
                return [TextContent(type="text", text="Failed to fetch personas.")]
            
            personas = data.get("personas", [])
            if not personas:
                return [TextContent(type="text", text="No custom personas found.")]
                
            formatted = "\n".join([f"- {p['name']} (ID: {p['id']})" for p in personas])
            return [TextContent(type="text", text=f"Available Custom Personas:\n{formatted}")]

        elif name == "get_analytics":
            response = await client.get(
                f"{BACKEND_URL}/admin/analytics",
                headers=headers
            )
            data = response.json()
            if "error" in data:
                return [TextContent(type="text", text=f"Analytics error: {data['error']}")]
                
            stats = (
                f"📊 SnapMind Library Stats:\n"
                f"- Documents Indexed: {data.get('docs', 0)}\n"
                f"- Bookmarks Saved: {data.get('bookmarks', 0)}\n"
                f"- Total Sessions: {data.get('sessions', 0)}\n"
                f"- Storage Used: {data.get('storage', '0 B')}\n"
                f"- Health: {data.get('health', 'unknown')}"
            )
            return [TextContent(type="text", text=stats)]

        else:
            raise ValueError(f"Unknown tool: {name}")

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
