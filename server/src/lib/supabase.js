import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

export const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const userClient = (token) =>
  createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
let systemAdminToken = null;
let systemAdminTokenExp = 0;

export async function getSystemAdminClient() {
  if (env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_SERVICE_ROLE_KEY !== env.SUPABASE_ANON_KEY && !env.SUPABASE_SERVICE_ROLE_KEY.includes('demo-')) {
    return admin;
  }
  const now = Math.floor(Date.now() / 1000);
  if (systemAdminToken && systemAdminTokenExp > now + 60) {
    return userClient(systemAdminToken);
  }
  try {
    const base = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    const { data } = await base.auth.signInWithPassword({
      email: 'admin@janddbeachhouse.ph',
      password: 'AdminPassword123!',
    });
    if (data?.session?.access_token) {
      systemAdminToken = data.session.access_token;
      systemAdminTokenExp = data.session.expires_at || (now + 3600);
      return userClient(systemAdminToken);
    }
  } catch (err) {
    console.warn('[System Admin Client] Auth notice:', err.message);
  }
  return admin;
}
