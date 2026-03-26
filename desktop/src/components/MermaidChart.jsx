import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Activity } from 'lucide-react';

mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
        primaryColor: '#121214',
        primaryTextColor: '#fafafa',
        primaryBorderColor: '#27272a',
        lineColor: '#22c55e',
        secondaryColor: '#18181b',
        tertiaryColor: '#09090b',
        mainBkg: '#121214',
        nodeBorder: '#27272a',
        clusterBkg: '#09090b',
        clusterBorder: '#27272a',
        fontSize: '12px',
        fontFamily: 'Geist Mono, monospace'
    },
    fontFamily: 'Geist Mono, monospace',
    securityLevel: 'loose',
    suppressErrorRendering: true
});

export default function MermaidChart({ chart }) {
    const containerRef = useRef(null);
    const [svgStr, setSvgStr] = useState('');
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const renderChart = async () => {
            try {
                setError(false);
                let cleanChart = chart.replace(/```mermaid\n?/g, '').replace(/```/g, '').trim();

                if (cleanChart.toLowerCase().startsWith('mermaid\n')) {
                    cleanChart = cleanChart.substring(8).trim();
                } else if (cleanChart.toLowerCase().startsWith('mermaid ')) {
                    cleanChart = cleanChart.substring(8).trim();
                }

                cleanChart = cleanChart.replace(/(\w+)\s*\[([^"\]]*\([^"\]]*\)[^"\]]*)\]/g, '$1["$2"]');
                cleanChart = cleanChart.replace(/(\w+)\s*\(([^"\]]*\([^"\]]*\)[^"\]]*)\)/g, '$1("$2")');
                cleanChart = cleanChart.replace(/(\w+)\s*\{([^"\]]*\([^"\]]*\)[^"\]]*)\}/g, '$1{"$2"}');

                if (await mermaid.parse(cleanChart)) {
                    const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    const { svg } = await mermaid.render(id, cleanChart);

                    if (svg.includes("Syntax error in text")) {
                        throw new Error("Mermaid syntax error detected in SVG output");
                    }

                    if (isMounted) setSvgStr(svg);
                }
            } catch (err) {
                console.error("Mermaid parsing error:", err);
                if (isMounted) setError(true);
            }
        };
        if (chart) renderChart();
        return () => { isMounted = false; };
    }, [chart]);

    if (error) {
        return (
            <div className="p-4 bg-[#121214] text-[#3f3f46] rounded-xl border border-dashed border-[#27272a] text-[10px] font-black uppercase tracking-widest text-center my-4 animate-pulse">
                Diagram Extraction Failure • Check Syntax
            </div>
        );
    }

    return (
        <React.Fragment>
            <style>
                {`
                .mermaid-chart-container svg {
                    max-width: 100% !important;
                    height: auto !important;
                    max-height: 500px !important;
                }
                .mermaid-chart-container .node rect, 
                .mermaid-chart-container .node circle, 
                .mermaid-chart-container .node polygon, 
                .mermaid-chart-container .node path {
                    stroke-width: 1.5px !important;
                    fill: #121214 !important;
                    stroke: #27272a !important;
                }
                .mermaid-chart-container .label {
                    color: #fafafa !important;
                    font-family: inherit !important;
                }
                .mermaid-chart-container .edgePath .path {
                    stroke: #22c55e !important;
                    stroke-width: 1.5px !important;
                }
                .mermaid-chart-container .edgeLabel {
                    background-color: #09090b !important;
                    color: #71717a !important;
                    font-size: 10px !important;
                    font-weight: 900 !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.1em !important;
                }
                `}
            </style>
            <div className="my-6 space-y-2">
                <div className="flex items-center gap-2 px-1">
                    <Activity className="w-3 h-3 text-[#22c55e]" />
                    <span className="text-[9px] font-black text-[#52525b] uppercase tracking-[0.2em]">Flow Schematic v1.0</span>
                </div>
                <div
                    ref={containerRef}
                    className="mermaid-chart-container p-6 bg-[#09090b] rounded-2xl border border-[#27272a] shadow-inner flex justify-center overflow-auto"
                    style={{
                        maxHeight: '520px',
                        maxWidth: '100%',
                    }}
                    dangerouslySetInnerHTML={{ __html: svgStr }}
                />
            </div>
        </React.Fragment>
    );
}
