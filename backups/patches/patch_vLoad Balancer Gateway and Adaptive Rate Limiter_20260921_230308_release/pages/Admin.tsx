import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth, generateAccountEmail } from '../context/AuthContext.tsx';
import '../styles/admin.css';
import { getThemePalette, getAdminStyles } from '../styles/modules/index.ts';
import { BarChart, AreaLineChart, MultiBarChart, DualLineChart, Sparkline, ReferrerCategoryBarChart, DonutChart, DualSplineWaveChart } from '../components/Charts.tsx';
import CsvTableViewer from '../components/CsvTableViewer.tsx';
import {
  IconDashboard, IconDining, IconUsers, IconTelemetry, IconLedger,
  IconCsv, IconSettings, IconSignOut, IconSearch, IconBell,
  IconSun, IconMoon, IconCrown, IconTrendingUp, IconCreditCard,
  IconWallet, IconBuilding, IconShield, IconBriefcase, DefaultUserAvatar
} from '../components/AdminIcons.tsx';
import { api } from '../lib/api.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { InterchangeableImagePicker } from '../components/InterchangeableImagePicker.tsx';
import CloudinarySettingsCard from '../components/CloudinarySettingsCard.tsx';
import { ExecutiveGuestChatModal } from '../components/ExecutiveGuestChatModal.tsx';
import { ExecutiveGuestConversationsPanel } from '../components/ExecutiveGuestConversationsPanel.tsx';
import { AnalyticsGlossaryModal } from '../components/AnalyticsGlossaryModal.tsx';
import { money, fmtDate, fmtTime } from '../lib/format.ts';
import { toast } from '../components/Toasts.tsx';
import { dispatchWordPrompt } from '../lib/wordPrompt.ts';

const emptyAnalytics = {
  overview: {
    arrivals_today: 0,
    departures_today: 0,
    occupancy_pct: 0,
    revenue_week_php: 0,
    total_revenue_php: 0,
    adr_php: 0,
    revpar_php: 0,
    room_revenue_php: 0,
    dining_revenue_php: 0,
    tour_revenue_php: 0,
    sms_delivered: 0,
  },
  daily: [],
  top: [],
  food_sales: [],
  bookings: [],
};

export default function Admin() {
  const { profile, signIn, signOut } = useAuth();
  const [data, setData] = useState(emptyAnalytics);
  const [loading, setLoading] = useState(false);

  // Custom Admin Login Form State
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  // Administrative Navigation Tabs, Sidebar & LIGHT/DARK THEME STATE
  const [activeTab, setActiveTab] = useState('overview'); // overview | food_sales | telemetry | accounts | settings | ledger | csv
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showGlossaryModal, setShowGlossaryModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isLightMode, setIsLightMode] = useState(() => {
    // Explicitly prioritize Executive White Theme as default
    const saved = localStorage.getItem('admin_theme_v2');
    if (saved === 'dark') return false;
    // Clear any stale legacy dark mode flag
    localStorage.removeItem('admin_theme_light');
    localStorage.setItem('admin_theme_v2', 'light');
    return true; // Executive Pure White Theme by default!
  });

  const toggleThemeMode = () => {
    const nextMode = !isLightMode;
    setIsLightMode(nextMode);
    localStorage.setItem('admin_theme_v2', nextMode ? 'light' : 'dark');
    toast(nextMode ? '☀️ Executive White Theme Activated' : '🌙 Dark Luxury Mode Activated');
  };

  // TWEAKABLE ADVANCED ADMIN PROFILE STATE (LIVE SYNCHRONIZED)
  const [adminProfileState, setAdminProfileState] = useState({
    fullName: profile?.full_name || 'Johannes Von Shicksal',
    title: 'General Manager & Executive Director',
    avatarKey: 'crown',
    customAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
    email: profile?.email || 'administrator@jdbeachhouse.ph',
    phone: profile?.phone || '+63 900 555 0123',
    department: 'Executive General Management',
    statusBio: 'Managing J & D Beach House Patar Beach Executive Operations 🌴',
    location: 'J & D Beach House - Patar Beach, Bolinao, Pangasinan',
    refreshRate: '5',
    smsNotifications: true,
    telemetryStream: true,
    twoFactorAuth: true,
    sessionTimeout: '30',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const avatarOptions = [
    { label: 'Executive Crown', key: 'crown', icon: <IconCrown size={22} color="#F59E0B" /> },
    { label: 'General Manager', key: 'manager', icon: <IconBriefcase size={22} color="#38BDF8" /> },
    { label: 'Tech Administrator', key: 'tech', icon: <IconTelemetry size={22} color="#10B981" /> },
    { label: 'Security Chief', key: 'security', icon: <IconShield size={22} color="#F43F5E" /> },
    { label: 'Operations Director', key: 'operations', icon: <IconBuilding size={22} color="#8B5CF6" /> },
  ];

  // Sample Datasets Matching Reference UI
  const salesOverviewData = [
    { label: 'Nov 15', value: 32 },
    { label: 'Nov 16', value: 40 },
    { label: 'Nov 17', value: 28 },
    { label: 'Nov 18', value: 50 },
    { label: 'Nov 19', value: 42 },
    { label: 'Nov 20', value: 92 },
    { label: 'Nov 21', value: 84 },
  ];

  const performanceData = [
    { day: 'Mon', target: 45, paid: 18, pending: 22 },
    { day: 'Tue', target: 68, paid: 28, pending: 15 },
    { day: 'Wed', target: 42, paid: 12, pending: 35 },
    { day: 'Thu', target: 78, paid: 15, pending: 40 },
    { day: 'Fri', target: 32, paid: 24, pending: 38 },
    { day: 'Sat', target: 52, paid: 35, pending: 48 },
    { day: 'Sun', target: 54, paid: 20, pending: 42 },
  ];

  const dualSalesData = [
    { month: 'Jan', lineA: 20, lineB: 15 },
    { month: 'Feb', lineA: 42, lineB: 38 },
    { month: 'Mar', lineA: 78, lineB: 65 },
    { month: 'Apr', lineA: 55, lineB: 50 },
    { month: 'May', lineA: 62, lineB: 58 },
    { month: 'Jun', lineA: 48, lineB: 52 },
    { month: 'Jul', lineA: 72, lineB: 45 },
    { month: 'Aug', lineA: 64, lineB: 68 },
    { month: 'Sep', lineA: 82, lineB: 75 },
    { month: 'Oct', lineA: 75, lineB: 70 },
    { month: 'Nov', lineA: 45, lineB: 62 },
    { month: 'Dec', lineA: 88, lineB: 78 },
  ];

  // Guest Conversations & Live Messaging State
  const [guestConversations, setGuestConversations] = useState([]);

  useEffect(() => {
    api.conversations().then((data) => {
      if (Array.isArray(data)) setGuestConversations(data);
    }).catch(() => {});
  }, []);

  // Interactive Chat Modal Active Guest State
  const [activeChatGuest, setActiveChatGuest] = useState(null);
  const [selectedPanelGuest, setSelectedPanelGuest] = useState(null);

  // Account Management State
  const [roleFilter, setRoleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  // Accounts Sub-Tab: 'staff' | 'customers'
  const [accountsSubTab, setAccountsSubTab] = useState('staff');

  // Chart Time Range Filter
  const [chartRange, setChartRange] = useState('30d');

  // Live Telemetry State
  const [telemetryLive, setTelemetryLive] = useState({
    cpuUsage: 24,
    memoryUsage: 58,
    diskUsage: 41,
    activeSessions: 14,
    dbLatency: 1.2,
    smsDispatches: 142,
    uptime: 99.97,
    requestsPerMin: 245,
    sparklineValues: [42, 65, 80, 110, 95, 140, 130, 175, 160, 210, 190, 245, 230],
    requestLog: [
      { id: 1, time: '09:01:12', method: 'GET', path: '/api/rooms', status: 200, ms: 12 },
      { id: 2, time: '09:01:14', method: 'POST', path: '/api/reservations', status: 201, ms: 45 },
      { id: 3, time: '09:01:18', method: 'GET', path: '/api/analytics/overview', status: 200, ms: 28 },
      { id: 4, time: '09:01:22', method: 'GET', path: '/api/reviews/recent', status: 200, ms: 15 },
      { id: 5, time: '09:01:25', method: 'POST', path: '/api/twilio/sms', status: 200, ms: 320 },
    ],
  });
  const telemetryLogIdRef = useRef(6);

  // Provision Staff Modal Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStaff, setNewStaff] = useState({
    first_name: '', middle_name: '', last_name: '', full_name: '',
    email: '', password: '', phone: '', role: 'receptionist',
  });
  const [creatingStaff, setCreatingStaff] = useState(false);

  // Account Recovery / Reset Password Modal State
  const [recoveryTarget, setRecoveryTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPass, setResettingPass] = useState(false);

  // Interactive Modals & Analytical Breakdown States
  const [selectedSalesItem, setSelectedSalesItem] = useState(null);
  const [showKeywordsModal, setShowKeywordsModal] = useState(false);
  const [showCampaignsModal, setShowCampaignsModal] = useState(false);

  useEffect(() => {
    if (profile && ['administrator', 'admin'].includes(profile.role)) {
      let live = true;
      let es = null;

      api.analyticsOverview()
        .then((d) => live && setData(d))
        .catch((e) => toast(e.message, true))
        .finally(() => live && setLoading(false));

      api.myNotifications()
        .then((n) => live && setNotifications(n))
        .catch(() => {});

      supabase.auth.getSession().then(({ data: authData }) => {
        const token = authData?.session?.access_token;
        if (token) {
          es = new EventSource(`/api/analytics/stream?token=${token}`);
          es.onmessage = (e) => {
            if (!live) return;
            try {
              const ov = JSON.parse(e.data);
              setData((prev) => (prev ? { ...prev, overview: ov } : prev));
            } catch {}
          };
        }
      });

      return () => {
        live = false;
        if (es) es.close();
      };
    } else {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (activeTab === 'accounts') {
      setSearchingUsers(true);
      api.adminCustomers(searchQuery)
        .then(setUsers)
        .catch((e) => toast(e.message, true))
        .finally(() => setSearchingUsers(false));
    }
  }, [activeTab, searchQuery, roleFilter]);

  // Live telemetry tick — update system gauges every 3s when telemetry tab is active
  useEffect(() => {
    if (activeTab !== 'telemetry') return;
    const endpoints = ['/api/rooms', '/api/reservations', '/api/analytics/overview', '/api/reviews/recent', '/api/twilio/sms', '/api/profiles', '/api/food-sales', '/api/telemetry/ping'];
    const methods = ['GET', 'GET', 'POST', 'GET', 'POST', 'GET', 'GET', 'GET'];
    const iv = setInterval(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const eIdx = Math.floor(Math.random() * endpoints.length);
      const newEntry = {
        id: telemetryLogIdRef.current++,
        time: timeStr,
        method: methods[eIdx],
        path: endpoints[eIdx],
        status: Math.random() > 0.05 ? 200 : 502,
        ms: Math.round(Math.random() * 60 + 5),
      };
      setTelemetryLive(prev => ({
        cpuUsage: Math.max(8, Math.min(95, prev.cpuUsage + (Math.random() - 0.5) * 12)),
        memoryUsage: Math.max(30, Math.min(88, prev.memoryUsage + (Math.random() - 0.5) * 6)),
        diskUsage: Math.max(35, Math.min(75, prev.diskUsage + (Math.random() - 0.5) * 2)),
        activeSessions: Math.max(3, Math.min(42, prev.activeSessions + Math.round((Math.random() - 0.45) * 4))),
        dbLatency: Math.max(0.3, Math.min(8, +(prev.dbLatency + (Math.random() - 0.5) * 1.2).toFixed(1))),
        smsDispatches: prev.smsDispatches + (Math.random() > 0.7 ? 1 : 0),
        uptime: 99.97,
        requestsPerMin: Math.max(80, Math.min(500, prev.requestsPerMin + Math.round((Math.random() - 0.45) * 30))),
        sparklineValues: [...prev.sparklineValues.slice(-24), prev.requestsPerMin + Math.round((Math.random() - 0.5) * 40)],
        requestLog: [...prev.requestLog.slice(-14), newEntry],
      }));
    }, 3000);
    return () => clearInterval(iv);
  }, [activeTab]);

  async function handleAdminCustomLogin(e) {
    e.preventDefault();
    setAuthenticating(true);
    try {
      const res = await signIn(adminEmail || 'administrator@jdbeachhouse.ph', adminPass || '1234');
      if (res?.error) throw res.error;
      toast('Administrator Portal Authenticated ✦');
    } catch (err) {
      toast(err.message || 'Authentication failed', true);
    } finally {
      setAuthenticating(false);
    }
  }

  const handleSaveSettings = (e) => {
    e.preventDefault();
    toast('⚙️ Executive Profile & Control Settings Live Synced ✦');
  };

  // DEDICATED SEPARATE ADMINISTRATOR LOGIN PORTAL
  if (!profile || !['administrator', 'admin'].includes(profile.role)) {
    return (
      <div className="container section">
        <div className="gate" style={{ maxWidth: 460, borderTop: '5px solid #0EA5E9' }}>
          <span className="label" style={{ color: '#38BDF8' }}>Executive System Control</span>
          <h2 className="serif" style={{ fontSize: '2.2rem', margin: '8px 0 12px' }}>Administrator Portal</h2>
          <p className="muted" style={{ marginBottom: 24, fontSize: '.92rem' }}>
            Restricted executive portal for resort general managers and administrators.
          </p>

          <form onSubmit={handleAdminCustomLogin} style={{ textAlign: 'left' }}>
            <div className="field">
              <label>ADMINISTRATOR EMAIL</label>
              <input
                type="email"
                required
                value={adminEmail}
                placeholder="administrator@jdbeachhouse.ph"
                onChange={(e) => setAdminEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label>SECURITY PASSWORD</label>
              <input
                type="password"
                required
                value={adminPass}
                placeholder="••••••••"
                onChange={(e) => setAdminPass(e.target.value)}
              />
            </div>
            <button className="btn btn-sky" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} disabled={authenticating}>
              {authenticating ? 'Verifying Security Credentials…' : 'Sign In to Executive Dashboard 👑'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="container section">
        <div className="skel" style={{ height: 120, marginBottom: 20 }} />
        <div className="skel" style={{ height: 320 }} />
      </div>
    );
  }

  const { overview: ov = {}, daily = [], top = [], food_sales = [], bookings = [] } = data;

  const chartData = daily.map((d) => ({
    label: d.day ? d.day.slice(8) : '',
    value: d.nights_sold || 0,
    fc: d.is_forecast,
    date: d.day,
    estimatedGuests: Math.round((d.nights_sold || 0) * 2.4),
  }));

  async function updateStatus(id, status) {
    try {
      await api.setReservationStatus(id, status);
      toast(`Reservation marked as ${status.replace('_', ' ')}`);
      setData((x) => ({
        ...x,
        bookings: x.bookings.map((b) => (b.id === id ? { ...b, status } : b)),
      }));
    } catch (e) { toast(e.message, true); }
  }

  async function handleProvisionStaff(e) {
    e.preventDefault();
    setCreatingStaff(true);
    try {
      const full_name = [newStaff.first_name, newStaff.middle_name, newStaff.last_name].filter(Boolean).join(' ') || newStaff.full_name || 'Staff User';
      const targetEmail = newStaff.email || generateAccountEmail(newStaff.first_name, newStaff.middle_name, newStaff.last_name, users.length + 1);
      const created = await api.createStaffAccount({ ...newStaff, full_name, email: targetEmail });
      toast(`Staff Account Created for ${created.full_name || full_name} (${created.role}) ✦`);
      setUsers((prev) => [created, ...prev]);
      setShowCreateModal(false);
      setNewStaff({ first_name: '', middle_name: '', last_name: '', full_name: '', email: '', password: '', phone: '', role: 'receptionist' });
    } catch (err) { toast(err.message, true); }
    finally { setCreatingStaff(false); }
  }

  async function handleRoleChange(userId, newRole) {
    try {
      await api.updateUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      toast(`User role updated to ${newRole} ✦`);
    } catch (err) { toast(err.message, true); }
  }

  async function handlePasswordRecovery(e) {
    e.preventDefault();
    if (!recoveryTarget || !newPassword) return;
    setResettingPass(true);
    try {
      await api.resetUserPassword(recoveryTarget.id, newPassword);
      toast(`Password Reset & SMS Recovery Ping sent to ${recoveryTarget.full_name} ✦`);
      setRecoveryTarget(null);
      setNewPassword('');
    } catch (err) { toast(err.message, true); }
    finally { setResettingPass(false); }
  }

  const sidebarItems = [
    { key: 'overview', label: 'Dashboard', icon: <IconDashboard size={19} /> },
    { key: 'conversations', label: 'Customer Services', icon: <span style={{ fontSize: '1.1rem' }}>💬</span> },
    { key: 'food_sales', label: 'Dining Sales', icon: <IconDining size={19} /> },
    { key: 'accounts', label: 'Staff & Accounts', icon: <IconUsers size={19} /> },
    { key: 'telemetry', label: 'Telemetry Stream', icon: <IconTelemetry size={19} /> },
    { key: 'ledger', label: 'Reservations Ledger', icon: <IconLedger size={19} /> },
    { key: 'csv', label: 'CSV Explorer', icon: <IconCsv size={19} /> },
    { key: 'settings', label: 'Profile & Settings', icon: <IconSettings size={19} /> },
  ];

  // THEME COLOR PALETTE TOKENS
  const themeBg = isLightMode ? '#F8FAFC' : '#020617';
  const themeSidebarBg = isLightMode ? '#FFFFFF' : 'rgba(15, 23, 42, 0.95)';
  const themeHeaderBg = isLightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.9)';
  const themeCardBg = isLightMode ? '#FFFFFF' : 'rgba(15, 23, 42, 0.85)';
  const themeText = isLightMode ? '#0F172A' : '#F8FAFC';
  const themeMuted = isLightMode ? '#64748B' : '#94A3B8';
  const themeBorder = isLightMode ? '#E2E8F0' : 'rgba(255, 255, 255, 0.1)';
  const themeShadow = isLightMode ? '0 4px 20px rgba(0, 0, 0, 0.05)' : 'none';

  return (
    <div className={`admin-portal ${isLightMode ? 'light-mode' : 'dark-mode'}`} style={{ display: 'flex', minHeight: '100vh', width: '100%', overflowX: 'hidden', background: themeBg, color: themeText, transition: 'background 0.3s ease, color 0.3s ease' }}>
      {/* MOBILE SIDEBAR BACKDROP OVERLAY */}
      {sidebarMobileOpen && (
        <div
          onClick={() => setSidebarMobileOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 998,
          }}
        />
      )}

      {/* 1. VERTICAL EXECUTIVE SAAS SIDEBAR NAVIGATION BAR */}
      <aside
        className={`sidebar ${sidebarMobileOpen ? 'mobile-open' : ''}`}
        style={{
          width: sidebarCollapsed ? 76 : 240,
          background: themeSidebarBg,
          borderRight: `1px solid ${themeBorder}`,
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.25s ease',
          zIndex: 1000,
          position: 'sticky',
          top: 0,
          height: '100vh',
          boxShadow: themeShadow,
        }}
      >
        {/* SIDEBAR LOGO BRANDING */}
        <div style={{ padding: '18px 16px', display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', borderBottom: `1px solid ${themeBorder}` }}>
          <div
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title="Click to toggle sidebar expand/collapse"
            style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #4338CA, #6366F1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFF',
                fontWeight: 900,
                fontSize: '1.2rem',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                transition: 'transform 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              ~
            </span>
            {!sidebarCollapsed && (
              <div>
                <b style={{ fontSize: '1.05rem', color: themeText, display: 'block', fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1 }}>
                  J & D SAAS
                </b>
                <span style={{ fontSize: '.62rem', color: '#6366F1', fontWeight: 800, letterSpacing: '.08em' }}>EXECUTIVE HUB</span>
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              style={{
                background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.06)',
                border: 'none',
                color: themeMuted,
                width: 28,
                height: 28,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '.8rem',
                cursor: 'pointer',
              }}
            >
              ◀
            </button>
          )}
        </div>

        {/* SIDEBAR MENU NAVIGATION ITEMS */}
        <nav style={{ padding: '16px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {!sidebarCollapsed && (
            <span style={{ fontSize: '.68rem', color: themeMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.18em', margin: '4px 8px 8px' }}>
              EXECUTIVE MENU
            </span>
          )}
          {sidebarItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: sidebarCollapsed ? '10px' : '10px 14px',
                  borderRadius: 12,
                  border: isActive ? '1px solid #4338CA' : '1px solid transparent',
                  background: isActive ? 'linear-gradient(135deg, #4338CA, #6366F1)' : 'transparent',
                  color: isActive ? '#FFFFFF' : themeMuted,
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  width: '100%',
                  boxShadow: isActive ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', color: isActive ? '#FFFFFF' : '#6366F1' }}>
                    {item.icon}
                  </span>
                  {!sidebarCollapsed && <span style={{ color: isActive ? '#FFFFFF' : themeText, fontWeight: isActive ? 800 : 600 }}>{item.label}</span>}
                </div>

                {/* NOTIFICATION BADGE / ACTIVE PILL DOT */}
                {!sidebarCollapsed && (item.key === 'accounts' || item.key === 'conversations') && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      background: item.key === 'conversations'
                        ? 'linear-gradient(135deg, #6366F1, #4338CA)'
                        : 'linear-gradient(135deg, #F43F5E, #E11D48)',
                      color: '#FFFFFF',
                      fontSize: '.68rem',
                      fontWeight: 800,
                      minWidth: 20,
                      height: 20,
                      borderRadius: 10,
                      padding: '0 7px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      boxShadow: item.key === 'conversations'
                        ? '0 2px 8px rgba(99, 102, 241, 0.45)'
                        : '0 2px 8px rgba(244, 63, 94, 0.45)',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                    }}
                  >
                    {item.key === 'conversations' ? 9 : 4}
                  </span>
                )}
                {isActive && sidebarCollapsed && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFF' }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* SIDEBAR FOOTER: FLOATING HELP BUTTON & SIGN OUT */}
        <div style={{ padding: 14, borderTop: `1px solid ${themeBorder}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* FLOATING HELP BUTTON MATCHING REFERENCE UI */}
          <button
            onClick={() => toast('❓ Help & Support Center: Contacting Executive AI Assistant')}
            style={{
              width: sidebarCollapsed ? 44 : '100%',
              height: 40,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #4338CA, #6366F1)',
              color: '#FFF',
              border: 'none',
              fontWeight: 800,
              fontSize: '.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
              margin: '0 auto',
            }}
          >
            <span>❓</span>
            {!sidebarCollapsed && <span style={{ fontSize: '.82rem' }}>Help & Support</span>}
          </button>

          <button
            onClick={signOut}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 10,
              border: '1px solid rgba(244,63,94,0.3)',
              background: 'rgba(244,63,94,0.1)',
              color: '#FB7185',
              fontWeight: 700,
              fontSize: '.84rem',
              cursor: 'pointer',
            }}
          >
            <IconSignOut size={18} color="#FB7185" />
            {!sidebarCollapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* 2. MAIN EXECUTIVE CONTENT WRAPPER */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* TOP EXECUTIVE HEADER CONTROL BAR WITH NOTIFICATIONS, PROFILE & THEME TOGGLE */}
        <header
          style={{
            height: 64,
            background: themeHeaderBg,
            borderBottom: `1px solid ${themeBorder}`,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 90,
            backdropFilter: 'blur(12px)',
            boxShadow: themeShadow,
          }}
        >
          {/* SEARCH & BREADCRUMB */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setSidebarMobileOpen(!sidebarMobileOpen)}
              className="mobile-menu-btn"
              title="Toggle sidebar navigation"
            >
              ☰
            </button>
            <span className="admin-header-title" style={{ fontSize: '.88rem', color: themeMuted, fontWeight: 600 }}>
              Executive Control Center <span style={{ color: '#0EA5E9' }}>/ {sidebarItems.find(i => i.key === activeTab)?.label}</span>
            </span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                className="search admin-header-search"
                placeholder="Search analytics, guests, or stays…"
                style={{ width: 240, maxWidth: '100%', padding: '6px 12px 6px 32px', fontSize: '.8rem', borderRadius: 20, background: isLightMode ? '#F1F5F9' : undefined, color: themeText, border: `1px solid ${themeBorder}` }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span style={{ position: 'absolute', left: 10, display: 'flex', alignItems: 'center', color: themeMuted }}>
                <IconSearch size={15} />
              </span>
            </div>
          </div>

          {/* TOP RIGHT CONTROLS: LIGHT/DARK THEME TOGGLE, NOTIFICATION BAR & AVATAR */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* LIGHT MODE / DARK MODE TOGGLE BUTTON */}
            <button
              onClick={toggleThemeMode}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 20,
                border: `1px solid ${themeBorder}`,
                background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.08)',
                color: themeText,
                fontWeight: 700,
                fontSize: '.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Toggle Executive White / Dark Theme"
            >
              {isLightMode ? <IconSun size={16} color="#F59E0B" /> : <IconMoon size={16} color="#38BDF8" />}
              <span>{isLightMode ? 'White Mode' : 'Dark Mode'}</span>
            </button>

            {/* NOTIFICATION BAR ICON & DROPDOWN */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  background: isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${themeBorder}`,
                  color: themeText,
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <IconBell size={18} color={themeText} />
                {notifications.length > 0 && (
                  <span style={{ position: 'absolute', top: 2, right: 2, background: '#F43F5E', color: '#FFF', borderRadius: '50%', width: 16, height: 16, fontSize: '.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* NOTIFICATION PANELS DROPDOWN */}
              {showNotifications && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 48,
                    width: 320,
                    background: themeSidebarBg,
                    border: `1px solid ${themeBorder}`,
                    borderRadius: 14,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                    padding: 14,
                    zIndex: 200,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${themeBorder}`, paddingBottom: 8, marginBottom: 10 }}>
                    <b style={{ fontSize: '.88rem', color: themeText }}>Executive Notifications (SMS & System)</b>
                    <small style={{ color: '#0EA5E9', fontSize: '.72rem' }}>Live SSE</small>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="muted small" style={{ margin: 0, padding: 10 }}>No new notifications.</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} style={{ padding: '8px 0', borderBottom: `1px solid ${themeBorder}`, fontSize: '.78rem' }}>
                        <span className={`pill ${n.status}`}>{n.status}</span>{' '}
                        <span style={{ color: themeMuted }}>{fmtTime(n.created_at)}</span> — {n.body}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* ADMIN PROFILE AVATAR & BADGE WITH LIVE NAME & PICTURE SYNCHRONIZATION */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.05)', padding: '4px 14px 4px 6px', borderRadius: 20, border: `1px solid ${themeBorder}` }}>
              {adminProfileState.customAvatarUrl ? (
                <img src={adminProfileState.customAvatarUrl} alt="Admin Avatar" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #0EA5E9, #38BDF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
                  <IconCrown size={18} color="#FFF" />
                </span>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <b style={{ fontSize: '.84rem', color: themeText }}>{adminProfileState.fullName.split(' ')[0]}</b>
                <span style={{ fontSize: '.62rem', color: '#0EA5E9', fontWeight: 800, letterSpacing: '.05em' }}>ADMINISTRATOR</span>
              </div>
            </div>
          </div>
        </header>

        {/* 3. DASHBOARD MAIN TAB VIEW */}
        <div className="admin-main-content" style={{ padding: '24px 24px 90px 24px', flex: 1, width: '100%', boxSizing: 'border-box' }}>
          {/* TAB 1: EXECUTIVE SAAS DASHBOARD (MATCHING 2026 REFERENCE SYSTEM) */}
          {activeTab === 'overview' && (
            <>
              {/* TOP BANNER & PERFORMANCE BAND (RESPONSIVE GRID) */}
              <div className="admin-grid-top-banner">
                {/* Left Card: Welcome Back Banner Card */}
                <div
                  className="panel-card"
                  style={{
                    background: isLightMode ? '#FFFFFF' : 'linear-gradient(135deg, #4338CA, #6366F1)',
                    border: isLightMode ? `1px solid ${themeBorder}` : 'none',
                    borderRadius: 18,
                    padding: '24px 28px',
                    color: isLightMode ? '#0F172A' : '#FFFFFF',
                    boxShadow: isLightMode ? themeShadow : '0 10px 25px rgba(99, 102, 241, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: '.78rem', color: isLightMode ? '#64748B' : 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>
                    Date range: last 30 days
                  </span>
                  <h2 style={{ fontSize: '1.7rem', margin: '6px 0 8px', color: isLightMode ? '#0F172A' : '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>
                    Welcome back <br />
                    {adminProfileState.fullName}!
                  </h2>
                  <p style={{ margin: 0, fontSize: '.9rem', color: isLightMode ? '#334155' : 'rgba(255,255,255,0.95)', lineHeight: 1.4 }}>
                    You've solved <b style={{ textDecoration: 'underline', color: isLightMode ? '#0F172A' : '#FFFFFF' }}>80% of resort operations & guest inquiries</b> this month!
                    Keep it up and improve your performance!
                  </p>
                </div>

                {/* Right Card: Dark Midnight Metric Box */}
                <div
                  className="panel-card"
                  style={{
                    background: isLightMode ? '#1E293B' : 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 18,
                    padding: 22,
                    color: '#F8FAFC',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '.72rem', color: '#94A3B8', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                      AVERAGE TIME FOR FIRST REPLY
                    </span>
                    <b style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.6rem', color: '#FFF', margin: '4px 0 2px' }}>
                      ⏱️ 1.8 mins <small style={{ fontSize: '.74rem', color: '#10B981', fontWeight: 600 }}>⚡ 4.2 mins faster than team avg (-68%)</small>
                    </b>
                  </div>

                  {/* Micro Sparkline Wave */}
                  <div style={{ marginTop: 10 }}>
                    <Sparkline values={[85, 70, 58, 45, 36, 28, 22, 18, 15, 12, 10]} width={340} height={50} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, fontSize: '.68rem', marginTop: 4 }}>
                      <span style={{ color: '#38BDF8', display: 'flex', alignItems: 'center', gap: 4 }}>● My response time</span>
                      <span style={{ color: '#6366F1', display: 'flex', alignItems: 'center', gap: 4 }}>● Team average</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* OVERVIEW METRIC CARDS (RESPONSIVE 4-CARD GRID) */}
              <div className="admin-grid-metrics-4">
                {/* Card 1: 80% Automation Rate */}
                <div
                  className="panel-card kpi-card"
                  onClick={() => toast('🤖 Automation Rate: 80% AI Chatbot Resolution Engine')}
                  style={{
                    background: themeCardBg,
                    border: `1px solid ${themeBorder}`,
                    borderRadius: 16,
                    padding: 20,
                    cursor: 'pointer',
                    boxShadow: themeShadow,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <b style={{ fontSize: '2rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'block', lineHeight: 1 }}>
                        80%
                      </b>
                      <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 4, display: 'block' }}>
                        AUTOMATION RATE
                      </span>
                    </div>
                    <span style={{ fontSize: '1.6rem', padding: 8, background: 'rgba(99, 102, 241, 0.1)', borderRadius: 12 }}>🤖</span>
                  </div>
                  <span style={{ fontSize: '.74rem', color: '#10B981', fontWeight: 600, marginTop: 10, display: 'block' }}>
                    ⇧ 16% <small style={{ color: themeMuted }}>from previous 30 days</small>
                  </span>
                </div>

                {/* Card 2: 240 Bookings Made Via Chat */}
                <div
                  className="panel-card kpi-card"
                  onClick={() => {
                    setActiveTab('ledger');
                    toast('🔖 240 Bookings placed via Resort Assistant Chatbot');
                  }}
                  style={{
                    background: themeCardBg,
                    border: `1px solid ${themeBorder}`,
                    borderRadius: 16,
                    padding: 20,
                    cursor: 'pointer',
                    boxShadow: themeShadow,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <b style={{ fontSize: '2rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'block', lineHeight: 1 }}>
                        240
                      </b>
                      <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 4, display: 'block' }}>
                        BOOKINGS MADE VIA CHAT
                      </span>
                    </div>
                    <span style={{ fontSize: '1.6rem', padding: 8, background: 'rgba(56, 189, 248, 0.1)', borderRadius: 12 }}>🔖</span>
                  </div>
                  <span style={{ fontSize: '.74rem', color: '#F43F5E', fontWeight: 600, marginTop: 10, display: 'block' }}>
                    ⇩ -6% <small style={{ color: themeMuted }}>from previous 30 days</small>
                  </span>
                </div>

                {/* Card 3: 85% Chatbot CSAT Score */}
                <div
                  className="panel-card kpi-card"
                  onClick={() => toast('😊 Chatbot CSAT Score: 85% Guest Satisfaction Rating')}
                  style={{
                    background: themeCardBg,
                    border: `1px solid ${themeBorder}`,
                    borderRadius: 16,
                    padding: 20,
                    cursor: 'pointer',
                    boxShadow: themeShadow,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <b style={{ fontSize: '2rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'block', lineHeight: 1 }}>
                        85%
                      </b>
                      <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 4, display: 'block' }}>
                        CHATBOT CSAT SCORE
                      </span>
                    </div>
                    <span style={{ fontSize: '1.6rem', padding: 8, background: 'rgba(52, 211, 153, 0.1)', borderRadius: 12 }}>😊</span>
                  </div>
                  <span style={{ fontSize: '.74rem', color: '#10B981', fontWeight: 600, marginTop: 10, display: 'block' }}>
                    ⇧ 17% <small style={{ color: themeMuted }}>from previous 30 days</small>
                  </span>
                </div>

                {/* Card 4: 21,648 Conversations Closed */}
                <div
                  className="panel-card kpi-card"
                  onClick={() => {
                    setActiveTab('telemetry');
                    toast('👥 21,648 Operations Conversations Handled');
                  }}
                  style={{
                    background: themeCardBg,
                    border: `1px solid ${themeBorder}`,
                    borderRadius: 16,
                    padding: 20,
                    cursor: 'pointer',
                    boxShadow: themeShadow,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <b style={{ fontSize: '2rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'block', lineHeight: 1 }}>
                        21 648
                      </b>
                      <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 4, display: 'block' }}>
                        CONVERSATIONS CLOSED BY TEAM
                      </span>
                    </div>
                    <span style={{ fontSize: '1.6rem', padding: 8, background: 'rgba(245, 158, 11, 0.1)', borderRadius: 12 }}>👥</span>
                  </div>
                  <span style={{ fontSize: '.74rem', color: '#10B981', fontWeight: 600, marginTop: 10, display: 'block' }}>
                    ⇧ 150% <small style={{ color: themeMuted }}>from previous 30 days</small>
                  </span>
                </div>
              </div>

              {/* MAIN 2-COLUMN SPLIT VIEW (RESPONSIVE SPLIT) */}
              <div className="admin-grid-split-2">
                {/* LEFT COLUMN: CONVERSATIONS EVOLUTION & SALES / PERFORMANCE ROW */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* CONVERSATIONS EVOLUTION (DUAL WAVE CHART) */}
                  {/* CONVERSATIONS EVOLUTION (DUAL WAVE CHART WITH INTERACTIVE ANALYTICAL BREAKDOWN) */}
                  <div className="panel panel-card" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 18, padding: 22, boxShadow: themeShadow, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <DualSplineWaveChart
                      height={220}
                      isLightMode={isLightMode}
                      onPointClick={(item) => toast(`📊 Inspection for ${item.periodLabel}: ${item.total} total chats (${item.auto} AI, ${item.staff} staff)`)}
                    />
                  </div>

                  {/* SALES OVERVIEW & PERFORMANCE DUAL ROW */}
                  <div className="admin-grid-dual-cards">
                    <div className="panel panel-card" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 20, boxShadow: themeShadow, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <h4 style={{ fontSize: '1.05rem', margin: '0 0 2px', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>
                            Sales Overview
                          </h4>
                          <span style={{ fontSize: '.72rem', color: themeMuted }}>Total revenue this month</span>
                        </div>
                        <span
                          onClick={() => toast('📈 Monthly Revenue Growth Rate: +18.4% YoY increase driven by online villa bookings')}
                          style={{ fontSize: '.78rem', color: '#10B981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: 8, cursor: 'pointer' }}
                          title="Click for revenue growth summary"
                        >
                          ↑ 18.4%
                        </span>
                      </div>
                      <AreaLineChart 
                        data={salesOverviewData} 
                        height={150} 
                        onPointClick={(item) => {
                          const salesInsightsMap = {
                            'Nov 15': 'Baseline weekend booking revenue from 14 Nipa Cove cottage stays.',
                            'Nov 16': 'Inbound demand surge for Habagat Sea-View Suite weekend getaways.',
                            'Nov 17': 'Mid-week lull; steady dining revenue from J & D Beach Bar.',
                            'Nov 18': 'Corporate retreat booking deposit for 15 guests.',
                            'Nov 19': 'Private outrigger boat tour bookings & sunset cocktail packages.',
                            'Nov 20': 'MONTHLY HIGH: ₱92,000 revenue! Driven by Patar Beach Festival weekend villa reservations.',
                            'Nov 21': 'Strong Sunday check-out extension revenue & souvenirs.',
                          };
                          setSelectedSalesItem({
                            ...item,
                            insight: salesInsightsMap[item.label] || 'High guest booking revenue recorded.',
                            revenuePhp: item.value * 1000,
                            nights: Math.round(item.value * 0.4),
                          });
                          toast(`📈 Sales Insight ${item.label}: ₱${(item.value * 1000).toLocaleString()}`);
                        }}
                      />
                      {selectedSalesItem && (
                        <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: isLightMode ? '#F1F5F9' : 'rgba(15,23,42,0.85)', border: '1px solid rgba(56,189,248,0.35)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <b style={{ fontSize: '.84rem', color: '#38BDF8' }}>📊 Revenue Analytical Meaning ({selectedSalesItem.label})</b>
                            <button onClick={() => setSelectedSalesItem(null)} style={{ background: 'none', border: 'none', color: themeMuted, cursor: 'pointer', fontSize: '.74rem', fontWeight: 700 }}>✕ Close</button>
                          </div>
                          <div style={{ display: 'flex', gap: 14, fontSize: '.78rem', marginBottom: 6 }}>
                            <span>Revenue: <b style={{ color: '#10B981' }}>₱{selectedSalesItem.revenuePhp.toLocaleString()}</b></span>
                            <span>Est. Room Nights: <b style={{ color: '#38BDF8' }}>{selectedSalesItem.nights} nights</b></span>
                          </div>
                          <p style={{ margin: 0, fontSize: '.76rem', color: themeText, lineHeight: 1.4 }}>
                            💡 <b>Driver:</b> {selectedSalesItem.insight}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="panel panel-card" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 20, boxShadow: themeShadow, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <h4 style={{ fontSize: '1.05rem', margin: '0 0 2px', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>
                            Weekly Performance
                          </h4>
                          <span style={{ fontSize: '.72rem', color: themeMuted }}>Staff reply efficiency score</span>
                        </div>
                        <span style={{ fontSize: '.78rem', color: '#6366F1', fontWeight: 700, background: 'rgba(99, 102, 241, 0.12)', padding: '2px 8px', borderRadius: 8 }}>
                          94% Optimal
                        </span>
                      </div>
                      <MultiBarChart 
                        data={performanceData} 
                        height={160} 
                        onBarClick={(group) => toast(`📊 ${group.day} Performance — Target: ${group.target}%, Paid: ${group.paid}%, Pending: ${group.pending}%`)}
                      />
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: OPEN CONVERSATIONS & GUEST INBOX */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* OPEN CONVERSATIONS LIST */}
                  <div className="panel panel-card" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 18, padding: 22, boxShadow: themeShadow, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <span style={{ fontSize: '.72rem', color: '#6366F1', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                            OPEN CONVERSATIONS
                          </span>
                          <h3 style={{ fontSize: '1.4rem', margin: 0, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>
                            9 Conversations to Solve!
                          </h3>
                        </div>
                        <span style={{
                          fontSize: '.72rem', color: isLightMode ? '#4338CA' : '#A5B4FC',
                          background: isLightMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(30, 58, 138, 0.5)',
                          border: `1px solid ${isLightMode ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.4)'}`,
                          padding: '4px 12px', borderRadius: 20,
                          fontWeight: 800, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 4
                        }}>
                          ⚡ {guestConversations.length} ACTIVE
                        </span>
                      </div>

                      <p style={{ margin: '0 0 16px', fontSize: '.8rem', color: themeMuted, lineHeight: 1.4 }}>
                        Start resolving your open conversations now and boost your average client's CSAT score.
                      </p>

                      {/* Guest Items - Sleek Custom Scrollable Container */}
                      <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16, maxHeight: 420, overflowY: 'auto', paddingRight: 6 }}>
                        {guestConversations.length === 0 ? (
                          <div style={{
                            padding: '36px 16px',
                            textAlign: 'center',
                            background: isLightMode ? '#F8FAFC' : 'rgba(15, 23, 42, 0.7)',
                            borderRadius: 16,
                            border: `1px dashed ${themeBorder}`,
                          }}>
                            <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: 8 }}>💬</span>
                            <b style={{ fontSize: '.9rem', color: themeText, display: 'block', marginBottom: 4 }}>No Active Conversations</b>
                            <span style={{ fontSize: '.76rem', color: themeMuted }}>Live messaging inquiries from guests will appear here.</span>
                          </div>
                        ) : (
                          guestConversations.map((g, idx) => {
                          const isHighlighted = activeChatGuest?.id === g.id || g.name === 'Alex Rivera';
                          return (
                            <div
                              key={g.id}
                              onClick={() => {
                                setSelectedPanelGuest(g);
                                setActiveChatGuest(null);
                                setActiveTab('conversations');
                                toast(`💬 Opened conversation thread for ${g.name}`);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '14px 16px',
                                background: isHighlighted
                                  ? (isLightMode ? '#DBEAFE' : 'rgba(30, 58, 138, 0.35)')
                                  : (isLightMode ? '#F8FAFC' : 'rgba(15, 23, 42, 0.7)'),
                                borderRadius: 16,
                                border: isHighlighted
                                  ? '1px solid #3B82F6'
                                  : `1px solid ${themeBorder}`,
                                boxShadow: isHighlighted
                                  ? (isLightMode ? '0 4px 14px rgba(59, 130, 246, 0.2)' : '0 0 14px rgba(59, 130, 246, 0.3)')
                                  : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!isHighlighted) {
                                  e.currentTarget.style.borderColor = '#3B82F6';
                                  e.currentTarget.style.boxShadow = isLightMode ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 0 12px rgba(59, 130, 246, 0.25)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isHighlighted) {
                                  e.currentTarget.style.borderColor = themeBorder;
                                  e.currentTarget.style.boxShadow = 'none';
                                }
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{ position: 'relative' }}>
                                  <DefaultUserAvatar
                                    size={44}
                                    bg={isLightMode ? '#CBD5E1' : 'rgba(255, 255, 255, 0.15)'}
                                    iconColor={isLightMode ? '#475569' : '#FFFFFF'}
                                  />
                                  <span style={{
                                    position: 'absolute', bottom: 0, right: 0, width: 12, height: 12,
                                    borderRadius: '50%', background: '#10B981', border: `2px solid ${isLightMode ? '#FFF' : '#0F172A'}`,
                                    zIndex: 2
                                  }} />
                                </div>
                                <div>
                                  <b style={{ fontSize: '.95rem', color: isHighlighted ? (isLightMode ? '#1E3A8A' : '#FFFFFF') : themeText, display: 'block', fontWeight: 700, lineHeight: 1.2 }}>
                                    {g.name}
                                  </b>
                                  <span style={{ fontSize: '.78rem', color: themeMuted, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {g.channel}
                                    <span style={{ opacity: 0.4, margin: '0 2px' }}>|</span>
                                    <span>💬</span>
                                    <span>{g.resort}</span>
                                  </span>
                                </div>
                              </div>

                              <span style={{
                                fontSize: '.78rem',
                                color: '#FFFFFF',
                                background: isLightMode ? '#334155' : 'rgba(30, 41, 59, 0.8)',
                                border: `1px solid ${isLightMode ? '#475569' : 'rgba(255, 255, 255, 0.15)'}`,
                                padding: '6px 14px',
                                borderRadius: 20,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}>
                                {g.timeAgo}
                              </span>
                            </div>
                          );
                        }))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: `1px solid ${themeBorder}` }}>
                      <button
                        onClick={() => {
                          setSelectedPanelGuest(guestConversations[0] || null);
                          setActiveChatGuest(null);
                          setActiveTab('conversations');
                          toast('💬 Navigated to Guest Conversations Inbox Panel Page');
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#6366F1',
                          fontSize: '.86rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: 0,
                          transition: 'gap 0.2s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.gap = '10px')}
                        onMouseLeave={(e) => (e.currentTarget.style.gap = '6px')}
                      >
                        view more ➔
                      </button>
                      <small style={{ fontSize: '.72rem', color: themeMuted }}>Click item to launch chat thread</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4: BOTTOM THREE DIAGNOSTIC PANELS (RESPONSIVE 3-PANEL GRID) */}
              <div className="admin-grid-bottom-3">
                {/* Panel 1: Summary Category Pills */}
                <div className="panel panel-card" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 20, boxShadow: themeShadow, minWidth: 0 }}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: 14, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>Summary</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div
                      onClick={() => {
                        setActiveTab('telemetry');
                        toast('📊 Switched to Live System Telemetry Audit');
                      }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: isLightMode ? '#F0F9FF' : 'rgba(56,189,248,0.15)', borderRadius: 12, color: isLightMode ? '#0284C7' : '#0EA5E9', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease', border: `1px solid ${isLightMode ? '#BAE6FD' : 'rgba(56,189,248,0.3)'}` }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      title="Click to view full System Telemetry Audit"
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.92rem' }}>📊 Overview</span>
                      <span className="pill" style={{ background: '#0EA5E9', color: '#FFFFFF', fontWeight: 800, padding: '4px 12px', borderRadius: 16, fontSize: '.8rem' }}>1,248 pings</span>
                    </div>

                    <div
                      onClick={() => {
                        setShowCreateModal(true);
                        toast('📁 Opening Provision Staff Account & Department Group modal');
                      }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: isLightMode ? '#FFF1F2' : 'rgba(244,63,94,0.15)', borderRadius: 12, color: isLightMode ? '#E11D48' : '#F43F5E', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease', border: `1px solid ${isLightMode ? '#FECDD3' : 'rgba(244,63,94,0.3)'}` }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      title="Click to add a new Staff / Department Group Account"
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.92rem' }}>📁 Add Group</span>
                      <span className="pill" style={{ background: '#F43F5E', color: '#FFFFFF', fontWeight: 800, padding: '4px 12px', borderRadius: 16, fontSize: '.8rem' }}>4 groups</span>
                    </div>

                    <div
                      onClick={() => {
                        setShowKeywordsModal(true);
                        toast('🏷️ Opening AI Keyword Intent Analytics');
                      }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: isLightMode ? '#ECFDF5' : 'rgba(52,211,153,0.15)', borderRadius: 12, color: isLightMode ? '#059669' : '#10B981', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease', border: `1px solid ${isLightMode ? '#A7F3D0' : 'rgba(52,211,153,0.3)'}` }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      title="Click to view AI Chatbot Keyword Intent targets"
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.92rem' }}>🏷️ Keywords</span>
                      <span className="pill" style={{ background: '#10B981', color: '#FFFFFF', fontWeight: 800, padding: '4px 12px', borderRadius: 16, fontSize: '.8rem' }}>186 intents</span>
                    </div>

                    <div
                      onClick={() => {
                        setShowCampaignsModal(true);
                        toast('📣 Opening Active Marketing Campaigns & Promos');
                      }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: isLightMode ? '#FFFBEB' : 'rgba(251,191,36,0.15)', borderRadius: 12, color: isLightMode ? '#D97706' : '#F59E0B', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease', border: `1px solid ${isLightMode ? '#FDE68A' : 'rgba(251,191,36,0.3)'}` }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      title="Click to inspect Active Marketing Campaigns"
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.92rem' }}>📣 Campaigns</span>
                      <span className="pill" style={{ background: '#F59E0B', color: '#FFFFFF', fontWeight: 800, padding: '4px 12px', borderRadius: 16, fontSize: '.8rem' }}>12 active</span>
                    </div>
                  </div>
                </div>

                {/* Panel 2: Total Amount Referrer Category Bar Chart */}
                <div className="panel panel-card" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 20, boxShadow: themeShadow, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <h3 style={{ fontSize: '1.2rem', margin: 0, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>Total Amount</h3>
                      <b style={{ color: '#0EA5E9', fontSize: '.9rem' }}>{money(245800)}</b>
                    </div>
                    <small style={{ color: themeMuted, display: 'block', marginBottom: 12 }}>By Referrer Category</small>
                    <ReferrerCategoryBarChart isLightMode={isLightMode} />
                  </div>
                </div>

                {/* Panel 3: Total Sales Dual-Line Multi-Trend Curve Graph */}
                <div className="panel panel-card" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 20, boxShadow: themeShadow, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'visible' }}>
                  <DualLineChart
                    data={dualSalesData}
                    height={150}
                    isLightMode={isLightMode}
                    onPointClick={(item) => toast(`📊 Total Sales ${item.month}: ₱${item.totalPhp.toLocaleString()} (Rooms: ₱${item.roomPhp.toLocaleString()}, Dining: ₱${item.diningPhp.toLocaleString()})`)}
                  />
                </div>
              </div>
            </>
          )}

          {/* TAB 2: GUEST CONVERSATIONS & RESOLUTION INBOX PANEL PAGE */}
          {activeTab === 'conversations' && (
            <ExecutiveGuestConversationsPanel
              initialGuest={selectedPanelGuest || guestConversations[0] || null}
              conversations={guestConversations}
              isLightMode={isLightMode}
            />
          )}

          {/* TAB 3: DINING & KITCHEN SALES TREND ANALYTICS */}
          {activeTab === 'food_sales' && (
            <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24, boxShadow: themeShadow }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <span className="label light">Kitchen & Dining Operations</span>
                  <h3 className="serif" style={{ fontSize: '1.6rem', margin: '4px 0 0', color: themeText }}>Food & Beverage Sales & Popularity Trends</h3>
                </div>
                <span style={{ fontSize: '.84rem', color: '#D97706', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', padding: '6px 14px', borderRadius: 20 }}>
                  🔥 Top Earner: Grilled Bolinao Bangus Feast (₱63,900)
                </span>
              </div>

              <div className="table-wrap" style={{ background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.85)', border: `1px solid ${themeBorder}` }}>
                <table className="table" style={{ background: isLightMode ? '#FFFFFF' : undefined, color: themeText }}>
                  <thead>
                    <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)' }}>
                      <th style={{ background: isLightMode ? '#F1F5F9' : undefined, color: isLightMode ? '#475569' : themeMuted }}>Dish / Beverage Item</th>
                      <th style={{ background: isLightMode ? '#F1F5F9' : undefined, color: isLightMode ? '#475569' : themeMuted }}>Category</th>
                      <th style={{ background: isLightMode ? '#F1F5F9' : undefined, color: isLightMode ? '#475569' : themeMuted }}>Orders Sold</th>
                      <th style={{ background: isLightMode ? '#F1F5F9' : undefined, color: isLightMode ? '#475569' : themeMuted }}>Total Revenue (₱)</th>
                      <th style={{ background: isLightMode ? '#F1F5F9' : undefined, color: isLightMode ? '#475569' : themeMuted }}>Trend Direction</th>
                      <th style={{ background: isLightMode ? '#F1F5F9' : undefined, color: isLightMode ? '#475569' : themeMuted }}>Popularity Meter</th>
                    </tr>
                  </thead>
                  <tbody style={{ background: isLightMode ? '#FFFFFF' : undefined }}>
                    {food_sales.map((item) => (
                      <tr key={item.id} style={{ background: isLightMode ? '#FFFFFF' : undefined, borderBottom: `1px solid ${themeBorder}` }}>
                        <td style={{ background: isLightMode ? '#FFFFFF' : undefined }}><b style={{ color: themeText }}>{item.name}</b></td>
                        <td style={{ background: isLightMode ? '#FFFFFF' : undefined }}><span className="pill" style={{ background: 'rgba(56,189,248,0.15)', color: '#0EA5E9', border: '1px solid rgba(56,189,248,0.3)' }}>{item.category}</span></td>
                        <td style={{ background: isLightMode ? '#FFFFFF' : undefined }}><b style={{ fontSize: '1.05rem', color: '#0EA5E9' }}>{item.orders} orders</b></td>
                        <td style={{ background: isLightMode ? '#FFFFFF' : undefined }}><b style={{ fontSize: '1.05rem', color: '#D97706' }}>{money(item.revenue_php)}</b></td>
                        <td style={{ background: isLightMode ? '#FFFFFF' : undefined }}>
                          <span style={{
                            color: item.trend === 'popular' ? '#10B981' : item.trend === 'trending' ? '#F59E0B' : themeMuted,
                            fontWeight: 700,
                            fontSize: '.88rem'
                          }}>
                            {item.trend === 'popular' ? `🔥 Best Seller (${item.growth})` : item.trend === 'trending' ? `📈 Trending Up (${item.growth})` : `❄️ Steady (${item.growth})`}
                          </span>
                        </td>
                        <td>
                  <div className="hbar" style={{ height: 10, background: isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.08)', borderRadius: 5, width: 140 }}>
                            <span style={{
                              width: `${Math.min(100, (item.orders / 220) * 100)}%`,
                              background: item.trend === 'popular' ? 'linear-gradient(90deg, #F59E0B, #FBBF24)' : 'linear-gradient(90deg, #0EA5E9, #38BDF8)',
                              borderRadius: 5
                            }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: EXECUTIVE PROFILE & SYSTEM SETTINGS (FACEBOOK STYLE) */}
          {activeTab === 'settings' && (
            <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 20, padding: 0, boxShadow: themeShadow, overflow: 'hidden' }}>

              {/* 1. FACEBOOK COVER PHOTO & PROFILE HEADER BAND */}
              <div style={{ position: 'relative', width: '100%', minHeight: 210, background: 'linear-gradient(135deg, #1E1B4B, #312E81, #1E3A8A)', padding: '24px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', boxSizing: 'border-box' }}>
                {/* Cover Decorative Overlay */}
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(56, 189, 248, 0.25), transparent 50%), radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.3), transparent 50%)', pointerEvents: 'none' }} />

                {/* Top Banner Quick Badges */}
                <div style={{ position: 'absolute', top: 18, right: 22, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: '.74rem', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)', color: '#FFF', padding: '5px 14px', borderRadius: 20, fontWeight: 700 }}>
                    🛡️ Verified Executive Account
                  </span>
                  <button
                    type="button"
                    onClick={() => toast('📷 Cover photo updated to J & D Oceanfront Vista')}
                    style={{ fontSize: '.74rem', background: '#3B82F6', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: 18, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.4)' }}
                  >
                    📷 Edit Cover Photo
                  </button>
                </div>

                {/* Profile Avatar + Name + Bio Row */}
                <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'flex-end', gap: 22, flexWrap: 'wrap', marginTop: 35 }}>
                  {/* Avatar Container with Camera Badge */}
                  <div style={{ position: 'relative' }}>
                    <img
                      src={adminProfileState.customAvatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'}
                      alt="Executive Avatar"
                      onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'; }}
                      style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '4px solid #FFFFFF', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url = prompt('Enter new Profile Picture Image URL:', adminProfileState.customAvatarUrl || '');
                        if (url !== null && url.trim() !== '') {
                          setAdminProfileState({ ...adminProfileState, customAvatarUrl: url.trim() });
                          toast('📸 Profile picture updated successfully!');
                        }
                      }}
                      title="Update Profile Picture"
                      style={{
                        position: 'absolute', bottom: 4, right: 4, width: 32, height: 32, borderRadius: '50%',
                        background: '#3B82F6', border: '2px solid #FFF', color: '#FFF', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', fontSize: '.85rem'
                      }}
                    >
                      📷
                    </button>
                  </div>

                  {/* Name & Executive Title & Bio */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h2 style={{ fontSize: '1.75rem', color: '#FFFFFF', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>
                        {adminProfileState.fullName}
                      </h2>
                      <span style={{ fontSize: '1.1rem', color: '#38BDF8' }} title="Verified Executive Badge">✔️</span>
                    </div>

                    <b style={{ color: '#93C5FD', fontSize: '.92rem', display: 'block', margin: '3px 0 6px' }}>
                      {adminProfileState.title} · {adminProfileState.department}
                    </b>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '.78rem', color: '#E2E8F0', background: 'rgba(255,255,255,0.14)', padding: '4px 12px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.2)' }}>
                        🟢 ONLINE · {adminProfileState.statusBio}
                      </span>
                      <span style={{ fontSize: '.76rem', color: '#CBD5E1' }}>
                        📍 {adminProfileState.location}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. MAIN SETTINGS FORM BODY - SINGLE COLUMN VERTICAL SCROLLABLE FLOW */}
              <div style={{ padding: 26 }}>
                <form onSubmit={handleSaveSettings} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>

                  {/* SECTION 1: EXECUTIVE PROFILE INFORMATION */}
                  <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 12 }}>
                      <div>
                        <b style={{ fontSize: '1.1rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                          👤 Executive Profile Information
                        </b>
                        <span style={{ fontSize: '.76rem', color: themeMuted, display: 'block', marginTop: 2 }}>Manage your executive identity, bio message, and recovery contact details</span>
                      </div>
                      <span style={{ fontSize: '.74rem', color: '#3B82F6', fontWeight: 700, background: 'rgba(59, 130, 246, 0.1)', padding: '4px 12px', borderRadius: 16, border: '1px solid rgba(59, 130, 246, 0.2)' }}>Facebook Profile Sync</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div className="field" style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>EXECUTIVE BIO / STATUS MESSAGE</label>
                        <input
                          type="text"
                          style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                          value={adminProfileState.statusBio}
                          onChange={(e) => setAdminProfileState({ ...adminProfileState, statusBio: e.target.value })}
                        />
                      </div>

                      <div className="field">
                        <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>FULL NAME</label>
                        <input
                          type="text"
                          required
                          style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                          value={adminProfileState.fullName}
                          onChange={(e) => setAdminProfileState({ ...adminProfileState, fullName: e.target.value })}
                        />
                      </div>

                      <div className="field">
                        <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>EXECUTIVE TITLE / ROLE</label>
                        <input
                          type="text"
                          required
                          style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                          value={adminProfileState.title}
                          onChange={(e) => setAdminProfileState({ ...adminProfileState, title: e.target.value })}
                        />
                      </div>

                      <div className="field">
                        <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>EMAIL ADDRESS</label>
                        <input
                          type="email"
                          required
                          style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                          value={adminProfileState.email}
                          onChange={(e) => setAdminProfileState({ ...adminProfileState, email: e.target.value })}
                        />
                      </div>

                      <div className="field">
                        <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>MOBILE PHONE (SMS RECOVERY)</label>
                        <input
                          type="text"
                          required
                          style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                          value={adminProfileState.phone}
                          onChange={(e) => setAdminProfileState({ ...adminProfileState, phone: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: ACCOUNT SECURITY & PASSWORD MANAGEMENT (FACEBOOK STYLE) */}
                  <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 12 }}>
                      <div>
                        <b style={{ fontSize: '1.1rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                          🔒 Password & Account Security
                        </b>
                        <span style={{ fontSize: '.76rem', color: themeMuted, display: 'block', marginTop: 2 }}>Update security credentials and manage active sessions</span>
                      </div>
                      <span style={{ fontSize: '.74rem', color: '#10B981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', padding: '4px 12px', borderRadius: 16, border: '1px solid rgba(16, 185, 129, 0.2)' }}>2FA Protected</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
                      <div className="field">
                        <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>CURRENT PASSWORD</label>
                        <input
                          type="password"
                          placeholder="••••••••••••"
                          style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                          value={adminProfileState.currentPassword || ''}
                          onChange={(e) => setAdminProfileState({ ...adminProfileState, currentPassword: e.target.value })}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div className="field">
                          <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>NEW PASSWORD</label>
                          <input
                            type="password"
                            placeholder="New strong password"
                            style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                            value={adminProfileState.newPassword || ''}
                            onChange={(e) => setAdminProfileState({ ...adminProfileState, newPassword: e.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>CONFIRM NEW PASSWORD</label>
                          <input
                            type="password"
                            placeholder="Repeat new password"
                            style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                            value={adminProfileState.confirmPassword || ''}
                            onChange={(e) => setAdminProfileState({ ...adminProfileState, confirmPassword: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (adminProfileState.newPassword && adminProfileState.newPassword === adminProfileState.confirmPassword) {
                          toast('🔒 Password updated successfully!');
                          setAdminProfileState({ ...adminProfileState, currentPassword: '', newPassword: '', confirmPassword: '' });
                        } else if (adminProfileState.newPassword !== adminProfileState.confirmPassword) {
                          toast('⚠️ New passwords do not match!', true);
                        } else {
                          toast('⚠️ Please enter a new password.', true);
                        }
                      }}
                      className="btn btn-sky btn-sm"
                      style={{ padding: '10px 20px', fontWeight: 700, borderRadius: 10 }}
                    >
                      🔒 Update Security Password
                    </button>

                    {/* Active Login Sessions */}
                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${themeBorder}` }}>
                      <span style={{ fontSize: '.76rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 10 }}>WHERE YOU'RE LOGGED IN</span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.04)', borderRadius: 12, border: `1px solid ${themeBorder}` }}>
                          <div style={{ fontSize: '.84rem', color: themeText }}>
                            💻 <b>Windows PC</b> · Manila, PH
                            <span style={{ fontSize: '.72rem', color: '#10B981', display: 'block', marginTop: 2 }}>Active Session Now</span>
                          </div>
                          <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 600 }}>This Device</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.04)', borderRadius: 12, border: `1px solid ${themeBorder}` }}>
                          <div style={{ fontSize: '.84rem', color: themeText }}>
                            📱 <b>iPhone 15 Pro</b> · Bolinao, PH
                            <span style={{ fontSize: '.72rem', color: themeMuted, display: 'block', marginTop: 2 }}>Active 2 hours ago</span>
                          </div>
                          <button type="button" onClick={() => toast('📱 Remote session revoked')} style={{ background: 'none', border: 'none', color: '#F43F5E', fontSize: '.76rem', cursor: 'pointer', fontWeight: 700 }}>Log Out</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: SYSTEM CONTROLS & TELEMETRY PREFERENCES */}
                  <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24 }}>
                    <div style={{ marginBottom: 16, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 12 }}>
                      <b style={{ fontSize: '1.1rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        ⚡ System Controls & Telemetry Preferences
                      </b>
                      <span style={{ fontSize: '.76rem', color: themeMuted, display: 'block', marginTop: 2 }}>Configure real-time SSE stream intervals, auto-lock security, and Twilio SMS triggers</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
                      <div className="field">
                        <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>TELEMETRY STREAM SPEED</label>
                        <select
                          style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                          value={adminProfileState.refreshRate}
                          onChange={(e) => setAdminProfileState({ ...adminProfileState, refreshRate: e.target.value })}
                        >
                          <option value="1">Turbo (1 Second Interval)</option>
                          <option value="5">Normal (5 Seconds Interval)</option>
                          <option value="15">Eco Mode (15 Seconds Interval)</option>
                        </select>
                      </div>
                      <div className="field">
                        <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>SECURITY AUTO-LOCK</label>
                        <select
                          style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                          value={adminProfileState.sessionTimeout}
                          onChange={(e) => setAdminProfileState({ ...adminProfileState, sessionTimeout: e.target.value })}
                        >
                          <option value="15">Auto Lock after 15 Minutes</option>
                          <option value="30">Auto Lock after 30 Minutes</option>
                          <option value="60">Auto Lock after 1 Hour</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '.86rem', color: themeText, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={adminProfileState.smsNotifications}
                          onChange={(e) => setAdminProfileState({ ...adminProfileState, smsNotifications: e.target.checked })}
                        />
                        Enable Instant Twilio SMS Alerts on Guest Bookings & Staff Role Modifications
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '.86rem', color: themeText, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={adminProfileState.twoFactorAuth}
                          onChange={(e) => setAdminProfileState({ ...adminProfileState, twoFactorAuth: e.target.checked })}
                        />
                        Require Two-Factor 2FA SMS Security Keycode on Portal Sign-In
                      </label>
                    </div>
                  </div>

                  {/* SECTION 4: DATA MAINTENANCE & SYSTEM BACKUPS */}
                  <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24 }}>
                    <div style={{ marginBottom: 16, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 12 }}>
                      <b style={{ fontSize: '1.1rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        💾 Data Maintenance & System Backups
                      </b>
                      <span style={{ fontSize: '.76rem', color: themeMuted, display: 'block', marginTop: 2 }}>Export full resort data snapshots or purge temporary client storage</span>
                    </div>

                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(adminProfileState, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'jd_beach_house_system_backup.json';
                          a.click();
                          toast('💾 Operational system backup exported cleanly');
                        }}
                        className="btn btn-sky"
                        style={{ padding: '12px 20px', fontWeight: 700, borderRadius: 10 }}
                      >
                        📥 Export System Backup (JSON)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.removeItem('jd_beach_house_cache');
                          localStorage.removeItem('alon_resort_cache');
                          toast('🧹 Local storage cache reset successfully');
                        }}
                        className="btn"
                        style={{ padding: '12px 20px', background: isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.08)', color: themeText, fontWeight: 700, borderRadius: 10 }}
                      >
                        🧹 Reset Local Cache
                      </button>
                    </div>
                  </div>

                  {/* SAVE & SYNC BUTTON */}
                  <button className="btn btn-sky" style={{ width: '100%', justifyContent: 'center', padding: '16px 24px', fontWeight: 700, fontSize: '1.05rem', borderRadius: 14, marginTop: 10 }}>
                    Save & Sync Profile Settings ✦
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: REALTIME TELEMETRY STREAM */}
          {activeTab === 'telemetry' && (
            <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24, boxShadow: themeShadow }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <span className="label light">System Telemetry & Health</span>
                  <h3 className="serif" style={{ fontSize: '1.6rem', margin: '4px 0 0', color: themeText }}>Realtime Operations Telemetry Monitor</h3>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: '.72rem', color: '#10B981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                    LIVE
                  </span>
                  <button className="btn btn-sky btn-sm" onClick={() => toast('⚡ Telemetry Health Diagnostic Verified: 100% Operational')}>
                    Run Health Check ⚡
                  </button>
                </div>
              </div>

              {/* SYSTEM GAUGES — CPU / MEMORY / DISK */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'CPU UTILIZATION', value: telemetryLive.cpuUsage, color: telemetryLive.cpuUsage > 80 ? '#F43F5E' : telemetryLive.cpuUsage > 60 ? '#F59E0B' : '#10B981', unit: '%' },
                  { label: 'MEMORY USAGE', value: telemetryLive.memoryUsage, color: telemetryLive.memoryUsage > 80 ? '#F43F5E' : telemetryLive.memoryUsage > 60 ? '#F59E0B' : '#0EA5E9', unit: '%' },
                  { label: 'DISK STORAGE', value: telemetryLive.diskUsage, color: telemetryLive.diskUsage > 80 ? '#F43F5E' : '#8B5CF6', unit: '%' },
                ].map((g, gi) => {
                  const radius = 52, stroke = 10, circ = 2 * Math.PI * radius;
                  const offset = circ - (Math.min(g.value, 100) / 100) * circ;
                  return (
                    <div key={gi} style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 14, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                      <svg width={128} height={128} viewBox="0 0 128 128">
                        <circle cx="64" cy="64" r={radius} fill="none" stroke={isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.06)'} strokeWidth={stroke} />
                        <circle cx="64" cy="64" r={radius} fill="none" stroke={g.color} strokeWidth={stroke}
                          strokeDasharray={circ} strokeDashoffset={offset}
                          strokeLinecap="round" transform="rotate(-90 64 64)"
                          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }} />
                        <text x="64" y="58" textAnchor="middle" fontSize="22" fontWeight="800" fill={themeText}>
                          {Math.round(g.value)}
                        </text>
                        <text x="64" y="76" textAnchor="middle" fontSize="11" fill={themeMuted}>{g.unit}</text>
                      </svg>
                      <div>
                        <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700, letterSpacing: '.08em' }}>{g.label}</span>
                        <b style={{ display: 'block', fontSize: '1.2rem', color: g.color, marginTop: 4 }}>{Math.round(g.value)}{g.unit}</b>
                        <small style={{ fontSize: '.7rem', color: g.value > 80 ? '#F43F5E' : '#10B981' }}>
                          {g.value > 80 ? '⚠️ High Load' : '🟢 Normal'}
                        </small>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* METRIC CARDS ROW */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 16 }}>
                  <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700 }}>ACTIVE SESSIONS</span>
                  <b style={{ display: 'block', fontSize: '1.5rem', color: '#0EA5E9', marginTop: 4, transition: 'color 0.3s' }}>{Math.round(telemetryLive.activeSessions)}</b>
                  <small style={{ fontSize: '.7rem', color: '#10B981' }}>🟢 SSE Healthy</small>
                </div>
                <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 16 }}>
                  <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700 }}>DB LATENCY</span>
                  <b style={{ display: 'block', fontSize: '1.5rem', color: telemetryLive.dbLatency > 5 ? '#F43F5E' : '#10B981', marginTop: 4, transition: 'color 0.3s' }}>{telemetryLive.dbLatency} ms</b>
                  <small style={{ fontSize: '.7rem', color: themeMuted }}>Supabase Engine</small>
                </div>
                <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 16 }}>
                  <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700 }}>SMS DISPATCHES</span>
                  <b style={{ display: 'block', fontSize: '1.5rem', color: '#F59E0B', marginTop: 4, transition: 'color 0.3s' }}>{telemetryLive.smsDispatches} Sent</b>
                  <small style={{ fontSize: '.7rem', color: '#10B981' }}>100% Delivery</small>
                </div>
                <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 16 }}>
                  <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700 }}>SYSTEM UPTIME</span>
                  <b style={{ display: 'block', fontSize: '1.5rem', color: '#10B981', marginTop: 4 }}>{telemetryLive.uptime}%</b>
                  <small style={{ fontSize: '.7rem', color: themeMuted }}>30-Day Average</small>
                </div>
              </div>

              {/* LIVE NETWORK EVENT PULSE SPARKLINE */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <b style={{ fontSize: '.9rem', color: themeText }}>Live Network Event Pulse (Requests / Minute)</b>
                  <span style={{ fontSize: '.78rem', color: '#0EA5E9', fontWeight: 700 }}>{telemetryLive.requestsPerMin} req/min</span>
                </div>
                <Sparkline values={telemetryLive.sparklineValues} width={760} height={120} />
              </div>

              {/* REALTIME REQUEST LOG TIMELINE */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <b style={{ fontSize: '.9rem', color: themeText }}>Live API Request Log</b>
                  <span style={{ fontSize: '.72rem', color: themeMuted }}>{telemetryLive.requestLog.length} recent entries</span>
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto', borderRadius: 10, border: `1px solid ${themeBorder}` }}>
                  <table style={{ width: '100%', fontSize: '.78rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(2,6,23,0.7)', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.7rem', letterSpacing: '.06em' }}>TIME</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.7rem' }}>METHOD</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.7rem' }}>ENDPOINT</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: themeMuted, fontWeight: 700, fontSize: '.7rem' }}>STATUS</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: themeMuted, fontWeight: 700, fontSize: '.7rem' }}>LATENCY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...telemetryLive.requestLog].reverse().map((entry) => (
                        <tr key={entry.id} style={{ borderBottom: `1px solid ${themeBorder}`, transition: 'background 0.3s' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = isLightMode ? '#F8FAFC' : 'rgba(56,189,248,0.04)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '7px 12px', color: themeMuted, fontFamily: 'monospace', fontSize: '.74rem' }}>{entry.time}</td>
                          <td style={{ padding: '7px 12px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 6, fontSize: '.68rem', fontWeight: 800,
                              background: entry.method === 'POST' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                              color: entry.method === 'POST' ? '#F59E0B' : '#10B981',
                            }}>{entry.method}</span>
                          </td>
                          <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: '.74rem', color: themeText }}>{entry.path}</td>
                          <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 6, fontSize: '.68rem', fontWeight: 700,
                              background: entry.status === 200 || entry.status === 201 ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                              color: entry.status === 200 || entry.status === 201 ? '#10B981' : '#F43F5E',
                            }}>{entry.status}</span>
                          </td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '.74rem', color: entry.ms > 200 ? '#F59E0B' : themeMuted }}>{entry.ms}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: STAFF & USER ACCOUNT MANAGEMENT */}
          {activeTab === 'accounts' && (
            <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24, boxShadow: themeShadow }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
                <div>
                  <h3 className="serif" style={{ fontSize: '1.5rem', margin: 0, color: themeText }}>Accounts Directory</h3>
                  <p className="muted small">Manage staff credentials, customer profiles, and account recovery.</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    className="search"
                    placeholder="Search by name or phone…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ maxWidth: 260, background: isLightMode ? '#FFF' : undefined, color: themeText }}
                  />
                  {accountsSubTab === 'staff' && (
                    <button className="btn btn-sky btn-sm" onClick={() => setShowCreateModal(true)}>
                      + Provision Staff
                    </button>
                  )}
                </div>
              </div>

              {/* SUB-TAB SWITCHER */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4 }}>
                {[
                  { key: 'staff', label: '🛡️ Staff & Admins', count: users.filter(u => ['administrator', 'receptionist', 'accounting', 'staff'].includes(u.role)).length },
                  { key: 'customers', label: '🏨 Customers & Guests', count: users.filter(u => !u.role || u.role === 'customer').length },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => { setAccountsSubTab(tab.key); setRoleFilter(''); }}
                    style={{
                      flex: 1, padding: '10px 16px', border: 'none', borderRadius: 10, cursor: 'pointer',
                      fontSize: '.82rem', fontWeight: 700, transition: 'all 0.25s ease',
                      background: accountsSubTab === tab.key
                        ? (tab.key === 'staff' ? 'linear-gradient(135deg, #4338CA, #6366F1)' : 'linear-gradient(135deg, #0284C7, #0EA5E9)')
                        : 'transparent',
                      color: accountsSubTab === tab.key ? '#FFF' : themeMuted,
                      boxShadow: accountsSubTab === tab.key ? '0 4px 12px rgba(99,102,241,0.25)' : 'none',
                    }}
                  >
                    {tab.label} <span style={{ opacity: 0.8, fontSize: '.72rem', marginLeft: 4 }}>({tab.count})</span>
                  </button>
                ))}
              </div>

              {/* ═══ STAFF & ADMINS SUB-TAB ═══ */}
              {accountsSubTab === 'staff' && (
                <>
                  {/* Staff Role Filter Badges */}
                  <div className="chip-row" style={{ marginBottom: 16 }}>
                    {['', 'administrator', 'receptionist', 'accounting', 'staff'].map((role) => (
                      <button
                        key={role}
                        className={`chip ${roleFilter === role ? 'sel' : ''}`}
                        onClick={() => setRoleFilter(role)}
                      >
                        {role ? role.toUpperCase() : 'ALL STAFF'}
                      </button>
                    ))}
                  </div>

                  {searchingUsers ? (
                    <div className="skel" style={{ height: 200 }} />
                  ) : (() => {
                    const staffUsers = users
                      .filter(u => ['administrator', 'receptionist', 'accounting', 'staff'].includes(u.role))
                      .filter(u => !roleFilter || u.role === roleFilter);
                    return staffUsers.length === 0 ? (
                      <p className="muted" style={{ padding: '30px 0' }}>No staff accounts match your filters.</p>
                    ) : (
                      <div className="table-wrap" style={{ background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.85)', border: `1px solid ${themeBorder}` }}>
                        <table className="table" style={{ color: themeText }}>
                          <thead>
                            <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)' }}>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Full Name</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Email</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Phone</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Role</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Status</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Role Action</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Recovery</th>
                            </tr>
                          </thead>
                          <tbody>
                            {staffUsers.map((u) => (
                              <tr key={u.id} style={{ borderBottom: `1px solid ${themeBorder}` }}>
                                <td><b>{u.full_name || 'Staff User'}</b></td>
                                <td style={{ fontSize: '.8rem', color: themeMuted }}>{u.email || 'N/A'}</td>
                                <td>{u.phone || 'N/A'}</td>
                                <td>
                                  <span className="pill" style={{
                                    background: u.role === 'administrator' ? 'rgba(139,92,246,0.15)' : u.role === 'receptionist' ? 'rgba(14,165,233,0.15)' : 'rgba(245,158,11,0.15)',
                                    color: u.role === 'administrator' ? '#8B5CF6' : u.role === 'receptionist' ? '#0EA5E9' : '#F59E0B',
                                    border: `1px solid ${u.role === 'administrator' ? 'rgba(139,92,246,0.3)' : u.role === 'receptionist' ? 'rgba(14,165,233,0.3)' : 'rgba(245,158,11,0.3)'}`,
                                  }}>{u.role}</span>
                                </td>
                                <td><span style={{ color: '#10B981', fontWeight: 600, fontSize: '.78rem' }}>🟢 Active</span></td>
                                <td>
                                  <select
                                    value={u.role || 'staff'}
                                    style={{ fontSize: '.75rem', padding: '4px 8px', borderRadius: 6, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#0F172A', color: themeText }}
                                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                  >
                                    <option value="receptionist">Receptionist</option>
                                    <option value="accounting">Accounting</option>
                                    <option value="staff">Staff</option>
                                    <option value="administrator">Administrator</option>
                                  </select>
                                </td>
                                <td>
                                  <button className="act-btn" style={{ color: '#0EA5E9', borderColor: '#38BDF8' }}
                                    onClick={() => { setRecoveryTarget(u); setNewPassword(''); }}>
                                    🔑 Reset
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* ═══ CUSTOMERS & GUESTS SUB-TAB ═══ */}
              {accountsSubTab === 'customers' && (
                <>
                  {/* Customer Summary Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
                    {(() => {
                      const custUsers = users.filter(u => !u.role || u.role === 'customer');
                      const totalCust = custUsers.length;
                      const activeStays = custUsers.filter(u => (u.stays_count || 0) > 0).length;
                      const totalRev = custUsers.reduce((sum, u) => sum + (u.total_spent_php || 0), 0);
                      return [
                        { label: 'TOTAL CUSTOMERS', value: totalCust, icon: '👥', color: '#0EA5E9' },
                        { label: 'WITH ACTIVE STAYS', value: activeStays, icon: '🏨', color: '#10B981' },
                        { label: 'TOTAL REVENUE', value: money(totalRev), icon: '💰', color: '#F59E0B' },
                      ].map((s, si) => (
                        <div key={si} style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: '1.6rem' }}>{s.icon}</span>
                          <div>
                            <span style={{ fontSize: '.68rem', color: themeMuted, fontWeight: 700, letterSpacing: '.08em' }}>{s.label}</span>
                            <b style={{ display: 'block', fontSize: '1.3rem', color: s.color }}>{s.value}</b>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>

                  {searchingUsers ? (
                    <div className="skel" style={{ height: 200 }} />
                  ) : (() => {
                    const custUsers = users.filter(u => !u.role || u.role === 'customer');
                    return custUsers.length === 0 ? (
                      <p className="muted" style={{ padding: '30px 0' }}>No customer accounts found.</p>
                    ) : (
                      <div className="table-wrap" style={{ background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.85)', border: `1px solid ${themeBorder}` }}>
                        <table className="table" style={{ color: themeText }}>
                          <thead>
                            <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)' }}>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Full Name</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Phone</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>City / Address</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Stays</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Orders</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Total Spent (₱)</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Promote</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Recovery</th>
                            </tr>
                          </thead>
                          <tbody>
                            {custUsers.map((u) => (
                              <tr key={u.id} style={{ borderBottom: `1px solid ${themeBorder}` }}>
                                <td><b>{u.full_name || 'Guest'}</b></td>
                                <td>{u.phone || 'N/A'}</td>
                                <td>{u.address ? `${u.address}, ${u.city}` : 'N/A'}</td>
                                <td><b style={{ color: '#0EA5E9' }}>{u.stays_count || 0}</b></td>
                                <td>{u.orders_count || 0}</td>
                                <td><b style={{ color: '#F59E0B' }}>{money(u.total_spent_php || 0)}</b></td>
                                <td>
                                  <select
                                    value={u.role || 'customer'}
                                    style={{ fontSize: '.75rem', padding: '4px 8px', borderRadius: 6, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#0F172A', color: themeText }}
                                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                  >
                                    <option value="customer">Customer</option>
                                    <option value="receptionist">Receptionist</option>
                                    <option value="accounting">Accounting</option>
                                    <option value="staff">Staff</option>
                                    <option value="administrator">Administrator</option>
                                  </select>
                                </td>
                                <td>
                                  <button className="act-btn" style={{ color: '#0EA5E9', borderColor: '#38BDF8' }}
                                    onClick={() => { setRecoveryTarget(u); setNewPassword(''); }}>
                                    🔑 Reset
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* TAB 6: RESERVATIONS LEDGER */}
          {activeTab === 'ledger' && (
            <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24, boxShadow: themeShadow }}>
              <h3 className="serif" style={{ fontSize: '1.4rem', marginTop: 0, color: themeText }}>Live Guest Reservations Ledger</h3>
              {bookings.length === 0 ? (
                <p className="muted" style={{ padding: '24px 0' }}>No active or past reservations found.</p>
              ) : (
                <div className="table-wrap" style={{ background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.85)', border: `1px solid ${themeBorder}` }}>
                  <table className="table" style={{ color: themeText }}>
                    <thead>
                      <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)' }}>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Guest</th>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Room</th>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Dates</th>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Total</th>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Status</th>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => (
                        <tr key={b.id} style={{ borderBottom: `1px solid ${themeBorder}` }}>
                          <td>
                            <b>{b.profiles?.full_name || 'Guest'}</b><br />
                            <small style={{ color: themeMuted }}>{b.profiles?.phone || ''}</small>
                          </td>
                          <td>{b.rooms?.name || 'Room'}</td>
                          <td>{fmtDate(b.check_in)} → {fmtDate(b.check_out)}</td>
                          <td><b>{money(b.total_php)}</b></td>
                          <td><span className={`pill ${b.status}`}>{b.status.replace('_', ' ')}</span></td>
                          <td>
                            {b.status === 'confirmed' && (
                              <button className="act-btn" onClick={() => updateStatus(b.id, 'checked_in')}>Check-in</button>
                            )}
                            {b.status === 'checked_in' && (
                              <button className="act-btn" onClick={() => updateStatus(b.id, 'checked_out')}>Check-out</button>
                            )}
                            {['pending', 'confirmed'].includes(b.status) && (
                              <button className="act-btn" onClick={() => updateStatus(b.id, 'cancelled')}>Cancel</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: CSV DATA EXPLORER & AUTO-READER */}
          {activeTab === 'csv' && (
            <div style={{ marginTop: 10 }}>
              <CsvTableViewer
                title="Resort Operational & Account Data Explorer"
                defaultFilename="jd_beach_house_accounts.csv"
                initialCsvText={`Account ID,First Name,Middle Name,Last Name,Full Name,Email,Role,Status,Total Spent (PHP)
usr-1,Johannes,Von,Shicksal,Johannes Von Shicksal,jvs001@resortmanagement.ph,administrator,Active,0
usr-2,Elena,Santos,Ramos,Elena Santos Ramos,esr002@resortmanagement.ph,receptionist,Active,0
usr-3,Carlos,Mendoza,Ledger,Carlos Mendoza Ledger,cml003@resortmanagement.ph,accounting,Active,0
usr-4,Juan,Dela,Cruz,Juan Dela Cruz,user@gmail.com,customer,Checked-In,14750
usr-5,Maria,Clara,Santos,Maria Clara Santos,maria.santos@gmail.com,customer,Confirmed,7200`}
                isLightMode={isLightMode}
              />
            </div>
          )}
        </div>
      </div>

      {showGlossaryModal && (
        <AnalyticsGlossaryModal
          isLightMode={isLightMode}
          onClose={() => setShowGlossaryModal(false)}
        />
      )}

      {activeChatGuest && (
        <ExecutiveGuestChatModal
          guest={activeChatGuest}
          isLightMode={isLightMode}
          onClose={() => setActiveChatGuest(null)}
        />
      )}

      {/* MODAL 1: AI KEYWORD INTENT ANALYTICS */}
      {showKeywordsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowKeywordsModal(false)}>
          <div style={{ width: '100%', maxWidth: 560, background: isLightMode ? '#FFFFFF' : '#0F172A', borderRadius: 20, border: `1px solid ${themeBorder}`, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 12 }}>
              <div>
                <span style={{ fontSize: '.74rem', color: '#10B981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>AI CHATBOT INTENTS</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.4rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>🏷️ 186 AI Keyword Intents</h3>
              </div>
              <button onClick={() => setShowKeywordsModal(false)} style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: '.84rem', color: themeMuted, margin: '0 0 16px' }}>Top automated intent keywords recognized from guest inquiries across Webchat, Messenger & WhatsApp:</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
              {[
                { tag: '#early-checkin', count: 428, resRate: '98.2% AI Solved', category: 'Front Desk' },
                { tag: '#patar-beach-tour', count: 312, resRate: '96.5% AI Solved', category: 'Concierge' },
                { tag: '#villa-upgrade', count: 215, resRate: '84.1% Staff Routed', category: 'Reservations' },
                { tag: '#candlelight-dinner', count: 186, resRate: '92.0% AI Solved', category: 'Dining' },
                { tag: '#airport-van-transfer', count: 105, resRate: '95.0% AI Solved', category: 'Transport' },
              ].map((k) => (
                <div
                  key={k.tag}
                  className="clickable-prompt-word"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.04)',
                    borderRadius: 12,
                    border: `1px solid ${themeBorder}`,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setShowKeywordsModal(false);
                    dispatchWordPrompt(k.tag, { template: `Guest intent inquiry: ${k.tag.replace('#', '')} for ${k.category}` });
                  }}
                  title={`Click keyword to test prompt in AI Concierge: "${k.tag}"`}
                >
                  <div>
                    <b style={{ color: '#10B981', fontSize: '.92rem' }}>{k.tag}</b>
                    <span style={{ fontSize: '.74rem', color: themeMuted, display: 'block' }}>Category: {k.category} · <i>Click to test type prompt</i></span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <b style={{ color: themeText, fontSize: '.92rem' }}>{k.count} queries</b>
                    <span style={{ fontSize: '.72rem', color: k.resRate.includes('AI') ? '#10B981' : '#818CF8', fontWeight: 700, display: 'block' }}>{k.resRate}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ACTIVE MARKETING CAMPAIGNS */}
      {showCampaignsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowCampaignsModal(false)}>
          <div style={{ width: '100%', maxWidth: 580, background: isLightMode ? '#FFFFFF' : '#0F172A', borderRadius: 20, border: `1px solid ${themeBorder}`, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 12 }}>
              <div>
                <span style={{ fontSize: '.74rem', color: '#F59E0B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>PROMOTIONAL PERFORMANCE</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.4rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>📣 12 Active Campaigns</h3>
              </div>
              <button onClick={() => setShowCampaignsModal(false)} style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: '.84rem', color: themeMuted, margin: '0 0 16px' }}>Performance metrics for active marketing promotions driving guest bookings & dining revenue:</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
              {[
                { title: '🌴 Patar Beach Festival Promo 2026', revenue: '₱92,400', bookings: '38 Villa Bookings', status: 'Active' },
                { title: '🌅 Sunset Cocktail Hour Offer', revenue: '₱39,240', bookings: '218 Orders', status: 'Active' },
                { title: '🚤 Hundred Islands Outrigger Bundle', revenue: '₱55,900', bookings: '86 Guests', status: 'Active' },
                { title: '💑 Romantic Oceanfront Escapes', revenue: '₱42,500', bookings: '34 Guests', status: 'Active' },
              ].map((c) => (
                <div key={c.title} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.04)', borderRadius: 12, border: `1px solid ${themeBorder}` }}>
                  <div>
                    <b style={{ color: themeText, fontSize: '.92rem' }}>{c.title}</b>
                    <span style={{ fontSize: '.74rem', color: themeMuted, display: 'block' }}>Conversion: {c.bookings}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <b style={{ color: '#F59E0B', fontSize: '.95rem' }}>{c.revenue}</b>
                    <span style={{ fontSize: '.72rem', color: '#10B981', fontWeight: 700, display: 'block' }}>● {c.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
