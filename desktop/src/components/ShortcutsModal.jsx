import React from 'react';
import { X, Command, Zap } from 'lucide-react';

export default function ShortcutsModal({ onClose }) {
    const shortcuts = [
        { keys: ['Ctrl', 'K'], description: 'Focus Terminal Input' },
        { keys: ['Ctrl', 'Shift', 'I'], description: 'Index Current Stream' },
        { keys: ['Ctrl', 'Shift', 'V'], description: 'Initialize Visual Scan' },
        { keys: ['Ctrl', '/'], description: 'View Documentation' },
        { keys: ['Esc'], description: 'Abort / Close Instance' },
    ];

    return (
        <div className="fixed inset-0 bg-[#09090b]/80 backdrop-blur-md flex items-center justify-center z-[100] animate-in fade-in duration-300">
            <div className="bg-[#121214] border border-[#27272a] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[#27272a] bg-[#18181b]/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#6366f1]/10 flex items-center justify-center text-[#6366f1] border border-[#6366f1]/20">
                            <Command className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#fafafa]">Key Bindings</h2>
                            <p className="text-[9px] font-black text-[#52525b] uppercase tracking-widest mt-0.5">Control Infrastructure</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-[#27272a] rounded-lg transition-all text-[#3f3f46] hover:text-[#fafafa]"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Shortcuts List */}
                <div className="p-6 space-y-4">
                    {shortcuts.map((shortcut, idx) => (
                        <div key={idx} className="flex items-center justify-between group">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#71717a] group-hover:text-[#fafafa] transition-colors">{shortcut.description}</span>
                            <div className="flex items-center gap-1.5">
                                {shortcut.keys.map((key, keyIdx) => (
                                    <React.Fragment key={keyIdx}>
                                        <kbd className="px-2 py-1 bg-[#18181b] border border-[#27272a] rounded text-[9px] font-mono font-black text-[#fafafa] shadow-inner min-w-[24px] text-center">
                                            {key}
                                        </kbd>
                                        {keyIdx < shortcut.keys.length - 1 && (
                                            <span className="text-[#3f3f46] text-[10px] font-black">+</span>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-[#09090b] border-t border-[#27272a] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap className="w-3 h-3 text-[#6366f1]" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#3f3f46]">System v2.4a</span>
                    </div>
                    <p className="text-[9px] font-black text-[#3f3f46] uppercase tracking-widest">
                        Press <kbd className="px-1.5 py-0.5 bg-[#18181b] border border-[#27272a] rounded text-[9px] font-mono text-[#52525b]">Esc</kbd> to return
                    </p>
                </div>
            </div>
        </div>
    );
}
