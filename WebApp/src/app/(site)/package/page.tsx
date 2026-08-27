import type { Metadata } from 'next';
import { Terminal, Cpu, Zap, FolderKanban, ExternalLink } from 'lucide-react';
import CopyButton from './copy-button';

export const metadata: Metadata = {
  title: 'SnapMind NPM Package',
  description: 'Persona-based RAG CLI for local AI, semantic vector search, PDF/code/data ingestion, and terminal-native knowledge workflows with LanceDB and Ollama.',
};

export default function PackagePage() {
  const versions = [
    { version: '1.5.2', date: '2026-06-22', tag: 'Latest', desc: 'Adds deep reasoning agent capabilities and local LanceDB fixes' },
    { version: '1.5.1', date: '2026-06-22', tag: 'Stable', desc: 'Optimized vector search recall rates and multi-hop routing stability' },
    { version: '1.5.0', date: '2026-06-20', tag: 'Stable', desc: 'Introduces support for multi-provider LLMs (Claude, Gemini, Mistral)' },
    { version: '1.3.4', date: '2026-05-31', tag: 'Legacy', desc: 'Performance patches for codebase context indexing' },
    { version: '1.3.3', date: '2026-05-31', tag: 'Legacy', desc: 'Initial release of local-first RAG offline mode' },
  ];

  return (
    <main className="min-h-screen bg-[#0b0f19] text-white selection:bg-primary-500 selection:text-white pb-20">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-primary-900/20 via-transparent to-transparent pointer-events-none z-0" />

      <div className="wrapper max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 relative z-10">
        
        {/* Breadcrumb / Top Info */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-500/10 text-primary-400 border border-primary-500/20">
            npm v1.5.2 is live
          </span>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-500 bg-clip-text text-transparent mb-6">
            SnapMind AI CLI Package
          </h1>
          <p className="text-lg text-gray-400 leading-relaxed mb-8">
            Persona-based RAG CLI for local AI, semantic vector search, PDF/code/data ingestion, and terminal-native knowledge workflows with LanceDB and Ollama.
          </p>

          {/* Copyable Install Command */}
          <div className="max-w-md mx-auto p-1.5 bg-gray-900/60 backdrop-blur-md rounded-2xl border border-gray-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 pl-3 text-sm text-gray-300 font-mono">
              <Terminal className="h-4 w-4 text-primary-500" />
              <span>npm install -g snapmind-ai</span>
            </div>
            <CopyButton text="npm install -g snapmind-ai" />
          </div>
        </div>

        {/* View on NPM Button */}
        <div className="flex justify-center gap-4 mb-20">
          <a
            href="https://www.npmjs.com/package/snapmind-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#cc3534] hover:bg-[#b02e2d] text-white font-semibold transition-all hover:scale-105"
          >
            <span>View on npmjs.com</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Core Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="p-6 rounded-2xl bg-gray-900/40 border border-gray-800/80 hover:border-primary-500/50 hover:bg-gray-900/60 transition-all group">
            <div className="h-12 w-12 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-400 mb-4 group-hover:scale-110 transition-transform">
              <Cpu className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Local-First RAG</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Vector indexes are stored safely in <code>~/.snapmind/</code> using LanceDB. Runs 100% offline with Ollama or connects to cloud endpoints.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-gray-900/40 border border-gray-800/80 hover:border-primary-500/50 hover:bg-gray-900/60 transition-all group">
            <div className="h-12 w-12 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-400 mb-4 group-hover:scale-110 transition-transform">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Hybrid Search Retrieval</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Combines semantic vector similarity with traditional BM25 full-text search for extremely sharp, high-recall retrieval.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-gray-900/40 border border-gray-800/80 hover:border-primary-500/50 hover:bg-gray-900/60 transition-all group">
            <div className="h-12 w-12 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-400 mb-4 group-hover:scale-110 transition-transform">
              <FolderKanban className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Multi-Format Ingestion</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Ingest local files (PDFs, spreadsheets, codebases), crawl whole websites, or index full GitHub repositories via CLI flags.
            </p>
          </div>
        </div>

        {/* Command Reference Section */}
        <div className="mb-20">
          <h2 className="text-3xl font-extrabold tracking-tight text-white text-center mb-12">
            CLI Command Reference
          </h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="p-5 rounded-xl bg-gray-900/50 border border-gray-800 font-mono text-xs">
              <div className="text-primary-400 mb-2"># Ingest a directory of documents</div>
              <div className="text-white mb-4">$ snapmind ingest ./docs --tag science</div>
              
              <div className="text-primary-400 mb-2"># Query with strict citations</div>
              <div className="text-white">$ snapmind ask "What is the quantum effect?" --tag science</div>
            </div>

            <div className="p-5 rounded-xl bg-gray-900/50 border border-gray-800 font-mono text-xs">
              <div className="text-primary-400 mb-2"># Index a full github repository</div>
              <div className="text-white mb-4">$ snapmind ingest-repo https://github.com/org/repo</div>
              
              <div className="text-primary-400 mb-2"># Start interactive terminal chat</div>
              <div className="text-white">$ snapmind chat --persona coder</div>
            </div>
          </div>
        </div>

        {/* Version History Table */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-extrabold tracking-tight text-white text-center mb-8">
            Version Release History
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-900/20 backdrop-blur-md">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="p-4 text-xs font-semibold tracking-wider text-gray-400 uppercase">Version</th>
                  <th className="p-4 text-xs font-semibold tracking-wider text-gray-400 uppercase">Date</th>
                  <th className="p-4 text-xs font-semibold tracking-wider text-gray-400 uppercase">Release Class</th>
                  <th className="p-4 text-xs font-semibold tracking-wider text-gray-400 uppercase">Highlights</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {versions.map((v, i) => (
                  <tr key={i} className="hover:bg-gray-900/30 transition-colors">
                    <td className="p-4 text-sm font-mono font-bold text-white">{v.version}</td>
                    <td className="p-4 text-sm text-gray-400">{v.date}</td>
                    <td className="p-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        v.tag === 'Latest' ? 'bg-primary-500/20 text-primary-300' :
                        v.tag === 'Stable' ? 'bg-emerald-500/20 text-emerald-300' :
                        'bg-gray-800 text-gray-400'
                      }`}>
                        {v.tag}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-300">{v.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}
