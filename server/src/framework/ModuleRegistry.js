/**
 * ============================================================================
 * J & D Beach House · Isolated Modularity Base
 * Module Registry: Central State & Telemetry Authority
 * Location: Brgy. Patar, Bolinao, Pangasinan (16.3042° N, 119.7821° E)
 * ============================================================================
 */

class ModuleRegistry {
  constructor() {
    this.modules = new Map();
    this.createdAt = new Date().toISOString();
  }

  /**
   * Register a module in the registry
   * @param {Object} config 
   */
  register(config) {
    const {
      name,
      version = '1.0.0',
      description = '',
      type = 'core-route',
      mountPath = '/api',
      endpoints = [],
      status = 'HEALTHY',
      healthCheck = null,
      metadata = {},
    } = config;

    if (!name) {
      throw new Error('Module registration failed: "name" is required.');
    }

    const entry = {
      name,
      version,
      description,
      type,
      mountPath,
      status, // HEALTHY | DEGRADED | FAILED
      endpoints,
      healthCheck,
      metadata,
      stats: {
        totalRequests: 0,
        successfulRequests: 0,
        errorCount: 0,
        consecutiveErrors: 0,
        lastError: null,
        loadedAt: new Date().toISOString(),
        lastActive: null,
      },
    };

    this.modules.set(name, entry);
    return entry;
  }

  /**
   * Record an incoming request handled by a specific module
   */
  recordRequest(name) {
    let mod = this.modules.get(name);
    if (!mod) {
      mod = this.register({ name, status: 'HEALTHY', description: `Auto-registered module: ${name}` });
    }
    mod.stats.totalRequests++;
    mod.stats.lastActive = new Date().toISOString();
  }

  /**
   * Record a successful request
   */
  recordSuccess(name) {
    const mod = this.modules.get(name);
    if (!mod) return;
    mod.stats.successfulRequests++;
    mod.stats.consecutiveErrors = 0;
    if (mod.status === 'DEGRADED') {
      mod.status = 'HEALTHY';
    }
  }

  /**
   * Record an isolated error within a module
   */
  recordError(name, error) {
    let mod = this.modules.get(name);
    if (!mod) {
      mod = this.register({ name, status: 'DEGRADED', description: `Auto-registered module: ${name}` });
    }

    mod.stats.errorCount++;
    mod.stats.consecutiveErrors++;
    mod.stats.lastError = {
      message: error?.message || String(error),
      code: error?.code || 'ERR_INTERNAL',
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
    };

    // If consecutive errors reach threshold (e.g. 5), set status to DEGRADED
    if (mod.stats.consecutiveErrors >= 5 && mod.status !== 'FAILED') {
      mod.status = 'DEGRADED';
    }
  }

  /**
   * Mark a module as explicitly FAILED (e.g. startup/import crash)
   */
  markFailed(name, error, extra = {}) {
    let mod = this.modules.get(name);
    if (!mod) {
      mod = this.register({
        name,
        status: 'FAILED',
        ...extra,
      });
    } else {
      mod.status = 'FAILED';
    }

    mod.stats.lastError = {
      message: error?.message || String(error),
      code: error?.code || 'ERR_INIT_FAILED',
      timestamp: new Date().toISOString(),
      stack: error?.stack,
    };

    return mod;
  }

  /**
   * Reset errors and restore health for a module
   */
  reset(name) {
    const mod = this.modules.get(name);
    if (!mod) return false;
    mod.stats.consecutiveErrors = 0;
    mod.stats.lastError = null;
    mod.status = 'HEALTHY';
    return true;
  }

  get(name) {
    return this.modules.get(name) || null;
  }

  getAll() {
    return Array.from(this.modules.values());
  }

  getSummary() {
    const all = this.getAll();
    return {
      total: all.length,
      healthy: all.filter(m => m.status === 'HEALTHY').length,
      degraded: all.filter(m => m.status === 'DEGRADED').length,
      failed: all.filter(m => m.status === 'FAILED').length,
      timestamp: new Date().toISOString(),
    };
  }
}

export const registry = new ModuleRegistry();
