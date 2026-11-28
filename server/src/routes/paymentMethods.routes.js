import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate } from '../middleware/auth.js';
import { logAuditEvent } from '../lib/auditLogger.js';
import { validatePaymentMethodInput } from '../lib/paymentSecurity.js';
import {
  listPaymentMethods,
  registerPaymentMethod,
  setDefaultPaymentMethod,
  revokePaymentMethod,
} from '../lib/paymentMethods.js';

const r = Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const methodWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => `pm:${req.user?.id || 'anon'}`,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many payment method changes. Try again in 15 minutes.' },
});

function requireCustomer(req, _res, next) {
  const role = String(req.user?.role || '').toLowerCase();
  if (role !== 'customer' && role !== 'client') return next(new ApiError(403, 'Only guest accounts can save payment methods.'));
  return next();
}

function methodIdFrom(req) {
  if (!UUID_PATTERN.test(String(req.params.id))) throw new ApiError(404, 'Payment method not found.');
  return req.params.id;
}

r.get('/payment-methods', authenticate, requireCustomer, asyncH(async (req, res) => {
  res.json(await listPaymentMethods(req.user.id));
}));

r.post('/payment-methods', authenticate, requireCustomer, methodWriteLimiter, asyncH(async (req, res) => {
  const check = validatePaymentMethodInput(req.body);
  if (!check.ok) {
    if (check.message.startsWith('Card numbers')) {
      await logAuditEvent({
        actor: req.user,
        action: 'PAYMENT_METHOD_RAW_CARD_REFUSED',
        resourceType: 'payment_method',
        details: { note: 'A request contained a card number and was refused. The number was not stored or logged.' },
        req,
      });
    }
    throw new ApiError(check.status, check.message);
  }

  const method = await registerPaymentMethod(req.user.id, check.value);
  await logAuditEvent({
    actor: req.user,
    action: 'PAYMENT_METHOD_ADDED',
    resourceType: 'payment_method',
    resourceId: method.id,
    details: { type: method.type, label: method.label },
    req,
  });
  res.status(201).json(method);
}));

r.patch('/payment-methods/:id/default', authenticate, requireCustomer, methodWriteLimiter, asyncH(async (req, res) => {
  const method = await setDefaultPaymentMethod(req.user.id, methodIdFrom(req));
  res.json(method);
}));

r.delete('/payment-methods/:id', authenticate, requireCustomer, methodWriteLimiter, asyncH(async (req, res) => {
  const id = methodIdFrom(req);
  await revokePaymentMethod(req.user.id, id);
  await logAuditEvent({
    actor: req.user,
    action: 'PAYMENT_METHOD_REMOVED',
    resourceType: 'payment_method',
    resourceId: id,
    req,
  });
  res.json({ success: true });
}));

export default r;
