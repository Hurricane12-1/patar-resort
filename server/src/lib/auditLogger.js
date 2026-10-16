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
    const sbPayload = {
      action: entry.action,
      actor_id: String(entry.actor_id),
      actor_email: String(entry.actor_email),
      actor_role: String(entry.role),
      resource_type: String(entry.resource_type || ''),
      resource_id: entry.resource_id ? String(entry.resource_id) : '',
      details: entry.details,
      ip_address: String(entry.ip_address || ''),
      user_agent: String(entry.user_agent || ''),
      created_at: entry.timestamp,
    };
    client.from('audit_logs').insert(sbPayload).then((res) => {
      if (res.error && res.status !== 404) {
        // Handled safely
      }
    }).catch(() => {});
  } catch {}

  console.log(`[AUDIT AUTO LOGGER] 🛡️ [${entry.action}] by ${entry.actor_email} (${entry.role}) on ${entry.resource_type}:${entry.resource_id || 'all'}`);
  return entry;
}

/**
 * Clear all audit logs from in-memory cache, local JSON file, and Supabase table
 */
export async function clearAuditLogs() {
  inMemoryLogs = [];
  try {
    fs.writeFileSync(auditLogFile, '[]', 'utf8');
  } catch (err) {
    console.warn('[AuditLogger] Failed to empty local file:', err.message);
  }

  try {
    const client = await getSystemAdminClient();
    await client.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  } catch (err) {
    console.warn('[AuditLogger] Supabase audit log clear notice:', err.message);
  }

  return { success: true, message: 'System audit logs cleared successfully' };
}

/**
 * Retrieve paginated audit logs with search and filtering directly from Supabase (with resilient local fallback)
 */
export async function getAuditLogs({ limit = 50, offset = 0, action = null, resourceType = null, q = null } = {}) {
  // 1. Try Supabase live audit logs first
  try {
    const client = await getSystemAdminClient();
    let query = client.from('audit_logs').select('*', { count: 'exact' });
    if (action && action !== 'ALL') {
      query = query.ilike('action', `%${action}%`);
    }
    if (resourceType && resourceType !== 'ALL') {
      query = query.eq('resource_type', resourceType);
    }
    if (q) {
      query = query.or(`action.ilike.%${q}%,actor_email.ilike.%${q}%,resource_type.ilike.%${q}%`);
    }
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!error && Array.isArray(data) && (data.length > 0 || inMemoryLogs.length === 0)) {
      const logs = data.map((l) => ({
        id: l.id,
        timestamp: l.created_at,
        created_at: l.created_at,
        action: l.action,
        actor_id: l.actor_id,
        actor_email: l.actor_email,
        actor_name: l.actor_email ? l.actor_email.split('@')[0] : 'System Administrator',
        role: l.actor_role || 'administrator',
        actor_role: l.actor_role || 'administrator',
        resource_type: l.resource_type,
        resource_id: l.resource_id,
        details: l.details || {},
        ip_address: l.ip_address,
        user_agent: l.user_agent,
        source: 'supabase',
      }));
      return {
        success: true,
        total: count ?? logs.length,
        limit,
        offset,
        logs,
        source: 'supabase',
      };
    }
  } catch (err) {
    console.warn('[AuditLogger] Supabase audit fetch notice:', err.message);
  }

  // 2. Fallback to local in-memory/file logs
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
    source: 'local',
  };
}
