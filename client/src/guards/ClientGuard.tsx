import React from 'react';
import ResidentLogin from '../components/ResidentLogin.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { CLIENT_DIRECT_ACCESS } from '../lib/guestPortal.ts';

interface ClientGuardProps {
  children: React.ReactNode;
  /**
   * Lets visitors open this route without signing in while CLIENT_DIRECT_ACCESS is on.
   * The guest dashboard uses it to show a clearly labelled, device-only preview.
   */
  allowPreview?: boolean;
}

/**
 * ClientGuard - Strictly isolates the resident customer namespace (/client).
 * End-User Self-Service & Portal: Authenticated resident customers only.
 * When unauthenticated, renders the half-and-half deep blue marine Resident Guest Portal login.
 */
export default function ClientGuard({ children, allowPreview = false }: ClientGuardProps) {
  const { customerSession, customerProfile } = useAuth();
  const isAuthorized = Boolean(customerSession && customerProfile);

  if (isAuthorized || (allowPreview && CLIENT_DIRECT_ACCESS)) {
    return <>{children}</>;
  }

  return <ResidentLogin returnTo={window.location.pathname} />;
}
