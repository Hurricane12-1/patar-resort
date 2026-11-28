import React, { useEffect, useState } from 'react';
import ResidentLogin from '../components/ResidentLogin.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { CLIENT_DIRECT_ACCESS } from '../lib/guestPortal.ts';
import { toast } from '../components/Toasts.tsx';

interface ClientGuardProps {
  children: React.ReactNode;
  /**
   * Lets visitors open this route without signing in while CLIENT_DIRECT_ACCESS is on.
   * The guest dashboard uses it to show a clearly labelled, device-only preview.
   */
  allowPreview?: boolean;
}

/**
 * ClientGuard - Strictly isolates the resident customer namespace (/client).
 * End-User Self-Service & Portal: Authenticated resident customers only.
 * When unauthenticated, renders the half-and-half deep blue marine Resident Guest Portal login.
 */
export default function ClientGuard({ children, allowPreview = false }: ClientGuardProps) {
  const { customerSession, customerProfile } = useAuth();
  const [resolvingAuth, setResolvingAuth] = useState(() => {
    if (typeof window === 'undefined') return false;
    const hasOAuthParams = window.location.search.includes('code=') || window.location.hash.includes('access_token=');
    return hasOAuthParams;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Handle OAuth error params in URL (e.g., user denied, permission error, or provider block)
    const rawParams = window.location.search ? window.location.search.substring(1) : window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(rawParams);
    const errorParam = params.get('error') || params.get('error_code');
    const errorDesc = params.get('error_description');

    if (errorParam) {
      const cleanDesc = errorDesc ? decodeURIComponent(errorDesc).replace(/\+/g, ' ') : '';
      toast(cleanDesc || 'Sign-in could not be completed. Please try again.', true);
      window.history.replaceState(null, '', window.location.pathname);
      setResolvingAuth(false);
      return;
    }

    if (resolvingAuth) {
      const timer = setTimeout(() => {
        setResolvingAuth(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [resolvingAuth]);

  useEffect(() => {
    if (customerSession && customerProfile) {
      setResolvingAuth(false);
    }
  }, [customerSession, customerProfile]);

  const isAuthorized = Boolean(customerSession && customerProfile);

  if (isAuthorized || (allowPreview && CLIENT_DIRECT_ACCESS)) {
    return <>{children}</>;
  }

  if (resolvingAuth) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: '#040e22',
        color: '#e8eef7',
        fontFamily: 'var(--font-sans)',
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '3px solid rgba(56, 189, 248, 0.22)',
          borderTopColor: '#38bdf8',
          animation: 'rvAuthSpin 0.8s linear infinite',
        }} />
        <p style={{ margin: 0, fontSize: '0.95rem' }}>Authenticating resident session…</p>
        <style>{`@keyframes rvAuthSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return <ResidentLogin returnTo={window.location.pathname} />;
}
