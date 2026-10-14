import { admin } from '../lib/supabase.js';
import { redis } from '../lib/redis.js';
import { getCertificateStatus } from '../config/cert.js';

export const resolvers = {
  // Queries
  rooms: async () => {
    const cacheKey = 'graphql:rooms:all';
    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    const { data, error } = await admin.from('rooms').select('*').order('rate_php', { ascending: true });
    if (error) throw new Error(`Failed to fetch rooms: ${error.message}`);

    const result = data || [];
    await redis.set(cacheKey, result, 60); // Cache for 60 seconds
    return result;
  },

  room: async ({ id }) => {
    const { data, error } = await admin.from('rooms').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  roomBySlug: async ({ slug }) => {
    const { data, error } = await admin.from('rooms').select('*').eq('slug', slug).single();
    if (error) return null;
    return data;
  },

  reservations: async ({ limit = 20 }) => {
    const { data, error } = await admin
      .from('reservations')
      .select('*, rooms(*)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Failed to fetch reservations: ${error.message}`);
    return data || [];
  },

  analytics: async () => {
    const cacheKey = 'graphql:analytics:overview';
    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    const [ovRes, resDataRes, ordersRes] = await Promise.all([
      admin.from('analytics_overview').select('*').single(),
      admin.from('reservations').select('total_php, status, nights').neq('status', 'cancelled'),
      admin.from('resort_orders').select('price_php, category'),
    ]);

    const ov = ovRes.data || {};
    const bookings = resDataRes.data || [];
    const orders = ordersRes.data || [];

    const roomRev = bookings.reduce((sum, r) => sum + (Number(r.total_php) || 0), 0);
    const diningRev = orders.filter(o => o.category === 'Dining').reduce((sum, o) => sum + (Number(o.price_php) || 0), 0);
    const tourRev = orders.filter(o => o.category === 'Tour').reduce((sum, o) => sum + (Number(o.price_php) || 0), 0);
    const totalRev = roomRev + diningRev + tourRev;
    const totalNights = bookings.reduce((sum, r) => sum + (r.nights || 1), 0);
    const adr = totalNights > 0 ? Math.round(roomRev / totalNights) : 0;
    const revpar = Math.round(adr * ((ov.occupancy_pct || 0) / 100));

    const result = {
      arrivals_today: ov.arrivals_today || 0,
      departures_today: ov.departures_today || 0,
      occupancy_pct: Number(ov.occupancy_pct) || 0,
      revenue_week_php: ov.revenue_week_php || 0,
      total_revenue_php: totalRev,
      adr_php: adr,
      revpar_php: revpar,
      room_revenue_php: roomRev,
      dining_revenue_php: diningRev,
      tour_revenue_php: tourRev,
      sms_delivered: ov.sms_delivered || 0,
    };

    await redis.set(cacheKey, result, 30);
    return result;
  },

  departmentTasks: async ({ department }) => {
    let query = admin.from('department_tasks').select('*').order('created_at', { ascending: false });
    if (department) {
      query = query.eq('department', department);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch tasks: ${error.message}`);
    return data || [];
  },

  networkStatus: async () => {
    const start = Date.now();
    const redisPing = await redis.ping();
    const cert = getCertificateStatus();

    // Check DB ping
    let dbStatus = 'HEALTHY';
    try {
      const { error } = await admin.from('rooms').select('id').limit(1);
      if (error) dbStatus = 'DEGRADED';
    } catch {
      dbStatus = 'OFFLINE';
    }

    const latency = Date.now() - start;
    return {
      status: dbStatus === 'HEALTHY' ? 'OPERATIONAL' : 'DEGRADED',
      latency_ms: latency,
      db_status: dbStatus,
      redis_status: redisPing.status,
      tls_status: cert.status,
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  },

  // Mutations
  createReservation: async ({ roomId, check_in, check_out, guests, notes, phone }) => {
    const { data: room } = await admin.from('rooms').select('*').eq('id', roomId).single();
    if (!room) throw new Error('Room not found');

    const nights = Math.max(1, Math.round((new Date(check_out) - new Date(check_in)) / (1000 * 60 * 60 * 24)));
    const totalPhp = (room.rate_php || 2500) * nights;

    const payload = {
      room_id: roomId,
      check_in,
      check_out,
      guests,
      notes: notes || '',
      phone: phone || '',
      total_php: totalPhp,
      status: 'confirmed',
    };

    const { data, error } = await admin.from('reservations').insert(payload).select().single();
    if (error) throw new Error(`Reservation failed: ${error.message}`);

    // Invalidate Redis caches
    await redis.del('graphql:rooms:all');
    await redis.del('graphql:analytics:overview');

    return data;
  },

  updateTaskStatus: async ({ id, status }) => {
    const { data, error } = await admin
      .from('department_tasks')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Task update failed: ${error.message}`);
    return data;
  },
};
