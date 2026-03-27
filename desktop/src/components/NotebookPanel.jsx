import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, Sparkles, Loader2, Save, Trash2, Plus, FileText, Zap, X } from 'lucide-react';
import { apiClient } from '../background/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'snapmind_notebook_notes';
const STORAGE_ACTIVE_KEY = 'snapmind_notebook_active';

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return [{ id: Date.now(), title: 'Research Note #1', content: '', createdAt: Date.now() }];
}

export default function NotebookPanel({ sessionId }) {
  const [notes, setNotes] = useState(loadNotes);
  const [activeNoteId, setActiveNoteId] = useState(() => {
    const saved = localStorage.getItem(STORAGE_ACTIVE_KEY);
    return saved ? parseInt(saved) : loadNotes()[0]?.id;
  });
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotation, setAnnotation] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const saveTimerRef = useRef(null);

  const activeNote = notes.find(n => n.id === activeNoteId);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [notes]);

  useEffect(() => {
    if (activeNoteId) localStorage.setItem(STORAGE_ACTIVE_KEY, String(activeNoteId));
  }, [activeNoteId]);

  const updateContent = useCallback((content) => {
    setNotes(prev => prev.map(n => n.id === activeNoteId ? { ...n, content } : n));
  }, [activeNoteId]);

  const updateTitle = useCallback((title) => {
    setNotes(prev => prev.map(n => n.id === activeNoteId ? { ...n, title } : n));
  }, [activeNoteId]);

  const createNote = () => {
    const id = Date.now();
    setNotes(prev => [{ id, title: `Research Note #${prev.length + 1}`, content: '', createdAt: id }, ...prev]);
    setActiveNoteId(id);
    setAnnotation('');
  };

  const deleteNote = (id) => {
    const updated = notes.filter(n => n.id !== id);
    const rest = updated.length > 0 ? updated : [{ id: Date.now(), title: 'Research Note #1', content: '', createdAt: Date.now() }];
    setNotes(rest);
    if (activeNoteId === id) setActiveNoteId(rest[0]?.id);
    toast.success('Note deleted');
  };

  const handleTextSelect = () => {
    const sel = window.getSelection()?.toString().trim();
    if (sel && sel.length > 5) setSelectedText(sel);
    else if (!sel) setSelectedText('');
  };

  const handleAnnotate = async () => {
    const textToAnnotate = selectedText || activeNote?.content?.substring(0, 1500);
    if (!textToAnnotate?.trim()) {
      toast.error('Write some content or select text to annotate');
      return;
    }
    setIsAnnotating(true);
    setAnnotation('');
    try {
      const blocks = [{ id: 'nb-annotation-0', text: textToAnnotate, url: 'notebook' }];
      const prompt = `Analyze and annotate this research note. Provide:\n1. Key insights and claims\n2. Potential blind spots or assumptions\n3. Connections to broader topics\n4. Suggested follow-up research questions\n\nNote Content:\n"""${textToAnnotate}"""`;
      let fullAnnotation = '';
      await apiClient.streamQueryRag(
        blocks, prompt,
        (token) => { fullAnnotation += token; setAnnotation(fullAnnotation); },
        () => {}, null, sessionId, null, null, 'auto', false
      );
    } catch (e) {
      toast.error('AI annotation failed');
    }
    setIsAnnotating(false);
    setSelectedText('');
  };

  if (!activeNote) return null;

  const wordCount = activeNote.content ? activeNote.content.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="flex-1 flex overflow-hidden h-full bg-[#09090b]">

      {/* ── Sidebar ── */}
      <aside className="w-52 bg-[#07070a] border-r border-[#1e1e26] flex flex-col shrink-0">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#6366f1]/10 border border-[#6366f1]/20 flex items-center justify-center">
              <BookOpen className="w-3 h-3 text-[#6366f1]" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#71717a]">Notes</span>
          </div>
          <button
            onClick={createNote}
            className="w-6 h-6 rounded-lg bg-[#111113] border border-[#1e1e26] flex items-center justify-center text-[#71717a] hover:text-[#6366f1] hover:border-[#6366f1]/30 transition-all"
            title="New Note"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-1 custom-scrollbar">
          {notes.map(note => (
            <div key={note.id} className="group relative">
              <button
                onClick={() => { setActiveNoteId(note.id); setAnnotation(''); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${
                  activeNoteId === note.id
                    ? 'bg-[#6366f1]/10 border border-[#6366f1]/20 text-[#6366f1]'
                    : 'hover:bg-[#111113] text-[#71717a] hover:text-[#d4d4d8] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-3 h-3 shrink-0" />
                  <p className="text-[11px] font-bold truncate pr-4">{note.title || 'Untitled'}</p>
                </div>
                <p className="text-[9px] text-[#3f3f46] truncate pl-5 font-mono">
                  {note.content ? note.content.substring(0, 30) + '…' : 'empty'}
                </p>
              </button>

              {notes.length > 1 && (
                <button
                  onClick={() => deleteNote(note.id)}
                  className="absolute right-2 top-2 p-1 text-[#3f3f46] hover:text-[#ef4444] opacity-0 group-hover:opacity-100 rounded-md hover:bg-[#ef4444]/10 transition-all"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Metadata strip */}
        <div className="p-3 border-t border-[#1e1e26]">
          <p className="text-[9px] font-mono text-[#3f3f46] text-center uppercase tracking-widest">
            {notes.length} note{notes.length !== 1 ? 's' : ''} · auto-saved
          </p>
        </div>
      </aside>

      {/* ── Main Editor ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-8 py-3 border-b border-[#1e1e26] bg-[#0a0a0f]">
          <input
            type="text"
            value={activeNote.title}
            onChange={(e) => updateTitle(e.target.value)}
            placeholder="Note title..."
            className="flex-1 bg-transparent text-sm font-bold text-[#fafafa] focus:outline-none placeholder:text-[#3f3f46] tracking-tight"
          />
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-[9px] font-mono text-[#3f3f46] uppercase tracking-widest">
              {wordCount} words
            </span>
            <button
              onClick={handleAnnotate}
              disabled={isAnnotating}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#6366f1]/10 border border-[#6366f1]/25 rounded-lg text-[10px] font-black text-[#6366f1] uppercase tracking-widest hover:bg-[#6366f1]/20 transition-all disabled:opacity-50"
            >
              {isAnnotating
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Sparkles className="w-3 h-3" />}
              {selectedText ? 'Annotate Selection' : 'Annotate Note'}
            </button>
          </div>
        </div>

        {/* Selected text indicator */}
        <AnimatePresence>
          {selectedText && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="px-8 py-2 bg-[#6366f1]/5 border-b border-[#6366f1]/10 flex items-center justify-between"
            >
              <p className="text-[10px] text-[#6366f1] font-medium truncate max-w-lg">
                <span className="opacity-60 mr-2">Selected:</span>
                <span className="italic">"{selectedText.substring(0, 80)}{selectedText.length > 80 ? '...' : ''}"</span>
              </p>
              <button onClick={() => setSelectedText('')} className="text-[#6366f1]/50 hover:text-[#6366f1] p-0.5 ml-4">
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Split pane: editor + annotation */}
        <div className="flex-1 flex overflow-hidden">

          {/* Editor */}
          <textarea
            value={activeNote.content}
            onChange={(e) => updateContent(e.target.value)}
            onMouseUp={handleTextSelect}
            onKeyUp={handleTextSelect}
            placeholder={"Start writing your research notes in Markdown...\n\nEvery keystroke is saved locally.\n\nTip: Select any text and click 'Annotate Selection' to get AI insights drawn from your knowledge base."}
            className="flex-1 bg-transparent text-[13px] text-[#d4d4d8] leading-relaxed px-8 py-6 focus:outline-none resize-none font-mono placeholder:text-[#2a2a35] custom-scrollbar"
            spellCheck={false}
          />

          {/* Annotation Panel */}
          <AnimatePresence>
            {(annotation || isAnnotating) && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 340, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="border-l border-[#1e1e26] bg-[#07070a] flex flex-col overflow-hidden shrink-0"
              >
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e1e26]">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#6366f1] animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#6366f1]">AI Annotations</span>
                  </div>
                  <button onClick={() => setAnnotation('')} className="p-1 text-[#3f3f46] hover:text-[#a1a1aa] rounded transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
                  {isAnnotating && !annotation && (
                    <div className="flex items-center gap-3 text-[#71717a]">
                      <Loader2 className="w-4 h-4 animate-spin text-[#6366f1]" />
                      <span className="text-xs font-medium">Analyzing with knowledge base...</span>
                    </div>
                  )}
                  <p className="text-[12px] text-[#c4c4cc] leading-relaxed whitespace-pre-wrap font-light">
                    {annotation}
                    {isAnnotating && <span className="inline-block w-1 h-4 bg-[#6366f1] animate-pulse ml-0.5 align-bottom rounded-sm" />}
                  </p>
                </div>

                {!isAnnotating && annotation && (
                  <div className="p-4 border-t border-[#1e1e26] flex gap-2">
                    <button
                      onClick={() => {
                        updateContent((activeNote.content || '') + '\n\n---\n### AI Annotation\n' + annotation);
                        setAnnotation('');
                        toast.success('Annotation appended to note');
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#6366f1]/10 border border-[#6366f1]/20 rounded-xl text-[10px] font-black text-[#6366f1] uppercase tracking-widest hover:bg-[#6366f1]/20 transition-all"
                    >
                      <Save className="w-3 h-3" /> Append to Note
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status bar */}
        <div className="px-8 py-2 border-t border-[#1e1e26] bg-[#07070a] flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-[#6366f1]" />
            <span className="text-[9px] font-black uppercase tracking-widest text-[#3f3f46]">Auto-Saved · localStorage</span>
          </div>
          <div className="h-3 w-px bg-[#1e1e26]" />
          <span className="text-[9px] font-mono text-[#3f3f46]">
            {activeNote.content?.length || 0} chars · {wordCount} words
          </span>
        </div>
      </div>
    </div>
  );
}
