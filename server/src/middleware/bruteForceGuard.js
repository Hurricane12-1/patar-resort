import { logAuditEvent } from '../lib/auditLogger.js';

// In-Memory Ring Store for Fast Brute Force Defense Tracking
const attemptsMap = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_DURATION_MS = 15 * 60 * 1000;  // 15 minutes

function getCompoundKey(ip, identifier = '') {
  const cleanIp = String(ip || '0.0.0.0').trim();
  const cleanId = String(identifier || '').toLowerCase().trim();
  return `${cleanIp}:${cleanId}`;
}

// Periodic cleanup of expired brute force records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attemptsMap.entries()) {
    if (record.lockoutExpires && record.lockoutExpires < now) {
      attemptsMap.delete(key);
    } else if (now - record.firstAttemptAt > WINDOW_DURATION_MS && (!record.lockoutExpires || record.lockoutExpires < now)) {
      attemptsMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Checks if the given IP or account identifier is currently locked out.
 */
export function checkBruteForceLockout(ip, identifier = '') {
  if (process.env.NODE_ENV === 'test' && !process.env.ENFORCE_BRUTE_FORCE_TEST) {
    return { locked: false, remainingSeconds: 0 };
  }

  const key = getCompoundKey(ip, identifier);
  const record = attemptsMap.get(key);
  const now = Date.now();

  if (record && record.lockoutExpires && record.lockoutExpires > now) {
    const remainingSeconds = Math.ceil((record.lockoutExpires - now) / 1000);
    return {
      locked: true,
      remainingSeconds,
      attempts: record.attempts,
    };
  }

  return { locked: false, remainingSeconds: 0, attempts: record?.attempts || 0 };
}

/**
 * Records a failed authentication attempt. Escalates to lockout if threshold exceeded.
 */
export async function recordFailedAttempt(ip, identifier = '', req = null) {
  const key = getCompoundKey(ip, identifier);
  const now = Date.now();
  let record = attemptsMap.get(key);

  if (!record || (now - record.firstAttemptAt > WINDOW_DURATION_MS && (!record.lockoutExpires || record.lockoutExpires < now))) {
    record = {
      ip,
      identifier,
      attempts: 1,
      firstAttemptAt: now,
      lastAttemptAt: now,
      lockoutExpires: null,
    };
  } else {
    record.attempts += 1;
    record.lastAttemptAt = now;
  }

  // Check if threshold exceeded
  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockoutExpires = now + LOCKOUT_DURATION_MS;
    
    // Log high-priority security audit event
    await logAuditEvent({
      actor: { full_name: identifier || 'Unknown Attacker', role: 'guest' },
      action: 'BRUTE_FORCE_LOCKOUT_TRIGGERED',
      resourceType: 'auth_gate',
      resourceId: key,
      details: {
        ip,
        identifier,
        attempts: record.attempts,
        lockout_duration_minutes: 15,
        user_agent: req?.headers?.['user-agent'] || 'Unknown',
      },
      req,
    }).catch(() => {});
  }

  attemptsMap.set(key, record);
  return record;
}

/**
 * Resets failed attempts after successful authentication.
 */
export function recordSuccessfulAttempt(ip, identifier = '') {
  const key = getCompoundKey(ip, identifier);
  attemptsMap.delete(key);
}

/**
 * Returns summary stats for security telemetry dashboard.
 */
export function getBruteForceStats() {
  const now = Date.now();
  let activeLockouts = 0;
  let totalStrikes = 0;
  const lockedEntries = [];

  for (const [key, record] of attemptsMap.entries()) {
    totalStrikes += record.attempts;
    if (record.lockoutExpires && record.lockoutExpires > now) {
      activeLockouts += 1;
      lockedEntries.push({
        key,
        ip: record.ip,
        identifier: record.identifier,
        attempts: record.attempts,
        remaining_seconds: Math.ceil((record.lockoutExpires - now) / 1000),
      });
    }
  }

  return {
    active_lockouts: activeLockouts,
    total_strikes_tracked: totalStrikes,
    locked_entries: lockedEntries,
    max_threshold: MAX_ATTEMPTS,
    lockout_duration_minutes: 15,
  };
}

/**
 * Administrative reset of all brute force lockout records.
 */
export function clearAllLockouts() {
  const count = attemptsMap.size;
  attemptsMap.clear();
  return { cleared_entries: count };
}
