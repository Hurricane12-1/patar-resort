import { Router } from 'express';
import twilioPkg from 'twilio';
import { asyncH, ApiError } from '../middleware/errors.js';
import { env, smsEnabled } from '../config/env.js';
import { admin } from '../lib/supabase.js';

const r = Router();
const validateSig = twilioPkg.validateExpressRequest;

r.post('/webhooks/sms/status', asyncH(async (req, res) => {
  if (smsEnabled && typeof validateSig === 'function'
      && !validateSig(req, env.TWILIO_AUTH_TOKEN)) {
    throw new ApiError(403, 'Invalid webhook signature');
  }
  const { MessageSid, MessageStatus } = req.body;
  const map = { delivered: 'sent', sent: 'sent', failed: 'failed', undelivered: 'failed' };
  if (MessageSid && map[MessageStatus]) {
    await admin.from('notifications')
      .update({ status: map[MessageStatus] })
      .eq('payload->>provider_sid', MessageSid);
  }
  res.sendStatus(204);
}));

export default r;
