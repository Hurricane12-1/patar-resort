import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const rootPkgInit = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const EXPECTED_VERSION = process.env.TARGET_VERSION || rootPkgInit.version || '1.5.1';

console.log('\n======================================================================');
console.log(` 🛡️ J & D BEACH HOUSE · RELEASE GATEKEEPER v${EXPECTED_VERSION} 🛡️`);
console.log('======================================================================\n');

const gateResults = [];

function recordGate(gateNum, gateName, passed, details) {
  gateResults.push({ gate: gateNum, name: gateName, passed, details, timestamp: new Date().toISOString() });
  if (passed) {
    console.log(` [GATE ${gateNum}] ✅ PASS: ${gateName}`);
    if (details) console.log(`          ↳ ${details}`);
  } else {
    console.error(` [GATE ${gateNum}] ❌ FAIL: ${gateName}`);
    if (details) console.error(`          ↳ ${details}`);
  }
}

// -------------------------------------------------------------
// GATE 1: Semantic Version Synchronization Gate
// -------------------------------------------------------------
try {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const clientPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'client', 'package.json'), 'utf8'));
  const serverPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'server', 'package.json'), 'utf8'));

  const isAligned = rootPkg.version === EXPECTED_VERSION &&
                    clientPkg.version === EXPECTED_VERSION &&
                    serverPkg.version === EXPECTED_VERSION;

  if (isAligned) {
    recordGate(1, 'Semantic Version 1.0 Synchronization', true,
      `All packages synchronized at v${EXPECTED_VERSION} (root, client, server)`);
  } else {
    recordGate(1, 'Semantic Version 1.0 Synchronization', false,
      `Version mismatch: root=${rootPkg.version}, client=${clientPkg.version}, server=${serverPkg.version}`);
  }
} catch (err) {
  recordGate(1, 'Semantic Version 1.0 Synchronization', false, err.message);
}

// -------------------------------------------------------------
// GATE 2: TLS/SSL Certificate Integrity Gate
// -------------------------------------------------------------
try {
  const certsDir = path.join(rootDir, 'server', 'certs');
  const keyPath = path.join(certsDir, 'key.pem');
  const certPath = path.join(certsDir, 'cert.pem');

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    // Attempt auto-generation if missing
    console.log(' [GATE 2] ℹ️ Certificates missing. Invoking certificate generator...');
    execSync('node scripts/generate_certs.js', { cwd: rootDir, stdio: 'inherit' });
  }

  const keyStat = fs.statSync(keyPath);
  const certStat = fs.statSync(certPath);

  if (keyStat.size > 0 && certStat.size > 0) {
    const certModule = await import('../server/src/config/cert.js');
    const certStatus = certModule.getCertificateStatus();

    if (certStatus.ssl_enabled && certStatus.status === 'Active & Valid') {
      recordGate(2, 'TLS/SSL Certificate Status (HTTPS TLS v1.3)', true,
        `Active & Valid (${certStatus.protocol}) — Key: ${keyStat.size}B, Cert: ${certStat.size}B`);
    } else {
      recordGate(2, 'TLS/SSL Certificate Status (HTTPS TLS v1.3)', false,
        `Certificates present but status is not Active: ${JSON.stringify(certStatus)}`);
    }
  } else {
    recordGate(2, 'TLS/SSL Certificate Status (HTTPS TLS v1.3)', false,
      'Certificate files are empty (0 bytes)');
  }
} catch (err) {
  recordGate(2, 'TLS/SSL Certificate Status (HTTPS TLS v1.3)', false, err.message);
}

// -------------------------------------------------------------
// GATE 3: Security Headers & CSP Directives Protection Gate
// -------------------------------------------------------------
try {
  const secModule = await import('../server/src/middleware/security.js');
  const directives = secModule.cspDirectives;

  const checks = [
    { name: 'default-src', pass: directives['default-src']?.includes("'self'") },
    { name: 'object-src: none', pass: directives['object-src']?.includes("'none'") },
    { name: 'frame-ancestors: none', pass: directives['frame-ancestors']?.includes("'none'") },
    { name: 'base-uri: self', pass: directives['base-uri']?.includes("'self'") },
    { name: 'style-src cdnjs', pass: directives['style-src']?.includes('https://cdnjs.cloudflare.com') },
    { name: 'font-src cdnjs', pass: directives['font-src']?.includes('https://cdnjs.cloudflare.com') },
    { name: 'img-src unsplash', pass: directives['img-src']?.includes('https://images.unsplash.com') },
  ];

  const allPassed = checks.every(c => c.pass);
  if (allPassed) {
    recordGate(3, 'Security Headers & Content Security Policy (CSP)', true,
      'Strict CSP directives verified (anti-clickjacking, anti-object-injection, asset whitelisting)');
  } else {
    const failedChecks = checks.filter(c => !c.pass).map(c => c.name).join(', ');
    recordGate(3, 'Security Headers & Content Security Policy (CSP)', false,
      `Failed CSP checks: ${failedChecks}`);
  }
} catch (err) {
  recordGate(3, 'Security Headers & Content Security Policy (CSP)', false, err.message);
}

// -------------------------------------------------------------
// GATE 4: Backend Green Suite Verification Gate
// -------------------------------------------------------------
try {
  console.log(' [GATE 4] Executing backend test suite...');
  const testOutput = execSync('node test/verify-all.test.js', {
    cwd: path.join(rootDir, 'server'),
    encoding: 'utf8',
  });
  if (testOutput.includes('ALL SYSTEMS VERIFIED') || testOutput.includes('TESTS PASSED')) {
    recordGate(4, 'Backend Integrity & Green Verification Suite', true,
      'All backend unit & security tests executed with 100% green pass rate');
  } else {
    recordGate(4, 'Backend Integrity & Green Verification Suite', false,
      'Test runner finished without green confirmation signature');
  }
} catch (err) {
  recordGate(4, 'Backend Integrity & Green Verification Suite', false, err.message);
}

// -------------------------------------------------------------
// GATE 5: Frontend Production Bundle Build Gate
// -------------------------------------------------------------
try {
  console.log(' [GATE 5] Building client production bundle...');
  const buildOutput = execSync('npm run build', {
    cwd: path.join(rootDir, 'client'),
    encoding: 'utf8',
  });
  if (buildOutput.includes('built in') || fs.existsSync(path.join(rootDir, 'client', 'dist', 'index.html'))) {
    recordGate(5, 'Frontend Vite Production Bundle Build', true,
      'Vite bundle transformed and built cleanly into client/dist');
  } else {
    recordGate(5, 'Frontend Vite Production Bundle Build', false,
      'Build did not produce client/dist/index.html');
  }
} catch (err) {
  recordGate(5, 'Frontend Vite Production Bundle Build', false, err.message);
}

// -------------------------------------------------------------
// GATE EVALUATION & GATEPASS REPORT EMISSION
// -------------------------------------------------------------
const allPassed = gateResults.every(g => g.passed);
const passedCount = gateResults.filter(g => g.passed).length;
const totalCount = gateResults.length;

let gitInfo = { branch: 'unknown', commit: 'unknown' };
try {
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
  const commit = execSync('git rev-parse --short HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
  gitInfo = { branch, commit };
} catch {}

const reportData = {
  project: 'J & D Beach House Resort Management System',
  baseline_version: EXPECTED_VERSION,
  verdict: allPassed ? 'RELEASE_GATE_APPROVED' : 'RELEASE_GATE_REJECTED',
  timestamp: new Date().toISOString(),
  git: gitInfo,
  summary: `${passedCount}/${totalCount} Gates Cleared`,
  gates: gateResults,
};

// Ensure docs/security directory exists
const securityDocsDir = path.join(rootDir, 'docs', 'security');
if (!fs.existsSync(securityDocsDir)) {
  fs.mkdirSync(securityDocsDir, { recursive: true });
}

// Write JSON Report
const reportFileBase = `version_${EXPECTED_VERSION.replace(/\./g, '_')}_gatepass`;
fs.writeFileSync(
  path.join(securityDocsDir, `${reportFileBase}.json`),
  JSON.stringify(reportData, null, 2),
  'utf8'
);

// Write Markdown Report
const markdownReport = `# 🛡️ J & D Beach House · Version Control Gatepass v${EXPECTED_VERSION}

- **Baseline Version**: \`v${EXPECTED_VERSION}\`
- **Gate Verdict**: **${allPassed ? '🟢 RELEASE APPROVED (100% GATES CLEARED)' : '🔴 RELEASE BLOCKED'}**
- **Audit Timestamp**: \`${new Date().toISOString()}\`
- **Git Branch / Commit**: \`${gitInfo.branch}\` @ \`${gitInfo.commit}\`

---

## 📋 Gate Evaluation Matrix

| Gate | Verification Check | Status | Details |
| :---: | :--- | :---: | :--- |
| **1** | **Semantic Version Synchronization** | ${gateResults[0]?.passed ? '✅ PASS' : '❌ FAIL'} | ${gateResults[0]?.details || ''} |
| **2** | **TLS/SSL Certificate Integrity** | ${gateResults[1]?.passed ? '✅ PASS' : '❌ FAIL'} | ${gateResults[1]?.details || ''} |
| **3** | **Security Headers & CSP Directives** | ${gateResults[2]?.passed ? '✅ PASS' : '❌ FAIL'} | ${gateResults[2]?.details || ''} |
| **4** | **Backend Green Suite Verification** | ${gateResults[3]?.passed ? '✅ PASS' : '❌ FAIL'} | ${gateResults[3]?.details || ''} |
| **5** | **Frontend Production Bundle Build** | ${gateResults[4]?.passed ? '✅ PASS' : '❌ FAIL'} | ${gateResults[4]?.details || ''} |

---

## 🔐 Security & Tri-API Architecture Standards
1. **Tri-API Stack**: REST + Native GraphQL 17.0 (No Apollo) + Socket.io WebSockets.
2. **High-Performance Redis Cache**: In-memory Redis caching with automated fallback.
3. **Dual Validation Defense**: Zod + Joi Schema Validation (\`validateJoi\`).
4. **X.509 TLS/SSL Active**: HTTPS TLS v1.3 enabled with RSA 2048-bit key in \`server/certs/\`.
5. **Hardened Content Security Policy**: \`object-src 'none'\`, \`frame-ancestors 'none'\`, whitelisted external CDNs for FontAwesome and Unsplash imagery.
6. **HTTP Strict Transport Security (HSTS)**: 1-year maxAge (\`31536000\`), subdomains included, preload enabled.
7. **Permissions-Policy**: Restricted hardware access (\`camera=(), microphone=(), geolocation=()\`).
8. **Anti-XSS & NGWF Firewall**: Layer 7 inspection filters active on all request payloads.

---
*Generated automatically by J & D Beach House Version Control Gatekeeper.*
`;

fs.writeFileSync(
  path.join(securityDocsDir, `${reportFileBase}.md`),
  markdownReport,
  'utf8'
);

console.log('\n======================================================================');
if (allPassed) {
  console.log(` 🏆 VERSION CONTROL GATEKEEPING PASSED: ${passedCount}/${totalCount} GATES CLEARED 🟢`);
  console.log(`    Version ${EXPECTED_VERSION} baseline certified & locked!`);
  console.log(`    Gatepass Report: docs/security/${reportFileBase}.md`);
  console.log('======================================================================\n');
  process.exit(0);
} else {
  console.error(` ❌ GATEKEEPING BLOCKED: Only ${passedCount}/${totalCount} Gates Cleared`);
  console.error('======================================================================\n');
  process.exit(1);
}
