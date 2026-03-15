import React from 'react';

export default function LoadingSkeleton({ type = 'card', count = 1 }) {
    if (type === 'card') {
        return (
            <>
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm animate-pulse">
                        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-slate-100 rounded w-full mb-2"></div>
                        <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                    </div>
                ))}
            </>
        );
    }

    if (type === 'message') {
        return (
            <div className="flex gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-slate-200"></div>
                <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-200 rounded w-full"></div>
                    <div className="h-3 bg-slate-200 rounded w-5/6"></div>
                </div>
            </div>
        );
    }

    if (type === 'text') {
        return (
            <div className="animate-pulse space-y-2">
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="h-3 bg-slate-200 rounded w-full"></div>
                ))}
            </div>
        );
    }

    return null;
}
