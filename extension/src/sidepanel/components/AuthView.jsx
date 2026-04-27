import React, { useState, useEffect } from 'react';
import { supabase } from '../../shared/supabaseClient';
import { Loader2, Bot, Github, ArrowRight, BrainCircuit } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthView({ onAuthSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [providerLoading, setProviderLoading] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleOAuthLogin = async (provider) => {
    setIsLoading(true);
    setProviderLoading(provider);
    try {
      // 1. Ask the SDK to generate the authorize URL (includes state + PKCE code_challenge)
      const redirectUrl = chrome.identity.getRedirectURL();
      console.log(`[AUTH] Extension redirect URL: ${redirectUrl}`);

      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (signInError) throw signInError;
      const authUrl = data.url;
      console.log(`[AUTH] Launching ${provider} PKCE flow. URL: ${authUrl}`);

      // 2. Launch the Chrome Identity popup
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        async (callbackUrl) => {
          // Handle popup errors
          if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message;
            console.warn("[AUTH] Identity popup error:", msg);

            // Fallback: open in a regular tab if the popup is blocked (Brave)
            if (msg.includes("could not be loaded") || msg.includes("blocked")) {
              chrome.tabs.create({ url: authUrl });
              toast.info("Opening login in a new tab...");
            } else {
              toast.error(`Auth popup failed: ${msg}`);
            }
            setIsLoading(false);
            setProviderLoading(null);
            return;
          }

          if (!callbackUrl) {
            console.error("[AUTH] No callback URL returned (user closed popup?)");
            setIsLoading(false);
            setProviderLoading(null);
            return;
          }

          console.log("[AUTH] Callback URL received:", callbackUrl.substring(0, 120) + "...");

          // 3. Parse the callback URL for tokens or code
          try {
            const url = new URL(callbackUrl);
            const hashParams = new URLSearchParams(url.hash.substring(1));
            const searchParams = url.searchParams;

            // Check for errors first
            const errorCode = hashParams.get("error") || searchParams.get("error");
            const errorDesc = hashParams.get("error_description") || searchParams.get("error_description");
            if (errorCode) {
              console.error(`[AUTH] Provider error: ${errorCode} — ${errorDesc}`);
              throw new Error(errorDesc || errorCode);
            }

            // Path A: PKCE — Supabase returns a `code` in the query string
            const code = searchParams.get("code");
            if (code) {
              console.log("[AUTH] Got authorization code, exchanging for session...");
              const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
              if (exchangeError) throw exchangeError;
              console.log("[AUTH] ✅ Session established via PKCE");
              if (onAuthSuccess) onAuthSuccess(data.session);
              return;
            }

            // Path B: Implicit — tokens arrive in the hash fragment
            const access_token = hashParams.get("access_token");
            const refresh_token = hashParams.get("refresh_token");
            if (access_token) {
              console.log("[AUTH] Got tokens from implicit flow, setting session...");
              const { data, error: sessionError } = await supabase.auth.setSession({
                access_token,
                refresh_token: refresh_token || "",
              });
              if (sessionError) throw sessionError;
              console.log("[AUTH] ✅ Session established via Implicit flow");
              if (onAuthSuccess) onAuthSuccess(data.session);
              return;
            }

            throw new Error("No code or tokens found in callback URL");
          } catch (err) {
            console.error("[AUTH] Callback processing failed:", err);
            toast.error(`Login failed: ${err.message}`);
          } finally {
            setIsLoading(false);
            setProviderLoading(null);
          }
        }
      );
    } catch (error) {
      console.error(`[AUTH] Setup error for ${provider}:`, error);
      toast.error(error.message || `Failed to start ${provider} login`);
      setIsLoading(false);
      setProviderLoading(null);
    }
  };

  return (
  <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-[#F8FAFC] selection:bg-indigo-500/20 overflow-hidden font-sans">

    {/* ── Background Layer ── */}
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">

      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage: 'radial-gradient(#CBD5E1 0.8px, transparent 0.8px)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* Ambient colour washes — subtle, offset from center */}
      <div className="absolute -top-[15%] right-[5%] w-[420px] h-[420px] bg-indigo-400/[0.12] rounded-full blur-[90px]" />
      <div className="absolute bottom-[0%] -left-[8%] w-[350px] h-[350px] bg-violet-400/[0.10] rounded-full blur-[70px]" />

      {/* Small decorative node constellation — top-right corner */}
      <svg className="absolute top-[8%] right-[6%] w-[140px] h-[140px] text-indigo-800 opacity-[0.06]" viewBox="0 0 100 100" fill="none">
        <circle cx="15" cy="30" r="2.5" fill="currentColor" />
        <circle cx="60" cy="15" r="3.5" fill="currentColor" />
        <circle cx="85" cy="55" r="2" fill="currentColor" />
        <circle cx="40" cy="75" r="3" fill="currentColor" />
        <line x1="15" y1="30" x2="60" y2="15" stroke="currentColor" strokeWidth="0.6" />
        <line x1="60" y1="15" x2="85" y2="55" stroke="currentColor" strokeWidth="0.6" />
        <line x1="15" y1="30" x2="40" y2="75" stroke="currentColor" strokeWidth="0.6" />
        <line x1="40" y1="75" x2="85" y2="55" stroke="currentColor" strokeWidth="0.6" />
        <line x1="60" y1="15" x2="40" y2="75" stroke="currentColor" strokeWidth="0.4" />
      </svg>

      {/* Small decorative shapes — bottom-left corner */}
      <svg className="absolute bottom-[10%] left-[5%] w-[120px] h-[120px] text-violet-800 opacity-[0.05]" viewBox="0 0 100 100" fill="none">
        <rect x="10" y="30" width="28" height="28" rx="6" stroke="currentColor" strokeWidth="1.2" transform="rotate(12 24 44)" />
        <circle cx="72" cy="38" r="18" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="45" cy="80" r="4" fill="currentColor" opacity="0.5" />
      </svg>
    </div>

    {/* ── Main Content ── */}
    <div className={`relative z-10 w-full max-w-[380px] px-6 flex flex-col items-center transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

      {/* Logo + Title */}
      <div className="flex flex-col items-center mb-7">
        <div className="relative group mb-4">
          <div className="relative w-14 h-14 bg-white border border-slate-200 rounded-[14px] flex items-center justify-center shadow-[0_4px_20px_rgb(0,0,0,0.06)] transition-transform duration-500 group-hover:scale-[1.04]">
            <div className="absolute inset-0 rounded-[14px] bg-gradient-to-br from-indigo-50/60 to-transparent" />
            <Bot className="w-7 h-7 text-indigo-600 stroke-[2] relative z-10" />
          </div>
          <div className="absolute -bottom-1.5 inset-x-3 h-3 bg-indigo-500/15 blur-lg rounded-full" />
        </div>

        <h1 className="text-[1.85rem] leading-none font-extrabold tracking-tight text-slate-900">
          SnapMind{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500">
            AI
          </span>
        </h1>
      </div>

      {/* ── Auth Card ── */}
      <div className="w-full bg-white/75 backdrop-blur-2xl rounded-[22px] px-7 py-8 shadow-[0_6px_32px_rgb(0,0,0,0.05)] border border-white/80 ring-1 ring-slate-900/[0.03] relative">

        {/* Top edge accent */}
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-indigo-500/25 to-transparent" />

        {/* Header */}
        <div className="mb-6 text-center">
          <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
            Welcome to Workspace
          </h2>
          <p className="text-[13.5px] font-medium text-slate-500 mt-1">
            Sign in to sync your neural graph
          </p>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          {/* Google */}
          <button
            onClick={() => handleOAuthLogin('google')}
            disabled={isLoading}
            className="group relative w-full flex items-center justify-center gap-2.5 h-[46px] px-5 rounded-xl text-[14.5px] font-semibold text-slate-700 bg-white border border-slate-200 shadow-[0_1px_3px_rgb(0,0,0,0.04)] hover:border-indigo-200 hover:shadow-[0_4px_12px_rgb(0,0,0,0.06)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-px active:translate-y-0"
          >
            {providerLoading === 'google' ? (
              <Loader2 className="w-[18px] h-[18px] animate-spin text-indigo-500" />
            ) : (
              <svg className="w-[18px] h-[18px] shrink-0 group-hover:scale-105 transition-transform duration-300" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            <span className="tracking-tight transition-transform duration-300 group-hover:-translate-x-0.5">Continue with Google</span>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-400 absolute right-4 opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
          </button>

          {/* GitHub */}
          <button
            onClick={() => handleOAuthLogin('github')}
            disabled={isLoading}
            className="group relative w-full flex items-center justify-center gap-2.5 h-[46px] px-5 rounded-xl text-[14.5px] font-semibold text-white bg-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.18)] hover:bg-[#1a1a2e] hover:shadow-[0_4px_16px_rgba(15,23,42,0.25)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-px active:translate-y-0"
          >
            {providerLoading === 'github' ? (
              <Loader2 className="w-[18px] h-[18px] animate-spin text-slate-400" />
            ) : (
              <Github className="w-[18px] h-[18px] shrink-0 group-hover:scale-105 transition-transform duration-300" />
            )}
            <span className="tracking-tight transition-transform duration-300 group-hover:-translate-x-0.5">Continue with GitHub</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500 absolute right-4 opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
          </button>
        </div>
      </div>

      {/* ── Tagline Pill ── */}
      <div className="mt-6 px-4 py-2.5 bg-white/50 backdrop-blur-md rounded-full border border-slate-200/50 shadow-[0_1px_4px_rgb(0,0,0,0.03)] flex items-center gap-2.5">
        <div className="p-1 bg-indigo-50 rounded-lg border border-indigo-100/60">
          <BrainCircuit className="w-3.5 h-3.5 text-indigo-600" />
        </div>
        <p className="text-[12.5px] font-medium text-slate-600 tracking-tight">
          Your neural knowledge graph,{' '}
          <span className="text-indigo-600 font-semibold">ready.</span>
        </p>
      </div>

      {/* ── Footer links ── */}
      <div className="mt-5 flex items-center gap-3 text-[11.5px] font-medium text-slate-400">
        <span className="hover:text-slate-600 transition-colors cursor-pointer">Terms of Service</span>
        <span className="w-1 h-1 bg-slate-300 rounded-full" />
        <span className="hover:text-slate-600 transition-colors cursor-pointer">Privacy Policy</span>
      </div>

    </div>
  </div>
);
}

