import React from 'react';
import { Globe, Activity, X } from 'lucide-react';

const Header = ({ 
  isFocusMode, 
  onSetFocusMode, 
  view, 
  mode, 
  currentUrl, 
  visibleBrowser, 
  onSetVisibleBrowser, 
  isCitationPanelOpen, 
  onCloseCitationPanel, 
  onSetView 
}) => {
  return (
    <>
      {/* DESKTOP TITLE BAR (Draggable) */}
      <div className="h-10 border-b border-[#1e1e26] bg-[#07070a]/80 backdrop-blur-xl flex items-center justify-between px-6 z-50 shrink-0" style={{ WebkitAppRegion: 'drag' }}>
        <div className="flex items-center gap-3">
           <div className="w-2 h-2 rounded-full bg-[#6366f1] animate-pulse shadow-[0_0_8px_#6366f1]" />
           <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-[0.3em] font-display">SnapMind <span className="text-[#3f3f46]">Console</span></span>
        </div>
        
        <div className="flex items-center -mr-2 no-drag" style={{ WebkitAppRegion: 'no-drag' }}>
           <button onClick={() => window.close()} className="p-2.5 hover:bg-neutral-800 transition-colors">
             <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
               <path d="M1 1L9 9M9 1L1 9" stroke="#71717a" strokeWidth="1.5" strokeLinecap="round"/>
             </svg>
           </button>
        </div>
      </div>

      {/* HEADER / TOOLBAR */}
      {isFocusMode ? (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
          <div className="px-3 py-1.5 bg-[#6366f1]/10 border border-[#6366f1]/30 rounded-full flex items-center gap-2 animate-pulse">
            <div className="w-1.5 h-1.5 rounded-full bg-[#6366f1]" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#6366f1]">Focus Mode</span>
          </div>
          <button
            onClick={() => onSetFocusMode(false)}
            className="p-1.5 bg-[#18181b] border border-[#27272a] rounded-lg hover:bg-[#27272a] text-[#71717a] hover:text-white transition-all"
            title="Exit Focus Mode (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <header className="h-14 border-b border-[#1a1a1d] flex items-center justify-between px-8 bg-[#09090b]/40 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-4">
             <h2 className="text-sm font-bold tracking-tight text-[#fafafa] lowercase">
                ~/ {view === 'chat' ? (mode === 'rag' ? 'neural-chat' : mode === 'browser' ? 'shadow-agent' : 'vision-protocol') : view === 'memory' ? 'vector-memory' : view === 'settings' ? 'controller-config' : view === 'notebook' ? 'research-notebook' : 'system-logs'}
             </h2>
             
             {currentUrl && (
                <div className="flex items-center gap-2 px-3 py-1 bg-[#111113] border border-[#27272a] rounded-full">
                  <Globe className="w-3 h-3 text-[#71717a]" />
                  <span className="text-[10px] font-bold text-[#a1a1aa] truncate max-w-[150px]">
                    {(() => {
                      try { return new URL(currentUrl).hostname; } 
                      catch(e) { return currentUrl; }
                    })()}
                  </span>
                </div>
             )}
          </div>

          <div className="flex items-center gap-2">
             {mode === 'browser' && (
                <div className="flex items-center gap-2 pr-4 mr-2 border-r border-[#1a1a1d]">
                   <span className="text-[10px] font-black text-[#3f3f46] uppercase tracking-widest">Observer</span>
                   <button
                    onClick={() => onSetVisibleBrowser(!visibleBrowser)}
                    className={`w-7 h-3.5 rounded-full relative transition-all duration-300 ${visibleBrowser ? 'bg-[#6366f1]' : 'bg-[#1a1a1d]'}`}
                  >
                    <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all duration-300 ${visibleBrowser ? 'left-3.5' : 'left-0.5'}`} />
                  </button>
                </div>
             )}
             
             {isCitationPanelOpen && (
                <button 
                  onClick={onCloseCitationPanel}
                  className="px-3 py-1 bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20 rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-[#6366f1]/20 transition-all mr-2"
                >
                  Close Panel
                </button>
             )}

             <button 
                onClick={() => { onSetView('memory'); }}
                className="p-2 text-[#71717a] hover:text-[#fafafa] transition-colors rounded-lg hover:bg-[#111113]"
             >
                <Activity className="w-4 h-4" />
             </button>
          </div>
        </header>
      )}
    </>
  );
};

export default Header;
