/**
 * Highlighter: Responsible for locating and highlighting text blocks on web pages.
 * Uses a DOM text walker for reliable matching, highlights the containing block element.
 */
export class Highlighter {
    constructor() {
        this.activeHighlight = null;
    }

    /**
     * Scrolls to and highlights a specific block by ID or text content.
     * @param {string} blockId - The unique ID assigned during extraction.
     * @param {string} text - The text snippet to search for as fallback.
     * @returns {boolean} Success status.
     */
    highlight(blockId, text) {
        // 1. Remove existing highlight
        this.clearHighlight();

        // 2. For br-block/db-block IDs (from scraped/DB pages), skip ID lookup — they never exist on the target page
        let element = null;
        if (blockId && !blockId.startsWith('br-block-') && !blockId.startsWith('db-block-') && !blockId.startsWith('nb-block-') && !blockId.startsWith('pin-')) {
            element = document.querySelector(`[data-bi-block-id="${blockId}"]`);
        }
                if (!element && text) {
            console.log('[Highlighter] Attempting text search for snippet:', text.substring(0, 60));
            
            // 1. Build list of progressive attempts (sentences, then fragments)
            const attempts = [];
            
            // Add full text if short enough
            if (text.length < 500) attempts.push(text);
            
            // Add sentences (very reliable for anchors)
            const sentences = text.split(/[.!?]+\s+/).filter(s => s.length > 20 && s.length < 300);
            if (sentences.length > 0) {
                // Try first, middle, and last sentences
                attempts.push(sentences[0]);
                if (sentences.length > 1) attempts.push(sentences[Math.floor(sentences.length / 2)]);
                if (sentences.length > 2) attempts.push(sentences[sentences.length - 1]);
            }
            
            // Add fixed-length fragments as fallback
            attempts.push(text.substring(0, Math.min(text.length, 120)));
            attempts.push(text.substring(Math.max(0, text.length - 120)));
            
            for (const snippet of attempts) {
                const trimmed = snippet.trim();
                if (trimmed.length < 15) continue;
                
                const matchedBlock = this._findBlockByText(trimmed);
                if (matchedBlock) {
                    console.log(`[Highlighter] Match found logic: "${trimmed.substring(0, 30)}..." in ${matchedBlock.tagName}`);
                    matchedBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    this._applyBlockHighlight(matchedBlock);
                    return true;
                }
            }
 
            // [NEW] Second Pass: Hidden content search
            console.log('[Highlighter] Visible search failed. Trying hidden content search...');
            for (const snippet of attempts) {
                const trimmed = snippet.trim();
                const hiddenBlock = this._findBlockByText(trimmed, { includeHidden: true });
                if (hiddenBlock) {
                    console.log(`[Highlighter] Hidden match found in ${hiddenBlock.tagName}.`);
                    this._triggerTabSwitch(hiddenBlock);
                    setTimeout(() => {
                        hiddenBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        this._applyBlockHighlight(hiddenBlock);
                    }, 400);
                    return true;
                }
            }
            
            // Final fallback: Robust word-overlap search
            console.log('[Highlighter] Precise search failed. Calculating word overlap...');
            const words = this._normalize(text).split(/\s+/).filter(w => w.length > 3);
            const bestBlock = this._findBestMatchingBlock(words);
            if (bestBlock) {
                console.log('[Highlighter] Best candidate via overlap:', bestBlock.tagName);
                bestBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
                this._applyBlockHighlight(bestBlock);
                return true;
            }
 
            console.warn('[Highlighter] Highlights failed for:', text.substring(0, 40));
            return false;
        }


        if (!element) {
            console.warn(`[Highlighter] Block not found: ${blockId}`);
            return false;
        }

        // 3. Highlight by element (for bi-block IDs that exist on the page)
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this._applyBlockHighlight(element);
        return true;
    }

    /**
     * Core search: finds the text in the DOM, then returns the nearest block-level ancestor.
     * This gives us a full paragraph/heading to highlight, not just the matched characters.
     */
    _findBlockByText(searchText, options = { includeHidden: false }) {
        const normalizedSearch = this._normalize(searchText);
        console.log('[Highlighter] _findBlockByText: searching for normalized:', normalizedSearch);
        if (!normalizedSearch || normalizedSearch.length < 3) return null;

        // Collect text nodes from main content area (using document.body for maximum reach)
        const root = document.body;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                const tag = parent.tagName.toLowerCase();
                
                // Always block noise tags
                if (['script', 'style', 'noscript', 'nav', 'footer', 'header', 'svg', 'button'].includes(tag))
                    return NodeFilter.FILTER_REJECT;
                
                if (!options.includeHidden) {
                    try {
                        const style = window.getComputedStyle(parent);
                        if (style.display === 'none' || style.visibility === 'hidden')
                            return NodeFilter.FILTER_REJECT;
                        
                        // Check if any ancestor is hidden (expensive but more accurate for tabs)
                        if (parent.closest('[hidden]') || parent.closest('[aria-hidden="true"]'))
                            return NodeFilter.FILTER_REJECT;
                    } catch(e) { /* ignore */ }
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        // Build concatenated page text and track node positions
        let fullText = '';
        const nodeMap = []; // [{node, start, end}]
        let node;
        while (node = walker.nextNode()) {
            const start = fullText.length;
            fullText += node.textContent;
            nodeMap.push({ node, start, end: fullText.length });
        }
        console.log(`[Highlighter] TreeWalker collected ${nodeMap.length} text nodes`);

        // Search for the normalized snippet in the normalized page text
        const normalizedFull = this._normalize(fullText);
        const matchIdx = normalizedFull.indexOf(normalizedSearch);
        
        if (matchIdx === -1) return null;

        // Find the text node that contains the match start position
        // We map from normalized position back to original by walking both strings
        const origPos = this._mapNormPosToOrig(fullText, matchIdx);
        if (origPos === -1) return null;

        // Find which text node contains this position
        let matchNode = null;
        for (const entry of nodeMap) {
            if (origPos < entry.end) {
                matchNode = entry.node;
                break;
            }
        }

        if (!matchNode) return null;

        // Walk up from the matched text node to find the nearest block-level element
        const blockTags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'td', 'dd', 'dt', 'figcaption', 'section']);
        let el = matchNode.parentElement;
        while (el && el !== root && el !== document.body) {
            if (blockTags.has(el.tagName.toLowerCase())) {
                return el;
            }
            el = el.parentElement;
        }

        // Fallback: just return the immediate parent 
        return matchNode.parentElement;
    }

    /**
     * Normalize text for comparison: lowercase, collapse whitespace, strip zero-width chars.
     */
    _normalize(text) {
        return text
            .replace(/[\u200B\uFEFF\u00A0]/g, ' ')  // Zero-width and non-breaking spaces
            .replace(/[\u2013\u2014]/g, '-')          // Normalize dashes
            .replace(/['']/g, "'")                    // Normalize quotes
            .replace(/[""]/g, '"')
            .replace(/\s+/g, ' ')                     // Collapse whitespace
            .toLowerCase()
            .trim();
    }

    /**
     * Maps a position in normalized text back to the approximate original position.
     * Walks both strings in parallel to handle whitespace collapsing.
     */
    _mapNormPosToOrig(original, normalizedPos) {
        const lower = original.toLowerCase();
        let origIdx = 0;
        let normCount = 0;

        // Skip leading whitespace in normalized (it's trimmed)
        while (origIdx < original.length && /\s/.test(original[origIdx])) {
            origIdx++;
        }

        while (normCount < normalizedPos && origIdx < original.length) {
            const ch = original[origIdx];
            
            // Skip zero-width characters
            if ('\u200B\uFEFF'.includes(ch)) {
                origIdx++;
                continue;
            }

            if (/\s/.test(ch)) {
                // Consume all consecutive whitespace in original
                while (origIdx < original.length && /\s/.test(original[origIdx])) {
                    origIdx++;
                }
                normCount++; // One space in normalized
            } else {
                origIdx++;
                normCount++;
            }
        }

        return origIdx <= original.length ? origIdx : -1;
    }

    /**
     * Fallback: Finds the block element (p, h, li) with the most word overlap.
     */
    _findBestMatchingBlock(words) {
        if (!words || words.length < 2) return null;
        
        const candidateWords = words.slice(0, 20).map(w => w.toLowerCase());
        const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, td, dd, div, span, a, summary, th, dt, dd');
        
        let bestScore = 0;
        let bestDensity = 0;
        let bestEl = null;

        for (const el of elements) {
            const text = el.textContent.toLowerCase().trim();
            // Ignore tiny elements, or massive wrapper divs that just absorb the whole page
            if (text.length < 5 || text.length > 800) continue;
            
            let score = 0;
            
            for (let i = 0; i < candidateWords.length; i++) {
                if (text.includes(candidateWords[i])) {
                    score += 1;
                    // Bonus for consecutive word pairs (bigrams)
                    if (i > 0 && text.includes(candidateWords[i-1] + ' ' + candidateWords[i])) {
                        score += 3; // Boosted bigram score
                    }
                }
            }

            // Density: higher score is strictly better, but if scores are close, 
            // a shorter text snippet is a more precise highlight target.
            const density = score / Math.max(1, Math.log10(text.length));

            if (score > bestScore || (score === bestScore && density > bestDensity && score > 0)) {
                bestScore = score;
                bestDensity = density;
                bestEl = el;
            }
        }

        // Reduced threshold slightly because short links might only have 3 words
        return (bestScore >= 3) ? bestEl : null;
    }

    /**
     * Logic to detect if an element is hidden and attempt to "click" open its parent tab/panel.
     */
    _triggerTabSwitch(element) {
        // 1. Find the parent that is likely a tab panel
        const panel = element.closest('[role="tabpanel"], [class*="tab-panel"], [class*="pane"], [class*="active"]') 
                     || element.closest('div[id]');
        
        if (!panel) return;

        const panelId = panel.id;
        let trigger = null;

        // 2. Look for an ARIA-controlled trigger
        if (panelId) {
            trigger = document.querySelector(`[aria-controls="${panelId}"]`) ||
                      document.querySelector(`[href="#${panelId}"]`);
        }

        // 3. Heuristic: Look for buttons in a sibling container with similar classes
        if (!trigger) {
            const container = panel.parentElement;
            if (container) {
                // Look for a nearby button/link that might be a tab header
                const possibleTabs = Array.from(container.querySelectorAll('button, a, role="tab"'));
                // Try to match by text label if we can find one on the panel
                const label = panel.getAttribute('aria-label') || panel.getAttribute('title');
                if (label) {
                    trigger = possibleTabs.find(t => t.textContent.includes(label));
                }
            }
        }

        if (trigger) {
            console.log('[Highlighter] Clicking tab trigger:', trigger);
            trigger.click();
        }
    }

    /**
     * Applies a block-level highlight style to an element.
     */
    _applyBlockHighlight(element) {
        const originalStyles = {
            transition: element.style.transition,
            backgroundColor: element.style.backgroundColor,
            boxShadow: element.style.boxShadow,
            borderLeft: element.style.borderLeft,
            paddingLeft: element.style.paddingLeft,
            borderRadius: element.style.borderRadius
        };

        element.style.transition = 'all 0.4s ease-out';
        element.style.backgroundColor = 'rgba(255, 235, 59, 0.18)';
        element.style.boxShadow = 'inset 4px 0 0 #ffeb3b';
        element.style.borderLeft = '4px solid #ffeb3b';
        element.style.paddingLeft = '12px';
        element.style.borderRadius = '0 4px 4px 0';

        this.activeHighlight = {
            element,
            originalStyles,
            timeout: setTimeout(() => this.clearHighlight(), 8000)
        };
    }

    clearHighlight() {
        if (!this.activeHighlight) return;
        
        if (this.activeHighlight.timeout) {
            clearTimeout(this.activeHighlight.timeout);
        }
        
        // Restore block-level highlights (style overrides)
        if (this.activeHighlight.element && this.activeHighlight.originalStyles) {
            const { element, originalStyles } = this.activeHighlight;
            Object.keys(originalStyles).forEach(prop => {
                element.style[prop] = originalStyles[prop];
            });
        }

        this.activeHighlight = null;
    }
}
