import { Router } from 'express';
import { z } from 'zod';
import { asyncH } from '../middleware/errors.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createDownpaymentHold, getDownpaymentHoldForGuest, getBookingAllowance } from '../lib/paymentHolds.js';

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

r.get('/payment-holds/:id', authenticate, asyncH(async (req, res) => {
  const hold = await getDownpaymentHoldForGuest({
    user: req.user,
    holdId: req.params.id,
  });
  return res.json(hold);
}));

r.get('/booking-allowance', authenticate, asyncH(async (req, res) => {
  const allowance = await getBookingAllowance(req.user);
  return res.json(allowance);
}));

export default r;
