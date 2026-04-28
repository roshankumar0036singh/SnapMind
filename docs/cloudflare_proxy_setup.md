# Cloudflare Worker Proxy Setup (High Security)

This guide explains how to set up a Cloudflare Worker to act as a secure gateway for your private Hugging Face Space. This prevents your `HF_TOKEN` from ever being exposed to the extension code or network logs.

## 1. Create the Worker
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Go to **Workers & Pages** -> **Create application** -> **Create Worker**.
3. Name it (e.g., `snapmind-gateway`).
4. Click **Deploy**.

## 2. Worker Code (`worker.js`)
Click **Edit Code** and replace the contents with this:

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // The target Private Hugging Face Space URL
    const TARGET_BASE = "https://roshan123478-snapmindai.hf.space";
    
    // Create new URL for the backend
    const targetUrl = new URL(url.pathname + url.search, TARGET_BASE);

    // Clone headers and add the Secret Token
    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${env.HF_TOKEN}`);
    
    // Add CORS headers for your extension
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // Or specific extension ID
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-gemini-key, x-mistral-key, x-groq-key, x-lingodev-key, x-firecrawl-key, x-supabase-auth",
    };

    // Handle Preflight OPTIONS request
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: headers,
        body: request.method !== "GET" && request.method !== "HEAD" ? await request.clone().arrayBuffer() : null,
      });

      // Clone response and add CORS headers
      const newResponse = new Response(response.body, response);
      Object.keys(corsHeaders).forEach(key => newResponse.headers.set(key, corsHeaders[key]));
      
      return newResponse;
    } catch (e) {
      return new Response(JSON.stringify({ error: "Gateway Error", detail: e.message }), { 
        status: 502, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      });
    }
  },
};
```

## 3. Set the Secret Token
1. In the Worker dashboard, go to **Settings** -> **Variables**.
2. Under **Environment Variables**, click **Add Variable**.
3. **Variable Name**: `HF_TOKEN`
4. **Value**: `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`
5. Click **Encrypt** (MANDATORY).
6. Click **Save and Deploy**.

## 4. Update the Extension
Once deployed, you will get a URL like `https://snapmind-gateway.your-subdomain.workers.dev`.
Set this as your `VITE_BACKEND_URL` in the extension's `.env`.

**Now your token is 100% server-side and invisible!** 🛡️✨
