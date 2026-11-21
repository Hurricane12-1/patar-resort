/**
 * ============================================================================
 * Rock View Beach Resort · Isolated Modular Framework (IMF)
 * Module: Client & Customer Authentication Service
 * Scope: Strictly Customer & Guest Persona Authentication Only
 * Location: Brgy. Patar, Bolinao, Pangasinan (16.3042° N, 119.7821° E)
 * ============================================================================
 */

import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { asyncH, ApiError } from '../../middleware/errors.js';
import { admin } from '../../lib/supabase.js';
import { logAuditEvent } from '../../lib/auditLogger.js';
import { checkBruteForceLockout, recordFailedAttempt, recordSuccessfulAttempt } from '../../middleware/bruteForceGuard.js';
import { verifyPassword } from '../../lib/passwords.js';
import { verifyCustomerCredentials, findCustomerByEmail, saveCustomer } from '../../lib/customerStore.js';

export const clientAuthRouter = Router();

/**
 * ============================================================================
 * STRICT CUSTOMER / GUEST AUTHENTICATION HANDLER
 * Enforces strict persona boundary:
 *  - Only authenticates verified guest / customer accounts
 *  - Explicitly rejects administrative accounts (must use Executive Portal)
 *  - Emits CUSTOMER_LOGIN audit trail
 *  - Completely isolated from administrative token keys and executive privileges
 * ============================================================================
 */
export const handleClientLogin = asyncH(async (req, res) => {
  const { email, username, login, identifier, password } = req.body || {};
  const userIdent = (username || login || identifier || email || '').trim();
  if (!userIdent || !password) {
    throw new ApiError(400, 'Username or email, and password are required.');
  }

  // 1. Check Brute Force / Credential Stuffing Lockout
  const lockout = checkBruteForceLockout(req.ip, userIdent);
  if (lockout.locked) {
    throw new ApiError(429, `Security Lockout Active: Too many failed customer login attempts. Access blocked for ${lockout.remainingSeconds} seconds.`);
  }

  let targetEmail = userIdent.toLowerCase();
  let targetProfile = null;

  // 2. Resolve Customer Identifier (Username or Email) strictly via Customer Stores
  if (!targetEmail.includes('@')) {
    let resolved = null;
    // Check customers table by username if column exists
    try {
      const { data: custMatched } = await admin
        .from('customers')
        .select('email')
        .ilike('username', userIdent)
        .maybeSingle();
      if (custMatched?.email) resolved = custMatched.email.toLowerCase();
    } catch {}

    // Check profiles table by matching email prefix or full_name
    if (!resolved) {
      try {
        const { data: matched } = await admin
          .from('profiles')
          .select('*')
          .or(`email.ilike.${userIdent}@%,full_name.ilike.${userIdent}`)
          .maybeSingle();
        targetProfile = matched;
        if (matched?.email) {
          resolved = matched.email.toLowerCase();
        }
      } catch {}
    }

    if (resolved) {
      targetEmail = resolved;
    }
  } else {
    // Lookup profile by email
    try {
      const { data: matched } = await admin
        .from('profiles')
        .select('*')
        .ilike('email', targetEmail)
        .maybeSingle();
      targetProfile = matched;
    } catch {}
  }

  // 3. Authenticate customer credentials strictly via Supabase Auth OR customers password store
  let authData = null;
  let authErr = null;

  try {
    const { data, error } = await admin.auth.signInWithPassword({
      email: targetEmail,
      password,
    });
    if (!error && data?.session) {
      authData = data;
    } else if (error) {
      authErr = error;
    }
  } catch (err) {
    authErr = err;
  }

  // 3b. If Supabase direct auth failed, verify against resilient customer store or customers table
  if (!authData) {
    const localCust = verifyCustomerCredentials(targetEmail, password) || verifyCustomerCredentials(userIdent, password);
    if (localCust) {
      const sessionToken = jwt.sign(
        {
          id: localCust.id,
          email: localCust.email,
          role: 'customer',
          persona: 'customer',
          aud: 'authenticated',
        },
        env.SUPABASE_JWT_SECRET || 'rockview-customer-secret-key-2026',
        { expiresIn: '7d' }
      );

      authData = {
        user: {
          id: localCust.id,
          email: localCust.email,
          user_metadata: {
            full_name: localCust.full_name,
            first_name: localCust.first_name,
            last_name: localCust.last_name,
            phone: localCust.phone,
            role: 'customer',
          },
        },
        session: {
          access_token: sessionToken,
          token_type: 'bearer',
          expires_in: 7 * 24 * 3600,
          refresh_token: sessionToken,
          user: {
            id: localCust.id,
            email: localCust.email,
            role: 'customer',
          },
        },
      };
      authErr = null;
      if (!targetProfile) targetProfile = localCust;
    }
  }

  // 3c. Fallback check against Supabase customers table password hash if not in local store
  if (!authData) {
    try {
      const { data: custRecord } = await admin
        .from('customers')
        .select('*')
        .ilike('email', targetEmail)
        .maybeSingle();

      if (custRecord?.password && verifyPassword(password, custRecord.password)) {
        // Authenticated successfully via customers table!
        const sessionToken = jwt.sign(
          {
            id: custRecord.id,
            email: custRecord.email,
            role: 'customer',
            persona: 'customer',
            aud: 'authenticated',
          },
          env.SUPABASE_JWT_SECRET || 'rockview-customer-secret-key-2026',
          { expiresIn: '7d' }
        );

        authData = {
          user: {
            id: custRecord.id,
            email: custRecord.email,
            user_metadata: {
              full_name: custRecord.full_name,
              first_name: custRecord.first_name,
              last_name: custRecord.last_name,
              phone: custRecord.phone,
              role: 'customer',
            },
          },
          session: {
            access_token: sessionToken,
            token_type: 'bearer',
            expires_in: 7 * 24 * 3600,
            refresh_token: sessionToken,
            user: {
              id: custRecord.id,
              email: custRecord.email,
              role: 'customer',
            },
          },
        };
        authErr = null;
        if (!targetProfile) targetProfile = custRecord;
      }
    } catch (e) {
      console.warn('[Customer Local Password Auth Warning]:', e.message);
    }
  }

  if (!authData) {
    await recordFailedAttempt(req.ip, userIdent, req);
    if (authErr?.message?.includes('Email not confirmed') || authErr?.code === 'email_not_confirmed') {
      throw new ApiError(400, 'Your email address has not been confirmed yet. Please check your inbox for the confirmation link.');
    }
    if (authErr instanceof ApiError) throw authErr;
    throw new ApiError(401, 'Invalid login credentials. Please check your customer email/username and password.');
  }

  // 4. Strict Persona Boundary: Prevent Executive Administrators from authenticating on customer endpoint
  let profile = targetProfile;
  if (!profile && authData.user?.id) {
    try {
      const { data: prof } = await admin.from('profiles').select('*').eq('id', authData.user.id).single();
      profile = prof;
    } catch {}
  }

  // Check if account has an active executive record in employee_accounts
  let employeeRecord = null;
  try {
    const { data: emp } = await admin.from('employee_accounts')
      .select('id, employee_id, role, position, department, is_active')
      .or(`auth_user_id.eq.${authData.user.id},email.eq.${targetEmail}`)
      .eq('is_active', true)
      .maybeSingle();
    employeeRecord = emp;
  } catch {}

  const detectedRole = (employeeRecord?.role || profile?.role || authData.user.user_metadata?.role || 'customer').toLowerCase();
  const isAdministrator = detectedRole === 'administrator' || detectedRole === 'admin';

  if (isAdministrator) {
    await recordFailedAttempt(req.ip, userIdent, req);
    await logAuditEvent({
      actor: { id: authData.user.id, email: targetEmail, role: 'administrator' },
      action: 'RBAC_ACCESS_DENIED',
      resourceType: 'client_portal_login',
      resourceId: authData.user.id,
      details: {
        reason: 'Executive Administrator account blocked on public customer login endpoint.',
        required_endpoint: '/api/admin-auth/login',
      },
      req,
    }).catch(() => {});
    throw new ApiError(403, 'RBAC_ACCESS_DENIED: Executive administrator accounts must authenticate via the dedicated Executive Administrator Portal.');
  }

  // 5. Build Enriched, Strictly Customer-Scoped User Object
  const resolvedEmail = profile?.email || targetEmail || authData.user.email;
  const customerUser = {
    id: authData.user.id,
    email: resolvedEmail,
    full_name: profile?.full_name || authData.user.user_metadata?.full_name || resolvedEmail.split('@')[0],
    role: 'customer',
    position: 'Customer',
    phone: profile?.phone || '',
    address: profile?.address || '',
    city: profile?.city || '',
    avatar_url: profile?.avatar_url || authData.user.user_metadata?.avatar_url || '',
    is_verified: true,
    has_password: true,
    password_status: 'Configured',
    admin_token_verified: false,
  };

  // Reset lockout counter on successful customer sign-in
  recordSuccessfulAttempt(req.ip, userIdent);

  // 6. Record CUSTOMER_LOGIN Audit Event
  await logAuditEvent({
    actor: {
      id: customerUser.id,
      email: customerUser.email,
      full_name: customerUser.full_name,
      role: 'customer',
    },
    action: 'CUSTOMER_LOGIN',
    resourceType: 'authentication',
    resourceId: customerUser.id,
    details: {
      process: 'Customer Login Authentication',
      message: `Customer ${customerUser.full_name} logged in successfully`,
      login_timestamp: new Date().toISOString(),
      login_method: 'customer_credentials',
    },
    req,
  }).catch(() => {});

  return res.json({
    success: true,
    session: authData.session,
    user: customerUser,
    profile: customerUser,
  });
});

// Modular Route Bindings
export const handleGoogleAuth = asyncH(async (req, res) => {
  const { credential, email, name, first_name, last_name, picture, sub, googleId } = req.body || {};

  let targetEmail = (email || '').trim().toLowerCase();
  let targetName = (name || '').trim();
  let targetFirst = (first_name || '').trim();
  let targetLast = (last_name || '').trim();
  let targetPicture = picture || '';
  let targetSub = sub || googleId || '';

  // 1. If Google Identity Services JWT credential (id_token) is provided, decode payload
  if (credential && typeof credential === 'string') {
    try {
      const parts = credential.split('.');
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
        const tokenPayload = JSON.parse(payloadJson);
        if (tokenPayload.email) {
          targetEmail = tokenPayload.email.trim().toLowerCase();
          targetName = targetName || tokenPayload.name || '';
          targetFirst = targetFirst || tokenPayload.given_name || '';
          targetLast = targetLast || tokenPayload.family_name || '';
          targetPicture = targetPicture || tokenPayload.picture || '';
          targetSub = targetSub || tokenPayload.sub || '';
        }
      }
    } catch (e) {
      console.warn('[Google Auth Token Parse Warning]:', e.message);
    }
  }

  if (!targetEmail || !targetEmail.includes('@')) {
    throw new ApiError(400, 'Valid Google email address is required.');
  }

  if (!targetFirst && !targetLast && targetName) {
    const parts = targetName.split(' ');
    targetFirst = parts[0] || 'Guest';
    targetLast = parts.slice(1).join(' ') || '';
  } else if (!targetName) {
    targetFirst = targetFirst || targetEmail.split('@')[0];
    targetLast = targetLast || '';
    targetName = [targetFirst, targetLast].filter(Boolean).join(' ');
  }

  // 2. Check if customer exists in local store or memory first
  const local = findCustomerByEmail(targetEmail);
  let userId = local?.id || (targetSub ? `google_${targetSub}` : crypto.randomUUID());
  let existingCust = local;

  // 3. Upsert customer in resilient local customerStore immediately
  const customerProfile = {
    id: userId,
    email: targetEmail,
    full_name: targetName,
    first_name: targetFirst,
    last_name: targetLast,
    avatar_url: targetPicture || existingCust?.avatar_url || '',
    phone: existingCust?.phone || '',
    role: 'customer',
    position: 'Customer',
    provider: 'google',
    is_verified: true,
    has_password: true,
    password_status: 'OAuth Managed',
  };

  saveCustomer({
    ...customerProfile,
    updated_at: new Date().toISOString(),
  });

  // Non-blocking async background sync to Supabase (never slows down client response)
  Promise.resolve().then(async () => {
    try {
      await admin.from('profiles').upsert(customerProfile, { onConflict: 'id' });
    } catch {}
    try {
      await admin.from('customers').upsert({
        id: userId,
        email: targetEmail,
        full_name: targetName,
        first_name: targetFirst,
        last_name: targetLast,
        avatar_url: targetPicture || existingCust?.avatar_url || '',
        phone: existingCust?.phone || '',
        role: 'customer',
        provider: 'google',
        is_verified: true,
      }, { onConflict: 'id' });
    } catch {}
  });

  // 4. Issue authenticated session JWT for client
  const sessionToken = jwt.sign(
    {
      id: userId,
      email: targetEmail,
      role: 'customer',
      persona: 'customer',
      aud: 'authenticated',
      provider: 'google',
    },
    env.SUPABASE_JWT_SECRET || 'rockview-customer-secret-key-2026',
    { expiresIn: '7d' }
  );

  const authData = {
    user: {
      id: userId,
      email: targetEmail,
      user_metadata: customerProfile,
    },
    profile: customerProfile,
    session: {
      access_token: sessionToken,
      token_type: 'bearer',
      expires_in: 7 * 24 * 3600,
      refresh_token: sessionToken,
      user: {
        id: userId,
        email: targetEmail,
        role: 'customer',
      },
    },
  };

  await logAuditEvent({
    actor: { id: userId, email: targetEmail, role: 'customer' },
    action: 'CUSTOMER_LOGIN',
    resourceType: 'oauth_google',
    resourceId: userId,
    details: {
      method: 'google_oauth',
      provider: 'google',
      email: targetEmail,
      full_name: targetName,
    },
    req,
  }).catch(() => {});

  return res.json({
    success: true,
    message: `Welcome to Rock View Beach Resort, ${targetName}!`,
    session: authData.session,
    user: customerProfile,
    profile: customerProfile,
  });
});

export const handleFacebookAuth = asyncH(async (req, res) => {
  const accessToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) {
    throw new ApiError(401, 'Sign in with Facebook first.');
  }

  // Identity comes from the Supabase session, never the request body, so a caller cannot claim another guest's email.
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error?.name === 'AuthRetryableFetchError') {
    throw new ApiError(503, 'Could not reach the sign-in service. Try again in a moment.');
  }
  const fbUser = data?.user;
  if (error || !fbUser) {
    throw new ApiError(401, 'Your Facebook sign-in has expired. Sign in again.');
  }

  const providers = fbUser.app_metadata?.providers || [fbUser.app_metadata?.provider];
  if (!providers.includes('facebook')) {
    throw new ApiError(403, 'This session was not created with Facebook sign-in.');
  }

  const targetEmail = (fbUser.email || '').trim().toLowerCase();
  if (!targetEmail) {
    throw new ApiError(400, 'Facebook did not share an email address for this account.');
  }

  const meta = fbUser.user_metadata || {};
  const targetName = String(meta.full_name || meta.name || targetEmail.split('@')[0]).trim();
  const [targetFirst, ...lastNameParts] = targetName.split(/\s+/);
  const existingCust = findCustomerByEmail(targetEmail);

  const customerProfile = {
    id: existingCust?.id || fbUser.id,
    email: targetEmail,
    full_name: targetName,
    first_name: targetFirst || 'Guest',
    last_name: lastNameParts.join(' '),
    avatar_url: meta.avatar_url || meta.picture || existingCust?.avatar_url || '',
    phone: existingCust?.phone || '',
    role: 'customer',
    position: 'Customer',
    provider: 'facebook',
    is_verified: true,
    has_password: true,
    password_status: 'OAuth Managed',
  };

  // saveCustomer blanks the stored password unless it is passed back in.
  saveCustomer({
    ...customerProfile,
    password: existingCust?.password,
    created_at: existingCust?.created_at,
  });

  Promise.resolve().then(async () => {
    for (const table of ['profiles', 'customers']) {
      const { error: syncErr } = await admin.from(table).upsert(customerProfile, { onConflict: 'id' });
      if (syncErr) console.warn(`[Facebook sign-in] ${table} sync failed:`, syncErr.message);
    }
  }).catch((err) => console.warn('[Facebook sign-in] profile sync failed:', err.message));

  return res.json({
    success: true,
    message: `Welcome to Rock View Beach Resort, ${targetName}!`,
    user: customerProfile,
    profile: customerProfile,
  });
});

clientAuthRouter.post('/login', handleClientLogin);
clientAuthRouter.post('/google', handleGoogleAuth);
clientAuthRouter.post('/facebook', handleFacebookAuth);

clientAuthRouter.get('/health', (_req, res) => {
  res.json({
    module: 'client-auth',
    status: 'OPERATIONAL',
    service: 'Customer & Guest Authentication Service (Isolated)',
    scope: 'customer-only',
    timestamp: new Date().toISOString(),
  });
});

export default {
  name: 'client-auth',
  version: '1.5.1',
  description: 'Pluggable Customer & Guest Authentication Domain Module',
  mountPath: '/api/client-auth',
  router: clientAuthRouter,
  healthCheck: async () => ({
    status: 'HEALTHY',
    module: 'client-auth',
    scope: 'customer-only',
  }),
};
