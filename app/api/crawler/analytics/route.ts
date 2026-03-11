/**
 * Crawler Analytics API
 * 
 * GET /api/crawler/analytics
 * 
 * Provides insights into crawler performance and data quality
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    // Get overall statistics
    const [
      documentsResult,
      chunksResult,
      embeddingStatusResult,
      popularChunksResult,
      duplicatesResult,
      recrawlNeededResult
    ] = await Promise.all([
      // Document statistics
      supabase.rpc('document_stats'),
      
      // Chunk statistics
      supabase
        .from('document_chunks')
        .select('id, token_count, retrieval_count, avg_relevance_score')
        .not('token_count', 'is', null),
      
      // Embedding completion status
      supabase.rpc('embedding_status'),
      
      // Popular chunks
      supabase.rpc('get_popular_chunks', { limit_count: 10 }),
      
      // Duplicate chunks
      supabase.rpc('find_duplicate_chunks'),
      
      // Documents needing recrawl
      supabase.rpc('get_documents_needing_recrawl')
    ]);

    // Calculate chunk statistics
    const chunks = chunksResult.data || [];
    const chunkStats = {
      total_chunks: chunks.length,
      avg_token_count: chunks.length > 0 ? 
        Math.round(chunks.reduce((sum, c) => sum + (c.token_count || 0), 0) / chunks.length) : 0,
      total_retrievals: chunks.reduce((sum, c) => sum + (c.retrieval_count || 0), 0),
      avg_relevance: chunks.length > 0 ? 
        chunks.reduce((sum, c) => sum + (c.avg_relevance_score || 0), 0) / chunks.length : 0
    };

    // Get country and category breakdown
    const { data: countryBreakdown } = await supabase
      .from('kb_documents')
      .select('metadata')
      .eq('document_type', 'gov_crawled');

    const countryStats: Record<string, number> = {};
    const categoryStats: Record<string, number> = {};
    const departmentStats: Record<string, number> = {};

    countryBreakdown?.forEach(doc => {
      const metadata = doc.metadata as any;
      if (metadata?.country) {
        countryStats[metadata.country] = (countryStats[metadata.country] || 0) + 1;
      }
      if (metadata?.category) {
        categoryStats[metadata.category] = (categoryStats[metadata.category] || 0) + 1;
      }
      if (metadata?.department) {
        departmentStats[metadata.department] = (departmentStats[metadata.department] || 0) + 1;
      }
    });

    return NextResponse.json({
      success: true,
      analytics: {
        overview: {
          total_documents: documentsResult.data?.length || 0,
          ...chunkStats,
          embedding_completion: embeddingStatusResult.data?.[0] || {}
        },
        
        breakdown: {
          by_country: countryStats,
          by_category: categoryStats,
          by_department: departmentStats
        },
        
        quality: {
          popular_chunks: popularChunksResult.data || [],
          duplicate_chunks: duplicatesResult.data?.length || 0,
          documents_needing_recrawl: recrawlNeededResult.data?.length || 0
        },
        
        documents: documentsResult.data || [],
        
        maintenance: {
          duplicates: duplicatesResult.data || [],
          recrawl_needed: recrawlNeededResult.data || []
        }
      }
    });

  } catch (error) {
    console.error('[Crawler Analytics] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}