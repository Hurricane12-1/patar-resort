import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import {
  authenticate,
  requireAdmin,
  requireOperationalStaffOrAdmin,
  normalizeEmployeeRole,
  resolveEmployeeDepartment,
} from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { admin, getSystemAdminClient } from '../lib/supabase.js';
import { logAuditEvent } from '../lib/auditLogger.js';

const r = Router();
const ACTIVE_DEPARTMENTS = ['front_desk', 'housekeeping', 'kitchen', 'tours'];

function assertDepartmentAccess(user, targetDepartment) {
  const role = normalizeEmployeeRole(user?.role);
  if (role === 'administrator') return true;
  const userDept = resolveEmployeeDepartment(user);
  if (targetDepartment === 'tours' && userDept !== 'tours') {
    throw new ApiError(403, 'Access denied: Tours & Island Hopping operations remain restricted.');
  }
  if (!userDept || userDept !== targetDepartment) {
    throw new ApiError(403, `Access denied: Department "${userDept || role}" cannot modify "${targetDepartment}" records.`);
  }
  return true;
}

r.get('/department/tasks', authenticate, requireOperationalStaffOrAdmin, asyncH(async (req, res) => {
  const client = req.sb || admin;
  const role = normalizeEmployeeRole(req.user?.role);
  const userDept = resolveEmployeeDepartment(req.user);

  let data = [];
  try {
    let q = client.from('department_tasks').select('*, rooms(name)').order('created_at', { ascending: false });
    if (role !== 'administrator' && userDept) {
      q = q.eq('department', userDept);
    } else {
      q = q.in('department', ACTIVE_DEPARTMENTS);
    }
    const { data: joined, error } = await q;
    if (!error && Array.isArray(joined)) {
      data = joined;
    } else {
      let fq = client.from('department_tasks').select('*').order('created_at', { ascending: false });
      if (role !== 'administrator' && userDept) {
        fq = fq.eq('department', userDept);
      } else {
        fq = fq.in('department', ACTIVE_DEPARTMENTS);
      }
      const fallback = await fq;
      data = fallback.data || [];
    }
  } catch (err) {
    console.warn('[Department Tasks] Notice on query:', err.message);
  }
  return res.json(data);
}));

r.post('/department/tasks', authenticate, requireOperationalStaffOrAdmin,
  validate(z.object({
    department: z.enum(['front_desk', 'housekeeping', 'kitchen', 'tours']),
    title: z.string().min(3).max(120),
    room_name: z.string().optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    assigned_to: z.string().optional(),
  })),
  asyncH(async (req, res) => {
    assertDepartmentAccess(req.user, req.body.department);
    const client = req.sb || admin;
    const { data, error } = await client.from('department_tasks')
      .insert({ ...req.body, created_by: req.user.id })
      .select().single();
    if (error) throw new ApiError(500, error.message);
    return res.status(201).json(data);
  }));

r.patch('/department/tasks/:id/status', authenticate, requireOperationalStaffOrAdmin,
  validate(z.object({ status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']) })),
  asyncH(async (req, res) => {
    const client = req.sb || admin;
    const { data: existing } = await client.from('department_tasks').select('id, department').eq('id', req.params.id).maybeSingle();
    if (!existing) throw new ApiError(404, 'Department task not found');
    assertDepartmentAccess(req.user, existing.department);

    const { data, error } = await client.from('department_tasks')
      .update({ status: req.body.status }).eq('id', req.params.id)
      .select().single();
    if (error) throw new ApiError(500, error.message);
    return res.json(data);
  }));

r.get('/department/room-status', authenticate, requireOperationalStaffOrAdmin, asyncH(async (req, res) => {
  const role = normalizeEmployeeRole(req.user?.role);
  const userDept = resolveEmployeeDepartment(req.user);
  if (role !== 'administrator' && !['front_desk', 'housekeeping'].includes(userDept || '')) {
    throw new ApiError(403, 'Access denied: Room readiness status is limited to Front Desk, Housekeeping, and Administration.');
  }

  const client = req.sb || admin;
  const [roomsRes, activeRes, tasksRes] = await Promise.all([
    client.from('rooms').select('id, name, slug, category, units, rate_php').eq('is_active', true).order('name'),
    client.from('reservations').select('room_id').in('status', ['confirmed', 'checked_in']),
    client.from('department_tasks').select('room_name, department, title, status').in('status', ['pending', 'in_progress']),
  ]);

  const rooms = roomsRes.data || [];
  const activeStays = activeRes.data || [];
  const openTasks = tasksRes.data || [];

  const result = rooms.map((room) => {
    const occupied = activeStays.filter((s) => s.room_id === room.id).length;
    const roomTasks = openTasks.filter((t) => t.room_name?.toLowerCase().includes(room.name.toLowerCase()));
    const hkTask = roomTasks.find((t) => t.department === 'housekeeping');

    return {
      ...room,
      housekeeping_status: hkTask ? 'turn_down' : 'clean_ready',
      occupied_units: Math.min(room.units, occupied),
    };
  });

  return res.json(result);
}));

r.get('/department/inventory', authenticate, requireOperationalStaffOrAdmin, asyncH(async (req, res) => {
  const client = req.sb || admin;
  const role = normalizeEmployeeRole(req.user?.role);
  const userDept = resolveEmployeeDepartment(req.user);

  let q = client.from('resort_inventory').select('*').order('item_name');
  if (role !== 'administrator' && userDept) {
    q = q.eq('category', userDept);
  } else {
    q = q.in('category', ACTIVE_DEPARTMENTS);
  }
  const { data, error } = await q;
  if (error) {
    console.warn('[Department Inventory] Select warning:', error.message);
    return res.json([]);
  }
  return res.json(data || []);
}));

r.post('/department/inventory', authenticate, requireOperationalStaffOrAdmin,
  validate(z.object({
    item_name: z.string().min(2).max(100),
    category: z.enum(['front_desk', 'housekeeping', 'kitchen', 'tours']).default('housekeeping'),
    stock_qty: z.coerce.number().int().min(0).default(0),
    unit: z.string().default('pcs'),
    reorder_at: z.coerce.number().int().min(0).default(10),
  })),
  asyncH(async (req, res) => {
    assertDepartmentAccess(req.user, req.body.category);
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

r.patch('/department/inventory/:id', authenticate, requireOperationalStaffOrAdmin,
  validate(z.object({
    item_name: z.string().min(2).max(100).optional(),
    category: z.enum(['front_desk', 'housekeeping', 'kitchen', 'tours']).optional(),
    stock_qty: z.coerce.number().int().min(0).optional(),
    unit: z.string().optional(),
    reorder_at: z.coerce.number().int().min(0).optional(),
  })),
  asyncH(async (req, res) => {
    const client = req.sb || admin;
    const { data: existing } = await client.from('resort_inventory').select('id, category').eq('id', req.params.id).maybeSingle();
    if (!existing) throw new ApiError(404, 'Inventory item not found');
    assertDepartmentAccess(req.user, existing.category);
    if (req.body.category) {
      assertDepartmentAccess(req.user, req.body.category);
    }

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

r.delete('/department/inventory/:id', authenticate, requireAdmin, asyncH(async (req, res) => {
  const client = (await getSystemAdminClient().catch(() => null)) || admin;
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
