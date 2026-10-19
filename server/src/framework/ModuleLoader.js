/**
 * ============================================================================
 * J & D Beach House · Isolated Modularity Base
 * Dynamic Module Loader & Fault-Tolerant Auto-Discovery Engine
 * Location: Brgy. Patar, Bolinao, Pangasinan (16.3042° N, 119.7821° E)
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { registry } from './ModuleRegistry.js';
import { createModuleSandbox, extractEndpoints } from './ModuleSandbox.js';
import inspectorRoutes from './inspector.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const routesDir = path.resolve(__dirname, '../routes');
const modulesDir = path.resolve(__dirname, '../modules');

/**
 * Loads a single core route file safely with complete error isolation.
 *
 * @param {import('express').Application} app
 * @param {string} filePath
 * @returns {Promise<{ name: string, success: boolean, error?: any }>}
 */
export async function loadRouteModule(app, filePath) {
  const fileName = path.basename(filePath);
  // Derive name e.g. "rooms.routes.js" -> "rooms"
  const moduleName = fileName.replace(/\.routes\.js$/, '').replace(/\.js$/, '');

  try {
    const fileUrl = pathToFileURL(filePath).href;
    const imported = await import(fileUrl);
    const router = imported.default || imported.router;

    if (!router || typeof router !== 'function') {
      throw new Error(`Module file "${fileName}" does not export an Express router as default export.`);
    }

    const endpoints = extractEndpoints(router);

    // Register module in registry
    registry.register({
      name: moduleName,
      version: imported.version || '1.5.0',
      description: imported.description || `Core operational route module: ${moduleName}`,
      type: 'core-route',
      mountPath: '/api',
      endpoints,
      healthCheck: imported.healthCheck || null,
      status: 'HEALTHY',
    });

    // Create bulkhead execution sandbox with isolated error boundary
    const sandboxedRouter = createModuleSandbox(moduleName, router);
    app.use('/api', sandboxedRouter);

    return { name: moduleName, success: true };
  } catch (err) {
    console.error(`[IMF Module Loader] ❌ Error loading core route "${moduleName}": ${err.message}`);
    registry.markFailed(moduleName, err, {
      type: 'core-route',
      mountPath: '/api',
      description: `Failed route module: ${fileName}`,
    });
    return { name: moduleName, success: false, error: err };
  }
}

/**
 * Loads a pluggable self-contained domain module safely with error isolation.
 *
 * @param {import('express').Application} app
 * @param {string} moduleDirPath
 * @returns {Promise<{ name: string, success: boolean, error?: any }>}
 */
export async function loadDomainPlugin(app, moduleDirPath) {
  const dirName = path.basename(moduleDirPath);
  let entryFile = path.join(moduleDirPath, 'index.js');
  if (!fs.existsSync(entryFile)) {
    entryFile = path.join(moduleDirPath, 'module.js');
  }

  if (!fs.existsSync(entryFile)) {
    return { name: dirName, success: false, error: new Error('No index.js or module.js found in module directory') };
  }

  try {
    const fileUrl = pathToFileURL(entryFile).href;
    const imported = await import(fileUrl);
    const moduleConfig = imported.default || imported;

    const name = moduleConfig.name || dirName;
    const version = moduleConfig.version || '1.0.0';
    const description = moduleConfig.description || `Self-contained domain module: ${name}`;
    const mountPath = moduleConfig.mountPath || `/api/${name}`;
    const router = moduleConfig.router || (typeof moduleConfig === 'function' ? moduleConfig : null);

    if (!router) {
      throw new Error(`Plugin module "${dirName}" does not provide a valid Express router.`);
    }

    const endpoints = extractEndpoints(router);

    registry.register({
      name,
      version,
      description,
      type: 'domain-plugin',
      mountPath,
      endpoints,
      healthCheck: moduleConfig.healthCheck || null,
      metadata: moduleConfig.metadata || {},
      status: 'HEALTHY',
    });

    const sandboxedRouter = createModuleSandbox(name, router);
    app.use(mountPath, sandboxedRouter);

    return { name, success: true };
  } catch (err) {
    console.error(`[IMF Module Loader] ❌ Error loading domain plugin "${dirName}": ${err.message}`);
    registry.markFailed(dirName, err, {
      type: 'domain-plugin',
      description: `Failed domain plugin in: ${dirName}`,
    });
    return { name: dirName, success: false, error: err };
  }
}

/**
 * Bootstraps the entire Isolated Modular Framework:
 * 1. Mounts system inspector routes
 * 2. Scans and safely loads all routes in server/src/routes/
 * 3. Scans and safely loads all domain modules in server/src/modules/
 * 4. Ensures the entire server remains online even if any individual module fails.
 *
 * @param {import('express').Application} app
 * @returns {Promise<Object>} Summary of bootstrap results
 */
export async function bootstrapFramework(app) {
  console.log('\n[IMF Framework] Initializing J & D Reserve Isolated Modular Framework (IMF)...');

  // 1. Mount framework system inspector routes first (ensures /api/system/modules is always accessible)
  app.use('/api', inspectorRoutes);
  registry.register({
    name: 'system-inspector',
    version: '1.2.0',
    description: 'Framework Telemetry, Module Registry & Runtime Inspector',
    type: 'system-infrastructure',
    mountPath: '/api',
    endpoints: extractEndpoints(inspectorRoutes),
    status: 'HEALTHY',
  });

  // 2. Discover and load all routes in server/src/routes
  if (fs.existsSync(routesDir)) {
    const routeFiles = fs.readdirSync(routesDir)
      .filter(file => file.endsWith('.routes.js') || file.endsWith('.routes.mjs'))
      .sort();

    for (const file of routeFiles) {
      const fullPath = path.join(routesDir, file);
      await loadRouteModule(app, fullPath);
    }
  }

  // 3. Discover and load any self-contained domain modules in server/src/modules
  if (fs.existsSync(modulesDir)) {
    const pluginDirs = fs.readdirSync(modulesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => path.join(modulesDir, dirent.name));

    for (const pluginDir of pluginDirs) {
      await loadDomainPlugin(app, pluginDir);
    }
  }

  const summary = registry.getSummary();
  console.log(`[IMF Framework] ✅ Bootstrap Complete: ${summary.total} modules registered (${summary.healthy} healthy, ${summary.degraded} degraded, ${summary.failed} failed).\n`);

  return summary;
}
