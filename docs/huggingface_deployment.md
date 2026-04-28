# Deploying SnapMind to Hugging Face Spaces

Hugging Face (HF) Spaces is a powerful, free way to host the SnapMind backend. By using a Docker Space, you get a public API with free SSL.

## 1. Setup HF Docker Space
1. Create a new Space on Hugging Face.
2. Select **Docker** as the SDK.
3. Choose the **Blank** template or **FastAPI**.

## 2. Dockerfile Configuration
Hugging Face Spaces require a specific non-root user setup. I have created a specialized file for this: **[Dockerfile.hf](file:///d:/Rag/backend/Dockerfile.hf)**.

- **Setup**: In your HF Space settings, ensure the Dockerfile path is set to `backend/Dockerfile.hf`.
- **User UID**: This file uses UID 1000, which is required for HF persistent storage and permissions.

## 3. Keep-Alive (The "Ping Bot" Strategy)
Free HF Spaces go to sleep after 48 hours. To keep SnapMind awake 24/7:

### Option A: Cron-job.org (Easiest)
1. Go to [Cron-job.org](https://cron-job.org).
2. Create a new job.
3. **URL**: `https://<your-username>-<your-space-name>.hf.space/api/v1/health`
4. **Interval**: Every 15 minutes.
5. This external "ping" tells Hugging Face that the service is in active use, preventing it from ever sleeping.

### Option B: GitHub Actions Heartbeat
Create a `.github/workflows/heartbeat.yml` in your repo:
```yaml
name: Space Heartbeat
on:
  schedule:
    - cron: '*/15 * * * *' # Every 15 mins
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl https://<your-username>-<your-space-name>.hf.space/api/v1/health
```

## 4. Default Domain
HF provides a direct URL: `https://<username>-<space-name>.hf.space`. 
**Note**: Ensure your Space is set to **Public** for the extension to reach it.

## 5. Environment Secrets
Add your keys (GEMINI_API_KEY, etc.) in the Space's **Settings -> Variables and Secrets** tab. Do NOT put them in the Dockerfile.

## 6. Code Privacy (Private Source / Public API)
If you want to keep your code private but have a public API:
1. **Private Registry**: Build your Docker image in a Private GitHub repository and push it to **GitHub Container Registry (GHCR)** as a private image.
2. **HF Image Pull**: In your Public Hugging Face Space's `Dockerfile`, simply use:
   ```dockerfile
   FROM ghcr.io/<your-username>/snapmind-backend:latest
   ```
3. **HF Secret**: Add a secret named `GHCR_PAT` (GitHub Personal Access Token) in HF to allow it to pull from your private registry.
This way, the public can see the 1-line Dockerfile, but your **actual source code remains 100% hidden** in your private repo.

## 7. Eliminating Cold Starts
By using the **Ping Bot** (Cron-job.org or GitHub Actions) to request the `/health` endpoint every 15 minutes:
- Hugging Face detects constant traffic.
- The container remains in memory.
- **Result**: Zero cold starts. The extension will get instant responses every time.
