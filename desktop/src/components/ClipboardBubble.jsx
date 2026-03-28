import React, { useState, useEffect, useCallback } from 'react';
import { Clipboard, X, Sparkles, MessageSquare, Globe, Image as ImageIcon, Copy, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ClipboardBubble = ({ onAction }) => {
  const [clip, setClip] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (window.electronAPI?.onClipboardUpdate) {
      const unsubscribe = window.electronAPI.onClipboardUpdate((data) => {
        setClip(data);
        setIsVisible(true);
        
        // Auto-hide after 8 seconds
        const timer = setTimeout(() => {
          setIsVisible(false);
        }, 8000);
        
        return () => clearTimeout(timer);
      });
      return unsubscribe;
    }
  }, []);

  const handleAction = (actionType) => {
    if (onAction && clip) {
      onAction(actionType, clip);
    }
    setIsVisible(false);
  };

  const getSuggestions = () => {
    if (!clip) return [];
    if (clip.type === 'image') {
      return [
        { id: 'analyze_vision', label: 'Analyze Visual', icon: Sparkles, color: 'text-indigo-400' },
        { id: 'ocr_to_chat', label: 'OCR to Chat', icon: MessageSquare, color: 'text-emerald-400' }
      ];
    }
    if (clip.type === 'text') {
      // Check if URL
      if (clip.content.startsWith('http')) {
        return [
          { id: 'crawl_url', label: 'Digest Page', icon: Globe, color: 'text-blue-400' },
          { id: 'add_to_pins', label: 'Pin Tab', icon: Zap, color: 'text-amber-400' }
        ];
      }
      return [
        { id: 'summarize', label: 'Summarize', icon: Sparkles, color: 'text-indigo-400' },
        { id: 'translate', label: 'Translate', icon: Globe, color: 'text-cyan-400' },
        { id: 'explain_code', label: 'Explain Code', icon: Zap, color: 'text-emerald-400' }
      ];
    }
    return [];
  };

  return (
    <AnimatePresence>
      {isVisible && clip && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
          className="fixed bottom-6 right-6 z-[1000] w-72 bg-[#09090b] border border-[#1e1e26] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-[#111113] border-b border-[#1e1e26] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#6366f1]/10 flex items-center justify-center">
                <Clipboard className="w-3 h-3 text-[#6366f1]" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#fafafa]">Clipboard Match</span>
            </div>
            <button 
              onClick={() => setIsVisible(false)}
              className="p-1 hover:bg-[#1e1e26] rounded-md text-[#71717a] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Content Preview */}
          <div className="p-4">
             <div className="flex items-start gap-3 mb-4">
                {clip.type === 'image' ? (
                  <img src={clip.content} className="w-12 h-12 rounded-lg object-cover border border-[#27272a]" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-[#27272a]/30 flex items-center justify-center shrink-0">
                    <Copy className="w-4 h-4 text-[#71717a]" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                   <p className="text-[11px] font-bold text-[#71717a] uppercase tracking-widest mb-1">
                     {clip.type} detected
                   </p>
                   <p className="text-[12px] text-[#fafafa] font-medium truncate leading-tight">
                     {clip.type === 'image' ? 'System Screenshot' : clip.content.substring(0, 50)}
                   </p>
                </div>
             </div>

             {/* Actions List */}
             <div className="grid grid-cols-1 gap-1.5">
                {getSuggestions().map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleAction(action.id)}
                    className="flex items-center gap-3 px-3 py-2 bg-[#18181b] border border-[#27272a] rounded-xl hover:bg-[#6366f1]/10 hover:border-[#6366f1]/30 transition-all group w-full text-left"
                  >
                    <div className={`p-1.5 rounded-lg bg-black/40 ${action.color} group-hover:scale-110 transition-transform`}>
                      <action.icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] font-bold text-[#a1a1aa] group-hover:text-[#fafafa] uppercase tracking-wider">
                      {action.label}
                    </span>
                  </button>
                ))}
             </div>
          </div>

          {/* Progress Indication (Auto-hide timer) */}
          <div className="h-0.5 bg-[#6366f1]/20 w-full overflow-hidden">
             <motion.div 
               initial={{ scaleX: 1 }}
               animate={{ scaleX: 0 }}
               transition={{ duration: 8, ease: "linear" }}
               className="h-full bg-[#6366f1] origin-left"
             />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ClipboardBubble;
