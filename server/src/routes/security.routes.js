import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getCertificateStatus } from '../config/cert.js';
import { cspDirectives } from '../middleware/security.js';
import { getQuarantineStats, releaseQuarantinedIp, quarantineIp, clearAllQuarantines } from '../middleware/ngwfSecurity.js';
import { getBruteForceStats, clearAllLockouts } from '../middleware/bruteForceGuard.js';
import { getLimiterStats } from '../middleware/adaptiveLimiter.js';
import { registry } from '../framework/ModuleRegistry.js';
import { logAuditEvent, getAuditLogs } from '../lib/auditLogger.js';

const r = Router();

/**
 * GET /api/security/posture
 * Comprehensive Security Posture & Real-time Telemetry Health Check
 */
r.get('/security/posture', asyncH(async (_req, res) => {
  const certStatus = getCertificateStatus();
  const quarantineStats = getQuarantineStats();
  const bruteForceStats = getBruteForceStats();
  const limiterStats = getLimiterStats();
  const modulesSummary = registry.getSummary();
  const auditLogsSample = await getAuditLogs({ limit: 5 }).catch(() => ({ total: 0, logs: [] }));

  return res.json({
    status: 'OPTIMAL',
    security_level: 'DEFENSE_IN_DEPTH_LEVEL_4',
    tls: {
      enabled: certStatus.ssl_enabled,
      protocol: certStatus.protocol,
      ciphers: certStatus.ciphers,
      valid_until: certStatus.valid_until,
      issuer: certStatus.issuer,
      status: certStatus.status,
    },
    csp: {
      enforced: true,
      default_src: cspDirectives['default-src'],
      object_src: cspDirectives['object-src'],
      frame_ancestors: cspDirectives['frame-ancestors'],
      upgrade_insecure_requests: true,
    },
    firewall: {
      layer: 'Layer 7 Next-Gen Web Application Firewall (NGWF)',
      active: true,
      strike_threshold: quarantineStats.strike_threshold,
      total_threat_strikes: quarantineStats.total_strikes_tracked,
      active_quarantines_count: quarantineStats.active_quarantines_count,
      quarantined_ips: quarantineStats.active_quarantines,
    },
    brute_force_defense: {
      active: true,
      max_threshold: bruteForceStats.max_threshold,
      lockout_duration_minutes: bruteForceStats.lockout_duration_minutes,
      active_lockouts_count: bruteForceStats.active_lockouts,
      total_strikes_tracked: bruteForceStats.total_strikes_tracked,
      locked_entries: bruteForceStats.locked_entries,
    },
    rate_limiter: limiterStats,
    modules: modulesSummary,
    audit_telemetry: {
      total_audit_events: auditLogsSample.total,
      recent_sample_count: auditLogsSample.logs?.length || 0,
      storage: 'Supabase PostgreSQL + Resilient Local Ring Buffer',
    },
    timestamp: new Date().toISOString(),
  });
}));

/**
 * GET /api/security/quarantined-ips
 * Returns list of actively quarantined IPs
 */
r.get('/security/quarantined-ips', authenticate, requireAdmin, asyncH(async (_req, res) => {
  return res.json(getQuarantineStats());
}));

/**
 * POST /api/security/quarantine/release
 * Pardon / Unban an IP from active quarantine
 */
r.post('/security/quarantine/release',
  authenticate,
  requireAdmin,
  validate(z.object({
    ip: z.string().min(3),
  })),
  asyncH(async (req, res) => {
    const { ip } = req.body;
    const result = await releaseQuarantinedIp(ip, req.user, req);
    return res.json({
      success: true,
      message: `IP ${ip} has been successfully released from quarantine.`,
      result,
    });
  })
);

/**
 * POST /api/security/quarantine/isolate
 * Manually isolate an IP into active quarantine
 */
r.post('/security/quarantine/isolate',
  authenticate,
  requireAdmin,
  validate(z.object({
    ip: z.string().min(3),
    reason: z.string().optional(),
    duration_minutes: z.number().int().min(1).max(10080).optional(),
  })),
  asyncH(async (req, res) => {
    const { ip, reason, duration_minutes } = req.body;
    const result = quarantineIp(ip, reason || 'Manual Administrative Quarantine', duration_minutes || 60);
    await logAuditEvent({
      actor: req.user,
      action: 'MANUAL_IP_QUARANTINE',
      resourceType: 'network_firewall',
      resourceId: ip,
      details: { ip, reason, duration_minutes: duration_minutes || 60 },
      req,
    }).catch(() => {});
    return res.json({
      success: true,
      message: `IP ${ip} has been placed in quarantine.`,
      result,
    });
  })
);

/**
 * POST /api/security/quarantine/clear-all
 * Clear all active quarantines
 */
r.post('/security/quarantine/clear-all', authenticate, requireAdmin, asyncH(async (req, res) => {
  const result = clearAllQuarantines();
  await logAuditEvent({
    actor: req.user,
    action: 'ALL_IP_QUARANTINES_CLEARED',
    resourceType: 'network_firewall',
    resourceId: 'all',
    details: result,
    req,
  }).catch(() => {});
  return res.json({
    success: true,
    message: 'All IP quarantines have been successfully cleared.',
    result,
  });
}));

/**
 * GET /api/security/lockouts
 * Returns active brute force lockouts
 */
r.get('/security/lockouts', authenticate, requireAdmin, asyncH(async (_req, res) => {
  return res.json(getBruteForceStats());
}));

/**
 * POST /api/security/lockouts/clear
 * Clear all active brute force lockouts
 */
r.post('/security/lockouts/clear', authenticate, requireAdmin, asyncH(async (req, res) => {
  const result = clearAllLockouts();
  await logAuditEvent({
    actor: req.user,
    action: 'BRUTE_FORCE_LOCKOUTS_CLEARED',
    resourceType: 'auth_gate',
    resourceId: 'all',
    details: result,
    req,
  }).catch(() => {});
  return res.json({
    success: true,
    message: 'All brute force lockouts have been reset.',
    result,
  });
}));

export default r;
