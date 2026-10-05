import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '../config/env.js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_URL.includes('placeholder')) {
    console.warn('[Supabase] Warning: Valid SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not yet configured in .env');
  }

  // Create client (with dummy fallback if missing, to prevent crash on startup before user configures .env)
  supabaseClient = createClient(
    ENV.SUPABASE_URL || 'https://placeholder.supabase.co',
    ENV.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  return supabaseClient;
}
