import React, { useState, useEffect } from 'react';
import { Folder, FolderPlus, Trash2, ShieldCheck, Activity } from 'lucide-react';

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
      alert("This feature is only available in the Desktop App.");
      return;
    }

    const path = await window.electronAPI.selectFolder();
    if (path) {
      // Check if already watching
      if (folders.some(f => f.path === path)) return;

      const res = await window.electronAPI.addWatchFolder(path);
      if (res.success) {
        saveFolders([...folders, { 
          path, 
          addedAt: new Date().toISOString(),
          status: 'watching'
        }]);
      } else {
        alert("Failed to watch folder: " + res.error);
      }
    }
  };

  const handleRemoveFolder = async (pathToRemove) => {
    if (window.electronAPI) {
      await window.electronAPI.removeWatchFolder(pathToRemove);
    }
    saveFolders(folders.filter(f => f.path !== pathToRemove));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Mountable Watch Folders</h3>
            <p className="text-xs text-gray-500">Auto-ingest new PDFs, Markdown, and TXT files instantly.</p>
          </div>
        </div>
        <button
          onClick={handleAddFolder}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <FolderPlus className="w-4 h-4" /> Mount Folder
        </button>
      </div>

      <div className="p-5">
        {!loading && folders.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Folder className="w-6 h-6 text-gray-400" />
            </div>
            <h4 className="text-sm font-medium text-gray-900 mb-1">No Mounted Folders</h4>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Mount a local folder to seamlessly sync documents into your secure, Local Postgres vector database.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {folders.map((folder, idx) => (
              <li key={idx} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group">
                <div className="flex items-start gap-3 overflow-hidden">
                  <div className="mt-0.5">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate" title={folder.path}>
                      {folder.path.split(/[\\/]/).pop() || folder.path}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5 font-mono">
                      {folder.path}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                    <Activity className="w-3.5 h-3.5" /> Watching
                  </div>
                  <button
                    onClick={() => handleRemoveFolder(folder.path)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
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
    </div>
  );
}
