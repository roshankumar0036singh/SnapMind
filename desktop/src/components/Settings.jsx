import { Save, Key, ArrowLeft, Database, Upload, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings({ onBack }) {
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [mistralApiKey, setMistralApiKey] = useState('');
    const [lingodevApiKey, setLingodevApiKey] = useState('');
    const [firecrawlApiKey, setFirecrawlApiKey] = useState('');
    const [groqApiKey, setGroqApiKey] = useState('');
    const [backendUrl, setBackendUrl] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        // Load existing keys
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
        <div className="h-full flex flex-col animate-in slide-in-from-right duration-300">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="p-1 -ml-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="font-bold text-gray-900">Settings</h2>
            </div>

            <div className="p-5 space-y-6">

                {/* API KEY */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <Key className="w-3.5 h-3.5" />
                        Gemini API Key
                    </label>
                    <input
                        type="password"
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all mb-1"
                    />
                    <p className="text-xs text-gray-400">
                        Used for embedding documents and search.
                    </p>
                </div>

                {/* MISTRAL API KEY */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <Key className="w-3.5 h-3.5" />
                        Mistral API Key
                    </label>
                    <input
                        type="password"
                        value={mistralApiKey}
                        onChange={(e) => setMistralApiKey(e.target.value)}
                        placeholder="Retrieve from console.mistral.ai..."
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all mb-1"
                    />
                    <p className="text-xs text-gray-400">
                        Primary model for chat generation and formatting.
                    </p>
                </div>

                {/* LINGODEV API KEY */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <Key className="w-3.5 h-3.5" />
                        Lingo.dev API Key
                    </label>
                    <input
                        type="password"
                        value={lingodevApiKey}
                        onChange={(e) => setLingodevApiKey(e.target.value)}
                        placeholder="Get from platform.lingo.dev..."
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all mb-1"
                    />
                    <p className="text-xs text-gray-400">
                        Multi-language ingestion formatting.
                    </p>
                </div>

                {/* GROQ API KEY */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <Key className="w-3.5 h-3.5" />
                        Groq API Key (Fallback Vision)
                    </label>
                    <input
                        type="password"
                        value={groqApiKey}
                        onChange={(e) => setGroqApiKey(e.target.value)}
                        placeholder="gsk_..."
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all mb-1"
                    />
                    <p className="text-xs text-gray-400">
                        Used as a fallback for Vision analysis (Llama 4 Scout).
                    </p>
                </div>

                {/* FIRECRAWL API KEY */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <Key className="w-3.5 h-3.5" />
                        Firecrawl API Key
                    </label>
                    <input
                        type="password"
                        value={firecrawlApiKey}
                        onChange={(e) => setFirecrawlApiKey(e.target.value)}
                        placeholder="fc-..."
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all mb-1"
                    />
                    <p className="text-xs text-gray-400">
                        Used for advanced web scraping and recursive crawls.
                    </p>
                </div>

                {/* BACKEND URL */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <Save className="w-3.5 h-3.5" />
                        Backend Server URL
                    </label>
                    <input
                        type="text"
                        value={backendUrl}
                        onChange={(e) => setBackendUrl(e.target.value)}
                        placeholder="https://roshan123478-snapmind-backend.hf.space"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all mb-1"
                    />
                    <p className="text-xs text-gray-400">
                        Point to your local or hosted Snapmind server.
                    </p>
                </div>


                {/* DATA MANAGEMENT */}
                <div className="pt-4 border-t border-gray-100 space-y-4">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <Database className="w-3.5 h-3.5" />
                        Data Portability
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={handleBackup}
                            className="flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-indigo-200 transition-all shadow-sm"
                        >
                            <Download className="w-4 h-4 text-indigo-500" />
                            Backup
                        </button>
                        <button
                            onClick={handleRestore}
                            className="flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-indigo-200 transition-all shadow-sm"
                        >
                            <Upload className="w-4 h-4 text-indigo-500" />
                            Restore
                        </button>
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        onClick={handleSave}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${saved
                            ? 'bg-emerald-500 text-white shadow-emerald-200'
                            : 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-200'
                            } shadow-lg`}
                    >
                        {saved ? 'Saved!' : 'Save Configuration'}
                        {!saved && <Save className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
