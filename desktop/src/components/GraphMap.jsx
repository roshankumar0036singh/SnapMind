import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { Loader2, ZoomIn, ZoomOut, Maximize2, Database, ShieldCheck, Zap, Activity } from 'lucide-react';

const GraphMap = ({ data, isLoading }) => {
    const containerRef = useRef(null);
    const cyRef = useRef(null);
    const [hoveredNode, setHoveredNode] = useState(null);

    useEffect(() => {
        if (!containerRef.current || isLoading) return;

        // Convert data to Cytoscape format
        const elements = [];
        const nodeDegrees = {};

        // 1. Initial degree pass
        if (data.edges) {
            data.edges.forEach(edge => {
                const edgeData = edge.data || edge;
                if (!edgeData || !edgeData.source || !edgeData.target) return;
                const s = edgeData.source.toString();
                const t = edgeData.target.toString();
                nodeDegrees[s] = (nodeDegrees[s] || 0) + 1;
                nodeDegrees[t] = (nodeDegrees[t] || 0) + 1;
            });
        }

        // Nodes
        if (data.nodes) {
            data.nodes.forEach(node => {
                const nodeData = node.data || node;
                if (!nodeData || !nodeData.id) return;
                
                const id = nodeData.id.toString();
                elements.push({
                    data: {
                        id: id,
                        label: nodeData.label || nodeData.name || 'UNKNOWN',
                        type: nodeData.type || 'concept',
                        degree: nodeDegrees[id] || 0
                    }
                });
            });
        }

        // Edges
        if (data.edges) {
            data.edges.forEach((edge, index) => {
                const edgeData = edge.data || edge;
                if (!edgeData || !edgeData.source || !edgeData.target) return;

                elements.push({
                    data: {
                        id: edgeData.id ? edgeData.id.toString() : `e${index}`,
                        source: edgeData.source.toString(),
                        target: edgeData.target.toString(),
                        label: (edgeData.label || edgeData.relation || '').toUpperCase()
                    }
                });
            });
        }

        // Initialize Cytoscape
        try {
            cyRef.current = cytoscape({
                container: containerRef.current,
                elements: elements,
                style: [
                    {
                        selector: 'node',
                        style: {
                            'label': 'data(label)',
                            'background-color': '#121214',
                            'color': '#fafafa',
                            'font-size': '11px',
                            'font-family': 'Geist Mono, monospace',
                            'font-weight': '900',
                            'text-valign': 'center',
                            'text-halign': 'center',
                            'border-width': 1,
                            'border-color': '#27272a',
                            'text-wrap': 'wrap',
                            'text-max-width': '80px',
                            'overlay-padding': '6px',
                            'overlay-color': '#22c55e',
                            'overlay-opacity': 0.05,
                            'z-index': 10,
                            'transition-property': 'background-color, border-color, width, height, border-width',
                            'transition-duration': '0.3s'
                        }
                    },
                    {
                        selector: 'node[degree]',
                        style: {
                            'width': 'mapData(degree, 0, 10, 50, 90)',
                            'height': 'mapData(degree, 0, 10, 50, 90)',
                        }
                    },
                    {
                        selector: 'node[type="person"]',
                        style: { 
                            'border-color': '#f59e0b',
                            'border-width': 2,
                            'text-background-opacity': 0.1,
                            'text-background-color': '#f59e0b',
                        }
                    },
                    {
                        selector: 'node[type="organization"]',
                        style: { 
                            'border-color': '#3b82f6',
                            'border-width': 2,
                            'text-background-opacity': 0.1,
                            'text-background-color': '#3b82f6',
                        }
                    },
                    {
                        selector: 'node:selected',
                        style: {
                            'border-color': '#22c55e',
                            'border-width': 3,
                            'background-color': '#18181b',
                            'shadow-blur': 15,
                            'shadow-color': '#22c55e',
                            'shadow-opacity': 0.3
                        }
                    },
                    {
                        selector: 'node:hover',
                        style: {
                            'background-color': '#18181b',
                            'border-width': 4,
                            'border-color': '#22c55e',
                            'z-index': 100
                        }
                    },
                    {
                        selector: 'edge',
                        style: {
                            'width': 1,
                            'line-color': '#27272a',
                            'target-arrow-color': '#27272a',
                            'target-arrow-shape': 'triangle',
                            'curve-style': 'bezier',
                            'label': 'data(label)',
                            'font-size': '8px',
                            'font-family': 'Geist Mono, monospace',
                            'font-weight': '900',
                            'color': '#3f3f46',
                            'text-background-opacity': 1,
                            'text-background-color': '#09090b',
                            'text-background-padding': '4px',
                            'text-background-shape': 'roundrectangle',
                            'edge-text-rotation': 'autorotate',
                            'opacity': 0.6,
                            'transition-property': 'line-color, width, opacity',
                            'transition-duration': '0.3s'
                        }
                    },
                    {
                        selector: 'edge:hover',
                        style: {
                            'width': 2,
                            'line-color': '#22c55e',
                            'target-arrow-color': '#22c55e',
                            'opacity': 1,
                            'color': '#22c55e'
                        }
                    }
                ],
                layout: {
                    name: 'cose',
                    padding: 60,
                    animate: elements.length < 50,
                    animationDuration: 1000,
                    fit: true,
                    nodeRepulsion: 800000,
                    gravity: 100,
                }
            });

            cyRef.current.on('mouseover', 'node', (e) => {
                const node = e.target;
                setHoveredNode(node.data('label'));
            });

            cyRef.current.on('mouseout', 'node', () => {
                setHoveredNode(null);
            });
        } catch (err) {
            console.error("Failed to initialize Cytoscape:", err);
        }

        return () => {
            if (cyRef.current) {
                try {
                    cyRef.current.destroy();
                    cyRef.current = null;
                } catch (e) {
                    console.warn("Cleanup error:", e);
                }
            }
        };
    }, [data, isLoading]);

    const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
    const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
    const handleFit = () => cyRef.current?.fit();

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[500px] bg-[#09090b] rounded-2xl border border-[#27272a] shadow-inner">
                <div className="relative">
                    <div className="absolute inset-0 bg-[#22c55e]/10 blur-2xl rounded-full animate-pulse"></div>
                    <Loader2 className="w-12 h-12 text-[#22c55e] animate-spin relative z-10" />
                </div>
                <span className="mt-6 text-[11px] font-black uppercase tracking-[0.2em] text-[#fafafa]">Mapping Semantic Nodes...</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-[#3f3f46] mt-2">Initializing Neural Graph Structure</span>
            </div>
        );
    }

    if (!data.nodes || data.nodes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[500px] bg-[#09090b] rounded-2xl border border-dashed border-[#27272a] text-center p-8">
                <div className="w-16 h-16 bg-[#18181b] border border-[#27272a] text-[#3f3f46] rounded-2xl flex items-center justify-center mb-6">
                    <Database className="w-6 h-6" />
                </div>
                <h3 className="text-[#fafafa] font-black text-sm uppercase tracking-[0.2em]">Neural Map Empty</h3>
                <p className="text-[10px] text-[#71717a] max-w-[280px] mt-3 font-medium uppercase tracking-widest leading-relaxed">
                    Entities and relations will materialize as your local library expands. Start a conversation to initialize graph extraction.
                </p>
            </div>
        );
    }

    return (
        <div className="relative group overflow-hidden rounded-2xl border border-[#27272a] bg-[#09090b] shadow-2xl">
            {/* Header / Info Bar */}
            <div className="absolute top-6 left-6 z-20 flex flex-col items-start gap-3">
                <div className="px-4 py-2 bg-[#121214]/80 backdrop-blur-md border border-[#27272a] rounded-lg shadow-xl">
                    <span className="text-[10px] font-black text-[#fafafa] uppercase tracking-[0.2em] flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></div>
                        {data.nodes.length} Nodes • {data.edges.length} Tensors
                    </span>
                </div>
                {hoveredNode && (
                    <div className="px-4 py-2 bg-[#22c55e] text-[#09090b] rounded-lg shadow-[0_0_30px_rgba(34,197,94,0.4)] animate-in fade-in slide-in-from-left-2 duration-300">
                        <span className="text-[11px] font-black uppercase tracking-tighter">{hoveredNode}</span>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-3">
                {[
                    { icon: ZoomIn, action: handleZoomIn, label: 'Zoom In' },
                    { icon: ZoomOut, action: handleZoomOut, label: 'Zoom Out' },
                    { icon: Maximize2, action: handleFit, label: 'Recenter' }
                ].map((btn, i) => (
                    <button 
                        key={i}
                        onClick={btn.action} 
                        className="p-2.5 bg-[#121214] border border-[#27272a] rounded-lg shadow-xl hover:border-[#22c55e] hover:text-[#22c55e] text-[#71717a] transition-all hover:shadow-[0_0_15px_rgba(34,197,94,0.1)] active:scale-90"
                        title={btn.label}
                    >
                        <btn.icon className="w-4 h-4" />
                    </button>
                ))}
            </div>

            <div
                ref={containerRef}
                className="bg-[radial-gradient(#1a1a1d_1px,transparent_1px)] bg-[size:32px_32px]"
                style={{
                    width: '100%',
                    height: '550px',
                    cursor: 'crosshair'
                }}
            />

            {/* Legend */}
            <div className="absolute bottom-6 left-6 z-20 flex gap-6 px-4 py-2.5 bg-[#121214]/80 backdrop-blur-md rounded-lg border border-[#27272a] shadow-xl">
                {[
                    { color: 'bg-[#f59e0b]', label: 'Person' },
                    { color: 'bg-[#3b82f6]', label: 'Organization' },
                    { color: 'bg-[#fafafa]', label: 'Concept' }
                ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${item.color} shadow-[0_0_8px_rgba(0,0,0,0.5)]`}></div>
                        <span className="text-[9px] font-black text-[#52525b] uppercase tracking-[0.15em]">{item.label}</span>
                    </div>
                ))}
            </div>

            {/* Status Footer */}
            <div className="absolute top-6 right-6 z-20 opacity-40 group-hover:opacity-100 transition-opacity">
                 <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#27272a] bg-[#09090b]">
                    <Activity className="w-3 h-3 text-[#22c55e]" />
                    <span className="text-[9px] font-black text-[#71717a] uppercase tracking-widest leading-none">Kernel Visualization Active</span>
                 </div>
            </div>
        </div>
    );
};

export default GraphMap;
