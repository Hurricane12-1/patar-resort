import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getAuditLogs, logAuditEvent } from '../lib/auditLogger.js';

const r = Router();

/**
 * GET /api/audit-logs
 * Strictly mandatory RBAC: Only authenticated Administrators can inspect system audit logs.
 */
r.get('/audit-logs', authenticate, requireAdmin, asyncH(async (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const action = req.query.action || null;
  const resourceType = req.query.resource_type || null;
  const q = req.query.q || null;

  const result = await getAuditLogs({ limit, offset, action, resourceType, q });
  return res.json(result);
}));

/**
 * POST /api/audit-logs
 * Record an explicit security event or manual audit entry
 */
r.post('/audit-logs', authenticate, requireAdmin,
  validate(z.object({
    action: z.string().min(2).max(64),
    resource_type: z.string().default('system'),
    resource_id: z.string().optional(),
    details: z.any().optional(),
  })),
  asyncH(async (req, res) => {
    const entry = await logAuditEvent({
      actor: req.user,
      action: req.body.action,
      resourceType: req.body.resource_type,
      resourceId: req.body.resource_id,
      details: req.body.details || {},
      req,
    });
    return res.status(201).json({ success: true, log: entry });
  })
);

export default r;
