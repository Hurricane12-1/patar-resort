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

export default r;
