import type { Metadata } from 'next';
import { Terminal, Shield, Cpu, Zap, Settings, HelpCircle, Code, Layers, FileText, ArrowRight, Wrench, Book, MessageSquare } from 'lucide-react';
import CopyButton from '../package/copy-button';

export const metadata: Metadata = {
  title: 'SnapMind Model Context Protocol (MCP)',
  description: 'Setup and integrate the SnapMind Model Context Protocol (MCP) server with Cursor, Claude Desktop, or Antigravity.',
};

export default function McpPage() {
  const claudeConfigJson = `{
  "mcpServers": {
    "snapmind": {
      "command": "uvx",
      "args": [
        "snapmind-mcp"
      ],
      "env": {
        "SNAPMIND_BACKEND_URL": "https://snapmind-gateway.roshankumar30080.workers.dev",
        "SNAPMIND_API_KEY": "snp_your_generated_api_key",
        "GEMINI_API_KEY": "your-gemini-key",
        "FIRECRAWL_API_KEY": "your-firecrawl-key",
        "MISTRAL_API_KEY": "your-mistral-key",
        "LINGODEV_API_KEY": "your-lingodev-key"
      }
    }
  }
}`;

  const localConfigJson = `{
  "mcpServers": {
    "snapmind": {
      "command": "snapmind-mcp",
      "env": {
        "SNAPMIND_BACKEND_URL": "https://snapmind-gateway.roshankumar30080.workers.dev",
        "SNAPMIND_API_KEY": "snp_your_generated_api_key",
        "GEMINI_API_KEY": "your-gemini-key",
        "FIRECRAWL_API_KEY": "your-firecrawl-key",
        "MISTRAL_API_KEY": "your-mistral-key",
        "LINGODEV_API_KEY": "your-lingodev-key"
      }
    }
  }
}`;

  const toolCategories = [
    {
      title: 'Agentic Intelligence',
      tools: [
        { name: 'snapmind_see_screen', desc: 'Securely screenshots the desktop so your LLM can "see" active work' },
        { name: 'snapmind_agent_debate', desc: 'Spins up dual independent agents in memory to debate complex topics' },
        { name: 'snapmind_cross_lingual_research', desc: 'Autonomously researches foreign websites and translates findings' },
        { name: 'snapmind_person_intelligence', desc: 'Generates targeted OSINT dossiers for individuals' },
        { name: 'snapmind_live_scrape', desc: 'Extracts clean markdown from any URL without pre-indexing it' }
      ]
    },
    {
      title: 'Search & Chat',
      tools: [
        { name: 'snapmind_search', desc: 'Semantic search across documents, bookmarks, and sessions' },
        { name: 'snapmind_chat', desc: 'Chat directly with your knowledge base using custom personas' }
      ]
    },
    {
      title: 'Deep Research',
      tools: [
        { name: 'snapmind_web_research', desc: 'Multi-agent web research pipeline' },
        { name: 'snapmind_deep_research', desc: 'Multi-hop reasoning chain across web and local sources' },
        { name: 'snapmind_generate_report', desc: 'Synthesizes active chat sessions into DOCX reports' }
      ]
    },
    {
      title: 'Ingestion & Utilities',
      tools: [
        { name: 'snapmind_ingest_url', desc: 'Crawls and indexes a web page' },
        { name: 'snapmind_ingest_file', desc: 'Indexes local documents (PDF, DOCX, CSV)' },
        { name: 'snapmind_ingest_repo', desc: 'Clones and indexes full GitHub repositories' },
        { name: 'snapmind_analyze_image', desc: 'Runs Vision AI (QA/OCR) on local images' }
      ]
    }
  ];

  return (
    <main className="min-h-screen pt-16 text-gray-900 dark:text-white pb-20 selection:bg-primary-500 selection:text-white relative overflow-hidden">
      <div className="wrapper max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 relative z-10">
        
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-500/20">
            Model Context Protocol v2.1
          </span>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-gray-900 via-gray-700 to-gray-500 dark:from-white dark:via-gray-200 dark:to-gray-500 bg-clip-text text-transparent mb-6">
            SnapMind MCP Server
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-8">
            Expose the powerful capabilities of the SnapMind RAG backend to any MCP-compatible client (like Cursor, Claude Desktop, or Antigravity) with 24 available tools, deep reasoning agents, and desktop vision.
          </p>
        </div>

        {/* Setup Methods Container */}
        <div className="max-w-4xl mx-auto mb-20">
          <h2 className="text-2xl font-bold mb-8 text-center text-gray-900 dark:text-white">Choose Setup Method</h2>
          
          <div className="space-y-8">
            
            {/* Method 1: PyPI Global Install */}
            <div className="p-9 rounded-[20px] bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-[0px_30px_50px_-32px_rgba(107,110,148,0.04)] dark:shadow-none">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 font-bold text-sm">
                  1
                </span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Global Installation (Recommended)</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 leading-relaxed">
                The easiest way to use SnapMind with Claude Desktop is via <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded border border-gray-200 dark:border-gray-800">uvx</code> or <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded border border-gray-200 dark:border-gray-800">npx</code>, which pulls directly from PyPI. Add this code block to your <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded border border-gray-200 dark:border-gray-800">claude_desktop_config.json</code> file:
              </p>
              <div className="relative rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4 font-mono text-xs text-gray-700 dark:text-gray-300 overflow-x-auto leading-relaxed shadow-sm dark:shadow-none">
                <pre>{claudeConfigJson}</pre>
                <div className="absolute top-3 right-3">
                  <CopyButton text={claudeConfigJson} />
                </div>
              </div>
            </div>

            {/* Method 2: PyPI Installation */}
            <div className="p-9 rounded-[20px] bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-[0px_30px_50px_-32px_rgba(107,110,148,0.04)] dark:shadow-none">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 font-bold text-sm">
                  2
                </span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Installation via PyPI (pip)</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 leading-relaxed">
                Install the SnapMind MCP server globally from PyPI using pip:
              </p>
              <div className="max-w-xl p-1.5 bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4 mb-6 shadow-sm dark:shadow-none">
                <div className="flex items-center gap-3 pl-3 text-sm text-gray-700 dark:text-gray-300 font-mono">
                  <Terminal className="h-4 w-4 text-primary-500" />
                  <span>pip install snapmind-mcp</span>
                </div>
                <CopyButton text="pip install snapmind-mcp" />
              </div>

              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 leading-relaxed">
                Once installed, add this configuration block to your MCP client:
              </p>
              <div className="relative rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4 font-mono text-xs text-gray-700 dark:text-gray-300 overflow-x-auto leading-relaxed shadow-sm dark:shadow-none">
                <pre>{localConfigJson}</pre>
                <div className="absolute top-3 right-3">
                  <CopyButton text={localConfigJson} />
                </div>
              </div>
            </div>

            {/* Method 3: Manual Local Install */}
            <div className="p-9 rounded-[20px] bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-[0px_30px_50px_-32px_rgba(107,110,148,0.04)] dark:shadow-none">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 font-bold text-sm">
                  3
                </span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Manual Local Installation</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 leading-relaxed">
                1. Clone the repository and navigate to the <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded border border-gray-200 dark:border-gray-800">mcp-server</code> directory:
              </p>
              <div className="max-w-xl p-1.5 bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4 mb-4 shadow-sm dark:shadow-none">
                <div className="flex items-center gap-3 pl-3 text-sm text-gray-700 dark:text-gray-300 font-mono">
                  <Terminal className="h-4 w-4 text-primary-500" />
                  <span>git clone https://github.com/roshankumar0036singh/SnapMind.git && cd SnapMind/mcp-server</span>
                </div>
                <CopyButton text="git clone https://github.com/roshankumar0036singh/SnapMind.git && cd SnapMind/mcp-server" />
              </div>
              
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 leading-relaxed">
                2. Install dependencies locally:
              </p>
              <div className="max-w-xl p-1.5 bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4 mb-4 shadow-sm dark:shadow-none">
                <div className="flex items-center gap-3 pl-3 text-sm text-gray-700 dark:text-gray-300 font-mono">
                  <Terminal className="h-4 w-4 text-primary-500" />
                  <span>pip install -e .</span>
                </div>
                <CopyButton text="pip install -e ." />
              </div>

              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 leading-relaxed">
                3. Update your MCP client config with the manual server executable reference:
              </p>
              <div className="relative rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4 font-mono text-xs text-gray-700 dark:text-gray-300 overflow-x-auto leading-relaxed shadow-sm dark:shadow-none">
                <pre>{localConfigJson}</pre>
                <div className="absolute top-3 right-3">
                  <CopyButton text={localConfigJson} />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Tools Section */}
        <div className="max-w-5xl mx-auto mb-20">
          <h2 className="flex items-center justify-center gap-3 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white text-center mb-6">
            <Wrench className="w-8 h-8 text-primary-500" />
            24 Packaged Tools & Actions
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-2xl mx-auto mb-12">
            The SnapMind MCP server bundles robust automation pipelines directly usable by LLMs.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {toolCategories.map((cat, i) => (
              <div key={i} className="p-8 rounded-[20px] bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm dark:shadow-none">
                <h3 className="text-lg font-bold text-primary-600 dark:text-primary-400 border-b border-gray-200 dark:border-gray-800 pb-3 mb-4">
                  {cat.title}
                </h3>
                <div className="space-y-4">
                  {cat.tools.map((t, idx) => (
                    <div key={idx} className="flex gap-3 items-start">
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary-500 shrink-0" />
                      <div>
                        <code className="text-xs font-mono font-bold text-gray-800 dark:text-white bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-800">
                          {t.name}
                        </code>
                        <p className="text-gray-600 dark:text-gray-400 text-xs mt-1.5 leading-relaxed">{t.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resources & Templates List */}
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
          <div className="p-8 rounded-[20px] bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-[0px_30px_50px_-32px_rgba(107,110,148,0.04)] dark:shadow-none">
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white mb-6">
              <Book className="w-5 h-5 text-primary-500" />
              Available Resources
            </h3>
            <ul className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-3">
                <code className="text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-gray-950 px-1.5 py-0.5 rounded font-mono border border-primary-100 dark:border-gray-800">snapmind://kb/stats</code>
                <span>Live knowledge base statistics</span>
              </li>
              <li className="flex items-start gap-3">
                <code className="text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-gray-950 px-1.5 py-0.5 rounded font-mono border border-primary-100 dark:border-gray-800">snapmind://kb/tags</code>
                <span>All semantic tags</span>
              </li>
              <li className="flex items-start gap-3">
                <code className="text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-gray-950 px-1.5 py-0.5 rounded font-mono border border-primary-100 dark:border-gray-800">snapmind://kb/sites</code>
                <span>Indexed source URL catalog</span>
              </li>
              <li className="flex items-start gap-3">
                <code className="text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-gray-950 px-1.5 py-0.5 rounded font-mono border border-primary-100 dark:border-gray-800">snapmind://graph/full</code>
                <span>Full JSON Knowledge Graph export</span>
              </li>
            </ul>
          </div>

          <div className="p-8 rounded-[20px] bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-[0px_30px_50px_-32px_rgba(107,110,148,0.04)] dark:shadow-none">
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white mb-6">
              <MessageSquare className="w-5 h-5 text-primary-500" />
              Prompt Templates
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              Quickly load preset configurations to command agent workflows:
            </p>
            <div className="flex flex-wrap gap-2.5">
              {['research_topic', 'code_review', 'summarize_notebook', 'deep_dive', 'compare_sources', 'export_knowledge'].map((p, idx) => (
                <span key={idx} className="px-3 py-1.5 rounded bg-gray-50 dark:bg-gray-950 text-xs font-mono border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
