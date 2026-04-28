# Robust Root Dockerfile for Hugging Face Spaces
# This version copies the entire repository to ensure paths are always found

FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=7860
ENV HOME=/home/user

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    git \
    curl \
    # Playwright dependencies
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
    librandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user with UID 1000
RUN useradd -m -u 1000 user
USER user
WORKDIR $HOME/app

# 1. Copy the entire repository into the container
# This guarantees that the 'backend' folder is available
COPY --chown=user . .

# 2. Move into the backend directory for execution
WORKDIR $HOME/app/backend

# 3. Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    python -m playwright install chromium --with-deps

# 4. Ensure start.sh is executable
RUN chmod +x start.sh

# Expose the port HF expects
EXPOSE 7860

# Start the application from the backend directory
CMD ["./start.sh"]
