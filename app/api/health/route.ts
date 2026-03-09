/**
 * Health Check Endpoint
 * 
 * GET /api/health
 */

import { NextResponse } from 'next/server';
import { GOVERNMENT_SOURCES } from '@/lib/crawler/sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'docs-bridge-crawler',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    sources: {
      total: GOVERNMENT_SOURCES.length,
      by_frequency: {
        daily: GOVERNMENT_SOURCES.filter(s => s.crawl_frequency === 'daily').length,
        weekly: GOVERNMENT_SOURCES.filter(s => s.crawl_frequency === 'weekly').length,
        monthly: GOVERNMENT_SOURCES.filter(s => s.crawl_frequency === 'monthly').length
      },
      by_country: {
        malaysia: GOVERNMENT_SOURCES.filter(s => s.country === 'malaysia').length,
        philippines: GOVERNMENT_SOURCES.filter(s => s.country === 'philippines').length,
        singapore: GOVERNMENT_SOURCES.filter(s => s.country === 'singapore').length
      }
    }
  });
}
