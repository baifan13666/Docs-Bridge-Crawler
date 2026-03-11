/**
 * Batch Crawler API
 * 
 * POST /api/crawler/batch
 * 
 * Triggers batch crawling of all enabled sources
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQStashClient } from '@/lib/qstash/client';
import { getEnabledSources, getSourcesByPriority } from '@/lib/crawler/sources';
import { CrawlerJobManager } from '@/lib/crawler/job-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('[Batch Crawler] Starting batch crawl job...');
    
    const body = await request.json();
    const { priority = 'all', country, category } = body;

    // Get sources based on filters
    let sources = getEnabledSources();
    
    if (priority !== 'all') {
      sources = sources.filter(s => s.priority === priority);
    }
    
    if (country) {
      sources = sources.filter(s => s.country === country);
    }
    
    if (category) {
      sources = sources.filter(s => s.category === category);
    }

    console.log(`[Batch Crawler] Found ${sources.length} sources to crawl`);

    if (sources.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No sources found matching criteria'
      }, { status: 400 });
    }

    // Create job record
    const jobManager = new CrawlerJobManager();
    const jobId = await jobManager.createBatchJob();

    console.log(`[Batch Crawler] Created job: ${jobId}`);

    // Queue individual crawl tasks
    const qstashClient = getQStashClient();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    
    let queuedCount = 0;
    const errors: string[] = [];

    for (const source of sources) {
      try {
        await qstashClient.publishJSON({
          url: `${baseUrl}/api/crawler/worker`,
          body: {
            source_id: source.id,
            triggered_by: 'batch_crawler',
            job_id: jobId,
            timestamp: new Date().toISOString()
          },
          // Stagger requests to avoid overwhelming servers
          delay: queuedCount * 5 // 5 second delay between each request
        });
        
        queuedCount++;
        console.log(`[Batch Crawler] Queued: ${source.name}`);
      } catch (error) {
        const errorMsg = `Failed to queue ${source.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[Batch Crawler] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`[Batch Crawler] ✅ Queued ${queuedCount}/${sources.length} sources`);

    return NextResponse.json({
      success: true,
      job_id: jobId,
      sources_queued: queuedCount,
      total_sources: sources.length,
      errors: errors.length > 0 ? errors : undefined,
      estimated_completion: new Date(Date.now() + (sources.length * 30 * 1000)).toISOString() // ~30s per source
    });

  } catch (error) {
    console.error('[Batch Crawler] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/crawler/batch?job_id=xxx
 * 
 * Get batch crawl job status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('job_id');

    if (!jobId) {
      return NextResponse.json({
        success: false,
        error: 'job_id parameter is required'
      }, { status: 400 });
    }

    const jobManager = new CrawlerJobManager();
    const job = await jobManager.getJobStatus(jobId);

    if (!job) {
      return NextResponse.json({
        success: false,
        error: 'Job not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      job
    });

  } catch (error) {
    console.error('[Batch Crawler] Status check error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}