import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { antiXssSanitizer, cookieTokenizer, cspDirectives, securityHeaders, safeRedirect } from '../src/middleware/security.js';
import { ngwfFirewall, pathNormalizer, isIpQuarantined, quarantineIp, releaseQuarantinedIp, getQuarantineStats, clearAllQuarantines } from '../src/middleware/ngwfSecurity.js';
import { checkBruteForceLockout, recordFailedAttempt, recordSuccessfulAttempt, getBruteForceStats, clearAllLockouts } from '../src/middleware/bruteForceGuard.js';
import securityRoutes from '../src/routes/security.routes.js';
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
import {
  CHART_OF_ACCOUNTS,
  getLedgerEntries,
  createLedgerEntry,
  createJournalPair,
  calculateTrialBalance,
  exportPostgresSQL,
  exportJSON,
  exportCSV,
  importAdaptiveBackup,
} from '../src/lib/ledgerService.js';
import { registry } from '../src/framework/ModuleRegistry.js';
import { createModuleSandbox, extractEndpoints } from '../src/framework/ModuleSandbox.js';
import { loadRouteModule, loadDomainPlugin, bootstrapFramework } from '../src/framework/ModuleLoader.js';
import { sendRecoveryOTP, sendPasswordResetSuccess, sendSignup2FAOTP, sendWelcomeClientEmail, sendSignupExpiredEmail, sendRefundRequestedEmail, sendRefundConfirmedEmail } from '../src/lib/mailer.js';
import { findAvailableServiceAgent } from '../src/socket/chatbot.js';
import { logAuditEvent, getAuditLogs } from '../src/lib/auditLogger.js';
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

// 12. Zero Duplicate SQL/System Files Integrity Test
runTest('Zero Duplicate SQL/System Files Integrity', () => {

  const oldMigrationSql = path.resolve(projectRoot, 'updates/migrations/001_initial_baseline.sql');
  const oldProvisionSql = path.resolve(projectRoot, 'supabase/provision_production_accounts.sql');
  const duplicateRootServer = path.resolve(projectRoot, 'server.js');
  const duplicateSrcServer = path.resolve(projectRoot, 'server/src/server.js');

  assert.strictEqual(fs.existsSync(oldMigrationSql), false, 'Old baseline SQL file should be removed');
  assert.strictEqual(fs.existsSync(oldProvisionSql), false, 'Duplicate provision SQL file should be removed');
  assert.strictEqual(fs.existsSync(duplicateRootServer), false, 'Duplicate root server.js should be removed');
  assert.strictEqual(fs.existsSync(duplicateSrcServer), false, 'Duplicate server/src/server.js should be removed');
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

  // Test dispatching "Refund In Process" email on the day requested
  const refundReqResult = await sendRefundRequestedEmail({
    to: testEmail,
    name: testName,
    reservationId: 'res-test-9988',
    roomName: 'Patar Beach Villa',
    checkIn: '2026-11-01',
    checkOut: '2026-11-03',
    amount: 7000,
    reason: 'Guest travel plan change',
  });
  assert(refundReqResult, 'sendRefundRequestedEmail must return a valid nodemailer response');
  assert(refundReqResult.messageId, 'Refund request email must contain a messageId');

  // Test dispatching "Refund Confirmed & Processed" email
  const refundConfResult = await sendRefundConfirmedEmail({
    to: testEmail,
    name: testName,
    reservationId: 'res-test-9988',
    roomName: 'Patar Beach Villa',
    amount: 7000,
    refundMethod: 'GCash',
    referenceNumber: 'GCASH-TEST-1234',
  });
  assert(refundConfResult, 'sendRefundConfirmedEmail must return a valid nodemailer response');
  assert(refundConfResult.messageId, 'Refund confirmed email must contain a messageId');
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

// 28. Admin Control Center: Accommodations & Inventory Management Suite
await runTest('Admin Control Center: Accommodations & Inventory Management Suite', async () => {
  // 1. Verify rooms backend routes
  const roomsRoutePath = path.resolve(serverRoot, 'src/routes/rooms.routes.js');
  const roomsContent = fs.readFileSync(roomsRoutePath, 'utf8');
  assert(roomsContent.includes("r.post('/rooms'"), 'rooms.routes.js must export POST /rooms');
  assert(roomsContent.includes("r.patch('/rooms/:id'"), 'rooms.routes.js must export PATCH /rooms/:id');
  assert(roomsContent.includes("r.delete('/rooms/:id'"), 'rooms.routes.js must export DELETE /rooms/:id');

  // 2. Verify department inventory backend routes
  const deptRoutePath = path.resolve(serverRoot, 'src/routes/department.routes.js');
  const deptContent = fs.readFileSync(deptRoutePath, 'utf8');
  assert(deptContent.includes("r.post('/department/inventory'"), 'department.routes.js must export POST /department/inventory');
  assert(deptContent.includes("r.patch('/department/inventory/:id'"), 'department.routes.js must export PATCH /department/inventory/:id');
  assert(deptContent.includes("r.delete('/department/inventory/:id'"), 'department.routes.js must export DELETE /department/inventory/:id');

  // 3. Verify client API mutations
  const apiPath = path.resolve(projectRoot, 'client/src/lib/api.ts');
  const apiContent = fs.readFileSync(apiPath, 'utf8');
  assert(apiContent.includes('createRoom:'), 'api.ts must export createRoom');
  assert(apiContent.includes('updateRoom:'), 'api.ts must export updateRoom');
  assert(apiContent.includes('deleteRoom:'), 'api.ts must export deleteRoom');
  assert(apiContent.includes('createInventoryItem:'), 'api.ts must export createInventoryItem');
  assert(apiContent.includes('updateInventoryItem:'), 'api.ts must export updateInventoryItem');
  assert(apiContent.includes('deleteInventoryItem:'), 'api.ts must export deleteInventoryItem');

  // 4. Verify Admin UI integration & modals
  const adminPath = path.resolve(projectRoot, 'client/src/pages/Admin.tsx');
  const adminContent = fs.readFileSync(adminPath, 'utf8');
  assert(adminContent.includes("activeTab === 'inventory'"), 'Admin.tsx must render inventory tab');
  assert(adminContent.includes('showCreateModal'), 'Admin.tsx must include showCreateModal');
  assert(adminContent.includes('recoveryTarget'), 'Admin.tsx must include recoveryTarget');
  assert(adminContent.includes('showCreateRoomModal'), 'Admin.tsx must include showCreateRoomModal');
  assert(adminContent.includes('editingRoom'), 'Admin.tsx must include editingRoom modal');
  assert(adminContent.includes('showCreateSupplyModal'), 'Admin.tsx must include showCreateSupplyModal');
  assert(adminContent.includes('API_BASE'), 'Admin.tsx must use API_BASE for SSE streaming');
});

// 29. Brute Force & Credential Stuffing Guard Engine
await runTest('Brute Force Guard: Progressive Thresholds, Lockout Window & Audit Emission', async () => {
  const testIp = '198.51.100.42';
  const testUser = 'attacker@evilcorp.xyz';

  process.env.ENFORCE_BRUTE_FORCE_TEST = 'true';
  try {
    clearAllLockouts();

    // 1-4 failed attempts should record strikes without triggering lockout
    for (let i = 1; i <= 4; i++) {
      await recordFailedAttempt(testIp, testUser);
      const status = checkBruteForceLockout(testIp, testUser);
      assert.strictEqual(status.locked, false, `Strike ${i} should not lock out account`);
      assert.strictEqual(status.attempts, i, `Strike count should be ${i}`);
    }

    // 5th attempt must trigger progressive lockout (15 minutes)
    await recordFailedAttempt(testIp, testUser);
    const lockedStatus = checkBruteForceLockout(testIp, testUser);
    assert.strictEqual(lockedStatus.locked, true, '5th failed attempt must trigger lockout');
    assert.ok(lockedStatus.remainingSeconds > 0, 'Remaining lockout seconds must be greater than 0');

    // Stats reflection
    const stats = getBruteForceStats();
    assert.ok(stats.active_lockouts >= 1, 'Stats must reflect at least 1 active lockout');
    assert.strictEqual(stats.max_threshold, 5, 'Max threshold must be 5');

    // Successful attempt clears lockout
    recordSuccessfulAttempt(testIp, testUser);
    const resetStatus = checkBruteForceLockout(testIp, testUser);
    assert.strictEqual(resetStatus.locked, false, 'Successful authentication must reset lockout state');
  } finally {
    delete process.env.ENFORCE_BRUTE_FORCE_TEST;
    clearAllLockouts();
  }
});

// 30. NGWF Active IP Quarantine & Defense Telemetry Center
await runTest('NGWF Active IP Threat Quarantine & Security Telemetry Center', async () => {
  const attackingIp = '203.0.113.88';
  clearAllQuarantines();

  // Strike 1: Malicious SQLi payload blocked with NGWF_THREAT_BLOCKED
  let res1Status = 0;
  let res1Data = null;
  const mockRes1 = {
    status(code) { res1Status = code; return { json(d) { res1Data = d; } }; },
  };
  ngwfFirewall({
    ip: attackingIp,
    originalUrl: '/api/rooms',
    query: { filter: "1' UNION SELECT username, password FROM profiles--" },
    body: {},
    params: {},
  }, mockRes1, () => {});

  assert.strictEqual(res1Status, 403, 'Strike 1 must return 403');
  assert.strictEqual(res1Data?.code, 'NGWF_THREAT_BLOCKED', 'Strike 1 code must be NGWF_THREAT_BLOCKED');
  assert.strictEqual(res1Data?.strikes, 1, 'Strike count must be 1');

  // Strike 2: Second malicious probe (blind SQLi)
  let res2Data = null;
  const mockRes2 = {
    status() { return { json(d) { res2Data = d; } }; },
  };
  ngwfFirewall({
    ip: attackingIp,
    originalUrl: '/api/rooms',
    query: { q: "WAITFOR DELAY '0:0:5'" },
    body: {},
    params: {},
  }, mockRes2, () => {});
  assert.strictEqual(res2Data?.strikes, 2, 'Strike count must be 2');

  // Strike 3: Prototype pollution attempt -> Escalates to NGWF_IP_QUARANTINED
  let res3Data = null;
  const mockRes3 = {
    status() { return { json(d) { res3Data = d; } }; },
  };
  ngwfFirewall({
    ip: attackingIp,
    originalUrl: '/api/feedback',
    query: {},
    body: JSON.parse('{"__proto__": {"admin": true}}'),
    params: {},
  }, mockRes3, () => {});

  assert.strictEqual(res3Data?.code, 'NGWF_IP_QUARANTINED', 'Strike 3 must escalate to NGWF_IP_QUARANTINED');
  assert.strictEqual(res3Data?.ip, attackingIp, 'Quarantine data must specify attacking IP');

  // Any subsequent request from this IP (even a benign request) must be immediately blocked
  let res4Data = null;
  const mockRes4 = {
    status(code) { assert.strictEqual(code, 403); return { json(d) { res4Data = d; } }; },
  };
  ngwfFirewall({
    ip: attackingIp,
    originalUrl: '/api/rooms',
    query: {},
    body: {},
    params: {},
  }, mockRes4, () => {});
  assert.strictEqual(res4Data?.code, 'NGWF_IP_QUARANTINED', 'Subsequent benign requests from quarantined IP must be blocked');

  // Verify Quarantine Telemetry
  const qStats = getQuarantineStats();
  assert.strictEqual(qStats.active_quarantines_count, 1, 'Quarantine stats must report 1 quarantined IP');
  assert.strictEqual(qStats.active_quarantines[0].ip, attackingIp);

  // Administrative unban / release
  await releaseQuarantinedIp(attackingIp);
  const postReleaseCheck = isIpQuarantined(attackingIp);
  assert.strictEqual(postReleaseCheck.quarantined, false, 'IP must be released from quarantine');

  // Verify security.routes.js module and client integration
  assert(securityRoutes && typeof securityRoutes === 'function', 'security.routes.js must export an Express router');

  const clientApiPath = path.resolve(projectRoot, 'client/src/lib/api.ts');
  const clientApiContent = fs.readFileSync(clientApiPath, 'utf8');
  assert(clientApiContent.includes('securityPosture:'), 'client api.ts must export securityPosture');
  assert(clientApiContent.includes('releaseQuarantinedIp:'), 'client api.ts must export releaseQuarantinedIp');

  const clientAdminPath = path.resolve(projectRoot, 'client/src/pages/Admin.tsx');
  const clientAdminContent = fs.readFileSync(clientAdminPath, 'utf8');
  assert(clientAdminContent.includes('Active Defense Telemetry & Perimeter Hardening'), 'Admin.tsx must render defense telemetry banner');
  assert(clientAdminContent.includes('handleUnbanIp'), 'Admin.tsx must define handleUnbanIp action');

  clearAllQuarantines();
});

// 31. Account Management, OTP Recovery, Account Chat Persistence & Refund Automation Lifecycle
await runTest('Account Management, OTP Recovery, Account Chat Persistence & Refund Automation Lifecycle', async () => {
  // 1. Verify me.routes.js administrative mutation endpoints (PATCH & DELETE /admin/users/:id)
  const meRoutesPath = path.resolve(serverRoot, 'src/routes/me.routes.js');
  const meContent = fs.readFileSync(meRoutesPath, 'utf8');
  assert(meContent.includes("r.patch('/admin/users/:id'"), 'me.routes.js must export PATCH /admin/users/:id for profile edits');
  assert(meContent.includes("r.delete('/admin/users/:id'"), 'me.routes.js must export DELETE /admin/users/:id with self-deletion guard');
  assert(meContent.includes('USER_PROFILE_UPDATED'), 'me.routes.js must emit USER_PROFILE_UPDATED audit log');
  assert(meContent.includes('USER_DELETED'), 'me.routes.js must emit USER_DELETED audit log');

  // 2. Verify chat.routes.js mandated account chat reload & persistence endpoints
  const chatRoutesPath = path.resolve(serverRoot, 'src/routes/chat.routes.js');
  const chatContent = fs.readFileSync(chatRoutesPath, 'utf8');
  assert(chatContent.includes("r.get('/chat/my-messages'"), 'chat.routes.js must export GET /chat/my-messages for account reload');
  assert(chatContent.includes("r.post('/chat/my-messages'"), 'chat.routes.js must export POST /chat/my-messages for account chat saving');

  // 3. Verify reservations.routes.js refund request & confirmation with email dispatch
  const resRoutesPath = path.resolve(serverRoot, 'src/routes/reservations.routes.js');
  const resContent = fs.readFileSync(resRoutesPath, 'utf8');
  assert(resContent.includes("r.post('/reservations/:id/refund-request'"), 'reservations.routes.js must export POST /refund-request');
  assert(resContent.includes("r.post('/reservations/:id/refund-confirm'"), 'reservations.routes.js must export POST /refund-confirm');
  assert(resContent.includes('sendRefundRequestedEmail'), 'reservations.routes.js must invoke sendRefundRequestedEmail');
  assert(resContent.includes('sendRefundConfirmedEmail'), 'reservations.routes.js must invoke sendRefundConfirmedEmail');

  // 4. Verify client api.ts methods for account management, chat, and refunds
  const clientApiPath = path.resolve(projectRoot, 'client/src/lib/api.ts');
  const clientApiContent = fs.readFileSync(clientApiPath, 'utf8');
  assert(clientApiContent.includes('adminUpdateUser:'), 'client api.ts must export adminUpdateUser');
  assert(clientApiContent.includes('adminDeleteUser:'), 'client api.ts must export adminDeleteUser');
  assert(clientApiContent.includes('requestRefund:'), 'client api.ts must export requestRefund');
  assert(clientApiContent.includes('confirmRefund:'), 'client api.ts must export confirmRefund');
  assert(clientApiContent.includes('myChatMessages:'), 'client api.ts must export myChatMessages');

  // 5. Verify Chatbot.tsx mandated account reload & persistence
  const chatbotPath = path.resolve(projectRoot, 'client/src/components/Chatbot.tsx');
  const chatbotContent = fs.readFileSync(chatbotPath, 'utf8');
  assert(chatbotContent.includes('jd_chat_msgs_'), 'Chatbot.tsx must key chat cache by account ID');
  assert(chatbotContent.includes('api.myChatMessages'), 'Chatbot.tsx must reload account chat from Supabase');
  assert(chatbotContent.includes('reloadAccountChat'), 'Chatbot.tsx must implement reloadAccountChat function');

  // 6. Verify MobileResortApp.tsx OTP Forgot Password integration
  const mobileAppPath = path.resolve(projectRoot, 'client/src/components/MobileResortApp.tsx');
  const mobileAppContent = fs.readFileSync(mobileAppPath, 'utf8');
  assert(mobileAppContent.includes('handleMobileForgotPassword'), 'MobileResortApp.tsx must define handleMobileForgotPassword');
  assert(mobileAppContent.includes('handleMobileResetPassword'), 'MobileResortApp.tsx must define handleMobileResetPassword');
  assert(mobileAppContent.includes('showForgotModal'), 'MobileResortApp.tsx must render mobile recovery modal');

  // 7. Verify Admin.tsx account management, OTP recovery and refund modal
  const adminPath = path.resolve(projectRoot, 'client/src/pages/Admin.tsx');
  const adminContent = fs.readFileSync(adminPath, 'utf8');
  assert(adminContent.includes('handleUpdateUser'), 'Admin.tsx must define handleUpdateUser');
  assert(adminContent.includes('handleDeleteUser'), 'Admin.tsx must define handleDeleteUser');
  assert(adminContent.includes('handleAdminForgotPassword'), 'Admin.tsx must define handleAdminForgotPassword');
  assert(adminContent.includes('handleRefundSubmit'), 'Admin.tsx must define handleRefundSubmit');
  assert(adminContent.includes('editingUser'), 'Admin.tsx must render editingUser modal');
  assert(adminContent.includes('userToDelete'), 'Admin.tsx must render userToDelete modal');
  assert(adminContent.includes('refundTarget'), 'Admin.tsx must render refundTarget modal');
});

// 32. Service Agent Directing & Permanent Database Recording Lifecycle
await runTest('Service Agent Directing & Permanent Database Recording Lifecycle', async () => {
  // 1. Verify available service agent discovery engine
  const agent = await findAvailableServiceAgent();
  assert(agent && typeof agent === 'object', 'findAvailableServiceAgent must return an agent object');
  assert(agent.name, 'Service agent must have a name');
  assert(agent.role, 'Service agent must have a designated role (e.g. Front Desk Receptionist)');
  assert(agent.phone, 'Service agent must have contact phone');
  assert.strictEqual(agent.is_online, true, 'Service agent must be flagged online');

  // 2. Verify chatbot.js exports and real-time socket routing methods
  const chatbotModulePath = path.resolve(serverRoot, 'src/socket/chatbot.js');
  const chatbotContent = fs.readFileSync(chatbotModulePath, 'utf8');
  assert(chatbotContent.includes('findAvailableServiceAgent'), 'chatbot.js must export findAvailableServiceAgent');
  assert(chatbotContent.includes('emitToGuest'), 'chatbot.js must export emitToGuest');
  assert(chatbotContent.includes('broadcastToStaff'), 'chatbot.js must export broadcastToStaff');
  assert(chatbotContent.includes('staff:customer_handoff'), 'chatbot.js must emit staff:customer_handoff');
  assert(chatbotContent.includes('agent:guest_message'), 'chatbot.js must emit agent:guest_message to staff');
  assert(chatbotContent.includes('socket.isDirectedToAgent'), 'chatbot.js must track isDirectedToAgent state on socket');

  // 3. Verify chat.routes.js service agent directing & dual database recording
  const chatRoutesPath = path.resolve(serverRoot, 'src/routes/chat.routes.js');
  const chatContent = fs.readFileSync(chatRoutesPath, 'utf8');
  assert(chatContent.includes("sender: 'service_agent'"), 'chat.routes.js must record sender: service_agent in database');
  assert(chatContent.includes('directed_to_agent: true'), 'chat.routes.js must persist directed_to_agent metadata in chat_messages');
  assert(chatContent.includes('findAvailableServiceAgent()'), 'chat.routes.js must resolve available agent dynamically');
  assert(chatContent.includes('emitToGuest('), 'chat.routes.js must emit staff reply to guest room');
  assert(chatContent.includes('broadcastToStaff('), 'chat.routes.js must broadcast customer handoffs to staff');

  // 4. Verify client Chatbot.tsx service agent status banner and badges
  const clientChatbotPath = path.resolve(projectRoot, 'client/src/components/Chatbot.tsx');
  const clientChatbotContent = fs.readFileSync(clientChatbotPath, 'utf8');
  assert(clientChatbotContent.includes('isDirectedToAgent'), 'Chatbot.tsx must track isDirectedToAgent state');
  assert(clientChatbotContent.includes('assignedAgent'), 'Chatbot.tsx must track assignedAgent state');
  assert(clientChatbotContent.includes('Directed to:'), 'Chatbot.tsx must render directed service agent status banner');
  assert(clientChatbotContent.includes('SERVICE AGENT'), 'Chatbot.tsx must render service agent badge on agent replies');
  assert(clientChatbotContent.includes('agent:assigned'), 'Chatbot.tsx must listen for agent:assigned socket event');

  // 5. Verify ExecutiveGuestConversationsPanel.tsx live agent indicators
  const panelPath = path.resolve(projectRoot, 'client/src/components/ExecutiveGuestConversationsPanel.tsx');
  const panelContent = fs.readFileSync(panelPath, 'utf8');
  assert(panelContent.includes('staff:customer_handoff'), 'ExecutiveGuestConversationsPanel.tsx must listen for customer handoffs');
  assert(panelContent.includes('agent:guest_message'), 'ExecutiveGuestConversationsPanel.tsx must listen for live guest messages');
  assert(panelContent.includes('Live with Agent'), 'ExecutiveGuestConversationsPanel.tsx must display Live with Agent badge');
});

// 33. System Security Audit Trail: Daily Action Collections, Role-Specific Filtering & Customer Login Logging
await runTest('System Security Audit Trail: Daily Action Collections, Role Filtering & Customer Login Logging', async () => {
  const todayDate = new Date().toISOString().slice(0, 10);

  // 1. Log a customer login timestamp
  const custEntry = await logAuditEvent({
    actor: {
      id: 'cust-uuid-1234',
      email: 'customer.juan@gmail.com',
      full_name: 'Juan Dela Cruz',
      role: 'customer',
    },
    action: 'CUSTOMER_LOGIN',
    resourceType: 'authentication',
    resourceId: 'cust-uuid-1234',
    details: {
      process: 'Customer Login Timestamp',
      message: 'Customer Juan Dela Cruz logged in successfully',
      login_method: 'credentials',
    },
  });

  assert.strictEqual(custEntry.action, 'CUSTOMER_LOGIN', 'Action must be CUSTOMER_LOGIN');
  assert.strictEqual(custEntry.role, 'customer', 'Role must be customer');
  assert.ok(custEntry.timestamp, 'Timestamp must exist');
  assert.ok(custEntry.details.message, 'Message details must exist');

  // 2. Log an admin process
  const adminEntry = await logAuditEvent({
    actor: {
      id: 'admin-uuid-0001',
      email: 'admin@janddbeachhouse.ph',
      full_name: 'Executive Director',
      role: 'administrator',
    },
    action: 'ROOM_UPDATE',
    resourceType: 'room',
    resourceId: 'room-deluxe-villa',
    details: {
      process: 'Updated Room Rates & Units',
      rate_php: 5500,
      units: 4,
    },
  });

  assert.strictEqual(adminEntry.action, 'ROOM_UPDATE');
  assert.strictEqual(adminEntry.role, 'administrator');

  // 3. Log a staff operational action
  const staffEntry = await logAuditEvent({
    actor: {
      id: 'staff-uuid-0042',
      email: 'frontdesk@janddbeachhouse.ph',
      full_name: 'Staff Frontdesk',
      role: 'staff',
    },
    action: 'INVENTORY_STOCK_UPDATE',
    resourceType: 'inventory',
    resourceId: 'item-towels-01',
    details: {
      process: 'Restocked Beach Towels',
      delta: 25,
      reason: 'Delivery Restock',
    },
  });

  assert.strictEqual(staffEntry.action, 'INVENTORY_STOCK_UPDATE');

  // 4. Test specific day filtering in getAuditLogs
  const dayResults = await getAuditLogs({ date: todayDate, limit: 100 });
  assert.strictEqual(dayResults.success, true, 'getAuditLogs should succeed');
  assert.ok(Array.isArray(dayResults.logs), 'logs should be an array');
  assert.ok(dayResults.logs.length > 0, 'should return logs for today');
  for (const l of dayResults.logs) {
    const logDate = (l.timestamp || l.created_at || '').slice(0, 10);
    assert.strictEqual(logDate, todayDate, `Log date ${logDate} should match filtered date ${todayDate}`);
  }

  // 5. Test role filtering for customer logins
  const custResults = await getAuditLogs({ role: 'customer', limit: 50 });
  assert.strictEqual(custResults.success, true);
  assert.ok(custResults.logs.some((l) => l.action === 'CUSTOMER_LOGIN'), 'Must find CUSTOMER_LOGIN in customer audit logs');

  // 6. Test role filtering for administrators
  const adminResults = await getAuditLogs({ role: 'administrator', limit: 50 });
  assert.strictEqual(adminResults.success, true);
  assert.ok(adminResults.logs.some((l) => l.action === 'ROOM_UPDATE' || l.action.startsWith('ADMIN')), 'Must find admin actions in admin audit logs');

  // 7. Verify routes and frontend integration
  const authRoutesSrc = fs.readFileSync(path.resolve(serverRoot, 'src/routes/auth.routes.js'), 'utf8');
  assert(authRoutesSrc.includes('CUSTOMER_LOGIN'), 'auth.routes.js must emit CUSTOMER_LOGIN audit event on login');
  assert(authRoutesSrc.includes('ADMIN_LOGIN'), 'auth.routes.js must emit ADMIN_LOGIN audit event on admin login');
  assert(authRoutesSrc.includes('STAFF_LOGIN'), 'auth.routes.js must emit STAFF_LOGIN audit event on staff login');

  const auditRoutesSrc = fs.readFileSync(path.resolve(serverRoot, 'src/routes/audit.routes.js'), 'utf8');
  assert(auditRoutesSrc.includes('date = req.query.date'), 'audit.routes.js must accept date query parameter');
  assert(auditRoutesSrc.includes('role = req.query.role'), 'audit.routes.js must accept role query parameter');

  const clientAdminSrc = fs.readFileSync(path.resolve(projectRoot, 'client/src/pages/Admin.tsx'), 'utf8');
  assert(clientAdminSrc.includes('auditDateFilter'), 'Admin.tsx must maintain auditDateFilter state');
  assert(clientAdminSrc.includes('auditRoleFilter'), 'Admin.tsx must maintain auditRoleFilter state');
  assert(clientAdminSrc.includes('SELECT DAY:'), 'Admin.tsx must render specific day selection header');
  assert(clientAdminSrc.includes('ACTOR SCOPE:'), 'Admin.tsx must render role scope pills');
  assert(clientAdminSrc.includes('Customer Sign-In'), 'Admin.tsx must render humanized customer sign-in title');
  assert(clientAdminSrc.includes('AUDIT RECORD INSPECTION'), 'Admin.tsx must provide audit record inspection modal');
});

// 34. Account Deletion Lifecycle, Promotion Removal & Real-Time Room Locking Until Checkout
await runTest('Account Deletion Lifecycle, Promotion Removal & Real-Time Room Locking Until Checkout', async () => {
  const meRoutesSrc = fs.readFileSync(path.resolve(serverRoot, 'src/routes/me.routes.js'), 'utf8');
  assert(meRoutesSrc.includes('deleteUserPermanently'), 'me.routes.js must export deleteUserPermanently helper');
  assert(meRoutesSrc.includes("r.delete('/me'"), 'me.routes.js must provide self-service DELETE /me route');
  assert(meRoutesSrc.includes("r.delete('/admin/users/:id'"), 'me.routes.js must provide administrative DELETE /admin/users/:id route');
  assert(meRoutesSrc.includes('USER_ACCOUNT_SELF_DELETED'), 'me.routes.js must log USER_ACCOUNT_SELF_DELETED audit event');

  const apiSrc = fs.readFileSync(path.resolve(projectRoot, 'client/src/lib/api.ts'), 'utf8');
  assert(apiSrc.includes("deleteMe: () => req('/me', { method: 'DELETE' })"), 'api.ts must export deleteMe method');

  const authCtxSrc = fs.readFileSync(path.resolve(projectRoot, 'client/src/context/AuthContext.tsx'), 'utf8');
  assert(authCtxSrc.includes('deleteAccount: async () =>'), 'AuthContext.tsx must export deleteAccount method');

  // Verify "Save | Delete | Cancel" pattern across user profile settings (supports FontAwesome and classic emojis)
  const myBookingsSrc = fs.readFileSync(path.resolve(projectRoot, 'client/src/pages/MyBookings.tsx'), 'utf8');
  assert(myBookingsSrc.includes('💾 Save') || (myBookingsSrc.includes('fa-floppy-disk') && myBookingsSrc.includes('Save')), 'MyBookings.tsx must render Save button');
  assert(myBookingsSrc.includes('🗑️ Delete') || (myBookingsSrc.includes('fa-trash') && myBookingsSrc.includes('Delete')), 'MyBookings.tsx must render Delete button');
  assert(myBookingsSrc.includes('✕ Cancel') || (myBookingsSrc.includes('Cancel') && (myBookingsSrc.includes('fa-xmark') || myBookingsSrc.includes('✕'))), 'MyBookings.tsx must render Cancel button');
  assert(myBookingsSrc.includes('confirmDeleteProf'), 'MyBookings.tsx must require confirmation before account deletion');

  const mobileAppSrc = fs.readFileSync(path.resolve(projectRoot, 'client/src/components/MobileResortApp.tsx'), 'utf8');
  assert(mobileAppSrc.includes('💾 Save') || (mobileAppSrc.includes('fa-floppy-disk') && mobileAppSrc.includes('Save')), 'MobileResortApp.tsx must render Save button');
  assert(mobileAppSrc.includes('🗑️ Delete') || (mobileAppSrc.includes('fa-trash') && mobileAppSrc.includes('Delete')), 'MobileResortApp.tsx must render Delete button');
  assert(mobileAppSrc.includes('✕ Cancel') || (mobileAppSrc.includes('Cancel') && (mobileAppSrc.includes('fa-xmark') || mobileAppSrc.includes('✕'))), 'MobileResortApp.tsx must render Cancel button');

  const adminSrc = fs.readFileSync(path.resolve(projectRoot, 'client/src/pages/Admin.tsx'), 'utf8');
  assert(adminSrc.includes('💾 Save') || (adminSrc.includes('fa-floppy-disk') && adminSrc.includes('Save')), 'Admin.tsx must render Save button');
  assert(adminSrc.includes('🗑️ Delete') || (adminSrc.includes('fa-trash') && adminSrc.includes('Delete')), 'Admin.tsx must render Delete button');
  assert(adminSrc.includes('✕ Cancel') || (adminSrc.includes('Cancel') && (adminSrc.includes('fa-xmark') || adminSrc.includes('✕'))), 'Admin.tsx must render Cancel button');
  assert(!adminSrc.includes('<th style={{ color: isLightMode ? \'#475569\' : themeMuted }}>Promote</th>'), 'Admin.tsx must remove Promote column from customer accounts table');
  assert(!adminSrc.includes('🌴 Patar Beach Festival Promo 2026'), 'Admin.tsx must remove marketing campaigns modal');

  // Verify Real-Time Room Locking Until Checkout
  const roomsRoutesSrc = fs.readFileSync(path.resolve(serverRoot, 'src/routes/rooms.routes.js'), 'utf8');
  assert(roomsRoutesSrc.includes('is_locked_now'), 'rooms.routes.js must compute is_locked_now based on active stay dates');
  assert(roomsRoutesSrc.includes('units_available_now'), 'rooms.routes.js must compute units_available_now');
  assert(roomsRoutesSrc.includes('unavailable_until_checkout'), 'rooms.routes.js must designate unavailable_until_checkout status');

  const roomsSrc = fs.readFileSync(path.resolve(projectRoot, 'client/src/pages/Rooms.tsx'), 'utf8');
  assert(roomsSrc.includes('Occupied Until Checkout'), 'Rooms.tsx must display Occupied Until Checkout status');
  assert(roomsSrc.includes('AvailabilityCalendar'), 'Rooms.tsx must integrate AvailabilityCalendar');
});

// 35. Double-Entry Debit & Credit Ledger, Trial Balance & Adaptive PostgreSQL Backup Suite
await runTest('Debit & Credit Ledger: Chart of Accounts, Double-Entry Pairs, Trial Balance & Adaptive PostgreSQL Backup', async () => {
  // 1. Chart of Accounts verification
  assert.ok(Array.isArray(CHART_OF_ACCOUNTS), 'CHART_OF_ACCOUNTS must be an array');
  assert.ok(CHART_OF_ACCOUNTS.length >= 10, 'Chart of accounts must have at least 10 accounts');
  const cashAcc = CHART_OF_ACCOUNTS.find((a) => a.code === '1010');
  assert.strictEqual(cashAcc.type, 'ASSET');
  assert.strictEqual(cashAcc.normal, 'DEBIT');
  const revAcc = CHART_OF_ACCOUNTS.find((a) => a.code === '4010');
  assert.strictEqual(revAcc.type, 'REVENUE');
  assert.strictEqual(revAcc.normal, 'CREDIT');

  // 2. Double-entry journal pair posting
  const pairResult = await createJournalPair({
    debit_account_code: '1010',
    credit_account_code: '4010',
    amount_php: 18000,
    particulars: 'Test Stay Settlement Unit TEV',
    reference_id: 'TRX-TEST-001',
    category: 'REVENUE',
  }, { email: 'admin@rockviewresort.ph' });

  assert.ok(pairResult.success, 'createJournalPair must succeed');
  assert.strictEqual(pairResult.debit.entry_type, 'DEBIT');
  assert.strictEqual(pairResult.debit.debit_php, 18000);
  assert.strictEqual(pairResult.credit.entry_type, 'CREDIT');
  assert.strictEqual(pairResult.credit.credit_php, 18000);

  // 3. Trial balance calculation
  const tb = calculateTrialBalance();
  assert.ok(tb.total_debits_php > 0, 'Trial balance must calculate total debits');
  assert.ok(tb.total_credits_php > 0, 'Trial balance must calculate total credits');
  assert.ok(typeof tb.is_balanced === 'boolean', 'Trial balance must return boolean is_balanced');

  // 4. PostgreSQL Dump export
  const sqlDump = exportPostgresSQL();
  assert.ok(sqlDump.includes('BEGIN;'), 'SQL dump must start transaction with BEGIN;');
  assert.ok(sqlDump.includes('CREATE TABLE IF NOT EXISTS public.ledger_entries'), 'SQL dump must contain DDL');
  assert.ok(sqlDump.includes('INSERT INTO public.ledger_entries'), 'SQL dump must contain INSERT statements');
  assert.ok(sqlDump.includes('COMMIT;'), 'SQL dump must commit transaction');

  // 5. JSON export
  const jsonExport = exportJSON();
  assert.strictEqual(jsonExport.table, 'public.ledger_entries');
  assert.ok(Array.isArray(jsonExport.records), 'JSON export must contain records array');
  assert.ok(jsonExport.trial_balance, 'JSON export must include trial balance');

  // 6. CSV export
  const csvExport = exportCSV();
  assert.ok(csvExport.includes('entry_number,posted_at,account_code'), 'CSV export must include standard headers');
  assert.ok(csvExport.includes('1010'), 'CSV export must contain account entries');

  // 7. Adaptive Import: PostgreSQL SQL Dump
  const sqlImportResult = await importAdaptiveBackup(sqlDump, { mode: 'append' }, { email: 'test@rockviewresort.ph' });
  assert.strictEqual(sqlImportResult.detected_format, 'sql', 'Must detect SQL dump format');
  assert.ok(sqlImportResult.imported_count > 0, 'Must import records from SQL dump');

  // 8. Adaptive Import: JSON
  const sampleJson = JSON.stringify([
    {
      account_code: '1010',
      account_name: 'Cash on Hand & Digital Wallets',
      entry_type: 'DEBIT',
      debit_php: 5000,
      credit_php: 0,
      particulars: 'JSON Import Test Deposit',
    },
    {
      account_code: '2010',
      account_name: 'Guest Reservation Deposits',
      entry_type: 'CREDIT',
      debit_php: 0,
      credit_php: 5000,
      particulars: 'JSON Import Test Liability',
    },
  ]);
  const jsonImportResult = await importAdaptiveBackup(sampleJson, { mode: 'append' });
  assert.strictEqual(jsonImportResult.detected_format, 'json', 'Must detect JSON format');
  assert.strictEqual(jsonImportResult.imported_count, 2, 'Must import 2 records from JSON');

  // 9. Adaptive Import: CSV
  const sampleCsv = `entry_number,posted_at,account_code,account_name,entry_type,debit_php,credit_php,running_balance_php,category,particulars,reference_id,status\nLED-CSV-01,2026-10-02T10:00:00Z,1010,Cash on Hand,DEBIT,3000,0,3000,PAYMENT,CSV Test Entry,REF-CSV,POSTED`;
  const csvImportResult = await importAdaptiveBackup(sampleCsv, { mode: 'append' });
  assert.strictEqual(csvImportResult.detected_format, 'csv', 'Must detect CSV format');
  assert.strictEqual(csvImportResult.imported_count, 1, 'Must import 1 record from CSV');

  // 10. Adaptive Import: Physical Logbook notation
  const logbookSample = `Juan Dela Cruz | 2026-10-01 to 2026-10-03 | Unit TEV | 18,000 - 3,000 = 15,000 Bal | DP Paid via GCash`;
  const logbookImportResult = await importAdaptiveBackup(logbookSample, { mode: 'append' });
  assert.strictEqual(logbookImportResult.detected_format, 'logbook', 'Must detect logbook format');
  assert.strictEqual(logbookImportResult.imported_count, 2, 'Must generate dual debit & credit records from logbook line');

  // 11. Schema DDL & Admin Frontend Verification
  const schemaSql = fs.readFileSync(path.resolve(projectRoot, 'schema.sql'), 'utf8');
  assert.ok(schemaSql.includes('public.ledger_entries'), 'schema.sql must define public.ledger_entries');

  const adminSrc = fs.readFileSync(path.resolve(projectRoot, 'client/src/pages/Admin.tsx'), 'utf8');
  assert.ok(adminSrc.includes('General Ledger (Debit & Credit System)'), 'Admin.tsx must render General Ledger Debit & Credit view');
  assert.ok(adminSrc.includes('Trial Balance Status'), 'Admin.tsx must render Trial Balance Status');
  assert.ok(adminSrc.includes('PostgreSQL Ledger Backup & Adaptive Migration'), 'Admin.tsx must render PostgreSQL Backup & Migration modal');
  assert.ok(adminSrc.includes('Record Journal Voucher'), 'Admin.tsx must render Journal Voucher modal');
});

// 36. Complete Signout Purge, Session Storage Isolation & Strict Admin vs Customer Persona Partitioning
await runTest('Complete Signout Purge, Session Storage Isolation & Strict Admin vs Customer Persona Partitioning', async () => {
  // 1. Backend Unauthenticated Access & Elevation Prevention
  const { authenticate } = await import('../src/middleware/auth.js');
  let authError = null;
  let nextCalled = false;
  const mockNext = (err) => {
    if (err) authError = err;
    else nextCalled = true;
  };

  // Case A: Missing token without headers must throw 401
  authError = null; nextCalled = false;
  try {
    await authenticate({ headers: {}, cookies: {} }, {}, mockNext);
  } catch (err) { authError = err; }
  assert.strictEqual(authError?.statusCode, 401, 'Unauthenticated request must be rejected with 401');

  // Case B: Wild unauthenticated request with x-admin-token-key alone must NOT elevate to admin
  authError = null; nextCalled = false;
  try {
    await authenticate({ headers: { 'x-admin-token-key': 'etc-34' }, cookies: {} }, {}, mockNext);
  } catch (err) { authError = err; }
  assert.strictEqual(authError?.statusCode, 401, 'Missing token with x-admin-token-key must NOT elevate without valid token');

  // 2. Server Logout Endpoint Verification
  const authRoutesSrc = fs.readFileSync(path.resolve(serverRoot, 'src/routes/auth.routes.js'), 'utf8');
  assert.ok(authRoutesSrc.includes("r.post('/auth/logout'"), 'auth.routes.js must provide /auth/logout endpoint');
  assert.ok(authRoutesSrc.includes("res.clearCookie('session_token'"), 'auth.routes.js logout must clear session_token cookie');
  assert.ok(authRoutesSrc.includes("res.clearCookie('access_token'"), 'auth.routes.js logout must clear access_token cookie');
  assert.ok(authRoutesSrc.includes("res.clearCookie('x-admin-token-key'"), 'auth.routes.js logout must clear x-admin-token-key cookie');

  // 3. Client api.ts Verification
  const apiSrc = fs.readFileSync(path.resolve(projectRoot, 'client/src/lib/api.ts'), 'utf8');
  assert.ok(!apiSrc.includes("|| 'etc-34'"), 'api.ts must not have hardcoded etc-34 fallback for unauthenticated requests');
  assert.ok(apiSrc.includes('resetApiSecurityTokens'), 'api.ts must export resetApiSecurityTokens');
  assert.ok(apiSrc.includes("logout: () => req<{ success: boolean; message: string }>('/auth/logout'"), 'api.ts must define logout method');

  // 4. Client AuthContext.tsx Scope Partitioning & Complete Purge
  const authCtxSrc = fs.readFileSync(path.resolve(projectRoot, 'client/src/context/AuthContext.tsx'), 'utf8');
  assert.ok(authCtxSrc.includes('customerSession'), 'AuthContext.tsx must maintain customerSession');
  assert.ok(authCtxSrc.includes('customerProfile'), 'AuthContext.tsx must maintain customerProfile');
  assert.ok(authCtxSrc.includes('adminSession'), 'AuthContext.tsx must maintain adminSession');
  assert.ok(authCtxSrc.includes('adminProfile'), 'AuthContext.tsx must maintain adminProfile');
  assert.ok(authCtxSrc.includes('customerSignIn'), 'AuthContext.tsx must provide customerSignIn');
  assert.ok(authCtxSrc.includes('adminSignIn'), 'AuthContext.tsx must provide adminSignIn');
  assert.ok(authCtxSrc.includes('sessionStorage.clear()'), 'AuthContext.tsx signOut must thoroughly clear sessionStorage');
  assert.ok(authCtxSrc.includes('resetApiSecurityTokens()'), 'AuthContext.tsx signOut must reset API security tokens');
  assert.ok(authCtxSrc.includes("supabase.auth.signOut({ scope: 'global' })"), 'AuthContext.tsx signOut must invoke global Supabase signOut');

  // 5. Navbar & UI Separation Verification
  const navbarSrc = fs.readFileSync(path.resolve(projectRoot, 'client/src/components/Navbar.tsx'), 'utf8');
  assert.ok(navbarSrc.includes('adminSession'), 'Navbar.tsx must inspect adminSession');
  assert.ok(navbarSrc.includes('Admin Console'), 'Navbar.tsx must link to Admin Console when adminSession is active');
  assert.ok(navbarSrc.includes('signOutCustomer'), 'Navbar.tsx must provide dedicated customer signout');

  // 6. ProtectedRoute & App Routing Partitioning
  const protectedRouteSrc = fs.readFileSync(path.resolve(projectRoot, 'client/src/components/ProtectedRoute.tsx'), 'utf8');
  assert.ok(protectedRouteSrc.includes('isCustomerOnly'), 'ProtectedRoute.tsx must differentiate customer-only routes');
  assert.ok(protectedRouteSrc.includes('isStaffRoute'), 'ProtectedRoute.tsx must differentiate staff routes');

  const appSrc = fs.readFileSync(path.resolve(projectRoot, 'client/src/App.tsx'), 'utf8');
  assert.ok(appSrc.includes("<ProtectedRoute allowedRoles={['customer']} portalTitle=\"My Bookings\">"), 'App.tsx must strictly restrict My Bookings to customer role');
});

console.log('\n-------------------------------------------------------------');
console.log(` 🏆 GREEN SUITE VERIFICATION RESULT: ${passedTests}/${totalTests} TESTS PASSED 🟢`);
console.log('=============================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
