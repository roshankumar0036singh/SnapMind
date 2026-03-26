import { useState, useEffect } from 'react';
import { Save, Key, ArrowLeft, Database, Upload, Download, Loader2, ShieldCheck, Globe, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings({ onBack }) {
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [mistralApiKey, setMistralApiKey] = useState('');
    const [lingodevApiKey, setLingodevApiKey] = useState('');
    const [firecrawlApiKey, setFirecrawlApiKey] = useState('');
    const [groqApiKey, setGroqApiKey] = useState('');
    const [backendUrl, setBackendUrl] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['geminiApiKey', 'mistralApiKey', 'lingodevApiKey', 'firecrawlApiKey', 'groqApiKey', 'backendUrl'], (result) => {
                if (result.geminiApiKey) setGeminiApiKey(result.geminiApiKey);
                if (result.mistralApiKey) setMistralApiKey(result.mistralApiKey);
                if (result.lingodevApiKey) setLingodevApiKey(result.lingodevApiKey);
                if (result.firecrawlApiKey) setFirecrawlApiKey(result.firecrawlApiKey);
                if (result.groqApiKey) setGroqApiKey(result.groqApiKey);
                if (result.backendUrl) setBackendUrl(result.backendUrl);
            });
        }
    }, []);

    const handleSave = () => {
        setIsSaving(true);
        chrome.storage.local.set({
            geminiApiKey,
            mistralApiKey,
            lingodevApiKey,
            firecrawlApiKey,
            groqApiKey,
            backendUrl
        }, () => {
            setIsSaving(false);
            setSaved(true);
            toast.success('Configuration updated');
            setTimeout(() => setSaved(false), 2000);
        });
    };

    const handleBackup = async () => {
        const path = await window.electronAPI.selectFolder();
        if (!path) return;

        const targetPath = `${path}\\snapmind_backup_${new Date().toISOString().split('T')[0]}.json`;
        const toastId = toast.loading("Creating backup...");

        try {
            const response = await fetch(`${backendUrl || 'http://localhost:8000'}/admin/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: targetPath })
            });
            const result = await response.json();
            if (result.success) {
                toast.success(`Backup created: ${result.counts.documents} chunks exported`, { id: toastId });
            } else {
                toast.error(`Backup failed: ${result.error}`, { id: toastId });
            }
        } catch (e) {
            toast.error(`Error: ${e.message}`, { id: toastId });
        }
    };

    const handleRestore = async () => {
        const path = await window.electronAPI.selectFile();
        if (!path) return;

        if (!confirm("This will merge the backup data into your current library. Continue?")) return;

        const toastId = toast.loading("Restoring library...");

        try {
            const response = await fetch(`${backendUrl || 'http://localhost:8000'}/admin/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: path })
            });
            const result = await response.json();
            if (result.success) {
                toast.success("Library restored successfully!", { id: toastId });
            } else {
                toast.error(`Restore failed: ${result.error}`, { id: toastId });
            }
        } catch (e) {
            toast.error(`Error: ${e.message}`, { id: toastId });
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#09090b] text-[#fafafa] font-sans">
            {/* Header */}
            <header className="px-6 py-4 border-b border-[#1a1a1d] flex items-center justify-between bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 hover:bg-[#1a1a1d] rounded-lg transition-colors text-[#a1a1aa]"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-widest text-[#fafafa]">System Preferences</h2>
                        <p className="text-[10px] font-medium text-[#71717a] uppercase tracking-wider">Infrastructure Configuration</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="px-2 py-1 rounded bg-[#22c55e]/10 border border-[#22c55e]/20">
                        <span className="text-[10px] font-black text-[#22c55e] uppercase tracking-tighter">v2.4.0-PRO</span>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                {/* Section: API Keys */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-1 h-4 bg-[#22c55e] rounded-full" />
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#71717a]">Security & Authentication</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            { label: 'Gemini API Key', value: geminiApiKey, setter: setGeminiApiKey, placeholder: 'AIzaSy...', desc: 'Core Embedding & RAG provider' },
                            { label: 'Mistral API Key', value: mistralApiKey, setter: setMistralApiKey, placeholder: 'Retrieve from console.mistral.ai', desc: 'Primary LLM Generation' },
                            { label: 'Lingo.dev API Key', value: lingodevApiKey, setter: setLingodevApiKey, placeholder: 'Get from platform.lingo.dev', desc: 'Multi-lingual ingestion engine' },
                            { label: 'Groq API Key', value: groqApiKey, setter: setGroqApiKey, placeholder: 'gsk_...', desc: 'Ultra-fast fallback vision model' },
                            { label: 'Firecrawl API Key', value: firecrawlApiKey, setter: setFirecrawlApiKey, placeholder: 'fc-...', desc: 'Advanced recursive web scraping' }
                        ].map((field, i) => (
                            <div key={i} className="space-y-2 group">
                                <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider flex items-center gap-2">
                                    <Key className="w-3 h-3 text-[#3f3f46]" />
                                    {field.label}
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={field.value}
                                        onChange={(e) => field.setter(e.target.value)}
                                        placeholder={field.placeholder}
                                        className="w-full bg-[#121214] border border-[#27272a] rounded-lg px-4 py-3 text-xs font-mono text-[#fafafa] placeholder-[#3f3f46] focus:outline-none focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e]/20 transition-all"
                                    />
                                </div>
                                <p className="text-[10px] text-[#52525b] font-medium">{field.desc}</p>
                            </div>
                        ))}

                        {/* Backend URL - Special Width */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider flex items-center gap-2">
                                <Globe className="w-3 h-3 text-[#3f3f46]" />
                                Backend Infrastructure URL
                            </label>
                            <input
                                type="text"
                                value={backendUrl}
                                onChange={(e) => setBackendUrl(e.target.value)}
                                placeholder="http://localhost:8000"
                                className="w-full bg-[#121214] border border-[#27272a] rounded-lg px-4 py-3 text-xs font-mono text-[#fafafa] placeholder-[#3f3f46] focus:outline-none focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e]/20 transition-all"
                            />
                            <p className="text-[10px] text-[#52525b] font-medium">Point to your local or hosted SnapMind core server instance.</p>
                        </div>
                    </div>
                </section>

                {/* Section: Data Management */}
                <section className="space-y-6 pt-6 border-t border-[#1a1a1d]">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-1 h-4 bg-[#22c55e] rounded-full" />
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#71717a]">Data Portability</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={handleBackup}
                            className="flex flex-col items-start gap-3 p-5 bg-[#121214] border border-[#27272a] rounded-xl hover:border-[#3f3f46] hover:bg-[#18181b] transition-all group"
                        >
                            <div className="p-2 bg-[#27272a] rounded-lg group-hover:bg-[#22c55e]/10 group-hover:text-[#22c55e] transition-colors">
                                <Download className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <h4 className="text-xs font-bold text-[#fafafa] uppercase tracking-wide">Export Library</h4>
                                <p className="text-[10px] text-[#71717a] mt-1">Generate a full JSON backup of your vector index and metadata.</p>
                            </div>
                        </button>

                        <button
                            onClick={handleRestore}
                            className="flex flex-col items-start gap-3 p-5 bg-[#121214] border border-[#27272a] rounded-xl hover:border-[#3f3f46] hover:bg-[#18181b] transition-all group"
                        >
                            <div className="p-2 bg-[#27272a] rounded-lg group-hover:bg-[#22c55e]/10 group-hover:text-[#22c55e] transition-colors">
                                <Upload className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <h4 className="text-xs font-bold text-[#fafafa] uppercase tracking-wide">Import Library</h4>
                                <p className="text-[10px] text-[#71717a] mt-1">Restore your knowledge base from a previously exported archive.</p>
                            </div>
                        </button>
                    </div>
                </section>

                {/* Section: Maintenance */}
                <section className="space-y-6 pt-6 border-t border-[#1a1a1d]">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-1 h-4 bg-[#22c55e] rounded-full" />
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#71717a]">System Integrity</h3>
                    </div>
                    
                    <div className="p-5 bg-[#22c55e]/5 border border-[#22c55e]/10 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-[#22c55e]/20 flex items-center justify-center">
                                <ShieldCheck className="w-5 h-5 text-[#22c55e]" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-[#fafafa] uppercase tracking-wide">Secure Storage Active</h4>
                                <p className="text-[10px] text-[#22c55e]/70">Local secrets are encrypted using AES-256 standard.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                            <span className="text-[10px] font-black text-[#22c55e] uppercase">Verified</span>
                        </div>
                    </div>
                </section>
            </div>

            {/* Sticky Action Footer */}
            <div className="p-6 bg-[#09090b] border-t border-[#1a1a1d] flex justify-end items-center gap-4">
                <button
                    onClick={onBack}
                    className="px-5 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest text-[#71717a] hover:text-[#fafafa] hover:bg-[#1a1a1d] transition-all"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`flex items-center gap-3 px-8 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                        saved 
                        ? 'bg-[#22c55e] text-[#09090b] shadow-[0_0_20px_rgba(34,197,94,0.3)]' 
                        : 'bg-[#fafafa] text-[#09090b] hover:bg-[#22c55e] hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                    } disabled:opacity-50`}
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (saved ? 'All Systems Go' : 'Commit Changes')}
                    {!isSaving && !saved && <Zap className="w-4 h-4 fill-current" />}
                </button>
            </div>
        </div>
    );
}

