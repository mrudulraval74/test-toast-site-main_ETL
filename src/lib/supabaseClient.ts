import { createClient } from '@supabase/supabase-js';

/**
 * WARNING: This frontend uses NEXT_PUBLIC_* environment variables.
 * DO NOT place service role keys in frontend code.
 * The parent repository must provide safe public keys via environment variables.
 * 
 * Environment variables required:
 * - NEXT_PUBLIC_SUPABASE_URL: The Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: The Supabase anonymous/public key (NOT service role)
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabasePublishableKey) {
  console.error('Missing Supabase environment variables. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
