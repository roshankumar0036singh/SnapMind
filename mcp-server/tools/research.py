"""
SnapMind MCP Tools — Web Research
Wraps POST /api/v1/research/research, POST /api/v1/research/deep-research, POST /api/v1/research/generate_report
"""
from mcp.types import TextContent
from config import BACKEND_URL, API_PREFIX, get_headers, get_client

async def handle_web_research(arguments: dict) -> list[TextContent]:
    """Deep multi-agent web research with synthesis and citations."""
    async with get_client(timeout=120.0) as client:
        response = await client.post(
            f"{BACKEND_URL}{API_PREFIX}/research/research",
            json={
                "query": arguments.get("query"),
                "session_id": arguments.get("session_id"),
            },
            headers=get_headers()
        )
        data = response.json()

    if "error" in data or "detail" in data:
        return [TextContent(type="text", text=f"Research error: {data.get('error', data.get('detail', 'Unknown error'))}")]

    answer = data.get("answer", "")
    sources = data.get("sources", [])

    text = answer
    if sources:
        text += "\n\nResearch Sources:\n" + "\n".join([f"- {s}" for s in sources])

    return [TextContent(type="text", text=text)]

async def handle_deep_research(arguments: dict) -> list[TextContent]:
    """Multi-hop reasoning chain across web and local sources."""
    async with get_client(timeout=180.0) as client:
        response = await client.post(
            f"{BACKEND_URL}{API_PREFIX}/research/deep-research",
            json={
                "query": arguments.get("query"),
                "session_id": arguments.get("session_id"),
                "target_language": arguments.get("target_language", "auto")
            },
            headers=get_headers()
        )
        data = response.json()

    if "error" in data or "detail" in data:
         return [TextContent(type="text", text=f"Deep research error: {data.get('error', data.get('detail', 'Unknown error'))}")]
         
    return [TextContent(type="text", text=data.get("answer", "No answer returned."))]

async def handle_generate_report(arguments: dict) -> list[TextContent]:
    """Generate a comprehensive research report spanning multiple sessions."""
    async with get_client(timeout=120.0) as client:
        response = await client.post(
            f"{BACKEND_URL}{API_PREFIX}/research/generate_report",
            json={
                "query": arguments.get("query", "Comprehensive Research Report"),
                "session_ids": arguments.get("session_ids", []),
                "workspace_id": arguments.get("workspace_id", "00000000-0000-0000-0000-000000000000")
            },
            headers=get_headers()
        )
        
    if response.status_code == 202:
         return [TextContent(type="text", text="Research ingestion is still in progress. Please try generating the report again later.")]
         
    if response.status_code != 200:
         return [TextContent(type="text", text=f"Report generation failed: {response.text}")]
         
    # Assuming backend returns binary DOCX, we cannot display it directly via text
    # Let's write it to a local file
    output_path = f"Research_Report.docx"
    try:
         with open(output_path, "wb") as f:
             f.write(response.content)
         return [TextContent(type="text", text=f"Successfully generated report. Saved locally as {output_path}")]
    except Exception as e:
         return [TextContent(type="text", text=f"Failed to save generated report locally: {str(e)}")]
