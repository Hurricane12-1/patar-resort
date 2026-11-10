import React from 'react';
import ProtectedRoute from '../components/ProtectedRoute.tsx';

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * AdminGuard - Strictly isolates the /admin namespace.
 * Governance & System Control: Only users with verified 'administrator' or 'admin' roles.
 */
export default function AdminGuard({ children }: AdminGuardProps) {
  return (
    <ProtectedRoute
      allowedRoles={['administrator', 'admin']}
      portalTitle="Governance & System Control (/admin)"
    >
      {children}
    </ProtectedRoute>
  );
}
