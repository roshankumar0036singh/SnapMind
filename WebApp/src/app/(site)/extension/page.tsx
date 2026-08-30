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
    <main className="min-h-screen pt-16 flex flex-col items-center justify-center text-gray-900 dark:text-white pb-20 selection:bg-primary-500 selection:text-white relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-500/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 text-center max-w-2xl mx-auto px-4">
        <div className="mx-auto inline-flex items-center justify-center h-24 w-24 rounded-full bg-primary-50 dark:bg-primary-500/10 mb-8 border border-primary-100 dark:border-primary-500/20 shadow-2xl shadow-primary-500/20 animate-pulse">
          <Sparkles className="h-10 w-10 text-primary-500" />
        </div>
        
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-gray-900 via-gray-700 to-gray-500 dark:from-white dark:via-gray-200 dark:to-gray-500 bg-clip-text text-transparent mb-6">
          Deploying Soon
        </h1>
        
        <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-10">
          We're putting the final touches on the SnapMind Context Intelligence extension. It will be available on the Microsoft Edge Addons store very shortly. Check back soon!
        </p>

        <a href="/" className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold transition-all hover:scale-105 shadow-xl">
          Return to Home
        </a>
      </div>
    </main>
  );
}
