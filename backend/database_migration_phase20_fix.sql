-- Phase 20 Fix: Update bookmarks embedding dimension to 3072
ALTER TABLE bookmarks ALTER COLUMN embedding TYPE halfvec(3072);
