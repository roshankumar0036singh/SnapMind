import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ForceGraph2DImport from 'react-force-graph-2d';
const ForceGraph2D = ForceGraph2DImport.default || ForceGraph2DImport;
import { Loader2, ZoomIn, ZoomOut, Maximize2, Database, ShieldCheck, Zap, Activity, MousePointer2, Globe, FileText, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const GraphMap = ({ data = { nodes: [], edges: [] }, isLoading }) => {
    const fgRef = useRef();
    const [hoverNode, setHoverNode] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedNode, setSelectedNode] = useState(null);

    // Filter and sanitize data for ForceGraph2D
    const graphData = useMemo(() => {
        const nodes = (data.nodes || []).map(n => {
            const nodeData = n.data || n;
            return {
                id: nodeData.id ? nodeData.id.toString() : 'unknown',
                name: nodeData.label || nodeData.name || 'Concept Node',
                type: nodeData.type || 'generic',
                val: nodeData.degree ? Math.max(nodeData.degree, 1) : 1
            };
        });

        const links = (data.edges || data.links || []).map(e => {
            const edgeData = e.data || e;
            return {
                source: edgeData.source ? edgeData.source.toString() : '',
                target: edgeData.target ? edgeData.target.toString() : '',
                label: (edgeData.label || edgeData.relation || 'related').toLowerCase()
            };
        }).filter(l => l.source && l.target);

        return { nodes, links };
    }, [data]);

    // Enhanced filtered data for search
    const filteredData = useMemo(() => {
        if (!searchTerm) return graphData;
        const term = searchTerm.toLowerCase();
        return {
            nodes: graphData.nodes.map(n => ({
                ...n,
                isMatch: n.name.toLowerCase().includes(term) || n.type.toLowerCase().includes(term)
            })),
            links: graphData.links
        };
    }, [graphData, searchTerm]);

    const handleNodeClick = useCallback(node => {
        if (fgRef.current) {
            fgRef.current.centerAt(node.x, node.y, 1000);
            fgRef.current.zoom(2, 1000);
        }
    }, [fgRef]);

    if (isLoading) {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#09090b] z-50">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-2 border-[#6366f1]/20 border-t-[#6366f1] animate-spin" />
                    <Database className="w-6 h-6 text-[#6366f1] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[10px] font-black text-[#71717a] uppercase tracking-[0.3em] mt-6">Initializing Neural Atlas</p>
            </div>
        );
    }

    return (
        <div className="flex-1 relative bg-[#07070a] overflow-hidden group min-h-[500px]">
            {/* 2D GRAPH ENGINE */}
            <ForceGraph2D
                ref={fgRef}
                graphData={filteredData}
                backgroundColor="#07070a"
                showNavInfo={false}
                
                // Node Styling
                nodeLabel={node => `
                  <div style="background: rgba(15,15,20,0.95); border: 1px solid #27272a; padding: 12px; border-radius: 12px; backdrop-filter: blur(8px); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    <div style="color: #6366f1; font-weight: 900; font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">${node.type} node</div>
                    <div style="color: #fafafa; font-weight: bold; font-size: 13px;">${node.name}</div>
                  </div>
                `}
                nodeRelSize={6}
                onNodeClick={(node) => {
                  handleNodeClick(node);
                  setSelectedNode(node);
                }}
                onNodeHover={setHoverNode}
                nodeColor={node => {
                    if (searchTerm) {
                        return node.isMatch ? '#6366f1' : '#1e1e26';
                    }
                    return node.type === 'site' ? '#6366f1' : '#10b981';
                }}

                // Link Styling
                linkLabel={link => `<div style="padding: 4px 10px; background: rgba(0,0,0,0.8); border: 1px solid #1e1e26; border-radius: 6px; color: #71717a; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em;">${link.label}</div>`}
                linkDirectionalArrowLength={4}
                linkDirectionalArrowRelPos={1}
                linkCurvature={0.2}
                linkColor={() => '#1e1e26'}
                linkWidth={1}
                
                // Extra Polish
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const label = node.name;
                  const fontSize = 12 / globalScale;
                  ctx.font = `${fontSize}px Inter, system-ui`;
                  
                  // Highlight logic
                  const isMatch = searchTerm ? node.isMatch : true;
                  const radius = isMatch ? 5 : 3;
                  const isSelected = selectedNode?.id === node.id;
                  
                  // Draw Node circle
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, radius + (isSelected ? 2 : 0), 0, 2 * Math.PI, false);
                  
                  if (searchTerm) {
                    ctx.fillStyle = node.isMatch ? '#6366f1' : '#1e1e26';
                    ctx.globalAlpha = node.isMatch ? 1 : 0.2;
                  } else {
                    ctx.fillStyle = node.type === 'site' ? '#6366f1' : '#10b981';
                    ctx.globalAlpha = 1;
                  }
                  
                  ctx.fill();
                  
                  if (isMatch || isSelected) {
                    ctx.strokeStyle = isSelected ? '#6366f1' : '#fafafa20';
                    ctx.lineWidth = isSelected ? 2 / globalScale : 1 / globalScale;
                    ctx.stroke();
                  }

                  // Draw Label only if zoomed in or matching search
                  if (globalScale > 1.5 || (searchTerm && node.isMatch)) {
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = isMatch ? '#fafafa' : '#3f3f46';
                    ctx.fillText(label, node.x, node.y + 10);
                  }
                  
                  ctx.globalAlpha = 1;
                }}
            />

            {/* FLOATING HUD */}
            <div className="absolute inset-x-0 top-0 p-8 flex justify-between pointer-events-none z-50">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#6366f1] shadow-[0_0_10px_#6366f1]" />
                        <span className="text-[10px] font-black text-[#fafafa] uppercase tracking-[0.2em]">SnapMind Neural Atlas <span className="text-[#3f3f46]">v3.0</span></span>
                    </div>
                    <p className="text-[9px] text-[#71717a] font-bold uppercase tracking-widest pl-4">Simulating {graphData?.nodes?.length || 0} Neural Intersections</p>
                </div>
                
                <div className="flex flex-col items-end gap-1">
                    <div className="p-1 px-3 bg-[#10b981]/10 border border-[#10b981]/20 rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                        <span className="text-[8px] font-black text-[#10b981] uppercase tracking-tighter">Engine Optimized</span>
                    </div>
                </div>
            </div>

            {/* BOTTOM CONTROLS */}
            <div className="absolute inset-x-0 bottom-0 p-8 flex justify-between items-end z-50 pointer-events-none">
                <div className="flex items-center gap-3 pointer-events-auto">
                    <div className="p-5 bg-[#0f0f14]/80 backdrop-blur-xl border border-[#1e1e26] rounded-[24px] flex items-center gap-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                        <div className="flex flex-col gap-3">
                            <span className="text-[8px] font-black text-[#3f3f46] uppercase tracking-[0.3em]">HMI Neural Search</span>
                            <div className="flex items-center gap-4 bg-[#1a1a1d] border border-[#27272a] rounded-xl px-4 py-2 shadow-inner focus-within:border-[#6366f1]/50 transition-all">
                                <Database className="w-3.5 h-3.5 text-[#3f3f46]" />
                                <input 
                                  className="bg-transparent border-none outline-none text-[#fafafa] text-[10px] font-bold placeholder:text-[#3f3f46] w-48"
                                  placeholder="IDENTIFY NODE..."
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 pointer-events-auto">
                    <button 
                      onClick={() => fgRef.current?.zoomToFit(1200, 100)}
                      className="p-5 px-8 bg-[#6366f1]/10 hover:bg-[#6366f1]/20 border border-[#6366f1]/30 text-[#6366f1] rounded-[24px] transition-all hover:scale-105 active:scale-95 font-black text-[10px] uppercase tracking-[0.25em] shadow-[0_10px_30px_rgba(99,102,241,0.1)] active:shadow-none"
                    >
                      Recenter Atlas
                    </button>
                    
                    <button 
                      className="p-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-[24px] transition-all"
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            {/* SELECTION DETAIL OVERLAY */}
            <AnimatePresence>
                {selectedNode && (
                    <motion.div 
                        initial={{ x: 300, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 300, opacity: 0 }}
                        className="absolute right-8 top-32 bottom-32 w-[280px] bg-[#09090b]/95 backdrop-blur-2xl border border-[#1e1e26] rounded-[32px] p-6 shadow-[-20px_0_60px_rgba(0,0,0,0.5)] z-[60] flex flex-col"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <span className="text-[10px] font-black text-[#6366f1] uppercase tracking-[0.3em]">Node Protocol</span>
                            <button onClick={() => setSelectedNode(null)} className="p-2 hover:bg-[#1a1a1d] rounded-xl text-[#71717a]">
                                <ZoomOut className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <div className={`w-12 h-12 rounded-2xl ${selectedNode.type === 'site' ? 'bg-[#6366f1]/10 text-[#6366f1]' : 'bg-[#10b981]/10 text-[#10b981]'} flex items-center justify-center mb-4 border border-current/20 shadow-inner`}>
                                {selectedNode.type === 'site' ? <Globe className="w-6 h-6" /> : <Database className="w-6 h-6" />}
                            </div>
                            
                            <h3 className="text-lg font-black text-[#fafafa] tracking-tight leading-tight mb-2">{selectedNode.name}</h3>
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#71717a] border border-[#1e1e26] px-2 py-1 rounded-full">{selectedNode.type} intersection</span>
                            
                            <div className="mt-8 space-y-6">
                                <div>
                                    <span className="text-[10px] font-black text-[#3f3f46] uppercase tracking-widest block mb-2">Neural Connectivity</span>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-[#1a1a1d] rounded-full overflow-hidden">
                                            <div className="h-full bg-[#6366f1] rounded-full" style={{ width: `${Math.min(selectedNode.val * 20, 100)}%` }} />
                                        </div>
                                        <span className="text-[10px] font-black text-[#fafafa] italic">{selectedNode.val}</span>
                                    </div>
                                </div>
                                
                                <div className="p-4 bg-[#111116] border border-[#1e1e26] rounded-2xl">
                                    <p className="text-[11px] text-[#71717a] leading-relaxed">
                                        This {selectedNode.type} node represents a high-entropy concept extracted during neural analysis sessions.
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        <button 
                            className="mt-6 w-full py-4 bg-[#6366f1] text-black text-[10px] font-black uppercase tracking-widest rounded-[20px] transition-all hover:scale-[1.02] active:scale-95 shadow-[0_10px_30px_rgba(99,102,241,0.2)]"
                        >
                            Pivot Context
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AMBIENT EFFECTS */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.02),transparent_70%)]" />
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#6366f1]/20 to-transparent" />
                <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#6366f1]/10 to-transparent" />
            </div>
        </div>
    );
};

export default GraphMap;
