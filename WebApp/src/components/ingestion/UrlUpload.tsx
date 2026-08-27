'use client';

import { useState } from 'react';
import { Link as LinkIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';

export default function UrlUpload() {
  const { activeWorkspace } = useWorkspace();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !activeWorkspace) return;
    setStatus('processing');
    
    try {
      // Simulate API call for now
      // await fetchApi('/api/v1/ingest/url', { 
      //   method: 'POST', 
      //   body: JSON.stringify({ url, workspace_id: activeWorkspace.id }) 
      // });
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      setStatus('success');
      setTimeout(() => {
        setUrl('');
        setStatus('idle');
      }, 3000);
    } catch (error) {
      setStatus('error');
    }
  };

  return (
    <div className="w-full bg-white dark:bg-dark-secondary border border-gray-200 dark:border-gray-800 rounded-2xl p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
          <LinkIcon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Add URL</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Paste a link to any webpage, article, or blog post.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <LinkIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setStatus('idle');
            }}
            placeholder="https://example.com/article"
            required
            className="block w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-dark-primary border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-gray-900 dark:text-white"
          />
        </div>
        <button
          type="submit"
          disabled={!activeWorkspace || !url || status === 'processing'}
          className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {status === 'processing' ? 'Processing...' : 'Add Link'}
        </button>
      </form>

      {status === 'success' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
          <CheckCircle2 className="w-5 h-5" />
          Successfully processed and added to workspace.
        </div>
      )}
      {status === 'error' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-500/10 p-3 rounded-xl border border-rose-100 dark:border-rose-500/20">
          <AlertCircle className="w-5 h-5" />
          Failed to process URL. Please try again.
        </div>
      )}
    </div>
  );
}
