import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { Loader2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

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
                        label: nodeData.label || nodeData.name || 'Unknown',
                        type: nodeData.type || 'concept',
                        degree: nodeDegrees[id] || 0 // Add degree for styling
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
                        label: edgeData.label || edgeData.relation || ''
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
                            'background-color': '#ffffff',
                            'color': '#334155',
                            'font-size': '10px',
                            'font-weight': '600',
                            'text-valign': 'center',
                            'text-halign': 'center',
                            'border-width': 2,
                            'border-color': '#6366f1',
                            'text-wrap': 'wrap',
                            'text-max-width': '60px',
                            'overlay-padding': '4px',
                            'overlay-color': '#6366f1',
                            'overlay-opacity': 0.1,
                            'z-index': 10,
                            'transition-property': 'background-color, border-color, width, height',
                            'transition-duration': '0.3s'
                        }
                    },
                    {
                        // Explicitly only map degree on nodes that HAVE the property
                        selector: 'node[degree]',
                        style: {
                            'width': 'mapData(degree, 0, 10, 40, 80)',
                            'height': 'mapData(degree, 0, 10, 40, 80)',
                        }
                    },
                    {
                        selector: 'node[type="person"]',
                        style: { 
                            'background-color': '#fff7ed',
                            'border-color': '#f59e0b',
                            'color': '#9a3412'
                        }
                    },
                    {
                        selector: 'node[type="organization"]',
                        style: { 
                            'background-color': '#f0fdf4',
                            'border-color': '#10b981',
                            'color': '#166534'
                        }
                    },
                    {
                        selector: 'node:hover',
                        style: {
                            'background-color': '#eef2ff',
                            'border-width': 3,
                            'border-color': '#4f46e5',
                            'font-size': '11px',
                            'z-index': 100
                        }
                    },
                    {
                        selector: 'edge',
                        style: {
                            'width': 1.5,
                            'line-color': '#e2e8f0',
                            'target-arrow-color': '#e2e8f0',
                            'target-arrow-shape': 'triangle',
                            'curve-style': 'bezier',
                            'label': 'data(label)',
                            'font-size': '8px',
                            'color': '#94a3b8',
                            'text-background-opacity': 1,
                            'text-background-color': '#ffffff',
                            'text-background-padding': '2px',
                            'text-background-shape': 'roundrectangle',
                            'edge-text-rotation': 'autorotate',
                            'opacity': 0.8,
                            'transition-property': 'line-color, width, opacity',
                            'transition-duration': '0.3s'
                        }
                    },
                    {
                        selector: 'edge:hover',
                        style: {
                            'width': 3,
                            'line-color': '#6366f1',
                            'target-arrow-color': '#6366f1',
                            'opacity': 1
                        }
                    }
                ],
                layout: {
                    name: 'cose',
                    padding: 40,
                    animate: false, // [FIX] Disabled animation to prevent unmount crash ('notify' error)
                    refresh: 20,
                    fit: true,
                    randomize: false,
                    componentSpacing: 100,
                    nodeRepulsion: 400000,
                    edgeElasticity: 100,
                    nestingFactor: 5,
                    gravity: 80,
                    numIter: 1000,
                    initialTemp: 200,
                    coolingFactor: 0.95,
                    minTemp: 1.0
                }
            });

            // Event listeners
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
                    // [FIX] Stop any ongoing animations or background layouts before destroying
                    if (typeof cyRef.current.stop === 'function') {
                        cyRef.current.stop(true, true);
                    }
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
            <div className="flex flex-col items-center justify-center h-[400px] bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse"></div>
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin relative z-10" />
                </div>
                <span className="mt-4 text-sm font-semibold text-slate-600">Generating Knowledge Graph...</span>
                <span className="text-xs text-slate-400 mt-1">Extracting entities and relations</span>
            </div>
        );
    }

    if (!data.nodes || data.nodes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] bg-white rounded-2xl border border-slate-200 border-dashed text-center">
                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                    <Database className="w-6 h-6" />
                </div>
                <h3 className="text-slate-800 font-bold text-lg">No Graph Data Found</h3>
                <p className="text-sm text-slate-500 max-w-[250px] mt-2 mb-6">
                    Entities will appear here as you chat and index new pages. Start a conversation to build your knowledge map.
                </p>
            </div>
        );
    }

    return (
        <div className="relative group overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
            {/* Header / Info Bar */}
            <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2">
                <div className="px-3 py-1.5 bg-white/80 backdrop-blur-md border border-slate-200 rounded-full shadow-sm">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                        {data.nodes.length} Entities • {data.edges.length} Relations
                    </span>
                </div>
                {hoveredNode && (
                    <div className="px-3 py-1.5 bg-indigo-600 text-white rounded-full shadow-lg animate-in fade-in slide-in-from-left-2 duration-200">
                        <span className="text-xs font-bold">{hoveredNode}</span>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
                <button onClick={handleZoomIn} className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-600 transition-colors">
                    <ZoomIn className="w-4 h-4" />
                </button>
                <button onClick={handleZoomOut} className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-600 transition-colors">
                    <ZoomOut className="w-4 h-4" />
                </button>
                <button onClick={handleFit} className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-600 transition-colors">
                    <Maximize2 className="w-4 h-4" />
                </button>
            </div>

            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: '350px',
                    cursor: 'grab'
                }}
            />

            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-20 flex gap-4 p-2 bg-white/50 backdrop-blur-sm rounded-lg border border-white/20">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Person</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Org</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Concept</span>
                </div>
            </div>
        </div>
    );
};

export default GraphMap;
