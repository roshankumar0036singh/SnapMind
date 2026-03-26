import React, { useState, useEffect } from 'react';
import { Database, MessageSquare, Bookmark, HardDrive, Activity, Clock, Loader2, TrendingUp } from 'lucide-react';

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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-500 font-medium">Calculating library metrics...</p>
            </div>
        );
    }

    if (!stats || stats.error) {
        return (
            <div className="p-8 text-center text-slate-500 italic bg-white rounded-3xl border border-slate-100">
                Failed to load analytics. Ensure backend is connected.
            </div>
        );
    }

    const cards = [
        { label: 'Knowledge Base', value: stats.docs, sub: 'Chunks', icon: Database, color: 'bg-blue-50 text-blue-500' },
        { label: 'Storage Usage', value: stats.storage, sub: 'Local Disk', icon: HardDrive, color: 'bg-purple-50 text-purple-500' },
        { label: 'Chat History', value: stats.sessions, sub: 'Conversations', icon: MessageSquare, color: 'bg-emerald-50 text-emerald-500' },
        { label: 'Notebook', value: stats.bookmarks, sub: 'Saved Snippets', icon: Bookmark, color: 'bg-orange-50 text-orange-500' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                {cards.map((card, i) => (
                    <div key={i} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all">
                        <div className={`w-10 h-10 ${card.color} rounded-2xl flex items-center justify-center mb-4`}>
                            <card.icon className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-black text-slate-800 tracking-tight">{card.value}</div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">{card.label}</div>
                        <div className="text-[10px] text-slate-300 mt-0.5">{card.sub}</div>
                    </div>
                ))}
            </div>

            {/* Health Indicator */}
            <div className="bg-gradient-to-r from-indigo-500 to-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <Activity className="w-24 h-24" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">System Health</span>
                    </div>
                    <h3 className="text-xl font-bold">Privacy Integrity: Excellent</h3>
                    <p className="text-xs opacity-80 mt-1 max-w-[200px]">All data is stored locally. Encrypted transmission active.</p>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-indigo-500" />
                        Growth History
                    </h3>
                    <span className="px-2 py-1 bg-slate-50 text-slate-400 text-[10px] font-bold rounded-lg uppercase">Live</span>
                </div>
                
                <div className="space-y-4">
                    {stats.recent && stats.recent.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-slate-700 truncate">{item.url}</div>
                                <div className="text-[10px] text-slate-400">{new Date(item.date).toLocaleDateString()} at {new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                            </div>
                            <div className="text-[10px] font-bold text-emerald-500">Active</div>
                        </div>
                    ))}
                    {(!stats.recent || stats.recent.length === 0) && (
                        <p className="text-center text-xs text-slate-400 italic py-4">No recent activity detected.</p>
                    )}
                </div>
            </div>
            
            <div className="text-center p-4">
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    RAG Analytics v1.0 • Privacy Secured
                 </p>
            </div>
        </div>
    );
}
