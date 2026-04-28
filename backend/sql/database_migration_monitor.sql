-- Migration for Web Monitoring / Refresh Suggestions
CREATE TABLE IF NOT EXISTS refresh_suggestions (
    id SERIAL PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    last_indexed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending', -- 'pending', 'ignore', 'completed'
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_suggestions_status ON refresh_suggestions(status);
