import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, ExternalLink, ShieldCheck, Loader2, AlertCircle, Zap, Activity } from 'lucide-react';
import { toast } from 'sonner';

export default function RefreshSuggestions({ backendUrl }) {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(null); // URL being refreshed

    const fetchSuggestions = async () => {
        setLoading(true);
        try {
            const baseUrl = backendUrl || 'http://localhost:8000';
            const response = await fetch(`${baseUrl}/admin/refresh-suggestions`);
            const data = await response.json();
            setSuggestions(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Failed to fetch suggestions:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuggestions();
    }, [backendUrl]);

    const handleRefresh = async (url) => {
        setRefreshing(url);
        const toastId = toast.loading(`Re-indexing ${url}...`);
        try {
            const baseUrl = backendUrl || 'http://localhost:8000';
            const response = await fetch(`${baseUrl}/admin/refresh-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const result = await response.json();
            if (result.success) {
                toast.success("Content updated successfully!", { id: toastId });
                setSuggestions(prev => prev.filter(s => s.url !== url));
            } else {
                toast.error(`Refresh failed: ${result.error}`, { id: toastId });
            }
        } catch (e) {
            toast.error(`Error: ${e.message}`, { id: toastId });
        } finally {
            setRefreshing(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4 bg-[#09090b] min-h-full">
                <Loader2 className="w-8 h-8 text-[#22c55e] animate-spin" />
                <p className="text-[11px] font-black uppercase tracking-widest text-[#71717a]">Scanning for Stale Records...</p>
            </div>
        );
    }

    if (suggestions.length === 0) {
        return (
            <div className="p-12 text-center bg-[#09090b] min-h-screen">
                <div className="max-w-md mx-auto p-12 rounded-2xl border border-dashed border-[#27272a] bg-[#121214] animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-16 h-16 bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(34,197,94,0.1)]">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h3 className="text-[#fafafa] font-black text-sm uppercase tracking-[0.2em]">Library Integral</h3>
                    <p className="text-[10px] text-[#71717a] mt-3 leading-relaxed font-medium uppercase tracking-widest">
                        Zero stale nodes detected. Your local semantic index is fully synchronized with current web states.
                    </p>
                    <button 
                      onClick={fetchSuggestions}
                      className="mt-8 px-6 py-2 text-[10px] font-black text-[#22c55e] border border-[#22c55e]/20 hover:bg-[#22c55e]/10 rounded-lg transition-all uppercase tracking-widest"
                    >
                        Force Rescan
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 animate-in slide-in-from-bottom-4 duration-500 bg-[#09090b] min-h-full pb-24">
            {/* Header */}
            <header className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#fafafa]">Maintenance Queue</h2>
                    <p className="text-[10px] font-medium text-[#71717a] uppercase tracking-widest mt-1">Stale Content Synchronization</p>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-[#f59e0b] uppercase tracking-tighter px-2 py-1 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded">
                        {suggestions.length} Records Pending
                    </span>
                </div>
            </header>

            <div className="space-y-4">
                {suggestions.map((item) => (
                    <div 
                        key={item.id}
                        className="group bg-[#121214] border border-[#27272a] rounded-xl overflow-hidden hover:border-[#22c55e]/30 transition-all duration-300"
                    >
                        <div className="flex items-stretch gap-0">
                            <div className="w-1 bg-[#f59e0b] group-hover:bg-[#22c55e] transition-colors" />
                            
                            <div className="flex-1 p-5 flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-[#27272a] text-[#71717a] flex items-center justify-center flex-shrink-0 group-hover:bg-[#22c55e]/10 group-hover:text-[#22c55e] group-hover:border-[#22c55e]/20 transition-all duration-300">
                                    <Clock className="w-5 h-5" />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-[#fafafa] text-xs truncate pr-4 uppercase tracking-tighter">
                                            {item.url}
                                        </h4>
                                        <a 
                                            href={item.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-[#3f3f46] hover:text-[#22c55e] transition-colors p-1"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    </div>
                                    
                                    <p className="text-[10px] text-[#71717a] mt-1.5 flex items-center gap-1.5 font-medium uppercase tracking-wide">
                                        <AlertCircle className="w-3.5 h-3.5 text-[#f59e0b]" />
                                        {item.reason}
                                    </p>
                                    
                                    <div className="flex items-center gap-4 mt-4">
                                        <button 
                                            onClick={() => handleRefresh(item.url)}
                                            disabled={refreshing === item.url}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                                refreshing === item.url 
                                                ? 'bg-[#18181b] text-[#3f3f46] cursor-not-allowed border border-[#27272a]' 
                                                : 'bg-[#fafafa] text-[#09090b] hover:bg-[#22c55e] hover:shadow-[0_0_20px_rgba(34,197,94,0.2)] active:scale-95'
                                            }`}
                                        >
                                            {refreshing === item.url ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <RefreshCw className="w-3.5 h-3.5" />
                                            )}
                                            {refreshing === item.url ? 'Syncing...' : 'Synchronize Node'}
                                        </button>
                                        
                                        {refreshing !== item.url && (
                                            <div className="text-[9px] font-black text-[#3f3f46] uppercase tracking-widest group-hover:text-[#52525b] transition-colors">
                                                Last Scanned: {new Date().toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            <footer className="pt-12 pb-6 text-center border-t border-[#1a1a1d]">
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-[#27272a] bg-[#121214] shadow-inner">
                    <Activity className="w-3.5 h-3.5 text-[#22c55e]" />
                    <span className="text-[9px] font-black text-[#71717a] uppercase tracking-[0.2em] px-2">Web State Monitor Active • Infrastructure Status: Optimal</span>
                </div>
            </footer>
        </div>
    );
}
