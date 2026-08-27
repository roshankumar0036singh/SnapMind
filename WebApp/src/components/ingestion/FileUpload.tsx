'use client';

import { useState } from 'react';
import { UploadCloud, File, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';

export default function FileUpload() {
  const { activeWorkspace } = useWorkspace();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setStatus('idle');
    }
  };

  const handleUpload = async () => {
    if (!file || !activeWorkspace) return;
    setStatus('uploading');
    
    try {
      // Simulate API call for now
      // const formData = new FormData();
      // formData.append('file', file);
      // formData.append('workspace_id', activeWorkspace.id);
      // await fetchApi('/api/v1/ingest/file', { method: 'POST', body: formData });
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      setStatus('success');
      setTimeout(() => {
        setFile(null);
        setStatus('idle');
      }, 3000);
    } catch (error) {
      setStatus('error');
    }
  };

  return (
    <div className="w-full">
      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-colors ${
            isDragging 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' 
              : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-gray-50/50 dark:bg-white/5'
          }`}
        >
          <div className="w-16 h-16 rounded-full bg-white dark:bg-dark-secondary shadow-sm flex items-center justify-center mb-6">
            <UploadCloud className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Upload documents
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
            Drag and drop your PDFs, Word documents, or text files here to add them to your knowledge base.
          </p>
          <label className="cursor-pointer relative px-6 py-2.5 bg-white dark:bg-dark-secondary border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-full shadow-sm transition-colors">
            <span>Browse Files</span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setFile(e.target.files[0]);
                  setStatus('idle');
                }
              }}
            />
          </label>
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-dark-secondary rounded-2xl p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <File className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            {status === 'idle' && (
              <button onClick={() => setFile(null)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          
          <div className="mt-6 flex items-center justify-end gap-3">
            {status === 'idle' && (
              <button
                onClick={handleUpload}
                disabled={!activeWorkspace}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload & Process
              </button>
            )}
            {status === 'uploading' && (
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Processing...
              </div>
            )}
            {status === 'success' && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-5 h-5" />
                Added to workspace
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400 font-medium">
                <AlertCircle className="w-5 h-5" />
                Upload failed
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
