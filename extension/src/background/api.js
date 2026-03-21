/**
 * API Client for handling Backend/LLM communication.
 */


// WARNING: API Key is now managed via Settings (chrome.storage).
// WARNING: API Key is now managed via Settings (chrome.storage).
// User's working Python script uses "gemini-2.5-flash". Syncing extension to match.
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
// Default to env var if available, else empty (user must set it in settings)
const DEFAULT_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const DEFAULT_BACKEND_URL = "http://localhost:8000";
const DEFAULT_HF_TOKEN = "";

export const apiClient = {
    /**
     * Retrieves the backend base URL from storage or returns default.
     */
    async getBaseUrl() {
        console.log("[DEBUG] getBaseUrl() called");
        // 1. Prioritize user-configured URL from storage
        const storage = await new Promise(r => chrome.storage.local.get(['backendUrl'], r));
        if (storage.backendUrl) {
            console.log("[DEBUG] Found configured backendUrl in storage:", storage.backendUrl);
            return storage.backendUrl.replace(/\/$/, ""); 
        }

        // 2. Fallback to Environment Variable (Vite)
        const envUrl = import.meta.env.VITE_BACKEND_URL;
        console.log("[DEBUG] Fallback to env VITE_BACKEND_URL:", envUrl);
        if (envUrl) return envUrl.replace(/\/$/, "");

        // 3. Last resort hardcoded default
        console.log("[DEBUG] Last resort: DEFAULT_BACKEND_URL:", DEFAULT_BACKEND_URL);
        return DEFAULT_BACKEND_URL.replace(/\/$/, "");
    },

    /**
     * Retrieves all custom API keys from extension storage to pass to the backend.
     */
    async getApiKeysHeaders() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['geminiApiKey', 'mistralApiKey', 'lingodevApiKey', 'firecrawlApiKey', 'groqApiKey'], (res) => {
                const headers = {};
                if (res.geminiApiKey) headers['x-gemini-key'] = res.geminiApiKey;
                if (res.mistralApiKey) headers['x-mistral-key'] = res.mistralApiKey;
                if (res.lingodevApiKey) headers['x-lingodev-key'] = res.lingodevApiKey;
                if (res.firecrawlApiKey) headers['x-firecrawl-key'] = res.firecrawlApiKey;
                
                // HF token is now optional for local development
                if (DEFAULT_HF_TOKEN) {
                    headers['Authorization'] = `Bearer ${DEFAULT_HF_TOKEN}`;
                    headers['x-hf-token'] = DEFAULT_HF_TOKEN;
                }
                
                if (res.groqApiKey) headers['x-groq-key'] = res.groqApiKey;
                resolve(headers);
            });
        });
    },

    /**
     * Translates text using the backend Lingo.dev proxy functionality.
     */
    async translateText(text, targetLang = 'en') {
        const res = await new Promise(r => chrome.storage.local.get(['lingodevApiKey'], r));
        const apiKey = res.lingodevApiKey;
        if (!text) {
            return { translatedText: text, originalLang: 'unknown', isTranslated: false };
        }

        if (!apiKey) {
            console.log(`[Lingo.dev] No API key found in settings, skipping client-side translation.`);
            // Return 'unknown' so backend knows we haven't even tried to detect language
            return { translatedText: text, originalLang: 'unknown', isTranslated: false };
        }

        try {
            console.log(`[Lingo.dev] Translating via backend API: "${text.substring(0, 30)}..."`);
            const apiKeysHeaders = await this.getApiKeysHeaders();
            const baseUrl = await this.getBaseUrl();
            const response = await fetch(`${baseUrl}/translate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...apiKeysHeaders
                },
                body: JSON.stringify({
                    text: text,
                    target_lang: targetLang
                })
            });

            if (!response.ok) {
                console.warn(`[Lingo.dev] Backend translation API error: ${response.status}`);
                return { translatedText: text, originalLang: 'unknown', isTranslated: false };
            }

            const contentType = response.headers.get("content-type");
            let data;
            try {
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Not JSON");
                }
                data = await response.json();
            } catch (e) {
                const textBody = await response.text();
                console.error("[Lingo.dev] Expected JSON but got:", textBody.substring(0, 100));
                return { translatedText: text, originalLang: 'unknown', isTranslated: false };
            }
            return data;
        } catch (error) {
            console.error("[Lingo.dev] Backend fetch error:", error);
            return { translatedText: text, originalLang: 'unknown', isTranslated: false };
        }
    },

    /**
     * Retrieves the API key from local storage or returns default.
     * @returns {Promise<string>} The API key or null.
     */
    async getApiKey() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['geminiApiKey'], (result) => {
                resolve(result.geminiApiKey || DEFAULT_KEY);
            });
        });
    },

    /**
     * Sends an image to the backend for analysis or extraction.
     * @param {string} base64Image - The base64 encoded image data.
     * @param {string} prompt - The user prompt or instruction.
     * @param {string} mode - "qa" or "extraction".
     * @returns {Promise<Object>} The analysis result.
     */
    async analyzeImage(base64Image, prompt, mode = "qa", options = {}) {
        // Get Backend URL from storage
        const baseUrl = await this.getBaseUrl();

        try {
            console.log(`[API] analyzeImage calling: ${baseUrl}/analyze-image (Mode: ${mode})`);
            
            const response = await fetch(`${baseUrl}/analyze-image`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(await this.getApiKeysHeaders())
                },
                body: JSON.stringify({
                    image_data: base64Image,
                    prompt: prompt,
                    mode: mode,
                    target_lang: options.outputLang || "auto"
                })
            });

            const contentType = response.headers.get("content-type");
            let data;
            const textBody = await response.text();

            try {
                if (contentType && contentType.includes("application/json")) {
                    data = JSON.parse(textBody);
                } else {
                    throw new Error("Not JSON");
                }
            } catch (e) {
                if (textBody.includes("<!DOCTYPE html>") || textBody.includes("<html")) {
                    throw new Error(`Backend returned HTML instead of JSON. Ensure your Backend URL is correct and not hitting a dev server or proxy. (URL: ${baseUrl}/analyze-image)`);
                }
                throw new Error(`Invalid Response: ${textBody.substring(0, 100)}...`);
            }

            if (!response.ok) {
                throw new Error(data?.detail || data?.error || `Backend Error: ${response.status}`);
            }

            return {
                answer: data.answer,
                sources: []
            };

        } catch (error) {
            console.error("Backend Vision Error:", error);
            const isNetworkError = error.message.includes("Failed to fetch");
            return {
                answer: isNetworkError
                    ? `**Connection Refused**: Cannot reach \`${baseUrl}\`.`
                    : `Error analyzing image: ${error.message}`
            };
        }
    },

    /**
     * Simulates RAG query against indexed page content.
     * (Keeping mock for RAG as we don't have a Vector DB setup in this Phase)
     */
    async queryRag(blocks, question) {
        console.log('[API] Sending RAG Query to Backend...', { count: blocks.length, question });

        const fullText = blocks.map(b => b.text).join('\n\n');

        // Get Backend URL from storage
        const baseUrl = await this.getBaseUrl();
        const chatEndpoint = `${baseUrl}/chat`;

        try {
            console.log(`[API] Fetching ${chatEndpoint}...`);

            const response = await fetch(chatEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(await this.getApiKeysHeaders())
                },
                body: JSON.stringify({
                    query: question,
                    search_query: arguments[2]?.search_query || null,
                    query_lang: arguments[2]?.query_lang || 'unknown',
                    content_blocks: blocks, // [NEW] Phase 1: Send structured blocks
                    page_content: fullText,  // Fallback / Debug
                    output_lang: arguments[2]?.outputLang || 'auto',
                    query_notebook: !!arguments[2]?.queryNotebook // Access from potential options object
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[API] Backend responded with ${response.status}:`, errorText);
                throw new Error(`Server returned ${response.status}: ${errorText}`);
            }

            const contentType = response.headers.get("content-type");
            let data;
            try {
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Not JSON");
                }
                data = await response.json();
            } catch (e) {
                const textBody = await response.text();
                if (textBody.includes("<!DOCTYPE html>")) {
                    throw new Error("Backend returned HTML instead of JSON. Check your Hugging Face space status and authentication token.");
                }
                throw new Error("Invalid backend response format.");
            }

            if (!response.ok) {
                throw new Error(data.detail || data.error || `Backend Error: ${response.status}`);
            }

            // Extract citations from the answer text
            // Regex to find bi-block-X, db-block-X, or pin-HANDLE-X anywhere
            const citationRegex = /((?:bi|nb|db|br)-block-[\d-]+|pin-[A-Z0-9]+-\d+)/g;
            const citations = [];
            let match;

            // We can keep the tags in the text for context, or remove them. 
            // For now, let's keep them but ensure the UI knows about them in the citations array.
            while ((match = citationRegex.exec(data.answer)) !== null) {
                // Avoid duplicates
                const blockId = match[1];
                if (!citations.find(c => c.blockId === blockId)) {
                    citations.push({
                        blockId: blockId,
                        snippet: `Source Reference ${blockId}` // We could look up snippet if we had map
                    });
                }
            }

            return {
                answer: data.answer,
                citations: citations
            };

        } catch (error) {
            console.error("RAG Backend Error:", error);
            // Check if it's a specific fetch error (Failed to fetch)
            const isNetworkError = error.message.includes("Failed to fetch") || error.message.includes("NetworkError");

            return {
                answer: isNetworkError
                    ? `**Connection Refused**: Cannot reach \`${baseUrl}\`.`
                    : `**Backend Error**: ${error.message}`,
                citations: []
            };
        }
    },

    /**
     * Retrieves unique semantic tags from the database.
     * @returns {Promise<string[]>} Array of tags.
     */
    async getTags() {
        const baseUrl = await this.getBaseUrl();
        const tagsEndpoint = `${baseUrl}/tags`;

        try {
            const response = await fetch(tagsEndpoint, {
                headers: await this.getApiKeysHeaders()
            });
            if (!response.ok) return [];
            
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) return [];

            const data = await response.json();
            if (data.success) {
                return data.tags || [];
            }
            return [];
        } catch (error) {
            console.error("Error fetching tags:", error);
            return [];
        }
    },

    /**
     * Retrieves contextual chat suggestions from the backend.
     * @param {string} pageContent - The page content.
     * @param {string} url - The URL of the page.
     * @param {string} siteId - Contextual Site ID.
     * @returns {Promise<string[]>} Array of suggestion strings.
     */
    async getSuggestions(pageContent, url, siteId) {
        const baseUrl = await this.getBaseUrl();
        const suggestEndpoint = `${baseUrl}/chat/suggest`;

        try {
            const response = await fetch(suggestEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(await this.getApiKeysHeaders())
                },
                body: JSON.stringify({
                    page_content: pageContent,
                    url: url,
                    site_id: siteId
                })
            });
            
            const contentType = response.headers.get("content-type");
            let data;
            try {
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Not JSON");
                }
                data = await response.json();
            } catch (e) {
                return [];
            }

            if (response.ok && data.suggestions) {
                return data.suggestions;
            }
            return [];
        } catch (error) {
            console.error("Error fetching suggestions:", error);
            return [];
        }
    },

    async ingestPage(url, crawl_mode = 'single', max_pages = 10, max_depth = 3, target_lang = 'auto', session_id = null) {
        // Get Backend URL from storage
        const baseUrl = await this.getBaseUrl();
        const ingestEndpoint = `${baseUrl}/ingest`;

        try {
            console.log(`[API] Ingesting ${url} to ${ingestEndpoint} (mode: ${crawl_mode}, lang: ${target_lang})...`);
            const response = await fetch(ingestEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(await this.getApiKeysHeaders())
                },
                body: JSON.stringify({
                    url: url,
                    crawl_mode: crawl_mode,
                    max_pages: max_pages,
                    max_depth: max_depth,
                    target_lang: target_lang,
                    session_id: session_id
                })
            });

            const contentType = response.headers.get("content-type");
            let data;
            try {
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Not JSON");
                }
                data = await response.json();
            } catch (e) {
                const textBody = await response.text();
                if (textBody.includes("<!DOCTYPE html>") || textBody.includes("<html")) {
                    throw new Error("Backend returned an HTML page (Hugging Face login or error). Check your Token and Space status.");
                }
                throw new Error("Backend returned non-JSON response.");
            }

            if (!response.ok) {
                throw new Error(data.detail || data.error || `Ingest failed: ${response.status}`);
            }

            return { success: true, message: data.message, ...data };

        } catch (error) {
            console.error("Ingest Error:", error);
            return {
                success: false,
                message: error.message.includes("Failed to fetch")
                    ? `Cannot reach Backend at ${baseUrl}`
                    : error.message
            };
        }
    },

    /**
     * Ingests text content along with a URL to the backend.
     * @param {string} url - The URL associated with the text content.
     * @param {string} text - The text content to ingest.
     * @returns {Promise<Object>} Ingestion result.
     */
    async ingestText(url, text, session_id = null) {
        // Get Backend URL from storage
        const baseUrl = await this.getBaseUrl();
        const ingestEndpoint = `${baseUrl}/ingest`; // Match backend route

        try {
            console.log(`[API] Ingesting text for ${url} (Session: ${session_id}) to ${ingestEndpoint}...`);
            const response = await fetch(ingestEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(await this.getApiKeysHeaders())
                },
                body: JSON.stringify({
                    url: url,
                    text_content: text,
                    session_id: session_id
                })
            });

            const contentType = response.headers.get("content-type");
            let data;
            try {
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Not JSON");
                }
                data = await response.json();
            } catch (e) {
                const textBody = await response.text();
                if (textBody.includes("<!DOCTYPE html>") || textBody.includes("<html")) {
                    throw new Error("Backend returned an HTML page (Hugging Face login or error). Check your Token and Space status.");
                }
                throw new Error("Backend returned non-JSON response.");
            }

            if (!response.ok) {
                throw new Error(data.detail || data.error || `Text Ingestion failed: ${response.status}`);
            }

            return { success: true, message: data.message };

        } catch (error) {
            console.error("Text Ingestion Error:", error);
            return {
                success: false,
                message: error.message.includes("Failed to fetch")
                    ? `Cannot reach Backend at ${baseUrl}`
                    : error.message
            };
        }
    },

    /**
     * Uploads a local file (PDF, DOCX, CSV) to the backend for ingestion.
     * @param {File} file - The file object to upload.
     * @param {string} [siteUrl=null] - Optional URL to associate with this file text.
     * @param {string} [targetLanguage="auto"] - Optional language to translate the file to before embedding.
     */
    async ingestFile(file, siteUrl = null, targetLanguage = "auto", sessionId = null) {
        // Get Backend URL from storage
        const baseUrl = await this.getBaseUrl();
        const ingestEndpoint = `${baseUrl}/ingest/file`;

        try {
            console.log(`[API] Uploading file ${file.name} to ${ingestEndpoint} with targetLanguage: ${targetLanguage}...`);

            const formData = new FormData();
            formData.append("file", file);
            if (siteUrl) formData.append("site_url", siteUrl);
            formData.append("target_language", targetLanguage);
            if (sessionId) formData.append("session_id", sessionId);

            const response = await fetch(ingestEndpoint, {
                method: "POST",
                headers: {
                    ...(await this.getApiKeysHeaders())
                },
                // Do NOT set Content-Type header manually when using FormData
                body: formData
            });

            const contentType = response.headers.get("content-type");
            let data;
            try {
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Not JSON");
                }
                data = await response.json();
            } catch (e) {
                const textBody = await response.text();
                if (textBody.includes("<!DOCTYPE html>") || textBody.includes("<html")) {
                    throw new Error("Backend returned an HTML page (Hugging Face login or error). Check your Token and Space status.");
                }
                throw new Error("Backend returned non-JSON response.");
            }

            if (!response.ok) {
                throw new Error(data.detail || data.error || `File Upload failed: ${response.status}`);
            }

            return { success: true, message: data.message };

        } catch (error) {
            console.error("File Upload Error:", error);
            return {
                success: false,
                message: error.message.includes("Failed to fetch")
                    ? `Cannot reach Backend at ${baseUrl}`
                    : error.message
            };
        }
    },

    /**
     * Triggers a background ingestion of a full GitHub repository.
     * @param {string} repoUrl - The URL of the GitHub repository.
     * @param {string} [targetLanguage="auto"] - Optional language to translate comments/docs to.
     */
    async ingestGithub(repoUrl, targetLanguage = "auto", sessionId = null) {
        const baseUrl = await this.getBaseUrl();
        const ingestEndpoint = `${baseUrl}/ingest/github`;

        try {
            console.log(`[API] Triggering GitHub ingestion for ${repoUrl} to ${ingestEndpoint} (Session: ${sessionId})...`);
            const response = await fetch(ingestEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(await this.getApiKeysHeaders())
                },
                body: JSON.stringify({
                    repo_url: repoUrl,
                    target_lang: targetLanguage,
                    session_id: sessionId
                })
            });

            const contentType = response.headers.get("content-type");
            let data;
            try {
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Not JSON");
                }
                data = await response.json();
            } catch (e) {
                const textBody = await response.text();
                if (textBody.includes("<!DOCTYPE html>") || textBody.includes("<html")) {
                    throw new Error("Backend returned an HTML page (Hugging Face login or error). Check your Token and Space status.");
                }
                throw new Error("Backend returned non-JSON response.");
            }

            if (!response.ok) {
                throw new Error(data.detail || data.error || `GitHub Ingestion failed: ${response.status}`);
            }

            return { success: true, message: data.message, job_id: data.job_id };

        } catch (error) {
            console.error("GitHub Ingestion Error:", error);
            return {
                success: false,
                message: error.message.includes("Failed to fetch")
                    ? `Cannot reach Backend at ${baseUrl}`
                    : error.message
            };
        }
    },

    async getGraphData(sessionId = null) {
        const baseUrl = await this.getBaseUrl();
        const endpoint = sessionId 
            ? `${baseUrl}/graph/session/${sessionId}`
            : `${baseUrl}/graph/data`;

        try {
            const response = await fetch(endpoint, {
                headers: await this.getApiKeysHeaders()
            });

            const contentType = response.headers.get("content-type");
            let data;
            try {
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Not JSON");
                }
                data = await response.json();
            } catch (e) {
                const textBody = await response.text();
                if (textBody.includes("<!DOCTYPE html>") || textBody.includes("<html")) {
                    throw new Error("Backend returned an HTML page (Hugging Face login or error). Check your Token and Space status.");
                }
                throw new Error("Backend returned non-JSON response.");
            }

            if (!response.ok) {
                throw new Error(data.detail || data.error || `Failed to fetch graph data: ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error("Graph Data Fetch Error:", error);
            return { success: false, nodes: [], edges: [] };
        }
    },

    async getGraphSessions() {
        const baseUrl = await this.getBaseUrl();
        const endpoint = `${baseUrl}/graph/sessions`;

        try {
            const response = await fetch(endpoint, {
                headers: await this.getApiKeysHeaders()
            });
            
            const contentType = response.headers.get("content-type");
            let data;
            try {
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Not JSON");
                }
                data = await response.json();
            } catch (e) {
                const textBody = await response.text();
                if (textBody.includes("<!DOCTYPE html>") || textBody.includes("<html")) {
                    throw new Error("Backend returned an HTML page (Hugging Face login or error). Check your Token and Space status.");
                }
                return []; // Silent fallback for list fetch if not HTML error
            }

            if (!response.ok) {
                throw new Error(data.detail || data.error || `Failed to fetch graph sessions: ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error("Graph Sessions Fetch Error:", error);
            return [];
        }
    },

    async downloadReport(sessionId, query) {
        const baseUrl = await this.getBaseUrl();
        const response = await fetch(`${baseUrl}/browser/generate_report`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(await this.getApiKeysHeaders())
            },
            body: JSON.stringify({ session_id: sessionId, query: query })
        });

        if (response.status === 202) {
            return { status: 'pending' };
        }

        if (!response.ok) {
            const err = await response.json().catch(() => ({ detail: "Failed to generate report" }));
            throw new Error(err.detail || "Server Error");
        }

        return await response.blob();
    },

    async getIngestStatus(sessionId) {
        const baseUrl = await this.getBaseUrl();
        const response = await fetch(`${baseUrl}/browser/ingest_status/${sessionId}`, {
            headers: await this.getApiKeysHeaders()
        });
        if (!response.ok) return { status: 'unknown' };
        return await response.json();
    },

    /**
     * Queries the Multi-Agent Browser orchestrator.
     * @param {string} question - User query.
     * @param {string} sessionId - Session ID.
     * @returns {Promise<Object>} Final answer and citations.
     */
    async queryBrowserMode(question, sessionId = null, options = {}) {
        console.log('[API] Sending Browser Query to Backend...', { question, ...options });
        const baseUrl = await this.getBaseUrl();
        const endpoint = `${baseUrl}/browser/query`;

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(await this.getApiKeysHeaders())
                },
                body: JSON.stringify({
                    query: question,
                    session_id: sessionId,
                    output_lang: options.outputLang || 'auto',
                    query_notebook: !!options.queryNotebook,
                    image_data: options.imagePayload || null
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server returned ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            return {
                answer: data.answer || "No response generated.",
                citations: data.citations || [],
                blocks: data.blocks || []
            };

        } catch (error) {
            console.error("Browser Backend Error:", error);
            const isNetworkError = error.message.includes("Failed to fetch");
            return {
                answer: isNetworkError
                    ? `**Connection Refused**: Cannot reach \`${baseUrl}\`.`
                    : `**Backend Error**: ${error.message}`,
                citations: []
            };
        }
    },

    /**
     * Streams RAG query response using NDJSON.
     * @param {Array} blocks - Content blocks.
     * @param {string} question - User query.
     * @param {function} onBlocks - Callback(blocks) for metadata blocks.
     * @returns {Promise<Object>} Final result/metadata.
     */
    async streamQueryRag(blocks, question, onChunk, onBlocks, siteId = null, sessionId = null, search_query = null, query_lang = null, outputLang = "auto", queryNotebook = false) {
        console.log('[API] Stream RAG request...', siteId ? `(Site: ${siteId})` : '', queryNotebook ? '(Notebook ON)' : '');
        const baseUrl = await this.getBaseUrl();

        try {
            const response = await fetch(`${baseUrl}/chat/stream`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(await this.getApiKeysHeaders())
                },
                body: JSON.stringify({
                    query: question,
                    search_query: search_query,
                    query_lang: query_lang,
                    content_blocks: blocks,
                    page_content: blocks.map(b => b.text).join('\n\n'),
                    site_id: siteId,
                    session_id: sessionId,
                    history: null,
                    output_lang: outputLang,
                    query_notebook: queryNotebook
                })
            });

            if (!response.ok) {
                throw new Error(`Stream Error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let finalMetadata = {};
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Last one is partial

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;
                    try {
                        const data = JSON.parse(trimmedLine);
                        if (data.type === 'token') {
                            onChunk(data.text);
                        } else if (data.type === 'retrieved_blocks') {
                            if (onBlocks) onBlocks(data.blocks);
                        } else if (data.type === 'usage' || data.type === 'error') {
                            finalMetadata = data;
                        }
                    } catch (e) {
                        console.warn("Stream parse error", e, "Line:", trimmedLine);
                    }
                }
            }

            // [NEW] Process remaining buffer if any (last chunk might not end with \n)
            if (buffer.trim()) {
                const trimmedLine = buffer.trim();
                try {
                    const data = JSON.parse(trimmedLine);
                    if (data.type === 'token') {
                        onChunk(data.text);
                    } else if (data.type === 'retrieved_blocks') {
                        if (onBlocks) onBlocks(data.blocks);
                    } else if (data.type === 'usage' || data.type === 'error') {
                        finalMetadata = data;
                    }
                } catch (e) {
                    console.warn("Stream flush error", e, "Line:", trimmedLine);
                }
            }

            return { success: true, ...finalMetadata };

        } catch (e) {
            console.error("Stream error", e);
            return { success: false, error: e.message };
        }
    },
    // --- Phase 3: Site Management ---
    async getSites() {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await fetch(`${baseUrl}/sites`);
            
            const contentType = response.headers.get("content-type");
            let data;
            try {
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Not JSON");
                }
                data = await response.json();
            } catch (e) {
                const textBody = await response.text();
                if (textBody.includes("<!DOCTYPE html>") || textBody.includes("<html")) {
                    throw new Error("Backend returned an HTML page (Hugging Face login or error). Check your Token and Space status.");
                }
                return [];
            }

            if (!response.ok) {
                throw new Error(data.detail || data.error || `Failed to fetch sites: ${response.status}`);
            }
            return data.sites || [];
        } catch (e) {
            console.error("Get Sites Error", e);
            return [];
        }
    },
    async deleteSite(siteId) {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await fetch(`${baseUrl}/sites/${siteId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error("Failed to delete site");
            return { success: true };
        } catch (e) {
            console.error("Delete Site Error", e);
            return { success: false, error: e.message };
        }
    },

    /**
     * Export site content
     * @param {string} siteUrl - URL to export
     * @param {string} format - 'json' or 'text'
     */
    async exportSite(siteUrl, format = 'json') {
        const encodedUrl = encodeURIComponent(siteUrl);
        const baseUrl = await this.getBaseUrl();
        const url = `${baseUrl}/export/${encodedUrl}?format=${format}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Export failed: ${response.statusText}`);

            // Trigger download
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `export_${siteUrl.replace(/[^a-z0-9]/gi, '_')}.${format === 'json' ? 'json' : 'txt'}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            return { success: true };
        } catch (error) {
            console.error('Export error:', error);
            return { success: false, error: error.message };
        }
    },

    // --- Phase 19: Bookmarking ---
    async getBookmarks() {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await fetch(`${baseUrl}/bookmarks`);
            
            const contentType = response.headers.get("content-type");
            let data;
            try {
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Not JSON");
                }
                data = await response.json();
            } catch (e) {
                const textBody = await response.text();
                if (textBody.includes("<!DOCTYPE html>") || textBody.includes("<html")) {
                    throw new Error("Backend returned an HTML page (Hugging Face login or error). Check your Token and Space status.");
                }
                return [];
            }

            if (!response.ok) {
                throw new Error(data.detail || data.error || `Failed to fetch bookmarks: ${response.status}`);
            }
            return data.bookmarks || [];
        } catch (e) {
            console.error("Get Bookmarks Error", e);
            return [];
        }
    },
    async createBookmark(content, sourceUrl, metadata = {}) {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await fetch(`${baseUrl}/bookmarks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(await this.getApiKeysHeaders())
                },
                body: JSON.stringify({
                    content,
                    source_url: sourceUrl,
                    metadata
                })
            });

            const contentType = response.headers.get("content-type");
            let data;
            try {
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Not JSON");
                }
                data = await response.json();
            } catch (e) {
                const textBody = await response.text();
                if (textBody.includes("<!DOCTYPE html>") || textBody.includes("<html")) {
                    throw new Error("Backend returned an HTML page (Hugging Face login or error). Check your Token and Space status.");
                }
                throw new Error("Backend returned non-JSON response.");
            }

            if (!response.ok) {
                throw new Error(data.detail || data.error || `Failed to create bookmark: ${response.status}`);
            }
            return data;
        } catch (e) {
            console.error("Create Bookmark Error", e);
            return { success: false, error: e.message };
        }
    },
    async deleteBookmark(bookmarkId) {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await fetch(`${baseUrl}/bookmarks/${bookmarkId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error("Failed to delete bookmark");
            return { success: true };
        } catch (e) {
            console.error("Delete Bookmark Error", e);
            return { success: false, error: e.message };
        }
    },
    /**
     * Polls the status of a background ingestion job.
     * @param {number} jobId - The job ID returned from /ingest/github.
     * @returns {Promise<Object>} { status: 'processing'|'completed'|'failed', message, files_processed, chunks_count }
     */
    async getIngestionStatus(jobId) {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await fetch(`${baseUrl}/ingest/status/${jobId}`, {
                headers: { ...(await this.getApiKeysHeaders()) }
            });

            const contentType = response.headers.get("content-type");
            let data;
            try {
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Not JSON");
                }
                data = await response.json();
            } catch (e) {
                const textBody = await response.text();
                if (textBody.includes("<!DOCTYPE html>") || textBody.includes("<html")) {
                    throw new Error("Backend returned an HTML page (Hugging Face login or error). Check your Token and Space status.");
                }
                throw new Error("Backend returned non-JSON response.");
            }

            if (!response.ok) {
                throw new Error(data.detail || data.error || `Status fetch failed: ${response.status}`);
            }
            return data;
        } catch (e) {
            console.error("[API] getIngestionStatus Error:", e);
            return { status: 'processing', message: e.message };
        }
    }
};
