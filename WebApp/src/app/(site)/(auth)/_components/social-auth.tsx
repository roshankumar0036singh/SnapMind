'use client';

import { GithubIcon, GoogleIcon } from '@/icons/icons';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

export function SignInWithGoogle({ label = 'Sign in with Google' }: { label?: string }) {
  const supabase = createClient();

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) {
      toast.error(error.message);
    }
  };

  return (
    <button 
      onClick={handleSignIn}
      className="bg-gray-100 text-left w-full justify-center dark:hover:bg-white/10 dark:hover:text-white/90 dark:bg-white/5 transition dark:text-gray-400 font-normal text-sm hover:bg-gray-200 rounded-full text-gray-700 hover:text-gray-800 flex items-center gap-3 px-4 sm:px-8 py-2.5 min-h-12"
    >
      <GoogleIcon className="shrink-0" />
      <span>{label}</span>
    </button>
  );
}

export function SignInWithGithub({ label = 'Sign in with Github' }: { label?: string }) {
  const supabase = createClient();

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) {
      toast.error(error.message);
    }
  };

  return (
    <button 
      onClick={handleSignIn}
      className="bg-gray-100 w-full justify-center dark:hover:bg-white/10 dark:hover:text-white/90 dark:bg-white/5 transition dark:text-gray-400 font-normal text-sm hover:bg-gray-200 rounded-full text-gray-700 hover:text-gray-800 flex items-center gap-3 px-4 sm:px-8 py-2.5 text-left min-h-12"
    >
      <GithubIcon className="size-6 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
