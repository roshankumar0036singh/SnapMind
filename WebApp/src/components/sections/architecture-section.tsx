"use client";

import React, { useState } from "react";
import { 
  GithubIcon, 
  CodeGeneratorIcon, 
  TextGeneratorIcon, 
  VideoGeneratorIcon,
  CodeXmlIcon,
  AttachmentIcon,
  SettingsIcon,
  ChatGPTIcon,
  XIcon
} from "@/icons/icons";
import { Database, AppWindow, Cpu, Layers, Box, Cloud, Package, Globe, Shield } from "lucide-react";

interface PopupData {
  title: string;
  description: string;
  tags: string[];
}

export default function ArchitectureSection() {
  const [activePopup, setActivePopup] = useState<PopupData | null>(null);

  const openPopup = (data: PopupData) => {
    setActivePopup(data);
  };

  const closePopup = () => {
    setActivePopup(null);
  };

  // Helper for rendering clickable component boxes
  const ComponentBox = ({ 
    icon, 
    title, 
    subtitle, 
    popupData,
    className = ""
  }: { 
    icon: React.ReactNode, 
    title: string, 
    subtitle?: string, 
    popupData: PopupData,
    className?: string
  }) => (
    <button 
      onClick={() => openPopup(popupData)}
      className={`flex items-center gap-2.5 sm:gap-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-2.5 sm:p-3 rounded-xl transition-all duration-300 hover:bg-gray-50 hover:dark:bg-white/10 hover:border-primary-500/50 hover:shadow-[0_0_15px_rgba(70,179,240,0.15)] hover:-translate-y-0.5 text-left w-full min-w-0 group ${className}`}
    >
      <div className="shrink-0 transition-transform group-hover:scale-110 flex items-center justify-center">
        {icon}
      </div>
      <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
        <span className="text-xs sm:text-sm font-bold text-gray-800 dark:text-white leading-tight truncate">{title}</span>
        {subtitle && <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{subtitle}</span>}
      </div>
    </button>
  );

  return (
    <section id="architecture" className="py-20 lg:py-32 bg-[#F8FAFC] dark:bg-[#06080C] px-3 sm:px-5 border-y border-gray-200 dark:border-white/5 relative overflow-hidden">
      
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary-500 opacity-20 blur-[100px]"></div>

      <div className="max-w-[90rem] mx-auto relative z-10">
        <div className="mb-20 text-center">
          <h2 className="mb-4 font-extrabold text-gray-900 text-3xl dark:text-white md:text-5xl max-w-3xl mx-auto tracking-tight">
            The SnapMind Architecture
          </h2>
          <p className="max-w-2xl mx-auto text-lg leading-relaxed text-gray-600 dark:text-gray-400">
            A high-performance, edge-accelerated pipeline. Click on any component to explore how we process, structure, and serve your knowledge at scale.
          </p>
        </div>

        {/* Professional Architecture Diagram */}
        <div className="relative w-full mx-auto bg-white/80 dark:bg-[#0A0D14]/90 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[24px] sm:rounded-[32px] p-3 sm:p-6 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
          
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 relative z-10">
            
            {/* 1. Inputs & Edge (Col 1-3) */}
            <div className="xl:col-span-3 flex flex-col gap-6 sm:gap-8">
              
              <div className="bg-gray-50/50 dark:bg-[#11151F] border border-gray-200 dark:border-white/5 p-3.5 sm:p-5 rounded-2xl">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div> Data Sources
                </div>
                <div className="flex flex-col gap-2.5 sm:gap-3">
                  <ComponentBox 
                    icon={<GithubIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 dark:text-gray-300" />}
                    title="GitHub Repos"
                    subtitle="OAuth App / Webhooks"
                    popupData={{ title: "GitHub Integration", description: "Continuously syncs repositories using OAuth apps. Listens to webhooks for real-time code updates and file tracking.", tags: ["Git", "OAuth", "Webhooks"] }}
                  />
                  <ComponentBox 
                    icon={<VideoGeneratorIcon className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />}
                    title="YouTube Transcripts"
                    subtitle="Multi-lang Parsing"
                    popupData={{ title: "YouTube Ingestion", description: "Bypasses rate limits using a waterfall cascade of proxies to extract accurate, timestamped video transcripts.", tags: ["PyTube", "Transcript API", "Proxies"] }}
                  />
                  <ComponentBox 
                    icon={<AttachmentIcon className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />}
                    title="Local Documents"
                    subtitle="PDFs, DOCX, TXT"
                    popupData={{ title: "Document Parser", description: "Applies advanced OCR and structural layout detection to parse complex PDFs, tables, and images.", tags: ["OCR", "Layout Parser", "PDF.js"] }}
                  />
                  <ComponentBox 
                    icon={<CodeXmlIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />}
                    title="Web Pages"
                    subtitle="Dynamic Scraping"
                    popupData={{ title: "Web Crawler", description: "Navigates dynamic JS-heavy websites to extract semantic article content and clean markdown.", tags: ["Headless Browser", "Markdown"] }}
                  />
                </div>
              </div>

              <div className="bg-gray-50/50 dark:bg-[#11151F] border border-gray-200 dark:border-white/5 p-3.5 sm:p-5 rounded-2xl">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-500"></div> Local Context
                </div>
                <ComponentBox 
                  icon={<SettingsIcon className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-500" />}
                  title="MCP Server"
                  subtitle="Model Context Protocol"
                  popupData={{ title: "MCP Server", description: "A local daemon that connects your IDE and local file system securely to the cloud inference engine, providing deep context.", tags: ["Daemon", "IDE Integration", "Secure RPC"] }}
                />
              </div>
            </div>

            {/* Connecting Arrows */}
            <div className="hidden xl:flex xl:col-span-1 items-center justify-center relative">
               <div className="w-full h-[2px] bg-gradient-to-r from-blue-500/20 to-purple-500/50 relative">
                 <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 border-purple-500 rotate-45"></div>
               </div>
            </div>

            {/* 2. Core Processing Backend (Col 5-8) */}
            <div className="xl:col-span-4 flex flex-col">
              <div className="flex-1 border border-primary-500/30 bg-primary-500/[0.02] rounded-[24px] sm:rounded-[32px] p-3 sm:p-6 md:p-8 relative shadow-inner">
                <div className="absolute -top-3 left-6 sm:left-10 bg-white dark:bg-[#0B0E14] px-3 sm:px-4 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold text-primary-500 uppercase tracking-widest border border-primary-500/30 rounded-full">
                  AI Orchestrator Engine
                </div>
                
                <div className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
                    <ComponentBox 
                      icon={<SettingsIcon className="w-5 h-5 text-indigo-500" />}
                      title="API Gateway"
                      subtitle="Rate Limiting"
                      className="col-span-1 sm:col-span-2"
                      popupData={{ title: "API Gateway", description: "The central entry point handling authentication, rate limiting, and routing requests to specialized background workers.", tags: ["FastAPI", "Redis Rate Limits"] }}
                    />
                    
                    <ComponentBox 
                      icon={<TextGeneratorIcon className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500" />}
                      title="Async Workers"
                      subtitle="Celery Tasks"
                      popupData={{ title: "Async Ingestion", description: "Scalable background workers handling heavy I/O operations like web scraping and video downloading without blocking the main thread.", tags: ["Celery", "RabbitMQ"] }}
                    />
                    
                    <ComponentBox 
                      icon={<CodeGeneratorIcon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" />}
                      title="GraphRAG"
                      subtitle="Entity Mapping"
                      popupData={{ title: "GraphRAG Engine", description: "Uses LLMs to extract nodes (entities) and edges (relationships), building a multi-hop semantic knowledge graph from unstructured text.", tags: ["Graph Extraction", "Multi-hop"] }}
                    />

                    <ComponentBox 
                      icon={<Cpu className="w-5 h-5 text-emerald-400" />}
                      title="Memory"
                      subtitle="State & Context"
                      popupData={{ title: "Memory Manager", description: "Maintains session state, long-term memory, and context window optimization across multi-turn conversations.", tags: ["Context Window", "Session State"] }}
                    />

                    <ComponentBox 
                      icon={<Database className="w-5 h-5 text-yellow-500" />}
                      title="Semantic Cache"
                      subtitle="Redis / Upstash"
                      popupData={{ title: "Semantic Cache", description: "Caches frequent LLM responses and embeddings to reduce latency by 80% and save API costs on identical or highly similar queries.", tags: ["Redis", "Vector Caching"] }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
                    <ComponentBox 
                      icon={<Layers className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />}
                      title="Chunker"
                      subtitle="Context-Aware Splits"
                      popupData={{ title: "Semantic Chunking", description: "Intelligently splits large documents into cohesive chunks based on semantic boundaries rather than fixed token limits.", tags: ["Recursive Splitting"] }}
                    />
                    
                    <ComponentBox 
                      icon={<SettingsIcon className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />}
                      title="Reranker"
                      subtitle="Reranking Layer"
                      popupData={{ title: "Reranker", description: "A secondary neural model that scores and reranks the initial retrieved chunks to dramatically improve final context relevance.", tags: ["Cohere", "BGE-Reranker"] }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
                    <ComponentBox 
                      icon={<Globe className="w-5 h-5 text-blue-500" />}
                      title="Firecrawl"
                      subtitle="Web Crawling API"
                      popupData={{ title: "Firecrawl", description: "Turns entire websites into clean markdown or structured data for seamless LLM ingestion.", tags: ["Scraping", "Data Ingestion"] }}
                    />
                    
                    <ComponentBox 
                      icon={<Shield className="w-5 h-5 text-indigo-500" />}
                      title="AI Guardrails"
                      subtitle="Safety & Policy"
                      popupData={{ title: "Safety Guardrails", description: "Enforces topical restrictions, toxic content filtering, and enterprise data privacy policies on all LLM inputs and outputs.", tags: ["NeMo Guardrails", "Security"] }}
                    />
                  </div>

                  <ComponentBox 
                    icon={<ChatGPTIcon className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />}
                    title="LLM Router"
                    subtitle="GPT-4o / Claude 3.5 / Gemini"
                    className="w-full"
                    popupData={{ title: "LLM Router", description: "Dynamically routes prompts to the most cost-effective and capable model for the task, supporting streaming SSE responses.", tags: ["Streaming", "Model Fallbacks"] }}
                  />
                  
                </div>
              </div>
            </div>

            {/* Connecting Arrows */}
            <div className="hidden xl:flex xl:col-span-1 items-center justify-center relative">
               <div className="w-full h-[2px] bg-gradient-to-r from-purple-500/50 to-emerald-500/50 relative">
                 <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 border-emerald-500 rotate-45"></div>
               </div>
            </div>

            {/* 3. Storage & Clients (Col 10-12) */}
            <div className="xl:col-span-3 flex flex-col gap-8">
              
              <div className="bg-gray-50/50 dark:bg-[#11151F] border border-gray-200 dark:border-white/5 p-3.5 sm:p-5 rounded-2xl">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Data Layer
                </div>
                <div className="flex flex-col gap-2.5 sm:gap-3">
                  <ComponentBox 
                    icon={<Database className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />}
                    title="Vector DB"
                    subtitle="LanceDB / pgvector"
                    popupData={{ title: "Vector Database", description: "Stores high-dimensional embeddings for blazing-fast similarity search and semantic retrieval.", tags: ["LanceDB", "pgvector"] }}
                  />
                  
                  <ComponentBox 
                    icon={<CodeXmlIcon className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />}
                    title="Relational DB"
                    subtitle="Supabase Postgres"
                    popupData={{ title: "Relational Database", description: "Stores user accounts, metadata, chat histories, and access controls using Postgres with Row Level Security.", tags: ["PostgreSQL", "RLS"] }}
                  />

                  <ComponentBox 
                    icon={<Box className="w-5 h-5 sm:w-6 sm:h-6 text-pink-500" />}
                    title="Graph Store"
                    subtitle="Supabase"
                    popupData={{ title: "Graph Database", description: "Maintains the structural topology of your knowledge graph, enabling complex Cypher queries for interconnected concepts.", tags: ["Supabase", "Graph Traversal"] }}
                  />

                  <ComponentBox 
                    icon={<Cloud className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />}
                    title="Blob Storage"
                    subtitle="S3 / R2"
                    popupData={{ title: "Object Storage", description: "Stores the raw, unprocessed PDFs, images, and raw HTML dumps securely before they pass through the ingestion pipeline.", tags: ["AWS S3", "Cloudflare R2"] }}
                  />
                </div>
              </div>

              <div className="bg-gray-50/50 dark:bg-[#11151F] border border-gray-200 dark:border-white/5 p-3.5 sm:p-5 rounded-2xl">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary-500"></div> Client Apps
                </div>
                <div className="flex flex-col gap-2.5 sm:gap-3">
                  <ComponentBox 
                    icon={<TextGeneratorIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-500" />}
                    title="Next.js Web UI"
                    subtitle="Dashboard & Canvas"
                    popupData={{ title: "Web Application", description: "React-based interface featuring a streaming chat window, interactive canvas, and graphical knowledge map.", tags: ["Next.js", "Tailwind", "React Flow"] }}
                  />

                  <ComponentBox 
                    icon={<AppWindow className="w-5 h-5 sm:w-6 sm:h-6 text-gray-800 dark:text-gray-200" />}
                    title="Chrome Extension"
                    subtitle="Capture Anywhere"
                    popupData={{ title: "Browser Extension", description: "Injects SnapMind into your browser allowing you to highlight text, bookmark pages, and chat with the current tab context instantly.", tags: ["Content Scripts", "Service Workers"] }}
                  />

                  <ComponentBox 
                    icon={<CodeXmlIcon className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />}
                    title="IDE Integrations"
                    subtitle="MCP Client"
                    popupData={{ title: "IDE Extension", description: "Connects your local VSCode or JetBrains environment directly to the SnapMind AI orchestrator to provide rich codebase context.", tags: ["VS Code", "Model Context Protocol"] }}
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Infrastructure & Deployment Layer (Bottom span) */}
          <div className="mt-12 sm:mt-16 pt-8 sm:pt-10 border-t border-gray-200 dark:border-white/10 relative z-10">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 text-center">Global Infrastructure & Deployment</div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 max-w-4xl mx-auto">
              
              <ComponentBox 
                icon={<svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 dark:text-white text-black"><path d="M24 22.525H0l12-21.05 12 21.05z"/></svg>}
                title="Vercel"
                subtitle="Frontend Edge"
                className="justify-center"
                popupData={{ title: "Vercel Edge Network", description: "Hosts the Next.js frontend, utilizing edge caching and serverless functions for optimal load times globally.", tags: ["Edge Config", "Serverless"] }}
              />

              <ComponentBox 
                icon={<svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-orange-500"><path d="M13.139 5.861L12 4 4.025 17.822h6.297l4.316-7.464 2.128 3.68H24l-3.39-5.864-4.814 8.33h-2.274l-4.305 7.447h-5.26L18.423 4z"/></svg>}
                title="Cloudflare"
                subtitle="API Workers"
                className="justify-center"
                popupData={{ title: "Cloudflare Workers", description: "Deploys ultra-fast, low-latency API routes across Cloudflare's global network to handle chat streaming and request routing.", tags: ["Wasm", "Edge Workers"] }}
              />

              <ComponentBox 
                icon={<span className="text-2xl font-black text-yellow-500">🤗</span>}
                title="Hugging Face"
                subtitle="Inference Compute"
                className="justify-center"
                popupData={{ title: "Hugging Face Compute", description: "Hosts the heavy Python backend and specialized open-source ML models for embedding generation and GraphRAG inference.", tags: ["Inference Endpoints", "GPU Compute"] }}
              />

              <ComponentBox 
                icon={<svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-emerald-500"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-5H8.5l4-5.5v5h2.5l-4 5.5z"/></svg>}
                title="Supabase"
                subtitle="Auth & Postgres"
                className="justify-center"
                popupData={{ title: "Supabase Backend", description: "Provides secure user authentication, Row Level Security, and fully managed PostgreSQL database hosting.", tags: ["Auth", "pgvector"] }}
              />

            </div>
          </div>

        </div>
      </div>

      {/* Interactive Details Modal */}
      {activePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={closePopup}
          ></div>
          <div className="relative bg-white dark:bg-[#11151F] border border-gray-200 dark:border-white/10 p-6 md:p-8 rounded-[24px] max-w-md w-full shadow-2xl transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={closePopup}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition"
            >
              <XIcon className="w-5 h-5" />
            </button>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{activePopup.title}</h3>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
              {activePopup.description}
            </p>
            <div className="flex flex-wrap gap-2">
              {activePopup.tags.map((tag, idx) => (
                <span key={idx} className="px-3 py-1 bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-full text-xs font-bold border border-primary-500/20">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
