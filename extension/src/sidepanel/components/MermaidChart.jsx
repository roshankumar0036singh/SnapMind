import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
        primaryColor: '#eef2ff', // indigo-50
        primaryTextColor: '#4f46e5', // indigo-600
        primaryBorderColor: '#c7d2fe', // indigo-200
        lineColor: '#6366f1', // indigo-500
        secondaryColor: '#f8fafc', // slate-50
        tertiaryColor: '#ffffff'
    },
    fontFamily: 'inherit',
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
                // ReactMarkdown passes the children as a string. Sometimes LLMs write `mermaid` at the start of the inside.
                let cleanChart = chart.replace(/```mermaid\n?/g, '').replace(/```/g, '').trim();

                // If it starts with 'mermaid', strip that out (common LLM mistake)
                if (cleanChart.toLowerCase().startsWith('mermaid\n')) {
                    cleanChart = cleanChart.substring(8).trim();
                } else if (cleanChart.toLowerCase().startsWith('mermaid ')) {
                    cleanChart = cleanChart.substring(8).trim();
                }

                // [NEW] Sanitize labels: wrap labels containing parentheses in quotes if not already quoted
                // This fixes errors like: id[Label (with parens)] -> id["Label (with parens)"]
                cleanChart = cleanChart.replace(/(\w+)\s*\[([^"\]]*\([^"\]]*\)[^"\]]*)\]/g, '$1["$2"]');
                cleanChart = cleanChart.replace(/(\w+)\s*\(([^"\]]*\([^"\]]*\)[^"\]]*)\)/g, '$1("$2")');
                cleanChart = cleanChart.replace(/(\w+)\s*\{([^"\]]*\([^"\]]*\)[^"\]]*)\}/g, '$1{"$2"}');

                // First attempt to parse it strictly to catch syntax errors
                if (await mermaid.parse(cleanChart)) {
                    const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    const { svg } = await mermaid.render(id, cleanChart);

                    // The standard mermaid error string can sometimes still bypass suppressErrorRendering
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
            <div className="p-3 bg-slate-50 text-slate-400 rounded-lg border border-slate-200 text-xs text-center italic my-3">
                Diagram is generating or unavailable.
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
                    max-height: 400px !important;
                }
                `}
            </style>
            <div
                ref={containerRef}
                className="mermaid-chart-container p-4 bg-white/50 rounded-xl border border-indigo-100/50 shadow-sm flex justify-center my-3"
                style={{
                    maxHeight: '400px',
                    maxWidth: '100%',
                    overflow: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
                dangerouslySetInnerHTML={{ __html: svgStr }}
            />
        </React.Fragment>
    );
}
