import { Router } from 'express';
import { z } from 'zod';
import { asyncH } from '../middleware/errors.js';
import { authenticate, requireRole, requireRecoveryOfficer } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { admin, getSystemAdminClient } from '../lib/supabase.js';
import {
  createEscalation,
  listEscalationCases,
  resolveEscalationCase,
  escalateCaseToGovernance,
} from '../lib/escalations.js';

const r = Router();

const requireCaseViewer = requireRole('administrator', 'admin', 'staff', 'receptionist', 'accounting');

const CATEGORIES = [
  'Inventory Overbooking Clash',
  'Digital Keycode Lockout',
  'Billing Discrepancy Dispute',
  'Identity / Manifest Mismatch',
  'Security / Property Incident',
];

const escalationSchema = z
  .object({
    reservation_id: z.string().uuid().nullable().optional(),
    room_id: z.string().uuid().nullable().optional(),
    category: z.enum(CATEGORIES),
    severity: z.enum(['medium', 'urgent', 'critical']),
    reason: z.string().min(5).max(1000),
  })
  .refine((value) => Boolean(value.reservation_id || value.room_id), {
    message: 'Choose a reservation or a room.',
  });

const decisionSchema = z.object({
  note: z.string().min(3).max(1000),
});

async function clientFor(req) {
  return req.sb || (await getSystemAdminClient().catch(() => null)) || admin;
}

r.post('/escalations', authenticate, requireCaseViewer, validate(escalationSchema), asyncH(async (req, res) => {
  const result = await createEscalation(await clientFor(req), req.user, req.body);
  return res.status(201).json(result);
}));

r.get('/escalations', authenticate, requireCaseViewer, asyncH(async (req, res) => {
  return res.json(await listEscalationCases(await clientFor(req)));
}));

r.post('/escalations/:id/resolve', authenticate, requireRecoveryOfficer, validate(decisionSchema), asyncH(async (req, res) => {
  const result = await resolveEscalationCase(await clientFor(req), req.user, req.params.id, req.body.note);
  return res.json(result);
}));

r.post('/escalations/:id/govern', authenticate, requireRecoveryOfficer, validate(decisionSchema), asyncH(async (req, res) => {
  const result = await escalateCaseToGovernance(await clientFor(req), req.user, req.params.id, req.body.note);
  return res.json(result);
}));

export default r;
