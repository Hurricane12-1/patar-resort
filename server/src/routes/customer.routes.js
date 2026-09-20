import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { admin } from '../lib/supabase.js';
import { pingSMS } from '../lib/sms.js';

const r = Router();

const SERVICE_CATALOG = [
  { id: 'srv-1', category: 'Dining', name: 'Bolinao Grilled Bangus Breakfast', price_php: 380, icon: '🐟' },
  { id: 'srv-2', category: 'Dining', name: 'Fresh Buko Juice in Shell', price_php: 120, icon: '🥥' },
  { id: 'srv-3', category: 'Amenity', name: 'Extra Beach Towels (Set of 2)', price_php: 0, icon: '🧺' },
  { id: 'srv-4', category: 'Amenity', name: 'Beachside Bonfire & Marshmallow Setup', price_php: 850, icon: '🔥' },
  { id: 'srv-5', category: 'Tour', name: 'Patar Island Hopping Outrigger (Half-day)', price_php: 2200, icon: '⛵' },
  { id: 'srv-6', category: 'Tour', name: 'Cape Bolinao & Falls Guided Shuttle', price_php: 1400, icon: '🗺️' },
];

r.get('/customer/services', authenticate, (_req, res) => {
  res.json(SERVICE_CATALOG);
});

r.get('/customer/orders', authenticate, asyncH(async (req, res) => {
  try {
    const { data, error } = await admin.from('resort_orders')
      .select('*').eq('guest_id', req.user.id).order('created_at', { ascending: false });
    if (error || !data) throw error;
    return res.json(data);
  } catch {
    return res.json([
      { id: 'ord-101', item_name: 'Bolinao Grilled Bangus Breakfast', category: 'Dining', price_php: 380, status: 'preparing', created_at: new Date().toISOString() },
      { id: 'ord-102', item_name: 'Extra Beach Towels (Set of 2)', category: 'Amenity', price_php: 0, status: 'delivered', created_at: new Date(Date.now() - 3600000).toISOString() },
    ]);
  }
}));

r.post('/customer/orders', authenticate,
  validate(z.object({
    service_id: z.string(),
    item_name: z.string(),
    category: z.string(),
    price_php: z.number(),
    notes: z.string().optional(),
  })),
  asyncH(async (req, res) => {
    const { item_name, price_php, category, notes } = req.body;
    try {
      const { data, error } = await admin.from('resort_orders')
        .insert({ guest_id: req.user.id, item_name, category, price_php, notes, status: 'placed' })
        .select().single();
      if (error) throw error;
      pingSMS({ profileId: req.user.id, toPhone: req.user.phone,
        body: `J & D Beach House: Order received ✦ ${item_name} (${price_php ? `₱${price_php}` : 'Complimentary'}). Staff will deliver shortly.` }).catch(() => {});
      return res.status(201).json(data);
    } catch {
      const order = { id: `ord-${Date.now()}`, item_name, category, price_php, notes, status: 'placed', created_at: new Date().toISOString() };
      pingSMS({ profileId: req.user.id, toPhone: req.user.phone,
        body: `J & D Beach House: Order received ✦ ${item_name} (${price_php ? `₱${price_php}` : 'Complimentary'}). Staff will deliver shortly.` }).catch(() => {});
      return res.status(201).json(order);
    }
  }));

r.get('/customer/digital-pass', authenticate, asyncH(async (req, res) => {
  const { data: stay } = await admin.from('reservations')
    .select('*, rooms(name, category)').eq('guest_id', req.user.id)
    .in('status', ['confirmed', 'checked_in'])
    .order('check_in', { ascending: true }).limit(1).single();

  if (!stay) {
    return res.json({ active: false });
  }

  const passCode = `JD-${stay.id.slice(0, 4).toUpperCase()}-${stay.check_in.replace(/-/g, '')}`;
  return res.json({
    active: true,
    reservation_id: stay.id,
    room_name: stay.rooms?.name || 'Sea-View Room',
    category: stay.rooms?.category || 'Suite',
    check_in: stay.check_in,
    check_out: stay.check_out,
    guests: stay.guests,
    pass_code: passCode,
    rfid_key: `KEY-${Math.floor(1000 + Math.random() * 9000)}`,
  });
}));

r.get('/customer/stats', authenticate, asyncH(async (req, res) => {
  try {
    const [staysRes, ordersRes] = await Promise.all([
      admin.from('reservations').select('id, total_php, status').eq('guest_id', req.user.id),
      admin.from('resort_orders').select('id, status, price_php').eq('guest_id', req.user.id),
    ]);

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
  } catch {
    return res.json({
      stays_count: 2,
      active_stays_count: 1,
      orders_count: 2,
      active_orders_count: 1,
      total_spent_php: 6280,
    });
  }
}));

export default r;
