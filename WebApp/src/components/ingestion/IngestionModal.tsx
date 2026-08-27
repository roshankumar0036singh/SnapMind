'use client';

import { useState, useRef } from 'react';
import { CheckCircle2, FileText, GitBranch, Layers, Link as LinkIcon, Upload, Video, X } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

type IngestionMode = 'single' | 'batch' | 'file' | 'youtube' | 'github';

export default function IngestionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { activeWorkspace } = useWorkspace();
  const [mode, setMode] = useState<IngestionMode>('single');
  
  // Form states
  const [singleUrl, setSingleUrl] = useState('');
  const [batchUrls, setBatchUrls] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setStatus('processing');
    setErrorMessage('');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      let endpoint = '';
      let body: any = null;
      let headers: Record<string, string> = {
        ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` })
      };

      if (mode === 'file' && file) {
        endpoint = '/api/ingest/file';
        body = new FormData();
        body.append('file', file);
        body.append('workspace_id', activeWorkspace?.id || '');
        // Do not set Content-Type for FormData, browser will set it with boundary
      } else {
        headers['Content-Type'] = 'application/json';
        if (mode === 'github') {
          endpoint = '/api/ingest/github';
          body = JSON.stringify({ url: githubUrl, workspace_id: activeWorkspace?.id });
        } else if (mode === 'youtube') {
          endpoint = '/api/ingest';
          body = JSON.stringify({ url: youtubeUrl, workspace_id: activeWorkspace?.id });
        } else if (mode === 'single') {
          endpoint = '/api/ingest';
          body = JSON.stringify({ url: singleUrl, workspace_id: activeWorkspace?.id });
        } else if (mode === 'batch') {
          endpoint = '/api/ingest';
          // For simplicity, we just send the first URL or backend could handle list. 
          // Assuming backend handles single URLs, we would need to map over batchUrls.
          // For now, let's just send the first one as a proof of concept or assume the backend accepts a list of text?
          // Wait, backend DTO for ingest expects 'url' string. 
          // Let's implement batching by hitting the endpoint sequentially.
        }
      }

      const handleStreamResponse = async (res: Response) => {
        if (!res.ok) throw new Error(await res.text() || 'Ingestion failed');
        if (!res.body) throw new Error('No response body');
        
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let buffer = '';
        let finalResult = null;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            buffer += decoder.decode(value, { stream: !done });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last partial line in the buffer
            
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const data = JSON.parse(line);
                if (data.success === false) {
                  throw new Error(data.message || 'Ingestion failed');
                }
                if (data.success === true) {
                  finalResult = data;
                }
                // Optional: We could update a local state here with data.status and data.progress
                // to show live progress in the UI!
              } catch (e) {
                if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
                  throw e;
                }
              }
            }
          }
        }
        return finalResult;
      };

      let ingestPromise: Promise<any>;

      if (mode === 'batch') {
        const urls = batchUrls.split('\n').map(u => u.trim()).filter(Boolean);
        ingestPromise = Promise.all(urls.map(url => 
          fetch('/api/ingest', {
            method: 'POST',
            headers,
            body: JSON.stringify({ url, workspace_id: activeWorkspace?.id })
          }).then(handleStreamResponse)
        ));
      } else {
        ingestPromise = fetch(endpoint, {
          method: 'POST',
          headers,
          body
        }).then(handleStreamResponse);
      }

      toast.promise(ingestPromise, {
        loading: 'Ingesting knowledge in the background...',
        success: 'Successfully added to knowledge base!',
        error: (err) => `Failed to ingest: ${err.message}`
      });

      // Clear states and close modal immediately
      setSingleUrl('');
      setBatchUrls('');
      setYoutubeUrl('');
      setGithubUrl('');
      setFile(null);
      setStatus('idle');
      onClose();

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'An error occurred setting up ingestion.');
      setStatus('idle');
    }
  };

  const isSubmitDisabled = !activeWorkspace || status === 'processing' || 
    (mode === 'single' && !singleUrl) || 
    (mode === 'batch' && !batchUrls) ||
    (mode === 'youtube' && !youtubeUrl) ||
    (mode === 'github' && !githubUrl) ||
    (mode === 'file' && !file);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-white dark:bg-dark-secondary rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center">
              <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Knowledge</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-5 pb-2">
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 sm:pb-0">
            {[
              { id: 'single', label: 'Single Page', icon: LinkIcon },
              { id: 'batch', label: 'Batch URLs', icon: Layers },
              { id: 'file', label: 'Upload', icon: Upload },
              { id: 'youtube', label: 'YouTube', icon: Video },
              { id: 'github', label: 'GitHub', icon: GitBranch },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id as IngestionMode)}
                className={`flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold rounded-full transition-all whitespace-nowrap ${
                  mode === tab.id
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-500/20'
                    : 'bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-white/5 border border-transparent'
                }`}
              >
                <tab.icon className="w-4 h-4 shrink-0" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6 pt-2">
          {mode === 'single' && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                URL to index
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <LinkIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="url"
                  value={singleUrl}
                  onChange={e => setSingleUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-dark-primary border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-900 dark:text-white transition-all shadow-sm"
                />
              </div>
            </div>
          )}

          {mode === 'batch' && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Multiple URLs (one per line)
              </label>
              <textarea
                value={batchUrls}
                onChange={e => setBatchUrls(e.target.value)}
                placeholder="https://example.com/page1&#10;https://example.com/page2"
                rows={5}
                className="w-full px-4 py-3 bg-white dark:bg-dark-primary border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-900 dark:text-white resize-none transition-all shadow-sm"
              />
            </div>
          )}

          {mode === 'file' && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Upload Document (PDF, DOCX, TXT, CSV)
              </label>
              <div 
                className="w-full h-40 border-2 border-dashed border-gray-200 hover:border-blue-400 dark:border-gray-700 dark:hover:border-blue-500 bg-gray-50/50 hover:bg-blue-50/50 dark:bg-dark-primary/50 dark:hover:bg-blue-900/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all group"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)} 
                />
                <div className="w-12 h-12 bg-white dark:bg-gray-800 shadow-sm rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6 text-blue-500" />
                </div>
                {file ? (
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{file.name}</span>
                ) : (
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Click to select a file</span>
                )}
                <span className="text-xs text-gray-400 mt-1">Maximum file size: 50MB</span>
              </div>
            </div>
          )}

          {mode === 'youtube' && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                YouTube Video URL
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Video className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={e => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-dark-primary border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-900 dark:text-white transition-all shadow-sm"
                />
              </div>
            </div>
          )}

          {mode === 'github' && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                GitHub Repository URL
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <GitBranch className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="url"
                  value={githubUrl}
                  onChange={e => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/user/repo"
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-dark-primary border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-900 dark:text-white transition-all shadow-sm"
                />
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm rounded-xl">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="px-6 py-5 bg-gray-50/80 dark:bg-white/[0.02] border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400 flex flex-col">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500 mb-1">Target Workspace</span>
            <span className="font-medium text-gray-900 dark:text-white">{activeWorkspace?.name || 'No workspace selected'}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
            >
              Index Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
