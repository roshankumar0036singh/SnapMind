# Deploying SnapMind to Oracle Cloud (OCI)

This guide provides a step-by-step roadmap to host the SnapMind backend on Oracle Cloud Infrastructure (OCI) for maximum performance and cost-efficiency (using the Always Free tier if available).

## 1. Provision Infrastructure
1. **Create an Instance**:
   - Go to **Compute -> Instances -> Create Instance**.
   - **Image**: Ubuntu 22.04 or 24.04.
   - **Shape**: `VM.Standard.A1.Flex` (ARM-based) is recommended for 24GB RAM on Always Free. If unavailable, use `VM.Standard.E4.Flex`.
   - **Networking**: Ensure a Public IP is assigned.
   - **SSH Keys**: Download your private key.

2. **Configure Virtual Cloud Network (VCN)**:
   - Go to your VCN -> **Security Lists**.
   - Add **Ingress Rules** for:
     - `80` (HTTP)
     - `443` (HTTPS)
     - `10000` (Backend API Port)

## 2. Server Setup
Connect via SSH:
```bash
ssh -i <your-key>.key ubuntu@<your-public-ip>
```

Install Docker and Docker Compose:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER
newgrp docker
```

## 3. Clone and Configure
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/roshankumar0036singh/SnapMind.git
   cd SnapMind/backend
   ```

2. **Set up Environment Variables**:
   ```bash
   cp .env.example .env
   nano .env
   ```
   Ensure `DATABASE_URL` (Supabase), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and LLM keys are correctly set.

## 4. Build and Launch
Build the high-fidelity container (this will install Playwright and Chromium):
```bash
docker build -t snapmind-backend .
docker run -d --name snapmind-backend \
  -p 10000:10000 \
  --env-file .env \
  --restart always \
  snapmind-backend
```

## 5. Reverse Proxy & SSL (Recommended)
### Option A: With a Domain (Caddy)
1. Install Caddy:
   ```bash
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update && sudo apt install caddy
   ```
2. Configure Caddy:
   ```bash
   sudo nano /etc/caddy/Caddyfile
   ```
   Add:
   ```caddy
   your-domain.com {
       reverse_proxy localhost:10000
   }
   ```
3. Restart Caddy: `sudo systemctl restart caddy`

### Option B: No Domain? No Problem
If you don't have a domain, you have two choices:

1. **Direct IP Access**:
   - Access your API at `http://<YOUR_PUBLIC_IP>:10000`.
   - **Note**: This will be insecure (HTTP) and some browsers may block extension requests to non-HTTPS endpoints.

2. **Cloudflare Tunnel (Best for No-Domain)**:
   - This provides a free HTTPS URL without needing a domain or opening ports.
   - Install `cloudflared`:
     ```bash
     curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
     sudo dpkg -i cloudflared.deb
     ```
   - Authenticate and create a tunnel:
     ```bash
     cloudflared tunnel login
     cloudflared tunnel create snapmind-tunnel
     ```
   - Route traffic:
     ```bash
     cloudflared tunnel route dns snapmind-tunnel snapmind.your-free-subdomain.com 
     # OR use the 'Quick Tunnel' feature for a random URL:
     cloudflared tunnel --url http://localhost:10000
     ```

## 6. Maintenance
- **Logs**: `docker logs -f snapmind-backend`
- **Updates**: `git pull && docker build -t snapmind-backend . && docker restart snapmind-backend`
