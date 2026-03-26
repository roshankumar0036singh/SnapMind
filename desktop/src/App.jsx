import * as HoverCard from '@radix-ui/react-hover-card';
import 'highlight.js/styles/atom-one-dark.css';
import { Bot, Crop, Database, FileText, History, Loader2, Send, Settings as SettingsIcon, User, Sparkles, Github, Bookmark, Globe, Youtube, MessageSquare, Pin, Folder, RefreshCw, Clock, ExternalLink, ShieldCheck, Activity } from 'lucide-react';
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
import RefreshSuggestions from './components/RefreshSuggestions';
import AnalyticsView from './components/AnalyticsView';

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




  return (
    <div className="flex h-screen w-full bg-[#09090b] text-[#a1a1aa] font-sans overflow-hidden selection:bg-[#22c55e]/30 selection:text-white">
      {/* SIDEBAR NAVIGATION (240px) */}
      <aside className="w-[240px] bg-[#0b0b0d] border-r border-[#1a1a1d] flex flex-col z-50 pt-12">
        <div className="px-6 mb-8 group cursor-default">
          <div className="flex items-center gap-3 py-3 px-4 bg-[#111113] border border-[#27272a] rounded-xl shadow-inner">
             <div className="w-8 h-8 rounded-lg bg-[#09090b] border border-[#1a1a1d] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#22c55e]" />
             </div>
             <div className="min-w-0">
                <p className="text-[11px] font-black text-[#fafafa] tracking-wider uppercase">Mainframe</p>
                <p className="text-[9px] font-bold text-[#71717a] uppercase tracking-[0.2em] mt-0.5">Local Instance</p>
             </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5">
          {[
            { id: 'rag', label: 'Neural Chat', icon: MessageSquare },
            { id: 'memory', label: 'Vector Memory', icon: Database },
            { id: 'browser', label: 'Shadow Agent', icon: Globe },
            { id: 'visual', label: 'Vision Protocol', icon: Crop },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => { setMode(item.id); setView('chat'); if (item.id === 'visual') handleRegionScan(); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all group relative ${
                mode === item.id && view === 'chat'
                ? 'bg-[#111113] text-[#fafafa] border border-[#27272a] shadow-lg' 
                : 'text-[#71717a] hover:text-[#fafafa] hover:bg-[#111113]/50'
              }`}
            >
              {mode === item.id && view === 'chat' && (
                <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-[#22c55e] rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              )}
              <item.icon className={`w-4 h-4 transition-colors ${
                mode === item.id && view === 'chat' ? 'text-[#22c55e]' : 'group-hover:text-[#22c55e]'
              }`} />
              {item.label}
            </button>
          ))}
          
          <div className="pt-4 border-t border-[#1a1a1d] mt-4 space-y-1.5">
             <button
               onClick={() => setView('history')}
               className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all group ${
                 view === 'history' ? 'bg-[#111113] text-[#fafafa] border border-[#27272a]' : 'text-[#71717a] hover:text-[#fafafa]'
               }`}
             >
               <History className={`w-4 h-4 ${view === 'history' ? 'text-[#22c55e]' : ''}`} />
               Research Logs
             </button>
             <button
               onClick={() => setView('settings')}
               className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all group ${
                 view === 'settings' ? 'bg-[#111113] text-[#fafafa] border border-[#27272a]' : 'text-[#71717a] hover:text-[#fafafa]'
               }`}
             >
               <SettingsIcon className={`w-4 h-4 ${view === 'settings' ? 'text-[#22c55e]' : ''}`} />
               Controller
             </button>
          </div>
        </nav>

        <div className="p-6">
          <div className="p-4 rounded-xl bg-[#09090b] border border-[#1a1a1d] group hover:border-[#27272a] transition-all">
             <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#3f3f46]">Core Status</span>
                <div className="flex gap-1">
                   <div className="w-1 h-1 rounded-full bg-[#22c55e]" />
                   <div className="w-1 h-1 rounded-full bg-[#22c55e] opacity-50" />
                   <div className="w-1 h-1 rounded-full bg-[#22c55e] opacity-20" />
                </div>
             </div>
             <p className="text-[11px] font-bold text-[#fafafa] flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#22c55e]" />
                Secured
             </p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative">
        {/* DESKTOP TITLE BAR (Draggable) */}
        <div className="h-10 border-b border-[#1a1a1d] bg-[#09090b]/80 backdrop-blur-xl flex items-center justify-between px-6 z-50 shrink-0" style={{ WebkitAppRegion: 'drag' }}>
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse shadow-[0_0_8px_#22c55e]" />
             <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-[0.3em]">SnapMind <span className="text-[#3f3f46]">Console</span></span>
          </div>
          
          <div className="flex items-center -mr-2 no-drag" style={{ WebkitAppRegion: 'no-drag' }}>
             <button onClick={() => window.close()} className="p-2.5 hover:bg-neutral-800 transition-colors">
               <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                 <path d="M1 1L9 9M9 1L1 9" stroke="#71717a" strokeWidth="1.5" strokeLinecap="round"/>
               </svg>
             </button>
          </div>
        </div>

        {/* HEADER / TOOLBAR */}
        <header className="h-14 border-b border-[#1a1a1d] flex items-center justify-between px-8 bg-[#09090b]/40 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-4">
             <h2 className="text-sm font-bold tracking-tight text-[#fafafa] lowercase">
                ~/ {view === 'chat' ? (mode === 'rag' ? 'neural-chat' : mode === 'browser' ? 'shadow-agent' : 'vision-protocol') : view === 'memory' ? 'vector-memory' : view === 'settings' ? 'controller-config' : 'system-logs'}
             </h2>
             
             {currentUrl && (
                <div className="flex items-center gap-2 px-3 py-1 bg-[#111113] border border-[#27272a] rounded-full">
                  <Globe className="w-3 h-3 text-[#71717a]" />
                  <span className="text-[10px] font-bold text-[#a1a1aa] truncate max-w-[150px]">{new URL(currentUrl).hostname}</span>
                </div>
             )}
          </div>

          <div className="flex items-center gap-2">
             {mode === 'browser' && (
                <div className="flex items-center gap-2 pr-4 mr-2 border-r border-[#1a1a1d]">
                   <span className="text-[10px] font-black text-[#3f3f46] uppercase tracking-widest">Observer</span>
                   <button
                    onClick={() => setVisibleBrowser(!visibleBrowser)}
                    className={`w-7 h-3.5 rounded-full relative transition-all duration-300 ${visibleBrowser ? 'bg-[#22c55e]' : 'bg-[#1a1a1d]'}`}
                  >
                    <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all duration-300 ${visibleBrowser ? 'left-3.5' : 'left-0.5'}`} />
                  </button>
                </div>
             )}
             
             <button className="p-2 text-[#71717a] hover:text-[#fafafa] transition-colors rounded-lg hover:bg-[#111113]">
                <Activity className="w-4 h-4" />
             </button>
          </div>
        </header>


        {/* VIEW CONDITIONAL RENDERING */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {view === 'settings' ? (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#22c55e]" /></div>}>
               <Settings onBack={() => setView('chat')} />
            </Suspense>
          ) : view === 'history' ? (
            <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4">
               <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <Suspense fallback={<LoadingSkeleton type="card" count={3} />}>
                    <SessionList
                      sessions={sessions}
                      currentSessionId={currentSessionId}
                      onSessionSwitch={(id) => { switchSession(id); setView('chat'); }}
                      onSessionDelete={deleteSession}
                      onNewSession={() => { createNewSession(); setView('chat'); }}
                      onClearAll={clearAllHistory}
                    />
                  </Suspense>
               </div>
            </div>
          ) : view === 'memory' ? (
             <div className="flex-1 flex flex-col bg-[#0a0a0f] overflow-hidden">
               {/* Memory View Content will be here */}
               <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
                  <div className="flex p-1 bg-[#111113] border border-[#1a1a1d] rounded-xl mb-6 shadow-inner">
                    {[
                      { id: 'sites', label: 'Nodes', icon: FileText },
                      { id: 'graph', label: 'Atlas', icon: Database },
                      { id: 'bookmarks', label: 'Library', icon: Bookmark },
                      { id: 'folders', label: 'Sync', icon: Folder },
                      { id: 'updates', label: 'Maintenance', icon: RefreshCw },
                      { id: 'stats', label: 'Analytics', icon: Activity },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setMemoryTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
                          memoryTab === tab.id 
                          ? 'bg-[#1a1a1d] text-[#22c55e] border border-[#27272a] shadow-sm' 
                          : 'text-[#71717a] hover:text-[#a1a1aa]'
                        }`}
                      >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="mb-8 p-6 bg-[#111113] border border-[#1a1a1d] rounded-2xl relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-[#22c55e]/5 rounded-full blur-3xl" />
                     <h2 className="text-lg font-bold text-[#fafafa] tracking-tight">
                       {memoryTab === 'sites' ? 'Indexed Nodes' : memoryTab === 'graph' ? 'Knowledge Atlas' : memoryTab === 'updates' ? 'Maintenance Protocol' : memoryTab === 'stats' ? 'Neural Analytics' : 'Research Library'}
                     </h2>
                     <p className="text-xs text-[#71717a] mt-1 max-w-[400px]">
                       {memoryTab === 'sites' ? 'Manage your semantic index of web pages and local documents.' : 'Explore the interconnected web of your local knowledge base.'}
                     </p>
                  </div>

                  {/* Rest of Memory Content... will be handled after fixing bottom tags */}
               </div>
             </div>
          ) : (
             <div className="flex-1 flex flex-col overflow-hidden">
                {/* CHAT/MESSAGE WORKSPACE */}
                <div 
                  id="message-container"
                  className="flex-1 overflow-y-auto px-8 pt-8 pb-4 space-y-6 custom-scrollbar"
                >
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-50">
                      <div className="w-16 h-16 rounded-2xl bg-[#111113] border border-[#1a1a1d] flex items-center justify-center mb-6">
                        <Terminal className="w-8 h-8 text-[#22c55e]" />
                      </div>
                      <h3 className="text-sm font-bold text-[#fafafa] tracking-widest uppercase">Neural Terminal Active</h3>
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
                            <Sparkles className="w-4 h-4 text-[#22c55e]" />
                          </div>
                        )}
                        
                        <div className={`max-w-[85%] group relative ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
                          <div className={`
                            px-5 py-4 rounded-xl border transition-all duration-300
                            ${msg.role === 'user' 
                              ? 'bg-[#111113] border-[#22c55e]/20 text-[#fafafa] shadow-[0_0_20px_rgba(34,197,94,0.05)]' 
                              : 'bg-[#111113] border-[#1a1a1d] text-[#a1a1aa] shadow-sm'}
                          `}>
                            {/* Message Header (Internal Metadata) */}
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
                                      if (inline) return <code className="bg-[#1a1a1d] text-[#22c55e] px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                                      return (
                                        <div className="my-4 border border-[#1a1a1d] rounded-lg overflow-hidden bg-[#0a0a0f]">
                                          <div className="px-4 py-2 border-b border-[#1a1a1d] bg-[#111113] flex items-center justify-between">
                                            <span className="text-[10px] font-black text-[#71717a] uppercase tracking-widest">{className?.replace('language-', '') || 'Code'}</span>
                                            <button className="text-[#3f3f46] hover:text-[#22c55e] transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                                          </div>
                                          <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-[#a1a1aa]"><code>{children}</code></pre>
                                        </div>
                                      )
                                    },
                                    a: ({href, children}) => <a href={href} target="_blank" className="text-[#22c55e] underline decoration-[#22c55e]/30 underline-offset-4 hover:decoration-[#22c55e] transition-all">{children}</a>
                                  }}
                                >
                                  {msg.text}
                                </ReactMarkdown>
                              )}
                            </div>

                            {/* Citations Grid */}
                            {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-[#1a1a1d] flex flex-wrap gap-2">
                                {msg.citations.map((cite, i) => (
                                  <CitationHoverCard 
                                    key={i} 
                                    citation={cite} 
                                    blocks={[...(msg.contextBlocks || []), ...(contentBlocks || [])]}
                                    onHighlight={handleCitationHighlight}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {msg.role === 'user' && (
                          <div className="w-8 h-8 rounded-lg bg-[#22c55e] border border-[#22c55e]/20 flex items-center justify-center shrink-0 mt-1 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                            <User className="w-4 h-4 text-black" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {isLoading && (
                    <div className="flex gap-4 animate-pulse">
                       <div className="w-8 h-8 rounded-lg bg-[#111113] border border-[#1a1a1d] flex items-center justify-center">
                          <Loader2 className="w-4 h-4 text-[#22c55e] animate-spin" />
                       </div>
                       <div className="px-5 py-3 rounded-xl bg-[#111113] border border-[#1a1a1d] flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3f3f46]">Processing Neural Request...</span>
                       </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* CHAT INPUT AREA */}
                <footer className="px-8 pb-8 pt-4">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-[#22c55e]/5 rounded-2xl blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                    <form 
                      onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                      className="relative bg-[#111113] border border-[#1a1a1d] rounded-2xl focus-within:border-[#22c55e]/40 transition-all shadow-xl"
                    >
                      <input 
                        className="w-full bg-transparent border-none pl-6 pr-16 py-5 focus:outline-none text-[14px] text-[#fafafa] placeholder:text-[#3f3f46] font-medium"
                        placeholder="Invoke query or command..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                      />
                      <button 
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-3 top-3 bottom-3 px-5 bg-[#22c55e] text-black rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[#16a34a] transition-all disabled:opacity-20 disabled:grayscale active:scale-95 shadow-lg shadow-[#22c55e]/10"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </form>
                  </div>
                  
                  <div className="mt-4 flex items-center justify-center gap-6">
                     <button 
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
                              toast.error("Could not extract page context.");
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
                          toast.success("Current context pinned.");
                        }}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#3f3f46] hover:text-[#22c55e] transition-colors"
                     >
                        <Pin className="w-3 h-3" /> Pin Current
                     </button>
                     <div className="h-3 w-[1px] bg-[#1a1a1d]" />
                     <button 
                        onClick={() => setView('memory')}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#3f3f46] hover:text-[#22c55e] transition-colors"
                     >
                        <Bookmark className="w-3 h-3" /> Library
                     </button>
                  </div>
                </footer>
             </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

