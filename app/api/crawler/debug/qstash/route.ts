/**
 * QStash Debug API
 * 
 * GET /api/crawler/debug/qstash?action=logs|dlq|messages
 * 
 * Debug endpoint to check QStash message status, logs, and DLQ
 */

import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[QStash Debug] ========================================');
    console.log('[QStash Debug] Request received');
    console.log('[QStash Debug] Timestamp:', new Date().toISOString());
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'logs';
    const messageId = searchParams.get('messageId');
    const count = parseInt(searchParams.get('count') || '50');

    console.log('[QStash Debug] Parameters:', { action, messageId, count });

    if (!process.env.QSTASH_TOKEN) {
      console.error('[QStash Debug] ❌ QSTASH_TOKEN not configured');
      return NextResponse.json(
        { success: false, error: 'QSTASH_TOKEN not configured' },
        { status: 500 }
      );
    }

    console.log('[QStash Debug] ✅ QSTASH_TOKEN configured');
    const client = new Client({ token: process.env.QSTASH_TOKEN });

    switch (action) {
      case 'logs': {
        console.log('[QStash Debug] Fetching logs...');
        // Get recent logs
        const logs = await client.logs({
          filter: {
            count,
          }
        });

        console.log(`[QStash Debug] Found ${logs.logs.length} logs`);
        
        // Group logs by state
        const byState = logs.logs.reduce((acc, log) => {
          acc[log.state] = (acc[log.state] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        console.log('[QStash Debug] Logs by state:', byState);

        return NextResponse.json({
          success: true,
          action: 'logs',
          count: logs.logs.length,
          cursor: logs.cursor,
          summary: {
            total: logs.logs.length,
            byState,
            hasMore: !!logs.cursor
          },
          logs: logs.logs.map(log => ({
            messageId: log.messageId,
            state: log.state,
            url: log.url,
            time: new Date(log.time).toISOString(),
            error: log.error || null,
          }))
        });
      }

      case 'dlq': {
        console.log('[QStash Debug] Fetching DLQ messages...');
        // Get Dead Letter Queue messages
        const dlq = await client.dlq.listMessages({
          count,
        });

        console.log(`[QStash Debug] Found ${dlq.messages.length} DLQ messages`);
        
        // Group by response status
        const byStatus = dlq.messages.reduce((acc, msg) => {
          const status = msg.responseStatus || 'unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {} as Record<string | number, number>);
        
        console.log('[QStash Debug] DLQ by status:', byStatus);

        return NextResponse.json({
          success: true,
          action: 'dlq',
          count: dlq.messages.length,
          cursor: dlq.cursor,
          summary: {
            total: dlq.messages.length,
            byStatus,
            hasMore: !!dlq.cursor
          },
          messages: dlq.messages.map(msg => ({
            dlqId: msg.dlqId,
            messageId: msg.messageId,
            url: msg.url,
            method: msg.method,
            createdAt: new Date(msg.createdAt).toISOString(),
            responseStatus: msg.responseStatus,
            responseBody: msg.responseBody,
            responseBodyBase64: msg.responseBodyBase64,
            scheduleId: msg.scheduleId,
            queueName: msg.queueName
          }))
        });
      }

      case 'message': {
        console.log('[QStash Debug] Fetching message details...');
        // Get specific message details
        if (!messageId) {
          console.error('[QStash Debug] ❌ Missing messageId parameter');
          return NextResponse.json(
            { success: false, error: 'messageId parameter required' },
            { status: 400 }
          );
        }

        console.log('[QStash Debug] Message ID:', messageId);
        const message = await client.messages.get(messageId);
        
        console.log('[QStash Debug] Message found:', {
          messageId: message.messageId,
          url: message.url
        });

        return NextResponse.json({
          success: true,
          action: 'message',
          message: {
            messageId: message.messageId,
            url: message.url,
            createdAt: new Date(message.createdAt).toISOString()
          }
        });
      }

      default:
        console.error('[QStash Debug] ❌ Invalid action:', action);
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: logs, dlq, or message' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('[QStash Debug] ❌ Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error
    });
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
