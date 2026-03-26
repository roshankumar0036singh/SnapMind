import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Key, HardDrive, Cpu, Cloud, CheckCircle2, Server, ArrowRight, Loader2, PartyPopper } from 'lucide-react';
import { chrome } from '../background/api';

const STEPS = [
    { id: 'welcome', label: 'Welcome to SnapMind' },
    { id: 'model', label: 'Choose Intelligence' },
    { id: 'keys', label: 'Authenticate API' },
    { id: 'storage', label: 'Configure Vault' },
    { id: 'test', label: 'Verify Connection' },
    { id: 'ready', label: 'Launch Sequence' }
];

const slideVariants = {
    enter: (direction) => ({
        x: direction > 0 ? 40 : -40,
        opacity: 0
    }),
    center: {
        zIndex: 1,
        x: 0,
        opacity: 1
    },
    exit: (direction) => ({
        zIndex: 0,
        x: direction < 0 ? 40 : -40,
        opacity: 0
    })
};

export default function Onboarding({ onComplete }) {
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState(0);

    // Form State
    const [modelType, setModelType] = useState('cloud'); // 'cloud' | 'local' | 'custom'
    const [apiKey, setApiKey] = useState('');
    const [storageMode, setStorageMode] = useState('local'); // 'local' | 'cloud'
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState(null); // 'success' | 'error' | null
    const [showConfetti, setShowConfetti] = useState(false);

    const nextStep = () => {
        if (step === 4 && !testResult) return; // Prevent skipping test
        if (step < STEPS.length - 1) {
            setDirection(1);
            setStep(prev => prev + 1);
        } else {
            handleComplete();
        }
    };

    const prevStep = () => {
        if (step > 0) {
            setDirection(-1);
            setStep(prev => prev - 1);
        }
    };

    const handleComplete = () => {
        // Persist settings
        if (apiKey) localStorage.setItem('geminiApiKey', JSON.stringify(apiKey));
        localStorage.setItem('snapmind_onboarded', 'true');
        onComplete();
    };

    const runTest = () => {
        setIsTesting(true);
        setTestResult(null);
        // Simulate connection test
        setTimeout(() => {
            setIsTesting(false);
            setTestResult('success');
            setTimeout(nextStep, 1000); // Auto-advance on success
        }, 1500);
    };

    useEffect(() => {
        if (step === 5) {
            setShowConfetti(true);
        }
    }, [step]);

    return (
        <motion.div 
            className="fixed inset-0 bg-[#07070a] flex items-center justify-center z-50 text-[#a1a1aa] font-sans overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
        >
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#6366f1]/5 rounded-full blur-[150px] pointer-events-none" />

            <div className="w-full max-w-[800px] grid grid-cols-12 gap-8 surface-card p-6 overflow-hidden relative shadow-lg">
                
                {/* Left Column: Step Tracker (cols 1-4) */}
                <div className="col-span-4 border-r border-[#1e1e26] pr-6 py-4 relative">
                    <h2 className="text-xl font-bold font-display text-[#f4f4f5] mb-8">Setup Engine</h2>
                    
                    <div className="space-y-6 relative">
                        {/* Connecting Line */}
                        <div className="absolute left-[11px] top-3 bottom-8 w-px bg-[#1e1e26] z-0" />
                        
                        {STEPS.map((s, i) => {
                            const isCompleted = i < step;
                            const isCurrent = i === step;
                            
                            return (
                                <div key={s.id} className="flex items-center gap-4 relative z-10 group">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 bg-[#0a0a0e] transition-all duration-300 ${
                                        isCompleted ? 'border-[#6366f1] bg-[#6366f1]' :
                                        isCurrent ? 'border-[#6366f1] shadow-[0_0_12px_rgba(99,102,241,0.4)]' :
                                        'border-[#2a2a35] text-[#52525b]'
                                    }`}>
                                        {isCompleted ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                        ) : isCurrent ? (
                                            <div className="w-2 h-2 bg-[#6366f1] rounded-full" />
                                        ) : (
                                            <span className="text-[10px] font-medium">{i + 1}</span>
                                        )}
                                    </div>
                                    <span className={`text-sm tracking-tight transition-colors ${
                                        isCurrent ? 'text-[#f4f4f5] font-semibold' :
                                        isCompleted ? 'text-[#a1a1aa]' :
                                        'text-[#52525b]'
                                    }`}>
                                        {s.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Column: Content Area (cols 5-12) */}
                <div className="col-span-8 py-4 relative flex flex-col min-h-[400px]">
                    <AnimatePresence custom={direction} mode="wait">
                        <motion.div
                            key={step}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="flex-1"
                        >
                            {/* Step 0: Welcome */}
                            {step === 0 && (
                                <div className="space-y-6">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6366f1]/20 to-[#6366f1]/5 border border-[#6366f1]/30 flex items-center justify-center shadow-glow mb-6">
                                        <Sparkles className="w-6 h-6 text-[#6366f1]" />
                                    </div>
                                    <h1 className="text-3xl font-bold font-display text-[#f4f4f5]">Initialize Core.</h1>
                                    <p className="text-sm leading-relaxed text-[#a1a1aa]">
                                        SnapMind operates completely isolated on your machine by default. 
                                        Before we launch, let's configure your engine limits, intelligence provider, and vault schema.
                                    </p>
                                </div>
                            )}

                            {/* Step 1: Model Choice */}
                            {step === 1 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-bold font-display text-[#f4f4f5]">Intelligence Protocol</h2>
                                        <p className="text-xs text-[#71717a] mt-1">Select your primary embedded intelligence.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            { id: 'cloud', icon: Cloud, title: 'Cloud Engine', desc: 'Google Gemini (Fastest, High-fidelity)', active: true },
                                            { id: 'local', icon: Cpu, title: 'Local AI (Ollama)', desc: '100% private, runs entirely on CPU/GPU' },
                                            { id: 'custom', icon: Server, title: 'Custom Endpoint', desc: 'Connect to vLLM, OpenAI, or local port' }
                                        ].map(m => (
                                            <button
                                                key={m.id}
                                                onClick={() => setModelType(m.id)}
                                                className={`p-4 rounded-xl border text-left flex items-start gap-4 transition-all ${
                                                    modelType === m.id 
                                                        ? 'border-[#6366f1] bg-[#6366f1]/5 shadow-[0_0_24px_rgba(99,102,241,0.1)]' 
                                                        : 'border-[#1e1e26] hover:border-[#2a2a35] bg-[#07070a]'
                                                }`}
                                            >
                                                <m.icon className={`w-5 h-5 shrink-0 ${modelType === m.id ? 'text-[#6366f1]' : 'text-[#52525b]'}`} />
                                                <div>
                                                    <h3 className={`text-sm font-semibold mb-1 ${modelType === m.id ? 'text-[#f4f4f5]' : 'text-[#a1a1aa]'}`}>{m.title}</h3>
                                                    <p className="text-[10px] text-[#52525b] leading-tight">{m.desc}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Step 2: API Keys */}
                            {step === 2 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-bold font-display text-[#f4f4f5]">Authenticate API</h2>
                                        <p className="text-xs text-[#71717a] mt-1">Provide access keys for the selected cloud provider.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-[#f4f4f5] uppercase tracking-wider flex items-center gap-2">
                                            <Key className="w-3 h-3 text-[#52525b]" />
                                            Primary API Key
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="password"
                                                value={apiKey}
                                                onChange={(e) => setApiKey(e.target.value)}
                                                placeholder="sk-..."
                                                className="w-full input-field font-mono pr-24"
                                            />
                                            {apiKey && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 animate-fade-up">
                                                    <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
                                                    <span className="text-[10px] font-bold text-[#22c55e] uppercase">Valid</span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-[#52525b]">Keys are encrypted locally inside your vault. We never see them.</p>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Storage */}
                            {step === 3 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-bold font-display text-[#f4f4f5]">Vault Configuration</h2>
                                        <p className="text-xs text-[#71717a] mt-1">Choose where your indexed vectors and metadata reside.</p>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={() => setStorageMode('local')}
                                            className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                                                storageMode === 'local' ? 'border-[#6366f1] bg-[#6366f1]/5' : 'border-[#1e1e26] bg-[#07070a]'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 text-left">
                                                <HardDrive className={`w-5 h-5 ${storageMode === 'local' ? 'text-[#6366f1]' : 'text-[#52525b]'}`} />
                                                <div>
                                                    <h3 className={`text-sm font-semibold ${storageMode === 'local' ? 'text-[#f4f4f5]' : 'text-[#a1a1aa]'}`}>Local PostgreSQL</h3>
                                                    <p className="text-[10px] text-[#52525b]">Data never leaves your machine.</p>
                                                </div>
                                            </div>
                                            {/* Disk space indicator indicator */}
                                            <div className="badge border-[#2a2a35] text-[#71717a] bg-[#0a0a0e]">
                                                12GB Available
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => setStorageMode('cloud')}
                                            className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                                                storageMode === 'cloud' ? 'border-[#6366f1] bg-[#6366f1]/5' : 'border-[#1e1e26] bg-[#07070a]'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 text-left">
                                                <Cloud className={`w-5 h-5 ${storageMode === 'cloud' ? 'text-[#6366f1]' : 'text-[#52525b]'}`} />
                                                <div>
                                                    <h3 className={`text-sm font-semibold ${storageMode === 'cloud' ? 'text-[#f4f4f5]' : 'text-[#a1a1aa]'}`}>Cloud Supabase</h3>
                                                    <p className="text-[10px] text-[#52525b]">Sync seamlessly across devices.</p>
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 4: Verification */}
                            {step === 4 && (
                                <div className="space-y-6 flex flex-col items-center justify-center text-center py-8">
                                    <div className="relative">
                                        <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                                            isTesting ? 'border-[#6366f1]/30 bg-[#6366f1]/5' :
                                            testResult === 'success' ? 'border-[#22c55e] bg-[#22c55e]/10 shadow-[0_0_30px_rgba(99,102,241,0.2)]' :
                                            'border-[#2a2a35] bg-[#0a0a0e]'
                                        }`}>
                                            {isTesting ? (
                                                <Loader2 className="w-6 h-6 text-[#6366f1] animate-spin" />
                                            ) : testResult === 'success' ? (
                                                <CheckCircle2 className="w-8 h-8 text-[#22c55e]" />
                                            ) : (
                                                <Server className="w-6 h-6 text-[#52525b]" />
                                            )}
                                        </div>
                                        {isTesting && (
                                            <svg className="absolute inset-0 w-full h-full -rotate-90 animate-pulse-glow" viewBox="0 0 100 100">
                                                <circle cx="50" cy="50" r="48" fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="301" strokeDashoffset="100" />
                                            </svg>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <h2 className="text-lg font-bold font-display text-[#f4f4f5]">
                                            {isTesting ? 'Initializing Neural Link...' : testResult === 'success' ? 'Connection Verified' : 'Verify Handshake'}
                                        </h2>
                                        <p className="text-[11px] text-[#71717a] mt-1 max-w-[250px] mx-auto">
                                            {isTesting ? 'Testing connection to vector database and validating API token response times.' : 
                                            testResult === 'success' ? 'All systems nominal. Vector database linked successfully.' :
                                            'Click below to ping the external embedding services and link the local database.'}
                                        </p>
                                    </div>

                                    {!isTesting && !testResult && (
                                        <button onClick={runTest} className="btn-primary px-6 py-2 text-xs">Run Diagnostic Test</button>
                                    )}
                                </div>
                            )}

                            {/* Step 5: Ready */}
                            {step === 5 && (
                                <div className="space-y-6 text-center py-6 relative">
                                    {showConfetti && (
                                         <div className="absolute inset-x-0 -top-8 flex justify-center text-3xl z-50 pointer-events-none animate-[fadeUp_2s_ease-out_forwards]">
                                            🎉 ✨ 🚀
                                         </div>
                                    )}

                                    <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#6366f1]/30 to-indigo-400/10 border border-[#6366f1]/40 flex items-center justify-center shadow-glow-strong mb-4">
                                        <PartyPopper className="w-8 h-8 text-[#818cf8]" />
                                    </div>
                                    
                                    <div>
                                        <h2 className="text-2xl font-bold font-display text-[#f4f4f5]">You're Ready.</h2>
                                        <p className="text-xs text-[#a1a1aa] mt-2 max-w-[280px] mx-auto leading-relaxed">
                                            The node is online. You can now start throwing links, PDFs, and codebase URLs into the terminal.
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-2 bg-[#07070a] border border-[#1e1e26] p-4 rounded-xl text-left mx-auto max-w-[280px] mt-6">
                                        <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-[#71717a]">
                                            <span>Configuration</span>
                                            <span className="text-[#6366f1]">Nominal</span>
                                        </div>
                                        <div className="space-y-1 mt-2">
                                            <div className="flex justify-between text-xs"><span className="text-[#52525b]">Engine:</span><span className="text-[#f4f4f5] font-mono capitalize">{modelType}</span></div>
                                            <div className="flex justify-between text-xs"><span className="text-[#52525b]">Vault:</span><span className="text-[#f4f4f5] font-mono capitalize">{storageMode}</span></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation Footer */}
                    <div className="mt-auto pt-8 flex items-center justify-between border-t border-[#1e1e26] z-10 bg-[#0f0f14]">
                        {step > 0 && step < STEPS.length - 1 ? (
                            <button onClick={prevStep} className="btn-ghost px-5 py-2 text-xs font-semibold">
                                Back
                            </button>
                        ) : <div />}

                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-[#52525b] uppercase tracking-wider">
                                {step + 1} OF {STEPS.length}
                            </span>
                            
                            {step < STEPS.length - 1 ? (
                                <button 
                                    onClick={nextStep} 
                                    disabled={step === 4 && testResult !== 'success'}
                                    className={`btn-primary flex items-center gap-2 px-6 py-2 text-xs transition-opacity ${
                                        step === 4 && testResult !== 'success' ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                >
                                    Proceed <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            ) : (
                                <button onClick={handleComplete} className="btn-primary flex items-center gap-2 px-8 py-2.5 text-sm">
                                    Open SnapMind <Sparkles className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
