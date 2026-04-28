# Deploying SnapMind to Koyeb

Koyeb is an excellent platform for hosting the SnapMind backend using Docker. It provides high performance, global edge networking, and free SSL by default.

## 1. Prerequisites
- A Koyeb account.
- Your SnapMind repository pushed to GitHub.
- All API keys (Supabase, Gemini, Groq, etc.) ready.

## 2. Deployment Steps
1. **Create an App**:
   - Go to the Koyeb Console -> **Create App**.
   - Choose **GitHub** as the source.
   - Select your `SnapMind` repository.

2. **Configure Service**:
   - **Service Name**: `snapmind-backend`.
   - **Build Method**: Select **Docker**.
   - **Docker Context Directory**: `/backend` (Important: ensure it points to the folder containing the `Dockerfile`).
   - **Docker File**: `Dockerfile`.

3. **Instance Selection**:
   - Choose a size (e.g., `Nano` or `Micro`). For research agents with Playwright, `Micro` or larger is recommended to avoid OOM (Out of Memory) errors.

4. **Environment Variables**:
   Add all variables from your `.env` file, especially:
   - `DATABASE_URL` (Supabase connection string)
   - `GEMINI_API_KEY`
   - `GROQ_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `PORT`: `10000` (or leave as default if using start.sh)

5. **Expose Ports**:
   - Set **Exposed Port** to `10000` (or whichever port your Dockerfile EXPOSEs).
   - Set **Public Path** to `/`.

6. **Deploy**: Click **Deploy**. Koyeb will pull your image, install dependencies (including Playwright/Chromium), and launch the service.

## 3. Post-Deployment Access
- Koyeb will provide a URL like `https://snapmind-backend-<your-id>.koyeb.app`.
- Use this URL in your extension settings.

## 4. Why Koyeb?
- **Global Edge**: Low latency for your research agents.
- **Auto-healing**: Koyeb automatically restarts your backend if it crashes.
- **Zero-config SSL**: Fully managed HTTPS.
