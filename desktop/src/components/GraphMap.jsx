import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ForceGraph3D } from 'react-force-graph-3d';
import { Loader2, ZoomIn, ZoomOut, Maximize2, Database, ShieldCheck, Zap, Activity, MousePointer2 } from 'lucide-react';
import * as THREE from 'three';

const GraphMap = ({ data = { nodes: [], edges: [] }, isLoading }) => {
    const fgRef = useRef();
    const [hoverNode, setHoverNode] = useState(null);

    // Filter and sanitize data for ForceGraph3D
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

    const handleNodeClick = useCallback(node => {
        // Aim at node from outside it
        const distance = 40;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

        if (fgRef.current) {
            fgRef.current.cameraPosition(
                { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new pos
                node, // lookAt property
                3000  // transitions duration (ms)
            );
        }
    }, [fgRef]);

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#09090b]">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-2 border-[#6366f1]/20 border-t-[#6366f1] animate-spin" />
                    <Database className="w-6 h-6 text-[#6366f1] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[10px] font-black text-[#71717a] uppercase tracking-[0.3em] mt-6">Initializing Neural Atlas</p>
            </div>
        );
    }

    return (
        <div className="flex-1 relative bg-[#07070a] overflow-hidden group">
            {/* 3D GRAPH ENGINE */}
            <ForceGraph3D
                ref={fgRef}
                graphData={graphData}
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
                nodeThreeObject={node => {
                   const geometry = new THREE.SphereGeometry(Math.sqrt(node.val) * 2 + 2);
                   const material = new THREE.MeshPhongMaterial({
                     color: node.type === 'site' ? '#6366f1' : '#10b981',
                     transparent: true,
                     opacity: 0.85,
                     emissive: node.type === 'site' ? '#4338ca' : '#047857',
                     emissiveIntensity: 0.4,
                     shininess: 100
                   });
                   return new THREE.Mesh(geometry, material);
                }}
                onNodeClick={handleNodeClick}
                onNodeHover={setHoverNode}

                // Link Styling
                linkLabel={link => `<div style="padding: 4px 10px; background: rgba(0,0,0,0.8); border: 1px solid #1e1e26; border-radius: 6px; color: #71717a; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em;">${link.label}</div>`}
                linkDirectionalArrowLength={4}
                linkDirectionalArrowRelPos={1}
                linkCurvature={0.2}
                linkColor={() => '#1e1e26'}
                linkWidth={0.6}
                
                // Camera / Controls
                enableNodeDrag={false}
                controlType="orbit"
            />

            {/* FLOATING HUD */}
            <div className="absolute inset-x-0 top-0 p-8 flex justify-between pointer-events-none z-50">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#6366f1] shadow-[0_0_10px_#6366f1]" />
                        <span className="text-[10px] font-black text-[#fafafa] uppercase tracking-[0.2em]">SnapMind Neural Atlas <span className="text-[#3f3f46]">v3.0</span></span>
                    </div>
                    <p className="text-[9px] text-[#71717a] font-bold uppercase tracking-widest pl-4">Simulating {graphData.nodes.length} Neural Intersections</p>
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
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[8px] font-black text-[#3f3f46] uppercase tracking-[0.3em]">HMI Control Layer</span>
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-[#1a1a1d] rounded-xl border border-[#27272a] shadow-inner"><MousePointer2 className="w-3.5 h-3.5 text-[#6366f1]" /></div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-[#fafafa] font-bold">Left Click</span>
                                        <span className="text-[9px] text-[#71717a] font-bold uppercase tracking-tighter">Target & Fly</span>
                                    </div>
                                </div>
                                <div className="w-px h-5 bg-[#1e1e26]" />
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-[#1a1a1d] rounded-xl border border-[#27272a] shadow-inner"><Maximize2 className="w-3.5 h-3.5 text-[#71717a]" /></div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-[#fafafa] font-bold">Orbital Drag</span>
                                        <span className="text-[9px] text-[#71717a] font-bold uppercase tracking-tighter">360° Inspection</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 pointer-events-auto">
                    <button 
                      onClick={() => fgRef.current.zoomToFit(1200, 100)}
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
