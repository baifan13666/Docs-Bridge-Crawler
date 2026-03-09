/**
 * Document Detail API
 * 
 * GET /api/dashboard/document/[id]
 * 
 * Returns detailed information about a specific document including chunks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('kb_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Get chunks for this document
    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select('id, chunk_text, chunk_index, token_count, embedding_small, embedding_large')
      .eq('document_id', id)
      .order('chunk_index', { ascending: true });

    if (chunksError) {
      console.error('[Dashboard] Error fetching chunks:', chunksError);
    }

    // Transform chunks to include embedding status
    const transformedChunks = (chunks || []).map(chunk => ({
      id: chunk.id,
      chunk_text: chunk.chunk_text,
      chunk_index: chunk.chunk_index,
      token_count: chunk.token_count,
      has_small_embedding: chunk.embedding_small !== null,
      has_large_embedding: chunk.embedding_large !== null,
    }));

    // Get chunk count
    const { count: chunkCount } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', id);

    return NextResponse.json({
      success: true,
      document: {
        ...document,
        chunk_count: chunkCount || 0,
        chunks: transformedChunks,
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
