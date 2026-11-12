import React from 'react';

interface AdminLayoutProps {
  children?: React.ReactNode;
}

/**
 * AdminLayout - Clean passthrough for the /admin page.
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  return <>{children}</>;
}
