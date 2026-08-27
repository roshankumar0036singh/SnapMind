'use client';

import { AutoGrowingTextArea } from '@/components/ui/inputs/textarea';
import { PencilIcon } from '@/icons/icons';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { User } from 'lucide-react';

type PropsType = {
  message: string;
  showActions?: boolean;
  onEdit: (
    newMessage: string,
    options?: { isSubmitting: boolean }
  ) => Promise<void>;
};

export default function UserMessage({
  message,
  showActions,
  onEdit,
}: PropsType) {
  const [showEditInput, setShowEditInput] = useState(false);
  const [value, setValue] = useState(message);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleCancel() {
    setShowEditInput(false);
    setValue(message);
  }

  async function handleEdit() {
    setIsSubmitting(true);

    try {
      await onEdit(value, { isSubmitting });
    } catch (error) {
      console.error('Error while editing message:', error);
    } finally {
      setIsSubmitting(false);
      setShowEditInput(false);
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto flex gap-4 group">
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-1">
        <User className="w-5 h-5 text-white" />
      </div>

      <div className="flex-1 overflow-hidden">
        <div
          className={cn(
            'text-gray-800 dark:text-gray-200 text-lg py-1.5',
            showEditInput && 'w-full'
          )}
        >
          {!showEditInput ? (
            <div className="whitespace-pre-wrap">{message}</div>
          ) : (
            <AutoGrowingTextArea
              onChange={(value) => setValue(value)}
              value={value}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleCancel();
                }
              }}
              autoFocus
              className="bg-transparent text-lg border border-gray-300 dark:border-gray-700 rounded-lg p-3"
            />
          )}
        </div>

        {showActions && !showEditInput && (
          <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              title="Edit message"
              onClick={() => setShowEditInput(true)}
              className="flex gap-1 items-center text-gray-500 hover:text-gray-900 dark:hover:text-white dark:text-gray-400 font-medium text-xs transition-colors"
            >
              <PencilIcon className="size-4" />
              <span>Edit</span>
            </button>
          </div>
        )}

        {showEditInput && (
          <div className="flex justify-start gap-2 mt-3">
            <button
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              onClick={handleEdit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
            <button
              className="px-4 py-2 text-sm font-medium bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg transition-colors disabled:opacity-50"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
