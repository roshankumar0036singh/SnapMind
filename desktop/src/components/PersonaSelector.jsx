import React, { useState, useEffect, useRef } from 'react';
import { User, Plus, X, Loader2, Sparkles, Trash2, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../background/api';
import { toast } from 'sonner';

export default function PersonaSelector({ selectedPersonaId, onSelectPersona }) {
  const [personas, setPersonas] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Create form state
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');

  const dropdownRef = useRef(null);

  useEffect(() => {
    loadPersonas();
    
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadPersonas = async () => {
    const data = await apiClient.getPersonas();
    setPersonas(data);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newPrompt.trim()) {
      toast.error('Name and prompt are required');
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await apiClient.createPersona(newName, newPrompt);
      if (res.success) {
        toast.success(`Persona "${newName}" created`);
        await loadPersonas();
        onSelectPersona(res.id);
        setIsCreating(false);
        setNewName('');
        setNewPrompt('');
        setIsOpen(false);
      } else {
        toast.error('Failed to create persona');
      }
    } catch (e) {
      toast.error('Failed to create persona');
    }
    setIsLoading(false);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      const res = await apiClient.deletePersona(id);
      if (res.success) {
        toast.success("Persona deleted");
        if (selectedPersonaId === id) onSelectPersona(null);
        await loadPersonas();
      }
    } catch (err) {
      toast.error("Failed to delete persona");
    }
  };

  const activePersona = personas.find(p => p.id === selectedPersonaId);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
          activePersona 
            ? 'bg-[#6366f1]/10 text-[#6366f1] border-[#6366f1]/30 hover:bg-[#6366f1]/20' 
            : 'bg-[#18181b] text-[#a1a1aa] border-[#27272a] hover:bg-[#27272a] hover:text-[#d4d4d8]'
        }`}
        title="Select AI Persona"
      >
        <User className="w-3.5 h-3.5" />
        {activePersona ? activePersona.name : "Default"}
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 w-64 bg-[#0f0f14] border border-[#27272a] rounded-xl shadow-2xl p-2 z-[60] animate-in fade-in slide-in-from-bottom-2 duration-200">
          {!isCreating ? (
            <div className="flex flex-col gap-1 max-h-60 overflow-y-auto custom-scrollbar">
              <div className="px-2 py-1.5 text-[10px] uppercase font-black tracking-wider text-[#71717a] flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#6366f1]" />
                Agent Personas
              </div>
              
              <button
                onClick={() => { onSelectPersona(null); setIsOpen(false); }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left transition-colors ${
                  !selectedPersonaId ? 'bg-[#6366f1]/10 text-[#6366f1]' : 'text-[#d4d4d8] hover:bg-[#18181b]'
                }`}
              >
                <span>Default Assistant</span>
                {!selectedPersonaId && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
              
              {personas.map(p => (
                <div key={p.id} className="group flex items-center relative rounded-lg hover:bg-[#18181b]">
                  <button
                    onClick={() => { onSelectPersona(p.id); setIsOpen(false); }}
                    className={`flex-1 flex items-center justify-between px-3 py-2 text-xs text-left transition-colors truncate rounded-lg ${
                      selectedPersonaId === p.id ? 'bg-[#6366f1]/10 text-[#6366f1]' : 'text-[#d4d4d8]'
                    }`}
                  >
                    <span className="truncate pr-4">{p.name}</span>
                    {selectedPersonaId === p.id && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                  <button 
                    onClick={(e) => handleDelete(e, p.id)}
                    className="absolute right-2 p-1 text-[#71717a] hover:text-[#ef4444] opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-[#ef4444]/10"
                    title="Delete Persona"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              
              <div className="h-px bg-[#27272a] my-1" />
              
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create New Persona
              </button>
            </div>
          ) : (
            <div className="p-2 flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-[#fafafa]">New Persona</span>
                <button onClick={() => setIsCreating(false)} className="text-[#a1a1aa] hover:text-white p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <input 
                type="text" 
                placeholder="Persona Name (e.g. Skeptical Critic)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#71717a] focus:outline-none focus:border-[#6366f1]/50 w-full"
                autoFocus
              />
              
              <textarea 
                placeholder="System Prompt Addon (e.g. 'You are extremely skeptical and always demand citations for every claim made. Provide highly critical analysis.')"
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                className="bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#71717a] focus:outline-none focus:border-[#6366f1]/50 h-24 resize-none w-full"
              />
              
              <button
                onClick={handleCreate}
                disabled={isLoading}
                className="w-full py-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Create Persona
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
