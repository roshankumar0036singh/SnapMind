import { FileText, Bookmark, Globe } from 'lucide-react';

interface MemoryListProps {
  type: 'sites' | 'saved' | 'bookmarks';
  data: any[];
}

export default function MemoryList({ type, data }: MemoryListProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] w-full bg-white dark:bg-[#0D1117] rounded-2xl border border-gray-200 dark:border-gray-800 border-dashed text-center">
        <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 text-gray-300 dark:text-gray-600 rounded-full flex items-center justify-center mb-4 border border-gray-100 dark:border-white/10">
          {type === 'bookmarks' ? <Bookmark className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
        </div>
        <h3 className="text-gray-800 dark:text-white font-bold text-lg">No {type === 'bookmarks' ? 'Bookmarks' : type === 'sites' ? 'Indexed Sites' : 'Saved Websites'} Found</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[250px] mt-2 mb-6">
          Content will appear here as you interact with the agent.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12 pt-4">
      {data.map((item, idx) => (
        <div key={item.id || idx} className="p-4 bg-white dark:bg-[#1A1E23] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow group flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
            {type === 'bookmarks' ? <Bookmark className="w-5 h-5" /> : type === 'sites' ? <FileText className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1 mb-1">
              {item.title || item.text || 'Untitled'}
            </h4>
            
            {(item.url || item.source) && (
              <a href={item.url || item.source} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline line-clamp-1 break-all flex items-center gap-1.5">
                {item.url || item.source}
              </a>
            )}

            {item.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                {item.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
