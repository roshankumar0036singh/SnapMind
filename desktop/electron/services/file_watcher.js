const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');

/**
 * FileWatcher Service
 * Monitors configured local directories and automatically ingests new files into the local backend.
 */
class FileWatcherService {
    constructor() {
        this.watchers = new Map(); // path -> chokidar instance
        this.backendUrl = 'http://localhost:8000';
    }

    /**
     * Start watching a specific directory.
     * @param {string} dirPath - Absolute path to watch.
     */
    addWatchFolder(dirPath) {
        if (this.watchers.has(dirPath)) {
            console.log(`[FileWatcher] Already watching: ${dirPath}`);
            return;
        }

        console.log(`[FileWatcher] Starting watch on: ${dirPath}`);
        
        // Add a slight delay for file stability (avoiding partial reads)
        const watcher = chokidar.watch(dirPath, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100
            }
        });

        watcher
            .on('add', (filePath) => this.handleNewFile(filePath))
            .on('error', error => console.error(`[FileWatcher] Error on ${dirPath}:`, error));

        this.watchers.set(dirPath, watcher);
    }

    /**
     * Stop watching a specific directory.
     * @param {string} dirPath 
     */
    removeWatchFolder(dirPath) {
        const watcher = this.watchers.get(dirPath);
        if (watcher) {
            watcher.close().then(() => {
                console.log(`[FileWatcher] Stopped watching: ${dirPath}`);
                this.watchers.delete(dirPath);
            });
        }
    }

    /**
     * Handles newly detected files.
     * Submits them to the local backend for ingestion.
     * @param {string} filePath 
     */
    async handleNewFile(filePath) {
        console.log(`[FileWatcher] New file detected: ${filePath}`);
        
        const ext = path.extname(filePath).toLowerCase();
        const supportedExts = ['.txt', '.md', '.pdf', '.csv', '.json', '.docx', '.csv'];
        
        if (!supportedExts.includes(ext)) {
            console.log(`[FileWatcher] Ignoring unsupported file type: ${ext}`);
            return;
        }

        try {
            console.log(`[FileWatcher] Submitting ${path.basename(filePath)} to backend...`);
            
            // Note: Since we are in Node.js standard environment (not browser), 
            // we use the Node native fetch api directly. 
            // We construct a multipart/form-data request manually or via Blob standard.
            
            const fileStream = fs.createReadStream(filePath);
            const fileName = path.basename(filePath);
            
            // To upload via Node.js native fetch, we use FormData if available (Node 18+)
            const formData = new FormData();
            
            // Create a Blob from the file buffer to append
            const buffer = fs.readFileSync(filePath);
            const blob = new Blob([buffer]);
            
            formData.append('file', blob, fileName);
            formData.append('target_language', 'auto');
            
            const response = await fetch(`${this.backendUrl}/ingest/file`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Backend Error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log(`[FileWatcher] Successfully ingested: ${fileName}. Response:`, data);
            
        } catch (error) {
            console.error(`[FileWatcher] Failed to ingest file ${filePath}:`, error);
        }
    }

    /**
     * Stop all active watchers.
     */
    stopAll() {
        for (const [dirPath, watcher] of this.watchers.entries()) {
            watcher.close();
        }
        this.watchers.clear();
        console.log('[FileWatcher] All watchers stopped.');
    }
}

// Export singleton instance
const fileWatcher = new FileWatcherService();
module.exports = fileWatcher;
