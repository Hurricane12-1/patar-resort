import { insertNotification } from './notifications.js';

export const STAFF_NOTIFICATION_TYPES = ['booking', 'ticket', 'customer'];

/**
 * Adds an alert to the staff Notifications page. It never throws, so a problem with the
 * notifications table cannot break the booking, ticket or sign-up that triggered it.
 */
export async function notifyStaff({ type, title, body, reservationId = null }) {
  if (!STAFF_NOTIFICATION_TYPES.includes(type)) return null;
  try {
    return await insertNotification({ type, title, body, recipient: 'Front Desk', reservationId });
  } catch (err) {
    console.warn(`[Notify] Could not save the ${type} alert: ${err.message}`);
    return null;
  }
}
