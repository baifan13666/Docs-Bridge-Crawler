/**
 * Dashboard Stats API
 * 
 * GET /api/dashboard/stats
 * 
 * Returns real-time statistics about crawled documents
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get recent documents with chunk counts
    const { data: documents, error: docsError } = await supabase
      .from('kb_documents')
      .select(`
        id,
        title,
        document_type,
        trust_level,
        created_at
      `)
      .eq('document_type', 'gov_crawled')
      .order('created_at', { ascending: false })
      .limit(20);

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

    // Get total statistics
    const { count: totalDocs } = await supabase
      .from('kb_documents')
      .select('*', { count: 'exact', head: true })
      .eq('document_type', 'gov_crawled');

    const { count: totalChunks } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true });

    // Get documents created today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: docsToday } = await supabase
      .from('kb_documents')
      .select('*', { count: 'exact', head: true })
      .eq('document_type', 'gov_crawled')
      .gte('created_at', today.toISOString());

    // Calculate average quality score (mock for now, can be added to schema)
    const avgQualityScore = 85; // TODO: Calculate from actual quality_score field

    return NextResponse.json({
      success: true,
      documents: documentsWithChunks,
      stats: {
        total_documents: totalDocs || 0,
        total_chunks: totalChunks || 0,
        avg_quality_score: avgQualityScore,
        documents_today: docsToday || 0
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
