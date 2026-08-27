'use client';

import { getCurrentYear } from '@/lib/utils';
import { createClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SidebarWidget({ isCollapsed }: { isCollapsed?: boolean }) {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();
  }, [supabase.auth]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/signin');
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Guest';
  const email = user?.email || 'Sign in to sync';
  const initials = displayName.substring(0, 2).toUpperCase();

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-4 w-full border-t border-gray-800/50">
        <button 
          title="Profile / Sign Out"
          onClick={handleSignOut}
          className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm hover:bg-red-600 transition-colors"
        >
          {initials}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* <!-- User profile --> */}
      <div className="pt-5 pb-3 px-3 rounded-2xl widget-bg border border-gray-200 dark:border-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex-1 truncate flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
              {initials}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {displayName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {email}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5 space-y-2">
          <button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex gap-2 items-center justify-center text-xs font-semibold w-full px-6 py-2.5 transition-colors">
            Upgrade Plan
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M9.61054 2.0625L3.58887 10.5264H8.38943L8.38943 15.9375L14.4111 7.47361L9.61054 7.47361V2.0625Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {user && (
            <button 
              onClick={handleSignOut}
              className="rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white flex gap-2 items-center justify-center text-xs font-medium w-full px-6 py-2.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 px-3 text-center tracking-wide text-xs text-gray-500">
        &copy; {getCurrentYear()} SnapMind
      </div>
    </div>
  );
}
