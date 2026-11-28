import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { signWebhookPayload } from '../src/lib/paymentSecurity.js';

// Sends real HTTP requests to the webhook route. Only the refusal paths are covered here, because
// they all stop before the database is touched.

const SECRET = 'whsec_http_test_only';
let server;
let baseUrl;

before(async () => {
  process.env.PAYMENT_PROVIDER = 'testpay';
  process.env.PAYMENT_WEBHOOK_SECRET = SECRET;
  const { default: router } = await import('../src/routes/paymentWebhooks.routes.js');
  const app = express();
  app.use(express.json({
    limit: '5mb',
    verify: (req, _res, buf) => {
      if (req.originalUrl?.startsWith('/api/webhooks/')) req.rawBody = buf.toString('utf8');
    },
  }));
  app.use('/api', router);
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/webhooks/payments`;
});

after(() => {
  server?.close();
});

function send(body, headers = {}) {
  return fetch(baseUrl, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
}

const event = JSON.stringify({ id: 'evt_http_0001', type: 'payment.paid', data: { reference: 'DP-ABC234', amount_centavos: 100, currency: 'PHP' } });
const now = () => Math.floor(Date.now() / 1000);

describe('POST /api/webhooks/payments', () => {
  test('401 without a signature', async () => {
    const res = await send(event);
    assert.equal(res.status, 401);
  });

  test('401 with a forged signature', async () => {
    const res = await send(event, { 'x-payment-signature': signWebhookPayload(event, 'wrong_secret', now()) });
    assert.equal(res.status, 401);
  });

  test('401 when a valid signature is replayed after 5 minutes', async () => {
    const res = await send(event, { 'x-payment-signature': signWebhookPayload(event, SECRET, now() - 400) });
    assert.equal(res.status, 401);
  });

  test('401 when the amount is changed after signing', async () => {
    const header = signWebhookPayload(event, SECRET, now());
    const res = await send(event.replace('"amount_centavos":100', '"amount_centavos":1'), { 'x-payment-signature': header });
    assert.equal(res.status, 401);
  });

  test('400 when a signed payload is missing required fields', async () => {
    const bad = JSON.stringify({ id: 'evt_http_0002', type: 'payment.paid', data: { reference: 'DP-ABC234' } });
    const res = await send(bad, { 'x-payment-signature': signWebhookPayload(bad, SECRET, now()) });
    assert.equal(res.status, 400);
  });

  test('400 when a signed payload has an injected reference', async () => {
    const bad = JSON.stringify({ id: 'evt_http_0003', type: 'payment.paid', data: { reference: "x' OR 1=1 --", amount_centavos: 100, currency: 'PHP' } });
    const res = await send(bad, { 'x-payment-signature': signWebhookPayload(bad, SECRET, now()) });
    assert.equal(res.status, 400);
  });

  test('400 for a payload over 64 KB', async () => {
    const big = JSON.stringify({ id: 'evt_http_0004', pad: 'x'.repeat(70 * 1024) });
    const res = await send(big, { 'x-payment-signature': signWebhookPayload(big, SECRET, now()) });
    assert.equal(res.status, 400);
  });

  test('503 when no webhook secret is configured', async () => {
    delete process.env.PAYMENT_WEBHOOK_SECRET;
    const res = await send(event, { 'x-payment-signature': signWebhookPayload(event, SECRET, now()) });
    process.env.PAYMENT_WEBHOOK_SECRET = SECRET;
    assert.equal(res.status, 503);
  });

  test('503 while payments are still simulated', async () => {
    process.env.PAYMENT_PROVIDER = 'simulated';
    const res = await send(event, { 'x-payment-signature': signWebhookPayload(event, SECRET, now()) });
    process.env.PAYMENT_PROVIDER = 'testpay';
    assert.equal(res.status, 503);
  });
});
