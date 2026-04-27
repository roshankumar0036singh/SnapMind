/**
 * DomExtractor: Handles parsing of the page content to extract meaningful text blocks.
 */
export class DomExtractor {
    constructor() {
        this.blockIdCounter = 0;
    }

    /**
     * Main entry point to get structured page content.
     * @returns {Object} Structured content with url, title, and blocks.
     */
    extract() {
        this.blockIdCounter = 0;
        const rootInfo = this.findMainContent();
        const blocks = this.traverse(rootInfo.element);

        // Calculate a simple content score (total characters)
        const contentScore = blocks.reduce((acc, block) => acc + block.text.length, 0);

        return {
            url: window.location.href,
            title: document.title,
            blocks: blocks,
            contentScore: contentScore
        };
    }

    /**
     * Attempts to find the most relevant container for content.
     */
    findMainContent() {
        // LinkedIn Specific: Try to find the profile container first
        if (window.location.hostname.includes('linkedin.com')) {
            const profileSelectors = [
                'main.scaffold-layout__main', 
                'div#profile-content',
                'section.pv-top-card',
                '.pv-profile-section',
                '#experience-section'
            ];
            for (const selector of profileSelectors) {
                const el = document.querySelector(selector);
                if (el && el.innerText.length > 200) {
                    return { element: el, type: 'linkedin-profile-core' };
                }
            }
        }

        const candidates = [
            'article',
            'main',
            '[role="main"]',
            '#content',
            '#main',
            '.main-content'
        ];


        for (const selector of candidates) {
            const el = document.querySelector(selector);
            if (el) return { element: el, type: selector };
        }

        return { element: document.body, type: 'body' };
    }

    /**
     * Recursively traverses the DOM to build text blocks.
     * @param {HTMLElement} node 
     * @returns {Array} List of content blocks
     */
    traverse(node) {
        let blocks = [];

        // Skip hidden or irrelevant nodes
        if (this.shouldIgnore(node)) return [];

        // Process Text Nodes representing content
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text.length > 20) { // Minimum threshold to avoid noise
                blocks.push(this.createBlock('text', text, node.parentNode));
            }
            return blocks;
        }

        // Process Elements
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();

            // Headings
            if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
                blocks.push(this.createBlock('heading', node.textContent.trim(), node));
                return blocks;
            }

            // Paragraphs
            if (tagName === 'p') {
                const text = node.textContent.trim();
                if (text.length > 0) {
                    blocks.push(this.createBlock('paragraph', text, node));
                }
                return blocks;
            }

            // Recursively process children
            for (const child of node.childNodes) {
                blocks = blocks.concat(this.traverse(child));
            }
        }

        return blocks;
    }

    shouldIgnore(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toLowerCase();
            const cls = (node.className || "").toString().toLowerCase();
            const id = (node.id || "").toLowerCase();

            // Ignore navigation, footers, headers, and buttons
            if (['script', 'style', 'noscript', 'svg', 'iframe', 'button', 'nav', 'footer', 'header', 'aside'].includes(tag)) {
                return true;
            }

            // LinkedIn specific noise filters (login banners, related profiles, ads)
            if (window.location.hostname.includes('linkedin.com')) {
                const noiseClasses = ['authwall', 'login', 'signup', 'ad-banner', 'premium-upsell', 'distraction-free'];
                if (noiseClasses.some(noise => cls.includes(noise) || id.includes(noise))) {
                    return true;
                }
            }

            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === "0") {
                return true;
            }
        }
        return false;
    }

    createBlock(type, text, element) {
        const id = `bi-block-${this.blockIdCounter++}`;

        // Assign stable ID to DOM for highlighting later
        if (element && element.nodeType === Node.ELEMENT_NODE) {
            if (!element.dataset.biBlockId) {
                element.dataset.biBlockId = id;
            }
        }

        return {
            id: id,
            type: type,
            text: text,
            // CSS path could be added here if needed for robustness
        };
    }
}
