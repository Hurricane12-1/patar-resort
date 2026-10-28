/**
 * ============================================================================
 * Rock View Beach Resort · Schema Collector API Routes
 * Exposes live schema catalog and SSL health to Backend and Clients
 * ============================================================================
 */

import { Router } from 'express';
import { getCachedCatalog, collectLiveSchema } from '../services/schemaCollector.js';
import { authenticate, requireStaffOrAdmin } from '../middleware/auth.js';

const r = Router();

/**
 * GET /api/schema/health
 * Public health check of SSL / TLS link to Supabase and collected tables
 */
r.get('/schema/health', async (_req, res) => {
  const catalog = getCachedCatalog();
  if (!catalog.collectedAt) {
    await collectLiveSchema().catch(() => {});
  }
  const current = getCachedCatalog();
  res.json({
    status: current.ssl.status === 'ACTIVE' ? 'HEALTHY' : 'DEGRADED',
    ssl: current.ssl,
    summary: current.summary,
    timestamp: current.collectedAt || new Date().toISOString(),
  });
});

/**
 * GET /api/schema/catalog
 * Complete table introspection dictionary (Staff & Admin only)
 */
r.get('/schema/catalog', authenticate, requireStaffOrAdmin, async (_req, res) => {
  let catalog = getCachedCatalog();
  if (!catalog.collectedAt) {
    catalog = await collectLiveSchema();
  }
  res.json({
    success: true,
    data: catalog,
  });
});

/**
 * POST /api/schema/refresh
 * Forces immediate SSL introspection against live Supabase database
 */
r.post('/schema/refresh', authenticate, requireStaffOrAdmin, async (_req, res) => {
  const updated = await collectLiveSchema();
  res.json({
    success: true,
    message: 'Schema successfully collected via SSL from Supabase.',
    data: updated,
  });
});

export default r;
