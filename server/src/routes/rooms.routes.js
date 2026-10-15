import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { admin, getSystemAdminClient } from '../lib/supabase.js';
import { authenticate, requireStaffOrAdmin } from '../middleware/auth.js';
import { redis } from '../lib/redis.js';
import { isSupabaseConfigured } from '../config/env.js';
import { CANONICAL_ROOMS } from '../lib/canonicalRooms.js';

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

  if (result.length === 0) {
    result = [...CANONICAL_ROOMS];
    if (req.query.category && req.query.category !== 'All') {
      result = result.filter(r => r.category.toLowerCase() === req.query.category.toLowerCase());
    }
    if (req.query.q) {
      const qLower = req.query.q.toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(qLower) || r.description.toLowerCase().includes(qLower));
    }
  }

  if (result.length > 0) {
    await redis.set(cacheKey, result, 60);
  }
  res.setHeader('X-Cache', 'MISS');
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  return res.json(result);
}));

r.get('/rooms/:slug', asyncH(async (req, res) => {
  let room = null;
  try {
    const { data, error } = await admin.from('rooms').select('*')
      .eq('slug', req.params.slug).single();
    if (!error && data) room = data;
  } catch (err) {
    console.warn('[Rooms Slug API] Error fetching slug:', err?.message);
  }
  if (!room) {
    room = CANONICAL_ROOMS.find(r => r.slug === req.params.slug || r.id === req.params.slug);
  }
  if (!room) {
    throw new ApiError(404, 'Room not found');
  }
  return res.json(room);
}));

const rangeSchema = z.object({
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.coerce.number().int().min(1).max(12).default(1),
});

r.get('/availability', validate(rangeSchema, 'query'), asyncH(async (req, res) => {
  const { check_in, check_out, guests } = req.query;
  if (check_out <= check_in) throw new ApiError(422, 'Check-out must be after check-in');

  const cacheKey = `avail:${check_in}:${check_out}:${guests}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  const sysClient = await getSystemAdminClient();

  // 1. Fetch active rooms from database or fallback catalog
  let allRooms = [];
  try {
    const { data, error } = await sysClient.from('rooms').select('*').eq('is_active', true);
    if (!error && data && data.length > 0) allRooms = data;
  } catch (err) {
    console.warn('[Availability] Rooms query notice:', err.message);
  }
  if (allRooms.length === 0) {
    allRooms = CANONICAL_ROOMS.filter(r => r.is_active);
  }

  // 2. Query overlapping reservations in database: [check_in, check_out)
  let overlappingRes = [];
  try {
    const { data } = await sysClient.from('reservations')
      .select('room_id, check_in, check_out, status')
      .in('status', ['pending', 'confirmed', 'checked_in'])
      .lt('check_in', check_out)
      .gt('check_out', check_in);
    if (data) overlappingRes = data;
  } catch (err) {
    console.warn('[Availability] Overlapping reservations notice:', err.message);
  }

  // 3. Generate date sequence for each night: [check_in, check_out)
  const nights = [];
  let cur = new Date(check_in);
  const end = new Date(check_out);
  while (cur < end) {
    nights.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }

  // 4. Calculate peak occupancy per room across the stay duration
  const list = allRooms
    .filter((r) => r.capacity >= guests)
    .map((r) => {
      const roomBookings = overlappingRes.filter((b) => b.room_id === r.id);
      let peakBusy = 0;
      for (const night of nights) {
        const busyTonight = roomBookings.filter((b) => b.check_in <= night && b.check_out > night).length;
        if (busyTonight > peakBusy) peakBusy = busyTonight;
      }
      const totalUnits = Number(r.units) || 1;
      const unitsLeft = Math.max(0, totalUnits - peakBusy);
      return {
        room_id: r.id,
        name: r.name,
        category: r.category,
        capacity: r.capacity,
        rate_php: r.rate_php,
        units_left: unitsLeft,
        rating_avg: Number(r.rating_avg) || 0,
      };
    })
    .sort((a, b) => a.rate_php - b.rate_php);

  await redis.set(cacheKey, list, 30);
  res.setHeader('X-Cache', 'MISS');
  res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
  return res.json(list);
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
    const client = req.sb || admin;
    const { data, error } = await client.from('rooms').insert(payload).select().single();
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
    const client = req.sb || admin;
    const { data, error } = await client.from('rooms')
      .update(req.body)
      .eq('id', req.params.id)
      .select().single();
    if (error) throw new ApiError(500, error.message);
    await redis.clear();
    return res.json(data);
  }));

r.delete('/rooms/:id', authenticate, requireStaffOrAdmin, asyncH(async (req, res) => {
  const client = req.sb || admin;
  const { data, error } = await client.from('rooms')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .select().single();
  if (error) throw new ApiError(500, error.message);
  await redis.clear();
  return res.json({ success: true, deactivated: data });
}));

export default r;
