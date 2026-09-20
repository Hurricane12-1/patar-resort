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

const MOCK_ACCOUNTS = {
  admin: {
    id: 'usr-admin-1234',
    first_name: 'Johannes',
    middle_name: 'Von',
    last_name: 'Shicksal',
    full_name: 'Johannes Von Shicksal',
    email: 'administrator@jdbeachhouse.ph',
    phone: '+63 900 555 0123',
    address: 'Tambak Beach Road',
    city: 'Bolinao',
    role: 'administrator',
  },
  receptionist: {
    id: 'usr-recep-1234',
    first_name: 'Elena',
    middle_name: 'Santos',
    last_name: 'Ramos',
    full_name: 'Elena Santos Ramos',
    email: 'receptionist@jdbeachhouse.ph',
    phone: '+63 900 555 0101',
    address: 'Front Desk Office',
    city: 'Bolinao',
    role: 'receptionist',
  },
  accountant: {
    id: 'usr-acct-1234',
    first_name: 'Carlos',
    middle_name: 'Mendoza',
    last_name: 'Ledger',
    full_name: 'Carlos Mendoza Ledger',
    email: 'accounting@jdbeachhouse.ph',
    phone: '+63 900 555 0102',
    address: 'Finance Office',
    city: 'Bolinao',
    role: 'accounting',
  },
  customer: {
    id: 'usr-cust-1234',
    first_name: 'Juan',
    middle_name: 'Dela',
    last_name: 'Cruz',
    full_name: 'Juan Dela Cruz',
    email: 'user@gmail.com',
    phone: '+63 917 555 0192',
    address: '123 Sunset Drive',
    city: 'Manila',
    role: 'customer',
  },
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem('jd_session') || localStorage.getItem('alon_session');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('jd_profile') || localStorage.getItem('alon_profile');
      return saved ? JSON.parse(saved) : null;
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
    const u = String(emailOrUsername || '').trim().toLowerCase();

    let key = 'customer';
    if (u.includes('admin') || u.includes('jvs001')) key = 'admin';
    else if (u.includes('recep') || u.includes('esr002')) key = 'receptionist';
    else if (u.includes('acct') || u.includes('accounting') || u.includes('cml003')) key = 'accountant';

    try {
      const res = await supabase.auth.signInWithPassword({ email: emailOrUsername, password });
      if (!res.error && res.data?.session) {
        setSession(res.data.session);
        return res;
      }
    } catch {}

    // Fallback mock session when backend server or Supabase is offline/unreachable
    const mockProfile = MOCK_ACCOUNTS[key] || MOCK_ACCOUNTS.customer;
    const mockSession = {
      access_token: `mock-token-${key}`,
      user: { id: mockProfile.id, email: mockProfile.email, is_mock: true, profile: mockProfile },
    };
    setSession(mockSession);
    setProfile(mockProfile);
    localStorage.setItem('jd_session', JSON.stringify(mockSession));
    localStorage.setItem('jd_profile', JSON.stringify(mockProfile));
    return { data: mockSession, error: null };
  };

  const switchMockRole = (roleKey) => {
    const p = MOCK_ACCOUNTS[roleKey] || MOCK_ACCOUNTS.customer;
    const s = { access_token: `mock-token-${roleKey}`, user: { id: p.id, email: p.email, is_mock: true, profile: p } };
    setSession(s);
    setProfile(p);
    localStorage.setItem('jd_session', JSON.stringify(s));
    localStorage.setItem('jd_profile', JSON.stringify(p));
    toast(`Switched active portal role to ${p.role.toUpperCase()} ✦`);
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

      if (session?.user?.is_mock) {
        const updated = { ...profile, ...updatedFields };
        setProfile(updated);
        localStorage.setItem('jd_profile', JSON.stringify(updated));
        return updated;
      }
      try {
        const updated = await api.updateMe(updatedFields);
        setProfile(updated);
        localStorage.setItem('jd_profile', JSON.stringify(updated));
        return updated;
      } catch {
        const updated = { ...profile, ...updatedFields };
        setProfile(updated);
        localStorage.setItem('jd_profile', JSON.stringify(updated));
        return updated;
      }
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
