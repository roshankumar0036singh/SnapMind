import asyncio
import os
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def test_mcp():
    # Provide necessary env vars so the server doesn't crash on boot if it checks them
    env = os.environ.copy()
    env["SNAPMIND_BACKEND_URL"] = "http://localhost:7860/api/v1"
    
    server_params = StdioServerParameters(
        command="snapmind-mcp", # This is the binary installed by pip
        args=[],
        env=env
    )
    
    print("Starting MCP Test Client...")
    try:
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                print("Session initialized successfully!")
                
                # List tools
                tools = await session.list_tools()
                print(f"\nFound {len(tools.tools)} tools from PyPI Package:")
                for t in tools.tools:
                    print(f"  - {t.name}")
                    
                print("\nAll MCP endpoints are registered and ready for Claude Desktop!")
    except Exception as e:
        print(f"❌ Test Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_mcp())
