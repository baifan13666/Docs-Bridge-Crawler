/**
 * QStash Client for Crawler Service
 */

import { Client } from '@upstash/qstash';

let _qstashClient: Client | null = null;

export function getQStashClient(): Client {
  if (_qstashClient) {
    return _qstashClient;
  }

  const qstashToken = process.env.QSTASH_TOKEN;

  if (!qstashToken) {
    throw new Error('QSTASH_TOKEN environment variable is required');
  }

  _qstashClient = new Client({
    token: qstashToken,
  });

  return _qstashClient;
}

// For backward compatibility
export const qstashClient = new Proxy({} as Client, {
  get(_target, prop) {
    return getQStashClient()[prop as keyof Client];
  }
});
