# Final hardened Dockerfile for Hugging Face Spaces (Root Version)
# This version handles Playwright dependencies as ROOT before switching users

FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=7860
ENV HOME=/home/user
ENV PATH="/home/user/.local/bin:${PATH}"

# Install system dependencies (All dependencies MUST be here, as root)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    git \
    curl \
    # Playwright/Chromium dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    # Additional dependencies often needed by Playwright
    libxshmfence1 \
    libglu1-mesa \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user with UID 1000
RUN useradd -m -u 1000 user
USER user
WORKDIR $HOME/app

# 1. Copy the entire repository
COPY --chown=user . .

# 2. Move into the backend directory
WORKDIR $HOME/app/backend

# 3. Install Python dependencies
# IMPORTANT: No '--with-deps' in playwright install to avoid sudo requirement
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --user -r requirements.txt && \
    python -m playwright install chromium

# 4. Ensure start.sh is executable
RUN chmod +x start.sh

# Expose the port HF expects
EXPOSE 7860

# Start the application
CMD ["./start.sh"]
