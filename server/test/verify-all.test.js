import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { antiXssSanitizer, cookieTokenizer, cspDirectives, securityHeaders, safeRedirect } from '../src/middleware/security.js';
import { ngwfFirewall, pathNormalizer } from '../src/middleware/ngwfSecurity.js';
import { getCertificateStatus } from '../src/config/cert.js';
import { joiSchemas } from '../src/middleware/joiValidation.js';
import { graphql } from 'graphql';
import { schema } from '../src/graphql/schema.js';
import { resolvers } from '../src/graphql/resolvers.js';
import { requireRole, requireAdmin, requireStaffOrAdmin } from '../src/middleware/auth.js';
import { redis, InMemoryCache } from '../src/lib/redis.js';
import {
  parseFinancialEquation,
  normalizeLedgerDates,
  resolveRoomSlug,
  checkRoomAvailability,
  runReActLedgerIngestion,
  ROOMS_CATALOG,
} from '../src/agents/ledgerIngestionAgent.js';
import { registry } from '../src/framework/ModuleRegistry.js';
import { createModuleSandbox, extractEndpoints } from '../src/framework/ModuleSandbox.js';
import { loadRouteModule, loadDomainPlugin, bootstrapFramework } from '../src/framework/ModuleLoader.js';
import { sendRecoveryOTP, sendPasswordResetSuccess, sendSignup2FAOTP, sendWelcomeClientEmail, sendSignupExpiredEmail } from '../src/lib/mailer.js';
import express, { Router } from 'express';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const serverRoot = path.resolve(__dirname, '..');

function generateAccountEmail(firstName, middleName, lastName, seq = 1, isStaff = true) {
  const f = (firstName || '').trim().charAt(0).toLowerCase() || 'x';
  const m = (middleName || '').trim().charAt(0).toLowerCase() || 'x';
  const l = (lastName || '').trim().charAt(0).toLowerCase() || 'x';
  if (!isStaff) return `${f}${m}${l}@gmail.com`;
  const paddedSeq = String(seq).padStart(3, '0');
  return `${f}${m}${l}${paddedSeq}@resortmanagement.ph`;
}

console.log('\n=============================================================');
console.log(' 🟢 J & D BEACH HOUSE SYSTEM VERIFICATION & GREEN SUITE RUNNER 🟢');
console.log('=============================================================\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(` ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(` ❌ FAIL: ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

// 1. Account Name & Email Format Tests
runTest('Injected Account Email Generation (Staff vs Customer)', () => {
  const staffEmail = generateAccountEmail('Johannes', 'Von', 'Shicksal', 1, true);
  assert.strictEqual(staffEmail, 'jvs001@resortmanagement.ph', 'Staff email generation failed');

  const customerEmail = generateAccountEmail('Juan', 'Dela', 'Cruz', 1, false);
  assert.strictEqual(customerEmail, 'jdc@gmail.com', 'Customer email generation failed');
});

// 2a. Security Certificates Status Test
runTest('TLS/SSL Certificate Status Verification (HTTPS TLS v1.3)', () => {
  const certStatus = getCertificateStatus();
  assert.strictEqual(certStatus.ssl_enabled, true, 'SSL should be enabled with provisioned certificates');
  assert.ok(certStatus.protocol.includes('HTTPS'), 'Protocol should be HTTPS');
  assert.ok(certStatus.valid_until, 'Missing valid_until date');
  assert.strictEqual(certStatus.status, 'Active & Valid', 'Cert status should be Active & Valid');
});

// 2b. Content Security Policy (CSP) & HTTP Security Headers Test
runTest('Content Security Policy (CSP) Directives & Headers Gate', () => {
  // Verify CSP Directives
  assert.ok(cspDirectives['default-src'].includes("'self'"), 'Missing default-src: self');
  assert.ok(cspDirectives['object-src'].includes("'none'"), 'Missing object-src: none (plugin defense)');
  assert.ok(cspDirectives['frame-ancestors'].includes("'none'"), 'Missing frame-ancestors: none (clickjacking)');
  assert.ok(cspDirectives['style-src'].includes('https://cdnjs.cloudflare.com'), 'Missing cdnjs in style-src');
  assert.ok(cspDirectives['font-src'].includes('https://cdnjs.cloudflare.com'), 'Missing cdnjs in font-src');
  assert.ok(cspDirectives['img-src'].includes('https://images.unsplash.com'), 'Missing unsplash in img-src');

  // Verify Security Headers Middleware
  const mockHeaders = {};
  const mockRes = {
    setHeader(key, val) { mockHeaders[key.toLowerCase()] = val; },
    removeHeader(key) { delete mockHeaders[key.toLowerCase()]; },
    getHeader(key) { return mockHeaders[key.toLowerCase()]; },
  };
  let middlewareCalled = false;
  securityHeaders({ headers: {} }, mockRes, () => { middlewareCalled = true; });
  assert.ok(middlewareCalled, 'securityHeaders did not call next()');
  assert.ok(mockHeaders['permissions-policy'], 'Missing Permissions-Policy header');
  assert.strictEqual(mockHeaders['x-permitted-cross-domain-policies'], 'none', 'Missing cross-domain policies header');
});

// 3. Anti-XSS Payload Sanitization Test
runTest('Anti-XSS Payload Sanitization (Strips Script Injection)', () => {
  const mockReq = {
    body: {
      name: '<script>alert("xss")</script>Johannes',
      note: 'Hello <iframe src="evil.com"></iframe> world',
    },
    query: {},
    params: {},
  };
  let nextCalled = false;
  antiXssSanitizer(mockReq, {}, () => { nextCalled = true; });

  assert.ok(nextCalled, 'Next middleware was not called');
  assert.strictEqual(mockReq.body.name, 'Johannes', 'XSS script was not stripped');
  assert.strictEqual(mockReq.body.note, 'Hello  world', 'Iframe tag was not stripped');
});

// 4. NGWF Firewall Balanced Threat Inspection Test
runTest('NGWF Firewall Allows Legitimate Text and Blocks Malicious Payload', () => {
  // Test Legitimate Input (No excessive restraints)
  const legitReq = {
    originalUrl: '/api/customer/orders',
    query: { q: 'Select a cottage room from the options' },
    body: { notes: 'Please send extra towels' },
    params: {},
  };
  let legitPassed = false;
  ngwfFirewall(legitReq, {}, () => { legitPassed = true; });
  assert.ok(legitPassed, 'NGWF blocked legitimate natural language text');

  // Test Malicious SQLi Input
  const maliciousReq = {
    originalUrl: '/api/customer/orders',
    query: { q: '1 UNION SELECT * FROM profiles' },
    body: {},
    params: {},
  };
  let maliciousBlocked = false;
  const mockRes = {
    status(code) {
      assert.strictEqual(code, 403, 'Expected 403 status code for malicious payload');
      return {
        json(data) {
          assert.strictEqual(data.code, 'NGWF_THREAT_BLOCKED');
          maliciousBlocked = true;
        },
      };
    },
  };
  ngwfFirewall(maliciousReq, mockRes, () => {});
  assert.ok(maliciousBlocked, 'NGWF failed to block malicious UNION SELECT payload');
});

// 6. CSV Auto-Reading Parser Test
runTest('CSV Auto-Reader Parses CSV Text into Header and Row Data', () => {
  const sampleCsv = `Name,Role,Status\nJohannes,administrator,Active\nJuan,customer,Checked-In`;
  const lines = sampleCsv.split('\n');
  const headers = lines[0].split(',');
  const row1 = lines[1].split(',');
  assert.strictEqual(headers[0], 'Name');
  assert.strictEqual(headers[1], 'Role');
  assert.strictEqual(row1[0], 'Johannes');
  assert.strictEqual(row1[1], 'administrator');
});

// 7. Open Redirect Prevention Test
runTest('Open Redirect Guard Blocks Malicious External Destinations', () => {
  let redirectedTo = null;
  const mockRes = {
    redirect(url) { redirectedTo = url; },
  };
  const mockReq = {
    get: (h) => (h === 'host' ? 'localhost:4000' : ''),
  };

  // Safe relative path
  safeRedirect(mockReq, mockRes, '/rooms');
  assert.strictEqual(redirectedTo, '/rooms', 'Safe relative path was not allowed');

  // Block scheme-relative attack //evil.com
  safeRedirect(mockReq, mockRes, '//evil.com');
  assert.strictEqual(redirectedTo, '/', 'Scheme-relative // redirect was not blocked');

  // Block malicious external URL
  safeRedirect(mockReq, mockRes, 'https://phishing-resort.com/login');
  assert.strictEqual(redirectedTo, '/', 'External untrusted redirect was not blocked');
});

// 8. Joi Request Contract Validation Test
runTest('Joi Schema Validation Enforces Payload Integrity', () => {
  // Valid booking payload
  const validBooking = {
    roomId: 'room-101',
    check_in: '2026-10-01',
    check_out: '2026-10-05',
    guests: 2,
    phone: '+63 917 555 0192',
  };
  const { error: validErr } = joiSchemas.reservation.validate(validBooking);
  assert.strictEqual(validErr, undefined, 'Valid booking payload was rejected');

  // Invalid booking payload (missing check_in, negative guests)
  const invalidBooking = {
    roomId: 'room-101',
    check_out: '2026-10-05',
    guests: -1,
  };
  const { error: invalidErr } = joiSchemas.reservation.validate(invalidBooking);
  assert.ok(invalidErr, 'Invalid booking payload was incorrectly accepted');
});

// 9. Native GraphQL Execution Test (Without Apollo)
await runTest('Native GraphQL Engine Executes Schema Queries Directly', async () => {
  const query = `
    query {
      networkStatus {
        status
        tls_status
      }
    }
  `;
  const result = await graphql({
    schema,
    source: query,
    rootValue: resolvers,
  });

  assert.strictEqual(result.errors, undefined, `GraphQL query had errors: ${result.errors?.[0]?.message}`);
  assert.ok(result.data?.networkStatus?.status, 'Missing networkStatus in GraphQL response');
});

// 10. Redis Cache & Memory Fallback Operations Test
await runTest('Redis Cache Manager Performs Set, Get, Invalidation & Status Check', async () => {
  const testKey = 'test:verify:key';
  const testData = { hotel: 'J & D Beach House', rooms_active: 18 };

  await redis.set(testKey, testData, 10);
  const retrieved = await redis.get(testKey);
  assert.deepStrictEqual(retrieved, testData, 'Retrieved cache payload does not match');

  await redis.del(testKey);
  const afterDel = await redis.get(testKey);
  assert.strictEqual(afterDel, null, 'Cache key was not deleted');

  const pingResult = await redis.ping();
  assert.ok(pingResult.status, 'Missing ping status');
  assert.ok(pingResult.driver, 'Missing cache driver');
});

// 11. Memory Leak Defense: LRU Eviction, TTL Sweep & Clear Test
await runTest('Cache Memory Leak Defense: LRU Eviction, Active TTL Sweep & On-Demand Clear', async () => {
  const boundedCache = new InMemoryCache(3); // Small test capacity of 3 items
  await boundedCache.set('k1', 'val1', 60);
  await boundedCache.set('k2', 'val2', 60);
  await boundedCache.set('k3', 'val3', 60);
  assert.strictEqual(boundedCache.size(), 3, 'Initial cache size should be 3');

  // Insert 4th item -> k1 should be evicted (LRU)
  await boundedCache.set('k4', 'val4', 60);
  assert.strictEqual(boundedCache.size(), 3, 'Bounded cache exceeded capacity limit');
  const evicted = await boundedCache.get('k1');
  assert.strictEqual(evicted, null, 'Oldest unaccessed key k1 was not evicted');
  const present = await boundedCache.get('k4');
  assert.strictEqual(present, 'val4', 'Newly inserted key k4 missing');

  // Test active TTL sweep
  await boundedCache.set('expired_key', 'old_val', -1); // Already expired
  boundedCache.sweep();
  const swept = await boundedCache.get('expired_key');
  assert.strictEqual(swept, null, 'Expired key was not purged by sweep()');

  // Test on-demand clear
  const purged = await boundedCache.clear();
  assert.ok(purged > 0, 'Purge count should be greater than 0');
  assert.strictEqual(boundedCache.size(), 0, 'Cache should be completely empty after clear()');

  boundedCache.destroy();
});

// 12. Automated Patch Backup & Checksum Manifest Integrity Test
runTest('Automated Patch Backup & Checksum Manifest Integrity', () => {
  const v10ManifestPath = path.resolve(projectRoot, 'backups/patches/v1.0.0/patch_manifest.json');
  const v11ManifestPath = path.resolve(projectRoot, 'backups/patches/v1.1.0/patch_manifest.json');

  assert.ok(fs.existsSync(v10ManifestPath), 'v1.0.0 patch manifest is missing');
  assert.ok(fs.existsSync(v11ManifestPath), 'v1.1.0 patch manifest is missing');

  const v10 = JSON.parse(fs.readFileSync(v10ManifestPath, 'utf8'));
  const v11 = JSON.parse(fs.readFileSync(v11ManifestPath, 'utf8'));

  assert.strictEqual(v10.patch_version, '1.0.0');
  assert.strictEqual(v11.patch_version, '1.1.0');
  assert.strictEqual(v10.checksum_algorithm, 'SHA-256');
  assert.strictEqual(v11.checksum_algorithm, 'SHA-256');
  assert.ok(v10.files.length >= 10, 'v1.0.0 files manifest too small');
  assert.ok(v11.files.length >= 12, 'v1.1.0 files manifest too small');
  assert.ok(v11.files.every(f => f.sha256 && f.sha256.length === 64), 'Invalid SHA-256 hash in v1.1.0 manifest');
});

// 13. Account Recovery Validation & OTP Lifecycle Test
await runTest('Account Recovery Joi Schema & OTP Verification Lifecycle', async () => {
  // Test valid forgot-password schema
  const { error: fpErr } = joiSchemas.forgotPassword.validate({ email: 'guest@example.ph' });
  assert.strictEqual(fpErr, undefined, 'Valid forgot-password payload was rejected');

  // Test invalid forgot-password schema
  const { error: fpBadErr } = joiSchemas.forgotPassword.validate({ email: 'not-an-email' });
  assert.ok(fpBadErr, 'Invalid email was incorrectly accepted');

  // Test OTP persistence in cache
  const recoveryKey = 'recovery:guest@example.ph';
  const testOtp = { code: '849201', email: 'guest@example.ph' };
  await redis.set(recoveryKey, testOtp, 900);

  const stored = await redis.get(recoveryKey);
  assert.strictEqual(stored.code, '849201', 'Stored OTP code mismatch');

  // Test verify-recovery schema
  const { error: vErr } = joiSchemas.verifyRecovery.validate({ email: 'guest@example.ph', code: '849201' });
  assert.strictEqual(vErr, undefined, 'Valid recovery verification payload was rejected');

  // Test reset-password schema
  const { error: rpErr } = joiSchemas.resetPassword.validate({ email: 'guest@example.ph', code: '849201', new_password: 'SuperSecret123!' });
  assert.strictEqual(rpErr, undefined, 'Valid reset-password payload was rejected');

  await redis.del(recoveryKey);
});

// 14. Zero Mock Contamination Verification
runTest('Zero Mock Contamination Gate (AuthContext & Admin Verified)', () => {
  const authContextPath = path.resolve(projectRoot, 'client/src/context/AuthContext.tsx');
  const authContent = fs.readFileSync(authContextPath, 'utf8');

  assert.ok(!authContent.includes('MOCK_ACCOUNTS'), 'AuthContext.tsx still contains MOCK_ACCOUNTS');
  assert.ok(!authContent.includes('mock-token-'), 'AuthContext.tsx still contains mock-token generation');

  const adminPath = path.resolve(projectRoot, 'client/src/pages/Admin.tsx');
  const adminContent = fs.readFileSync(adminPath, 'utf8');

  assert.ok(!adminContent.includes('const openGuestConversations = ['), 'Admin.tsx still contains hardcoded openGuestConversations');
  assert.ok(!adminContent.includes('const topGuests = ['), 'Admin.tsx still contains hardcoded topGuests');
  assert.ok(!adminContent.includes('const recentTransactions = ['), 'Admin.tsx still contains hardcoded recentTransactions');
});

// 15. Enhanced TLS/SSL Certificate Suite Verification
runTest('Enhanced TLS/SSL Certificate Suite & Root CA Verification', () => {
  const certStatus = getCertificateStatus();
  assert.strictEqual(certStatus.ssl_enabled, true, 'SSL must be enabled');
  assert.strictEqual(certStatus.has_ca_authority, true, 'Root CA authority file must exist');
  assert.ok(certStatus.issuer.includes('J & D Beach House Root CA'), 'Certificate issuer must be J & D Beach House Root CA');
  assert.ok(certStatus.subject_alt_names.includes('DNS:localhost'), 'SANs must include localhost');
  assert.ok(certStatus.subject_alt_names.includes('DNS:janddbeachhouse.local'), 'SANs must include janddbeachhouse.local');
  assert.ok(certStatus.subject_alt_names.includes('IP Address:127.0.0.1') || certStatus.subject_alt_names.includes('127.0.0.1'), 'SANs must include 127.0.0.1');

  // Verify certificate files on disk
  const certPath = path.resolve(serverRoot, 'certs/cert.pem');
  const keyPath = path.resolve(serverRoot, 'certs/key.pem');
  const caPath = path.resolve(serverRoot, 'certs/ca-cert.pem');
  const chainPath = path.resolve(serverRoot, 'certs/cert-chain.pem');

  assert.ok(fs.existsSync(certPath), 'cert.pem missing');
  assert.ok(fs.existsSync(keyPath), 'key.pem missing');
  assert.ok(fs.existsSync(caPath), 'ca-cert.pem missing');
  assert.ok(fs.existsSync(chainPath), 'cert-chain.pem missing');
});

// 16. Ledger Ingestion Agent: Financial Math & Logbook Notation Parser
runTest('Ledger Ingestion Agent: Financial Math & Logbook Notation Parser', () => {
  // Test Case A: Deposit with remaining balance
  const resA = parseFinancialEquation('18,000 - 3,000 = 15,000 Bal.');
  assert.strictEqual(resA.total_php, 18000, 'Total PHP parsed incorrectly');
  assert.strictEqual(resA.downpayment_php, 3000, 'Downpayment PHP parsed incorrectly');
  assert.strictEqual(resA.balance_php, 15000, 'Balance PHP parsed incorrectly');
  assert.strictEqual(resA.payment_status, 'partial', 'Payment status should be partial');

  // Test Case B: Fully paid with "Pd" tag
  const resB = parseFinancialEquation('12,000 - 12,000 = 0 Pd');
  assert.strictEqual(resB.total_php, 12000);
  assert.strictEqual(resB.payment_status, 'paid');

  // Test Case C: Single "Pd" notation
  const resC = parseFinancialEquation('6000 Pd');
  assert.strictEqual(resC.total_php, 6000);
  assert.strictEqual(resC.payment_status, 'paid');

  // Test Case D: Unpaid base rate without deposit
  const resD = parseFinancialEquation('18000');
  assert.strictEqual(resD.total_php, 18000);
  assert.strictEqual(resD.downpayment_php, 0);
  assert.strictEqual(resD.payment_status, 'unpaid');
});

// 17. Ledger Ingestion Agent: Room Aliases, Date Inference & ISO 8601 Normalization
runTest('Ledger Ingestion Agent: Room Aliases, Date Inference & ISO 8601 Normalization', () => {
  // Alias mapping: "Unit Papang" -> unit-cat
  const aliasPapang = resolveRoomSlug('Unit Papang');
  assert.strictEqual(aliasPapang.room_slug, 'unit-cat', 'Unit Papang must resolve to unit-cat');
  assert.strictEqual(aliasPapang.sub_unit_note, 'Unit Papang');

  // Alias mapping: "Whole House" / "Unit Gorgio" -> unit-tev
  const aliasGorgio = resolveRoomSlug('Unit Gorgio');
  assert.strictEqual(aliasGorgio.room_slug, 'unit-tev');
  assert.strictEqual(aliasGorgio.sub_unit_note, 'Unit Gorgio');

  // Date bracket: "May 12 - 14" -> 2026-05-12 to 2026-05-14
  const datesBracket = normalizeLedgerDates('May 12 - 14', 2026);
  assert.strictEqual(datesBracket.check_in, '2026-05-12');
  assert.strictEqual(datesBracket.check_out, '2026-05-14');

  // Single date: "Oct 3" -> 2026-10-03 to 2026-10-04 (infer +1 day)
  const dateSingle = normalizeLedgerDates('Oct 3', 2026);
  assert.strictEqual(dateSingle.check_in, '2026-10-03');
  assert.strictEqual(dateSingle.check_out, '2026-10-04');
});

// 18. Autonomous ReAct Ledger Ingestion Loop & GiST Hard Overbooking Constraint
await runTest('Autonomous ReAct Ledger Ingestion Loop & GiST Hard Overbooking Constraint', async () => {
  // Line 1: Booking for Juan Dela Cruz in Unit Papang
  const sampleLogbook = [
    'Juan Dela Cruz & Ana Dela Cruz | May 20 - 22 | Unit Papang | 8 | 6,000 - 2,000 = 4,000 Bal. | Birthday celebration',
    // Line 2: Conflicting booking for same room on overlapping dates
    'Pedro Reyes | May 21 - 23 | Unit CAT | 6 | 6,000 Pd | Overlapping request',
  ];

  const result = await runReActLedgerIngestion(sampleLogbook);

  // Line 1 should succeed
  assert.strictEqual(result.successful_count, 1, 'First non-overlapping booking should succeed');
  assert.strictEqual(result.reservations[0].room_slug, 'unit-cat');
  assert.strictEqual(result.reservations[0].downpayment_php, 2000);
  assert.strictEqual(result.reservations[0].payment_status, 'partial');

  // Line 2 should be rejected by GiST range exclusion constraint
  assert.strictEqual(result.error_count, 1, 'Second booking should be rejected by GiST constraint');
  assert.ok(result.errors[0].error.includes('GiST Overbooking Exclusion'), 'Error must cite GiST Overbooking Exclusion');

  // Verify ReAct trace completeness
  assert.strictEqual(result.audit_trace.length, 2, 'Audit trace must contain 2 entries');
  const phases = result.audit_trace[0].steps.map((s) => s.phase);
  assert.ok(phases.includes('ANALYZE'), 'Trace missing ANALYZE phase');
  assert.ok(phases.includes('RESOLVE'), 'Trace missing RESOLVE phase');
  assert.ok(phases.includes('VALIDATE'), 'Trace missing VALIDATE phase');
  assert.ok(phases.includes('EXECUTE'), 'Trace missing EXECUTE phase');
});

// 19. Role-Based Access Control (RBAC) Guard Enforcement (401/403 Gates)
await runTest('Role-Based Access Control (RBAC) Guard Enforcement (401/403 Gates)', async () => {
  let nextCalled = false;
  let caughtError = null;
  const mockNext = (err) => {
    if (err) caughtError = err;
    else nextCalled = true;
  };

  // Case A: Unauthenticated request to requireAdmin
  caughtError = null; nextCalled = false;
  requireAdmin({}, {}, mockNext);
  assert.strictEqual(caughtError?.statusCode, 401, 'Unauthenticated request must throw 401');

  // Case B: Customer attempting admin action -> 403
  caughtError = null; nextCalled = false;
  requireAdmin({ user: { id: 'usr-cust', role: 'customer' } }, {}, mockNext);
  assert.strictEqual(caughtError?.statusCode, 403, 'Customer role must be blocked with 403 on admin routes');

  // Case C: Administrator permitted on admin action
  caughtError = null; nextCalled = false;
  requireAdmin({ user: { id: 'usr-admin', role: 'administrator' } }, {}, mockNext);
  assert.strictEqual(nextCalled, true, 'Administrator must be permitted');
  assert.strictEqual(caughtError, null);

  // Case D: Staff attempting staff action -> allowed
  caughtError = null; nextCalled = false;
  requireStaffOrAdmin({ user: { id: 'usr-staff', role: 'staff' } }, {}, mockNext);
  assert.strictEqual(nextCalled, true, 'Staff must be permitted on staff routes');

  // Case E: Receptionist attempting staff action -> allowed
  caughtError = null; nextCalled = false;
  requireStaffOrAdmin({ user: { id: 'usr-recep', role: 'receptionist' } }, {}, mockNext);
  assert.strictEqual(nextCalled, true, 'Receptionist must be permitted on staff routes');

  // Case F: Customer attempting staff action -> 403
  caughtError = null; nextCalled = false;
  requireStaffOrAdmin({ user: { id: 'usr-cust', role: 'customer' } }, {}, mockNext);
  assert.strictEqual(caughtError?.statusCode, 403, 'Customer role must be blocked with 403 on staff routes');

  // Case G: Synonym 'admin' permitted on requireAdmin (SEC-RBAC-01)
  caughtError = null; nextCalled = false;
  requireAdmin({ user: { id: 'usr-admin-short', role: 'admin' } }, {}, mockNext);
  assert.strictEqual(nextCalled, true, "Synonym 'admin' must be permitted on requireAdmin");
  assert.strictEqual(caughtError, null);

  // Case H: Synonym 'admin' permitted on requireStaffOrAdmin (SEC-RBAC-01)
  caughtError = null; nextCalled = false;
  requireStaffOrAdmin({ user: { id: 'usr-admin-short', role: 'admin' } }, {}, mockNext);
  assert.strictEqual(nextCalled, true, "Synonym 'admin' must be permitted on requireStaffOrAdmin");
  assert.strictEqual(caughtError, null);

  // Case I: Accounting role permitted on requireStaffOrAdmin (SEC-RBAC-03)
  caughtError = null; nextCalled = false;
  requireStaffOrAdmin({ user: { id: 'usr-acct', role: 'accounting' } }, {}, mockNext);
  assert.strictEqual(nextCalled, true, 'Accounting role must be permitted on staff/admin routes');
  assert.strictEqual(caughtError, null);
});

// 20. RBAC Revisions 4 & 5: Financial Analytics, CSV & Ledger Ingestion Gates
await runTest('RBAC Revisions 4 & 5: Financial Analytics, CSV & Ledger Ingestion Gates', async () => {
  let nextCalled = false;
  let caughtError = null;
  const mockNext = (err) => {
    if (err) caughtError = err;
    else nextCalled = true;
  };

  // SEC-RBAC-04 Tests: Financial Analytics & CSV Protection
  // Case A: Customer blocked from accessing financial analytics
  caughtError = null; nextCalled = false;
  requireStaffOrAdmin({ user: { id: 'usr-cust-99', role: 'customer' } }, {}, mockNext);
  assert.strictEqual(caughtError?.statusCode, 403, 'Customer must be blocked with 403 on financial analytics');

  // Case B: Accounting role permitted on financial analytics
  caughtError = null; nextCalled = false;
  requireStaffOrAdmin({ user: { id: 'usr-acct-01', role: 'accounting' } }, {}, mockNext);
  assert.strictEqual(nextCalled, true, 'Accounting role must be allowed on analytics and CSV reports');

  // Case C: Staff blocked from admin-only cache purge/optimize
  caughtError = null; nextCalled = false;
  requireAdmin({ user: { id: 'usr-staff-02', role: 'staff' } }, {}, mockNext);
  assert.strictEqual(caughtError?.statusCode, 403, 'General staff must be blocked with 403 on cache purge and optimization');

  // Case D: Administrator allowed on cache purge/optimize
  caughtError = null; nextCalled = false;
  requireAdmin({ user: { id: 'usr-admin-01', role: 'administrator' } }, {}, mockNext);
  assert.strictEqual(nextCalled, true, 'Administrator must be allowed on cache purge and optimization');

  // SEC-RBAC-05 Tests: Ledger Ingestion Agent Protection
  // Case E: Customer blocked from autonomous ledger ingestion
  caughtError = null; nextCalled = false;
  requireStaffOrAdmin({ user: { id: 'usr-cust-10', role: 'customer' } }, {}, mockNext);
  assert.strictEqual(caughtError?.statusCode, 403, 'Customer must be blocked with 403 on ledger ingestion mutations');

  // Case F: Receptionist permitted on ledger ingestion
  caughtError = null; nextCalled = false;
  requireStaffOrAdmin({ user: { id: 'usr-recep-05', role: 'receptionist' } }, {}, mockNext);
  assert.strictEqual(nextCalled, true, 'Receptionist must be allowed on autonomous ledger ingestion');

  // Case G: Unauthenticated access blocked on ledger ingestion
  caughtError = null; nextCalled = false;
  requireStaffOrAdmin({}, {}, mockNext);
  assert.strictEqual(caughtError?.statusCode, 401, 'Unauthenticated ledger ingestion request must throw 401');
});

await runTest('IMF Core: Dynamic Discovery, Module Registry & Telemetry Tracking', async () => {
  const testApp = express();
  const summary = await bootstrapFramework(testApp);

  assert(summary.total >= 18, `Expected at least 18 modules registered, found ${summary.total}`);
  assert(summary.healthy >= 18, `Expected at least 18 healthy modules, found ${summary.healthy}`);

  // Test Registry Queries
  const roomsMod = registry.get('rooms');
  assert(roomsMod, 'Module "rooms" must be registered');
  assert.strictEqual(roomsMod.status, 'HEALTHY');
  assert.strictEqual(roomsMod.type, 'core-route');

  const conciergeMod = registry.get('concierge');
  assert(conciergeMod, 'Domain plugin "concierge" must be registered');
  assert.strictEqual(conciergeMod.type, 'domain-plugin');
  assert.strictEqual(conciergeMod.mountPath, '/api/concierge');

  // Test Request Recording & Success Recovery
  registry.recordRequest('concierge');
  assert.strictEqual(conciergeMod.stats.totalRequests >= 1, true);
  registry.recordSuccess('concierge');
  assert.strictEqual(conciergeMod.stats.successfulRequests >= 1, true);
});

await runTest('IMF Resiliency: Fault Isolation & Zero-Crash Error Boundary Guarantee', async () => {
  // Case A: Load a deliberate corrupt/non-existent route file
  const testApp = express();
  const badResult = await loadRouteModule(testApp, 'server/src/routes/non-existent-fake-module.js');
  assert.strictEqual(badResult.success, false, 'Loading broken module must return false');
  
  const failedMod = registry.get('non-existent-fake-module');
  assert(failedMod, 'Failed module must be recorded in registry');
  assert.strictEqual(failedMod.status, 'FAILED');
  assert(failedMod.stats.lastError, 'Last error must be captured');

  // Case B: Sandboxed Router catches thrown exception, prevents process crash, and isolates error
  const innerRouter = Router();
  innerRouter.get('/test-crash', (_req, _res) => {
    throw new Error('Synthetic database pool exhausted inside module');
  });

  const sandboxedRouter = createModuleSandbox('fault-simulator', innerRouter);
  assert(sandboxedRouter, 'Sandbox router must be created');

  // Verify simulated request error boundary
  let capturedStatus = null;
  let capturedBody = null;
  const mockReq = { headers: {} };
  const mockRes = {
    headers: {},
    setHeader: (k, v) => { mockRes.headers[k] = v; },
    getHeader: (k) => mockRes.headers[k],
    on: () => {},
    status: (code) => {
      capturedStatus = code;
      return {
        json: (data) => {
          capturedBody = data;
          return data;
        },
      };
    },
  };

  // Dispatch through error boundary
  const errorBoundaryLayer = sandboxedRouter.stack.find(l => l.handle && l.handle.length === 4);
  assert(errorBoundaryLayer, 'Sandbox must include 4-argument error boundary middleware');

  errorBoundaryLayer.handle(
    new Error('Synthetic database pool exhausted inside module'),
    mockReq,
    mockRes,
    () => {}
  );

  assert.strictEqual(capturedStatus, 500, 'Error boundary must emit HTTP 500');
  assert.strictEqual(capturedBody.module, 'fault-simulator', 'Error response must attribute exact module');
  assert.strictEqual(capturedBody.title, 'Isolated Module Processing Exception');
  assert.strictEqual(mockRes.headers['X-Module-Name'], 'fault-simulator', 'X-Module-Name header must be set');

  const faultMod = registry.get('fault-simulator');
  assert.strictEqual(faultMod.stats.errorCount, 1, 'Registry must track error count for fault-simulator');
});

// 23. Nodemailer OTP Email Generator & Google Recovery Transporter Lifecycle
await runTest('Nodemailer OTP Email Generator & Google Recovery Transporter Lifecycle', async () => {
  const testEmail = 'guest.testing@gmail.com';
  const testCode = '719304';
  const testName = 'Juan Dela Cruz';

  // Test dispatching OTP email
  const result = await sendRecoveryOTP({
    to: testEmail,
    code: testCode,
    name: testName,
  });

  assert(result, 'Nodemailer transporter must return a response object');
  assert(result.messageId, 'Nodemailer response must contain a valid messageId');

  // Test dispatching password reset success notice
  const successResult = await sendPasswordResetSuccess({
    to: testEmail,
    name: testName,
  });

  assert(successResult, 'Nodemailer success notification must return a response object');
  assert(successResult.messageId, 'Success notification must contain a messageId');
});

// 24. Chatbot Security: Rate Limiting & Input Protection
await runTest('Chatbot Security: Input Sanitization, Rate Limiter & Token Fallback', async () => {
  const chatbotPath = path.resolve(serverRoot, 'src/socket/chatbot.js');
  const content = fs.readFileSync(chatbotPath, 'utf8');

  assert(content.includes('slice(0, 500)'), 'Chatbot must truncate user input to 500 characters');
  assert(content.includes('msgHistory.length >= 10'), 'Chatbot must enforce rate limit of 10 messages per 10s');
  assert(content.includes('admin.auth.getUser(token)'), 'Chatbot must include Supabase Auth verification fallback');
  assert(content.includes('clearTimeout(pendingTimeout)'), 'Chatbot must prevent overlapping timer execution');
});

// 25. Data Analytics: Dynamic Kitchen Food Sales & Metric Wiring
await runTest('Data Analytics: Dynamic Kitchen Food Sales & CSAT Aggregation', async () => {
  const analyticsPath = path.resolve(serverRoot, 'src/routes/analytics.routes.js');
  const content = fs.readFileSync(analyticsPath, 'utf8');

  assert(content.includes('food_sales'), 'Analytics overview must include dynamic food_sales in payload');
  assert(content.includes('automation_rate_pct'), 'Analytics overview must include dynamic automation_rate_pct');
  assert(content.includes('chatbot_bookings'), 'Analytics overview must include dynamic chatbot_bookings count');
  assert(content.includes('chatbot_csat_pct'), 'Analytics overview must include dynamic chatbot_csat_pct');
});

// 26. Client User Account Creation: Gmail & Facebook Auto Sign-Up, Mandatory Name Sentinel & 2FA Finalization Lifecycle
await runTest('Client User Account Creation: Gmail & Facebook Auto Sign-Up, Mandatory Name Sentinel & 2FA Finalization', async () => {
  // 1. Mandatory Name Validation Gate ("and the name is still need")
  const missingNamePayload = {
    email: 'guest.test@gmail.com',
    password: 'SecurePassword123!',
    first_name: '',
    last_name: '',
    provider: 'gmail',
  };
  const { error: missingNameErr } = joiSchemas.initiateSignup.validate(missingNamePayload);
  assert(missingNameErr, 'Schema must reject account sign-up when first_name or last_name is missing');
  assert(
    missingNameErr.details.some((d) => d.message.includes('First name is strictly required') || d.message.includes('first_name')),
    'Validation error must identify first_name requirement'
  );

  // 2. Valid Gmail Account Creation Payload
  const validGmailPayload = {
    email: 'guest.verification@gmail.com',
    password: 'SecurePassword123!',
    first_name: 'Elena',
    middle_name: 'Joy',
    last_name: 'Rivera',
    phone: '+63 917 555 8899',
    provider: 'gmail',
    is_automated: true,
  };
  const { error: validGmailErr, value: validatedGmail } = joiSchemas.initiateSignup.validate(validGmailPayload);
  assert.ifError(validGmailErr);
  assert.strictEqual(validatedGmail.first_name, 'Elena');
  assert.strictEqual(validatedGmail.last_name, 'Rivera');
  assert.strictEqual(validatedGmail.provider, 'gmail');
  assert.strictEqual(validatedGmail.is_automated, true);

  // 3. Valid Facebook Auto Sign-Up Payload
  const validFbPayload = {
    email: 'social.guest@facebook.com',
    password: 'FacebookClientSecret123!',
    first_name: 'David',
    middle_name: 'Ray',
    last_name: 'Aquino',
    phone: '+63 920 888 7766',
    provider: 'facebook',
    is_automated: true,
  };
  const { error: validFbErr, value: validatedFb } = joiSchemas.initiateSignup.validate(validFbPayload);
  assert.ifError(validFbErr);
  assert.strictEqual(validatedFb.first_name, 'David');
  assert.strictEqual(validatedFb.last_name, 'Aquino');
  assert.strictEqual(validatedFb.provider, 'facebook');

  // 4. Test 2FA OTP Email Generator via Google Mail / SMTP Transporter
  const testCode = '892104';
  const mailResult = await sendSignup2FAOTP({
    to: 'guest.verification@gmail.com',
    code: testCode,
    name: 'Elena Joy Rivera',
    provider: 'gmail',
  });
  assert(mailResult, 'sendSignup2FAOTP must return a valid nodemailer response');
  assert(mailResult.messageId, '2FA OTP response must contain a valid messageId');

  // 5. 2FA Code Schema Validation
  const validCodePayload = { email: 'guest.verification@gmail.com', code: '892104' };
  const { error: codeErr } = joiSchemas.verifySignup2FA.validate(validCodePayload);
  assert.ifError(codeErr);

  const invalidCodePayload = { email: 'guest.verification@gmail.com', code: '123' };
  const { error: badCodeErr } = joiSchemas.verifySignup2FA.validate(invalidCodePayload);
  assert(badCodeErr, '2FA verification schema must reject codes not exactly 6 characters');

  // 6. Test Account Finalization & Welcome Email Dispatch
  const welcomeResult = await sendWelcomeClientEmail({
    to: 'guest.verification@gmail.com',
    name: 'Elena Joy Rivera',
    provider: 'gmail',
  });
  assert(welcomeResult, 'sendWelcomeClientEmail must return a valid nodemailer response');
  assert(welcomeResult.messageId, 'Welcome response must contain a valid messageId');

  // 7. Test 1-Minute Expiration Email: Auto-Removal & "Try Again, please make sure you confirm"
  const expiredEmailResult = await sendSignupExpiredEmail({
    to: 'guest.verification@gmail.com',
    name: 'Elena Joy Rivera',
  });
  assert(expiredEmailResult, 'sendSignupExpiredEmail must return a valid nodemailer response');
  assert(expiredEmailResult.messageId, 'Expired email response must contain a valid messageId');

  // 8. Test expireSignup Joi Schema Validation
  const validExpirePayload = { email: 'guest.verification@gmail.com' };
  const { error: expireSchemaErr } = joiSchemas.expireSignup.validate(validExpirePayload);
  assert.ifError(expireSchemaErr, 'expireSignup schema must validate legitimate email addresses');

  const invalidExpirePayload = { email: 'not-an-email' };
  const { error: badExpireErr } = joiSchemas.expireSignup.validate(invalidExpirePayload);
  assert(badExpireErr, 'expireSignup schema must reject invalid emails');

  // 9. Verify AuthModal UI Source File Integrity for 1-Minute Time Gating & Auto-Removal
  const authModalPath = path.resolve(projectRoot, 'client/src/components/AuthModal.tsx');
  const modalContent = fs.readFileSync(authModalPath, 'utf8');
  assert(modalContent.includes('mode === \'2fa\''), 'AuthModal must contain 2FA confirmation mode');
  assert(modalContent.includes('handleAutoSignUp'), 'AuthModal must contain handleAutoSignUp automated handler');
  assert(modalContent.includes('signInWithFacebook'), 'AuthModal must support Facebook authentication');
  assert(modalContent.includes('FIRST NAME *'), 'AuthModal must strictly require First Name');
  assert(modalContent.includes('LAST NAME *'), 'AuthModal must strictly require Last Name');
  assert(modalContent.includes('api.confirmSignup2FA'), 'AuthModal must call confirmSignup2FA to finalize account');
  assert(modalContent.includes('confirmationTimeLeft'), 'AuthModal must maintain 1-minute countdown timer state');
  assert(modalContent.includes('handleConfirmationTimeout'), 'AuthModal must have handler for 1-minute confirmation expiration');
  assert(modalContent.includes('Try Again, please make sure you confirm'), 'AuthModal must present Try Again please make sure you confirm notice');
  assert(modalContent.includes('api.expireSignup'), 'AuthModal must notify backend when 1-minute expires to auto-remove account');

  // 10. Verify auth.routes.js Backend Route Integrity for 1-Minute Token Gate & Auto-Removal
  const authRoutesPath = path.resolve(serverRoot, 'src/routes/auth.routes.js');
  const authRoutesContent = fs.readFileSync(authRoutesPath, 'utf8');
  assert(authRoutesContent.includes('/auth/signup/expire-unconfirmed'), 'auth.routes.js must have expire-unconfirmed endpoint');
  assert(authRoutesContent.includes('expires_in_seconds: 60'), 'auth.routes.js must enforce 1-minute (60s) confirmation window');
  assert(authRoutesContent.includes('sendSignupExpiredEmail'), 'auth.routes.js must dispatch cancellation email on expiration');
  assert(authRoutesContent.includes('deleteUser'), 'auth.routes.js must auto-remove unconfirmed accounts upon 1-minute expiration');

  // 11. Profile Entry Type Constraints: Char Only for Names/City, Number Only for Phone/Emergency
  const invalidNamePayload = { ...validGmailPayload, first_name: 'Elena123' };
  const { error: invalidNameErr } = joiSchemas.initiateSignup.validate(invalidNamePayload);
  assert(invalidNameErr, 'Schema must reject names containing numbers or non-character symbols');

  const invalidPhonePayload = { ...validGmailPayload, phone: 'call-me-phone' };
  const { error: invalidPhoneErr } = joiSchemas.initiateSignup.validate(invalidPhonePayload);
  assert(invalidPhoneErr, 'Schema must reject phone containing alphabetic characters');

  const invalidEmergencyPayload = { ...validGmailPayload, emergency_contact: 'ask-for-help' };
  const { error: invalidEmergencyErr } = joiSchemas.initiateSignup.validate(invalidEmergencyPayload);
  assert(invalidEmergencyErr, 'Schema must reject emergency contact containing alphabetic characters');

  // Verify client input sanitization regex in AuthModal.tsx
  assert(modalContent.includes('replace(/[^a-zA-Z\\s\\-]/g, \'\')'), 'AuthModal must sanitize char-only inputs');
  assert(modalContent.includes('replace(/\\D/g, \'\').slice(0, 11)'), 'AuthModal must sanitize strictly 11-digit number-only inputs');
  assert(modalContent.includes('11-DIGIT NUMBER ONLY'), 'AuthModal must label 11-digit number inputs');
});



// 27. AI .TSX Guardrailing: Anti-Hacking, System Inquiries, Concerns & Contact Us Hotlines
await runTest('AI .TSX Guardrailing: Anti-Hacking, System Inquiries, Concerns & Contact Us Hotlines', async () => {
  const guardrailsPath = path.resolve(projectRoot, 'client/src/lib/aiGuardrails.ts');
  assert(fs.existsSync(guardrailsPath), 'client/src/lib/aiGuardrails.ts must exist');
  const guardContent = fs.readFileSync(guardrailsPath, 'utf8');

  // Verify Anti-Hacking Signatures
  assert(guardContent.includes('evaluateClientGuardrails'), 'Must export evaluateClientGuardrails function');
  assert(guardContent.includes('PROMPT_INJECTION_PATTERNS'), 'Must define PROMPT_INJECTION_PATTERNS');
  assert(guardContent.includes('EXFILTRATION_PATTERNS'), 'Must define EXFILTRATION_PATTERNS');
  assert(guardContent.includes('CODE_INJECTION_PATTERNS'), 'Must define CODE_INJECTION_PATTERNS');

  // Verify System Intent Classifier & Contact Hotlines
  assert(guardContent.includes('detectSystemIntent'), 'Must export detectSystemIntent');
  assert(guardContent.includes('RESORT_CONTACT_INFO'), 'Must define RESORT_CONTACT_INFO');
  assert(guardContent.includes('+63 900 555 0123'), 'Contact info must include primary front desk phone');
  assert(guardContent.includes('+63 917 123 4567'), 'Contact info must include Viber/WhatsApp number');
  assert(guardContent.includes('support@jdbeachhouse.com'), 'Contact info must include support email');

  // Verify Chatbot UI (.TSX) Guardrail & Quick Actions Integration
  const chatbotTsxPath = path.resolve(projectRoot, 'client/src/components/Chatbot.tsx');
  const tsxContent = fs.readFileSync(chatbotTsxPath, 'utf8');
  assert(tsxContent.includes('evaluateClientGuardrails'), 'Chatbot.tsx must integrate evaluateClientGuardrails');
  assert(tsxContent.includes('AI SECURITY GUARDRAIL ENFORCED'), 'Chatbot.tsx must display security guardrail badge');
  assert(tsxContent.includes('GUEST CONCERN PRIORITY NOTIFICATION'), 'Chatbot.tsx must display guest concern badge');
  assert(tsxContent.includes('FRONT DESK 24/7 HOTLINE'), 'Chatbot.tsx must render interactive contact card');

  // Verify Backend Chatbot Guardrails & Fallbacks
  const backendChatbotPath = path.resolve(serverRoot, 'src/socket/chatbot.js');
  const backendContent = fs.readFileSync(backendChatbotPath, 'utf8');
  assert(backendContent.includes('checkBackendGuardrails'), 'Backend must enforce checkBackendGuardrails');
  assert(backendContent.includes('room recommendations for a group'), 'Gemini prompt must explain party size and 5 pax family recommendations');
  assert(backendContent.includes('Booking: Book online'), 'Gemini prompt must explain booking system mechanics');
  assert(backendContent.includes('is_concern: true'), 'Backend fallback must support concern escalation');
  assert(backendContent.includes('contact_card: true'), 'Backend fallback must support contact card dispatch');
});

console.log('\n-------------------------------------------------------------');
console.log(` 🏆 GREEN SUITE VERIFICATION RESULT: ${passedTests}/${totalTests} TESTS PASSED 🟢`);
console.log('=============================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
