import { createClient } from '@supabase/supabase-js';

let supabaseClient: any = null;

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && 
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) &&
  !import.meta.env.VITE_SUPABASE_URL.includes('placeholder')
);

export function getSupabase() {
  if (supabaseClient) return supabaseClient;
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';
  
  try {
    // Only attempt to create if URL is actually a URL
    if (!supabaseUrl.startsWith('http')) {
      throw new Error('Invalid Supabase URL: ' + supabaseUrl);
    }
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    return supabaseClient;
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
    // Return a dummy object to prevent immediate crashes
    return {
      from: () => ({
        select: () => ({ 
          eq: () => ({ 
            single: () => Promise.resolve({ data: null, error: null }),
            limit: () => Promise.resolve({ data: [], error: null })
          }),
          order: () => Promise.resolve({ data: [], error: null }),
          limit: () => Promise.resolve({ data: [], error: null }),
          then: (cb: any) => cb({ data: [], error: null })
        }),
        upsert: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) })
      })
    };
  }
}
