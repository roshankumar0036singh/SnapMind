# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set environment variables
# Pythondontwritebytecode: Prevents Python from writing pyc files to disc
# Pythonunbuffered: Prevents Python from buffering stdout and stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies
# gcc and libpq-dev are often needed for psychopg2 (PostgreSQL) if you use it
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the current directory contents into the container at /app
COPY . .

# Make port 7860 available (Hugging Face Spaces default)
EXPOSE 7860

# Run app.py when the container launches
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
