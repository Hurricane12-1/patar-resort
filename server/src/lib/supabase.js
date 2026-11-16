import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

// Fast-aborting fetch wrapper to prevent paused Supabase projects (Error 522) from hanging requests
const resilientFetch = (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  return fetch(url, {
    ...options,
    signal: options.signal || controller.signal,
  }).finally(() => clearTimeout(timeout));
};

export const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: resilientFetch },
});

export const userClient = (token) =>
  createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: resilientFetch,
    },
    auth: { persistSession: false },
  });
let systemAdminToken = null;
let systemAdminTokenExp = 0;

export async function getSystemAdminClient() {
  if (env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_SERVICE_ROLE_KEY !== env.SUPABASE_ANON_KEY) {
    return admin;
  }
  const now = Math.floor(Date.now() / 1000);
  if (systemAdminToken && systemAdminTokenExp > now + 60) {
    return userClient(systemAdminToken);
  }
  if (env.SUPABASE_ADMIN_EMAIL && env.SUPABASE_ADMIN_PASSWORD) {
    try {
      const base = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
      const { data } = await base.auth.signInWithPassword({
        email: env.SUPABASE_ADMIN_EMAIL,
        password: env.SUPABASE_ADMIN_PASSWORD,
      });
      if (data?.session?.access_token) {
        systemAdminToken = data.session.access_token;
        systemAdminTokenExp = data.session.expires_at || (now + 3600);
        return userClient(systemAdminToken);
      }
    } catch (err) {
      console.warn('[System Admin Client] Auth notice:', err.message);
    }
  }
  return admin;
}
