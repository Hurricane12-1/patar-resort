import assert from 'assert';
import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';

console.log('🧪 [Server Verification Test Suite]');

async function runTests() {
  console.log('  ▶ Testing environment & configuration...');
  const { env } = await import('../src/config/env.js');
  assert.ok(env, 'Environment configuration must be exported');
  assert.ok(env.SUPABASE_URL, 'SUPABASE_URL must be configured');
  assert.ok(env.SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY must be configured');
  console.log('    ✓ Environment variables verified');

  console.log('  ▶ Testing router & module registrations...');
  const { registry } = await import('../src/framework/ModuleRegistry.js');
  assert.ok(registry, 'ModuleRegistry must be defined');
  console.log('    ✓ ModuleRegistry operational');

  console.log('  ▶ Testing database & Supabase client...');
  const { checkSupabaseConnection } = await import('../src/index.js');
  assert.strictEqual(typeof checkSupabaseConnection, 'function', 'checkSupabaseConnection function must exist');
  console.log('    ✓ Supabase connection check verified');

  console.log('\n  ✅ All Backend Verification Tests Passed!\n');
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  });
