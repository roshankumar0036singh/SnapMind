import React, { useState, useEffect } from 'react';
import { Folder, FolderPlus, Trash2, ShieldCheck, Activity, Zap, Loader2, HardDrive } from 'lucide-react';
import { toast } from 'sonner';

export default function WatchFoldersPanel() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load saved folders from localStorage
    const saved = localStorage.getItem('snapmind_watch_folders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFolders(parsed);
        // Automatically restart watching on mount
        parsed.forEach(f => window.electronAPI?.addWatchFolder(f.path));
      } catch(e) { console.error('Error parsing folders', e); }
    }
    setLoading(false);
  }, []);

  const saveFolders = (newFolders) => {
    localStorage.setItem('snapmind_watch_folders', JSON.stringify(newFolders));
    setFolders(newFolders);
  };

  const handleAddFolder = async () => {
    if (!window.electronAPI) {
      toast.error("This feature is only available in the Desktop App.");
      return;
    }

    const path = await window.electronAPI.selectFolder();
    if (path) {
      // Check if already watching
      if (folders.some(f => f.path === path)) {
        toast.error("Folder already being monitored.");
        return;
      }

      const res = await window.electronAPI.addWatchFolder(path);
      if (res.success) {
        saveFolders([...folders, { 
          path, 
          addedAt: new Date().toISOString(),
          status: 'watching'
        }]);
        toast.success("Folder mounted successfully");
      } else {
        toast.error("Failed to watch folder: " + res.error);
      }
    }
  };

  const handleRemoveFolder = async (pathToRemove) => {
    if (window.electronAPI) {
      await window.electronAPI.removeWatchFolder(pathToRemove);
    }
    saveFolders(folders.filter(f => f.path !== pathToRemove));
    toast.success("Folder unmounted");
  };

  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-[#09090b]">
            <Loader2 className="w-6 h-6 text-[#6366f1] animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest text-[#71717a]">Verifying Mount Points...</p>
        </div>
     );
  }

  return (
    <div className="bg-[#121214] border border-[#27272a] rounded-xl overflow-hidden mb-6">
      <div className="px-6 py-5 border-b border-[#27272a] flex items-center justify-between bg-[#18181b]/50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 border border-[#6366f1]/20 flex items-center justify-center text-[#6366f1]">
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#fafafa]">Mountable Storage</h3>
            <p className="text-[10px] text-[#71717a] font-medium uppercase tracking-widest mt-1">Real-time File System Ingestion</p>
          </div>
        </div>
        <button
          onClick={handleAddFolder}
          className="flex items-center gap-2 px-4 py-2 bg-[#fafafa] hover:bg-[#6366f1] text-[#09090b] text-[10px] font-black uppercase tracking-widest rounded-lg transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-95"
        >
          <FolderPlus className="w-3.5 h-3.5" /> Mount Directory
        </button>
      </div>

      <div className="p-6">
        {folders.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#27272a] rounded-xl bg-[#09090b]/50">
            <div className="w-12 h-12 rounded-full bg-[#18181b] flex items-center justify-center mx-auto mb-4 opacity-50">
              <HardDrive className="w-6 h-6 text-[#71717a]" />
            </div>
            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#fafafa]">Zero Mount Points</h4>
            <p className="text-[10px] text-[#3f3f46] max-w-xs mx-auto mt-2 font-medium uppercase tracking-widest">
              Mount local directories to automate ingestion of PDF, MarkDown, and System logs into your local secure index.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4">
            {folders.map((folder, idx) => (
              <li key={idx} className="flex items-center justify-between p-4 rounded-xl border border-[#27272a] bg-[#18181b] hover:border-[#6366f1]/30 transition-all group">
                <div className="flex items-start gap-4 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-[#27272a] group-hover:bg-[#6366f1]/10 flex items-center justify-center transition-colors">
                    <ShieldCheck className="w-4 h-4 text-[#3f3f46] group-hover:text-[#6366f1]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-[#fafafa] truncate uppercase tracking-tighter" title={folder.path}>
                      {folder.path.split(/[\\/]/).pop() || folder.path}
                    </p>
                    <p className="text-[9px] text-[#52525b] truncate mt-1 font-mono uppercase tracking-widest">
                      {folder.path}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                  <div className="flex items-center gap-2 text-[9px] font-black text-[#6366f1] bg-[#6366f1]/10 border border-[#6366f1]/20 px-2 py-1 rounded">
                    <Activity className="w-3 h-3 animate-pulse" /> LIVE
                  </div>
                  <button
                    onClick={() => handleRemoveFolder(folder.path)}
                    className="p-1.5 text-[#3f3f46] hover:text-[#ef4444] hover:bg-[#ef4444]/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Unmount Folder"
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
            <Zap className="w-3 h-3 text-[#6366f1]" />
            <span className="text-[9px] font-black uppercase tracking-widest text-[#3f3f46]">Infrastructure Ingestion Protocol: Optimized</span>
        </div>
        <div className="text-[9px] font-black uppercase tracking-widest text-[#3f3f46]">
            {folders.length} active mounts
        </div>
      </div>
    </div>
  );
}
