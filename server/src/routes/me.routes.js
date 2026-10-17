import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { admin, getSystemAdminClient } from '../lib/supabase.js';
import { pingSMS } from '../lib/sms.js';
import { logAuditEvent } from '../lib/auditLogger.js';

const r = Router();

r.get('/me', authenticate, (req, res) => res.json(req.user));

r.patch('/me', authenticate,
  validate(z.object({
    first_name: z.string().max(80).optional(),
    middle_name: z.string().max(80).optional(),
    last_name: z.string().max(80).optional(),
    full_name: z.string().max(160).optional(),
    position: z.string().max(80).optional(),
    title: z.string().max(80).optional(),
    phone: z.string().max(25).optional(),
    address: z.string().max(150).optional(),
    city: z.string().max(80).optional(),
    emergency_contact: z.string().max(100).optional(),
  })),
  asyncH(async (req, res) => {
    const allowedFields = ['first_name', 'middle_name', 'last_name', 'full_name', 'position', 'phone', 'address', 'city', 'emergency_contact'];
    const updatePayload = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updatePayload[key] = req.body[key];
    }
    if (req.body.title !== undefined && updatePayload.position === undefined) {
      updatePayload.position = req.body.title;
    }
    if (!updatePayload.full_name && (updatePayload.first_name || updatePayload.last_name)) {
      updatePayload.full_name = [updatePayload.first_name, updatePayload.middle_name, updatePayload.last_name].filter(Boolean).join(' ');
    }
    const sysAdmin = await getSystemAdminClient().catch(() => null);
    const client = sysAdmin || req.sb || admin;
    const { data, error } = await client.from('profiles')
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
      let updated = false;
      try {
        const { error } = await admin.auth.admin.updateUserById(req.user.id, { password });
        if (!error) updated = true;
      } catch {}

      if (!updated && req.sb) {
        const { error: sbErr } = await req.sb.auth.updateUser({ password });
        if (sbErr) throw sbErr;
        updated = true;
      }

      // Synchronize password to profiles table (trigger trg_profile_password_hash will auto-hash it)
      const sysAdmin = await getSystemAdminClient().catch(() => null);
      const client = sysAdmin || admin;
      await client.from('profiles').update({ password }).eq('id', req.user.id).catch(() => {});

      // Synchronize password to employee_accounts table if user is linked to staff / management
      const userEmail = req.user.email;
      if (req.user.id || userEmail) {
        const empFilter = [];
        if (req.user.id) empFilter.push(`auth_user_id.eq.${req.user.id}`);
        if (userEmail) empFilter.push(`email.eq.${userEmail}`);
        await client.from('employee_accounts')
          .update({ password, updated_at: new Date().toISOString() })
          .or(empFilter.join(','))
          .catch(() => {});
      }

      pingSMS({ profileId: req.user.id, toPhone: req.user.phone, body: 'J & D Beach House: Your account password was updated successfully.' }).catch(() => {});
      return res.json({
        success: true,
        message: 'Password updated successfully',
        has_password: true,
        password_status: 'Configured',
      });
    } catch (err) {
      throw new ApiError(500, err.message);
    }
  }));

// Accounts Directory: List, Search, Provision & Role Modification
r.get('/admin/customers', authenticate, requireAdmin, asyncH(async (req, res) => {
  const query = String(req.query.q || '').trim();
  const roleFilter = String(req.query.role || '').trim();
  const sysAdmin = await getSystemAdminClient().catch(() => null);
  const client = sysAdmin || req.sb || admin;

  const resolveStaffEmail = (p) => {
    if (p.email) return p.email;
    if (p.id === req.user?.id && req.user?.email) {
      return req.user.email;
    }
    return '';
  };

  // Tier 1: Unified profiles query with reservations and orders joins
  try {
    let q = client.from('profiles').select('*, reservations(id, total_php, status), resort_orders(id, status)')
      .order('created_at', { ascending: false });
    
    if (query) {
      q = q.or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,username.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`);
    }
    if (roleFilter) {
      q = q.eq('role', roleFilter);
    }

    const { data, error } = await q.limit(100);
    if (!error && Array.isArray(data) && data.length > 0) {
      return res.json(data.map((p) => ({
        ...p,
        email: resolveStaffEmail(p),
        stays_count: p.reservations?.length || 0,
        orders_count: p.resort_orders?.length || 0,
        total_spent_php: (p.reservations || []).reduce((acc, r) => acc + (r.total_php || 0), 0),
      })));
    }
  } catch (err) {
    console.warn('[Admin Customers] Tier 1 query notice:', err.message);
  }

  // Tier 2: Resilient fallback: simple profiles select without joins
  try {
    let q = client.from('profiles').select('*').order('created_at', { ascending: false });
    if (query) {
      q = q.or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,username.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`);
    }
    if (roleFilter) {
      q = q.eq('role', roleFilter);
    }
    const { data, error } = await q.limit(100);
    if (!error && Array.isArray(data) && data.length > 0) {
      return res.json(data.map((p) => ({
        ...p,
        email: resolveStaffEmail(p),
        stays_count: 0,
        orders_count: 0,
        total_spent_php: 0,
      })));
    }
  } catch (err) {
    console.warn('[Admin Customers] Tier 2 query notice:', err.message);
  }

  // Tier 3: Physical separated tables fallback (users + customers)
  try {
    const fallbackClient = admin || client;
    const [staffRes, custRes] = await Promise.all([
      fallbackClient.from('users').select('*').order('created_at', { ascending: false }).limit(60).catch(() => ({ data: [] })),
      fallbackClient.from('customers').select('*').order('created_at', { ascending: false }).limit(60).catch(() => ({ data: [] })),
    ]);

    const combined = [
      ...(Array.isArray(staffRes.data) ? staffRes.data : []),
      ...(Array.isArray(custRes.data) ? custRes.data : [])
    ];

    if (combined.length > 0) {
      let filtered = combined;
      if (roleFilter) {
        filtered = filtered.filter(u => u.role === roleFilter);
      }
      if (query) {
        const ql = query.toLowerCase();
        filtered = filtered.filter(u =>
          (u.full_name && u.full_name.toLowerCase().includes(ql)) ||
          (u.email && u.email.toLowerCase().includes(ql)) ||
          (u.username && u.username.toLowerCase().includes(ql)) ||
          (u.phone && u.phone.toLowerCase().includes(ql))
        );
      }
      return res.json(filtered.map((p) => ({
        ...p,
        email: resolveStaffEmail(p),
        stays_count: p.total_stays || 0,
        orders_count: 0,
        total_spent_php: 0,
      })));
    }
  } catch (err) {
    console.warn('[Admin Customers] Tier 3 query notice:', err.message);
  }

  return res.json([]);
}));

// Provision New Staff Account
r.post('/admin/users', authenticate, requireAdmin,
  validate(z.object({
    first_name: z.string().optional(),
    middle_name: z.string().optional(),
    last_name: z.string().optional(),
    full_name: z.string().optional(),
    username: z.string().optional(),
    email: z.string().email(),
    password: z.string().min(6),
    phone: z.string().optional(),
    role: z.enum(['customer', 'staff', 'receptionist', 'accounting', 'administrator']),
  })),
  asyncH(async (req, res) => {
    let { first_name = '', middle_name = '', last_name = '', full_name, username, email, password, phone, role } = req.body;
    if (!full_name) {
      full_name = [first_name, middle_name, last_name].filter(Boolean).join(' ') || 'Resort User';
    }
    const cleanUsername = (username || email.split('@')[0]).trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');

    let authUser = null;
    try {
      const { data, error } = await admin.auth.admin.createUser({
        email, password, user_metadata: { first_name, middle_name, last_name, full_name, username: cleanUsername, phone, role }, email_confirm: true,
      });
      if (!error && data?.user) authUser = data;
    } catch {}

    if (!authUser) {
      const { data, error } = await (req.sb || admin).auth.signUp({
        email, password, options: { data: { first_name, middle_name, last_name, full_name, username: cleanUsername, phone, role } }
      });
      if (error) throw new ApiError(400, error.message);
      authUser = data;
    }

    const client = req.sb || admin;
    const { data: prof, error: profErr } = await client.from('profiles')
      .upsert({ id: authUser.user.id, email, username: cleanUsername, first_name, middle_name, last_name, full_name, phone, role })
      .select().single();
    if (profErr) {
      console.warn('[Admin Create User] Profile upsert notice:', profErr.message);
    }

    const createdRecord = prof || {
      id: authUser.user.id,
      email,
      username: cleanUsername,
      first_name,
      middle_name,
      last_name,
      full_name,
      phone,
      role
    };

    await logAuditEvent({
      actor: req.user,
      action: role === 'administrator' ? 'ADMIN_PROVISIONED' : 'STAFF_PROVISIONED',
      resourceType: 'user',
      resourceId: authUser.user.id,
      details: { email, full_name, role },
      req,
    });

    return res.status(201).json(createdRecord);
  }));

// Modify Account Role
r.patch('/admin/users/:id/role', authenticate, requireAdmin,
  validate(z.object({
    role: z.enum(['customer', 'staff', 'receptionist', 'accounting', 'administrator']),
  })),
  asyncH(async (req, res) => {
    const { role } = req.body;
    const client = req.sb || admin;

    // Disallow promoting customer accounts - new employees/hirees must be provisioned directly
    const { data: existingProf } = await client.from('profiles').select('role, full_name').eq('id', req.params.id).maybeSingle();
    if (existingProf && (existingProf.role === 'customer' || !existingProf.role) && role !== 'customer') {
      throw new ApiError(400, 'Customer accounts cannot be promoted. To onboard new employees or hirees, please provision a new staff account directly.');
    }

    const { data, error } = await client.from('profiles')
      .update({ role }).eq('id', req.params.id).select().single();
    if (error) throw new ApiError(500, error.message);

    await logAuditEvent({
      actor: req.user,
      action: 'ROLE_UPDATE',
      resourceType: 'user',
      resourceId: req.params.id,
      details: { new_role: role, full_name: data.full_name },
      req,
    });

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

    try {
      const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
        password: new_password,
      });
      if (authErr) console.warn('[Admin Reset Password] Admin auth notice:', authErr.message);
    } catch {}

    const client = req.sb || admin;
    const { data: prof } = await client.from('profiles').select('full_name, phone').eq('id', userId).single();
    if (prof?.phone) {
      pingSMS({
        profileId: userId,
        toPhone: prof.phone,
        body: `Resort Account Recovery: Your password has been reset by administration. Your new password is: ${new_password}`,
      }).catch(() => {});
    }

    return res.json({ success: true, message: `Password reset successfully for ${prof?.full_name || 'account'}` });
  }));

// Administrative Account Details Update
r.patch('/admin/users/:id', authenticate, requireAdmin,
  validate(z.object({
    full_name: z.string().optional(),
    first_name: z.string().optional(),
    middle_name: z.string().optional(),
    last_name: z.string().optional(),
    username: z.string().optional(),
    phone: z.string().optional(),
    role: z.enum(['customer', 'staff', 'receptionist', 'accounting', 'administrator']).optional(),
  })),
  asyncH(async (req, res) => {
    const userId = req.params.id;
    const { full_name, first_name, middle_name, last_name, username, phone, role } = req.body;

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (first_name !== undefined) updates.first_name = first_name;
    if (middle_name !== undefined) updates.middle_name = middle_name;
    if (last_name !== undefined) updates.last_name = last_name;
    if (username !== undefined) updates.username = username;
    if (phone !== undefined) updates.phone = phone;
    if (role !== undefined) updates.role = role;

    const client = req.sb || admin;
    if (role && role !== 'customer') {
      const { data: targetProf } = await client.from('profiles').select('role').eq('id', userId).maybeSingle();
      if (targetProf && (targetProf.role === 'customer' || !targetProf.role)) {
        throw new ApiError(400, 'Customer accounts cannot be promoted. To onboard new employees or hirees, please provision a new staff account directly.');
      }
    }

    const { data, error } = await client.from('profiles').update(updates).eq('id', userId).select().single();
    if (error) throw new ApiError(500, error.message);

    // Sync auth metadata if applicable
    try {
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: updates,
      });
    } catch {}

    await logAuditEvent({
      actor: req.user,
      action: 'USER_PROFILE_UPDATED',
      resourceType: 'user',
      resourceId: userId,
      details: { updates, target_user: data?.full_name || userId },
      req,
    });

    return res.json(data);
  }));

// Helper: Permanent deletion of user account credentials while preserving prior business records
export async function deleteUserPermanently(userId) {
  const sysAdmin = await getSystemAdminClient().catch(() => null);
  const client = sysAdmin || admin;

  // 1. Fetch user profile for audit & record
  let prof = null;
  try {
    const { data } = await client.from('profiles').select('id, full_name, email, role').eq('id', userId).maybeSingle();
    prof = data;
  } catch {}

  // 2. Cascade delete authentication tokens and transient notifications
  try { await client.from('user_confirmations').delete().eq('user_id', userId); } catch (e) { console.warn('[Delete User] Confirmations notice:', e.message); }
  try { await client.from('chat_messages').delete().eq('profile_id', userId); } catch (e) { console.warn('[Delete User] Chat notice:', e.message); }
  try { await client.from('notifications').delete().eq('profile_id', userId); } catch (e) { console.warn('[Delete User] Notifications notice:', e.message); }

  // 3. PRIOR BUSINESS RECORDS ARE PRESERVED (Reservations, Orders, Reviews remain in ledger)
  try {
    await client.from('reservations').update({ guest_id: null }).eq('guest_id', userId);
  } catch (e) {
    console.warn('[Delete User] Preserve reservations notice:', e.message);
  }
  try {
    await client.from('resort_orders').update({ guest_id: null }).eq('guest_id', userId);
  } catch (e) {
    console.warn('[Delete User] Preserve orders notice:', e.message);
  }
  try {
    await client.from('reviews').update({ guest_id: null }).eq('guest_id', userId);
  } catch (e) {
    console.warn('[Delete User] Preserve reviews notice:', e.message);
  }

  // 4. Delete user account from identity and profile tables: customers, users, profiles
  try { await client.from('customers').delete().eq('id', userId); } catch (e) { console.warn('[Delete User] Customers notice:', e.message); }
  try { await client.from('users').delete().eq('id', userId); } catch (e) { console.warn('[Delete User] Users notice:', e.message); }
  try { await client.from('profiles').delete().eq('id', userId); } catch (e) { console.warn('[Delete User] Profiles notice:', e.message); }

  // 5. Delete from Supabase Auth admin so credentials can no longer sign in
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch (err) {
    console.warn('[Delete User] Auth admin notice:', err.message);
  }

  return prof || { id: userId };
}

// Self-Service Account Deletion (Guest or Staff permanently deletes own account)
r.delete('/me', authenticate, asyncH(async (req, res) => {
  const userId = req.user.id;
  const deletedInfo = await deleteUserPermanently(userId);

  await logAuditEvent({
    actor: req.user,
    action: 'USER_ACCOUNT_SELF_DELETED',
    resourceType: 'user',
    resourceId: userId,
    details: {
      deleted_user: deletedInfo?.full_name || req.user.full_name || userId,
      email: deletedInfo?.email || req.user.email,
      role: deletedInfo?.role || req.user.role,
      self_service: true,
    },
    req,
  });

  return res.json({
    success: true,
    message: 'Your account and associated profile data have been permanently deleted.'
  });
}));

// Administrative Account Deletion
r.delete('/admin/users/:id', authenticate, requireAdmin, asyncH(async (req, res) => {
  const userId = req.params.id;
  if (req.user?.id === userId) {
    throw new ApiError(400, 'Cannot delete currently signed-in administrative account.');
  }

  const deletedInfo = await deleteUserPermanently(userId);

  await logAuditEvent({
    actor: req.user,
    action: 'USER_DELETED',
    resourceType: 'user',
    resourceId: userId,
    details: {
      deleted_user: deletedInfo?.full_name || userId,
      email: deletedInfo?.email,
      role: deletedInfo?.role
    },
    req,
  });

  return res.json({
    success: true,
    message: `Account for ${deletedInfo?.full_name || deletedInfo?.email || userId} has been permanently deleted.`
  });
}));

export default r;
