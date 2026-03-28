import React, { useState, useEffect, useRef } from 'react';
import { Globe, FileText, Layout, X, ChevronRight, Search, Loader2, Link as LinkIcon, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const IngestModal = ({ isOpen, onClose, currentUrl, onIngest }) => {
  const [step, setStep] = useState(1); // 1: URL Entry, 2: Mode Selection
  const [url, setUrl] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(true);
  const urlInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setUrl(currentUrl || '');
      // Focus input on open
      setTimeout(() => urlInputRef.current?.focus(), 100);
    }
  }, [isOpen, currentUrl]);

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (!url) return;

    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setIsValidUrl(false);
        return;
      }
      setUrl(parsed.toString());
      setIsValidUrl(true);
      
      // Auto-bypass mode selection for special URLs (GitHub, YouTube, etc.)
      const hostname = parsed.hostname;
      if (hostname === 'github.com' || hostname.includes('youtube.com') || hostname.includes('youtu.be') || hostname.includes('twitter.com') || hostname.includes('x.com')) {
        onIngest(parsed.toString(), null); // handleIngest logic in App.jsx will handle these
        onClose();
        return;
      }

      setStep(2);
    } catch (err) {
      setIsValidUrl(false);
    }
  };

  const selectMode = (mode) => {
    const config = mode === 'single' 
      ? { mode: 'single' } 
      : { mode: 'multi', max_pages: 10, max_depth: 3 };
    
    onIngest(url, config);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-[#0f172a] border border-[#1e293b] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl shadow-indigo-500/10"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/20 rounded-lg">
              <Globe className="w-5 h-5 text-indigo-400" />
            </div>
            <h3 className="font-semibold text-slate-100">
              {step === 1 ? 'Step 1: Website URL' : 'Step 2: Indexing Depth'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
              >
                <form onSubmit={handleUrlSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">
                      Enter URL to index
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <LinkIcon className="w-4 h-4" />
                      </div>
                      <input
                        ref={urlInputRef}
                        type="text"
                        value={url}
                        onChange={(e) => {
                          setUrl(e.target.value);
                          setIsValidUrl(true);
                        }}
                        placeholder="example.com"
                        className={`w-full bg-[#1e293b] border ${isValidUrl ? 'border-[#334155] focus:border-indigo-500' : 'border-rose-500/50'} rounded-xl py-3 pl-10 pr-4 text-slate-100 outline-none transition-all placeholder:text-slate-500`}
                      />
                    </div>
                    {!isValidUrl && (
                      <p className="text-rose-400 text-xs ml-1 flex items-center gap-1">
                        <Info className="w-3 h-3" /> Please enter a valid URL (http/https).
                      </p>
                    )}
                  </div>

                  <p className="text-sm text-slate-400 leading-relaxed px-1">
                    Enter the URL of the documentation, blog, or website you want to add to your knowledge base.
                  </p>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 group"
                  >
                    Continue to Mode
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-3"
              >
                <button
                  onClick={() => selectMode('single')}
                  className="w-full p-4 bg-[#1e293b] border border-[#334155] hover:border-indigo-500/50 hover:bg-[#2e3b4e] rounded-xl text-left flex items-start gap-4 transition-all group"
                >
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-100">Single Page</h4>
                    <p className="text-sm text-slate-400">Only index the exact URL provided (~10s)</p>
                  </div>
                </button>

                <button
                  onClick={() => selectMode('multi')}
                  className="w-full p-4 bg-[#1e293b] border border-[#334155] hover:border-emerald-500/50 hover:bg-[#2e3b4e] rounded-xl text-left flex items-start gap-4 transition-all group"
                >
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    <Layout className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-100">Website Crawl</h4>
                    <p className="text-sm text-slate-400">Find and index subpages automatically (~1-2m)</p>
                  </div>
                </button>

                <div className="pt-2">
                  <button
                    onClick={() => setStep(1)}
                    className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 mx-auto"
                  >
                    ← Back to URL
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default IngestModal;
