import { Router } from 'express';
import { asyncH } from '../middleware/errors.js';
import { verifyWebhookSignature, paymentEventSchema } from '../lib/paymentSecurity.js';
import { applyProviderPaymentEvent, simulatedPaymentsEnabled } from '../lib/paymentHolds.js';

const r = Router();
const MAX_WEBHOOK_BYTES = 64 * 1024;

// The path contains "/webhooks" so the CSRF gate skips it; the HMAC signature is the protection here.
r.post('/webhooks/payments', asyncH(async (req, res) => {
  if (simulatedPaymentsEnabled()) {
    return res.status(503).json({ message: 'Payment provider is not connected.' });
  }

  const rawBody = typeof req.rawBody === 'string' ? req.rawBody : '';
  if (!rawBody || Buffer.byteLength(rawBody) > MAX_WEBHOOK_BYTES) {
    return res.status(400).json({ message: 'Invalid payload.' });
  }

  const check = verifyWebhookSignature({
    rawBody,
    header: req.get('x-payment-signature'),
    secret: process.env.PAYMENT_WEBHOOK_SECRET,
  });
  if (!check.ok) {
    console.warn(`[Payments] Webhook refused: ${check.reason}`);
    return res.status(check.reason === 'not_configured' ? 503 : 401).json({ message: 'Invalid signature.' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ message: 'Invalid payload.' });
  }
  const parsed = paymentEventSchema.safeParse(payload);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload.' });

  const provider = (process.env.PAYMENT_PROVIDER || 'provider').trim().toLowerCase();
  const outcome = await applyProviderPaymentEvent(parsed.data, provider);
  return res.json({ received: true, outcome });
}));

export default r;
