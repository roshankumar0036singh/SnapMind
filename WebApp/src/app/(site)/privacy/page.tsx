import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | SnapMind',
  description: 'Privacy Policy for the SnapMind Web Application and Browser Extension',
};

export default function PrivacyPage() {
  return (
    <section className="py-20 bg-[#F8FAFC] dark:bg-[#06080C] min-h-screen">
      <div className="max-w-[800px] mx-auto px-5">
        <p className="text-primary-500 font-bold mb-3 tracking-wider text-sm uppercase">
          Legal
        </p>
        <h1 className="mb-4 text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium mb-12">
          Last Updated: <span className="text-gray-800 dark:text-gray-300">August 28, 2026</span>
        </p>

        <div className="prose prose-lg dark:prose-invert max-w-none text-gray-600 dark:text-gray-300">
          
          <p className="lead text-xl text-gray-800 dark:text-gray-200 font-medium mb-8">
            At SnapMind, we believe that your second brain belongs entirely to you. We are committed to transparency and to protecting the data you entrust to us while using our Web Dashboard, Browser Extension, and Local MCP Server.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4">1. Information We Collect</h2>
          <p className="mb-4">SnapMind collects information strictly necessary to provide you with our Knowledge Graph and AI Chat capabilities. This includes:</p>
          <ul className="list-disc pl-6 space-y-2 mb-6">
            <li><strong>Account Information:</strong> Name, email address, and authentication tokens provided via our auth partner (Supabase).</li>
            <li><strong>Ingested Knowledge Data:</strong> URLs, YouTube transcripts, PDF contents, and GitHub repositories that you explicitly choose to ingest into SnapMind.</li>
            <li><strong>Local Context (MCP):</strong> When using the Model Context Protocol, SnapMind accesses your local files only when explicitly authorized during an active session.</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4">2. How We Use Your Data</h2>
          <p className="mb-4">Your data is processed to generate semantic embeddings and multi-hop knowledge graphs. Specifically:</p>
          <ul className="list-disc pl-6 space-y-2 mb-6">
            <li><strong>AI Processing:</strong> Your ingested texts are securely transmitted to our LLM partners (OpenAI, Anthropic, Google) to generate summaries and embeddings.</li>
            <li><strong>Storage:</strong> Embeddings are stored securely in our Vector Database (Qdrant/Pinecone), and relational data is stored in our secured Postgres database.</li>
            <li><strong>No Training:</strong> We <strong>do not</strong> use your personal data or private repositories to train our own foundational AI models. We opt-out of data sharing for training with our enterprise LLM partners.</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4">3. Browser Extension Specifics</h2>
          <p className="mb-6">
            The SnapMind Chrome Extension requires permissions to read the current webpage to extract articles and highlight text. 
            The extension <strong>does not</strong> track your browsing history in the background. Data is only transmitted to our servers when you actively click "Capture" or interact with the SnapMind sidebar.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4">4. Third-Party Services</h2>
          <p className="mb-4">We employ world-class third-party infrastructure providers to run SnapMind securely:</p>
          <ul className="list-disc pl-6 space-y-2 mb-6">
            <li><strong>Supabase:</strong> For identity management and secure Postgres hosting.</li>
            <li><strong>Vercel & Cloudflare:</strong> For edge routing, web hosting, and low-latency API execution.</li>
            <li><strong>Hugging Face:</strong> For executing open-source embedding models securely.</li>
            <li><strong>Stripe / Paddle:</strong> For processing subscription payments. We never see or store your raw credit card information.</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4">5. Your Data Rights</h2>
          <p className="mb-4">You have full control over your second brain. At any time, you have the right to:</p>
          <ul className="list-disc pl-6 space-y-2 mb-6">
            <li><strong>Access:</strong> View all knowledge bases, graphs, and chat histories stored in your account.</li>
            <li><strong>Export:</strong> Download a full archive of your semantic data and original texts.</li>
            <li><strong>Delete:</strong> Permanently delete your account and all associated vectors and graphs. When you delete a workspace, the underlying vector embeddings are purged instantly.</li>
          </ul>

        </div>
      </div>
    </section>
  );
}
