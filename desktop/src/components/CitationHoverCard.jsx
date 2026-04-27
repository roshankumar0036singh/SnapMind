import React from 'react';
import * as HoverCard from '@radix-ui/react-hover-card';
import { FileText, Bookmark, Sparkles, Youtube } from 'lucide-react';
import { chrome } from '../background/api';
import { toast } from 'sonner';

const CitationHoverCard = ({ citation, blocks, onSave, isBookmarked, onHighlight }) => {
  // Find block content
  const block = blocks?.find(b => b.id === citation.blockId);
  const text = block ? block.text : "Content not available.";
  const preview = text.length > 200 ? text.substring(0, 200) + "..." : text;

  // YouTube Parsing
  const isYouTube = block?.url?.includes('youtube.com') || block?.url?.includes('youtu.be');
  let youtubeTimestamp = null;
  let youtubeSeconds = 0;
  if (isYouTube) {
    const tsMatch = text.match(/\[(\d{2}):(\d{2})\]/);
    if (tsMatch) {
      youtubeTimestamp = tsMatch[0]; // "[MM:SS]"
      youtubeSeconds = parseInt(tsMatch[1], 10) * 60 + parseInt(tsMatch[2], 10);
    }
  }

  const handleClick = async () => {
    console.log("Clicked citation:", citation.blockId);
    const targetUrl = block?.url || block?.sourceURL;

    if (isYouTube && youtubeTimestamp) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTabUrl = tabs[0]?.url || "";
        if (activeTabUrl.includes('youtube.com/watch') || activeTabUrl.includes('youtu.be/')) {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'SEEK_YOUTUBE',
              seconds: youtubeSeconds
            });
          }
        } else if (targetUrl) {
          chrome.tabs.create({ url: `${targetUrl}&t=${youtubeSeconds}s` });
        } else {
          const vIdMatch = block?.url?.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
          const videoId = vIdMatch ? vIdMatch[1] : '';
          if (videoId) {
            chrome.tabs.create({ url: `https://youtube.com/watch?v=${videoId}&t=${youtubeSeconds}s` });
          }
        }
      });
    } else if (targetUrl) {
      const highlightUrl = citation.highlightUrl || targetUrl;

      const cleanSnippetText = (text) => {
        if (!text) return '';
        let cleaned = text.replace(/\[((?:bi|nb|db|br)-block-[\d-]+|pin-[a-zA-Z0-9-]+-\d+)\]/gi, '')
          .replace(/https?:\/\/[^\s\)]+/g, '') 
          .replace(/[*_~`#>\\]/g, '')           
          .replace(/[\[\]\(\)]/g, ' ')          
          .replace(/\s+/g, ' ')                 
          .trim();

        if (cleaned.length > 150) {
          const lastSpace = cleaned.lastIndexOf(' ', 150);
          cleaned = cleaned.substring(0, lastSpace > 30 ? lastSpace : 150);
        }
        return cleaned;
      };

      const snippet = block?.highlight_snippet || (block?.text ? cleanSnippetText(block.text) : '');
      const pageNum = block?.metadata?.page || block?.page;
      onHighlight(citation.blockId, highlightUrl, snippet, pageNum, block);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          const cleanSnippetText = (text) => {
            if (!text) return '';
            let cleaned = text.replace(/\[((?:bi|nb|db|br)-block-[a-zA-Z0-9-]+|pin-[a-zA-Z0-9-]+-\d+)\]/gi, '')
              .replace(/https?:\/\/[^\s\)]+/g, '') 
              .replace(/[*_~`#>\\]/g, '')           
              .replace(/[\[\]\(\)]/g, ' ')          
              .replace(/\s+/g, ' ')                 
              .trim();
            if (cleaned.length > 150) {
              const lastSpace = cleaned.lastIndexOf(' ', 150);
              cleaned = cleaned.substring(0, lastSpace > 30 ? lastSpace : 150);
            }
            return cleaned;
          };
          const snippet = block?.highlight_snippet || (block?.text ? cleanSnippetText(block.text) : '');
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'HIGHLIGHT_CITATION',
            blockId: citation.blockId,
            text: snippet
          }, (resp) => {
            if (chrome.runtime.lastError) {
              toast.error("Highlight failed: Please refresh the target page.", { duration: 3000 });
            }
          });
          onHighlight(citation.blockId, null, snippet, null, block);
        }
      });
    }
  };

  return (
    <HoverCard.Root openDelay={200} closeDelay={100}>
      <HoverCard.Trigger asChild>
        <button
          onClick={handleClick}
          className={`group flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-[11px] font-medium transition-all cursor-pointer shadow-sm ${isYouTube
              ? 'bg-[#18181b]/50 text-rose-400 border-rose-500/20 hover:bg-[#18181b] hover:border-rose-500/40'
              : isBookmarked
                ? 'bg-[#18181b]/80 text-amber-500 border-amber-500/30'
                : 'bg-[#0f0f14] text-[#a1a1aa] hover:text-[#d4d4d8] hover:bg-[#18181b] border-[#27272a] hover:border-[#6366f1]/50'
            }`}
        >
          {isYouTube ? (
            <Youtube className="w-3.5 h-3.5 text-rose-600" />
          ) : (
            <span className={`w-1.5 h-1.5 rounded-full transition-colors ${isBookmarked ? 'bg-amber-600' : 'bg-amber-400 group-hover:bg-amber-500'}`}></span>
          )}
          {isYouTube ? youtubeTimestamp : (
            (isBookmarked ? 'Saved' : 'Source')
          )} {!isYouTube ? (citation.blockId?.match?.(/\d+$/)?.[0] || citation.blockId?.replace?.(/^(bi-block-|nb-block-|db-block-|pin-[a-zA-Z0-9-]+-)/i, '') || 'Link') : ''}
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className="z-50 w-80 bg-[#0f0f14] p-4 rounded-xl shadow-2xl ring-1 ring-[#27272a] animate-in fade-in zoom-in-95 duration-200"
          sideOffset={5}
          side="top"
          align="start"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#71717a] uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <FileText className="w-3 h-3" />
                Source Context
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isBookmarked && onSave) {
                    const snippet = block?.highlight_snippet || "";
                    const h_url = citation.highlightUrl || block?.url || block?.sourceURL;
                    onSave(text, block?.url || block?.sourceURL, {
                      highlight_snippet: snippet,
                      highlightUrl: h_url
                    });
                  }
                }}
                className={`p-1 rounded-md transition-colors ${isBookmarked ? 'text-amber-500 bg-amber-500/10 cursor-default' : 'text-[#71717a] hover:bg-[#18181b] hover:text-amber-500'
                  }`}
                title={isBookmarked ? "Already Saved" : "Save to Bookmarks"}
                disabled={isBookmarked}
              >
                <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-[#d4d4d8] font-medium mt-3">
              "{preview}"
            </p>
            <div className="text-[10px] text-[#71717a] pt-2 border-t border-[#1e1e26] flex justify-between items-center mt-3">
              <span>ID: {citation.blockId}</span>
              {isBookmarked && <span className="text-amber-600 font-bold flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" /> IN NOTEBOOK</span>}
            </div>
          </div>
          <HoverCard.Arrow className="fill-white" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
};

export default CitationHoverCard;
