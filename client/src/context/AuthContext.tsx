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
      api.me().then(async (p) => {
        if (p) {
          // Automated user information collection from Google / OAuth metadata
          const meta = session.user?.user_metadata || {};
          const googleFirst = meta.given_name || meta.first_name || '';
          const googleLast = meta.family_name || meta.last_name || '';
          const googleFull = meta.full_name || meta.name || [googleFirst, googleLast].filter(Boolean).join(' ');

          if (!p.full_name || !p.first_name) {
            const firstName = p.first_name || googleFirst || 'Guest';
            const lastName = p.last_name || googleLast || 'Resident';
            const fullName = p.full_name || googleFull || `${firstName} ${lastName}`;
            try {
              const updated = await api.updateMe({
                first_name: firstName.replace(/[^a-zA-Z\s\-]/g, ''),
                last_name: lastName.replace(/[^a-zA-Z\s\-]/g, ''),
                full_name: fullName,
                phone: to11Digits(p.phone) || '09175558899',
                address: p.address || 'Patar Beach',
                city: (p.city || 'Bolinao').replace(/[^a-zA-Z\s\-]/g, ''),
                emergency_contact: to11Digits(p.emergency_contact) || '09185550123',
              });
              setProfile(updated);
              setNeedsProfileCompletion(false);
              return;
            } catch {}
          }

          setProfile(p);
          // Seamless login without redundant entry of account
          setNeedsProfileCompletion(false);
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

  const switchActiveRole = (roleKey) => {
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
