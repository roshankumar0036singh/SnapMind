import React, { useState, useEffect } from 'react';
import { Globe, Plus, Trash2, Activity, Zap, Loader2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../background/api';

export default function WatchedUrlsPanel() {
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchUrls();
  }, []);

  const fetchUrls = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getWatchedUrls();
      setUrls(data || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load watched URLs");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUrl = async (e) => {
    e.preventDefault();
    if (!newUrl || !newUrl.trim()) return;

    let targetUrl = newUrl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    try {
        new URL(targetUrl); // Basic validation
    } catch (_) {
        toast.error("Invalid URL format");
        return;
    }

    setIsAdding(true);
    try {
      const res = await apiClient.addWatchedUrl(targetUrl);
      if (res.success) {
        toast.success("Added to background watchlist");
        setNewUrl('');
        fetchUrls(); // Refresh list
      } else {
        toast.error("Failed to add URL: " + res.error);
      }
    } catch (e) {
      toast.error("Failed to add URL");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveUrl = async (urlToRemove) => {
    try {
      const res = await apiClient.removeWatchedUrl(urlToRemove);
      if (res.success) {
        toast.success("Removed from watchlist");
        setUrls(urls.filter(u => u.url !== urlToRemove));
      } else {
        toast.error("Failed to remove URL: " + res.error);
      }
    } catch (e) {
      toast.error("Failed to remove URL");
    }
  };

  if (loading && urls.length === 0) {
     return (
        <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-[#09090b]">
            <Loader2 className="w-6 h-6 text-[#10b981] animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest text-[#71717a]">Loading Watchlist...</p>
        </div>
     );
  }

  return (
    <div className="bg-[#121214] border border-[#27272a] rounded-xl overflow-hidden mb-6">
      <div className="px-6 py-5 border-b border-[#27272a] flex items-center justify-between bg-[#18181b]/50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 border border-[#10b981]/20 flex items-center justify-center text-[#10b981]">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#fafafa]">Targeted Web Sync</h3>
            <p className="text-[10px] text-[#71717a] font-medium uppercase tracking-widest mt-1">Background Intelligence Watchlist</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Input Form */}
        <form onSubmit={handleAddUrl} className="flex gap-3 mb-6">
            <input 
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/docs"
                className="flex-1 bg-[#09090b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs font-mono text-[#fafafa] placeholder-[#3f3f46] focus:outline-none focus:border-[#10b981] transition-all"
            />
            <button
                type="submit"
                disabled={isAdding || !newUrl.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white text-[11px] font-black uppercase tracking-widest rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Target
            </button>
        </form>

        {urls.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-[#27272a] rounded-xl bg-[#09090b]/50">
            <div className="w-10 h-10 rounded-full bg-[#18181b] flex items-center justify-center mx-auto mb-3 opacity-50">
              <Link2 className="w-5 h-5 text-[#71717a]" />
            </div>
            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#fafafa]">Empty Watchlist</h4>
            <p className="text-[10px] text-[#3f3f46] max-w-xs mx-auto mt-2 font-medium uppercase tracking-widest">
              Add specific URLs you want the system to continuously monitor for changes in the background.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto scrollbar-hide pr-2">
            {urls.map((item, idx) => (
              <li key={item.id || idx} className="flex items-center justify-between p-3 rounded-lg border border-[#27272a] bg-[#18181b] hover:border-[#10b981]/30 transition-all group">
                <div className="flex items-start gap-4 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-[#27272a] group-hover:bg-[#10b981]/10 flex items-center justify-center transition-colors flex-shrink-0">
                    <Globe className="w-4 h-4 text-[#3f3f46] group-hover:text-[#10b981]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-[#fafafa] truncate" title={item.url}>
                      {item.url}
                    </p>
                    <p className="text-[9px] text-[#52525b] mt-1 font-mono uppercase tracking-widest">
                      Added: {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                  <div className="flex items-center gap-2 text-[9px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/20 px-2 py-1 rounded">
                    <Activity className="w-3 h-3 animate-pulse" /> SYNC
                  </div>
                  <button
                    onClick={() => handleRemoveUrl(item.url)}
                    className="p-1.5 text-[#3f3f46] hover:text-[#ef4444] hover:bg-[#ef4444]/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Remove from Watchlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-6 py-4 bg-[#09090b] border-t border-[#27272a] flex items-center justify-between">
        <div className="flex items-center gap-3">
            <Zap className="w-3 h-3 text-[#10b981]" />
            <span className="text-[9px] font-black uppercase tracking-widest text-[#3f3f46]">Targeted Sweeps Enabled</span>
        </div>
        <div className="text-[9px] font-black uppercase tracking-widest text-[#3f3f46]">
            {urls.length} Active Targets
        </div>
      </div>
    </div>
  );
}
