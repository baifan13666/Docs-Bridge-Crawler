-- ============================================================================
-- RAG System Database Enhancements
-- ============================================================================
-- This script adds essential fields and indexes for a production-ready RAG system
-- Features: Full-text search, metadata, deduplication, analytics, and hybrid search
-- ============================================================================

-- ============================================================================
-- PART 1: Add New Columns to document_chunks
-- ============================================================================

-- Full-text search vector (for hybrid retrieval)
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Metadata storage (flexible JSON for various use cases)
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Deduplication hash
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS chunk_hash text;

-- Hierarchical chunking support
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS parent_chunk_id uuid REFERENCES document_chunks(id) ON DELETE SET NULL;

-- Quality metrics
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS semantic_density float;
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS readability_score float;

-- Analytics fields
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS retrieval_count integer DEFAULT 0;
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS avg_relevance_score float;
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS last_retrieved_at timestamp with time zone;

-- ============================================================================
-- PART 2: Add New Columns to kb_documents
-- ============================================================================

-- Crawl tracking
ALTER TABLE kb_documents 
ADD COLUMN IF NOT EXISTS last_crawled_at timestamp with time zone;
ALTER TABLE kb_documents 
ADD COLUMN IF NOT EXISTS crawl_frequency text DEFAULT 'weekly';
ALTER TABLE kb_documents 
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;
ALTER TABLE kb_documents 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Document metadata
ALTER TABLE kb_documents 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- ============================================================================
-- PART 3: Create Indexes for Performance
-- ============================================================================

-- Full-text search index (GIN for tsvector)
CREATE INDEX IF NOT EXISTS idx_document_chunks_search_vector 
ON document_chunks USING gin(search_vector);

-- Metadata search index (GIN for jsonb)
CREATE INDEX IF NOT EXISTS idx_document_chunks_metadata 
ON document_chunks USING gin(metadata);

CREATE INDEX IF NOT EXISTS idx_kb_documents_metadata 
ON document_chunks USING gin(metadata);

-- Deduplication index
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_chunks_hash 
ON document_chunks(chunk_hash) 
WHERE chunk_hash IS NOT NULL;

-- Parent-child relationship index
CREATE INDEX IF NOT EXISTS idx_document_chunks_parent 
ON document_chunks(parent_chunk_id) 
WHERE parent_chunk_id IS NOT NULL;

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_document_chunks_retrieval_count 
ON document_chunks(retrieval_count DESC);

CREATE INDEX IF NOT EXISTS idx_document_chunks_last_retrieved 
ON document_chunks(last_retrieved_at DESC);

-- Active documents index
CREATE INDEX IF NOT EXISTS idx_kb_documents_active 
ON kb_documents(is_active) 
WHERE is_active = true;

-- Crawl frequency index
CREATE INDEX IF NOT EXISTS idx_kb_documents_crawl_frequency 
ON kb_documents(crawl_frequency, last_crawled_at);

-- ============================================================================
-- PART 4: Create Triggers for Automatic Updates
-- ============================================================================

-- Trigger function: Auto-update search_vector when chunk_text changes
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  -- Support multiple languages (English, Tagalog uses simple, Malay uses simple)
  -- You can customize this based on the language field
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.chunk_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to document_chunks
DROP TRIGGER IF EXISTS tsvector_update ON document_chunks;
CREATE TRIGGER tsvector_update 
BEFORE INSERT OR UPDATE OF chunk_text ON document_chunks
FOR EACH ROW 
EXECUTE FUNCTION update_search_vector();

-- Trigger function: Auto-generate chunk_hash for deduplication
CREATE OR REPLACE FUNCTION generate_chunk_hash()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate MD5 hash of chunk_text for deduplication
  NEW.chunk_hash := md5(NEW.chunk_text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to document_chunks
DROP TRIGGER IF EXISTS chunk_hash_update ON document_chunks;
CREATE TRIGGER chunk_hash_update 
BEFORE INSERT OR UPDATE OF chunk_text ON document_chunks
FOR EACH ROW 
EXECUTE FUNCTION generate_chunk_hash();

-- ============================================================================
-- PART 5: Hybrid Search Function (Vector + Full-Text) with RRF
-- ============================================================================

-- Reciprocal Rank Fusion (RRF) - The correct way to combine rankings
-- RRF Score = 1/(k + rank) where k is typically 60
-- This handles different score scales properly (cosine similarity vs ts_rank)

CREATE OR REPLACE FUNCTION hybrid_search_rrf(
  query_text text,
  query_embedding vector(384),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 20,
  k_constant int DEFAULT 60
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  chunk_index integer,
  token_count integer,
  metadata jsonb,
  vector_similarity float,
  fulltext_rank float,
  vector_rank bigint,
  fulltext_rank_position bigint,
  rrf_score float,
  source_url text,
  document_title text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    -- Step 1: Get vector search results with rankings
    SELECT 
      dc.id,
      dc.document_id,
      dc.chunk_text,
      dc.chunk_index,
      dc.token_count,
      dc.metadata,
      (1 - (dc.embedding_small <=> query_embedding)) as similarity,
      ROW_NUMBER() OVER (ORDER BY dc.embedding_small <=> query_embedding) as rank,
      kd.source_url,
      kd.title as document_title
    FROM document_chunks dc
    INNER JOIN kb_documents kd ON dc.document_id = kd.id
    WHERE 
      kd.is_active = true
      AND (1 - (dc.embedding_small <=> query_embedding)) > match_threshold
    ORDER BY dc.embedding_small <=> query_embedding
    LIMIT 100  -- Get top 100 for fusion
  ),
  fulltext_results AS (
    -- Step 2: Get full-text search results with rankings
    SELECT 
      dc.id,
      ts_rank(dc.search_vector, plainto_tsquery('english', query_text)) as ts_rank_score,
      ROW_NUMBER() OVER (ORDER BY ts_rank(dc.search_vector, plainto_tsquery('english', query_text)) DESC) as rank
    FROM document_chunks dc
    INNER JOIN kb_documents kd ON dc.document_id = kd.id
    WHERE 
      kd.is_active = true
      AND dc.search_vector @@ plainto_tsquery('english', query_text)
    ORDER BY ts_rank(dc.search_vector, plainto_tsquery('english', query_text)) DESC
    LIMIT 100  -- Get top 100 for fusion
  )
  -- Step 3: Combine using Reciprocal Rank Fusion
  SELECT 
    vr.id,
    vr.document_id,
    vr.chunk_text,
    vr.chunk_index,
    vr.token_count,
    vr.metadata,
    vr.similarity as vector_similarity,
    COALESCE(fr.ts_rank_score, 0) as fulltext_rank,
    vr.rank as vector_rank,
    COALESCE(fr.rank, 999999) as fulltext_rank_position,
    -- RRF formula: sum of 1/(k + rank) for each ranking method
    (1.0 / (k_constant + vr.rank)) + 
    (1.0 / (k_constant + COALESCE(fr.rank, 999999))) as rrf_score,
    vr.source_url,
    vr.document_title
  FROM vector_results vr
  LEFT JOIN fulltext_results fr ON vr.id = fr.id
  
  UNION
  
  -- Also include results that only appeared in full-text search
  SELECT 
    dc.id,
    dc.document_id,
    dc.chunk_text,
    dc.chunk_index,
    dc.token_count,
    dc.metadata,
    (1 - (dc.embedding_small <=> query_embedding)) as vector_similarity,
    fr.ts_rank_score as fulltext_rank,
    999999 as vector_rank,
    fr.rank as fulltext_rank_position,
    (1.0 / (k_constant + 999999)) + (1.0 / (k_constant + fr.rank)) as rrf_score,
    kd.source_url,
    kd.title as document_title
  FROM fulltext_results fr
  INNER JOIN document_chunks dc ON fr.id = dc.id
  INNER JOIN kb_documents kd ON dc.document_id = kd.id
  WHERE NOT EXISTS (
    SELECT 1 FROM vector_results vr WHERE vr.id = fr.id
  )
  
  ORDER BY rrf_score DESC
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- Alternative: Normalized Score Fusion (Min-Max Normalization)
-- ============================================================================

CREATE OR REPLACE FUNCTION hybrid_search_normalized(
  query_text text,
  query_embedding vector(384),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 20,
  vector_weight float DEFAULT 0.7,
  fulltext_weight float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  chunk_index integer,
  token_count integer,
  metadata jsonb,
  vector_similarity float,
  fulltext_rank float,
  normalized_vector_score float,
  normalized_fulltext_score float,
  combined_score float,
  source_url text,
  document_title text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT 
      dc.id,
      dc.document_id,
      dc.chunk_text,
      dc.chunk_index,
      dc.token_count,
      dc.metadata,
      (1 - (dc.embedding_small <=> query_embedding)) as similarity,
      kd.source_url,
      kd.title as document_title
    FROM document_chunks dc
    INNER JOIN kb_documents kd ON dc.document_id = kd.id
    WHERE 
      kd.is_active = true
      AND (1 - (dc.embedding_small <=> query_embedding)) > match_threshold
    LIMIT 100
  ),
  fulltext_results AS (
    SELECT 
      dc.id,
      ts_rank(dc.search_vector, plainto_tsquery('english', query_text)) as ts_rank_score
    FROM document_chunks dc
    INNER JOIN kb_documents kd ON dc.document_id = kd.id
    WHERE 
      kd.is_active = true
      AND dc.search_vector @@ plainto_tsquery('english', query_text)
  ),
  -- Calculate min/max for normalization
  score_ranges AS (
    SELECT 
      MIN(vr.similarity) as min_vector,
      MAX(vr.similarity) as max_vector,
      MIN(fr.ts_rank_score) as min_fulltext,
      MAX(fr.ts_rank_score) as max_fulltext
    FROM vector_results vr
    FULL OUTER JOIN fulltext_results fr ON vr.id = fr.id
  )
  SELECT 
    vr.id,
    vr.document_id,
    vr.chunk_text,
    vr.chunk_index,
    vr.token_count,
    vr.metadata,
    vr.similarity as vector_similarity,
    COALESCE(fr.ts_rank_score, 0) as fulltext_rank,
    -- Min-Max normalization: (x - min) / (max - min)
    CASE 
      WHEN sr.max_vector > sr.min_vector 
      THEN (vr.similarity - sr.min_vector) / (sr.max_vector - sr.min_vector)
      ELSE 0
    END as normalized_vector_score,
    CASE 
      WHEN sr.max_fulltext > sr.min_fulltext AND fr.ts_rank_score IS NOT NULL
      THEN (fr.ts_rank_score - sr.min_fulltext) / (sr.max_fulltext - sr.min_fulltext)
      ELSE 0
    END as normalized_fulltext_score,
    -- Weighted combination of normalized scores
    (vector_weight * 
      CASE 
        WHEN sr.max_vector > sr.min_vector 
        THEN (vr.similarity - sr.min_vector) / (sr.max_vector - sr.min_vector)
        ELSE 0
      END
    ) +
    (fulltext_weight * 
      CASE 
        WHEN sr.max_fulltext > sr.min_fulltext AND fr.ts_rank_score IS NOT NULL
        THEN (fr.ts_rank_score - sr.min_fulltext) / (sr.max_fulltext - sr.min_fulltext)
        ELSE 0
      END
    ) as combined_score,
    vr.source_url,
    vr.document_title
  FROM vector_results vr
  CROSS JOIN score_ranges sr
  LEFT JOIN fulltext_results fr ON vr.id = fr.id
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- PART 6: Vector-Only Search Function (Fast, for default queries)
-- ============================================================================

CREATE OR REPLACE FUNCTION vector_search(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  chunk_index integer,
  token_count integer,
  metadata jsonb,
  similarity float,
  source_url text,
  document_title text,
  trust_level numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.document_id,
    dc.chunk_text,
    dc.chunk_index,
    dc.token_count,
    dc.metadata,
    (1 - (dc.embedding_small <=> query_embedding)) as similarity,
    kd.source_url,
    kd.title as document_title,
    kd.trust_level
  FROM document_chunks dc
  INNER JOIN kb_documents kd ON dc.document_id = kd.id
  WHERE 
    kd.is_active = true
    AND (1 - (dc.embedding_small <=> query_embedding)) > match_threshold
  ORDER BY dc.embedding_small <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- PART 7: Advanced Reranking Search (Using 1024-dim embeddings)
-- ============================================================================

CREATE OR REPLACE FUNCTION rerank_search(
  query_embedding_small vector(384),
  query_embedding_large vector(1024),
  initial_match_count int DEFAULT 100,
  final_match_count int DEFAULT 20,
  match_threshold float DEFAULT 0.7
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  chunk_index integer,
  token_count integer,
  metadata jsonb,
  small_similarity float,
  large_similarity float,
  source_url text,
  document_title text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH initial_results AS (
    -- Step 1: Fast coarse search with 384-dim
    SELECT 
      dc.id,
      dc.document_id,
      dc.chunk_text,
      dc.chunk_index,
      dc.token_count,
      dc.metadata,
      dc.embedding_large,
      (1 - (dc.embedding_small <=> query_embedding_small)) as small_sim,
      kd.source_url,
      kd.title as document_title
    FROM document_chunks dc
    INNER JOIN kb_documents kd ON dc.document_id = kd.id
    WHERE 
      kd.is_active = true
      AND (1 - (dc.embedding_small <=> query_embedding_small)) > match_threshold
      AND dc.embedding_large IS NOT NULL
    ORDER BY dc.embedding_small <=> query_embedding_small
    LIMIT initial_match_count
  )
  -- Step 2: Rerank with 1024-dim
  SELECT 
    ir.id,
    ir.document_id,
    ir.chunk_text,
    ir.chunk_index,
    ir.token_count,
    ir.metadata,
    ir.small_sim as small_similarity,
    (1 - (ir.embedding_large <=> query_embedding_large)) as large_similarity,
    ir.source_url,
    ir.document_title
  FROM initial_results ir
  ORDER BY ir.embedding_large <=> query_embedding_large
  LIMIT final_match_count;
END;
$$;

-- ============================================================================
-- PART 8: Analytics Functions
-- ============================================================================

-- Function to track chunk retrieval
CREATE OR REPLACE FUNCTION track_chunk_retrieval(
  chunk_id uuid,
  relevance_score float
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE document_chunks
  SET 
    retrieval_count = retrieval_count + 1,
    avg_relevance_score = COALESCE(
      (avg_relevance_score * retrieval_count + relevance_score) / (retrieval_count + 1),
      relevance_score
    ),
    last_retrieved_at = now()
  WHERE id = chunk_id;
END;
$$;

-- Function to get popular chunks
CREATE OR REPLACE FUNCTION get_popular_chunks(
  limit_count int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  chunk_text text,
  retrieval_count integer,
  avg_relevance_score float,
  document_title text,
  source_url text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.chunk_text,
    dc.retrieval_count,
    dc.avg_relevance_score,
    kd.title as document_title,
    kd.source_url
  FROM document_chunks dc
  INNER JOIN kb_documents kd ON dc.document_id = kd.id
  WHERE dc.retrieval_count > 0
  ORDER BY dc.retrieval_count DESC, dc.avg_relevance_score DESC
  LIMIT limit_count;
END;
$$;

-- ============================================================================
-- PART 9: Utility Functions
-- ============================================================================

-- Function to find duplicate chunks
CREATE OR REPLACE FUNCTION find_duplicate_chunks()
RETURNS TABLE (
  chunk_hash text,
  duplicate_count bigint,
  chunk_ids uuid[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.chunk_hash,
    COUNT(*) as duplicate_count,
    array_agg(dc.id) as chunk_ids
  FROM document_chunks dc
  WHERE dc.chunk_hash IS NOT NULL
  GROUP BY dc.chunk_hash
  HAVING COUNT(*) > 1
  ORDER BY duplicate_count DESC;
END;
$$;

-- Function to get documents needing recrawl
CREATE OR REPLACE FUNCTION get_documents_needing_recrawl()
RETURNS TABLE (
  id uuid,
  title text,
  source_url text,
  crawl_frequency text,
  last_crawled_at timestamp with time zone,
  days_since_crawl integer
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kd.id,
    kd.title,
    kd.source_url,
    kd.crawl_frequency,
    kd.last_crawled_at,
    EXTRACT(DAY FROM (now() - kd.last_crawled_at))::integer as days_since_crawl
  FROM kb_documents kd
  WHERE 
    kd.is_active = true
    AND kd.document_type = 'gov_crawled'
    AND (
      (kd.crawl_frequency = 'daily' AND kd.last_crawled_at < now() - interval '1 day')
      OR (kd.crawl_frequency = 'weekly' AND kd.last_crawled_at < now() - interval '7 days')
      OR (kd.crawl_frequency = 'monthly' AND kd.last_crawled_at < now() - interval '30 days')
      OR kd.last_crawled_at IS NULL
    )
  ORDER BY kd.last_crawled_at ASC NULLS FIRST;
END;
$$;

-- ============================================================================
-- PART 10: Backfill Existing Data
-- ============================================================================

-- Update search_vector for existing chunks
UPDATE document_chunks
SET search_vector = to_tsvector('english', COALESCE(chunk_text, ''))
WHERE search_vector IS NULL;

-- Generate chunk_hash for existing chunks
UPDATE document_chunks
SET chunk_hash = md5(chunk_text)
WHERE chunk_hash IS NULL;

-- Set last_crawled_at to created_at for existing documents
UPDATE kb_documents
SET last_crawled_at = created_at
WHERE last_crawled_at IS NULL AND document_type = 'gov_crawled';

-- ============================================================================
-- PART 11: Example Metadata Structures
-- ============================================================================

-- Example metadata for document_chunks:
-- {
--   "section": "Introduction",
--   "page_number": 1,
--   "heading": "Overview of Social Programs",
--   "heading_level": 2,
--   "has_table": false,
--   "has_list": true,
--   "keywords": ["social welfare", "DSWD", "programs"],
--   "entities": ["Department of Social Welfare", "Manila"],
--   "language": "en",
--   "confidence": 0.95
-- }

-- Example metadata for kb_documents:
-- {
--   "department": "DSWD",
--   "category": "social-services",
--   "tags": ["welfare", "assistance", "programs"],
--   "last_modified": "2026-03-09",
--   "file_type": "html",
--   "crawl_duration_ms": 2301,
--   "total_pages": 1,
--   "author": "Department of Social Welfare and Development"
-- }

-- ============================================================================
-- PART 12: Performance Monitoring Views
-- ============================================================================

-- View: Embedding completion status
CREATE OR REPLACE VIEW embedding_status AS
SELECT 
  COUNT(*) as total_chunks,
  COUNT(embedding_small) as chunks_with_small,
  COUNT(embedding_large) as chunks_with_large,
  ROUND(100.0 * COUNT(embedding_small) / NULLIF(COUNT(*), 0), 2) as small_completion_pct,
  ROUND(100.0 * COUNT(embedding_large) / NULLIF(COUNT(*), 0), 2) as large_completion_pct
FROM document_chunks;

-- View: Document statistics
CREATE OR REPLACE VIEW document_stats AS
SELECT 
  kd.id,
  kd.title,
  kd.source_url,
  kd.trust_level,
  kd.created_at,
  kd.last_crawled_at,
  COUNT(dc.id) as chunk_count,
  COUNT(dc.embedding_small) as chunks_with_small,
  COUNT(dc.embedding_large) as chunks_with_large,
  SUM(dc.token_count) as total_tokens,
  AVG(dc.retrieval_count) as avg_retrieval_count
FROM kb_documents kd
LEFT JOIN document_chunks dc ON kd.id = dc.document_id
WHERE kd.document_type = 'gov_crawled'
GROUP BY kd.id;

-- ============================================================================
-- PART 13: Cleanup and Maintenance
-- ============================================================================

-- Function to remove duplicate chunks (keep the oldest one)
CREATE OR REPLACE FUNCTION remove_duplicate_chunks()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  WITH duplicates AS (
    SELECT 
      chunk_hash,
      array_agg(id ORDER BY created_at ASC) as chunk_ids
    FROM document_chunks
    WHERE chunk_hash IS NOT NULL
    GROUP BY chunk_hash
    HAVING COUNT(*) > 1
  )
  DELETE FROM document_chunks
  WHERE id IN (
    SELECT unnest(chunk_ids[2:]) -- Keep first, delete rest
    FROM duplicates
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ============================================================================
-- DONE! 
-- ============================================================================
-- Next steps:
-- 1. Run this SQL in your Supabase SQL Editor
-- 2. Update your crawler to populate metadata fields
-- 3. Use hybrid_search() or vector_search() in your query API
-- 4. Monitor performance with the views created
-- ============================================================================
