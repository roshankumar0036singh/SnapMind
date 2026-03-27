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
                <Loader2 className="w-8 h-8 text-[#6366f1] animate-spin" />
                <p className="text-[11px] font-black uppercase tracking-widest text-[#71717a]">Scanning for Stale Records...</p>
            </div>
        );
    }

    if (suggestions.length === 0) {
        return (
            <div className="p-16 text-center bg-[#09090b] min-h-screen flex flex-col items-center justify-center">
                <div className="max-w-md w-full p-16 rounded-[32px] border border-[#1e1e26] bg-[#0f0f14] shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-700">
                    <div className="w-20 h-20 bg-gradient-to-br from-[#1e1e26] to-[#07070a] border border-[#6366f1]/30 text-[#6366f1] rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-[0_0_40px_rgba(99,102,241,0.15)] relative group-hover:scale-110 transition-transform">
                        <ShieldCheck className="w-10 h-10 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                    </div>
                    <h3 className="text-[#fafafa] font-black text-sm uppercase tracking-[0.2em]">Library Integral</h3>
                    <p className="text-[10px] text-[#71717a] mt-3 leading-relaxed font-medium uppercase tracking-widest">
                        Zero stale nodes detected. Your local semantic index is fully synchronized with current web states.
                    </p>
                    <button 
                      onClick={fetchSuggestions}
                      className="mt-8 px-6 py-2 text-[10px] font-black text-[#6366f1] border border-[#6366f1]/20 hover:bg-[#6366f1]/10 rounded-lg transition-all uppercase tracking-widest"
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
                        key={item.id || item.url}
                        className="group bg-[#0f0f14] border border-[#1e1e26] rounded-[20px] overflow-hidden hover:border-[#6366f1]/40 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition-all duration-400"
                    >
                        <div className="flex items-stretch gap-0">
                            <div className="w-1 bg-[#f59e0b] group-hover:bg-[#6366f1] transition-colors" />
                            
                            <div className="flex-1 p-5 flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-[#27272a] text-[#71717a] flex items-center justify-center flex-shrink-0 group-hover:bg-[#6366f1]/10 group-hover:text-[#6366f1] group-hover:border-[#6366f1]/20 transition-all duration-300">
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
                                            className="text-[#3f3f46] hover:text-[#6366f1] transition-colors p-1"
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
                                            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all ${
                                                refreshing === item.url 
                                                ? 'bg-[#18181b] text-[#52525b] cursor-not-allowed border border-[#27272a]' 
                                                : 'bg-[#fafafa] text-[#09090b] hover:bg-[#6366f1] hover:text-white hover:shadow-[0_8px_25px_rgba(99,102,241,0.3)] active:scale-95'
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
                    <Activity className="w-3.5 h-3.5 text-[#6366f1]" />
                    <span className="text-[9px] font-black text-[#71717a] uppercase tracking-[0.2em] px-2">Web State Monitor Active • Infrastructure Status: Optimal</span>
                </div>
            </footer>
        </div>
    );
}
