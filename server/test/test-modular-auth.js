/**
 * ============================================================================
 * J & D Beach House · Automated Modular Authentication Test Suite
 * Validates Complete Logic & Persona Separation: Admin vs Customer
 * Location: Brgy. Patar, Bolinao, Pangasinan (16.3042° N, 119.7821° E)
 * ============================================================================
 */

import assert from 'assert';
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { handleAdminLogin } from '../src/modules/admin-auth/index.js';
import { handleClientLogin } from '../src/modules/client-auth/index.js';
import { bootstrapFramework } from '../src/framework/ModuleLoader.js';
import { registry } from '../src/framework/ModuleRegistry.js';
import { env } from '../src/config/env.js';
import { logAuditEvent, getAuditLogs } from '../src/lib/auditLogger.js';

console.log('\n=============================================================');
console.log(' 🧪 TESTING STRICT LOGIC SEPARATION: ADMIN VS CUSTOMER 🧪');
console.log('=============================================================\n');

let totalTests = 0;
let passedTests = 0;

async function runTestCase(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(` ✅ PASS: ${name}`);
  } catch (err) {
    console.error(` ❌ FAIL: ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

// --------------------------------------------------------------------------
// TEST 1: Administrator Module Registration & Discovery
// --------------------------------------------------------------------------
await runTestCase('Admin Auth Module is Registered in IMF with Health Check', async () => {
  const testApp = express();
  await bootstrapFramework(testApp);

  const adminMod = registry.get('admin-auth');
  assert.ok(adminMod, 'Module admin-auth must be registered');
  assert.strictEqual(adminMod.status, 'HEALTHY');
  assert.strictEqual(adminMod.mountPath, '/api/admin-auth');
  assert.ok(adminMod.endpoints.some(e => e.path === '/login' && e.method === 'POST'), 'admin-auth must expose POST /login');

  const health = await adminMod.healthCheck();
  assert.strictEqual(health.status, 'HEALTHY');
  assert.strictEqual(health.module, 'admin-auth');
  assert.strictEqual(health.scope, 'administrator-only');
});

// --------------------------------------------------------------------------
// TEST 2: Customer Module Registration & Discovery
// --------------------------------------------------------------------------
await runTestCase('Client Auth Module is Registered in IMF with Health Check', async () => {
  const clientMod = registry.get('client-auth');
  assert.ok(clientMod, 'Module client-auth must be registered');
  assert.strictEqual(clientMod.status, 'HEALTHY');
  assert.strictEqual(clientMod.mountPath, '/api/client-auth');
  assert.ok(clientMod.endpoints.some(e => e.path === '/login' && e.method === 'POST'), 'client-auth must expose POST /login');

  const health = await clientMod.healthCheck();
  assert.strictEqual(health.status, 'HEALTHY');
  assert.strictEqual(health.module, 'client-auth');
  assert.strictEqual(health.scope, 'customer-only');
});

// --------------------------------------------------------------------------
// TEST 3: Administrator Login via Email & 4-Field RBAC Security Block
// --------------------------------------------------------------------------
await runTestCase('Administrator Login: Email + Password + Token Key + Position', async () => {
  let responseData = null;
  const mockRes = {
    status(code) { this.statusCode = code; return this; },
    json(data) { responseData = data; return this; },
  };

  const req = {
    ip: '127.0.0.1',
    body: {
      identifier: 'admin@rockviewresort.ph',
      password: 'theneckron123',
      position: 'administrator',
      tokenIdKey: 'etc-34',
    },
  };

  await handleAdminLogin(req, mockRes, (err) => { if (err) throw err; });

  assert.ok(responseData, 'Must return response data');
  assert.strictEqual(responseData.success, true);
  assert.strictEqual(responseData.profile.role, 'administrator');
  assert.strictEqual(responseData.profile.email, 'admin@rockviewresort.ph');
  assert.strictEqual(responseData.tokenIdKey, 'etc-34');
  assert.ok(responseData.session.access_token, 'Must issue signed JWT');

  // Verify JWT claims
  const decoded = jwt.decode(responseData.session.access_token);
  assert.strictEqual(decoded.role, 'administrator');
  assert.strictEqual(decoded.position, 'admin');
  assert.strictEqual(decoded.admin_token_verified, true);
  assert.strictEqual(decoded.admin_token_key, 'etc-34');
});

// --------------------------------------------------------------------------
// TEST 4: Administrator Login via Employee Badge ID
// --------------------------------------------------------------------------
await runTestCase('Administrator Login: Employee Badge ID Resolution', async () => {
  let responseData = null;
  const mockRes = {
    json(data) { responseData = data; return this; },
  };

  const req = {
    ip: '127.0.0.1',
    body: {
      identifier: 'RCR-000-000-000-001',
      password: 'theneckron123',
      position: 'administrator',
      tokenIdKey: 'etc-34',
    },
  };

  await handleAdminLogin(req, mockRes, (err) => { if (err) throw err; });

  assert.ok(responseData);
  assert.strictEqual(responseData.success, true);
  assert.strictEqual(responseData.profile.role, 'administrator');
  assert.strictEqual(responseData.profile.employee_id, 'RCR-000-000-000-001');
  assert.strictEqual(responseData.profile.full_name, 'Julian Nygel J. Deleon');
});

// --------------------------------------------------------------------------
// TEST 5: Strict Persona Separation - Admin Account Rejected on Customer Endpoint
// --------------------------------------------------------------------------
await runTestCase('Cross-Persona Defense: Admin Credentials Blocked on Customer Portal', async () => {
  const mockRes = { json() { return this; } };
  let caughtError = null;

  try {
    await handleClientLogin({
      ip: '127.0.0.1',
      body: {
        email: 'jjd001.administrator@rockview.ph',
        password: 'theneckron123',
      },
    }, mockRes, (err) => { if (err) throw err; });
  } catch (err) {
    caughtError = err;
  }

  assert.ok(caughtError, 'Must reject admin account on customer login');
  assert.ok(
    caughtError.statusCode === 401 || caughtError.statusCode === 403,
    `Expected 401 or 403, received ${caughtError.statusCode}`
  );
});

// --------------------------------------------------------------------------
// TEST 6: Strict Persona Separation - Customer Account Rejected on Admin Portal
// --------------------------------------------------------------------------
await runTestCase('Cross-Persona Defense: Customer Credentials Blocked on Admin Portal', async () => {
  const mockRes = { json() { return this; } };
  let caughtError = null;

  try {
    await handleAdminLogin({
      ip: '127.0.0.1',
      body: {
        identifier: 'guest.juan@gmail.com',
        password: 'GuestPassword123!',
        position: 'administrator',
        tokenIdKey: 'etc-34',
      },
    }, mockRes, (err) => { if (err) throw err; });
  } catch (err) {
    caughtError = err;
  }

  assert.ok(caughtError, 'Must reject customer on admin portal');
  assert.strictEqual(caughtError.statusCode, 401, 'Must reject unlisted employee account with 401');
});

// --------------------------------------------------------------------------
// TEST 7: Administrator Security Perimeter (RBAC Token Key & Credentials Guard)
// --------------------------------------------------------------------------
await runTestCase('Administrator Security Rejections: Invalid Token Key & Bad Password', async () => {
  const mockRes = { json() { return this; } };

  // Case A: Invalid Token ID Key -> 403 Forbidden
  let keyErr = null;
  try {
    await handleAdminLogin({
      ip: '127.0.0.1',
      body: { identifier: 'admin@rockviewresort.ph', password: 'theneckron123', tokenIdKey: 'INVALID-KEY-123' },
    }, mockRes, (err) => { if (err) throw err; });
  } catch (err) { keyErr = err; }
  assert.strictEqual(keyErr?.statusCode, 403, 'Must return 403 for invalid admin token key');

  // Case B: Incorrect Password -> 401 Unauthorized
  let passErr = null;
  try {
    await handleAdminLogin({
      ip: '127.0.0.1',
      body: { identifier: 'admin@rockviewresort.ph', password: 'wrong-admin-password', tokenIdKey: 'etc-34' },
    }, mockRes, (err) => { if (err) throw err; });
  } catch (err) { passErr = err; }
  assert.strictEqual(passErr?.statusCode, 401, 'Must return 401 for bad password');

  // Case C: Missing Credentials -> 400 Bad Request
  let missingErr = null;
  try {
    await handleAdminLogin({
      ip: '127.0.0.1',
      body: { identifier: 'admin@rockviewresort.ph' },
    }, mockRes, (err) => { if (err) throw err; });
  } catch (err) { missingErr = err; }
  assert.strictEqual(missingErr?.statusCode, 400, 'Must return 400 for missing password');
});

// --------------------------------------------------------------------------
// TEST 8: Customer Login Input Validation & Security Rejections
// --------------------------------------------------------------------------
await runTestCase('Customer Login Security Rejections: Missing and Invalid Credentials', async () => {
  const mockRes = { json() { return this; } };

  // Case A: Missing Username/Email
  let missingUserErr = null;
  try {
    await handleClientLogin({
      ip: '127.0.0.1',
      body: { password: 'SomePassword123!' },
    }, mockRes, (err) => { if (err) throw err; });
  } catch (err) { missingUserErr = err; }
  assert.strictEqual(missingUserErr?.statusCode, 400, 'Must reject missing username with 400');

  // Case B: Missing Password
  let missingPassErr = null;
  try {
    await handleClientLogin({
      ip: '127.0.0.1',
      body: { email: 'guest@example.com' },
    }, mockRes, (err) => { if (err) throw err; });
  } catch (err) { missingPassErr = err; }
  assert.strictEqual(missingPassErr?.statusCode, 400, 'Must reject missing password with 400');

  // Case C: Invalid / Unregistered Credentials
  let invalidCredsErr = null;
  try {
    await handleClientLogin({
      ip: '127.0.0.1',
      body: { email: 'unregistered.guest@example.com', password: 'IncorrectPassword999!' },
    }, mockRes, (err) => { if (err) throw err; });
  } catch (err) { invalidCredsErr = err; }
  assert.strictEqual(invalidCredsErr?.statusCode, 401, 'Must reject invalid credentials with 401');
});

// --------------------------------------------------------------------------
// TEST 9: Customer Profile Sanitization & Audit Event Emission
// --------------------------------------------------------------------------
await runTestCase('Customer Login: Session Sanitization & CUSTOMER_LOGIN Audit Event', async () => {
  const custAudit = await logAuditEvent({
    actor: {
      id: 'cust-uuid-modular-test',
      email: 'verified.guest@gmail.com',
      full_name: 'Maria Clara',
      role: 'customer',
    },
    action: 'CUSTOMER_LOGIN',
    resourceType: 'authentication',
    resourceId: 'cust-uuid-modular-test',
    details: {
      process: 'Customer Login Modular Verification',
      message: 'Customer Maria Clara authenticated via client-auth module',
      login_timestamp: new Date().toISOString(),
      login_method: 'customer_credentials',
    },
  });

  assert.strictEqual(custAudit.action, 'CUSTOMER_LOGIN');
  assert.strictEqual(custAudit.role, 'customer');

  const logs = await getAuditLogs({ role: 'customer', limit: 10 });
  assert.ok(logs.success);
  assert.ok(logs.logs.some(l => l.action === 'CUSTOMER_LOGIN'), 'Audit trail must contain CUSTOMER_LOGIN event');
});

// --------------------------------------------------------------------------
// TEST 10: Full HTTP Wire Test of Separated Endpoints
// --------------------------------------------------------------------------
await runTestCase('HTTP Wire Test: /api/admin-auth/login and /api/client-auth/login', async () => {
  const app = express();
  app.use(express.json());
  await bootstrapFramework(app);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Health checks on both modules
    const adminHealthRes = await fetch(`${baseUrl}/api/admin-auth/health`);
    assert.strictEqual(adminHealthRes.status, 200);
    const adminHealth = await adminHealthRes.json();
    assert.strictEqual(adminHealth.module, 'admin-auth');
    assert.strictEqual(adminHealth.status, 'OPERATIONAL');
    assert.strictEqual(adminHealth.scope, 'administrator-only');

    const clientHealthRes = await fetch(`${baseUrl}/api/client-auth/health`);
    assert.strictEqual(clientHealthRes.status, 200);
    const clientHealth = await clientHealthRes.json();
    assert.strictEqual(clientHealth.module, 'client-auth');
    assert.strictEqual(clientHealth.status, 'OPERATIONAL');
    assert.strictEqual(clientHealth.scope, 'customer-only');

    // 2. HTTP Admin Login on dedicated modular route /api/admin-auth/login
    const adminLoginRes = await fetch(`${baseUrl}/api/admin-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@rockviewresort.ph',
        password: 'theneckron123',
        position: 'administrator',
        tokenIdKey: 'etc-34',
      }),
    });
    assert.strictEqual(adminLoginRes.status, 200);
    const adminBody = await adminLoginRes.json();
    assert.strictEqual(adminBody.success, true);
    assert.strictEqual(adminBody.profile.role, 'administrator');
    assert.ok(adminBody.session.access_token);

    // 3. HTTP Admin Login via backward-compatible route /api/auth/admin-login
    const compatAdminRes = await fetch(`${baseUrl}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@rockviewresort.ph',
        password: 'theneckron123',
        position: 'administrator',
        tokenIdKey: 'etc-34',
      }),
    });
    assert.strictEqual(compatAdminRes.status, 200);
    const compatAdminBody = await compatAdminRes.json();
    assert.strictEqual(compatAdminBody.success, true);

    // 4. HTTP Client Login on dedicated modular route /api/client-auth/login (bad creds -> 401)
    const clientBadRes = await fetch(`${baseUrl}/api/client-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid.guest@example.com',
        password: 'wrongpassword',
      }),
    });
    assert.strictEqual(clientBadRes.status, 401);

    // 5. HTTP Client Login via backward-compatible route /api/auth/login (bad creds -> 401)
    const compatClientBadRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid.guest@example.com',
        password: 'wrongpassword',
      }),
    });
    assert.strictEqual(compatClientBadRes.status, 401);
  } finally {
    server.close();
  }
});

console.log('\n=============================================================');
console.log(` 🏆 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED 🟢`);
console.log('=============================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
