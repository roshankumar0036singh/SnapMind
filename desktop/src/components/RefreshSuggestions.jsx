import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, ExternalLink, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
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
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-500 font-medium">Checking for updates...</p>
            </div>
        );
    }

    if (suggestions.length === 0) {
        return (
            <div className="text-center p-12 bg-white rounded-3xl border border-slate-200 border-dashed animate-in fade-in zoom-in-95 duration-500">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-slate-800 font-bold text-lg">Library is Up to Date</h3>
                <p className="text-sm text-slate-500 max-w-[260px] mx-auto mt-2 leading-relaxed">
                    No stale content detected. Your indexed knowledge is healthy and fresh.
                </p>
                <button 
                  onClick={fetchSuggestions}
                  className="mt-6 px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                >
                    Check Again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500 pb-20">
            {suggestions.map((item) => (
                <div 
                    key={item.id}
                    className="group bg-white border border-slate-200 rounded-2xl p-4 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/5 transition-all relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
                    
                    <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
                            <Clock className="w-6 h-6" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-800 text-sm truncate pr-4">
                                {item.url}
                            </h4>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
                                {item.reason}
                            </p>
                            
                            <div className="flex items-center gap-4 mt-3">
                                <button 
                                    onClick={() => handleRefresh(item.url)}
                                    disabled={refreshing === item.url}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                        refreshing === item.url 
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 active:scale-95'
                                    }`}
                                >
                                    {refreshing === item.url ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    )}
                                    {refreshing === item.url ? 'Updating...' : 'Refresh Now'}
                                </button>
                                
                                <a 
                                    href={item.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
            
            <div className="p-4 text-center">
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    Web Monitor v1.0
                 </p>
            </div>
        </div>
    );
}
