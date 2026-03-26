import React, { useState, useEffect } from 'react';
import { MessageSquare, Trash2, Plus, Tag, Clock, Database } from 'lucide-react';
import { apiClient } from '../background/api';

export default function SessionList({
    sessions,
    currentSessionId,
    onSessionSwitch,
    onSessionDelete,
    onNewSession,
    onClearAll
}) {
    const [tags, setTags] = useState([]);

    useEffect(() => {
        // Fetch global semantic tags on mount
        const loadTags = async () => {
            try {
                const fetchedTags = await apiClient.getTags();
                setTags(fetchedTags || []);
            } catch (e) {
                console.error("Failed to load tags:", e);
            }
        };
        loadTags();
    }, []);

    return (
        <div className="flex flex-col h-full bg-[#09090b] text-[#fafafa] font-sans">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#1a1a1d] bg-[#09090b]/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#71717a]" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#fafafa]">Persistence Ledger</h3>
                </div>
                <button
                    onClick={onNewSession}
                    className="p-1.5 hover:bg-[#1a1a1d] rounded-lg text-[#22c55e] transition-all hover:shadow-[0_0_15px_rgba(34,197,94,0.2)] active:scale-95 border border-[#22c55e]/10"
                    title="New Instance"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
                {sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <Database className="w-8 h-8 text-[#1a1a1d] mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#3f3f46] italic">
                            Zero Transaction Nodes Detected
                        </p>
                    </div>
                ) : (
                    sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => onSessionSwitch(session.id)}
                            className={`group relative p-3 rounded-xl cursor-pointer transition-all border ${session.id === currentSessionId
                                ? 'bg-[#22c55e]/5 border-[#22c55e]/30 shadow-[0_4px_20px_-8px_rgba(34,197,94,0.1)]'
                                : 'bg-[#121214] border-[#1a1a1d] hover:border-[#27272a] hover:bg-[#18181b]'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`mt-0.5 p-1.5 rounded-lg transition-colors ${session.id === currentSessionId ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#18181b] text-[#3f3f46] group-hover:text-[#71717a]'}`}>
                                    <MessageSquare className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-[11px] font-black uppercase tracking-tight truncate ${session.id === currentSessionId ? 'text-[#fafafa]' : 'text-[#a1a1aa] group-hover:text-[#fafafa]'}`}>
                                        {session.title || "Untitled Instance"}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className={`w-1 h-1 rounded-full ${session.id === currentSessionId ? 'bg-[#22c55e] animate-pulse' : 'bg-[#3f3f46]'}`} />
                                        <div className="text-[9px] font-black text-[#3f3f46] uppercase tracking-widest">
                                            {new Date(session.updatedAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSessionDelete(session.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 rounded-lg text-[#3f3f46] hover:text-red-500 transition-all"
                                    title="Purge Node"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Semantic Tags Section */}
            {tags.length > 0 && (
                <div className="p-3 border-t border-[#1a1a1d] bg-[#0a0a0c]">
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <Tag className="w-3 h-3 text-[#22c55e]" />
                        <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-[#71717a]">Semantic Schema</h4>
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-1 max-h-[120px] overflow-y-auto scrollbar-hide">
                        {tags.map((tag, idx) => (
                            <div
                                key={idx}
                                className="px-2 py-1 bg-[#121214] border border-[#27272a] text-[#a1a1aa] text-[9px] font-black uppercase tracking-tighter rounded hover:border-[#22c55e]/50 hover:text-[#22c55e] cursor-pointer transition-all"
                            >
                                {tag}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            {sessions.length > 0 && (
                <div className="p-4 border-t border-[#1a1a1d] bg-[#09090b]">
                    <button
                        onClick={onClearAll}
                        className="w-full py-2.5 px-3 text-[10px] font-black uppercase tracking-widest text-[#ef4444] border border-[#ef4444]/10 hover:bg-[#ef4444]/5 hover:border-[#ef4444]/30 rounded-lg transition-all"
                    >
                        Purge All History
                    </button>
                </div>
            )}
        </div>
    );
}
