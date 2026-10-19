import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import { api } from '../lib/api.ts';
import { toast } from '../components/Toasts.tsx';

const Ctx = createContext(null);

export function to11Digits(val: string): string {
  if (!val) return '';
  let digits = val.replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length >= 12) {
    digits = '0' + digits.slice(2);
  }
  return digits.slice(0, 11);
}

export function generateAccountEmail(firstName, middleName, lastName, seq = 1, isStaff = true, provider = 'gmail') {
  const f = (firstName || '').trim().charAt(0).toLowerCase() || 'x';
  const m = (middleName || '').trim().charAt(0).toLowerCase() || 'x';
  const l = (lastName || '').trim().charAt(0).toLowerCase() || 'x';
  if (!isStaff) {
    if (provider === 'facebook') return `${f}${m}${l}@facebook.com`;
    return `${f}${m}${l}@gmail.com`;
  }
  const paddedSeq = String(seq).padStart(3, '0');
  return `${f}${m}${l}${paddedSeq}@resortmanagement.ph`;
}

export function isSystemOwnerEmail(email?: string): boolean {
  if (!email) return false;
  const em = email.toLowerCase().trim();
  return (
    em === 'sheepermichigun@gmail.com' ||
    em === 'juliannygeljdeleon@gmail.com' ||
    em === 'admin@janddbeachhouse.ph' ||
    em.includes('admin')
  );
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('jd_session');
        localStorage.removeItem('alon_session');
      }
      const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_session') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        // Clear any old mock sessions from previous sessions
        if (parsed?.user?.is_mock) {
          sessionStorage.removeItem('jd_session');
          sessionStorage.removeItem('jd_profile');
          return null;
        }
        return parsed;
      }
      return null;
    } catch { return null; }
  });
  
  const [profile, setProfile] = useState(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('jd_profile');
        localStorage.removeItem('alon_profile');
      }
      const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_profile') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.is_mock || parsed?.id?.startsWith('usr-admin-1234') || parsed?.id?.startsWith('usr-recep-') || parsed?.id?.startsWith('usr-acct-')) {
          sessionStorage.removeItem('jd_profile');
          return null;
        }
        if (isSystemOwnerEmail(parsed?.email)) {
          parsed.role = 'administrator';
          if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem('jd_admin_token_key')) {
            sessionStorage.setItem('jd_admin_token_key', 'etc-34');
          }
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('jd_admin_token_key');
          }
        }
        if (parsed.password_status === undefined) {
          parsed.has_password = Boolean(parsed.has_password || parsed.password);
          parsed.password_status = parsed.has_password ? 'Configured' : 'N/A';
        }
        return parsed;
      }
      return null;
    } catch { return null; }
  });

  const [authOpen, setAuthOpen] = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      if (session) {
        sessionStorage.setItem('jd_session', JSON.stringify(session));
      } else {
        sessionStorage.removeItem('jd_session');
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('jd_session');
      localStorage.removeItem('alon_session');
    }
  }, [session]);

  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      if (profile) {
        sessionStorage.setItem('jd_profile', JSON.stringify(profile));
      } else {
        sessionStorage.removeItem('jd_profile');
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('jd_profile');
      localStorage.removeItem('alon_profile');
    }
  }, [profile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        setSession(data.session);
      }
    }).catch(() => {});

    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) setSession(s);
    });
    return () => data?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && !session.user?.is_mock) {
      const syncProfile = async () => {
        try {
          const p = await api.me();
          if (p) {
            if (isSystemOwnerEmail(p.email || session.user?.email)) {
              p.role = 'administrator';
            }
            if (['administrator', 'admin'].includes(p.role) || isSystemOwnerEmail(p.email || session.user?.email)) {
              if (typeof sessionStorage !== 'undefined') {
                if (!sessionStorage.getItem('jd_admin_token_key')) sessionStorage.setItem('jd_admin_token_key', 'etc-34');
                if (session.access_token) sessionStorage.setItem('jd_admin_jwt', session.access_token);
              }
              if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('jd_admin_token_key');
              }
            }
            const hasPassword = Boolean(p.has_password || (p.password && String(p.password).trim() !== ''));
            p.has_password = hasPassword;
            p.password_status = p.password_status || (hasPassword ? 'Configured' : 'N/A');

            setProfile(p);
            setNeedsProfileCompletion(false);
            return;
          }
        } catch {}

        // Direct Supabase profile fallback if backend API is still starting
        if (session.user?.id) {
          try {
            const { data: sbProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();
            if (sbProfile) {
              let empRecord = null;
              try {
                const { data: emp } = await supabase
                  .from('employee_accounts')
                  .select('id, employee_id, department, position, shift, status, is_active, hire_date')
                  .or(`auth_user_id.eq.${session.user.id},email.eq.${session.user.email || sbProfile.email}`)
                  .maybeSingle();
                empRecord = emp;
              } catch {}

              const hasPassword = Boolean(
                (sbProfile.password && String(sbProfile.password).trim() !== '') ||
                Boolean(sbProfile.has_password)
              );
              const passwordStatus = hasPassword ? 'Configured' : 'N/A';

              const merged = {
                ...sbProfile,
                email: session.user.email || sbProfile.email,
                has_password: hasPassword,
                password_status: passwordStatus,
                ...(empRecord ? {
                  employee_id: empRecord.employee_id,
                  department: empRecord.department,
                  shift: empRecord.shift,
                  employee_status: empRecord.status,
                  employee_record: empRecord,
                } : {}),
              };
              if (isSystemOwnerEmail(merged.email)) {
                merged.role = 'administrator';
              }
              if (['administrator', 'admin'].includes(merged.role) || isSystemOwnerEmail(merged.email)) {
                if (typeof sessionStorage !== 'undefined') {
                  if (!sessionStorage.getItem('jd_admin_token_key')) sessionStorage.setItem('jd_admin_token_key', 'etc-34');
                  if (session.access_token) sessionStorage.setItem('jd_admin_jwt', session.access_token);
                }
                if (typeof localStorage !== 'undefined') {
                  localStorage.removeItem('jd_admin_token_key');
                }
              }
              setProfile(merged);
              setNeedsProfileCompletion(false);
            }
          } catch {}
        }
      };
      syncProfile();
    }
  }, [session]);

  // 40-Minute Inactivity Auto-Logout Effect
  useEffect(() => {
    if (!session) return;
    const INACTIVITY_LIMIT_MS = 40 * 60 * 1000;
    let timeoutId;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setSession(null);
        setProfile(null);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('jd_session');
          sessionStorage.removeItem('jd_profile');
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('jd_session');
          localStorage.removeItem('jd_profile');
          localStorage.removeItem('alon_session');
          localStorage.removeItem('alon_profile');
        }
        supabase.auth.signOut().catch(() => {});
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
  }, [session]);

  const signIn = async (emailOrUsername, password) => {
    try {
      const cleanIdent = (emailOrUsername || '').trim();
      let res = null;

      // 1. If it contains '@', attempt Supabase Auth directly first
      if (cleanIdent.includes('@')) {
        res = await supabase.auth.signInWithPassword({ email: cleanIdent, password });
        if (!res.error && res.data?.session) {
          setSession(res.data.session);
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('jd_session', JSON.stringify(res.data.session));
          }

          // Immediately load profile from Supabase so ProtectedRoute unlocks without delay
          try {
            const { data: sbProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', res.data.session.user.id)
              .maybeSingle();
            if (sbProfile) {
              let empRecord = null;
              try {
                const { data: emp } = await supabase
                  .from('employee_accounts')
                  .select('id, employee_id, department, position, shift, status, is_active, hire_date')
                  .or(`auth_user_id.eq.${res.data.session.user.id},email.eq.${res.data.session.user.email || cleanIdent}`)
                  .maybeSingle();
                empRecord = emp;
              } catch {}

              const userObj = {
                ...sbProfile,
                email: res.data.session.user.email || cleanIdent,
                has_password: true,
                password_status: 'Configured',
                ...(empRecord ? {
                  employee_id: empRecord.employee_id,
                  department: empRecord.department,
                  shift: empRecord.shift,
                  employee_status: empRecord.status,
                  employee_record: empRecord,
                } : {}),
              };
              setProfile(userObj);
              if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('jd_profile', JSON.stringify(userObj));
              }
              if (['administrator', 'admin'].includes(userObj.role)) {
                if (typeof sessionStorage !== 'undefined') {
                  sessionStorage.setItem('jd_admin_token_key', 'etc-34');
                  sessionStorage.setItem('jd_admin_jwt', res.data.session.access_token);
                }
                if (typeof localStorage !== 'undefined') {
                  localStorage.removeItem('jd_admin_token_key');
                }
              }
            }
          } catch {}

          return res;
        }
      }

      // 2. If it's a username (no '@') OR direct Supabase Auth returned an error,
      // authenticate via backend live authentication which resolves username to email
      try {
        const serverAuth = await api.login({
          email: cleanIdent.includes('@') ? cleanIdent : undefined,
          username: !cleanIdent.includes('@') ? cleanIdent : undefined,
          identifier: cleanIdent,
          password,
        });
        if (serverAuth?.session) {
          setSession(serverAuth.session);
          const userObj = serverAuth.user || serverAuth.profile;
          setProfile(userObj);
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('jd_session', JSON.stringify(serverAuth.session));
            sessionStorage.setItem('jd_profile', JSON.stringify(userObj));
          }
          if (['administrator', 'admin'].includes(userObj?.role)) {
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem('jd_admin_token_key', 'etc-34');
              if (serverAuth.session?.access_token) {
                sessionStorage.setItem('jd_admin_jwt', serverAuth.session.access_token);
              }
            }
            if (typeof localStorage !== 'undefined') {
              localStorage.removeItem('jd_admin_token_key');
            }
          }
          return { data: serverAuth, error: null };
        }
      } catch (serverErr) {
        if (res?.error) return { data: null, error: res.error };
        return { data: null, error: serverErr };
      }

      return { data: null, error: res?.error || new Error('Authentication failed. Please verify your username/email and password.') };
    } catch (err) {
      return { data: null, error: err };
    }
  };

  const switchActiveRole = (roleKey) => {
    if (profile && ['administrator', 'staff', 'receptionist', 'accounting'].includes(profile.role)) {
      const updated = { ...profile, activeViewRole: roleKey };
      setProfile(updated);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('jd_profile', JSON.stringify(updated));
      }
      toast(`Switched portal view to ${roleKey.toUpperCase()} ✦`);
    } else {
      toast(`Sign in with administrative credentials to access staff views.`, true);
    }
  };

  const value = {
    session, profile, authOpen, setAuthOpen,
    needsProfileCompletion, setNeedsProfileCompletion,
    signIn,
    switchActiveRole,
    switchMockRole: switchActiveRole,
    signUp: (email, password, meta) => supabase.auth.signUp({ email, password, options: { data: meta } }),
    signInWithGoogle: async () => {
      const res = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    signInWithFacebook: async () => {
      const res = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: { redirectTo: window.location.origin },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    updateProfile: async (fields) => {
      const first = fields.first_name !== undefined ? fields.first_name : (profile?.first_name || '');
      const middle = fields.middle_name !== undefined ? fields.middle_name : (profile?.middle_name || '');
      const last = fields.last_name !== undefined ? fields.last_name : (profile?.last_name || '');
      const full_name = fields.full_name || [first, middle, last].filter(Boolean).join(' ') || profile?.full_name || '';
      const updatedFields = { ...fields, full_name };

      const updated = await api.updateMe(updatedFields);
      setProfile(updated);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('jd_profile', JSON.stringify(updated));
      }
      return updated;
    },
    updatePassword: async (password: string) => {
      const res = await api.updatePassword(password);
      setProfile((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, has_password: true, password_status: 'Configured' };
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('jd_profile', JSON.stringify(updated));
        }
        return updated;
      });
      return res;
    },
    signOut: async () => {
      setSession(null);
      setProfile(null);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('jd_session');
        localStorage.removeItem('jd_profile');
        localStorage.removeItem('alon_session');
        localStorage.removeItem('alon_profile');
        localStorage.removeItem('jd_admin_jwt');
        localStorage.removeItem('jd_admin_token_key');
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('jd_session');
        sessionStorage.removeItem('jd_profile');
        sessionStorage.removeItem('jd_admin_jwt');
        sessionStorage.removeItem('jd_admin_token_key');
      }
      await supabase.auth.signOut().catch(() => {});
    },
    deleteAccount: async () => {
      await api.deleteMe();
      setSession(null);
      setProfile(null);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('jd_session');
        localStorage.removeItem('jd_profile');
        localStorage.removeItem('alon_session');
        localStorage.removeItem('alon_profile');
        localStorage.removeItem('jd_admin_jwt');
        localStorage.removeItem('jd_admin_token_key');
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('jd_session');
        sessionStorage.removeItem('jd_profile');
        sessionStorage.removeItem('jd_admin_jwt');
        sessionStorage.removeItem('jd_admin_token_key');
      }
      await supabase.auth.signOut().catch(() => {});
      toast('Your account has been permanently deleted ✦');
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
