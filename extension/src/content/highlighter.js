/**
 * Highlighter: Responsible for locating and highlighting text blocks.
 */
export class Highlighter {
    constructor() {
        this.activeHighlight = null;
    }

    /**
     * Scrolls to and highlights a specific block by ID.
     * @param {string} blockId - The unique ID assigned during extraction.
     * @returns {boolean} Success status.
     */
    highlight(blockId) {
        // 1. Remove existing highlight
        this.clearHighlight();

        // 2. Find element
        const element = document.querySelector(`[data-bi-block-id="${blockId}"]`);
        if (!element) {
            console.warn(`[Highlighter] Block not found: ${blockId}`);
            return false;
        }

        // 3. Scroll into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // 4. Apply styles
        // Using inline styles to avoid external CSS dependency issues in Shadow DOMs etc.
        const originalTransition = element.style.transition;
        const originalBackground = element.style.backgroundColor;

        element.style.transition = 'background-color 0.5s ease';
        element.style.backgroundColor = 'rgba(255, 255, 0, 0.4)'; // Yellow highlight

        this.activeHighlight = {
            element,
            originalTransition,
            originalBackground,
            timeout: setTimeout(() => this.clearHighlight(), 4000) // Auto-clear after 4s
        };

        return true;
    }

    clearHighlight() {
        if (this.activeHighlight) {
            const { element, originalTransition, originalBackground, timeout } = this.activeHighlight;

            clearTimeout(timeout);

            // Fade out
            element.style.backgroundColor = 'rgba(255, 255, 0, 0)';

            // Restore original styles after fade
            setTimeout(() => {
                element.style.backgroundColor = originalBackground;
                element.style.transition = originalTransition;
            }, 500);

            this.activeHighlight = null;
        }
    }
}
