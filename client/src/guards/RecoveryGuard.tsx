import React from 'react';

interface RecoveryGuardProps {
  children: React.ReactNode;
}

/**
 * RecoveryGuard - Access handler for the /recovery namespace.
 * NO SEPARATE RECOVERY LOGIN:
 * Directly passes through to the recovery page which confirms active authentication status.
 */
export default function RecoveryGuard({ children }: RecoveryGuardProps) {
  return <>{children}</>;
}
