/**
 * Crawler Worker API
 * 
 * POST /api/crawler/worker
 * 
 * Background worker that processes crawl jobs from QStash queue
 * Crawls documents and sends them to main DocsBridge app for processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { createServiceClient } from '@/lib/supabase/server';
import { getSourceById } from '@/lib/crawler/sources';
import { crawlHTML, isValidCrawlURL } from '@/lib/crawler/html';
import { crawlPDF, isValidPDFURL } from '@/lib/crawler/pdf';
import { normalizeHTMLDocument, normalizePDFDocument, validateDocument, sanitizeContent } from '@/lib/crawler/normalize';
import { chunkDocument } from '@/lib/nlp/chunking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for crawling

export async function POST(request: NextRequest) {
  try {
    console.log('[Crawler Worker] ========================================');
    console.log('[Crawler Worker] Received request');
    console.log('[Crawler Worker] Timestamp:', new Date().toISOString());
    console.log('[Crawler Worker] Request URL:', request.url);
    console.log('[Crawler Worker] Request headers:', {
      'content-type': request.headers.get('content-type'),
      'upstash-signature': request.headers.get('upstash-signature') ? 'present' : 'missing',
      'user-agent': request.headers.get('user-agent')
    });
    
    // Read body once
    const bodyText = await request.text();
    console.log('[Crawler Worker] Body length:', bodyText.length);
    console.log('[Crawler Worker] Body preview:', bodyText.substring(0, 200));
    
    // Verify QStash signature
    const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

    console.log('[Crawler Worker] Signature verification:', {
      hasCurrentKey: !!currentSigningKey,
      hasNextKey: !!nextSigningKey,
      willVerify: !!(currentSigningKey && nextSigningKey)
    });

    if (currentSigningKey && nextSigningKey) {
      const receiver = new Receiver({
        currentSigningKey,
        nextSigningKey,
      });

      const signature = request.headers.get('upstash-signature');

      if (signature) {
        try {
          console.log('[Crawler Worker] Verifying signature...');
          await receiver.verify({
            signature,
            body: bodyText,
          });
          console.log('[Crawler Worker] ✅ Signature verified');
        } catch (error) {
          console.error('[Crawler Worker] ❌ Invalid signature');
          console.error('[Crawler Worker] Signature error:', error);
          return NextResponse.json(
            { success: false, error: 'Invalid signature' },
            { status: 401 }
          );
        }
      } else {
        console.warn('[Crawler Worker] ⚠️ No signature provided');
      }
    } else {
      console.warn('[Crawler Worker] ⚠️ Signature verification skipped (keys not configured)');
    }

    console.log('[Crawler Worker] Processing crawl job...');

    // Parse request body
    const body = JSON.parse(bodyText);
    const { source_id, triggered_by, timestamp } = body;

    console.log('[Crawler Worker] Parsed body:', {
      source_id,
      triggered_by,
      timestamp,
      fullBody: body
    });

    if (!source_id) {
      console.error('[Crawler Worker] ❌ Missing source_id');
      return NextResponse.json(
        { success: false, error: 'source_id is required' },
        { status: 400 }
      );
    }

    // Get source configuration
    const source = getSourceById(source_id);
    if (!source) {
      console.error('[Crawler Worker] ❌ Source not found:', source_id);
      return NextResponse.json(
        { success: false, error: 'Source not found' },
        { status: 404 }
      );
    }

    // Check if source is disabled
    if (source.disabled) {
      console.warn('[Crawler Worker] ⚠️ Source is disabled:', source_id);
      console.warn('[Crawler Worker] Reason:', source.disabled_reason || 'No reason provided');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Source is disabled', 
          reason: source.disabled_reason,
          skipped: true 
        },
        { status: 200 } // Return 200 so QStash doesn't retry
      );
    }

    console.log('[Crawler Worker] Source found:', {
      id: source.id,
      name: source.name,
      url: source.url,
      type: source.type,
      category: source.category,
      frequency: source.crawl_frequency
    });

    const crawlURL = source.url;

    // Validate URL
    if (source.type === 'pdf' && !isValidPDFURL(crawlURL)) {
      console.error('[Crawler Worker] ❌ Invalid PDF URL:', crawlURL);
      return NextResponse.json(
        { success: false, error: 'Invalid PDF URL' },
        { status: 400 }
      );
    } else if (source.type === 'html' && !isValidCrawlURL(crawlURL)) {
      console.error('[Crawler Worker] ❌ Invalid HTML URL:', crawlURL);
      return NextResponse.json(
        { success: false, error: 'Invalid HTML URL' },
        { status: 400 }
      );
    }

    // Crawl document
    console.log(`[Crawler Worker] Starting crawl...`);
    console.log(`[Crawler Worker] Type: ${source.type.toUpperCase()}`);
    console.log(`[Crawler Worker] URL: ${crawlURL}`);
    
    const crawlStartTime = Date.now();
    let normalizedDoc;

    try {
      if (source.type === 'pdf') {
        console.log('[Crawler Worker] Crawling PDF...');
        const pdfContent = await crawlPDF(crawlURL);
        console.log('[Crawler Worker] PDF crawled, normalizing...');
        normalizedDoc = normalizePDFDocument(pdfContent, source);
      } else {
        console.log('[Crawler Worker] Crawling HTML...');
        const htmlContent = await crawlHTML(crawlURL);
        console.log('[Crawler Worker] HTML crawled, normalizing...');
        normalizedDoc = normalizeHTMLDocument(htmlContent, source);
      }
      
      const crawlDuration = Date.now() - crawlStartTime;
      console.log(`[Crawler Worker] ✅ Crawl completed in ${crawlDuration}ms`);
    } catch (crawlError) {
      console.error('[Crawler Worker] ❌ Crawl error:', {
        message: crawlError instanceof Error ? crawlError.message : 'Unknown error',
        stack: crawlError instanceof Error ? crawlError.stack : undefined,
        error: crawlError
      });
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to crawl document: ${crawlError instanceof Error ? crawlError.message : 'Unknown error'}` 
        },
        { status: 500 }
      );
    }

    // Validate document
    console.log('[Crawler Worker] Validating document...');
    const validation = validateDocument(normalizedDoc);
    if (!validation.valid) {
      console.error('[Crawler Worker] ❌ Validation failed:', validation.errors);
      return NextResponse.json(
        { success: false, error: 'Document validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    console.log('[Crawler Worker] ✅ Document validated');
    console.log('[Crawler Worker] Document details:', {
      title: normalizedDoc.title,
      quality_score: normalizedDoc.quality_score,
      word_count: normalizedDoc.metadata.word_count,
      language: normalizedDoc.metadata.language,
      trust_level: normalizedDoc.trust_level
    });

    // Sanitize content
    const sanitizedContent = sanitizeContent(normalizedDoc.content);

    // Create Supabase service client (bypasses RLS for system operations)
    const supabase = createServiceClient();

    // Ensure system folder exists
    const systemFolderId = process.env.SYSTEM_FOLDER_ID || '00000000-0000-0000-0000-000000000001';
    const systemUserId = process.env.SYSTEM_USER_ID || '00000000-0000-0000-0000-000000000000';


    // Check if document already exists (by source_url)
    const { data: existingDoc } = await supabase
      .from('kb_documents')
      .select('id')
      .eq('source_url', normalizedDoc.source_url)
      .eq('document_type', 'gov_crawled')
      .single();

    let documentId;
    let action: 'created' | 'updated';

    if (existingDoc) {
      // Update existing document
      console.log(`[Crawler Worker] Updating existing document: ${existingDoc.id}`);
      
      const { data: updatedDoc, error: updateError } = await supabase
        .from('kb_documents')
        .update({
          title: normalizedDoc.title,
          content: sanitizedContent,
          trust_level: normalizedDoc.trust_level,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDoc.id)
        .select()
        .single();

      if (updateError || !updatedDoc) {
        console.error('[Crawler Worker] Update error:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update document' },
          { status: 500 }
        );
      }

      documentId = updatedDoc.id;
      action = 'updated';

      // Delete old chunks for reprocessing
      await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId);

    } else {
      // Insert new document (service role bypasses RLS)
      console.log('[Crawler Worker] Creating new document...');
      
      const { data: document, error: dbError } = await supabase
        .from('kb_documents')
        .insert({
          user_id: systemUserId,
          folder_id: systemFolderId,
          title: normalizedDoc.title,
          content: sanitizedContent,
          document_type: normalizedDoc.document_type,
          source_url: normalizedDoc.source_url,
          trust_level: normalizedDoc.trust_level,
          icon: source.category === 'healthcare' ? 'medical_services' :
                source.category === 'finance' ? 'account_balance' :
                source.category === 'education' ? 'school' :
                'description'
        })
        .select()
        .single();

      if (dbError || !document) {
        console.error('[Crawler Worker] Database error:', {
          code: dbError?.code,
          message: dbError?.message,
          details: dbError?.details,
          hint: dbError?.hint
        });
        return NextResponse.json(
          { success: false, error: 'Failed to save document', details: dbError?.message },
          { status: 500 }
        );
      }

      documentId = document.id;
      action = 'created';
    }

    console.log(`[Crawler Worker] ✅ Saved document: ${documentId}`);

    // Process document directly in crawler service
    console.log('[Crawler Worker] ========================================');
    console.log('[Crawler Worker] Starting document processing...');
    
    // Step 1: Chunk the document
    console.log('[Crawler Worker] Step 1: Chunking document...');
    const chunks = await chunkDocument(sanitizedContent, {
      chunkSize: 800,
      chunkOverlap: 100
    });

    console.log(`[Crawler Worker] Created ${chunks.length} chunks`);

    if (chunks.length === 0) {
      console.log('[Crawler Worker] ⚠️ No chunks created (document too short)');
      return NextResponse.json({
        success: true,
        document_id: documentId,
        source_id: source.id,
        source_name: source.name,
        title: normalizedDoc.title,
        word_count: normalizedDoc.metadata.word_count,
        quality_score: normalizedDoc.quality_score,
        action,
        chunks_created: 0,
        message: 'Document saved but too short to chunk'
      });
    }

    // Step 2: Generate embeddings with e5-large (1024-dim)
    console.log('[Crawler Worker] Step 2: Generating embeddings with e5-large (1024-dim)...');
    console.log('[Crawler Worker] Using dual embedding strategy:');
    console.log('[Crawler Worker] - Small (384-dim): for fast coarse search');
    console.log('[Crawler Worker] - Large (1024-dim): for accurate reranking');
    
    const chunkTexts = chunks.map(c => c.text);
    
    // Call Edge Runtime embedding API
    const embeddingResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ texts: chunkTexts }),
    });

    if (!embeddingResponse.ok) {
      const errorData = await embeddingResponse.json();
      throw new Error(`Embedding API error: ${errorData.message || 'Unknown error'}`);
    }

    const { embeddings } = await embeddingResponse.json();

    console.log(`[Crawler Worker] Generated ${embeddings.length} dual embeddings`);

    // Step 3: Save chunks with embeddings to database
    console.log('[Crawler Worker] Step 3: Saving chunks with dual embeddings...');
    const chunksToInsert = chunks.map((chunk, index) => ({
      document_id: documentId,
      chunk_text: chunk.text,
      chunk_index: chunk.index,
      embedding_small: embeddings[index].small,  // 384-dim for coarse search
      embedding_large: embeddings[index].large,  // 1024-dim for reranking
      token_count: chunk.tokenCount,
      language: normalizedDoc.metadata.language || null
    }));

    const { error: insertError } = await supabase
      .from('document_chunks')
      .insert(chunksToInsert);

    if (insertError) {
      console.error('[Crawler Worker] ❌ Error inserting chunks:', insertError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to save chunks',
          document_id: documentId 
        },
        { status: 500 }
      );
    }

    console.log(`[Crawler Worker] ✅ Saved ${chunks.length} chunks with dual embeddings`);

    console.log('[Crawler Worker] ✅ Crawl and processing completed successfully');
    console.log('[Crawler Worker] ========================================');

    return NextResponse.json({
      success: true,
      document_id: documentId,
      source_id: source.id,
      source_name: source.name,
      title: normalizedDoc.title,
      word_count: normalizedDoc.metadata.word_count,
      quality_score: normalizedDoc.quality_score,
      chunks_created: chunks.length,
      action
    });

  } catch (error) {
    console.error('[Crawler Worker] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
