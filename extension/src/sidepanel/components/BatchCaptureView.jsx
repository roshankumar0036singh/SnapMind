import React, { useState, useEffect } from 'react';
import { ArrowLeft, Globe, Check, Layers, Monitor, X, Play, ShieldAlert, Circle, CheckCircle2 } from 'lucide-react';

export default function BatchCaptureView({ onBack, onBatchStart, currentWorkspace, currentSessionId }) {
    const [tabs, setTabs] = useState([]);
    const [selectedTabIds, setSelectedTabIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [autoClose, setAutoClose] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchTabs = async () => {
            setLoading(true);
            try {
                const allTabs = await chrome.tabs.query({ currentWindow: true });
                // Filter out non-ingestible pages
                const filtered = allTabs.filter(t => 
                    t.url && 
                    !t.url.startsWith('chrome://') && 
                    !t.url.startsWith('devtools://') && 
                    !t.url.startsWith('edge://') &&
                    !t.url.startsWith('about:') &&
                    !t.url.startsWith('chrome-extension://')
                );
                setTabs(filtered);
                // Auto-select current tab (if it's in the list)
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (activeTab && filtered.some(t => t.id === activeTab.id)) {
                    setSelectedTabIds(new Set([activeTab.id]));
                }
            } catch (err) {
                console.error("Failed to fetch tabs:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchTabs();
    }, []);

    const toggleTab = (id) => {
        const next = new Set(selectedTabIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedTabIds(next);
    };

    const toggleAll = () => {
        if (selectedTabIds.size === filteredTabs.length) {
            setSelectedTabIds(new Set());
        } else {
            setSelectedTabIds(new Set(filteredTabs.map(t => t.id)));
        }
    };

    const handleStart = () => {
        const selectedTabs = tabs.filter(t => selectedTabIds.has(t.id));
        onBatchStart(selectedTabs, { autoClose });
    };

    const filteredTabs = tabs.filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.url.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-screen bg-[#F8FAFC]">
            {/* Header */}
            <header className="shrink-0 px-4 py-4 border-b border-slate-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-1.5 hover:bg-slate-100 rounded-xl transition-all text-slate-500"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="flex flex-col">
                        <h2 className="font-bold text-slate-900 text-sm leading-none">Batch Scan</h2>
                        <span className="text-[10px] text-indigo-500 font-bold mt-1 uppercase tracking-tighter">Multi-Tab Ingestion</span>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 pb-32">
                
                {/* Search & Bulk Actions */}
                <div className="space-y-3">
                    <div className="relative">
                        <input 
                            type="text"
                            placeholder="Filter open tabs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                        />
                    </div>
                    
                    <div className="flex items-center justify-between px-1">
                        <button 
                            onClick={toggleAll}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                        >
                            {selectedTabIds.size === filteredTabs.length ? 'Deselect All' : 'Select All'}
                        </button>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {selectedTabIds.size} of {filteredTabs.length} Selected
                        </span>
                    </div>
                </div>

                {/* Tab List */}
                <div className="space-y-2">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center gap-3 text-slate-300">
                            <Layers className="w-8 h-8 animate-pulse" />
                            <span className="text-xs font-medium">Scanning browser workspace...</span>
                        </div>
                    ) : filteredTabs.length === 0 ? (
                        <div className="py-20 text-center space-y-2">
                            <Globe className="w-8 h-8 mx-auto text-slate-200" />
                            <p className="text-xs text-slate-400 font-medium whitespace-pre-wrap">
                                {searchQuery ? "No tabs match your search." : "No ingestible tabs found.\nOpen some research pages to get started."}
                            </p>
                        </div>
                    ) : (
                        filteredTabs.map((tab) => (
                            <div 
                                key={tab.id}
                                onClick={() => toggleTab(tab.id)}
                                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 group ${
                                    selectedTabIds.has(tab.id) 
                                    ? 'bg-white border-indigo-200 shadow-md ring-1 ring-indigo-50' 
                                    : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:border-slate-200'
                                }`}
                            >
                                <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all ${
                                    selectedTabIds.has(tab.id)
                                    ? 'bg-indigo-500 border-indigo-500 text-white'
                                    : 'border-slate-200 bg-white group-hover:border-indigo-300'
                                }`}>
                                    {selectedTabIds.has(tab.id) && <Check className="w-3 h-3" />}
                                </div>
                                
                                <div className="shrink-0 w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center shadow-sm overflow-hidden">
                                    <img 
                                        src={`https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}&sz=64`}
                                        className="w-5 h-5"
                                        onError={(e) => { e.target.src = 'favicon-placeholder.png'; }}
                                    />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h4 className="text-xs font-bold text-slate-800 truncate mb-0.5">
                                        {tab.title}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 truncate">
                                        {new URL(tab.url).hostname}
                                    </p>
                                </div>
                                
                                {tab.active && (
                                    <div className="shrink-0 px-1.5 py-0.5 bg-indigo-50 text-indigo-500 text-[8px] font-black rounded uppercase tracking-tighter border border-indigo-100/50">
                                        Active
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Auto-Close Info */}
                <div className="p-3 bg-red-50/30 rounded-2xl border border-red-100/30 flex items-start gap-3">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-red-800 uppercase tracking-tight">Cleanup Mode</p>
                        <p className="text-[10px] text-red-700/70 leading-relaxed font-medium">
                            Enabling "Auto-Close" will close the tabs upon successful ingestion to clear your workspace.
                        </p>
                    </div>
                </div>
            </main>

            {/* Sticky Actions */}
            <footer className="shrink-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200/60 absolute bottom-0 left-0 right-0 z-40 space-y-4">
                <div className="flex items-center justify-between px-1">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-800">Auto-Close Tabs</span>
                        <span className="text-[9px] text-slate-400">Clear workspace after indexing</span>
                    </div>
                    <button
                        onClick={() => setAutoClose(!autoClose)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${autoClose ? 'bg-red-500' : 'bg-slate-200'}`}
                    >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${autoClose ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                </div>

                <button
                    onClick={handleStart}
                    disabled={selectedTabIds.size === 0}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold transition-all shadow-lg active:scale-[0.98] ${
                        selectedTabIds.size === 0
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
                        : 'bg-indigo-600 text-white hover:bg-slate-900 shadow-indigo-200'
                    }`}
                >
                    <Play className="w-3.5 h-3.5" />
                    Start Batch Indexing ({selectedTabIds.size})
                </button>
            </footer>
        </div>
    );
}
