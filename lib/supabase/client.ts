/**
 * Supabase Client for Crawler Service
 * 
 * Uses service role key for background operations
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Create Supabase client with service role (for crawler operations)
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
