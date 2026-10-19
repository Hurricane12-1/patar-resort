import { logAuditEvent } from '../lib/auditLogger.js';

// Threat Signatures for Next-Gen Web Application Firewall (NGWF) - Balanced Protection Without Excessive Restraints
const NGWF_SIGNATURES = [
  // SQL Injection Signatures
  /\bunion\s+(all\s+)?select\b/i,
  /\bdrop\s+(table|database|schema)\b/i,
  /\binsert\s+into\s+[a-z_`"]+/i,
  /\bdelete\s+from\s+[a-z_`"]+/i,
  /exec\s*\(\s*['"]/i,
  /\bwaitfor\s+delay\b/i,
  /\bpg_sleep\s*\(/i,
  /\bbenchmark\s*\(\s*\d+\s*,/i,
  /\bxp_cmdshell\b/i,
  /\binto\s+(outfile|dumpfile)\b/i,

  // Cross-Site Scripting (XSS) Signatures
  /<script\b[^>]*>/i,
  /javascript\s*:/i,
  /\bonerror\s*=/i,
  /\bonload\s*=/i,

  // Path Traversal & Null Byte Injection
  /%00/i,
  /\0/i,
  /\.\.\//i,
  /\.\.\\/i,
  /%2e%2e/i,

  // Remote Code Execution & Command Injection
  /cmd\.exe/i,
  /\/etc\/passwd/i,
  /\/bin\/sh/i,
  /powershell(?:\.exe)?\s+(?:-[a-zA-Z]+\s+)*(?:-[eE]n?c?|iex|invoke-expression)/i,
  /\$\{jndi:(?:ldap|rmi|dns|corba):/i,
  /\$\{(?:lower|upper):[^}]*\}/i,

  // Prototype Pollution
  /__proto__/i,
  /constructor\s*\[\s*['"]prototype['"]\s*\]/i,
];

// Active Threat & IP Quarantine Ring Buffers
const strikeMap = new Map();     // ip -> { strikes: number, firstStrikeAt: number, lastThreat: string }
const quarantineMap = new Map(); // ip -> { ip: string, quarantinedAt: number, expiresAt: number, reason: string, strikes: number }

const STRIKE_THRESHOLD = 3;                  // Escalates to active IP quarantine on 3 strikes
const STRIKE_WINDOW_MS = 10 * 60 * 1000;     // 10 minutes sliding window
const QUARANTINE_DURATION_MS = 60 * 60 * 1000; // 1 hour active lockout

function getClientIp(req) {
  if (!req) return '0.0.0.0';
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '0.0.0.0';
}

// Periodic cleanup of expired strike and quarantine records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of quarantineMap.entries()) {
    if (record.expiresAt <= now) {
      quarantineMap.delete(ip);
    }
  }
  for (const [ip, record] of strikeMap.entries()) {
    if (now - record.firstStrikeAt > STRIKE_WINDOW_MS) {
      strikeMap.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

function inspectPayload(val) {
  if (typeof val === 'string') {
    for (const pattern of NGWF_SIGNATURES) {
      if (pattern.test(val)) return { matched: true, pattern: pattern.toString() };
    }
  } else if (Array.isArray(val)) {
    for (const item of val) {
      const match = inspectPayload(item);
      if (match) return match;
    }
  } else if (val !== null && typeof val === 'object') {
    // Inspect all own property names including non-enumerable and __proto__
    const ownKeys = Object.getOwnPropertyNames(val);
    for (const key of ownKeys) {
      for (const pattern of NGWF_SIGNATURES) {
        if (pattern.test(key)) return { matched: true, pattern: `Object Key: ${key}` };
      }
      const match = inspectPayload(val[key]);
      if (match) return match;
    }

    // Inspect prototype tampering
    const proto = Object.getPrototypeOf(val);
    if (proto && proto !== Object.prototype && proto !== Array.prototype) {
      if (Object.keys(proto).length > 0) {
        return { matched: true, pattern: 'Prototype Chain Tampering (__proto__)' };
      }
    }
  }
  return null;
}

/**
 * Next-Gen Web Application Firewall (NGWF) Inspection Middleware
 * Layer 7 Deep Packet Inspection with Active IP Threat Quarantine
 */
export function ngwfFirewall(req, res, next) {
  const clientIp = getClientIp(req);
  const now = Date.now();

  // 1. Check if the incoming IP is actively quarantined
  if (quarantineMap.has(clientIp)) {
    const qRecord = quarantineMap.get(clientIp);
    if (qRecord.expiresAt > now) {
      const remainingSeconds = Math.ceil((qRecord.expiresAt - now) / 1000);
      return res.status(403).json({
        error: 'Access Denied: IP Quarantined Due to Repeat Malicious Probes',
        code: 'NGWF_IP_QUARANTINED',
        ip: clientIp,
        remaining_seconds: remainingSeconds,
        reason: qRecord.reason,
        quarantined_at: new Date(qRecord.quarantinedAt).toISOString(),
        timestamp: new Date().toISOString(),
      });
    } else {
      quarantineMap.delete(clientIp);
    }
  }

  // 2. Deep inspection of URL, query params, body, and params
  const isBackupImportRoute = req.originalUrl?.includes('/ledger/backup/import') || req.path?.includes('/ledger/backup/import');
  const threat =
    inspectPayload(req.originalUrl) ||
    inspectPayload(req.query) ||
    (!isBackupImportRoute ? inspectPayload(req.body) : null) ||
    inspectPayload(req.params);

  if (threat) {
    // Record strike for this IP
    let strikeData = strikeMap.get(clientIp);
    if (!strikeData || (now - strikeData.firstStrikeAt > STRIKE_WINDOW_MS)) {
      strikeData = { strikes: 1, firstStrikeAt: now, lastThreat: threat.pattern };
    } else {
      strikeData.strikes += 1;
      strikeData.lastThreat = threat.pattern;
    }
    strikeMap.set(clientIp, strikeData);

    console.warn(`[NGWF FIREWALL BLOCK] Threat strike ${strikeData.strikes}/${STRIKE_THRESHOLD} from IP: ${clientIp} | Pattern: ${threat.pattern} | URL: ${req.originalUrl}`);

    // Check if strike threshold reached -> Escalate to Active Quarantine
    if (strikeData.strikes >= STRIKE_THRESHOLD) {
      const expiresAt = now + QUARANTINE_DURATION_MS;
      quarantineMap.set(clientIp, {
        ip: clientIp,
        quarantinedAt: now,
        expiresAt,
        reason: `Automated quarantine: ${strikeData.strikes} attacks detected within sliding window (last: ${threat.pattern})`,
        strikes: strikeData.strikes,
      });

      // Emit high-priority security audit event
      logAuditEvent({
        actor: { full_name: 'NGWF Sentinel Engine', role: 'system' },
        action: 'IP_QUARANTINE_ACTIVATED',
        resourceType: 'network_firewall',
        resourceId: clientIp,
        details: {
          ip: clientIp,
          strikes: strikeData.strikes,
          trigger_pattern: threat.pattern,
          quarantine_duration_minutes: 60,
          url: req.originalUrl,
        },
        req,
      }).catch(() => {});

      return res.status(403).json({
        error: 'Access Denied: IP Quarantined Due to Repeat Malicious Probes',
        code: 'NGWF_IP_QUARANTINED',
        ip: clientIp,
        remaining_seconds: Math.ceil(QUARANTINE_DURATION_MS / 1000),
        strikes: strikeData.strikes,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(403).json({
      error: 'NGWF Firewall: Threat Payload Blocked',
      code: 'NGWF_THREAT_BLOCKED',
      strikes: strikeData.strikes,
      threshold: STRIKE_THRESHOLD,
      timestamp: new Date().toISOString(),
    });
  }

  next();
}

/**
 * Strict Path Upgrade & Normalization Middleware
 */
export function pathNormalizer(req, _res, next) {
  if (req.url) {
    let cleanUrl = req.url.replace(/\0/g, '').replace(/%00/gi, '');
    cleanUrl = cleanUrl.replace(/\/+/g, '/');
    req.url = cleanUrl;
  }
  next();
}

/**
 * Checks if a given IP is actively in quarantine.
 */
export function isIpQuarantined(ip) {
  const cleanIp = String(ip || '').trim();
  const record = quarantineMap.get(cleanIp);
  if (!record) return { quarantined: false, remaining_seconds: 0 };
  const now = Date.now();
  if (record.expiresAt <= now) {
    quarantineMap.delete(cleanIp);
    return { quarantined: false, remaining_seconds: 0 };
  }
  return {
    quarantined: true,
    remaining_seconds: Math.ceil((record.expiresAt - now) / 1000),
    reason: record.reason,
    quarantined_at: new Date(record.quarantinedAt).toISOString(),
    strikes: record.strikes,
  };
}

/**
 * Manually quarantines an IP address.
 */
export function quarantineIp(ip, reason = 'Administrative manual isolation', durationMinutes = 60) {
  const cleanIp = String(ip || '').trim();
  const now = Date.now();
  const durationMs = durationMinutes * 60 * 1000;
  const expiresAt = now + durationMs;
  quarantineMap.set(cleanIp, {
    ip: cleanIp,
    quarantinedAt: now,
    expiresAt,
    reason,
    strikes: (strikeMap.get(cleanIp)?.strikes || 0) + 1,
  });
  return { success: true, ip: cleanIp, expires_at: new Date(expiresAt).toISOString() };
}

/**
 * Releases/unbans an IP from quarantine.
 */
export async function releaseQuarantinedIp(ip, actor = null, req = null) {
  const cleanIp = String(ip || '').trim();
  const hadQuarantine = quarantineMap.has(cleanIp);
  quarantineMap.delete(cleanIp);
  strikeMap.delete(cleanIp);

  if (hadQuarantine) {
    await logAuditEvent({
      actor: actor || { full_name: 'Administrator', role: 'administrator' },
      action: 'IP_QUARANTINE_RELEASED',
      resourceType: 'network_firewall',
      resourceId: cleanIp,
      details: { ip: cleanIp, manual_release: true },
      req,
    }).catch(() => {});
  }

  return { success: true, released: hadQuarantine, ip: cleanIp };
}

/**
 * Returns summary stats for NGWF telemetry dashboard.
 */
export function getQuarantineStats() {
  const now = Date.now();
  const activeQuarantines = [];
  for (const [ip, record] of quarantineMap.entries()) {
    if (record.expiresAt > now) {
      activeQuarantines.push({
        ip,
        quarantined_at: new Date(record.quarantinedAt).toISOString(),
        expires_at: new Date(record.expiresAt).toISOString(),
        remaining_seconds: Math.ceil((record.expiresAt - now) / 1000),
        reason: record.reason,
        strikes: record.strikes,
      });
    }
  }

  let totalStrikes = 0;
  for (const item of strikeMap.values()) {
    totalStrikes += item.strikes;
  }

  return {
    active_quarantines_count: activeQuarantines.length,
    active_quarantines: activeQuarantines,
    strike_threshold: STRIKE_THRESHOLD,
    total_strikes_tracked: totalStrikes,
  };
}

/**
 * Clears all active quarantines and strike tracking.
 */
export function clearAllQuarantines() {
  const count = quarantineMap.size;
  quarantineMap.clear();
  strikeMap.clear();
  return { cleared_quarantines: count };
}
