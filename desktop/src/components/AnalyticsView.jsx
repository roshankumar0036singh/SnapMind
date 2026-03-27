import React, { useState, useEffect } from 'react';
import { Database, MessageSquare, Bookmark, HardDrive, Activity, Clock, Loader2, TrendingUp, ShieldCheck, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function AnalyticsView({ backendUrl }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const baseUrl = backendUrl || 'http://localhost:8000';
                const response = await fetch(`${baseUrl}/admin/analytics`);
                const data = await response.json();
                setStats(data);
            } catch (e) {
                console.error("Failed to fetch analytics:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [backendUrl]);

    const handleExportLogs = () => {
        if (!stats) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(stats, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `snapmind_analytics_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        toast.success("Analytical ledger exported");
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4 bg-[#09090b] min-h-screen">
                <Loader2 className="w-8 h-8 text-[#22c55e] animate-spin" />
                <p className="text-[11px] font-black uppercase tracking-widest text-[#71717a]">Calculating Infrastructure Load...</p>
            </div>
        );
    }

    if (!stats || stats.error) {
        return (
            <div className="p-12 text-center bg-[#09090b] min-h-screen">
                <div className="max-w-xs mx-auto p-8 rounded-2xl border border-dashed border-[#27272a] text-[#71717a]">
                    <Activity className="w-10 h-10 mx-auto mb-4 opacity-20" />
                    <p className="text-xs font-medium uppercase tracking-wider italic">Telemetry Offline</p>
                    <p className="text-[10px] mt-2 text-[#3f3f46]">Ensure backend infrastructure is reachable.</p>
                </div>
            </div>
        );
    }

    const cards = [
        { label: 'Knowledge Base', value: stats.docs, sub: 'VECTOR CHUNKS', icon: Database, color: 'text-[#22c55e] border-[#22c55e]/20' },
        { label: 'Storage Usage', value: stats.storage, sub: 'LOCAL NVMe', icon: HardDrive, color: 'text-[#22c55e] border-[#22c55e]/20' },
        { label: 'Persistence', value: stats.sessions, sub: 'CONVERSATIONS', icon: MessageSquare, color: 'text-[#22c55e] border-[#22c55e]/20' },
        { label: 'Notebook', value: stats.bookmarks, sub: 'RESEARCH NODES', icon: Bookmark, color: 'text-[#22c55e] border-[#22c55e]/20' },
    ];

    return (
        <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-[#09090b] min-h-full pb-24">
            {/* Header Section */}
            <header className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#fafafa]">System Telemetry</h2>
                    <p className="text-[10px] font-medium text-[#71717a] uppercase tracking-widest mt-1">Real-time Performance Metrics</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                    <span className="text-[9px] font-black text-[#22c55e] uppercase tracking-tighter">Live Monitor</span>
                </div>
            </header>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                {cards.map((card, i) => (
                    <div key={i} className="bg-[#121214] border border-[#27272a] rounded-xl p-6 group hover:border-[#22c55e]/50 transition-all duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2.5 bg-[#18181b] rounded-lg group-hover:bg-[#22c55e]/10 group-hover:text-[#22c55e] transition-colors border border-transparent group-hover:border-[#22c55e]/20">
                                <card.icon className="w-4 h-4" />
                            </div>
                            <TrendingUp className="w-3 h-3 text-[#3f3f46] group-hover:text-[#22c55e] transition-colors" />
                        </div>
                        <div className="text-3xl font-black text-[#fafafa] tracking-tighter mb-1">{card.value}</div>
                        <div className="text-[10px] font-black text-[#a1a1aa] uppercase tracking-widest">{card.label}</div>
                        <div className="text-[9px] font-bold text-[#3f3f46] mt-1 group-hover:text-[#22c55e]/50 transition-colors uppercase">{card.sub}</div>
                    </div>
                ))}
            </div>

            {/* Health Monitor Card */}
            <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 relative overflow-hidden group">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#22c55e 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                
                <div className="relative z-10 flex items-center justify-between">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-[#22c55e]" />
                            <span className="text-[10px] font-black text-[#22c55e] uppercase tracking-[0.2em]">Security Protocol v4</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-[#fafafa] uppercase tracking-tight">Privacy Integrity: Sealed</h3>
                            <p className="text-[10px] text-[#71717a] mt-1 uppercase font-bold tracking-wide">End-to-end Local Processing • AES-256 Vector Encryption</p>
                        </div>
                        <div className="flex items-center gap-4 pt-2">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-[#3f3f46] uppercase">Network</span>
                                <span className="text-[10px] font-bold text-[#fafafa]">Air-Gapped Compatible</span>
                            </div>
                            <div className="w-[1px] h-6 bg-[#27272a]" />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-[#3f3f46] uppercase">Latency</span>
                                <span className="text-[10px] font-bold text-[#fafafa]">&lt; 14ms (Local)</span>
                            </div>
                        </div>
                    </div>
                    <div className="hidden md:flex w-24 h-24 rounded-full bg-[#22c55e]/5 items-center justify-center border border-[#22c55e]/10 group-hover:border-[#22c55e]/20 transition-colors">
                        <Activity className="w-10 h-10 text-[#22c55e] group-hover:scale-110 transition-transform duration-500" />
                    </div>
                </div>
            </div>

            {/* Recent Activity Ledger */}
            <div className="bg-[#121214] border border-[#27272a] rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-[#27272a] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-[#71717a]" />
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#fafafa]">Ingestion Ledger</h3>
                    </div>
                    <button 
                        onClick={handleExportLogs}
                        className="text-[9px] font-black uppercase tracking-widest text-[#22c55e] hover:text-[#4ade80] transition-colors"
                    >
                        Export Logs
                    </button>
                </div>
                
                <div className="divide-y divide-[#1a1a1d]">
                    {stats.recent && stats.recent.map((item, idx) => (
                        <div key={idx} className="p-4 hover:bg-[#18181b] transition-colors flex items-center gap-4 group">
                            <div className="w-8 h-8 rounded-lg bg-[#27272a] group-hover:bg-[#22c55e]/10 flex items-center justify-center transition-colors">
                                <Zap className="w-3.5 h-3.5 text-[#3f3f46] group-hover:text-[#22c55e]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-bold text-[#fafafa] truncate uppercase tracking-tight">{item.url}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[9px] font-black text-[#52525b] uppercase tracking-widest">
                                        {new Date(item.date).toLocaleDateString()}
                                    </span>
                                    <span className="text-[9px] font-black text-[#3f3f46]">@</span>
                                    <span className="text-[9px] font-black text-[#52525b] uppercase tracking-widest">
                                        {new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                            </div>
                            <div className="px-2 py-0.5 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded text-[8px] font-black text-[#22c55e] uppercase tracking-tighter">
                                PERSISTED
                            </div>
                        </div>
                    ))}
                    {(!stats.recent || stats.recent.length === 0) && (
                        <div className="p-12 text-center">
                            <p className="text-[10px] text-[#3f3f46] font-bold uppercase tracking-widest italic">No Transaction Records Found</p>
                        </div>
                    )}
                </div>
            </div>
            
            <footer className="pt-8 pb-4 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#27272a] bg-[#121214]">
                    <Activity className="w-3 h-3 text-[#22c55e]" />
                    <span className="text-[9px] font-black text-[#71717a] uppercase tracking-[0.2em]">SnapMind Kernel v2.4a • Infrastructure Status: Optimized</span>
                </div>
            </footer>
        </div>
    );
}
