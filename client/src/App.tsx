import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.tsx';
import Navbar from './components/Navbar.tsx';
import Footer from './components/Footer.tsx';
import Chatbot from './components/Chatbot.tsx';
import AuthModal from './components/AuthModal.tsx';
import Toasts from './components/Toasts.tsx';
import TelemetryTracker from './components/TelemetryTracker.tsx';
import { NetworkStatusControl } from './components/NetworkStatusControl.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import MobileResortApp from './components/MobileResortApp.tsx';
import Home from './pages/Home.tsx';
import Rooms from './pages/Rooms.tsx';
import MyBookings from './pages/MyBookings.tsx';
import Admin from './pages/Admin.tsx';
import Accounting from './pages/Accounting.tsx';
import Receptionist from './pages/Receptionist.tsx';
import ResortDepartment from './pages/ResortDepartment.tsx';

function MainAppShell() {
  const location = useLocation();
  const isStaffRoute = ['/administrator', '/admin', '/receptionist', '/accounting', '/resort-department'].some((p) =>
    location.pathname.toLowerCase().startsWith(p)
  );
  const isGuestHome = location.pathname === '/';

  return (
    <div className="app-shell">
      <TelemetryTracker />

      {/* Render Public Guest Navbar ONLY when not on Mobile App Home or Staff Routes */}
      {!isStaffRoute && !isGuestHome && <Navbar />}

      <main>
        <Routes>
          <Route path="/" element={<MobileResortApp />} />
          <Route path="/classic-home" element={<Home />} />
          <Route path="/rooms" element={<Rooms />} />

          <Route path="/my-bookings" element={
            <ProtectedRoute allowedRoles={['customer']} portalTitle="My Bookings">
              <MyBookings />
            </ProtectedRoute>
          } />

          <Route path="/resort-customer" element={<Navigate to="/my-bookings" replace />} />

          <Route path="/resort-department" element={
            <ProtectedRoute allowedRoles={['staff', 'receptionist', 'accounting', 'administrator']} portalTitle="Operations & Department Hub">
              <ResortDepartment />
            </ProtectedRoute>
          } />

          <Route path="/administrator" element={
            <ProtectedRoute allowedRoles={['administrator']} portalTitle="Administrator Control Center">
              <Admin />
            </ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['administrator']} portalTitle="Administrator Control Center">
              <Admin />
            </ProtectedRoute>
          } />

          <Route path="/accounting" element={
            <ProtectedRoute allowedRoles={['accounting', 'administrator']} portalTitle="Accounting Audit & Ledger">
              <Accounting />
            </ProtectedRoute>
          } />

          <Route path="/receptionist" element={
            <ProtectedRoute allowedRoles={['receptionist', 'administrator']} portalTitle="Receptionist Desk">
              <Receptionist />
            </ProtectedRoute>
          } />
        </Routes>
      </main>

      {!isStaffRoute && !isGuestHome && <Footer />}
      {!isStaffRoute && <Chatbot />}
      <AuthModal />
      <Toasts />
      {!isGuestHome && <NetworkStatusControl />}
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
