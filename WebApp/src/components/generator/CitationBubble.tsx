import React from 'react';
import { ExternalLink, FileText } from 'lucide-react';

interface CitationBubbleProps {
  id: string;
  url?: string;
  content?: string;
}

export function CitationBubble({ id, url, content }: CitationBubbleProps) {
  return (
    <span 
      onClick={() => { if (url && url !== 'local') window.open(url, '_blank'); }}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 ml-1 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-md hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors group cursor-pointer relative"
    >
      {url && url !== 'local' ? (
        <ExternalLink className="w-3 h-3" />
      ) : (
        <FileText className="w-3 h-3" />
      )}
      <span>{id}</span>
      
      {/* Tooltip on hover */}
      {content && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-xl shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 line-clamp-4 flex flex-col">
          <span className="font-semibold mb-1 truncate">{url !== 'local' ? url : 'Document Context'}</span>
          <span className="text-gray-300 font-normal">{content}</span>
        </span>
      )}
    </span>
  );
}
