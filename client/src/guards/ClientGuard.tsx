import React from 'react';
import ResidentLogin from '../components/ResidentLogin.tsx';
import { useAuth } from '../context/AuthContext.tsx';

interface ClientGuardProps {
  children: React.ReactNode;
}

/**
 * ClientGuard - Strictly isolates the resident customer namespace (/client).
 * End-User Self-Service & Portal: Authenticated resident customers only.
 * When unauthenticated, renders the half-and-half deep blue marine Resident Guest Portal login.
 */
export default function ClientGuard({ children }: ClientGuardProps) {
  const { customerSession, customerProfile } = useAuth();
  const isAuthorized = Boolean(customerSession && customerProfile);

  if (isAuthorized) {
    return <>{children}</>;
  }

  return <ResidentLogin returnTo={window.location.pathname} />;
}
