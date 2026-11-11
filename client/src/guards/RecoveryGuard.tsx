import React from 'react';
import ProtectedRoute from '../components/ProtectedRoute.tsx';

interface RecoveryGuardProps {
  children: React.ReactNode;
}

/**
 * RecoveryGuard - Enforces RBAC on the /recovery namespace.
 * Restricted to Administrators, Front Desk Receptionists, and Accounting Officers.
 */
export default function RecoveryGuard({ children }: RecoveryGuardProps) {
  return (
    <ProtectedRoute
      allowedRoles={['administrator', 'admin', 'receptionist', 'accounting']}
      requiredPortal="recovery"
      portalTitle="Incident & Escalation Resolution (/recovery)"
    >
      {children}
    </ProtectedRoute>
  );
}
