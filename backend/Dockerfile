# Use an optimized Python runtime
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/app/pw-browsers

# Set the working directory
WORKDIR /app

# Install critical system dependencies for PostgreSQL, Git, and Playwright
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    git \
    curl \
    # Playwright system dependencies
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
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright and Chromium specifically
RUN python -m playwright install chromium --with-deps

# Copy application code
COPY . .

# Make the start script executable
RUN chmod +x /app/start.sh

# Use Port 10000 (Render default) or 8080 (Railway default)
EXPOSE 10000

# Use the start script to handle migrations and startup
CMD ["/app/start.sh"]
