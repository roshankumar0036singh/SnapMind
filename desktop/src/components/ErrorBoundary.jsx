import React from 'react';
import { AlertTriangle, RefreshCcw, Zap } from 'lucide-react';

export default function ErrorBoundary({ children }) {
    const [hasError, setHasError] = React.useState(false);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        const errorHandler = (event) => {
            setHasError(true);
            setError(event.error);
            console.error('Kernel exception caught by boundary:', event.error);
        };

        window.addEventListener('error', errorHandler);
        return () => window.removeEventListener('error', errorHandler);
    }, []);

    if (hasError) {
        return (
            <div className="h-screen flex items-center justify-center bg-[#09090b] p-6 font-sans">
                <div className="max-w-md w-full bg-[#121214] rounded-2xl border border-[#ef4444]/20 shadow-[0_0_50px_rgba(239,68,68,0.1)] overflow-hidden">
                    <div className="p-8">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center text-[#ef4444]">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#fafafa]">Kernel Exception</h2>
                                <p className="text-[10px] font-black text-[#52525b] uppercase tracking-widest mt-1">Infrastructure Instability Detected</p>
                            </div>
                        </div>

                        <div className="p-4 bg-[#09090b] rounded-xl border border-[#1a1a1d] mb-6">
                            <p className="text-[11px] text-[#a1a1aa] leading-relaxed font-medium uppercase tracking-tight">
                                The application runtime has encountered a non-recoverable state. Critical process termination may be required to maintain data integrity.
                            </p>
                        </div>

                        {error && (
                            <div className="mb-6">
                                <details className="group">
                                    <summary className="text-[9px] font-black text-[#3f3f46] cursor-pointer hover:text-[#71717a] uppercase tracking-[0.2em] list-none flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-[#3f3f46] group-open:bg-[#ef4444]" />
                                        Stack Trace Dump
                                    </summary>
                                    <div className="mt-4 p-4 bg-[#09090b] rounded-lg border border-[#1a1a1d] overflow-auto max-h-40 scrollbar-hide">
                                        <pre className="text-[10px] font-mono text-[#ef4444]/70 whitespace-pre-wrap leading-relaxed">
                                            {error.stack || error.toString()}
                                        </pre>
                                    </div>
                                </details>
                            </div>
                        )}

                        <button
                            onClick={() => window.location.reload()}
                            className="w-full flex items-center justify-center gap-3 py-3 bg-[#fafafa] hover:bg-[#ef4444] text-[#09090b] hover:text-[#fafafa] rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all hover:shadow-[0_0_30px_rgba(239,68,68,0.2)] active:scale-95"
                        >
                            <RefreshCcw className="w-4 h-4" />
                            Reinitialize Kernel
                        </button>
                    </div>
                    
                    <div className="px-8 py-4 bg-[#09090b] border-t border-[#1a1a1d] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Zap className="w-3 h-3 text-[#f59e0b]" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#3f3f46]">Safeguard Protocol Active</span>
                        </div>
                        <span className="text-[9px] font-black text-[#3f3f46] uppercase tracking-widest">Error 0xSM-KRNL</span>
                    </div>
                </div>
            </div>
        );
    }

    return children;
}
