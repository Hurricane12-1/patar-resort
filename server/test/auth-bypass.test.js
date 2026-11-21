import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isBenchmarkRequest } from '../src/lib/benchmarkMode.js';
import { BYPASS_HEADERS, startServer, request, csrfHeaders } from './helpers/testServer.js';

const requestWith = (headers) => ({ headers });

afterEach(() => {
  delete process.env.BENCHMARK_MODE;
});

test('isBenchmarkRequest needs BENCHMARK_MODE on the server, not just a header', () => {
  process.env.BENCHMARK_MODE = 'false';
  assert.equal(isBenchmarkRequest(requestWith({ 'x-benchmark-bypass': 'jd-benchmark-concurrency-any' })), false);
  assert.equal(isBenchmarkRequest(requestWith({ 'x-benchmark-test': '1' })), false);

  delete process.env.BENCHMARK_MODE;
  assert.equal(isBenchmarkRequest(requestWith({ 'x-benchmark-bypass': 'jd-benchmark-concurrency-any' })), false);

  process.env.BENCHMARK_MODE = 'true';
  assert.equal(isBenchmarkRequest(requestWith({ 'x-benchmark-bypass': 'jd-benchmark-concurrency-any' })), true);
  assert.equal(isBenchmarkRequest(requestWith({ 'x-benchmark-test': '1' })), true);
  assert.equal(isBenchmarkRequest(requestWith({})), false, 'benchmark mode still needs a benchmark header');
  assert.equal(isBenchmarkRequest(requestWith({ 'x-benchmark-bypass': 'something-else' })), false);
});

test('the benchmark header does not grant admin access unless the server is in benchmark mode', async (t) => {
  const server = await startServer({ benchmark: false });
  t.after(() => server.stop());
  const csrf = await csrfHeaders(server);

  await t.test('requests with no credentials are refused', async () => {
    const res = await request(server, { urlPath: '/api/ledger/backup/export?format=json' });
    assert.equal(res.status, 401);
  });

  await t.test('the x-benchmark-bypass header alone is refused on admin routes', async () => {
    const reads = ['/api/ledger/backup/export?format=json', '/api/ledger/entries', '/api/me', '/api/analytics/overview'];
    for (const urlPath of reads) {
      const res = await request(server, { urlPath, headers: BYPASS_HEADERS });
      assert.equal(res.status, 401, urlPath);
    }
    const writes = [
      ['/api/ledger/backup/import', { content: '[]', mode: 'append', dry_run: true }],
      ['/api/ledger/clear', {}],
    ];
    for (const [urlPath, body] of writes) {
      const res = await request(server, { method: 'POST', urlPath, headers: { ...BYPASS_HEADERS, ...csrf }, body });
      assert.equal(res.status, 401, urlPath);
    }
  });

  await t.test('the x-benchmark-test header alone is refused too', async () => {
    const res = await request(server, { urlPath: '/api/ledger/backup/export?format=json', headers: { 'x-benchmark-test': '1' } });
    assert.equal(res.status, 401);
  });
});

test('benchmark mode still lets the benchmark scripts through', async (t) => {
  const server = await startServer({ benchmark: true });
  t.after(() => server.stop());

  const withHeader = await request(server, { urlPath: '/api/ledger/backup/export?format=json', headers: BYPASS_HEADERS });
  assert.equal(withHeader.status, 200);

  const withoutHeader = await request(server, { urlPath: '/api/ledger/backup/export?format=json' });
  assert.equal(withoutHeader.status, 401, 'benchmark mode does not open the API to requests without the header');
});
