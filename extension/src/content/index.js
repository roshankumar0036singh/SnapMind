import { DomExtractor } from './extractor';
import { Highlighter } from './highlighter';
import { SelectionOverlay } from './selection';

console.log('Context-Aware Browser Intelligence: Content script loaded');

const extractor = new DomExtractor();
const highlighter = new Highlighter();
const selectionOverlay = new SelectionOverlay();

let lastRightClickedElement = null;

document.addEventListener('contextmenu', (e) => {
    lastRightClickedElement = e.target;
}, true);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_CONTENT') {
        console.log('[Content] Extracting content...');
        const data = extractor.extract();
        const isLowQuality = data.contentScore < 500; // Heuristic
        sendResponse({ success: true, data, isLowQuality });
    }
    else if (request.type === 'HIGHLIGHT_CITATION') {
        console.log('[Content] Highlighting block:', request.blockId);
        const success = highlighter.highlight(request.blockId, request.text);
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
    else if (request.type === 'CAPTURE_ELEMENT') {
        const target = lastRightClickedElement || document.activeElement;
        if (!target) {
            sendResponse({ success: false, error: 'No element targeted' });
            return;
        }

        const rect = target.getBoundingClientRect();
        
        // Deep clone and prune HTML for the clean code pipeline
        const clone = target.cloneNode(true);
        // Remove scripts/styles if present in the fragment
        clone.querySelectorAll('script, style, iframe').forEach(el => el.remove());
        
        const html = clone.outerHTML;
        const styles = window.getComputedStyle(target);
        
        // Pick only relevant styles to avoid bloat
        const relevantStyles = {};
        ['color', 'backgroundColor', 'fontSize', 'fontWeight', 'padding', 'margin', 'display', 'position', 'flex', 'grid', 'borderColor', 'borderRadius', 'width', 'height', 'gap', 'alignItems', 'justifyContent']
            .forEach(prop => { relevantStyles[prop] = styles[prop]; });

        sendResponse({ 
            success: true, 
            html, 
            styles: relevantStyles,
            rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
        });
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
