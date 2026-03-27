import React from 'react';

export default function LoadingSkeleton({ type = 'card', count = 1 }) {
    if (type === 'card') {
        return (
            <>
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="bg-[#121214] border border-[#27272a] p-6 rounded-xl animate-pulse">
                        <div className="h-3 bg-[#1a1a1d] rounded w-3/4 mb-3"></div>
                        <div className="h-2 bg-[#1a1a1d] rounded w-full mb-2"></div>
                        <div className="h-2 bg-[#1a1a1d] rounded w-1/2"></div>
                    </div>
                ))}
            </>
        );
    }

    if (type === 'message') {
        return (
            <div className="flex gap-4 animate-pulse p-6">
                <div className="w-8 h-8 rounded-lg bg-[#1a1a1d]"></div>
                <div className="flex-1 space-y-3">
                    <div className="h-2 bg-[#1a1a1d] rounded w-3/4"></div>
                    <div className="h-2 bg-[#1a1a1d] rounded w-full"></div>
                    <div className="h-2 bg-[#1a1a1d] rounded w-5/6"></div>
                </div>
            </div>
        );
    }

    if (type === 'text') {
        return (
            <div className="animate-pulse space-y-3">
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="h-2 bg-[#1a1a1d] rounded w-full"></div>
                ))}
            </div>
        );
    }

    return null;
}
