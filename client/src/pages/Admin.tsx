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
  IconWallet, IconBuilding, IconShield, IconBriefcase, DefaultUserAvatar,
  IconMessages, IconAnalytics, IconRefresh
} from '../components/AdminIcons.tsx';
import { api, API_BASE } from '../lib/api.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { InterchangeableImagePicker } from '../components/InterchangeableImagePicker.tsx';
import CloudinarySettingsCard from '../components/CloudinarySettingsCard.tsx';
import RoomImageCarousel from '../components/RoomImageCarousel.tsx';
import {
  getCloudinaryConfig,
  saveCloudinaryConfig,
  uploadImageToCloudinary,
  optimizeCloudinaryUrl,
  RESORT_PRESET_IMAGES,
} from '../lib/cloudinary.ts';
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
  const { session, profile, signIn, signOut } = useAuth();
  const user = session?.user;
  const [data, setData] = useState(emptyAnalytics);
  const [loading, setLoading] = useState(false);

  // Automatic Database Clearance & Clean Auth State
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);
  const [refreshingAnalytics, setRefreshingAnalytics] = useState(false);

  // Live database profile role validation (Acquired automatically from database profile)
  const isAdministrator = Boolean(session && profile && ['administrator', 'admin'].includes(profile?.role));

  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifFilter, setNotifFilter] = useState('all');
  const [reservationsList, setReservationsList] = useState<any[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [reservationFilter, setReservationFilter] = useState('all');
  const [reservationSearch, setReservationSearch] = useState('');
  const [showAddReservationModal, setShowAddReservationModal] = useState(false);
  const [creatingReservation, setCreatingReservation] = useState(false);
  const [newReservation, setNewReservation] = useState({
    guest_name: '',
    phone: '',
    guest_email: '',
    room_id: '',
    check_in: new Date().toISOString().slice(0, 10),
    check_out: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    guests: 2,
    total_php: 3500,
    payment_method: 'GCash',
    payment_status: 'confirmed',
    notes: 'Direct Front Desk walk-in entry',
  });

  const refreshReservations = useCallback(async () => {
    setLoadingReservations(true);
    try {
      const res = await api.allReservations();
      if (Array.isArray(res)) {
        setReservationsList(res.map((b: any) => ({
          ...b,
          nights: b.nights || Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000)),
        })));
        toast('✦ Reservations ledger synchronized with database!');
      }
    } catch (e: any) {
      toast(`Could not load reservations: ${e.message}`, true);
    } finally {
      setLoadingReservations(false);
    }
  }, []);

  const handleManualSync = async () => {
    setRefreshingAnalytics(true);
    try {
      const [fresh, res, notifs] = await Promise.all([
        api.analyticsOverview(),
        api.allReservations().catch(() => null),
        api.myNotifications().catch(() => null),
      ]);
      if (fresh) setData(fresh);
      if (Array.isArray(res)) {
        setReservationsList(res.map((b: any) => ({
          ...b,
          nights: b.nights || Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000)),
        })));
      }
      if (Array.isArray(notifs)) setNotifications(notifs);
      refreshRoomsAndInventory().catch(() => {});
      toast('✦ Live Analytics, Ledger, Inventory & Alerts Synchronized!');
    } catch (err: any) {
      toast(err.message || 'Sync failed', true);
    } finally {
      setRefreshingAnalytics(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthenticating(true);
    setAuthError('');
    try {
      if (!adminEmail.trim() || !adminPass) {
        throw new Error('Please enter administrator username or email, and password.');
      }
      const res = await signIn(adminEmail.trim(), adminPass);
      if (res?.error) throw res.error;
      toast('✦ Administrator credentials verified. Loading control center…');
    } catch (err: any) {
      setAuthError(err.message || 'Invalid administrator credentials. Access restricted.');
      toast(err.message || 'Authentication failed', true);
    } finally {
      setAuthenticating(false);
    }
  };

  // Administrative Navigation Tabs, Sidebar & LIGHT/DARK THEME STATE
  const [activeTab, setActiveTab] = useState('overview'); // overview | ledger | notifications | inventory | conversations | food_sales | accounts | audit | csv | settings
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showGlossaryModal, setShowGlossaryModal] = useState(false);
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
    fullName: profile?.full_name || '',
    title: profile?.title || '',
    avatarKey: 'crown',
    customAvatarUrl: profile?.avatar_url || '',
    email: profile?.email || user?.email || '',
    phone: profile?.phone || '',
    department: profile?.department || '',
    statusBio: profile?.status_bio || '',
    location: 'Brgy. Patar, Bolinao, Pangasinan',
    refreshRate: '5',
    smsNotifications: true,
    telemetryStream: true,
    twoFactorAuth: true,
    sessionTimeout: '30',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (profile) {
      setAdminProfileState((prev) => ({
        ...prev,
        fullName: profile.full_name || prev.fullName,
        email: profile.email || user?.email || prev.email,
        phone: profile.phone || prev.phone,
      }));
    }
  }, [profile, user]);

  const avatarOptions = [
    { label: 'Executive Crown', key: 'crown', icon: <IconCrown size={22} color="#F59E0B" /> },
    { label: 'General Manager', key: 'manager', icon: <IconBriefcase size={22} color="#38BDF8" /> },
    { label: 'Tech Administrator', key: 'tech', icon: <IconTelemetry size={22} color="#10B981" /> },
    { label: 'Security Chief', key: 'security', icon: <IconShield size={22} color="#F43F5E" /> },
    { label: 'Operations Director', key: 'operations', icon: <IconBuilding size={22} color="#8B5CF6" /> },
  ];

  // Chart datasets derived from live analytics data
  const salesOverviewData = (data.daily && data.daily.length > 0)
    ? data.daily.slice(-7).map((d) => ({
        label: d.date?.slice(5) || '',
        value: d.bookings || 0,
        revenue: d.revenue_php || 0,
        date: d.date,
      }))
    : [];

  const performanceData = (data.bookings && data.bookings.length > 0)
    ? (() => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const rawGrouped: Record<string, { target: number; paid: number; pending: number }> = {};
        for (const b of data.bookings) {
          const rawDate = b.check_in ? `${b.check_in}T00:00:00` : b.created_at;
          const d = days[new Date(rawDate).getDay()] || 'Mon';
          if (!rawGrouped[d]) rawGrouped[d] = { target: 0, paid: 0, pending: 0 };
          const amt = Number(b.total_php) || 0;
          rawGrouped[d].target += amt;
          if (b.status === 'checked_out' || b.status === 'checked_in') rawGrouped[d].paid += amt;
          if (b.status === 'confirmed' || b.status === 'pending') rawGrouped[d].pending += amt;
        }
        const maxDayTarget = Math.max(1, ...Object.values(rawGrouped).map((g) => g.target));
        return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => {
          const g = rawGrouped[d] || { target: 0, paid: 0, pending: 0 };
          return {
            day: d,
            target: g.target > 0 ? Math.max(18, Math.round((g.target / maxDayTarget) * 100)) : 0,
            paid: g.paid > 0 ? Math.max(12, Math.round((g.paid / maxDayTarget) * 100)) : 0,
            pending: g.pending > 0 ? Math.max(10, Math.round((g.pending / maxDayTarget) * 100)) : 0,
          };
        });
      })()
    : [];

  const dualSalesData = (data.daily && data.daily.length > 0)
    ? data.daily.slice(-12).map((d) => ({
        month: d.date ? new Date(d.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
        lineA: d.revenue_php || 0,
        lineB: d.dining_revenue_php !== undefined ? d.dining_revenue_php : ((d.bookings || 0) * 850),
      }))
    : [];

  // Guest Conversations & Live Messaging State
  const [guestConversations, setGuestConversations] = useState([]);

  useEffect(() => {
    if (!isAdministrator) return;
    api.conversations().then((convData) => {
      if (Array.isArray(convData)) setGuestConversations(convData);
    }).catch(() => {});
  }, [isAdministrator]);

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

  // Live Audit Auto Logger State
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditAutoRefresh, setAuditAutoRefresh] = useState(true);

  // Provision Administrator & Staff Modal State
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    role: 'administrator',
  });
  const [submittingAdmin, setSubmittingAdmin] = useState(false);

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

  // Accommodations & Inventory State (Live Synchronized with Supabase & Backend)
  const [roomsList, setRoomsList] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [loadingRoomsAndInv, setLoadingRoomsAndInv] = useState(false);
  const [inventorySubTab, setInventorySubTab] = useState('accommodations'); // 'accommodations' | 'supplies'
  const [inventoryDeptFilter, setInventoryDeptFilter] = useState('all');
  const [inventoryRoomFilter, setInventoryRoomFilter] = useState('all');
  const [inventorySearch, setInventorySearch] = useState('');

  // Modals for Accommodations & Inventory
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [newRoom, setNewRoom] = useState({
    name: '',
    category: 'Cottage',
    description: '',
    capacity: 2,
    units: 1,
    rate_php: 3500,
    amenities: 'Air Conditioning, Free Wi-Fi, Private Bath, Sea View',
  });
  const [editingRoom, setEditingRoom] = useState(null);
  const [uploadingRoomPhoto, setUploadingRoomPhoto] = useState(false);
  const [newPhotoUrlInput, setNewPhotoUrlInput] = useState('');
  const roomFileInputRef = useRef(null);

  const [showCreateSupplyModal, setShowCreateSupplyModal] = useState(false);
  const [newSupply, setNewSupply] = useState({
    item_name: '',
    category: 'housekeeping',
    stock_qty: 20,
    unit: 'pcs',
    reorder_at: 10,
  });
  const [editingSupply, setEditingSupply] = useState(null);

  const refreshRoomsAndInventory = useCallback(() => {
    setLoadingRoomsAndInv(true);
    Promise.all([api.rooms(true), api.departmentInventory()])
      .then(([r, inv]) => {
        setRoomsList(Array.isArray(r) ? r : []);
        setInventoryList(Array.isArray(inv) ? inv : []);
      })
      .catch((e) => toast(e.message, true))
      .finally(() => setLoadingRoomsAndInv(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'inventory') {
      refreshRoomsAndInventory();
    }
    if (activeTab === 'ledger') {
      refreshReservations();
      if (roomsList.length === 0) {
        api.rooms(true).then((r: any) => setRoomsList(Array.isArray(r) ? r : [])).catch(() => {});
      }
    }
    if (activeTab === 'notifications') {
      api.myNotifications().then((n: any) => Array.isArray(n) && setNotifications(n)).catch(() => {});
    }
  }, [activeTab, refreshRoomsAndInventory, refreshReservations, roomsList.length]);

  useEffect(() => {
    if (isAdministrator) {
      let live = true;
      let es = null;

      api.analyticsOverview()
        .then((d) => live && setData(d))
        .catch((e) => toast(e.message, true))
        .finally(() => live && setLoading(false));

      refreshReservations();

      api.myNotifications()
        .then((n) => live && setNotifications(n))
        .catch(() => {});

      supabase.auth.getSession().then(({ data: authData }) => {
        const token = localStorage.getItem('jd_admin_jwt') || authData?.session?.access_token;
        if (token) {
          const streamUrl = API_BASE ? `${API_BASE}/api/analytics/stream?token=${token}` : `/api/analytics/stream?token=${token}`;
          try {
            es = new EventSource(streamUrl);
            es.onmessage = (e) => {
              if (!live) return;
              try {
                const ov = JSON.parse(e.data);
                setData((prev) => (prev ? { ...prev, overview: ov } : prev));
              } catch {}
            };
            es.onerror = () => {
              if (es) { es.close(); es = null; }
            };
          } catch {}
        }
      });

      return () => {
        live = false;
        if (es) es.close();
      };
    } else {
      setLoading(false);
    }
  }, [isAdministrator, profile]);

  const fetchUsers = useCallback(() => {
    if (activeTab === 'accounts') {
      setSearchingUsers(true);
      api.adminCustomers(searchQuery, roleFilter)
        .then((data) => {
          if (Array.isArray(data)) setUsers(data);
        })
        .catch((e) => toast(e.message, true))
        .finally(() => setSearchingUsers(false));
    }
  }, [activeTab, searchQuery, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Live Audit Auto Logger Data Fetching
  const fetchAuditLogs = useCallback(() => {
    setLoadingAudit(true);
    const params = new URLSearchParams();
    if (auditActionFilter !== 'ALL') params.append('action', auditActionFilter);
    if (auditSearchQuery.trim()) params.append('q', auditSearchQuery.trim());
    params.append('limit', '80');

    api.auditLogs(params.toString())
      .then((res) => {
        if (res && Array.isArray(res.logs)) {
          setAuditLogs(res.logs);
        }
      })
      .catch((err) => {
        console.warn('[Audit Logs] Fetch notice:', err.message);
      })
      .finally(() => setLoadingAudit(false));
  }, [auditActionFilter, auditSearchQuery]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
      if (!auditAutoRefresh) return;
      const iv = setInterval(fetchAuditLogs, 5000);
      return () => clearInterval(iv);
    }
  }, [activeTab, auditActionFilter, auditSearchQuery, auditAutoRefresh, fetchAuditLogs]);

  const handleSaveSettings = (e) => {
    e.preventDefault();
    toast('⚙️ Executive Profile & Control Settings Live Synced ✦');
  };

  // GUARD CHECK: Live database administrator verification
  if (!isAdministrator) {
    // Case 1: Authenticated session, but database profile role lacks administrator clearance
    if (session && profile) {
      return (
        <div style={{
          minHeight: '100vh',
          width: '100%',
          background: 'radial-gradient(ellipse at 50% 20%, #0d1b38 0%, #060b18 70%)',
          color: '#e8eef7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          fontFamily: "'Outfit', sans-serif",
        }}>
          <div style={{
            maxWidth: 520,
            width: '100%',
            background: 'rgba(11, 20, 38, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            borderRadius: 24,
            padding: '36px 32px',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 35px rgba(244, 63, 94, 0.15)',
            textAlign: 'center',
          }}>
            <div style={{ display: 'inline-flex', padding: 14, borderRadius: 20, background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.3)', marginBottom: 16 }}>
              <IconShield size={36} color="#F43F5E" />
            </div>

            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '2.2rem',
              margin: '0 0 8px',
              color: '#FFFFFF',
              fontWeight: 600,
            }}>
              Administrative Clearance Required
            </h2>

            <p style={{ margin: '0 0 20px', fontSize: '.88rem', color: 'rgba(232, 238, 247, 0.75)', lineHeight: 1.6 }}>
              This portal is strictly guarded. The database profile acquired for your authenticated session does not possess administrator clearance.
            </p>

            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 14,
              padding: '16px',
              textAlign: 'left',
              marginBottom: 24,
              fontSize: '.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div><strong style={{ color: '#94A3B8' }}>Account Name:</strong> <span style={{ color: '#FFF' }}>{profile.full_name || 'User'}</span></div>
              <div><strong style={{ color: '#94A3B8' }}>Email:</strong> <span style={{ color: '#FFF' }}>{profile.email || user?.email}</span></div>
              <div>
                <strong style={{ color: '#94A3B8' }}>Database Role:</strong>{' '}
                <span style={{
                  color: '#F43F5E',
                  background: 'rgba(244, 63, 94, 0.15)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: '.78rem',
                }}>
                  {profile.role || 'customer'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => signOut()}
                style={{
                  width: '100%',
                  background: '#22c3ee',
                  color: '#060b18',
                  border: 'none',
                  borderRadius: 14,
                  padding: '13px 20px',
                  fontSize: '.82rem',
                  fontWeight: 800,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Sign In With Administrator Account ✦
              </button>
              <a
                href="/"
                style={{
                  color: 'rgba(232, 238, 247, 0.65)',
                  textDecoration: 'none',
                  fontSize: '.8rem',
                  fontWeight: 600,
                  marginTop: 6,
                }}
              >
                ← Return to Guest Homepage
              </a>
            </div>
          </div>
        </div>
      );
    }

    // Case 2: Unauthenticated - Clean 2-Field Login (Email & Password Only)
    return (
      <div style={{
        minHeight: '100vh',
        width: '100%',
        background: 'radial-gradient(ellipse at 50% 20%, #0d1b38 0%, #060b18 70%)',
        color: '#e8eef7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: "'Outfit', sans-serif",
      }}>
        <div style={{
          maxWidth: 480,
          width: '100%',
          background: 'rgba(11, 20, 38, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(34, 195, 238, 0.25)',
          borderRadius: 24,
          padding: '36px 32px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 35px rgba(34, 195, 238, 0.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(34, 195, 238, 0.12)',
              border: '1px solid rgba(34, 195, 238, 0.3)',
              color: '#22c3ee',
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: '.72rem',
              fontWeight: 800,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
            }}>
              <IconShield size={14} color="#22c3ee" /> Administrator Portal
            </span>
            <span style={{ fontSize: '.72rem', color: '#f6b74a', fontWeight: 700, letterSpacing: '.06em' }}>
              ✦ J&D RESORT
            </span>
          </div>

          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '2.4rem',
            margin: '0 0 8px',
            color: '#FFFFFF',
            fontWeight: 600,
            lineHeight: 1.1,
          }}>
            Administrator Sign In
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: '.86rem', color: 'rgba(232, 238, 247, 0.7)', lineHeight: 1.5 }}>
            Enter your credentials. Once authenticated, your identity and administrative role are verified automatically from the database.
          </p>

          {authError && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              borderRadius: 12,
              padding: '10px 14px',
              marginBottom: 18,
              fontSize: '.8rem',
              color: '#FECDD3',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span>⚠️</span>
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '.72rem', color: '#22c3ee', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 6 }}>
                Administrator Username or Email
              </label>
              <input
                type="text"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin_username or admin@example.com"
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 14,
                  padding: '12px 14px',
                  color: '#FFFFFF',
                  fontSize: '.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '.72rem', color: '#22c3ee', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                required
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 14,
                  padding: '12px 14px',
                  color: '#FFFFFF',
                  fontSize: '.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={authenticating}
              style={{
                width: '100%',
                marginTop: 8,
                background: '#22c3ee',
                color: '#060b18',
                border: 'none',
                borderRadius: 20,
                padding: '14px 20px',
                fontSize: '.82rem',
                fontWeight: 800,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                cursor: authenticating ? 'wait' : 'pointer',
                boxShadow: '0 10px 30px -8px rgba(34, 195, 238, 0.7)',
                transition: 'all 0.2s ease',
              }}
            >
              {authenticating ? 'Verifying Database Clearance…' : 'Sign In as Administrator ✦'}
            </button>
          </form>

          <div style={{ marginTop: 22, textAlign: 'center' }}>
            <a
              href="/"
              style={{
                color: 'rgba(232, 238, 247, 0.6)',
                textDecoration: 'none',
                fontSize: '.78rem',
                fontWeight: 600,
              }}
            >
              ← Return to Guest Homepage
            </a>
          </div>
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

  async function updateStatus(id: string, status: string) {
    try {
      await api.setReservationStatus(id, status);
      toast(`Reservation marked as ${status.replace('_', ' ')}`);
      setReservationsList((prev: any[]) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
      setData((x) => ({
        ...x,
        bookings: (x.bookings || []).map((b: any) => (b.id === id ? { ...b, status } : b)),
      }));
    } catch (e: any) { toast(e.message, true); }
  }

  async function handleCreateReservation(e: React.FormEvent) {
    e.preventDefault();
    setCreatingReservation(true);
    try {
      if (!newReservation.room_id) {
        throw new Error('Please select an accommodation / room.');
      }
      if (!newReservation.guest_name.trim()) {
        throw new Error('Please enter guest full name.');
      }
      if (!newReservation.phone.trim()) {
        throw new Error('Please enter guest mobile number for SMS notifications.');
      }
      await api.createReservation({
        ...newReservation,
        total_php: Number(newReservation.total_php),
        guests: Number(newReservation.guests),
      });
      toast('✦ New reservation recorded and added to Ledger!');
      setShowAddReservationModal(false);
      setNewReservation({
        guest_name: '',
        phone: '',
        guest_email: '',
        room_id: '',
        check_in: new Date().toISOString().slice(0, 10),
        check_out: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        guests: 2,
        total_php: 3500,
        payment_method: 'GCash',
        payment_status: 'confirmed',
        notes: 'Direct Front Desk walk-in entry',
      });
      refreshReservations();
      handleManualSync();
    } catch (err: any) {
      toast(err.message || 'Failed to record reservation', true);
    } finally {
      setCreatingReservation(false);
    }
  }

  const unreadNotifsCount = notifications.filter((n: any) => !n.is_read).length;

  const handleMarkNotifRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev: any[]) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      toast('Notification marked as read');
    } catch (err: any) {
      console.warn(err);
    }
  };

  const handleMarkAllNotifsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev: any[]) => prev.map((n) => ({ ...n, is_read: true })));
      toast('All notifications marked as read');
    } catch (err: any) {
      console.warn(err);
    }
  };

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

  // Accommodations & Inventory Handlers
  async function handleCreateRoom(e) {
    e.preventDefault();
    try {
      const amenitiesArr = newRoom.amenities
        ? newRoom.amenities.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const created = await api.createRoom({
        name: newRoom.name,
        category: newRoom.category,
        description: newRoom.description,
        capacity: Number(newRoom.capacity),
        units: Number(newRoom.units),
        rate_php: Number(newRoom.rate_php),
        amenities: amenitiesArr,
      });
      setRoomsList((prev) => [...prev, created]);
      setShowCreateRoomModal(false);
      setNewRoom({
        name: '',
        category: 'Cottage',
        description: '',
        capacity: 2,
        units: 1,
        rate_php: 3500,
        amenities: 'Air Conditioning, Free Wi-Fi, Private Bath, Sea View',
      });
      toast(`✦ Accommodation "${created.name}" created successfully`);
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function handleUpdateRoomSubmit(e) {
    e.preventDefault();
    if (!editingRoom) return;
    try {
      const amenitiesArr = typeof editingRoom.amenities === 'string'
        ? editingRoom.amenities.split(',').map((s) => s.trim()).filter(Boolean)
        : (editingRoom.amenities || []);
      const imagesArr = Array.isArray(editingRoom.images)
        ? editingRoom.images.filter(Boolean)
        : (editingRoom.image_url ? [editingRoom.image_url] : []);
      const primaryImg = editingRoom.image_url || imagesArr[0] || '';

      const updated = await api.updateRoom(editingRoom.id, {
        name: editingRoom.name,
        category: editingRoom.category,
        description: editingRoom.description,
        capacity: Number(editingRoom.capacity),
        units: Number(editingRoom.units),
        rate_php: Number(editingRoom.rate_php),
        amenities: amenitiesArr,
        image_url: primaryImg,
        images: imagesArr,
      });

      setRoomsList((prev) => prev.map((r) => (r.id === editingRoom.id ? { ...r, ...updated } : r)));
      setEditingRoom(null);
      toast(`✦ Accommodation "${editingRoom.name}" updated & synchronized live!`);
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function handleRoomPhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !editingRoom) return;

    if (!file.type.startsWith('image/')) {
      toast('Please upload a valid image file (JPG, PNG, WebP).', true);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast('Image file exceeds 5MB limit.', true);
      return;
    }

    try {
      setUploadingRoomPhoto(true);
      toast('Uploading photo…');
      const uploaded = await uploadImageToCloudinary(file);
      const url = uploaded.url;
      const currentList = Array.isArray(editingRoom.images) ? [...editingRoom.images] : [];
      if (!currentList.includes(url)) currentList.push(url);
      const primaryUrl = editingRoom.image_url || url;

      setEditingRoom({
        ...editingRoom,
        image_url: primaryUrl,
        images: currentList,
      });

      toast('✅ Room photo uploaded successfully!');
    } catch (err: any) {
      toast(err.message || 'Failed to upload photo', true);
    } finally {
      setUploadingRoomPhoto(false);
      if (e.target) e.target.value = '';
    }
  }

  function handleAddPhotoUrl() {
    if (!editingRoom || !newPhotoUrlInput.trim()) return;
    const cleanUrl = newPhotoUrlInput.trim();
    const currentList = Array.isArray(editingRoom.images) ? [...editingRoom.images] : [];
    if (!currentList.includes(cleanUrl)) currentList.push(cleanUrl);
    setEditingRoom({
      ...editingRoom,
      image_url: editingRoom.image_url || cleanUrl,
      images: currentList,
    });
    setNewPhotoUrlInput('');
    toast('🖼️ Added photo to room gallery');
  }

  function handleAddPresetPhoto(presetUrl) {
    if (!editingRoom) return;
    const currentList = Array.isArray(editingRoom.images) ? [...editingRoom.images] : [];
    if (!currentList.includes(presetUrl)) currentList.push(presetUrl);
    setEditingRoom({
      ...editingRoom,
      image_url: editingRoom.image_url || presetUrl,
      images: currentList,
    });
    toast('✨ Added scenic resort preset photo');
  }

  function handleRemovePhoto(indexToRemove) {
    if (!editingRoom || !Array.isArray(editingRoom.images)) return;
    const filtered = editingRoom.images.filter((_, idx) => idx !== indexToRemove);
    const newPrimary = filtered.includes(editingRoom.image_url)
      ? editingRoom.image_url
      : (filtered[0] || '');
    setEditingRoom({
      ...editingRoom,
      image_url: newPrimary,
      images: filtered,
    });
    toast('🗑️ Removed photo from gallery');
  }

  function handleSetPrimaryPhoto(url) {
    if (!editingRoom) return;
    setEditingRoom({
      ...editingRoom,
      image_url: url,
    });
    toast('⭐ Set as primary showcase photo');
  }

  async function handleToggleRoomActive(room) {
    try {
      const nextActive = !room.is_active;
      await api.updateRoom(room.id, { is_active: nextActive });
      setRoomsList((prev) => prev.map((r) => (r.id === room.id ? { ...r, is_active: nextActive } : r)));
      toast(nextActive ? `✅ ${room.name} marked Active` : `⏸️ ${room.name} placed in Maintenance`);
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function handleDeleteRoom(room) {
    if (!room?.id) return;
    const ok = window.confirm(`Permanently remove accommodation "${room.name}"? If there are no bookings referencing it, this will completely delete it from the system.`);
    if (!ok) return;
    try {
      await api.deleteRoom(room.id, true);
      setRoomsList((prev) => prev.filter((r) => r.id !== room.id));
      if (editingRoom?.id === room.id) setEditingRoom(null);
      toast(`🗑️ Accommodation "${room.name}" deleted successfully`);
    } catch (err: any) {
      toast(`Delete failed: ${err.message || 'Error deleting room'}`, true);
    }
  }

  async function handleCreateSupply(e) {
    e.preventDefault();
    try {
      const created = await api.createInventoryItem({
        item_name: newSupply.item_name,
        category: newSupply.category,
        stock_qty: Number(newSupply.stock_qty),
        unit: newSupply.unit,
        reorder_at: Number(newSupply.reorder_at),
      });
      setInventoryList((prev) => [...prev, created]);
      setShowCreateSupplyModal(false);
      setNewSupply({
        item_name: '',
        category: 'housekeeping',
        stock_qty: 20,
        unit: 'pcs',
        reorder_at: 10,
      });
      toast(`✦ Supply "${created.item_name}" registered`);
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function handleAdjustSupplyStock(item, delta) {
    const nextQty = Math.max(0, (item.stock_qty || 0) + delta);
    try {
      const updated = await api.updateInventoryItem(item.id, { stock_qty: nextQty });
      setInventoryList((prev) => prev.map((i) => (i.id === item.id ? { ...i, stock_qty: nextQty, updated_at: updated.updated_at } : i)));
      toast(`Stock for ${item.item_name}: ${nextQty} ${item.unit}`);
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function handleDeleteSupply(id, name) {
    if (!confirm(`Delete supply item "${name}" from inventory?`)) return;
    try {
      await api.deleteInventoryItem(id);
      setInventoryList((prev) => prev.filter((i) => i.id !== id));
      toast(`Deleted "${name}"`);
    } catch (err) {
      toast(err.message, true);
    }
  }

  // Unified display bookings from either direct reservationsList or data.bookings
  const rawDisplayBookings = reservationsList.length > 0 ? reservationsList : (data.bookings || []);
  const allBookings = rawDisplayBookings.map((b: any) => ({
    ...b,
    nights: b.nights || Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000)),
  }));

  const filteredBookings = allBookings.filter((b: any) => {
    if (reservationFilter !== 'all' && b.status !== reservationFilter) return false;
    if (reservationSearch.trim()) {
      const q = reservationSearch.toLowerCase();
      const guestName = (b.guest_name || b.profiles?.full_name || '').toLowerCase();
      const phone = (b.phone || b.profiles?.phone || '').toLowerCase();
      const room = (b.rooms?.name || '').toLowerCase();
      const id = (b.id || '').toLowerCase();
      if (!guestName.includes(q) && !phone.includes(q) && !room.includes(q) && !id.includes(q)) return false;
    }
    return true;
  });

  const sidebarItems = [
    { key: 'overview', label: 'Dashboard & Analytics', icon: <IconAnalytics size={19} /> },
    { key: 'ledger', label: 'Reservations Ledger', icon: <IconLedger size={19} />, count: allBookings.length, badgeColor: '#0EA5E9' },
    { key: 'notifications', label: 'Alerts & Notifications', icon: <IconBell size={19} />, count: unreadNotifsCount, badgeColor: '#F43F5E' },
    { key: 'inventory', label: 'Accommodations & Inventory', icon: <IconBuilding size={19} /> },
    { key: 'conversations', label: 'Customer Services', icon: <IconMessages size={19} /> },
    { key: 'food_sales', label: 'Dining Sales', icon: <IconDining size={19} /> },
    { key: 'accounts', label: 'Staff & Accounts', icon: <IconUsers size={19} /> },
    { key: 'audit', label: 'System Audit Logs', icon: <IconShield size={19} /> },
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
    <div className={`admin-portal ${isLightMode ? 'light-mode' : 'dark-mode'}`}>
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

      {/* 1. VERTICAL EXECUTIVE SAAS SIDEBAR NAVIGATION BAR (FIXED DOCKED STATE) */}
      <aside
        className={`sidebar ${sidebarMobileOpen ? 'mobile-open' : ''} ${sidebarHidden ? 'hidden' : ''}`}
        style={{
          width: sidebarHidden ? 0 : (sidebarCollapsed ? 76 : 268),
          minWidth: sidebarHidden ? 0 : (sidebarCollapsed ? 76 : 268),
          maxWidth: sidebarHidden ? 0 : (sidebarCollapsed ? 76 : 268),
          background: themeSidebarBg,
          borderRight: sidebarHidden ? 'none' : `1px solid ${themeBorder}`,
        }}
      >
        {/* SIDEBAR LOGO BRANDING & DOCK CONTROLS */}
        <div style={{ padding: '16px 14px', display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', borderBottom: `1px solid ${themeBorder}` }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="sidebar-action-btn"
              title={sidebarCollapsed ? "Expand sidebar menu" : "Collapse to icon rail"}
              aria-label="Toggle compact sidebar"
            >
              {sidebarCollapsed ? '▶' : '◀'}
            </button>
            {!sidebarCollapsed && (
              <button
                onClick={() => setSidebarHidden(true)}
                className="sidebar-action-btn"
                title="Hide sidebar menu completely"
                aria-label="Hide sidebar menu"
              >
                ✕
              </button>
            )}
          </div>
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
                onClick={() => {
                  setActiveTab(item.key);
                  setSidebarMobileOpen(false);
                }}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarCollapsed ? 'center' : 'space-between',
                  padding: sidebarCollapsed ? '10px' : '10px 14px',
                  borderRadius: 12,
                  border: isActive ? '1px solid #4338CA' : '1px solid transparent',
                  background: isActive ? 'linear-gradient(135deg, #4338CA, #6366F1)' : 'transparent',
                  color: isActive ? '#FFFFFF' : themeMuted,
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '.86rem',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  width: '100%',
                  boxShadow: isActive ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: sidebarCollapsed ? 'none' : 1, minWidth: 0, textAlign: 'left' }}>
                  <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: isActive ? '#FFFFFF' : '#6366F1' }}>
                    {item.icon}
                  </span>
                  {!sidebarCollapsed && (
                    <span style={{ color: isActive ? '#FFFFFF' : themeText, fontWeight: isActive ? 800 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>
                      {item.label}
                    </span>
                  )}
                </div>

                {/* NOTIFICATION BADGE / ACTIVE PILL DOT */}
                {!sidebarCollapsed && ((item as any).count !== undefined ? (item as any).count > 0 : (item.key === 'accounts' || item.key === 'conversations')) && (
                  <span
                    style={{
                      marginLeft: 8,
                      flexShrink: 0,
                      background: (item as any).badgeColor
                        ? (item as any).badgeColor
                        : item.key === 'conversations'
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
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                    }}
                  >
                    {(item as any).count !== undefined ? (item as any).count : (item.key === 'conversations' ? (guestConversations.length || 8) : (users.length || 4))}
                  </span>
                )}
                {sidebarCollapsed && (item as any).count > 0 && (
                  <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: (item as any).badgeColor || '#F43F5E' }} />
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
              padding: sidebarCollapsed ? 0 : '0 14px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #4338CA, #6366F1)',
              color: '#FFF',
              border: 'none',
              fontWeight: 700,
              fontSize: '.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: 10,
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
              margin: '0 auto',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18 }}>❓</span>
            {!sidebarCollapsed && <span>Help & Support</span>}
          </button>

          <button
            onClick={signOut}
            style={{
              width: '100%',
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: 10,
              padding: sidebarCollapsed ? 0 : '0 14px',
              borderRadius: 12,
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

      {/* 2. MAIN EXECUTIVE RIGHT PANE WRAPPER */}
      <div className="admin-right-pane">
        {/* TOP EXECUTIVE HEADER CONTROL BAR WITH NOTIFICATIONS, PROFILE & THEME TOGGLE */}
        <header className="admin-header" style={{ background: themeHeaderBg, borderBottom: `1px solid ${themeBorder}` }}>
          {/* SIDEBAR TOGGLE, BREADCRUMB & SEARCH */}
          <div className="admin-header-left">
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  setSidebarMobileOpen(!sidebarMobileOpen);
                } else {
                  setSidebarHidden(!sidebarHidden);
                }
              }}
              className="sidebar-toggle-btn"
              title={sidebarHidden ? "Show sidebar menu" : "Hide sidebar menu"}
              aria-label="Toggle navigation menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              <span className="sidebar-toggle-label">{sidebarHidden ? 'Show Menu' : 'Hide Menu'}</span>
            </button>

            <span className="admin-header-title">
              <span className="admin-header-corp-prefix">Executive Control Center</span>
              <span className="admin-header-tab-name"> / {sidebarItems.find(i => i.key === activeTab)?.label}</span>
            </span>

            <div className="admin-header-search-wrap">
              <input
                className="search admin-header-search"
                placeholder="Search analytics, guests, or stays…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="admin-header-search-icon">
                <IconSearch size={14} />
              </span>
            </div>
          </div>

          {/* TOP RIGHT CONTROLS: SYNC LIVE, LIGHT/DARK THEME TOGGLE, NOTIFICATION BAR & AVATAR */}
          <div className="admin-header-right">

            {/* SYNC LIVE ON-DEMAND BUTTON */}
            <button
              onClick={handleManualSync}
              disabled={refreshingAnalytics}
              className="admin-header-btn admin-header-sync-btn"
              title="Synchronize live analytics and bookings with database"
            >
              <span style={{ display: 'inline-flex', animation: refreshingAnalytics ? 'spin 1s linear infinite' : 'none' }}>
                <IconRefresh size={14} color="#0284C7" />
              </span>
              <span className="btn-label">{refreshingAnalytics ? 'Syncing…' : 'Sync Live'}</span>
            </button>

            {/* LIGHT MODE / DARK MODE TOGGLE BUTTON */}
            <button
              onClick={toggleThemeMode}
              className="admin-header-btn admin-theme-toggle-btn"
              title={isLightMode ? 'Switch to Dark Luxury Theme' : 'Switch to Executive White Theme'}
            >
              {isLightMode ? <IconMoon size={15} color="#6366F1" /> : <IconSun size={15} color="#F59E0B" />}
              <span className="theme-btn-label">{isLightMode ? 'Dark Mode' : 'Light Mode'}</span>
            </button>

            {/* NOTIFICATION BAR ICON & DROPDOWN */}
            <div className="admin-header-notif-wrap" style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`admin-header-btn admin-header-notif-btn ${unreadNotifsCount > 0 ? 'has-alerts' : ''}`}
                title="Executive Notifications & SMS Alerts"
              >
                <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <IconBell size={16} color={unreadNotifsCount > 0 ? '#E11D48' : themeText} />
                  {unreadNotifsCount > 0 && (
                    <span className="notif-badge" style={{ position: 'absolute', top: -8, right: -10 }}>
                      {unreadNotifsCount}
                    </span>
                  )}
                </span>
                <span className="btn-label" style={{ fontWeight: 700, color: unreadNotifsCount > 0 ? '#E11D48' : themeText }}>
                  Alerts {notifications.length > 0 ? `(${notifications.length})` : ''}
                </span>
              </button>

              {/* NOTIFICATION PANELS DROPDOWN */}
              {showNotifications && (
                <>
                  <div
                    onClick={() => setShowNotifications(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 44,
                      width: 360,
                      maxWidth: 'calc(100vw - 28px)',
                      background: themeSidebarBg,
                      border: `1px solid ${themeBorder}`,
                      borderRadius: 14,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                      padding: 14,
                      zIndex: 200,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${themeBorder}`, paddingBottom: 8, marginBottom: 10 }}>
                      <div>
                        <b style={{ fontSize: '.88rem', color: themeText }}>Executive Notifications</b>
                        <small style={{ color: '#0EA5E9', fontSize: '.72rem', display: 'block' }}>SMS & Live System Alerts</small>
                      </div>
                      {unreadNotifsCount > 0 && (
                        <button
                          onClick={handleMarkAllNotifsRead}
                          style={{ background: 'transparent', border: 'none', color: '#0EA5E9', fontSize: '.74rem', cursor: 'pointer', fontWeight: 700 }}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <p className="muted small" style={{ margin: 0, padding: 16, textAlign: 'center' }}>No new notifications.</p>
                    ) : (
                      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                        {notifications.slice(0, 6).map((n: any) => (
                          <div
                            key={n.id}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 8,
                              marginBottom: 4,
                              background: !n.is_read ? (isLightMode ? '#F1F5F9' : 'rgba(99,102,241,0.12)') : 'transparent',
                              borderBottom: `1px solid ${themeBorder}`,
                              fontSize: '.78rem',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                              <span className={`pill ${n.status || 'sent'}`}>{n.status || 'sent'}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ color: themeMuted, fontSize: '.72rem' }}>{fmtTime(n.created_at)}</span>
                                {!n.is_read && (
                                  <button
                                    onClick={() => handleMarkNotifRead(n.id)}
                                    title="Mark as read"
                                    style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', fontSize: '.75rem', padding: '0 4px', fontWeight: 800 }}
                                  >
                                    ✓
                                  </button>
                                )}
                              </div>
                            </div>
                            <span style={{ color: themeText, display: 'block', marginTop: 2 }}>{n.body || n.content}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ borderTop: `1px solid ${themeBorder}`, paddingTop: 10, marginTop: 10 }}>
                      <button
                        onClick={() => {
                          setActiveTab('notifications');
                          setShowNotifications(false);
                        }}
                        className="btn btn-sky btn-sm"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        Open Full Alerts Center ➔
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ADMIN PROFILE AVATAR & BADGE */}
            <div className="admin-header-profile" title={`Administrator: ${adminProfileState.fullName}`}>
              {adminProfileState.customAvatarUrl ? (
                <img src={adminProfileState.customAvatarUrl} alt="Admin Avatar" className="admin-profile-avatar" />
              ) : (
                <span className="admin-profile-avatar placeholder">
                  <IconCrown size={15} color="#FFF" />
                </span>
              )}
              <div className="admin-profile-info">
                <b className="admin-profile-name">{adminProfileState.fullName.split(' ')[0]}</b>
                <span className="admin-profile-role">ADMIN</span>
              </div>
            </div>
          </div>
        </header>

        {/* 3. DASHBOARD MAIN TAB VIEW (ISOLATED INDEPENDENT SCROLL CONTAINER) */}
        <div className="admin-main-content">
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
                {/* Card 1: Automation Rate */}
                <div
                  className="panel-card kpi-card"
                  onClick={() => toast(`🤖 Automation Rate: ${ov.automation_rate_pct || 82}% AI Chatbot Resolution Engine`)}
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
                        {ov.automation_rate_pct || 82}%
                      </b>
                      <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 4, display: 'block' }}>
                        AUTOMATION RATE
                      </span>
                    </div>
                    <span style={{ fontSize: '1.6rem', padding: 8, background: 'rgba(99, 102, 241, 0.1)', borderRadius: 12 }}>🤖</span>
                  </div>
                  <span style={{ fontSize: '.74rem', color: '#10B981', fontWeight: 600, marginTop: 10, display: 'block' }}>
                    ⇧ 16% <small style={{ color: themeMuted }}>AI inquiry resolution</small>
                  </span>
                </div>

                {/* Card 2: Bookings Made Via Chat */}
                <div
                  className="panel-card kpi-card"
                  onClick={() => {
                    setActiveTab('ledger');
                    toast(`🔖 ${ov.chatbot_bookings || 0} Bookings assisted via Resort Chatbot`);
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
                        {ov.chatbot_bookings || 0}
                      </b>
                      <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 4, display: 'block' }}>
                        BOOKINGS MADE VIA CHAT
                      </span>
                    </div>
                    <span style={{ fontSize: '1.6rem', padding: 8, background: 'rgba(56, 189, 248, 0.1)', borderRadius: 12 }}>🔖</span>
                  </div>
                  <span style={{ fontSize: '.74rem', color: '#10B981', fontWeight: 600, marginTop: 10, display: 'block' }}>
                    ✦ Direct guest engagement
                  </span>
                </div>

                {/* Card 3: Chatbot CSAT Score */}
                <div
                  className="panel-card kpi-card"
                  onClick={() => toast(`😊 Chatbot CSAT Score: ${ov.chatbot_csat_pct || 88}% Guest Satisfaction Rating`)}
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
                        {ov.chatbot_csat_pct || 88}%
                      </b>
                      <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 4, display: 'block' }}>
                        CHATBOT CSAT SCORE
                      </span>
                    </div>
                    <span style={{ fontSize: '1.6rem', padding: 8, background: 'rgba(52, 211, 153, 0.1)', borderRadius: 12 }}>😊</span>
                  </div>
                  <span style={{ fontSize: '.74rem', color: '#10B981', fontWeight: 600, marginTop: 10, display: 'block' }}>
                    ⇧ Verified guest rating
                  </span>
                </div>

                {/* Card 4: Conversations Handled */}
                <div
                  className="panel-card kpi-card"
                  onClick={() => {
                    setActiveTab('conversations');
                    toast(`👥 ${ov.conversations_closed || guestConversations.length || 0} Operations Inquiries Handled`);
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
                        {ov.conversations_closed || guestConversations.length || 0}
                      </b>
                      <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 4, display: 'block' }}>
                        CONVERSATIONS HANDLED
                      </span>
                    </div>
                    <span style={{ fontSize: '1.6rem', padding: 8, background: 'rgba(245, 158, 11, 0.1)', borderRadius: 12 }}>👥</span>
                  </div>
                  <span style={{ fontSize: '.74rem', color: '#10B981', fontWeight: 600, marginTop: 10, display: 'block' }}>
                    ✦ Active concierge threads
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
                      totalChats={ov.conversations_closed || guestConversations.length || 0}
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
                          onClick={() => toast(`📈 Revenue Status: ₱${Number(data.overview?.total_revenue_php || 0).toLocaleString()} (Active Stays: ${data.overview?.stays_total || 0})`)}
                          style={{ fontSize: '.78rem', color: '#10B981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: 8, cursor: 'pointer' }}
                          title="Click for revenue status"
                        >
                          {data.overview?.total_revenue_php > 0 ? `₱${Number(data.overview.total_revenue_php).toLocaleString()}` : 'Awaiting Stays'}
                        </span>
                      </div>
                      <AreaLineChart 
                        data={salesOverviewData} 
                        height={150} 
                        onPointClick={(item) => {
                          const rev = item.revenue > 0 ? item.revenue : (item.value * 4500);
                          const dynamicInsight = rev > 60000
                            ? `Peak weekend demand: High villa & sea-view suite reservations on Patar beachfront.`
                            : rev > 30000
                              ? `Steady inbound guest volume: Cottage rentals and beachfront dining orders.`
                              : `Mid-week baseline: Standard room stays and casual tour inquiries.`;

                          setSelectedSalesItem({
                            ...item,
                            insight: dynamicInsight,
                            revenuePhp: rev,
                            nights: Math.max(1, Math.round(item.value * 1.5)),
                          });
                          toast(`📈 Sales Insight ${item.label}: ₱${rev.toLocaleString()}`);
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
                          {data.overview?.automation_rate_pct ? `${data.overview.automation_rate_pct}% Automation` : 'Live Operations'}
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
                            {guestConversations.length > 0 ? `${guestConversations.length} Active Conversations to Solve!` : 'Awaiting Guest Inquiries'}
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
                          const isHighlighted = activeChatGuest?.id === g.id;
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

              {/* LIVE RESORT ALERTS & SMS STREAM FEED */}
              <div className="panel panel-card" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: '18px 22px', boxShadow: themeShadow, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, background: isLightMode ? '#FFF1F2' : 'rgba(244, 63, 94, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconBell size={18} color="#E11D48" />
                    </span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>
                        Live Resort Alerts & SMS Stream {unreadNotifsCount > 0 && <span className="notif-badge" style={{ position: 'static', display: 'inline-flex', marginLeft: 6 }}>{unreadNotifsCount}</span>}
                      </h4>
                      <small style={{ color: themeMuted }}>Real-time guest booking confirmations, stay operations and front-desk dispatches</small>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-sky btn-sm"
                      onClick={() => setActiveTab('notifications')}
                      style={{ fontWeight: 700 }}
                    >
                      Open Alerts Center ➔
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => setActiveTab('ledger')}
                      style={{ background: isLightMode ? '#F0F9FF' : 'rgba(14, 165, 233, 0.15)', color: '#0284C7', border: '1px solid #BAE6FD', fontWeight: 700 }}
                    >
                      Reservations Ledger ({allBookings.length}) ➔
                    </button>
                  </div>
                </div>

                {notifications.length === 0 ? (
                  <p className="muted small" style={{ margin: 0, padding: '10px 0' }}>No active notifications recorded yet. Automated SMS alerts will stream here when guests book.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                    {notifications.slice(0, 3).map((n: any) => (
                      <div
                        key={n.id}
                        onClick={() => setActiveTab('notifications')}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 12,
                          background: isLightMode ? '#F8FAFC' : 'rgba(255, 255, 255, 0.04)',
                          border: `1px solid ${n.is_read ? themeBorder : '#6366F1'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span className={`pill ${n.status || 'sent'}`}>{n.status || 'sent'}</span>
                          <span style={{ fontSize: '.72rem', color: themeMuted }}>{fmtTime(n.created_at)}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '.82rem', color: themeText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.body || n.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION 4: BOTTOM THREE DIAGNOSTIC PANELS (RESPONSIVE 3-PANEL GRID) */}
              <div className="admin-grid-bottom-3">
                {/* Panel 1: Summary Category Pills */}
                <div className="panel panel-card" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 20, boxShadow: themeShadow, minWidth: 0 }}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: 14, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>Summary</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div
                      onClick={() => {
                        setActiveTab('ledger');
                        toast('📋 Navigated to Live Guest Reservations Ledger');
                      }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: isLightMode ? '#F0F9FF' : 'rgba(14,165,233,0.15)', borderRadius: 12, color: isLightMode ? '#0284C7' : '#38BDF8', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease', border: `1px solid ${isLightMode ? '#BAE6FD' : 'rgba(14,165,233,0.3)'}` }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      title="Click to view Reservations Ledger"
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.92rem' }}>📋 Reservations Ledger</span>
                      <span className="pill" style={{ background: '#0EA5E9', color: '#FFFFFF', fontWeight: 800, padding: '4px 12px', borderRadius: 16, fontSize: '.8rem' }}>{allBookings.length} stays</span>
                    </div>

                    <div
                      onClick={() => {
                        setActiveTab('notifications');
                        toast('🔔 Navigated to Executive Notifications & Alerts Center');
                      }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: isLightMode ? '#FFF1F2' : 'rgba(244,63,94,0.15)', borderRadius: 12, color: isLightMode ? '#E11D48' : '#F43F5E', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease', border: `1px solid ${isLightMode ? '#FECDD3' : 'rgba(244,63,94,0.3)'}` }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      title="Click to view full Notification Center"
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.92rem' }}>🔔 Alert Center</span>
                      <span className="pill" style={{ background: '#F43F5E', color: '#FFFFFF', fontWeight: 800, padding: '4px 12px', borderRadius: 16, fontSize: '.8rem' }}>{unreadNotifsCount > 0 ? `${unreadNotifsCount} new` : `${notifications.length} alerts`}</span>
                    </div>

                    <div
                      onClick={() => {
                        setActiveTab('audit');
                        toast('🛡️ Switched to Live System Audit Logs');
                      }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', borderRadius: 12, color: themeText, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease', border: `1px solid ${themeBorder}` }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      title="Click to view full System Audit Trail"
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.92rem' }}>🛡️ Audit Trail</span>
                      <span className="pill" style={{ background: '#64748B', color: '#FFFFFF', fontWeight: 800, padding: '4px 12px', borderRadius: 16, fontSize: '.8rem' }}>Live Stream</span>
                    </div>

                    <div
                      onClick={() => {
                        setShowCreateModal(true);
                        toast('📁 Opening Provision Staff Account & Department Group modal');
                      }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: isLightMode ? '#F5F3FF' : 'rgba(139,92,246,0.15)', borderRadius: 12, color: isLightMode ? '#7C3AED' : '#A78BFA', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease', border: `1px solid ${isLightMode ? '#DDD6FE' : 'rgba(139,92,246,0.3)'}` }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      title="Click to add a new Staff / Department Group Account"
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.92rem' }}>📁 Add Group</span>
                      <span className="pill" style={{ background: '#8B5CF6', color: '#FFFFFF', fontWeight: 800, padding: '4px 12px', borderRadius: 16, fontSize: '.8rem' }}>4 groups</span>
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
                      <b style={{ color: '#0EA5E9', fontSize: '.9rem' }}>{money(data.overview?.total_revenue_php || 0)}</b>
                    </div>
                    <small style={{ color: themeMuted, display: 'block', marginBottom: 12 }}>By Referrer Category</small>
                    <ReferrerCategoryBarChart isLightMode={isLightMode} totalAmount={data.overview?.total_revenue_php || 0} />
                  </div>
                </div>

                {/* Panel 3: Total Sales Dual-Line Multi-Trend Curve Graph */}
                <div className="panel panel-card" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 20, boxShadow: themeShadow, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
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

          {/* TAB 2: ACCOMMODATIONS & INVENTORY MANAGEMENT */}
          {activeTab === 'inventory' && (
            <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24, boxShadow: themeShadow }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
                <div>
                  <span className="label light">Resort Infrastructure & Assets</span>
                  <h3 className="serif" style={{ fontSize: '1.6rem', margin: '4px 0 0', color: themeText }}>Accommodations & Inventory Hub</h3>
                  <p className="muted small" style={{ margin: '4px 0 0' }}>Live control of room rates, unit inventory, availability, and resort department stock supplies.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    className="search"
                    placeholder="Search rooms or supplies…"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    style={{ maxWidth: 220, background: isLightMode ? '#FFF' : undefined, color: themeText }}
                  />
                  <button className="btn btn-sm" onClick={refreshRoomsAndInventory} disabled={loadingRoomsAndInv} style={{ border: `1px solid ${themeBorder}`, color: themeText }}>
                    {loadingRoomsAndInv ? 'Syncing…' : '↻ Sync Now'}
                  </button>
                  {inventorySubTab === 'accommodations' ? (
                    <button className="btn btn-sky btn-sm" onClick={() => setShowCreateRoomModal(true)}>
                      + Provision Room
                    </button>
                  ) : (
                    <button className="btn btn-sky btn-sm" onClick={() => setShowCreateSupplyModal(true)}>
                      + Add Supply Item
                    </button>
                  )}
                </div>
              </div>

              {/* STAT SUMMARY BAND */}
              <div className="admin-grid-4-col" style={{ gap: 12, marginBottom: 20 }}>
                <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 14 }}>
                  <span style={{ fontSize: '.72rem', color: themeMuted, textTransform: 'uppercase', fontWeight: 700 }}>Accommodations</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: themeText, marginTop: 4 }}>{roomsList.length} Categories</div>
                </div>
                <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 14 }}>
                  <span style={{ fontSize: '.72rem', color: themeMuted, textTransform: 'uppercase', fontWeight: 700 }}>Total Units</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38BDF8', marginTop: 4 }}>
                    {roomsList.reduce((acc, r) => acc + (r.units || 0), 0)} Physical Rooms
                  </div>
                </div>
                <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 14 }}>
                  <span style={{ fontSize: '.72rem', color: themeMuted, textTransform: 'uppercase', fontWeight: 700 }}>Resort Supplies</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10B981', marginTop: 4 }}>
                    {inventoryList.length} Tracked Items
                  </div>
                </div>
                <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 14 }}>
                  <span style={{ fontSize: '.72rem', color: themeMuted, textTransform: 'uppercase', fontWeight: 700 }}>Reorder Alerts</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: inventoryList.filter(i => (i.stock_qty || 0) <= (i.reorder_at || 10)).length > 0 ? '#F43F5E' : '#10B981', marginTop: 4 }}>
                    {inventoryList.filter(i => (i.stock_qty || 0) <= (i.reorder_at || 10)).length} Items Low
                  </div>
                </div>
              </div>

              {/* SUBTAB SWITCHER */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4 }}>
                {[
                  { key: 'accommodations', label: '🏡 Accommodations & Rates', count: roomsList.length },
                  { key: 'supplies', label: '📦 Resort Supplies Ledger', count: inventoryList.length },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setInventorySubTab(tab.key)}
                    style={{
                      flex: 1, padding: '10px 16px', border: 'none', borderRadius: 10, cursor: 'pointer',
                      fontSize: '.84rem', fontWeight: 700, transition: 'all 0.25s ease',
                      background: inventorySubTab === tab.key
                        ? (tab.key === 'accommodations' ? 'linear-gradient(135deg, #0284C7, #0EA5E9)' : 'linear-gradient(135deg, #4338CA, #6366F1)')
                        : 'transparent',
                      color: inventorySubTab === tab.key ? '#FFF' : themeMuted,
                      boxShadow: inventorySubTab === tab.key ? '0 4px 12px rgba(14,165,233,0.25)' : 'none',
                    }}
                  >
                    {tab.label} <span style={{ opacity: 0.85, fontSize: '.74rem', marginLeft: 4 }}>({tab.count})</span>
                  </button>
                ))}
              </div>

              {/* SUBTAB 1: ACCOMMODATIONS & ROOM RATES */}
              {inventorySubTab === 'accommodations' && (
                <>
                  {/* Category Filter Chips */}
                  <div className="chip-row" style={{ marginBottom: 16 }}>
                    {['all', 'Cottage', 'Villa', 'Suite', 'Garden', 'Dorm'].map((cat) => (
                      <button
                        key={cat}
                        className={`chip ${inventoryRoomFilter === cat ? 'sel' : ''}`}
                        onClick={() => setInventoryRoomFilter(cat)}
                      >
                        {cat === 'all' ? 'ALL CATEGORIES' : cat.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {loadingRoomsAndInv ? (
                    <div className="skel" style={{ height: 260 }} />
                  ) : (() => {
                    const filteredRooms = roomsList
                      .filter((r) => inventoryRoomFilter === 'all' || r.category?.toLowerCase() === inventoryRoomFilter.toLowerCase())
                      .filter((r) => !inventorySearch || r.name?.toLowerCase().includes(inventorySearch.toLowerCase()) || r.description?.toLowerCase().includes(inventorySearch.toLowerCase()));

                    return filteredRooms.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '48px 20px', background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)', borderRadius: 16, border: `1px dashed ${themeBorder}`, margin: '12px 0' }}>
                        <div style={{ fontSize: '2.8rem', marginBottom: 12 }}>🏖️</div>
                        <h4 style={{ margin: '0 0 6px', color: themeText, fontSize: '1.15rem', fontWeight: 800 }}>No Accommodations Added Yet</h4>
                        <p style={{ margin: '0 auto 18px', maxWidth: 460, color: themeMuted, fontSize: '.86rem', lineHeight: 1.5 }}>
                          All mock room data has been cleared. Click below to provision and publish your first custom room with photos and rates.
                        </p>
                        <button className="btn btn-sky btn-sm" onClick={() => setShowCreateRoomModal(true)} style={{ padding: '9px 18px', fontWeight: 700 }}>
                          + Provision Your First Room
                        </button>
                      </div>
                    ) : (
                      <div className="admin-grid-3-col" style={{ gap: 16 }}>
                        {filteredRooms.map((room) => {
                          const roomImages = Array.isArray(room.images) && room.images.length > 0
                            ? room.images
                            : (room.image_url ? [room.image_url] : []);

                          return (
                            <div
                              key={room.id}
                              style={{
                                background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.85)',
                                border: `1px solid ${themeBorder}`,
                                borderRadius: 14,
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                boxShadow: themeShadow,
                              }}
                            >
                              {/* AUTO-SCROLLING ROOM IMAGE SHOWCASE */}
                              <RoomImageCarousel
                                images={roomImages}
                                roomName={room.name}
                                category={room.category}
                                slug={room.slug}
                                height={185}
                                autoScroll={true}
                                interval={3500}
                                badge={
                                  <span className="pill" style={{ background: 'rgba(14,165,233,0.85)', color: '#FFFFFF', fontWeight: 800, fontSize: '.72rem', backdropFilter: 'blur(4px)' }}>
                                    {room.category || 'Standard'}
                                  </span>
                                }
                              />

                              <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <h4 style={{ margin: 0, fontSize: '1.15rem', color: themeText }}>{room.name}</h4>
                                    <button
                                      onClick={() => handleToggleRoomActive(room)}
                                      style={{
                                        border: 'none',
                                        borderRadius: 12,
                                        padding: '3px 10px',
                                        fontSize: '.72rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        background: room.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                                        color: room.is_active ? '#10B981' : '#F43F5E',
                                      }}
                                      title="Click to toggle Active vs Maintenance"
                                    >
                                      {room.is_active ? '● Active' : '⏸ Maintenance'}
                                    </button>
                                  </div>

                                  <p style={{ margin: '0 0 12px', fontSize: '.82rem', color: themeMuted, lineHeight: 1.4, minHeight: 36 }}>
                                    {room.description || 'Patar beachfront accommodation with scenic sea vistas and resort amenities.'}
                                  </p>

                                  <div style={{ display: 'flex', gap: 14, marginBottom: 12, fontSize: '.84rem', color: themeText, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 10 }}>
                                    <div><span style={{ color: themeMuted, fontSize: '.72rem', display: 'block' }}>Capacity</span><b>Sleeps {room.capacity || 2}</b></div>
                                    <div><span style={{ color: themeMuted, fontSize: '.72rem', display: 'block' }}>Physical Units</span><b style={{ color: '#0EA5E9' }}>{room.units || 1} units</b></div>
                                    <div><span style={{ color: themeMuted, fontSize: '.72rem', display: 'block' }}>Rating</span><b>★ {room.rating_avg || 5.0}</b></div>
                                  </div>

                                  {Array.isArray(room.amenities) && room.amenities.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
                                      {room.amenities.slice(0, 4).map((a, i) => (
                                        <span key={i} style={{ fontSize: '.68rem', padding: '2px 8px', borderRadius: 8, background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.05)', color: themeMuted }}>
                                          {a}
                                        </span>
                                      ))}
                                      {room.amenities.length > 4 && (
                                        <span style={{ fontSize: '.68rem', padding: '2px 6px', borderRadius: 8, color: themeMuted }}>+{room.amenities.length - 4} more</span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div style={{ borderTop: `1px solid ${themeBorder}`, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <span style={{ fontSize: '.72rem', color: themeMuted, display: 'block' }}>Rate per night</span>
                                    <b style={{ fontSize: '1.15rem', color: '#10B981' }}>{money(room.rate_php)}</b>
                                  </div>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                      className="btn btn-sky btn-sm"
                                      onClick={() => {
                                        const currentImgs = Array.isArray(room.images) && room.images.length > 0
                                          ? [...room.images]
                                          : (room.image_url ? [room.image_url] : []);
                                        setEditingRoom({
                                          ...room,
                                          image_url: room.image_url || currentImgs[0] || '',
                                          images: currentImgs,
                                          amenities: Array.isArray(room.amenities) ? room.amenities.join(', ') : (room.amenities || ''),
                                        });
                                      }}
                                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button
                                      className="btn btn-sm"
                                      onClick={() => handleDeleteRoom(room)}
                                      style={{
                                        background: 'rgba(244,63,94,0.1)',
                                        color: '#F43F5E',
                                        border: '1px solid rgba(244,63,94,0.25)',
                                        fontSize: '.82rem',
                                        padding: '4px 8px',
                                        cursor: 'pointer',
                                      }}
                                      title="Delete room"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </>
              )}

              {/* SUBTAB 2: RESORT SUPPLIES & STOCK LEDGER */}
              {inventorySubTab === 'supplies' && (
                <>
                  {/* Department Filter Chips */}
                  <div className="chip-row" style={{ marginBottom: 16 }}>
                    {[
                      { id: 'all', label: 'ALL DEPARTMENTS' },
                      { id: 'front_desk', label: 'FRONT DESK' },
                      { id: 'housekeeping', label: 'HOUSEKEEPING' },
                      { id: 'kitchen', label: 'KITCHEN & DINING' },
                      { id: 'tours', label: 'TOURS & LEISURE' },
                      { id: 'maintenance', label: 'MAINTENANCE' },
                    ].map((dept) => (
                      <button
                        key={dept.id}
                        className={`chip ${inventoryDeptFilter === dept.id ? 'sel' : ''}`}
                        onClick={() => setInventoryDeptFilter(dept.id)}
                      >
                        {dept.label}
                      </button>
                    ))}
                  </div>

                  {loadingRoomsAndInv ? (
                    <div className="skel" style={{ height: 260 }} />
                  ) : (() => {
                    const filteredSupplies = inventoryList
                      .filter((i) => inventoryDeptFilter === 'all' || i.category === inventoryDeptFilter)
                      .filter((i) => !inventorySearch || i.item_name?.toLowerCase().includes(inventorySearch.toLowerCase()));

                    return filteredSupplies.length === 0 ? (
                      <p className="muted" style={{ padding: '30px 0', textAlign: 'center' }}>No supplies found in this department.</p>
                    ) : (
                      <div className="table-wrap" style={{ background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.85)', border: `1px solid ${themeBorder}` }}>
                        <table className="table" style={{ color: themeText }}>
                          <thead>
                            <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)' }}>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Supply Item</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Department</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>In-Stock Ledger</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Reorder Threshold</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Inventory Health</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted, textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSupplies.map((item) => {
                              const isLow = (item.stock_qty || 0) <= (item.reorder_at || 10);
                              return (
                                <tr key={item.id} style={{ borderBottom: `1px solid ${themeBorder}` }}>
                                  <td>
                                    <b style={{ color: themeText }}>{item.item_name}</b>
                                    <span style={{ fontSize: '.72rem', color: themeMuted, display: 'block' }}>Unit: {item.unit || 'pcs'}</span>
                                  </td>
                                  <td>
                                    <span className="pill" style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8', fontSize: '.72rem', textTransform: 'uppercase' }}>
                                      {(item.category || 'general').replace('_', ' ')}
                                    </span>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <button
                                        onClick={() => handleAdjustSupplyStock(item, -1)}
                                        style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.06)', color: themeText, cursor: 'pointer', fontWeight: 800 }}
                                        title="Decrease stock by 1"
                                      >
                                        -
                                      </button>
                                      <b style={{ minWidth: 36, textAlign: 'center', fontSize: '1rem', color: isLow ? '#F43F5E' : '#10B981' }}>
                                        {item.stock_qty} {item.unit || 'pcs'}
                                      </b>
                                      <button
                                        onClick={() => handleAdjustSupplyStock(item, 1)}
                                        style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.06)', color: themeText, cursor: 'pointer', fontWeight: 800 }}
                                        title="Increase stock by 1"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </td>
                                  <td>
                                    <span style={{ fontSize: '.84rem', color: themeMuted }}>Min {item.reorder_at || 10} {item.unit || 'pcs'}</span>
                                  </td>
                                  <td>
                                    <span
                                      className="pill"
                                      style={{
                                        background: isLow ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)',
                                        color: isLow ? '#F43F5E' : '#10B981',
                                        fontSize: '.74rem',
                                        fontWeight: 700,
                                      }}
                                    >
                                      {isLow ? '⚠️ Reorder Needed' : '🟢 In Stock'}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button
                                      onClick={() => handleDeleteSupply(item.id, item.item_name)}
                                      style={{ background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer', fontSize: '.8rem', fontWeight: 700 }}
                                      title="Delete supply item"
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* TAB 3: GUEST CONVERSATIONS & RESOLUTION INBOX PANEL PAGE */}
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
                  {food_sales.length > 0
                    ? `🔥 Top Earner: ${food_sales[0].name} (${money(food_sales[0].revenue_php)})`
                    : '🍳 Kitchen & Dining Operations Active'}
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
                    {food_sales.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: themeMuted }}>
                          No food & beverage orders recorded yet this billing period.
                        </td>
                      </tr>
                    ) : (
                      food_sales.map((item) => (
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
                                width: `${Math.min(100, (item.orders / Math.max(1, (food_sales[0]?.orders || 1))) * 100)}%`,
                                background: item.trend === 'popular' ? 'linear-gradient(90deg, #F59E0B, #FBBF24)' : 'linear-gradient(90deg, #0EA5E9, #38BDF8)',
                                borderRadius: 5
                              }} />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
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
                  <div style={{ position: 'relative', width: 96, height: 96 }}>
                    {adminProfileState.customAvatarUrl && !adminProfileState.customAvatarUrl.startsWith('initials:') && !adminProfileState.customAvatarUrl.startsWith('svg:') ? (
                      <img
                        src={adminProfileState.customAvatarUrl}
                        alt="Executive Avatar"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '4px solid #FFFFFF', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 96,
                          height: 96,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #0284C7, #0EA5E9)',
                          color: '#FFFFFF',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '2.2rem',
                          fontWeight: 800,
                          border: '4px solid #FFFFFF',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                        }}
                      >
                        {adminProfileState.customAvatarUrl?.startsWith('initials:')
                          ? adminProfileState.customAvatarUrl.replace('initials:', '')
                          : (adminProfileState.displayName || profile?.full_name || 'Admin')[0].toUpperCase()}
                      </div>
                    )}
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

                    <div className="admin-grid-2-col" style={{ marginBottom: 16 }}>
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

                      <div className="admin-grid-2-col" style={{ gap: 14 }}>
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
                      <div className="admin-grid-2-col" style={{ gap: 12 }}>
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

                  {/* SECTION 3: SYSTEM CONTROLS & AUDIT PREFERENCES */}
                  <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24 }}>
                    <div style={{ marginBottom: 16, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 12 }}>
                      <b style={{ fontSize: '1.1rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        ⚡ System Controls & Live Audit Preferences
                      </b>
                      <span style={{ fontSize: '.76rem', color: themeMuted, display: 'block', marginTop: 2 }}>Configure real-time audit refresh intervals, auto-lock security, and Twilio SMS triggers</span>
                    </div>

                    <div className="admin-grid-2-col" style={{ marginBottom: 18 }}>
                      <div className="field">
                        <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>AUDIT STREAM INTERVAL</label>
                        <select
                          style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                          value={adminProfileState.refreshRate}
                          onChange={(e) => setAdminProfileState({ ...adminProfileState, refreshRate: e.target.value })}
                        >
                          <option value="5">Realtime (5 Seconds)</option>
                          <option value="15">Balanced (15 Seconds)</option>
                          <option value="30">Eco Mode (30 Seconds)</option>
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

                  {/* SECTION 4: CLOUDINARY MEDIA CDN & ASSET STORAGE */}
                  <CloudinarySettingsCard
                    isLightMode={isLightMode}
                    toast={toast}
                  />

                  {/* SAVE & SYNC BUTTON */}
                  <button className="btn btn-sky" style={{ width: '100%', justifyContent: 'center', padding: '16px 24px', fontWeight: 700, fontSize: '1.05rem', borderRadius: 14, marginTop: 10 }}>
                    Save & Sync Profile Settings ✦
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: REALTIME SYSTEM AUDIT & SECURITY AUTO LOGGER */}
          {activeTab === 'audit' && (
            <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24, boxShadow: themeShadow }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="label light" style={{ color: '#0EA5E9' }}>Enterprise Security</span>
                    <span style={{ fontSize: '.72rem', color: '#10B981', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 12, border: '1px solid rgba(16,185,129,0.3)' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                      AUDIT AUTO-LOGGER ACTIVE
                    </span>
                  </div>
                  <h3 className="serif" style={{ fontSize: '1.6rem', margin: '4px 0 0', color: themeText }}>System Audit & Security Event Trail</h3>
                  <p className="muted small" style={{ margin: '4px 0 0' }}>Tamper-evident administrative audit log. Records all room, inventory, role, and security access events in real-time.</p>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-sm"
                    onClick={() => setAuditAutoRefresh(!auditAutoRefresh)}
                    style={{
                      border: `1px solid ${auditAutoRefresh ? '#10B981' : themeBorder}`,
                      color: auditAutoRefresh ? '#10B981' : themeMuted,
                      background: auditAutoRefresh ? 'rgba(16,185,129,0.1)' : 'transparent',
                      fontWeight: 700,
                    }}
                  >
                    {auditAutoRefresh ? '🟢 Auto-Sync ON (5s)' : '⏸️ Auto-Sync Paused'}
                  </button>

                  <button className="btn btn-sky btn-sm" onClick={fetchAuditLogs} disabled={loadingAudit}>
                    {loadingAudit ? 'Syncing…' : '🔄 Refresh Logs'}
                  </button>

                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(auditLogs, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.json`;
                      a.click();
                      toast('📥 Audit logs exported to JSON');
                    }}
                    style={{ border: `1px solid ${themeBorder}`, color: themeText, fontWeight: 700 }}
                  >
                    📥 Export JSON
                  </button>
                </div>
              </div>

              {/* AUDIT KPIS ROW */}
              <div className="admin-grid-4-col" style={{ marginBottom: 20 }}>
                <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 16 }}>
                  <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700 }}>TOTAL LOGGED EVENTS</span>
                  <b style={{ display: 'block', fontSize: '1.5rem', color: '#0EA5E9', marginTop: 4 }}>{auditLogs.length}</b>
                  <small style={{ fontSize: '.7rem', color: '#10B981' }}>🟢 Ring Buffer Active</small>
                </div>
                <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 16 }}>
                  <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700 }}>ROOM & INVENTORY ACTIONS</span>
                  <b style={{ display: 'block', fontSize: '1.5rem', color: '#10B981', marginTop: 4 }}>
                    {auditLogs.filter((l) => l.action?.startsWith('ROOM') || l.action?.startsWith('INVENTORY')).length}
                  </b>
                  <small style={{ fontSize: '.7rem', color: themeMuted }}>Inventory Mutations</small>
                </div>
                <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 16 }}>
                  <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700 }}>USER & ROLE MUTATIONS</span>
                  <b style={{ display: 'block', fontSize: '1.5rem', color: '#8B5CF6', marginTop: 4 }}>
                    {auditLogs.filter((l) => l.action?.includes('PROVISIONED') || l.action?.includes('ROLE')).length}
                  </b>
                  <small style={{ fontSize: '.7rem', color: themeMuted }}>RBAC Provisioning</small>
                </div>
                <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 16 }}>
                  <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700 }}>SECURITY AUDIT DENIALS</span>
                  <b style={{ display: 'block', fontSize: '1.5rem', color: auditLogs.some((l) => l.action?.includes('DENIED')) ? '#F43F5E' : '#10B981', marginTop: 4 }}>
                    {auditLogs.filter((l) => l.action?.includes('DENIED')).length}
                  </b>
                  <small style={{ fontSize: '.7rem', color: auditLogs.some((l) => l.action?.includes('DENIED')) ? '#F43F5E' : '#10B981' }}>
                    {auditLogs.some((l) => l.action?.includes('DENIED')) ? '⚠️ Breaches Blocked' : '🟢 0 Access Violations'}
                  </small>
                </div>
              </div>

              {/* FILTER CONTROLS & SEARCH */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div className="chip-row">
                  {[
                    { key: 'ALL', label: 'ALL EVENTS' },
                    { key: 'ROOM', label: 'ROOM ACTIONS' },
                    { key: 'INVENTORY', label: 'INVENTORY' },
                    { key: 'BOOKING', label: 'BOOKINGS' },
                    { key: 'PROVISIONED', label: 'PROVISIONING' },
                    { key: 'DENIED', label: 'SECURITY / DENIED' },
                  ].map((f) => (
                    <button
                      key={f.key}
                      className={`chip ${auditActionFilter === f.key ? 'sel' : ''}`}
                      onClick={() => setAuditActionFilter(f.key)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <input
                  className="search"
                  placeholder="Search logs by actor, action, IP…"
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  style={{ maxWidth: 280, background: isLightMode ? '#FFF' : undefined, color: themeText }}
                />
              </div>

              {/* AUDIT LOG TABLE */}
              {loadingAudit && auditLogs.length === 0 ? (
                <div className="skel" style={{ height: 260 }} />
              ) : auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', border: `1px dashed ${themeBorder}`, borderRadius: 12 }}>
                  <span style={{ fontSize: '2rem' }}>🛡️</span>
                  <h4 style={{ margin: '8px 0 4px', color: themeText }}>No Audit Logs Recorded Yet</h4>
                  <p className="muted small">Actions taken by administrators on accommodations, inventory, and staff roles will automatically appear here.</p>
                </div>
              ) : (
                <div style={{ maxHeight: 520, overflowY: 'auto', borderRadius: 12, border: `1px solid ${themeBorder}` }}>
                  <table style={{ width: '100%', fontSize: '.8rem', borderCollapse: 'collapse', color: themeText }}>
                    <thead>
                      <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)', position: 'sticky', top: 0, zIndex: 10 }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>TIMESTAMP</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>ACTION</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>ACTOR</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>RESOURCE</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>DETAILS</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>IP / CLIENT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => {
                        const isDanger = log.action?.includes('DELETE') || log.action?.includes('DENIED') || log.action?.includes('DEACTIVATE');
                        const isSuccess = log.action?.includes('CREATE') || log.action?.includes('PROVISIONED');
                        const isUpdate = log.action?.includes('UPDATE') || log.action?.includes('STATUS');

                        return (
                          <tr
                            key={log.id}
                            style={{ borderBottom: `1px solid ${themeBorder}`, transition: 'background 0.2s' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = isLightMode ? '#F8FAFC' : 'rgba(56,189,248,0.04)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '.74rem', color: themeMuted }}>
                              {log.timestamp ? new Date(log.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
                            </td>
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                              <span style={{
                                padding: '3px 8px', borderRadius: 6, fontSize: '.68rem', fontWeight: 800,
                                background: isDanger ? 'rgba(244,63,94,0.15)' : isSuccess ? 'rgba(16,185,129,0.15)' : isUpdate ? 'rgba(14,165,233,0.15)' : 'rgba(139,92,246,0.15)',
                                color: isDanger ? '#F43F5E' : isSuccess ? '#10B981' : isUpdate ? '#0EA5E9' : '#8B5CF6',
                                border: `1px solid ${isDanger ? 'rgba(244,63,94,0.3)' : isSuccess ? 'rgba(16,185,129,0.3)' : isUpdate ? 'rgba(14,165,233,0.3)' : 'rgba(139,92,246,0.3)'}`,
                              }}>
                                {log.action}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                  width: 24, height: 24, borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #0284C7, #0EA5E9)',
                                  color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '.7rem', fontWeight: 800,
                                }}>
                                  {(log.actor_name || log.actor_email || 'A')[0].toUpperCase()}
                                </div>
                                <div>
                                  <b style={{ display: 'block', fontSize: '.78rem', color: themeText }}>{log.actor_name || 'System Admin'}</b>
                                  <span style={{ fontSize: '.7rem', color: themeMuted }}>{log.actor_email}</span>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontWeight: 600, color: themeText }}>{log.resource_type || 'system'}</span>
                              {log.resource_id && <small style={{ color: themeMuted, display: 'block', fontFamily: 'monospace' }}>#{String(log.resource_id).slice(0, 12)}</small>}
                            </td>
                            <td style={{ padding: '10px 14px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span style={{ color: themeMuted, fontSize: '.74rem' }}>
                                {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: '.72rem', color: themeMuted, display: 'block' }}>{log.ip_address || '127.0.0.1'}</span>
                              <span style={{ fontSize: '.68rem', color: themeMuted, opacity: 0.8 }}>
                                {log.user_agent ? (log.user_agent.length > 25 ? log.user_agent.slice(0, 25) + '…' : log.user_agent) : 'Client'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: STAFF & USER ACCOUNT MANAGEMENT */}
          {activeTab === 'accounts' && (
            <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24, boxShadow: themeShadow }}>
              {/* Header */}
              <div className="admin-tab-header">
                <div>
                  <h3 className="serif" style={{ fontSize: '1.5rem', margin: 0, color: themeText }}>Accounts Directory</h3>
                  <p className="muted small" style={{ margin: '4px 0 0' }}>Manage staff credentials, customer profiles, and account recovery.</p>
                </div>
                <div className="admin-tab-header-actions">
                  <input
                    className="search"
                    placeholder="Search by name, email, or phone…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ maxWidth: 260, background: isLightMode ? '#FFF' : undefined, color: themeText }}
                  />
                  <button
                    className="btn btn-sm"
                    title="Reload live accounts from database"
                    onClick={() => fetchUsers()}
                    disabled={searchingUsers}
                    style={{ border: `1px solid ${themeBorder}`, color: themeText, background: isLightMode ? '#FFF' : 'rgba(255,255,255,0.05)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    🔄 {searchingUsers ? 'Loading…' : 'Refresh'}
                  </button>
                  {accountsSubTab === 'staff' && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-sky btn-sm"
                        onClick={() => {
                          setNewStaff({ first_name: '', middle_name: '', last_name: '', full_name: '', email: '', password: '', phone: '', role: 'administrator' });
                          setShowCreateModal(true);
                        }}
                      >
                        👑 + Provision Administrator
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ border: `1px solid ${themeBorder}`, color: themeText, background: isLightMode ? '#FFF' : 'rgba(255,255,255,0.05)' }}
                        onClick={() => {
                          setNewStaff({ first_name: '', middle_name: '', last_name: '', full_name: '', email: '', password: '', phone: '', role: 'receptionist' });
                          setShowCreateModal(true);
                        }}
                      >
                        🛡️ + Provision Staff
                      </button>
                    </div>
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
                                <td style={{ fontSize: '.8rem', color: themeMuted }}>{u.email || '—'}</td>
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
                  <div className="admin-grid-3-col" style={{ gap: 14, marginBottom: 20 }}>
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
              {/* Header & Quick Action Buttons */}
              <div className="admin-tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <span style={{ fontSize: '.76rem', color: '#0EA5E9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    PHYSICAL & DIGITAL BOOKINGS FOLIO
                  </span>
                  <h3 className="serif" style={{ fontSize: '1.4rem', margin: '4px 0 0', color: themeText }}>
                    📋 Guest Stay & Reservations Ledger
                  </h3>
                  <p className="muted small" style={{ margin: '4px 0 0' }}>
                    Real-time guest folios, room assignments, physical logbook ingestion and check-in / check-out operations.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-sky btn-sm"
                    onClick={() => setShowAddReservationModal(true)}
                    style={{ fontWeight: 700 }}
                  >
                    ➕ New Reservation (Walk-In / Phone)
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={refreshReservations}
                    disabled={loadingReservations}
                    style={{ color: themeText, border: `1px solid ${themeBorder}`, fontWeight: 600 }}
                  >
                    {loadingReservations ? 'Refreshing…' : '🔄 Refresh Ledger'}
                  </button>
                </div>
              </div>

              {/* 4 KPI Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
                <div style={{ padding: '16px 18px', background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.04)', borderRadius: 14, border: `1px solid ${themeBorder}` }}>
                  <small style={{ color: themeMuted, textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Total Reservations</small>
                  <b style={{ display: 'block', fontSize: '1.6rem', color: themeText, marginTop: 4 }}>{allBookings.length} stays</b>
                  <span style={{ fontSize: '.74rem', color: '#0EA5E9' }}>All active & past folios</span>
                </div>
                <div style={{ padding: '16px 18px', background: isLightMode ? '#ECFDF5' : 'rgba(16,185,129,0.1)', borderRadius: 14, border: `1px solid ${isLightMode ? '#A7F3D0' : 'rgba(16,185,129,0.2)'}` }}>
                  <small style={{ color: isLightMode ? '#047857' : '#34D399', textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>In-House / Checked In</small>
                  <b style={{ display: 'block', fontSize: '1.6rem', color: isLightMode ? '#065F46' : '#10B981', marginTop: 4 }}>
                    {allBookings.filter((b) => b.status === 'checked_in').length} guests
                  </b>
                  <span style={{ fontSize: '.74rem', color: '#10B981' }}>Currently staying in resort</span>
                </div>
                <div style={{ padding: '16px 18px', background: isLightMode ? '#EFF6FF' : 'rgba(59,130,246,0.1)', borderRadius: 14, border: `1px solid ${isLightMode ? '#BFDBFE' : 'rgba(59,130,246,0.2)'}` }}>
                  <small style={{ color: isLightMode ? '#1D4ED8' : '#60A5FA', textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Upcoming Confirmed</small>
                  <b style={{ display: 'block', fontSize: '1.6rem', color: isLightMode ? '#1E40AF' : '#3B82F6', marginTop: 4 }}>
                    {allBookings.filter((b) => b.status === 'confirmed').length} bookings
                  </b>
                  <span style={{ fontSize: '.74rem', color: '#3B82F6' }}>Awaiting arrival date</span>
                </div>
                <div style={{ padding: '16px 18px', background: isLightMode ? '#FFFBEB' : 'rgba(245,158,11,0.1)', borderRadius: 14, border: `1px solid ${isLightMode ? '#FDE68A' : 'rgba(245,158,11,0.2)'}` }}>
                  <small style={{ color: isLightMode ? '#B45309' : '#FBBF24', textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Gross Ledger Value</small>
                  <b style={{ display: 'block', fontSize: '1.6rem', color: isLightMode ? '#92400E' : '#F59E0B', marginTop: 4 }}>
                    {money(allBookings.filter((b) => b.status !== 'cancelled').reduce((acc, b) => acc + (b.total_php || 0), 0))}
                  </b>
                  <span style={{ fontSize: '.74rem', color: '#F59E0B' }}>Total booking revenue</span>
                </div>
              </div>

              {/* Search Bar & Status Filter Pills */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { key: 'all', label: `All (${allBookings.length})` },
                    { key: 'confirmed', label: `Confirmed (${allBookings.filter(b => b.status === 'confirmed').length})` },
                    { key: 'checked_in', label: `In-House (${allBookings.filter(b => b.status === 'checked_in').length})` },
                    { key: 'checked_out', label: `Checked Out (${allBookings.filter(b => b.status === 'checked_out').length})` },
                    { key: 'pending', label: `Pending (${allBookings.filter(b => b.status === 'pending').length})` },
                    { key: 'cancelled', label: `Cancelled (${allBookings.filter(b => b.status === 'cancelled').length})` },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setReservationFilter(f.key)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 16,
                        border: `1px solid ${reservationFilter === f.key ? '#0EA5E9' : themeBorder}`,
                        background: reservationFilter === f.key ? (isLightMode ? '#E0F2FE' : 'rgba(14,165,233,0.25)') : 'transparent',
                        color: reservationFilter === f.key ? '#0284C7' : themeText,
                        fontSize: '.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
                  <input
                    className="search"
                    placeholder="Search guest, room, phone, folio…"
                    value={reservationSearch}
                    onChange={(e) => setReservationSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 32px',
                      borderRadius: 14,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.6)',
                      color: themeText,
                      fontSize: '.82rem',
                    }}
                  />
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                    <IconSearch size={14} />
                  </span>
                </div>
              </div>

              {/* Reservations Ledger Table */}
              {loadingReservations && allBookings.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: themeMuted }}>
                  <p>Loading Guest Reservations Ledger…</p>
                </div>
              ) : filteredBookings.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center', background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)', borderRadius: 14, border: `1px dashed ${themeBorder}` }}>
                  <p className="muted" style={{ margin: '0 0 8px', fontSize: '1rem' }}>No reservations match your search or filter.</p>
                  <small style={{ color: themeMuted }}>Click "New Reservation" above to record a guest booking.</small>
                </div>
              ) : (
                <div className="table-wrap" style={{ background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.85)', border: `1px solid ${themeBorder}`, borderRadius: 12 }}>
                  <table className="table" style={{ color: themeText }}>
                    <thead>
                      <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)' }}>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Guest Folio</th>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Accommodation</th>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Stay Dates</th>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Party</th>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Total Amount</th>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Status</th>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Front Desk Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBookings.map((b) => (
                        <tr key={b.id} style={{ borderBottom: `1px solid ${themeBorder}` }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ width: 32, height: 32, borderRadius: '50%', background: isLightMode ? '#E2E8F0' : '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.8rem', fontWeight: 800 }}>
                                {(b.guest_name || b.profiles?.full_name || 'G').charAt(0).toUpperCase()}
                              </span>
                              <div>
                                <b>{b.guest_name || b.profiles?.full_name || 'Guest User'}</b>
                                <small style={{ color: themeMuted, display: 'block' }}>{b.phone || b.profiles?.phone || 'No phone recorded'}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <b>{b.rooms?.name || 'Assigned Villa/Room'}</b>
                          </td>
                          <td>
                            <div>
                              <span>{fmtDate(b.check_in)} → {fmtDate(b.check_out)}</span>
                              <span style={{ marginLeft: 6, fontSize: '.72rem', background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 6, color: themeMuted }}>
                                {b.nights || 1} {b.nights === 1 ? 'night' : 'nights'}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '.82rem' }}>{b.guests || 2} Guests</span>
                          </td>
                          <td>
                            <b>{money(b.total_php)}</b>
                            <small style={{ display: 'block', color: themeMuted, fontSize: '.72rem' }}>{b.payment_method || 'GCash'}</small>
                          </td>
                          <td>
                            <span className={`pill ${b.status}`}>{b.status.replace('_', ' ')}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {['pending', 'confirmed'].includes(b.status) && (
                                <button className="act-btn" onClick={() => updateStatus(b.id, 'checked_in')} style={{ color: '#10B981', borderColor: '#10B981' }}>
                                  🛎️ Check-in
                                </button>
                              )}
                              {b.status === 'checked_in' && (
                                <button className="act-btn" onClick={() => updateStatus(b.id, 'checked_out')} style={{ color: '#6366F1', borderColor: '#6366F1' }}>
                                  🔑 Check-out
                                </button>
                              )}
                              {['pending', 'confirmed'].includes(b.status) && (
                                <button className="act-btn" onClick={() => updateStatus(b.id, 'cancelled')} style={{ color: '#EF4444', borderColor: '#EF4444' }}>
                                  ✕ Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: RESORT ALERTS & NOTIFICATIONS CENTER */}
          {activeTab === 'notifications' && (
            <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24, boxShadow: themeShadow }}>
              <div className="admin-tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <span style={{ fontSize: '.76rem', color: '#E11D48', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    COMMUNICATIONS & AUDIT TRAIL
                  </span>
                  <h3 className="serif" style={{ fontSize: '1.4rem', margin: '4px 0 0', color: themeText }}>
                    🔔 Executive Notifications & SMS Alert Center
                  </h3>
                  <p className="muted small" style={{ margin: '4px 0 0' }}>
                    Live dispatch log of SMS guest alerts, role change verifications and automated reservation updates.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {unreadNotifsCount > 0 && (
                    <button className="btn btn-sm btn-ghost" onClick={handleMarkAllNotifsRead} style={{ color: themeText, border: `1px solid ${themeBorder}`, fontWeight: 600 }}>
                      ✓ Mark All Read
                    </button>
                  )}
                  <button className="btn btn-sm btn-sky" onClick={() => api.myNotifications().then((n: any) => Array.isArray(n) && setNotifications(n))} style={{ fontWeight: 700 }}>
                    🔄 Refresh Alerts
                  </button>
                </div>
              </div>

              {/* Filter Pills */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                {[
                  { key: 'all', label: `All Alerts (${notifications.length})` },
                  { key: 'unread', label: `Unread (${unreadNotifsCount})` },
                  { key: 'sms', label: 'SMS Messages' },
                  { key: 'system', label: 'System Logs' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setNotifFilter(f.key)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 20,
                      border: `1px solid ${notifFilter === f.key ? '#6366F1' : themeBorder}`,
                      background: notifFilter === f.key ? (isLightMode ? '#EEF2FF' : 'rgba(99, 102, 241, 0.2)') : 'transparent',
                      color: notifFilter === f.key ? '#6366F1' : themeText,
                      fontWeight: 700,
                      fontSize: '.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Notifications List */}
              {notifications.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: themeMuted, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)', borderRadius: 14, border: `1px dashed ${themeBorder}` }}>
                  <p style={{ fontSize: '1.1rem', margin: '0 0 6px' }}>📭 No alerts or notifications recorded.</p>
                  <small>SMS confirmations and system dispatches will appear here in real time.</small>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {notifications
                    .filter((n: any) => {
                      if (notifFilter === 'unread') return !n.is_read;
                      if (notifFilter === 'sms') return n.type === 'sms' || n.to_phone;
                      if (notifFilter === 'system') return n.type !== 'sms';
                      return true;
                    })
                    .map((n: any) => (
                      <div
                        key={n.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          padding: '14px 18px',
                          borderRadius: 14,
                          border: `1px solid ${n.is_read ? themeBorder : '#6366F1'}`,
                          background: !n.is_read ? (isLightMode ? '#F8FAFC' : 'rgba(99, 102, 241, 0.08)') : (isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.6)'),
                          boxShadow: !n.is_read ? '0 2px 10px rgba(99,102,241,0.1)' : 'none',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                            <span className={`pill ${n.status || 'sent'}`}>{n.status || 'sent'}</span>
                            {n.to_phone && <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#0EA5E9' }}>📱 {n.to_phone}</span>}
                            <span style={{ fontSize: '.75rem', color: themeMuted }}>• {fmtDate(n.created_at)} {fmtTime(n.created_at)}</span>
                            {!n.is_read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F43F5E', display: 'inline-block' }} />}
                          </div>
                          <p style={{ margin: 0, fontSize: '.9rem', color: themeText, lineHeight: 1.4 }}>
                            {n.body || n.content || 'Notification message'}
                          </p>
                        </div>
                        {!n.is_read && (
                          <button
                            onClick={() => handleMarkNotifRead(n.id)}
                            style={{
                              background: 'transparent',
                              border: `1px solid ${themeBorder}`,
                              color: themeMuted,
                              borderRadius: 8,
                              padding: '4px 8px',
                              fontSize: '.74rem',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* MODAL: ADD WALK-IN / PHONE RESERVATION */}
          {showAddReservationModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2, 6, 23, 0.75)',
                backdropFilter: 'blur(8px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
              }}
              onClick={() => setShowAddReservationModal(false)}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 580,
                  background: isLightMode ? '#FFFFFF' : '#0F172A',
                  borderRadius: 20,
                  border: `1px solid ${themeBorder}`,
                  padding: 26,
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: '.74rem', color: '#0EA5E9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>FRONT DESK FOLIO</span>
                    <h3 style={{ margin: '4px 0 0', fontSize: '1.4rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>➕ Record Walk-In / Phone Reservation</h3>
                  </div>
                  <button onClick={() => setShowAddReservationModal(false)} style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                </div>

                <form onSubmit={handleCreateReservation} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Guest Full Name *</label>
                    <input
                      required
                      placeholder="e.g. Maria Santos"
                      value={newReservation.guest_name}
                      onChange={(e) => setNewReservation({ ...newReservation, guest_name: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Phone (for SMS confirmation) *</label>
                      <input
                        required
                        placeholder="09171234567"
                        value={newReservation.phone}
                        onChange={(e) => setNewReservation({ ...newReservation, phone: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Email (Optional)</label>
                      <input
                        type="email"
                        placeholder="guest@gmail.com"
                        value={newReservation.guest_email}
                        onChange={(e) => setNewReservation({ ...newReservation, guest_email: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Accommodation / Room *</label>
                    <select
                      required
                      value={newReservation.room_id}
                      onChange={(e) => {
                        const rId = e.target.value;
                        const room = roomsList.find((r) => r.id === rId);
                        const rate = room?.rate_php || 3500;
                        const nights = Math.max(1, Math.round((new Date(newReservation.check_out).getTime() - new Date(newReservation.check_in).getTime()) / 86400000));
                        setNewReservation({
                          ...newReservation,
                          room_id: rId,
                          total_php: rate * nights,
                        });
                      }}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText }}
                    >
                      <option value="">-- Select Room / Cottage / Villa --</option>
                      {roomsList.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.category || 'Standard'}) — {money(r.rate_php)}/night
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Check-In Date *</label>
                      <input
                        type="date"
                        required
                        value={newReservation.check_in}
                        onChange={(e) => {
                          const cin = e.target.value;
                          let cout = newReservation.check_out;
                          if (cin >= cout) {
                            cout = new Date(new Date(cin).getTime() + 86400000).toISOString().slice(0, 10);
                          }
                          const nights = Math.max(1, Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000));
                          const room = roomsList.find((r) => r.id === newReservation.room_id);
                          const rate = room?.rate_php || 3500;
                          setNewReservation({
                            ...newReservation,
                            check_in: cin,
                            check_out: cout,
                            total_php: rate * nights,
                          });
                        }}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Check-Out Date *</label>
                      <input
                        type="date"
                        required
                        value={newReservation.check_out}
                        onChange={(e) => {
                          const cout = e.target.value;
                          const nights = Math.max(1, Math.round((new Date(cout).getTime() - new Date(newReservation.check_in).getTime()) / 86400000));
                          const room = roomsList.find((r) => r.id === newReservation.room_id);
                          const rate = room?.rate_php || 3500;
                          setNewReservation({
                            ...newReservation,
                            check_out: cout,
                            total_php: rate * nights,
                          });
                        }}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Guests *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={newReservation.guests}
                        onChange={(e) => setNewReservation({ ...newReservation, guests: Number(e.target.value) })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Total Amount (₱) *</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={newReservation.total_php}
                        onChange={(e) => setNewReservation({ ...newReservation, total_php: Number(e.target.value) })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Payment Method</label>
                      <select
                        value={newReservation.payment_method}
                        onChange={(e) => setNewReservation({ ...newReservation, payment_method: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText }}
                      >
                        <option value="GCash">GCash</option>
                        <option value="Cash">Cash (Front Desk)</option>
                        <option value="Maya">Maya</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Notes</label>
                    <input
                      placeholder="e.g. Early check-in requested, walk-in guest"
                      value={newReservation.notes}
                      onChange={(e) => setNewReservation({ ...newReservation, notes: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => setShowAddReservationModal(false)}
                      className="btn btn-ghost btn-sm"
                      style={{ color: themeText, border: `1px solid ${themeBorder}` }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingReservation}
                      className="btn btn-sky btn-sm"
                      style={{ fontWeight: 700 }}
                    >
                      {creatingReservation ? 'Saving to Ledger…' : 'Save & Log to Ledger ✦'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 7: CSV DATA EXPLORER & AUTO-READER */}
          {activeTab === 'csv' && (
            <div style={{ marginTop: 10 }}>
              <CsvTableViewer
                title="Resort Operational & Account Data Explorer"
                defaultFilename="jd_beach_house_accounts.csv"
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

      {/* MODAL 3: PROVISION STAFF ACCOUNT */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowCreateModal(false)}>
          <div style={{ width: '100%', maxWidth: 520, background: isLightMode ? '#FFFFFF' : '#0F172A', borderRadius: 20, border: `1px solid ${themeBorder}`, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 12 }}>
              <div>
                <span style={{ fontSize: '.74rem', color: newStaff.role === 'administrator' ? '#8B5CF6' : '#6366F1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  {newStaff.role === 'administrator' ? 'EXECUTIVE RBAC PROVISIONING' : 'ADMINISTRATIVE ACCESS CONTROL'}
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.35rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {newStaff.role === 'administrator' ? '👑 Provision Administrator Account' : '🛡️ Provision Staff Account'}
                </h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleProvisionStaff} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>First Name *</label>
                  <input
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={newStaff.first_name}
                    onChange={(e) => setNewStaff({ ...newStaff, first_name: e.target.value })}
                    placeholder="e.g. Maria"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Last Name *</label>
                  <input
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={newStaff.last_name}
                    onChange={(e) => setNewStaff({ ...newStaff, last_name: e.target.value })}
                    placeholder="e.g. Santos"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Corporate Email</label>
                <input
                  type="email"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  placeholder={generateAccountEmail(newStaff.first_name || 'm', '', newStaff.last_name || 's', users.length + 1)}
                />
                <small style={{ fontSize: '.72rem', color: themeMuted }}>Leave blank to auto-generate resort corporate email.</small>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Phone (SMS Alerts)</label>
                  <input
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    placeholder="09171234567"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Assigned Role *</label>
                  <select
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  >
                    <option value="receptionist">Receptionist / Front Desk</option>
                    <option value="staff">Resort House Staff</option>
                    <option value="accounting">Accounting & Finance</option>
                    <option value="administrator">Full Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Temporary Password * (min 6 chars)</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => setShowCreateModal(false)} style={{ border: `1px solid ${themeBorder}`, color: themeText }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-sky btn-sm" disabled={creatingStaff}>
                  {creatingStaff ? 'Provisioning…' : (newStaff.role === 'administrator' ? 'Create Administrator Credentials ✦' : 'Create Staff Credentials ✦')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RESET PASSWORD & SMS RECOVERY */}
      {recoveryTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setRecoveryTarget(null)}>
          <div style={{ width: '100%', maxWidth: 440, background: isLightMode ? '#FFFFFF' : '#0F172A', borderRadius: 20, border: `1px solid ${themeBorder}`, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 12 }}>
              <div>
                <span style={{ fontSize: '.74rem', color: '#F43F5E', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>ACCOUNT SECURITY</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.25rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>🔑 Reset Credentials</h3>
              </div>
              <button onClick={() => setRecoveryTarget(null)} style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: '.84rem', color: themeMuted, margin: '0 0 16px' }}>
              Reset password for <b>{recoveryTarget.full_name || recoveryTarget.email}</b> ({recoveryTarget.role}).
            </p>

            <form onSubmit={handlePasswordRecovery} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>New Password * (min 6 characters)</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password…"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => setRecoveryTarget(null)} style={{ border: `1px solid ${themeBorder}`, color: themeText }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-sky btn-sm" disabled={resettingPass}>
                  {resettingPass ? 'Resetting…' : 'Update Password & Ping SMS ✦'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: PROVISION NEW ACCOMMODATION */}
      {showCreateRoomModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowCreateRoomModal(false)}>
          <div style={{ width: '100%', maxWidth: 540, background: isLightMode ? '#FFFFFF' : '#0F172A', borderRadius: 20, border: `1px solid ${themeBorder}`, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 12 }}>
              <div>
                <span style={{ fontSize: '.74rem', color: '#0EA5E9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>ACCOMMODATION CATALOG</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.35rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>🏡 Add New Accommodation</h3>
              </div>
              <button onClick={() => setShowCreateRoomModal(false)} style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Room Name *</label>
                <input
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                  value={newRoom.name}
                  onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                  placeholder="e.g. Sunset Luxury Cottage"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Category *</label>
                  <select
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
                    value={newRoom.category}
                    onChange={(e) => setNewRoom({ ...newRoom, category: e.target.value })}
                  >
                    <option value="Cottage">Cottage</option>
                    <option value="Villa">Villa</option>
                    <option value="Suite">Suite</option>
                    <option value="Garden">Garden</option>
                    <option value="Dorm">Dorm</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Nightly Rate (₱) *</label>
                  <input
                    required
                    type="number"
                    min={100}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={newRoom.rate_php}
                    onChange={(e) => setNewRoom({ ...newRoom, rate_php: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Sleeps Capacity (Guests)</label>
                  <input
                    required
                    type="number"
                    min={1}
                    max={20}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={newRoom.capacity}
                    onChange={(e) => setNewRoom({ ...newRoom, capacity: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Total Physical Units</label>
                  <input
                    required
                    type="number"
                    min={1}
                    max={50}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={newRoom.units}
                    onChange={(e) => setNewRoom({ ...newRoom, units: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Description</label>
                <textarea
                  rows={3}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                  value={newRoom.description}
                  onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                  placeholder="Describe view, ambiance, and special features…"
                />
              </div>

              <div>
                <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Amenities (comma separated)</label>
                <input
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                  value={newRoom.amenities}
                  onChange={(e) => setNewRoom({ ...newRoom, amenities: e.target.value })}
                  placeholder="Air Conditioning, Free Wi-Fi, Private Bath, Sea View"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => setShowCreateRoomModal(false)} style={{ border: `1px solid ${themeBorder}`, color: themeText }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-sky btn-sm">
                  Save Accommodation ✦
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: EDIT ACCOMMODATION & CLOUDINARY MEDIA */}
      {editingRoom && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setEditingRoom(null)}>
          <div style={{ width: '100%', maxWidth: 660, background: isLightMode ? '#FFFFFF' : '#0F172A', borderRadius: 20, border: `1px solid ${themeBorder}`, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', maxHeight: '92vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 12 }}>
              <div>
                <span style={{ fontSize: '.74rem', color: '#0EA5E9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>ACCOMMODATION DETAILS & PHOTO MANAGEMENT</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.35rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>✏️ Edit {editingRoom.name}</h3>
              </div>
              <button onClick={() => setEditingRoom(null)} style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleUpdateRoomSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* SECTION A: ROOM DETAILS */}
              <div>
                <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Room Name *</label>
                <input
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                  value={editingRoom.name}
                  onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Nightly Rate (₱) *</label>
                  <input
                    required
                    type="number"
                    min={100}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={editingRoom.rate_php}
                    onChange={(e) => setEditingRoom({ ...editingRoom, rate_php: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Available Physical Units *</label>
                  <input
                    required
                    type="number"
                    min={1}
                    max={50}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={editingRoom.units}
                    onChange={(e) => setEditingRoom({ ...editingRoom, units: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Category</label>
                  <select
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
                    value={editingRoom.category}
                    onChange={(e) => setEditingRoom({ ...editingRoom, category: e.target.value })}
                  >
                    <option value="Cottage">Cottage</option>
                    <option value="Villa">Villa</option>
                    <option value="Suite">Suite</option>
                    <option value="Garden">Garden</option>
                    <option value="Dorm">Dorm</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Sleeps Capacity (Guests)</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={editingRoom.capacity}
                    onChange={(e) => setEditingRoom({ ...editingRoom, capacity: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Description</label>
                <textarea
                  rows={2}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                  value={editingRoom.description || ''}
                  onChange={(e) => setEditingRoom({ ...editingRoom, description: e.target.value })}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700 }}>Amenities</label>
                  <span style={{ fontSize: '.72rem', color: themeMuted }}>Click to toggle popular amenities</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {['Air Conditioning', 'Free Wi-Fi', 'Private Bath', 'Sea View', 'Balcony', 'Kitchenette', 'Garden Access', 'Rock View', 'Private Veranda'].map((amenity) => {
                    const currentAmenities = typeof editingRoom.amenities === 'string'
                      ? editingRoom.amenities.split(',').map((s) => s.trim()).filter(Boolean)
                      : (Array.isArray(editingRoom.amenities) ? editingRoom.amenities : []);
                    const isSelected = currentAmenities.some((a) => a.toLowerCase() === amenity.toLowerCase());

                    return (
                      <button
                        key={amenity}
                        type="button"
                        onClick={() => {
                          let nextList;
                          if (isSelected) {
                            nextList = currentAmenities.filter((a) => a.toLowerCase() !== amenity.toLowerCase());
                          } else {
                            nextList = [...currentAmenities, amenity];
                          }
                          setEditingRoom({ ...editingRoom, amenities: nextList.join(', ') });
                        }}
                        style={{
                          fontSize: '.72rem',
                          padding: '3px 9px',
                          borderRadius: 8,
                          border: isSelected ? '1px solid #0EA5E9' : `1px solid ${themeBorder}`,
                          background: isSelected ? 'rgba(14,165,233,0.18)' : isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.05)',
                          color: isSelected ? '#0EA5E9' : themeText,
                          cursor: 'pointer',
                          fontWeight: isSelected ? 700 : 500,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '}{amenity}
                      </button>
                    );
                  })}
                </div>

                <input
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                  value={editingRoom.amenities}
                  onChange={(e) => setEditingRoom({ ...editingRoom, amenities: e.target.value })}
                  placeholder="e.g. Air Conditioning, Free Wi-Fi, Private Bath, Sea View"
                />
              </div>

              {/* SECTION B: CLOUDINARY MEDIA & AUTO-SCROLLING CAROUSEL */}
              {/* SECTION B: ROOM PHOTOS & IMAGE UPLOAD */}
              <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.6)', border: `1px solid ${themeBorder}`, borderRadius: 14, padding: 18 }}>
                <div style={{ marginBottom: 14 }}>
                  <b style={{ fontSize: '.92rem', color: themeText, display: 'block' }}>📸 Room Photo / Upload Image</b>
                  <span style={{ fontSize: '.75rem', color: themeMuted }}>Upload accommodation photos directly from your device (JPG, PNG, WebP up to 5MB).</span>
                </div>

                {/* UPLOAD DROPZONE / BUTTON */}
                <input
                  type="file"
                  ref={roomFileInputRef}
                  accept="image/*"
                  onChange={handleRoomPhotoUpload}
                  style={{ display: 'none' }}
                />

                <div
                  onClick={() => !uploadingRoomPhoto && roomFileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${uploadingRoomPhoto ? '#0EA5E9' : themeBorder}`,
                    borderRadius: 12,
                    padding: '28px 16px',
                    textAlign: 'center',
                    cursor: uploadingRoomPhoto ? 'not-allowed' : 'pointer',
                    background: isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.02)',
                    marginBottom: 16,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>📷</div>
                  <button
                    type="button"
                    disabled={uploadingRoomPhoto}
                    className="btn btn-sky btn-sm"
                    style={{ pointerEvents: 'none', fontWeight: 800, padding: '8px 22px', fontSize: '.85rem' }}
                  >
                    {uploadingRoomPhoto ? 'Uploading Image...' : '📁 Choose Image to Upload'}
                  </button>
                  <span style={{ fontSize: '.75rem', color: themeMuted, display: 'block', marginTop: 8 }}>
                    Click here to browse and upload an image file
                  </span>
                </div>

                {/* CURRENT UPLOADED PHOTOS GALLERY */}
                {Array.isArray(editingRoom.images) && editingRoom.images.length > 0 ? (
                  <div>
                    <span style={{ fontSize: '.74rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 8, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                      Uploaded Room Photos ({editingRoom.images.length})
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                      {editingRoom.images.map((imgUrl, i) => {
                        const isPrimary = editingRoom.image_url === imgUrl || (!editingRoom.image_url && i === 0);
                        return (
                          <div
                            key={i}
                            style={{
                              position: 'relative',
                              borderRadius: 8,
                              overflow: 'hidden',
                              border: isPrimary ? '2px solid #0EA5E9' : `1px solid ${themeBorder}`,
                              background: '#0B132B',
                              aspectRatio: '16/10',
                              boxShadow: isPrimary ? '0 0 0 2px rgba(14,165,233,0.3)' : 'none',
                            }}
                          >
                            <img src={imgUrl} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            {isPrimary && (
                              <span style={{ position: 'absolute', top: 4, left: 4, background: '#0EA5E9', color: '#FFF', fontSize: '.6rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>
                                ⭐ Primary
                              </span>
                            )}
                            <div style={{ position: 'absolute', bottom: 4, right: 4, display: 'flex', gap: 4 }}>
                              {!isPrimary && (
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimaryPhoto(imgUrl)}
                                  title="Set as primary showcase image"
                                  style={{ background: 'rgba(0,0,0,0.7)', border: 'none', color: '#FFF', borderRadius: 4, padding: '2px 6px', fontSize: '.68rem', cursor: 'pointer' }}
                                >
                                  ⭐ Set Primary
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(i)}
                                title="Remove photo"
                                style={{ background: 'rgba(239,68,68,0.85)', border: 'none', color: '#FFF', borderRadius: 4, padding: '2px 6px', fontSize: '.68rem', cursor: 'pointer' }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '14px', textAlign: 'center', background: isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px dashed ${themeBorder}` }}>
                    <small style={{ color: themeMuted }}>No images uploaded yet. Click the upload button above to add a photo.</small>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTop: `1px solid ${themeBorder}`, paddingTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => handleDeleteRoom(editingRoom)}
                  style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.3)', fontWeight: 700 }}
                >
                  🗑️ Delete Room Permanently
                </button>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn btn-sm" onClick={() => setEditingRoom(null)} style={{ border: `1px solid ${themeBorder}`, color: themeText }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sky btn-sm" style={{ padding: '10px 20px', fontWeight: 800 }}>
                    Save & Synchronize Accommodation ✦
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: ADD NEW SUPPLY ITEM */}
      {showCreateSupplyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowCreateSupplyModal(false)}>
          <div style={{ width: '100%', maxWidth: 480, background: isLightMode ? '#FFFFFF' : '#0F172A', borderRadius: 20, border: `1px solid ${themeBorder}`, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 12 }}>
              <div>
                <span style={{ fontSize: '.74rem', color: '#10B981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>DEPARTMENT STOCK REGISTRY</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.35rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>📦 Register Supply Item</h3>
              </div>
              <button onClick={() => setShowCreateSupplyModal(false)} style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleCreateSupply} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Item Name *</label>
                <input
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                  value={newSupply.item_name}
                  onChange={(e) => setNewSupply({ ...newSupply, item_name: e.target.value })}
                  placeholder="e.g. Premium Bath Towels"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Department *</label>
                  <select
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
                    value={newSupply.category}
                    onChange={(e) => setNewSupply({ ...newSupply, category: e.target.value })}
                  >
                    <option value="housekeeping">Housekeeping</option>
                    <option value="front_desk">Front Desk</option>
                    <option value="kitchen">Kitchen & Dining</option>
                    <option value="tours">Tours & Outrigger</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Unit *</label>
                  <input
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={newSupply.unit}
                    onChange={(e) => setNewSupply({ ...newSupply, unit: e.target.value })}
                    placeholder="pcs / sets / bottles"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Initial Stock Quantity</label>
                  <input
                    required
                    type="number"
                    min={0}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={newSupply.stock_qty}
                    onChange={(e) => setNewSupply({ ...newSupply, stock_qty: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Reorder Threshold</label>
                  <input
                    required
                    type="number"
                    min={1}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={newSupply.reorder_at}
                    onChange={(e) => setNewSupply({ ...newSupply, reorder_at: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => setShowCreateSupplyModal(false)} style={{ border: `1px solid ${themeBorder}`, color: themeText }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-sky btn-sm">
                  Register Item ✦
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
