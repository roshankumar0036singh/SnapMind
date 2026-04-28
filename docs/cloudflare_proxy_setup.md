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

    // Clone all headers from the original request
    const headers = new Headers(request.headers);
    
    // [CRITICAL] Preserve the original Authorization token (Supabase JWT)
    // BEFORE we overwrite Authorization with the HF token.
    // This ensures user identity is forwarded to the backend.
    const originalAuth = request.headers.get("Authorization");
    if (originalAuth && originalAuth.startsWith("Bearer ")) {
      const originalToken = originalAuth.split(" ")[1];
      // Only preserve if it's NOT already an HF token
      if (!originalToken.startsWith("hf_")) {
        headers.set("x-supabase-auth", originalToken);
      }
    }
    
    // Now overwrite Authorization with the HF Token for private space access
    headers.set("Authorization", `Bearer ${env.HF_TOKEN}`);
    
    // Add CORS headers for your extension
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,DELETE,OPTIONS",
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

### Key Change: The `x-supabase-auth` Preservation Logic
The Worker now automatically extracts the Supabase JWT from the original `Authorization` header and copies it into a custom `x-supabase-auth` header **before** overwriting `Authorization` with the HF Token. This means:
- The backend gets `Authorization: Bearer hf_...` (for HF private space access)
- The backend ALSO gets `x-supabase-auth: <supabase_jwt>` (for user identification)
- The extension doesn't need any special handling — it just sends its normal `Authorization` header.

## 3. Set the Secret Token
1. In the Worker dashboard, go to **Settings** -> **Variables**.
2. Under **Environment Variables**, click **Add Variable**.
3. **Variable Name**: `HF_TOKEN`
4. **Value**: Your Hugging Face token
5. Click **Encrypt** (MANDATORY).
6. Click **Save and Deploy**.

## 4. Your Worker URL
Your deployed worker URL: `https://snapmind-gateway.roshankumar30080.workers.dev`

**Now your token is 100% server-side and invisible!**
