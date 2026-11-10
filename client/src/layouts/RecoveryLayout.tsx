import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

interface RecoveryLayoutProps {
  children?: React.ReactNode;
}

/**
 * RecoveryLayout - Specialized Resolution, Restoration & Escalation Namespace Wrapper (/recovery)
 * Dedicated to resolving edge cases, disputed bookings, account restoration, and legal/financial escalations.
 */
export default function RecoveryLayout({ children }: RecoveryLayoutProps) {
  const { adminProfile, profile, signOut, setAuthOpen, session, adminSession, customerSession } = useAuth();
  const isAuthenticated = Boolean(session || adminSession || customerSession);
  const activeProfile = adminProfile || profile;

  const recoveryNavItems = [
    { to: '/recovery', label: 'Resolution Console', icon: 'fas fa-shield-virus' },
    { to: '/recovery/cases', label: 'Flagged & Disputed Queue', icon: 'fas fa-folder-open' },
    { to: '/recovery/audit', label: 'Escalation Logs', icon: 'fas fa-history' },
  ];

  return (
    <div className="recovery-namespace-wrapper" style={{ minHeight: '100vh', background: '#0B0A12', color: '#F8FAFC' }}>
      {/* Top Recovery Command Header */}
      <header style={{
        background: 'rgba(19, 16, 29, 0.96)',
        borderBottom: '1px solid rgba(245, 158, 11, 0.35)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(14px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/recovery" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <span style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.4), rgba(217, 119, 6, 0.6))',
              border: '1px solid rgba(251, 191, 36, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(245, 158, 11, 0.35)',
            }}>
              <i className="fas fa-life-ring" style={{ color: '#FDE68A', fontSize: '1.2rem' }} />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.2em', color: '#F59E0B', textTransform: 'uppercase' }}>
                  SPECIALIZED RESOLUTION & RESTORATION
                </span>
                <span style={{
                  fontSize: '.62rem',
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: '#FDE68A',
                  fontWeight: 700,
                }}>
                  /recovery
                </span>
              </div>
              <h1 className="serif" style={{ fontSize: '1.22rem', margin: 0, color: '#FFFFFF', letterSpacing: '.03em' }}>
                Incident & Escalation Portal
              </h1>
            </div>
          </Link>

          {/* Recovery Navigation Tabs */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 20 }}>
            {recoveryNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/recovery'}
                className={({ isActive }) => `recovery-nav-btn ${isActive ? 'active' : ''}`}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '.78rem',
                  fontWeight: 700,
                  padding: '7px 14px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  color: isActive ? '#FFFFFF' : '#94A3B8',
                  background: isActive ? 'rgba(245, 158, 11, 0.22)' : 'rgba(30, 41, 59, 0.4)',
                  border: isActive ? '1px solid rgba(251, 191, 36, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                  transition: 'all 0.2s ease',
                })}
              >
                <i className={item.icon} style={{ fontSize: '.85rem' }} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Handoff Link to Executive Governance */}
          <Link
            to="/admin"
            style={{
              fontSize: '.74rem',
              fontWeight: 700,
              color: '#C4B5FD',
              background: 'rgba(139, 92, 246, 0.15)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              padding: '6px 12px',
              borderRadius: 8,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Escalate critical dispute to Executive Governance (/admin)"
          >
            <i className="fas fa-crown" style={{ color: '#A78BFA' }} />
            Governance (/admin)
          </Link>

          <div style={{
            fontSize: '.74rem',
            color: '#CBD5E1',
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '5px 12px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isAuthenticated ? '#10B981' : '#F59E0B', display: 'inline-block' }} />
            <span>{isAuthenticated ? (
              <>Status: <strong style={{ color: '#10B981' }}>Confirmed</strong> ({activeProfile?.full_name || activeProfile?.username || activeProfile?.email || 'Logged In'})</>
            ) : (
              <>Status: <strong style={{ color: '#F59E0B' }}>Guest</strong></>
            )}</span>
          </div>

          {isAuthenticated ? (
            <button
              onClick={signOut}
              style={{
                fontSize: '.74rem',
                fontWeight: 700,
                color: '#F87171',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '6px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
              }}
            >
              <i className="fas fa-arrow-right-from-bracket" />
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              style={{
                fontSize: '.74rem',
                fontWeight: 700,
                color: '#38BDF8',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '6px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
              }}
            >
              <i className="fas fa-sign-in-alt" />
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Recovery Content */}
      <main style={{ minHeight: 'calc(100vh - 66px)', padding: '16px 0' }}>
        {children}
      </main>
    </div>
  );
}
