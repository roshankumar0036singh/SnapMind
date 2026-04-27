import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Sparkles, ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';

const CitationPanel = ({ 
  isOpen, 
  onClose, 
  citation, 
  summary, 
  isSummarizing, 
  onSummarize 
}) => {
  if (!isOpen || !citation) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute top-0 right-0 bottom-0 w-[400px] bg-[#09090b]/95 backdrop-blur-2xl border-l border-[#1e1e26] z-[60] shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col"
      >
        <div className="p-6 border-b border-[#1e1e26] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#6366f1]/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-[#6366f1]" />
            </div>
            <div>
              <h3 className="text-xs font-black text-[#fafafa] uppercase tracking-widest">Source Intelligence</h3>
              <p className="text-[10px] text-[#71717a] font-medium tracking-wide truncate w-48">{citation.url || 'Local Cache'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-[#1a1a1d] rounded-lg text-[#71717a] transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="space-y-8">
            {/* Snippet Block */}
            <div>
              <span className="text-[9px] font-black text-[#3f3f46] uppercase tracking-[0.2em] mb-3 block">High-Fidelity Context</span>
              <div 
                className="p-5 rounded-2xl bg-[#6366f1]/5 border border-[#6366f1]/30 text-[#fafafa] text-[12.5px] leading-relaxed italic relative shadow-[0_0_20px_rgba(99,102,241,0.1)] animate-in fade-in zoom-in-95 duration-500"
              >
                 <span className="absolute -left-2 top-4 text-4xl text-[#6366f1]/20 font-serif">"</span>
                 {citation.snippet || citation.block?.text}
              </div>
            </div>

            {/* AI Insights / Summary */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[9px] font-black text-[#3f3f46] uppercase tracking-[0.2em]">Neural Synthesis</span>
                {!summary && (
                  <button 
                    onClick={onSummarize}
                    disabled={isSummarizing}
                    className="text-[9px] font-black uppercase text-[#6366f1] hover:text-[#818cf8] transition-colors disabled:opacity-50"
                  >
                    {isSummarizing ? 'Synthesizing...' : 'Summarize Block'}
                  </button>
                )}
              </div>
              
              {summary ? (
                <div className="p-5 rounded-2xl bg-[#6366f1]/5 border border-[#6366f1]/10 text-[#fafafa] text-[12px] leading-relaxed animate-in fade-in slide-in-from-top-2 duration-500">
                  {summary}
                </div>
              ) : (
                <div className="h-24 rounded-2xl border border-dashed border-[#1e1e26] flex items-center justify-center group cursor-pointer hover:border-[#6366f1]/30 transition-all" onClick={onSummarize}>
                   <div className="flex flex-col items-center gap-2 opacity-30 group-hover:opacity-100">
                     <Sparkles className="w-4 h-4 text-[#6366f1]" />
                     <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-widest">Click to Generate insights</span>
                   </div>
                </div>
              )}
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#111113] border border-[#1a1a1d]">
                <span className="text-[8px] font-black text-[#3f3f46] uppercase tracking-widest block mb-1">Index ID</span>
                <code className="text-[10px] text-[#a1a1aa] font-mono">{citation.blockId}</code>
              </div>
              <div className="p-4 rounded-xl bg-[#111113] border border-[#1a1a1d]">
                <span className="text-[8px] font-black text-[#3f3f46] uppercase tracking-widest block mb-1">Target Page</span>
                <span className="text-[10px] text-[#a1a1aa] font-bold">{citation.pageNum ? `Page ${citation.pageNum}` : 'Dynamic Content'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-[#07070a] border-t border-[#1e1e26] flex gap-3">
          <button 
            onClick={() => {
              if (citation.url) window.open(citation.url, '_blank');
              else toast.error("Live source not available for local snippets");
            }}
            className="flex-1 py-3 bg-[#6366f1] hover:bg-[#818cf8] text-black text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Navigate to Source
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CitationPanel;
