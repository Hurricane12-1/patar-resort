import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { admin, getSystemAdminClient } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbDir = path.resolve(__dirname, '../db');
const auditLogFile = path.join(dbDir, 'audit_logs.json');

// Ensure directory exists
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch {}
}

// In-memory buffer of recent logs (up to 2000 entries)
let inMemoryLogs = [];

function loadPersistedLogs() {
  try {
    if (fs.existsSync(auditLogFile)) {
      const raw = fs.readFileSync(auditLogFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        inMemoryLogs = parsed;
      }
    }
  } catch (err) {
    console.warn('[AuditLogger] Failed to load local audit log file:', err.message);
  }
}

function savePersistedLogs() {
  try {
    fs.writeFileSync(auditLogFile, JSON.stringify(inMemoryLogs.slice(-2000), null, 2), 'utf8');
  } catch (err) {
    console.warn('[AuditLogger] Failed to write local audit log file:', err.message);
  }
}

loadPersistedLogs();

/**
 * Log an administrative or security audit event automatically.
 *
 * @param {Object} options
 * @param {Object} [options.actor] - User profile/object triggering the action
 * @param {string} options.action - Action identifier (e.g. ROOM_CREATE, INVENTORY_DELETE)
 * @param {string} [options.resourceType] - Type of resource (room, inventory, user, booking)
 * @param {string|number} [options.resourceId] - Target ID
 * @param {Object|string} [options.details] - Detailed changes or payload
 * @param {import('express').Request} [options.req] - Express request for IP/UA capture
 * @returns {Promise<Object>} The created audit record
 */
export async function logAuditEvent({ actor, action, resourceType = 'system', resourceId = null, details = {}, req = null }) {
  const reqActor = req?.user || actor || {};
  const ip = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || req?.ip || '127.0.0.1';
  const userAgent = req?.headers?.['user-agent'] || 'System Kernel';

  const entry = {
    id: `audit_${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    action: String(action || 'UNKNOWN_ACTION').toUpperCase(),
    actor_id: reqActor.id || 'system',
    actor_email: reqActor.email || 'system@janddbeachhouse.ph',
    actor_name: reqActor.full_name || reqActor.name || (reqActor.first_name ? `${reqActor.first_name} ${reqActor.last_name || ''}`.trim() : 'System Administrator'),
    role: reqActor.role || 'system',
    resource_type: resourceType,
    resource_id: resourceId ? String(resourceId) : null,
    details: typeof details === 'object' ? details : { message: String(details) },
    ip_address: ip,
    user_agent: userAgent,
  };

  // 1. Add to in-memory store
  inMemoryLogs.unshift(entry);
  if (inMemoryLogs.length > 2000) {
    inMemoryLogs = inMemoryLogs.slice(0, 2000);
  }

  // 2. Persist to local disk
  savePersistedLogs();

  // 3. Attempt Supabase persistence (non-blocking)
  try {
    const client = await getSystemAdminClient();
    client.from('audit_logs').insert(entry).then((res) => {
      if (res.error && res.status !== 404) {
        // Table may not exist yet, which is safely handled by local file persistence
      }
    }).catch(() => {});
  } catch {}

  console.log(`[AUDIT AUTO LOGGER] 🛡️ [${entry.action}] by ${entry.actor_email} (${entry.role}) on ${entry.resource_type}:${entry.resource_id || 'all'}`);
  return entry;
}

/**
 * Retrieve paginated audit logs with search and filtering
 */
export async function getAuditLogs({ limit = 50, offset = 0, action = null, resourceType = null, q = null } = {}) {
  let list = [...inMemoryLogs];

  if (action && action !== 'ALL') {
    const actUpper = action.toUpperCase();
    list = list.filter((l) => l.action === actUpper || l.action.startsWith(actUpper));
  }

  if (resourceType && resourceType !== 'ALL') {
    list = list.filter((l) => l.resource_type?.toLowerCase() === resourceType.toLowerCase());
  }

  if (q) {
    const qLower = q.toLowerCase();
    list = list.filter((l) =>
      l.action.toLowerCase().includes(qLower) ||
      l.actor_email.toLowerCase().includes(qLower) ||
      l.actor_name.toLowerCase().includes(qLower) ||
      l.resource_type.toLowerCase().includes(qLower) ||
      JSON.stringify(l.details).toLowerCase().includes(qLower)
    );
  }

  const total = list.length;
  const paginated = list.slice(offset, offset + limit);

  return {
    success: true,
    total,
    limit,
    offset,
    logs: paginated,
  };
}
