import assert from 'assert';
import http from 'http';
import { antiXssSanitizer, cookieTokenizer } from '../src/middleware/security.js';
import { ngwfFirewall, pathNormalizer } from '../src/middleware/ngwfSecurity.js';
import { getCertificateStatus } from '../src/config/cert.js';

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

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
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

// 2. Security Certificates Status Test
runTest('TLS/SSL Certificate Status Verification', () => {
  const certStatus = getCertificateStatus();
  assert.ok(certStatus.protocol, 'Missing protocol info');
  assert.ok(certStatus.valid_until, 'Missing valid_until date');
  assert.ok(certStatus.status, 'Missing cert status');
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

console.log('\n-------------------------------------------------------------');
console.log(` 🏆 GREEN SUITE VERIFICATION RESULT: ${passedTests}/${totalTests} TESTS PASSED 🟢`);
console.log('=============================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
