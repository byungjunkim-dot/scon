import { createClient } from '@supabase/supabase-js';

let supabaseClient: any = null;

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && 
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) &&
  !import.meta.env.VITE_SUPABASE_URL.includes('placeholder')
);

// Helper to create an awaitable dummy result
const createDummyResult = (data: any = []) => {
  const result = { data, error: null };
  const promise = Promise.resolve(result);
  
  // Make the result itself look like a chainable Supabase query
  const chainable: any = {
    ...result,
    then: (onfulfilled?: any) => promise.then(onfulfilled),
    catch: (onrejected?: any) => promise.catch(onrejected),
    finally: (onfinally?: any) => promise.finally(onfinally),
    eq: () => chainable,
    select: () => chainable,
    single: () => createDummyResult(Array.isArray(data) ? data[0] || null : data),
    order: () => chainable,
    limit: () => chainable,
    upsert: () => chainable,
    delete: () => chainable,
    insert: () => chainable,
    update: () => chainable,
  };
  
  return chainable;
};

export function getSupabase() {
  if (supabaseClient) return supabaseClient;
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';
  
  try {
    if (!supabaseUrl.startsWith('http')) {
      throw new Error('Invalid Supabase URL');
    }
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    return supabaseClient;
  } catch (error) {
    console.warn('Using dummy Supabase client due to initialization error:', error);
    
    // Return a fully chainable and awaitable dummy object
    return {
      from: () => createDummyResult([]),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      }
    };
  }
}

export const supabase = getSupabase();
