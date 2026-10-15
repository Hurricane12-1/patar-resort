import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { admin } from '../lib/supabase.js';
import { authenticate, requireStaffOrAdmin } from '../middleware/auth.js';
import { redis } from '../lib/redis.js';
import { isSupabaseConfigured } from '../config/env.js';

const r = Router();

r.get('/rooms', asyncH(async (req, res) => {
  const cacheKey = `rooms:catalog:${req.query.category || 'all'}:${req.query.q || 'all'}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    return res.json(cached);
  }

  let q = admin.from('rooms').select('*').eq('is_active', true)
    .order('rating_avg', { ascending: false });
  if (req.query.category && req.query.category !== 'All') {
    q = q.ilike('category', req.query.category);
  }
  if (req.query.q) {
    q = q.or(`name.ilike.%${req.query.q}%,description.ilike.%${req.query.q}%`);
  }
  let result = [];
  try {
    const { data, error } = await q;
    if (error) {
      console.warn('[Rooms API] Supabase query notice:', error.message);
    } else {
      result = data || [];
    }
  } catch (err) {
    console.warn('[Rooms API] Query exception:', err.message);
  }

  if (result.length > 0) {
    await redis.set(cacheKey, result, 60);
  }
  res.setHeader('X-Cache', 'MISS');
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  return res.json(result);
}));

r.get('/rooms/:slug', asyncH(async (req, res) => {
  const { data, error } = await admin.from('rooms').select('*')
    .eq('slug', req.params.slug).single();
  if (error || !data) {
    throw new ApiError(404, 'Room not found');
  }
  return res.json(data);
}));

const rangeSchema = z.object({
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.coerce.number().int().min(1).max(12).default(1),
});

r.get('/availability', validate(rangeSchema, 'query'), asyncH(async (req, res) => {
  const { check_in, check_out, guests } = req.query;
  if (check_out <= check_in) throw new ApiError(422, 'Check-out must be after check-in');
  try {
    const { data, error } = await admin.rpc('available_rooms',
      { p_check_in: check_in, p_check_out: check_out, p_guests: guests });
    if (error) throw error;
    return res.json(data || []);
  } catch (rpcErr) {
    console.warn('[Availability] RPC fallback query engaged:', rpcErr?.message);
    const { data: allRooms } = await admin.from('rooms').select('id, name, category, capacity, rate_php, units, rating_avg').eq('is_active', true);
    const list = (allRooms || []).map((r) => ({
      room_id: r.id,
      name: r.name,
      category: r.category,
      capacity: r.capacity,
      rate_php: r.rate_php,
      units_left: r.units || 1,
      rating_avg: r.rating_avg || 0,
    }));
    return res.json(list);
  }
}));

r.post('/rooms', authenticate, requireStaffOrAdmin,
  validate(z.object({
    name: z.string().min(2).max(100),
    slug: z.string().min(2).max(100).optional(),
    category: z.string().default('Cottage'),
    description: z.string().default(''),
    capacity: z.coerce.number().int().min(1).default(2),
    units: z.coerce.number().int().min(1).default(1),
    rate_php: z.coerce.number().int().min(100),
    amenities: z.array(z.string()).default([]),
    is_active: z.boolean().default(true),
  })),
  asyncH(async (req, res) => {
    let slug = req.body.slug;
    if (!slug) {
      slug = req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `room-${Date.now()}`;
    }
    const payload = { ...req.body, slug };
    const { data, error } = await admin.from('rooms').insert(payload).select().single();
    if (error) throw new ApiError(500, error.message);
    await redis.clear();
    return res.status(201).json(data);
  }));

r.patch('/rooms/:id', authenticate, requireStaffOrAdmin,
  validate(z.object({
    name: z.string().min(2).max(100).optional(),
    slug: z.string().min(2).max(100).optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    capacity: z.coerce.number().int().min(1).optional(),
    units: z.coerce.number().int().min(1).optional(),
    rate_php: z.coerce.number().int().min(100).optional(),
    amenities: z.array(z.string()).optional(),
    is_active: z.boolean().optional(),
  })),
  asyncH(async (req, res) => {
    const { data, error } = await admin.from('rooms')
      .update(req.body)
      .eq('id', req.params.id)
      .select().single();
    if (error) throw new ApiError(500, error.message);
    await redis.clear();
    return res.json(data);
  }));

r.delete('/rooms/:id', authenticate, requireStaffOrAdmin, asyncH(async (req, res) => {
  const { data, error } = await admin.from('rooms')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .select().single();
  if (error) throw new ApiError(500, error.message);
  await redis.clear();
  return res.json({ success: true, deactivated: data });
}));

export default r;
