"""
pytest configuration — ensures the mcp-server root is on sys.path
so that `from snapmind_mcp.tools.search import ...` works when running tests from
any working directory.
"""
import sys
import os

# Add the mcp-server root (parent of this tests/ folder) to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
