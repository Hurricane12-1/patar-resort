import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { canAccessPortal, isInternalEmployee, getDefaultStaffPath, formatDepartmentBadge, PortalKey, normalizeRole } from '../lib/rbac.ts';
import '../styles/staff-portal.css';

interface StaffGuardProps {
  children: React.ReactNode;
  portal?: 'reception' | 'accounting' | 'operations';
  title?: string;
}

/**
 * StaffGuard - Isolates each /staff portal by employee department and role (RBAC).
 * Enforces zero "god-eye" leakage: Staff members only access their authorized department.
 * Unauthenticated users are sent to the dedicated /staff/login page.
 */
export default function StaffGuard({ children, portal, title }: StaffGuardProps) {
  const location = useLocation();
  const { adminSession, adminProfile, profile, signOutAdmin } = useAuth();
  const activeProfile = adminProfile || profile;

  // 1. Unauthenticated -> Redirect to dedicated /staff/login
  if (!adminSession || !activeProfile || !isInternalEmployee(activeProfile)) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/staff/login?redirect=${returnUrl}`} replace />;
  }

  // 2. If a specific portal is required, check RBAC permission
  if (portal) {
    const isAllowed = canAccessPortal(activeProfile, portal);
    if (!isAllowed) {
      const userDept = formatDepartmentBadge(activeProfile);
      const userDefaultDesk = getDefaultStaffPath(activeProfile);
      const portalNames: Record<string, string> = {
        reception: 'Front Desk & Reception Desk',
        accounting: 'Accounting, Audit & Folio Billing',
        operations: 'Department Operations & Housekeeping',
      };
      const requestedPortalName = portalNames[portal] || title || portal;

      return (
        <div className="staff-denied-container">
          <div className="staff-denied-card">
            <div className="staff-denied-icon">
              <i className="fas fa-lock" />
            </div>
            <h2 className="serif" style={{ fontSize: '1.4rem', color: '#FFFFFF', margin: 0, letterSpacing: '.02em' }}>
              Department Clearance Restricted
            </h2>
            <p style={{ fontSize: '.84rem', color: '#CBD5E1', marginTop: 8, marginBottom: 20, lineHeight: 1.6 }}>
              Your account has operational clearance for <strong>{userDept}</strong>, but cannot access <strong>{requestedPortalName}</strong>.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link
                to={userDefaultDesk}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '.82rem',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                }}
              >
                <i className="fas fa-arrow-left" />
                <span>Return to My Authorized Department Desk</span>
              </Link>
              <button
                type="button"
                onClick={signOutAdmin}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#F87171',
                  fontWeight: 600,
                  fontSize: '.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <i className="fas fa-arrow-right-from-bracket" />
                <span>Sign Out / Switch Station</span>
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Authorized -> Render scoped department view
  return <>{children}</>;
}
