import React from 'react';
import ProtectedRoute from '../components/ProtectedRoute.tsx';

interface StaffGuardProps {
  children: React.ReactNode;
}

/**
 * StaffGuard - Strictly isolates the /staff namespace.
 * Daily Operations & Execution: Authorized staff, receptionist, accounting, and admin roles.
 */
export default function StaffGuard({ children }: StaffGuardProps) {
  return (
    <ProtectedRoute
      allowedRoles={['staff', 'receptionist', 'accounting', 'administrator', 'admin']}
      portalTitle="Daily Operations & Execution (/staff)"
    >
      {children}
    </ProtectedRoute>
  );
}
