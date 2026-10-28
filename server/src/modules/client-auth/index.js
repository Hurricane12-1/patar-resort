/**
 * ============================================================================
 * Rock View Beach Resort · Isolated Modular Framework (IMF)
 * Module: Client & Customer Authentication Service
 * Scope: Strictly Customer & Guest Persona Authentication Only
 * Location: Brgy. Patar, Bolinao, Pangasinan (16.3042° N, 119.7821° E)
 * ============================================================================
 */

import { Router } from 'express';
import { asyncH, ApiError } from '../../middleware/errors.js';
import { admin } from '../../lib/supabase.js';
import { logAuditEvent } from '../../lib/auditLogger.js';
import { checkBruteForceLockout, recordFailedAttempt, recordSuccessfulAttempt } from '../../middleware/bruteForceGuard.js';

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

  // 3. Authenticate customer credentials strictly via Supabase Auth
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

  if (!authData) {
    await recordFailedAttempt(req.ip, userIdent, req);
    if (authErr?.message?.includes('Email not confirmed') || authErr?.code === 'email_not_confirmed') {
      throw new ApiError(400, 'Your email address has not been confirmed yet. Please check your inbox for the confirmation link.');
    }
    const isOAuthUser = targetProfile?.avatar_url && (
      targetProfile.avatar_url.includes('google') ||
      targetProfile.avatar_url.includes('lh3.googleusercontent.com') ||
      targetProfile.avatar_url.includes('facebook')
    );
    if (isOAuthUser) {
      throw new ApiError(400, 'This account was registered with Google / Facebook Sign-In. Please click the Google or Facebook button above, or click "Forgot password?" to set a password.');
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
clientAuthRouter.post('/login', handleClientLogin);

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
