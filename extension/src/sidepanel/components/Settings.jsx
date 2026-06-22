import React, { useState, useEffect } from 'react';
import { Save, Key, ArrowLeft, LogOut, User, ExternalLink, ShieldCheck, Zap, Globe, Sparkles, Terminal, Copy, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../shared/supabaseClient';
import { apiClient } from '../../background/api';

export default function Settings({ onBack }) {
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [mistralApiKey, setMistralApiKey] = useState('');
    const [lingodevApiKey, setLingodevApiKey] = useState('');
    const [firecrawlApiKey, setFirecrawlApiKey] = useState('');
    const [groqApiKey, setGroqApiKey] = useState('');
    const [autoSuggest, setAutoSuggest] = useState(false);
    const [saved, setSaved] = useState(false);
    
    // MCP API Keys State
    const [mcpKeys, setMcpKeys] = useState([]);
    const [generatedKey, setGeneratedKey] = useState(null);
    const [loadingKeys, setLoadingKeys] = useState(false);
    const [generatingKey, setGeneratingKey] = useState(false);

    useEffect(() => {
        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['geminiApiKey', 'mistralApiKey', 'lingodevApiKey', 'firecrawlApiKey', 'groqApiKey', 'autoSuggest'], (result) => {
                if (result.geminiApiKey) setGeminiApiKey(result.geminiApiKey);
                if (result.mistralApiKey) setMistralApiKey(result.mistralApiKey);
                if (result.lingodevApiKey) setLingodevApiKey(result.lingodevApiKey);
                if (result.firecrawlApiKey) setFirecrawlApiKey(result.firecrawlApiKey);
                if (result.groqApiKey) setGroqApiKey(result.groqApiKey);
                if (result.autoSuggest !== undefined) setAutoSuggest(result.autoSuggest);
            });
        }
        fetchMcpKeys();
    }, []);

    const fetchMcpKeys = async () => {
        try {
            setLoadingKeys(true);
            const response = await apiClient.listApiKeys();
            if (response && response.keys) {
                setMcpKeys(response.keys);
            }
        } catch (error) {
            console.error("Failed to fetch MCP keys:", error);
        } finally {
            setLoadingKeys(false);
        }
    };

    const handleGenerateKey = async () => {
        try {
            setGeneratingKey(true);
            const response = await apiClient.generateApiKey("Claude Desktop Extension");
            if (response && response.success) {
                setGeneratedKey(response.key);
                fetchMcpKeys(); // Refresh list
            }
        } catch (error) {
            console.error("Failed to generate key:", error);
        } finally {
            setGeneratingKey(false);
        }
    };

    const handleRevokeKey = async (keyId) => {
        if (!confirm("Are you sure you want to revoke this key? Any connected MCP clients will stop working immediately.")) return;
        try {
            await apiClient.revokeApiKey(keyId);
            fetchMcpKeys(); // Refresh list
        } catch (error) {
            console.error("Failed to revoke key:", error);
        }
    };

    const handleSave = () => {
        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({
                geminiApiKey: geminiApiKey.trim(),
                mistralApiKey: mistralApiKey.trim(),
                lingodevApiKey: lingodevApiKey.trim(),
                firecrawlApiKey: firecrawlApiKey.trim(),
                groqApiKey: groqApiKey.trim(),
                autoSuggest: autoSuggest
            }, () => {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            });
        }
    };

    const apiGroups = [
        {
            title: "Core Intelligence",
            icon: <Sparkles className="w-3.5 h-3.5 text-indigo-500" />,
            items: [
                { id: 'gemini', label: 'Google Gemini', value: geminiApiKey, setter: setGeminiApiKey, placeholder: 'AIzaSy...', link: 'https://aistudio.google.com/app/apikey', hint: 'Embeddings & Vision' },
                { id: 'mistral', label: 'Mistral AI', value: mistralApiKey, setter: setMistralApiKey, placeholder: 'Key...', link: 'https://console.mistral.ai/api-keys/', hint: 'Primary Reasoning' },
            ]
        },
        {
            title: "Scraping & Connectivity",
            icon: <Globe className="w-3.5 h-3.5 text-emerald-500" />,
            items: [
                { id: 'firecrawl', label: 'Firecrawl', value: firecrawlApiKey, setter: setFirecrawlApiKey, placeholder: 'fc-...', link: 'https://www.firecrawl.dev/app/api-keys', hint: 'Advanced Web Scraper' },
                { id: 'groq', label: 'Groq Cloud', value: groqApiKey, setter: setGroqApiKey, placeholder: 'gsk_...', link: 'https://console.groq.com/keys', hint: 'Ultra-fast Vision' },
                { id: 'lingo', label: 'Lingo.dev', value: lingodevApiKey, setter: setLingodevApiKey, placeholder: 'Key...', link: 'https://lingo.dev', hint: 'I18n Translation' },
            ]
        }
    ];

    return (
        <div className="flex flex-col h-screen bg-[#F8FAFC]">
            {/* Header */}
            <header className="shrink-0 px-4 py-4 border-b border-slate-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-30 flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="p-1.5 hover:bg-slate-100 rounded-xl transition-all text-slate-500 active:scale-95"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex flex-col">
                    <h2 className="font-bold text-slate-900 text-sm leading-none">Settings</h2>
                    <span className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-tighter">SnapMind Extension</span>
                </div>
            </header>

            {/* Scrollable Content */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 pb-24">

                {/* Account Section */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account</h3>
                        </div>
                    </div>

                    <div className="bg-white p-3 rounded-2xl border border-slate-200/60 shadow-sm">
                        <button
                            onClick={async () => {
                                await supabase.auth.signOut();
                            }}
                            className="w-full flex justify-between items-center bg-red-50/50 hover:bg-red-50 text-red-600 px-3 py-2.5 rounded-xl border border-red-100/50 transition-all active:scale-[0.98]"
                        >
                            <span className="text-xs font-bold">Sign Out</span>
                            <LogOut className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </section>

                {/* API Key Sections */}
                {apiGroups.map((group, idx) => (
                    <section key={idx} className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            {group.icon}
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{group.title}</h3>
                        </div>

                        <div className="space-y-2.5">
                            {group.items.map((key) => (
                                <div key={key.id} className="bg-white p-3 rounded-2xl border border-slate-200/60 shadow-sm space-y-2 transition-all focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500/50">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5">
                                            {key.label}
                                            <a
                                                href={key.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-indigo-500 hover:text-indigo-600 transition-colors"
                                                title={`Get ${key.label} Key`}
                                            >
                                                <ExternalLink className="w-2.5 h-2.5" />
                                            </a>
                                        </label>
                                        <span className="text-[9px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">{key.hint}</span>
                                    </div>
                                    <div className="relative group">
                                        <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-300 group-focus-within:text-indigo-400 transition-colors" />
                                        <input
                                            type="password"
                                            value={key.value}
                                            onChange={(e) => key.setter(e.target.value)}
                                            placeholder={key.placeholder}
                                            className="w-full bg-slate-50/50 border border-slate-100 rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:bg-white transition-all font-mono"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                ))}

                {/* Preferences Section */}
                <section className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Behavior</h3>
                    </div>

                    <div className="p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <label className="text-xs font-bold text-slate-800">
                                    Auto-Suggest Summaries
                                </label>
                                <p className="text-[9px] text-slate-400">
                                    Generate context-aware suggestions
                                </p>
                            </div>
                            <button
                                onClick={() => setAutoSuggest(!autoSuggest)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${autoSuggest ? 'bg-indigo-600' : 'bg-slate-200'}`}
                            >
                                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${autoSuggest ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>
                </section>

                {/* MCP Integration Section */}
                <section className="space-y-3 mt-4">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MCP Integration</h3>
                        </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
                        <div className="space-y-1">
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                                Generate a Personal API Key to connect SnapMind to Claude Desktop or other MCP clients. 
                                Keys are hashed and cannot be viewed again.
                            </p>
                        </div>

                        {generatedKey ? (
                            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Copy this key now</span>
                                    <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(generatedKey);
                                            setGeneratedKey(null);
                                        }}
                                        className="text-[10px] bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700 transition-colors flex items-center gap-1"
                                    >
                                        <Copy className="w-3 h-3" /> Done
                                    </button>
                                </div>
                                <code className="block w-full p-2 bg-white rounded border border-emerald-200 text-xs font-mono text-emerald-900 break-all">
                                    {generatedKey}
                                </code>
                            </div>
                        ) : (
                            <button
                                onClick={handleGenerateKey}
                                disabled={generatingKey}
                                className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-100"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                {generatingKey ? "Generating..." : "Generate New API Key"}
                            </button>
                        )}

                        {mcpKeys.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                {mcpKeys.map(k => (
                                    <div key={k.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-bold text-slate-700">{k.name}</span>
                                            <span className="text-[9px] text-slate-400 font-mono">{k.key_prefix}</span>
                                        </div>
                                        <button
                                            onClick={() => handleRevokeKey(k.id)}
                                            className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                            title="Revoke Key"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* Security Note */}
                <div className="flex items-start gap-2.5 p-3 bg-indigo-50/30 rounded-2xl border border-indigo-100/30">
                    <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <p className="text-[9px] text-indigo-700/70 leading-relaxed font-medium">
                        All keys are stored encrypted locally in your browser and never touch our servers directly.
                    </p>
                </div>
            </main>

            {/* Fixed Footer for Save Button */}
            <footer className="shrink-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200/60 absolute bottom-0 left-0 right-0 z-40">
                <button
                    onClick={handleSave}
                    disabled={saved}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold transition-all shadow-lg active:scale-[0.98] ${saved
                        ? 'bg-emerald-500 text-white shadow-emerald-200'
                        : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200'
                        }`}
                >
                    {saved ? (
                        <>Saved Successfully ✓</>
                    ) : (
                        <>
                            <Save className="w-3.5 h-3.5" />
                            Save & Sync Settings
                        </>
                    )}
                </button>
            </footer>

        </div>
    );
}
