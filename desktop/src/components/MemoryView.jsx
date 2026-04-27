import React from 'react';
import { FileText, Database, Bookmark, Folder, RefreshCw, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../background/api';
import SiteList from './SiteList';
import BookmarkList from './BookmarkList';
import WatchFoldersPanel from './WatchFoldersPanel';
import AnalyticsView from './AnalyticsView';
import GraphMap from './GraphMap';

const MemoryView = ({ 
  memoryTab, 
  onSetMemoryTab, 
  graphData, 
  isLoading, 
  bookmarks, 
  bookmarksLoading, 
  loadBookmarks, 
  onContextSelect, 
  onSessionSwitch, 
  onSetView,
  graphSessions,
  selectedGraphSession,
  onSelectGraphSession,
  onBackToSessions
}) => {
  const tabs = [
    { id: 'sites', label: 'Nodes', icon: FileText },
    { id: 'graph', label: 'Atlas', icon: Database },
    { id: 'bookmarks', label: 'Library', icon: Bookmark },
    { id: 'folders', label: 'Sync', icon: Folder },
    { id: 'updates', label: 'Maintenance', icon: RefreshCw },
    { id: 'stats', label: 'Analytics', icon: Activity },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0f] overflow-hidden">
      <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
        <div className="flex p-1 bg-[#111113] border border-[#1a1a1d] rounded-xl mb-6 shadow-inner">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onSetMemoryTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
                memoryTab === tab.id 
                ? 'bg-[#1a1a1d] text-[#6366f1] border border-[#27272a] shadow-sm' 
                : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mb-8 p-6 bg-[#111113] border border-[#1a1a1d] rounded-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-[#6366f1]/5 rounded-full blur-3xl" />
           <h2 className="text-lg font-bold text-[#fafafa] tracking-tight">
             {memoryTab === 'sites' ? 'Indexed Nodes' : memoryTab === 'graph' ? 'Knowledge Atlas' : memoryTab === 'updates' ? 'Maintenance Protocol' : memoryTab === 'stats' ? 'Neural Analytics' : 'Research Library'}
           </h2>
           <p className="text-xs text-[#71717a] mt-1 max-w-[400px]">
             {memoryTab === 'sites' ? 'Manage your semantic index of web pages and local documents.' : 'Explore the interconnected web of your local knowledge base.'}
           </p>
        </div>

        <div className="flex-1 min-h-0">
          {memoryTab === 'sites' && (
              <SiteList 
                  onContextSelect={onContextSelect} 
                  onSessionSwitch={onSessionSwitch} 
                  setView={onSetView}
              />
          )}
          {memoryTab === 'graph' && (
            <div className="h-[700px] border border-[#1a1a1d] rounded-2xl overflow-hidden bg-[#07070a] relative flex flex-col">
              {/* Atlas Sidebar / Navigation */}
              {selectedGraphSession === null ? (
                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                   <div className="flex items-center gap-3 mb-8">
                      <div className="p-3 bg-[#6366f1]/10 rounded-2xl border border-[#6366f1]/20"><Database className="w-5 h-5 text-[#6366f1]" /></div>
                      <div>
                        <h3 className="text-sm font-black text-[#fafafa] uppercase tracking-widest">Select Neural Domain</h3>
                        <p className="text-[10px] text-[#71717a] font-bold uppercase tracking-wider">Choose a session to visualize its extracted concepts</p>
                      </div>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button 
                        onClick={() => onSelectGraphSession('global')}
                        className="p-6 bg-[#111116] border border-[#1e1e26] rounded-2xl hover:border-[#6366f1]/50 transition-all text-left flex items-start gap-4 group"
                      >
                         <div className="p-3 bg-[#6366f1]/10 rounded-xl group-hover:bg-[#6366f1]/20 transition-all"><Globe className="w-5 h-5 text-[#6366f1]" /></div>
                         <div>
                            <span className="text-xs font-black text-[#fafafa] uppercase tracking-widest">Global Atlas</span>
                            <p className="text-[10px] text-[#71717a] mt-1 font-bold uppercase tracking-tighter">Unified visualization of all indexed knowledge</p>
                         </div>
                      </button>

                      {graphSessions.map(sess => (
                        <button 
                          key={sess.id}
                          onClick={() => onSelectGraphSession(sess.id)}
                          className="p-6 bg-[#111116] border border-[#1e1e26] rounded-2xl hover:border-[#6366f1]/50 transition-all text-left flex items-start gap-4 group"
                        >
                           <div className="p-3 bg-[#1e1e26] rounded-xl group-hover:bg-[#6366f1]/10 transition-all"><FileText className="w-5 h-5 text-[#71717a] group-hover:text-[#6366f1]" /></div>
                           <div className="min-w-0">
                              <span className="text-xs font-black text-[#fafafa] uppercase tracking-widest truncate block">{sess.title || 'Untitled Session'}</span>
                              <p className="text-[10px] text-[#71717a] mt-1 font-bold uppercase tracking-tighter line-clamp-1">{sess.id}</p>
                           </div>
                        </button>
                      ))}
                   </div>

                   {graphSessions.length === 0 && !isLoading && (
                     <div className="mt-12 text-center p-12 border border-dashed border-[#1e1e26] rounded-[32px]">
                        <Activity className="w-10 h-10 text-[#27272a] mx-auto mb-4" />
                        <h4 className="text-[#3f3f46] text-xs font-black uppercase tracking-widest">No GraphRAG Extractions Found</h4>
                        <p className="text-[10px] text-[#3f3f46] mt-2 font-bold uppercase tracking-wider">Chat with the AI to trigger neural concept extraction</p>
                     </div>
                   )}
                </div>
              ) : (
                <>
                  <div className="absolute top-6 left-6 z-[60] flex items-center gap-3">
                    <button 
                      onClick={onBackToSessions}
                      className="px-4 py-2 bg-[#111116]/80 backdrop-blur-md border border-[#1e1e26] text-[#71717a] rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-[#fafafa] hover:border-[#6366f1]/50 transition-all flex items-center gap-2"
                    >
                      <History className="w-3.5 h-3.5" /> Back to Atlas
                    </button>
                    <div className="h-4 w-px bg-[#1e1e26]" />
                    <span className="text-[10px] font-black text-[#6366f1] uppercase tracking-[0.2em]">{selectedGraphSession === 'global' ? 'Global Core' : 'Session Core'}</span>
                  </div>
                  <GraphMap data={graphData} isLoading={isLoading} />
                </>
              )}
            </div>
          )}
          {memoryTab === 'bookmarks' && (
            <BookmarkList 
              bookmarks={bookmarks} 
              loading={bookmarksLoading} 
              onDelete={(id) => {
                apiClient.deleteBookmark(id).then(() => loadBookmarks());
                toast.success("Bookmark removed");
              }} 
            />
          )}
          {memoryTab === 'folders' && <WatchFoldersPanel />}
          {memoryTab === 'stats' && <AnalyticsView />}
          {memoryTab === 'updates' && (
            <div className="p-8 text-center border border-[#1a1a1d] rounded-2xl bg-[#111113]/50">
              <RefreshCw className="w-10 h-10 mx-auto mb-4 text-[#3f3f46]" />
              <h3 className="text-sm font-bold text-[#fafafa] uppercase tracking-widest">Maintenance Protocol</h3>
              <p className="text-[10px] text-[#71717a] mt-2 mb-6">Manually trigger re-indexing or clear orphaned nodes from the vector database.</p>
              <button 
                onClick={() => toast.promise(apiClient.maintainDb(), {
                  loading: 'Optimizing database...',
                  success: 'Database clean and optimized',
                  error: 'Optimization failed'
                })}
                className="px-6 py-2 bg-[#1a1a1d] hover:bg-[#27272a] text-[#f4f4f5] text-[10px] font-black uppercase tracking-widest rounded-lg transition-all border border-[#27272a]"
              >
                Run Optimization
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemoryView;
