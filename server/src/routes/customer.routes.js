import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { admin } from '../lib/supabase.js';
import { pingSMS } from '../lib/sms.js';

const r = Router();

r.get('/customer/services', authenticate, asyncH(async (_req, res) => {
  const { data, error } = await admin.from('resort_services').select('*').eq('is_active', true).order('price_php', { ascending: true });
  if (error) throw new ApiError(500, error.message);
  return res.json(data || []);
}));

r.get('/customer/orders', authenticate, asyncH(async (req, res) => {
  const { data, error } = await admin.from('resort_orders')
    .select('*').eq('guest_id', req.user.id).order('created_at', { ascending: false });
  if (error) throw new ApiError(500, error.message);
  return res.json(data || []);
}));

r.post('/customer/orders', authenticate,
  validate(z.object({
    service_id: z.string().optional(),
    item_name: z.string(),
    category: z.string(),
    price_php: z.number(),
    notes: z.string().optional(),
  })),
  asyncH(async (req, res) => {
    const { item_name, price_php, category, notes } = req.body;
    const { data, error } = await admin.from('resort_orders')
      .insert({ guest_id: req.user.id, item_name, category, price_php, notes, status: 'placed' })
      .select().single();
    if (error) throw new ApiError(500, error.message);
    pingSMS({ profileId: req.user.id, toPhone: req.user.phone,
      body: `Rock View Beach Resort: Order received ✦ ${item_name} (${price_php ? `₱${price_php}` : 'Complimentary'}). Staff will deliver shortly.` }).catch(() => {});
    return res.status(201).json(data);
  }));

r.get('/customer/digital-pass', authenticate, asyncH(async (req, res) => {
  const { data: stay } = await admin.from('reservations')
    .select('*, rooms(name, category)').eq('guest_id', req.user.id)
    .in('status', ['confirmed', 'checked_in'])
    .order('check_in', { ascending: true }).limit(1).single();

  if (!stay) {
    return res.json({ active: false });
  }

  const passCode = `RV-${stay.id.slice(0, 4).toUpperCase()}-${stay.check_in.replace(/-/g, '')}`;
  return res.json({
    active: true,
    reservation_id: stay.id,
    room_name: stay.rooms?.name || 'Sea-View Room',
    category: stay.rooms?.category || 'Suite',
    check_in: stay.check_in,
    check_out: stay.check_out,
    guests: stay.guests,
    pass_code: passCode,
    rfid_key: `RFID-${stay.id.slice(0, 8).toUpperCase()}`,
  });
}));

r.get('/customer/stats', authenticate, asyncH(async (req, res) => {
  const [staysRes, ordersRes] = await Promise.all([
    admin.from('reservations').select('id, total_php, status').eq('guest_id', req.user.id),
    admin.from('resort_orders').select('id, status, price_php').eq('guest_id', req.user.id),
  ]);

  if (staysRes.error) throw new ApiError(500, staysRes.error.message);
  if (ordersRes.error) throw new ApiError(500, ordersRes.error.message);

  const stays = staysRes.data || [];
  const orders = ordersRes.data || [];

  const totalSpent = stays.reduce((acc, s) => acc + (s.total_php || 0), 0) +
                     orders.reduce((acc, o) => acc + (o.price_php || 0), 0);

  return res.json({
    stays_count: stays.length,
    active_stays_count: stays.filter((s) => ['confirmed', 'checked_in'].includes(s.status)).length,
    orders_count: orders.length,
    active_orders_count: orders.filter((o) => ['placed', 'preparing', 'delivering'].includes(o.status)).length,
    total_spent_php: totalSpent,
  });
}));

export default r;
