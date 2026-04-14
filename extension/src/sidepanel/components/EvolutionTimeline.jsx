import React, { useState, useEffect } from 'react';
import { History, FileText, ArrowRight, Loader2, GitCommit } from 'lucide-react';
import { apiClient } from '../../background/api';
import ReactMarkdown from 'react-markdown';

export default function EvolutionTimeline({ sourceUrl, onCancel }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchTimeline = async () => {
      try {
        const data = await apiClient.get(`/api/evolution/timeline/${encodeURIComponent(sourceUrl)}`);
        if (active) {
          setTimeline(data);
          setLoading(false);
          if (data && data.length > 0) {
            fetchSnapshot(data[0].id);
          }
        }
      } catch (e) {
        if (active) {
          setError(e.message || "Failed to load timeline");
          setLoading(false);
        }
      }
    };
    fetchTimeline();
    return () => { active = false; };
  }, [sourceUrl]);

  const fetchSnapshot = async (versionId) => {
    setSnapshotLoading(true);
    try {
      const data = await apiClient.get(`/api/evolution/diff/${versionId}`);
      setSelectedVersion(data);
    } catch (e) {
      console.error(e);
    } finally {
      setSnapshotLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-slate-500 text-sm">Loading knowledge evolution...</p>
      </div>
    );
  }

  if (error || timeline.length === 0) {
    return (
      <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center text-center">
        <History className="w-8 h-8 text-slate-400 mb-3" />
        <h3 className="font-semibold text-slate-800 mb-1">No Timeline Available</h3>
        <p className="text-sm text-slate-500 mb-4">{error || "This document has not changed since it was first indexed."}</p>
        <button onClick={onCancel} className="px-4 py-2 bg-white border rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Go Back</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b flex items-center gap-3 bg-slate-50">
        <button onClick={onCancel} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
          <ArrowRight className="w-4 h-4 rotate-180" />
        </button>
        <div>
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <History className="w-4 h-4 text-blue-500" /> Knowledge Evolution
          </h2>
          <div className="text-xs text-slate-500 truncate max-w-[250px]" title={sourceUrl}>{sourceUrl}</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 flex gap-6">
        {/* Timeline Sidebar */}
        <div className="w-1/3 min-w-[200px] border-r pr-4 space-y-4 relative">
          <div className="absolute left-[11px] top-2 bottom-4 w-0.5 bg-slate-100" />
          {timeline.map((ver) => (
            <div 
              key={ver.id} 
              onClick={() => fetchSnapshot(ver.id)}
              className={`relative pl-8 cursor-pointer group ${selectedVersion?.id === ver.id ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
            >
              <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 bg-white transition-colors
                ${selectedVersion?.id === ver.id ? 'border-blue-500 text-blue-500' : 'border-slate-300 text-slate-400 group-hover:border-slate-400'}`}
              >
                <GitCommit className="w-3 h-3" />
              </div>
              <div>
                <div className={`font-medium text-sm ${selectedVersion?.id === ver.id ? 'text-blue-600' : 'text-slate-800'}`}>Version {ver.version}</div>
                <div className="text-xs text-slate-500 mt-0.5">{new Date(ver.timestamp).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Snapshot Content */}
        <div className="flex-1 min-w-0">
          {snapshotLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : selectedVersion ? (
            <div className="space-y-6">
              <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl p-4">
                <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> What Changed
                </h4>
                <div className="text-sm text-slate-700 prose prose-sm max-w-none">
                  <ReactMarkdown>{selectedVersion.diff_summary}</ReactMarkdown>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-3 border-b pb-2">Full Snapshot Context</h4>
                <div className="bg-slate-50 border rounded-lg p-4 text-xs text-slate-600 h-[300px] overflow-auto whitespace-pre-wrap font-mono">
                  {selectedVersion.content.length > 5000 
                    ? selectedVersion.content.substring(0, 5000) + "\n...[Content Truncated]" 
                    : selectedVersion.content}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
