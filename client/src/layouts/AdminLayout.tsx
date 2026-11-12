import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

interface AdminLayoutProps {
  children?: React.ReactNode;
}

/**
 * AdminLayout - Governance & System Control Namespace Wrapper (/admin)
 * Oversight & Configuration: High-level system governance, RBAC assignment,
 * global settings, audit logs, and master analytics.
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  const { adminProfile, profile, signOutAdmin } = useAuth();
  const location = useLocation();
  const activeProfile = adminProfile || profile;

  return (
    <div className="admin-namespace-wrapper" style={{ minHeight: '100vh', background: '#020617', color: '#F8FAFC' }}>
      {/* Top Governance Control Bar */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.95)',
        borderBottom: '1px solid rgba(139, 92, 246, 0.35)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/admin" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <span style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(124, 58, 237, 0.6))',
              border: '1px solid rgba(167, 139, 250, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(139, 92, 246, 0.35)',
            }}>
              <i className="fas fa-crown" style={{ color: '#C4B5FD', fontSize: '1.1rem' }} />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '.7rem', fontWeight: 800, letterSpacing: '.22em', color: '#A78BFA', textTransform: 'uppercase' }}>
                  GOVERNANCE & SYSTEM CONTROL
                </span>
                <span style={{
                  fontSize: '.62rem',
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'rgba(139, 92, 246, 0.2)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  color: '#DDD6FE',
                  fontWeight: 700,
                }}>
                  /admin
                </span>
              </div>
              <h1 className="serif" style={{ fontSize: '1.18rem', margin: 0, color: '#FFFFFF', letterSpacing: '.04em' }}>
                Rock View Executive Console
              </h1>
            </div>
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            fontSize: '.74rem',
            color: '#CBD5E1',
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '4px 10px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            <span>Admin: <strong style={{ color: '#FFFFFF' }}>{activeProfile?.full_name || activeProfile?.username || 'System Administrator'}</strong></span>
          </div>

          <button
            onClick={signOutAdmin}
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
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ minHeight: 'calc(100vh - 60px)' }}>
        {children}
      </main>
    </div>
  );
}
