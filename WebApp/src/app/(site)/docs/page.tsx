import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Documentation | SnapMind',
  description: 'Documentation for SnapMind Web Application, Browser Extension, and MCP.',
};

export default function DocsPage() {
  return (
    <section className="py-20 bg-transparent min-h-screen">
      <div className="max-w-[800px] mx-auto px-5">
        <p className="text-primary-500 font-bold mb-3 tracking-wider text-sm uppercase">
          Documentation
        </p>
        <h1 className="mb-4 text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          SnapMind Docs
        </h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium mb-12">
          Everything you need to know to get the most out of your autonomous AI research assistant.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 hover:dark:bg-white/10 transition-colors">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Getting Started</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Learn the basics of SnapMind, how to set up your account, and connect your first data sources.
            </p>
            <Link href="/docs/getting-started" className="text-primary-500 font-medium hover:underline">
              Read Guide &rarr;
            </Link>
          </div>
          
          <div className="p-6 bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 hover:dark:bg-white/10 transition-colors">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Browser Extension</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Install and configure the Chrome extension to capture knowledge seamlessly while you browse.
            </p>
            <Link href="/extension" className="text-primary-500 font-medium hover:underline">
              View Extension &rarr;
            </Link>
          </div>

          <div className="p-6 bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 hover:dark:bg-white/10 transition-colors">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">GraphRAG Engine</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Dive deep into how our GraphRAG pipeline structures your data into a cohesive knowledge graph.
            </p>
            <Link href="/docs/graphrag" className="text-primary-500 font-medium hover:underline">
              Learn More &rarr;
            </Link>
          </div>

          <div className="p-6 bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 hover:dark:bg-white/10 transition-colors">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Model Context Protocol</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Connect local directories and IDEs to your SnapMind brain using MCP standard.
            </p>
            <Link href="/mcp" className="text-primary-500 font-medium hover:underline">
              MCP Setup &rarr;
            </Link>
          </div>
        </div>

        <div className="mt-16 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Can't find what you're looking for?</p>
          <Link href="/contact" className="inline-block px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors">
            Contact Support
          </Link>
        </div>
      </div>
    </section>
  );
}
