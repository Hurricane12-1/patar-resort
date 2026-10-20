import React from 'react';
import { IconShield } from '../../components/AdminIcons';

export interface AdminLoginViewProps {
  session: any;
  profile: any;
  user: any;
  signOut: () => Promise<void> | void;
  authError: string;
  adminEmail: string;
  setAdminEmail: (email: string) => void;
  adminPass: string;
  setAdminPass: (pass: string) => void;
  handleAdminLogin: (e: React.FormEvent) => void;
  handleAdminBypass?: () => void;
  authenticating: boolean;
  setAdminRecoveryEmail: (email: string) => void;
  setAdminRecoveryStep: (step: number) => void;
  setShowAdminForgotModal: (show: boolean) => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  session,
  profile,
  user,
  signOut,
  authError,
  adminEmail,
  setAdminEmail,
  adminPass,
  setAdminPass,
  handleAdminLogin,
  handleAdminBypass,
  authenticating,
  setAdminRecoveryEmail,
  setAdminRecoveryStep,
  setShowAdminForgotModal,
}) => {
  // Case 1: Authenticated session, but database profile role lacks administrator clearance
  if (session && profile) {
    return (
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          background: 'radial-gradient(ellipse at 50% 20%, #0d1b38 0%, #060b18 70%)',
          color: '#e8eef7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: '100%',
            background: 'rgba(11, 20, 38, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            borderRadius: 24,
            padding: '36px 32px',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 35px rgba(244, 63, 94, 0.15)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              padding: 14,
              borderRadius: 20,
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              marginBottom: 16,
            }}
          >
            <IconShield size={36} color="#F43F5E" />
          </div>

          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '2.2rem',
              margin: '0 0 8px',
              color: '#FFFFFF',
              fontWeight: 600,
            }}
          >
            Administrative Clearance Required
          </h2>

          <p style={{ margin: '0 0 20px', fontSize: '.88rem', color: 'rgba(232, 238, 247, 0.75)', lineHeight: 1.6 }}>
            This portal is strictly guarded. The database profile acquired for your authenticated session does not possess administrator clearance.
          </p>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 14,
              padding: '16px',
              textAlign: 'left',
              marginBottom: 24,
              fontSize: '.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div>
              <strong style={{ color: '#94A3B8' }}>Account Name:</strong>{' '}
              <span style={{ color: '#FFF' }}>{profile?.full_name || 'User'}</span>
            </div>
            <div>
              <strong style={{ color: '#94A3B8' }}>Email:</strong>{' '}
              <span style={{ color: '#FFF' }}>{profile?.email || user?.email}</span>
            </div>
            <div>
              <strong style={{ color: '#94A3B8' }}>Database Role:</strong>{' '}
              <span
                style={{
                  color: '#F43F5E',
                  background: 'rgba(244, 63, 94, 0.15)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: '.78rem',
                }}
              >
                {profile?.role || 'customer'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={() => signOut()}
              style={{
                width: '100%',
                background: '#22c3ee',
                color: '#060b18',
                border: 'none',
                borderRadius: 14,
                padding: '13px 20px',
                fontSize: '.82rem',
                fontWeight: 800,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Sign In With Administrator Account ✦
            </button>
            {handleAdminBypass && (
              <button
                type="button"
                onClick={handleAdminBypass}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, rgba(246, 183, 74, 0.2) 0%, rgba(34, 195, 238, 0.2) 100%)',
                  border: '1px solid rgba(246, 183, 74, 0.5)',
                  color: '#f6b74a',
                  borderRadius: 14,
                  padding: '13px 20px',
                  fontSize: '.82rem',
                  fontWeight: 800,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span>⚡</span>
                <span>Switch to Executive Admin (Julian Nygel J. Deleon)</span>
              </button>
            )}
            <a
              href="/"
              style={{
                color: 'rgba(232, 238, 247, 0.65)',
                textDecoration: 'none',
                fontSize: '.8rem',
                fontWeight: 600,
                marginTop: 6,
              }}
            >
              ← Return to Guest Homepage
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Unauthenticated - Clean 2-Field Login (Email & Password Only)
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: 'radial-gradient(ellipse at 50% 20%, #0d1b38 0%, #060b18 70%)',
        color: '#e8eef7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: '100%',
          background: 'rgba(11, 20, 38, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(34, 195, 238, 0.25)',
          borderRadius: 24,
          padding: '36px 32px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 35px rgba(34, 195, 238, 0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(34, 195, 238, 0.12)',
              border: '1px solid rgba(34, 195, 238, 0.3)',
              color: '#22c3ee',
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: '.72rem',
              fontWeight: 800,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
            }}
          >
            <IconShield size={14} color="#22c3ee" /> Administrator Portal
          </span>
          <span style={{ fontSize: '.72rem', color: '#f6b74a', fontWeight: 700, letterSpacing: '.06em' }}>
            ✦ ROCK VIEW RESORT
          </span>
        </div>

        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '2.4rem',
            margin: '0 0 8px',
            color: '#FFFFFF',
            fontWeight: 600,
            lineHeight: 1.1,
          }}
        >
          Administrator Sign In
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: '.86rem', color: 'rgba(232, 238, 247, 0.7)', lineHeight: 1.5 }}>
          Enter your credentials. Once authenticated, your identity and administrative role are verified automatically from the database.
        </p>

        {authError && (
          <div
            style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              borderRadius: 12,
              padding: '10px 14px',
              marginBottom: 18,
              fontSize: '.8rem',
              color: '#FECDD3',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <i className="fas fa-triangle-exclamation" />
            <span>
              {(!authError || authError === '{}' || authError === '[object Object]')
                ? 'Invalid administrator credentials. Please check your username and password.'
                : authError}
            </span>
          </div>
        )}

        <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '.72rem',
                color: '#22c3ee',
                fontWeight: 800,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Administrator Username or Email
            </label>
            <input
              type="text"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin_username or admin@example.com"
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 14,
                padding: '12px 14px',
                color: '#FFFFFF',
                fontSize: '.9rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '.72rem',
                color: '#22c3ee',
                fontWeight: 800,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Password
            </label>
            <input
              type="password"
              required
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 14,
                padding: '12px 14px',
                color: '#FFFFFF',
                fontSize: '.9rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6 }}>
            <button
              type="button"
              onClick={() => {
                setAdminRecoveryEmail(adminEmail || '');
                setAdminRecoveryStep(1);
                setShowAdminForgotModal(true);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#38BDF8',
                fontSize: '.78rem',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Forgot password? Reset via OTP
            </button>
          </div>

          <button
            type="submit"
            disabled={authenticating}
            style={{
              width: '100%',
              marginTop: 8,
              background: '#22c3ee',
              color: '#060b18',
              border: 'none',
              borderRadius: 20,
              padding: '14px 20px',
              fontSize: '.82rem',
              fontWeight: 800,
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              cursor: authenticating ? 'wait' : 'pointer',
              boxShadow: '0 10px 30px -8px rgba(34, 195, 238, 0.7)',
              transition: 'all 0.2s ease',
            }}
          >
            {authenticating ? 'Verifying Database Clearance…' : 'Sign In as Administrator ✦'}
          </button>
        </form>

        {handleAdminBypass && (
          <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ textAlign: 'center', marginBottom: 12, fontSize: '.72rem', color: 'rgba(232, 238, 247, 0.5)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              — OR DIRECT EXECUTIVE ACCESS —
            </div>
            <button
              type="button"
              onClick={handleAdminBypass}
              disabled={authenticating}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, rgba(246, 183, 74, 0.18) 0%, rgba(34, 195, 238, 0.18) 100%)',
                border: '1px solid rgba(246, 183, 74, 0.5)',
                color: '#f6b74a',
                borderRadius: 16,
                padding: '13px 18px',
                fontSize: '.82rem',
                fontWeight: 800,
                letterSpacing: '.06em',
                cursor: authenticating ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: '0 4px 20px rgba(246, 183, 74, 0.15)',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>⚡</span>
              <span>One-Click Administrative Bypass (Julian Nygel J. Deleon)</span>
            </button>
            <div style={{ fontSize: '.72rem', color: 'rgba(232, 238, 247, 0.5)', textAlign: 'center', marginTop: 8 }}>
              Badge: <span style={{ color: '#22c3ee', fontWeight: 700 }}>RCR-000-000-000-001</span> • Direct Executive Clearance
            </div>
          </div>
        )}

        <div style={{ marginTop: 22, textAlign: 'center' }}>
          <a
            href="/"
            style={{
              color: 'rgba(232, 238, 247, 0.6)',
              textDecoration: 'none',
              fontSize: '.78rem',
              fontWeight: 600,
            }}
          >
            ← Return to Guest Homepage
          </a>
        </div>
      </div>
    </div>
  );
};
