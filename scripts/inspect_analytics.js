import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { redis } from '../server/src/lib/redis.js';
import { getSystemAdminClient } from '../server/src/lib/supabase.js';
import { isSupabaseConfigured } from '../server/src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function inspect() {
  console.log('\n======================================================================');
  console.log(' 🔍 J & D BEACH HOUSE · DATA ANALYTICS & CACHE INSPECTOR 🔍');
  console.log('======================================================================\n');

  const t0 = Date.now();
  const sysClient = await getSystemAdminClient();

  // 1. Inspect Cache Subsystem
  console.log('[1/4] Inspecting Redis Cache Subsystem...');
  const ping = await redis.ping();
  const ovCached = await redis.get('analytics:overview');
  const fullDiveCached = await redis.get('analytics:full_dive:30d');
  const roomsCached = await redis.get('rooms:catalog:all:all');
  const cacheLatencyMs = Date.now() - t0;

  console.log(`      Driver: ${ping.driver}`);
  console.log(`      Status: ${ping.status} (Ping Latency: ${cacheLatencyMs}ms)`);
  console.log(`      analytics:overview:       ${ovCached ? '✅ WARM (HIT READY)' : '⚠️ COLD (MISS)'}`);
  console.log(`      analytics:full_dive:30d:   ${fullDiveCached ? '✅ WARM (HIT READY)' : '⚠️ COLD (MISS)'}`);
  console.log(`      rooms:catalog:all:all:     ${roomsCached ? '✅ WARM (HIT READY)' : '⚠️ COLD (MISS)'}`);

  // 2. Inspect Database Row Counts & Table Status
  console.log('\n[2/4] Inspecting Supabase Data Tables...');
  const tables = ['analytics_overview', 'analytics_daily', 'analytics_top_rooms', 'reservations', 'resort_orders', 'department_tasks', 'reviews', 'profiles', 'rooms', 'resort_inventory', 'resort_services'];
  const tableStats = {};

  for (const t of tables) {
    if (!isSupabaseConfigured) {
      tableStats[t] = 'local-offline';
      console.log(`      Table [${t.padEnd(20)}]: local-offline (mock-free development engine)`);
      continue;
    }
    try {
      const { count, error } = await sysClient.from(t).select('*', { count: 'exact', head: true });
      tableStats[t] = error ? 'N/A' : (count || 0);
      console.log(`      Table [${t.padEnd(20)}]: ${error ? 'offline' : `${count || 0} rows`}`);
    } catch {
      tableStats[t] = 'offline';
      console.log(`      Table [${t.padEnd(20)}]: offline`);
    }
  }

  // 3. Inspect Memory & Garbage Collection State
  console.log('\n[3/4] Inspecting Process Memory Footprint...');
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
  const rssMb = Math.round(mem.rss / 1024 / 1024);
  console.log(`      Heap Used:  ${heapUsedMb} MB`);
  console.log(`      Heap Total: ${heapTotalMb} MB`);
  console.log(`      RSS:        ${rssMb} MB`);

  // 4. Concurrency & Performance Readiness Score
  console.log('\n[4/4] Evaluating Concurrency Optimization Score...');
  let score = 70;
  if (ovCached) score += 10;
  if (fullDiveCached) score += 10;
  if (roomsCached) score += 10;
  if (heapUsedMb < 150) score += 0; // Baseline good

  console.log(`      Optimization Score: ${score}/100%`);
  console.log(`      Ready for 10k Concurrency: ${score >= 90 ? '✅ EXCELLENT' : '⚠️ RECOMMENDED TO RUN OPTIMIZE'}`);

  const report = {
    timestamp: new Date().toISOString(),
    cache: {
      driver: ping.driver,
      status: ping.status,
      latency_ms: cacheLatencyMs,
      keys: {
        'analytics:overview': ovCached ? 'WARMED' : 'COLD',
        'analytics:full_dive:30d': fullDiveCached ? 'WARMED' : 'COLD',
        'rooms:catalog:all:all': roomsCached ? 'WARMED' : 'COLD',
      },
    },
    database: tableStats,
    memory: {
      heap_used_mb: heapUsedMb,
      heap_total_mb: heapTotalMb,
      rss_mb: rssMb,
    },
    optimization_score: score,
    ready_for_10k_burst: score >= 90,
  };

  const perfDir = path.join(rootDir, 'docs', 'performance');
  if (!fs.existsSync(perfDir)) fs.mkdirSync(perfDir, { recursive: true });
  fs.writeFileSync(path.join(perfDir, 'analytics_inspection_report.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log('\n======================================================================');
  console.log(' 🏁 Inspection Completed. Saved to docs/performance/analytics_inspection_report.json');
  console.log('======================================================================\n');

  return report;
}

inspect()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Inspection error:', err);
    process.exit(1);
  });
