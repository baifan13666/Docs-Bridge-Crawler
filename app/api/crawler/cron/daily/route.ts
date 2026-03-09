/**
 * Daily Crawler Cron Job
 * 
 * GET /api/crawler/cron/daily
 * 
 * Triggered by Vercel Cron at 2:00 AM daily
 * Queues daily crawl jobs via QStash
 */

import { NextRequest, NextResponse } from 'next/server';
import { qstashClient, getBaseURL } from '@/lib/qstash/client';
import { GOVERNMENT_SOURCES } from '@/lib/crawler/sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[Cron Daily] ========================================');
    console.log('[Cron Daily] Starting daily crawl job...');
    console.log('[Cron Daily] Timestamp:', new Date().toISOString());

    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    console.log('[Cron Daily] Auth check:', {
      hasAuthHeader: !!authHeader,
      hasCronSecret: !!process.env.CRON_SECRET
    });
    
    if (authHeader !== expectedAuth) {
      console.error('[Cron Daily] Unauthorized request');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get daily sources
    const dailySources = GOVERNMENT_SOURCES.filter(
      source => source.crawl_frequency === 'daily'
    );

    console.log(`[Cron Daily] Found ${dailySources.length} daily sources`);

    if (dailySources.length === 0) {
      console.log('[Cron Daily] No daily sources configured');
      return NextResponse.json({
        success: true,
        message: 'No daily sources to crawl',
        queued: 0
      });
    }

    // Get crawler service URL (this service)
    const baseURL = getBaseURL();
    const workerURL = `${baseURL}/api/crawler/worker`;
    
    console.log('[Cron Daily] Environment:', {
      baseURL,
      workerURL,
      hasQStashToken: !!process.env.QSTASH_TOKEN
    });

    // Queue crawl jobs via QStash
    const queuedJobs: Array<{
      source_id: string;
      source_name: string;
      message_id: string;
    }> = [];
    const failedJobs: Array<{
      source_id: string;
      source_name: string;
      error: string;
    }> = [];

    for (const source of dailySources) {
      try {
        console.log(`[Cron Daily] Queuing: ${source.name} (${source.id})`);
        
        const publishOptions: any = {
          url: workerURL,
          body: {
            source_id: source.id,
            triggered_by: 'cron_daily',
            timestamp: new Date().toISOString()
          },
          retries: 3,
          delay: queuedJobs.length * 5 // Stagger requests by 5 seconds
        };

        // Add Vercel bypass token if configured
        if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
          publishOptions.headers = {
            'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET
          };
        }
        
        const result = await qstashClient.publishJSON(publishOptions);

        queuedJobs.push({
          source_id: source.id,
          source_name: source.name,
          message_id: result.messageId
        });

        console.log(`[Cron Daily] ✅ Queued: ${source.name} (messageId: ${result.messageId})`);
      } catch (error) {
        console.error(`[Cron Daily] ❌ Failed to queue ${source.name}:`, error);
        failedJobs.push({
          source_id: source.id,
          source_name: source.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`[Cron Daily] ✅ Queued ${queuedJobs.length} jobs`);
    if (failedJobs.length > 0) {
      console.log(`[Cron Daily] ⚠️ Failed ${failedJobs.length} jobs:`, failedJobs);
    }
    console.log('[Cron Daily] Summary:', {
      total: dailySources.length,
      queued: queuedJobs.length,
      failed: failedJobs.length,
      messageIds: queuedJobs.map(j => j.message_id)
    });
    console.log('[Cron Daily] ========================================');

    return NextResponse.json({
      success: true,
      queued: queuedJobs.length,
      failed: failedJobs.length,
      jobs: queuedJobs,
      failures: failedJobs
    });

  } catch (error) {
    console.error('[Cron Daily] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
