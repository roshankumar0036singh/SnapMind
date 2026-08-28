import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'GraphRAG Engine | SnapMind Docs',
  description: 'Deep dive into how SnapMind structures data into a cohesive knowledge graph.',
};

export default function GraphRAGPage() {
  return (
    <section className="py-20 bg-[#F8FAFC] dark:bg-[#06080C] min-h-screen">
      <div className="max-w-[800px] mx-auto px-5">
        <Link href="/docs" className="text-primary-500 font-medium hover:underline mb-8 inline-block">
          &larr; Back to Docs
        </Link>
        <p className="text-primary-500 font-bold mb-3 tracking-wider text-sm uppercase">
          Architecture
        </p>
        <h1 className="mb-4 text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          GraphRAG Engine
        </h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium mb-12">
          Understanding the intelligent backend powering SnapMind.
        </p>

        <div className="prose prose-lg dark:prose-invert max-w-none text-gray-600 dark:text-gray-300">
          <p className="lead text-xl text-gray-800 dark:text-gray-200 font-medium mb-8">
            Traditional RAG simply retrieves text snippets. SnapMind goes a step further by constructing a dense knowledge graph that maps out entities, concepts, and the relationships between them.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4">How It Works</h2>
          <p className="mb-4">
            When you ingest content (whether it's a web page, YouTube video, or GitHub repo), our pipeline executes the following steps:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-6">
            <li><strong>Scraping & Cleaning:</strong> We extract the raw Markdown content using our ingestion parsers.</li>
            <li><strong>Semantic Chunking:</strong> The text is split intelligently, respecting headers and paragraphs, to maintain contextual boundaries.</li>
            <li><strong>Entity Extraction:</strong> We utilize advanced LLMs (like Mistral Large) to scan chunks for core entities (e.g., people, organizations, concepts) and their relationships.</li>
            <li><strong>Graph Construction:</strong> Nodes and edges are inserted into our Supabase Postgres database. This enables multi-hop reasoning during retrieval.</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4">Hybrid Search</h2>
          <p className="mb-4">
            At query time, SnapMind uses a <strong>Hybrid Search</strong> approach:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-6">
            <li><strong>Vector Search (pgvector):</strong> Finds chunks that are semantically similar to your question using embeddings (e.g., Gemini 2.0 or Mistral embeddings).</li>
            <li><strong>Full-Text Search (FTS):</strong> Ensures exact keyword matches aren't missed.</li>
            <li><strong>Graph Traversal:</strong> Pulls in neighboring nodes from the knowledge graph to provide holistic context, especially for complex questions like "How does X relate to Y?"</li>
            <li><strong>Cross-Encoder Reranking:</strong> Reranks the combined results to ensure the most highly relevant context is fed into the generator LLM.</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4">Why It Matters</h2>
          <p className="mb-4">
            By structuring your research as a graph, SnapMind doesn't just act like a search engine—it acts like an intelligent assistant that understands the global structure of your knowledge base. It can synthesize answers that span multiple distinct documents, uncovering insights that simple vector search would miss.
          </p>
        </div>
      </div>
    </section>
  );
}
