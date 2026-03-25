import React from 'react';
import { X, Command } from 'lucide-react';

export default function ShortcutsModal({ onClose }) {
    const shortcuts = [
        { keys: ['Ctrl', 'K'], description: 'Focus search input' },
        { keys: ['Ctrl', 'Shift', 'I'], description: 'Index current page' },
        { keys: ['Ctrl', 'Shift', 'V'], description: 'Start visual scan' },
        { keys: ['Ctrl', '/'], description: 'Show this help' },
        { keys: ['Esc'], description: 'Close modals / Cancel' },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <Command className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-lg font-semibold text-slate-800">Keyboard Shortcuts</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                </div>

                {/* Shortcuts List */}
                <div className="p-6 space-y-3">
                    {shortcuts.map((shortcut, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">{shortcut.description}</span>
                            <div className="flex items-center gap-1">
                                {shortcut.keys.map((key, keyIdx) => (
                                    <React.Fragment key={keyIdx}>
                                        <kbd className="px-2 py-1 bg-slate-100 border border-slate-300 rounded text-xs font-mono text-slate-700 shadow-sm">
                                            {key}
                                        </kbd>
                                        {keyIdx < shortcut.keys.length - 1 && (
                                            <span className="text-slate-400 text-xs">+</span>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 rounded-b-2xl border-t border-slate-200">
                    <p className="text-xs text-slate-500 text-center">
                        Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs font-mono">Esc</kbd> to close
                    </p>
                </div>
            </div>
        </div>
    );
}
