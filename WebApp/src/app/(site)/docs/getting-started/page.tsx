import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Getting Started | SnapMind Docs',
  description: 'Learn how to set up your account and connect data sources.',
};

export default function GettingStartedPage() {
  return (
    <section className="py-20 bg-[#F8FAFC] dark:bg-[#06080C] min-h-screen">
      <div className="max-w-[800px] mx-auto px-5">
        <Link href="/docs" className="text-primary-500 font-medium hover:underline mb-8 inline-block">
          &larr; Back to Docs
        </Link>
        <p className="text-primary-500 font-bold mb-3 tracking-wider text-sm uppercase">
          Guide
        </p>
        <h1 className="mb-4 text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Getting Started
        </h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium mb-12">
          Your journey to building a second brain starts here.
        </p>

        <div className="prose prose-lg dark:prose-invert max-w-none text-gray-600 dark:text-gray-300">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4">1. Create an Account</h2>
          <p className="mb-4">
            SnapMind uses Supabase for secure authentication. To get started, head over to the <Link href="/signin">Sign In</Link> page and create a new account using your email or Google OAuth.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4">2. Install the Extension</h2>
          <div className="mb-4">
            The easiest way to feed data into SnapMind is via our Chrome Extension. 
            <ul>
              <li>Navigate to the <Link href="/extension">Extension</Link> page.</li>
              <li>Follow the instructions to install the unpacked extension in developer mode.</li>
              <li>Pin the extension to your browser toolbar.</li>
            </ul>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4">3. Ingest Your First Source</h2>
          <div className="mb-4">
            Once logged in, open the extension on any webpage, article, or YouTube video. Click "Capture" and SnapMind will automatically:
            <ul>
              <li>Scrape and clean the content (removing ads and boilerplate).</li>
              <li>Chunk the text semantically.</li>
              <li>Generate embeddings using our LLM ensemble.</li>
              <li>Store it safely in your personalized vector database.</li>
            </ul>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4">4. Query Your Brain</h2>
          <p className="mb-4">
            Open the SnapMind chat interface and start asking questions. Our Hybrid Search engine (combining keyword and vector search) will retrieve the exact context you need and synthesize an answer instantly.
          </p>
        </div>
      </div>
    </section>
  );
}
