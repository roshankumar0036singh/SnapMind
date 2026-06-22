import React, { useState, useEffect } from 'react';
import { MessageSquare, Trash2, Plus, Tag, Copy, Check } from 'lucide-react';
import { apiClient } from '../../background/api';

export default function SessionList({
    sessions,
    currentSessionId,
    onSessionSwitch,
    onSessionDelete,
    onNewSession,
    onClearAll
}) {
    const [tags, setTags] = useState([]);
    const [copiedId, setCopiedId] = useState(null);

    const handleCopyId = (e, id) => {
        e.stopPropagation();
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    useEffect(() => {
        // Fetch global semantic tags on mount
        const loadTags = async () => {
            const fetchedTags = await apiClient.getTags();
            setTags(fetchedTags || []);
        };
        loadTags();
    }, []);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800">Conversations</h3>
                <button
                    onClick={onNewSession}
                    className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-600 transition-colors"
                    title="New conversation"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {sessions.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs py-8">
                        No conversations yet
                    </div>
                ) : (
                    sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => onSessionSwitch(session.id)}
                            className={`group relative p-3 rounded-lg cursor-pointer transition-all ${session.id === currentSessionId
                                ? 'bg-indigo-50 border border-indigo-200'
                                : 'bg-white border border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                                }`}
                        >
                            <div className="flex items-start gap-2">
                                <MessageSquare className={`w-4 h-4 mt-0.5 shrink-0 ${session.id === currentSessionId ? 'text-indigo-600' : 'text-slate-400'
                                    }`} />
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium truncate ${session.id === currentSessionId ? 'text-indigo-900' : 'text-slate-700'
                                        }`}>
                                        {session.title}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">
                                        {new Date(session.updatedAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all">
                                    <button
                                        onClick={(e) => handleCopyId(e, session.id)}
                                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-all mr-1"
                                        title="Copy Session ID for MCP"
                                    >
                                        {copiedId === session.id ? (
                                            <Check className="w-3.5 h-3.5 text-green-500" />
                                        ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSessionDelete(session.id);
                                        }}
                                        className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-all"
                                        title="Delete conversation"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Semantic Tags Section */}
            {tags.length > 0 && (
                <div className="p-3 border-t border-slate-200" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    <div className="flex items-center gap-1.5 mb-2 text-slate-600 font-medium text-xs uppercase tracking-wider">
                        <Tag className="w-3.5 h-3.5" />
                        Semantic Web Graph
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {tags.map((tag, idx) => (
                            <div
                                key={idx}
                                className="px-2 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-medium rounded-md hover:bg-indigo-100 cursor-pointer transition-colors"
                            >
                                {tag}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            {sessions.length > 0 && (
                <div className="p-3 border-t border-slate-200">
                    <button
                        onClick={onClearAll}
                        className="w-full py-2 px-3 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                    >
                        Clear All History
                    </button>
                </div>
            )}
        </div>
    );
}
