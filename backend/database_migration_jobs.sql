-- Migration: Create ingestion_jobs table for background task tracking
-- Run this SQL against your PostgreSQL database before restarting the backend.

CREATE TABLE IF NOT EXISTS ingestion_jobs (
    job_id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    status TEXT DEFAULT 'processing', -- 'processing', 'completed', 'failed'
    message TEXT,
    files_processed INT DEFAULT 0,
    chunks_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_url ON ingestion_jobs(url);
