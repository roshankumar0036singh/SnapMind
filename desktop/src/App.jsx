import * as HoverCard from '@radix-ui/react-hover-card';
import 'highlight.js/styles/atom-one-dark.css';
import { 
  Bot, Crop, Database, FileText, History, Loader2, Send, Settings as SettingsIcon, User, 
  Sparkles, GitBranch, Bookmark, Globe, Video, MessageSquare, Pin, Folder, RefreshCw, 
  Clock, ExternalLink, ShieldCheck, Activity, Copy, Download, Camera, X, BookOpen, 
  Search, Terminal, Share2, Trash2, Layout, Zap, Layers, Cpu, Code
} from 'lucide-react';
import BotLogo from './components/BotLogo';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { toast, Toaster } from 'sonner';
import { apiClient, chrome } from './background/api';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSkeleton from './components/LoadingSkeleton';
import IngestModal from './components/IngestModal';
import ShortcutsModal from './components/ShortcutsModal';
import GraphMap from './components/GraphMap';
import SpotlightModal from './components/SpotlightModal';
import * as ReactWindow from 'react-window';
const List = ReactWindow.FixedSizeList || (ReactWindow.default && ReactWindow.default.FixedSizeList);
import { motion, AnimatePresence } from 'framer-motion';
import './styles/design-tokens.css';

// Lazy load heavy components for better initial load
const Settings = lazy(() => import('./components/Settings'));
const SessionList = lazy(() => import('./components/SessionList'));
import MermaidChart from './components/MermaidChart';
import WatchFoldersPanel from './components/WatchFoldersPanel';
import RefreshSuggestions from './components/RefreshSuggestions';
import AnalyticsView from './components/AnalyticsView';
import Onboarding from './components/Onboarding';
import SplashScreen from './components/SplashScreen';
import SiteList from './components/SiteList';
import BookmarkList from './components/BookmarkList';
import PersonaSelector from './components/PersonaSelector';
import NotebookPanel from './components/NotebookPanel';
import LanguageSelector from './components/LanguageSelector';
import ClipboardBubble from './components/ClipboardBubble';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import MemoryView from './components/MemoryView';
import InputArea from './components/InputArea';
import CitationPanel from './components/CitationPanel';
import CitationHoverCard from './components/CitationHoverCard';
import AuthView from './components/AuthView';
import { supabase } from './supabaseClient';

// Custom Markdown Components





// [REMOVED] Internal components extracted to separate files

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


function App() {
  const [showSplash, setShowSplash] = useState(true); // Always show splash on mount
  const [isOnboarded, setIsOnboarded] = useState(() => localStorage.getItem('snapmind_onboarded') === 'true');
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
  const [selectedPersonaId, setSelectedPersonaId] = useState(null); // [NEW] Feature 21: Custom Agent Personas
  const [suggestions, setSuggestions] = useState([]); // Feature 4: Smart Suggestions
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [spotlightVisionData, setSpotlightVisionData] = useState(null); // [NEW] Feature 9: Screen Intel
  const [isFocusMode, setIsFocusMode] = useState(false); // [NEW] Feature 22: Focus Mode
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
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false); // [NEW] Ingest Modal
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
  
  // [NEW] Phase 16: Citation Side Panel
  const [selectedCitation, setSelectedCitation] = useState(null);
  const [isCitationPanelOpen, setIsCitationPanelOpen] = useState(false);
  const [citationSummary, setCitationSummary] = useState('');
  const [isSummarizingCitation, setIsSummarizingCitation] = useState(false);

  // [NEW] Synthesize Mode / Report states
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportQuery, setReportQuery] = useState('');
  const [selectedSources, setSelectedSources] = useState([]); // List of source URLs
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);

  const handleProfessionalReport = async (query, sources) => {
    setIsGeneratingReport(true);
    const toastId = toast.loading(`📑 Synthesizing Professional Report for: ${query}...`, { duration: Infinity });
    
    try {
      const blob = await apiClient.generateReport(currentSessionId, query, sources.length > 0 ? sources : null);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SnapMind_Research_Report_${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("✅ Professional Report Generated!", { id: toastId });
      setIsReportModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(`❌ Synthesis Failed: ${err.message}`, { id: toastId });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null); // For Ctrl+K focus
  const fileInputRef = useRef(null); // Used by manual generic file clicks

  // [NEW] Phase 22: Ingestion Tracking & Visual Search
  const [ingestions, setIngestions] = useState([]); // Array of { id, filename, status: 'processing'|'completed'|'error' }
  const [isCapturing, setIsCapturing] = useState(false);
  const [jobStatus, setJobStatus] = useState({ status: 'idle', message: '', progress: 0 });

  const handleVisualSearch = async () => {
    if (!window.electronAPI) return;
    setIsCapturing(true);
    const toastId = toast.loading("Capturing high-fidelity system screenshot...", { duration: Infinity });
    
    try {
      const { success, data, error } = await window.electronAPI.captureScreen();
      if (!success) throw new Error(error || "Screenshot failed");
      
      // POST to SnapMind cache
      const baseUrl = await apiClient.getBaseUrl();
      const response = await fetch(`${baseUrl}/api/vision/cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: data })
      });
      
      if (!response.ok) throw new Error("Backend cache sync failed");
      
      const resData = await response.json();
      setCropPreview(data);
      setMode('visual');
      toast.success("Visual Context Ingested", { id: toastId });
      
      // Auto-trigger a visual analysis
      setInput("Describe and analyze this visual state for current research.");
    } catch (err) {
      console.error(err);
      toast.error(`Visual Capture Failed: ${err.message}`, { id: toastId });
    } finally {
      setIsCapturing(false);
    }
  };

  const handleDocumentDrop = async (files) => {
    const newIngestions = files.map(f => ({ 
      id: Math.random().toString(36).substr(2, 9), 
      filename: f.name, 
      status: 'processing',
      message: 'Initial Sync...',
      progress: 0
    }));
    setIngestions(prev => [...prev, ...newIngestions]);

    newIngestions.forEach(async (ing) => {
      // Setup Polling
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await apiClient.getIngestStatus(currentSessionId);
          if (statusRes && statusRes.status === 'processing') {
            setIngestions(prev => prev.map(i => i.id === ing.id ? { 
              ...i, 
              message: statusRes.message, 
              progress: statusRes.progress 
            } : i));
          }
        } catch (e) {
          // Silent polling error
        }
      }, 2000);

      try {
        const file = files.find(f => f.name === ing.filename);
        const res = await apiClient.ingestFile(file, currentSessionId);
        
        clearInterval(pollInterval);

        if (res.success) {
          setIngestions(prev => prev.map(i => i.id === ing.id ? { ...i, status: 'completed', message: 'Neural Sync Ready', progress: 100 } : i));
          setTimeout(() => {
             setIngestions(prev => prev.filter(i => i.id !== ing.id));
          }, 5000);
        } else {
          setIngestions(prev => prev.map(i => i.id === ing.id ? { ...i, status: 'error', message: res.error || 'Sync Fault' } : i));
          setTimeout(() => {
             setIngestions(prev => prev.filter(i => i.id !== ing.id));
          }, 5000);
        }
      } catch (err) {
        clearInterval(pollInterval);
        setIngestions(prev => prev.map(i => i.id === ing.id ? { ...i, status: 'error', message: 'Connection Error' } : i));
        setTimeout(() => {
           setIngestions(prev => prev.filter(i => i.id !== ing.id));
        }, 5000);
      }
    });
  };

  // --- Phase 15-20: Deep Link Listener ---
  const [isCodeSynthesisOpen, setIsCodeSynthesisOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');

  // [NEW] Ingestion Sweeper: Ensure no status message stays longer than 30s regardless of results
  useEffect(() => {
    const interval = setInterval(() => {
      setIngestions(prev => prev.filter(ing => {
        // If it's been processing for > 60s or error/completed for > 15s, clear it
        // Since we don't have a timestamp, we'll just clear error/completed items that might have missed their timeout
        if (ing.status !== 'processing') return false; 
        return true; 
      }));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onDeepLink) {
      const unsubscribe = window.electronAPI.onDeepLink(async (url) => {
        console.log("Received Deep Link:", url);
        try {
          const urlObj = new URL(url);
          const cacheId = urlObj.searchParams.get('cache_id');
          if (!cacheId) return;

          if (url.includes('snapmind://vision')) {
            const baseUrl = await apiClient.getBaseUrl();
            const res = await fetch(`${baseUrl}/api/vision/cache/${cacheId}`);
            if (res.ok) {
              const data = await res.json();
              if (data.image) {
                setCropPreview(data.image);
                setMode('visual');
                setInput("Describe and analyze this visual context in detail.");
                toast.success("Visual Search Request Received", { icon: "👁️" });
              }
            }
          } else if (url.includes('snapmind://code')) {
            const baseUrl = await apiClient.getBaseUrl();
            const res = await fetch(`${baseUrl}/api/vision/cache/${cacheId}`);
            if (res.ok) {
              const data = await res.json();
              if (data.text_data) {
                setGeneratedCode(data.text_data);
                setIsCodeSynthesisOpen(true);
                toast.success("UI Component Reverse-Engineered", { icon: "⚡" });
              }
            }
          }
        } catch(e) {
          console.error("Failed handling deep link:", e);
        }
      });
      return unsubscribe;
    }
  }, []);



  const handleCitationHighlight = (blockId, url, snippet = "", pageNum = null, block = null) => {
    // [NEW] Phase 16: Open Side Panel instead of just highlighting/redirecting
    setSelectedCitation({ blockId, url, snippet, pageNum, block });
    setIsCitationPanelOpen(true);
    setCitationSummary(''); // Clear previous summary
    
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

      // Ctrl+Shift+Space: Global Spotlight
      if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        setIsSpotlightOpen(prev => !prev);
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

  // Hoisted Fetchers
  const loadSites = async () => {
    const data = await apiClient.getSites();
    setSites(data);
  };

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

  const loadHistory = async () => {
    const result = await chrome.storage.local.get(['chatSessions', 'currentSessionId']);
    const savedSessions = result.chatSessions || [];
    const savedSessionId = result.currentSessionId;

    if (savedSessions.length > 0) {
      setSessions(savedSessions);
      if (savedSessionId) {
        const session = savedSessions.find(s => s.id === savedSessionId);
        if (session) {
          setCurrentSessionId(savedSessionId);
          setMessages(session.messages || [{ id: '1', role: 'assistant', text: 'Hello! Choose a mode to start analyzing this page.' }]);
          return;
        }
      }
    }
    createNewSession();
  };

  // Load sites on mount
  useEffect(() => {
    loadSites();
  }, []);

  // Load conversation history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  // [NEW] Feature: Real-time Bookmark Sync & Citation State
  useEffect(() => {
    loadBookmarks();
  }, []);

  // [NEW] Phase 5: Global Job Status Subscription (SSE)
  useEffect(() => {
    if (!currentSessionId) return;

    let unsubscribe = null;
    const startSse = async () => {
      unsubscribe = await apiClient.subscribeJobUpdates(currentSessionId, (update) => {
        console.log("[SSE Update]", update);
        setJobStatus({
          status: update.status || 'processing',
          message: update.message || '',
          progress: update.progress || 0
        });
        
        // If it's a completion or failure, we might want to clear it after a delay
        if (update.status === 'completed' || update.status === 'failed') {
          setTimeout(() => {
            setJobStatus(prev => (prev.message === update.message ? { status: 'idle', message: '', progress: 0 } : prev));
          }, 8000);
          
          // Refresh state
          if (update.status === 'completed') {
            loadHistory();
            loadSites();
          }
        }
      });
    };

    startSse();
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') unsubscribe();
    };
  }, [currentSessionId]);

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
      // Ctrl+I: Index current page (Now shows Unified Ingest Modal)
      if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        if (!isLoading) {
          setIsIngestModalOpen(true);
        }
      }
      // Feature 22: Focus Mode Toggle
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setIsFocusMode(prev => !prev);
        toast.success(isFocusMode ? 'Focus Mode: OFF' : 'Focus Mode: ON — Esc to exit', { duration: 1500 });
      }
      // Esc exits focus mode
      if (e.key === 'Escape' && isFocusMode) {
        setIsFocusMode(false);
        toast.success('Focus Mode: OFF', { duration: 1500 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, currentUrl, isFocusMode]);

  // [NEW] Feature 9: Universal Screen Intelligence Listener & other Electron listeners
  useEffect(() => {
    if (window.electronAPI) {
      const unsubscribeVision = window.electronAPI.onVisionSpotlight((data) => {
        setSpotlightVisionData(data.image); // data.image is the base64 screenshot
        setIsSpotlightOpen(true);
      });
      
      const unsubscribeFocus = window.electronAPI.onToggleFocusMode(() => {
        setIsFocusMode(prev => !prev);
        toast.success(`Focus Mode ${!isFocusMode ? 'Enabled' : 'Disabled'}`);
      });

      const unsubscribeSync = window.electronAPI.onTriggerSync(() => {
        toast.info("Knowledge Sync Triggered...");
        // Trigger refresh logic (SiteList or global RAG sync)
        setView('chat');
        setMode('rag');
      });

      return () => {
        unsubscribeVision();
        unsubscribeFocus();
        unsubscribeSync();
      };
    }
  }, [isFocusMode]);

  // [NEW] Feature 9: Trigger Vision Query from Spotlight
  useEffect(() => {
    const handleTriggerVision = (e) => {
      const { query, image } = e.detail;
      setMode('visual');
      setCropPreview(image);
      setInput(query);
      // We use a small timeout to let the state update before sending
      setTimeout(() => {
        handleSend(query, 'visual');
      }, 100);
    };

    window.addEventListener('trigger-vision-query', handleTriggerVision);
    return () => window.removeEventListener('trigger-vision-query', handleTriggerVision);
  }, []);

  // [NEW] Update Greeting on Mode Switch if session is fresh
  useEffect(() => {
    if (messages.length === 1 && messages[0].role === 'assistant' && !messages[0].userContext) {
      let newGreeting = 'Hello! Choose a mode to start analyzing this page.';
      if (mode === 'browser') newGreeting = 'Shadow Agent Online. Ready to execute browser automation and multi-agent research.';
      else if (mode === 'visual') newGreeting = 'Vision Protocol Active. Select a region on the page to analyze with multimodal intelligence.';
      else if (mode === 'rag') newGreeting = 'Neural Chat Synchronized. I have access to your pinned context and the current page memory.';
      
      setMessages([{ ...messages[0], text: newGreeting }]);
    }
  }, [mode]);

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
    let initialMessage = 'Hello! Choose a mode to start analyzing this page.';
    if (mode === 'browser') {
      initialMessage = 'Shadow Agent Online. Ready to execute browser automation and multi-agent research.';
    } else if (mode === 'visual') {
      initialMessage = 'Vision Protocol Active. Select a region on the page to analyze with multimodal intelligence.';
    } else if (mode === 'rag') {
      initialMessage = 'Neural Chat Synchronized. I have access to your pinned context and the current page memory.';
    }

    const newSession = {
      id: newSessionId,
      title: 'New Session',
      messages: [{ id: '1', role: 'assistant', text: initialMessage }],
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

  const lastScrollTime = useRef(0);
  useEffect(() => {
    const now = Date.now();
    if (now - lastScrollTime.current > 100) { // Throttle scroll to 10fps
      scrollToBottom();
      lastScrollTime.current = now;
    }
  }, [messages, view, cropPreview]);

  // loadBookmarks is defined earlier (L701) using apiClient.getBookmarks()

  useEffect(() => {
    if (view === 'memory' && memoryTab === 'bookmarks') {
      loadBookmarks();
    }
  }, [view, memoryTab]);

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

  const handleIngest = async (urlToIngest, crawlMode = null) => {
    // Validate URL (just in case)
    let url;
    try {
      url = new URL(urlToIngest);
      if (!['http:', 'https:'].includes(url.protocol)) {
        toast.error('Can only index HTTP/HTTPS pages');
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
    
    let modeConfig = crawlMode;

    if (isYouTube || isTwitter) {
      modeConfig = { mode: 'single', max_pages: 1, max_depth: 1 };
    } else if (!modeConfig) {
        // If no crawl mode provided yet, we should have opened the modal instead.
        // This is a safety fallback.
        setIsIngestModalOpen(true);
        return;
    }

    await performIngest(urlToIngest, modeConfig);
  };

  const performIngest = async (url, crawlOptions) => {
    setIsLoading(true);
    const toastId = toast.loading(
      crawlOptions.mode === 'multi'
        ? "🌐 Starting multi-page crawl..."
        : "📄 Scraping page content..."
    );
    setIngestStatus({ status: 'processing', message: 'Connecting to ingest backend...', progress: 5 });

    try {
      const response = await apiClient.streamIngest(
        url,
        null,
        currentSessionId,
        (progressEvent) => {
          if (progressEvent.status === 'processing' || progressEvent.status === 'completed') {
            setIngestStatus({
              status: progressEvent.status,
              message: progressEvent.message,
              progress: progressEvent.progress || 50
            });
            // Update toast optionally
            if (progressEvent.progress && progressEvent.progress % 20 === 0 && progressEvent.progress < 100) {
               toast.loading(progressEvent.message, { id: toastId });
            }
          }
        },
        crawlOptions.mode,
        crawlOptions.max_pages || 10,
        crawlOptions.max_depth || 3
      );

      if (response.success && response.status !== 'failed') {
        const msg = crawlOptions.mode === 'multi'
          ? `Crawled ${response.pages_indexed || response.pages_crawled || 'multiple'} pages, ${response.total_chunks || response.chunks_count || 0} chunks indexed`
          : `Indexed chunks successfully`;
        
        toast.success(msg, { id: toastId });
        setIngestStatus(null);
        setExternalUrl('');

        if (url !== currentUrl) {
          let displayUrl = url;
          try {
            const u = new URL(url);
            displayUrl = u.hostname + (u.pathname === '/' ? '' : u.pathname.substring(0, 20));
          } catch (e) { }
          setActiveContext({ type: 'url', id: url, name: displayUrl });
        }
        setLastFailedAction(null);
      } else {
        throw new Error(response.error || response.message || "Ingestion failed without explicit error");
      }
    } catch (err) {
      console.error(err);
      setIngestStatus(null);
      setLastFailedAction({ type: 'ingest', url: url });
      toast.error(`Error: ${err.message}`, {
        id: toastId,
        action: { label: 'Retry', onClick: () => handleIngest(url) },
        actionButtonStyle: { backgroundColor: '#3b82f6', color: 'white' }
      });
    } finally {
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

  const handleSummarizeCitation = async () => {
    if (!selectedCitation) return;
    setIsSummarizingCitation(true);
    try {
      const blockText = selectedCitation.block?.text || selectedCitation.snippet || '';
      if (!blockText) {
        toast.error("No content available to summarize.");
        return;
      }
      const response = await apiClient.chat({
        query: "Provide a concise, professional summary of this specific document snippet. Focus on key data points and conclusions.",
        content_blocks: [{
          id: selectedCitation.blockId,
          text: blockText,
          source_url: selectedCitation.url
        }],
        page_content: blockText,
        session_id: currentSessionId
      });
      setCitationSummary(response.answer || response.text || 'Summary unavailable.');
    } catch (e) {
      console.error("Summarization failed:", e);
      toast.error("Neural Synthesis failed for this block.");
    } finally {
      setIsSummarizingCitation(false);
    }
  };

  // [NEW] Feature 6: Clipboard Action Handler
  const handleClipboardAction = async (actionId, clip) => {
    switch (actionId) {
      case 'summarize':
        setMode('rag');
        setInput(`Summarize this text: ${clip.content}`);
        handleSend(`Summarize this text: ${clip.content}`, 'rag');
        break;
      case 'translate':
        setMode('rag');
        setInput(`Translate this text to ${outputLang === 'auto' ? 'English' : outputLang}: ${clip.content}`);
        handleSend(`Translate this text to ${outputLang === 'auto' ? 'English' : outputLang}: ${clip.content}`, 'rag');
        break;
      case 'explain_code':
        setMode('rag');
        setInput(`Explain this code snippet and suggest improvements: \n\n\`\`\`\n${clip.content}\n\`\`\``);
        handleSend(`Explain this code snippet and suggest improvements: \n\n\`\`\`\n${clip.content}\n\`\`\``, 'rag');
        break;
      case 'crawl_url':
        setMode('rag');
        setExternalUrl(clip.content);
        setInput(`Analyze what this page is about: ${clip.content}`);
        handleSend(`Analyze what this page is about: ${clip.content}`, 'rag');
        break;
      case 'analyze_vision':
        setMode('visual');
        setCropPreview(clip.content); // Base64 image
        setInput("What is in this image?");
        handleSend("What is in this image?", 'visual');
        break;
      case 'ocr_to_chat':
        setMode('visual');
        setCropPreview(clip.content);
        setInput("Perform OCR and extract all text from this image.");
        handleSend("Perform OCR and extract all text from this image.", 'visual');
        break;
      case 'add_to_pins':
        try {
          const response = await apiClient.crawlUrl(clip.content);
          if (response.blocks) {
             setPinnedTabs(prev => [...prev, { title: response.title || 'Pinned Clip', url: clip.content, blocks: response.blocks }]);
             toast.success("URL content pinned successfully!");
          }
        } catch (e) {
          toast.error("Failed to pin URL");
        }
        break;
      default:
        break;
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
            fullText += token;
            
            // [NEW] Incremental Citation Extraction
            const citationRegex = /((?:bi|nb|db|br|source)-block-[a-zA-Z0-9-]+|pin-[a-zA-Z0-9-]+|source-[a-zA-Z0-9\.\:/%-]+)/gi;
            const currentCitations = [];
            let match;
            while ((match = citationRegex.exec(fullText)) !== null) {
              const blockId = match[1];
              if (!currentCitations.find(c => c.blockId === blockId)) {
                let snippet = `Source ${blockId.replace(/^(bi-block-|nb-block-|db-block-|br-block-|source-block-)/, '')}`;
                if (blockId.startsWith('pin-')) {
                  const parts = blockId.split('-');
                  snippet = `Pinned Tab ${parseInt(parts[1].replace('t', '')) + 1} #${parts[parts.length - 1]}`;
                } else if (blockId.startsWith('source-')) {
                  snippet = "Site Header";
                }
                currentCitations.push({ blockId, snippet });
              }
            }

            if (isFirstToken) {
              isFirstToken = false;
              setIsLoading(false);
              setMessages(prev => [...prev, {
                id: aiMsgId,
                role: 'assistant',
                text: fullText,
                citations: currentCitations
              }]);
            } else {
              setMessages(currentMessages =>
                currentMessages.map(m => m.id === aiMsgId ? { ...m, text: fullText, citations: currentCitations } : m)
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
          targetSiteId, currentSessionId, search_query, query_lang, outputLang, queryNotebook, selectedPersonaId);

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

  // handleCitationHighlight is defined at L359
  // handleSummarizeCitation is defined at L1529
  // handleRegionScan is defined at L1436

  // --- Splash & Onboarding Gate ---
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (!isOnboarded) {
    return <Onboarding onComplete={() => setIsOnboarded(true)} />;
  }

  return (
    <div className="flex h-screen bg-[#07070a] text-[#fafafa] font-sans selection:bg-[#6366f1]/30 overflow-hidden">
      <Toaster 
        theme="dark" 
        position="top-right" 
        toastOptions={{
          style: { background: '#0f0f14', border: '1px solid #1e1e26', color: '#fafafa' }
        }} 
      />

      <Sidebar 
        mode={mode} 
        view={view} 
        isFocusMode={isFocusMode}
        onSetMode={setMode}
        onSetView={setView}
        onRegionScan={handleRegionScan}
        jobStatus={jobStatus}
      />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative">
        
        {/* DRAG AND DROP OVERLAY */}
        {isDragging && (
          <div className="absolute inset-0 z-[9999] bg-[#09090b]/90 backdrop-blur-md flex flex-col items-center justify-center border-2 border-dashed border-[#6366f1] m-4 rounded-[32px] animate-in fade-in duration-200 pointer-events-none">
             <div className="w-24 h-24 rounded-3xl bg-[#6366f1]/10 flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(99,102,241,0.2)] animate-pulse">
               <FileText className="w-12 h-12 text-[#6366f1]" />
             </div>
             <h2 className="text-3xl font-black text-[#fafafa] tracking-widest uppercase font-display">Drop Files to Neural Core</h2>
             <p className="text-[#a1a1aa] mt-3 tracking-widest uppercase text-xs font-bold bg-[#111113] px-4 py-2 rounded-full border border-[#27272a]">Files will be vectorized instantly</p>
          </div>
        )}

        <Header 
          isFocusMode={isFocusMode}
          onSetFocusMode={setIsFocusMode}
          view={view}
          mode={mode}
          currentUrl={currentUrl}
          visibleBrowser={visibleBrowser}
          onSetVisibleBrowser={setVisibleBrowser}
          isCitationPanelOpen={isCitationPanelOpen}
          onCloseCitationPanel={() => setIsCitationPanelOpen(false)}
          onSetView={setView}
        />

        {/* VIEW CONDITIONAL RENDERING */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={view + (view === 'chat' ? mode : '')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-0 flex flex-col overflow-hidden"
            >
              {view === 'settings' ? (
                <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#6366f1]" /></div>}>
                  <Settings onBack={() => setView('chat')} />
                </Suspense>
              ) : view === 'history' ? (
                <div className="flex-1 flex flex-col overflow-hidden">
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
              ) : view === 'memory' ? (
                <MemoryView 
                  memoryTab={memoryTab}
                  onSetMemoryTab={setMemoryTab}
                  graphData={graphData}
                  isLoading={isLoading}
                  bookmarks={bookmarks}
                  bookmarksLoading={bookmarksLoading}
                  loadBookmarks={loadBookmarks}
                  onContextSelect={setSelectedSiteId}
                  onSessionSwitch={(id) => { switchSession(id); setView('chat'); }}
                  onSetView={setView}
                  graphSessions={graphSessions}
                  selectedGraphSession={selectedGraphSession}
                  onSelectGraphSession={handleSelectGraphSession}
                  onBackToSessions={handleBackToSessions}
                />
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 relative flex flex-col overflow-hidden">
                    <ChatArea 
                      messages={messages}
                      isLoading={isLoading}
                      contentBlocks={contentBlocks}
                      onCitationHighlight={handleCitationHighlight}
                      onCopy={(text) => {
                        const cleanText = text ? text.replace(/\[(?:br|bi|nb|db)-block-[a-zA-Z0-9-]+\]/gi, '').trim() : '';
                        navigator.clipboard.writeText(cleanText);
                        toast.success("Response copied to clipboard");
                      }}
                      onSynthesis={(text) => {
                        setReportQuery(text?.substring(0, 100).replace(/\[(?:br|bi|nb|db)-block-[a-zA-Z0-9-]+\]/gi, '').trim() + "...");
                        setIsReportModalOpen(true);
                      }}
                      messagesEndRef={messagesEndRef}
                    />

                    <InputArea 
                      input={input}
                      onSetInput={setInput}
                      onSend={handleSend}
                      isLoading={isLoading}
                      cropPreview={cropPreview}
                      onSetCropPreview={setCropPreview}
                      pinnedTabs={pinnedTabs}
                      onRemovePinnedTab={(idx) => setPinnedTabs(prev => prev.filter((_, i) => i !== idx))}
                      selectedPersonaId={selectedPersonaId}
                      onSelectPersona={setSelectedPersonaId}
                      outputLang={outputLang}
                      onSetOutputLang={setOutputLang}
                      queryNotebook={queryNotebook}
                      onSetQueryNotebook={setQueryNotebook}
                      onPinCurrent={async () => {
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
                        toast.success("Context pinned.");
                      }}
                      onSetView={setView}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <CitationPanel 
            isOpen={isCitationPanelOpen}
            onClose={() => setIsCitationPanelOpen(false)}
            citation={selectedCitation}
            summary={citationSummary}
            isSummarizing={isSummarizingCitation}
            onSummarize={handleSummarizeCitation}
          />
          
          <SpotlightModal 
            isOpen={isSpotlightOpen} 
            onClose={() => { setIsSpotlightOpen(false); setSpotlightVisionData(null); }}
            visionData={spotlightVisionData}
            onResultClick={(res) => {
              if (res.type === 'session') {
                switchSession(res.id);
                setView('chat');
              } else if (res.url) {
                window.open(res.url, '_blank');
              }
            }}
          />

          <IngestModal 
            isOpen={isIngestModalOpen}
            onClose={() => setIsIngestModalOpen(false)}
            currentUrl={currentUrl}
            onIngest={handleIngest}
          />

          <AnimatePresence>
            {isReportModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-[#09090b]/80 backdrop-blur-md z-[100] flex items-center justify-center p-6"
              >
                <motion.div
                  initial={{ scale: 0.95, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 20 }}
                  className="w-full max-w-2xl bg-[#0f0f14] border border-[#1e1e26] rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                >
                  <div className="p-8 border-b border-[#1e1e26] bg-[#111116] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-[#10b981]/10 flex items-center justify-center border border-[#10b981]/20">
                        <Sparkles className="w-6 h-6 text-[#10b981]" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-[#fafafa] uppercase tracking-widest">Professional Synthesis</h3>
                        <p className="text-xs text-[#71717a] font-bold uppercase tracking-wider">Select knowledge sources for your synthesis</p>
                      </div>
                    </div>
                    <button onClick={() => setIsReportModalOpen(false)} className="p-2 hover:bg-[#1a1a1d] rounded-xl text-[#71717a]">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="mb-8">
                       <label className="text-[10px] font-black text-[#3f3f46] uppercase tracking-[0.3em] mb-3 block">Research Objective / Title</label>
                       <input 
                         className="w-full bg-[#07070a] border border-[#1e1e26] rounded-xl px-5 py-4 text-[#fafafa] text-sm font-bold focus:border-[#6366f1]/50 outline-none transition-all placeholder:text-[#3f3f46]"
                         placeholder="e.g. Impact analysis of Quantum Computing"
                         value={reportQuery}
                         onChange={(e) => setReportQuery(e.target.value)}
                       />
                    </div>

                    <div className="space-y-4">
                       <span className="text-[10px] font-black text-[#3f3f46] uppercase tracking-[0.3em]">Available Context (From Atlas)</span>
                       <div className="grid grid-cols-1 gap-2">
                          {(graphData?.nodes || []).filter(n => n.type === 'site').map(source => (
                             <button
                               key={source.id}
                               onClick={() => {
                                 setSelectedSources(prev => 
                                   prev.includes(source.id) ? prev.filter(id => id !== source.id) : [...prev, source.id]
                                 );
                               }}
                               className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                 selectedSources.includes(source.id) ? 'bg-[#6366f1]/10 border-[#6366f1]/40' : 'bg-[#111116] border-[#1e1e26]'
                               }`}
                             >
                                <div className="flex items-center gap-3">
                                   <Globe className={`w-4 h-4 ${selectedSources.includes(source.id) ? 'text-[#6366f1]' : 'text-[#71717a]'}`} />
                                   <span className="text-xs font-bold text-[#fafafa]">{source.name}</span>
                                </div>
                                {selectedSources.includes(source.id) && <ShieldCheck className="w-4 h-4 text-[#10b981]" />}
                             </button>
                          ))}
                       </div>
                    </div>
                  </div>

                  <div className="p-8 bg-[#07070a] border-t border-[#1e1e26] flex gap-4">
                     <button onClick={() => setIsReportModalOpen(false)} className="flex-1 py-4 text-[#71717a] font-black uppercase text-[10px] tracking-widest">Cancel</button>
                     <button 
                       onClick={() => handleProfessionalReport(reportQuery, selectedSources)}
                       disabled={isGeneratingReport || !reportQuery.trim()}
                       className="flex-[2] py-4 bg-[#6366f1] text-black font-black uppercase text-[10px] tracking-widest rounded-2xl hover:scale-[1.02] transition-all disabled:opacity-50"
                     >
                        {isGeneratingReport ? 'Generating...' : 'Synthesize Professional Report'}
                     </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* INGESTION HUD */}
          <div className="fixed bottom-32 right-8 flex flex-col gap-3 z-[150] pointer-events-none">
            <AnimatePresence>
              {ingestions.map((ing) => (
                <motion.div
                  key={ing.id}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`flex items-center gap-3 px-5 py-3 rounded-2xl border backdrop-blur-xl pointer-events-auto ${
                    ing.status === 'processing' ? 'bg-[#111116]/80 border-[#6366f1]/30' : 'bg-[#064e3b]/80 border-[#10b981]/40 text-[#10b981]'
                  }`}
                >
                  <Loader2 className={`w-4 h-4 ${ing.status === 'processing' ? 'animate-spin' : 'hidden'}`} />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest truncate max-w-[150px]">{ing.filename}</span>
                    <span className="text-[9px] font-bold opacity-60 uppercase">{ing.message}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {isCodeSynthesisOpen && (
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                className="fixed inset-y-0 right-0 w-[600px] bg-[#09090b] border-l border-[#1e1e26] z-[110] flex flex-col shadow-2xl"
              >
                 <div className="p-8 border-b border-[#1e1e26] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-[#6366f1]/10 flex items-center justify-center border border-[#6366f1]/20">
                          <Code className="w-6 h-6 text-[#6366f1]" />
                       </div>
                       <h3 className="text-lg font-black text-[#fafafa] uppercase tracking-widest">Neural Reverse-Engineer</h3>
                    </div>
                    <button onClick={() => setIsCodeSynthesisOpen(false)} className="p-2 text-[#71717a] hover:text-white"><X className="w-6 h-6" /></button>
                 </div>
                 <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="flex items-center justify-between mb-6">
                       <span className="text-[10px] font-black text-[#3f3f46] uppercase tracking-[0.3em]">Synthesized Source Code</span>
                       <button 
                         onClick={() => { navigator.clipboard.writeText(generatedCode); toast.success("Copied!"); }}
                         className="flex items-center gap-2 px-4 py-2 bg-[#6366f1]/10 border border-[#6366f1]/20 rounded-xl text-[10px] font-black text-[#6366f1] uppercase tracking-widest"
                       >
                         <Copy className="w-3 h-3" /> Copy
                       </button>
                    </div>
                    <pre className="p-8 bg-[#0f0f14] border border-[#1e1e26] rounded-2xl text-[13px] font-mono leading-relaxed text-[#d4d4d8] overflow-x-auto">
                       <code>{generatedCode}</code>
                    </pre>
                 </div>
                 <div className="p-8 border-t border-[#1e1e26]">
                    <button onClick={() => setIsCodeSynthesisOpen(false)} className="w-full py-5 bg-[#fafafa] text-black text-[12px] font-black uppercase tracking-[0.2em] rounded-2xl">Exit Inspector</button>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
          <ClipboardBubble onAction={handleClipboardAction} />
        </div>
      </main>
    </div>
  );
}

export default function AppWithErrorBoundary() {
  const [session, setSession] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isInitializing) {
    return <div className="flex h-screen items-center justify-center bg-[#09090b]"><Loader2 className="w-8 h-8 animate-spin text-[#6366f1]" /></div>;
  }

  if (!session) {
    return <AuthView onAuthSuccess={(s) => setSession(s)} />;
  }

  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

