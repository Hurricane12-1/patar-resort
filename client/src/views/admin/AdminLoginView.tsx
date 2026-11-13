import React from 'react';
import { IconShield } from '../../components/AdminIcons';
import '../../styles/admin-login.css';

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
  authenticating,
  setAdminRecoveryEmail,
  setAdminRecoveryStep,
  setShowAdminForgotModal,
}) => {
  return (
    <div className="admin-login-viewport">
      <div className="admin-login-card">
        {/* Top Header: Badge + Brand Mark (Collision-Proof) */}
        <div className="admin-login-topbar">
          <span className="admin-login-badge">
            <IconShield size={13} color="#22c3ee" /> Executive Portal
          </span>
          <span className="admin-login-brand">
            ✦ ROCK VIEW RESORT
          </span>
        </div>

        <h2 className="admin-login-title">
          Administrator Sign In
        </h2>
        <p className="admin-login-subtitle">
          Executive clearance required. Enter your administrator credentials to access resort governance, catalog management, and financial ledgers.
        </p>

        {authError && (
          <div className="admin-login-error">
            <i className="fas fa-triangle-exclamation" />
            <span>
              {(!authError || authError === '{}' || authError === '[object Object]')
                ? 'Invalid administrator credentials. Please check your username and password.'
                : authError}
            </span>
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="admin-login-form">
          <div>
            <label className="admin-login-label">
              Administrator Username or Email
            </label>
            <input
              type="text"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="e.g. jjd001.administrator@rockview.ph"
              className="admin-login-input"
            />
          </div>

          <div>
            <label className="admin-login-label">
              Password
            </label>
            <input
              type="password"
              required
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              placeholder="••••••••"
              className="admin-login-input"
            />
          </div>

          <div className="admin-login-forgot">
            <button
              type="button"
              onClick={() => {
                setAdminRecoveryEmail(adminEmail || '');
                setAdminRecoveryStep(1);
                setShowAdminForgotModal(true);
              }}
              className="admin-login-forgot-btn"
            >
              Forgot password? Reset via OTP
            </button>
          </div>

          <button
            type="submit"
            disabled={authenticating}
            className="admin-login-submit"
          >
            {authenticating ? 'Verifying Clearance…' : 'Sign In to Portal'}
          </button>
        </form>

        <div className="admin-login-footer">
          <div>
            <span style={{ fontSize: '.72rem', color: 'rgba(232, 238, 247, 0.5)' }}>
              Operational Staff Member?{' '}
            </span>
            <a href="/staff/login" className="admin-login-staff-link">
              Go to Staff Station Login (/staff/login) →
            </a>
          </div>
          <div>
            <a href="/" className="admin-login-home-link">
              ← Return to Guest Homepage
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
