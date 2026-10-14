/**
 * ============================================================================
 * J & D Beach House · Isolated Modularity Base
 * Module Sandbox: Per-Module Bulkhead & Error Boundary
 * Location: Brgy. Patar, Bolinao, Pangasinan (16.3042° N, 119.7821° E)
 * ============================================================================
 */

import { Router } from 'express';
import { registry } from './ModuleRegistry.js';
import crypto from 'crypto';

/**
 * Extracts route definitions from an Express router for telemetry
 * @param {import('express').Router} router 
 * @returns {Array<{ method: string, path: string }>}
 */
export function extractEndpoints(router) {
  const endpoints = [];
  if (!router || !router.stack) return endpoints;

  for (const layer of router.stack) {
    if (layer.route) {
      const path = layer.route.path;
      const methods = Object.keys(layer.route.methods)
        .filter(m => layer.route.methods[m])
        .map(m => m.toUpperCase());
      for (const method of methods) {
        endpoints.push({ method, path });
      }
    }
  }
  return endpoints;
}

/**
 * Creates an isolated sandboxed router for a given module.
 * Wraps all requests and errors in an execution boundary that records module metrics
 * and prevents failures from cascading to unrelated modules.
 *
 * @param {string} moduleName
 * @param {import('express').Router} innerRouter
 * @param {Object} [options]
 * @returns {import('express').Router}
 */
export function createModuleSandbox(moduleName, innerRouter, options = {}) {
  const sandboxedRouter = Router();
  const mod = registry.get(moduleName);

  const endpoints = options.endpoints || extractEndpoints(innerRouter);

  // 1. Pre-execution Interceptor (telemetry, correlation ID, header attribution)
  sandboxedRouter.use((req, res, next) => {
    if (res.setMaxListeners && typeof res.setMaxListeners === 'function') {
      res.setMaxListeners(40);
    }

    // Only hook finish listener if path matches this module
    const isCandidate = endpoints.length === 0 || endpoints.some(ep => {
      const base = ep.path.replace(/\/:.*$/, '').replace(/\/$/, '');
      return base ? req.path.startsWith(base) || req.path === base : true;
    });

    if (!isCandidate) {
      return next();
    }

    if (!res.getHeader || !res.getHeader('X-Module-Name')) {
      const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
      res.setHeader('X-Correlation-Id', correlationId);
      res.setHeader('X-Module-Name', moduleName);
    }

    registry.recordRequest(moduleName);

    // Track request finish once per module
    if (!res._moduleListeners) res._moduleListeners = new Set();
    if (!res._moduleListeners.has(moduleName)) {
      res._moduleListeners.add(moduleName);
      res.once('finish', () => {
        if (res.statusCode < 500) {
          registry.recordSuccess(moduleName);
        }
      });
    }

    next();
  });

  // 2. Attach inner router
  sandboxedRouter.use(innerRouter);

    // 3. Isolated Error Boundary Interceptor
  sandboxedRouter.use((err, req, res, next) => {
    // Ensure module headers are set on response
    if (res.setHeader) {
      res.setHeader('X-Module-Name', moduleName);
      if (!res.getHeader || !res.getHeader('X-Correlation-Id')) {
        res.setHeader('X-Correlation-Id', req.headers?.['x-correlation-id'] || crypto.randomUUID());
      }
    }

    // Record error in registry for this specific module
    registry.recordError(moduleName, err);

    const statusCode = err.status || err.statusCode || 500;
    const isServerError = statusCode >= 500;

    // Log diagnostic trace with module attribution
    console.error(`[IMF Module Error Boundary] [Module: ${moduleName}] HTTP ${statusCode}: ${err.message}`);

    // If already sent, delegate to default Express handler
    if (res.headersSent) {
      return next(err);
    }

    // Deliver structured RFC 7807 compliant Problem Details
    const problemDetails = {
      type: `https://janddbeachhouse.ph/errors/${isServerError ? 'module-error' : 'request-error'}`,
      title: isServerError ? 'Isolated Module Processing Exception' : (err.name || 'Request Error'),
      status: statusCode,
      detail: err.message || 'An error occurred during module request execution.',
      module: moduleName,
      correlation_id: res.getHeader('X-Correlation-Id'),
      timestamp: new Date().toISOString(),
    };

    if (process.env.NODE_ENV === 'development' && isServerError) {
      problemDetails.stack = err.stack;
    }

    return res.status(statusCode).json(problemDetails);
  });

  return sandboxedRouter;
}
