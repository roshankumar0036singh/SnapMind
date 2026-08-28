"use client";

import React from "react";
import { 
  CodeGeneratorIcon, 
  TextGeneratorIcon, 
  ImageGeneratorIcon,
  CheckMarkIcon2,
  GithubIcon,
  VideoGeneratorIcon,
  AttachmentIcon,
  SettingsIcon
} from "@/icons/icons";

export default function UseCasesSection() {
  return (
    <section className="py-20 lg:py-32 bg-[#F8FAFC] dark:bg-[#06080C] px-5 relative overflow-hidden">
      
      {/* Background Mesh/Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      
      <div className="max-w-[72rem] mx-auto relative z-10">
        <div className="mb-20 text-center">
          <h2 className="mb-3 font-extrabold text-gray-900 text-3xl dark:text-white md:text-5xl max-w-xl mx-auto tracking-tight">
            Built for Your Workflow
          </h2>
          <p className="max-w-xl mx-auto text-lg leading-relaxed text-gray-600 dark:text-gray-400">
            SnapMind adapts to your specific needs, whether you are analyzing complex codebases, organizing academic research, or studying for exams.
          </p>
        </div>

        <div className="space-y-32">
          
          {/* Use Case 1: Developers (Mock UI Right) */}
          <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-sm font-bold shadow-[0_0_10px_rgba(59,130,246,0.1)]">
                <CodeGeneratorIcon className="w-4 h-4" /> For Developers
              </div>
              <h3 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Master Complex Codebases
              </h3>
              <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                Stop getting lost in thousands of files. SnapMind ingests entire GitHub repositories and builds a semantic understanding of your architecture, tracking functions and dependencies.
              </p>
              <ul className="space-y-4 pt-2">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckMarkIcon2 className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Ask architectural questions and get exact file citations.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckMarkIcon2 className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Onboard new engineers in minutes instead of weeks.</span>
                </li>
              </ul>
            </div>
            
            <div className="flex-1 w-full relative">
              {/* Decorative Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px]"></div>
              
              {/* Mock IDE UI */}
              <div className="relative rounded-2xl bg-[#0d1117] border border-gray-700/50 shadow-2xl overflow-hidden md:h-[400px] flex flex-col transform transition hover:scale-[1.02] duration-500 z-0">
                {/* IDE Header */}
                <div className="h-10 bg-[#161b22] border-b border-gray-700/50 flex items-center px-4 gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  </div>
                  <div className="mx-auto flex items-center gap-2 bg-[#0d1117] px-3 py-1 rounded-md text-xs text-gray-400 border border-gray-700/50">
                    <GithubIcon className="w-3 h-3" /> facebook / react
                  </div>
                </div>
                {/* IDE Body */}
                <div className="flex-1 p-6 font-mono text-sm overflow-hidden relative">
                  <div className="text-purple-400">import <span className="text-blue-300">{`{`}</span> <span className="text-gray-300">GraphRAG, CodeParser</span> <span className="text-blue-300">{`}`}</span> from <span className="text-green-400">'snapmind-sdk'</span>;</div>
                  <div className="mt-4 text-gray-500">// Initialize repository analysis</div>
                  <div className="text-purple-400">const <span className="text-blue-300">analyzer</span> = <span className="text-purple-400">await</span> GraphRAG.<span className="text-yellow-200">analyzeRepo</span>(</div>
                  <div className="ml-4 text-green-400">'https://github.com/facebook/react'</div>
                  <div className="text-gray-300">);</div>
                  <div className="mt-4 text-gray-500">// Find circular dependencies in core</div>
                  <div className="text-purple-400">const <span className="text-blue-300">issues</span> = <span className="text-blue-300">analyzer</span>.<span className="text-yellow-200">query</span>(</div>
                  <div className="ml-4 text-green-400">'Find all circular dependencies in the fiber reconciler'</div>
                  <div className="text-gray-300">);</div>
                  
                  {/* Floating AI Panel */}
                  <div className="absolute bottom-6 right-6 left-6 bg-[#161b22]/90 backdrop-blur-md border border-blue-500/30 rounded-xl p-4 shadow-xl z-10">
                    <div className="flex items-center gap-2 mb-2 text-blue-400 font-sans text-xs font-bold uppercase tracking-wider">
                      <CodeGeneratorIcon className="w-4 h-4" /> AI Analysis Complete
                    </div>
                    <p className="font-sans text-sm text-gray-300 leading-snug">
                      Found <span className="text-white font-bold">3 potential dependency cycles</span> in <code className="text-blue-300 bg-blue-500/10 px-1 rounded">ReactFiberWorkLoop.js</code>. Click to view the interactive graph.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Use Case 2: Researchers (Mock UI Left) */}
          <div className="flex flex-col md:flex-row-reverse items-center gap-12 lg:gap-20">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-sm font-bold shadow-[0_0_10px_rgba(168,85,247,0.1)]">
                <ImageGeneratorIcon className="w-4 h-4" /> For Researchers
              </div>
              <h3 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Visualize Academic Connections
              </h3>
              <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                Upload hundreds of PDFs and papers. SnapMind's Vision and GraphRAG engine automatically map authors, methodologies, and findings into a searchable network.
              </p>
              <ul className="space-y-4 pt-2">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckMarkIcon2 className="w-4 h-4 text-purple-500" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Extract actionable data from complex charts and diagrams.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckMarkIcon2 className="w-4 h-4 text-purple-500" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Generate fully formatted academic reports with inline citations.</span>
                </li>
              </ul>
            </div>
            
            <div className="flex-1 w-full relative">
               {/* Decorative Glow */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/20 rounded-full blur-[80px]"></div>
               
               {/* Mock Graph UI */}
               <div className="relative rounded-2xl bg-[#0d1117] border border-gray-700/50 shadow-2xl overflow-hidden h-[300px] md:h-[400px] flex items-center justify-center transform transition hover:scale-[1.02] duration-500 z-0 w-full">
                  {/* Graph Canvas */}
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-500 to-transparent"></div>
                  
                  {/* Constrained Node Area (Takes full width on mobile, avoids sidebar on desktop) */}
                  <div className="absolute inset-y-0 left-0 right-0 md:right-[14rem] p-2 md:p-4 overflow-hidden flex items-center justify-center">
                    {/* SVG Connections */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                      <path d="M 15 15 L 50 50 L 85 35" fill="none" stroke="currentColor" className="text-purple-500/40" strokeWidth="2" strokeDasharray="4 4" />
                      <path d="M 50 50 L 75 85" fill="none" stroke="currentColor" className="text-purple-500/40" strokeWidth="2" strokeDasharray="4 4" />
                      <path d="M 20 70 L 50 50" fill="none" stroke="currentColor" className="text-purple-500/40" strokeWidth="2" strokeDasharray="4 4" />
                    </svg>

                    {/* Node 1 */}
                    <div className="absolute top-[10%] left-[5%] bg-gray-800 border border-purple-500/50 shadow-lg px-2 py-1 md:px-3 md:py-1.5 rounded-lg flex items-center gap-2 animate-pulse z-10 max-w-[120px] md:max-w-none">
                      <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></div>
                      <span className="text-[10px] md:text-xs font-bold text-white truncate">Attention Is All You Need</span>
                    </div>

                    {/* Node 2 */}
                    <div className="absolute top-[30%] right-[5%] bg-gray-800 border border-gray-600 shadow-lg px-2 py-1 md:px-3 md:py-1.5 rounded-lg flex items-center gap-2 z-10">
                      <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                      <span className="text-[10px] md:text-xs font-medium text-gray-300">Vaswani et al.</span>
                    </div>

                    {/* Center Main Node */}
                    <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 bg-purple-500 text-white shadow-purple-500/40 shadow-2xl px-3 py-1.5 md:px-4 md:py-2 rounded-xl flex items-center gap-2 scale-100 sm:scale-110 z-10 border border-purple-400">
                      <div className="w-3 h-3 rounded-full bg-white animate-pulse shrink-0"></div>
                      <span className="text-[11px] md:text-sm font-bold whitespace-nowrap">Transformer</span>
                    </div>

                    {/* Node 3 */}
                    <div className="absolute bottom-[5%] right-[25%] bg-gray-800 border border-gray-600 shadow-lg px-2 py-1 md:px-3 md:py-1.5 rounded-lg flex items-center gap-2 z-10">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
                      <span className="text-[10px] md:text-xs font-medium text-gray-300">Self-Attention</span>
                    </div>

                    {/* Node 4 */}
                    <div className="absolute bottom-[25%] left-[10%] bg-gray-800 border border-gray-600 shadow-lg px-2 py-1 md:px-3 md:py-1.5 rounded-lg flex items-center gap-2 z-10">
                      <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></div>
                      <span className="text-[10px] md:text-xs font-medium text-gray-300">Multi-Head</span>
                    </div>
                  </div>

                  {/* Graph Sidebar Overlay (Hidden on very small screens, responsive width on tablet) */}
                  <div className="hidden md:flex absolute top-4 right-4 bottom-4 w-48 lg:w-52 bg-gray-900/90 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4 shadow-2xl flex-col gap-3 z-20">
                    <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                      Node Details <SettingsIcon className="w-3 h-3 opacity-50 shrink-0" />
                    </div>
                    <h4 className="text-sm font-bold text-white leading-tight">Transformer Architecture</h4>
                    <p className="text-[11px] text-gray-400 leading-relaxed">Deep learning architecture introduced in 2017 replacing RNNs with self-attention mechanisms.</p>
                    <div className="mt-auto space-y-2">
                      <div className="w-full h-[1px] bg-gray-700/50"></div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-400">References</span>
                        <span className="font-bold text-white">4</span>
                      </div>
                      <div className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-1.5 rounded text-center border border-purple-500/20 cursor-pointer hover:bg-purple-500/20 transition">
                        View Sub-Graph
                      </div>
                    </div>
                  </div>
               </div>
            </div>
          </div>

          {/* Use Case 3: Students & Creators (Mock UI Right) */}
          <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-sm font-bold shadow-[0_0_10px_rgba(249,115,22,0.1)]">
                <TextGeneratorIcon className="w-4 h-4" /> For Students & Creators
              </div>
              <h3 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Turn Lectures into Notes
              </h3>
              <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                Feed SnapMind long YouTube lectures and web articles. Chat directly with the transcripts to extract summaries and key study points instantly.
              </p>
              <ul className="space-y-4 pt-2">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckMarkIcon2 className="w-4 h-4 text-orange-500" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Bypass long video watch times with instant transcript parsing.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckMarkIcon2 className="w-4 h-4 text-orange-500" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Save important snippets as semantic bookmarks.</span>
                </li>
              </ul>
            </div>
            
            <div className="flex-1 w-full relative">
               {/* Decorative Glow */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-500/20 rounded-full blur-[80px]"></div>
               
               {/* Mock Video/Chat UI */}
               <div className="relative rounded-2xl bg-[#0d1117] border border-gray-700/50 shadow-2xl overflow-hidden md:h-[400px] flex flex-col transform transition hover:scale-[1.02] duration-500 z-0">
                  
                  {/* Mock Video Player Top */}
                  <div className="h-44 bg-black relative group flex-shrink-0 border-b border-gray-800">
                    {/* Thumbnail Image/Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center opacity-80">
                       <svg className="w-24 h-24 text-white/5 opacity-50" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                    </div>
                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg transform transition group-hover:scale-110 group-hover:bg-red-500 cursor-pointer">
                        <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                    </div>
                    {/* Video Header */}
                    <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start">
                      <div className="text-white text-sm font-bold flex items-center gap-2 drop-shadow-md">
                        <VideoGeneratorIcon className="w-4 h-4 text-red-500" /> Advanced Calculus Lecture 4
                      </div>
                      <div className="flex gap-2">
                        <div className="w-2 h-2 rounded-full bg-white/50"></div>
                        <div className="w-2 h-2 rounded-full bg-white/50"></div>
                        <div className="w-2 h-2 rounded-full bg-white/50"></div>
                      </div>
                    </div>
                    {/* Progress Bar & Controls */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      <div className="h-1 bg-gray-600/50 rounded-full mb-2 cursor-pointer">
                        <div className="h-full bg-red-600 w-1/3 relative rounded-full">
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full border-2 border-black/50 shadow-sm"></div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center px-1">
                        <div className="text-white/80 text-[10px] font-mono">14:22 / 45:00</div>
                        <div className="flex gap-3 text-white/80">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mock Chat Panel */}
                  <div className="flex-1 bg-[#11151F] p-4 flex flex-col gap-4 overflow-hidden relative">
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs shadow-md">U</div>
                      <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-sm p-3 text-xs text-gray-300 shadow-sm max-w-[85%] leading-relaxed">
                        Can you summarize the key theorems mentioned between 14:00 and 28:00?
                      </div>
                    </div>
                    
                    <div className="flex gap-3 flex-row-reverse relative z-10">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-lg ring-2 ring-[#11151F]">
                        <TextGeneratorIcon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl rounded-tr-sm p-3.5 text-xs text-gray-300 shadow-sm max-w-[85%] backdrop-blur-sm">
                        <p className="font-bold mb-2 text-orange-400">Key Theorems Extracted:</p>
                        <ul className="list-decimal pl-4 space-y-1.5 text-gray-300">
                          <li>The Fundamental Theorem of Calculus <span className="text-blue-400 hover:underline cursor-pointer">[14:22]</span></li>
                          <li>Mean Value Theorem for Integrals <span className="text-blue-400 hover:underline cursor-pointer">[21:05]</span></li>
                        </ul>
                        <div className="mt-3 pt-2 border-t border-orange-500/10 flex items-center gap-1.5">
                          <AttachmentIcon className="w-3 h-3 text-gray-500" /> 
                          <span className="text-[10px] text-gray-500">2 Citations from Transcript</span>
                        </div>
                      </div>
                    </div>
                  </div>

               </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
