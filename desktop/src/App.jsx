import * as HoverCard from '@radix-ui/react-hover-card';
import 'highlight.js/styles/atom-one-dark.css';
import { Bot, Crop, Database, FileText, History, Loader2, Send, Settings as SettingsIcon, User, Sparkles, Github, Bookmark, Globe, Youtube, MessageSquare, Pin, Folder } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { toast, Toaster } from 'sonner';
import { apiClient } from '../background/api';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSkeleton from './components/LoadingSkeleton';
import ShortcutsModal from './components/ShortcutsModal';
import GraphMap from './components/GraphMap';
import './styles/design-tokens.css';

// Lazy load heavy components for better initial load
const Settings = lazy(() => import('./components/Settings'));
const SessionList = lazy(() => import('./components/SessionList'));
import MermaidChart from './components/MermaidChart';
import WatchFoldersPanel from './components/WatchFoldersPanel';

// Custom Markdown Components





const CitationHoverCard = ({ citation, blocks, onSave, isBookmarked, onHighlight }) => {
  // Find block content
  const block = blocks?.find(b => b.id === citation.blockId);
  const text = block ? block.text : "Content not available.";
  const preview = text.length > 200 ? text.substring(0, 200) + "..." : text;

  // [NEW] YouTube Parsing
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

  return (
    <HoverCard.Root openDelay={200} closeDelay={100}>
      <HoverCard.Trigger asChild>
        <button
          onClick={async () => {
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

              // [FIX] Clean markdown from snippet and take a longer, robust window
              const cleanSnippetText = (text) => {
                if (!text) return '';
                let cleaned = text.replace(/\[((?:bi|nb|db|br)-block-[\d-]+|pin-[a-zA-Z0-9-]+-\d+)\]/gi, '')
                  .replace(/https?:\/\/[^\s\)]+/g, '') // Strip URLs
                  .replace(/[*_~`#>\\]/g, '')           // Strip markdown formatting chars
                  .replace(/[\[\]\(\)]/g, ' ')          // Convert ANY brackets/parens to spaces
                  .replace(/\s+/g, ' ')                 // Collapse whitespace
                  .trim();

                if (cleaned.length > 150) {
                  const lastSpace = cleaned.lastIndexOf(' ', 150);
                  cleaned = cleaned.substring(0, lastSpace > 30 ? lastSpace : 150);
                }
                return cleaned;
              };

              // Prefer clean highlight_snippet from backend, fall back to raw text cleaning
              const snippet = block?.highlight_snippet || (block?.text ? cleanSnippetText(block.text) : '');
              console.log(`[Citation] Highlighting ${citation.blockId} with snippet: "${snippet.substring(0, 50)}..."`);

              const pageNum = block?.metadata?.page || block?.page;
              onHighlight(citation.blockId, highlightUrl, snippet, pageNum);
            } else {
              // Local/Active tab fallback (same page)
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.id) {
                  const cleanSnippetText = (text) => {
                    if (!text) return '';
                    let cleaned = text.replace(/\[((?:bi|nb|db|br)-block-[a-zA-Z0-9-]+|pin-[a-zA-Z0-9-]+-\d+)\]/gi, '')
                      .replace(/https?:\/\/[^\s\)]+/g, '') // Strip URLs
                      .replace(/[*_~`#>\\]/g, '')           // Strip markdown formatting chars
                      .replace(/[\[\]\(\)]/g, ' ')          // Convert ANY brackets/parens to spaces
                      .replace(/\s+/g, ' ')                 // Collapse whitespace
                      .trim();
                    if (cleaned.length > 150) {
                      const lastSpace = cleaned.lastIndexOf(' ', 150);
                      cleaned = cleaned.substring(0, lastSpace > 30 ? lastSpace : 150);
                    }
                    return cleaned;
                  };
                  // Prefer highlight_snippet from backend
                  const snippet = block?.highlight_snippet || (block?.text ? cleanSnippetText(block.text) : '');
                  chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'HIGHLIGHT_CITATION',
                    blockId: citation.blockId,
                    text: snippet
                  }, (resp) => {
                    if (chrome.runtime.lastError) {
                      console.warn("Highlight msg failed:", chrome.runtime.lastError);
                      toast.error("Highlight failed: Please refresh the target page and try again.", { duration: 3000 });
                    }
                  });
                }
              });
            }
          }}
          className={`group flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-[11px] font-medium transition-all cursor-pointer ${isYouTube
              ? 'bg-rose-50/90 text-rose-700 border-rose-200 hover:bg-rose-100 shadow-sm'
              : isBookmarked
                ? 'bg-amber-100/80 text-amber-800 border-amber-300 shadow-sm'
                : 'bg-amber-50/50 text-amber-700 hover:bg-amber-100 border-amber-200/60'
            }`}
        >
          {isYouTube ? (
            <Youtube className="w-3.5 h-3.5 text-rose-600" />
          ) : (
            <span className={`w-1.5 h-1.5 rounded-full transition-colors ${isBookmarked ? 'bg-amber-600' : 'bg-amber-400 group-hover:bg-amber-500'}`}></span>
          )}
          {isYouTube ? youtubeTimestamp : (
            (isBookmarked ? 'Saved' :
              (citation.blockId?.startsWith?.('pin-') ? 'Source' : 'Source'))
          )} {!isYouTube ? (citation.blockId?.match?.(/\d+$/)?.[0] || citation.blockId?.replace?.(/^(bi-block-|nb-block-|db-block-|pin-[a-zA-Z0-9-]+-)/i, '') || 'Link') : ''}
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className="z-50 w-80 bg-white p-4 rounded-xl shadow-xl ring-1 ring-slate-200 animate-in fade-in zoom-in-95 duration-200"
          sideOffset={5}
          side="top"
          align="start"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <FileText className="w-3 h-3" />
                Source Context
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isBookmarked) {
                    const snippet = block?.highlight_snippet || "";
                    const h_url = citation.highlightUrl || block?.url || block?.sourceURL;
                    onSave(text, block?.url || block?.sourceURL, {
                      highlight_snippet: snippet,
                      highlightUrl: h_url
                    });
                  }
                }}
                className={`p-1 rounded-md transition-colors ${isBookmarked ? 'text-amber-600 bg-amber-50 cursor-default' : 'text-slate-400 hover:bg-amber-50 hover:text-amber-600'
                  }`}
                title={isBookmarked ? "Already Saved" : "Save to Bookmarks"}
                disabled={isBookmarked}
              >
                <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
            </div>
            <p className="text-xs leading-relaxed text-slate-700 font-medium">
              "{preview}"
            </p>
            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 flex justify-between items-center">
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

const getFlagEmoji = (langCode) => {
  if (!langCode || langCode === 'unknown') return null;
  const map = {
    'en': '🇺🇸', 'es': '🇪🇸', 'fr': '🇫🇷', 'de': '🇩🇪', 'it': '🇮🇹',
    'pt': '🇵🇹', 'pt-br': '🇧🇷', 'nl': '🇳🇱', 'ru': '🇷🇺', 'zh': '🇨🇳', 'ja': '🇯🇵',
    'ko': '🇰🇷', 'ar': '🇸🇦', 'hi': '🇮🇳'
  };
  return map[langCode.toLowerCase()] || null;
};

const getSourceHandle = (title) => {
  if (!title) return 'PIN';
  // Use up to 3 words to ensure uniqueness
  const words = title.trim().split(/\s+/).slice(0, 3);
  const handle = words.map(w => w.replace(/[^a-zA-Z0-9]/g, '')).filter(Boolean).join('-');
  return handle || 'PIN';
};

const SiteList = ({ onContextSelect }) => {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    setLoading(true);
    const data = await apiClient.getSites();
    setSites(data);
    setLoading(false);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    await apiClient.deleteSite(id);
    loadSites(); // Refresh
    toast.success("Site memory deleted");
  };

  if (loading) return <LoadingSkeleton type="card" count={3} />;

  if (sites.length === 0) {
    return (
      <div className="text-center p-8 text-slate-500">
        <Database className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <h3 className="font-semibold text-slate-700">No Memories Yet</h3>
        <p className="text-xs">Index pages to build your knowledge base.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {sites.map(site => (
        <div
          key={site.id}
          onClick={async () => {
            chrome.tabs.create({ url: site.url });
            const newSessionId = `session-${Date.now()}`;
            const newSession = {
              id: newSessionId,
              title: site.title || site.url,
              messages: [{ id: '1', role: 'assistant', text: `Ready to answer questions about ${site.title || site.url}` }],
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
            const result = await chrome.storage.local.get(['chatSessions']);
            const updatedSessions = [...(result.chatSessions || []), newSession];
            await chrome.storage.local.set({ chatSessions: updatedSessions, currentSessionId: newSessionId });
            setCurrentSessionId(newSessionId);
            setSessions(updatedSessions);
            setMessages(newSession.messages);
            setView('chat');
            toast.success(`Opened ${site.title || site.url}`);
          }}
          style={{
            background: 'var(--bg-primary)',
            padding: '20px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
            transition: 'var(--transition-fast)',
            position: 'relative',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary-300)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-light)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {/* Title */}
          <h3 style={{
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--text-primary)',
            marginBottom: '6px',
            paddingRight: '24px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {site.title || new URL(site.url).hostname}
          </h3>

          {/* Domain and Language */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-tertiary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            <span>{new URL(site.url).hostname}</span>
            {site.original_lang && site.original_lang !== 'unknown' && site.original_lang !== 'en' && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-medium rounded-md border border-indigo-100">
                {getFlagEmoji(site.original_lang)} {site.original_lang.toUpperCase()}
                {site.translated && " (Translated)"}
              </span>
            )}
          </div>



          {/* Delete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(site.id, e);
            }}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              width: '24px',
              height: '24px',
              padding: 0,
              background: 'transparent',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              transition: 'var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--error)';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

const BookmarkList = ({ bookmarks, loading, onDelete }) => {
  if (loading) return <LoadingSkeleton type="card" count={3} />;

  if (bookmarks.length === 0) {
    return (
      <div className="text-center p-8 text-slate-500">
        <Bookmark className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <h3 className="font-semibold text-slate-700">No Bookmarks Saved</h3>
        <p className="text-xs text-slate-400">Click the bookmark icon on any citation to save it here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {bookmarks.map(b => (
        <div key={b.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative">
          <div className="flex flex-col gap-2">
            <p className="text-xs leading-relaxed text-slate-700 font-medium italic">
              "{b.content}"
            </p>
            {b.source_url && (
              <a
                href={b.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-indigo-500 hover:underline flex items-center gap-1"
              >
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                {new URL(b.source_url).hostname}
              </a>
            )}
            <div className="flex items-center justify-between mt-1 text-[9px] text-slate-400 font-medium">
              <span>Saved on {new Date(b.created_at).toLocaleDateString()}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(b.id);
                }}
                className="text-slate-300 hover:text-red-500 transition-colors uppercase font-bold tracking-tighter"
                title="Delete Bookmark"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

function App() {
  const [view, setView] = useState('chat'); // 'chat' | 'settings'
  const [mode, setMode] = useState('rag'); // 'rag' | 'visual'
  const [input, setInput] = useState('');
  const [externalUrl, setExternalUrl] = useState(''); // [NEW] Feature 2: External URL scraping
  const [twitterUrl, setTwitterUrl] = useState(''); // [NEW] Twitter scraping
  const [messages, setMessages] = useState([
    { id: '1', role: 'assistant', text: 'Hello! Choose a mode to start analyzing this page.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [outputLang, setOutputLang] = useState('auto'); // [NEW] Feature 5: Seamless Polyglot
  const [suggestions, setSuggestions] = useState([]); // Feature 4: Smart Suggestions
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [cropPreview, setCropPreview] = useState(null); // Data URL of crop
  const [contentBlocks, setContentBlocks] = useState([]); // Store blocks for hover lookups

  // [NEW] Active Context tracking (File vs Page)
  const [activeContext, setActiveContext] = useState(null); // { type: 'url'|'file', id: string, name: string }
  const [fileTargetLang, setFileTargetLang] = useState('auto'); // [NEW] File translation target language

  // [NEW] Feature 10: Cross-Tab Intelligence
  const [pinnedTabs, setPinnedTabs] = useState([]); // Array of { title, url, blocks }

  const [selectedSiteId, setSelectedSiteId] = useState(null); // Phase 3: Site Context
  const [sites, setSites] = useState([]); // Available sites for context switching
  const [currentSessionId, setCurrentSessionId] = useState(null); // Phase 5: Session management
  const [sessions, setSessions] = useState([]); // List of all sessions
  const [ingestStatus, setIngestStatus] = useState(null);
  const [currentUrl, setCurrentUrl] = useState(''); // Current active tab URL
  const [currentTabTitle, setCurrentTabTitle] = useState(''); // [NEW] Current active tab title
  const [isOffline, setIsOffline] = useState(false); // Offline detection
  const [lastFailedAction, setLastFailedAction] = useState(null); // For retry functionality
  const [showShortcuts, setShowShortcuts] = useState(false); // Keyboard shortcuts modal
  const [pendingFile, setPendingFile] = useState(null); // File dragged in by user
  const [isDragging, setIsDragging] = useState(false); // Drag overlay state
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [graphSessions, setGraphSessions] = useState([]);
  const [selectedGraphSession, setSelectedGraphSession] = useState(null); // [NEW] Phase 13
  const [memoryTab, setMemoryTab] = useState('sites'); // 'sites' | 'graph' | 'bookmarks' | 'folders'
  const [queryNotebook, setQueryNotebook] = useState(false); // [NEW] Phase 20: Research Notebook Correlation
  const [bookmarks, setBookmarks] = useState([]); // [LIFTED] Phase 21: Real-time bookmark icons
  const [bookmarksLoading, setBookmarksLoading] = useState(false);
  const [githubIngesting, setGithubIngesting] = useState(false); // [NEW] Phase 23: GitHub ingestion status
  const [githubJobId, setGithubJobId] = useState(null); // [NEW] Phase 23: Job polling
  const [visibleBrowser, setVisibleBrowser] = useState(false); // [NEW] Feature 17: Local Browser Agent Visibility

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null); // For Ctrl+K focus
  const fileInputRef = useRef(null); // Used by manual generic file clicks

  const handleCitationHighlight = (blockId, url, snippet = "", pageNum = null) => {
    if (!url) {
      console.warn("handleCitationHighlight: No URL for block", blockId);
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      let highlightUrl = url;

      // [NEW] PDF Page Navigation
      if (url.toLowerCase().endsWith('.pdf') && pageNum) {
        // Append #page=N to PDF URL for direct navigation
        highlightUrl = url.includes('#') ? url.split('#')[0] : url;
        highlightUrl += `#page=${pageNum}`;
        console.log(`[Citation] PDF detected, navigating to page ${pageNum}: ${highlightUrl}`);
      }

      // Helper: wait for a tab to finish loading, then send highlight
      const sendHighlightAfterLoad = (tabId) => {
        const onUpdated = (updatedTabId, changeInfo) => {
          if (updatedTabId === tabId && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(onUpdated);
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, {
                type: 'HIGHLIGHT_CITATION',
                blockId: blockId,
                text: snippet
              }, (resp) => {
                if (chrome.runtime.lastError) console.warn("Highlight message failed:", chrome.runtime.lastError);
              });
            }, 800);
          }
        };
        chrome.tabs.onUpdated.addListener(onUpdated);
        setTimeout(() => chrome.tabs.onUpdated.removeListener(onUpdated), 15000);
      };

      chrome.tabs.query({}, (tabs) => {
        let highlightUrlObj;
        try {
          highlightUrlObj = new URL(highlightUrl);
        } catch (e) {
          // Fallback for relative URLs or malformed strings
          console.warn("Failed to parse URL:", highlightUrl, e);
          if (highlightUrl.startsWith('http')) {
            // Probably okay to just use chrome.tabs.create with it anyway
          } else {
            return;
          }
        }

        // [NEW] Prioritize exact URL match for multi-tab accuracy
        let existingTab = tabs.find(t => t.url === highlightUrl);

        if (!existingTab) {
          const highlightBase = highlightUrlObj ? (highlightUrlObj.origin + highlightUrlObj.pathname) : highlightUrl.split('#')[0];
          existingTab = tabs.find(t => {
            if (!t.url) return false;
            try {
              const tabUrlObj = new URL(t.url);
              return (tabUrlObj.origin + tabUrlObj.pathname) === highlightBase;
            } catch (e) { return false; }
          });
        }

        if (existingTab) {
          // Tab already open (at least the same base page)
          chrome.tabs.update(existingTab.id, { active: true });
          chrome.windows.update(existingTab.windowId, { focused: true });

          const isSameExactUrl = existingTab.url === highlightUrl;

          if (isSameExactUrl) {
            // Already there, just highlight
            setTimeout(() => {
              chrome.tabs.sendMessage(existingTab.id, {
                type: 'HIGHLIGHT_CITATION',
                blockId: blockId,
                text: snippet
              }, (resp) => {
                if (chrome.runtime.lastError) console.warn("Highlight msg failed:", chrome.runtime.lastError);
              });
            }, 500);
          } else {
            // Same page, but maybe different fragment. 
            // Only update URL if it actually changed the base or something significant
            chrome.tabs.update(existingTab.id, { url: highlightUrl });

            // Wait for potential fragment-based scroll/load
            setTimeout(() => {
              chrome.tabs.sendMessage(existingTab.id, {
                type: 'HIGHLIGHT_CITATION',
                blockId: blockId,
                text: snippet
              }, (resp) => {
                if (chrome.runtime.lastError) {
                  // If it fails (maybe the page reloaded), retry with full listener
                  sendHighlightAfterLoad(existingTab.id);
                }
              });
            }, 600);
          }
        } else {
          // Open new tab and highlight after load
          chrome.tabs.create({ url: highlightUrl }, (newTab) => {
            sendHighlightAfterLoad(newTab.id);
          });
        }
      });
    });
  };

  // [NEW] Global Click Interceptor as a fail-safe for citation redirects
  useEffect(() => {
    const handleGlobalClick = (e) => {
      const link = e.target.closest('a');
      if (link && (link.getAttribute('href')?.includes('#snap-cite-') || link.getAttribute('href')?.includes('cite:'))) {
        e.preventDefault();
        e.stopPropagation();

        const href = link.getAttribute('href');
        const parts = href.split(href.includes('snap-cite-') ? 'snap-cite-' : 'cite:');
        const blockId = parts[parts.length - 1].replace(/^[#/]+/, '');

        console.log("[Global Interceptor] Catching click for:", blockId);

        const allBlocks = [
          ...(contentBlocks || []),
          ...pinnedTabs.flatMap(t => t.blocks || [])
        ];
        
        // [FIX] Find the block by its ID (including namespaced IDs)
        const block = allBlocks.find(b => b.id === blockId);
        
        if (block) {
          const pageNum = block?.metadata?.page || block?.page;
          handleCitationHighlight(blockId, block.url || block.sourceURL, block.highlight_snippet || "", pageNum);
        } else {
          // Fallback: Check if it's a source-URL block which might not have a full content block but has metadata in citations
          const msgWithCites = messages.findLast(m => m.citations?.some(c => c.blockId === blockId));
          const citeData = msgWithCites?.citations?.find(c => c.blockId === blockId);
          
          if (citeData?.url) {
            handleCitationHighlight(blockId, citeData.url, "");
          } else if (blockId.startsWith('source-')) {
            // Extract URL from ID: source-https://...
            const potentialUrl = blockId.replace('source-', '');
            handleCitationHighlight(blockId, potentialUrl, "");
          }
        }
      }
    };
    document.addEventListener('click', handleGlobalClick, true);
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, [contentBlocks, pinnedTabs, messages]);

  // [REMOVED] Legacy global MarkdownComponents - now defined per-message in the render loop for closure accuracy

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Global Drag and Drop handlers
  useEffect(() => {
    let dragCounter = 0; // Prevent drag leave flickering

    const handleDragEnter = (e) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      setIsDragging(true);
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        setIsDragging(false);
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragging(false);

      const file = e.dataTransfer?.files?.[0];
      if (file) {
        setPendingFile(file);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // [NEW] Listen for Context Menu "Send to Chat"
  useEffect(() => {
    const handleMessage = (request, sender, sendResponse) => {
      if (request.type === 'SET_CHAT_QUERY' && request.text) {
        console.log("Received context menu text:", request.text);
        setInput(request.text);
        // Optional: Focus the input
        inputRef.current?.focus();
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K: Focus input
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }

      // Ctrl+Shift+I: Ingest page
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        if (!isLoading) handleIngest();
      }

      // Ctrl+Shift+V: Visual scan
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        if (!isLoading) handleRegionScan();
      }

      // Ctrl+/: Show shortcuts
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setShowShortcuts(true);
      }

      // Esc: Close modals / Cancel
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        // Could add more cancel logic here
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading]); // Re-bind when loading state changes

  // Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Back online!');
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error('No internet connection');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load current tab URL
  useEffect(() => {
    const updateCurrentUrl = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
          setCurrentUrl(tab.url);
          setCurrentTabTitle(tab.title || new URL(tab.url).hostname);
          // If no active context is set, or if it's a URL context, update it to the new tab URL.
          setActiveContext(prev => {
            if (!prev || prev.type === 'url') {
              return { type: 'url', id: tab.url, name: 'Current Page' };
            }
            return prev; // keep file context if they uploaded a file
          });
        }
      } catch (err) {
        console.error('Failed to get current URL:', err);
      }
    };

    updateCurrentUrl();

    // Update URL when tab changes
    const handleTabUpdate = () => updateCurrentUrl();
    chrome.tabs.onActivated?.addListener(handleTabUpdate);
    chrome.tabs.onUpdated?.addListener(handleTabUpdate);

    return () => {
      chrome.tabs.onActivated?.removeListener(handleTabUpdate);
      chrome.tabs.onUpdated?.removeListener(handleTabUpdate);
    };
  }, []);

  // Load sites on mount
  useEffect(() => {
    const loadSites = async () => {
      const data = await apiClient.getSites();
      setSites(data);
    };
    loadSites();
  }, []);

  // Load conversation history on mount
  useEffect(() => {
    const loadHistory = async () => {
      const result = await chrome.storage.local.get(['chatSessions', 'currentSessionId']);
      const savedSessions = result.chatSessions || [];
      const savedSessionId = result.currentSessionId;

      if (savedSessions.length > 0) {
        setSessions(savedSessions);

        // Load current session or create new one
        if (savedSessionId) {
          const session = savedSessions.find(s => s.id === savedSessionId);
          if (session) {
            setCurrentSessionId(savedSessionId);
            setMessages(session.messages || [{ id: '1', role: 'assistant', text: 'Hello! Choose a mode to start analyzing this page.' }]);
            return;
          }
        }
      }

      // Create first session if none exist
      createNewSession();
    };
    loadHistory();
  }, []);

  // [NEW] Feature: Real-time Bookmark Sync & Citation State
  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    setBookmarksLoading(true);
    try {
      const data = await apiClient.getBookmarks();
      setBookmarks(data || []);
    } catch (e) {
      console.error("Failed to load bookmarks:", e);
    } finally {
      setBookmarksLoading(false);
    }
  };

  const handleDeleteBookmark = async (id) => {
    try {
      await apiClient.deleteBookmark(id);
      setBookmarks(prev => prev.filter(b => b.id !== id));
      toast.success("Bookmark removed from notebook");
    } catch (e) {
      console.error("Failed to delete bookmark:", e);
      toast.error("Error removing bookmark");
    }
  };

  // [NEW] Feature 4: Zero-Click Smart Suggestions
  useEffect(() => {
    // Only fetch suggestions if we are at the beginning of a fresh chat, and not in Visual mode
    if (view === 'chat' && mode === 'rag' && messages.length <= 1 && !isLoading && (activeContext?.type === 'url' || currentUrl)) {
      const fetchSuggestions = async () => {
        setIsSuggesting(true);
        // If we are on the live page, use the blocks we have
        const pageContent = contentBlocks.map(b => b.text).join('\n\n').substring(0, 3000);
        const targetUrl = activeContext?.id || currentUrl;

        try {
          const fetchedSuggestions = await apiClient.getSuggestions(pageContent, targetUrl, targetUrl);
          if (fetchedSuggestions && fetchedSuggestions.length > 0) {
            setSuggestions(fetchedSuggestions);
          }
        } catch (e) {
          console.error("Failed to load suggestions:", e);
        } finally {
          setIsSuggesting(false);
        }
      };
      // Adding a tiny delay to ensure page blocks have been extracted first
      const timeout = setTimeout(fetchSuggestions, 500);
      return () => clearTimeout(timeout);
    } else {
      setSuggestions([]); // Clear suggestions if chat progresses
    }
  }, [view, mode, messages.length, activeContext, currentUrl, contentBlocks, isLoading]);

  // [NEW] Ingestion Status Polling (Optimized for Browser Mode)
  useEffect(() => {
    let intervalId;

    const pollStatus = async () => {
      if (!currentSessionId) return;
      try {
        const status = await apiClient.getIngestStatus(currentSessionId);
        setIngestStatus(status);

        // Stop polling if completed or failed
        if (status.status === 'completed' || status.status === 'error' || status.status === 'unknown') {
          // Keep completed status for a few seconds then clear
          if (status.status === 'completed') {
            setTimeout(() => setIngestStatus(null), 5000);
          } else {
            setIngestStatus(null);
          }
          if (intervalId) clearInterval(intervalId);
        }
      } catch (e) {
        console.error("Status check failed:", e);
        if (intervalId) clearInterval(intervalId);
      }
    };

    // Only poll if we are in 'browser' mode OR if there is an active processing job
    const shouldPoll = (mode === 'browser' && isLoading) || (ingestStatus && ingestStatus.status === 'processing');

    if (shouldPoll) {
      intervalId = setInterval(pollStatus, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentSessionId, isLoading, ingestStatus?.status, mode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+I: Index current page
      if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        if (!isLoading && currentUrl) {
          handleIngest();
          toast.success('Indexing page... (Ctrl+I)');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, currentUrl]);

  // Save messages to storage whenever they change
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      const saveMessages = async () => {
        const result = await chrome.storage.local.get(['chatSessions']);
        const savedSessions = result.chatSessions || [];

        const updatedSessions = savedSessions.map(session =>
          session.id === currentSessionId
            ? { ...session, messages, updatedAt: Date.now() }
            : session
        );

        await chrome.storage.local.set({ chatSessions: updatedSessions });
        setSessions(updatedSessions);
      };
      saveMessages();
    }
  }, [messages, currentSessionId]);

  const createNewSession = async () => {
    const newSessionId = `session-${Date.now()}`;
    const newSession = {
      id: newSessionId,
      title: 'New Conversation',
      messages: [{ id: '1', role: 'assistant', text: 'Hello! Choose a mode to start analyzing this page.' }],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const result = await chrome.storage.local.get(['chatSessions']);
    const savedSessions = result.chatSessions || [];
    const updatedSessions = [...savedSessions, newSession];

    await chrome.storage.local.set({
      chatSessions: updatedSessions,
      currentSessionId: newSessionId
    });

    setCurrentSessionId(newSessionId);
    setSessions(updatedSessions);
    setMessages(newSession.messages);
  };

  const switchSession = async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
      await chrome.storage.local.set({ currentSessionId: sessionId });
    }
  };

  const deleteSession = async (sessionId) => {
    const result = await chrome.storage.local.get(['chatSessions']);
    const savedSessions = result.chatSessions || [];
    const updatedSessions = savedSessions.filter(s => s.id !== sessionId);

    await chrome.storage.local.set({ chatSessions: updatedSessions });
    setSessions(updatedSessions);

    // If deleting current session, switch to another or create new
    if (sessionId === currentSessionId) {
      if (updatedSessions.length > 0) {
        switchSession(updatedSessions[0].id);
      } else {
        createNewSession();
      }
    }
  };

  const clearAllHistory = async () => {
    if (confirm('Clear all conversation history? This cannot be undone.')) {
      await chrome.storage.local.remove(['chatSessions', 'currentSessionId']);
      setSessions([]);
      createNewSession();
      toast.success('History cleared');
    }
  };


  const fetchGraphData = async (sessionId = null) => {
    setIsLoading(true);
    try {
      if (!sessionId) {
        // Fetch sessions list
        const sessions = await apiClient.getGraphSessions();
        setGraphSessions(sessions);

        // [NEW] Fallback: If no sessions, fetch all graph data for global view
        if (!sessions || sessions.length === 0) {
          const data = await apiClient.getGraphData();
          if (data.success && (data.nodes?.length > 0 || data.edges?.length > 0)) {
            setGraphData({ nodes: data.nodes, edges: data.edges });
            setSelectedGraphSession("global"); // Use a special ID for global view
          }
        }
      } else {
        const data = await apiClient.getGraphData(sessionId === "global" ? null : sessionId);
        if (data.success) {
          setGraphData({ nodes: data.nodes, edges: data.edges });
          setSelectedGraphSession(sessionId);
        }
      }
    } catch (err) {
      console.error("Failed to fetch graph:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectGraphSession = (sessionId) => {
    fetchGraphData(sessionId);
  };

  const handleBackToSessions = () => {
    setSelectedGraphSession(null);
    setGraphData({ nodes: [], edges: [] });
    // Re-fetch sessions to be sure
    fetchGraphData();
  };

  useEffect(() => {
    if (view === 'memory' && memoryTab === 'graph') {
      fetchGraphData();
    }
  }, [view, memoryTab]);

  // [FIX] Throttled scroll to bottom to prevent flickering during rapid streaming
  const lastScrollTime = useRef(0);
  useEffect(() => {
    const now = Date.now();
    if (now - lastScrollTime.current > 100) { // Throttle scroll to 10fps
      scrollToBottom();
      lastScrollTime.current = now;
    }
  }, [messages, view, cropPreview]);

  const handleFileUpload = async (eventOrFile) => {
    let file = eventOrFile;
    if (eventOrFile?.target?.files) {
      file = eventOrFile.target.files[0];
    }
    if (!file) return;

    // Optional: Validate file type before upload
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/markdown',
      'application/json',
      'image/png',
      'image/jpeg',
      'image/webp'
    ];
    // We allow basic extensions if type is empty (e.g. .md)
    if (file.type && !allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|docx|csv|xls|xlsx|txt|md|json|png|jpg|jpeg|webp)$/i)) {
      toast.error('Unsupported file type. Please upload a PDF, Word, CSV, Text, or Image file.');
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading(`📤 Uploading and Parsing ${file.name}...`);

    try {
      const response = await apiClient.ingestFile(file, null, fileTargetLang, currentSessionId);

      if (response.success) {
        toast.success(`✅ File Indexed: ${file.name}`, { id: toastId });
        // [NEW] Switch active context to the uploaded file
        setActiveContext({ type: 'file', id: `file://${file.name}`, name: file.name });
        setPendingFile(null);
      } else {
        toast.error(`❌ Upload Failed: ${response.message}`, { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error(`❌ Error uploading file: ${err.message}`, { id: toastId });
    } finally {
      setIsLoading(false);
      // Reset input so the exact same file can be uploaded again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleGithubIngest = async (url) => {
    setGithubIngesting(true);
    const toastId = toast.loading(`📥 Cloning and processing: ${url}...`, { duration: Infinity });

    try {
      const response = await apiClient.ingestGithub(url, 'auto', currentSessionId);
      if (!response.success) {
        toast.error(`❌ Ingestion Failed: ${response.message}`, { id: toastId });
        setGithubIngesting(false);
        return;
      }

      // [NEW] Set active context to the repository URL so chat targets it
      try {
        const u = new URL(url);
        const displayUrl = u.hostname + (u.pathname.length > 20 ? u.pathname.substring(0, 20) + "..." : u.pathname);
        setActiveContext({ type: 'url', id: url, name: displayUrl });
      } catch (e) {
        setActiveContext({ type: 'url', id: url, name: 'GitHub Repo' });
      }

      const jobId = response.job_id;
      setGithubJobId(jobId);

      // If no job_id returned (migration not run yet), fallback to a simple toast
      if (!jobId) {
        toast.success(`✅ Repository indexing started in background.`, { id: toastId });
        setGithubIngesting(false);
        return;
      }

      // Poll the backend every 3 seconds until the job is done
      const pollInterval = setInterval(async () => {
        try {
          const statusResp = await apiClient.getIngestionStatus(jobId);
          if (statusResp.status === 'completed') {
            clearInterval(pollInterval);
            setGithubIngesting(false);
            setGithubJobId(null);
            const chunks = statusResp.chunks_count || 0;
            const files = statusResp.files_processed || 0;
            toast.success(
              `🟢 Ready for Chat! Indexed ${files} files (${chunks} chunks).`,
              { id: toastId, duration: 6000 }
            );
          } else if (statusResp.status === 'failed') {
            clearInterval(pollInterval);
            setGithubIngesting(false);
            setGithubJobId(null);
            toast.error(`❌ Ingestion Failed: ${statusResp.message}`, { id: toastId, duration: 6000 });
          }
        } catch (pollErr) {
          console.warn('[GitHub Poll] Error checking status:', pollErr);
        }
      }, 3000);

    } catch (err) {
      console.error(err);
      toast.error(`❌ Error ingesting repo: ${err.message}`, { id: toastId });
      setGithubIngesting(false);
    }
  };

  const handleIngest = async (customUrl = null) => {
    // Client-side validation
    let urlToIngest = typeof customUrl === 'string' ? customUrl : null;

    if (!urlToIngest) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) {
        toast.error('No active tab found');
        return;
      }
      urlToIngest = tab.url;
    }

    // Validate URL
    let url;
    try {
      url = new URL(urlToIngest);
      if (!['http:', 'https:'].includes(url.protocol)) {
        toast.error('Can only index HTTP/HTTPS pages');
        return;
      }
      if (url.hostname === 'chrome' || url.protocol === 'chrome-extension:') {
        toast.error('Cannot index Chrome internal pages');
        return;
      }
    } catch (err) {
      toast.error('Invalid URL');
      return;
    }

    // Check offline
    if (isOffline) {
      toast.error('Cannot index while offline');
      return;
    }

    // ROUTING: Check for GitHub URL
    if (url.hostname === 'github.com') {
      return handleGithubIngest(urlToIngest);
    }

    // YouTube and Twitter URLs don't need multi-page crawl
    const isYouTube = url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be');
    const isTwitter = url.hostname.includes('twitter.com') || url.hostname.includes('x.com');
    let crawlMode;

    if (isYouTube || isTwitter) {
      crawlMode = { mode: 'single', max_pages: 1, max_depth: 1 };
    } else {
      // Show crawl mode selection dialog
      crawlMode = await showCrawlModeDialog();
      if (!crawlMode) return; // User cancelled
    }

    await performIngest(urlToIngest, crawlMode);
  };

  const showCrawlModeDialog = () => {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.4);
        backdrop-filter: blur(4px);
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        animation: fadeIn 0.2s ease-out forwards;
      `;

      dialog.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 24px; width: 100%; max-width: 384px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); border: 1px solid #f1f5f9; transform: scale(1); transition: all 0.2s; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 18px; font-weight: 600; color: #0f172a; margin: 0 0 4px 0;">Choose Crawl Mode</h3>
            <p style="font-size: 14px; color: #64748b; margin: 0;">Select how you want to index this website</p>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <button id="single-page-btn" style="width: 100%; position: relative; padding: 16px; border-radius: 12px; border: 2px solid #f1f5f9; background: white; text-align: left; display: flex; align-items: flex-start; gap: 16px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#6366f1'; this.style.backgroundColor='#eef2ff'; this.querySelector('.icon-bg').style.backgroundColor='#4f46e5'; this.querySelector('.icon-bg').style.color='white';" onmouseout="this.style.borderColor='#f1f5f9'; this.style.backgroundColor='white'; this.querySelector('.icon-bg').style.backgroundColor='#e0e7ff'; this.querySelector('.icon-bg').style.color='#4f46e5';">
              <div class="icon-bg" style="width: 40px; height: 40px; border-radius: 8px; background: #e0e7ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></polyline><polyline points="10 9 9 9 8 9"></polyline></svg>
              </div>
              <div>
                <div style="font-weight: 600; color: #0f172a; margin-bottom: 2px; font-size: 14px;">Single Page</div>
                <div style="font-size: 12px; color: #64748b;">Index only this exact URL (~10s)</div>
              </div>
            </button>
            
            <button id="multi-page-btn" style="width: 100%; position: relative; padding: 16px; border-radius: 12px; border: 2px solid #f1f5f9; background: white; text-align: left; display: flex; align-items: flex-start; gap: 16px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#10b981'; this.style.backgroundColor='#ecfdf5'; this.querySelector('.icon-bg').style.backgroundColor='#059669'; this.querySelector('.icon-bg').style.color='white';" onmouseout="this.style.borderColor='#f1f5f9'; this.style.backgroundColor='white'; this.querySelector('.icon-bg').style.backgroundColor='#d1fae5'; this.querySelector('.icon-bg').style.color='#059669';">
              <div class="icon-bg" style="width: 40px; height: 40px; border-radius: 8px; background: #d1fae5; color: #059669; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              </div>
              <div>
                <div style="font-weight: 600; color: #0f172a; margin-bottom: 2px; font-size: 14px;">Website Crawl</div>
                <div style="font-size: 12px; color: #64748b;">Find and index subpages (~60s)</div>
              </div>
            </button>
          </div>
          
          <button id="cancel-btn" style="margin-top: 20px; width: 100%; padding: 10px; font-size: 14px; font-weight: 500; color: #64748b; background: #f8fafc; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#f1f5f9'; this.style.color='#1e293b';" onmouseout="this.style.backgroundColor='#f8fafc'; this.style.color='#64748b';">
            Cancel
          </button>
        </div>
      `;

      document.body.appendChild(dialog);

      const singleBtn = dialog.querySelector('#single-page-btn');
      const multiBtn = dialog.querySelector('#multi-page-btn');
      const cancelBtn = dialog.querySelector('#cancel-btn');

      // Hover effects
      [singleBtn, multiBtn].forEach(btn => {
        btn.addEventListener('mouseenter', () => {
          btn.style.transform = 'translateY(-1px)';
          btn.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.2)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.transform = 'translateY(0)';
          btn.style.boxShadow = 'none';
        });
      });

      singleBtn.onclick = () => {
        document.body.removeChild(dialog);
        resolve({ mode: 'single' });
      };

      multiBtn.onclick = () => {
        document.body.removeChild(dialog);
        resolve({ mode: 'multi', max_pages: 10, max_depth: 3 });
      };

      cancelBtn.onclick = () => {
        document.body.removeChild(dialog);
        resolve(null);
      };

      // Close on backdrop click
      dialog.onclick = (e) => {
        if (e.target === dialog) {
          document.body.removeChild(dialog);
          resolve(null);
        }
      };
    });
  };

  const performIngest = async (url, crawlOptions) => {

    setIsLoading(true);
    const toastId = toast.loading(
      crawlOptions.mode === 'multi'
        ? "🌐 Starting multi-page crawl..."
        : "📄 Scraping page content..."
    );
    setIngestStatus({ status: 'processing', message: 'Starting ingestion...', progress: 5 });

    const timeoutIds = [];

    try {
      // Update toast based on mode
      if (crawlOptions.mode === 'multi') {
        timeoutIds.push(setTimeout(() => toast.loading("🔍 Discovering pages...", { id: toastId }), 1000));
        timeoutIds.push(setTimeout(() => toast.loading("🧠 Processing and embedding...", { id: toastId }), 3000));
      } else {
        timeoutIds.push(setTimeout(() => toast.loading("🧠 Creating embeddings...", { id: toastId }), 1000));
      }

      const response = await chrome.runtime.sendMessage({
        type: 'INGEST_PAGE',
        url: url,
        crawl_mode: crawlOptions.mode,
        max_pages: crawlOptions.max_pages || 10,
        max_depth: crawlOptions.max_depth || 3,
        target_lang: outputLang || 'auto',
        sessionId: currentSessionId
      });

      // Clear all pending timeouts to prevent overwriting rapid responses
      timeoutIds.forEach(clearTimeout);

      if (response.success && response.status === 'processing') {
        // [NEW] Background job accepted

        // Build a short URL for the Toast notification
        let displayUrl = url;
        try {
          const u = new URL(url);
          let path = u.pathname;
          if (path.length > 20) path = path.substring(0, 20) + '...';
          displayUrl = u.hostname + (path === '/' ? '' : path);
        } catch (e) { }

        const msg = crawlOptions.mode === 'multi'
          ? `Website Crawl started for ${displayUrl}`
          : `Indexing started for ${displayUrl}`;

        toast.success(msg, { id: toastId });
        setExternalUrl(''); // clear input if it was used

        // [NEW] Dynamically switch active chat context to the external URL if it doesn't match the current tab
        if (url !== currentUrl) {
          setActiveContext({ type: 'url', id: url, name: displayUrl });
        }

        // Clear any failed action
        setLastFailedAction(null);
      } else if (response.success) {
        // Legacy synchronous success
        toast.loading("💾 Storing in database...", { id: toastId });

        setTimeout(() => {
          const message = crawlOptions.mode === 'multi'
            ? `Crawled ${response.pages_indexed || response.pages_crawled || 0} pages, ${response.total_chunks || response.chunks_count || 0} chunks indexed`
            : `Indexed ${response.chunks_count || 'page'} successfully`;
          toast.success(message, { id: toastId });
        }, 500);

        // Phase 2: Heuristic Check
        if (response.isLowQuality) {
          setTimeout(() => {
            toast.warning("Low content detected. Try Visual Scan mode.", { duration: 5000 });
          }, 1500);
        }

        // [NEW] Dynamically switch active chat context to the external URL if it doesn't match the current tab
        if (url !== currentUrl) {
          let displayUrl = url;
          try {
            const u = new URL(url);
            displayUrl = u.hostname + (u.pathname === '/' ? '' : u.pathname.substring(0, 20));
          } catch (e) { }
          setActiveContext({ type: 'url', id: url, name: displayUrl });
          setExternalUrl('');
        }

        // Clear any failed action
        setLastFailedAction(null);
      } else {
        // Store failed action for retry
        setLastFailedAction({ type: 'ingest', url: url });
        const errMsg = response.error || response.message || "Unknown error";
        toast.error(`Indexing failed: ${errMsg}`, {
          id: toastId,
          action: {
            label: 'Retry',
            onClick: () => handleIngest(url)
          },
          actionButtonStyle: { backgroundColor: '#3b82f6', color: 'white' }
        });
      }
    } catch (err) {
      console.error(err);
      setLastFailedAction({ type: 'ingest', url: url });
      toast.error(`Error: ${err.message}`, {
        id: toastId,
        action: {
          label: 'Retry',
          onClick: () => handleIngest(url)
        },
        actionButtonStyle: { backgroundColor: '#3b82f6', color: 'white' }
      });
    } finally {
      timeoutIds.forEach(clearTimeout);
      setIsLoading(false);
    }
  };

  const handleVisualIngest = async () => {
    setIsLoading(true);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      text: "**Visual Indexing**: Capturing screenshot and extracting text..."
    }]);

    try {
      // 1. Capture Visible Tab
      const visibleTabQuery = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!visibleTabQuery[0]?.id) throw new Error("No active tab");
      const tab = visibleTabQuery[0];

      const captureResponse = await chrome.runtime.sendMessage({
        type: 'CAPTURE_VISIBLE_TAB',
        windowId: tab.windowId
      });

      if (!captureResponse.success) throw new Error("Screenshot failed");

      // 2. Extract Text via Backend VLM
      // We pass `imageData` to avoid re-capture in background (optimization)
      const analysisResponse = await chrome.runtime.sendMessage({
        type: 'PROCESS_QUERY',
        mode: 'visual',
        backendMode: 'extraction', // Triggers "Extraction Mode" in Backend
        text: 'Extract all text coverage',
        tabId: tab.id,
        windowId: tab.windowId,
        imageData: captureResponse.dataUrl
      });

      if (!analysisResponse.success) {
        throw new Error(analysisResponse.error || "Visual extraction failed");
      }

      // 3. Ingest Extracted Text
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        text: `**Extraction Complete**: Found content. Indexing to database...`
      }]);

      const ingestResponse = await chrome.runtime.sendMessage({
        type: 'INGEST_PAGE', // We use same type but different payload signature handles it
        url: tab.url,
        text: analysisResponse.answer, // Pass extracted text
        sessionId: currentSessionId
      });

      if (ingestResponse.success) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          text: "**Visual Indexing Success**: Page content added to memory."
        }]);
      } else {
        throw new Error(ingestResponse.error || "Ingestion failed");
      }

    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        text: `**Visual Indexing Error**: ${e.message}`
      }]);
    }
    setIsLoading(false);
  };

  // -- region: Cropping Logic
  const performCrop = (dataUrl, rect, devicePixelRatio) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Scale rect by DPR because captureVisibleTab returns full resolution image
        // BUT rect comes from CSS pixels.
        // Usually, captureVisibleTab is 1x dpr of the screen resolution? 
        // Actually, in Chrome extensions, captureVisibleTab returns the image at device pixel resolution.
        // So on Retina (2x), the image is 2x larger than window.innerWidth.

        const scale = img.width / rect.windowWidth;

        const sourceX = rect.x * scale;
        const sourceY = rect.y * scale;
        const sourceW = rect.width * scale;
        const sourceH = rect.height * scale;

        canvas.width = sourceW;
        canvas.height = sourceH;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.src = dataUrl;
    });
  };

  const handleRegionScan = async () => {
    setMode('visual'); // Switch context to visual
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      // 1. Start UI Selection
      // Close sidepanel momentarily? No, Side Panel stays open. 
      // Note: Overlay inside content script works even with side panel open.
      const selResponse = await chrome.tabs.sendMessage(tab.id, { type: 'START_SELECTION' });

      if (selResponse && selResponse.success && selResponse.rect) {
        setIsLoading(true);
        // 2. Capture full screen
        const captureResponse = await chrome.runtime.sendMessage({
          type: 'CAPTURE_VISIBLE_TAB',
          windowId: tab.windowId
        });

        if (captureResponse.success) {
          // 3. Crop
          const croppedUrl = await performCrop(captureResponse.dataUrl, selResponse.rect);
          setCropPreview(croppedUrl); // Show preview to user
          // Focus input
          setTimeout(() => document.querySelector('input')?.focus(), 100);
        }
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Region scan failed:", err);
      setIsLoading(false);
      // Inform user
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        text: "**Region Scan Failed**: Could not connect to the page.\n\nPlease **REFRESH THE PAGE** and try again. (Content script needs to reload)."
      }]);
    }
  };
  // -- endregion

  const handleSaveBookmark = async (content, overrideUrl = null, metadata = {}) => {
    const toastId = toast.loading("Saving to Bookmarks...");
    try {
      const sourceUrl = overrideUrl || activeContext?.id || currentUrl;
      const resp = await apiClient.createBookmark(content, sourceUrl, {
        session_id: currentSessionId,
        ...metadata
      });
      if (resp.success) {
        toast.success("Saved to Research Notebook", { id: toastId });
        loadBookmarks(); // Refresh global bookmark state
      } else {
        toast.error("Failed to save bookmark", { id: toastId });
      }
    } catch (e) {
      console.error("Save bookmark error:", e);
      toast.error("Error saving bookmark", { id: toastId });
    }
  };

  const handleDownloadReport = async () => {
    if (!currentSessionId) {
      toast.error("No active session to generate report from.");
      return;
    }
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const query = lastUserMsg ? lastUserMsg.text : "Research Findings";
    const toastId = toast.loading("Synthesizing your Multi-Page Research Report...");
    try {
      const response = await apiClient.downloadReport(currentSessionId, query);

      // Handle "still processing" state
      if (response && response.status === 'pending') {
        toast.info("Research is still being indexed. Please wait a few moments for the background process to finish!", { id: toastId, duration: 5000 });
        return;
      }

      const url = window.URL.createObjectURL(response);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SnapMind_Report_${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Report Synthesized & Downloaded!", { id: toastId });
    } catch (e) {
      console.error("Report generation failed:", e);
      toast.error(`Report generation failed: ${e.message}`, { id: toastId });
    }
  };

  const handleSend = async (overrideText = null, overrideMode = null) => {
    const textToSend = overrideText || input;
    const modeToUse = overrideMode || mode;

    if (!textToSend.trim()) return;

    // Create optimistic user message
    const userMsg = { id: Date.now().toString(), role: 'user', text: textToSend };
    const imagePayload = cropPreview;

    setMessages(prev => [...prev, userMsg]);

    if (!overrideText) {
      setInput('');
      setCropPreview(null);
    }
    setIsLoading(true);
    // Clear global blocks to prevent citation cross-pollination from previous turns
    setContentBlocks([]);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("No active tab found");

      if (modeToUse === 'browser') {
        // Browser Multi-Agent Flow
        try {
          const response = await apiClient.queryBrowserMode(userMsg.text, currentSessionId, {
            outputLang,
            queryNotebook,
            imagePayload,
            visible: visibleBrowser // [NEW] Pass visibility flag to local agent
          });

          if (response.blocks && response.blocks.length > 0) {
            setContentBlocks(prev => {
              const newBlocks = response.blocks.filter(nb => !prev.some(pb => pb.id === nb.id));
              return [...prev, ...newBlocks];
            });
          }

          setMessages(currentMessages => [
            ...currentMessages,
            { id: (Date.now() + 1).toString(), role: 'assistant', text: response.answer, citations: response.citations }
          ]);
        } catch (e) {
          setMessages(currentMessages => [
            ...currentMessages,
            { id: (Date.now() + 1).toString(), role: 'assistant', text: `Error: ${e.message}` }
          ]);
        }
        setIsLoading(false);
        return;
      }

      // STEAMING FLOW (RAG Only, No Image)
      if (modeToUse === 'rag' && !imagePayload) {
        let blocks = [];
        try {
          // 1. Extract Content directly
          // Always extract current page if it's the active context (to allow correlation)
          if (activeContext?.type === 'url' || !activeContext) {
            const extResponse = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONTENT' });
            if (extResponse && extResponse.data) {
              blocks = extResponse.data.blocks.map(b => ({ ...b, url: currentUrl }));
              setContentBlocks(blocks); // Update state for Hover Cards
            }
          }
        } catch (e) {
          console.warn("Content extraction failed (could be restricted page)", e);
        }

        // [NEW] Append pinned tabs context if any exist, outside the try-catch!
        // Always append pinned contexts to allow multi-tab correlation
        if (pinnedTabs.length > 0) {
          pinnedTabs.forEach((pinnedTab, tabIndex) => {
            if (pinnedTab.blocks && pinnedTab.blocks.length > 0) {
              // Add a source header block so the AI knows which tab is which
              const headerBlock = { id: `source-${pinnedTab.url}`, text: `\n\n--- Source: ${pinnedTab.title} (${pinnedTab.url}) ---\n\n`, url: pinnedTab.url };
              // [FIX] Inject parent URL and namespace block IDs to prevent cross-tab collisions
              // We use pin-t${tabIndex}- prefix to guarantee uniqueness across all pinned tabs
              const enrichedBlocks = pinnedTab.blocks.map(b => ({
                ...b,
                id: `pin-t${tabIndex}-${b.id.replace(/^(bi-block-|pin-)/, '')}`,
                url: b.url || pinnedTab.url,
              }));
              blocks = [...blocks, headerBlock, ...enrichedBlocks];
            }
          });
          console.log("Multi-tab context injected! Total chunks:", blocks.length);
        }

        // 2. Prepare empty AI message
        const aiMsgId = (Date.now() + 1).toString();

        // [NEW] Prepare History
        // Exclude the very last user message (which is treated as 'Current Question' by backend logic usually, but here we passed it as query arg)
        // Also exclude initial greeting if needed, but keeping it is fine.
        // We only want completed messages.
        const history = messages
          .filter(m => m.text && !m.error) // valid messages
          .map(m => ({
            role: m.role,
            content: m.text
          }));

        let fullText = "";
        let isFirstToken = true;

        // Determine site_id based on activeContext
        // 2. Identify Context (Filtered by Sidebar or Global Mode)
        let targetSiteId = currentUrl;

        // [NEW] Phase 19: Global Search Toggle
        // When queryNotebook (labeled as Global Knowledge) is active, we pass site_id=null
        // to tell the backend to search across ALL indexed content.
        if (queryNotebook) {
          targetSiteId = null;
        } else if (pinnedTabs && pinnedTabs.length > 0) {
          // [FIX] If pinned tabs exist, query ONLY from pinned tabs (not current page + tabs)
          // [FIX] Consolidate target sites: include current page AND all pinned tabs
          let targetSites = [...pinnedTabs.map(t => t.url)];
          if (currentUrl && !pinnedTabs.some(t => t.url === currentUrl)) {
            targetSites.push(currentUrl);
          }
          if (activeContext?.id && !targetSites.includes(activeContext.id)) {
            targetSites.push(activeContext.id);
          }
          targetSiteId = targetSites.filter(Boolean).join(',');
          console.log('[QUERY] Pinned tabs detected. Querying ONLY from pinned tabs:', targetSiteId);
        } else {
          if (activeContext && activeContext.type === 'file') {
            targetSiteId = activeContext.id;
          } else if (activeContext && activeContext.type === 'url') {
            targetSiteId = activeContext.id;
          } else {
            targetSiteId = currentUrl; // Default to current URL
          }
        }

        // 2.5 Translate query via Lingo.dev JS SDK before RAG
        let search_query = userMsg.text;
        let query_lang = 'en';
        try {
          const translation = await apiClient.translateText(userMsg.text);
          search_query = translation.translatedText;
          query_lang = translation.originalLang;
        } catch (e) {
          console.error("Translation pre-process failed:", e);
        }

        // 3. Stream Response via API Helper (filtered by active context)
        const streamResult = await apiClient.streamQueryRag(
          blocks,
          userMsg.text,
          (token) => {
            if (isFirstToken) {
              isFirstToken = false;
              setIsLoading(false); // Hide the "AI is thinking..." loader
              fullText += token;
              setMessages(prev => [...prev, {
                id: aiMsgId,
                role: 'assistant',
                text: fullText,
                citations: []
              }]);
            } else {
              fullText += token;
              setMessages(currentMessages =>
                currentMessages.map(m => m.id === aiMsgId ? { ...m, text: fullText } : m)
              );
            }
          },
          (newBlocks) => {
            if (newBlocks && newBlocks.length > 0) {
              console.log("[Stream] Received blocks:", newBlocks.length, newBlocks);

              // 1. Update global contentBlocks (for current context awareness)
              setContentBlocks(prev => {
                const filtered = newBlocks.filter(nb => !prev.some(pb => pb.id === nb.id));
                console.log("[Stream] Added", filtered.length, "new blocks to contentBlocks");
                return [...prev, ...filtered];
              });

              // 2. [FIX] Store blocks directly in THIS message to avoid ID collisions in citations
              setMessages(currentMessages =>
                currentMessages.map(m => m.id === aiMsgId ? {
                  ...m,
                  contextBlocks: [...(m.contextBlocks || []), ...newBlocks]
                } : m)
              );
              console.log("[Stream] Updated message with contextBlocks");
            }
          },
          targetSiteId, currentSessionId, search_query, query_lang, outputLang, queryNotebook);

        // 3.5 Handle empty or failed stream
        if (!streamResult.success || isFirstToken) {
          throw new Error(streamResult.error || "The AI failed to generate a response. Please check your connection or try a different query.");
        }

        // 4. Extract Citations (Post-Stream)
        // Find block IDs including new format with hex hash: db-block-abc123-5
        console.log("[Stream] Generation complete. Extracting citations from text...");
        console.log("[Stream] Full response text:", fullText);
        // [FIX] Support source-URL and pin-tX- citation extraction
        const citationRegex = /((?:bi|nb|db|br|source)-block-[a-zA-Z0-9-]+|pin-[a-zA-Z0-9-]+|source-[a-zA-Z0-9\.\:/%-]+)/gi;
        const citations = [];
        let match;
        console.log("[Stream] Looking for citations with regex...");
        while ((match = citationRegex.exec(fullText)) !== null) {
          const blockId = match[1];
          console.log("[Stream] Found citation:", blockId);
          if (!citations.find(c => c.blockId === blockId)) {
            // Descriptive snippet for pinned tabs and sources
            let snippet = `Source ${blockId.replace(/^(bi-block-|nb-block-|db-block-|br-block-|source-block-)/, '')}`;
            
            if (blockId.startsWith('pin-')) {
              // Format: pin-t0-5 or pin-t0-bi-block-5
              const parts = blockId.split('-');
              const tabIdx = parts[1].replace('t', '');
              const blockIdx = parts[parts.length - 1];
              snippet = `Pinned Tab ${parseInt(tabIdx) + 1} #${blockIdx}`;
            } else if (blockId.startsWith('source-')) {
              snippet = "Site Header";
            }
            
            citations.push({ blockId, snippet });
            console.log("[Stream] Added citation - ID:", blockId, "Snippet:", snippet);
          }
        }
        console.log("[Stream] Total citations extracted:", citations.length, citations);

        if (citations.length > 0) {
          setMessages(currentMessages =>
            currentMessages.map(m => m.id === aiMsgId ? { ...m, citations } : m)
          );
        }

      } else {
        // LEGACY FLOW (Visual / Image RAG)
        const response = await chrome.runtime.sendMessage({
          type: 'PROCESS_QUERY',
          mode: modeToUse,
          tabId: tab.id,
          windowId: tab.windowId,
          imageData: imagePayload,
          outputLang: outputLang
        });

        if (response && response.success) {
          const aiMsg = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            text: response.answer,
            citations: response.citations
          };
          setMessages(prev => [...prev, aiMsg]);
        } else {
          throw new Error(response?.error || 'Unknown error occurred');
        }
      }

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        text: `Error: ${err.message || "Failed to communicate."}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (view === 'settings') {
    return (
      <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>}>
        <Settings onBack={() => setView('chat')} />
      </Suspense>
    );
  }

  if (view === 'history') {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-violet-50/50">
        <header className="px-5 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
          <div className="flex items-center justify-between">
            <h1 className="text-slate-800 font-bold text-base">Conversation History</h1>
            <button
              onClick={() => setView('chat')}
              className="text-sm text-slate-600 hover:text-indigo-600 transition-colors"
            >
              ← Back to Chat
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<LoadingSkeleton type="card" count={3} />}>
            <SessionList
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSessionSwitch={(id) => {
                switchSession(id);
                setView('chat');
              }}
              onSessionDelete={deleteSession}
              onNewSession={() => {
                createNewSession();
                setView('chat');
              }}
              onClearAll={clearAllHistory}
            />
          </Suspense>
        </div>
      </div>
    );
  }


  return (
    <div className="flex flex-col bg-gradient-to-br from-slate-50 via-white to-indigo-50/50 text-sm font-sans antialiased text-slate-900 selection:bg-indigo-100 overflow-hidden max-w-full" style={{ position: 'fixed', inset: 0, height: '100dvh', width: '100vw' }}>

      {/* Offline Banner */}
      {isOffline && (
        <div className="bg-red-500 text-white px-4 py-2 text-center text-xs font-medium flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
          No internet connection - Some features may not work
        </div>
      )}

      {/* Modern Clean Header */}
      <header style={{
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-light)',
        position: 'sticky',
        top: 0,
        zIndex: 20
      }} className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-2">
            <div style={{
              background: 'var(--primary-500)',
              borderRadius: 'var(--radius-md)',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bot className="w-4 h-4 text-white" />
            </div>
            <h1 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--text-primary)'
            }}>
              SnapMind
            </h1>
          </div>

          {/* Center: Current Page Domain Pill - Clickable */}
          {currentUrl && (
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-full)',
                padding: '4px 12px',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                fontWeight: 'var(--font-medium)',
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                transition: 'var(--transition-fast)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--primary-50)';
                e.currentTarget.style.borderColor = 'var(--primary-200)';
                e.currentTarget.style.color = 'var(--primary-600)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-light)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              title={`Open ${currentUrl}`}
            >
              {new URL(currentUrl).hostname}
            </a>
          )}

          {/* Right: Icon Navigation */}
          <div className="flex items-center gap-1">
            {/* Index Button */}
            <button
              onClick={handleIngest}
              disabled={isLoading || !currentUrl}
              title="Index this page (Ctrl+I)"
              style={{
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                transition: 'var(--transition-fast)',
                color: isLoading ? 'var(--text-tertiary)' : 'var(--text-tertiary)',
                background: 'transparent',
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'var(--primary-50)';
                  e.currentTarget.style.color = 'var(--primary-600)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                }
              }}
            >
              <Database className="w-4 h-4" />
            </button>

            <button
              onClick={() => setView('history')}
              title="Conversation history"
              style={{
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                transition: 'var(--transition-fast)',
                color: 'var(--text-tertiary)',
                background: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--primary-50)';
                e.currentTarget.style.color = 'var(--primary-600)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
            >
              <History className="w-4 h-4" />
            </button>

            <button
              onClick={() => setView('settings')}
              title="Settings"
              style={{
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                transition: 'var(--transition-fast)',
                color: 'var(--text-tertiary)',
                background: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--primary-50)';
                e.currentTarget.style.color = 'var(--primary-600)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Modern Pill-Style Mode Tabs */}
      <div style={{
        padding: 'var(--space-2)',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-light)'
      }}>
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '4px',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)'
        }}>
          <button
            onClick={() => { setMode('rag'); setView('chat'); setCropPreview(null); }}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              transition: 'var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: 'none',
              cursor: 'pointer',
              background: mode === 'rag' && view === 'chat' ? 'var(--tab-active-bg)' : 'transparent',
              color: mode === 'rag' && view === 'chat' ? 'var(--tab-active-color)' : 'var(--text-secondary)',
              boxShadow: mode === 'rag' && view === 'chat' ? 'var(--shadow-sm)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (!(mode === 'rag' && view === 'chat')) {
                e.currentTarget.style.background = 'var(--tab-hover-bg)';
                e.currentTarget.style.color = 'var(--tab-hover-color)';
              }
            }}
            onMouseLeave={(e) => {
              if (!(mode === 'rag' && view === 'chat')) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            <FileText className="w-4 h-4" />
            <span>RAG</span>
          </button>

          <button
            onClick={() => {
              setView('chat');
              handleRegionScan();
            }}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              transition: 'var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: 'none',
              cursor: 'pointer',
              background: mode === 'visual' && view === 'chat' ? 'var(--tab-active-bg)' : 'transparent',
              color: mode === 'visual' && view === 'chat' ? 'var(--tab-active-color)' : 'var(--text-secondary)',
              boxShadow: mode === 'visual' && view === 'chat' ? 'var(--shadow-sm)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (!(mode === 'visual' && view === 'chat')) {
                e.currentTarget.style.background = 'var(--tab-hover-bg)';
                e.currentTarget.style.color = 'var(--tab-hover-color)';
              }
            }}
            onMouseLeave={(e) => {
              if (!(mode === 'visual' && view === 'chat')) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            <Crop className="w-4 h-4" />
            <span>Visual</span>
          </button>

          <button
            onClick={() => { setView('memory'); }}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              transition: 'var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: 'none',
              cursor: 'pointer',
              background: view === 'memory' ? 'var(--tab-active-bg)' : 'transparent',
              color: view === 'memory' ? 'var(--tab-active-color)' : 'var(--text-secondary)',
              boxShadow: view === 'memory' ? 'var(--shadow-sm)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (view !== 'memory') {
                e.currentTarget.style.background = 'var(--tab-hover-bg)';
                e.currentTarget.style.color = 'var(--tab-hover-color)';
              }
            }}
            onMouseLeave={(e) => {
              if (view !== 'memory') {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            <Database className="w-4 h-4" />
            <span>Memory</span>
          </button>

          <button
            onClick={() => { setMode('browser'); setView('chat'); setCropPreview(null); }}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              transition: 'var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: 'none',
              cursor: 'pointer',
              background: mode === 'browser' && view === 'chat' ? 'var(--tab-active-bg)' : 'transparent',
              color: mode === 'browser' && view === 'chat' ? 'var(--tab-active-color)' : 'var(--text-secondary)',
              boxShadow: mode === 'browser' && view === 'chat' ? 'var(--shadow-sm)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (!(mode === 'browser' && view === 'chat')) {
                e.currentTarget.style.background = 'var(--tab-hover-bg)';
                e.currentTarget.style.color = 'var(--tab-hover-color)';
              }
            }}
            onMouseLeave={(e) => {
              if (!(mode === 'browser' && view === 'chat')) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            <Globe className="w-4 h-4" />
            <span>Browser</span>
          </button>

          {/* [NEW] Visible Browser Toggle - only shown when Browser mode or Desktop specific */}
          {mode === 'browser' && (
            <div className="flex items-center gap-2 px-3 border-l border-slate-200 ml-2 animate-in fade-in slide-in-from-left-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visible</span>
              <button
                onClick={() => setVisibleBrowser(!visibleBrowser)}
                className={`w-8 h-4 rounded-full relative transition-all duration-300 ${visibleBrowser ? 'bg-indigo-500' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-300 ${visibleBrowser ? 'left-4.5' : 'left-0.5'}`} />
              </button>
            </div>
          )}

        </div>


        {/* [NEW] External URL Input for Background Scraping */}
        {mode === 'rag' && view === 'chat' && (
          <div className="flex flex-col gap-2 mt-3 px-1">
            <div className="flex items-center gap-2 bg-slate-50/80 border border-slate-200/60 p-1.5 rounded-xl transition-all focus-within:bg-white focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/10">
              <input
                type="url"
                placeholder="Or index any external URL..."
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && externalUrl.trim() && !isLoading) {
                    handleIngest(externalUrl.trim());
                  }
                }}
                className="flex-1 bg-transparent px-3 py-2 outline-none text-[13px] text-slate-700 placeholder:text-slate-400 font-medium"
              />
              <button
                onClick={() => {
                  if (externalUrl.trim() && !isLoading) {
                    handleIngest(externalUrl.trim());
                  }
                }}
                disabled={!externalUrl.trim() || isLoading}
                className={`flex items-center gap-2 px-4 py-2 flex-shrink-0 rounded-lg font-semibold text-[13px] transition-all duration-200 ${externalUrl.trim() && !isLoading
                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-sm hover:shadow-md hover:from-indigo-600 hover:to-indigo-700 active:scale-95 cursor-pointer'
                  : 'bg-slate-100/80 text-slate-400 cursor-not-allowed'
                  }`}
              >
                <div className={`flex items-center justify-center w-4 h-4 rounded-full ${externalUrl.trim() && !isLoading ? 'bg-white/20' : 'bg-slate-200/50'}`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                </div>
                Scrape
              </button>
            </div>
          </div>
        )}

        {/* [NEW] Report Generation Button for Browser Mode REMOVED as per user request */}
      </div>

      {/* Modern Memory View */}
      {
        view === 'memory' && (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-2)',
            background: 'var(--bg-secondary)'
          }}>
            {/* Tab Switcher */}
            <div className="flex p-1 bg-slate-100 rounded-xl mb-4 border border-slate-200/60 shadow-inner">
              <button
                onClick={() => setMemoryTab('sites')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${memoryTab === 'sites' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'}`}
              >
                <FileText className="w-3.5 h-3.5" />
                Sites
              </button>
              <button
                onClick={() => setMemoryTab('graph')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${memoryTab === 'graph' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'}`}
              >
                <Database className="w-3.5 h-3.5" />
                Graph
              </button>
               <button
                onClick={() => setMemoryTab('bookmarks')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${memoryTab === 'bookmarks' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'}`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                Notebook
              </button>
              <button
                onClick={() => setMemoryTab('folders')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${memoryTab === 'folders' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'}`}
              >
                <Folder className="w-3.5 h-3.5" />
                Folders
              </button>
            </div>

            {/* Header */}
            <div style={{
              marginBottom: 'var(--space-3)',
              padding: 'var(--space-2)',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-light)'
            }}>
              <h2 style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--text-primary)',
                marginBottom: '4px'
              }}>
                {memoryTab === 'sites' ? 'Indexed Sites' : memoryTab === 'graph' ? 'Knowledge Map' : 'Research Notebook'}
              </h2>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)'
              }}>
                {memoryTab === 'sites'
                  ? "Pages you've indexed for intelligent search"
                  : memoryTab === 'graph'
                    ? "Semantic entities and relationships discovered across your knowledge base"
                    : memoryTab === 'bookmarks'
                      ? "Pinned citations and key snippets saved for your research"
                      : "Local directories synced via real-time file system monitoring"}
              </p>
            </div>

            {/* site list or graph */}
            {memoryTab === 'sites' ? (
              <SiteList onBack={() => setView('chat')} />
            ) : memoryTab === 'graph' ? (
              selectedGraphSession ? (
                <div className="space-y-4">
                  <button
                    onClick={handleBackToSessions}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                    Back to Conversations
                  </button>
                  <GraphMap data={graphData} isLoading={isLoading} />
                </div>
              ) : (
                <div className="space-y-3">
                  {graphSessions.length === 0 && !isLoading ? (
                    <div className="text-center p-12 bg-white rounded-2xl border border-slate-200 border-dashed">
                      <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Database className="w-6 h-6" />
                      </div>
                      <h3 className="text-slate-700 font-bold">No Graphs Found</h3>
                      <p className="text-xs text-slate-500 max-w-[200px] mx-auto mt-1">Start a conversation and index some content to build your knowledge map.</p>
                    </div>
                  ) : (
                    graphSessions.map((session) => (
                      <button
                        key={session.session_id}
                        onClick={() => handleSelectGraphSession(session.session_id)}
                        className="w-full max-w-full flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-500 hover:shadow-md hover:shadow-indigo-500/5 transition-all group text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                          <MessageSquare className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-800 text-sm truncate pr-2">
                            {session.title || "Untitled Conversation"}
                          </h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                              {session.node_count} Entities
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                              {session.edge_count} Relations
                            </span>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-indigo-500 group-hover:bg-indigo-50 transition-all">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                        </div>
                      </button>
                    ))
                  )}
                  {isLoading && (
                    <div className="flex justify-center p-8">
                      <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                    </div>
                  )}
                </div>
              )
            ) : memoryTab === 'bookmarks' ? (
              <BookmarkList
                bookmarks={bookmarks}
                loading={bookmarksLoading}
                onDelete={handleDeleteBookmark}
              />
            ) : (
              <WatchFoldersPanel />
            )}
          </div>
        )
      }

      {/* Chat Container */}
      {
        view === 'chat' && (
          <div
            className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 scroll-smooth scrollbar-hide relative min-h-0"
            id="message-container"
            style={{ background: 'var(--bg-secondary)', maxWidth: '100%', scrollbarGutter: 'stable' }}
          >
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: '12px',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  animation: 'fadeIn 0.3s ease-in-out'
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: msg.role === 'user' ? 'var(--primary-500)' : 'var(--bg-secondary)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border-light)',
                  color: msg.role === 'user' ? 'white' : 'var(--primary-600)'
                }}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Card */}
                <div
                  className="group/msg relative"
                  style={{
                    maxWidth: '85%',
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-xl)',
                    background: msg.role === 'user' ? 'var(--primary-50)' : 'var(--bg-primary)',
                    border: `1px solid ${msg.role === 'user' ? 'var(--primary-100)' : 'var(--border-light)'}`,
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s ease-out'
                  }}>
                  {/* [NEW] Per-Message Report Download Icon */}
                  {msg.role === 'assistant' && mode === 'browser' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadReport();
                      }}
                      className="absolute -top-2.5 -right-2.5 p-2 bg-white border border-slate-200 rounded-full shadow-lg text-indigo-600 opacity-0 group-hover/msg:opacity-100 transition-all hover:bg-indigo-50 hover:scale-110 active:scale-95 z-30 flex items-center justify-center"
                      title="Download Systematic Research Paper"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {/* Message Content */}
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    lineHeight: 'var(--leading-relaxed)',
                    color: msg.role === 'user' ? 'var(--primary-700)' : 'var(--text-primary)',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere'
                  }}>
                    {msg.role === 'user' ? (
                      <div>{msg.text}</div>
                    ) : (
                      (() => {
                        // [NEW] Dynamically create components for THIS message context
                        const components = {
                          a: ({ href, children }) => {
                            const blockId = href?.replace('#snap-cite-', '');
                            if (href?.startsWith('#snap-cite-')) {
                              return (
                                <span
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    console.log("[Citation] Intercepted click for block:", blockId);

                                    // 1. [FIX] EXCLUSIVELY use this message's blocks
                                    let block = msg.contextBlocks?.find(b => b.id === blockId);

                                    // 2. Fallback to global context pools (pinned tabs, active tab)
                                    if (!block) {
                                      const globalBlocks = [
                                        ...(contentBlocks || []),
                                        ...pinnedTabs.flatMap(t => t.blocks || [])
                                      ];
                                      block = globalBlocks.find(b => b.id === blockId);
                                    }
                                    const citeData = msg.citations?.find(c => c.blockId === blockId);

                                    if (block || citeData) {
                                      const url = block?.url || block?.sourceURL || citeData?.url;
                                      const snippet = block?.highlight_snippet || block?.text || "";

                                      if (url) {
                                        const pageNum = block?.metadata?.page || block?.page || citeData?.page;
                                        handleCitationHighlight(blockId, url, snippet, pageNum);
                                      } else {
                                        console.warn("[Markdown] No URL found for citation:", blockId);
                                      }
                                    } else {
                                      console.warn("[Markdown] No metadata found for citation:", blockId);
                                    }
                                  }}
                                  className="citation-dot cursor-pointer transition-all hover:scale-125 select-none text-indigo-500 font-serif font-bold align-super ml-0.5 text-sm"
                                >
                                  {children || '●'}
                                </span>
                              );
                            }
                            return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
                          },
                          code: ({ node, inline, className, children, ...props }) => {
                            const match = /language-(\w+)/.exec(className || '');
                            const lang = match ? match[1] : '';

                            if (!inline && lang === 'mermaid') {
                              return <MermaidChart chart={String(children).replace(/\n$/, '')} />;
                            }

                            return !inline ? (
                              <div className="relative group/code">
                                <pre className={`${className} p-4 rounded-xl overflow-x-auto bg-slate-900/50 backdrop-blur-sm border border-slate-800 text-[13px] leading-relaxed shadow-lg mb-4`} {...props}>
                                  <code>{children}</code>
                                </pre>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(String(children));
                                    toast.success("Code copied to clipboard!");
                                  }}
                                  className="absolute top-3 right-3 p-2 bg-slate-800/80 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg opacity-0 group-hover/code:opacity-100 transition-all border border-slate-700/50 backdrop-blur-sm"
                                  title="Copy Code"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <code className="px-1.5 py-0.5 bg-slate-100 text-indigo-600 rounded-md font-medium" {...props}>
                                {children}
                              </code>
                            );
                          },
                          table: ({ children }) => (
                            <div className="overflow-x-auto mb-4 border border-slate-200 rounded-lg shadow-sm">
                              <table className="min-w-full divide-y divide-slate-200 text-xs">
                                {children}
                              </table>
                            </div>
                          ),
                          thead: ({ children }) => <thead className="bg-slate-50/80">{children}</thead>,
                          th: ({ children }) => <th className="px-3 py-2 text-left font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">{children}</th>,
                          td: ({ children }) => <td className="px-3 py-2 text-slate-600 border-b border-slate-100">{children}</td>
                        };

                        // [FIX] Updated regex to handle multiple citations in brackets like [pin-t0-1, nb-block-5, source-URL]
                        const citationRegex = /\[((?:(?:bi|nb|db|br|source)-block-[a-zA-Z0-9-]+|pin-[a-zA-Z0-9-]+|source-[a-zA-Z0-9\.\:/%-]+)(?:\s*,\s*(?:(?:bi|nb|db|br|source)-block-[a-zA-Z0-9-]+|pin-[a-zA-Z0-9-]+|source-[a-zA-Z0-9\.\:/%-]+))*)\]/gi;
                        let seenCitations = new Set(); // Track seen citations to avoid duplicates

                        const processedText = msg.text.replace(citationRegex, (match) => {
                          // Extract individual citation IDs from the bracket group
                          const citationIds = match.slice(1, -1) // Remove brackets
                            .split(',')
                            .map(id => id.trim())
                            .filter(id => id.length > 0);

                          // Convert each citation to a link, avoiding duplicates
                          const citationLinks = citationIds
                            .filter(id => {
                              if (seenCitations.has(id)) return false; // Skip duplicates
                              seenCitations.add(id);
                              return msg.citations?.some(c => c.blockId === id);
                            })
                            .map(id => `[●](#snap-cite-${id})`)
                            .join('');

                          return citationLinks || ''; // Return empty if no valid citations found
                        });

                        return (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={components}
                          >
                            {processedText}
                          </ReactMarkdown>
                        );
                      })()
                    )}
                  </div>

                  {/* Citations Grid */}
                  {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                    <div style={{
                      marginTop: '12px',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--border-light)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      {(() => {
                        // [FIX] Prioritize blocks belonging to THIS specific message
                        const allAvailableBlocks = [
                          ...(msg.contextBlocks || []),
                          ...(contentBlocks || []),
                          ...pinnedTabs.flatMap(t => t.blocks || [])
                        ];

                        console.log("[Citations] Available blocks:", allAvailableBlocks.map(b => ({ id: b.id, url: b.url })));
                        console.log("[Citations] Extracted citations:", msg.citations?.map(c => c.blockId));

                        // [FIX] Deduplicate citations by blockId to avoid showing the same citation twice
                        const seenBlockIds = new Set();
                        const uniqueCitations = msg.citations.filter(cite => {
                          if (seenBlockIds.has(cite.blockId)) return false;
                          seenBlockIds.add(cite.blockId);
                          return true;
                        });

                        return uniqueCitations
                          .filter(cite => {
                            // [FIX] In RAG / Research modes, show ALL citations regardless of URL
                            if (mode === 'rag' || mode === 'browser') {
                              const block = allAvailableBlocks.find(cb => cb.id === cite.blockId);
                              if (!block) {
                                console.warn(`[Citations] Block not found for citation: ${cite.blockId}, but showing anyway in RAG mode`);
                                // Show citation even if block not found - it might be from pinned tabs or other sources
                                return true;
                              }
                              return true;
                            }

                            const block = allAvailableBlocks.find(cb => cb.id === cite.blockId);
                            if (!block) {
                              console.warn(`[Citations] Block not found for citation: ${cite.blockId}`);
                              return false;
                            }

                            // Scoping for sidepanel context (Legacy behavior for specific modes)
                            const isPinned = pinnedTabs.some(t => t.url === block?.url || t.url === block?.sourceURL);
                            return isPinned || !currentUrl || block?.url === currentUrl || block?.sourceURL === currentUrl;
                          })
                          .map((cite, i) => {
                            const isBookmarked = bookmarks.some(b => {
                              const block = allAvailableBlocks.find(cb => cb.id === cite.blockId);
                              return b.content === block?.text;
                            });
                            return (
                              <CitationHoverCard
                                key={i}
                                citation={cite}
                                blocks={allAvailableBlocks}
                                onSave={handleSaveBookmark}
                                isBookmarked={isBookmarked}
                                onHighlight={handleCitationHighlight}
                              />
                            );
                          });
                      })()}
                    </div>
                  )}

                  {/* Timestamp & Actions */}
                  <div style={{
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-tertiary)'
                  }}>
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.text);
                          toast.success('Copied to clipboard');
                        }}
                        style={{
                          padding: '6px 10px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-light)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-secondary)',
                          transition: 'var(--transition-fast)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 'var(--font-medium)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--primary-50)';
                          e.currentTarget.style.color = 'var(--primary-600)';
                          e.currentTarget.style.borderColor = 'var(--primary-200)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-secondary)';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                          e.currentTarget.style.borderColor = 'var(--border-light)';
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 animate-pulse px-2">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                  <Bot className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="flex items-center gap-2 text-slate-400 bg-white/50 px-4 py-2 rounded-full border border-slate-100">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  <span className="text-xs font-medium tracking-wide">AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )
      }

      {/* Smart Suggestions UI */}
      {
        view === 'chat' && mode === 'rag' && messages.length <= 1 && (isSuggesting || suggestions.length > 0) && (
          <div style={{ padding: '0 16px 8px 16px', display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '40px' }}>
            {isSuggesting ? (
              // Skeleton Loaders
              <>
                <div className="animate-pulse bg-slate-200/60 rounded-full h-8 w-32"></div>
                <div className="animate-pulse bg-slate-200/60 rounded-full h-8 w-40"></div>
                <div className="animate-pulse bg-slate-200/60 rounded-full h-8 w-24"></div>
              </>
            ) : (
              suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(suggestion);
                    // We must use a short timeout so `input` state updates before sending, or manually trigger handleSend
                    setTimeout(() => handleSend(suggestion), 50);
                  }}
                  style={{
                    padding: '6px 14px',
                    background: 'linear-gradient(to right, var(--indigo-50), var(--blue-50))',
                    border: '1px solid var(--indigo-100)',
                    borderRadius: '16px',
                    color: 'var(--indigo-700)',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'normal',
                    textAlign: 'left',
                    lineHeight: '1.4'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    e.currentTarget.style.borderColor = 'var(--indigo-300)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    e.currentTarget.style.borderColor = 'var(--indigo-100)';
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  {suggestion}
                </button>
              ))
            )}
          </div>
        )
      }

      {/* Footer Input */}
      {view === 'chat' && (
        <footer className="relative flex-shrink-0 p-4 pt-2 bg-white/80 backdrop-blur-md border-t border-slate-200/60 transition-all focus-within:bg-white focus-within:shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.1)] min-h-[85px]">
          {/* Floating PIN TAB and Context Area - Outside footer flow to avoid shifting chat bar */}
          <div className="absolute bottom-[140px] right-4 flex flex-col items-end gap-2 pointer-events-none z-[40] transition-all duration-300">
            {/* Active Context Indicator */}
            {activeContext && activeContext.type === 'file' && (
              <div className="bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg cursor-pointer group hover:-translate-y-0.5 pointer-events-auto"
                onClick={() => setActiveContext({ type: 'url', id: currentUrl, name: 'Current Page' })}
                title="Click to clear and revert to web page"
              >
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-[pulse_2s_ease-in-out_infinite]"></div>
                <span className="text-[11px] font-bold text-indigo-700 max-w-[150px] truncate uppercase tracking-wider">Chatting with {activeContext.name}</span>
                <span className="text-indigo-400 group-hover:text-red-500 ml-1 font-bold text-sm">×</span>
              </div>
            )}

            {/* Floating PIN TAB Button */}
            {(!activeContext || activeContext.type === 'url') && currentUrl && !pinnedTabs.find(t => t.url === currentUrl) && mode === 'rag' && (
              <div className="bg-white/95 backdrop-blur border-2 border-indigo-200 px-4 py-2 rounded-2xl flex items-center justify-center gap-2 shadow-xl cursor-pointer hover:-translate-y-1 transition-all w-fit pointer-events-auto group ring-4 ring-indigo-500/5 hover:border-indigo-400 active:scale-95"
                onClick={async () => {
                  let blocks = contentBlocks;
                  if (blocks.length === 0) {
                    try {
                      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                      const extResponse = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONTENT' });
                      if (extResponse && extResponse.data) {
                        blocks = extResponse.data.blocks;
                        setContentBlocks(blocks);
                      }
                    } catch (e) {
                      console.error("Pin Tab Error:", e);
                      toast.error("Could not extract page. Please REFRESH this page and try again!");
                      return;
                    }
                  }
                  const handle = getSourceHandle(currentTabTitle);
                  const pinId = `pin-${handle}-`;
                  const blocksWithUniqueIds = blocks.map(b => ({
                    ...b,
                    id: pinId + b.id.replace(/^bi-block-/, ''),
                    url: currentUrl
                  }));
                  setPinnedTabs(prev => [...prev, { title: currentTabTitle || 'Pinned Tab', url: currentUrl, blocks: blocksWithUniqueIds }]);
                  toast.success("Tab pinned for Multi-Tab AI");
                }}
              >
                <Pin className="w-3.5 h-3.5 text-indigo-600 group-hover:rotate-12 transition-transform" />
                <span className="text-[12px] font-bold text-indigo-800 uppercase tracking-wide">Pin Tab</span>
              </div>
            )}

            {/* Compact Pinned Tabs List - Floating horizontally */}
            {pinnedTabs.length > 0 && (
              <div className="flex gap-2 mb-1 flex-wrap justify-end pointer-events-auto">
                {pinnedTabs.map((tab, idx) => (
                  <div key={idx} className="bg-indigo-100/90 border border-indigo-200 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-lg hover:shadow-xl transition-all text-[10px] font-bold text-indigo-900 tracking-wider uppercase backdrop-blur-sm animate-in zoom-in-50 duration-200">
                    <span className="max-w-[120px] truncate">{tab.title}</span>
                    <button className="hover:bg-indigo-200 p-0.5 rounded-md text-indigo-600 transition-colors" onClick={() => setPinnedTabs(prev => prev.filter((_, i) => i !== idx))}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Preview Area for Crop */}
          {cropPreview && (
            <div className="mb-3 flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-bottom-2">
              <img src={cropPreview} className="h-12 w-auto rounded-lg border border-slate-100" alt="Selection" />
              <div className="flex-1 text-xs text-slate-500">
                Region Selected. Ask a question about it below.
              </div>
              <button onClick={() => setCropPreview(null)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
                ✕
              </button>
            </div>
          )}

          {/* Preview Area for Pending File Attachment */}
          {pendingFile && (
            <div className="mb-3 flex flex-col gap-2 bg-white p-3 rounded-xl border border-indigo-200 shadow-sm animate-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <FileText className="w-6 h-6 text-indigo-500 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-slate-700 truncate">{pendingFile.name}</span>
                    <span className="text-xs text-slate-400 pl-0.5">{(pendingFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>
                <button type="button" onClick={() => setPendingFile(null)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition" disabled={isLoading}>
                  ✕
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <select
                  value={fileTargetLang}
                  onChange={(e) => setFileTargetLang(e.target.value)}
                  disabled={isLoading}
                  className="text-xs bg-slate-50 border border-slate-200 text-slate-600 rounded px-2 py-1 outline-none"
                >
                  <option value="auto">Keep Original Lang</option>
                  <option value="en">Translate to EN</option>
                  <option value="es">Translate to ES</option>
                  <option value="fr">Translate to FR</option>
                  <option value="de">Translate to DE</option>
                  <option value="ja">Translate to JA</option>
                  <option value="zh">Translate to ZH</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleFileUpload(pendingFile)}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition"
                >
                  {isLoading ? 'Uploading...' : 'Upload & Index'}
                </button>
              </div>
            </div>
          )}

          {/* Input Wrapper */}
          <div className="relative flex flex-col pt-1 pb-1">
            {/* Premium Chat Control Bar */}
            {(mode === 'rag' || mode === 'browser' || mode === 'visual') && (
              <div className="flex items-center justify-between px-3 py-1.5 mx-4 mb-2 bg-white/80 backdrop-blur-xl border border-slate-200/40 rounded-full shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] translate-y-1">
                <div className="flex items-center gap-1 pr-2 border-r border-slate-200/80">
                  <div className="flex gap-0.5">
                    {['auto', 'en', 'es', 'fr', 'de', 'it', 'ja'].map(lang => (
                      <button
                        key={lang}
                        onClick={() => setOutputLang(lang)}
                        className={`px-2 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${outputLang === lang
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-105'
                          : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50'
                          }`}
                      >
                        {lang === 'auto' ? 'AUTO' : lang}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center pl-2 pr-1">
                  <button
                    type="button"
                    onClick={() => setQueryNotebook(!queryNotebook)}
                    title={queryNotebook ? "Searching Research Notebook" : "Searching Global Knowledge"}
                    className={`p-2.5 rounded-full transition-all duration-300 ${queryNotebook
                      ? 'bg-amber-100 text-amber-600 shadow-md shadow-amber-100 scale-105 ring-2 ring-amber-50'
                      : 'bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="relative flex items-center group mt-2"
            >
              <input
                autoFocus
                type="text"
                className="w-full bg-slate-100/50 border border-slate-200 rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400 text-[13px] text-slate-700"
                placeholder={cropPreview ? "Ask about this selection..." : (queryNotebook ? "Ask about Research Notebook..." : (mode === 'rag' ? "Ask about page content..." : "Ask about the screen..."))}
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-md hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </footer>
      )}
      <Toaster richColors position="top-center" />

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </div >
  );
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
