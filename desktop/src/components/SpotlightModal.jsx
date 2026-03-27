import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, Bookmark, MessageSquare, ExternalLink, Loader2, X } from 'lucide-react';
import { apiClient } from '../background/api';

const SpotlightModal = ({ isOpen, onClose, onResultClick, visionData }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [visionAnswer, setVisionAnswer] = useState(null);
  const inputRef = useRef(null);
  
  // Ref for the debounced search function
  const searchTimeout = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
      setSelectedIndex(-1);
      setVisionAnswer(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown' && !visionData) {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp' && !visionData) {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (visionData) {
          handleVisionQuery();
        } else if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleResultClick(results[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose, visionData, query]);

  const handleVisionQuery = async () => {
    if (!query.trim() || isLoading) return;
    
    setIsLoading(true);
    setVisionAnswer(null);
    try {
      // Logic to trigger vision query - for now we can redirect to main chat
      // OR hit a dedicated endpoint if we want it in-modal.
      // We'll jump to main chat as it has better streaming support.
      window.dispatchEvent(new CustomEvent('trigger-vision-query', { 
        detail: { query, image: visionData } 
      }));
      onClose();
    } catch (err) {
      console.error("Vision query trigger error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const performSearch = async (searchQuery) => {
    if (visionData) return; // Don't search RAG while in vision mode
    if (!searchQuery.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const data = await apiClient.searchGlobal(searchQuery, 15);
      setResults(data || []);
      setSelectedIndex(-1);
    } catch (err) {
      console.error("Spotlight search error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    
    if (visionData) return; // No auto-search in vision mode
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    searchTimeout.current = setTimeout(() => {
      performSearch(val);
    }, 400); // Debounce
  };

  const handleResultClick = (result) => {
    if (onResultClick) {
      onResultClick(result);
    } else if (result.url) {
      if (result.url.startsWith('http')) {
        window.open(result.url, '_blank');
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-32 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-[#0f0f14] border border-[#27272a] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col transform transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Screenshot Preview (Vision Mode) */}
        {visionData && (
          <div className="px-6 pt-6 flex items-center gap-4">
            <div className="relative group shrink-0">
               <img 
                src={visionData} 
                className="h-24 w-auto rounded-xl border border-indigo-500/40 shadow-xl object-contain bg-black" 
               />
               <div className="absolute inset-0 rounded-xl bg-indigo-500/10 pointer-events-none" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-indigo-500/30">
                  Vision Active
                </span>
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                  Screen Intelligence
                </span>
              </div>
              <h3 className="text-neutral-100 font-bold text-sm tracking-tight">Window captured successfully</h3>
              <p className="text-neutral-500 text-[11px] font-medium max-w-xs">Ask anything about the content on your screen right now.</p>
            </div>
          </div>
        )}

        {/* Search Input Area */}
        <div className="flex items-center px-6 py-6 border-b border-[#1e1e26]/30">
          <div className="mr-4">
            {visionData ? (
               <div className="p-2 bg-indigo-500 text-white rounded-lg shadow-lg">
                  <Search className="w-5 h-5" />
               </div>
            ) : (
              <Search className="w-6 h-6 text-indigo-500/70" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-xl text-neutral-100 placeholder-neutral-700 font-medium tracking-tight"
            placeholder={visionData ? "What would you like to know?" : "Search knowledge base..."}
            value={query}
            onChange={handleInputChange}
          />
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0" />
          ) : query ? (
            <button onClick={() => setQuery('')} className="p-1 rounded-md hover:bg-neutral-800 text-neutral-500 transition-colors">
              <X className="w-5 h-5" />
            </button>
          ) : null}
        </div>

        {/* Results Area (Regular Mode) */}
        {!visionData && query && (
          <div className="max-h-[60vh] overflow-y-auto w-full custom-scrollbar">
            {results.length === 0 && !isLoading ? (
              <div className="p-12 text-center">
                <p className="text-neutral-400 font-bold text-lg">No matches discovered</p>
                <p className="text-neutral-600 text-sm mt-1">Try expanding your search parameters.</p>
              </div>
            ) : (
              <div className="p-3 space-y-1">
                {results.map((res, idx) => {
                  const isSelected = selectedIndex === idx;
                  
                  let Icon = FileText;
                  let colorClass = "text-emerald-400";
                  let bgClass = "bg-emerald-400/10";
                  
                  if (res.type === 'bookmark') {
                    Icon = Bookmark;
                    colorClass = "text-amber-400";
                    bgClass = "bg-amber-400/10";
                  } else if (res.type === 'session') {
                    Icon = MessageSquare;
                    colorClass = "text-indigo-400";
                    bgClass = "bg-indigo-400/10";
                  }

                  return (
                    <div
                      key={res.id || idx}
                      onClick={() => handleResultClick(res)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-start p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                        isSelected ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30' : 'hover:bg-[#18181b] border-transparent'
                      }`}
                    >
                      <div className={`p-2.5 rounded-xl ${bgClass} ${colorClass} shrink-0 mt-0.5 shadow-sm`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      
                      <div className="ml-4 flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-neutral-500 uppercase tracking-widest">
                            {res.type}
                          </h4>
                          <span className="text-[10px] text-neutral-600 font-mono font-bold">
                            MATCH: {(res.score * 100).toFixed(0)}%
                          </span>
                        </div>
                        
                        <p className="text-[13px] text-neutral-300 mt-1.5 line-clamp-2 leading-relaxed font-medium">
                          {res.content}
                        </p>
                        
                        {(res.url || res.metadata?.title) && (
                          <div className="flex items-center mt-3 text-[10px] text-neutral-600 font-bold uppercase tracking-wider">
                            <ExternalLink className="w-3 h-3 mr-1.5 text-indigo-500/50" />
                            <span className="truncate max-w-[400px]">
                              {res.metadata?.title || res.url}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        
        {/* Footer */}
        <div className="px-6 py-4 bg-[#111116] border-t border-[#1e1e26]/30 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
          <div className="flex gap-6">
            <span className="flex items-center gap-2">
              <kbd className="bg-[#18181f] border border-[#27272a] px-2 py-0.5 rounded text-neutral-400 shadow-sm">ENTER</kbd> 
              {visionData ? "Ask AI" : "Open Match"}
            </span>
            <span className="flex items-center gap-2">
              <kbd className="bg-[#18181f] border border-[#27272a] px-2 py-0.5 rounded text-neutral-400 shadow-sm">ESC</kbd> 
              Close
            </span>
          </div>
          <div className="text-indigo-500/80 animate-pulse">
            Neural Core v2
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpotlightModal;
