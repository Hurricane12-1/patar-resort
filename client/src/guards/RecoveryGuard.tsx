import React from 'react';
import ProtectedRoute from '../components/ProtectedRoute.tsx';

interface RecoveryGuardProps {
  children: React.ReactNode;
}

/**
 * RecoveryGuard - Strictly isolates the /recovery namespace.
 * Specialized Resolution, Restoration & Escalation: Dedicated recovery officers and governance admins.
 */
export default function RecoveryGuard({ children }: RecoveryGuardProps) {
  return (
    <ProtectedRoute
      allowedRoles={['recovery', 'support_escalation', 'administrator', 'admin']}
      portalTitle="Specialized Resolution & Restoration (/recovery)"
    >
      {children}
    </ProtectedRoute>
  );
}
