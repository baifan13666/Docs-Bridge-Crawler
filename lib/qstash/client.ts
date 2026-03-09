/**
 * QStash Client for Crawler Service
 * Updated for @upstash/qstash v2.3.0+
 */

import { Client } from '@upstash/qstash';

let _qstashClient: Client | null = null;

export function getQStashClient(): Client {
  if (_qstashClient) {
    return _qstashClient;
  }

  if (!process.env.QSTASH_TOKEN) {
    throw new Error('QSTASH_TOKEN environment variable is not set');
  }

  // Client automatically reads QSTASH_TOKEN from environment variables
  // Optional: configure retry and telemetry
  _qstashClient = new Client({
    token: process.env.QSTASH_TOKEN,
    retry: {
      retries: 3,
      backoff: (retryCount: number) => Math.exp(retryCount) * 50,
    },
  });

  return _qstashClient;
}

// For backward compatibility
export const qstashClient = new Proxy({} as Client, {
  get(_target, prop) {
    return getQStashClient()[prop as keyof Client];
  }
});

/**
 * Get the base URL for the application
 * Works in both development and production (Vercel)
 */
export function getBaseURL(): string {
  // Production: Use VERCEL_URL or NEXT_PUBLIC_VERCEL_URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // Development: Use localhost
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
}
