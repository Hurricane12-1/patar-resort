import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { admin } from '../lib/supabase.js';

const r = Router();

r.get('/reviews/recent', asyncH(async (_req, res) => {
  const { data, error } = await admin.from('reviews')
    .select('id, rating, comment, created_at, rooms(name), profiles(full_name)')
    .order('created_at', { ascending: false }).limit(9);
  if (error) {
    throw new ApiError(500, error.message);
  }
  return res.json(data || []);
}));

r.post('/reviews', authenticate,
  validate(z.object({
    reservationId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(600).default(''),
  })),
  asyncH(async (req, res) => {
    const { reservationId, rating, comment } = req.body;
    const { data: b } = await req.sb.from('reservations').select('*')
      .eq('id', reservationId).single();
    if (!b) throw new ApiError(404, 'Reservation not found');
    if (b.status !== 'checked_out')
      throw new ApiError(409, 'You can review after you check out.');
    const { data, error } = await req.sb.from('reviews')
      .insert({ reservation_id: reservationId, guest_id: req.user.id,
                room_id: b.room_id, rating, comment })
      .select().single();
    if (error) throw new ApiError(error.code === '23505' ? 409 : 500,
      error.code === '23505' ? 'You already reviewed this stay.' : error.message);
    return res.status(201).json(data);
  }));

export default r;
