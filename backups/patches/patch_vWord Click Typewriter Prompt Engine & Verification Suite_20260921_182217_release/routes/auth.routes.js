import { Router } from 'express';
import crypto from 'crypto';
import { asyncH, ApiError } from '../middleware/errors.js';
import { validateJoi, joiSchemas } from '../middleware/joiValidation.js';
import { admin } from '../lib/supabase.js';
import { redis } from '../lib/redis.js';
import { pingSMS } from '../lib/sms.js';

const r = Router();

/**
 * Step 1: Initiate Account Recovery
 * Generates a 6-digit OTP code, stores it in Redis/in-memory cache (15 min TTL),
 * and dispatches SMS ping to the registered phone number.
 */
r.post('/auth/forgot-password',
  validateJoi(joiSchemas.forgotPassword),
  asyncH(async (req, res) => {
    const email = req.body.email.trim().toLowerCase();

    // Look up user in Supabase auth users
    let targetUser = null;
    let targetProfile = null;

    try {
      const { data: usersData, error: usersErr } = await admin.auth.admin.listUsers();
      if (!usersErr && usersData?.users) {
        targetUser = usersData.users.find((u) => u.email?.toLowerCase() === email);
      }
    } catch {}

    // Also look up profile in profiles table
    try {
      if (targetUser) {
        const { data: p } = await admin.from('profiles').select('*').eq('id', targetUser.id).single();
        targetProfile = p;
      }
    } catch {}

    // Generate secure 6-digit verification code
    const code = crypto.randomInt(100000, 999999).toString();
    const cacheKey = `recovery:${email}`;

    // Store in Redis / in-memory cache with 900s (15 min) TTL
    await redis.set(cacheKey, {
      code,
      userId: targetUser?.id || null,
      email,
      createdAt: Date.now(),
    }, 900);

    // Send SMS ping if target has a registered mobile number
    const targetPhone = targetProfile?.phone || targetUser?.user_metadata?.phone;
    if (targetPhone) {
      pingSMS({
        profileId: targetUser?.id || 'guest',
        toPhone: targetPhone,
        body: `J & D Beach House: Your account recovery verification code is ${code}. Valid for 15 minutes. Never share this code.`,
      }).catch(() => {});
    }

    // In local development or standalone mode, return code preview for smooth testing
    const isDev = process.env.NODE_ENV !== 'production';

    return res.json({
      success: true,
      message: targetPhone
        ? `Recovery code dispatched to your registered phone (${targetPhone.slice(0, 4)}***${targetPhone.slice(-2)}).`
        : 'Recovery code generated. If an account is associated with this email, you will receive instructions.',
      expires_in_seconds: 900,
      ...(isDev ? { dev_code_preview: code } : {}),
    });
  }));

/**
 * Step 2: Verify Recovery Code
 */
r.post('/auth/verify-recovery-code',
  validateJoi(joiSchemas.verifyRecovery),
  asyncH(async (req, res) => {
    const { email, code } = req.body;
    const cacheKey = `recovery:${email.trim().toLowerCase()}`;

    const record = await redis.get(cacheKey);
    if (!record || String(record.code) !== String(code).trim()) {
      throw new ApiError(400, 'Invalid or expired recovery code. Please request a new code.');
    }

    return res.json({
      success: true,
      verified: true,
      message: 'Recovery code verified successfully. Please enter your new password.',
    });
  }));

/**
 * Step 3: Reset Password with Verified Code
 */
r.post('/auth/reset-password',
  validateJoi(joiSchemas.resetPassword),
  asyncH(async (req, res) => {
    const { email, code, new_password } = req.body;
    const cleanEmail = email.trim().toLowerCase();
    const cacheKey = `recovery:${cleanEmail}`;

    const record = await redis.get(cacheKey);
    if (!record || String(record.code) !== String(code).trim()) {
      throw new ApiError(400, 'Invalid or expired recovery code. Please request a new code.');
    }

    // Resolve user ID
    let userId = record.userId;
    if (!userId) {
      try {
        const { data: usersData } = await admin.auth.admin.listUsers();
        const found = usersData?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
        if (found) userId = found.id;
      } catch {}
    }

    if (!userId) {
      // If user wasn't registered in Supabase auth, throw clear error
      throw new ApiError(404, 'No account matching this email address was found.');
    }

    // Update password in Supabase Auth
    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
      password: new_password,
    });

    if (updateErr) {
      throw new ApiError(500, `Failed to update password: ${updateErr.message}`);
    }

    // Invalidate the recovery code from Redis
    await redis.del(cacheKey);

    // Send confirmation SMS
    try {
      const { data: prof } = await admin.from('profiles').select('phone, full_name').eq('id', userId).single();
      if (prof?.phone) {
        pingSMS({
          profileId: userId,
          toPhone: prof.phone,
          body: 'J & D Beach House: Your account password has been successfully updated. You may now log in.',
        }).catch(() => {});
      }
    } catch {}

    return res.json({
      success: true,
      message: 'Your password has been successfully reset. You may now log in with your new password.',
    });
  }));

export default r;
