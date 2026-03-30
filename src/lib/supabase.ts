import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// URL 형식이 올바른지 확인 (http로 시작하는지)
const isValidUrl = (url: string | undefined): url is string => {
  if (!url) return false;
  try {
    new URL(url);
    return url.startsWith('http');
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = Boolean(
  isValidUrl(supabaseUrl) && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder')
);

if (!isSupabaseConfigured) {
  console.warn('Supabase URL or Key is missing or invalid. Please check your environment variables.');
}

// 유효하지 않은 URL일 경우 에러 방지를 위해 placeholder URL 사용
export const supabase = createClient(
  isValidUrl(supabaseUrl) ? supabaseUrl : 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
