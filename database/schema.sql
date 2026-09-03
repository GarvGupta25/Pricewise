-- Shopping Agent database schema.
-- Run in the Supabase SQL editor, or in PostgreSQL with pgvector installed.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_site TEXT NOT NULL,
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    specs JSONB DEFAULT '{}'::jsonb,
    current_price INT,
    rating NUMERIC(2,1),
    review_count INT,
    embedding VECTOR(768),
    last_scraped_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT products_source_url_unique UNIQUE (source_url)
);

CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price INT NOT NULL CHECK (price >= 0),
    recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL UNIQUE,
    state JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_embedding
    ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_products_category ON products (category);
CREATE INDEX idx_products_brand ON products (brand);
CREATE INDEX idx_products_last_scraped_at ON products (last_scraped_at DESC);
CREATE INDEX idx_price_history_product ON price_history (product_id, recorded_at DESC);
CREATE INDEX idx_conversations_session ON conversations (session_id);

CREATE VIEW product_price_stats AS
SELECT
    p.id AS product_id,
    p.title,
    p.current_price,
    MIN(ph.price) AS all_time_low,
    AVG(ph.price) FILTER (WHERE ph.recorded_at >= now() - INTERVAL '90 days') AS avg_90_day,
    COUNT(ph.id) AS history_points
FROM products p
LEFT JOIN price_history ph ON ph.product_id = p.id
GROUP BY p.id, p.title, p.current_price;
