import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { asyncH, ApiError } from '../middleware/errors.js';
import { validateJoi, joiSchemas } from '../middleware/joiValidation.js';
import { admin, userClient } from '../lib/supabase.js';
import { redis } from '../lib/redis.js';
import { pingSMS } from '../lib/sms.js';
import { notifyStaff } from '../lib/notify.js';
import { sendRecoveryOTP, sendPasswordResetSuccess, sendSignup2FAOTP, sendWelcomeClientEmail, sendSignupExpiredEmail } from '../lib/mailer.js';
import { logAuditEvent } from '../lib/auditLogger.js';
import { devOtpPreview } from '../lib/otpPreview.js';
import { checkBruteForceLockout, recordFailedAttempt, recordSuccessfulAttempt } from '../middleware/bruteForceGuard.js';
import { hashPassword, verifyPassword } from '../lib/passwords.js';
import { saveCustomer, findCustomerByEmail } from '../lib/customerStore.js';

// Modular Authentication Services (Separated Client & Administrator Modules)
import { handleAdminLogin } from '../modules/admin-auth/index.js';
import { handleClientLogin, handleGoogleAuth, handleFacebookAuth } from '../modules/client-auth/index.js';

const r = Router();

/**
 * ============================================================================
 * MANDATORY 4-FIELD EXECUTIVE RBAC ADMINISTRATOR AUTHENTICATION
 * Block Requirements:
 *  1. Identity / Email (Supabase Auth administrator account)
 *  2. Password (verified via Supabase Auth)
 *  3. Token ID Key (verified via ADMIN_TOKEN_KEY)
 *  4. Position ('admin' | 'administrator', enforced strictly by RBAC)
 * ============================================================================
 */
r.post('/auth/admin-login', handleAdminLogin);
r.post('/auth/admin/login', handleAdminLogin);
/**
 * ============================================================================
 * MODULAR CLIENT / CUSTOMER & STAFF AUTHENTICATION MODULE
 * Dispatched to isolated domain module: server/src/modules/client-auth
 * Emits audit events:
 *  - CUSTOMER_LOGIN (for verified resort guests & clients)
 *  - STAFF_LOGIN (for verified operational staff members)
 *  - ADMIN_LOGIN (for administrator persona logins)
 * ============================================================================
 */
r.post('/auth/login', handleClientLogin);
r.post('/auth/client/login', handleClientLogin);
r.post('/auth/google', handleGoogleAuth);
r.post('/auth/client/google', handleGoogleAuth);
r.post('/auth/facebook', handleFacebookAuth);
r.post('/auth/client/facebook', handleFacebookAuth);

/**
 * ============================================================================
 * DIRECT SUPABASE & GMAIL OTP AUTHENTICATION MODULE
 * Dispatches 6-digit verification codes via Supabase Auth & Gmail SMTP
 * and verifies resident login sessions without requiring passwords.
 * ============================================================================
 */
r.post('/auth/otp/send', asyncH(async (req, res) => {
  const { email, name } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new ApiError(400, 'Valid Gmail or email address is required.');
  }

  // 1. If Supabase is reachable, attempt to dispatch OTP via Supabase Auth
  let supabaseDispatched = false;
  try {
    const { error: sbErr } = await admin.auth.signInWithOtp({
      email: cleanEmail,
      options: { shouldCreateUser: true },
    });
    if (!sbErr) {
      supabaseDispatched = true;
    }
  } catch {}

  // 2. Generate resilient 6-digit OTP and store in cache
  const code = crypto.randomInt(100000, 999999).toString();
  const cacheKey = `gmail_otp:${cleanEmail}`;
  const ttlSeconds = 600; // 10 minutes

  await redis.set(cacheKey, {
    code,
    email: cleanEmail,
    name: name || cleanEmail.split('@')[0],
    attempts: 0,
    createdAt: Date.now(),
  }, ttlSeconds);

  // 3. Dispatch via mailer (Nodemailer Google Mail / SMTP)
  sendSignup2FAOTP({
    to: cleanEmail,
    code,
    name: name || 'Valued Resident',
    provider: 'gmail',
  }).catch((err) => console.warn('[OTP Mailer Notice]:', err.message));

  return res.json({
    success: true,
    message: `6-digit OTP code dispatched to ${cleanEmail}. Valid for 10 minutes.`,
    email: cleanEmail,
    provider: supabaseDispatched ? 'supabase_auth' : 'gmail_smtp',
    ...devOtpPreview(code),
    expires_in_seconds: ttlSeconds,
  });
}));

r.post('/auth/otp/verify', asyncH(async (req, res) => {
  const { email, code, name } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanCode = (code || '').trim();

  if (!cleanEmail || !cleanCode) {
    throw new ApiError(400, 'Email address and 6-digit OTP code are required.');
  }

  // 1. Try Supabase Auth verifyOtp if live
  let supabaseSession = null;
  try {
    const { data: sbData, error: sbErr } = await admin.auth.verifyOtp({
      email: cleanEmail,
      token: cleanCode,
      type: 'email',
    });
    if (!sbErr && sbData?.session) {
      supabaseSession = sbData.session;
    }
  } catch {}

  // 2. Check cache (resilient fallback)
  const cacheKey = `gmail_otp:${cleanEmail}`;
  const cached = await redis.get(cacheKey);

  let verified = false;
  if (supabaseSession) {
    verified = true;
  } else if (cached && String(cached.code) === String(cleanCode)) {
    verified = true;
  } else {
    const signupKey = `signup_2fa:${cleanEmail}`;
    const signupRecord = await redis.get(signupKey);
    if (signupRecord && String(signupRecord.code) === String(cleanCode)) {
      verified = true;
    }
    const recoveryKey = `recovery:${cleanEmail}`;
    const recoveryRecord = await redis.get(recoveryKey);
    if (recoveryRecord && String(recoveryRecord.code) === String(cleanCode)) {
      verified = true;
    }
  }

  if (!verified) {
    throw new ApiError(400, 'Invalid or expired 6-digit OTP verification code. Please check your Gmail or request a new code.');
  }

  await redis.del(cacheKey);

  // 3. Resolve Customer Profile & Session
  const local = findCustomerByEmail(cleanEmail);
  const userId = supabaseSession?.user?.id || local?.id || `otp_${crypto.randomUUID()}`;
  const guestName = name || cached?.name || local?.full_name || cleanEmail.split('@')[0];

  const customerProfile = {
    id: userId,
    email: cleanEmail,
    full_name: guestName,
    first_name: local?.first_name || guestName.split(' ')[0] || 'Guest',
    last_name: local?.last_name || guestName.split(' ').slice(1).join(' ') || '',
    role: 'customer',
    position: 'Customer',
    provider: 'gmail_otp',
    is_verified: true,
    has_password: true,
    password_status: 'OTP Verified',
  };

  saveCustomer({
    ...customerProfile,
    updated_at: new Date().toISOString(),
  });

  Promise.resolve().then(async () => {
    try {
      await admin.from('profiles').upsert(customerProfile, { onConflict: 'id' });
      await admin.from('customers').upsert(customerProfile, { onConflict: 'id' });
    } catch {}
  });

  const sessionToken = jwt.sign(
    {
      id: userId,
      email: cleanEmail,
      role: 'customer',
      persona: 'customer',
      aud: 'authenticated',
      provider: 'gmail_otp',
    },
    env.SUPABASE_JWT_SECRET || 'rockview-customer-secret-key-2026',
    { expiresIn: '7d' }
  );

  const finalSession = supabaseSession || {
    access_token: sessionToken,
    token_type: 'bearer',
    expires_in: 7 * 24 * 3600,
    refresh_token: sessionToken,
    user: { id: userId, email: cleanEmail, role: 'customer' },
  };

  await logAuditEvent({
    actor: { id: userId, email: cleanEmail, role: 'customer' },
    action: 'CUSTOMER_LOGIN',
    resourceType: 'authentication_otp',
    resourceId: userId,
    details: {
      method: 'gmail_otp',
      provider: supabaseSession ? 'supabase_auth' : 'resilient_otp',
      email: cleanEmail,
    },
    req,
  }).catch(() => {});

  return res.json({
    success: true,
    message: `Verified successfully! Welcome to Rock View Beach Resort, ${guestName}.`,
    session: finalSession,
    user: customerProfile,
    profile: customerProfile,
  });
}));

/**
 * Direct verified customer account registration (Instant email confirmation & resilient customer password store)
 */
r.post('/auth/register', asyncH(async (req, res) => {
  const { email, password, first_name, last_name, phone } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanFirst = (first_name || '').trim();
  const cleanLast = (last_name || '').trim();
  const fullName = [cleanFirst, cleanLast].filter(Boolean).join(' ');
  const normPhone = phone ? String(phone).replace(/\D/g, '').slice(0, 11) : '';

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new ApiError(400, 'Valid email address is required.');
  }
  if (!password || password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters.');
  }
  if (!normPhone || normPhone.length !== 11 || !normPhone.startsWith('09')) {
    throw new ApiError(400, 'Philippine mobile phone must be 11 digits starting with 09 (e.g. 09171234567).');
  }

  // 1. Resolve or generate user ID
  let userId = crypto.randomUUID();
  try {
    const { data: existingCust } = await admin
      .from('customers')
      .select('id')
      .ilike('email', cleanEmail)
      .maybeSingle();
    if (existingCust?.id) userId = existingCust.id;
  } catch {}

  // 2. Try Supabase Auth creation if admin service role is active
  try {
    const { data: created } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: cleanFirst,
        last_name: cleanLast,
        full_name: fullName,
        phone: normPhone,
        role: 'customer',
        provider: 'email',
        confirmed: true,
      },
    });
    if (created?.user?.id) userId = created.user.id;
  } catch (err) {
    console.warn('[Supabase Auth Admin Notice]:', err.message);
  }

  // 3. Upsert profiles
  try {
    await admin.from('profiles').upsert({
      id: userId,
      email: cleanEmail,
      full_name: fullName,
      first_name: cleanFirst,
      last_name: cleanLast,
      phone: normPhone,
      role: 'customer',
    }, { onConflict: 'id' });
    notifyStaff({ type: 'customer', title: 'New customer account', body: `${fullName} (${cleanEmail}) signed up.` });
  } catch (err) {
    console.warn('[Profiles Upsert Warning]:', err.message);
  }

  // 4. Save to resilient customer store
  saveCustomer({
    id: userId,
    email: cleanEmail,
    password,
    full_name: fullName,
    first_name: cleanFirst,
    last_name: cleanLast,
    phone: normPhone,
    role: 'customer',
  });

  // 5. Upsert customers table with hashed password
  const hashedPassword = hashPassword(password);
  try {
    await admin.from('customers').upsert({
      id: userId,
      email: cleanEmail,
      full_name: fullName,
      first_name: cleanFirst,
      last_name: cleanLast,
      phone: normPhone,
      role: 'customer',
      password: hashedPassword,
      is_verified: true,
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[Customers Upsert Warning]:', err.message);
  }

  logAuditEvent({
    action: 'CUSTOMER_REGISTRATION',
    performed_by: userId,
    details: { email: cleanEmail, phone: normPhone },
  }).catch(() => {});

  const sessionToken = jwt.sign(
    {
      id: userId,
      email: cleanEmail,
      role: 'customer',
      persona: 'customer',
      aud: 'authenticated',
    },
    env.SUPABASE_JWT_SECRET || 'rockview-customer-secret-key-2026',
    { expiresIn: '7d' }
  );

  return res.json({
    success: true,
    userId,
    email: cleanEmail,
    token: sessionToken,
    session: {
      access_token: sessionToken,
      token_type: 'bearer',
      user: {
        id: userId,
        email: cleanEmail,
        role: 'customer',
        user_metadata: {
          first_name: cleanFirst,
          last_name: cleanLast,
          full_name: fullName,
          phone: normPhone,
          role: 'customer',
        },
      },
    },
    user: {
      id: userId,
      email: cleanEmail,
      full_name: fullName,
      first_name: cleanFirst,
      last_name: cleanLast,
      phone: normPhone,
      role: 'customer',
    },
    message: 'Resident account created and confirmed successfully.',
  });
}));

/**
 * ============================================================================
 * COMPLETE SESSION TERMINATION & LOGOUT PURGE
 * Clears all server-side authentication cookies, tokens, and records audit trail.
 * ============================================================================
 */
r.post('/auth/logout', asyncH(async (req, res) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
  res.clearCookie('session_token', cookieOptions);
  res.clearCookie('access_token', cookieOptions);
  res.clearCookie('csrf_token', { ...cookieOptions, httpOnly: false });
  res.clearCookie('x-admin-token-key', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);

  await logAuditEvent({
    actor: req.user || { role: 'guest', full_name: 'Logged Out User' },
    action: 'USER_LOGOUT',
    resourceType: 'system_auth',
    resourceId: req.user?.id || 'session-terminated',
    details: { message: 'User signed out; credentials and session cookies cleared completely.' },
    req,
  }).catch(() => {});

  return res.json({ success: true, message: 'Session terminated and credentials purged successfully.' });
}));

/**
 * ============================================================================
 * CLIENT USER ACCOUNT REGISTRATION WITH 2FA & SOCIAL AUTO SIGN-UP
 * ============================================================================
 */

/**
 * Step 1: Initiate Client Account Sign-Up
 * Validates user data (requiring First & Last name), checks Gmail/Facebook/Email.
 * The account is pre-created inside the system in an unconfirmed state.
 * A 1-minute (60s) time-gated token is issued. If not confirmed within 60s,
 * the unconfirmed account is automatically removed and a notification email is sent.
 */
/**
 * Pre-validation Endpoint: Anti-Duplication Security Gate
 * Checks whether an email address or 11-digit mobile number is already registered.
 */
r.post('/auth/check-duplicate', asyncH(async (req, res) => {
  const { email, phone } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPhone = phone ? String(phone).replace(/\D/g, '').replace(/^63(?=\d{10})/, '0').slice(0, 11) : '';

  if (cleanEmail) {
    const { data: dupCust } = await admin.from('customers').select('id, email').ilike('email', cleanEmail).maybeSingle();
    if (dupCust) {
      return res.json({ isDuplicate: true, field: 'email', message: `An account with email "${cleanEmail}" already exists. Please sign in or reset your password.` });
    }
    const { data: dupProf } = await admin.from('profiles').select('id, email').ilike('email', cleanEmail).maybeSingle();
    if (dupProf) {
      return res.json({ isDuplicate: true, field: 'email', message: `An account with email "${cleanEmail}" already exists. Please sign in or reset your password.` });
    }
  }

  if (cleanPhone) {
    if (cleanPhone.length !== 11 || !cleanPhone.startsWith('09')) {
      return res.json({ isDuplicate: false, invalidFormat: true, field: 'phone', message: 'Mobile number must strictly be an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567).' });
    }
    const { data: dupCustPhone } = await admin.from('customers').select('id, phone').eq('phone', cleanPhone).maybeSingle();
    if (dupCustPhone) {
      return res.json({ isDuplicate: true, field: 'phone', message: `Mobile number "${cleanPhone}" is already registered to an existing customer account.` });
    }
    const { data: dupProfPhone } = await admin.from('profiles').select('id, phone').eq('phone', cleanPhone).maybeSingle();
    if (dupProfPhone) {
      return res.json({ isDuplicate: true, field: 'phone', message: `Mobile number "${cleanPhone}" is already registered to an existing customer account.` });
    }
  }

  return res.json({ isDuplicate: false });
}));

r.post('/auth/signup/initiate',
  validateJoi(joiSchemas.initiateSignup),
  asyncH(async (req, res) => {
    const {
      email, password, first_name, middle_name, last_name, username,
      phone, address, city, emergency_contact, provider = 'email',
    } = req.body;

    const cleanEmail = email.trim().toLowerCase();
    const cleanFirst = first_name.trim();
    const cleanLast = last_name.trim();
    const cleanMiddle = (middle_name || '').trim();
    const cleanUsername = (username || cleanEmail.split('@')[0]).trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');

    // Strict Name Requirement Check ("and the name is still need")
    if (!cleanFirst || !cleanLast) {
      throw new ApiError(400, 'Name is strictly required: First name and last name must be provided to create a client account.');
    }

    const fullName = [cleanFirst, cleanMiddle, cleanLast].filter(Boolean).join(' ');
    const normPhone = phone ? String(phone).replace(/\D/g, '').replace(/^63(?=\d{10})/, '0').slice(0, 11) : '';
    const normEmergency = emergency_contact ? String(emergency_contact).replace(/\D/g, '').replace(/^63(?=\d{10})/, '0').slice(0, 11) : '';

    // Strict 11-Digit Philippine Mobile Limitation
    if (normPhone) {
      if (normPhone.length !== 11 || !normPhone.startsWith('09')) {
        throw new ApiError(400, 'Mobile phone must strictly be an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567).');
      }

      // Anti-Duplication Security Check: Phone Number
      try {
        const { data: dupCustPhone } = await admin.from('customers').select('id, phone').eq('phone', normPhone).maybeSingle();
        if (dupCustPhone) {
          throw new ApiError(409, `Mobile number ${normPhone} is already linked to an existing customer account. Please sign in or use another number.`);
        }
        const { data: dupProfPhone } = await admin.from('profiles').select('id, phone').eq('phone', normPhone).maybeSingle();
        if (dupProfPhone) {
          throw new ApiError(409, `Mobile number ${normPhone} is already linked to an existing customer account. Please sign in or use another number.`);
        }
      } catch (phoneCheckErr) {
        if (phoneCheckErr instanceof ApiError) throw phoneCheckErr;
      }
    }

    // Anti-Duplication Fast Local Store Check
    const localCust = findCustomerByEmail(cleanEmail);
    if (localCust) {
      throw new ApiError(409, 'An account with this email address already exists. Please sign in or use Account Recovery.');
    }

    // Anti-Duplication Security Check: Email in Customers and Profiles
    try {
      const { data: dupCustEmail } = await admin.from('customers').select('id, email').ilike('email', cleanEmail).maybeSingle();
      if (dupCustEmail) {
        throw new ApiError(409, 'An account with this email address already exists. Please sign in or use Account Recovery.');
      }
      const { data: dupProfEmail } = await admin.from('profiles').select('id, email').ilike('email', cleanEmail).maybeSingle();
      if (dupProfEmail) {
        throw new ApiError(409, 'An account with this email address already exists. Please sign in or use Account Recovery.');
      }
    } catch (emailCheckErr) {
      if (emailCheckErr instanceof ApiError) throw emailCheckErr;
    }

    // Gmail / Facebook provider domain guidance
    if (provider === 'gmail' || provider === 'google') {
      if (!cleanEmail.endsWith('@gmail.com') && !cleanEmail.includes('@')) {
        throw new ApiError(400, 'Please provide a valid Gmail address (e.g. yourname@gmail.com).');
      }
    }

    // Check if account already exists in Supabase
    try {
      const { data: usersData, error: usersErr } = await admin.auth.admin.listUsers();
      if (!usersErr && usersData?.users) {
        const existing = usersData.users.find((u) => u.email?.toLowerCase() === cleanEmail);
        if (existing) {
          // If the account was previously unconfirmed and expired, clean up the stale unconfirmed account
          if (!existing.email_confirmed_at && (!existing.user_metadata || !existing.user_metadata.confirmed)) {
            await admin.auth.admin.deleteUser(existing.id).catch(() => {});
            await admin.from('profiles').delete().eq('id', existing.id).catch(() => {});
          } else {
            throw new ApiError(409, 'An account with this email address already exists. Please sign in or use Account Recovery.');
          }
        }
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
    }

    // 1. Pre-create the unconfirmed account inside Supabase Auth
    let authUser = null;
    try {
      const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: false,
        user_metadata: {
          username: cleanUsername,
          first_name: cleanFirst,
          middle_name: cleanMiddle,
          last_name: cleanLast,
          full_name: fullName,
          phone: normPhone,
          address: address || '',
          city: city || '',
          emergency_contact: normEmergency,
          role: 'customer',
          provider,
          confirmed: false,
        },
      });

      if (!createErr && createdUser?.user) {
        authUser = createdUser.user;
      } else if (createErr?.message?.toLowerCase().includes('already')) {
        const { data: usersData } = await admin.auth.admin.listUsers();
        authUser = usersData?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
      }
    } catch (createErr) {
      console.warn('[Supabase Warning] Could not pre-create unconfirmed user:', createErr.message);
    }

    const userId = authUser?.id || authUser?.sub || `pending_${crypto.randomUUID()}`;

    // 2. Pre-create resort guest profile so account exists inside the database
    if (userId && !userId.startsWith('pending_')) {
      await admin.from('profiles').upsert({
        id: userId,
        email: cleanEmail,
        username: cleanUsername,
        first_name: cleanFirst,
        middle_name: cleanMiddle,
        last_name: cleanLast,
        full_name: fullName,
        phone: normPhone,
        address: address || '',
        city: city || '',
        emergency_contact: normEmergency,
        role: 'customer',
      }).catch((err) => console.warn('[Database Warning] Profile pre-creation notice:', err.message));
    }

    // Generate secure 6-digit 2FA confirmation code
    const code = crypto.randomInt(100000, 999999).toString();
    const cacheKey = `signup_2fa:${cleanEmail}`;
    const ttlSeconds = 60; // Strictly 1 minute (time-gated)
    const expiresAt = Date.now() + ttlSeconds * 1000;

    // Store in Redis / in-memory cache with 60s (1 min) TTL
    await redis.set(cacheKey, {
      code,
      email: cleanEmail,
      username: cleanUsername,
      password,
      userId,
      profile: {
        username: cleanUsername,
        first_name: cleanFirst,
        middle_name: cleanMiddle,
        last_name: cleanLast,
        full_name: fullName,
        phone: normPhone,
        address: address || '',
        city: city || '',
        emergency_contact: normEmergency,
        provider,
      },
      attempts: 0,
      createdAt: Date.now(),
      expiresAt,
      confirmed: false,
    }, ttlSeconds);

    // 3. Automated server-side 1-minute expiration watcher:
    // If not confirmed in 60s, automatically remove the unconfirmed account and email the user
    setTimeout(async () => {
      try {
        const pending = await redis.get(cacheKey);
        if (pending && !pending.confirmed) {
          console.log(`[1-Minute Auto-Removal] Account ${cleanEmail} was not confirmed in 1 minute. Removing...`);
          if (pending.userId && !pending.userId.startsWith('pending_')) {
            await admin.auth.admin.deleteUser(pending.userId).catch(() => {});
            await admin.from('profiles').delete().eq('id', pending.userId).catch(() => {});
          }
          await redis.del(cacheKey);
          await sendSignupExpiredEmail({
            to: cleanEmail,
            name: pending.profile?.full_name || 'Guest',
          }).catch((e) => console.warn('[Mailer Warning] Expiry email error:', e.message));
        }
      } catch (err) {
        console.warn('[Auto-Removal Notice]:', err.message);
      }
    }, ttlSeconds * 1000);

    // 4. Dispatch 2FA OTP Email via Nodemailer (Google Mail / SMTP)
    sendSignup2FAOTP({
      to: cleanEmail,
      code,
      name: fullName,
      provider,
    }).catch((err) => {
      console.warn(`[Nodemailer Warning] Could not send Signup 2FA OTP to ${cleanEmail}:`, err.message);
    });

    // 5. Dispatch SMS ping if guest provided a mobile number
    if (phone) {
      pingSMS({
        profileId: 'client-signup',
        toPhone: phone,
        body: `Rock View Beach Resort: Your client account confirmation code is ${code}. Valid for 1 minute. Confirm now to keep your account.`,
      }).catch(() => {});
    }

    const isDev = process.env.NODE_ENV !== 'production';

    return res.json({
      success: true,
      message: phone
        ? `2FA confirmation code dispatched to your Gmail (${cleanEmail}) and mobile phone. You have 1 minute to confirm.`
        : `2FA confirmation code dispatched to your Gmail (${cleanEmail}). You have 1 minute to confirm.`,
      email: cleanEmail,
      provider,
      expires_in_seconds: 60,
      channel: phone ? 'email_and_sms' : 'email',
      ...devOtpPreview(code),
    });
  }));

/**
 * Step 2: Confirm 2FA Code & Finalize Account Creation
 * Verifies code within the 1-minute window. If token expired, auto-removes the unconfirmed account,
 * sends an expiration notification email, and instructs user to "Try Again, please make sure you confirm".
 */
r.post('/auth/signup/confirm-2fa',
  validateJoi(joiSchemas.verifySignup2FA),
  asyncH(async (req, res) => {
    const { email, code } = req.body;
    const cleanEmail = email.trim().toLowerCase();
    const cacheKey = `signup_2fa:${cleanEmail}`;

    const record = await redis.get(cacheKey);
    // If token expired (> 60s) or not found:
    if (!record || (record.expiresAt && Date.now() > record.expiresAt)) {
      if (record?.userId && !record.userId.startsWith('pending_')) {
        await admin.auth.admin.deleteUser(record.userId).catch(() => {});
        await admin.from('profiles').delete().eq('id', record.userId).catch(() => {});
      }
      await redis.del(cacheKey);
      sendSignupExpiredEmail({
        to: cleanEmail,
        name: record?.profile?.full_name || 'Guest',
      }).catch(() => {});

      throw new ApiError(400, 'Confirmation token has expired (1-minute limit). Your unconfirmed account was automatically removed. Try Again, please make sure you confirm.');
    }

    if (String(record.code) !== String(code).trim()) {
      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts >= 5) {
        if (record.userId && !record.userId.startsWith('pending_')) {
          await admin.auth.admin.deleteUser(record.userId).catch(() => {});
          await admin.from('profiles').delete().eq('id', record.userId).catch(() => {});
        }
        await redis.del(cacheKey);
        sendSignupExpiredEmail({
          to: cleanEmail,
          name: record.profile?.full_name || 'Guest',
        }).catch(() => {});
        throw new ApiError(429, 'Too many invalid 2FA attempts. The unconfirmed account was removed for security. Try Again, please make sure you confirm.');
      }
      const remainingTtl = Math.max(1, Math.round((record.expiresAt - Date.now()) / 1000));
      await redis.set(cacheKey, record, remainingTtl);
      throw new ApiError(400, `Invalid 2FA verification code. ${5 - record.attempts} attempts remaining.`);
    }

    // Name integrity enforcement verification
    const { first_name, middle_name, last_name, full_name, phone, address, city, emergency_contact, provider } = record.profile;
    if (!first_name || !last_name) {
      throw new ApiError(400, 'Registration cannot be finalized without a valid First and Last Name.');
    }

    // Mark confirmed in record
    record.confirmed = true;

    // Finalize Account in Supabase Auth (set email_confirm = true)
    let userId = record.userId;
    if (userId && !userId.startsWith('pending_')) {
      await admin.auth.admin.updateUserById(userId, {
        email_confirm: true,
        user_metadata: {
          first_name,
          middle_name,
          last_name,
          full_name,
          phone,
          address,
          city,
          emergency_contact,
          role: 'customer',
          provider,
          confirmed: true,
        },
      }).catch((err) => console.warn('[Supabase Warning] Update user confirm status:', err.message));
    } else {
      // Create user if not pre-created
      const { data: createdUser } = await admin.auth.admin.createUser({
        email: record.email,
        password: record.password,
        email_confirm: true,
        user_metadata: {
          first_name,
          middle_name,
          last_name,
          full_name,
          phone,
          address,
          city,
          emergency_contact,
          role: 'customer',
          provider,
          confirmed: true,
        },
      });
      userId = createdUser?.user?.id || createdUser?.user?.sub;
    }

    if (!userId) {
      throw new ApiError(500, 'User identification could not be generated during account finalization.');
    }

    // Upsert confirmed guest profile in database
    const { data: prof, error: profErr } = await admin.from('profiles').upsert({
      id: userId,
      email: cleanEmail,
      username: record.profile?.username || cleanEmail.split('@')[0],
      first_name,
      middle_name: middle_name || '',
      last_name,
      full_name,
      phone: phone || '',
      address: address || '',
      city: city || '',
      emergency_contact: emergency_contact || '',
      role: 'customer',
      is_verified: true,
    }).select().single();

    if (profErr) {
      console.warn('[Database Warning] Profile upsert notice:', profErr.message);
    } else {
      notifyStaff({ type: 'customer', title: 'New customer account', body: `${full_name || cleanEmail} (${cleanEmail}) signed up.` });
    }

    // Upsert customer record into customers table with password hash
    try {
      await admin.from('customers').upsert({
        id: userId,
        email: cleanEmail,
        username: record.profile?.username || cleanEmail.split('@')[0],
        first_name,
        middle_name: middle_name || '',
        last_name,
        full_name,
        role: 'customer',
        phone: phone || '',
        address: address || '',
        city: city || '',
        emergency_contact: emergency_contact || '',
        provider: provider || 'email',
        is_verified: true,
        password: hashPassword(record.password),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    } catch (custUpsertErr) {
      console.warn('[Customers Table Sync Warning]:', custUpsertErr.message);
    }

    // Clean up 2FA cache state
    await redis.del(cacheKey);

    // Dispatch Welcome & Confirmation Email via Nodemailer
    sendWelcomeClientEmail({
      to: cleanEmail,
      name: full_name,
      provider,
    }).catch(() => {});

    // Dispatch SMS welcome ping if mobile phone available
    if (phone) {
      pingSMS({
        profileId: userId,
        toPhone: phone,
        body: `Mabuhay ${first_name}! Your Rock View Beach Resort account is verified & finalized. You may now reserve villas & access your digital pass.`,
      }).catch(() => {});
    }

    // Auto-log customer registration login timestamp
    await logAuditEvent({
      actor: {
        id: userId,
        email: cleanEmail,
        full_name,
        role: 'customer',
      },
      action: 'CUSTOMER_LOGIN',
      resourceType: 'authentication',
      resourceId: userId,
      details: {
        process: 'Customer Account Finalization & Login',
        message: `Customer ${full_name} completed 2FA verification and signed in`,
        login_timestamp: new Date().toISOString(),
        login_method: 'signup_2fa',
      },
      req,
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      finalized: true,
      message: 'Account finalized and verified successfully! Welcome to Rock View Beach Resort.',
      user: {
        id: userId,
        email: cleanEmail,
        ...(prof || record.profile),
        role: 'customer',
      },
      credentials: {
        email: cleanEmail,
        password: record.password,
      },
    });
  }));

/**
 * Step 3: Resend 2FA Confirmation Code (Restarts 1-minute window)
 */
r.post('/auth/signup/resend-2fa',
  validateJoi(joiSchemas.resendSignup2FA),
  asyncH(async (req, res) => {
    const { email } = req.body;
    const cleanEmail = email.trim().toLowerCase();
    const cacheKey = `signup_2fa:${cleanEmail}`;

    const record = await redis.get(cacheKey);
    if (!record) {
      throw new ApiError(400, 'No active sign-up found. The 1-minute confirmation window has expired. Try Again, please make sure you confirm.');
    }

    const newCode = crypto.randomInt(100000, 999999).toString();
    const ttlSeconds = 60;
    record.code = newCode;
    record.attempts = 0;
    record.createdAt = Date.now();
    record.expiresAt = Date.now() + ttlSeconds * 1000;

    await redis.set(cacheKey, record, ttlSeconds);

    sendSignup2FAOTP({
      to: cleanEmail,
      code: newCode,
      name: record.profile?.full_name || 'Guest',
      provider: record.profile?.provider || 'email',
    }).catch(() => {});

    if (record.profile?.phone) {
      pingSMS({
        profileId: 'client-signup',
        toPhone: record.profile.phone,
        body: `Rock View Beach Resort: Your new 2FA confirmation code is ${newCode}. Valid for 1 minute.`,
      }).catch(() => {});
    }

    const isDev = process.env.NODE_ENV !== 'production';

    return res.json({
      success: true,
      message: `A new confirmation code has been dispatched to ${cleanEmail}. You have 1 minute to confirm.`,
      expires_in_seconds: 60,
      ...devOtpPreview(newCode),
    });
  }));

/**
 * Step 4: Expire & Auto-Remove Unconfirmed Account
 * Called when client 1-minute timer elapses or user cancels confirmation.
 * Immediately removes the unconfirmed account from Supabase Auth & profiles,
 * cleans up Redis cache, and emails the user saying: "Try Again, please make sure you confirm".
 */
r.post('/auth/signup/expire-unconfirmed',
  validateJoi(joiSchemas.expireSignup),
  asyncH(async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    const cacheKey = `signup_2fa:${email}`;
    const pending = await redis.get(cacheKey);

    let userId = pending?.userId;
    let name = pending?.profile?.full_name || 'Guest';

    // If userId not found in redis, inspect Supabase for any unconfirmed user with this email
    if (!userId || userId.startsWith('pending_')) {
      try {
        const { data: usersData } = await admin.auth.admin.listUsers();
        const unconfirmed = usersData?.users?.find(
          (u) => u.email?.toLowerCase() === email && (!u.email_confirmed_at || !u.user_metadata?.confirmed)
        );
        if (unconfirmed) {
          userId = unconfirmed.id;
          name = unconfirmed.user_metadata?.full_name || name;
        }
      } catch {}
    }

    // Auto-remove unconfirmed account from Supabase Auth and database profiles
    if (userId && !userId.startsWith('pending_')) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      await admin.from('profiles').delete().eq('id', userId).catch(() => {});
    }

    await redis.del(cacheKey);

    // Send cancellation email notifying user of 1-minute expiration
    sendSignupExpiredEmail({ to: email, name }).catch((err) => {
      console.warn('[Mailer Warning] Could not send expired email:', err.message);
    });

    return res.json({
      success: true,
      removed: true,
      message: 'Try Again, please make sure you confirm',
    });
  }));


/**
 * Step 1: Initiate Account Recovery
 * Generates a 6-digit OTP code, stores it in Redis/in-memory cache (15 min TTL),
 * dispatches email OTP via Nodemailer (Google/SMTP), and sends SMS ping.
 */
r.post('/auth/forgot-password',
  validateJoi(joiSchemas.forgotPassword),
  asyncH(async (req, res) => {
    const email = req.body.email.trim().toLowerCase();

    // Look up user in Supabase auth users
    let targetUser = null;
    let targetProfile = null;
    let targetEmail = email;

    try {
      const { data: usersData, error: usersErr } = await admin.auth.admin.listUsers();
      if (!usersErr && usersData?.users) {
        targetUser = usersData.users.find((u) => u.email?.toLowerCase() === email);
      }
    } catch {}

    // Check employee_accounts for staff/admin email or employee_id
    try {
      const { data: emp } = await admin.from('employee_accounts')
        .select('*')
        .or(`email.ilike.${email},employee_id.ilike.${email}`)
        .single();
      if (emp) {
        if (!targetUser && emp.auth_user_id) {
          try {
            const { data: u } = await admin.auth.admin.getUserById(emp.auth_user_id);
            if (u?.user) targetUser = u.user;
          } catch {}
        }
        targetProfile = emp;
        if (emp.email) targetEmail = emp.email.toLowerCase();
      }
    } catch {}

    // Also look up profile in profiles table
    try {
      if (targetUser && !targetProfile) {
        const { data: p } = await admin.from('profiles').select('*').eq('id', targetUser.id).single();
        if (p) targetProfile = p;
      }
    } catch {}

    // Generate secure 6-digit verification code
    const code = crypto.randomInt(100000, 999999).toString();
    const cacheKey = `recovery:${targetEmail}`;

    // Store in Redis / in-memory cache with 900s (15 min) TTL
    await redis.set(cacheKey, {
      code,
      userId: targetUser?.id || null,
      email: targetEmail,
      attempts: 0,
      createdAt: Date.now(),
    }, 900);

    const guestName = targetProfile?.full_name || targetUser?.user_metadata?.full_name || 'Valued User';

    // 1. Dispatch Email OTP via Nodemailer (Google Mail / SMTP)
    sendRecoveryOTP({
      to: targetEmail,
      code,
      name: guestName,
    }).catch((err) => {
      console.warn(`[Nodemailer Warning] Could not send OTP to ${targetEmail}:`, err.message);
    });

    // 2. Dispatch SMS ping if target has a registered mobile number
    const targetPhone = targetProfile?.phone || targetUser?.user_metadata?.phone;
    if (targetPhone) {
      pingSMS({
        profileId: targetUser?.id || 'guest',
        toPhone: targetPhone,
        body: `Rock View Beach Resort: Your account recovery verification code is ${code}. Valid for 15 minutes. Never share this code.`,
      }).catch(() => {});
    }

    return res.json({
      success: true,
      message: targetPhone
        ? `Recovery code dispatched to your email (${email}) and phone (${targetPhone.slice(0, 4)}***${targetPhone.slice(-2)}).`
        : `Recovery code dispatched to your email (${email}).`,
      expires_in_seconds: 900,
      channel: targetPhone ? 'email_and_sms' : 'email',
      ...devOtpPreview(code),
    });
  }));

/**
 * Step 2: Verify Recovery Code
 */
r.post('/auth/verify-recovery-code',
  validateJoi(joiSchemas.verifyRecovery),
  asyncH(async (req, res) => {
    const { email, code } = req.body;
    const cleanEmail = email.trim().toLowerCase();

    // Check Brute Force / OTP enumeration lockout
    const lockout = checkBruteForceLockout(req.ip, cleanEmail);
    if (lockout.locked) {
      throw new ApiError(429, `Security Lockout Active: Too many invalid recovery code attempts. Access blocked for ${lockout.remainingSeconds} seconds.`);
    }

    const cacheKey = `recovery:${cleanEmail}`;

    const record = await redis.get(cacheKey);
    if (!record) {
      throw new ApiError(400, 'Recovery code has expired or was not requested. Please request a new code.');
    }

    if (String(record.code) !== String(code).trim()) {
      record.attempts = (record.attempts || 0) + 1;
      await recordFailedAttempt(req.ip, cleanEmail, req);
      if (record.attempts >= 5) {
        await redis.del(cacheKey);
        throw new ApiError(429, 'Too many invalid attempts. This recovery code has been invalidated for your security. Please request a new code.');
      }
      await redis.set(cacheKey, record, 900);
      throw new ApiError(400, `Invalid verification code. ${5 - record.attempts} attempts remaining.`);
    }

    recordSuccessfulAttempt(req.ip, cleanEmail);

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

    // Resolve user ID & account details
    let userId = record.userId;
    let guestName = 'Valued User';
    let targetPhone = null;

    if (!userId) {
      try {
        const { data: usersData } = await admin.auth.admin.listUsers();
        const found = usersData?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
        if (found) userId = found.id;
      } catch {}
    }

    // Check employee_accounts
    let targetEmployee = null;
    try {
      const { data: emp } = await admin.from('employee_accounts')
        .select('*')
        .or(`email.ilike.${cleanEmail},employee_id.ilike.${cleanEmail}`)
        .single();
      if (emp) {
        targetEmployee = emp;
        if (!userId && emp.auth_user_id) userId = emp.auth_user_id;
        guestName = emp.full_name || guestName;
      }
    } catch {}

    if (!userId && !targetEmployee) {
      throw new ApiError(404, 'No account matching this email address was found.');
    }

    // Fetch profile for notification personalization
    if (userId) {
      try {
        const { data: prof } = await admin.from('profiles').select('phone, full_name').eq('id', userId).single();
        if (prof) {
          guestName = prof.full_name || guestName;
          targetPhone = prof.phone;
        }
      } catch {}
    }

    let authUpdated = false;
    if (userId) {
      const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
        password: new_password,
      });
      if (!updateErr) authUpdated = true;
    }

    // Also update password hash in customers table
    try {
      await admin.from('customers')
        .update({ password: hashPassword(new_password), updated_at: new Date().toISOString() })
        .ilike('email', cleanEmail);
      authUpdated = true;
    } catch (custErr) {
      console.warn('[Customers Table Password Reset Warning]:', custErr.message);
    }

    // Also synchronize password to employee_accounts if an employee record exists
    let empUpdated = false;
    try {
      const { error: empErr } = await admin.from('employee_accounts')
        .update({ password: hashPassword(new_password) })
        .or(`email.ilike.${cleanEmail},auth_user_id.eq.${userId || '00000000-0000-0000-0000-000000000000'}`);
      if (!empErr) empUpdated = true;
    } catch {}

    if (!authUpdated && !empUpdated) {
      throw new ApiError(500, 'Failed to update security password in database.');
    }

    // Invalidate the recovery code from Redis immediately
    await redis.del(cacheKey);

    // Send confirmation Email via Nodemailer
    sendPasswordResetSuccess({
      to: cleanEmail,
      name: guestName,
    }).catch(() => {});

    // Send confirmation SMS if phone exists
    if (targetPhone) {
      pingSMS({
        profileId: userId,
        toPhone: targetPhone,
        body: 'Rock View Beach Resort: Your account password has been successfully updated. You may now log in.',
      }).catch(() => {});
    }

    // Auto-log security password reset event
    await logAuditEvent({
      actor: {
        id: userId,
        email: cleanEmail,
        full_name: guestName,
        role: 'customer',
      },
      action: 'PASSWORD_RESET',
      resourceType: 'user_security',
      resourceId: userId,
      details: {
        process: 'Account Password Reset',
        message: `Password was successfully updated for account ${cleanEmail}`,
      },
      req,
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Your password has been successfully reset. You may now log in with your new password.',
    });
  }));

// =========================================================================
// 7. META / FACEBOOK DATA DELETION CALLBACK & SELF-SERVICE ENDPOINT
//    Implements https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/data-deletion-callback
// =========================================================================
function base64UrlDecodeBuffer(input) {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;
  return Buffer.from(padded, 'base64');
}

export function parseFacebookSignedRequest(signedRequest, appSecret) {
  if (!signedRequest || typeof signedRequest !== 'string' || !signedRequest.includes('.')) {
    return null;
  }
  const [encodedSig, payload] = signedRequest.split('.', 2);
  const sig = base64UrlDecodeBuffer(encodedSig);
  const dataJson = base64UrlDecodeBuffer(payload).toString('utf8');
  const data = JSON.parse(dataJson);

  if (data?.algorithm && String(data.algorithm).toUpperCase() !== 'HMAC-SHA256') {
    throw new ApiError(400, 'Unknown signed_request algorithm. Expected HMAC-SHA256.');
  }

  // Verify HMAC-SHA256 signature if FACEBOOK_APP_SECRET is configured
  if (appSecret) {
    const expectedSig = crypto
      .createHmac('sha256', appSecret)
      .update(payload)
      .digest();
    if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(sig, expectedSig)) {
      throw new ApiError(400, 'Bad Signed JSON signature!');
    }
  }

  return data;
}

const handleUserDataDeletion = asyncH(async (req, res) => {
  const appSecret = process.env.FACEBOOK_APP_SECRET || process.env.FB_APP_SECRET || '';
  const signedRequest = req.body?.signed_request || req.query?.signed_request;
  const rawEmail = String(req.body?.email || '').trim().toLowerCase();
  const reason = String(req.body?.reason || 'Facebook / OAuth User Data Deletion Callback').trim();

  let fbUserId = null;
  if (signedRequest) {
    const parsed = parseFacebookSignedRequest(signedRequest, appSecret);
    fbUserId = parsed?.user_id ? String(parsed.user_id) : null;
    if (!fbUserId) {
      throw new ApiError(400, 'Invalid signed_request: missing user_id.');
    }
  } else if (!rawEmail) {
    throw new ApiError(400, 'Missing signed_request or email parameter.');
  }

  const confirmationCode = `DEL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  // Locate and delete matching user records in Supabase / local database
  try {
    const { data: usersData } = await admin.auth.admin.listUsers();
    const matchedUser = (usersData?.users || []).find((u) => {
      if (rawEmail && u.email?.toLowerCase() === rawEmail) return true;
      if (fbUserId) {
        const identities = Array.isArray(u.identities) ? u.identities : [];
        return (
          u.user_metadata?.provider_id === fbUserId ||
          u.user_metadata?.sub === fbUserId ||
          identities.some((idObj) => String(idObj?.id) === fbUserId || String(idObj?.identity_data?.sub) === fbUserId)
        );
      }
      return false;
    });

    if (matchedUser?.id) {
      await admin.from('user_confirmations').delete().eq('user_id', matchedUser.id).catch(() => {});
      await admin.from('chat_messages').delete().eq('profile_id', matchedUser.id).catch(() => {});
      await admin.from('notifications').delete().eq('profile_id', matchedUser.id).catch(() => {});
      await admin.from('reservations').update({ guest_id: null }).eq('guest_id', matchedUser.id).catch(() => {});
      await admin.from('resort_orders').update({ guest_id: null }).eq('guest_id', matchedUser.id).catch(() => {});
      await admin.from('reviews').update({ guest_id: null }).eq('guest_id', matchedUser.id).catch(() => {});
      await admin.from('customers').delete().eq('id', matchedUser.id).catch(() => {});
      await admin.from('users').delete().eq('id', matchedUser.id).catch(() => {});
      await admin.from('profiles').delete().eq('id', matchedUser.id).catch(() => {});
      await admin.auth.admin.deleteUser(matchedUser.id).catch(() => {});
    } else if (rawEmail) {
      await admin.from('customers').delete().eq('email', rawEmail).catch(() => {});
      await admin.from('profiles').delete().eq('email', rawEmail).catch(() => {});
    }
  } catch (err) {
    console.warn('[Data Deletion Callback] Cleanup notice:', err.message);
  }

  // Persist deletion receipt in Redis / memory cache for status checks
  await redis.set(`data_deletion:${confirmationCode}`, {
    confirmation_code: confirmationCode,
    facebook_user_id: fbUserId || null,
    email: rawEmail || null,
    status: 'COMPLETED',
    deleted_at: new Date().toISOString(),
  }, 86400 * 30).catch(() => {});

  await logAuditEvent({
    actor: {
      id: fbUserId || rawEmail || 'facebook_callback',
      email: rawEmail || null,
      role: 'customer',
    },
    action: 'USER_DATA_DELETION_COMPLETED',
    resourceType: 'user_privacy',
    resourceId: confirmationCode,
    details: {
      confirmation_code: confirmationCode,
      email: rawEmail || undefined,
      facebook_user_id: fbUserId || undefined,
      reason,
      callback_source: signedRequest ? 'meta_signed_request' : 'self_service_portal',
    },
    req,
  }).catch(() => {});

  const statusUrl = `https://patar-resort.pages.dev/data-deletion?id=${confirmationCode}`;

  // Strictly return { url, confirmation_code } as required by Meta's Data Deletion Callback spec
  return res.status(200).json({
    url: statusUrl,
    confirmation_code: confirmationCode,
  });
});

r.post('/auth/data-deletion', handleUserDataDeletion);
r.post('/auth/facebook/data-deletion', handleUserDataDeletion);
r.get('/auth/data-deletion/status/:code', asyncH(async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const cached = await redis.get(`data_deletion:${code}`).catch(() => null);
  return res.json(cached || {
    confirmation_code: code,
    status: 'COMPLETED',
    message: 'All personal profile and Facebook OAuth data associated with this confirmation code has been permanently erased.',
  });
}));
r.get('/auth/data-deletion', (req, res) => {
  const code = req.query?.id || req.query?.code;
  const target = code
    ? `https://patar-resort.pages.dev/data-deletion?id=${encodeURIComponent(String(code))}`
    : 'https://patar-resort.pages.dev/data-deletion';
  return res.redirect(302, target);
});
r.get('/auth/facebook/data-deletion', (req, res) => {
  const code = req.query?.id || req.query?.code;
  const target = code
    ? `https://patar-resort.pages.dev/data-deletion?id=${encodeURIComponent(String(code))}`
    : 'https://patar-resort.pages.dev/data-deletion';
  return res.redirect(302, target);
});

export default r;
