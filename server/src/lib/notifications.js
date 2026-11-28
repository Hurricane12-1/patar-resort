import { admin } from './supabase.js';

/**
 * The notifications table holds: id, user_id, title, message, channel (in_app | sms | email),
 * status (unread | read | sent | failed), payload (jsonb) and created_at. Anything else an alert
 * needs (its kind, who it is for, the booking it is about) lives in payload.
 */
export async function insertNotification({
  userId = null,
  title,
  body,
  type = 'system',
  channel = 'in_app',
  status = 'unread',
  recipient = null,
  reservationId = null,
  toPhone = null,
  client = admin,
}) {
  const { data, error } = await client
    .from('notifications')
    .insert({
      user_id: userId,
      title: String(title || 'Notification').slice(0, 200),
      message: String(body || '').slice(0, 2000) || String(title || 'Notification'),
      channel,
      status,
      payload: { type, recipient, reservation_id: reservationId, to_phone: toPhone },
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** The shape the admin pages read: body, type, is_read, to_phone and so on. */
export function shapeNotification(row) {
  const payload = row?.payload || {};
  return {
    id: row.id,
    profile_id: row.user_id,
    title: row.title,
    body: row.message,
    message: row.message,
    type: payload.type || (row.channel === 'sms' ? 'sms' : 'system'),
    channel: row.channel,
    recipient: payload.recipient || null,
    to_phone: payload.to_phone || null,
    reservation_id: payload.reservation_id || null,
    status: row.status,
    is_read: row.status === 'read',
    created_at: row.created_at,
  };
}
