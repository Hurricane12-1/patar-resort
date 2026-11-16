import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import { api, resetApiSecurityTokens } from '../lib/api.ts';
import { toast } from '../components/Toasts.tsx';

const Ctx = createContext<any>(null);

export function to11Digits(val: string): string {
  if (!val) return '';
  let digits = String(val).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('63') && digits.length >= 3) {
    digits = '0' + digits.slice(2);
  } else if (digits.startsWith('9')) {
    digits = '0' + digits;
  }
  return digits.slice(0, 11);
}

export function isValidPHMobile(val: string): boolean {
  if (!val) return false;
  const digits = String(val).replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length === 12) {
    return /^639\d{9}$/.test(digits);
  }
  return /^09\d{9}$/.test(digits);
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

export function isSystemOwnerEmail(_email?: string): boolean {
  return false;
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
        return JSON.parse(saved);
      }
      return null;
    } catch { return null; }
  });

  // ────────────────────────────────────────────────────────────
  // 3. STAFF SCOPE (Operational Desks: Receptionist, Housekeeping, Accounting, Operations)
  // ────────────────────────────────────────────────────────────
  const [staffSession, setStaffSession] = useState<any>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('jd_staff_session');
      }
      const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_staff_session') : null;
      if (saved) {
        return JSON.parse(saved);
      }
      return null;
    } catch { return null; }
  });

  const [staffProfile, setStaffProfile] = useState<any>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('jd_staff_profile');
      }
      const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_staff_profile') : null;
      if (saved) {
        return JSON.parse(saved);
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
        const storedRole = String(adminProfile?.role || adminSession?.user?.user_metadata?.role || '').toLowerCase();
        if (storedRole === 'administrator' || storedRole === 'admin') {
          if (!sessionStorage.getItem('jd_admin_token_key')) {
            sessionStorage.setItem('jd_admin_token_key', 'etc-34');
          }
        } else {
          sessionStorage.removeItem('jd_admin_token_key');
        }
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

  // Synchronize Staff Session & Profile with sessionStorage
  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      if (staffSession) {
        sessionStorage.setItem('jd_staff_session', JSON.stringify(staffSession));
        if (staffSession.access_token) {
          sessionStorage.setItem('jd_staff_jwt', staffSession.access_token);
        }
      } else {
        sessionStorage.removeItem('jd_staff_session');
        sessionStorage.removeItem('jd_staff_jwt');
      }
    }
  }, [staffSession]);

  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      if (staffProfile) {
        sessionStorage.setItem('jd_staff_profile', JSON.stringify(staffProfile));
      } else {
        sessionStorage.removeItem('jd_staff_profile');
      }
    }
  }, [staffProfile]);

  // Clean any old localStorage legacy keys immediately
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      ['jd_session', 'jd_profile', 'alon_session', 'alon_profile', 'jd_admin_token_key'].forEach((k) => {
        localStorage.removeItem(k);
      });
    }
  }, []);

  // Google OAuth URL Hash Listener (implicit grant access_token)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      if (accessToken) {
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then((r) => r.json())
          .then(async (userinfo) => {
            if (userinfo?.email) {
              const res: any = await api.googleLogin({
                email: userinfo.email,
                name: userinfo.name || userinfo.email.split('@')[0],
                first_name: userinfo.given_name || '',
                last_name: userinfo.family_name || '',
                picture: userinfo.picture || '',
                sub: userinfo.sub || '',
              });
              if (res?.session) {
                setCustomerSession(res.session);
                const prof = res.profile || res.user;
                setCustomerProfile(prof);
                if (typeof sessionStorage !== 'undefined') {
                  sessionStorage.setItem('jd_customer_session', JSON.stringify(res.session));
                  sessionStorage.setItem('jd_customer_jwt', res.session.access_token);
                  sessionStorage.setItem('jd_customer_profile', JSON.stringify(prof));
                }
                window.history.replaceState(null, '', window.location.pathname);
                toast(`Welcome to Rock View Beach Resort, ${prof.full_name || userinfo.name}! ✦`);
              }
            }
          })
          .catch((err) => {
            console.warn('[Google OAuth Token Parse Notice]:', err);
          });
      }
    }
  }, []);

  // Supabase Auth listener (for OAuth callbacks like Google/Facebook)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!s) return;
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        try {
          const pathname = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
          const onAdminPath = pathname.startsWith('/admin');
          const onStaffPath = pathname.startsWith('/staff') || pathname.startsWith('/recovery') || pathname.startsWith('/receptionist') || pathname.startsWith('/accounting') || pathname.startsWith('/resort-department');

          // STRICT SCOPE ISOLATION:
          // A customer/guest OAuth session MUST NEVER pop up toasts or run inside Admin or Staff portals!
          if (onAdminPath || onStaffPath) {
            return;
          }

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

          // Customer public website login
          setCustomerSession(s);
          setCustomerProfile({ ...finalProfile, role: 'customer' });
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('jd_customer_session', JSON.stringify(s));
            sessionStorage.setItem('jd_customer_jwt', s.access_token);
            sessionStorage.setItem('jd_customer_profile', JSON.stringify(finalProfile));
          }

          // Automatically synchronize new Google / Facebook / OAuth customer with Supabase database
          if (!prof && s.user?.id) {
            supabase.from('profiles').upsert({
              id: s.user.id,
              email: s.user.email,
              full_name: finalProfile.full_name,
              first_name: finalProfile.first_name,
              last_name: finalProfile.last_name,
              avatar_url: finalProfile.avatar_url,
              role: 'customer',
            }, { onConflict: 'id' }).then(() => {}).catch(() => {});

            supabase.from('customers').upsert({
              id: s.user.id,
              email: s.user.email,
              full_name: finalProfile.full_name,
            }, { onConflict: 'id' }).then(() => {}).catch(() => {});
          }

          setAuthOpen(false);
          // Only show welcome toast on explicit sign in from client portal, once per session
          const greetedKey = 'jd_customer_greeted_' + s.user.id;
          if (event === 'SIGNED_IN' && typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(greetedKey)) {
            sessionStorage.setItem(greetedKey, '1');
            toast(`Welcome, ${finalProfile.full_name || 'Guest'}! You are signed in.`);
          }
        } catch {
          setCustomerSession(s);
        }
      }
    });
    return () => data?.subscription?.unsubscribe();
  }, []);

  // Live Database Profile Retrieval & Synchronization across the 3 Scopes
  const refreshProfile = useCallback(async () => {
    try {
      const pathname = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
      const onAdminPath = pathname.startsWith('/admin');
      const onStaffPath = pathname.startsWith('/staff') || pathname.startsWith('/recovery') || pathname.startsWith('/receptionist') || pathname.startsWith('/accounting') || pathname.startsWith('/resort-department');

      if (onAdminPath) {
        if (adminSession || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('jd_admin_jwt'))) {
          try {
            const freshMe = await api.me();
            if (freshMe && freshMe.id && ['administrator', 'admin'].includes(freshMe.role)) {
              setAdminProfile((prev: any) => ({ ...(prev || {}), ...freshMe, role: freshMe.role }));
              return freshMe;
            }
          } catch {}
        }
      } else if (onStaffPath) {
        if (staffSession || adminSession || (typeof sessionStorage !== 'undefined' && (sessionStorage.getItem('jd_staff_jwt') || sessionStorage.getItem('jd_admin_jwt')))) {
          try {
            const freshMe = await api.me();
            if (freshMe && freshMe.id && freshMe.role !== 'customer') {
              setStaffProfile((prev: any) => ({ ...(prev || {}), ...freshMe }));
              return freshMe;
            }
          } catch {}
        }
      } else {
        // Client / Public Scope
        if (customerSession || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('jd_customer_jwt'))) {
          try {
            const freshMe = await api.me();
            if (freshMe && freshMe.id) {
              setCustomerProfile((prev: any) => ({ ...(prev || {}), ...freshMe, role: 'customer' }));
              return freshMe;
            }
          } catch {}
        }
      }
    } catch (e) {
      console.warn('[AuthContext] Profile sync notice:', e);
    }
    return null;
  }, [adminSession, staffSession, customerSession]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // ─────────────────────────────────────────────────────────────
  // 3. COMPLETE DEEP PURGE SIGN-OUT (Removes ALL User Credentials)
  // ─────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    // 1. Reset all in-memory React states across all 3 scopes
    setCustomerSession(null);
    setCustomerProfile(null);
    setAdminSession(null);
    setAdminProfile(null);
    setStaffSession(null);
    setStaffProfile(null);
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
          'jd_staff_session', 'jd_staff_profile', 'jd_staff_jwt',
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

  const signOutStaff = useCallback(async () => {
    setStaffSession(null);
    setStaffProfile(null);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('jd_staff_session');
      sessionStorage.removeItem('jd_staff_profile');
      sessionStorage.removeItem('jd_staff_jwt');
    }
    toast('✦ Staff station session terminated.');
  }, []);

  const signOutScope = useCallback(async (scope: 'customer' | 'admin' | 'staff') => {
    if (scope === 'customer') {
      setCustomerSession(null);
      setCustomerProfile(null);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('jd_customer_session');
        sessionStorage.removeItem('jd_customer_profile');
        sessionStorage.removeItem('jd_customer_jwt');
      }
      toast('✦ Customer session terminated.');
    } else if (scope === 'admin') {
      setAdminSession(null);
      setAdminProfile(null);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('jd_admin_session');
        sessionStorage.removeItem('jd_admin_profile');
        sessionStorage.removeItem('jd_admin_jwt');
        sessionStorage.removeItem('jd_admin_token_key');
      }
      toast('✦ Administrator session terminated.');
    } else if (scope === 'staff') {
      signOutStaff();
    }
  }, [signOutStaff]);

  // 40-Minute Inactivity Auto-Logout Effect
  useEffect(() => {
    if (!customerSession && !adminSession && !staffSession) return;
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
  }, [customerSession, adminSession, staffSession, signOut]);

  // ─────────────────────────────────────────────────────────────
  // 4. CUSTOMER AUTHENTICATION (Customer / Client Scope Only)
  // ─────────────────────────────────────────────────────────────
  const customerSignIn = async (emailOrUsername: string, password: string) => {
    try {
      const cleanIdent = (emailOrUsername || '').trim();
      let targetEmail = cleanIdent;

      // If user provided a username without @, resolve to email via profiles table
      if (!cleanIdent.includes('@')) {
        try {
          const { data: matched } = await supabase
            .from('profiles')
            .select('email')
            .or(`email.ilike.${cleanIdent}@%,full_name.ilike.${cleanIdent}`)
            .maybeSingle();
          if (matched?.email) {
            targetEmail = matched.email;
          }
        } catch {}
      }

      // 1. Direct Supabase Auth
      if (targetEmail.includes('@')) {
        const res = await supabase.auth.signInWithPassword({ email: targetEmail, password });
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
            email: s.user.email || targetEmail,
            role: 'customer',
            has_password: true,
            password_status: 'Configured',
          };
          setCustomerProfile(custUser);
          setNeedsProfileCompletion(false);
          return res;
        }
        // Supabase sign in did not produce a session; proceed to resilient server auth below
      }

      // 2. Server Auth endpoint /auth/login
      try {
        const serverAuth = await api.login({
          email: targetEmail.includes('@') ? targetEmail : undefined,
          username: !targetEmail.includes('@') ? cleanIdent : undefined,
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
      } catch (serverErr: any) {
        return { data: null, error: serverErr };
      }

      return { data: null, error: new Error('Invalid email or password. Please verify your credentials.') };
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
      const key = (tokenIdKey || '').trim();

      // 1. Executive Admin Login route
      try {
        const adminAuthRes = await api.adminLogin({
          identifier: cleanIdent,
          password,
          tokenIdKey: key,
          position: '',
        });

        if (adminAuthRes?.session) {
          const userObj = adminAuthRes.user || adminAuthRes.profile;
          const role = String(userObj?.role || 'staff').toLowerCase();
          if (!['administrator', 'admin'].includes(role)) {
            throw new Error('Access denied: Operational staff accounts must sign in at the Station Portal (/staff/login).');
          }
          const adminObj = {
            ...userObj,
            role: role === 'admin' ? 'administrator' : role,
          };
          setAdminSession(adminAuthRes.session);
          setAdminProfile(adminObj);
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('jd_admin_session', JSON.stringify(adminAuthRes.session));
            if (adminAuthRes.session.access_token) {
              sessionStorage.setItem('jd_admin_jwt', adminAuthRes.session.access_token);
            }
            sessionStorage.setItem('jd_admin_profile', JSON.stringify(adminObj));
            sessionStorage.setItem('jd_admin_token_key', key || adminAuthRes.tokenIdKey || 'etc-34');
          }
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

              const role = prof?.role || sbRes.data.session.user.user_metadata?.role || 'customer';
              if (!['administrator', 'admin'].includes(role)) {
                await supabase.auth.signOut().catch(() => {});
                throw new Error('Access denied: Only administrators are authorized for the Executive Hub. Staff must use /staff/login.');
              }

              const adminObj = {
                ...(prof || {}),
                id: sbRes.data.session.user.id,
                role: role === 'admin' ? 'administrator' : role,
                department: prof?.department || sbRes.data.session.user.user_metadata?.department,
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

          if (emp && ['administrator', 'admin'].includes(emp.role)) {
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

  // ────────────────────────────────────────────────────────────
  // 6. STAFF AUTHENTICATION (Operational Stations Scope: /staff)
  // ────────────────────────────────────────────────────────────
  const staffSignIn = async (emailOrUsername: string, password: string) => {
    try {
      const cleanIdent = (emailOrUsername || '').trim();
      const rawPass = (password || '').trim();

      // 1. Employee Station Login route /auth/admin-login
      try {
        const staffRes = await api.adminLogin({
          identifier: cleanIdent,
          password: rawPass,
          position: '',
        });

        if (staffRes?.session) {
          const userObj = staffRes.user || staffRes.profile;
          const role = String(userObj?.role || 'staff').toLowerCase();
          if (role === 'customer') {
            throw new Error('Access denied: Guest customer accounts cannot access the operational staff station.');
          }

          setStaffSession(staffRes.session);
          setStaffProfile(userObj);
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('jd_staff_session', JSON.stringify(staffRes.session));
            if (staffRes.session.access_token) {
              sessionStorage.setItem('jd_staff_jwt', staffRes.session.access_token);
            }
            sessionStorage.setItem('jd_staff_profile', JSON.stringify(userObj));
          }
          return { data: staffRes, error: null };
        }
      } catch (staffApiErr: any) {
        // Fallback: direct employee_accounts verified query
        try {
          const empEmail = cleanIdent.includes('@') ? cleanIdent : `${cleanIdent}@rockview.ph`;
          const empFilters = [
            `email.ilike.${cleanIdent}`,
            `email.ilike.${empEmail}`,
            `employee_id.ilike.${cleanIdent}`,
          ];
          const { data: emp } = await supabase
            .from('employee_accounts')
            .select('*')
            .or(empFilters.join(','))
            .eq('password', rawPass)
            .eq('is_active', true)
            .maybeSingle();

          if (emp && emp.role !== 'customer') {
            const staffObj = {
              id: emp.auth_user_id || emp.id,
              email: emp.email,
              full_name: emp.full_name,
              role: emp.role || 'staff',
              position: emp.position || 'Operations Staff',
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
            setStaffSession(syntheticSession);
            setStaffProfile(staffObj);
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem('jd_staff_session', JSON.stringify(syntheticSession));
              sessionStorage.setItem('jd_staff_jwt', syntheticSession.access_token);
              sessionStorage.setItem('jd_staff_profile', JSON.stringify(staffObj));
            }
            return { data: { session: syntheticSession, profile: staffObj }, error: null };
          }
        } catch {}

        const errMessage = staffApiErr?.message && staffApiErr.message !== '{}' && staffApiErr.message !== '[object Object]'
          ? staffApiErr.message
          : 'Invalid employee credentials. Access restricted.';
        return { data: null, error: new Error(errMessage) };
      }

      return { data: null, error: new Error('Staff station authentication failed.') };
    } catch (err: any) {
      return { data: null, error: err };
    }
  };

  const switchActiveRole = (roleKey: string) => {
    if (adminProfile && ['administrator', 'admin', 'staff', 'receptionist', 'accounting', 'housekeeping', 'kitchen', 'tours'].includes(adminProfile.role)) {
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
    // 1. Customer Scope (Default for public website view: Navbar, Home, Rooms, MyBookings, BookingFlow)
    session: customerSession,
    profile: customerProfile,
    customerSession,
    customerProfile,
    isCustomerAuthenticated: Boolean(customerSession && customerProfile),
    customerSignIn,
    signOutCustomer: () => signOutScope('customer'),

    // 2. Administrator Scope (For executive hub portal: /admin)
    adminSession,
    adminProfile,
    isAdminAuthenticated: Boolean(adminSession && adminProfile && ['administrator', 'admin'].includes(adminProfile.role)),
    adminSignIn,
    signOutAdmin: () => signOutScope('admin'),

    // 3. Staff Scope (For operational desks: /staff, /receptionist, /accounting, /resort-department)
    staffSession,
    staffProfile,
    isStaffAuthenticated: Boolean(
      (staffSession && staffProfile && ['staff', 'receptionist', 'accounting', 'housekeeping', 'kitchen', 'tours', 'operations'].includes(staffProfile.role)) ||
      (adminSession && adminProfile && ['administrator', 'admin'].includes(adminProfile.role))
    ),
    staffSignIn,
    signOutStaff: () => signOutScope('staff'),

    // Universal / Backward-compatible methods
    signOutScope,
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
    signUp: async (email: string, password: string, meta: any) => {
      const cleanEmail = (email || '').trim().toLowerCase();
      const rawPhone = meta?.phone ? String(meta.phone).replace(/\D/g, '') : '';
      const cleanPhone = rawPhone.length === 11 && rawPhone.startsWith('09')
        ? rawPhone
        : (rawPhone.startsWith('63') && rawPhone.length === 12 ? '0' + rawPhone.slice(2) : rawPhone);

      // 1. Strict 11-Digit Philippine Mobile Limitation
      if (cleanPhone) {
        if (cleanPhone.length !== 11 || !cleanPhone.startsWith('09')) {
          return {
            data: null,
            error: new Error('Mobile number must strictly be an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567).'),
          };
        }
      }

      // 2. Anti-Duplication Security Check: Email
      try {
        const { data: dupCustEmail } = await supabase
          .from('customers')
          .select('id, email')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (dupCustEmail) {
          return {
            data: null,
            error: new Error(`An account with the email "${cleanEmail}" is already registered. Please sign in or use forgot password.`),
          };
        }

        const { data: dupProfEmail } = await supabase
          .from('profiles')
          .select('id, email')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (dupProfEmail) {
          return {
            data: null,
            error: new Error(`An account with the email "${cleanEmail}" is already registered. Please sign in or use forgot password.`),
          };
        }
      } catch {}

      // 3. Anti-Duplication Security Check: Phone Number
      if (cleanPhone) {
        try {
          const { data: dupCustPhone } = await supabase
            .from('customers')
            .select('id, phone')
            .eq('phone', cleanPhone)
            .maybeSingle();

          if (dupCustPhone) {
            return {
              data: null,
              error: new Error(`Mobile number "${cleanPhone}" is already registered to an existing customer account. Please sign in or use a different phone number.`),
            };
          }

          const { data: dupProfPhone } = await supabase
            .from('profiles')
            .select('id, phone')
            .eq('phone', cleanPhone)
            .maybeSingle();

          if (dupProfPhone) {
            return {
              data: null,
              error: new Error(`Mobile number "${cleanPhone}" is already registered to an existing customer account. Please sign in or use a different phone number.`),
            };
          }
        } catch {}
      }

      // 4. Password Security Standards (min 8 chars, letters and numbers)
      if (!password || password.length < 8) {
        return {
          data: null,
          error: new Error('Password must be at least 8 characters long for account security.'),
        };
      }
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        return {
          data: null,
          error: new Error('Password must contain both letters and numbers for account security.'),
        };
      }

      // Try direct server registration first (instantly confirmed via Admin service role)
      try {
        const regRes = await api.register({
          email: cleanEmail,
          password,
          first_name: meta?.first_name || '',
          last_name: meta?.last_name || '',
          phone: cleanPhone || '',
        });
        if (regRes?.userId && regRes?.session) {
          setCustomerSession(regRes.session);
          const userObj = regRes.user || {
            id: regRes.userId,
            email: cleanEmail,
            role: 'customer',
            full_name: [meta?.first_name, meta?.last_name].filter(Boolean).join(' ') || cleanEmail.split('@')[0],
            first_name: meta?.first_name || '',
            last_name: meta?.last_name || '',
            phone: cleanPhone || '',
          };
          setCustomerProfile(userObj);
          setNeedsProfileCompletion(false);
          return { data: regRes, error: null };
        }
        if (regRes?.userId) {
          return await customerSignIn(cleanEmail, password);
        }
      } catch (regErr: any) {
        console.warn('[Direct Register Fallback]:', regErr?.message);
      }

      const res = await supabase.auth.signUp({ email: cleanEmail, password, options: { data: { ...meta, phone: cleanPhone } } });
      const uId = res.data?.user?.id;
      if (uId) {
        const fn = meta?.full_name || [meta?.first_name, meta?.last_name].filter(Boolean).join(' ') || cleanEmail.split('@')[0];
        try {
          await supabase.from('profiles').upsert({
            id: uId,
            email: cleanEmail,
            full_name: fn,
            first_name: meta?.first_name || '',
            last_name: meta?.last_name || '',
            phone: cleanPhone || '',
            role: 'customer',
          }, { onConflict: 'id' });
        } catch {}

        try {
          await supabase.from('customers').upsert({
            id: uId,
            email: cleanEmail,
            full_name: fn,
            first_name: meta?.first_name || '',
            last_name: meta?.last_name || '',
            phone: cleanPhone || '',
            role: 'customer',
            password,
            provider: 'email',
            is_verified: true,
          }, { onConflict: 'id' });
        } catch {}
      }
      return res;
    },
    signInWithGoogle: async (directPayload?: { email?: string; name?: string; first_name?: string; last_name?: string; picture?: string; credential?: string }) => {
      // 1. Direct payload authentication (from Google Account prompt or One-Tap)
      if (directPayload?.email || directPayload?.credential) {
        const res: any = await api.googleLogin(directPayload);
        if (res?.session) {
          setCustomerSession(res.session);
          const prof = res.profile || res.user || {
            id: res.user?.id || 'google_guest',
            email: directPayload.email,
            full_name: directPayload.name || (directPayload.email ? directPayload.email.split('@')[0] : 'Resident Guest'),
            role: 'customer',
            provider: 'google',
          };
          setCustomerProfile(prof);
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('jd_customer_session', JSON.stringify(res.session));
            sessionStorage.setItem('jd_customer_jwt', res.session.access_token);
            sessionStorage.setItem('jd_customer_profile', JSON.stringify(prof));
          }
          setAuthOpen(false);
          toast(`Welcome to Rock View Beach Resort, ${prof.full_name || 'Resident Guest'}! ✦`);
          return { data: res, error: null };
        }
      }

      // 2. Google Identity Services (GIS) on window
      const googleClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
      if (typeof window !== 'undefined' && (window as any).google?.accounts?.id && googleClientId) {
        try {
          const authResult: any = await new Promise((resolve, reject) => {
            (window as any).google.accounts.id.initialize({
              client_id: googleClientId,
              callback: async (response: any) => {
                try {
                  const res: any = await api.googleLogin({ credential: response.credential });
                  if (res?.session) {
                    setCustomerSession(res.session);
                    const prof = res.profile || res.user;
                    setCustomerProfile(prof);
                    if (typeof sessionStorage !== 'undefined') {
                      sessionStorage.setItem('jd_customer_session', JSON.stringify(res.session));
                      sessionStorage.setItem('jd_customer_jwt', res.session.access_token);
                      sessionStorage.setItem('jd_customer_profile', JSON.stringify(prof));
                    }
                    setAuthOpen(false);
                    toast(`Welcome to Rock View Beach Resort, ${prof.full_name || 'Resident Guest'}! ✦`);
                    resolve({ data: res, error: null });
                  } else {
                    reject(new Error('Google sign-in could not complete.'));
                  }
                } catch (err) {
                  reject(err);
                }
              },
              auto_select: false,
              cancel_on_tap_outside: true,
            });
            (window as any).google.accounts.id.prompt((notification: any) => {
              if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
                resolve({ needsPrompt: true });
              }
            });
          });
          if (authResult?.data) return authResult;
        } catch (gisErr) {
          console.warn('[Google GIS Notice]:', gisErr);
        }
      }

      const redirectUrl = `${window.location.origin}/client`;

      // 1. If Google OAuth 2.0 Web Client ID is configured, redirect to Google OAuth consent & account selection
      if (googleClientId && typeof window !== 'undefined') {
        const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(googleClientId)}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=token&scope=openid%20email%20profile&prompt=select_account`;
        window.location.href = oauthUrl;
        return { redirected: true, url: oauthUrl };
      }

      // 2. Try Supabase OAuth ONLY if responsive, redirect to provider url
      const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://owhodkhzldygavuwnqfg.supabase.co';
      let supabaseReachable = false;
      try {
        const ping = await Promise.race([
          fetch(`${rawUrl}/auth/v1/settings`, { method: 'GET', headers: { apikey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '' } }).catch(() => null),
          new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 800))
        ]).catch(() => null);
        if (ping && (ping as Response).ok) {
          supabaseReachable = true;
        }
      } catch {}

      if (supabaseReachable) {
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
        if (!res.error && res.data?.url && typeof window !== 'undefined') {
          window.location.href = res.data.url;
          return res.data;
        }
      }

      // 3. Guaranteed Direct Redirect to official Gmail / Google Account login authentication page
      if (typeof window !== 'undefined') {
        const googleLoginUrl = 'https://accounts.google.com/ServiceLogin';
        window.location.href = googleLoginUrl;
        return { redirected: true, url: googleLoginUrl };
      }

      return { ok: true };
    },
    signInWithFacebook: async (directPayload?: { email?: string; name?: string; first_name?: string; last_name?: string; picture?: string }) => {
      if (directPayload?.email) {
        const res: any = await api.facebookLogin(directPayload);
        if (res?.session) {
          setCustomerSession(res.session);
          const prof = res.profile || res.user || {
            id: res.user?.id || 'facebook_guest',
            email: directPayload.email,
            full_name: directPayload.name || (directPayload.email ? directPayload.email.split('@')[0] : 'Resident Guest'),
            role: 'customer',
            provider: 'facebook',
          };
          setCustomerProfile(prof);
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('jd_customer_session', JSON.stringify(res.session));
            sessionStorage.setItem('jd_customer_jwt', res.session.access_token);
            sessionStorage.setItem('jd_customer_profile', JSON.stringify(prof));
          }
          setAuthOpen(false);
          toast(`Welcome to Rock View Beach Resort, ${prof.full_name || 'Resident Guest'}! ✦`);
          return { data: res, error: null };
        }
      }
      return { needsPrompt: true };
    },
    sendGmailOtp: async (email: string, name?: string) => {
      const cleanEmail = email.trim().toLowerCase();
      // Try Supabase Auth signInWithOtp first if reachable
      try {
        const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://owhodkhzldygavuwnqfg.supabase.co';
        const ping = await Promise.race([
          fetch(`${rawUrl}/auth/v1/settings`, { headers: { apikey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '' } }).catch(() => null),
          new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 1000))
        ]).catch(() => null);

        if (ping && (ping as Response).ok) {
          const { error: sbErr } = await supabase.auth.signInWithOtp({
            email: cleanEmail,
            options: { shouldCreateUser: true }
          });
          if (!sbErr) {
            return { success: true, provider: 'supabase', message: `6-digit OTP dispatched to ${cleanEmail} via Supabase.` };
          }
        }
      } catch {}

      // Resilient server fallback endpoint
      return await api.sendOtp(cleanEmail, name);
    },
    verifyGmailOtp: async (email: string, code: string, name?: string) => {
      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = code.trim();

      // Try Supabase verifyOtp first if reachable
      try {
        const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://owhodkhzldygavuwnqfg.supabase.co';
        const ping = await Promise.race([
          fetch(`${rawUrl}/auth/v1/settings`, { headers: { apikey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '' } }).catch(() => null),
          new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 1000))
        ]).catch(() => null);

        if (ping && (ping as Response).ok) {
          const { data: sbData, error: sbErr } = await Promise.race([
            supabase.auth.verifyOtp({
              email: cleanEmail,
              token: cleanCode,
              type: 'email'
            }),
            new Promise<any>((_, r) => setTimeout(() => r(new Error('timeout')), 1500))
          ]);
          if (!sbErr && sbData?.session) {
            setCustomerSession(sbData.session);
            const prof = {
              id: sbData.session.user.id,
              email: cleanEmail,
              full_name: name || cleanEmail.split('@')[0],
              role: 'customer',
              provider: 'gmail_otp',
            };
            setCustomerProfile(prof);
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem('jd_customer_session', JSON.stringify(sbData.session));
              sessionStorage.setItem('jd_customer_jwt', sbData.session.access_token);
              sessionStorage.setItem('jd_customer_profile', JSON.stringify(prof));
            }
            setAuthOpen(false);
            toast(`Welcome to Rock View Beach Resort, ${prof.full_name}! ✦`);
            return { data: sbData, error: null };
          }
        }
      } catch {}

      // Resilient server fallback endpoint
      const res: any = await api.verifyOtp(cleanEmail, cleanCode, name);
      if (res?.session) {
        setCustomerSession(res.session);
        const prof = res.profile || res.user || {
          id: res.user?.id || 'otp_guest',
          email: cleanEmail,
          full_name: name || cleanEmail.split('@')[0],
          role: 'customer',
          provider: 'gmail_otp',
        };
        setCustomerProfile(prof);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('jd_customer_session', JSON.stringify(res.session));
          sessionStorage.setItem('jd_customer_jwt', res.session.access_token);
          sessionStorage.setItem('jd_customer_profile', JSON.stringify(prof));
        }
        setAuthOpen(false);
        toast(`Welcome to Rock View Beach Resort, ${prof.full_name || 'Resident Guest'}! ✦`);
        return { data: res, error: null };
      }
      return { data: null, error: new Error('Invalid or expired OTP verification code.') };
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
