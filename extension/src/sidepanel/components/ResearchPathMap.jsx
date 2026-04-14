import React, { useState, useEffect } from 'react';
import { Network, Loader2, ArrowRight, ExternalLink, MessageSquare, Database, Bookmark } from 'lucide-react';
import { apiClient } from '../../background/api';

export default function ResearchPathMap({ sessionId, onCancel }) {
  const [path, setPath] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchPath = async () => {
      try {
        const data = await apiClient.get(`/api/evolution/research-path/${encodeURIComponent(sessionId)}`);
        if (active) {
          setPath(data);
          setLoading(false);
        }
      } catch (e) {
        if (active) {
          setError(e.message || "Failed to load research path");
          setLoading(false);
        }
      }
    };
    if (sessionId) fetchPath();
    else { setLoading(false); setError("No session ID provided."); }
    return () => { active = false; };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-slate-500 text-sm">Mapping your research journey...</p>
      </div>
    );
  }

  if (error || path.length === 0) {
    return (
      <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center text-center">
        <Network className="w-8 h-8 text-slate-400 mb-3" />
        <h3 className="font-semibold text-slate-800 mb-1">No Path Available</h3>
        <p className="text-sm text-slate-500 mb-4">{error || "Start interacting to build your research path."}</p>
        <button onClick={onCancel} className="px-4 py-2 bg-white border rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Go Back</button>
      </div>
    );
  }

  const getActionIcon = (type) => {
    switch(type) {
      case 'query': return <MessageSquare className="w-4 h-4 text-emerald-500" />;
      case 'ingest': return <Database className="w-4 h-4 text-purple-500" />;
      case 'bookmark': return <Bookmark className="w-4 h-4 text-amber-500" />;
      case 'read': return <ExternalLink className="w-4 h-4 text-blue-500" />;
      default: return <div className="w-2 h-2 rounded-full bg-slate-400" />;
    }
  };

  const getActionColor = (type) => {
    switch(type) {
      case 'query': return 'border-emerald-200 bg-emerald-50';
      case 'ingest': return 'border-purple-200 bg-purple-50';
      case 'bookmark': return 'border-amber-200 bg-amber-50';
      case 'read': return 'border-blue-200 bg-blue-50';
      default: return 'border-slate-200 bg-slate-50';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Network className="w-4 h-4 text-indigo-500" /> Research Journey
          </h2>
        </div>
        <div className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded-md font-mono">{sessionId.substring(0,8)}</div>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
        <div className="relative max-w-xl mx-auto">
          {/* Connecting Line */}
          <div className="absolute left-[20px] top-4 bottom-4 w-[2px] bg-indigo-100 rounded-full" />
          
          <div className="space-y-6">
            {path.map((node, i) => (
              <div key={node.id} className="relative pl-12 group">
                {/* Node Dot */}
                <div className={`absolute left-0 top-1.5 w-10 h-10 rounded-full border-4 border-white flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 ${getActionColor(node.type)}`}>
                  {getActionIcon(node.type)}
                </div>

                {/* Node Card */}
                <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 transition-all hover:border-indigo-300 hover:shadow-md">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {node.type}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(node.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>

                  <div className="text-sm font-medium text-slate-800 mb-1">
                    {node.data.title || node.data.query || node.data.url || "Action"}
                  </div>
                  
                  {node.data.snippet && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded max-h-16 overflow-hidden line-clamp-3">
                      "{node.data.snippet}"
                    </div>
                  )}

                  {node.data.url && (
                    <a href={node.data.url} target="_blank" rel="noreferrer" 
                       className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-600 mt-2 hover:underline">
                      <ExternalLink className="w-3 h-3" />
                      View Source
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* End Cap */}
          <div className="mt-6 flex justify-center pl-4">
             <div className="px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-400 border border-slate-200">
                End of path
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
