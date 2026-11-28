import { Router } from 'express';
import { z } from 'zod';
import { asyncH } from '../middleware/errors.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createDownpaymentHold, confirmDownpaymentHold } from '../lib/paymentHolds.js';

const r = Router();

const createSchema = z.object({
  reservation_ids: z.array(z.string().uuid('Invalid booking reference.')).min(1, 'Choose at least one booking.').max(10),
});

r.post('/payment-holds', authenticate, validate(createSchema), asyncH(async (req, res) => {
  const hold = await createDownpaymentHold({
    user: req.user,
    reservationIds: req.body.reservation_ids,
    req,
  });
  return res.status(201).json(hold);
}));

r.post('/payment-holds/:id/confirm', authenticate, asyncH(async (req, res) => {
  const result = await confirmDownpaymentHold({
    user: req.user,
    holdId: req.params.id,
    req,
  });
  return res.json(result);
}));

export default r;
