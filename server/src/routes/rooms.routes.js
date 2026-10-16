import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { admin, getSystemAdminClient } from '../lib/supabase.js';
import { authenticate, requireStaffOrAdmin, requireAdmin } from '../middleware/auth.js';
import { redis } from '../lib/redis.js';
import { logAuditEvent } from '../lib/auditLogger.js';

const r = Router();

export function normalizeRoom(room) {
  if (!room) return room;
  const rawAmenities = Array.isArray(room.amenities) ? room.amenities : [];
  const cleanAmenities = [];
  const images = [];

  for (const item of rawAmenities) {
    if (typeof item === 'string' && (item.startsWith('__img__:') || item.startsWith('img:'))) {
      const url = item.replace(/^(__img__|img):/, '').trim();
      if (url && !images.includes(url)) images.push(url);
    } else {
      cleanAmenities.push(item);
    }
  }

  const primaryImage = room.image_url || images[0] || '';
  const allImages = Array.isArray(room.images) && room.images.length > 0
    ? room.images
    : (images.length > 0 ? images : (primaryImage ? [primaryImage] : []));

  return {
    ...room,
    image_url: primaryImage,
    images: allImages,
    amenities: cleanAmenities,
  };
}

export function packRoomPayload(body, existingRoom) {
  const payload = { ...body };
  const hasImagesField = 'images' in body;
  const hasImageUrlField = 'image_url' in body;

  if (hasImagesField || hasImageUrlField) {
    const imagesToStore = [];
    if (body.image_url && typeof body.image_url === 'string') {
      imagesToStore.push(body.image_url.trim());
    }
    if (Array.isArray(body.images)) {
      for (const img of body.images) {
        if (typeof img === 'string' && img.trim() && !imagesToStore.includes(img.trim())) {
          imagesToStore.push(img.trim());
        }
      }
    }

    const imageTags = imagesToStore.map(url => `__img__:${url}`);

    let baseAmenities = [];
    if (Array.isArray(body.amenities)) {
      baseAmenities = body.amenities.filter(a => typeof a === 'string' && !a.startsWith('__img__:') && !a.startsWith('img:'));
    } else if (existingRoom && Array.isArray(existingRoom.amenities)) {
      baseAmenities = existingRoom.amenities.filter(a => typeof a === 'string' && !a.startsWith('__img__:') && !a.startsWith('img:'));
    }

    payload.amenities = [...baseAmenities, ...imageTags];
  } else if (Array.isArray(body.amenities) && existingRoom) {
    const existingImages = (existingRoom.amenities || []).filter(a => typeof a === 'string' && (a.startsWith('__img__:') || a.startsWith('img:')));
    const cleanAmenities = body.amenities.filter(a => typeof a === 'string' && !a.startsWith('__img__:') && !a.startsWith('img:'));
    payload.amenities = [...cleanAmenities, ...existingImages];
  }

  delete payload.image_url;
  delete payload.images;

  return payload;
}

r.get('/rooms', asyncH(async (req, res) => {
  const includeAll = req.query.include_inactive === 'true';
  const cacheKey = `rooms:catalog:${req.query.category || 'all'}:${req.query.q || 'all'}:${includeAll ? 'all' : 'active'}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    return res.json(cached);
  }

  let q = admin.from('rooms').select('*');
  if (!includeAll) {
    q = q.eq('is_active', true);
  }
  q = q.order('rating_avg', { ascending: false });
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
      result = (data || []).map(normalizeRoom);
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
  let room = null;
  try {
    const { data, error } = await admin.from('rooms').select('*')
      .eq('slug', req.params.slug).single();
    if (!error && data) room = normalizeRoom(data);
  } catch (err) {
    console.warn('[Rooms Slug API] Error fetching slug:', err?.message);
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

  // 1. Fetch active rooms strictly from live Supabase database
  let allRooms = [];
  try {
    const { data, error } = await sysClient.from('rooms').select('*').eq('is_active', true);
    if (!error && data && data.length > 0) allRooms = data;
  } catch (err) {
    console.warn('[Availability] Rooms query notice:', err.message);
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

r.post('/rooms', authenticate, requireAdmin,
  validate(z.object({
    name: z.string().min(2).max(100),
    slug: z.string().min(2).max(100).optional(),
    category: z.string().default('Cottage'),
    description: z.string().default(''),
    capacity: z.coerce.number().int().min(1).default(2),
    units: z.coerce.number().int().min(1).default(1),
    rate_php: z.coerce.number().int().min(100),
    amenities: z.array(z.string()).default([]),
    image_url: z.string().optional(),
    images: z.array(z.string()).optional(),
    is_active: z.boolean().default(true),
  })),
  asyncH(async (req, res) => {
    let slug = req.body.slug;
    if (!slug) {
      slug = req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `room-${Date.now()}`;
    }
    const packed = packRoomPayload(req.body, null);
    const payload = { ...packed, slug };
    const client = req.sb || (await getSystemAdminClient());
    const { data, error } = await client.from('rooms').insert(payload).select().single();
    if (error) throw new ApiError(500, error.message);
    await redis.clear();

    const normalized = normalizeRoom(data);

    await logAuditEvent({
      actor: req.user,
      action: 'ROOM_CREATE',
      resourceType: 'room',
      resourceId: data.id,
      details: { name: data.name, rate_php: data.rate_php, units: data.units, category: data.category },
      req,
    });

    return res.status(201).json(normalized);
  }));

r.patch('/rooms/:id', authenticate, requireAdmin,
  validate(z.object({
    name: z.string().min(2).max(100).optional(),
    slug: z.string().min(2).max(100).optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    capacity: z.coerce.number().int().min(1).optional(),
    units: z.coerce.number().int().min(1).optional(),
    rate_php: z.coerce.number().int().min(100).optional(),
    amenities: z.array(z.string()).optional(),
    image_url: z.string().optional(),
    images: z.array(z.string()).optional(),
    is_active: z.boolean().optional(),
  })),
  asyncH(async (req, res) => {
    const client = req.sb || (await getSystemAdminClient());

    let existingRoom = null;
    try {
      const { data } = await client.from('rooms').select('*').eq('id', req.params.id).single();
      existingRoom = data;
    } catch {}

    const payload = packRoomPayload(req.body, existingRoom);

    const { data, error } = await client.from('rooms')
      .update(payload)
      .eq('id', req.params.id)
      .select().single();
    if (error) throw new ApiError(500, error.message);
    await redis.clear();

    const normalized = normalizeRoom(data);

    await logAuditEvent({
      actor: req.user,
      action: 'ROOM_UPDATE',
      resourceType: 'room',
      resourceId: req.params.id,
      details: req.body,
      req,
    });

    return res.json(normalized);
  }));

r.delete('/rooms/:id', authenticate, requireAdmin, asyncH(async (req, res) => {
  const client = req.sb || (await getSystemAdminClient());
  const isHard = req.query.hard === 'true';

  if (isHard) {
    const { error: hardErr } = await client.from('rooms').delete().eq('id', req.params.id);
    if (!hardErr) {
      await redis.clear();
      await logAuditEvent({
        actor: req.user,
        action: 'ROOM_DELETE_PERMANENT',
        resourceType: 'room',
        resourceId: req.params.id,
        details: { permanent: true },
        req,
      });
      return res.json({ success: true, deleted_id: req.params.id, permanent: true });
    }
  }

  const { data, error } = await client.from('rooms')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .select().single();
  if (error) throw new ApiError(500, error.message);
  await redis.clear();

  await logAuditEvent({
    actor: req.user,
    action: 'ROOM_DEACTIVATE',
    resourceType: 'room',
    resourceId: req.params.id,
    details: { is_active: false },
    req,
  });

  return res.json({ success: true, deactivated: data });
}));

export default r;
