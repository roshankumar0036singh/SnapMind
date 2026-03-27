import React from 'react';
import { Bookmark, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import * as ReactWindow from 'react-window';
const List = ReactWindow.FixedSizeList || (ReactWindow.default && ReactWindow.default.FixedSizeList);

export default function BookmarkList({ bookmarks, loading, onDelete }) {
  
  const Row = ({ index, style }) => {
    const b = bookmarks[index];
    if (!b) return null;

    return (
      <div style={style} className="px-2 pb-4">
        <div className="bg-[#111113] border border-[#1a1a1d] rounded-xl p-5 hover:border-[#6366f1]/40 hover:bg-[#1a1a1d] transition-all group relative h-full overflow-hidden">
          <div className="flex flex-col gap-3">
            <p className="text-[12px] leading-relaxed text-[#d4d4d8] font-medium italic pr-12 line-clamp-3">
              "{b.content}"
            </p>
            
            <div className="flex items-center justify-between mt-1 pt-3 border-t border-[#1a1a1d]/50">
              <div className="flex items-center gap-4">
                {b.source_url && (
                  <a
                    href={b.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] font-black uppercase tracking-widest text-[#6366f1] hover:text-[#4f46e5] flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    {new URL(b.source_url).hostname.replace('www.', '')}
                  </a>
                )}
                <span className="text-[9px] font-black uppercase tracking-widest text-[#3f3f46]">
                  {new Date(b.created_at).toLocaleDateString()}
                </span>
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(b.id);
                }}
                className="text-[#3f3f46] hover:text-[#ef4444] hover:bg-[#ef4444]/10 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                title="Purge Bookmark"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-6 h-6 text-[#6366f1] animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-[#71717a]">Opening Research Vault...</p>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="text-center p-12 border border-dashed border-[#1a1a1d] rounded-2xl bg-[#09090b]/50">
        <Bookmark className="w-10 h-10 mx-auto mb-4 text-[#3f3f46]" />
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#fafafa]">Zero Starred Snippets</h3>
        <p className="text-[10px] text-[#3f3f46] mt-2 font-medium uppercase tracking-widest">Star citations in your chat to cache key research findings here.</p>
      </div>
    );
  }

  return (
    <div className="h-[500px] w-full custom-scrollbar">
      <List
        height={500}
        itemCount={bookmarks.length}
        itemSize={130}
        width={'100%'}
        className="scrollbar-hide"
      >
        {Row}
      </List>
    </div>
  );
}
