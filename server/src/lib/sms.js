import twilioPkg from 'twilio';
import { env, smsEnabled } from '../config/env.js';
import { admin } from './supabase.js';
import { insertNotification } from './notifications.js';

const client = smsEnabled ? twilioPkg(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN) : null;

export async function pingSMS({ profileId, reservationId = null, toPhone, body }) {
  if (!toPhone) return null;
  let note = null;
  try {
    note = await insertNotification({
      userId: profileId,
      title: 'SMS to guest',
      body,
      type: 'sms',
      channel: 'sms',
      status: 'sent',
      reservationId,
      toPhone,
    });
  } catch (e) {
    console.warn('[sms] Could not log the message:', e.message);
  }
  if (!note) return null;

  if (!client) { console.log(`[sms:dev] → ${toPhone}: ${body}`); return note; }
  try {
    const msg = await client.messages.create({
      to: toPhone, from: env.TWILIO_FROM, body,
      statusCallback: env.PUBLIC_API_URL ? `${env.PUBLIC_API_URL}/api/webhooks/sms/status` : undefined,
    });
    await admin.from('notifications')
      .update({ status: 'sent', payload: { ...(note.payload || {}), provider_sid: msg.sid, sent_at: new Date().toISOString() } })
      .eq('id', note.id);
  } catch (e) {
    console.error('SMS failed:', e.message);
    await admin.from('notifications').update({ status: 'failed' }).eq('id', note.id);
  }
  return note;
}
