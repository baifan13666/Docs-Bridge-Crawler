/**
 * Dashboard Stats API
 * 
 * GET /api/dashboard/stats
 * 
 * Returns real-time statistics about crawled documents and crawl history
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get recent documents with detailed info
    const { data: documents, error: docsError } = await supabase
      .from('kb_documents')
      .select(`
        id,
        title,
        source_url,
        document_type,
        trust_level,
        quality_score,
        word_count,
        created_at,
        updated_at
      `)
      .eq('document_type', 'gov_crawled')
      .order('created_at', { ascending: false })
      .limit(50);

    if (docsError) {
      console.error('[Dashboard] Error fetching documents:', docsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    // Get chunk counts for each document
    const documentsWithChunks = await Promise.all(
      (documents || []).map(async (doc) => {
        const { count } = await supabase
          .from('document_chunks')
          .select('*', { count: 'exact', head: true })
          .eq('document_id', doc.id);

        return {
          ...doc,
          chunk_count: count || 0
        };
      })
    );

    // Get crawl logs (mock for now - you can create a crawl_logs table)
    // For now, we'll derive from documents
    const crawlLogs = (documents || []).slice(0, 20).map(doc => ({
      id: doc.id,
      source_id: 'unknown',
      source_name: doc.title,
      source_url: doc.source_url,
      status: 'success',
      started_at: doc.created_at,
      completed_at: doc.updated_at,
      error_message: null
    }));

    // Get total statistics
    const { count: totalDocs } = await supabase
      .from('kb_documents')
      .select('*', { count: 'exact', head: true })
      .eq('document_type', 'gov_crawled');

    const { count: totalChunks } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true });

    // Get embedding statistics
    const { count: chunksWithSmall } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .not('embedding_small', 'is', null);

    const { count: chunksWithLarge } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .not('embedding_large', 'is', null);

    // Get documents created today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: docsToday } = await supabase
      .from('kb_documents')
      .select('*', { count: 'exact', head: true })
      .eq('document_type', 'gov_crawled')
      .gte('created_at', today.toISOString());

    // Calculate average quality score
    const { data: qualityData } = await supabase
      .from('kb_documents')
      .select('quality_score')
      .eq('document_type', 'gov_crawled')
      .not('quality_score', 'is', null);

    const avgQualityScore = qualityData && qualityData.length > 0
      ? qualityData.reduce((sum, doc) => sum + (doc.quality_score || 0), 0) / qualityData.length
      : 0;

    const embeddingCompletionRate = totalChunks && totalChunks > 0
      ? (chunksWithLarge || 0) / totalChunks * 100
      : 0;

    return NextResponse.json({
      success: true,
      documents: documentsWithChunks,
      crawl_logs: crawlLogs,
      stats: {
        total_documents: totalDocs || 0,
        total_chunks: totalChunks || 0,
        avg_quality_score: avgQualityScore,
        documents_today: docsToday || 0,
        chunks_with_small: chunksWithSmall || 0,
        chunks_with_large: chunksWithLarge || 0,
        embedding_completion_rate: embeddingCompletionRate
      }
    });

  } catch (error) {
    console.error('[Dashboard] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
