import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

console.log('\n============================================================');
console.log(' 🔍 J & D BEACH HOUSE SYSTEM INTEGRITY VERIFICATION');
console.log('============================================================\n');

try {
  // 1. Run Server Verification Tests
  console.log('[1/2] Running Backend Verification Suite...');
  const serverDir = path.join(root, 'server');
  execSync('node test/verify-all.test.js', { cwd: serverDir, stdio: 'inherit' });

  // 2. Run Client Build
  console.log('\n[2/2] Building Client Production Bundle...');
  const clientDir = path.join(root, 'client');
  execSync('npm run build', { cwd: clientDir, stdio: 'inherit' });

  console.log('\n============================================================');
  console.log(' 🏆 ALL SYSTEMS VERIFIED: 100% OPERATIONAL & GREEN 🟢');
  console.log('============================================================\n');
} catch (err) {
  console.error('\n❌ Verification failed with error:', err.message);
  process.exit(1);
}
