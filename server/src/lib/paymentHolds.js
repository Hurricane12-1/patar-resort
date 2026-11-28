import crypto from 'crypto';
import QRCode from 'qrcode';
import { ApiError } from '../middleware/errors.js';
import { getSystemAdminClient } from './supabase.js';
import { ownsReservation } from './authz.js';
import { sendDownpaymentQrEmail, formatManilaTime } from './downpaymentEmail.js';
import { logAuditEvent } from './auditLogger.js';
import { notifyStaff } from './notify.js';
import { pingSMS } from './sms.js';
import { redis } from './redis.js';
import { checkPaymentAgainstHold } from './paymentSecurity.js';

export const DOWNPAYMENT_WINDOW_MS = 15 * 60 * 1000;
export const PAYMENT_REQUEST_LIMIT = 3;
export const PAYMENT_REQUEST_WINDOW_MS = 30 * 60 * 1000;

// TEMPORARY: simulated payment. There is no real payment provider yet, so the server credits each
// downpayment by itself once SIMULATED_CREDIT_DELAY_MS has passed, while the 15-minute window is open.
// When a real provider is connected, delete creditDueHolds and the credit calls, and credit from the
// provider's confirmation callback instead.
export const SIMULATED_PROVIDER = 'simulated-auto-credit';
export const SIMULATED_CREDIT_DELAY_MS = 20 * 1000;

// PAYMENT_PROVIDER unset or "simulated" keeps the temporary auto-credit. Any other value (for example
// "paymongo") turns it off, and only signed provider webhooks can credit a hold.
export function simulatedPaymentsEnabled() {
  return (process.env.PAYMENT_PROVIDER || 'simulated').trim().toLowerCase() === 'simulated';
}

const SWEEP_INTERVAL_MS = 15 * 1000;
const DOWNPAYMENT_RATE = 0.5;
const MAX_RESERVATIONS_PER_HOLD = 10;
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SYSTEM_ACTOR = { id: null, full_name: 'Simulated payment (automatic)', role: 'system' };

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

// Rooms allowed on a guest's 1st, 2nd and 3rd booking of the calendar month. No booking is allowed after the 3rd.
export const BOOKING_ROOM_TIERS = [2, 1, 1];
export const MONTHLY_BOOKING_LIMIT = BOOKING_ROOM_TIERS.length;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export function monthlyBookingWindow(nowMs) {
  const local = new Date(nowMs + MANILA_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  return {
    startMs: Date.UTC(year, month, 1) - MANILA_OFFSET_MS,
    nextStartMs: Date.UTC(year, month + 1, 1) - MANILA_OFFSET_MS,
  };
}

export function tierForBookingCount(bookingsThisMonth) {
  return {
    bookingsLeft: Math.max(0, MONTHLY_BOOKING_LIMIT - bookingsThisMonth),
    maxRooms: BOOKING_ROOM_TIERS[bookingsThisMonth] ?? 0,
  };
}

// One payment request is made per booking, so counting them counts bookings by the day they were made.
export async function getBookingAllowance(user) {
  const { startMs, nextStartMs } = monthlyBookingWindow(Date.now());
  const client = await getSystemAdminClient();
  const { count, error } = await client
    .from('payment_holds')
    .select('id', { count: 'exact', head: true })
    .eq('requested_by', user.id)
    .gte('created_at', new Date(startMs).toISOString());
  if (error) throw new ApiError(500, error.message);

  const used = count ?? 0;
  return {
    bookingsThisMonth: used,
    ...tierForBookingCount(used),
    resetsOn: new Date(nextStartMs).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Manila',
    }),
  };
}

export async function checkMonthlyBookingLimit(user) {
  const allowance = await getBookingAllowance(user);
  if (allowance.bookingsLeft <= 0) {
    throw new ApiError(
      429,
      `You have made ${MONTHLY_BOOKING_LIMIT} bookings this month. You can book again on ${allowance.resetsOn}. For more, file a ticket with customer service.`,
      { code: 'MONTHLY_BOOKING_LIMIT' }
    );
  }
  return allowance;
}

export function paymentRequestRetryAt(requestTimesMs, nowMs) {
  const inWindow = requestTimesMs
    .filter((time) => time > nowMs - PAYMENT_REQUEST_WINDOW_MS)
    .sort((a, b) => a - b);
  if (inWindow.length < PAYMENT_REQUEST_LIMIT) return null;
  return new Date(inWindow[inWindow.length - PAYMENT_REQUEST_LIMIT] + PAYMENT_REQUEST_WINDOW_MS);
}

function serializeHold(hold, qrDataUrl) {
  return {
    id: hold.id,
    reference: hold.reference,
    amount_php: hold.amount_php,
    status: hold.status,
    expires_at: hold.expires_at,
    reservation_ids: hold.reservation_ids,
    qr_data_url: qrDataUrl,
  };
}

function serializeStatus(hold) {
  return {
    id: hold.id,
    reference: hold.reference,
    amount_php: hold.amount_php,
    status: hold.status,
    expires_at: hold.expires_at,
    paid_at: hold.paid_at ?? null,
    reservation_ids: hold.reservation_ids,
  };
}

async function loadReservations(client, ids) {
  const { data, error } = await client
    .from('reservations')
    .select('id, guest_id, email, guest_name, phone, status, payment_status, total_php, check_in, check_out, rooms(name)')
    .in('id', ids);
  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}

// Releases the rooms first, then marks the hold expired. Crediting checks the window again
// at the moment it writes, so a hold that has expired can never be credited afterwards.
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

async function creditHold(client, hold, provider = SIMULATED_PROVIDER) {
  const reservations = await loadReservations(client, hold.reservation_ids);
  const stillWaiting = reservations.length === hold.reservation_ids.length
    && reservations.every((row) => row.status === 'pending');
  if (!stillWaiting) {
    await releaseHold(client, hold);
    return null;
  }

  const nowIso = new Date().toISOString();
  const { data: paidRows, error } = await client
    .from('payment_holds')
    .update({ status: 'paid', paid_at: nowIso, provider })
    .eq('id', hold.id)
    .eq('status', 'awaiting')
    .gt('expires_at', nowIso)
    .select('*');
  if (error) throw new Error(error.message);
  if (!paidRows?.length) return null;

  const paid = paidRows[0];
  const { data: confirmed, error: confirmError } = await client
    .from('reservations')
    .update({ status: 'confirmed', payment_status: 'partially_paid', updated_at: nowIso })
    .in('id', paid.reservation_ids)
    .eq('status', 'pending')
    .select('id, guest_id, guest_name, phone');
  if (confirmError) throw new Error(confirmError.message);

  await redis.clear();

  const simulated = provider === SIMULATED_PROVIDER;
  await logAuditEvent({
    actor: simulated ? SYSTEM_ACTOR : { id: null, full_name: `Payment provider (${provider})`, role: 'system' },
    action: simulated ? 'DOWNPAYMENT_AUTO_CREDITED' : 'DOWNPAYMENT_PROVIDER_CREDITED',
    resourceType: 'payment_hold',
    resourceId: paid.id,
    details: {
      reference: paid.reference,
      amount_php: paid.amount_php,
      reservation_ids: paid.reservation_ids,
      provider,
      simulated,
    },
  });

  const guest = confirmed?.[0];
  const amountLabel = `₱${Number(paid.amount_php).toLocaleString()}`;
  await notifyStaff({
    type: 'booking',
    title: simulated ? 'Downpayment received (simulated)' : 'Downpayment received',
    body: `${guest?.guest_name || paid.guest_name || 'Guest'} downpayment of ${amountLabel} (${paid.reference}) was credited ${simulated ? 'automatically. Temporary simulated payment.' : `by ${provider}.`}`,
    reservationId: paid.reservation_ids[0],
  });

  if (guest?.phone) {
    pingSMS({
      profileId: guest.guest_id || null,
      reservationId: paid.reservation_ids[0],
      toPhone: guest.phone,
      body: `Rock View Beach Resort: downpayment of ${amountLabel} received (${paid.reference}). Your stay is confirmed. The balance is paid at check-in.`,
    }).catch((err) => console.warn('[Downpayment] Confirmation SMS not sent:', err.message));
  }

  return paid;
}

async function creditDueHolds() {
  if (!simulatedPaymentsEnabled()) return 0;
  const client = await getSystemAdminClient();
  const nowMs = Date.now();
  const { data: due, error } = await client
    .from('payment_holds')
    .select('*')
    .eq('status', 'awaiting')
    .gt('expires_at', new Date(nowMs).toISOString())
    .lt('created_at', new Date(nowMs - SIMULATED_CREDIT_DELAY_MS).toISOString());
  if (error) throw new Error(error.message);

  for (const hold of due ?? []) {
    await creditHold(client, hold);
  }
  return due?.length ?? 0;
}

async function expireOverdueHolds() {
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

async function runSweepStep(label, step) {
  try {
    await step();
  } catch (err) {
    console.warn(`[Downpayment] Sweep (${label}) failed:`, err.message);
  }
}

export async function sweepExpiredHolds() {
  await runSweepStep('credit', creditDueHolds);
  await runSweepStep('expire', expireOverdueHolds);
}

export function startPaymentHoldSweeper() {
  if (sweepTimer) return;
  sweepTimer = setInterval(sweepExpiredHolds, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
}

async function enforcePaymentRequestLimit(client, user) {
  const sinceIso = new Date(Date.now() - PAYMENT_REQUEST_WINDOW_MS).toISOString();
  const { data, error } = await client
    .from('payment_holds')
    .select('created_at')
    .eq('requested_by', user.id)
    .gt('created_at', sinceIso);
  if (error) throw new ApiError(500, error.message);

  const retryAt = paymentRequestRetryAt(
    (data ?? []).map((row) => new Date(row.created_at).getTime()),
    Date.now()
  );
  if (retryAt) {
    throw new ApiError(
      429,
      `You have asked for ${PAYMENT_REQUEST_LIMIT} payments in the last 30 minutes. Try again after ${formatManilaTime(retryAt.toISOString())}.`,
      { retry_at: retryAt.toISOString() }
    );
  }
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

  await enforcePaymentRequestLimit(client, user);

  const allowance = await checkMonthlyBookingLimit(user);
  if (ids.length > allowance.maxRooms) {
    throw new ApiError(
      422,
      `On this booking you can reserve up to ${allowance.maxRooms} ${allowance.maxRooms === 1 ? 'room' : 'rooms'}. Remove a room to continue.`,
      { code: 'ROOM_LIMIT' }
    );
  }

  const stayTotal = reservations.reduce((sum, row) => sum + (Number(row.total_php) || 0), 0);
  const amount = Math.round(stayTotal * DOWNPAYMENT_RATE);
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
      requested_by: user.id,
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

  if (hold.guest_email) {
    sendDownpaymentQrEmail({
      to: hold.guest_email,
      name: hold.guest_name || 'Guest',
      reference: hold.reference,
      amount,
      rooms: reservations.map((row) => row.rooms?.name).filter(Boolean),
      checkIn: guest.check_in,
      checkOut: guest.check_out,
      expiresAt,
      qrPng,
    }).catch((err) => console.warn('[Downpayment] QR email could not be sent:', err.message));
  }

  await logAuditEvent({
    actor: user,
    action: 'DOWNPAYMENT_REQUESTED',
    resourceType: 'payment_hold',
    resourceId: hold.id,
    details: { reference: hold.reference, amount_php: amount, reservation_ids: ids, expires_at: expiresAt },
    req,
  });

  return serializeHold(hold, `data:image/png;base64,${qrPng.toString('base64')}`);
}

export async function getDownpaymentHoldForGuest({ user, holdId }) {
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

  if (hold.status !== 'awaiting') return serializeStatus(hold);

  const dueForCredit = simulatedPaymentsEnabled()
    && Date.now() - new Date(hold.created_at).getTime() >= SIMULATED_CREDIT_DELAY_MS;
  if (dueForCredit) {
    await creditHold(client, hold);
  }

  const windowClosed = new Date(hold.expires_at).getTime() <= Date.now();
  if (windowClosed) {
    await releaseHold(client, hold);
    await redis.clear();
  }

  const { data: latest, error: latestError } = await client
    .from('payment_holds')
    .select('*')
    .eq('id', hold.id)
    .single();
  if (latestError) throw new ApiError(500, latestError.message);
  return serializeStatus(latest);
}

const REVIEW_OUTCOMES = new Set(['unknown_reference', 'window_closed', 'wrong_currency', 'amount_mismatch', 'not_credited']);

// Applies one verified provider event. The event id is stored first, so a resent or replayed event
// is recognised and does nothing the second time.
export async function applyProviderPaymentEvent(event, provider) {
  const client = await getSystemAdminClient();
  const { error: insertError } = await client.from('payment_events').insert({
    event_id: event.id,
    provider,
    type: event.type,
    reference: event.data.reference,
    amount_centavos: event.data.amount_centavos,
    outcome: 'received',
  });
  if (insertError) {
    if (insertError.code === '23505') return 'duplicate';
    throw new Error(insertError.message);
  }

  let outcome = 'ignored';
  if (event.type === 'payment.paid') {
    const { data: hold, error } = await client
      .from('payment_holds')
      .select('*')
      .eq('reference', event.data.reference)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const check = checkPaymentAgainstHold(hold, { amountCentavos: event.data.amount_centavos, currency: event.data.currency });
    if (!check.ok) {
      outcome = check.reason;
    } else {
      outcome = (await creditHold(client, hold, provider)) ? 'credited' : 'not_credited';
    }
  }

  const { error: updateError } = await client.from('payment_events').update({ outcome }).eq('event_id', event.id);
  if (updateError) console.warn('[Payments] Could not record the event outcome:', updateError.message);

  if (REVIEW_OUTCOMES.has(outcome)) {
    await notifyStaff({
      type: 'booking',
      title: 'Payment needs review',
      body: `A ${provider} payment for ${event.data.reference} (₱${(event.data.amount_centavos / 100).toLocaleString()}) was not applied: ${outcome.replace(/_/g, ' ')}.`,
    });
  }
  return outcome;
}
