import { apiClient } from './api';
import { captureVisibleTab } from './capture';

console.log('Context-Aware Browser Intelligence: Background Worker loaded');

let currentRagBlocks = [];

// Ensure side panel opens on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// 1. Install & Context Menu Setup
const setupContextMenus = () => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "send-to-snapmind",
            title: "Append to SnapMind Chat",
            contexts: ["selection"]
        });
        chrome.contextMenus.create({
            id: "snapmind-visual-search",
            title: "Neural Visual Search",
            contexts: ["page", "image"]
        });
        chrome.contextMenus.create({
            id: "snapmind-ai-to-code",
            title: "Neural UI to Code (Alpha)",
            contexts: ["all"]
        });
    });
};

chrome.runtime.onInstalled.addListener(() => {
    console.log("SnapMind Installed/Updated");
    setupContextMenus();
});

// Also run on startup to be safe
chrome.runtime.onStartup.addListener(() => {
    setupContextMenus();
});

// Initialize on first load
setupContextMenus();

// 2. Handle Context Menu Click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "send-to-snapmind" && info.selectionText) {
        console.log("Context Menu Clicked:", info.selectionText);

        // Open Side Panel
        try {
            // Available in Chrome 116+
            await chrome.sidePanel.open({ windowId: tab.windowId });
        } catch (e) {
            console.warn("Could not open sidepanel (might already be open or restricted):", e);
        }

        // Send text to Side Panel
        // We delay slightly to ensure the panel has time to initialize if it was closed
        setTimeout(() => {
            chrome.runtime.sendMessage({
                type: "SET_CHAT_QUERY",
                text: info.selectionText
            }).catch(err => console.log("Panel not ready yet, message might be missed:", err));
        }, 500);
    } else if (info.menuItemId === "snapmind-visual-search") {
        console.log("Visual Search Triggered");
        try {
            let dataUrl;
            if (info.mediaType === 'image' && info.srcUrl) {
                // If it's an image, try to fetch it and convert to base64
                // Note: This might fail due to CORS, fallback to tab capture if so
                try {
                    const imgResp = await fetch(info.srcUrl);
                    const blob = await imgResp.blob();
                    dataUrl = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    console.warn("CORS/Fetch failed for image URL, falling back to tab capture", e);
                    dataUrl = await captureVisibleTab(tab.windowId);
                }
            } else {
                dataUrl = await captureVisibleTab(tab.windowId);
            }

            const response = await fetch('http://127.0.0.1:8000/api/vision/cache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: dataUrl })
            });
            if (response.ok) {
                const data = await response.json();
                if (data.cache_id) {
                    const snapmindUrl = `snapmind://vision?cache_id=${data.cache_id}`;
                    chrome.tabs.create({ url: snapmindUrl, active: false }, (newTab) => {
                        // Close protocol tab
                        setTimeout(() => { if (newTab && newTab.id) chrome.tabs.remove(newTab.id).catch(() => {}); }, 2000);
                    });
                }
            }
        } catch (e) {
            console.error("Visual search error:", e);
        }
    } else if (info.menuItemId === "snapmind-ai-to-code") {
        console.log("AI-to-Code Triggered");
        try {
            // 1. Capture Element from Content Script
            const capture = await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_ELEMENT' });
            if (capture && capture.success) {
                // 2. Get API Keys from Storage
                const storage = await chrome.storage.local.get(['geminiApiKey']);
                
                // 3. Send to Developer Synthesis Endpoint
                const response = await fetch('http://127.0.0.1:8000/developer/reverse_engineer', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-gemini-key': storage.geminiApiKey || ''
                    },
                    body: JSON.stringify({
                        html: capture.html,
                        styles: capture.styles
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        // 4. Cache the resulting code and deep-link to SnapMind
                        const cacheResp = await fetch('http://127.0.0.1:50650/api/vision/cache', {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({ text_data: data.code, type: 'code_synthesis' })
                        });
                        const cacheData = await cacheResp.json();
                        
                        const snapmindUrl = `snapmind://code?cache_id=${cacheData.cache_id}`;
                        chrome.tabs.create({ url: snapmindUrl, active: false }, (newTab) => {
                             setTimeout(() => chrome.tabs.remove(newTab.id), 3000);
                        });
                    }
                }
            }
        } catch (e) {
            console.error("AI-to-Code error:", e);
        }
    }
});

// 3. Listen for messages from Side Panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PROCESS_QUERY') {
        handleQuery(request).then(sendResponse);
        return true; // Async response
    }
    if (request.type === 'CAPTURE_VISIBLE_TAB') {
        captureVisibleTab(request.windowId)
            .then(dataUrl => sendResponse({ success: true, dataUrl }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
    if (request.type === 'INGEST_PAGE') {
        handleIngest(request).then(sendResponse);
        return true;
    }
    if (request.type === 'WIDGET_CHAT_PROXY') {
        const targetUrl = request.apiUrl.includes('/api/v1') ? `${request.apiUrl}/widget/chat` : `${request.apiUrl}/api/v1/widget/chat`;
        fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(request.body)
        })
            .then(res => res.json())
            .then(data => sendResponse({ success: true, data }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
});

// Store the last captured screenshot to allow follow-up questions
let lastCapturedImage = null;

async function handleIngest(request) {
    const { url, text, crawl_mode, max_pages, max_depth, target_lang, sessionId } = request;

    // Phase 2: Heuristic Check OR Visual Ingest
    if (text) {
        // Direct Text Ingest (Visual Pipeline)
        try {
            const result = await apiClient.ingestText(url, text, sessionId);
            return result;
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // Standard URL Ingest
    let isLowQuality = false;
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            const extractionResponse = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONTENT' });
            if (extractionResponse && extractionResponse.isLowQuality) {
                isLowQuality = true;
            }
        }
    } catch (e) {
        console.warn("Could not check page quality:", e);
    }

    try {
        const result = await apiClient.ingestPage(url, crawl_mode, max_pages, max_depth, target_lang || 'auto', sessionId);
        return { ...result, isLowQuality };
    } catch (err) {
        const errorMsg = err.message || String(err) || "Unknown Ingestion Error";
        return { success: false, error: errorMsg, isLowQuality };
    }
}

async function handleQuery(payload) {
    try {
        const { mode, text, tabId, windowId, backendMode, activeContext } = payload;
        console.log(`[Background] Processing ${mode} query: "${text}" with context:`, activeContext);

        if (mode === 'visual') {
            let dataUrl;

            // Heuristic: If prompt is "Describe..." (the default), we treat it as a new scan -> Capture new image.
            // If prompt is different (a specific question), we behave contextually:
            // 1. If we have a cached image, reuse it (assuming user asks about what they just saw).
            // 2. If no cached image, capture new one.
            const isDefaultPrompt = text && text.includes("Describe the visual layout");

            // Allow client to pass a pre-cropped image (e.g. Region Select)
            if (payload.imageData) {
                console.log('[Background] Using client-provided image (Crop)...');
                dataUrl = payload.imageData;
                lastCapturedImage = dataUrl; // Cache the crop so follow-ups context is the crop
            }
            else if (isDefaultPrompt || !lastCapturedImage) {
                console.log('[Background] Capturing new screenshot...');
                dataUrl = await captureVisibleTab(windowId);
                lastCapturedImage = dataUrl;
            } else {
                console.log('[Background] Reusing cached screenshot for follow-up...');
                dataUrl = lastCapturedImage;
            }

            // 2. Send to Visual API (Pass backendMode and outputLang if provided)
            const result = await apiClient.analyzeImage(dataUrl, text, backendMode, {
                outputLang: payload.outputLang,
                activeContext: activeContext
            });
            return { success: true, ...result };
        }
        else if (mode === 'rag' || mode === 'github') {
            // 1. Trigger Content Script extraction
            // Use chrome.tabs.sendMessage directly to the active tab
            try {
                const extractionResponse = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' });

                if (extractionResponse && extractionResponse.data) {
                    currentRagBlocks = extractionResponse.data.blocks;
                    // 2. Send to RAG API
                    const result = await apiClient.queryRag(currentRagBlocks, text);
                    return { success: true, ...result };
                }
            } catch (err) {
                console.warn('Could not contact content script. Is it injected?', err);
                return {
                    success: false,
                    error: "Could not read page content. Try refreshing the page."
                };
            }
        }

        return { success: false, error: "Unknown mode" };

    } catch (error) {
        console.error('Query processing failed:', error);
        return { success: false, error: error.message };
    }
}
