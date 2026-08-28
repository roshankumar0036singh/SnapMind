'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { toast } from 'sonner';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateWorkspaceModal({ isOpen, onClose }: CreateWorkspaceModalProps) {
  const { createWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      // The context creates it, inserts it into the list and switches to it, so
      // there is no refetch here and no window where the switcher shows stale
      // names. `description` is stored in the workspace's write-once metadata —
      // there is no update route, so neither field can be edited later.
      const created = await createWorkspace(name, description);
      toast.success(`${created.name} is ready and now active`);
      onClose();
      setName('');
      setDescription('');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'An error occurred while creating the workspace',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-white dark:bg-dark-primary rounded-3xl shadow-theme-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-white/10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Workspace</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Workspace Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Marketing Project"
              className="w-full px-4 py-2.5 bg-white dark:bg-dark-secondary border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-gray-900 dark:text-white transition-all"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this workspace..."
              rows={3}
              className="w-full px-4 py-2.5 bg-white dark:bg-dark-secondary border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-gray-900 dark:text-white resize-none transition-all"
            />
          </div>

          <p className="rounded-2xl bg-gray-50 px-4 py-3 text-[12px] leading-relaxed text-gray-500 dark:bg-white/5 dark:text-gray-400">
            Neither field can be changed later — the backend supports creating, reading and deleting
            a workspace, but not updating one.
          </p>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-full transition-colors disabled:opacity-50 flex items-center justify-center min-w-[120px]"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
