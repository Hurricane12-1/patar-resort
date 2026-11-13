import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { toast } from '../components/Toasts.tsx';
import { getDefaultStaffPath, formatDepartmentBadge, normalizeRole } from '../lib/rbac.ts';
import '../styles/staff-portal.css';

export default function StaffLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect');

  const { adminSignIn, adminProfile, profile } = useAuth();
  const [email, setEmail]                       = useState('');
  const [password, setPassword]                 = useState('');
  const [showPassword, setShowPassword]         = useState(false);
  const [submitting, setSubmitting]             = useState(false);

  const activeEmployee = adminProfile || profile;

  React.useEffect(() => {
    if (activeEmployee && normalizeRole(activeEmployee.role) !== 'customer') {
      const target = redirectTarget || getDefaultStaffPath(activeEmployee);
      navigate(target, { replace: true });
    }
  }, [activeEmployee, redirectTarget, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast('Please enter your employee email and password.', true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await adminSignIn(email.trim(), password);
      if (res?.error) throw res.error;

      const user = res?.data?.profile || res?.data?.user;
      const role = normalizeRole(user?.role);
      if (role === 'customer') {
        toast('Access denied: Guest accounts cannot access the operational station.', true);
        return;
      }
      const deptLabel = formatDepartmentBadge(user);
      toast(`✦ Clearance granted — Welcome, ${user?.full_name || 'Team Member'} (${deptLabel})`);
      const destination = redirectTarget || (role === 'administrator' ? '/staff/reception' : getDefaultStaffPath(user));
      navigate(destination, { replace: true });
    } catch (err: any) {
      toast(err.message || 'Authentication failed. Please check your credentials.', true);
    } finally {
      setSubmitting(false);
    }
  };

  const activeDept = null;

  return (
    <div className="sl-viewport">
      {/* Ambient glows — purely decorative */}
      <div className="sl-glow sl-glow--top"    aria-hidden="true" />
      <div className="sl-glow sl-glow--bottom" aria-hidden="true" />

      <div className="sl-card">

        {/* ── Top bar ── */}
        <div className="sl-topbar">
          <span className="sl-topbar__badge">
            <i className="fas fa-shield-halved" />
            Operational Portal
          </span>
          <span className="sl-topbar__brand">
            ✦ ROCK VIEW RESORT
          </span>
        </div>

        {/* ── Icon + Title ── */}
        <div className="sl-hero">
          <div className="sl-hero__icon">
            <i className="fas fa-clipboard-user" />
          </div>
          <h1 className="sl-hero__title">
            Station Sign In
          </h1>
          <p className="sl-hero__subtitle">
            Operational clearance required. Authenticate with your&nbsp;employee
            credentials to access your department station.
          </p>
        </div>

        {/* ── Login form ── */}
        <form onSubmit={handleSubmit} className="sl-form" noValidate>
          {/* Email */}
          <div className="sl-field">
            <label className="sl-field__label" htmlFor="sl-email">
              Employee Email / ID
            </label>
            <div className="sl-field__wrap">
              <i className="fas fa-envelope sl-field__icon" />
              <input
                id="sl-email"
                type="text"
                autoComplete="username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. jjd001.receptionist@rockview.ph"
                className="sl-field__input"
              />
            </div>
          </div>

          {/* Password */}
          <div className="sl-field">
            <label className="sl-field__label" htmlFor="sl-password">
              Password
            </label>
            <div className="sl-field__wrap">
              <i className="fas fa-lock sl-field__icon" />
              <input
                id="sl-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter account password"
                className="sl-field__input sl-field__input--padded-right"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="sl-field__eye"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="sl-submit"
          >
            {submitting ? (
              <>
                <i className="fas fa-spinner fa-spin" />
                <span>Verifying Clearance…</span>
              </>
            ) : (
              <>
                <i className="fas fa-right-to-bracket" />
                <span>Sign In to Station</span>
              </>
            )}
          </button>
        </form>

        {/* ── Cross-nav ── */}
        <div className="sl-footnav">
          <div className="sl-footnav__row">
            <span className="sl-footnav__hint">Executive Management Officer?</span>
            <Link to="/admin" className="sl-footnav__link sl-footnav__link--violet">
              Go to Administrator Sign In&nbsp;→
            </Link>
          </div>
          <div className="sl-footnav__row">
            <span className="sl-footnav__hint">Visiting as a guest?</span>
            <Link to="/" className="sl-footnav__link sl-footnav__link--cyan">
              ← Return to Guest Portal
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
