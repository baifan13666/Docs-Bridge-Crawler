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

  // Client automatically reads QSTASH_TOKEN from environment variables
  // Optional: configure retry and telemetry
  _qstashClient = new Client({
    token: process.env.QSTASH_TOKEN!,
    retry: {
      retries: 3,
      backoff: (retryCount: number) => Math.exp(retryCount) * 50,
    },
    enableTelemetry: true, // Default: true
  });

  return _qstashClient;
}

// For backward compatibility
export const qstashClient = new Proxy({} as Client, {
  get(_target, prop) {
    return getQStashClient()[prop as keyof Client];
  }
});
