-- Migration script for GraphRAG tables

-- Nodes table to store entities
CREATE TABLE IF NOT EXISTS nodes (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    entity_type TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Edges table to store relationships
CREATE TABLE IF NOT EXISTS edges (
    id SERIAL PRIMARY KEY,
    source_node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
    target_node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
    relation TEXT NOT NULL,
    source_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster retrieval
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes(name);
