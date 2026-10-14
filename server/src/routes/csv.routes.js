import { Router } from 'express';
import { asyncH } from '../middleware/errors.js';
import { authenticate, requireStaffOrAdmin } from '../middleware/auth.js';
import { admin } from '../lib/supabase.js';

const r = Router();

// GET /api/csv/sample - Returns live resort accounts & operations CSV directly from Supabase
r.get('/csv/sample', authenticate, requireStaffOrAdmin, asyncH(async (_req, res) => {
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, first_name, middle_name, last_name, full_name, role, reservations(total_php, status)')
    .order('created_at', { ascending: true })
    .limit(100);

  const header = 'Account ID,First Name,Middle Name,Last Name,Full Name,Role,Status,Total Spent (PHP)';
  const lines = [header];

  if (!error && profiles && profiles.length > 0) {
    for (const p of profiles) {
      const stays = p.reservations || [];
      const totalSpent = stays.reduce((sum, s) => sum + (s.total_php || 0), 0);
      const activeStay = stays.find((s) => ['checked_in', 'confirmed'].includes(s.status));
      const status = activeStay
        ? (activeStay.status === 'checked_in' ? 'Checked-In' : 'Confirmed')
        : (stays.length > 0 ? 'Past Guest' : 'Active');

      const safe = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
      lines.push([
        safe(p.id.slice(0, 8)),
        safe(p.first_name),
        safe(p.middle_name),
        safe(p.last_name),
        safe(p.full_name),
        safe(p.role),
        safe(status),
        totalSpent,
      ].join(','));
    }
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'inline; filename="jd_beach_house_accounts.csv"');
  res.send(lines.join('\n'));
}));

// POST /api/csv/parse - Accepts raw CSV text payload and returns structured JSON rows
r.post('/csv/parse', authenticate, requireStaffOrAdmin, asyncH(async (req, res) => {
  const { csv_text } = req.body || {};
  if (!csv_text || typeof csv_text !== 'string') {
    return res.status(400).json({ error: 'csv_text payload required' });
  }

  const lines = csv_text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return res.json({ headers: [], rows: [], count: 0 });
  }

  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.replace(/^"|"$/g, '').trim());
    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] || '';
    });
    rows.push(rowObj);
  }

  res.json({ headers, rows, count: rows.length });
}));

export default r;
