import React, { useState, useEffect } from 'react';
import { Search, Globe, Bookmark, Clock, Tag, ExternalLink } from 'lucide-react';
import { apiClient } from '../../background/api';
import { toast } from 'sonner';

export default function SavedPagesView() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState('All');

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getSavedPages();
      if (data && data.success) {
        setPages(data.data);
      }
    } catch (err) {
      console.error("Failed to load saved pages", err);
      toast.error("Failed to load saved pages");
    } finally {
      setLoading(false);
    }
  };

  const uniqueFolders = ['All', ...new Set(pages.map(p => p.folder_name || 'General'))];

  const filteredPages = pages.filter(p => {
    const q = searchQuery.toLowerCase();
    const textMatch = (
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.summary && p.summary.toLowerCase().includes(q)) ||
      (p.keywords && p.keywords.some(k => k.toLowerCase().includes(q)))
    );
    const folderMatch = folderFilter === 'All' || (p.folder_name || 'General') === folderFilter;
    return textMatch && folderMatch;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-4 max-w-4xl mx-auto w-full scrollbar-hide">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-indigo-500" />
          Saved Websites
        </h2>
        <div className="relative w-full sm:w-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-full text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all w-full sm:w-64 bg-white shadow-sm placeholder:text-slate-400 font-medium text-slate-700"
            placeholder="Search saved pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Folder Pill Filters */}
      {uniqueFolders.length > 1 && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide pb-2">
          {uniqueFolders.map(folder => (
            <button
              key={folder}
              onClick={() => setFolderFilter(folder)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shadow-sm ${
                folderFilter === folder 
                ? 'bg-slate-800 text-white border-transparent' 
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {folder === 'All' ? <Globe className="w-3.5 h-3.5" /> : <Tag className="w-3.5 h-3.5" />}
              {folder}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-10 scrollbar-hide">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : filteredPages.length === 0 ? (
          <div className="text-center mt-20">
            <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 border border-slate-200">
              <Globe className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-slate-500 font-medium">No saved pages found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Click the Save button in the navbar while browsing pages to save them instantly via AI.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPages.map(page => {
              const hostname = new URL(page.original_url).hostname.replace('www.', '');
              return (
              <div key={page.id} className="bg-white border border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-300 transition-all rounded-2xl p-4 flex flex-col gap-3 group relative pointer-events-auto cursor-pointer">
                {/* Header Row: Small Image + Site Name + Date */}
                <div className="flex items-center justify-between border-b border-slate-50/50 pb-2">
                   <div className="flex items-center gap-2">
                     <div className="w-8 h-8 rounded-lg border border-slate-100 shadow-sm relative overflow-hidden bg-white">
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=128`} 
                          alt={hostname}
                          className="w-full h-full object-cover p-1"
                          onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-extrabold text-xs hidden">
                           {hostname.charAt(0).toUpperCase()}
                        </div>
                     </div>
                     <div className="flex flex-col">
                       <a 
                         href={page.original_url} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 transition-colors text-[10px] font-bold uppercase tracking-wider select-none mb-0.5"
                         onClick={(e) => e.stopPropagation()}
                       >
                         {hostname}
                         <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                       </a>
                       <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider bg-slate-100 w-fit px-1.5 rounded-sm">
                         {page.folder_name || 'General'}
                       </span>
                     </div>
                   </div>
                   <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                     <Clock className="w-3 h-3" />
                     {new Date(page.created_at).toLocaleDateString()}
                   </span>
                </div>

                {/* Title */}
                <h3 className="font-extrabold text-slate-800 text-[14px] leading-snug group-hover:text-indigo-600 transition-colors line-clamp-2 mt-1">
                  {page.title}
                </h3>

                {/* Summary */}
                <p className="text-[12px] text-slate-600 leading-relaxed font-medium line-clamp-3 lg:line-clamp-4">
                  {page.summary}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-2">
                  <Tag className="w-3.5 h-3.5 text-slate-300 mr-1" />
                  {page.keywords?.slice(0, 3).map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-50 text-slate-600 text-[10px] rounded-md font-semibold border border-slate-200 shadow-sm whitespace-nowrap">
                      {kw}
                    </span>
                  ))}
                  {page.emotions?.slice(0, 1).map((emo, i) => (
                    <span key={'emo'+i} className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-600 text-[10px] rounded-md font-bold italic shadow-sm whitespace-nowrap">
                      {emo}
                    </span>
                  ))}
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}
