import crypto from 'crypto';
import QRCode from 'qrcode';
import { ApiError } from '../middleware/errors.js';
import { getSystemAdminClient } from './supabase.js';
import { ownsReservation } from './authz.js';
import { sendDownpaymentQrEmail } from './downpaymentEmail.js';
import { logAuditEvent } from './auditLogger.js';
import { notifyStaff } from './notify.js';
import { pingSMS } from './sms.js';
import { redis } from './redis.js';

export const DOWNPAYMENT_WINDOW_MS = 15 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
const MAX_RESERVATIONS_PER_HOLD = 10;
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WINDOW_CLOSED_MESSAGE = 'The 15-minute downpayment window has closed, so these rooms were released. Please book again.';

let sweepTimer = null;

function makeReference() {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += REFERENCE_ALPHABET[crypto.randomInt(REFERENCE_ALPHABET.length)];
  }
  return `DP-${code}`;
}

function buildQrPayload(reference, amount) {
  return `ROCKVIEW|DOWNPAYMENT|${reference}|PHP${amount}`;
}

async function renderQrPng(reference, amount) {
  return QRCode.toBuffer(buildQrPayload(reference, amount), {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
  });
}

function serializeHold(hold, qrDataUrl, emailed = false) {
  return {
    id: hold.id,
    reference: hold.reference,
    amount_php: hold.amount_php,
    status: hold.status,
    expires_at: hold.expires_at,
    reservation_ids: hold.reservation_ids,
    qr_data_url: qrDataUrl,
    emailed,
  };
}

async function loadReservations(client, ids) {
  const { data, error } = await client
    .from('reservations')
    .select('id, guest_id, email, guest_name, phone, status, payment_status, downpayment_php, check_in, check_out, rooms(name)')
    .in('id', ids);
  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}

// Releases the rooms first, then marks the hold expired. A hold is only expired after
// its window has passed, and confirmation checks the window again, so the two can never both succeed.
async function releaseHold(client, hold) {
  const { error: releaseError } = await client
    .from('reservations')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .in('id', hold.reservation_ids)
    .eq('status', 'pending');
  if (releaseError) throw new Error(releaseError.message);

  const { error } = await client
    .from('payment_holds')
    .update({ status: 'expired' })
    .eq('id', hold.id)
    .eq('status', 'awaiting');
  if (error) throw new Error(error.message);
}

export async function expireOverdueHolds() {
  const client = await getSystemAdminClient();
  const { data: overdue, error } = await client
    .from('payment_holds')
    .select('id, reservation_ids')
    .eq('status', 'awaiting')
    .lt('expires_at', new Date().toISOString());
  if (error) throw new Error(error.message);

  for (const hold of overdue ?? []) {
    await releaseHold(client, hold);
  }
  if (overdue?.length) await redis.clear();
  return overdue?.length ?? 0;
}

export async function sweepExpiredHolds() {
  try {
    await expireOverdueHolds();
  } catch (err) {
    console.warn('[Downpayment] Could not release overdue holds:', err.message);
  }
}

export function startPaymentHoldSweeper() {
  if (sweepTimer) return;
  sweepTimer = setInterval(sweepExpiredHolds, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
}

export async function createDownpaymentHold({ user, reservationIds, req }) {
  await sweepExpiredHolds();

  const ids = [...new Set(reservationIds)];
  if (ids.length > MAX_RESERVATIONS_PER_HOLD) {
    throw new ApiError(422, `A single downpayment can cover up to ${MAX_RESERVATIONS_PER_HOLD} rooms.`);
  }

  const client = await getSystemAdminClient();
  const reservations = await loadReservations(client, ids);
  if (reservations.length !== ids.length) {
    throw new ApiError(404, 'One of these bookings could not be found.');
  }
  if (!reservations.every((row) => ownsReservation(user, row))) {
    throw new ApiError(403, 'These bookings belong to another guest.');
  }
  if (!reservations.every((row) => row.status === 'pending' && row.payment_status === 'unpaid')) {
    throw new ApiError(409, 'These bookings are no longer waiting for a downpayment.');
  }

  const { data: openHolds, error: openError } = await client
    .from('payment_holds')
    .select('*')
    .eq('status', 'awaiting')
    .gt('expires_at', new Date().toISOString())
    .overlaps('reservation_ids', ids);
  if (openError) throw new ApiError(500, openError.message);

  const existing = openHolds?.[0];
  if (existing) {
    const qrPng = await renderQrPng(existing.reference, existing.amount_php);
    return serializeHold(existing, `data:image/png;base64,${qrPng.toString('base64')}`);
  }

  const amount = reservations.reduce((sum, row) => sum + (Number(row.downpayment_php) || 0), 0);
  if (amount <= 0) {
    throw new ApiError(422, 'These bookings have no downpayment to collect.');
  }

  const guest = reservations[0];
  const expiresAt = new Date(Date.now() + DOWNPAYMENT_WINDOW_MS).toISOString();
  const { data: hold, error: insertError } = await client
    .from('payment_holds')
    .insert({
      reference: makeReference(),
      reservation_ids: ids,
      guest_email: guest.email || user.email || null,
      guest_name: guest.guest_name || null,
      amount_php: amount,
      status: 'awaiting',
      expires_at: expiresAt,
    })
    .select('*')
    .single();
  if (insertError) throw new ApiError(500, insertError.message);

  const qrPng = await renderQrPng(hold.reference, amount);

  let emailed = false;
  if (hold.guest_email) {
    emailed = await sendDownpaymentQrEmail({
      to: hold.guest_email,
      name: hold.guest_name || 'Guest',
      reference: hold.reference,
      amount,
      rooms: reservations.map((row) => row.rooms?.name).filter(Boolean),
      checkIn: guest.check_in,
      checkOut: guest.check_out,
      expiresAt,
      qrPng,
    })
      .then(() => true)
      .catch((err) => {
        console.warn('[Downpayment] QR email could not be sent:', err.message);
        return false;
      });
  }

  await logAuditEvent({
    actor: user,
    action: 'DOWNPAYMENT_REQUESTED',
    resourceType: 'payment_hold',
    resourceId: hold.id,
    details: { reference: hold.reference, amount_php: amount, reservation_ids: ids, expires_at: expiresAt, emailed },
    req,
  });

  return serializeHold(hold, `data:image/png;base64,${qrPng.toString('base64')}`, emailed);
}

export async function confirmDownpaymentHold({ user, holdId, req }) {
  if (!UUID_PATTERN.test(String(holdId))) {
    throw new ApiError(404, 'This payment request could not be found.');
  }

  const client = await getSystemAdminClient();
  const { data: hold, error } = await client
    .from('payment_holds')
    .select('*')
    .eq('id', holdId)
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  if (!hold) throw new ApiError(404, 'This payment request could not be found.');

  const reservations = await loadReservations(client, hold.reservation_ids);
  if (!reservations.length || !reservations.every((row) => ownsReservation(user, row))) {
    throw new ApiError(403, 'This payment request belongs to another guest.');
  }

  if (hold.status === 'paid') {
    return { success: true, status: 'paid', reference: hold.reference, amount_php: hold.amount_php, reservation_ids: hold.reservation_ids };
  }

  const windowClosed = hold.status === 'expired' || new Date(hold.expires_at).getTime() <= Date.now();
  if (windowClosed) {
    await releaseHold(client, hold);
    await redis.clear();
    throw new ApiError(410, WINDOW_CLOSED_MESSAGE);
  }

  const nowIso = new Date().toISOString();
  const { data: paidRows, error: payError } = await client
    .from('payment_holds')
    .update({ status: 'paid', paid_at: nowIso })
    .eq('id', hold.id)
    .eq('status', 'awaiting')
    .gt('expires_at', nowIso)
    .select('*');
  if (payError) throw new ApiError(500, payError.message);
  if (!paidRows?.length) {
    throw new ApiError(409, 'This payment was already handled. Check your bookings for its status.');
  }
  const paid = paidRows[0];

  const { error: confirmError } = await client
    .from('reservations')
    .update({ status: 'confirmed', payment_status: 'partially_paid', updated_at: nowIso })
    .in('id', paid.reservation_ids)
    .eq('status', 'pending');
  if (confirmError) throw new ApiError(500, confirmError.message);

  await redis.clear();

  await logAuditEvent({
    actor: user,
    action: 'DOWNPAYMENT_CONFIRMED',
    resourceType: 'payment_hold',
    resourceId: paid.id,
    details: { reference: paid.reference, amount_php: paid.amount_php, reservation_ids: paid.reservation_ids, simulated: true },
    req,
  });

  const guest = reservations[0];
  const guestName = guest.guest_name || 'Guest';
  await notifyStaff({
    type: 'booking',
    title: 'Downpayment received',
    body: `${guestName} paid the ₱${Number(paid.amount_php).toLocaleString()} downpayment (${paid.reference}). Booking confirmed.`,
    reservationId: paid.reservation_ids[0],
  });

  if (guest.phone) {
    pingSMS({
      profileId: guest.guest_id || null,
      reservationId: paid.reservation_ids[0],
      toPhone: guest.phone,
      body: `Rock View Beach Resort: downpayment of ₱${Number(paid.amount_php).toLocaleString()} received (${paid.reference}). Your stay is confirmed. The balance is paid at check-in.`,
    }).catch((err) => console.warn('[Downpayment] Confirmation SMS not sent:', err.message));
  }

  return { success: true, status: 'paid', reference: paid.reference, amount_php: paid.amount_php, reservation_ids: paid.reservation_ids };
}
