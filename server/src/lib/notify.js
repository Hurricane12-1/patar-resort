import { admin } from './supabase.js';

export const STAFF_NOTIFICATION_TYPES = ['booking', 'ticket', 'customer'];

/**
 * Adds an alert to the staff Notifications page. It never throws, so a missing or different
 * notifications table cannot break the booking, ticket or sign-up that triggered it.
 */
export async function notifyStaff({ type, title, body, reservationId = null }) {
  if (!STAFF_NOTIFICATION_TYPES.includes(type)) return null;
  try {
    const { data, error } = await admin
      .from('notifications')
      .insert({
        type,
        title,
        body,
        recipient: 'Front Desk',
        reservation_id: reservationId,
        profile_id: null,
        status: 'sent',
        is_read: false,
      })
      .select()
      .single();
    if (error) {
      console.warn(`[Notify] Could not save the ${type} alert: ${error.message}`);
      return null;
    }
    return data;
  } catch (err) {
    console.warn(`[Notify] Could not save the ${type} alert: ${err.message}`);
    return null;
  }
}
