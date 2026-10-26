/**
 * ============================================================================
 * Rock View Beach Resort · Isolated Modularity Base
 * Framework Telemetry & Diagnostic Inspector Routes
 * Location: Brgy. Patar, Bolinao, Pangasinan (16.3042° N, 119.7821° E)
 * ============================================================================
 */

import { Router } from 'express';
import { registry } from './ModuleRegistry.js';

const r = Router();

/**
 * GET /api/system/modules
 * Overview of all registered modules, health statuses, and aggregated stats
 */
r.get('/system/modules', (_req, res) => {
  const summary = registry.getSummary();
  const modules = registry.getAll().map(mod => ({
    name: mod.name,
    version: mod.version,
    description: mod.description,
    type: mod.type,
    mountPath: mod.mountPath,
    status: mod.status,
    endpointsCount: mod.endpoints.length,
    stats: {
      totalRequests: mod.stats.totalRequests,
      successfulRequests: mod.stats.successfulRequests,
      errorCount: mod.stats.errorCount,
      lastError: mod.stats.lastError ? mod.stats.lastError.message : null,
      lastActive: mod.stats.lastActive,
      loadedAt: mod.stats.loadedAt,
    },
  }));

  res.json({
    framework: 'Rock View Isolated Modular Framework (IMF)',
    version: '1.2.0',
    summary,
    modules,
  });
});

/**
 * GET /api/system/modules/:name
 * Deep-dive diagnostic view for a specific module
 */
r.get('/system/modules/:name', (req, res) => {
  const mod = registry.get(req.params.name);
  if (!mod) {
    return res.status(404).json({
      error: 'MODULE_NOT_FOUND',
      message: `Module "${req.params.name}" is not registered in the framework.`,
    });
  }

  res.json({
    module: mod.name,
    version: mod.version,
    description: mod.description,
    type: mod.type,
    mountPath: mod.mountPath,
    status: mod.status,
    endpoints: mod.endpoints,
    metadata: mod.metadata,
    stats: mod.stats,
  });
});

/**
 * POST /api/system/modules/:name/reset
 * Resets a module's error state and restores status to HEALTHY
 */
r.post('/system/modules/:name/reset', (req, res) => {
  const success = registry.reset(req.params.name);
  if (!success) {
    return res.status(404).json({ error: 'MODULE_NOT_FOUND' });
  }

  res.json({
    success: true,
    message: `Module "${req.params.name}" state reset to HEALTHY.`,
    module: registry.get(req.params.name),
  });
});

export default r;
