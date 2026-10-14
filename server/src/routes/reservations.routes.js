import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate, requireAdmin, requireStaffOrAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bookingLimiter } from '../middleware/security.js';
import { admin } from '../lib/supabase.js';
import { pingSMS } from '../lib/sms.js';

const r = Router();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createSchema = z.object({
  roomId: z.string().uuid(),
  check_in: dateStr,
  check_out: dateStr,
  guests: z.number().int().min(1).max(12),
  notes: z.string().max(500).default(''),
  phone: z.string().max(20).optional(),
}).refine((d) => d.check_out > d.check_in, { message: 'Check-out must be after check-in' });

r.post('/reservations', authenticate, bookingLimiter, validate(createSchema), asyncH(async (req, res) => {
  const { roomId, check_in, check_out, guests, notes, phone } = req.body;

  const today = new Date().toISOString().slice(0, 10);
  if (check_in < today) throw new ApiError(422, 'Check-in cannot be in the past');

  const { data: room, error: roomError } = await admin.from('rooms').select('*')
    .eq('id', roomId).eq('is_active', true).single();
  
  if (roomError || !room) throw new ApiError(404, 'Room not found or inactive');

  const roomName = room.name;
  const roomRate = room.rate_php;
  const nights = Math.max(1, Math.round((new Date(check_out) - new Date(check_in)) / 86400000));
  const total_php = nights * roomRate;

  const finalPhone = phone || req.user.phone;
  if (phone && phone !== req.user.phone)
    await admin.from('profiles').update({ phone }).eq('id', req.user.id);

  const { data: stay, error } = await req.sb.from('reservations')
    .insert({ guest_id: req.user.id, room_id: roomId, check_in, check_out,
              guests, notes, total_php, status: 'confirmed' })
    .select('*, rooms(name)').single();
  
  if (error) {
    const raced = ['23P01', '23505'].includes(error.code);
    throw new ApiError(raced ? 409 : 500,
      raced ? 'That room was just booked for those dates — please pick another.' : error.message);
  }

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
  pingSMS({ profileId: req.user.id, reservationId: b.id, toPhone: req.user.phone,
    body: 'J & D Beach House: your reservation was cancelled. The beach will miss you — rebook anytime.' }).catch(() => {});
  return res.json(data);
}));

// ---- staff & admin ----
r.get('/reservations', authenticate, requireStaffOrAdmin, asyncH(async (_req, res) => {
  const { data, error } = await admin.from('reservations')
    .select('*, profiles(full_name, phone), rooms(name)')
    .order('check_in', { ascending: false }).limit(100);
  if (error) throw new ApiError(500, error.message);
  return res.json(data || []);
}));

r.patch('/reservations/:id/status', authenticate, requireStaffOrAdmin,
  validate(z.object({ status: z.enum(['pending','confirmed','checked_in','checked_out','cancelled','no_show']) })),
  asyncH(async (req, res) => {
    const { status } = req.body;
    const { data, error } = await admin.from('reservations')
      .update({ status }).eq('id', req.params.id)
      .select('*, profiles(id, phone, full_name), rooms(name)').single();
    if (error || !data) throw new ApiError(404, 'Reservation not found');
    const msg =
      status === 'checked_in'  ? `J & D Beach House: welcome! 🌊 Checked in to ${data.rooms?.name || 'your room'}. Enjoy Bolinao!` :
      status === 'checked_out' ? `J & D Beach House: safe travels ✦ Salamat for staying with us. Rate your stay in My Bookings!` :
      status === 'cancelled'   ? 'J & D Beach House: your reservation was cancelled by our team. Rebook anytime.' : null;
    if (msg && data.profiles) pingSMS({ profileId: data.profiles.id, reservationId: data.id,
      toPhone: data.profiles.phone, body: msg }).catch(() => {});
    return res.json(data);
  }));

export default r;
