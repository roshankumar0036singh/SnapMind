/**
 * API Client for handling Backend/LLM communication.
 */
import { supabase } from '../shared/supabaseClient';


const DEFAULT_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export const apiClient = {
    /**
     * Generic GET helper with auth and base URL.
     */
    async get(endpoint) {
        const baseUrl = await this.getBaseUrl();
        const response = await fetch(`${baseUrl}${endpoint}`, {
            headers: await this.getApiKeysHeaders()
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ detail: `Fetch failed: ${response.status}` }));
            throw new Error(err.detail || "Server Error");
        }
        return await response.json();
    },

    /**
     * Generic POST helper with auth and base URL.
     */
    async post(endpoint, body) {
        const baseUrl = await this.getBaseUrl();
        const response = await fetch(`${baseUrl}${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(await this.getApiKeysHeaders())
            },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ detail: `POST failed: ${response.status}` }));
            throw new Error(err.detail || "Server Error");
        }
        return await response.json();
    },

    /**
     * Retrieves the backend base URL.
     * Prioritizes VITE_BACKEND_URL environment variable, falling back to default production node.
     */
    async getBaseUrl() {
        // Fallback to Environment Variable (Vite)
        const envUrl = import.meta.env.VITE_BACKEND_URL;
        if (envUrl) return envUrl.replace(/\/$/, "");

        // Finally, use hardcoded production default
        return DEFAULT_BACKEND_URL.replace(/\/$/, "");
    },

    /**
     * Retrieves all custom API keys from extension storage to pass to the backend.
     */
    async getApiKeysHeaders() {
        return new Promise(async (resolve) => {
            // 1. Get Supabase Auth Session
            const { data: { session } } = await supabase.auth.getSession();

            chrome.storage.local.get(['geminiApiKey', 'mistralApiKey', 'lingodevApiKey', 'firecrawlApiKey', 'groqApiKey'], (res) => {
                const headers = {};
                if (res.geminiApiKey) headers['x-gemini-key'] = res.geminiApiKey;
                if (res.mistralApiKey) headers['x-mistral-key'] = res.mistralApiKey;
                if (res.lingodevApiKey) headers['x-lingodev-key'] = res.lingodevApiKey;
                if (res.firecrawlApiKey) headers['x-firecrawl-key'] = res.firecrawlApiKey;

                // 2. Set Authorization Header for Backend Security (Supabase Token)
                // Note: Hugging Face overwrites the standard Authorization header.
                // We MUST use x-supabase-auth so the backend can read the JWT!
                if (session?.access_token) {
                    headers['x-supabase-auth'] = session.access_token;
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
            const response = await fetch(`${baseUrl}/api/v1/translate`, {
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

    // --- Personal API Keys for MCP / CLI ---

    async generateApiKey(name = "Default") {
        const url = `${this.baseUrl}/auth/generate-key`;
        return this._fetchWithAuth(url, {
            method: 'POST',
            body: JSON.stringify({ name })
        });
    },

    async listApiKeys() {
        const url = `${this.baseUrl}/auth/keys`;
        return this._fetchWithAuth(url, {
            method: 'GET'
        });
    },

    async revokeApiKey(keyId) {
        const url = `${this.baseUrl}/auth/keys/${keyId}`;
        return this._fetchWithAuth(url, {
            method: 'DELETE'
        });
    },

    /**
     * Retrieves the API key from local storage or returns default.
     * @returns {Promise<string>} The API key or null.
     */
    async getApiKey() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['geminiApiKey'], (result) => {
                resolve(result.geminiApiKey || null);
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
            console.log(`[API] analyzeImage calling: ${baseUrl}/api/v1/vision/analyze-image (Mode: ${mode})`);

            const response = await fetch(`${baseUrl}/api/v1/vision/analyze-image`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(await this.getApiKeysHeaders())
                },
                body: JSON.stringify({
                    image_data: base64Image,
                    prompt: prompt,
                    mode: mode,
                    target_lang: options.outputLang || "auto",
                    active_context: options.activeContext || null
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
                    throw new Error(`Backend returned HTML instead of JSON. Ensure your Backend URL is correct and not hitting a dev server or proxy. (URL: ${baseUrl}/api/v1/vision/analyze-image)`);
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
            const isNetworkError = error?.message?.includes("Failed to fetch");
            return {
                answer: isNetworkError
                    ? `**Connection Refused**: Cannot reach \`${baseUrl}\`.`
                    : `Error analyzing image: ${error?.message || 'Unknown error'}`
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
        const chatEndpoint = `${baseUrl}/api/v1/search/chat`;

        try {
            console.log(`[API] Fetching ${chatEndpoint}...`);

            const response = await fetch(`${baseUrl}/api/v1/search/chat`, {
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
                    query_notebook: !!arguments[2]?.queryNotebook, // Access from potential options object
                    workspace_id: arguments[2]?.workspaceId || null
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
            const isNetworkError = error?.message?.includes("Failed to fetch") || error?.message?.includes("NetworkError");

            return {
                answer: isNetworkError
                    ? `**Connection Refused**: Cannot reach \`${baseUrl}\`.`
                    : `**Backend Error**: ${error?.message || 'Unknown error'}`,
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
        const tagsEndpoint = `${baseUrl}/api/v1/tags`;

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
        const suggestEndpoint = `${baseUrl}/api/v1/chat/suggest`;

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
        const ingestEndpoint = `${baseUrl}/api/v1/ingest`;

        try {
            const apiKeysHeaders = await this.getApiKeysHeaders();
            console.log(`[API-DEBUG] Ingest Endpoint: ${ingestEndpoint}`);
            console.log(`[API-DEBUG] Headers keys: ${Object.keys(apiKeysHeaders).join(", ")}`);
            console.log(`[API-DEBUG] Auth Header present: ${!!apiKeysHeaders['Authorization']}`);

            console.log(`[API] Ingesting ${url} to ${ingestEndpoint} (mode: ${crawl_mode}, lang: ${target_lang})...`);
            const response = await fetch(ingestEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...apiKeysHeaders
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
                message: error?.message?.includes("Failed to fetch")
                    ? `Cannot reach Backend at ${baseUrl}`
                    : error?.message || 'Unknown error'
            };
        }
    },

    /**
     * Streams ingestion progress using NDJSON.
     */
    async streamIngest(url, text = null, sessionId = null, onProgress, mode = "single", maxPages = 50, maxDepth = 3, workspaceId = null) {
        console.log('[API] Stream Ingest request...', url);
        const baseUrl = await this.getBaseUrl();
        const headers = await this.getApiKeysHeaders();

        try {
            const bodyPayload = {
                url,
                session_id: sessionId,
                stream: true,
                crawl_mode: mode,
                max_pages: maxPages,
                max_depth: maxDepth,
                workspace_id: workspaceId
            };
            if (text) {
                bodyPayload.text = text;
            }

            const response = await fetch(`${baseUrl}/api/v1/ingest`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...headers },
                body: JSON.stringify(bodyPayload)
            });

            if (!response.ok) throw new Error(`Stream Ingest Error: ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            let finalResult = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        // Terminal state check (success or error payload)
                        if (data.success !== undefined) {
                            finalResult = data;
                            // Also call onProgress once more with final result
                            if (onProgress) onProgress({ status: data.success ? "completed" : "failed", message: data.message || data.error, progress: 100 });
                        } else {
                            // Progress event
                            if (onProgress) onProgress(data);
                        }
                    } catch (e) {
                        console.error("[Stream] Parse Error:", e, line);
                    }
                }
            }
            return finalResult || { success: true };
        } catch (error) {
            console.error("Stream Ingest Error:", error);
            if (onProgress) onProgress({ status: "failed", message: error.message, progress: 0 });
            return { success: false, error: error.message };
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
        const ingestEndpoint = `${baseUrl}/api/v1/ingest`; // Match backend route

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
                    text: text,
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
                message: error?.message?.includes("Failed to fetch")
                    ? `Cannot reach Backend at ${baseUrl}`
                    : error?.message || 'Unknown error'
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
        const ingestEndpoint = `${baseUrl}/api/v1/ingest/file`;

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
                message: error?.message?.includes("Failed to fetch")
                    ? `Cannot reach Backend at ${baseUrl}`
                    : error?.message || 'Unknown error'
            };
        }
    },

    /**
     * Gets all workspaces for the current user
     */
    async getWorkspaces() {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await fetch(`${baseUrl}/api/v1/workspaces/`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    ...(await this.getApiKeysHeaders())
                }
            });

            if (!response.ok) {
                console.error(`[API] fetch Workspaces failed: ${response.status}`);
                return { success: false, data: [] };
            }

            const data = await response.json();
            return { success: true, data: data };
        } catch (error) {
            console.error("fetch Workspaces Error:", error);
            return { success: false, data: [] };
        }
    },

    /**
     * Triggers a background ingestion of a full GitHub repository.
     * @param {string} repoUrl - The URL of the GitHub repository.
     * @param {string} [targetLanguage="auto"] - Optional language to translate comments/docs to.
     */
    async ingestGithub(repoUrl, targetLanguage = "auto", sessionId = null) {
        const baseUrl = await this.getBaseUrl();
        const ingestEndpoint = `${baseUrl}/api/v1/ingest/github`;

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
                message: error?.message?.includes("Failed to fetch")
                    ? `Cannot reach Backend at ${baseUrl}`
                    : error?.message || 'Unknown error'
            };
        }
    },

    async getGraphData(sessionId = null) {
        const baseUrl = await this.getBaseUrl();
        const endpoint = sessionId
            ? `${baseUrl}/api/v1/graph/session/${sessionId}`
            : `${baseUrl}/api/v1/graph/data`;

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
        const endpoint = `${baseUrl}/api/v1/graph/sessions`;

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
        const response = await fetch(`${baseUrl}/api/v1/research/generate_report`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(await this.getApiKeysHeaders())
            },
            body: JSON.stringify({ 
                session_ids: [sessionId], 
                query: query,
                output_lang: "auto"
            })
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
        const response = await fetch(`${baseUrl}/api/v1/ingest/status/${sessionId}`, {
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
        const endpoint = `${baseUrl}/api/v1/research/research`;

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
                    image_data: options.imagePayload || null,
                    research_mode: options.research_mode || 'general'
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
                blocks: data.blocks || [],
                status: data.status,
                locked_url: data.locked_url
            };

        } catch (error) {
            console.error("Browser Backend Error:", error);
            const isNetworkError = error?.message?.includes("Failed to fetch");
            return {
                answer: isNetworkError
                    ? `**Connection Refused**: Cannot reach \`${baseUrl}\`.`
                    : `**Backend Error**: ${error?.message || 'Unknown error'}`,
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
    async streamQueryRag(blocks, question, onChunk, onBlocks, siteId = null, sessionId = null, search_query = null, query_lang = null, outputLang = "auto", queryNotebook = false, onThought = null, workspaceId = null) {
        console.log('[API] Stream RAG request...', siteId ? `(Site: ${siteId})` : '', queryNotebook ? '(Notebook ON)' : '', workspaceId ? `(Workspace: ${workspaceId})` : '');
        const baseUrl = await this.getBaseUrl();

        try {
            const response = await fetch(`${baseUrl}/api/v1/search/chat/stream`, {
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
                    query_notebook: queryNotebook,
                    workspace_id: workspaceId
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
                        } else if (data.type === 'answer') {
                            onChunk(data.data);
                        } else if (data.type === 'thought') {
                            if (onThought) onThought(data.data);
                        } else if (data.type === 'retrieved_blocks') {
                            if (onBlocks) onBlocks(data.blocks);
                        } else if (data.type === 'metadata' || data.type === 'usage' || data.type === 'error') {
                            finalMetadata = { ...finalMetadata, ...data };
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
            const response = await fetch(`${baseUrl}/api/v1/sites`, {
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
            const response = await fetch(`${baseUrl}/api/v1/sites/${siteId}`, { 
                method: 'DELETE',
                headers: await this.getApiKeysHeaders() 
            });
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
        const url = `${baseUrl}/api/v1/export/${encodedUrl}?format=${format}`;

        try {
            const response = await fetch(url, {
                headers: await this.getApiKeysHeaders()
            });
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
            return { success: false, error: error?.message || 'Unknown error' };
        }
    },

    // --- Phase 19: Bookmarking ---
    async getBookmarks() {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await fetch(`${baseUrl}/api/v1/bookmarks`, {
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
            const response = await fetch(`${baseUrl}/api/v1/bookmarks`, {
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
            const response = await fetch(`${baseUrl}/api/v1/bookmarks/${bookmarkId}`, { 
                method: 'DELETE',
                headers: await this.getApiKeysHeaders()
            });
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
            const response = await fetch(`${baseUrl}/api/v1/ingest/status/${jobId}`, {
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
    },

    async savePageData(url, text, folderName = "General") {
        const baseUrl = await this.getBaseUrl();
        const endpoint = `${baseUrl}/api/v1/saved-pages`;
        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(await this.getApiKeysHeaders())
                },
                body: JSON.stringify({ url, text, folder_name: folderName })
            });
            return await response.json();
        } catch (e) {
            console.error("Save Page Error:", e);
            return { success: false, detail: e.message };
        }
    },

    async getSavedPages() {
        const baseUrl = await this.getBaseUrl();
        const endpoint = `${baseUrl}/api/v1/saved-pages`;
        try {
            const response = await fetch(endpoint, {
                headers: await this.getApiKeysHeaders()
            });
            return await response.json();
        } catch (e) {
            console.error("Get Saved Pages Error:", e);
            return { success: false, data: [] };
        }
    },

    /**
     * Triggers multipage ingestion for a chatbot widget.
     */
    async ingestWidget(url, widgetId, maxPages = 50, maxDepth = 3) {
        const baseUrl = await this.getBaseUrl();
        const endpoint = `${baseUrl}/api/v1/widget/ingest`;

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(await this.getApiKeysHeaders())
                },
                body: JSON.stringify({
                    url: url,
                    widget_id: widgetId,
                    max_pages: maxPages,
                    max_depth: maxDepth
                })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({ detail: "Ingest failed" }));
                throw new Error(data.detail || `Server Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error("Widget Ingest Error:", error);
            return { success: false, message: error.message };
        }
    }
};
