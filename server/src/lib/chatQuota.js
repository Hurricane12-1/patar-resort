import { admin } from './supabase.js';
import { createDailyQuota, manilaDay } from './chatGuard.js';

const quota = createDailyQuota();

export function clientIpFrom(headers = {}, fallback = '') {
  const forwarded = String(headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(fallback || '').replace(/^::ffff:/, '') || 'unknown';
}

// Signed-in guests are counted from their saved messages on first use each day, so a server restart
// does not hand out a fresh 40. Visitors are counted by IP address in memory.
async function seedFromSavedMessages(key, userId, nowMs) {
  const startOfDay = new Date(`${manilaDay(nowMs)}T00:00:00+08:00`).toISOString();
  const { count, error } = await admin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', userId)
    .eq('role', 'customer')
    .gte('created_at', startOfDay)
    .is('metadata->>directed_to_agent', null);
  if (error) {
    console.warn('[Chat quota] Could not count saved messages:', error.message);
    quota.seed(key, 0, nowMs);
    return;
  }
  quota.seed(key, count ?? 0, nowMs);
}

export async function consumeChatQuota({ userId, ip }) {
  const nowMs = Date.now();
  const key = userId ? `user:${userId}` : `ip:${ip || 'unknown'}`;
  if (userId && !quota.isSeeded(key, nowMs)) {
    await seedFromSavedMessages(key, userId, nowMs);
  }
  return quota.consume(key, nowMs);
}
