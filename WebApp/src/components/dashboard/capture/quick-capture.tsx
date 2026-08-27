'use client';

import CaptureForm from './capture-form';
import { IconButton, PANEL } from '@/components/dashboard/ui';
import { useCapture } from '@/context/CaptureContext';
import { cn } from '@/lib/utils';
import { Sparkles, X } from 'lucide-react';
import { useEffect } from 'react';

export default function QuickCapture() {
  const { quickOpen, openQuick, closeQuick } = useCapture();

  // Cmd/Ctrl+Shift+K opens capture from anywhere in the dashboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openQuick();
      }
      if (e.key === 'Escape' && quickOpen) closeQuick();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [quickOpen, openQuick, closeQuick]);

  useEffect(() => {
    if (!quickOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [quickOpen]);

  if (!quickOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 sm:pt-24 overflow-y-auto">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={closeQuick} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick capture"
        className={cn(PANEL, 'relative w-full max-w-2xl shadow-theme-lg')}
      >
        <header className="flex items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">
                Quick capture
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Add anything to your knowledge base
              </p>
            </div>
          </div>
          <IconButton icon={<X className="w-4 h-4" />} label="Close" onClick={closeQuick} />
        </header>
        <div className="px-6 py-5">
          <CaptureForm compact onDone={closeQuick} />
        </div>
      </div>
    </div>
  );
}
