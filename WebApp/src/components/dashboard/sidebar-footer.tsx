'use client';

import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';
import { createClient } from '@/utils/supabase/client';
import { LogOut, Moon, Settings, Sun, User as UserIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Profile = { name: string; email: string; avatar?: string | null };

export default function SidebarFooter({ isCollapsed }: { isCollapsed?: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  // next-themes resolves on the client only; render a stable icon until then.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      setProfile({
        name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Account',
        email: u.email ?? '',
        avatar: u.user_metadata?.avatar_url ?? null,
      });
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/signin');
    router.refresh();
  };

  const isDark = mounted && resolvedTheme === 'dark';
  const avatarNode = profile?.avatar ? (
    // Supabase avatars come from arbitrary provider hosts; a plain img avoids
    // having to whitelist each one in next.config remotePatterns.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
  ) : (
    <span className="text-[11px] font-semibold text-white">
      {initials(profile?.name ?? profile?.email)}
    </span>
  );

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 border-t border-gray-100 dark:border-white/10">
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          title={isDark ? 'Switch to light' : 'Switch to dark'}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <Link
          href="/settings"
          title="Settings"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition"
        >
          <Settings className="w-4 h-4" />
        </Link>
        <button
          onClick={signOut}
          title={`Sign out${profile?.email ? ` (${profile.email})` : ''}`}
          className="w-9 h-9 rounded-full dashboard-gradient flex items-center justify-center overflow-hidden"
        >
          {avatarNode}
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 pb-4 pt-3 border-t border-gray-100 dark:border-white/10" ref={ref}>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition focus-visible:outline-none focus-visible:shadow-ring"
        >
          <span className="w-9 h-9 shrink-0 rounded-full dashboard-gradient flex items-center justify-center overflow-hidden">
            {avatarNode}
          </span>
          <span className="flex-1 min-w-0 text-left">
            <span className="block text-sm font-medium text-gray-900 dark:text-white truncate">
              {profile?.name ?? 'Account'}
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
              {profile?.email ?? 'Not signed in'}
            </span>
          </span>
        </button>

        {open && (
          <div
            role="menu"
            className="absolute bottom-full mb-2 left-0 w-full rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-dark-primary shadow-theme-lg overflow-hidden py-1"
          >
            <button
              role="menuitem"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {isDark ? 'Light theme' : 'Dark theme'}
            </button>
            <Link
              role="menuitem"
              href="/settings"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
            <Link
              role="menuitem"
              href="/"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition"
            >
              <UserIcon className="w-4 h-4" />
              Back to site
            </Link>
            <button
              role="menuitem"
              onClick={signOut}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-error-600 dark:text-red-300 hover:bg-error-50 dark:hover:bg-error-500/10 transition border-t border-gray-100 dark:border-white/10"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
