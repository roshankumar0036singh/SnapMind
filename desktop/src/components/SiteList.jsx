import React, { useState, useEffect } from 'react';
import { Database, Trash2, Globe, ExternalLink, Loader2 } from 'lucide-react';
import { FixedSizeList as List } from 'react-window';
import { apiClient, chrome } from '../background/api';
import { toast } from 'sonner';

const getFlagEmoji = (langCode) => {
  if (!langCode || langCode === 'unknown') return null;
  const map = {
    'en': '🇺🇸', 'es': '🇪🇸', 'fr': '🇫🇷', 'de': '🇩🇪', 'it': '🇮🇹',
    'pt': '🇵🇹', 'pt-br': '🇧🇷', 'nl': '🇳🇱', 'ru': '🇷🇺', 'zh': '🇨🇳', 'ja': '🇯🇵',
    'ko': '🇰🇷', 'ar': '🇸🇦', 'hi': '🇮🇳'
  };
  return map[langCode.toLowerCase()] || null;
};

export default function SiteList({ onContextSelect, onSessionSwitch, setView }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getSites();
      setSites(data);
    } catch (e) {
      console.error("Failed to load sites", e);
    }
    setLoading(false);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await apiClient.deleteSite(id);
      setSites(prev => prev.filter(s => s.id !== id));
      toast.success("Site memory deleted");
    } catch (e) {
      toast.error("Failed to delete site");
    }
  };

  const Row = ({ index, style }) => {
    const site = sites[index];
    if (!site) return null;

    return (
      <div style={style} className="px-2 pb-3">
        <div
          onClick={async () => {
            if (window.chrome && chrome.tabs) {
                chrome.tabs.create({ url: site.url });
            }
            
            const newSessionId = `session-${Date.now()}`;
            const newSession = {
              id: newSessionId,
              title: site.title || site.url,
              messages: [{ id: '1', role: 'assistant', text: `Ready to answer questions about ${site.title || site.url}` }],
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
            
            if (chrome.storage && chrome.storage.local) {
                const result = await chrome.storage.local.get(['chatSessions']);
                const updatedSessions = [...(result.chatSessions || []), newSession];
                await chrome.storage.local.set({ chatSessions: updatedSessions, currentSessionId: newSessionId });
                if (onSessionSwitch) onSessionSwitch(newSessionId);
            }
            
            if (setView) setView('chat');
            toast.success(`Opened ${site.title || site.url}`);
          }}
          className="group relative bg-[#111113] border border-[#1a1a1d] rounded-xl p-4 hover:border-[#6366f1]/40 hover:bg-[#1a1a1d] transition-all cursor-pointer h-full overflow-hidden"
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-bold text-[#fafafa] truncate mb-1 pr-8">
                {site.title || new URL(site.url).hostname}
              </h3>
              <div className="flex items-center gap-2 text-[10px] text-[#71717a] truncate font-medium">
                <Globe className="w-3 h-3 shrink-0" />
                <span className="truncate">{new URL(site.url).hostname}</span>
                {site.original_lang && site.original_lang !== 'unknown' && site.original_lang !== 'en' && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-[#6366f1]/10 text-[#6366f1] text-[9px] font-black rounded border border-[#6366f1]/20 uppercase">
                    {getFlagEmoji(site.original_lang)} {site.original_lang.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            
            <button
              onClick={(e) => handleDelete(site.id, e)}
              className="p-1.5 text-[#3f3f46] hover:text-[#ef4444] hover:bg-[#ef4444]/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0"
              title="Purge Memory"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-6 h-6 text-[#6366f1] animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-[#71717a]">Accessing Neural Nodes...</p>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="text-center p-12 border border-dashed border-[#1a1a1d] rounded-2xl bg-[#09090b]/50">
        <Database className="w-10 h-10 mx-auto mb-4 text-[#3f3f46]" />
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#fafafa]">Zero Knowledge Chunks</h3>
        <p className="text-[10px] text-[#3f3f46] mt-2 font-medium uppercase tracking-widest">Index web pages or documents to build your semantic coordinate system.</p>
      </div>
    );
  }

  return (
    <div className="h-[500px] w-full custom-scrollbar">
      <List
        height={500}
        itemCount={sites.length}
        itemSize={90}
        width={'100%'}
        className="scrollbar-hide"
      >
        {Row}
      </List>
    </div>
  );
}
