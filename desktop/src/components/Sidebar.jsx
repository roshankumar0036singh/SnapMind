import React from 'react';
import { MessageSquare, Database, Globe, Crop, History, Settings as SettingsIcon, BookOpen, ShieldCheck } from 'lucide-react';
import BotLogo from './BotLogo';

const Sidebar = ({ 
  mode, 
  view, 
  isFocusMode, 
  onSetMode, 
  onSetView, 
  onRegionScan,
  jobStatus
}) => {
  const { status, message, progress } = jobStatus || { status: 'idle', message: '', progress: 0 };
  if (isFocusMode) return null;

  const navItems = [
    { id: 'rag', label: 'Neural Chat', icon: MessageSquare },
    { id: 'memory', label: 'Vector Memory', icon: Database },
    { id: 'browser', label: 'Shadow Agent', icon: Globe },
    { id: 'visual', label: 'Vision Protocol', icon: Crop },
  ];

  return (
    <aside className="w-[300px] bg-[#09090b] border-r border-[#1e1e26]/60 flex flex-col z-50 pt-12 shadow-[10px_0_30px_rgba(0,0,0,0.3)] shrink-0">
      <div className="px-7 mb-10 group cursor-default">
        <div className="flex items-center gap-4 py-4 px-5 bg-[#111115] border border-[#27272a] rounded-[20px] shadow-[0_8px_20px_rgba(0,0,0,0.4)] transition-all hover:border-[#6366f1]/30">
           <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1e1e26] to-[#07070a] border border-[#2a2a35] flex items-center justify-center shadow-inner">
              <BotLogo className="w-5 h-5" color="#6366f1" />
           </div>
           <div className="min-w-0">
              <p className="text-[12px] font-black text-[#fafafa] tracking-[0.1em] uppercase font-display italic">SnapMind</p>
              <p className="text-[9px] font-bold text-[#6366f1] uppercase tracking-[0.25em] mt-0.5 opacity-80">v3.0.0-PRO</p>
           </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => { 
              onSetMode(item.id); 
              onSetView('chat'); 
              if (item.id === 'visual') onRegionScan(); 
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all group relative ${
              mode === item.id && view === 'chat'
              ? 'bg-[#0f0f14] text-[#f4f4f5] border border-[#2a2a35] shadow-sm' 
              : 'text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#0f0f14]/50'
            }`}
          >
            {mode === item.id && view === 'chat' && (
              <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-[#6366f1] rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
            )}
            <item.icon className={`w-4 h-4 transition-colors ${
              mode === item.id && view === 'chat' ? 'text-[#6366f1]' : 'group-hover:text-[#6366f1]'
            }`} />
            {item.label}
          </button>
        ))}
        
        <div className="pt-4 border-t border-[#1e1e26] mt-4 space-y-1.5">
           <button
             onClick={() => onSetView('history')}
             className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all group ${
               view === 'history' ? 'bg-[#0f0f14] text-[#f4f4f5] border border-[#2a2a35]' : 'text-[#71717a] hover:text-[#f4f4f5]'
             }`}
           >
             <History className={`w-4 h-4 ${view === 'history' ? 'text-[#6366f1]' : ''}`} />
             Research Logs
           </button>
           <button
             onClick={() => onSetView('settings')}
             className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all group ${
               view === 'settings' ? 'bg-[#0f0f14] text-[#f4f4f5] border border-[#2a2a35]' : 'text-[#71717a] hover:text-[#f4f4f5]'
             }`}
           >
             <SettingsIcon className={`w-4 h-4 ${view === 'settings' ? 'text-[#6366f1]' : ''}`} />
             Controller
           </button>
           <button
             onClick={() => onSetView('notebook')}
             className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all group ${
               view === 'notebook' ? 'bg-[#0f0f14] text-[#f4f4f5] border border-[#2a2a35]' : 'text-[#71717a] hover:text-[#f4f4f5]'
             }`}
           >
             <BookOpen className={`w-4 h-4 ${view === 'notebook' ? 'text-[#6366f1]' : ''}`} />
             Notebook
           </button>
        </div>
      </nav>

      {/* NEURAL PULSE (SSE HUD) */}
      {status !== 'idle' && (
        <div className="px-6 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="p-4 rounded-2xl bg-[#111116] border border-[#6366f1]/20 shadow-[0_0_20px_rgba(99,102,241,0.1)] relative overflow-hidden">
            {/* Pulsing Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#6366f1]/5 to-transparent animate-pulse" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-[#6366f1] uppercase tracking-[0.2em] flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#6366f1] animate-ping" />
                  Neural Pulse
                </span>
                <span className="text-[10px] font-black text-[#6366f1]">{progress}%</span>
              </div>
              
              <p className="text-[10px] font-bold text-[#fafafa] truncate mb-3 opacity-90">{message || 'Processing...'}</p>
              
              {/* Progress Bar */}
              <div className="w-full h-1 bg-[#1e1e26] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#6366f1] to-[#818cf8] transition-all duration-500 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="p-4 rounded-xl bg-[#07070a] border border-[#1e1e26] group hover:border-[#2a2a35] transition-all">
           <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#3f3f46]">Core Status</span>
              <div className="flex gap-1">
                 <div className="w-1 h-1 rounded-full bg-[#6366f1]" />
                 <div className="w-1 h-1 rounded-full bg-[#6366f1] opacity-50" />
                 <div className="w-1 h-1 rounded-full bg-[#6366f1] opacity-20" />
              </div>
           </div>
           <p className="text-[11px] font-bold text-[#fafafa] flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#6366f1]" />
              Secured
           </p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
