'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';

/**
 * `toggleSidebar` is optional: on desktop the rail stays open after starting a
 * new chat, and only the mobile drawer needs to close itself.
 */
export function NewChat({ toggleSidebar }: { toggleSidebar?: () => void }) {
  return (
    <Link
      href="/text-generator"
      onClick={toggleSidebar}
      className="button-bg flex w-full items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white shadow-theme-xs transition hover:opacity-90"
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
      New chat
    </Link>
  );
}

export default NewChat;
