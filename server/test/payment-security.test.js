import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  signWebhookPayload,
  verifyWebhookSignature,
  containsCardNumber,
  passesLuhn,
  maskMobile,
  validatePaymentMethodInput,
  paymentEventSchema,
  checkPaymentAgainstHold,
} from '../src/lib/paymentSecurity.js';

const SECRET = 'whsec_test_only_value';
const NOW = 1_800_000_000;
const BODY = JSON.stringify({ id: 'evt_000001', type: 'payment.paid', data: { reference: 'DP-ABC234', amount_centavos: 301300, currency: 'PHP' } });

describe('webhook signature', () => {
  test('accepts a correctly signed payload', () => {
    const header = signWebhookPayload(BODY, SECRET, NOW);
    assert.deepEqual(verifyWebhookSignature({ rawBody: BODY, header, secret: SECRET, nowSec: NOW }), { ok: true, timestamp: NOW });
  });

  test('refuses when the body was changed after signing', () => {
    const header = signWebhookPayload(BODY, SECRET, NOW);
    const tampered = BODY.replace('301300', '100');
    assert.equal(verifyWebhookSignature({ rawBody: tampered, header, secret: SECRET, nowSec: NOW }).reason, 'bad_signature');
  });

  test('refuses a signature made with another secret', () => {
    const header = signWebhookPayload(BODY, 'attacker_secret', NOW);
    assert.equal(verifyWebhookSignature({ rawBody: BODY, header, secret: SECRET, nowSec: NOW }).reason, 'bad_signature');
  });

  test('refuses an old signature (replay outside the 5-minute window)', () => {
    const header = signWebhookPayload(BODY, SECRET, NOW - 301);
    assert.equal(verifyWebhookSignature({ rawBody: BODY, header, secret: SECRET, nowSec: NOW }).reason, 'stale_timestamp');
  });

  test('refuses a timestamp far in the future', () => {
    const header = signWebhookPayload(BODY, SECRET, NOW + 301);
    assert.equal(verifyWebhookSignature({ rawBody: BODY, header, secret: SECRET, nowSec: NOW }).reason, 'stale_timestamp');
  });

  test('refuses when the timestamp in the header was swapped', () => {
    const header = signWebhookPayload(BODY, SECRET, NOW - 600).replace(`t=${NOW - 600}`, `t=${NOW}`);
    assert.equal(verifyWebhookSignature({ rawBody: BODY, header, secret: SECRET, nowSec: NOW }).reason, 'bad_signature');
  });

  test('refuses missing, empty and malformed headers', () => {
    assert.equal(verifyWebhookSignature({ rawBody: BODY, header: undefined, secret: SECRET, nowSec: NOW }).reason, 'missing_signature');
    assert.equal(verifyWebhookSignature({ rawBody: BODY, header: 'garbage', secret: SECRET, nowSec: NOW }).reason, 'malformed_signature');
    assert.equal(verifyWebhookSignature({ rawBody: BODY, header: `t=${NOW},v1=zz`, secret: SECRET, nowSec: NOW }).reason, 'malformed_signature');
    assert.equal(verifyWebhookSignature({ rawBody: BODY, header: `t=${NOW},v1=${'0'.repeat(63)}`, secret: SECRET, nowSec: NOW }).reason, 'malformed_signature');
  });

  test('refuses everything when no secret is configured', () => {
    const header = signWebhookPayload(BODY, '', NOW);
    assert.equal(verifyWebhookSignature({ rawBody: BODY, header, secret: undefined, nowSec: NOW }).reason, 'not_configured');
    assert.equal(verifyWebhookSignature({ rawBody: BODY, header, secret: '', nowSec: NOW }).reason, 'not_configured');
  });

  test('accepts either signature during secret rotation', () => {
    const fresh = signWebhookPayload(BODY, SECRET, NOW).split('v1=')[1];
    const header = `t=${NOW},v1=${'a'.repeat(64)},v1=${fresh}`;
    assert.equal(verifyWebhookSignature({ rawBody: BODY, header, secret: SECRET, nowSec: NOW }).ok, true);
  });
});

describe('card number detection', () => {
  test('recognises test card numbers in several formats', () => {
    assert.equal(containsCardNumber('4111111111111111'), true);
    assert.equal(containsCardNumber('4111 1111 1111 1111'), true);
    assert.equal(containsCardNumber('5555-5555-5555-4444'), true);
    assert.equal(containsCardNumber({ holder_name: 'Juan', note: 'my card 378282246310005' }), true);
  });

  test('does not flag mobile numbers or numbers that fail Luhn', () => {
    assert.equal(containsCardNumber('09171234567'), false);
    assert.equal(containsCardNumber('4111111111111112'), false);
    assert.equal(containsCardNumber({ last4: '4242', exp_year: 2030 }), false);
  });

  test('Luhn check', () => {
    assert.equal(passesLuhn('79927398713'), true);
    assert.equal(passesLuhn('79927398710'), false);
    assert.equal(passesLuhn('7992a398713'), false);
  });
});

describe('masking', () => {
  test('shows only the first 4 and last 4 digits of a mobile number', () => {
    assert.equal(maskMobile('09171234567'), '0917 ••• 4567');
    assert.equal(maskMobile('123'), '••••');
  });
});

describe('payment method registration input', () => {
  const NOW_MS = Date.UTC(2026, 10, 29);

  test('accepts a GCash wallet', () => {
    const result = validatePaymentMethodInput({ type: 'gcash', mobile: '09171234567', holder_name: 'Juan Dela Cruz' }, NOW_MS);
    assert.equal(result.ok, true);
  });

  test('refuses a raw card number in any field, without echoing it', () => {
    const result = validatePaymentMethodInput({ type: 'card', number: '4111111111111111', holder_name: 'Juan' }, NOW_MS);
    assert.equal(result.ok, false);
    assert.equal(result.message.includes('4111'), false);
  });

  test('refuses extra fields such as cvv or user_id (mass assignment)', () => {
    const withCvv = validatePaymentMethodInput({ type: 'gcash', mobile: '09171234567', holder_name: 'Juan Cruz', cvv: '123' }, NOW_MS);
    const withUser = validatePaymentMethodInput({ type: 'gcash', mobile: '09171234567', holder_name: 'Juan Cruz', user_id: 'someone-else' }, NOW_MS);
    assert.equal(withCvv.ok, false);
    assert.equal(withUser.ok, false);
  });

  test('refuses HTML or script in the holder name', () => {
    const result = validatePaymentMethodInput({ type: 'maya', mobile: '09171234567', holder_name: '<script>alert(1)</script>' }, NOW_MS);
    assert.equal(result.ok, false);
  });

  test('refuses a bad mobile number', () => {
    assert.equal(validatePaymentMethodInput({ type: 'gcash', mobile: '9171234567', holder_name: 'Juan Cruz' }, NOW_MS).ok, false);
    assert.equal(validatePaymentMethodInput({ type: 'gcash', mobile: '0917123456a', holder_name: 'Juan Cruz' }, NOW_MS).ok, false);
  });

  test('accepts a tokenised card and refuses an expired one', () => {
    const card = { type: 'card', provider_token: 'pm_ABCDEFGH1234', brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030, holder_name: 'Juan Cruz' };
    assert.equal(validatePaymentMethodInput(card, NOW_MS).ok, true);
    assert.equal(validatePaymentMethodInput({ ...card, exp_month: 10, exp_year: 2026 }, NOW_MS).ok, false);
  });

  test('refuses a card token with unsafe characters', () => {
    const card = { type: 'card', provider_token: "pm_x'; drop table--", brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030, holder_name: 'Juan Cruz' };
    assert.equal(validatePaymentMethodInput(card, NOW_MS).ok, false);
  });
});

describe('provider event payload', () => {
  test('accepts a well-formed event', () => {
    assert.equal(paymentEventSchema.safeParse(JSON.parse(BODY)).success, true);
  });

  test('refuses injection in the reference and non-integer amounts', () => {
    const base = JSON.parse(BODY);
    assert.equal(paymentEventSchema.safeParse({ ...base, data: { ...base.data, reference: "DP-ABC234' OR 1=1" } }).success, false);
    assert.equal(paymentEventSchema.safeParse({ ...base, data: { ...base.data, amount_centavos: 3013.5 } }).success, false);
    assert.equal(paymentEventSchema.safeParse({ ...base, data: { ...base.data, amount_centavos: -1 } }).success, false);
  });
});

describe('payment against hold', () => {
  const NOW_MS = Date.UTC(2026, 10, 29, 2, 0, 0);
  const hold = { status: 'awaiting', amount_php: 3013, expires_at: new Date(NOW_MS + 60_000).toISOString() };
  const exact = { amountCentavos: 301300, currency: 'PHP' };

  test('credits only the exact amount in pesos', () => {
    assert.deepEqual(checkPaymentAgainstHold(hold, exact, NOW_MS), { ok: true });
    assert.equal(checkPaymentAgainstHold(hold, { ...exact, amountCentavos: 301299 }, NOW_MS).reason, 'amount_mismatch');
    assert.equal(checkPaymentAgainstHold(hold, { ...exact, amountCentavos: 999999 }, NOW_MS).reason, 'amount_mismatch');
  });

  test('refuses other currencies', () => {
    assert.equal(checkPaymentAgainstHold(hold, { ...exact, currency: 'USD' }, NOW_MS).reason, 'wrong_currency');
  });

  test('refuses unknown, already paid and closed holds', () => {
    assert.equal(checkPaymentAgainstHold(null, exact, NOW_MS).reason, 'unknown_reference');
    assert.equal(checkPaymentAgainstHold({ ...hold, status: 'paid' }, exact, NOW_MS).reason, 'already_paid');
    assert.equal(checkPaymentAgainstHold({ ...hold, status: 'expired' }, exact, NOW_MS).reason, 'window_closed');
    assert.equal(checkPaymentAgainstHold({ ...hold, expires_at: new Date(NOW_MS - 1).toISOString() }, exact, NOW_MS).reason, 'window_closed');
  });
});
