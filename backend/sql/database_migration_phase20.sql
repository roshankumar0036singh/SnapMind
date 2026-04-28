-- Phase 20: Add embedding to bookmarks for semantic search
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS embedding halfvec(1536);

-- Optional: Create an index for faster search if the user saves many bookmarks
-- CREATE INDEX ON bookmarks USING hnsw (embedding halfvec_cosine_ops);
