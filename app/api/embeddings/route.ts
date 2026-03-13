/**
 * Edge Runtime Embeddings API
 * 
 * POST /api/embeddings
 * 
 * Generates embeddings using @huggingface/transformers with WASM backend
 * Runs on Vercel Edge Runtime for better compatibility
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateBatchDualEmbeddings } from '@/lib/embeddings/edge';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { texts } = body;

    if (!texts || !Array.isArray(texts)) {
      return NextResponse.json(
        { error: 'Invalid request: texts array required' },
        { status: 400 }
      );
    }

    console.log(`[Embeddings API] Processing ${texts.length} texts...`);
    
    const embeddings = await generateBatchDualEmbeddings(texts);
    
    return NextResponse.json({
      success: true,
      count: embeddings.length,
      embeddings,
    });
  } catch (error) {
    console.error('[Embeddings API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate embeddings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
