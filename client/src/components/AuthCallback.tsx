import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

/**
 * OAuth return landing for Google / Facebook sign-in.
 *
 * Google redirects here with the session in the URL hash. We wait for Supabase to read
 * that hash and establish the session before routing, instead of navigating away at once
 * — an immediate redirect strips the hash and loses the sign-in.
 */
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let settled = false;
    const go = (path: string) => {
      if (settled) return;
      settled = true;
      navigate(path, { replace: true });
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) go('/client');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) go('/client');
    });

    // No session lands when the page is opened directly or the sign-in failed; send the
    // guest to the resident login rather than leaving them on a blank screen.
    const timer = setTimeout(() => go('/client/login'), 6000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: '#040e22',
        color: '#e8eef7',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '3px solid rgba(56, 189, 248, 0.22)',
          borderTopColor: '#38bdf8',
          animation: 'rvAuthSpin 0.8s linear infinite',
        }}
      />
      <p style={{ margin: 0, fontSize: '0.95rem' }}>Completing resident sign-in…</p>
      <style>{`@keyframes rvAuthSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
