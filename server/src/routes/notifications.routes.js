import { Router } from 'express';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate } from '../middleware/auth.js';

const r = Router();
r.get('/notifications/mine', authenticate, asyncH(async (req, res) => {
  try {
    const { data, error } = await req.sb.from('notifications')
      .select('*').order('created_at', { ascending: false }).limit(20);
    if (error) return res.json([]);
    return res.json(data || []);
  } catch {
    return res.json([]);
  }
}));
export default r;
