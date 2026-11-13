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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDeptHint, setSelectedDeptHint] = useState<string>('front_desk');

  const activeEmployee = adminProfile || profile;

  // If already logged in as staff, redirect straight to their department
  React.useEffect(() => {
    if (activeEmployee && normalizeRole(activeEmployee.role) !== 'customer') {
      const target = redirectTarget || getDefaultStaffPath(activeEmployee);
      navigate(target, { replace: true });
    }
  }, [activeEmployee, redirectTarget, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast('Please enter your staff email and password.', true);
      return;
    }

    setSubmitting(true);
    try {
      const res = await adminSignIn(email.trim(), password);
      if (res?.error) {
        throw res.error;
      }

      const user = res?.data?.profile || res?.data?.user;
      const role = normalizeRole(user?.role);
      if (role === 'customer') {
        toast('Access denied: Guest accounts cannot enter the staff operational station.', true);
        return;
      }

      const deptLabel = formatDepartmentBadge(user);
      toast(`✦ Operational clearance granted: Welcome, ${user?.full_name || 'Staff Member'} (${deptLabel})`);
      
      const destination = redirectTarget || (role === 'administrator' ? '/staff/reception' : getDefaultStaffPath(user));
      navigate(destination, { replace: true });
    } catch (err: any) {
      toast(err.message || 'Staff authentication failed. Check credentials.', true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="staff-login-container">
      {/* Background Ambient Glow */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(14, 165, 233, 0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="staff-login-card">
        {/* Terminal Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.25), rgba(2, 132, 199, 0.45))',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            boxShadow: '0 0 24px rgba(14, 165, 233, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}>
            <i className="fas fa-clipboard-user" style={{ fontSize: '1.5rem', color: '#38BDF8' }} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
            <span className="staff-badge-pill staff-badge-frontdesk">
              Staff Portal
            </span>
            <span style={{ fontSize: '.68rem', color: '#64748B', fontFamily: 'monospace' }}>
              RBAC PROTECTED
            </span>
          </div>

          <h1 className="serif" style={{ fontSize: '1.45rem', color: '#FFFFFF', margin: 0, letterSpacing: '.03em' }}>
            Operations & Staff Terminal
          </h1>
          <p style={{ fontSize: '.78rem', color: '#94A3B8', marginTop: 4, marginBottom: 0 }}>
            Daily execution, check-ins, folios, and room sanitation turnarounds.
          </p>
        </div>

        {/* Department Station Pills */}
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.12em', color: '#64748B', display: 'block', marginBottom: 6 }}>
            Operational Stations:
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            <button
              type="button"
              onClick={() => setSelectedDeptHint('front_desk')}
              style={{
                fontSize: '.68rem',
                fontWeight: 700,
                padding: '6px 4px',
                borderRadius: 8,
                border: selectedDeptHint === 'front_desk' ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.08)',
                background: selectedDeptHint === 'front_desk' ? 'rgba(14, 165, 233, 0.2)' : 'rgba(30, 41, 59, 0.4)',
                color: selectedDeptHint === 'front_desk' ? '#38BDF8' : '#94A3B8',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <i className="fas fa-bell-concierge" style={{ display: 'block', marginBottom: 2 }} />
              Front Desk
            </button>
            <button
              type="button"
              onClick={() => setSelectedDeptHint('accounting')}
              style={{
                fontSize: '.68rem',
                fontWeight: 700,
                padding: '6px 4px',
                borderRadius: 8,
                border: selectedDeptHint === 'accounting' ? '1px solid #C084FC' : '1px solid rgba(255,255,255,0.08)',
                background: selectedDeptHint === 'accounting' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(30, 41, 59, 0.4)',
                color: selectedDeptHint === 'accounting' ? '#C084FC' : '#94A3B8',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <i className="fas fa-calculator" style={{ display: 'block', marginBottom: 2 }} />
              Accounting
            </button>
            <button
              type="button"
              onClick={() => setSelectedDeptHint('operations')}
              style={{
                fontSize: '.68rem',
                fontWeight: 700,
                padding: '6px 4px',
                borderRadius: 8,
                border: selectedDeptHint === 'operations' ? '1px solid #34D399' : '1px solid rgba(255,255,255,0.08)',
                background: selectedDeptHint === 'operations' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.4)',
                color: selectedDeptHint === 'operations' ? '#34D399' : '#94A3B8',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <i className="fas fa-broom" style={{ display: 'block', marginBottom: 2 }} />
              Operations
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: '.72rem', fontWeight: 600, color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Staff Employee Email / ID
            </label>
            <div style={{ position: 'relative' }}>
              <i className="fas fa-envelope" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B', fontSize: '.85rem' }} />
              <input
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. jjd001.receptionist@rockview.ph"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 34px',
                  borderRadius: 10,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  background: 'rgba(30, 41, 59, 0.6)',
                  color: '#FFFFFF',
                  fontSize: '.85rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '.72rem', fontWeight: 600, color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <i className="fas fa-lock" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B', fontSize: '.85rem' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter account password"
                style={{
                  width: '100%',
                  padding: '10px 36px 10px 34px',
                  borderRadius: 10,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  background: 'rgba(30, 41, 59, 0.6)',
                  color: '#FFFFFF',
                  fontSize: '.85rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} style={{ fontSize: '.85rem' }} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: 6,
              padding: '12px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '.85rem',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              cursor: submitting ? 'wait' : 'pointer',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
            }}
          >
            {submitting ? (
              <>
                <i className="fas fa-spinner fa-spin" />
                <span>Verifying Department Clearance…</span>
              </>
            ) : (
              <>
                <i className="fas fa-right-to-bracket" />
                <span>Enter Staff Station</span>
              </>
            )}
          </button>
        </form>

        {/* Portal Cross-Navigation Links */}
        <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <span style={{ fontSize: '.72rem', color: '#64748B' }}>
              Executive Management Officer?{' '}
            </span>
            <Link
              to="/admin"
              style={{
                fontSize: '.72rem',
                color: '#A78BFA',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Go to Administrator Sign In (/admin) →
            </Link>
          </div>
          <div>
            <span style={{ fontSize: '.72rem', color: '#64748B' }}>
              Visiting as a guest or checking your booking?{' '}
            </span>
            <Link
              to="/"
              style={{
                fontSize: '.72rem',
                color: '#38BDF8',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Return to Guest Portal →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
