"use client";

import React from "react";
import Link from "next/link";
import { CodeGeneratorIcon } from "@/icons/icons";

export default function CtaSection() {
  return (
    <section className="py-20 lg:py-28 bg-white dark:bg-gray-900 px-5">
      <div className="max-w-[72rem] mx-auto">
        <div className="relative flex flex-col items-center justify-center text-center bg-primary-500 rounded-[20px] p-9 md:p-16 overflow-hidden">
          {/* Decorative shapes to match benefits-grid style */}
          <svg
            className="absolute left-0 top-0 opacity-20"
            width="200"
            height="200"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="0" cy="0" r="100" fill="currentColor" />
          </svg>
          <svg
            className="absolute right-0 bottom-0 opacity-20"
            width="200"
            height="200"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="200" cy="200" r="100" fill="currentColor" />
          </svg>

          <div className="relative z-10 max-w-2xl">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Build Your Second Brain Today
            </h2>
            <p className="text-white/80 text-lg mb-10">
              Stop losing track of your knowledge. Connect your repositories, videos, and PDFs 
              to SnapMind and start chatting with your personal knowledge graph.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/signup" 
                className="w-full sm:w-auto px-8 py-4 bg-white text-primary-500 rounded-xl font-bold transition-all shadow-lg hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                Get Started for Free
              </Link>
              <Link 
                href="/#architecture" 
                className="w-full sm:w-auto px-8 py-4 bg-transparent border border-white/30 hover:bg-white/10 text-white rounded-xl font-medium transition-all flex items-center justify-center"
              >
                See How It Works
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
