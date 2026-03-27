const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * FileWatcher Service
 * Monitors configured local directories and automatically ingests new files into the local backend.
 */
class FileWatcherService {
    constructor() {
        this.watchers = new Map(); // path -> chokidar instance
        this.backendUrl = 'http://127.0.0.1:50650';
        this.apiKeys = {};
        this.isProcessing = false;
        this.queue = [];
    }

    setApiKeys(apiKeys) {
        this.apiKeys = apiKeys;
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
        
        const watcher = chokidar.watch(dirPath, {
            ignored: [
                /(^|[\/\\])\../, // ignore dotfiles
                '**/node_modules/**',
                '**/dist/**',
                '**/build/**',
                '**/.git/**',
                '**/*.log'
            ],
            persistent: true,
            ignoreInitial: false, 
            awaitWriteFinish: {
                stabilityThreshold: 3000,
                pollInterval: 100
            }
        });

        watcher
            .on('add', (filePath) => this.handleFileChange(filePath, 'add'))
            .on('change', (filePath) => this.handleFileChange(filePath, 'change'))
            .on('unlink', (filePath) => console.log(`[FileWatcher] Unlinked: ${filePath}`))
            .on('error', error => console.error(`[FileWatcher] Error on ${dirPath}:`, error));

        this.watchers.set(dirPath, watcher);
    }

    removeWatchFolder(dirPath) {
        const watcher = this.watchers.get(dirPath);
        if (watcher) {
            watcher.close().then(() => {
                console.log(`[FileWatcher] Stopped watching: ${dirPath}`);
                this.watchers.delete(dirPath);
            });
        }
    }

    async handleFileChange(filePath, type) {
        const ext = path.extname(filePath).toLowerCase();
        const supportedExts = ['.txt', '.md', '.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.json', '.pdf', '.docx', '.csv'];
        
        if (!supportedExts.includes(ext)) return;

        try {
            const buffer = fs.readFileSync(filePath);
            const hash = crypto.createHash('md5').update(buffer).digest('hex');

            // Add to processing queue with raw buffer
            this.queue.push({ 
                path: filePath, 
                buffer: buffer, 
                filename: path.basename(filePath),
                hash 
            });
            this.processQueue();
        } catch (e) {
            console.error(`[FileWatcher] Error reading ${filePath}:`, e);
        }
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        const item = this.queue.shift();

        try {
            // Using native Fetch and FormData (Node 18+)
            const formData = new FormData();
            
            // Create a Blob from the Buffer for FormData
            const blob = new Blob([item.buffer]);
            formData.append('file', blob, item.filename);
            formData.append('site_url', `file://${item.path}`);
            
            const response = await fetch(`${this.backendUrl}/ingest/file`, {
                method: 'POST',
                headers: {
                    'x-gemini-key': this.apiKeys.gemini || '',
                    'x-mistral-key': this.apiKeys.mistral || '',
                    'x-lingodev-key': this.apiKeys.lingodev || ''
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`[FileWatcher] Indexed: ${item.filename} -> ${data.status || 'success'}`);
            } else {
                const errText = await response.text();
                console.error(`[FileWatcher] Backend error indexing ${item.filename}: ${response.status} - ${errText}`);
            }
        } catch (e) {
            console.error(`[FileWatcher] Ingestion failed for ${item.path}:`, e.message);
        } finally {
            this.isProcessing = false;
            setTimeout(() => this.processQueue(), 500); // 500ms debounce between files
        }
    }

    stopAll() {
        for (const [dirPath, watcher] of this.watchers.entries()) {
            watcher.close();
        }
        this.watchers.clear();
        console.log('[FileWatcher] All watchers stopped.');
    }
}

const fileWatcher = new FileWatcherService();
module.exports = fileWatcher;
