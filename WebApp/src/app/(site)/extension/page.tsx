import type { Metadata } from 'next';
import { Shield, Sparkles, BookMarked, Search, CheckCircle, ExternalLink, Download } from 'lucide-react';

export const metadata: Metadata = {
  title: 'SnapMind Context Intelligence - Edge Extension',
  description: 'Download the SnapMind Context Intelligence extension for Microsoft Edge to seamlessly index and search web insights.',
};

export default function ExtensionPage() {
  const features = [
    {
      icon: <Search className="h-6 w-6 text-primary-500 dark:text-primary-400" />,
      title: 'Hybrid Search Indexing',
      desc: 'Seamlessly indexes webpages you visit. Automatically splits context and stores vectors locally for zero-latency semantic search queries.'
    },
    {
      icon: <Sparkles className="h-6 w-6 text-primary-500 dark:text-primary-400" />,
      title: 'Gemini-Powered Visual Intelligence',
      desc: 'Run instant OCR, object detection, or visual QA on images, screenshots, and visual page components directly from your browser panel.'
    },
    {
      icon: <BookMarked className="h-6 w-6 text-primary-500 dark:text-primary-400" />,
      title: 'Instant Bookmarks & Snippets',
      desc: 'Quickly highlight any block of text or graphic and pin it directly to your global knowledge graph without leaving your active tab.'
    },
    {
      icon: <Shield className="h-6 w-6 text-primary-500 dark:text-primary-400" />,
      title: 'Bring Your Own Key (BYOK)',
      desc: 'Strictly secure credentials architecture. You can connect your Gemini, Mistral, Groq, or OpenAI keys securely in local settings.'
    }
  ];

  return (
    <main className="min-h-screen pt-16 text-gray-900 dark:text-white pb-20 selection:bg-primary-500 selection:text-white relative overflow-hidden">
      <div className="wrapper max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 relative z-10">
        
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-500/20">
            Version 2.0.0 is live
          </span>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-gray-900 via-gray-700 to-gray-500 dark:from-white dark:via-gray-200 dark:to-gray-500 bg-clip-text text-transparent mb-6">
            SnapMind Context Intelligence
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-8">
            An intelligent Browser RAG Assistant that transforms your web browsing into a personalized, searchable knowledge base. Capture and organize key text or visual insights significantly easier.
          </p>

          {/* Action Download Buttons */}
          <div className="flex justify-center gap-4 flex-wrap">
            <a
              href="https://microsoftedge.microsoft.com/addons/detail/snapmind-%E2%80%94-ai-research-/nhdepgffhbdbcmoophlhcgjjckbpeabn"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-primary-500 hover:bg-primary-600 text-white font-bold transition-all hover:scale-105 shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30"
            >
              <Download className="h-5 w-5" />
              <span>Get it on Microsoft Edge Addons</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Browser Mockup Section */}
        <div className="max-w-4xl mx-auto mb-20">
          <div className="relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950/60 p-4 shadow-2xl dark:shadow-none backdrop-blur-md">
            {/* Window controls */}
            <div className="flex items-center gap-1.5 border-b border-gray-200 dark:border-gray-800/80 pb-3 mb-4">
              <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/80 inline-block" />
              <span className="h-3 w-3 rounded-full bg-green-500/80 inline-block" />
              <span className="text-xs text-gray-500 font-mono ml-4">edge://extensions/snapmind-context-intelligence</span>
            </div>

            {/* Mockup content */}
            <div className="grid md:grid-cols-[1fr_260px] gap-4 min-h-[300px]">
              <div className="p-6 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-800/60 flex flex-col justify-between">
                <div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Workspace Ingestion</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                    Instantly save current tabs, bookmark selected blocks, or pin URLs to your active notebooks.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-950 px-3 py-2 rounded border border-gray-200 dark:border-gray-800 w-fit shadow-sm dark:shadow-none">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Connected to Local Gateway (Ollama / LanceDB)</span>
                </div>
              </div>

              {/* Mockup sidebar panel */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl flex flex-col gap-4">
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider uppercase border-b border-gray-200 dark:border-gray-800 pb-2">
                  SnapMind Sidebar
                </div>
                <div className="space-y-3">
                  <div className="p-2.5 rounded bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs shadow-sm dark:shadow-none">
                    <span className="font-semibold text-primary-500 block mb-1">Search Context</span>
                    <span className="text-gray-600 dark:text-gray-500 block line-clamp-2">"Find other research documents describing BM25 hybrid search algorithms..."</span>
                  </div>
                  <div className="p-2.5 rounded bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs shadow-sm dark:shadow-none">
                    <span className="font-semibold text-primary-500 block mb-1">Visual QA</span>
                    <span className="text-gray-600 dark:text-gray-500 block line-clamp-2">"Identify diagram nodes from the currently loaded page screenshot..."</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {features.map((feat, i) => (
            <div key={i} className="p-6 rounded-[20px] bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-[0px_30px_50px_-32px_rgba(107,110,148,0.04)] dark:shadow-none hover:border-primary-500/30 transition-all flex gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center shrink-0">
                {feat.icon}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{feat.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
