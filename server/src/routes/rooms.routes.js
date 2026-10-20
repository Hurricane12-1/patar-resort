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
      let url = item.replace(/^(__img__|img):/, '').trim();
      if (url.includes('/uploads/')) {
        url = 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209701/jd_beach_house_accommodations/uploads/img_9146060b-5718-452f-a663-e04f109c8ab5_1792173695555.jpg';
      }
      if (url && !images.includes(url)) images.push(url);
    } else {
      cleanAmenities.push(item);
    }
  }

  // Guaranteed resort fallback image based on room category / slug
  let fallbackImage = 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209696/jd_beach_house_accommodations/cottage.jpg';
  const cat = String(room.category || '').toLowerCase();
  const slug = String(room.slug || '').toLowerCase();
  if (cat.includes('villa') || slug.includes('villa')) fallbackImage = 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209697/jd_beach_house_accommodations/villa.jpg';
  else if (cat.includes('suite') || slug.includes('suite') || slug.includes('gel')) fallbackImage = 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209695/jd_beach_house_accommodations/suite.jpg';
  else if (cat.includes('garden') || slug.includes('garden')) fallbackImage = 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209698/jd_beach_house_accommodations/garden.jpg';
  else if (cat.includes('dorm') || cat.includes('bunk') || slug.includes('dorm')) fallbackImage = 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209699/jd_beach_house_accommodations/bunk.jpg';
  else fallbackImage = 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209696/jd_beach_house_accommodations/cottage.jpg';

  const rawImg = (room.image_url && String(room.image_url).trim()) || '';
  const cleanImg = rawImg.includes('/uploads/') ? 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209701/jd_beach_house_accommodations/uploads/img_9146060b-5718-452f-a663-e04f109c8ab5_1792173695555.jpg' : rawImg;
  const primaryImage = cleanImg || images[0] || fallbackImage;
  const allImages = Array.isArray(room.images) && room.images.length > 0
    ? room.images
    : (images.length > 0 ? images : [primaryImage]);

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
      const normalized = (data || []).map(normalizeRoom);

      // Query active reservations occupying rooms today until checkout
      const today = new Date().toISOString().slice(0, 10);
      let activeBookings = [];
      try {
        const { data: resData } = await admin.from('reservations')
          .select('id, room_id, check_in, check_out, status')
          .in('status', ['pending', 'confirmed', 'checked_in'])
          .lte('check_in', today)
          .gt('check_out', today);
        if (Array.isArray(resData)) activeBookings = resData;
      } catch {}

      result = normalized.map((r) => {
        const occupied = activeBookings.filter((b) => b.room_id === r.id).length;
        const totalUnits = Number(r.units) || 1;
        const unitsAvailableNow = Math.max(0, totalUnits - occupied);
        const isLockedNow = unitsAvailableNow <= 0;
        return {
          ...r,
          occupied_units_now: occupied,
          units_available_now: unitsAvailableNow,
          is_locked_now: isLockedNow,
          availability_status: isLockedNow ? 'unavailable_until_checkout' : 'available_now',
        };
      });
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
  if (!room || room.is_active === false) {
    throw new ApiError(404, "There's no present room around matching this slug.");
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
      .select('room_id, check_in, check_out, status, notes')
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

  // 4. Calculate peak occupancy & available physical unit numbers per room across stay duration
  const list = allRooms
    .filter((r) => r.capacity >= guests)
    .map((r) => {
      const totalUnits = Number(r.units) || 1;
      const roomBookings = overlappingRes.filter((b) => b.room_id === r.id);

      // Track units specifically taken by overlapping bookings
      const takenUnits = new Set();
      roomBookings.forEach((b) => {
        const m = (b.notes || '').match(/\[Unit\s*(\d+)\]/i);
        if (m) {
          const uNum = parseInt(m[1], 10);
          if (uNum >= 1 && uNum <= totalUnits) takenUnits.add(uNum);
        }
      });

      let peakBusy = 0;
      for (const night of nights) {
        const busyTonight = roomBookings.filter((b) => b.check_in <= night && b.check_out > night).length;
        if (busyTonight > peakBusy) peakBusy = busyTonight;
      }

      // Compute exact available unit numbers
      const availableUnits = [];
      for (let u = 1; u <= totalUnits; u++) {
        if (!takenUnits.has(u)) {
          availableUnits.push(u);
        }
      }

      const unitsLeft = Math.max(0, Math.min(availableUnits.length, totalUnits - peakBusy));
      return {
        room_id: r.id,
        name: r.name,
        category: r.category,
        capacity: r.capacity,
        rate_php: r.rate_php,
        units_left: unitsLeft,
        total_units: totalUnits,
        available_unit_numbers: availableUnits,
        occupied_units: peakBusy,
        is_locked: unitsLeft <= 0,
        rating_avg: Number(r.rating_avg) || 0,
      };
    })
    .sort((a, b) => a.rate_php - b.rate_php);

  await redis.set(cacheKey, list, 30);
  res.setHeader('X-Cache', 'MISS');
  res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
  return res.json(list);
}));

r.get('/availability/calendar', asyncH(async (req, res) => {
  const { room_id, from, to } = req.query;
  const today = new Date().toISOString().slice(0, 10);
  const startDate = (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) ? from : today;
  const defaultEnd = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const endDate = (to && /^\d{4}-\d{2}-\d{2}$/.test(to) && to > startDate) ? to : defaultEnd;

  const cacheKey = `calendar:${room_id || 'all'}:${startDate}:${endDate}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  const sysClient = await getSystemAdminClient();

  // 1. Fetch active rooms
  let rooms = [];
  try {
    let q = sysClient.from('rooms').select('id, name, slug, category, capacity, units, rate_php, is_active').eq('is_active', true);
    if (room_id) q = q.eq('id', room_id);
    const { data } = await q;
    if (data) rooms = data;
  } catch (err) {
    console.warn('[Calendar API] Rooms notice:', err.message);
  }

  // 2. Query overlapping active reservations
  let reservations = [];
  try {
    let q = sysClient.from('reservations')
      .select('id, room_id, check_in, check_out, status, guests, rooms(id, name, units)')
      .in('status', ['pending', 'confirmed', 'checked_in'])
      .lt('check_in', endDate)
      .gt('check_out', startDate);
    if (room_id) q = q.eq('room_id', room_id);
    const { data } = await q;
    if (data) reservations = data;
  } catch (err) {
    console.warn('[Calendar API] Reservations notice:', err.message);
  }

  // 3. Build daily map: date -> room availability & lock status
  const dailyStatus = {};
  const datesList = [];
  let cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur < end) {
    datesList.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }

  for (const night of datesList) {
    let totalResortUnits = 0;
    let totalResortOccupied = 0;
    const roomMap = {};

    for (const r of rooms) {
      const roomUnits = Number(r.units) || 1;
      totalResortUnits += roomUnits;

      const roomBookings = reservations.filter((b) => b.room_id === r.id && b.check_in <= night && b.check_out > night);
      const occupied = roomBookings.length;
      totalResortOccupied += occupied;
      const isLocked = occupied >= roomUnits;
      const unitsLeft = Math.max(0, roomUnits - occupied);

      roomMap[r.id] = {
        name: r.name,
        category: r.category,
        total_units: roomUnits,
        occupied_units: occupied,
        units_left: unitsLeft,
        is_locked: isLocked,
      };
    }

    dailyStatus[night] = {
      date: night,
      total_units: totalResortUnits,
      total_occupied: totalResortOccupied,
      resort_fully_booked: totalResortUnits > 0 && totalResortOccupied >= totalResortUnits,
      rooms: roomMap,
    };
  }

  const payload = {
    start_date: startDate,
    end_date: endDate,
    rooms,
    booked_ranges: reservations.map((b) => ({
      id: b.id,
      room_id: b.room_id,
      room_name: b.rooms?.name,
      check_in: b.check_in,
      check_out: b.check_out,
      status: b.status,
    })),
    daily_status: dailyStatus,
  };

  await redis.set(cacheKey, payload, 30);
  res.setHeader('X-Cache', 'MISS');
  return res.json(payload);
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
    const client = (await getSystemAdminClient().catch(() => null)) || admin;
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
    const client = (await getSystemAdminClient().catch(() => null)) || admin;

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
  const sysClient = (await getSystemAdminClient().catch(() => null)) || admin;
  const isHard = req.query.hard === 'true';

  if (isHard) {
    try {
      // 1. Clean up locks, reviews, tasks referencing this room (safe non-blocking cleanup)
      try { await sysClient.from('room_locks').delete().eq('room_id', req.params.id); } catch {}
      try { await sysClient.from('reviews').delete().eq('room_id', req.params.id); } catch {}
      try { await sysClient.from('department_tasks').delete().eq('room_id', req.params.id); } catch {}

      // 2. Unlink reservations to satisfy foreign key constraint ON DELETE RESTRICT
      try {
        await sysClient.from('reservations').update({ room_id: null }).eq('room_id', req.params.id);
      } catch (unErr) {
        console.warn('[Rooms API] Unlink reservations warning:', unErr.message);
      }

      // 3. Delete room permanently
      const { error: hardErr } = await sysClient.from('rooms').delete().eq('id', req.params.id);
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
      console.warn('[Rooms API] Hard delete failed, falling back to soft deactivation:', hardErr.message);
    } catch (e) {
      console.warn('[Rooms API] Hard delete exception, falling back to soft deactivation:', e.message);
    }
  }

  const { data, error } = await sysClient.from('rooms')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .select().maybeSingle();
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

  return res.json({ success: true, deactivated: data, deleted_id: req.params.id });
}));

export default r;
