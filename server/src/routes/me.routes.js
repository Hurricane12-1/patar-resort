import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { admin } from '../lib/supabase.js';
import { pingSMS } from '../lib/sms.js';

const r = Router();

r.get('/me', authenticate, (req, res) => res.json(req.user));

r.patch('/me', authenticate,
  validate(z.object({
    first_name: z.string().max(80).optional(),
    middle_name: z.string().max(80).optional(),
    last_name: z.string().max(80).optional(),
    full_name: z.string().max(160).optional(),
    phone: z.string().max(25).optional(),
    address: z.string().max(150).optional(),
    city: z.string().max(80).optional(),
    emergency_contact: z.string().max(100).optional(),
  })),
  asyncH(async (req, res) => {
    const allowedFields = ['first_name', 'middle_name', 'last_name', 'full_name', 'phone', 'address', 'city', 'emergency_contact'];
    const updatePayload = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updatePayload[key] = req.body[key];
    }
    if (!updatePayload.full_name && (updatePayload.first_name || updatePayload.last_name)) {
      updatePayload.full_name = [updatePayload.first_name, updatePayload.middle_name, updatePayload.last_name].filter(Boolean).join(' ');
    }
    const { data, error } = await req.sb.from('profiles')
      .update(updatePayload).eq('id', req.user.id).select().single();
    if (error) throw new ApiError(500, error.message);
    res.json(data);
  }));

// Password Update for Logged-In User
r.patch('/me/password', authenticate,
  validate(z.object({
    password: z.string().min(6),
  })),
  asyncH(async (req, res) => {
    const { password } = req.body;
    try {
      const { data, error } = await admin.auth.admin.updateUserById(req.user.id, { password });
      if (error) throw error;
      pingSMS({ profileId: req.user.id, toPhone: req.user.phone, body: 'J & D Beach House: Your account password was updated successfully.' }).catch(() => {});
      return res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
      throw new ApiError(500, err.message);
    }
  }));

// Accounts Directory: List, Search, Provision & Role Modification
r.get('/admin/customers', authenticate, requireAdmin, asyncH(async (req, res) => {
  const query = String(req.query.q || '').trim();
  const roleFilter = String(req.query.role || '').trim();

  try {
    let q = admin.from('profiles').select('*, reservations(id, total_php, status), resort_orders(id, status)')
      .order('created_at', { ascending: false });
    
    if (query) {
      q = q.or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`);
    }
    if (roleFilter) {
      q = q.eq('role', roleFilter);
    }

    const { data, error } = await q.limit(60);
    if (error || !data) throw error;
    
    return res.json(data.map((p) => ({
      ...p,
      stays_count: p.reservations?.length || 0,
      orders_count: p.resort_orders?.length || 0,
      total_spent_php: (p.reservations || []).reduce((acc, r) => acc + (r.total_php || 0), 0),
    })));
  } catch {
    return res.json([]);
  }
}));

// Provision New Staff Account
r.post('/admin/users', authenticate, requireAdmin,
  validate(z.object({
    first_name: z.string().optional(),
    middle_name: z.string().optional(),
    last_name: z.string().optional(),
    full_name: z.string().optional(),
    email: z.string().email(),
    password: z.string().min(6),
    phone: z.string().optional(),
    role: z.enum(['customer', 'staff', 'receptionist', 'accounting', 'administrator']),
  })),
  asyncH(async (req, res) => {
    let { first_name = '', middle_name = '', last_name = '', full_name, email, password, phone, role } = req.body;
    if (!full_name) {
      full_name = [first_name, middle_name, last_name].filter(Boolean).join(' ') || 'Resort User';
    }
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email, password, user_metadata: { first_name, middle_name, last_name, full_name, phone, role }, email_confirm: true,
    });
    if (authErr) throw new ApiError(400, authErr.message);

    const { data: prof, error: profErr } = await admin.from('profiles')
      .upsert({ id: authUser.user.id, first_name, middle_name, last_name, full_name, phone, role })
      .select().single();
    if (profErr) throw new ApiError(500, profErr.message);

    return res.status(201).json(prof);
  }));

// Modify Account Role
r.patch('/admin/users/:id/role', authenticate, requireAdmin,
  validate(z.object({
    role: z.enum(['customer', 'staff', 'receptionist', 'accounting', 'administrator']),
  })),
  asyncH(async (req, res) => {
    const { role } = req.body;
    const { data, error } = await admin.from('profiles')
      .update({ role }).eq('id', req.params.id).select().single();
    if (error) throw new ApiError(500, error.message);
    return res.json(data);
  }));

// Administrative Account Recovery & Password Reset
r.post('/admin/users/:id/reset-password', authenticate, requireAdmin,
  validate(z.object({
    new_password: z.string().min(6),
  })),
  asyncH(async (req, res) => {
    const { new_password } = req.body;
    const userId = req.params.id;

    const { data: updatedUser, error: authErr } = await admin.auth.admin.updateUserById(userId, {
      password: new_password,
    });
    if (authErr) throw new ApiError(500, authErr.message);

    const { data: prof } = await admin.from('profiles').select('full_name, phone').eq('id', userId).single();
    if (prof?.phone) {
      pingSMS({
        profileId: userId,
        toPhone: prof.phone,
        body: `Resort Account Recovery: Your password has been reset by administration. Your new password is: ${new_password}`,
      }).catch(() => {});
    }

    return res.json({ success: true, message: `Password reset successfully for ${prof?.full_name || 'account'}` });
  }));

export default r;
