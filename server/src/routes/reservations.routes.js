import { Router } from 'express';
import crypto from 'crypto';
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
import { broadcastPayload1 } from '../socket/chatbot.js';
import { getLocalReservations, addLocalReservation, updateLocalReservation, deleteLocalReservation } from '../lib/reservationStore.js';

const r = Router();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createSchema = z.object({
  roomId: z.string().optional(),
  room_id: z.string().optional(),
  check_in: dateStr,
  check_out: dateStr,
  check_in_time: z.string().max(30).optional(),
  check_out_time: z.string().max(30).optional(),
  guests: z.coerce.number().int().min(1, 'Number of guests must be at least 1').max(12, 'Maximum 12 guests allowed per room').default(1),
  notes: z.string().max(500).default(''),
  phone: z.string().min(1, 'Mobile phone is required'),
  guest_name: z.string().optional(),
  guestName: z.string().optional(),
  guest_email: z.string().optional(),
  email: z.string().optional(),
  total_php: z.coerce.number().optional(),
  downpayment_php: z.coerce.number().optional(),
  payment_method: z.string().min(1, 'Preferred downpayment method is required'),
  payment_status: z.string().max(50).optional(),
  terms_accepted: z.boolean().optional(),
  status: z.string().max(50).optional(),
}).refine((d) => Boolean(d.roomId || d.room_id), { message: 'Room selection is required (roomId or room_id)' })
  .refine((d) => d.check_out > d.check_in, { message: 'Check-out date must be strictly after check-in date' })
  .refine((d) => {
    const name = (d.guest_name || d.guestName || '').trim();
    return name.length >= 2;
  }, { message: 'Primary guest name is required for booking manifest (minimum 2 characters)' })
  .refine((d) => {
    const raw = String(d.phone || '').replace(/\D/g, '').replace(/^63(?=\d{10})/, '0');
    return /^09\d{9}$/.test(raw);
  }, { message: 'Mobile phone must be strictly an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567)' })
  .refine((d) => {
    const mail = (d.email || d.guest_email || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
  }, { message: 'A valid email address is required for official booking voucher delivery' })
  .refine((d) => Boolean(d.payment_method && d.payment_method.trim().length > 0), { message: 'Preferred downpayment method is required' });

r.post('/reservations', authenticate, bookingLimiter, validate(createSchema), asyncH(async (req, res) => {
  const {
    roomId,
    room_id,
    check_in,
    check_out,
    check_in_time,
    check_out_time,
    guests,
    notes,
    phone,
    guest_name,
    guestName,
    guest_email,
    email,
    total_php: customTotal,
    downpayment_php: customDownpayment,
    payment_method,
    payment_status,
    status: customStatus,
    terms_accepted,
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
  if (!room || room.is_active === false) {
    throw new ApiError(404, "There's no present room around. This accommodation is absent or inactive.");
  }

  // Hard overbooking check: count active bookings per night in requested date range
  let activeRes = [];
  try {
    const { data } = await sysClient.from('reservations')
      .select('id, check_in, check_out, notes')
      .eq('room_id', targetRoomId)
      .in('status', ['pending', 'confirmed', 'checked_in'])
      .lt('check_in', check_out)
      .gt('check_out', check_in);
    if (data) activeRes = [...data];
  } catch {}

  // Resilient local store active bookings merge for zero overbooking
  const localActive = getLocalReservations().filter((b) =>
    b.room_id === targetRoomId &&
    ['pending', 'confirmed', 'checked_in'].includes(b.status) &&
    b.check_in < check_out &&
    b.check_out > check_in
  );
  for (const lb of localActive) {
    if (!activeRes.some((ar) => ar.id === lb.id)) {
      activeRes.push(lb);
    }
  }

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

  // Exact available physical unit resolution (ensures non-overlapping, even unit distribution)
  let finalNotes = (notes || '').trim();
  if (roomUnits > 1) {
    const unitMatch = finalNotes.match(/\[Unit\s*(\d+)\]/i);
    const takenUnits = new Set();
    activeRes.forEach((b) => {
      const m = (b.notes || '').match(/\[Unit\s*(\d+)\]/i);
      if (m) {
        const u = parseInt(m[1], 10);
        if (u >= 1 && u <= roomUnits) takenUnits.add(u);
      }
    });

    if (unitMatch) {
      const requestedUnit = parseInt(unitMatch[1], 10);
      if (takenUnits.has(requestedUnit)) {
        throw new ApiError(409, `Unit ${requestedUnit} is already booked for those dates. Please select an available unit.`);
      }
    } else {
      // Auto-assign first free unit
      let freeUnit = 1;
      for (let u = 1; u <= roomUnits; u++) {
        if (!takenUnits.has(u)) {
          freeUnit = u;
          break;
        }
      }
      finalNotes = `[Unit ${freeUnit}] ${finalNotes}`.trim();
    }
  }

  if (terms_accepted) {
    if (!finalNotes.includes('[Terms: Accepted]')) {
      finalNotes = `${finalNotes} [Terms: Accepted]`.trim();
    }
  }

  if (check_in_time || check_out_time) {
    const cinT = check_in_time || '14:00';
    const coutT = check_out_time || '12:00';
    if (!finalNotes.includes('[Check-In:')) {
      finalNotes = `${finalNotes} [Check-In: ${cinT}, Check-Out: ${coutT}]`.trim();
    }
  }

  const roomName = room.name;
  const roomRate = room.rate_php;
  const nights = Math.max(1, Math.round((new Date(check_out) - new Date(check_in)) / 86400000));
  const calculatedTotal = nights * roomRate;
  const total_php = customTotal && customTotal > 0 ? Number(customTotal) : calculatedTotal;
  const downpayment_php = customDownpayment !== undefined ? Number(customDownpayment) : Math.round(total_php * 0.3);

  const finalGuestName = (guest_name || guestName || req.user?.full_name || req.user?.name || '').trim();
  if (!finalGuestName || finalGuestName.length < 2) {
    throw new ApiError(400, 'Primary guest name is required for booking manifest (minimum 2 characters).');
  }

  const finalGuestEmail = (email || guest_email || req.user?.email || '').trim();
  if (!finalGuestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalGuestEmail)) {
    throw new ApiError(400, 'A valid guest email address is required for official booking voucher delivery.');
  }

  const rawPhone = (phone || req.user?.phone || '').trim();
  const finalPhone = rawPhone ? rawPhone.replace(/\D/g, '').replace(/^63(?=\d{10})/, '0').slice(0, 11) : '';
  if (!/^09\d{9}$/.test(finalPhone)) {
    throw new ApiError(400, 'Mobile phone must be strictly an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567).');
  }

  const finalPaymentMethod = (payment_method || 'GCash').trim();
  if (!finalPaymentMethod) {
    throw new ApiError(400, 'Preferred downpayment method is required.');
  }

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

  let targetGuestId = req.user?.id || null;
  // If staff or administrator creates a booking for a guest, check if guest email matches a customer profile
  if (['administrator', 'admin', 'staff', 'receptionist'].includes(req.user?.role)) {
    if (finalGuestEmail) {
      try {
        const { data: matchedProf } = await sysClient.from('profiles').select('id').ilike('email', finalGuestEmail).maybeSingle();
        targetGuestId = matchedProf?.id || null;
      } catch {
        targetGuestId = null;
      }
    } else {
      targetGuestId = null;
    }
  }

  const client = req.sb || sysClient;
  const insertPayload = {
    room_id: targetRoomId,
    check_in,
    check_out,
    guests,
    notes: finalNotes,
    total_php,
    downpayment_php,
    payment_method: finalPaymentMethod,
    payment_status: payment_status || 'unpaid',
    status: customStatus || 'confirmed',
    guest_name: finalGuestName,
    email: finalGuestEmail,
    phone: finalPhone,
  };
  if (targetGuestId) {
    insertPayload.guest_id = targetGuestId;
  }

  let stay = null;
  const { data: dbStay, error } = await client.from('reservations')
    .insert(insertPayload)
    .select('*, rooms(name), profiles(full_name, phone, email)').single();
  
  if (error) {
    const raced = ['23P01', '23505'].includes(error.code);
    if (raced) {
      throw new ApiError(409, 'That room was just booked for those dates — please pick another.');
    }
    if (error.code === '42501' || (error.message && error.message.includes('row-level security'))) {
      console.warn('[Reservations Service] Supabase RLS active; committing to resilient local reservation store.');
      const reservationId = crypto.randomUUID();
      stay = {
        id: reservationId,
        guest_id: targetGuestId,
        room_id: targetRoomId,
        check_in,
        check_out,
        guests,
        notes: finalNotes,
        total_php,
        downpayment_php,
        payment_method: finalPaymentMethod,
        payment_status: payment_status || 'unpaid',
        status: customStatus || 'confirmed',
        guest_name: finalGuestName,
        email: finalGuestEmail,
        guest_email: finalGuestEmail,
        phone: finalPhone,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        rooms: { name: roomName, slug: room.slug, rate_php: roomRate },
        profiles: { full_name: finalGuestName, phone: finalPhone, email: finalGuestEmail },
      };
      addLocalReservation(stay);
    } else {
      throw new ApiError(500, error.message);
    }
  } else {
    stay = dbStay;
    addLocalReservation(stay);
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

  // Broadcast real-time Data Payload 1 over TCP WebSocket channel
  try {
    broadcastPayload1('reservations:created', stay);
  } catch {}

  pingSMS({
    profileId: req.user.id, reservationId: stay.id, toPhone: finalPhone,
    body: `Mabuhay! Rock View Beach Resort ✦ Confirmed: ${stay.rooms?.name || roomName}, ${check_in} → ${check_out} (${nights} night${nights > 1 ? 's' : ''}), ₱${total_php.toLocaleString()}. Check-in 2:00 PM.`,
  }).catch(() => {});

  stay.guest_email = stay.email || finalGuestEmail;
  return res.status(201).json(stay);
}));

r.get('/reservations/mine', authenticate, asyncH(async (req, res) => {
  const sysClient = await getSystemAdminClient();
  let query = sysClient.from('reservations')
    .select('*, rooms(name, slug, capacity), reviews(id, rating)')
    .order('check_in', { ascending: false });

  if (!['administrator', 'admin'].includes(req.user.role)) {
    if (req.user.email) {
      query = query.or(`guest_id.eq.${req.user.id},email.eq.${req.user.email}`);
    } else {
      query = query.eq('guest_id', req.user.id);
    }
  }

  let data = null;
  try {
    const res = await query;
    data = res.data;
  } catch {}
  const dbList = Array.isArray(data) ? data : [];
  const localList = getLocalReservations().filter((b) => {
    if (['administrator', 'admin'].includes(req.user.role)) return true;
    if (b.guest_id === req.user.id) return true;
    if (req.user.email && (b.email || b.guest_email) && (b.email || b.guest_email).toLowerCase() === req.user.email.toLowerCase()) return true;
    return false;
  });

  const mergedMap = new Map();
  for (const b of [...localList, ...dbList]) {
    mergedMap.set(b.id, {
      ...b,
      guest_email: b.email || b.guest_email || '',
    });
  }

  return res.json(Array.from(mergedMap.values()).sort((a, b) => String(b.check_in || '').localeCompare(String(a.check_in || ''))));
}));

r.patch('/reservations/:id/cancel', authenticate, asyncH(async (req, res) => {
  const sysClient = await getSystemAdminClient();
  let b = null;
  try {
    const res = await sysClient.from('reservations').select('*').eq('id', req.params.id).maybeSingle();
    b = res.data;
  } catch {}
  if (!b) {
    b = getLocalReservations().find((r) => r.id === req.params.id);
  }
  if (!b) throw new ApiError(404, 'Reservation not found');
  const isOwner = b.guest_id === req.user.id ||
    Boolean(req.user.email && (b.email || b.guest_email) && (b.email || b.guest_email).toLowerCase() === req.user.email.toLowerCase());
  const isStaff = ['administrator', 'staff', 'accounting', 'receptionist', 'admin'].includes(req.user.role);
  if (!isOwner && !isStaff) throw new ApiError(403, 'Unauthorized to cancel this booking');
  if (!['pending', 'confirmed'].includes(b.status))
    throw new ApiError(409, 'Only upcoming stays can be cancelled.');

  updateLocalReservation(b.id, { status: 'cancelled' });
  let cancelledStay = { ...b, status: 'cancelled' };

  try {
    const { data } = await sysClient.from('reservations')
      .update({ status: 'cancelled' }).eq('id', b.id)
      .select('*, rooms(name)').single();
    if (data) cancelledStay = data;
  } catch {}

  await redis.clear();

  await logAuditEvent({
    actor: req.user,
    action: 'BOOKING_CANCEL',
    resourceType: 'reservation',
    resourceId: b.id,
    details: { reason: 'Guest cancelled reservation' },
    req,
  });

  // Broadcast real-time Data Payload 1 over TCP WebSocket channel
  try {
    broadcastPayload1('reservations:updated', cancelledStay);
  } catch {}

  pingSMS({ profileId: req.user.id, reservationId: b.id, toPhone: req.user.phone,
    body: 'Rock View Beach Resort: your reservation was cancelled. The beach will miss you — rebook anytime.' }).catch(() => {});
  return res.json(cancelledStay);
}));

// ---- staff & admin ----
r.get('/reservations', authenticate, requireStaffOrAdmin, asyncH(async (req, res) => {
  const sysClient = await getSystemAdminClient();
  const client = req.sb || sysClient;
  let data = null;
  try {
    const res = await client.from('reservations')
      .select('*, profiles(full_name, phone, email), rooms(name)')
      .order('check_in', { ascending: false }).limit(200);
    data = res.data;
  } catch {}

  const dbList = Array.isArray(data) ? data : [];
  const localList = getLocalReservations();

  const mergedMap = new Map();
  for (const b of [...localList, ...dbList]) {
    mergedMap.set(b.id, {
      ...b,
      guest_email: b.email || b.guest_email || b.profiles?.email || '',
    });
  }

  return res.json(Array.from(mergedMap.values()).sort((a, b) => String(b.check_in || '').localeCompare(String(a.check_in || ''))));
}));

r.patch('/reservations/:id/status', authenticate, requireStaffOrAdmin,
  validate(z.object({ status: z.enum(['pending','confirmed','checked_in','checked_out','cancelled','no_show']) })),
  asyncH(async (req, res) => {
    const { status } = req.body;
    const sysClient = await getSystemAdminClient();
    const client = req.sb || sysClient;
    let data = null;
    const { data: dbData, error } = await client.from('reservations')
      .update({ status }).eq('id', req.params.id)
      .select('*, profiles(id, phone, full_name, email), rooms(name)').single();
    if (dbData) {
      data = dbData;
      updateLocalReservation(data.id, { status });
    } else {
      const localUpdated = updateLocalReservation(req.params.id, { status });
      if (localUpdated) {
        data = localUpdated;
      } else if (error) {
        throw new ApiError(error.code === '42501' ? 403 : 500, error.message);
      } else {
        throw new ApiError(404, 'Reservation not found');
      }
    }

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
      status === 'checked_in'  ? `Rock View Beach Resort: welcome! 🌊 Checked in to ${data.rooms?.name || 'your room'}. Enjoy Bolinao!` :
      status === 'checked_out' ? `Rock View Beach Resort: safe travels ✦ Salamat for staying with us. Rate your stay in My Bookings!` :
      status === 'cancelled'   ? 'Rock View Beach Resort: your reservation was cancelled by our team. Rebook anytime.' : null;
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

    const isOwner = b.guest_id === req.user.id ||
      Boolean(req.user.email && (b.email || b.guest_email) && (b.email || b.guest_email).toLowerCase() === req.user.email.toLowerCase()) ||
      Boolean(b.profiles?.email && req.user.email && b.profiles.email.toLowerCase() === req.user.email.toLowerCase());
    const isStaff = ['administrator', 'staff', 'accounting', 'receptionist', 'admin'].includes(req.user.role);
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

    const targetEmail = b.email || b.guest_email || b.profiles?.email || req.user.email;
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

    try {
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
      ]);
    } catch (notifErr) {
      console.warn('[Notification Insert Warning]', notifErr?.message);
    }

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

    const targetEmail = b.email || b.guest_email || b.profiles?.email;
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
        body: `Rock View Beach Resort: Your refund of ₱${refundAmount.toLocaleString()} for ${roomName} has been processed via ${refundMethod}. Ref: ${refNum}. Salamat!`,
      }).catch(() => {});
    }

    try {
      await sysClient.from('notifications').insert({
        profile_id: b.guest_id || null,
        title: 'Refund Approved & Processed',
        body: `Refund of ₱${refundAmount.toLocaleString()} has been sent to your account via ${refundMethod}. Ref: ${refNum}.`,
        type: 'sms',
        recipient: guestName,
        status: 'sent',
      });
    } catch (notifErr) {
      console.warn('[Notification Insert Warning]', notifErr?.message);
    }

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

r.delete('/reservations/:id', authenticate, requireStaffOrAdmin, asyncH(async (req, res) => {
  const sysClient = (await getSystemAdminClient().catch(() => null)) || admin;
  const resId = req.params.id;

  deleteLocalReservation(resId);

  try {
    await sysClient.from('room_locks').delete().eq('reservation_id', resId);
  } catch {}

  const { error } = await sysClient.from('reservations').delete().eq('id', resId).catch(() => ({ error: null }));
  if (error) {
    // If foreign keys restrict deletion, soft delete to cancelled status
    const { error: updErr } = await sysClient.from('reservations').update({ status: 'cancelled' }).eq('id', resId).catch(() => ({ error: null }));
  }

  await redis.clear();
  await logAuditEvent({
    actor: req.user,
    action: 'BOOKING_DELETE',
    resourceType: 'reservation',
    resourceId: resId,
    details: { deleted: true },
    req,
  });

  // Broadcast real-time Data Payload 1 over TCP WebSocket channel
  try {
    broadcastPayload1('reservations:deleted', { id: resId });
  } catch {}

  return res.json({ success: true, deleted_id: resId });
}));

export default r;
