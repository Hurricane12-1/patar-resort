import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { getDefaultStaffPath } from './lib/rbac.ts';
import Navbar from './components/Navbar.tsx';
import Footer from './components/Footer.tsx';
import Chatbot from './components/Chatbot.tsx';
import AuthModal from './components/AuthModal.tsx';
import Toasts from './components/Toasts.tsx';
import TelemetryTracker from './components/TelemetryTracker.tsx';

// Namespace Guards (Role-Based Access Isolation)
import StaffGuard from './guards/StaffGuard.tsx';
import RecoveryGuard from './guards/RecoveryGuard.tsx';
import ClientGuard from './guards/ClientGuard.tsx';

// Namespace Layout Wrappers (Isolated Layouts)
import StaffLayout from './layouts/StaffLayout.tsx';
import RecoveryLayout from './layouts/RecoveryLayout.tsx';
import ClientLayout from './layouts/ClientLayout.tsx';

// Public Guest Pages
import MobileResortApp from './components/MobileResortApp.tsx';
import Home from './pages/Home.tsx';
import Rooms from './pages/Rooms.tsx';

// Namespace 1: /admin Pages (Governance & System Control)
import Admin from './pages/Admin.tsx';

// Namespace 2: /staff Pages (Daily Operations & Execution)
import ResortDepartment from './pages/ResortDepartment.tsx';
import Receptionist from './pages/Receptionist.tsx';
import Accounting from './pages/Accounting.tsx';
import StaffLogin from './pages/StaffLogin.tsx';

// Namespace 3: /recovery Pages (Specialized Resolution, Restoration & Escalation)
import RecoveryPortal from './pages/recovery/RecoveryPortal.tsx';

// Namespace 4: /client Pages (End-User Self-Service & Portal)
import ResortCustomer from './pages/ResortCustomer.tsx';
import MyBookings from './pages/MyBookings.tsx';
import ResidentLogin from './components/ResidentLogin.tsx';
import GuestPortalLayout from './components/guest/GuestPortalLayout.tsx';
import GuestStays from './pages/client/GuestStays.tsx';
import GuestProfile from './pages/client/GuestProfile.tsx';
import GuestHelp from './pages/client/GuestHelp.tsx';

function StaffPortalLanding() {
  const { adminProfile, profile } = useAuth();
  const active = adminProfile || profile;
  const target = getDefaultStaffPath(active);
  if (target === '/admin') {
    return (
      <StaffGuard portal="operations">
        <StaffLayout>
          <ResortDepartment />
        </StaffLayout>
      </StaffGuard>
    );
  }
  return <Navigate to={target} replace />;
}

function MainAppShell() {
  const location = useLocation();
  const path = location.pathname.toLowerCase();

  // Determine whether current route is within a dedicated portal or authentication namespace
  const isDedicatedPortal = ['/admin', '/staff', '/recovery', '/client', '/user'].some((p) =>
    path.startsWith(p)
  );

  // Check legacy routes being redirected
  const isLegacyInternal = [
    '/administrator',
    '/receptionist',
    '/accounting',
    '/resort-department',
    '/my-bookings',
    '/resort-customer',
  ].some((p) => path.startsWith(p));

  const isGuestHome = path === '/' || path === '/guest';
  const hideNavbarAndFooter = isDedicatedPortal || isLegacyInternal || isGuestHome;
  const hideChatbot = isDedicatedPortal || isLegacyInternal;

  return (
    <div className="app-shell">
      <TelemetryTracker />

      {/* Render Public Guest Navbar ONLY when not on Mobile App Home or Dedicated Internal Portals */}
      {!hideNavbarAndFooter && <Navbar />}

      <main>
        <Routes>
          {/* ============================================================ */}
          {/* PUBLIC GUEST INITIATION & EXPLORATION ROUTES (/guest & /)    */}
          {/* ============================================================ */}
          <Route path="/" element={<MobileResortApp />} />
          <Route path="/guest" element={<MobileResortApp />} />
          <Route path="/classic-home" element={<Home />} />
          <Route path="/rooms" element={<Rooms />} />

          {/* ============================================================ */}
          {/* NAMESPACE 1: /admin (Governance & System Control)            */}
          {/* ============================================================ */}
          {/* DEPRECATED ROUTE REDIRECT: /administrator is STRICTLY FORBIDDEN */}
          <Route path="/administrator" element={<Navigate to="/admin" replace />} />
          
          <Route path="/admin/*" element={<Admin />} />

          {/* ============================================================ */}
          {/* NAMESPACE 2: /staff (Daily Operations & Execution)           */}
          {/* ============================================================ */}
          <Route path="/staff/login" element={<StaffLogin />} />
          <Route path="/staff" element={
            <StaffGuard>
              <StaffPortalLanding />
            </StaffGuard>
          } />
          <Route path="/staff/operations" element={
            <StaffGuard portal="operations">
              <StaffLayout>
                <ResortDepartment />
              </StaffLayout>
            </StaffGuard>
          } />
          <Route path="/staff/reception" element={
            <StaffGuard portal="reception">
              <StaffLayout>
                <Receptionist />
              </StaffLayout>
            </StaffGuard>
          } />
          <Route path="/staff/accounting" element={
            <StaffGuard portal="accounting">
              <StaffLayout>
                <Accounting />
              </StaffLayout>
            </StaffGuard>
          } />

          {/* Legacy Staff Route Aliases -> Redirect to /staff/* */}
          <Route path="/resort-department" element={<Navigate to="/staff/operations" replace />} />
          <Route path="/receptionist" element={<Navigate to="/staff/reception" replace />} />
          <Route path="/accounting" element={<Navigate to="/staff/accounting" replace />} />

          {/* ============================================================ */}
          {/* NAMESPACE 3: /recovery (Resolution, Restoration & Escalation)*/}
          {/* ============================================================ */}
          <Route path="/recovery" element={
            <RecoveryGuard>
              <RecoveryLayout>
                <RecoveryPortal />
              </RecoveryLayout>
            </RecoveryGuard>
          } />
          <Route path="/recovery/cases" element={
            <RecoveryGuard>
              <RecoveryLayout>
                <RecoveryPortal />
              </RecoveryLayout>
            </RecoveryGuard>
          } />
          <Route path="/recovery/accounts" element={<Navigate to="/recovery" replace />} />
          <Route path="/recovery/audit" element={
            <RecoveryGuard>
              <RecoveryLayout>
                <RecoveryPortal />
              </RecoveryLayout>
            </RecoveryGuard>
          } />

          {/* ============================================================ */}
          {/* NAMESPACE 4: /client & /user (Resident Self-Service & Portal) */}
          {/* ============================================================ */}
          <Route path="/client/login" element={<ResidentLogin returnTo="/client" />} />
          <Route path="/user/login" element={<ResidentLogin returnTo="/client" />} />
          {/* Guest dashboard: stays first, then profile and help. Preview access is controlled by CLIENT_DIRECT_ACCESS. */}
          <Route path="/client" element={
            <ClientGuard allowPreview>
              <GuestPortalLayout />
            </ClientGuard>
          }>
            <Route index element={<GuestStays />} />
            <Route path="bookings" element={<GuestStays />} />
            <Route path="profile" element={<GuestProfile />} />
            <Route path="help" element={<GuestHelp />} />
            <Route path="requests" element={<Navigate to="/client/help" replace />} />
          </Route>
          {/* Previous resident portal, kept for reviews and refund requests (sign-in required) */}
          <Route path="/client/legacy" element={
            <ClientGuard>
              <ClientLayout>
                <ResortCustomer />
              </ClientLayout>
            </ClientGuard>
          } />
          <Route path="/client/legacy/bookings" element={
            <ClientGuard>
              <ClientLayout>
                <MyBookings />
              </ClientLayout>
            </ClientGuard>
          } />

          {/* User Route Aliases */}
          <Route path="/user" element={<Navigate to="/client" replace />} />
          <Route path="/user/bookings" element={<Navigate to="/client/bookings" replace />} />
          <Route path="/user/*" element={<Navigate to="/client" replace />} />
          <Route path="/my-bookings" element={<Navigate to="/client/bookings" replace />} />
          <Route path="/resort-customer" element={<Navigate to="/client" replace />} />

          {/* Fallback Catch-All */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Render Public Guest Footer & AI Concierge Chatbot */}
      {!hideNavbarAndFooter && <Footer />}
      {!hideChatbot && <Chatbot />}
      <AuthModal />
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppShell />
    </AuthProvider>
  );
}
