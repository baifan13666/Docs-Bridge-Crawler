/**
 * Large Embedding Generation Worker
 * 
 * POST /api/embeddings/large
 * 
 * Background worker that generates 1024-dim embeddings via external API
 * and updates document chunks
 */

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    console.log('[Large Embeddings] ========================================');
    console.log('[Large Embeddings] Received request');
    console.log('[Large Embeddings] Timestamp:', new Date().toISOString());

    // Verify QStash signature
    const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

    if (!currentSigningKey || !nextSigningKey) {
      console.error('[Large Embeddings] Missing QStash signing keys');
      return NextResponse.json(
        { success: false, error: 'Missing QStash configuration' },
        { status: 500 }
      );
    }

    const receiver = new Receiver({
      currentSigningKey,
      nextSigningKey,
    });

    const body = await request.text();
    const signature = request.headers.get('upstash-signature');

    if (!signature) {
      console.error('[Large Embeddings] Missing signature');
      return NextResponse.json(
        { success: false, error: 'Missing signature' },
        { status: 401 }
      );
    }

    const isValid = await receiver.verify({
      signature,
      body,
    });

    if (!isValid) {
      console.error('[Large Embeddings] Invalid signature');
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    console.log('[Large Embeddings] ✅ Signature verified');

    const payload = JSON.parse(body);
    const { document_id } = payload;

    if (!document_id) {
      return NextResponse.json(
        { success: false, error: 'Missing document_id' },
        { status: 400 }
      );
    }

    console.log(`[Large Embeddings] Processing document: ${document_id}`);

    // Get all chunks for this document
    const supabase = createServiceClient();
    const { data: chunks, error: fetchError } = await supabase
      .from('document_chunks')
      .select('id, chunk_text')
      .eq('document_id', document_id)
      .is('embedding_large', null);

    if (fetchError) {
      console.error('[Large Embeddings] Error fetching chunks:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch chunks' },
        { status: 500 }
      );
    }

    if (!chunks || chunks.length === 0) {
      console.log('[Large Embeddings] No chunks to process');
      return NextResponse.json({
        success: true,
        message: 'No chunks to process',
        document_id,
      });
    }

    console.log(`[Large Embeddings] Found ${chunks.length} chunks to process`);

    // Generate 1024-dim embeddings via external API
    const embeddingApiUrl = process.env.BGE_HF_EMBEDDING_SERVER_API_URL;
    if (!embeddingApiUrl) {
      console.error('[Large Embeddings] Missing BGE_HF_EMBEDDING_SERVER_API_URL');
      return NextResponse.json(
        { success: false, error: 'Missing embedding API configuration' },
        { status: 500 }
      );
    }

    console.log('[Large Embeddings] Calling external embedding API...');
    
    // Process in batches to avoid timeout
    const batchSize = 10;
    const allEmbeddings: number[][] = [];
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`[Large Embeddings] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}...`);
      
      // HuggingFace Space may be sleeping, retry with exponential backoff
      let embeddings;
      let retries = 0;
      const maxRetries = 3;
      const baseDelay = 5000; // 5 seconds
      
      while (retries < maxRetries) {
        try {
          console.log(`[Large Embeddings] Attempt ${retries + 1}/${maxRetries}...`);
          
          const response = await fetch(`${embeddingApiUrl}/embed/batch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: batch.map(c => c.chunk_text),
            }),
            signal: AbortSignal.timeout(60000), // 60 second timeout
          });

          if (!response.ok) {
            const errorText = await response.text();
            
            // If 503 (service unavailable), the space is probably sleeping
            if (response.status === 503 && retries < maxRetries - 1) {
              const delay = baseDelay * Math.pow(2, retries);
              console.log(`[Large Embeddings] Space is sleeping, waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              retries++;
              continue;
            }
            
            throw new Error(`Embedding API error (${response.status}): ${errorText}`);
          }

          const data = await response.json();
          embeddings = data.embeddings;
          console.log(`[Large Embeddings] ✅ Generated ${embeddings.length} embeddings for batch`);
          break;
          
        } catch (error) {
          if (retries < maxRetries - 1) {
            const delay = baseDelay * Math.pow(2, retries);
            console.log(`[Large Embeddings] Error: ${error}, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retries++;
          } else {
            throw error;
          }
        }
      }
      
      if (!embeddings) {
        throw new Error('Failed to generate embeddings after all retries');
      }
      
      allEmbeddings.push(...embeddings);
    }
    
    console.log(`[Large Embeddings] ✅ Generated total ${allEmbeddings.length} embeddings`);

    // Update chunks with 1024-dim embeddings
    console.log('[Large Embeddings] Updating chunks...');
    for (let i = 0; i < chunks.length; i++) {
      const { error: updateError } = await supabase
        .from('document_chunks')
        .update({ embedding_large: allEmbeddings[i] })
        .eq('id', chunks[i].id);

      if (updateError) {
        console.error(`[Large Embeddings] Error updating chunk ${chunks[i].id}:`, updateError);
      }
    }

    console.log('[Large Embeddings] ✅ Updated all chunks');
    console.log('[Large Embeddings] ========================================');

    return NextResponse.json({
      success: true,
      document_id,
      chunks_updated: chunks.length,
    });

  } catch (error) {
    console.error('[Large Embeddings] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
