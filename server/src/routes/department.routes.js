import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate, requireStaffOrAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { admin } from '../lib/supabase.js';

const r = Router();

r.get('/department/tasks', authenticate, requireStaffOrAdmin, asyncH(async (_req, res) => {
  const { data, error } = await admin.from('department_tasks')
    .select('*, rooms(name)').order('created_at', { ascending: false });
  if (error) throw new ApiError(500, error.message);
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
    const { data, error } = await admin.from('department_tasks')
      .insert({ ...req.body, created_by: req.user.id })
      .select().single();
    if (error) throw new ApiError(500, error.message);
    return res.status(201).json(data);
  }));

r.patch('/department/tasks/:id/status', authenticate, requireStaffOrAdmin,
  validate(z.object({ status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']) })),
  asyncH(async (req, res) => {
    const { data, error } = await admin.from('department_tasks')
      .update({ status: req.body.status }).eq('id', req.params.id)
      .select().single();
    if (error) throw new ApiError(500, error.message);
    return res.json(data);
  }));

r.get('/department/room-status', authenticate, requireStaffOrAdmin, asyncH(async (_req, res) => {
  const [roomsRes, activeRes, tasksRes] = await Promise.all([
    admin.from('rooms').select('id, name, slug, category, units, rate_php').eq('is_active', true).order('name'),
    admin.from('reservations').select('room_id').in('status', ['confirmed', 'checked_in']),
    admin.from('department_tasks').select('room_name, department, title, status').in('status', ['pending', 'in_progress']),
  ]);

  const rooms = roomsRes.data || [];
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

r.get('/department/inventory', authenticate, requireStaffOrAdmin, asyncH(async (_req, res) => {
  const { data, error } = await admin.from('resort_inventory').select('*').order('item_name');
  if (error) throw new ApiError(500, error.message);
  return res.json(data || []);
}));

export default r;
