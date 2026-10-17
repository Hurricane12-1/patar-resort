import { Router } from 'express';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate, requireStaffOrAdmin } from '../middleware/auth.js';
import { getSystemAdminClient, admin } from '../lib/supabase.js';

const r = Router();

const fetchNotificationsHandler = asyncH(async (req, res) => {
  try {
    const isStaffOrAdmin = ['administrator', 'admin', 'staff', 'receptionist', 'accounting', 'housekeeping', 'kitchen'].includes(req.user?.role);
    const client = isStaffOrAdmin ? await getSystemAdminClient() : (req.sb || admin);

    let query = client.from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!isStaffOrAdmin) {
      query = query.eq('profile_id', req.user.id);
    }

    const { data, error } = await query;
    if (error) return res.json([]);
    return res.json(data || []);
  } catch {
    return res.json([]);
  }
});

r.get('/notifications/mine', authenticate, fetchNotificationsHandler);
r.get('/notifications', authenticate, requireStaffOrAdmin, fetchNotificationsHandler);

r.patch('/notifications/:id/read', authenticate, asyncH(async (req, res) => {
  try {
    const client = await getSystemAdminClient();
    const { data, error } = await client
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw new ApiError(400, error.message);
    res.json({ status: 'success', data });
  } catch (err) {
    res.json({ status: 'ok' });
  }
}));

r.post('/notifications/read-all', authenticate, asyncH(async (req, res) => {
  try {
    const isStaffOrAdmin = ['administrator', 'admin', 'staff', 'receptionist', 'accounting', 'housekeeping', 'kitchen'].includes(req.user?.role);
    const client = await getSystemAdminClient();
    let query = client
      .from('notifications')
      .update({ is_read: true });
    if (!isStaffOrAdmin) {
      query = query.eq('profile_id', req.user.id);
    }
    await query;
    res.json({ status: 'success' });
  } catch (err) {
    res.json({ status: 'ok' });
  }
}));

r.patch('/notifications/read-all', authenticate, asyncH(async (req, res) => {
  try {
    const isStaffOrAdmin = ['administrator', 'admin', 'staff', 'receptionist', 'accounting', 'housekeeping', 'kitchen'].includes(req.user?.role);
    const client = await getSystemAdminClient();
    let query = client
      .from('notifications')
      .update({ is_read: true });
    if (!isStaffOrAdmin) {
      query = query.eq('profile_id', req.user.id);
    }
    await query;
    res.json({ status: 'success' });
  } catch (err) {
    res.json({ status: 'ok' });
  }
}));

// DELETE single notification
r.delete('/notifications/:id', authenticate, asyncH(async (req, res) => {
  try {
    const isStaffOrAdmin = ['administrator', 'admin', 'staff', 'receptionist', 'accounting', 'housekeeping', 'kitchen'].includes(req.user?.role);
    const client = isStaffOrAdmin ? await getSystemAdminClient() : (req.sb || admin);
    let query = client.from('notifications').delete().eq('id', req.params.id);
    if (!isStaffOrAdmin) {
      query = query.eq('profile_id', req.user.id);
    }
    const { error } = await query;
    if (error) throw new ApiError(400, error.message);
    res.json({ status: 'success' });
  } catch (err) {
    res.json({ status: 'ok' });
  }
}));

// DELETE / Clear all notifications
r.delete('/notifications', authenticate, asyncH(async (req, res) => {
  try {
    const isStaffOrAdmin = ['administrator', 'admin', 'staff', 'receptionist', 'accounting', 'housekeeping', 'kitchen'].includes(req.user?.role);
    const client = isStaffOrAdmin ? await getSystemAdminClient() : (req.sb || admin);
    let query = client.from('notifications').delete();
    if (!isStaffOrAdmin) {
      query = query.eq('profile_id', req.user.id);
    } else {
      query = query.neq('id', '00000000-0000-0000-0000-000000000000');
    }
    await query;
    res.json({ status: 'success' });
  } catch (err) {
    res.json({ status: 'ok' });
  }
}));

export default r;
