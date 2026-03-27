import React, { useState, useRef, useEffect } from 'react';
import { Globe, CheckCircle2 } from 'lucide-react';

const LANGUAGES = [
  { value: 'auto', label: 'Auto-Detect' },
  { value: 'en', label: 'English (US)' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'hi', label: 'Hindi' },
];

export default function LanguageSelector({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeLang = LANGUAGES.find(l => l.value === value) || LANGUAGES[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#18181b] border border-[#27272a] rounded-lg text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider hover:bg-[#27272a] hover:text-[#d4d4d8] transition-all"
      >
        <Globe className="w-3.5 h-3.5 text-[#71717a]" />
        {activeLang.label}
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 w-48 bg-[#0f0f14] border border-[#27272a] rounded-xl shadow-2xl p-2 z-[70] animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex flex-col gap-1">
            <div className="px-2 py-1 text-[9px] uppercase font-black tracking-widest text-[#3f3f46]">Output Language</div>
            {LANGUAGES.map(lang => (
              <button
                key={lang.value}
                onClick={() => { onChange(lang.value); setIsOpen(false); }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-bold text-left transition-colors ${
                  value === lang.value ? 'bg-[#6366f1]/10 text-[#6366f1]' : 'text-[#a1a1aa] hover:bg-[#18181b] hover:text-[#fafafa]'
                }`}
              >
                <span className="uppercase tracking-widest">{lang.label}</span>
                {value === lang.value && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
