import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import { api } from '../lib/api.ts';
import { toast } from '../components/Toasts.tsx';

const Ctx = createContext(null);

export function generateAccountEmail(firstName, middleName, lastName, seq = 1, isStaff = true) {
  const f = (firstName || '').trim().charAt(0).toLowerCase() || 'x';
  const m = (middleName || '').trim().charAt(0).toLowerCase() || 'x';
  const l = (lastName || '').trim().charAt(0).toLowerCase() || 'x';
  if (!isStaff) return `${f}${m}${l}@gmail.com`;
  const paddedSeq = String(seq).padStart(3, '0');
  return `${f}${m}${l}${paddedSeq}@resortmanagement.ph`;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem('jd_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Clear any old mock sessions from previous sessions
        if (parsed?.user?.is_mock) {
          localStorage.removeItem('jd_session');
          localStorage.removeItem('jd_profile');
          return null;
        }
        return parsed;
      }
      return null;
    } catch { return null; }
  });
  
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('jd_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.is_mock || parsed?.id?.startsWith('usr-admin-1234') || parsed?.id?.startsWith('usr-recep-') || parsed?.id?.startsWith('usr-acct-')) {
          localStorage.removeItem('jd_profile');
          return null;
        }
        return parsed;
      }
      return null;
    } catch { return null; }
  });

  const [authOpen, setAuthOpen] = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

  useEffect(() => {
    if (session) {
      localStorage.setItem('jd_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('jd_session');
      localStorage.removeItem('alon_session');
    }
  }, [session]);

  useEffect(() => {
    if (profile) {
      localStorage.setItem('jd_profile', JSON.stringify(profile));
    } else {
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
      api.me().then((p) => {
        if (p) {
          setProfile(p);
          setNeedsProfileCompletion(!p.full_name || !p.phone || !p.address);
        }
      }).catch(() => {});
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
        localStorage.removeItem('jd_session');
        localStorage.removeItem('jd_profile');
        localStorage.removeItem('alon_session');
        localStorage.removeItem('alon_profile');
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
      const res = await supabase.auth.signInWithPassword({ email: emailOrUsername, password });
      if (res.error) {
        return { data: null, error: res.error };
      }
      if (res.data?.session) {
        setSession(res.data.session);
        return res;
      }
      return { data: null, error: new Error('Authentication failed. Please verify your credentials.') };
    } catch (err) {
      return { data: null, error: err };
    }
  };

  const switchMockRole = (roleKey) => {
    if (profile && ['administrator', 'staff', 'receptionist', 'accounting'].includes(profile.role)) {
      const updated = { ...profile, activeViewRole: roleKey };
      setProfile(updated);
      localStorage.setItem('jd_profile', JSON.stringify(updated));
      toast(`Switched portal view to ${roleKey.toUpperCase()} ✦`);
    } else {
      toast(`Sign in with administrative credentials to access staff views.`, true);
    }
  };

  const value = {
    session, profile, authOpen, setAuthOpen,
    needsProfileCompletion, setNeedsProfileCompletion,
    signIn,
    switchMockRole,
    signUp: (email, password, meta) => supabase.auth.signUp({ email, password, options: { data: meta } }),
    signInWithGoogle: () => supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    }),
    updateProfile: async (fields) => {
      const first = fields.first_name !== undefined ? fields.first_name : (profile?.first_name || '');
      const middle = fields.middle_name !== undefined ? fields.middle_name : (profile?.middle_name || '');
      const last = fields.last_name !== undefined ? fields.last_name : (profile?.last_name || '');
      const full_name = fields.full_name || [first, middle, last].filter(Boolean).join(' ') || profile?.full_name || '';
      const updatedFields = { ...fields, full_name };

      const updated = await api.updateMe(updatedFields);
      setProfile(updated);
      localStorage.setItem('jd_profile', JSON.stringify(updated));
      return updated;
    },
    signOut: async () => {
      setSession(null);
      setProfile(null);
      localStorage.removeItem('jd_session');
      localStorage.removeItem('jd_profile');
      localStorage.removeItem('alon_session');
      localStorage.removeItem('alon_profile');
      await supabase.auth.signOut().catch(() => {});
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
