import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const deploymentsDir = path.join(rootDir, 'deployments');

console.log('\n======================================================================');
console.log(' 🚀 J & D BEACH HOUSE VERSION-SEGREGATED DEPLOYMENT MANAGER');
console.log('======================================================================\n');

function getVersions() {
  if (!fs.existsSync(deploymentsDir)) return [];
  return fs.readdirSync(deploymentsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('v'))
    .map(d => d.name);
}

function loadManifest(ver) {
  const manifestPath = path.join(deploymentsDir, ver, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }
  return null;
}

const args = process.argv.slice(2);
const isList = args.includes('--list') || args.length === 0;
const isDiff = args.includes('--diff');
const isDiagnose = args.includes('--diagnose');
const verArg = args.find(a => a.startsWith('--version='))?.split('=')[1] || 'v1.1';

if (isList) {
  const versions = getVersions();
  console.log(`[Deployment Manager] Discovered ${versions.length} versioned deployment environments:\n`);
  for (const ver of versions) {
    const manifest = loadManifest(ver);
    console.log(` • [${ver}] ${manifest?.codename || 'Deployment'} (Version ${manifest?.version || 'N/A'})`);
    console.log(`   Release Date: ${manifest?.release_date || 'N/A'}`);
    console.log(`   API Style:    ${manifest?.architecture?.api_style || 'REST'}`);
    console.log(`   Cache:        ${manifest?.architecture?.cache || 'None'}`);
    console.log(`   Path:         deployments/${ver}/\n`);
  }
}

if (isDiff) {
  const diffPath = path.join(deploymentsDir, 'v1.1', 'architecture_diff.md');
  if (fs.existsSync(diffPath)) {
    console.log(fs.readFileSync(diffPath, 'utf8'));
  } else {
    console.log('[Diff] architecture_diff.md not found.');
  }
}

if (isDiagnose) {
  console.log(`[Diagnostics] Running deployment integrity scan on [${verArg}]...\n`);
  const targetDir = path.join(deploymentsDir, verArg);
  if (!fs.existsSync(targetDir)) {
    console.error(`❌ Deployment directory does not exist: ${targetDir}`);
    process.exit(1);
  }

  const requiredFiles = ['manifest.json', 'docker-compose.yml', 'env.template', 'debug_session_log.md'];
  let passed = 0;

  for (const file of requiredFiles) {
    const filePath = path.join(targetDir, file);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      console.log(` ✅ PASS: ${file.padEnd(22)} (${stat.size} bytes)`);
      passed++;
    } else {
      console.error(` ❌ FAIL: Missing required deployment asset: ${file}`);
    }
  }

  const manifest = loadManifest(verArg);
  console.log(`\n[Audit Result] ${passed}/${requiredFiles.length} deployment verification checks passed for ${verArg}`);
  console.log(` Codename: ${manifest?.codename || 'Unknown'}`);
  console.log(` Architecture: ${manifest?.architecture?.api_style || 'Unknown'}`);
  console.log(` Debug Guide: deployments/${verArg}/debug_session_log.md\n`);
}
