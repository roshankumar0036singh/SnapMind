import React from 'react';
import { motion } from 'framer-motion';
import { Pin, Bookmark, Send, Loader2, X } from 'lucide-react';
import PersonaSelector from './PersonaSelector';
import LanguageSelector from './LanguageSelector';

const InputArea = ({ 
  input, 
  onSetInput, 
  onSend, 
  isLoading, 
  cropPreview, 
  onSetCropPreview, 
  pinnedTabs, 
  onRemovePinnedTab, 
  selectedPersonaId, 
  onSelectPersona, 
  outputLang, 
  onSetOutputLang, 
  queryNotebook, 
  onSetQueryNotebook, 
  onPinCurrent, 
  onSetView 
}) => {
  return (
    <footer className="px-8 pb-8 pt-4">
      {/* Pinned Tabs Manager */}
      {pinnedTabs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 animate-in slide-in-from-left-2 transition-all">
            {pinnedTabs.map((tab, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-[#111113] border border-[#27272a] rounded-full group">
                    <Pin className="w-3 h-3 text-[#6366f1]" />
                    <span className="text-[10px] font-bold text-[#f4f4f5] max-w-[100px] truncate">{tab.title}</span>
                    <button 
                        onClick={() => onRemovePinnedTab(idx)}
                        className="p-0.5 hover:text-[#ef4444] transition-colors"
                    >
                        <X className="w-2.5 h-2.5" />
                    </button>
                </div>
            ))}
        </div>
      )}

      <div className="relative group">
        <div className="absolute inset-0 bg-[#6366f1]/5 rounded-2xl blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
        <form 
          onSubmit={(e) => { e.preventDefault(); onSend(); }}
          className="relative bg-[#0f0f14] border border-[#1e1e26] rounded-2xl focus-within:border-[#6366f1]/40 transition-all shadow-xl flex flex-col"
        >
          {/* Vision Protocol Preview IN-BAR */}
          {cropPreview && (
            <div className="px-6 pt-4 flex gap-3 overflow-x-auto bg-[#111116]/50 border-b border-[#1e1e26]/30">
               <motion.div 
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="mb-4 relative group shrink-0"
               >
                   <img src={cropPreview} className="h-16 w-auto rounded-lg border border-[#6366f1]/40 shadow-xl object-contain bg-[#111115]" />
                   <button 
                       onClick={() => onSetCropPreview(null)}
                       className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#ef4444] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform text-[10px] font-bold"
                   >
                       <X className="w-3 h-3" />
                   </button>
               </motion.div>
            </div>
          )}
          <div className="relative flex items-center">
            <input 
              className="w-full bg-transparent border-none pl-8 pr-24 py-6 focus:outline-none text-[15px] text-[#fafafa] placeholder:text-[#52525b] font-medium tracking-tight"
              placeholder="Neural prompt or local command..."
              value={input}
              onChange={(e) => onSetInput(e.target.value)}
            />
            <button 
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-4 top-3 bottom-0.5 px-6 bg-[#6366f1] text-white rounded-xl font-bold text-[11px] uppercase tracking-[0.2em] hover:bg-[#4f46e5] hover:scale-[1.02] transition-all disabled:opacity-20 disabled:grayscale active:scale-95 shadow-[0_0_20px_rgba(99,102,241,0.3)] flex items-center gap-2 h-10 mt-1"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>SEND</span> <Send className="w-3.5 h-3.5" /></>}
            </button>
          </div>

          {/* Agent Controls */}
          <div className="px-6 py-3 bg-[#111116]/50 border-t border-[#1e1e26]/30 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <PersonaSelector 
                   selectedPersonaId={selectedPersonaId} 
                   onSelectPersona={onSelectPersona} 
                />
                
                <LanguageSelector 
                    value={outputLang} 
                    onChange={onSetOutputLang} 
                 />
             </div>
             
             <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-3.5 h-3.5 rounded-sm border transition-all flex items-center justify-center ${queryNotebook ? 'bg-[#6366f1] border-[#6366f1]' : 'border-[#3f3f46] group-hover:border-[#6366f1]'}`}>
                    {queryNotebook && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <input type="checkbox" className="hidden" checked={queryNotebook} onChange={() => onSetQueryNotebook(!queryNotebook)} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#71717a] group-hover:text-[#fafafa] transition-colors">Global Knowledge</span>
                </label>
             </div>
          </div>
        </form>
      </div>
      
      <div className="mt-4 flex items-center justify-center gap-6">
         <button 
            onClick={onPinCurrent}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#3f3f46] hover:text-[#6366f1] transition-colors"
         >
            <Pin className="w-3 h-3" /> Pin Current
         </button>
         <div className="h-3 w-[1px] bg-[#1a1a1d]" />
         <button 
            onClick={() => onSetView('memory')}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#3f3f46] hover:text-[#6366f1] transition-colors"
         >
            <Bookmark className="w-3 h-3" /> Library
         </button>
      </div>
    </footer>
  );
};

export default InputArea;
