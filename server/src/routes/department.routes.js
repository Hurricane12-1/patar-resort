import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate, requireStaffOrAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { admin } from '../lib/supabase.js';
import { CANONICAL_ROOMS } from '../lib/canonicalRooms.js';
import { logAuditEvent } from '../lib/auditLogger.js';

const r = Router();

r.get('/department/tasks', authenticate, requireStaffOrAdmin, asyncH(async (req, res) => {
  const client = req.sb || admin;
  try {
    const { data, error } = await client.from('department_tasks')
      .select('*, rooms(name)').order('created_at', { ascending: false });
    if (!error && data) return res.json(data);
  } catch (err) {
    console.warn('[Department Tasks] Notice on join query:', err.message);
  }
  const { data } = await client.from('department_tasks').select('*').order('created_at', { ascending: false });
  return res.json(data || []);
}));

r.post('/department/tasks', authenticate, requireStaffOrAdmin,
  validate(z.object({
    department: z.enum(['front_desk', 'housekeeping', 'kitchen', 'tours', 'maintenance']),
    title: z.string().min(3).max(120),
    room_name: z.string().optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    assigned_to: z.string().optional(),
  })),
  asyncH(async (req, res) => {
    const client = req.sb || admin;
    const { data, error } = await client.from('department_tasks')
      .insert({ ...req.body, created_by: req.user.id })
      .select().single();
    if (error) throw new ApiError(500, error.message);
    return res.status(201).json(data);
  }));

r.patch('/department/tasks/:id/status', authenticate, requireStaffOrAdmin,
  validate(z.object({ status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']) })),
  asyncH(async (req, res) => {
    const client = req.sb || admin;
    const { data, error } = await client.from('department_tasks')
      .update({ status: req.body.status }).eq('id', req.params.id)
      .select().single();
    if (error) throw new ApiError(500, error.message);
    return res.json(data);
  }));

r.get('/department/room-status', authenticate, requireStaffOrAdmin, asyncH(async (req, res) => {
  const client = req.sb || admin;
  const [roomsRes, activeRes, tasksRes] = await Promise.all([
    client.from('rooms').select('id, name, slug, category, units, rate_php').eq('is_active', true).order('name'),
    client.from('reservations').select('room_id').in('status', ['confirmed', 'checked_in']),
    client.from('department_tasks').select('room_name, department, title, status').in('status', ['pending', 'in_progress']),
  ]);

  let rooms = roomsRes.data || [];
  if (rooms.length === 0) {
    rooms = CANONICAL_ROOMS.filter(r => r.is_active);
  }
  const activeStays = activeRes.data || [];
  const openTasks = tasksRes.data || [];

  const result = rooms.map((room) => {
    const occupied = activeStays.filter((s) => s.room_id === room.id).length;
    const roomTasks = openTasks.filter((t) => t.room_name?.toLowerCase().includes(room.name.toLowerCase()));
    const hkTask = roomTasks.find((t) => t.department === 'housekeeping');
    const maintTask = roomTasks.find((t) => t.department === 'maintenance');

    return {
      ...room,
      housekeeping_status: hkTask ? 'turn_down' : 'clean_ready',
      maintenance_flag: maintTask ? maintTask.title : null,
      occupied_units: Math.min(room.units, occupied),
    };
  });

  return res.json(result);
}));

r.get('/department/inventory', authenticate, requireStaffOrAdmin, asyncH(async (req, res) => {
  const client = req.sb || admin;
  const { data, error } = await client.from('resort_inventory').select('*').order('item_name');
  if (error) {
    console.warn('[Department Inventory] Select warning:', error.message);
    return res.json([]);
  }
  return res.json(data || []);
}));

r.post('/department/inventory', authenticate, requireStaffOrAdmin,
  validate(z.object({
    item_name: z.string().min(2).max(100),
    category: z.enum(['front_desk', 'housekeeping', 'kitchen', 'tours', 'maintenance']).default('housekeeping'),
    stock_qty: z.coerce.number().int().min(0).default(0),
    unit: z.string().default('pcs'),
    reorder_at: z.coerce.number().int().min(0).default(10),
  })),
  asyncH(async (req, res) => {
    const client = req.sb || admin;
    const { data, error } = await client.from('resort_inventory').insert(req.body).select().single();
    if (error) throw new ApiError(500, error.message);

    await logAuditEvent({
      actor: req.user,
      action: 'INVENTORY_CREATE',
      resourceType: 'inventory',
      resourceId: data.id,
      details: { item_name: data.item_name, category: data.category, stock_qty: data.stock_qty },
      req,
    });

    return res.status(201).json(data);
  }));

r.patch('/department/inventory/:id', authenticate, requireStaffOrAdmin,
  validate(z.object({
    item_name: z.string().min(2).max(100).optional(),
    category: z.enum(['front_desk', 'housekeeping', 'kitchen', 'tours', 'maintenance']).optional(),
    stock_qty: z.coerce.number().int().min(0).optional(),
    unit: z.string().optional(),
    reorder_at: z.coerce.number().int().min(0).optional(),
  })),
  asyncH(async (req, res) => {
    const client = req.sb || admin;
    const { data, error } = await client.from('resort_inventory')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select().single();
    if (error) throw new ApiError(500, error.message);

    await logAuditEvent({
      actor: req.user,
      action: 'INVENTORY_UPDATE',
      resourceType: 'inventory',
      resourceId: req.params.id,
      details: req.body,
      req,
    });

    return res.json(data);
  }));

r.delete('/department/inventory/:id', authenticate, requireStaffOrAdmin, asyncH(async (req, res) => {
  const client = req.sb || admin;
  const { error } = await client.from('resort_inventory').delete().eq('id', req.params.id);
  if (error) throw new ApiError(500, error.message);

  await logAuditEvent({
    actor: req.user,
    action: 'INVENTORY_DELETE',
    resourceType: 'inventory',
    resourceId: req.params.id,
    details: { deleted: true },
    req,
  });

  return res.json({ success: true, deleted_id: req.params.id });
}));

export default r;
