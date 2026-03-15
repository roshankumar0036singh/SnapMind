/**
 * Captures the visible area of the active tab.
 * @returns {Promise<string>} Data URL of the screenshot (JPEG).
 */
export async function captureVisibleTab(windowId = null) {
    try {
        console.log(`[Capture] Taking screenshot of window: ${windowId || 'current'}`);
        // Requires 'activeTab' permissions
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
            format: 'jpeg',
            quality: 80
        });

        if (!dataUrl) {
            throw new Error("Captured dataUrl is empty or null");
        }

        return dataUrl;
    } catch (error) {
        console.error('Screenshot capture failed:', error);
        const originalError = error.message || "Unknown error";
        throw new Error(`Screen capture failed (Window: ${windowId || 'default'}). Chrome Error: ${originalError}. Note: This fails on chrome:// pages or local files (file://) without permission.`);
    }
}
