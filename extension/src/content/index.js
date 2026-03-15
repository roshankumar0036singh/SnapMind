import { DomExtractor } from './extractor';
import { Highlighter } from './highlighter';
import { SelectionOverlay } from './selection';

console.log('Context-Aware Browser Intelligence: Content script loaded');

const extractor = new DomExtractor();
const highlighter = new Highlighter();
const selectionOverlay = new SelectionOverlay();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_CONTENT') {
        console.log('[Content] Extracting content...');
        const data = extractor.extract();
        const isLowQuality = data.contentScore < 500; // Heuristic
        sendResponse({ success: true, data, isLowQuality });
    }
    else if (request.type === 'HIGHLIGHT_CITATION') {
        console.log('[Content] Highlighting block:', request.blockId);
        const success = highlighter.highlight(request.blockId);
        sendResponse({ success });
    }
    else if (request.type === 'START_SELECTION') {
        console.log('[Content] Starting region selection...');
        selectionOverlay.start().then(rect => {
            console.log('[Content] Selection complete:', rect);
            sendResponse({ success: true, rect });
        });
        return true; // Keep channel open for async response
    }
    else if (request.type === 'SEEK_YOUTUBE') {
        console.log('[Content] Seeking YouTube video to:', request.seconds);
        const video = document.querySelector('video');
        if (video) {
            video.currentTime = request.seconds;
            video.play().catch(e => console.log('Playback prevented:', e));
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'No video element found' });
        }
    }
});
