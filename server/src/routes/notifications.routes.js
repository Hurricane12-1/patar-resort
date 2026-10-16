import { Router } from 'express';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate, requireStaffOrAdmin } from '../middleware/auth.js';
import { getSystemAdminClient, admin } from '../lib/supabase.js';

const r = Router();

r.get('/notifications/mine', authenticate, asyncH(async (req, res) => {
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
}));

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
    const client = await getSystemAdminClient();
    await client
      .from('notifications')
      .update({ is_read: true })
      .neq('status', 'cancelled');
    res.json({ status: 'success' });
  } catch (err) {
    res.json({ status: 'ok' });
  }
}));

export default r;
