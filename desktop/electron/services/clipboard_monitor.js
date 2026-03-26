const { clipboard } = require('electron');

let lastText = '';
let lastImage = '';
let isMonitoring = false;
let checkInterval = null;

/**
 * Starts monitoring the system clipboard for new text or images.
 * Changes are sent to the renderer process via IPC.
 */
function startClipboardMonitor(mainWindow) {
    if (isMonitoring) return;
    isMonitoring = true;
    
    console.log("[CLIPBOARD] Monitoring started...");
    
    checkInterval = setInterval(() => {
        if (mainWindow.isDestroyed()) {
            stopClipboardMonitor();
            return;
        }

        // 1. Check for Text changes
        const text = clipboard.readText();
        if (text && text.trim() !== '' && text !== lastText) {
            lastText = text;
            console.log("[CLIPBOARD] New text detected");
            mainWindow.webContents.send('clipboard-update', { 
                type: 'text', 
                content: text,
                timestamp: new Date().toISOString()
            });
        }
        
        // 2. Check for Image changes
        const image = clipboard.readImage();
        if (!image.isEmpty()) {
            const dataUrl = image.toDataURL();
            // Basic length/content comparison for images since dataUrl can be large
            if (dataUrl !== lastImage) {
                lastImage = dataUrl;
                console.log("[CLIPBOARD] New image detected");
                mainWindow.webContents.send('clipboard-update', { 
                    type: 'image', 
                    content: dataUrl,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }, 2000); // Check every 2 seconds to balance responsiveness and CPU
}

function stopClipboardMonitor() {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
    isMonitoring = false;
    console.log("[CLIPBOARD] Monitoring stopped.");
}

module.exports = { startClipboardMonitor, stopClipboardMonitor };
