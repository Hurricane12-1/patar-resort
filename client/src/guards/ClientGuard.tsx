import React from 'react';
import ProtectedRoute from '../components/ProtectedRoute.tsx';

interface ClientGuardProps {
  children: React.ReactNode;
}

/**
 * ClientGuard - Strictly isolates the /client namespace.
 * End-User Self-Service & Portal: Authenticated resident customers only.
 * Clients never see internal operational controls.
 */
export default function ClientGuard({ children }: ClientGuardProps) {
  return (
    <ProtectedRoute
      allowedRoles={['customer']}
      portalTitle="Residents'"
      buttonText="Sign in to residents'"
    >
      {children}
    </ProtectedRoute>
  );
}
