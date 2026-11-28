import crypto from 'crypto';
import { z } from 'zod';

// Pure checks for the payment API. Nothing here touches the database, so all of it is covered by
// server/test/payment-security.test.js.

export const WEBHOOK_TOLERANCE_SEC = 300;
export const MAX_PAYMENT_METHODS = 5;

export function signWebhookPayload(rawBody, secret, timestampSec) {
  const mac = crypto.createHmac('sha256', secret).update(`${timestampSec}.${rawBody}`).digest('hex');
  return `t=${timestampSec},v1=${mac}`;
}

function parseSignatureHeader(header) {
  const parts = String(header).split(',').map((p) => p.trim());
  let timestamp = null;
  const signatures = [];
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === 't' && /^\d{1,12}$/.test(value)) timestamp = Number(value);
    if (key === 'v1' && /^[0-9a-f]{64}$/i.test(value)) signatures.push(value.toLowerCase());
  }
  return { timestamp, signatures };
}

// Header format: "t=<unix seconds>,v1=<hex HMAC-SHA256 of `${t}.${rawBody}`>". Several v1 values are
// accepted so the secret can be rotated without downtime.
export function verifyWebhookSignature({
  rawBody,
  header,
  secret,
  nowSec = Math.floor(Date.now() / 1000),
  toleranceSec = WEBHOOK_TOLERANCE_SEC,
}) {
  if (!secret) return { ok: false, reason: 'not_configured' };
  if (!header || typeof rawBody !== 'string') return { ok: false, reason: 'missing_signature' };

  const { timestamp, signatures } = parseSignatureHeader(header);
  if (timestamp === null || signatures.length === 0) return { ok: false, reason: 'malformed_signature' };
  if (Math.abs(nowSec - timestamp) > toleranceSec) return { ok: false, reason: 'stale_timestamp' };

  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();
  const match = signatures.some((sig) => {
    const given = Buffer.from(sig, 'hex');
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
  return match ? { ok: true, timestamp } : { ok: false, reason: 'bad_signature' };
}

export function passesLuhn(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

// True when the text holds something shaped like a payment card number (13 to 19 digits that pass Luhn).
export function containsCardNumber(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  const runs = text.match(/\d(?:[ -]?\d){12,18}/g) || [];
  return runs.some((run) => {
    const digits = run.replace(/\D/g, '');
    return digits.length >= 13 && digits.length <= 19 && passesLuhn(digits);
  });
}

export function maskMobile(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length < 8) return '••••';
  return `${digits.slice(0, 4)} ••• ${digits.slice(-4)}`;
}

const holderName = z
  .string()
  .trim()
  .min(2, 'Enter the account holder name.')
  .max(80)
  .regex(/^[\p{L} .'-]+$/u, 'The holder name can only have letters, spaces, dots, apostrophes and dashes.');

const walletSchema = z
  .object({
    type: z.enum(['gcash', 'maya']),
    mobile: z.string().regex(/^09\d{9}$/, 'Enter the 11-digit mobile number linked to the wallet (09XXXXXXXXX).'),
    holder_name: holderName,
    make_default: z.boolean().optional(),
  })
  .strict();

const cardSchema = z
  .object({
    type: z.literal('card'),
    provider_token: z.string().regex(/^[A-Za-z0-9_-]{8,200}$/, 'A card must come from the payment provider form.'),
    brand: z.enum(['visa', 'mastercard', 'jcb', 'amex']),
    last4: z.string().regex(/^\d{4}$/),
    exp_month: z.number().int().min(1).max(12),
    exp_year: z.number().int().min(2024).max(2100),
    holder_name: holderName,
    make_default: z.boolean().optional(),
  })
  .strict();

export const paymentMethodInputSchema = z.discriminatedUnion('type', [walletSchema, cardSchema]);

// Returns { ok, value } or { ok: false, status, message }. Raw card numbers are refused before any
// other check, so they are never echoed back in a validation error.
export function validatePaymentMethodInput(body, nowMs = Date.now()) {
  if (containsCardNumber(body)) {
    return { ok: false, status: 422, message: 'Card numbers are never accepted here. Add a card through the payment provider form.' };
  }
  const parsed = paymentMethodInputSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const unknownKey = first?.code === 'unrecognized_keys';
    return {
      ok: false,
      status: 422,
      message: unknownKey ? 'This request has fields that are not allowed.' : first?.message || 'Check the payment method details.',
    };
  }
  const value = parsed.data;
  if (value.type === 'card') {
    const now = new Date(nowMs);
    const expiredYear = value.exp_year < now.getUTCFullYear();
    const expiredMonth = value.exp_year === now.getUTCFullYear() && value.exp_month < now.getUTCMonth() + 1;
    if (expiredYear || expiredMonth) return { ok: false, status: 422, message: 'This card has expired.' };
  }
  return { ok: true, value };
}

export function paymentMethodLabel(value) {
  if (value.type === 'gcash') return `GCash ${maskMobile(value.mobile)}`;
  if (value.type === 'maya') return `Maya ${maskMobile(value.mobile)}`;
  const brand = value.brand === 'amex' ? 'Amex' : value.brand.charAt(0).toUpperCase() + value.brand.slice(1);
  return `${brand} •••• ${value.last4}`;
}

export const paymentEventSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_.:-]{6,120}$/),
  type: z.string().regex(/^[a-z_.]{3,60}$/),
  data: z.object({
    reference: z.string().regex(/^DP-[A-Z0-9]{6}$/),
    amount_centavos: z.number().int().positive(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    provider_payment_id: z.string().max(120).optional(),
  }),
});

// Decides whether a provider payment may credit a hold. Amounts are compared in whole centavos.
export function checkPaymentAgainstHold(hold, payment, nowMs = Date.now()) {
  if (!hold) return { ok: false, reason: 'unknown_reference' };
  if (hold.status === 'paid') return { ok: false, reason: 'already_paid' };
  if (hold.status === 'expired' || Date.parse(hold.expires_at) <= nowMs) return { ok: false, reason: 'window_closed' };
  if (payment.currency !== 'PHP') return { ok: false, reason: 'wrong_currency' };
  if (!Number.isInteger(payment.amountCentavos) || payment.amountCentavos !== Number(hold.amount_php) * 100) {
    return { ok: false, reason: 'amount_mismatch' };
  }
  return { ok: true };
}
