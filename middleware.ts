/**
 * Next.js Middleware
 * 
 * Handles request routing and protection bypass for webhook endpoints
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow QStash to access worker endpoint without Vercel auth
  if (pathname === '/api/crawler/worker') {
    // QStash requests should have upstash-signature header
    const hasQStashSignature = request.headers.has('upstash-signature');
    
    if (hasQStashSignature) {
      // Clone the response and add bypass header
      const response = NextResponse.next();
      
      // Log the request for debugging
      console.log('[Middleware] QStash request to worker:', {
        pathname,
        hasSignature: true,
        userAgent: request.headers.get('user-agent')
      });
      
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/crawler/worker',
  ],
};
