import { Router } from 'express';
import { asyncH } from '../middleware/errors.js';
import { authenticate } from '../middleware/auth.js';

const r = Router();

// Sample Resort Operational CSV Data
const SAMPLE_RESORT_CSV = `Account ID,First Name,Middle Name,Last Name,Full Name,Email,Role,Status,Total Spent (PHP)
usr-1,Johannes,Von,Shicksal,Johannes Von Shicksal,jvs001@resortmanagement.ph,administrator,Active,0
usr-2,Elena,Santos,Ramos,Elena Santos Ramos,esr002@resortmanagement.ph,receptionist,Active,0
usr-3,Carlos,Mendoza,Ledger,Carlos Mendoza Ledger,cml003@resortmanagement.ph,accounting,Active,0
usr-4,Juan,Dela,Cruz,Juan Dela Cruz,user@gmail.com,customer,Checked-In,14750
usr-5,Maria,Clara,Santos,Maria Clara Santos,maria.santos@gmail.com,customer,Confirmed,7200`;

// GET /api/csv/sample - Returns sample resort CSV data
r.get('/csv/sample', authenticate, (_req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'inline; filename="jd_beach_house_sample.csv"');
  res.send(SAMPLE_RESORT_CSV);
});

// POST /api/csv/parse - Accepts raw CSV text payload and returns structured JSON rows
r.post('/csv/parse', authenticate, asyncH(async (req, res) => {
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
