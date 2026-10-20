import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import { api, resetApiSecurityTokens } from '../lib/api.ts';
import { toast } from '../components/Toasts.tsx';

const Ctx = createContext<any>(null);

export function to11Digits(val: string): string {
  if (!val) return '';
  let digits = val.replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length >= 12) {
    digits = '0' + digits.slice(2);
  }
  return digits.slice(0, 11);
}

/**
 * Generates official formatted Employee ID: RCR-000-000-000-XXX
 */
export function generateEmployeeId(seq: number = 1): string {
  const padded = String(seq).padStart(3, '0');
  return `RCR-000-000-000-${padded}`;
}

/**
 * Generates Employee or Guest Email
 * Employee format: [initials][001-1000+].[position]@rockview.ph
 * Example: Julian Nygel Jimenez Deleon (General Manager) -> jjd001.generalmanager@rockview.ph
 */
export function generateAccountEmail(
  firstName: string,
  middleName: string,
  lastName: string,
  seq: number = 1,
  isStaff: boolean = true,
  positionOrProvider: string = 'receptionist'
): string {
  const f = (firstName || '').trim().charAt(0).toLowerCase() || 'x';
  
  // Extract middle initial (supports compound middle names like "Nygel Jimenez" or "J.")
  const mClean = (middleName || '').trim();
  const mParts = mClean.split(/\s+/).filter(Boolean);
  const m = mParts.length > 1
    ? (mParts[mParts.length - 1].charAt(0).toLowerCase() || 'x')
    : (mClean.charAt(0).toLowerCase() || 'x');
    
  const l = (lastName || '').trim().charAt(0).toLowerCase() || 'x';

  if (!isStaff) {
    if (positionOrProvider === 'facebook') return `${f}${m}${l}@facebook.com`;
    return `${f}${m}${l}@gmail.com`;
  }

  const paddedSeq = String(seq).padStart(3, '0');
  const cleanPos = (positionOrProvider || 'staff')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  return `${f}${m}${l}${paddedSeq}.${cleanPos}@rockview.ph`;
}

/**
 * Generates Employee Username following the exact creation mechanism:
 * [initials][001-1000+].[position] (e.g. jjd001.generalmanager)
 */
export function generateUsername(
  firstName: string,
  middleName: string,
  lastName: string,
  seq: number = 1,
  position: string = 'staff'
): string {
  const email = generateAccountEmail(firstName, middleName, lastName, seq, true, position);
  return email.split('@')[0];
}

export function isSystemOwnerEmail(email?: string): boolean {
  if (!email) return false;
  const em = email.toLowerCase().trim();
  return (
    em === 'sheepermichigun@gmail.com' ||
    em === 'juliannygeljdeleon@gmail.com' ||
    em === 'admin@janddbeachhouse.ph' ||
    em === 'admin@rockviewresort.ph' ||
    em === 'admin@rockview.ph' ||
    em.startsWith('jjd') ||
    em.includes('admin') ||
    em.includes('generalmanager') ||
    em.endsWith('@rockviewresort.ph') ||
    em.endsWith('@rockview.ph')
  );
}

export function AuthProvider({ children }) {
  // ─────────────────────────────────────────────────────────────
  // 1. CUSTOMER SCOPE (Public Website View, Guest Stays & Bookings)
  // ─────────────────────────────────────────────────────────────
  const [customerSession, setCustomerSession] = useState<any>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('jd_customer_session');
        localStorage.removeItem('jd_session');
      }
      const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_customer_session') : null;
      if (saved) {
        return JSON.parse(saved);
      }
      return null;
    } catch { return null; }
  });

  const [customerProfile, setCustomerProfile] = useState<any>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('jd_customer_profile');
        localStorage.removeItem('jd_profile');
      }
      const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_customer_profile') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.role = 'customer';
        return parsed;
      }
      return null;
    } catch { return null; }
  });

  // ─────────────────────────────────────────────────────────────
  // 2. ADMINISTRATOR & STAFF SCOPE (Executive Control & Portals)
  // ─────────────────────────────────────────────────────────────
  const [adminSession, setAdminSession] = useState<any>(() => {
    try {
      const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_session') : null;
      if (saved) {
        return JSON.parse(saved);
      }
      return null;
    } catch { return null; }
  });

  const [adminProfile, setAdminProfile] = useState<any>(() => {
    try {
      const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_profile') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (isSystemOwnerEmail(parsed?.email)) {
          parsed.role = 'administrator';
        }
        return parsed;
      }
      return null;
    } catch { return null; }
  });

  const [authOpen, setAuthOpen] = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

  // Synchronize Customer Session & Profile with sessionStorage
  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      if (customerSession) {
        sessionStorage.setItem('jd_customer_session', JSON.stringify(customerSession));
        if (customerSession.access_token) {
          sessionStorage.setItem('jd_customer_jwt', customerSession.access_token);
        }
      } else {
        sessionStorage.removeItem('jd_customer_session');
        sessionStorage.removeItem('jd_customer_jwt');
      }
    }
  }, [customerSession]);

  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      if (customerProfile) {
        sessionStorage.setItem('jd_customer_profile', JSON.stringify(customerProfile));
      } else {
        sessionStorage.removeItem('jd_customer_profile');
      }
    }
  }, [customerProfile]);

  // Synchronize Admin Session & Profile with sessionStorage
  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      if (adminSession) {
        sessionStorage.setItem('jd_admin_session', JSON.stringify(adminSession));
        if (adminSession.access_token) {
          sessionStorage.setItem('jd_admin_jwt', adminSession.access_token);
        }
        sessionStorage.setItem('jd_admin_token_key', 'etc-34');
      } else {
        sessionStorage.removeItem('jd_admin_session');
        sessionStorage.removeItem('jd_admin_jwt');
        sessionStorage.removeItem('jd_admin_token_key');
      }
    }
  }, [adminSession]);

  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      if (adminProfile) {
        sessionStorage.setItem('jd_admin_profile', JSON.stringify(adminProfile));
      } else {
        sessionStorage.removeItem('jd_admin_profile');
      }
    }
  }, [adminProfile]);

  // Clean any old localStorage legacy keys immediately
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      ['jd_session', 'jd_profile', 'alon_session', 'alon_profile', 'jd_admin_token_key'].forEach((k) => {
        localStorage.removeItem(k);
      });
    }
  }, []);

  // Supabase Auth listener (for OAuth callbacks like Google/Facebook)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!s) return;
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        try {
          let prof: any = null;
          try {
            const { data: dbProf } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
            prof = dbProf;
          } catch {}

          const meta = s.user.user_metadata || {};
          const fallbackRole = prof?.role || meta.role || 'customer';
          const finalProfile = prof || {
            id: s.user.id,
            email: s.user.email,
            full_name: meta.full_name || meta.name || (s.user.email ? s.user.email.split('@')[0] : 'Guest'),
            first_name: meta.first_name || '',
            last_name: meta.last_name || '',
            role: fallbackRole,
            avatar_url: meta.avatar_url || meta.picture || '',
          };

          if (['administrator', 'admin', 'staff', 'receptionist', 'accounting'].includes(fallbackRole) && window.location.pathname.startsWith('/admin')) {
            setAdminSession(s);
            setAdminProfile({ ...finalProfile, role: fallbackRole });
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem('jd_admin_session', JSON.stringify(s));
              sessionStorage.setItem('jd_admin_jwt', s.access_token);
              sessionStorage.setItem('jd_admin_profile', JSON.stringify(finalProfile));
            }
          } else {
            // Customer public website login
            setCustomerSession(s);
            setCustomerProfile({ ...finalProfile, role: 'customer' });
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem('jd_customer_session', JSON.stringify(s));
              sessionStorage.setItem('jd_customer_jwt', s.access_token);
              sessionStorage.setItem('jd_customer_profile', JSON.stringify(finalProfile));
            }
          }
          setAuthOpen(false);
          if (event === 'SIGNED_IN') {
            toast(`Welcome, ${finalProfile.full_name || 'Guest'}! You are signed in.`);
          }
        } catch {
          setCustomerSession(s);
        }
      }
    });
    return () => data?.subscription?.unsubscribe();
  }, []);

  // Live Database Profile Retrieval & Synchronization
  const refreshProfile = useCallback(async () => {
    try {
      const hasAdminJwt = typeof sessionStorage !== 'undefined' && Boolean(sessionStorage.getItem('jd_admin_jwt'));
      const hasCustomerJwt = typeof sessionStorage !== 'undefined' && Boolean(sessionStorage.getItem('jd_customer_jwt'));
      const onAdminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

      if (adminSession || customerSession || hasAdminJwt || hasCustomerJwt) {
        try {
          const freshMe = await api.me();
          if (freshMe && freshMe.id) {
            const role = freshMe.role || 'customer';
            const isAdminRole = ['administrator', 'admin', 'staff', 'receptionist', 'accounting'].includes(role) || isSystemOwnerEmail(freshMe.email);

            if ((hasAdminJwt || onAdminPath || adminSession) && isAdminRole) {
              setAdminProfile((prev: any) => ({
                ...(prev || {}),
                ...freshMe,
                role: isSystemOwnerEmail(freshMe.email) ? 'administrator' : role,
              }));
              return freshMe;
            } else if (hasCustomerJwt || customerSession || !onAdminPath) {
              setCustomerProfile((prev: any) => ({
                ...(prev || {}),
                ...freshMe,
                role: 'customer',
              }));
              return freshMe;
            }
          }
        } catch {
          // Fallback directly to Supabase table
          const targetId = (onAdminPath ? adminSession?.user?.id : customerSession?.user?.id) || adminSession?.user?.id;
          if (targetId) {
            const { data: sbProf } = await supabase.from('profiles').select('*').eq('id', targetId).maybeSingle();
            if (sbProf) {
              if (onAdminPath || adminSession) {
                setAdminProfile((prev: any) => ({ ...(prev || {}), ...sbProf }));
              } else {
                setCustomerProfile((prev: any) => ({ ...(prev || {}), ...sbProf, role: 'customer' }));
              }
              return sbProf;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[AuthContext] Profile sync notice:', e);
    }
    return null;
  }, [adminSession, customerSession]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // ─────────────────────────────────────────────────────────────
  // 3. COMPLETE DEEP PURGE SIGN-OUT (Removes ALL User Credentials)
  // ─────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    // 1. Reset all in-memory React states
    setCustomerSession(null);
    setCustomerProfile(null);
    setAdminSession(null);
    setAdminProfile(null);
    setNeedsProfileCompletion(false);

    // 2. Clear entire sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.clear();
      } catch {}
    }

    // 3. Clear all auth & profile data from localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const keysToRemove = [
          'jd_session', 'jd_profile', 'jd_customer_session', 'jd_customer_profile', 'jd_customer_jwt',
          'jd_admin_session', 'jd_admin_profile', 'jd_admin_jwt', 'jd_admin_token_key',
          'alon_session', 'alon_profile', 'sb-access-token', 'sb-refresh-token',
          'customer_profile', 'guest_manifest', 'rockview_booking_draft',
        ];
        keysToRemove.forEach((k) => localStorage.removeItem(k));

        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && (
            key.startsWith('sb-') ||
            key.startsWith('supabase.') ||
            key.startsWith('jd_') ||
            key.startsWith('alon_') ||
            key.includes('token') ||
            key.includes('session') ||
            key.includes('profile')
          )) {
            localStorage.removeItem(key);
          }
        }
      } catch {}
    }

    // 4. Wipe all browser cookies
    if (typeof document !== 'undefined') {
      try {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          if (name) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
          }
        }
      } catch {}
    }

    // 5. Invalidate server-side cookies & write audit event
    try {
      await api.logout();
    } catch {}

    // 6. Sign out from Supabase Auth
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {}

    // 7. Reset in-memory CSRF & security tokens
    resetApiSecurityTokens();

    toast('✦ Successfully signed out. All sessions, keys, and credentials have been purged.');
  }, []);

  const signOutScope = useCallback(async (scope: 'customer' | 'admin') => {
    if (scope === 'customer') {
      setCustomerSession(null);
      setCustomerProfile(null);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('jd_customer_session');
        sessionStorage.removeItem('jd_customer_profile');
        sessionStorage.removeItem('jd_customer_jwt');
      }
      toast('✦ Customer session terminated.');
    } else {
      setAdminSession(null);
      setAdminProfile(null);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('jd_admin_session');
        sessionStorage.removeItem('jd_admin_profile');
        sessionStorage.removeItem('jd_admin_jwt');
        sessionStorage.removeItem('jd_admin_token_key');
      }
      toast('✦ Administrator session terminated.');
    }
  }, []);

  // 40-Minute Inactivity Auto-Logout Effect
  useEffect(() => {
    if (!customerSession && !adminSession) return;
    const INACTIVITY_LIMIT_MS = 40 * 60 * 1000;
    let timeoutId: any;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        signOut();
        toast('Session expired after 40 minutes of inactivity.', true);
      }, INACTIVITY_LIMIT_MS);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [customerSession, adminSession, signOut]);

  // ─────────────────────────────────────────────────────────────
  // 4. CUSTOMER AUTHENTICATION (Customer / Client Scope Only)
  // ─────────────────────────────────────────────────────────────
  const customerSignIn = async (emailOrUsername: string, password: string) => {
    try {
      const cleanIdent = (emailOrUsername || '').trim();

      // 1. Direct Supabase Auth
      if (cleanIdent.includes('@')) {
        const res = await supabase.auth.signInWithPassword({ email: cleanIdent, password });
        if (!res.error && res.data?.session) {
          const s = res.data.session;
          setCustomerSession(s);

          let sbProfile = null;
          try {
            const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
            sbProfile = data;
          } catch {}

          const custUser = {
            ...sbProfile,
            id: s.user.id,
            email: s.user.email || cleanIdent,
            role: 'customer',
            has_password: true,
            password_status: 'Configured',
          };
          setCustomerProfile(custUser);
          setNeedsProfileCompletion(false);
          return res;
        }
      }

      // 2. Server Auth endpoint /auth/login
      try {
        const serverAuth = await api.login({
          email: cleanIdent.includes('@') ? cleanIdent : undefined,
          username: !cleanIdent.includes('@') ? cleanIdent : undefined,
          identifier: cleanIdent,
          password,
        });

        if (serverAuth?.session) {
          setCustomerSession(serverAuth.session);
          const userObj = {
            ...(serverAuth.user || serverAuth.profile),
            role: 'customer',
          };
          setCustomerProfile(userObj);
          setNeedsProfileCompletion(false);
          return { data: serverAuth, error: null };
        }
      } catch (serverErr) {
        return { data: null, error: serverErr };
      }

      return { data: null, error: new Error('Customer sign-in failed. Please verify your credentials.') };
    } catch (err) {
      return { data: null, error: err };
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 5. ADMINISTRATOR AUTHENTICATION (Admin Scope Only)
  // ─────────────────────────────────────────────────────────────
  const adminSignIn = async (emailOrUsername: string, password: string, tokenIdKey?: string) => {
    try {
      const cleanIdent = (emailOrUsername || '').trim();
      const key = tokenIdKey || 'etc-34';

      // 1. Executive Admin Login route
      try {
        const adminAuthRes = await api.adminLogin({
          identifier: cleanIdent,
          password,
          tokenIdKey: key,
          position: 'administrator',
        });

        if (adminAuthRes?.session) {
          const userObj = {
            ...(adminAuthRes.user || adminAuthRes.profile),
            role: 'administrator',
          };
          setAdminSession(adminAuthRes.session);
          setAdminProfile(userObj);
          return { data: adminAuthRes, error: null };
        }
      } catch (adminApiErr: any) {
        // Fallback 1: direct Supabase authentication with strict role check
        if (cleanIdent.includes('@')) {
          try {
            const sbRes = await supabase.auth.signInWithPassword({ email: cleanIdent, password });
            if (!sbRes.error && sbRes.data?.session) {
              let prof: any = null;
              try {
                const { data: p } = await supabase.from('profiles').select('*').eq('id', sbRes.data.session.user.id).maybeSingle();
                prof = p;
              } catch {}

              const role = prof?.role || sbRes.data.session.user.user_metadata?.role || 'administrator';
              if (!['administrator', 'admin', 'staff', 'receptionist', 'accounting'].includes(role) && !isSystemOwnerEmail(prof?.email || cleanIdent)) {
                await supabase.auth.signOut().catch(() => {});
                throw new Error('Access denied: Account is not authorized for executive administrator portal.');
              }

              const adminObj = {
                ...(prof || {}),
                id: sbRes.data.session.user.id,
                role: 'administrator',
                email: sbRes.data.session.user.email || cleanIdent,
                has_password: true,
                password_status: 'Configured',
              };
              setAdminSession(sbRes.data.session);
              setAdminProfile(adminObj);
              if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('jd_admin_session', JSON.stringify(sbRes.data.session));
                sessionStorage.setItem('jd_admin_jwt', sbRes.data.session.access_token);
                sessionStorage.setItem('jd_admin_profile', JSON.stringify(adminObj));
              }
              return { data: { session: sbRes.data.session, profile: adminObj }, error: null };
            }
          } catch {}
        }

        // Fallback 2: Direct verified lookup in employee_accounts
        try {
          const empEmail = cleanIdent.includes('@') ? cleanIdent : `${cleanIdent}@rockview.ph`;
          const empFilters = [
            `email.ilike.${cleanIdent}`,
            `email.ilike.${empEmail}`,
            `employee_id.ilike.${cleanIdent}`,
          ];
          const { data: emp, error: empErr } = await supabase
            .from('employee_accounts')
            .select('*')
            .or(empFilters.join(','))
            .eq('password', password)
            .eq('is_active', true)
            .maybeSingle();

          if (emp && (['administrator', 'admin', 'staff', 'receptionist', 'accounting'].includes(emp.role) || isSystemOwnerEmail(emp.email))) {
            const adminObj = {
              id: emp.auth_user_id || emp.id,
              email: emp.email,
              full_name: emp.full_name,
              role: emp.role || 'administrator',
              position: emp.position || 'General Manager',
              department: emp.department || 'FrontDesk',
              employee_id: emp.employee_id,
              has_password: true,
              password_status: 'Configured',
            };
            const syntheticSession = {
              access_token: 'emp_session_' + emp.id,
              token_type: 'bearer',
              user: {
                id: emp.auth_user_id || emp.id,
                email: emp.email,
                user_metadata: { role: emp.role, full_name: emp.full_name, employee_id: emp.employee_id },
              },
            };
            setAdminSession(syntheticSession);
            setAdminProfile(adminObj);
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem('jd_admin_session', JSON.stringify(syntheticSession));
              sessionStorage.setItem('jd_admin_jwt', syntheticSession.access_token);
              sessionStorage.setItem('jd_admin_profile', JSON.stringify(adminObj));
            }
            return { data: { session: syntheticSession, profile: adminObj }, error: null };
          }
        } catch {}

        const errMessage = adminApiErr?.message && adminApiErr.message !== '{}' && adminApiErr.message !== '[object Object]'
          ? adminApiErr.message
          : 'Invalid administrator credentials. Access restricted.';
        return { data: null, error: new Error(errMessage) };
      }

      return { data: null, error: new Error('Administrator authentication failed.') };
    } catch (err: any) {
      return { data: null, error: err };
    }
  };

  const switchActiveRole = (roleKey: string) => {
    if (adminProfile && ['administrator', 'staff', 'receptionist', 'accounting'].includes(adminProfile.role)) {
      const updated = { ...adminProfile, activeViewRole: roleKey };
      setAdminProfile(updated);
      toast(`Switched portal view to ${roleKey.toUpperCase()} ✦`);
    } else {
      toast(`Sign in with administrative credentials to access staff views.`, true);
    }
  };

  const updateProfile = async (fields: any) => {
    const isAdmin = (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) || Boolean(adminProfile);
    const currentProf = isAdmin ? (adminProfile || customerProfile) : (customerProfile || adminProfile);
    const first = fields.first_name !== undefined ? fields.first_name : (currentProf?.first_name || '');
    const middle = fields.middle_name !== undefined ? fields.middle_name : (currentProf?.middle_name || '');
    const last = fields.last_name !== undefined ? fields.last_name : (currentProf?.last_name || '');
    const full_name = fields.full_name || [first, middle, last].filter(Boolean).join(' ') || currentProf?.full_name || '';
    const updatedFields = { ...fields, full_name };

    const updated = await api.updateMe(updatedFields);
    if (isAdmin || adminProfile) {
      setAdminProfile((prev: any) => ({ ...prev, ...updated }));
    }
    if (!isAdmin && customerProfile) {
      setCustomerProfile((prev: any) => ({ ...prev, ...updated, role: 'customer' }));
    }
    return updated;
  };

  const updatePassword = async (password: string) => {
    const res = await api.updatePassword(password);
    if (customerProfile) {
      setCustomerProfile((prev: any) => prev ? { ...prev, has_password: true, password_status: 'Configured' } : prev);
    }
    if (adminProfile) {
      setAdminProfile((prev: any) => prev ? { ...prev, has_password: true, password_status: 'Configured' } : prev);
    }
    return res;
  };

  const deleteAccount = async () => {
    await api.deleteMe();
    await signOut();
    toast('Your account has been permanently deleted ✦');
  };

  const value = {
    // Customer Scope (Default for public website view: Navbar, Home, Rooms, MyBookings, BookingFlow)
    session: customerSession,
    profile: customerProfile,
    customerSession,
    customerProfile,
    isCustomerAuthenticated: Boolean(customerSession && customerProfile),
    customerSignIn,
    signOutCustomer: () => signOutScope('customer'),

    // Administrator & Staff Scope (For administrative & staff portals: Admin, Receptionist, Accounting, Department)
    adminSession,
    adminProfile,
    isAdminAuthenticated: Boolean(adminSession && adminProfile && ['administrator', 'admin'].includes(adminProfile.role)),
    isStaffAuthenticated: Boolean(adminSession && adminProfile && ['administrator', 'admin', 'receptionist', 'accounting', 'staff'].includes(adminProfile.role)),
    adminSignIn,
    signOutAdmin: () => signOutScope('admin'),

    // Universal / Backward-compatible methods
    signIn: customerSignIn,
    signOut,
    signOutAll: signOut,
    deleteAccount: async () => {
      await api.deleteMe();
      await signOut();
      toast('Your account has been permanently deleted ✦');
    },
    updateProfile,
    updatePassword,
    refreshProfile,
    switchActiveRole,
    authOpen,
    setAuthOpen,
    needsProfileCompletion,
    setNeedsProfileCompletion,
    signUp: (email: string, password: string, meta: any) => supabase.auth.signUp({ email, password, options: { data: meta } }),
    signInWithGoogle: async () => {
      const redirectUrl = `${window.location.origin}/`;
      const res = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    signInWithFacebook: async () => {
      const redirectUrl = `${window.location.origin}/`;
      const res = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (res.error) throw res.error;
      return res.data;
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
