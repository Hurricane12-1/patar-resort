import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate, requireAdmin, requireStaffOrAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bookingLimiter } from '../middleware/security.js';
import { admin, getSystemAdminClient } from '../lib/supabase.js';
import { pingSMS } from '../lib/sms.js';
import { redis } from '../lib/redis.js';
import { logAuditEvent } from '../lib/auditLogger.js';
import { sendRefundRequestedEmail, sendRefundConfirmedEmail } from '../lib/mailer.js';

const r = Router();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createSchema = z.object({
  roomId: z.string().optional(),
  room_id: z.string().optional(),
  check_in: dateStr,
  check_out: dateStr,
  guests: z.coerce.number().int().min(1).max(12).default(1),
  notes: z.string().max(500).default(''),
  phone: z.string().max(20).optional(),
  guest_name: z.string().max(200).optional(),
  guestName: z.string().max(200).optional(),
  guest_email: z.string().max(200).optional(),
  total_php: z.coerce.number().optional(),
  downpayment_php: z.coerce.number().optional(),
  payment_method: z.string().max(50).optional(),
  payment_status: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
}).refine((d) => Boolean(d.roomId || d.room_id), { message: 'roomId or room_id is required' })
  .refine((d) => d.check_out > d.check_in, { message: 'Check-out must be after check-in' });

r.post('/reservations', authenticate, bookingLimiter, validate(createSchema), asyncH(async (req, res) => {
  const {
    roomId,
    room_id,
    check_in,
    check_out,
    guests,
    notes,
    phone,
    guest_name,
    guestName,
    guest_email,
    total_php: customTotal,
    downpayment_php: customDownpayment,
    payment_method,
    payment_status,
    status: customStatus,
  } = req.body;
  const targetRoomId = roomId || room_id;

  const today = new Date().toISOString().slice(0, 10);
  if (check_in < today) throw new ApiError(422, 'Check-in cannot be in the past');

  const sysClient = await getSystemAdminClient();

  let room = null;
  try {
    const { data } = await sysClient.from('rooms').select('*').eq('id', targetRoomId).single();
    if (data) room = data;
  } catch {}
  if (!room) throw new ApiError(404, 'Room not found or inactive');

  // Hard overbooking check: count active bookings per night in requested date range
  let activeRes = [];
  try {
    const { data } = await sysClient.from('reservations')
      .select('id, check_in, check_out')
      .eq('room_id', targetRoomId)
      .in('status', ['pending', 'confirmed', 'checked_in'])
      .lt('check_in', check_out)
      .gt('check_out', check_in);
    if (data) activeRes = data;
  } catch {}

  const nightsList = [];
  let cur = new Date(check_in);
  const end = new Date(check_out);
  while (cur < end) {
    nightsList.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }

  let peakOccupied = 0;
  for (const night of nightsList) {
    const count = activeRes.filter((b) => b.check_in <= night && b.check_out > night).length;
    if (count > peakOccupied) peakOccupied = count;
  }

  const roomUnits = Number(room.units) || 1;
  if (peakOccupied >= roomUnits) {
    throw new ApiError(409, 'That room was just booked for those dates — please pick another.');
  }

  const roomName = room.name;
  const roomRate = room.rate_php;
  const nights = Math.max(1, Math.round((new Date(check_out) - new Date(check_in)) / 86400000));
  const calculatedTotal = nights * roomRate;
  const total_php = customTotal && customTotal > 0 ? Number(customTotal) : calculatedTotal;
  const downpayment_php = customDownpayment !== undefined ? Number(customDownpayment) : Math.round(total_php * 0.3);

  const finalGuestName = (guest_name || guestName || req.user.full_name || req.user.name || '').trim();
  const finalGuestEmail = (guest_email || req.user.email || '').trim();
  const finalPhone = (phone || req.user.phone || '').trim();
  const finalPaymentMethod = payment_method || 'GCash';

  if (req.user?.id) {
    const profileUpdates = {};
    if (finalPhone && finalPhone !== req.user.phone) {
      profileUpdates.phone = finalPhone;
    }
    if (finalGuestName && (!req.user.full_name || req.user.full_name === 'Resident Guest') && req.user.role === 'customer') {
      profileUpdates.full_name = finalGuestName;
    }
    if (Object.keys(profileUpdates).length > 0) {
      try {
        await sysClient.from('profiles').update(profileUpdates).eq('id', req.user.id);
      } catch {}
    }
  }

  const client = req.sb || sysClient;
  const insertPayload = {
    guest_id: req.user.id,
    room_id: targetRoomId,
    check_in,
    check_out,
    guests,
    notes,
    total_php,
    downpayment_php,
    payment_method: finalPaymentMethod,
    payment_status: payment_status || 'unpaid',
    status: customStatus || 'confirmed',
    guest_name: finalGuestName,
    guest_email: finalGuestEmail,
    phone: finalPhone,
  };

  const { data: stay, error } = await client.from('reservations')
    .insert(insertPayload)
    .select('*, rooms(name), profiles(full_name, phone, email)').single();
  
  if (error) {
    const raced = ['23P01', '23505'].includes(error.code);
    throw new ApiError(raced ? 409 : 500,
      raced ? 'That room was just booked for those dates — please pick another.' : error.message);
  }

  await redis.clear();

  await logAuditEvent({
    actor: req.user,
    action: 'BOOKING_CREATE',
    resourceType: 'reservation',
    resourceId: stay.id,
    details: { room: stay.rooms?.name || roomName, check_in, check_out, guests, total_php, guest_name: finalGuestName },
    req,
  });

  pingSMS({
    profileId: req.user.id, reservationId: stay.id, toPhone: finalPhone,
    body: `Mabuhay! J & D Beach House ✦ Confirmed: ${stay.rooms?.name || roomName}, ${check_in} → ${check_out} (${nights} night${nights > 1 ? 's' : ''}), ₱${total_php.toLocaleString()}. Check-in 2:00 PM.`,
  }).catch(() => {});

  return res.status(201).json(stay);
}));

r.get('/reservations/mine', authenticate, asyncH(async (req, res) => {
  const { data, error } = await req.sb.from('reservations')
    .select('*, rooms(name, slug, capacity), reviews(id, rating)')
    .order('check_in', { ascending: false });
  if (error) throw new ApiError(500, error.message);
  return res.json(data || []);
}));

r.patch('/reservations/:id/cancel', authenticate, asyncH(async (req, res) => {
  const { data: b } = await req.sb.from('reservations').select('*').eq('id', req.params.id).single();
  if (!b) throw new ApiError(404, 'Reservation not found');
  if (!['pending', 'confirmed'].includes(b.status))
    throw new ApiError(409, 'Only upcoming stays can be cancelled.');
  const { data, error } = await req.sb.from('reservations')
    .update({ status: 'cancelled' }).eq('id', b.id)
    .select('*, rooms(name)').single();
  if (error) throw new ApiError(500, error.message);

  await redis.clear();

  await logAuditEvent({
    actor: req.user,
    action: 'BOOKING_CANCEL',
    resourceType: 'reservation',
    resourceId: b.id,
    details: { reason: 'Guest cancelled reservation' },
    req,
  });

  pingSMS({ profileId: req.user.id, reservationId: b.id, toPhone: req.user.phone,
    body: 'J & D Beach House: your reservation was cancelled. The beach will miss you — rebook anytime.' }).catch(() => {});
  return res.json(data);
}));

// ---- staff & admin ----
r.get('/reservations', authenticate, requireStaffOrAdmin, asyncH(async (req, res) => {
  const sysClient = await getSystemAdminClient();
  const client = req.sb || sysClient;
  const { data, error } = await client.from('reservations')
    .select('*, profiles(full_name, phone, email), rooms(name)')
    .order('check_in', { ascending: false }).limit(200);
  if (error) throw new ApiError(500, error.message);
  return res.json(data || []);
}));

r.patch('/reservations/:id/status', authenticate, requireStaffOrAdmin,
  validate(z.object({ status: z.enum(['pending','confirmed','checked_in','checked_out','cancelled','no_show']) })),
  asyncH(async (req, res) => {
    const { status } = req.body;
    const sysClient = await getSystemAdminClient();
    const client = req.sb || sysClient;
    const { data, error } = await client.from('reservations')
      .update({ status }).eq('id', req.params.id)
      .select('*, profiles(id, phone, full_name, email), rooms(name)').single();
    if (error || !data) throw new ApiError(404, 'Reservation not found');

    await redis.clear();

    await logAuditEvent({
      actor: req.user,
      action: 'BOOKING_STATUS_UPDATE',
      resourceType: 'reservation',
      resourceId: data.id,
      details: { status, guest_name: data.guest_name || data.profiles?.full_name, room: data.rooms?.name },
      req,
    });

    const msg =
      status === 'checked_in'  ? `J & D Beach House: welcome! 🌊 Checked in to ${data.rooms?.name || 'your room'}. Enjoy Bolinao!` :
      status === 'checked_out' ? `J & D Beach House: safe travels ✦ Salamat for staying with us. Rate your stay in My Bookings!` :
      status === 'cancelled'   ? 'J & D Beach House: your reservation was cancelled by our team. Rebook anytime.' : null;
    const toPhone = data.phone || data.profiles?.phone;
    if (msg && toPhone) pingSMS({ profileId: data.guest_id || data.profiles?.id, reservationId: data.id,
      toPhone, body: msg }).catch(() => {});
    return res.json(data);
  }));

// POST /reservations/:id/refund-request
r.post('/reservations/:id/refund-request', authenticate,
  validate(z.object({
    reason: z.string().max(500).optional(),
    amount: z.coerce.number().optional(),
  })),
  asyncH(async (req, res) => {
    const sysClient = await getSystemAdminClient();
    const client = req.sb || sysClient;
    const { data: b, error } = await client.from('reservations')
      .select('*, profiles(id, phone, full_name, email), rooms(name)')
      .eq('id', req.params.id)
      .single();
    if (error || !b) throw new ApiError(404, 'Reservation not found');

    const isOwner = b.guest_id === req.user.id;
    const isStaff = ['administrator', 'staff', 'accounting', 'receptionist'].includes(req.user.role);
    if (!isOwner && !isStaff) {
      throw new ApiError(403, 'Unauthorized to request a refund for this booking');
    }

    const refundReason = req.body.reason || 'Guest requested refund for booking';
    const refundAmount = req.body.amount || b.downpayment_php || b.total_php || 0;
    const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const updatedNotes = `${b.notes || ''}\n[Refund Requested ${todayStr}]: ${refundReason} (₱${refundAmount})`.trim();

    const { data: updated, error: updateErr } = await sysClient.from('reservations')
      .update({
        payment_status: 'refund_pending',
        notes: updatedNotes,
      })
      .eq('id', b.id)
      .select('*, profiles(id, phone, full_name, email), rooms(name)')
      .single();

    if (updateErr) throw new ApiError(500, updateErr.message);

    await redis.clear();

    const targetEmail = b.guest_email || b.profiles?.email || req.user.email;
    const guestName = b.guest_name || b.profiles?.full_name || req.user.full_name || 'Valued Guest';
    const roomName = b.rooms?.name || 'Patar Beach Suite';

    if (targetEmail) {
      sendRefundRequestedEmail({
        to: targetEmail,
        name: guestName,
        reservationId: b.id,
        roomName,
        checkIn: b.check_in,
        checkOut: b.check_out,
        amount: refundAmount,
        reason: refundReason,
        dateRequested: todayStr,
      }).catch((e) => console.warn('[Refund Request Mail Warning]', e.message));
    }

    await sysClient.from('notifications').insert([
      {
        profile_id: b.guest_id || req.user.id,
        title: 'Refund Request In Process',
        body: `Your refund request for ${roomName} (₱${refundAmount.toLocaleString()}) has been received and is being processed.`,
        type: 'sms',
        recipient: guestName,
        status: 'sent',
      },
      {
        title: 'Guest Refund Requested',
        body: `Guest ${guestName} requested refund of ₱${refundAmount.toLocaleString()} for ${roomName} (#${b.id.slice(0, 8)}).`,
        type: 'sms',
        recipient: 'Accounting Desk',
        status: 'sent',
      }
    ]).catch(() => {});

    await logAuditEvent({
      actor: req.user,
      action: 'REFUND_REQUESTED',
      resourceType: 'reservation',
      resourceId: b.id,
      details: { amount: refundAmount, reason: refundReason, guest_name: guestName, room: roomName },
      req,
    });

    return res.json({ success: true, message: 'Refund request submitted and processing notification dispatched.', reservation: updated });
  })
);

// POST /reservations/:id/refund-confirm
r.post('/reservations/:id/refund-confirm', authenticate, requireStaffOrAdmin,
  validate(z.object({
    amount: z.coerce.number().optional(),
    refund_method: z.string().optional(),
    reference_number: z.string().optional(),
    cancel_booking: z.boolean().default(true),
  })),
  asyncH(async (req, res) => {
    const sysClient = await getSystemAdminClient();
    const { data: b, error } = await sysClient.from('reservations')
      .select('*, profiles(id, phone, full_name, email), rooms(name)')
      .eq('id', req.params.id)
      .single();
    if (error || !b) throw new ApiError(404, 'Reservation not found');

    const refundAmount = req.body.amount || b.downpayment_php || b.total_php || 0;
    const refundMethod = req.body.refund_method || b.payment_method || 'GCash / Electronic Transfer';
    const refNum = req.body.reference_number || `REF-${Date.now().toString().slice(-6)}`;
    const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const updatedNotes = `${b.notes || ''}\n[Refund Confirmed ${todayStr}]: ₱${refundAmount} via ${refundMethod} (Ref: ${refNum})`.trim();

    const updatePayload = {
      payment_status: 'refunded',
      notes: updatedNotes,
    };
    if (req.body.cancel_booking) {
      updatePayload.status = 'cancelled';
    }

    const { data: updated, error: updateErr } = await sysClient.from('reservations')
      .update(updatePayload)
      .eq('id', b.id)
      .select('*, profiles(id, phone, full_name, email), rooms(name)')
      .single();

    if (updateErr) throw new ApiError(500, updateErr.message);

    await redis.clear();

    const targetEmail = b.guest_email || b.profiles?.email;
    const guestName = b.guest_name || b.profiles?.full_name || 'Valued Guest';
    const roomName = b.rooms?.name || 'Patar Beach Suite';

    if (targetEmail) {
      sendRefundConfirmedEmail({
        to: targetEmail,
        name: guestName,
        reservationId: b.id,
        roomName,
        amount: refundAmount,
        refundMethod,
        referenceNumber: refNum,
        dateProcessed: todayStr,
      }).catch((e) => console.warn('[Refund Confirmed Mail Warning]', e.message));
    }

    const toPhone = b.phone || b.profiles?.phone;
    if (toPhone) {
      pingSMS({
        profileId: b.guest_id || b.profiles?.id,
        reservationId: b.id,
        toPhone,
        body: `J & D Beach House: Your refund of ₱${refundAmount.toLocaleString()} for ${roomName} has been processed via ${refundMethod}. Ref: ${refNum}. Salamat!`,
      }).catch(() => {});
    }

    await sysClient.from('notifications').insert({
      profile_id: b.guest_id || null,
      title: 'Refund Approved & Processed',
      body: `Refund of ₱${refundAmount.toLocaleString()} has been sent to your account via ${refundMethod}. Ref: ${refNum}.`,
      type: 'sms',
      recipient: guestName,
      status: 'sent',
    }).catch(() => {});

    await logAuditEvent({
      actor: req.user,
      action: 'REFUND_CONFIRMED',
      resourceType: 'reservation',
      resourceId: b.id,
      details: { amount: refundAmount, method: refundMethod, ref: refNum, guest_name: guestName },
      req,
    });

    return res.json({ success: true, message: 'Refund confirmed and confirmation email dispatched to guest.', reservation: updated });
  })
);

export default r;
