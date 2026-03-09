/**
 * Weekly Crawler Cron Job
 * 
 * GET /api/crawler/cron/weekly
 * 
 * Triggered by Vercel Cron at 3:00 AM every Sunday
 * Queues weekly crawl jobs via QStash
 */

import { NextRequest, NextResponse } from 'next/server';
import { qstashClient, getBaseURL } from '@/lib/qstash/client';
import { GOVERNMENT_SOURCES } from '@/lib/crawler/sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[Cron Weekly] ========================================');
    console.log('[Cron Weekly] Starting weekly crawl job...');
    console.log('[Cron Weekly] Timestamp:', new Date().toISOString());
    console.log('[Cron Weekly] Request URL:', request.url);

    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    console.log('[Cron Weekly] Auth check:', {
      hasAuthHeader: !!authHeader,
      hasCronSecret: !!process.env.CRON_SECRET,
      authMatches: authHeader === expectedAuth
    });
    
    if (authHeader !== expectedAuth) {
      console.error('[Cron Weekly] Unauthorized request');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get weekly sources
    const weeklySources = GOVERNMENT_SOURCES.filter(
      source => source.crawl_frequency === 'weekly'
    );

    console.log(`[Cron Weekly] Found ${weeklySources.length} weekly sources`);

    if (weeklySources.length === 0) {
      console.log('[Cron Weekly] No weekly sources configured');
      return NextResponse.json({
        success: true,
        message: 'No weekly sources to crawl',
        queued: 0
      });
    }

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

    const baseURL = getBaseURL();
    const workerURL = `${baseURL}/api/crawler/worker`;
    
    console.log('[Cron Weekly] Environment:', {
      VERCEL_URL: process.env.VERCEL_URL || 'not set',
      NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL || 'not set',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'not set',
      baseURL,
      workerURL
    });
    
    console.log('[Cron Weekly] QStash config:', {
      hasToken: !!process.env.QSTASH_TOKEN,
      hasCurrentKey: !!process.env.QSTASH_CURRENT_SIGNING_KEY,
      hasNextKey: !!process.env.QSTASH_NEXT_SIGNING_KEY
    });

    for (const source of weeklySources) {
      try {
        console.log(`[Cron Weekly] Queuing: ${source.name} (${source.id})`);
        console.log(`[Cron Weekly] Source details:`, {
          id: source.id,
          name: source.name,
          url: source.url,
          type: source.type,
          frequency: source.crawl_frequency
        });
        
        const payload = {
          source_id: source.id,
          triggered_by: 'cron_weekly',
          timestamp: new Date().toISOString()
        };
        
        console.log(`[Cron Weekly] Publishing to QStash:`, {
          workerURL,
          payload,
          retries: 3,
          delay: queuedJobs.length * 5
        });
        
        const result = await qstashClient.publishJSON({
          url: workerURL,
          body: payload,
          retries: 3,
          delay: queuedJobs.length * 5
        });

        queuedJobs.push({
          source_id: source.id,
          source_name: source.name,
          message_id: result.messageId
        });

        console.log(`[Cron Weekly] ✅ Queued: ${source.name}`);
        console.log(`[Cron Weekly] Message ID: ${result.messageId}`);
      } catch (error) {
        console.error(`[Cron Weekly] ❌ Failed to queue ${source.name}`);
        console.error(`[Cron Weekly] Error details:`, {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          error
        });
        failedJobs.push({
          source_id: source.id,
          source_name: source.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`[Cron Weekly] ✅ Queued ${queuedJobs.length} jobs`);
    if (failedJobs.length > 0) {
      console.log(`[Cron Weekly] ⚠️ Failed ${failedJobs.length} jobs:`, failedJobs);
    }
    console.log('[Cron Weekly] Summary:', {
      total: weeklySources.length,
      queued: queuedJobs.length,
      failed: failedJobs.length,
      messageIds: queuedJobs.map(j => j.message_id)
    });
    console.log('[Cron Weekly] ========================================');

    return NextResponse.json({
      success: true,
      queued: queuedJobs.length,
      failed: failedJobs.length,
      jobs: queuedJobs,
      failures: failedJobs
    });

  } catch (error) {
    console.error('[Cron Weekly] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

