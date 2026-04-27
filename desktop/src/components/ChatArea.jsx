import React from 'react';
import { Terminal, Bot, User, Copy, Download, Loader2 } from 'lucide-react';
import BotLogo from './BotLogo';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import CitationHoverCard from './CitationHoverCard'; // Check if we need to extract this too

const ChatArea = ({ 
  messages, 
  isLoading, 
  contentBlocks, 
  onCitationHighlight, 
  onCopy, 
  onSynthesis,
  messagesEndRef 
}) => {
  return (
    <div 
      id="message-container"
      className="flex-1 overflow-y-auto px-8 pt-8 pb-4 space-y-6 custom-scrollbar"
    >
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center opacity-50">
          <div className="w-16 h-16 rounded-2xl bg-[#0f0f14] border border-[#1e1e26] flex items-center justify-center mb-6">
            <Terminal className="w-8 h-8 text-[#6366f1]" />
          </div>
          <h3 className="text-sm font-bold text-[#f4f4f5] tracking-widest uppercase">Neural Terminal Active</h3>
          <p className="text-[10px] font-medium text-[#71717a] mt-2 tracking-wide">Enter query to begin research...</p>
        </div>
      ) : (
        messages.map((msg, idx) => (
          <div 
            key={msg.id}
            className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-[#111113] border border-[#1a1a1d] flex items-center justify-center shrink-0 mt-1">
                <BotLogo className="w-4 h-4" color="#6366f1" />
              </div>
            )}
            
            <div className={`max-w-[82%] group relative ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
              <div className={`
                px-7 py-6 rounded-[22px] border transition-all duration-400
                ${msg.role === 'user' 
                  ? 'bg-gradient-to-br from-[#111116] to-[#0f0f14] border-[#27272a] text-[#fafafa]' 
                  : 'bg-[#0f0f14] border-[#1e1e26]/80 text-[#d4d4d8] shadow-md'}
              `}>
                <div className="flex items-center justify-between mb-2 opacity-30 group-hover:opacity-100 transition-opacity">
                   <span className="text-[9px] font-black uppercase tracking-[0.2em]">[{msg.role}]</span>
                   <span className="text-[9px] font-medium">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div className="text-[13.5px] leading-relaxed prose prose-invert max-w-none">
                  {msg.role === 'user' ? (
                    <p className="font-medium">{msg.text}</p>
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      components={{
                        p: ({children}) => <p className="mb-4 last:mb-0">{children}</p>,
                        code: ({inline, children, className}) => {
                          if (inline) return <code className="bg-[#1a1a1d] text-[#6366f1] px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                          return (
                            <div className="my-4 border border-[#1e1e26] rounded-lg overflow-hidden bg-[#07070a]">
                              <div className="px-4 py-2 border-b border-[#1e1e26] bg-[#0f0f14] flex items-center justify-between">
                                <span className="text-[10px] font-black text-[#71717a] uppercase tracking-widest">{className?.replace('language-', '') || 'Code'}</span>
                                <button className="text-[#3f3f46] hover:text-[#6366f1] transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                              </div>
                              <pre className="p-6 overflow-x-auto text-[12px] font-mono leading-relaxed text-[#d4d4d8] selection:bg-[#6366f1]/50"><code>{children}</code></pre>
                            </div>
                          )
                        },
                        a: ({href, children}) => <a href={href} target="_blank" className="text-[#6366f1] underline decoration-[#6366f1]/30 underline-offset-4 hover:decoration-[#6366f1] transition-all">{children}</a>
                      }}
                    >
                      {(() => {
                        if (!msg.text) return '';
                        if (!msg.citations || msg.citations.length === 0) return msg.text;
                        
                        let processedText = msg.text;
                        msg.citations.forEach((cite, i) => {
                          const escapedId = cite.blockId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                          const regex = new RegExp(`\\[${escapedId}\\]`, 'g');
                          processedText = processedText.replace(regex, `[${i + 1}]`);
                        });
                        
                        return processedText.trim();
                      })()}
                    </ReactMarkdown>
                  )}
                </div>

                {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#1a1a1d] flex flex-wrap gap-2">
                    {msg.citations.map((cite, i) => (
                      <CitationHoverCard 
                        key={i} 
                        citation={cite} 
                        blocks={[...(msg.contextBlocks || []), ...(contentBlocks || [])]}
                        onHighlight={onCitationHighlight}
                      />
                    ))}
                  </div>
                )}

                {msg.role === 'assistant' && !msg.isLoading && (
                  <div className="mt-4 pt-3 flex items-center gap-3 border-t border-[#1a1a1d] opacity-50 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onCopy(msg.text)}
                      className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-[#71717a] hover:text-[#6366f1] transition-colors"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                    <button
                      onClick={() => onSynthesis(msg.text)}
                      className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-[#71717a] hover:text-[#10b981] transition-colors"
                    >
                      <Download className="w-3 h-3" /> Professional Synthesis
                    </button>
                  </div>
                )}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-[#6366f1] border border-[#6366f1]/20 flex items-center justify-center shrink-0 mt-1 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                <User className="w-4 h-4 text-black" />
              </div>
            )}
          </div>
        ))
      )}
      {isLoading && (
        <div className="flex gap-4">
           <div className="w-8 h-8 rounded-lg bg-[#0f0f14] border border-[#1e1e26] flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-[#6366f1] animate-spin" />
           </div>
           <div className="px-7 py-5 rounded-xl bg-[#0f0f14] border border-[#1e1e26] flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-[#6366f1] animate-pulse glow-effect" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#fafafa] flex items-center gap-2">
                Neural Pulse <span className="text-[#6366f1] animate-pulse">Synchronizing...</span>
              </span>
           </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatArea;
