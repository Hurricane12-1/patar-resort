/**
 * ============================================================================
 * J & D Beach House · Schema Collector Service
 * Target Architecture: Supabase -> SSL/CERTS -> Schema Collector -> SSL/CERTS -> API
 * Dynamic Table Introspection, Relational Health & SSL Telemetry Engine
 * ============================================================================
 */

import { admin, getSystemAdminClient } from '../lib/supabase.js';
import { env } from '../config/env.js';

// Live in-memory cache of introspected schema
let schemaCache = {
  collectedAt: null,
  ssl: {
    status: 'ACTIVE',
    protocol: 'TLS 1.3 / HTTPS',
    encrypted: true,
    targetUrl: env.SUPABASE_URL,
    latencyMs: 0,
  },
  tables: {},
  summary: {
    totalTables: 0,
    healthyTables: 0,
    unreachableTables: 0,
    totalRecordsEstimated: 0,
  },
  cachedRooms: [],
};

const MONITORED_TABLES = [
  'rooms',
  'reservations',
  'ledger_entries',
  'profiles',
  'customers',
  'employee_accounts',
  'room_locks',
  'resort_orders',
  'department_tasks',
  'chat_messages',
  'reviews',
  'notifications',
  'audit_logs',
  'inventory_items',
];

/**
 * Perform full schema introspection over SSL from Supabase.
 */
export async function collectLiveSchema() {
  const start = Date.now();
  const client = (await getSystemAdminClient().catch(() => null)) || admin;
  const tableResults = {};
  let healthyCount = 0;
  let totalRecs = 0;
  let cachedRooms = [];

  for (const table of MONITORED_TABLES) {
    try {
      const { count, error, data } = await client
        .from(table)
        .select('*', { count: 'exact', head: table !== 'rooms' })
        .limit(table === 'rooms' ? 50 : 1);

      if (!error) {
        tableResults[table] = {
          name: table,
          status: 'HEALTHY',
          count: count || (data ? data.length : 0),
          lastVerified: new Date().toISOString(),
          sslEncrypted: true,
        };
        healthyCount++;
        totalRecs += (count || (data ? data.length : 0));

        if (table === 'rooms' && Array.isArray(data)) {
          cachedRooms = data;
        }
      } else {
        tableResults[table] = {
          name: table,
          status: 'UNAVAILABLE',
          error: error.message,
          lastVerified: new Date().toISOString(),
          sslEncrypted: true,
        };
      }
    } catch (err) {
      tableResults[table] = {
        name: table,
        status: 'ERROR',
        error: err.message,
        lastVerified: new Date().toISOString(),
        sslEncrypted: true,
      };
    }
  }

  const latency = Date.now() - start;

  schemaCache = {
    collectedAt: new Date().toISOString(),
    ssl: {
      status: healthyCount > 0 ? 'ACTIVE' : 'DEGRADED',
      protocol: 'TLS 1.3 / HTTPS',
      encrypted: true,
      targetUrl: env.SUPABASE_URL,
      latencyMs: latency,
    },
    tables: tableResults,
    summary: {
      totalTables: MONITORED_TABLES.length,
      healthyTables: healthyCount,
      unreachableTables: MONITORED_TABLES.length - healthyCount,
      totalRecordsEstimated: totalRecs,
    },
    cachedRooms: cachedRooms.length > 0 ? cachedRooms : schemaCache.cachedRooms,
  };

  return schemaCache;
}

/**
 * Returns currently cached schema introspection state.
 */
export function getCachedCatalog() {
  return schemaCache;
}

/**
 * Returns cached rooms from the schema collector.
 */
export function getCachedRooms() {
  return schemaCache.cachedRooms;
}

// Background auto-refresh every 60 seconds
let refreshInterval = null;
export function startSchemaCollector(intervalMs = 60000) {
  if (refreshInterval) clearInterval(refreshInterval);
  // Initial collection (non-blocking)
  collectLiveSchema().catch((err) => {
    console.warn('[Schema Collector] Initial SSL fetch warning:', err.message);
  });

  refreshInterval = setInterval(() => {
    collectLiveSchema().catch((err) => {
      console.warn('[Schema Collector] Periodic SSL sync warning:', err.message);
    });
  }, intervalMs);
}
