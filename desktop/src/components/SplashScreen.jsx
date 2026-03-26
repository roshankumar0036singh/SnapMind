import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const STATUS_MESSAGES = [
    "Initializing engine...",
    "Loading embedding models...",
    "Connecting to vector store...",
    "Ready"
];

// Simple particle background
const Particles = () => {
    // Generate static particles array so they don't jump on re-render
    const [particles] = useState(() => Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 4 + 4,
        delay: Math.random() * 2
    })));

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
            {particles.map(p => (
                <motion.div
                    key={p.id}
                    className="absolute rounded-full bg-indigo-500/20"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        width: p.size,
                        height: p.size
                    }}
                    animate={{
                        y: ["0%", "-50%", "0%"],
                        opacity: [0.1, 0.5, 0.1]
                    }}
                    transition={{
                        duration: p.duration,
                        repeat: Infinity,
                        ease: "linear",
                        delay: p.delay
                    }}
                />
            ))}
        </div>
    );
};

export default function SplashScreen({ onComplete }) {
    const [statusIndex, setStatusIndex] = useState(0);

    useEffect(() => {
        // Cycle through status messages
        const timings = [600, 1200, 1800]; // when to trigger next message
        const timeouts = timings.map((time, i) => 
            setTimeout(() => setStatusIndex(i + 1), time)
        );

        // Notify complete after the full sequence (2.5s)
        const finishTimeout = setTimeout(() => {
            onComplete();
        }, 2500);

        return () => {
            timeouts.forEach(clearTimeout);
            clearTimeout(finishTimeout);
        };
    }, [onComplete]);

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#07070a] overflow-hidden"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
            >
                {/* Radial Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#6366f1]/10 rounded-full blur-[120px] pointer-events-none" />
                
                <Particles />

                <div className="relative flex flex-col items-center justify-center z-10 w-full max-w-sm">
                    {/* Logo Mark */}
                    <motion.div
                        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366f1]/20 to-[#6366f1]/5 border border-[#6366f1]/30 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.2)]"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
                    >
                        {/* Inner glowing pulse */}
                        <motion.div 
                            className="absolute inset-0 rounded-2xl bg-[#6366f1]/0"
                            animate={{ boxShadow: ["0 0 0 0px rgba(99,102,241,0.4)", "0 0 0 12px rgba(99,102,241,0)"] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                        />
                        <Sparkles className="w-8 h-8 text-[#6366f1]" />
                    </motion.div>

                    {/* Wordmark */}
                    <motion.h1
                        className="mt-6 text-3xl font-bold font-display tracking-tight text-[#f4f4f5]"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                        SnapMind
                    </motion.h1>

                    {/* Tagline */}
                    <motion.p
                        className="mt-2 text-sm text-[#a1a1aa] font-medium"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4, delay: 0.4 }}
                    >
                        Ingest anything. Know everything.
                    </motion.p>
                </div>

                {/* Bottom Progress Bar + Status */}
                <div className="absolute bottom-16 left-0 right-0 flex flex-col items-center">
                    <motion.div 
                        className="font-mono text-[10px] text-[#52525b] uppercase tracking-wider mb-4"
                        key={statusIndex}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                    >
                        {STATUS_MESSAGES[statusIndex]}
                    </motion.div>

                    <div className="w-64 h-[2px] bg-[#1e1e26] rounded-full overflow-hidden relative">
                        {/* Shimmer sweep */}
                        <motion.div
                            className="absolute top-0 bottom-0 left-0 bg-[#6366f1]"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 1.8, ease: "easeInOut", delay: 0.4 }}
                        />
                        <motion.div
                            className="absolute top-0 bottom-0 left-0 w-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
                            initial={{ x: "-100%" }}
                            animate={{ x: "100%" }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear", delay: 0.5 }}
                        />
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
