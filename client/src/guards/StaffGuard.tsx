import React from 'react';
import ProtectedRoute from '../components/ProtectedRoute.tsx';

interface StaffGuardProps {
  children: React.ReactNode;
  portal?: 'reception' | 'accounting' | 'operations';
  title?: string;
}

/**
 * StaffGuard - Isolates each /staff portal by employee department and role.
 */
export default function StaffGuard({ children, portal, title }: StaffGuardProps) {
  const portalTitles: Record<string, string> = {
    reception: 'Front Desk & Reception (/staff/reception)',
    accounting: 'Accounting & Finance (/staff/accounting)',
    operations: 'Department Operations (/staff/operations)',
  };

  const allowedRolesByPortal: Record<string, string[]> = {
    reception: ['receptionist', 'staff', 'administrator', 'admin'],
    accounting: ['accounting', 'administrator', 'admin'],
    operations: ['housekeeping', 'kitchen', 'tours', 'receptionist', 'staff', 'administrator', 'admin'],
  };

  const portalTitle = title || (portal ? portalTitles[portal] : 'Daily Operations & Execution (/staff)');
  const allowedRoles = portal
    ? allowedRolesByPortal[portal]
    : ['staff', 'receptionist', 'accounting', 'housekeeping', 'kitchen', 'tours', 'administrator', 'admin'];

  return (
    <ProtectedRoute
      allowedRoles={allowedRoles}
      requiredPortal={portal}
      portalTitle={portalTitle}
    >
      {children}
    </ProtectedRoute>
  );
}
