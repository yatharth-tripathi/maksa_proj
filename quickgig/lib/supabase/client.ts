/**
 * Supabase Client Utilities
 * Server-side and client-side Supabase clients
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Client-side Supabase client (uses anon key, respects RLS)
 * Use this in frontend components
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Server-side Supabase client (uses service role key, bypasses RLS)
 * Use this in API routes for admin operations
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

/**
 * Create a client for a specific user (for RLS policies)
 */
export function createUserClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
