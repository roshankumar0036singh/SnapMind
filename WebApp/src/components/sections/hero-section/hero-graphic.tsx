import React from "react";
import { MessageCircle, Settings, Activity, Database, Sparkles, BarChart, Layers } from "lucide-react";

export default function HeroGraphic() {
  return (
    <div className="relative w-full aspect-square md:aspect-[4/3] lg:aspect-auto lg:h-[600px] flex items-center justify-center p-4">
      {/* Background Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-primary-500/30 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-[20%] right-[20%] w-64 h-64 bg-purple-500/20 blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[20%] left-[20%] w-64 h-64 bg-blue-500/20 blur-[80px] rounded-full pointer-events-none" />

      {/* Main Container - Isometric-like tilt */}
      <div className="relative w-full max-w-2xl transform transition-transform duration-700 hover:scale-[1.02]">
        
        {/* Main Dashboard Card */}
        <div className="relative z-10 w-full bg-white/70 dark:bg-[#0A0D14]/80 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-6 border-b border-gray-200 dark:border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white">
                <Sparkles size={18} />
              </div>
              <span className="font-bold text-gray-900 dark:text-white text-lg tracking-tight">SnapMind AI Dashboard</span>
            </div>
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-700" />
              <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-700" />
              <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-700" />
            </div>
          </div>

          {/* Grid Layout inside Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Left Sidebar */}
            <div className="col-span-1 flex flex-col gap-3">
              <div className="bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 flex items-center gap-3">
                <Activity className="text-primary-500" size={20} />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-800 dark:text-white">Insights & Trends</span>
                  <span className="text-xs text-gray-500">Live monitoring</span>
                </div>
              </div>
              
              <div className="bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 flex items-center gap-3">
                <Database className="text-emerald-500" size={20} />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-800 dark:text-white">Vector DB</span>
                  <span className="text-xs text-gray-500">98.5% Indexed</span>
                </div>
              </div>

              <div className="bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 flex items-center gap-3">
                <Settings className="text-purple-500" size={20} />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-800 dark:text-white">Settings</span>
                  <span className="text-xs text-gray-500">Model configs</span>
                </div>
              </div>
            </div>

            {/* Main Area */}
            <div className="col-span-1 md:col-span-2 flex flex-col gap-4">
              
              {/* Chart Mockup */}
              <div className="bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-5 flex-1 min-h-[160px] relative overflow-hidden">
                <div className="text-sm font-bold text-gray-800 dark:text-white mb-4">Query Activity</div>
                {/* SVG Bar Chart */}
                <div className="absolute bottom-0 left-5 right-5 h-24 flex items-end justify-between gap-1 opacity-80">
                  {[40, 70, 45, 90, 65, 85, 55, 100, 75, 60, 80, 50].map((height, i) => (
                    <div 
                      key={i} 
                      className="w-full bg-primary-500 rounded-t-sm transition-all duration-1000 animate-pulse"
                      style={{ height: `${height}%`, animationDelay: `${i * 100}ms` }}
                    />
                  ))}
                </div>
              </div>

              {/* Bottom Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Knowledge Graph</div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-800 dark:text-white">124,592</span>
                    <Layers className="text-orange-500" size={16} />
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-800 h-1.5 rounded-full mt-2">
                    <div className="bg-orange-500 w-3/4 h-full rounded-full" />
                  </div>
                </div>
                
                <div className="bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">AI Assistant</div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-800 dark:text-white">Active</span>
                    <MessageCircle className="text-primary-500" size={16} />
                  </div>
                  <div className="flex gap-1 mt-2">
                    <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Floating Chat Widget (Overlay) */}
        <div className="absolute -left-6 -bottom-8 md:-left-12 md:-bottom-12 z-20 bg-white dark:bg-[#11151F] border border-gray-200 dark:border-white/10 rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] p-4 w-64 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <div className="text-sm font-bold text-gray-900 dark:text-white">SnapMind AI</div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="bg-gray-100 dark:bg-white/5 p-3 rounded-xl rounded-tl-sm text-xs text-gray-600 dark:text-gray-300 self-start max-w-[85%]">
              Hello! I've analyzed your recent GitHub commits.
            </div>
            <div className="bg-primary-500 p-3 rounded-xl rounded-tr-sm text-xs text-white self-end max-w-[85%] shadow-sm">
              Can you summarize the architecture changes?
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
