import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL || 'https://owhodkhzldygavuwnqfg.supabase.co';
const url = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93aG9ka2h6bGR5Z2F2dXducWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNzg4NTMsImV4cCI6MjEwNDg1NDg1M30.NyRQYrpcROhnlfEXq83eqnAIYhegCZl_b08YV-G9J_c';

export const supabase = createClient(url, key, {
  auth: {
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    persistSession: true,
  },
});
