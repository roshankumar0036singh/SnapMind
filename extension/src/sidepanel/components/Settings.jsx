import React, { useState, useEffect } from 'react';
import { Save, Key, ArrowLeft } from 'lucide-react';

export default function Settings({ onBack }) {
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [mistralApiKey, setMistralApiKey] = useState('');
    const [lingodevApiKey, setLingodevApiKey] = useState('');
    const [firecrawlApiKey, setFirecrawlApiKey] = useState('');
    const [groqApiKey, setGroqApiKey] = useState('');
    const [backendUrl, setBackendUrl] = useState('');
    const [useLocalBackend, setUseLocalBackend] = useState(false);
    const [localConnectionStatus, setLocalConnectionStatus] = useState(null); // 'testing', 'success', 'failed'
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        // Load existing keys
        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['geminiApiKey', 'mistralApiKey', 'lingodevApiKey', 'firecrawlApiKey', 'groqApiKey', 'backendUrl', 'useLocalBackend'], (result) => {
                if (result.geminiApiKey) setGeminiApiKey(result.geminiApiKey);
                if (result.mistralApiKey) setMistralApiKey(result.mistralApiKey);
                if (result.lingodevApiKey) setLingodevApiKey(result.lingodevApiKey);
                if (result.firecrawlApiKey) setFirecrawlApiKey(result.firecrawlApiKey);
                if (result.groqApiKey) setGroqApiKey(result.groqApiKey);
                if (result.backendUrl) setBackendUrl(result.backendUrl);
                if (result.useLocalBackend !== undefined) setUseLocalBackend(result.useLocalBackend);
            });
        }
    }, []);

    const handleSave = () => {
        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({
                geminiApiKey: geminiApiKey.trim(),
                mistralApiKey: mistralApiKey.trim(),
                lingodevApiKey: lingodevApiKey.trim(),
                firecrawlApiKey: firecrawlApiKey.trim(),
                groqApiKey: groqApiKey.trim(),
                backendUrl: backendUrl.trim(),
                useLocalBackend: useLocalBackend
            }, () => {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            });
        } else {
            console.warn("Chrome storage not available (dev mode?)");
        }
    };

    const testLocalConnection = async () => {
        setLocalConnectionStatus('testing');
        try {
            const res = await fetch('http://localhost:8000/bridge/status');
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'connected') {
                    setLocalConnectionStatus('success');
                    return;
                }
            }
            setLocalConnectionStatus('failed');
        } catch (e) {
            setLocalConnectionStatus('failed');
        }
    };

    return (
        <div className="flex flex-col h-screen bg-white">
            {/* Header - Fixed */}
            <div className="shrink-0 px-5 py-4 border-b border-gray-100 flex items-center gap-3 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
                <button
                    onClick={onBack}
                    className="p-1 -ml-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="font-bold text-gray-900">Settings</h2>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5 pb-8">
                
                {/* Section: API Keys */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Key className="w-4 h-4 text-indigo-500" />
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">API Infrastructure</h3>
                    </div>

                    {[
                        { id: 'gemini', label: 'Gemini (Vertex/AI)', value: geminiApiKey, setter: setGeminiApiKey, placeholder: 'AIzaSy...', hint: 'Embeddings & Vector Search' },
                        { id: 'mistral', label: 'Mistral (Chat)', value: mistralApiKey, setter: setMistralApiKey, placeholder: 'Mistral API Key...', hint: 'Primary Chat & Reasoning' },
                        { id: 'lingo', label: 'Lingo.dev (I18n)', value: lingodevApiKey, setter: setLingodevApiKey, placeholder: 'Lingo Key...', hint: 'Multi-language processing' },
                        { id: 'groq', label: 'Groq (Vision)', value: groqApiKey, setter: setGroqApiKey, placeholder: 'gsk_...', hint: 'Fast Vision Analysis Falback' },
                        { id: 'firecrawl', label: 'Firecrawl (Web)', value: firecrawlApiKey, setter: setFirecrawlApiKey, placeholder: 'fc-...', hint: 'Advanced Web Scraping' },
                    ].map((key) => (
                        <div key={key.id} className="space-y-1.5 bg-gray-50/50 p-3 rounded-xl border border-gray-100 transition-all focus-within:border-indigo-200">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex justify-between">
                                {key.label}
                                <span className="text-[9px] font-medium text-gray-400 normal-case">{key.hint}</span>
                            </label>
                            <input
                                type="password"
                                value={key.value}
                                onChange={(e) => key.setter(e.target.value)}
                                placeholder={key.placeholder}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono"
                            />
                        </div>
                    ))}
                </div>

                {/* Section: Connectivity */}
                <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 mb-1">
                        <Save className="w-4 h-4 text-indigo-500" />
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Routing</h3>
                    </div>

                    <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100/50">
                        <div className="flex items-center justify-between mb-2">
                            <div className="space-y-0.5">
                                <label className="text-xs font-bold text-gray-900">
                                    Local Fusion Mode
                                </label>
                                <p className="text-[10px] text-gray-500">
                                    Bridge to SnapMind Desktop
                                </p>
                            </div>
                            <button
                                onClick={() => setUseLocalBackend(!useLocalBackend)}
                                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${useLocalBackend ? 'bg-indigo-600' : 'bg-gray-200'}`}
                            >
                                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useLocalBackend ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {useLocalBackend && (
                            <div className="pt-2 border-t border-indigo-100 mt-2 flex items-center justify-between">
                                <button
                                    onClick={testLocalConnection}
                                    disabled={localConnectionStatus === 'testing'}
                                    className="px-2 py-1 bg-white border border-indigo-200 text-[10px] font-bold text-indigo-700 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                                >
                                    {localConnectionStatus === 'testing' ? 'Testing...' : 'Test Sync'}
                                </button>
                                {localConnectionStatus === 'success' && (
                                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 italic">
                                        ✓ Bridge Active
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {!useLocalBackend && (
                        <div className="space-y-1.5 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                Cloud Node URL
                            </label>
                            <input
                                type="text"
                                value={backendUrl}
                                onChange={(e) => setBackendUrl(e.target.value)}
                                placeholder="https://..."
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono"
                            />
                        </div>
                    )}
                </div>

                {/* Footer Sync */}
                <div className="pt-4">
                    <button
                        onClick={handleSave}
                        disabled={saved}
                        className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-xs font-bold transition-all shadow-lg ${saved
                            ? 'bg-emerald-500 text-white shadow-emerald-200 translate-y-0'
                            : 'bg-gray-900 text-white hover:bg-black hover:shadow-xl active:scale-95'
                        }`}
                    >
                        {saved ? 'Synchronized ✓' : 'Save & Refresh Bridge'}
                        {!saved && <Save className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6366f1; }
            `}} />
        </div>
    );
}
