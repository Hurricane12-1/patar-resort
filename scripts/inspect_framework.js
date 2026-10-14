#!/usr/bin/env node
/**
 * ============================================================================
 * J & D Beach House · Isolated Modular Framework (IMF)
 * Architecture & Telemetry Inspector CLI
 * Location: Brgy. Patar, Bolinao, Pangasinan (16.3042° N, 119.7821° E)
 * ============================================================================
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const routesDir = path.join(rootDir, 'server', 'src', 'routes');
const modulesDir = path.join(rootDir, 'server', 'src', 'modules');

console.log('\n======================================================================');
console.log(' 🔍 J & D RESERVE · ISOLATED MODULAR FRAMEWORK (IMF) INSPECTOR');
console.log('    Location: Brgy. Patar, Bolinao, Pangasinan (16.3042° N, 119.7821° E)');
console.log('======================================================================\n');

async function checkLiveServer(port = 8000) {
  return new Promise((resolve) => {
    const req = https.get(
      `https://localhost:${port}/api/system/modules`,
      { rejectUnauthorized: false, timeout: 2000 },
      (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            resolve({ online: true, data: JSON.parse(body) });
          } catch {
            resolve({ online: false });
          }
        });
      }
    );
    req.on('error', () => resolve({ online: false }));
    req.on('timeout', () => { req.destroy(); resolve({ online: false }); });
  });
}

function printStatusBadge(status) {
  switch (status) {
    case 'HEALTHY':
      return '\x1b[32m[🟢 HEALTHY]\x1b[0m';
    case 'DEGRADED':
      return '\x1b[33m[🟡 DEGRADED]\x1b[0m';
    case 'FAILED':
      return '\x1b[31m[🔴 FAILED]\x1b[0m';
    default:
      return `[${status}]`;
  }
}

async function main() {
  console.log('[Inspector] Probing live server at https://localhost:8000 ...');
  let result = await checkLiveServer(8000);
  if (!result.online) {
    result = await checkLiveServer(4000);
  }

  if (result.online && result.data?.modules) {
    const data = result.data;
    console.log(`\n✦ Framework Engine: ${data.framework} v${data.version}`);
    console.log(`✦ Status Summary: ${data.summary.total} Total | \x1b[32m${data.summary.healthy} Healthy\x1b[0m | \x1b[33m${data.summary.degraded} Degraded\x1b[0m | \x1b[31m${data.summary.failed} Failed\x1b[0m\n`);

    console.log('-----------------------------------------------------------------------------------------------');
    console.log(` ${'MODULE NAME'.padEnd(22)} | ${'TYPE'.padEnd(16)} | ${'STATUS'.padEnd(20)} | ${'ENDPOINTS'.padEnd(10)} | ERRORS`);
    console.log('-----------------------------------------------------------------------------------------------');

    for (const mod of data.modules) {
      const badge = printStatusBadge(mod.status);
      const errText = mod.stats.errorCount > 0 ? `\x1b[31m${mod.stats.errorCount}\x1b[0m` : '0';
      console.log(` ${mod.name.padEnd(22)} | ${mod.type.padEnd(16)} | ${badge.padEnd(29)} | ${String(mod.endpointsCount).padEnd(10)} | ${errText}`);
    }
    console.log('-----------------------------------------------------------------------------------------------\n');
    console.log(' ✅ Live Architecture Telemetry retrieved successfully from running instance.\n');
    return;
  }

  // Offline Static Topology Inspection
  console.log(' ℹ️ Live server not reached on :8000/:4000. Displaying Static Topology:\n');
  const routes = fs.existsSync(routesDir) 
    ? fs.readdirSync(routesDir).filter(f => f.endsWith('.routes.js'))
    : [];
  const modules = fs.existsSync(modulesDir)
    ? fs.readdirSync(modulesDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
    : [];

  console.log(`✦ Discovered Core Route Modules (${routes.length}):`);
  routes.forEach(r => console.log(`   - routes/${r}`));

  console.log(`\n✦ Discovered Pluggable Domain Modules (${modules.length}):`);
  modules.forEach(m => console.log(`   - modules/${m}/index.js`));

  console.log('\n======================================================================\n');
}

main().catch(console.error);
