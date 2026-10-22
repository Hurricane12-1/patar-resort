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

function parseUserAgent(ua) {
  if (!ua || ua === 'System Kernel') {
    return { device: 'Server / System', browser: 'System Service', os: 'Internal Runtime' };
  }
  let browser = 'Chrome';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/msie|trident/i.test(ua)) browser = 'Internet Explorer';
  else if (/postman/i.test(ua)) browser = 'Postman';
  else if (/curl/i.test(ua)) browser = 'cURL';
  
  let os = 'Windows';
  if (/windows nt 10/i.test(ua)) os = 'Windows 10/11';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let device = 'Desktop';
  if (/mobile/i.test(ua) || /android/i.test(ua) || /iphone/i.test(ua)) {
    device = 'Mobile';
  } else if (/tablet|ipad/i.test(ua)) {
    device = 'Tablet';
  }

  return { device, browser, os };
}

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
  const nowIso = new Date().toISOString();
  const parsedUa = parseUserAgent(userAgent);
  const roleStr = String(reqActor.role || 'system').toLowerCase();
  const isClient = roleStr === 'customer' || roleStr === 'client' || action === 'CUSTOMER_LOGIN';
  const category = isClient ? 'CLIENT' : 'EMPLOYEE';

  const entry = {
    id: `audit_${crypto.randomUUID()}`,
    timestamp: nowIso,
    created_at: nowIso,
    action: String(action || 'UNKNOWN_ACTION').toUpperCase(),
    actor_id: reqActor.id || 'system',
    actor_email: reqActor.email || 'system@janddbeachhouse.ph',
    actor_name: reqActor.full_name || reqActor.name || (reqActor.first_name ? `${reqActor.first_name} ${reqActor.last_name || ''}`.trim() : (reqActor.email ? reqActor.email.split('@')[0] : 'System Administrator')),
    role: reqActor.role || 'system',
    actor_role: reqActor.role || 'system',
    category,
    resource_type: resourceType,
    resource_id: resourceId ? String(resourceId) : null,
    details: typeof details === 'object' ? details : { message: String(details) },
    ip_address: ip,
    user_agent: userAgent,
    device: parsedUa.device,
    browser: parsedUa.browser,
    os: parsedUa.os,
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
      resource: String(entry.resource_type || entry.action || 'system'),
      details: {
        ...(entry.details || {}),
        actor_id: entry.actor_id,
        actor_email: entry.actor_email,
        actor_role: entry.role,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        user_agent: entry.user_agent,
      },
      ip_address: entry.ip_address || null,
      created_at: entry.timestamp,
    };
    if (entry.actor_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.actor_id)) {
      sbPayload.user_id = entry.actor_id;
    }
    client.from('audit_logs').insert(sbPayload).then((res) => {
      if (res.error && res.status !== 404) {
        // Handled safely
      }
    }).catch(() => {});
  } catch {}

  console.log(`[AUDIT AUTO LOGGER] 🛡️ [${entry.action}] by ${entry.actor_email} (${entry.role}) on ${entry.resource_type}:${entry.resource_id || 'all'} [${parsedUa.device} • ${parsedUa.browser}]`);
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
 * Retrieve paginated audit logs with search, specific day date filtering, and role filtering.
 * First queries live Supabase audit logs; if empty or offline, seamlessly falls back to resilient local logs.
 */
export async function getAuditLogs({
  limit = 50,
  offset = 0,
  action = null,
  resourceType = null,
  q = null,
  date = null,
  startDate = null,
  endDate = null,
  role = null,
} = {}) {
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

    if (role && role !== 'ALL') {
      const rLower = role.toLowerCase();
      if (rLower === 'employee' || rLower === 'staff') {
        query = query.not('actor_role', 'eq', 'customer').neq('action', 'CUSTOMER_LOGIN');
      } else if (rLower === 'client' || rLower === 'customer') {
        query = query.or('actor_role.eq.customer,action.eq.CUSTOMER_LOGIN,actor_role.eq.client');
      } else if (rLower === 'administrator' || rLower === 'admin') {
        query = query.or('actor_role.eq.administrator,actor_role.eq.admin,actor_role.eq.system');
      } else {
        query = query.eq('actor_role', role);
      }
    }

    if (startDate && endDate) {
      query = query.gte('created_at', startDate).lte('created_at', endDate);
    } else if (date && date !== 'ALL') {
      query = query.gte('created_at', `${date}T00:00:00.000Z`).lte('created_at', `${date}T23:59:59.999Z`);
    }

    if (q) {
      query = query.or(`action.ilike.%${q}%,actor_email.ilike.%${q}%,resource_type.ilike.%${q}%`);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!error && Array.isArray(data) && data.length > 0) {
      const logs = data.map((l) => {
        const parsed = parseUserAgent(l.user_agent);
        const rLower = String(l.actor_role || '').toLowerCase();
        const isClient = rLower === 'customer' || rLower === 'client' || l.action === 'CUSTOMER_LOGIN';
        return {
          id: l.id,
          timestamp: l.created_at,
          created_at: l.created_at,
          action: l.action,
          actor_id: l.actor_id,
          actor_email: l.actor_email,
          actor_name: l.actor_email ? l.actor_email.split('@')[0] : 'System Administrator',
          role: l.actor_role || 'administrator',
          actor_role: l.actor_role || 'administrator',
          category: isClient ? 'CLIENT' : 'EMPLOYEE',
          resource_type: l.resource_type,
          resource_id: l.resource_id,
          details: l.details || {},
          ip_address: l.ip_address || '127.0.0.1',
          user_agent: l.user_agent,
          device: l.device || parsed.device,
          browser: l.browser || parsed.browser,
          os: l.os || parsed.os,
          source: 'supabase',
        };
      });
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

  // 2. Resilient fallback to local in-memory/file logs
  if (inMemoryLogs.length === 0) {
    loadPersistedLogs();
  }
  let list = [...inMemoryLogs];

  if (action && action !== 'ALL') {
    const actUpper = action.toUpperCase();
    list = list.filter((l) => l.action === actUpper || l.action.startsWith(actUpper) || l.action.includes(actUpper));
  }

  if (resourceType && resourceType !== 'ALL') {
    list = list.filter((l) => l.resource_type?.toLowerCase() === resourceType.toLowerCase());
  }

  if (role && role !== 'ALL') {
    const rLower = role.toLowerCase();
    if (rLower === 'employee') {
      list = list.filter((l) => l.category === 'EMPLOYEE' || (!['customer', 'client'].includes(l.role?.toLowerCase()) && !['customer', 'client'].includes(l.actor_role?.toLowerCase()) && l.action !== 'CUSTOMER_LOGIN'));
    } else if (rLower === 'client' || rLower === 'customer') {
      list = list.filter((l) => l.category === 'CLIENT' || ['customer', 'client'].includes(l.role?.toLowerCase()) || ['customer', 'client'].includes(l.actor_role?.toLowerCase()) || l.action === 'CUSTOMER_LOGIN');
    } else if (rLower === 'staff') {
      list = list.filter((l) => ['staff', 'receptionist', 'accounting', 'manager', 'cashier'].includes(l.role?.toLowerCase()) || ['staff', 'receptionist', 'accounting'].includes(l.actor_role?.toLowerCase()) || l.action?.includes('STAFF'));
    } else if (rLower === 'administrator' || rLower === 'admin') {
      list = list.filter((l) => ['administrator', 'admin', 'system'].includes(l.role?.toLowerCase()) || ['administrator', 'admin', 'system'].includes(l.actor_role?.toLowerCase()));
    } else {
      list = list.filter((l) => l.role?.toLowerCase() === rLower || l.actor_role?.toLowerCase() === rLower);
    }
  }

  if (startDate && endDate) {
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    list = list.filter((l) => {
      const t = new Date(l.timestamp || l.created_at).getTime();
      return !isNaN(t) && t >= startMs && t <= endMs;
    });
  } else if (date && date !== 'ALL') {
    list = list.filter((l) => {
      const raw = (l.timestamp || l.created_at || '').slice(0, 10);
      return raw === date;
    });
  }

  if (q) {
    const qLower = q.toLowerCase();
    list = list.filter((l) =>
      l.action?.toLowerCase().includes(qLower) ||
      l.actor_email?.toLowerCase().includes(qLower) ||
      l.actor_name?.toLowerCase().includes(qLower) ||
      l.resource_type?.toLowerCase().includes(qLower) ||
      JSON.stringify(l.details || {}).toLowerCase().includes(qLower)
    );
  }

  const total = list.length;
  const paginated = list.slice(offset, offset + limit).map((l) => {
    const parsed = parseUserAgent(l.user_agent);
    const rLower = String(l.role || l.actor_role || '').toLowerCase();
    const isClient = rLower === 'customer' || rLower === 'client' || l.action === 'CUSTOMER_LOGIN';
    return {
      ...l,
      category: l.category || (isClient ? 'CLIENT' : 'EMPLOYEE'),
      device: l.device || parsed.device,
      browser: l.browser || parsed.browser,
      os: l.os || parsed.os,
    };
  });

  return {
    success: true,
    total,
    limit,
    offset,
    logs: paginated,
    source: 'local',
  };
}
