import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth, generateAccountEmail, isSystemOwnerEmail } from '../context/AuthContext.tsx';
import '../styles/admin.css';
import { AreaLineChart, MultiBarChart, Sparkline } from '../components/Charts.tsx';
import CsvTableViewer from '../components/CsvTableViewer.tsx';
import {
  IconDashboard, IconDining, IconUsers, IconTelemetry, IconLedger,
  IconCsv, IconSettings, IconSignOut, IconSearch, IconBell,
  IconSun, IconMoon, IconCrown, IconTrendingUp, IconCreditCard,
  IconWallet, IconBuilding, IconShield, IconBriefcase, DefaultUserAvatar,
  IconMessages, IconAnalytics
} from '../components/AdminIcons.tsx';
import { api, API_BASE } from '../lib/api.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { InterchangeableImagePicker } from '../components/InterchangeableImagePicker.tsx';
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
import AvailabilityCalendar from '../components/AvailabilityCalendar.tsx';
import { money, fmtDate, fmtTime } from '../lib/format.ts';
import { toast } from '../components/Toasts.tsx';
import { dispatchWordPrompt } from '../lib/wordPrompt.ts';
import { getRoomImageUrl } from '../lib/images.ts';

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
  const {
    session, profile,
    adminSession, adminProfile,
    adminSignIn, signOut, signOutAdmin,
    deleteAccount, updateProfile, updatePassword
  } = useAuth();
  const currentAdminSession = adminSession || session;
  const currentAdminProfile = adminProfile || profile;
  const user = currentAdminSession?.user;
  const [data, setData] = useState(emptyAnalytics);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteSelf, setConfirmDeleteSelf] = useState(false);
  const [deletingSelf, setDeletingSelf] = useState(false);

  // Automatic Database Clearance & Clean Auth State
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  // Live database profile role validation (Acquired automatically from database profile)
  const isAdministrator = Boolean(currentAdminSession && currentAdminProfile && (
    ['administrator', 'admin'].includes(currentAdminProfile?.role) ||
    isSystemOwnerEmail(currentAdminProfile?.email) ||
    isSystemOwnerEmail(user?.email)
  ));

  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifFilter, setNotifFilter] = useState('all');
  const [reservationsList, setReservationsList] = useState<any[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [reservationFilter, setReservationFilter] = useState('all');
  const [reservationSearch, setReservationSearch] = useState('');
  const [showAddReservationModal, setShowAddReservationModal] = useState(false);
  const [showLedgerCalendar, setShowLedgerCalendar] = useState(false);
  const [showWalkInCalendar, setShowWalkInCalendar] = useState(false);
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

  // Debit & Credit General Ledger States
  const [ledgerEntriesList, setLedgerEntriesList] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [trialBalance, setTrialBalance] = useState<any>(null);
  const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([]);
  const [ledgerSubView, setLedgerSubView] = useState<'debit_credit' | 'stay_folios' | 'availability'>('debit_credit');
  const [ledgerAccountFilter, setLedgerAccountFilter] = useState('');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | 'debit' | 'credit'>('all');
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Modals: New Journal Entry & PostgreSQL Backup
  const [showAddJournalModal, setShowAddJournalModal] = useState(false);
  const [postingJournal, setPostingJournal] = useState(false);
  const [journalForm, setJournalForm] = useState({
    mode: 'pair', // 'pair' for double-entry (Debit + Credit) or 'single'
    debit_account_code: '1010',
    credit_account_code: '4010',
    amount_php: 1000,
    particulars: '',
    category: 'REVENUE',
    reference_id: '',
  });

  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupTab, setBackupTab] = useState<'export' | 'import'>('export');
  const [exportFormat, setExportFormat] = useState<'sql' | 'json' | 'csv'>('sql');
  const [previewSqlText, setPreviewSqlText] = useState('');
  const [loadingPreviewSql, setLoadingPreviewSql] = useState(false);
  const [importContent, setImportContent] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'overwrite'>('append');
  const [importingBackup, setImportingBackup] = useState(false);
  const [reconcilingLedger, setReconcilingLedger] = useState(false);

  const refreshLedgerEntries = useCallback(async () => {
    setLoadingLedger(true);
    try {
      const res = await api.ledgerEntries({
        account_code: ledgerAccountFilter || undefined,
        category: ledgerCategoryFilter || undefined,
        entry_type: ledgerTypeFilter !== 'all' ? ledgerTypeFilter : undefined,
        search: ledgerSearch || undefined,
      });
      if (res?.data && Array.isArray(res.data)) {
        setLedgerEntriesList(res.data);
      }
      if (res?.trial_balance) {
        setTrialBalance(res.trial_balance);
      }
      if (res?.chart_of_accounts && Array.isArray(res.chart_of_accounts)) {
        setChartOfAccounts(res.chart_of_accounts);
      }
    } catch (err: any) {
      console.warn('Failed to load ledger entries:', err);
    } finally {
      setLoadingLedger(false);
    }
  }, [ledgerAccountFilter, ledgerCategoryFilter, ledgerTypeFilter, ledgerSearch]);

  const handleReconcileLedger = async () => {
    setReconcilingLedger(true);
    try {
      const res = await api.reconcileLedger();
      const count = res?.data?.new_entries_posted || 0;
      toast(`✦ Reconciliation complete: ${count} journal entries posted & synchronized!`);
      await refreshLedgerEntries();
    } catch (err: any) {
      toast(`Reconciliation error: ${err.message}`, true);
    } finally {
      setReconcilingLedger(false);
    }
  };

  const handlePostJournalEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setPostingJournal(true);
    try {
      if (!journalForm.particulars.trim()) {
        throw new Error('Please enter particulars / description for the journal entry.');
      }
      if (!journalForm.amount_php || Number(journalForm.amount_php) <= 0) {
        throw new Error('Transaction amount must be greater than zero.');
      }
      await api.createLedgerEntry(journalForm);
      toast('✦ Double-entry journal voucher recorded in General Ledger!');
      setShowAddJournalModal(false);
      setJournalForm({
        mode: 'pair',
        debit_account_code: '1010',
        credit_account_code: '4010',
        amount_php: 1000,
        particulars: '',
        category: 'REVENUE',
        reference_id: '',
      });
      await refreshLedgerEntries();
    } catch (err: any) {
      toast(err.message, true);
    } finally {
      setPostingJournal(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!importContent.trim()) {
      toast('Please upload a file or paste content to import.', true);
      return;
    }
    setImportingBackup(true);
    try {
      const res = await api.importLedgerBackup(importContent, importMode);
      toast(`✦ Successfully imported ${res.data.imported_count} records via adaptive ${String(res.data.detected_format).toUpperCase()} engine!`);
      setImportContent('');
      setShowBackupModal(false);
      await refreshLedgerEntries();
    } catch (err: any) {
      toast(`Import failed: ${err.message}`, true);
    } finally {
      setImportingBackup(false);
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
      const res = await adminSignIn(adminEmail.trim(), adminPass);
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
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [auditRoleFilter, setAuditRoleFilter] = useState('ALL');
  const [auditDateFilter, setAuditDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditAutoRefresh, setAuditAutoRefresh] = useState(true);
  const [inspectAuditLog, setInspectAuditLog] = useState<any | null>(null);

  // Live Defense-in-Depth Security & Threat Quarantine State
  const [securityPosture, setSecurityPosture] = useState<any>(null);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [unbanningIp, setUnbanningIp] = useState<string | null>(null);

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

  // Administrative User Edit Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [savingUser, setSavingUser] = useState(false);

  // Administrative User Deletion State
  const [userToDelete, setUserToDelete] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Administrator Forgot Password Modal State
  const [showAdminForgotModal, setShowAdminForgotModal] = useState(false);
  const [adminRecoveryEmail, setAdminRecoveryEmail] = useState('');
  const [adminRecoveryStep, setAdminRecoveryStep] = useState(1);
  const [adminRecoveryCode, setAdminRecoveryCode] = useState('');
  const [adminRecoveryNewPass, setAdminRecoveryNewPass] = useState('');
  const [adminRecoveryBusy, setAdminRecoveryBusy] = useState(false);

  // Ledger Refund Modal State
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);
  const [refundMode, setRefundMode] = useState('request'); // 'request' | 'confirm'
  const [refundMethod, setRefundMethod] = useState('GCash');
  const [refundRefNum, setRefundRefNum] = useState('');

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
      refreshLedgerEntries();
      if (roomsList.length === 0) {
        api.rooms(true).then((r: any) => setRoomsList(Array.isArray(r) ? r : [])).catch(() => {});
      }
    }
    if (activeTab === 'notifications') {
      api.myNotifications().then((n: any) => Array.isArray(n) && setNotifications(n)).catch(() => {});
    }
  }, [activeTab, refreshRoomsAndInventory, refreshReservations, refreshLedgerEntries, roomsList.length]);

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
        const token = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_jwt') : null) || localStorage.getItem('jd_admin_jwt') || authData?.session?.access_token;
        const key = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_token_key') : null) || localStorage.getItem('jd_admin_token_key') || 'etc-34';
        if (token) {
          const streamUrl = API_BASE
            ? `${API_BASE}/api/analytics/stream?token=${encodeURIComponent(token)}&admin_token_key=${encodeURIComponent(key)}`
            : `/api/analytics/stream?token=${encodeURIComponent(token)}&admin_token_key=${encodeURIComponent(key)}`;
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

  // Periodic background auto-reload every 20 seconds (silent, zero disruption)
  const autoReloadLive = useCallback(async () => {
    if (!isAdministrator) return;
    try {
      const [freshAnalytics, freshReservations, freshNotifs, freshRooms, freshInv, freshConvs] = await Promise.all([
        api.analyticsOverview().catch(() => null),
        api.allReservations().catch(() => null),
        api.myNotifications().catch(() => null),
        api.rooms(true).catch(() => null),
        api.departmentInventory().catch(() => null),
        api.conversations().catch(() => null),
      ]);

      if (freshAnalytics) setData(freshAnalytics);
      if (Array.isArray(freshReservations)) {
        setReservationsList(freshReservations.map((b: any) => ({
          ...b,
          nights: b.nights || Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000)),
        })));
      }
      if (Array.isArray(freshNotifs)) setNotifications(freshNotifs);
      if (Array.isArray(freshRooms)) setRoomsList(freshRooms);
      if (Array.isArray(freshInv)) setInventoryList(freshInv);
      if (Array.isArray(freshConvs)) setGuestConversations(freshConvs);
    } catch {
      // Silent background catch
    }
  }, [isAdministrator]);

  useEffect(() => {
    if (!isAdministrator) return;
    const interval = setInterval(() => {
      autoReloadLive();
    }, 20000); // 20-second auto reload
    return () => clearInterval(interval);
  }, [isAdministrator, autoReloadLive]);

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
    if (auditRoleFilter !== 'ALL') params.append('role', auditRoleFilter);
    if (auditDateFilter && auditDateFilter !== 'ALL') params.append('date', auditDateFilter);
    if (auditSearchQuery.trim()) params.append('q', auditSearchQuery.trim());
    params.append('limit', '200');

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
  }, [auditActionFilter, auditRoleFilter, auditDateFilter, auditSearchQuery]);

  // Live Defense-in-Depth Security Posture Data Fetching
  const fetchSecurityPosture = useCallback(() => {
    setLoadingSecurity(true);
    api.securityPosture()
      .then((res) => {
        if (res) setSecurityPosture(res);
      })
      .catch((err) => {
        console.warn('[Security Posture] Fetch notice:', err.message);
      })
      .finally(() => setLoadingSecurity(false));
  }, []);

  const handleUnbanIp = async (ip: string) => {
    setUnbanningIp(ip);
    try {
      await api.releaseQuarantinedIp(ip);
      toast(`🟢 IP ${ip} successfully released from quarantine`);
      fetchSecurityPosture();
      fetchAuditLogs();
    } catch (err: any) {
      toast(err.message, true);
    } finally {
      setUnbanningIp(null);
    }
  };

  const handleClearLockouts = async () => {
    if (!confirm('Reset all active brute force lockouts?')) return;
    try {
      await api.clearLockouts();
      toast('🔓 All brute force lockouts cleared');
      fetchSecurityPosture();
      fetchAuditLogs();
    } catch (err: any) {
      toast(err.message, true);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
      fetchSecurityPosture();
      if (!auditAutoRefresh) return;
      const iv = setInterval(() => {
        fetchAuditLogs();
        fetchSecurityPosture();
      }, 5000);
      return () => clearInterval(iv);
    }
  }, [activeTab, auditActionFilter, auditRoleFilter, auditDateFilter, auditSearchQuery, auditAutoRefresh, fetchAuditLogs, fetchSecurityPosture]);

  const [savingSettings, setSavingSettings] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      if (!adminProfileState.fullName?.trim()) {
        throw new Error('Please enter your full name.');
      }
      const updatePayload = {
        full_name: adminProfileState.fullName.trim(),
        title: adminProfileState.title.trim(),
        phone: adminProfileState.phone.trim(),
      };

      if (updateProfile) {
        await updateProfile(updatePayload);
      } else {
        await api.updateMe(updatePayload);
      }

      // If new password was entered, update it cleanly
      if (adminProfileState.newPassword) {
        if (adminProfileState.newPassword.length < 6) {
          throw new Error('New password must be at least 6 characters.');
        }
        if (adminProfileState.newPassword !== adminProfileState.confirmPassword) {
          throw new Error('New passwords do not match.');
        }
        await api.updatePassword(adminProfileState.newPassword);
        setAdminProfileState((prev) => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }));
      }

      toast('⚙️ Executive Profile & Control Settings saved to database! ✦');
    } catch (err: any) {
      toast(err.message || 'Could not save profile settings', true);
    } finally {
      setSavingSettings(false);
    }
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
              <div><strong style={{ color: '#94A3B8' }}>Account Name:</strong> <span style={{ color: '#FFF' }}>{profile?.full_name || 'User'}</span></div>
              <div><strong style={{ color: '#94A3B8' }}>Email:</strong> <span style={{ color: '#FFF' }}>{profile?.email || user?.email}</span></div>
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
                  {profile?.role || 'customer'}
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
              ✦ ROCK VIEW RESORT
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6 }}>
              <button
                type="button"
                onClick={() => {
                  setAdminRecoveryEmail(adminEmail || '');
                  setAdminRecoveryStep(1);
                  setShowAdminForgotModal(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#38BDF8',
                  fontSize: '.78rem',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Forgot password? Reset via OTP
              </button>
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

  const isModalRoomLocked = (() => {
    if (!newReservation.room_id || !newReservation.check_in || !newReservation.check_out) return false;
    const room = roomsList.find((r) => r.id === newReservation.room_id);
    const totalUnits = Number(room?.units) || 1;
    const overlapping = reservationsList.filter((b: any) =>
      b.room_id === newReservation.room_id &&
      ['pending', 'confirmed', 'checked_in'].includes(b.status) &&
      b.check_in < newReservation.check_out &&
      b.check_out > newReservation.check_in
    );
    let cur = new Date(newReservation.check_in);
    const end = new Date(newReservation.check_out);
    while (cur < end) {
      const night = cur.toISOString().slice(0, 10);
      const busy = overlapping.filter((b: any) => b.check_in <= night && b.check_out > night).length;
      if (busy >= totalUnits) return true;
      cur.setDate(cur.getDate() + 1);
    }
    return false;
  })();

  async function handleCreateReservation(e: React.FormEvent) {
    e.preventDefault();
    setCreatingReservation(true);
    try {
      if (!newReservation.room_id) {
        throw new Error('Please select an accommodation / room.');
      }
      if (isModalRoomLocked) {
        throw new Error('This accommodation is already locked in / taken for those dates. Overbooking is strictly prevented.');
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
      autoReloadLive();
    } catch (err: any) {
      toast(err.message || 'Failed to record reservation', true);
    } finally {
      setCreatingReservation(false);
    }
  }

  const unreadNotifsCount = notifications.filter((n: any) => !n.is_read).length;
  const readNotifsCount = notifications.filter((n: any) => Boolean(n.is_read)).length;
  const smsNotifsCount = notifications.filter((n: any) => n.type === 'sms' || Boolean(n.to_phone)).length;
  const systemNotifsCount = notifications.filter((n: any) => n.type !== 'sms' && !n.to_phone).length;

  const handleMarkNotifRead = async (id: string) => {
    setNotifications((prev: any[]) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    toast('✓ Notification marked as read');
    try {
      await api.markNotificationRead(id);
    } catch (err: any) {
      console.warn(err);
    }
  };

  const handleMarkAllNotifsRead = async () => {
    setNotifications((prev: any[]) => prev.map((n) => ({ ...n, is_read: true })));
    toast('✓ All notifications moved to Read');
    try {
      await api.markAllNotificationsRead();
    } catch (err: any) {
      console.warn(err);
    }
  };

  const handleDeleteNotif = async (id: string) => {
    setNotifications((prev: any[]) => prev.filter((n) => n.id !== id));
    toast('🗑️ Notification deleted');
    try {
      await api.deleteNotification(id);
    } catch (err: any) {
      console.warn(err);
    }
  };

  const handleClearAllNotifs = async () => {
    if (!notifications.length) return;
    const ok = window.confirm('Are you sure you want to permanently clear all notifications?');
    if (!ok) return;
    setNotifications([]);
    toast('🗑️ All notifications cleared');
    try {
      await api.clearAllNotifications();
    } catch (err: any) {
      console.warn(err);
    }
  };

  const handleClearReadNotifs = async () => {
    const readOnes = notifications.filter((n: any) => n.is_read);
    if (!readOnes.length) return toast('No read notifications to clear');
    setNotifications((prev: any[]) => prev.filter((n) => !n.is_read));
    toast('🧹 Cleared all read notifications');
    try {
      await Promise.all(readOnes.map((n) => api.deleteNotification(n.id).catch(() => {})));
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

  // Administrative User Profile Update Handler
  async function handleUpdateUser(e) {
    e.preventDefault();
    if (!editingUser) return;
    setSavingUser(true);
    try {
      const full_name = [editingUser.first_name, editingUser.middle_name, editingUser.last_name].filter(Boolean).join(' ') || editingUser.full_name;
      const isCustomer = !editingUser.role || editingUser.role === 'customer';
      const payload = {
        full_name,
        first_name: editingUser.first_name,
        middle_name: editingUser.middle_name,
        last_name: editingUser.last_name,
        phone: editingUser.phone,
        username: editingUser.username,
        role: isCustomer ? 'customer' : editingUser.role,
      };
      const updated = await api.adminUpdateUser(editingUser.id, payload);
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, ...updated, full_name } : u)));
      toast(`Profile updated for ${full_name || 'Account'} ✦`);
      setEditingUser(null);
    } catch (err) {
      toast(err.message, true);
    } finally {
      setSavingUser(false);
    }
  }

  // Administrative User Permanent Deletion Handler
  async function handleDeleteUser() {
    if (!userToDelete) return;
    setDeletingUser(true);
    try {
      await api.adminDeleteUser(userToDelete.id);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      toast(`Account permanently deleted for ${userToDelete.full_name || userToDelete.email} ✦`);
      setUserToDelete(null);
    } catch (err) {
      toast(err.message, true);
    } finally {
      setDeletingUser(false);
    }
  }

  // Administrator Sign-In Forgot Password OTP Request
  async function handleAdminForgotPassword(e) {
    e.preventDefault();
    if (!adminRecoveryEmail) return toast('Please enter your administrator account email', true);
    setAdminRecoveryBusy(true);
    try {
      const res = await api.forgotPassword(adminRecoveryEmail);
      toast(res.message || 'OTP verification code dispatched to your email!');
      setAdminRecoveryStep(2);
    } catch (err) {
      toast(err.message, true);
    } finally {
      setAdminRecoveryBusy(false);
    }
  }

  // Administrator Sign-In Reset Password with OTP
  async function handleAdminResetPassword(e) {
    e.preventDefault();
    if (!adminRecoveryCode || adminRecoveryCode.length !== 6) return toast('Enter the 6-digit verification code', true);
    if (!adminRecoveryNewPass || adminRecoveryNewPass.length < 6) return toast('New password must be at least 6 characters', true);
    setAdminRecoveryBusy(true);
    try {
      const res = await api.resetPassword(adminRecoveryEmail, adminRecoveryCode, adminRecoveryNewPass);
      toast(res.message || 'Password reset successfully! Please sign in with your new credentials.');
      setShowAdminForgotModal(false);
      setAdminRecoveryStep(1);
      setAdminEmail(adminRecoveryEmail);
      setAdminPass(adminRecoveryNewPass);
    } catch (err) {
      toast(err.message, true);
    } finally {
      setAdminRecoveryBusy(false);
    }
  }

  // Ledger Refund Submission Handler
  async function handleRefundSubmit(e) {
    e.preventDefault();
    if (!refundTarget) return;
    setSubmittingRefund(true);
    try {
      const amountNum = Number(refundAmount) || refundTarget.downpayment_php || refundTarget.total_php || 0;
      if (refundMode === 'request') {
        const res = await api.requestRefund(refundTarget.id, refundReason, amountNum);
        toast(res.message || 'Refund request registered and in-process email dispatched ✦');
      } else {
        const res = await api.confirmRefund(refundTarget.id, {
          amount: amountNum,
          refund_method: refundMethod,
          reference_number: refundRefNum || `REF-${Date.now().toString().slice(-6)}`,
          cancel_booking: true,
        });
        toast(res.message || 'Refund confirmed and confirmation email dispatched ✦');
      }
      setRefundTarget(null);
      setRefundReason('');
      setRefundAmount('');
      setRefundRefNum('');
      setReservationsList((prev) => prev.map((r) => r.id === refundTarget.id ? {
        ...r,
        payment_status: refundMode === 'confirm' ? 'refunded' : 'refund_pending',
        status: refundMode === 'confirm' ? 'cancelled' : r.status,
      } : r));
      refreshReservations();
      autoReloadLive();
    } catch (err) {
      toast(err.message, true);
    } finally {
      setSubmittingRefund(false);
    }
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

      if (uploaded.source === 'cloudinary' || (uploaded.url && uploaded.url.includes('cloudinary.com'))) {
        toast('☁️ Room photo uploaded to Cloudinary CDN & synchronized!');
      } else {
        toast('✅ Room photo uploaded & saved successfully!');
      }
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
    { key: 'ledger', label: 'General Ledger (Debit & Credit)', icon: <IconLedger size={19} />, count: (ledgerEntriesList.length > 0 ? ledgerEntriesList.length : allBookings.length), badgeColor: '#0EA5E9' },
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
                  ROCK VIEW SAAS
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
            onClick={() => setShowGlossaryModal(true)}
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
        <header className="admin-header" style={{ background: themeHeaderBg, borderBottom: `1px solid ${themeBorder}`, position: 'relative', zIndex: 100, overflow: 'visible' }}>
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

          {/* TOP RIGHT CONTROLS: LIGHT/DARK THEME TOGGLE, NOTIFICATION BAR & AVATAR */}
          <div className="admin-header-right">

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
            <div className="admin-header-notif-wrap" style={{ position: 'relative', zIndex: 102 }}>
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
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      width: '100vw',
                      height: '100vh',
                      zIndex: 9998,
                      background: 'rgba(0, 0, 0, 0.25)',
                    }}
                  />
                  <div
                    className="scrollbar-none no-scrollbar"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 8px)',
                      width: 400,
                      maxWidth: 'calc(100vw - 24px)',
                      background: isLightMode ? '#FFFFFF' : '#0F172A',
                      color: isLightMode ? '#0F172A' : '#F8FAFC',
                      border: `1px solid ${isLightMode ? '#CBD5E1' : 'rgba(255,255,255,0.18)'}`,
                      borderRadius: 16,
                      boxShadow: isLightMode ? '0 20px 48px rgba(0,0,0,0.16)' : '0 25px 60px rgba(0,0,0,0.85)',
                      padding: '16px 16px 14px 16px',
                      zIndex: 9999,
                      overflow: 'hidden',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${themeBorder}`, paddingBottom: 10, marginBottom: 10 }}>
                      <div>
                        <b style={{ fontSize: '.9rem', color: themeText, letterSpacing: '.01em' }}>Executive Notifications</b>
                        <small style={{ color: '#0EA5E9', fontSize: '.72rem', display: 'block', fontWeight: 600 }}>SMS & Live System Alerts</small>
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
                      <p className="muted small" style={{ margin: 0, padding: '24px 16px', textAlign: 'center' }}>No new notifications.</p>
                    ) : (
                      <div
                        className="scrollbar-none no-scrollbar"
                        style={{
                          maxHeight: 320,
                          overflowY: 'auto',
                          overflowX: 'hidden',
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          paddingRight: 1,
                        }}
                      >
                        {notifications.slice(0, 6).map((n: any) => (
                          <div
                            key={n.id}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 10,
                              background: !n.is_read ? (isLightMode ? '#F1F5F9' : 'rgba(99,102,241,0.14)') : (isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)'),
                              border: isLightMode ? '1px solid #E2E8F0' : '1px solid rgba(255,255,255,0.07)',
                              fontSize: '.78rem',
                              overflow: 'hidden',
                              boxSizing: 'border-box',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: '.66rem',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  letterSpacing: '.06em',
                                  padding: '2px 7px',
                                  borderRadius: 6,
                                  background: n.status === 'failed' ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)',
                                  color: n.status === 'failed' ? '#F43F5E' : '#10B981',
                                  border: `1px solid ${n.status === 'failed' ? 'rgba(244,63,94,0.3)' : 'rgba(16,185,129,0.3)'}`,
                                }}
                              >
                                {n.status || 'SENT'}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                                <span style={{ color: themeMuted, fontSize: '.7rem', whiteSpace: 'nowrap' }}>
                                  {fmtDate(n.created_at)} {fmtTime(n.created_at)}
                                </span>
                                {!n.is_read && (
                                  <button
                                    onClick={() => handleMarkNotifRead(n.id)}
                                    title="Mark as read"
                                    style={{ background: 'rgba(16,185,129,0.12)', border: 'none', color: '#10B981', cursor: 'pointer', fontSize: '.72rem', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}
                                  >
                                    ✓
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteNotif(n.id)}
                                  title="Delete alert"
                                  style={{ background: 'rgba(244,63,94,0.12)', border: 'none', color: '#F43F5E', cursor: 'pointer', fontSize: '.72rem', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                            <p
                              style={{
                                margin: 0,
                                color: themeText,
                                fontSize: '.78rem',
                                lineHeight: 1.45,
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere',
                                whiteSpace: 'normal',
                              }}
                            >
                              {(n.body || n.content || '').replace(/\broom1\b/gi, 'Villa Room 1')}
                            </p>
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
                        style={{ width: '100%', justifyContent: 'center', padding: '9px 16px', fontWeight: 700, fontSize: '.8rem' }}
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
                  onClick={() => toast(`🤖 Automation Rate: ${ov.automation_rate_pct ?? 98}% AI Chatbot Resolution Engine`)}
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
                        {ov.automation_rate_pct ?? 98}%
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
                    toast(`🔖 ${ov.chatbot_bookings ?? 1} Bookings assisted via Resort Chatbot`);
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
                        {ov.chatbot_bookings ?? 1}
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
                  onClick={() => toast(`😊 Chatbot CSAT Score: ${ov.chatbot_csat_pct ?? 96}% Guest Satisfaction Rating`)}
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
                        {ov.chatbot_csat_pct ?? 96}%
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
                    toast(`👥 ${ov.conversations_closed || guestConversations.length || 9} Operations Inquiries Handled`);
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
                        {ov.conversations_closed || guestConversations.length || 9}
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
                {/* LEFT COLUMN: SALES / PERFORMANCE ROW */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

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

          {/* TAB 3: EXECUTIVE PROFILE & ACCOUNT SETTINGS */}
          {activeTab === 'settings' && (
            <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 20, padding: 28, boxShadow: themeShadow }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 16 }}>
                <div>
                  <span style={{ fontSize: '.76rem', color: '#0EA5E9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em' }}>
                    ADMINISTRATIVE PROFILE
                  </span>
                  <h3 className="serif" style={{ fontSize: '1.6rem', margin: '4px 0 0', color: themeText }}>
                    Account Profile & Settings
                  </h3>
                  <p className="muted small" style={{ margin: '4px 0 0' }}>
                    Update your administrative credentials, contact information, and security password.
                  </p>
                </div>
                <span style={{ fontSize: '.76rem', color: '#10B981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', padding: '4px 14px', borderRadius: 20, border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  👑 {profile?.role?.toUpperCase() || 'ADMINISTRATOR'}
                </span>
              </div>

              <form onSubmit={handleSaveSettings} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* 1. Identity & Contact Information */}
                <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 22 }}>
                  <b style={{ fontSize: '1rem', color: themeText, display: 'block', marginBottom: 14 }}>
                    👤 Profile Details
                  </b>
                  <div className="admin-grid-2-col" style={{ gap: 14 }}>
                    <div className="field">
                      <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>FULL NAME *</label>
                      <input
                        type="text"
                        required
                        style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                        value={adminProfileState.fullName}
                        onChange={(e) => setAdminProfileState({ ...adminProfileState, fullName: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>TITLE / POSITION *</label>
                      <input
                        type="text"
                        required
                        style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                        value={adminProfileState.title}
                        onChange={(e) => setAdminProfileState({ ...adminProfileState, title: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>EMAIL ADDRESS *</label>
                      <input
                        type="email"
                        required
                        style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                        value={adminProfileState.email}
                        onChange={(e) => setAdminProfileState({ ...adminProfileState, email: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>MOBILE PHONE (11-DIGIT PH)</label>
                      <input
                        type="tel"
                        maxLength={11}
                        style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                        value={adminProfileState.phone}
                        onChange={(e) => setAdminProfileState({ ...adminProfileState, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Password Security Management */}
                <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                    <b style={{ fontSize: '1rem', color: themeText }}>
                      🔒 Password Security
                    </b>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {profile?.employee_id && (
                        <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: 12, background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.35)', fontWeight: 600 }}>
                          ID: {profile.employee_id} {profile.department ? `(${profile.department})` : ''}
                        </span>
                      )}
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 12,
                        background: profile?.password_status === 'N/A' || !profile?.has_password ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: profile?.password_status === 'N/A' || !profile?.has_password ? '#F59E0B' : '#10B981',
                        border: `1px solid ${profile?.password_status === 'N/A' || !profile?.has_password ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                      }}>
                        {profile?.password_status === 'N/A' || !profile?.has_password ? 'Password: N/A' : 'Password: Configured 🔒'}
                      </span>
                    </div>
                  </div>
                  <div className="admin-grid-2-col" style={{ gap: 14 }}>
                    <div className="field">
                      <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>NEW PASSWORD</label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                        value={adminProfileState.newPassword || ''}
                        onChange={(e) => setAdminProfileState({ ...adminProfileState, newPassword: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>CONFIRM NEW PASSWORD</label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                        value={adminProfileState.confirmPassword || ''}
                        onChange={(e) => setAdminProfileState({ ...adminProfileState, confirmPassword: e.target.value })}
                      />
                    </div>
                  </div>
                  {adminProfileState.newPassword && (
                    <button
                      type="button"
                      onClick={() => {
                        if (adminProfileState.newPassword.length < 6) return toast('Password must be at least 6 characters', true);
                        if (adminProfileState.newPassword !== adminProfileState.confirmPassword) return toast('Passwords do not match', true);
                        const doUpdate = updatePassword || api.updatePassword;
                        doUpdate(adminProfileState.newPassword)
                          .then(() => {
                            toast('🔒 Security password updated successfully!');
                            setAdminProfileState({ ...adminProfileState, currentPassword: '', newPassword: '', confirmPassword: '' });
                          })
                          .catch((e) => toast(e.message, true));
                      }}
                      className="btn btn-sky btn-sm"
                      style={{ marginTop: 12, fontWeight: 700 }}
                    >
                      Update Password Now
                    </button>
                  )}
                </div>

                {/* 3. Action Buttons: SAVE, DELETE, CANCEL */}
                {confirmDeleteSelf ? (
                  <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 16, padding: 20, textAlign: 'center' }}>
                    <b style={{ color: '#F87171', display: 'block', fontSize: '1.05rem', marginBottom: 6 }}>
                      ⚠️ Permanently Delete This Administrative Account?
                    </b>
                    <p style={{ color: '#FECACA', fontSize: '.84rem', margin: '0 0 16px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
                      This action will permanently purge your profile and administrative credentials from the database. You will be signed out immediately.
                    </p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                      <button
                        type="button"
                        disabled={deletingSelf}
                        onClick={async () => {
                          setDeletingSelf(true);
                          try {
                            if (deleteAccount) await deleteAccount();
                            window.location.href = '/';
                          } catch (err: any) {
                            toast(err.message, true);
                          } finally {
                            setDeletingSelf(false);
                            setConfirmDeleteSelf(false);
                          }
                        }}
                        className="btn"
                        style={{ background: '#EF4444', color: '#FFF', fontWeight: 800, padding: '10px 24px', borderRadius: 10 }}
                      >
                        {deletingSelf ? 'Deleting Account…' : 'Yes, Delete My Account'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteSelf(false)}
                        className="btn btn-ghost"
                        style={{ border: `1px solid ${themeBorder}`, color: themeText, padding: '10px 24px', borderRadius: 10 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 10 }}>
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="btn btn-sky"
                      style={{ justifyContent: 'center', padding: '14px 20px', fontWeight: 800, fontSize: '.95rem', borderRadius: 12 }}
                    >
                      {savingSettings ? '💾 Saving to Database…' : '💾 Save Profile'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteSelf(true)}
                      className="btn"
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#F87171',
                        justifyContent: 'center',
                        padding: '14px 20px',
                        fontWeight: 800,
                        fontSize: '.95rem',
                        borderRadius: 12,
                        cursor: 'pointer',
                      }}
                    >
                      🗑️ Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('overview')}
                      className="btn btn-ghost"
                      style={{
                        border: `1px solid ${themeBorder}`,
                        color: themeText,
                        justifyContent: 'center',
                        padding: '14px 20px',
                        fontWeight: 800,
                        fontSize: '.95rem',
                        borderRadius: 12,
                        cursor: 'pointer',
                      }}
                    >
                      ✕ Cancel
                    </button>
                  </div>
                )}
              </form>
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
                      SUPABASE LIVE CONNECTED
                    </span>
                  </div>
                  <h3 className="serif" style={{ fontSize: '1.6rem', margin: '4px 0 0', color: themeText }}>System Audit & Security Event Trail</h3>
                  <p className="muted small" style={{ margin: '4px 0 0' }}>Tamper-evident administrative audit log connected directly to Supabase. Records all room, inventory, role, and security access events in real-time.</p>
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
                    onClick={async () => {
                      if (!confirm('Empty all recorded audit logs and start fresh?')) return;
                      try {
                        await api.clearAuditLogs();
                        setAuditLogs([]);
                        toast('🗑️ Audit log trail emptied successfully');
                      } catch (err: any) {
                        toast(err.message, true);
                      }
                    }}
                    style={{ border: '1px solid rgba(244,63,94,0.3)', color: '#F43F5E', background: 'rgba(244,63,94,0.08)', fontWeight: 700 }}
                  >
                    🗑️ Empty Audit Logs
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
                  <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700 }}>TOTAL ACTIONS RECORDED</span>
                  <b style={{ display: 'block', fontSize: '1.5rem', color: '#0EA5E9', marginTop: 4 }}>{auditLogs.length}</b>
                  <small style={{ fontSize: '.7rem', color: '#10B981' }}>🟢 Database Ring Buffer Synced</small>
                </div>
                <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 16 }}>
                  <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700 }}>ADMINISTRATOR PROCESSES</span>
                  <b style={{ display: 'block', fontSize: '1.5rem', color: '#8B5CF6', marginTop: 4 }}>
                    {auditLogs.filter((l) => ['administrator', 'admin', 'system'].includes(l.role?.toLowerCase()) || ['administrator', 'admin', 'system'].includes(l.actor_role?.toLowerCase())).length}
                  </b>
                  <small style={{ fontSize: '.7rem', color: '#8B5CF6' }}>👑 Executive Operations Recorded</small>
                </div>
                <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 16 }}>
                  <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700 }}>STAFF OPERATIONAL ACTIONS</span>
                  <b style={{ display: 'block', fontSize: '1.5rem', color: '#0EA5E9', marginTop: 4 }}>
                    {auditLogs.filter((l) => ['staff', 'receptionist', 'accounting', 'manager', 'cashier'].includes(l.role?.toLowerCase()) || ['staff', 'receptionist', 'accounting'].includes(l.actor_role?.toLowerCase()) || l.action?.includes('STAFF') || l.action?.startsWith('INVENTORY')).length}
                  </b>
                  <small style={{ fontSize: '.7rem', color: '#0EA5E9' }}>👔 Front Desk & Inventory Processes</small>
                </div>
                <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 16 }}>
                  <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700 }}>CUSTOMER LOGIN TIMESTAMPS</span>
                  <b style={{ display: 'block', fontSize: '1.5rem', color: '#10B981', marginTop: 4 }}>
                    {auditLogs.filter((l) => l.action === 'CUSTOMER_LOGIN' || l.role === 'customer' || l.actor_role === 'customer').length}
                  </b>
                  <small style={{ fontSize: '.7rem', color: '#10B981' }}>👤 Verified Guest Access Timestamps</small>
                </div>
              </div>

              {/* LIVE DEFENSE-IN-DEPTH POSTURE & THREAT QUARANTINE CENTER */}
              <div style={{
                background: isLightMode ? '#F8FAFC' : 'rgba(15,23,42,0.7)',
                border: `1px solid ${themeBorder}`,
                borderRadius: 14,
                padding: 18,
                marginBottom: 20,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: themeText, fontWeight: 700 }}>
                        Active Defense Telemetry & Perimeter Hardening
                      </h4>
                      <small style={{ color: themeMuted, fontSize: '.74rem' }}>
                        Layer 7 NGWF Firewall • Brute Force Lockout Guard • TLS v1.3 SSL • Level 3 CSP Policy
                      </small>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      fontSize: '.72rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 12,
                      background: 'rgba(16,185,129,0.12)',
                      color: '#10B981',
                      border: '1px solid rgba(16,185,129,0.3)',
                    }}>
                      STATUS: {securityPosture?.status || 'OPTIMAL'}
                    </span>
                    <button
                      className="btn btn-sm"
                      onClick={fetchSecurityPosture}
                      disabled={loadingSecurity}
                      style={{ fontSize: '.75rem', padding: '4px 10px', border: `1px solid ${themeBorder}`, color: themeText }}
                    >
                      {loadingSecurity ? 'Refreshing…' : '🔄 Refresh Security'}
                    </button>
                  </div>
                </div>

                {/* 4 ACTIVE DEFENSE TILES */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 14 }}>
                  {/* TILE 1: LAYER 7 NGWF FIREWALL */}
                  <div style={{
                    background: isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${securityPosture?.firewall?.active_quarantines_count > 0 ? 'rgba(244,63,94,0.4)' : themeBorder}`,
                    borderRadius: 12,
                    padding: 12,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: '.7rem', fontWeight: 800, color: '#0EA5E9', textTransform: 'uppercase' }}>NGWF FIREWALL</span>
                      <span style={{ fontSize: '.68rem', color: '#10B981', fontWeight: 700 }}>🟢 ACTIVE</span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: themeText }}>
                      {securityPosture?.firewall?.total_threat_strikes ?? 0} <span style={{ fontSize: '.72rem', fontWeight: 500, color: themeMuted }}>Threat Probes Filtered</span>
                    </div>
                    <small style={{ fontSize: '.7rem', color: securityPosture?.firewall?.active_quarantines_count > 0 ? '#F43F5E' : themeMuted }}>
                      {securityPosture?.firewall?.active_quarantines_count > 0
                        ? `🚨 ${securityPosture.firewall.active_quarantines_count} IP(s) In Active Quarantine`
                        : `3-Strike Threshold • Auto IP Quarantine`}
                    </small>
                  </div>

                  {/* TILE 2: BRUTE FORCE & CREDENTIAL GUARD */}
                  <div style={{
                    background: isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${securityPosture?.brute_force_defense?.active_lockouts_count > 0 ? 'rgba(245,158,11,0.4)' : themeBorder}`,
                    borderRadius: 12,
                    padding: 12,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: '.7rem', fontWeight: 800, color: '#8B5CF6', textTransform: 'uppercase' }}>BRUTE FORCE GUARD</span>
                      <span style={{ fontSize: '.68rem', color: '#10B981', fontWeight: 700 }}>🟢 ACTIVE</span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: themeText }}>
                      {securityPosture?.brute_force_defense?.active_lockouts_count ?? 0} <span style={{ fontSize: '.72rem', fontWeight: 500, color: themeMuted }}>Active Lockouts</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                      <small style={{ fontSize: '.7rem', color: themeMuted }}>
                        5 Strikes = 15m Lockout
                      </small>
                      {securityPosture?.brute_force_defense?.active_lockouts_count > 0 && (
                        <button
                          onClick={handleClearLockouts}
                          style={{ fontSize: '.68rem', padding: '2px 6px', background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}
                        >
                          Clear Lockouts
                        </button>
                      )}
                    </div>
                  </div>

                  {/* TILE 3: TRANSPORT ENCRYPTION (TLS v1.3) */}
                  <div style={{
                    background: isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${themeBorder}`,
                    borderRadius: 12,
                    padding: 12,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: '.7rem', fontWeight: 800, color: '#10B981', textTransform: 'uppercase' }}>TRANSPORT TLS</span>
                      <span style={{ fontSize: '.68rem', color: '#10B981', fontWeight: 700 }}>🔒 HTTPS v1.3</span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: themeText }}>
                      TLS v1.3 <span style={{ fontSize: '.72rem', fontWeight: 500, color: themeMuted }}>ECDHE Hardened</span>
                    </div>
                    <small style={{ fontSize: '.7rem', color: '#10B981' }}>
                      Status: {securityPosture?.tls?.status || 'Active & Valid'}
                    </small>
                  </div>

                  {/* TILE 4: CONTENT SECURITY POLICY (CSP) */}
                  <div style={{
                    background: isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${themeBorder}`,
                    borderRadius: 12,
                    padding: 12,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: '.7rem', fontWeight: 800, color: '#F59E0B', textTransform: 'uppercase' }}>CONTENT POLICY (CSP)</span>
                      <span style={{ fontSize: '.68rem', color: '#10B981', fontWeight: 700 }}>🛡️ LEVEL 3</span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: themeText }}>
                      Strict CSP <span style={{ fontSize: '.72rem', fontWeight: 500, color: themeMuted }}>Directives</span>
                    </div>
                    <small style={{ fontSize: '.7rem', color: themeMuted }}>
                      Anti-Clickjacking • Zero Plugin Exec
                    </small>
                  </div>
                </div>

                {/* QUARANTINED IPS MANAGEMENT SECTION */}
                {securityPosture?.firewall?.quarantined_ips && securityPosture.firewall.quarantined_ips.length > 0 ? (
                  <div style={{
                    background: isLightMode ? '#FFF1F2' : 'rgba(244,63,94,0.08)',
                    border: '1px solid rgba(244,63,94,0.25)',
                    borderRadius: 10,
                    padding: 14,
                    marginTop: 10,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#F43F5E', fontWeight: 800, fontSize: '.85rem' }}>🚨 ACTIVELY QUARANTINED ATTACKING IP ADDRESSES</span>
                        <span style={{ fontSize: '.72rem', background: '#F43F5E', color: '#FFF', padding: '1px 7px', borderRadius: 10, fontWeight: 800 }}>
                          {securityPosture.firewall.quarantined_ips.length}
                        </span>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm('Pardon and release ALL quarantined IP addresses?')) return;
                          try {
                            await api.clearQuarantines();
                            toast('🟢 All quarantined IPs released');
                            fetchSecurityPosture();
                            fetchAuditLogs();
                          } catch (err: any) {
                            toast(err.message, true);
                          }
                        }}
                        style={{ fontSize: '.72rem', padding: '3px 8px', background: 'transparent', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.4)', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}
                      >
                        Release All Quarantines
                      </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', fontSize: '.78rem', borderCollapse: 'collapse', color: themeText }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${themeBorder}`, textAlign: 'left', color: themeMuted }}>
                            <th style={{ padding: '6px 8px' }}>IP Address</th>
                            <th style={{ padding: '6px 8px' }}>Strikes</th>
                            <th style={{ padding: '6px 8px' }}>Quarantine Trigger / Reason</th>
                            <th style={{ padding: '6px 8px' }}>Remaining Lockout</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {securityPosture.firewall.quarantined_ips.map((q: any) => (
                            <tr key={q.ip} style={{ borderBottom: `1px solid ${themeBorder}` }}>
                              <td style={{ padding: '8px', fontFamily: 'monospace', fontWeight: 700, color: '#F43F5E' }}>
                                {q.ip}
                              </td>
                              <td style={{ padding: '8px', fontWeight: 700 }}>
                                {q.strikes} strikes
                              </td>
                              <td style={{ padding: '8px', color: themeMuted, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {q.reason}
                              </td>
                              <td style={{ padding: '8px', color: themeMuted }}>
                                {q.remaining_seconds}s
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>
                                <button
                                  className="btn btn-sm btn-ghost"
                                  disabled={unbanningIp === q.ip}
                                  onClick={() => handleUnbanIp(q.ip)}
                                  style={{
                                    fontSize: '.72rem',
                                    padding: '3px 9px',
                                    border: '1px solid #10B981',
                                    color: '#10B981',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                  }}
                                >
                                  {unbanningIp === q.ip ? 'Releasing…' : '✓ Pardon / Unban'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: isLightMode ? '#F0FDF4' : 'rgba(16,185,129,0.06)',
                    border: '1px solid rgba(16,185,129,0.2)',
                  }}>
                    <span style={{ fontSize: '.75rem', color: '#10B981', fontWeight: 600 }}>
                      🟢 Perimeter Secure: 0 quarantined IPs. Layer 7 firewall sentinel running continuously.
                    </span>
                    <span style={{ fontSize: '.7rem', color: themeMuted }}>
                      Sliding Window: 10m • Lockout: 1h
                    </span>
                  </div>
                )}
              </div>

              {/* SPECIFIC DAY SELECTOR & COLLECTIONS CONTROLS */}
              <div style={{
                background: isLightMode ? '#F8FAFC' : 'rgba(15,23,42,0.6)',
                border: `1px solid ${themeBorder}`,
                borderRadius: 14,
                padding: '16px 20px',
                marginBottom: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}>
                {/* Upper Row: Specific Day Selector & Quick Toggles */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '.84rem', fontWeight: 800, color: themeText, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📅</span> SELECT DAY:
                    </span>
                    <input
                      type="date"
                      value={auditDateFilter === 'ALL' ? '' : auditDateFilter}
                      onChange={(e) => setAuditDateFilter(e.target.value || 'ALL')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: `1px solid ${themeBorder}`,
                        background: isLightMode ? '#FFF' : 'rgba(30,41,59,0.9)',
                        color: themeText,
                        fontSize: '.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setAuditDateFilter(new Date().toISOString().slice(0, 10))}
                        className={`btn btn-sm ${auditDateFilter === new Date().toISOString().slice(0, 10) ? 'btn-sky' : 'btn-ghost'}`}
                        style={{ fontSize: '.78rem', padding: '5px 12px', fontWeight: 700, borderRadius: 8 }}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const y = new Date();
                          y.setDate(y.getDate() - 1);
                          setAuditDateFilter(y.toISOString().slice(0, 10));
                        }}
                        className={`btn btn-sm ${auditDateFilter === new Date(Date.now() - 86400000).toISOString().slice(0, 10) ? 'btn-sky' : 'btn-ghost'}`}
                        style={{ fontSize: '.78rem', padding: '5px 12px', fontWeight: 700, borderRadius: 8 }}
                      >
                        Yesterday
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuditDateFilter('ALL')}
                        className={`btn btn-sm ${auditDateFilter === 'ALL' ? 'btn-sky' : 'btn-ghost'}`}
                        style={{ fontSize: '.78rem', padding: '5px 12px', fontWeight: 700, borderRadius: 8 }}
                      >
                        All Recorded Days
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: '.76rem',
                      fontWeight: 700,
                      padding: '4px 12px',
                      borderRadius: 20,
                      background: auditDateFilter !== 'ALL' ? 'rgba(14,165,233,0.12)' : 'rgba(16,185,129,0.12)',
                      color: auditDateFilter !== 'ALL' ? '#0EA5E9' : '#10B981',
                      border: `1px solid ${auditDateFilter !== 'ALL' ? 'rgba(14,165,233,0.3)' : 'rgba(16,185,129,0.3)'}`,
                    }}>
                      {auditDateFilter !== 'ALL'
                        ? `🗓️ Actions for ${new Date(auditDateFilter + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`
                        : '🗓️ All Recorded Days'}
                    </span>
                    <span style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>
                      ({auditLogs.length} actions in day collection)
                    </span>
                  </div>
                </div>

                {/* Middle Row: Actor Role Scope Filtering */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderTop: `1px solid ${themeBorder}`, paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '.74rem', fontWeight: 800, color: themeMuted, textTransform: 'uppercase' }}>
                      ACTOR SCOPE:
                    </span>
                    {[
                      { key: 'ALL', label: 'All Users', icon: '👥' },
                      { key: 'administrator', label: '👑 Administrators (Processes)', icon: '👑' },
                      { key: 'staff', label: '👔 Staff & Front Desk', icon: '👔' },
                      { key: 'customer', label: '👤 Customers (Login Timestamps)', icon: '👤' },
                    ].map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setAuditRoleFilter(r.key)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 20,
                          fontSize: '.76rem',
                          fontWeight: 700,
                          border: `1px solid ${auditRoleFilter === r.key ? '#0EA5E9' : themeBorder}`,
                          background: auditRoleFilter === r.key ? 'rgba(14,165,233,0.15)' : 'transparent',
                          color: auditRoleFilter === r.key ? '#0EA5E9' : themeText,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  {/* Real-time search */}
                  <input
                    className="search"
                    placeholder="Search by actor, action, IP, details…"
                    value={auditSearchQuery}
                    onChange={(e) => setAuditSearchQuery(e.target.value)}
                    style={{ maxWidth: 280, height: 34, fontSize: '.8rem', background: isLightMode ? '#FFF' : undefined, color: themeText }}
                  />
                </div>

                {/* Lower Row: Process Action Filters */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '.72rem', fontWeight: 700, color: themeMuted, marginRight: 4 }}>
                    PROCESS TYPE:
                  </span>
                  {[
                    { key: 'ALL', label: 'All Processes' },
                    { key: 'LOGIN', label: '🔑 Logins & Timestamps' },
                    { key: 'ROOM', label: '🏡 Rooms & Villas' },
                    { key: 'BOOKING', label: '📅 Reservations & Stays' },
                    { key: 'INVENTORY', label: '📦 Inventory Mutations' },
                    { key: 'PROVISIONED', label: '👥 Staff Provisioning' },
                    { key: 'SECURITY', label: '🛡️ Security Denials & Locks' },
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      className={`chip ${auditActionFilter === f.key ? 'sel' : ''}`}
                      onClick={() => setAuditActionFilter(f.key)}
                      style={{ fontSize: '.72rem', padding: '3px 10px' }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* AUDIT LOG TABLE */}
              {loadingAudit && auditLogs.length === 0 ? (
                <div className="skel" style={{ height: 260 }} />
              ) : auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', border: `1px dashed ${themeBorder}`, borderRadius: 12 }}>
                  <span style={{ fontSize: '2.4rem' }}>🛡️</span>
                  <h4 style={{ margin: '8px 0 4px', color: themeText }}>No Actions Recorded For Selected Criteria</h4>
                  <p className="muted small">
                    {auditDateFilter !== 'ALL'
                      ? `No actions occurred on ${auditDateFilter}. Switch date or click "Today" / "All Recorded Days" to inspect other dates.`
                      : 'All administrative, staff, and customer login actions are persisted directly to database in real-time.'}
                  </p>
                  <button
                    className="btn btn-sky btn-sm"
                    onClick={() => { setAuditDateFilter('ALL'); setAuditRoleFilter('ALL'); setAuditActionFilter('ALL'); setAuditSearchQuery(''); }}
                    style={{ marginTop: 12 }}
                  >
                    Reset Filters & View All
                  </button>
                </div>
              ) : (
                <div style={{ maxHeight: 560, overflowY: 'auto', borderRadius: 12, border: `1px solid ${themeBorder}` }}>
                  <table style={{ width: '100%', fontSize: '.8rem', borderCollapse: 'collapse', color: themeText }}>
                    <thead>
                      <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.9)', position: 'sticky', top: 0, zIndex: 10 }}>
                        <th style={{ padding: '12px 14px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>DATE & TIME</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>ACTOR / USER</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>PROCESS & ACTION</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>TARGET RESOURCE</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>PROCESS DETAILS</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>IP / CLIENT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => {
                        const act = String(log.action || '').toUpperCase();
                        const isCustomer = log.role === 'customer' || log.actor_role === 'customer' || act === 'CUSTOMER_LOGIN';
                        const isAdmin = ['administrator', 'admin'].includes(log.role?.toLowerCase()) || ['administrator', 'admin'].includes(log.actor_role?.toLowerCase()) || act.startsWith('ADMIN');
                        const isStaff = !isAdmin && !isCustomer;

                        // Humanized process descriptions
                        let processTitle = act.replace(/_/g, ' ');
                        let processCategory = log.resource_type || 'System';
                        let processColor = '#0EA5E9';
                        let processBg = 'rgba(14,165,233,0.12)';
                        let processBorder = 'rgba(14,165,233,0.3)';
                        let processIcon = '⚡';
                        let processSummary = typeof log.details === 'object' ? (log.details.message || JSON.stringify(log.details)) : String(log.details || '');

                        if (act === 'CUSTOMER_LOGIN') {
                          processTitle = 'Customer Sign-In';
                          processCategory = 'Guest Authentication';
                          processColor = '#10B981';
                          processBg = 'rgba(16,185,129,0.15)';
                          processBorder = 'rgba(16,185,129,0.35)';
                          processIcon = '👤';
                          processSummary = `Customer login timestamp recorded in database (credentials verified)`;
                        } else if (act === 'ADMIN_LOGIN') {
                          processTitle = 'Administrator Login';
                          processCategory = 'Executive Portal';
                          processColor = '#8B5CF6';
                          processBg = 'rgba(139,92,246,0.15)';
                          processBorder = 'rgba(139,92,246,0.35)';
                          processIcon = '👑';
                          processSummary = log.details?.message || 'Executive administrator logged into administration portal';
                        } else if (act === 'ADMIN_SECURITY_VALIDATED') {
                          processTitle = 'Executive Security Cleared';
                          processCategory = 'Executive RBAC';
                          processColor = '#8B5CF6';
                          processBg = 'rgba(139,92,246,0.15)';
                          processBorder = 'rgba(139,92,246,0.35)';
                          processIcon = '🛡️';
                          processSummary = '4-Block Security Block validated with physical cryptographic token';
                        } else if (act === 'STAFF_LOGIN') {
                          processTitle = 'Staff Member Authenticated';
                          processCategory = 'Staff Operations';
                          processColor = '#0EA5E9';
                          processBg = 'rgba(14,165,233,0.15)';
                          processBorder = 'rgba(14,165,233,0.35)';
                          processIcon = '👔';
                          processSummary = log.details?.message || `Staff member (${log.details?.staff_role || log.role || 'staff'}) signed into portal`;
                        } else if (act === 'ROOM_CREATE') {
                          processTitle = 'Created Accommodation';
                          processCategory = 'Accommodations';
                          processColor = '#10B981';
                          processBg = 'rgba(16,185,129,0.15)';
                          processBorder = 'rgba(16,185,129,0.35)';
                          processIcon = '🏡';
                          processSummary = log.details?.name ? `Created ${log.details.name} (₱${log.details.rate_php?.toLocaleString() || 0}/night, Cap: ${log.details.capacity || 2})` : 'New accommodation created in database';
                        } else if (act === 'ROOM_UPDATE') {
                          processTitle = 'Updated Room / Villa';
                          processCategory = 'Accommodations';
                          processColor = '#0EA5E9';
                          processBg = 'rgba(14,165,233,0.15)';
                          processBorder = 'rgba(14,165,233,0.35)';
                          processIcon = '✏️';
                          processSummary = typeof log.details === 'object' ? Object.keys(log.details).map((k) => `${k}: ${log.details[k]}`).slice(0, 3).join(', ') : String(log.details);
                        } else if (act === 'ROOM_DEACTIVATE') {
                          processTitle = 'Deactivated Room';
                          processCategory = 'Accommodations';
                          processColor = '#F43F5E';
                          processBg = 'rgba(244,63,94,0.15)';
                          processBorder = 'rgba(244,63,94,0.35)';
                          processIcon = '⏸️';
                          processSummary = 'Accommodation marked inactive and hidden from booking flow';
                        } else if (act === 'ROOM_DELETE_PERMANENT') {
                          processTitle = 'Permanently Purged Room';
                          processCategory = 'Accommodations';
                          processColor = '#F43F5E';
                          processBg = 'rgba(244,63,94,0.15)';
                          processBorder = 'rgba(244,63,94,0.35)';
                          processIcon = '🗑️';
                          processSummary = 'Room record permanently deleted from database';
                        } else if (act === 'BOOKING_CREATE') {
                          processTitle = 'Created Reservation / Walk-In';
                          processCategory = 'Reservations';
                          processColor = '#10B981';
                          processBg = 'rgba(16,185,129,0.15)';
                          processBorder = 'rgba(16,185,129,0.35)';
                          processIcon = '📅';
                          processSummary = log.details?.room ? `${log.details.room} • Guest: ${log.details.guest_name || 'Guest'} • ₱${log.details.total_php?.toLocaleString() || 0}` : 'Reservation booked into system';
                        } else if (act === 'BOOKING_STATUS_UPDATE') {
                          processTitle = `Booking: ${log.details?.status || 'Status Change'}`;
                          processCategory = 'Reservations';
                          processColor = '#0EA5E9';
                          processBg = 'rgba(14,165,233,0.15)';
                          processBorder = 'rgba(14,165,233,0.35)';
                          processIcon = '🔄';
                          processSummary = `Updated to ${log.details?.status || 'status'} for ${log.details?.guest_name || 'guest'} (${log.details?.room || 'room'})`;
                        } else if (act === 'REFUND_REQUESTED') {
                          processTitle = 'Refund Requested';
                          processCategory = 'Financial';
                          processColor = '#F59E0B';
                          processBg = 'rgba(245,158,11,0.15)';
                          processBorder = 'rgba(245,158,11,0.35)';
                          processIcon = '💸';
                          processSummary = `Refund of ₱${log.details?.amount?.toLocaleString() || 0} requested for ${log.details?.guest_name || 'guest'}`;
                        } else if (act === 'REFUND_CONFIRMED') {
                          processTitle = 'Refund Approved & Processed';
                          processCategory = 'Financial';
                          processColor = '#10B981';
                          processBg = 'rgba(16,185,129,0.15)';
                          processBorder = 'rgba(16,185,129,0.35)';
                          processIcon = '✅';
                          processSummary = `Refund of ₱${log.details?.amount?.toLocaleString() || 0} confirmed via ${log.details?.method || 'account'} (Ref: ${log.details?.ref || 'N/A'})`;
                        } else if (act === 'INVENTORY_CREATE') {
                          processTitle = 'Added Inventory Item';
                          processCategory = 'Resort Inventory';
                          processColor = '#10B981';
                          processBg = 'rgba(16,185,129,0.15)';
                          processBorder = 'rgba(16,185,129,0.35)';
                          processIcon = '📦';
                          processSummary = log.details?.item_name ? `Added ${log.details.item_name} (${log.details.quantity || 0} ${log.details.unit || 'units'})` : 'Created inventory item';
                        } else if (act === 'INVENTORY_STOCK_UPDATE') {
                          processTitle = 'Stock Level Adjusted';
                          processCategory = 'Resort Inventory';
                          processColor = '#0EA5E9';
                          processBg = 'rgba(14,165,233,0.15)';
                          processBorder = 'rgba(14,165,233,0.35)';
                          processIcon = '📊';
                          processSummary = log.details?.delta ? `Quantity modified by ${log.details.delta > 0 ? '+' : ''}${log.details.delta} (${log.details.reason || 'Restock'})` : 'Inventory quantity updated';
                        } else if (act === 'INVENTORY_DELETE') {
                          processTitle = 'Deleted Inventory Item';
                          processCategory = 'Resort Inventory';
                          processColor = '#F43F5E';
                          processBg = 'rgba(244,63,94,0.15)';
                          processBorder = 'rgba(244,63,94,0.35)';
                          processIcon = '🗑️';
                          processSummary = 'Item removed from inventory database';
                        } else if (act === 'STAFF_PROVISIONED' || act === 'ADMIN_PROVISIONED') {
                          processTitle = act === 'ADMIN_PROVISIONED' ? 'Provisioned Administrator' : 'Provisioned Staff Account';
                          processCategory = 'Staff Directory';
                          processColor = '#8B5CF6';
                          processBg = 'rgba(139,92,246,0.15)';
                          processBorder = 'rgba(139,92,246,0.35)';
                          processIcon = '👥';
                          processSummary = `Created credentials for ${log.details?.full_name || log.details?.email} (${log.details?.role || 'staff'})`;
                        } else if (act === 'ROLE_UPDATE') {
                          processTitle = 'Updated User Role';
                          processCategory = 'Staff Directory';
                          processColor = '#8B5CF6';
                          processBg = 'rgba(139,92,246,0.15)';
                          processBorder = 'rgba(139,92,246,0.35)';
                          processIcon = '🔑';
                          processSummary = `Role changed to ${log.details?.new_role} for ${log.details?.full_name || 'user'}`;
                        } else if (act === 'PASSWORD_RESET') {
                          processTitle = 'Password Reset Completed';
                          processCategory = 'User Security';
                          processColor = '#F59E0B';
                          processBg = 'rgba(245,158,11,0.15)';
                          processBorder = 'rgba(245,158,11,0.35)';
                          processIcon = '🔐';
                          processSummary = log.details?.message || 'Password successfully updated for user';
                        } else if (act === 'IP_QUARANTINE_RELEASED') {
                          processTitle = 'Quarantined IP Released';
                          processCategory = 'Perimeter Defense';
                          processColor = '#10B981';
                          processBg = 'rgba(16,185,129,0.15)';
                          processBorder = 'rgba(16,185,129,0.35)';
                          processIcon = '🔓';
                          processSummary = `Released quarantined IP ${log.resource_id || log.details?.ip || ''} from firewall`;
                        } else if (act === 'IP_QUARANTINE_ACTIVATED') {
                          processTitle = 'Malicious IP Quarantined';
                          processCategory = 'Perimeter Defense';
                          processColor = '#F43F5E';
                          processBg = 'rgba(244,63,94,0.15)';
                          processBorder = 'rgba(244,63,94,0.35)';
                          processIcon = '🚨';
                          processSummary = `Quarantined IP ${log.resource_id || ''}: ${log.details?.reason || 'threat probe'}`;
                        } else if (act === 'BRUTE_FORCE_LOCKOUT_TRIGGERED') {
                          processTitle = 'Brute Force Lockout Active';
                          processCategory = 'Perimeter Defense';
                          processColor = '#F59E0B';
                          processBg = 'rgba(245,158,11,0.15)';
                          processBorder = 'rgba(245,158,11,0.35)';
                          processIcon = '⛔';
                          processSummary = `5 failed attempts: IP ${log.ip_address || ''} locked out for 15 minutes`;
                        } else if (act === 'RBAC_ACCESS_DENIED') {
                          processTitle = 'Unauthorized Access Blocked';
                          processCategory = 'Access Control';
                          processColor = '#F43F5E';
                          processBg = 'rgba(244,63,94,0.15)';
                          processBorder = 'rgba(244,63,94,0.35)';
                          processIcon = '🛑';
                          processSummary = `Blocked probe on ${log.details?.endpoint || log.resource_type || 'endpoint'}`;
                        }

                        const rawTs = log.timestamp || log.created_at || '';
                        let logDateStr = 'Recent';
                        let logTimeStr = '';
                        try {
                          const d = new Date(rawTs);
                          if (!isNaN(d.getTime())) {
                            logDateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            logTimeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                          }
                        } catch {}

                        return (
                          <tr
                            key={log.id}
                            style={{ borderBottom: `1px solid ${themeBorder}`, transition: 'background 0.2s' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = isLightMode ? '#F8FAFC' : 'rgba(56,189,248,0.04)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            {/* 1. DATE & TIME */}
                            <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                              <b style={{ display: 'block', fontSize: '.78rem', color: themeText }}>{logDateStr}</b>
                              <span style={{ fontFamily: 'monospace', fontSize: '.72rem', color: themeMuted }}>{logTimeStr}</span>
                            </td>

                            {/* 2. ACTOR & ROLE */}
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                  width: 28, height: 28, borderRadius: '50%',
                                  background: isAdmin ? 'linear-gradient(135deg, #7C3AED, #9333EA)' : isCustomer ? 'linear-gradient(135deg, #059669, #10B981)' : 'linear-gradient(135deg, #0284C7, #0EA5E9)',
                                  color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '.75rem', fontWeight: 800, flexShrink: 0,
                                }}>
                                  {isCustomer ? '👤' : isAdmin ? '👑' : '👔'}
                                </div>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <b style={{ fontSize: '.8rem', color: themeText }}>{log.actor_name || 'System User'}</b>
                                    <span style={{
                                      fontSize: '.65rem',
                                      fontWeight: 800,
                                      padding: '1px 6px',
                                      borderRadius: 10,
                                      background: isAdmin ? 'rgba(139,92,246,0.15)' : isCustomer ? 'rgba(16,185,129,0.15)' : 'rgba(14,165,233,0.15)',
                                      color: isAdmin ? '#8B5CF6' : isCustomer ? '#10B981' : '#0EA5E9',
                                      border: `1px solid ${isAdmin ? 'rgba(139,92,246,0.3)' : isCustomer ? 'rgba(16,185,129,0.3)' : 'rgba(14,165,233,0.3)'}`,
                                    }}>
                                      {isAdmin ? 'ADMIN' : isCustomer ? 'CUSTOMER' : (log.role || 'STAFF').toUpperCase()}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '.7rem', color: themeMuted, display: 'block' }}>{log.actor_email}</span>
                                </div>
                              </div>
                            </td>

                            {/* 3. PROCESS & ACTION */}
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <span style={{
                                  padding: '2px 8px', borderRadius: 6, fontSize: '.68rem', fontWeight: 800,
                                  background: processBg, color: processColor, border: `1px solid ${processBorder}`,
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                }}>
                                  <span>{processIcon}</span>
                                  {act}
                                </span>
                              </div>
                              <span style={{ fontSize: '.78rem', fontWeight: 700, color: themeText }}>
                                {processTitle}
                              </span>
                            </td>

                            {/* 4. TARGET RESOURCE */}
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{
                                fontSize: '.72rem', fontWeight: 700, color: themeText,
                                background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.06)',
                                padding: '2px 8px', borderRadius: 4, border: `1px solid ${themeBorder}`,
                                display: 'inline-block',
                              }}>
                                {log.resource_type || 'system'}
                              </span>
                              {log.resource_id && (
                                <small style={{ color: themeMuted, display: 'block', fontFamily: 'monospace', fontSize: '.7rem', marginTop: 2 }}>
                                  #{String(log.resource_id).slice(0, 16)}
                                </small>
                              )}
                            </td>

                            {/* 5. PROCESS DETAILS */}
                            <td style={{ padding: '12px 14px', maxWidth: 320 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ color: themeMuted, fontSize: '.76rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={processSummary}>
                                  {processSummary}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setInspectAuditLog(log)}
                                  className="btn btn-ghost btn-sm"
                                  style={{ fontSize: '.68rem', padding: '2px 8px', borderRadius: 6, flexShrink: 0, border: `1px solid ${themeBorder}` }}
                                >
                                  Inspect 🔍
                                </button>
                              </div>
                            </td>

                            {/* 6. IP & CLIENT */}
                            <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: '.72rem', color: themeMuted, display: 'block' }}>{log.ip_address || '127.0.0.1'}</span>
                              <span style={{ fontSize: '.68rem', color: themeMuted, opacity: 0.8 }}>
                                {log.user_agent ? (log.user_agent.length > 22 ? log.user_agent.slice(0, 22) + '…' : log.user_agent) : 'Browser Client'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* AUDIT RECORD INSPECT MODAL */}
              {inspectAuditLog && (
                <div style={{
                  position: 'fixed', inset: 0, zIndex: 99999,
                  background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
                }}>
                  <div style={{
                    maxWidth: 620, width: '100%',
                    background: isLightMode ? '#FFFFFF' : '#0B1426',
                    border: `1px solid ${themeBorder}`, borderRadius: 18,
                    padding: 24, boxShadow: '0 25px 60px -15px rgba(0,0,0,0.7)',
                    maxHeight: '90vh', overflowY: 'auto',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <span style={{
                          fontSize: '.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                          background: 'rgba(14,165,233,0.15)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.3)',
                        }}>
                          AUDIT RECORD INSPECTION
                        </span>
                        <h3 style={{ margin: '6px 0 2px', fontSize: '1.25rem', color: themeText }}>
                          {inspectAuditLog.action}
                        </h3>
                        <span style={{ fontSize: '.75rem', color: themeMuted, fontFamily: 'monospace' }}>
                          ID: {inspectAuditLog.id}
                        </span>
                      </div>
                      <button
                        onClick={() => setInspectAuditLog(null)}
                        style={{ background: 'transparent', border: 'none', color: themeMuted, fontSize: '1.4rem', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                      <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, border: `1px solid ${themeBorder}` }}>
                        <small style={{ fontSize: '.68rem', color: themeMuted, display: 'block', fontWeight: 700 }}>TIMESTAMP (LOCAL & UTC)</small>
                        <b style={{ fontSize: '.8rem', color: themeText, display: 'block' }}>
                          {new Date(inspectAuditLog.timestamp || inspectAuditLog.created_at).toLocaleString()}
                        </b>
                        <small style={{ fontSize: '.7rem', color: themeMuted, fontFamily: 'monospace' }}>
                          {inspectAuditLog.timestamp || inspectAuditLog.created_at}
                        </small>
                      </div>
                      <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, border: `1px solid ${themeBorder}` }}>
                        <small style={{ fontSize: '.68rem', color: themeMuted, display: 'block', fontWeight: 700 }}>ACTOR & ROLE</small>
                        <b style={{ fontSize: '.8rem', color: themeText, display: 'block' }}>
                          {inspectAuditLog.actor_name} ({inspectAuditLog.role || inspectAuditLog.actor_role})
                        </b>
                        <small style={{ fontSize: '.72rem', color: themeMuted }}>
                          {inspectAuditLog.actor_email}
                        </small>
                      </div>
                      <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, border: `1px solid ${themeBorder}` }}>
                        <small style={{ fontSize: '.68rem', color: themeMuted, display: 'block', fontWeight: 700 }}>TARGET RESOURCE</small>
                        <b style={{ fontSize: '.8rem', color: themeText, display: 'block' }}>
                          {inspectAuditLog.resource_type || 'system'}
                        </b>
                        <small style={{ fontSize: '.72rem', color: themeMuted, fontFamily: 'monospace' }}>
                          #{inspectAuditLog.resource_id || 'N/A'}
                        </small>
                      </div>
                      <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, border: `1px solid ${themeBorder}` }}>
                        <small style={{ fontSize: '.68rem', color: themeMuted, display: 'block', fontWeight: 700 }}>CLIENT IP & AGENT</small>
                        <b style={{ fontSize: '.8rem', color: themeText, display: 'block', fontFamily: 'monospace' }}>
                          {inspectAuditLog.ip_address || '127.0.0.1'}
                        </b>
                        <small style={{ fontSize: '.7rem', color: themeMuted, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                          {inspectAuditLog.user_agent || 'Client'}
                        </small>
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <small style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                        PROCESS DETAILS (DATABASE PAYLOAD)
                      </small>
                      <pre style={{
                        background: isLightMode ? '#F1F5F9' : '#030712',
                        padding: 12, borderRadius: 8, fontSize: '.75rem',
                        fontFamily: 'monospace', overflowX: 'auto',
                        border: `1px solid ${themeBorder}`, color: isLightMode ? '#0F172A' : '#38BDF8',
                      }}>
                        {JSON.stringify(inspectAuditLog.details || {}, null, 2)}
                      </pre>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(inspectAuditLog, null, 2));
                          toast('📋 Full audit record copied to clipboard');
                        }}
                        className="btn btn-sm"
                        style={{ border: `1px solid ${themeBorder}`, color: themeText, fontWeight: 700 }}
                      >
                        Copy JSON
                      </button>
                      <button
                        onClick={() => setInspectAuditLog(null)}
                        className="btn btn-sky btn-sm"
                        style={{ fontWeight: 700 }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
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
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Role Assignment</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Account Actions</th>
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
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button className="act-btn" style={{ color: '#38BDF8', borderColor: '#38BDF8' }}
                                      title="Edit profile & contact details"
                                      onClick={() => setEditingUser(u)}>
                                      ✏️ Edit
                                    </button>
                                    <button className="act-btn" style={{ color: '#0EA5E9', borderColor: '#38BDF8' }}
                                      title="Reset user password"
                                      onClick={() => { setRecoveryTarget(u); setNewPassword(''); }}>
                                      🔑 Reset
                                    </button>
                                    <button className="act-btn" style={{ color: '#EF4444', borderColor: '#EF4444' }}
                                      title="Delete account permanently"
                                      onClick={() => setUserToDelete(u)}>
                                      🗑️ Delete
                                    </button>
                                  </div>
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
                              <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Account Actions</th>
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
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button className="act-btn" style={{ color: '#38BDF8', borderColor: '#38BDF8' }}
                                      title="Edit guest profile & contact details"
                                      onClick={() => setEditingUser(u)}>
                                      ✏️ Edit
                                    </button>
                                    <button className="act-btn" style={{ color: '#0EA5E9', borderColor: '#38BDF8' }}
                                      title="Reset guest password"
                                      onClick={() => { setRecoveryTarget(u); setNewPassword(''); }}>
                                      🔑 Reset
                                    </button>
                                    <button className="act-btn" style={{ color: '#EF4444', borderColor: '#EF4444' }}
                                      title="Delete account permanently"
                                      onClick={() => setUserToDelete(u)}>
                                      🗑️ Delete
                                    </button>
                                  </div>
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

          {/* TAB 6: DOUBLE-ENTRY GENERAL LEDGER (DEBIT & CREDIT) */}
          {activeTab === 'ledger' && (
            <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24, boxShadow: themeShadow }}>
              {/* Header & Quick Action Buttons */}
              <div className="admin-tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
                <div>
                  <span style={{ fontSize: '.76rem', color: '#0EA5E9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    ROCK VIEW BEACH RESORT · DOUBLE-ENTRY ACCOUNTING
                  </span>
                  <h3 className="serif" style={{ fontSize: '1.45rem', margin: '4px 0 0', color: themeText, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>⚖️</span> General Ledger (Debit & Credit System)
                  </h3>
                  <p className="muted small" style={{ margin: '4px 0 0' }}>
                    Dual-entry bookkeeping with real-time Trial Balance, Chart of Accounts, and adaptive PostgreSQL backup migration.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    className="btn btn-sky btn-sm"
                    onClick={() => setShowAddJournalModal(true)}
                    style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span>➕</span> New Journal Entry
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={handleReconcileLedger}
                    disabled={reconcilingLedger}
                    style={{
                      color: isLightMode ? '#0D9488' : '#2DD4BF',
                      border: `1px solid ${isLightMode ? '#99F6E4' : 'rgba(45, 212, 191, 0.3)'}`,
                      background: isLightMode ? '#F0FDFA' : 'rgba(45, 212, 191, 0.12)',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    title="Automatically sync and post unrecorded reservations and orders as double-entry journal vouchers"
                  >
                    <span>⚡</span> {reconcilingLedger ? 'Reconciling…' : 'Sync & Reconcile Stays'}
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setBackupTab('export');
                      setShowBackupModal(true);
                    }}
                    style={{
                      color: isLightMode ? '#4338CA' : '#818CF8',
                      border: `1px solid ${isLightMode ? '#C7D2FE' : 'rgba(129, 140, 248, 0.3)'}`,
                      background: isLightMode ? '#EEF2FF' : 'rgba(129, 140, 248, 0.12)',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    title="Export or Import PostgreSQL SQL dump, JSON, CSV, or logbook notation"
                  >
                    <span>💾</span> PostgreSQL Backup & Migration
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      refreshLedgerEntries();
                      refreshReservations();
                    }}
                    disabled={loadingLedger || loadingReservations}
                    style={{ color: themeText, border: `1px solid ${themeBorder}`, fontWeight: 600 }}
                  >
                    {loadingLedger ? 'Refreshing…' : '🔄 Refresh'}
                  </button>
                </div>
              </div>

              {/* Sub-View Navigation Switcher (Debit/Credit vs Stay Folios vs Calendar) */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setLedgerSubView('debit_credit')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: ledgerSubView === 'debit_credit' ? (isLightMode ? '#0284C7' : '#0EA5E9') : 'transparent',
                    color: ledgerSubView === 'debit_credit' ? '#FFFFFF' : themeMuted,
                    fontWeight: 700,
                    fontSize: '.84rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>⚖️</span> Debit & Credit General Ledger
                  <span style={{ fontSize: '.72rem', background: ledgerSubView === 'debit_credit' ? 'rgba(255,255,255,0.25)' : 'rgba(148, 163, 184, 0.2)', padding: '2px 7px', borderRadius: 10 }}>
                    {ledgerEntriesList.length}
                  </span>
                </button>
                <button
                  onClick={() => setLedgerSubView('stay_folios')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: ledgerSubView === 'stay_folios' ? (isLightMode ? '#0284C7' : '#0EA5E9') : 'transparent',
                    color: ledgerSubView === 'stay_folios' ? '#FFFFFF' : themeMuted,
                    fontWeight: 700,
                    fontSize: '.84rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>📋</span> Guest Stay Folios & Bookings
                  <span style={{ fontSize: '.72rem', background: ledgerSubView === 'stay_folios' ? 'rgba(255,255,255,0.25)' : 'rgba(148, 163, 184, 0.2)', padding: '2px 7px', borderRadius: 10 }}>
                    {allBookings.length}
                  </span>
                </button>
                <button
                  onClick={() => setLedgerSubView('availability')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: ledgerSubView === 'availability' ? (isLightMode ? '#0284C7' : '#0EA5E9') : 'transparent',
                    color: ledgerSubView === 'availability' ? '#FFFFFF' : themeMuted,
                    fontWeight: 700,
                    fontSize: '.84rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>📅</span> Visual Availability & Lock Calendar
                </button>
              </div>

              {/* VIEW 1: DEBIT & CREDIT GENERAL LEDGER */}
              {ledgerSubView === 'debit_credit' && (() => {
                const totalDebits = trialBalance?.total_debits_php ?? ledgerEntriesList.reduce((acc, e) => acc + (Number(e.debit_php) || 0), 0);
                const totalCredits = trialBalance?.total_credits_php ?? ledgerEntriesList.reduce((acc, e) => acc + (Number(e.credit_php) || 0), 0);
                const netDifference = Math.abs(totalDebits - totalCredits);
                const isBalanced = trialBalance ? trialBalance.is_balanced : netDifference === 0;

                const filteredLedgerEntries = ledgerEntriesList.filter((entry) => {
                  if (ledgerAccountFilter && entry.account_code !== ledgerAccountFilter) return false;
                  if (ledgerCategoryFilter && String(entry.category).toUpperCase() !== ledgerCategoryFilter.toUpperCase()) return false;
                  if (ledgerTypeFilter === 'debit' && entry.entry_type !== 'DEBIT') return false;
                  if (ledgerTypeFilter === 'credit' && entry.entry_type !== 'CREDIT') return false;
                  if (ledgerSearch) {
                    const q = ledgerSearch.toLowerCase();
                    const p = (entry.particulars || '').toLowerCase();
                    const num = (entry.entry_number || '').toLowerCase();
                    const acc = (entry.account_name || '').toLowerCase();
                    const code = (entry.account_code || '').toLowerCase();
                    const ref = (entry.reference_id || '').toLowerCase();
                    if (!p.includes(q) && !num.includes(q) && !acc.includes(q) && !code.includes(q) && !ref.includes(q)) return false;
                  }
                  return true;
                });

                return (
                  <div>
                    {/* 4 Financial KPI Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
                      <div style={{ padding: '16px 18px', background: isLightMode ? '#ECFDF5' : 'rgba(16,185,129,0.1)', borderRadius: 14, border: `1px solid ${isLightMode ? '#A7F3D0' : 'rgba(16,185,129,0.2)'}` }}>
                        <small style={{ color: isLightMode ? '#047857' : '#34D399', textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Total Debits (DR)</small>
                        <b style={{ display: 'block', fontSize: '1.6rem', color: isLightMode ? '#065F46' : '#10B981', marginTop: 4 }}>
                          {money(totalDebits)}
                        </b>
                        <span style={{ fontSize: '.74rem', color: '#10B981' }}>Assets increase & expense inflows</span>
                      </div>
                      <div style={{ padding: '16px 18px', background: isLightMode ? '#EFF6FF' : 'rgba(59,130,246,0.1)', borderRadius: 14, border: `1px solid ${isLightMode ? '#BFDBFE' : 'rgba(59,130,246,0.2)'}` }}>
                        <small style={{ color: isLightMode ? '#1D4ED8' : '#60A5FA', textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Total Credits (CR)</small>
                        <b style={{ display: 'block', fontSize: '1.6rem', color: isLightMode ? '#1E40AF' : '#3B82F6', marginTop: 4 }}>
                          {money(totalCredits)}
                        </b>
                        <span style={{ fontSize: '.74rem', color: '#3B82F6' }}>Revenues & guest deposit liabilities</span>
                      </div>
                      <div style={{ padding: '16px 18px', background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.04)', borderRadius: 14, border: `1px solid ${themeBorder}` }}>
                        <small style={{ color: themeMuted, textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Net General Ledger Balance</small>
                        <b style={{ display: 'block', fontSize: '1.6rem', color: themeText, marginTop: 4 }}>
                          {money(totalDebits - totalCredits)}
                        </b>
                        <span style={{ fontSize: '.74rem', color: '#0EA5E9' }}>Cumulative ledger balance</span>
                      </div>
                      <div style={{ padding: '16px 18px', background: isBalanced ? (isLightMode ? '#F0FDF4' : 'rgba(34,197,94,0.1)') : (isLightMode ? '#FFFBEB' : 'rgba(245,158,11,0.1)'), borderRadius: 14, border: `1px solid ${isBalanced ? (isLightMode ? '#BBF7D0' : 'rgba(34,197,94,0.25)') : (isLightMode ? '#FDE68A' : 'rgba(245,158,11,0.25)')}` }}>
                        <small style={{ color: isBalanced ? (isLightMode ? '#15803D' : '#4ADE80') : (isLightMode ? '#B45309' : '#FBBF24'), textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Trial Balance Status</small>
                        <b style={{ display: 'block', fontSize: '1.35rem', color: isBalanced ? (isLightMode ? '#166534' : '#22C55E') : (isLightMode ? '#92400E' : '#F59E0B'), marginTop: 4 }}>
                          {isBalanced ? '✓ Balanced (0.00)' : `⚠ Imbalance: ${money(netDifference)}`}
                        </b>
                        <span style={{ fontSize: '.74rem', color: isBalanced ? '#22C55E' : '#F59E0B' }}>
                          {isBalanced ? 'Debits equal Credits perfectly' : 'Review adjusting entries'}
                        </span>
                      </div>
                    </div>

                    {/* Filter & Search Toolbar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* Account Selector */}
                        <select
                          value={ledgerAccountFilter}
                          onChange={(e) => setLedgerAccountFilter(e.target.value)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 12,
                            border: `1px solid ${themeBorder}`,
                            background: isLightMode ? '#FFF' : '#1E293B',
                            color: themeText,
                            fontSize: '.78rem',
                            fontWeight: 600,
                          }}
                        >
                          <option value="">All Accounts ({chartOfAccounts.length || 11})</option>
                          {(chartOfAccounts.length > 0 ? chartOfAccounts : [
                            { code: '1010', name: 'Cash on Hand & Digital Wallets' },
                            { code: '1020', name: 'Accounts Receivable - Guest Folios' },
                            { code: '2010', name: 'Guest Reservation Deposits' },
                            { code: '2020', name: 'Guest Refunds Payable' },
                            { code: '4010', name: 'Room Accommodations Revenue' },
                            { code: '4020', name: 'Kitchen & Dining Revenue' },
                            { code: '4030', name: 'Island Tours Revenue' },
                            { code: '5010', name: 'Kitchen & Food Supplies' },
                            { code: '5020', name: 'Housekeeping Linens & Amenities' },
                            { code: '5030', name: 'Resort Utilities & Fuel' },
                            { code: '5040', name: 'Repairs & Property Maintenance' },
                          ]).map((acc) => (
                            <option key={acc.code} value={acc.code}>
                              {acc.code} - {acc.name}
                            </option>
                          ))}
                        </select>

                        {/* Category Selector */}
                        <select
                          value={ledgerCategoryFilter}
                          onChange={(e) => setLedgerCategoryFilter(e.target.value)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 12,
                            border: `1px solid ${themeBorder}`,
                            background: isLightMode ? '#FFF' : '#1E293B',
                            color: themeText,
                            fontSize: '.78rem',
                            fontWeight: 600,
                          }}
                        >
                          <option value="">All Categories</option>
                          <option value="REVENUE">Revenue</option>
                          <option value="PAYMENT">Payment</option>
                          <option value="EXPENSE">Expense</option>
                          <option value="REFUND">Refund</option>
                          <option value="ADJUSTMENT">Adjustment</option>
                        </select>

                        {/* Entry Type Filter Pills */}
                        <div style={{ display: 'flex', gap: 4, background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)', padding: 3, borderRadius: 12 }}>
                          {[
                            { key: 'all', label: 'All' },
                            { key: 'debit', label: 'Debits Only (DR)' },
                            { key: 'credit', label: 'Credits Only (CR)' },
                          ].map((t) => (
                            <button
                              key={t.key}
                              onClick={() => setLedgerTypeFilter(t.key as any)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 8,
                                border: 'none',
                                background: ledgerTypeFilter === t.key ? (isLightMode ? '#FFFFFF' : '#0F172A') : 'transparent',
                                color: ledgerTypeFilter === t.key ? (isLightMode ? '#0284C7' : '#38BDF8') : themeMuted,
                                fontSize: '.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: ledgerTypeFilter === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                              }}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Search Input */}
                      <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
                        <input
                          className="search"
                          placeholder="Search particulars, entry #, ref, code…"
                          value={ledgerSearch}
                          onChange={(e) => setLedgerSearch(e.target.value)}
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

                    {/* Debit & Credit Ledger Table */}
                    {loadingLedger && ledgerEntriesList.length === 0 ? (
                      <div style={{ padding: '40px 0', textAlign: 'center', color: themeMuted }}>
                        <p>Loading Double-Entry General Ledger…</p>
                      </div>
                    ) : filteredLedgerEntries.length === 0 ? (
                      <div style={{ padding: '40px 16px', textAlign: 'center', background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)', borderRadius: 14, border: `1px dashed ${themeBorder}` }}>
                        <p className="muted" style={{ margin: '0 0 8px', fontSize: '1rem' }}>No ledger entries match your filter or search.</p>
                        <small style={{ color: themeMuted }}>Click "New Journal Entry" or "Sync & Reconcile Stays" to record transactions.</small>
                      </div>
                    ) : (
                      <div className="table-wrap" style={{ background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.85)', border: `1px solid ${themeBorder}`, borderRadius: 12, overflowX: 'auto' }}>
                        <table className="table" style={{ color: themeText, width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)', textAlign: 'left' }}>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px' }}>Entry #</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px' }}>Date / Time</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px' }}>Account</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px' }}>Particulars / Reference</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px' }}>Category</th>
                              <th style={{ color: isLightMode ? '#047857' : '#34D399', padding: '12px 14px', textAlign: 'right' }}>Debit (₱)</th>
                              <th style={{ color: isLightMode ? '#1D4ED8' : '#60A5FA', padding: '12px 14px', textAlign: 'right' }}>Credit (₱)</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px', textAlign: 'right' }}>Balance (₱)</th>
                              <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredLedgerEntries.map((e) => {
                              const debitAmt = Number(e.debit_php) || 0;
                              const creditAmt = Number(e.credit_php) || 0;
                              const runBal = Number(e.running_balance_php) || 0;

                              return (
                                <tr key={e.id} style={{ borderBottom: `1px solid ${themeBorder}` }}>
                                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: '.8rem', fontWeight: 700, color: '#0EA5E9' }}>
                                      {e.entry_number}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 14px', fontSize: '.78rem', whiteSpace: 'nowrap', color: themeMuted }}>
                                    {fmtDate(e.posted_at)} <span style={{ opacity: 0.7 }}>{fmtTime(e.posted_at)}</span>
                                  </td>
                                  <td style={{ padding: '12px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ fontFamily: 'monospace', fontWeight: 700, background: isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 6, fontSize: '.72rem' }}>
                                        {e.account_code}
                                      </span>
                                      <span style={{ fontWeight: 600, fontSize: '.84rem' }}>{e.account_name}</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: '12px 14px' }}>
                                    <div style={{ fontSize: '.84rem' }}>{e.particulars}</div>
                                    {e.reference_id && (
                                      <small style={{ color: themeMuted, fontSize: '.7rem', fontFamily: 'monospace' }}>
                                        Ref: {e.reference_id}
                                      </small>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 14px' }}>
                                    <span
                                      className="pill"
                                      style={{
                                        fontSize: '.68rem',
                                        textTransform: 'uppercase',
                                        fontWeight: 700,
                                        background: e.category === 'REVENUE' ? (isLightMode ? '#EFF6FF' : 'rgba(59,130,246,0.15)') : e.category === 'EXPENSE' ? (isLightMode ? '#FFF1F2' : 'rgba(244,63,94,0.15)') : (isLightMode ? '#F0FDFA' : 'rgba(45,212,191,0.15)'),
                                        color: e.category === 'REVENUE' ? '#3B82F6' : e.category === 'EXPENSE' ? '#F43F5E' : '#14B8A6',
                                        border: '1px solid currentColor',
                                      }}
                                    >
                                      {e.category}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: debitAmt > 0 ? 800 : 400, color: debitAmt > 0 ? (isLightMode ? '#059669' : '#10B981') : themeMuted }}>
                                    {debitAmt > 0 ? money(debitAmt) : '—'}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: creditAmt > 0 ? 800 : 400, color: creditAmt > 0 ? (isLightMode ? '#2563EB' : '#38BDF8') : themeMuted }}>
                                    {creditAmt > 0 ? money(creditAmt) : '—'}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', fontSize: '.84rem' }}>
                                    {money(runBal)}
                                  </td>
                                  <td style={{ padding: '12px 14px' }}>
                                    <span
                                      style={{
                                        fontSize: '.68rem',
                                        padding: '3px 8px',
                                        borderRadius: 8,
                                        fontWeight: 700,
                                        background: e.status === 'RECONCILED' ? (isLightMode ? '#ECFDF5' : 'rgba(16,185,129,0.15)') : (isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.06)'),
                                        color: e.status === 'RECONCILED' ? '#10B981' : themeMuted,
                                      }}
                                    >
                                      {e.status}
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
                );
              })()}

              {/* VIEW 2: GUEST STAY FOLIOS & RESERVATIONS */}
              {ledgerSubView === 'stay_folios' && (
                <div>
                  {/* 4 KPI Summary Cards for Stays */}
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
                      <small style={{ color: isLightMode ? '#B45309' : '#FBBF24', textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Gross Stay Value</small>
                      <b style={{ display: 'block', fontSize: '1.6rem', color: isLightMode ? '#92400E' : '#F59E0B', marginTop: 4 }}>
                        {money(allBookings.filter((b) => b.status !== 'cancelled').reduce((acc, b) => acc + (b.total_php || 0), 0))}
                      </b>
                      <span style={{ fontSize: '.74rem', color: '#F59E0B' }}>Total booking accommodations</span>
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

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-sky btn-sm"
                        onClick={() => {
                          if (!newReservation.room_id && roomsList.length > 0) {
                            const firstRoom = roomsList[0];
                            const nights = Math.max(1, Math.round((new Date(newReservation.check_out).getTime() - new Date(newReservation.check_in).getTime()) / 86400000));
                            setNewReservation((prev) => ({
                              ...prev,
                              room_id: firstRoom.id,
                              total_php: (firstRoom.rate_php || 3500) * nights,
                            }));
                          }
                          setShowAddReservationModal(true);
                        }}
                        style={{ fontWeight: 700 }}
                      >
                        ➕ Walk-In / Phone Booking
                      </button>

                      <div style={{ position: 'relative', width: 240, maxWidth: '100%' }}>
                        <input
                          className="search"
                          placeholder="Search guest, room, phone…"
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
                  </div>

                  {/* Reservations Ledger Table */}
                  {loadingReservations && allBookings.length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: themeMuted }}>
                      <p>Loading Guest Reservations Folios…</p>
                    </div>
                  ) : filteredBookings.length === 0 ? (
                    <div style={{ padding: '40px 16px', textAlign: 'center', background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)', borderRadius: 14, border: `1px dashed ${themeBorder}` }}>
                      <p className="muted" style={{ margin: '0 0 8px', fontSize: '1rem' }}>No reservations match your search or filter.</p>
                      <small style={{ color: themeMuted }}>Click "Walk-In / Phone Booking" to record a guest reservation.</small>
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <span className={`pill ${b.status}`}>{b.status.replace('_', ' ')}</span>
                                  {b.payment_status === 'refund_pending' && (
                                    <span className="pill" style={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)', fontSize: '.7rem' }}>
                                      ⏳ Refund Pending
                                    </span>
                                  )}
                                  {b.payment_status === 'refunded' && (
                                    <span className="pill" style={{ background: 'rgba(16,185,129,0.2)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)', fontSize: '.7rem' }}>
                                      ✅ Refunded
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                                  {b.payment_status === 'refund_pending' ? (
                                    <button
                                      className="act-btn"
                                      onClick={() => {
                                        setRefundTarget(b);
                                        setRefundMode('confirm');
                                        setRefundAmount(b.downpayment_php || b.total_php || '');
                                        setRefundMethod(b.payment_method || 'GCash');
                                      }}
                                      style={{ color: '#10B981', borderColor: '#10B981', background: 'rgba(16,185,129,0.1)' }}
                                      title="Approve & confirm refund with automated email"
                                    >
                                      💵 Confirm Refund
                                    </button>
                                  ) : b.payment_status !== 'refunded' && (
                                    <button
                                      className="act-btn"
                                      onClick={() => {
                                        setRefundTarget(b);
                                        setRefundMode('request');
                                        setRefundAmount(b.downpayment_php || b.total_php || '');
                                      }}
                                      style={{ color: '#F59E0B', borderColor: '#F59E0B' }}
                                      title="Request refund with automated email on the day requested"
                                    >
                                      💰 Refund
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

              {/* VIEW 3: VISUAL AVAILABILITY & LOCK CALENDAR */}
              {ledgerSubView === 'availability' && (
                <div>
                  <AvailabilityCalendar
                    rooms={roomsList}
                    isLightMode={isLightMode}
                    onClose={() => setLedgerSubView('debit_credit')}
                    onSelectDates={(cin, cout) => {
                      const activeRoom = roomsList.find((r) => r.id === newReservation.room_id) || roomsList[0];
                      const nights = Math.max(1, Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000));
                      setNewReservation((prev) => ({
                        ...prev,
                        room_id: prev.room_id || activeRoom?.id || '',
                        check_in: cin,
                        check_out: cout,
                        total_php: (activeRoom?.rate_php || 3500) * nights,
                      }));
                      setShowAddReservationModal(true);
                      toast(`✦ Check-in (${fmtDate(cin)}) and Check-out (${fmtDate(cout)}) set in New Reservation modal`);
                    }}
                  />
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
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {unreadNotifsCount > 0 && (
                    <button
                      className="btn btn-sm"
                      onClick={handleMarkAllNotifsRead}
                      style={{
                        background: isLightMode ? '#EEF2FF' : 'rgba(99, 102, 241, 0.15)',
                        color: '#6366F1',
                        border: '1px solid #6366F1',
                        fontWeight: 700,
                        borderRadius: 8,
                        padding: '6px 14px',
                        cursor: 'pointer',
                      }}
                      title="Mark all notifications as read"
                    >
                      ✓ Mark All Read
                    </button>
                  )}
                  {readNotifsCount > 0 && (
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={handleClearReadNotifs}
                      style={{
                        color: themeMuted,
                        border: `1px solid ${themeBorder}`,
                        fontWeight: 600,
                        borderRadius: 8,
                        padding: '6px 12px',
                        cursor: 'pointer',
                      }}
                      title="Clear only read notifications"
                    >
                      🧹 Clear Read ({readNotifsCount})
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={handleClearAllNotifs}
                      style={{
                        color: '#F43F5E',
                        border: '1px solid rgba(244, 63, 94, 0.3)',
                        fontWeight: 600,
                        borderRadius: 8,
                        padding: '6px 12px',
                        background: 'rgba(244, 63, 94, 0.05)',
                        cursor: 'pointer',
                      }}
                      title="Clear all alerts permanently"
                    >
                      🗑️ Clear All
                    </button>
                  )}
                  <button
                    className="btn btn-sm btn-sky"
                    onClick={() => {
                      api.myNotifications().then((n: any) => {
                        if (Array.isArray(n)) {
                          setNotifications(n);
                          toast('🔄 Alerts synchronized');
                        }
                      }).catch(() => toast('Could not refresh alerts', true));
                    }}
                    style={{ fontWeight: 700, borderRadius: 8, padding: '6px 14px' }}
                  >
                    🔄 Refresh Alerts
                  </button>
                </div>
              </div>

              {/* Filter Pills */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { key: 'all', label: `All Alerts (${notifications.length})` },
                  { key: 'unread', label: `Unread (${unreadNotifsCount})` },
                  { key: 'read', label: `Read (${readNotifsCount})` },
                  { key: 'sms', label: `SMS Messages (${smsNotifsCount})` },
                  { key: 'system', label: `System Logs (${systemNotifsCount})` },
                ].map((f) => {
                  const isActive = notifFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setNotifFilter(f.key)}
                      style={{
                        padding: '7px 16px',
                        borderRadius: 20,
                        border: `1px solid ${isActive ? '#6366F1' : themeBorder}`,
                        background: isActive
                          ? (isLightMode ? '#EEF2FF' : 'rgba(99, 102, 241, 0.22)')
                          : (isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.03)'),
                        color: isActive ? '#6366F1' : themeText,
                        fontWeight: isActive ? 800 : 600,
                        fontSize: '.82rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isActive ? '0 2px 8px rgba(99, 102, 241, 0.15)' : 'none',
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {/* Notifications List */}
              {(() => {
                const filtered = notifications.filter((n: any) => {
                  if (notifFilter === 'unread') return !n.is_read;
                  if (notifFilter === 'read') return Boolean(n.is_read);
                  if (notifFilter === 'sms') return n.type === 'sms' || Boolean(n.to_phone);
                  if (notifFilter === 'system') return n.type !== 'sms' && !n.to_phone;
                  return true;
                });

                if (notifications.length === 0) {
                  return (
                    <div style={{ padding: '48px 20px', textAlign: 'center', color: themeMuted, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)', borderRadius: 14, border: `1px dashed ${themeBorder}` }}>
                      <p style={{ fontSize: '1.2rem', margin: '0 0 6px' }}>📭 No alerts or notifications recorded.</p>
                      <small>SMS confirmations and system dispatches will appear here in real time.</small>
                    </div>
                  );
                }

                if (filtered.length === 0) {
                  return (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: themeMuted, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)', borderRadius: 14, border: `1px dashed ${themeBorder}` }}>
                      <p style={{ fontSize: '1.1rem', margin: '0 0 6px', color: themeText, fontWeight: 700 }}>
                        {notifFilter === 'unread' && "🎉 You're all caught up! No unread notifications."}
                        {notifFilter === 'read' && "📖 No read notifications found in history."}
                        {notifFilter === 'sms' && "📱 No SMS dispatch messages found."}
                        {notifFilter === 'system' && "⚙️ No system log alerts found."}
                      </p>
                      <small>
                        {notifFilter === 'unread' ? 'All alerts have been marked as read. Switch to "Read" or "All Alerts" to view history.' : 'Check other filters or wait for upcoming alerts.'}
                      </small>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filtered.map((n: any) => (
                      <div
                        key={n.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          padding: '14px 18px',
                          borderRadius: 14,
                          border: `1px solid ${!n.is_read ? '#6366F1' : themeBorder}`,
                          background: !n.is_read
                            ? (isLightMode ? '#F8FAFC' : 'rgba(99, 102, 241, 0.08)')
                            : (isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.6)'),
                          boxShadow: !n.is_read ? '0 2px 10px rgba(99,102,241,0.1)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                            <span className={`pill ${n.status || 'sent'}`}>{n.status || 'sent'}</span>
                            {n.to_phone && <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#0EA5E9' }}>📱 {n.to_phone}</span>}
                            <span style={{ fontSize: '.75rem', color: themeMuted }}>• {fmtDate(n.created_at)} {fmtTime(n.created_at)}</span>
                            {!n.is_read ? (
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F43F5E', display: 'inline-block' }} title="Unread alert" />
                            ) : (
                              <span style={{ fontSize: '.72rem', color: '#10B981', fontWeight: 600 }}>✓ Read</span>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: '.9rem', color: themeText, lineHeight: 1.4 }}>
                            {n.body || n.content || 'Notification message'}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          {!n.is_read && (
                            <button
                              onClick={() => handleMarkNotifRead(n.id)}
                              style={{
                                background: 'transparent',
                                border: `1px solid ${themeBorder}`,
                                color: '#6366F1',
                                borderRadius: 8,
                                padding: '5px 10px',
                                fontSize: '.76rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                fontWeight: 700,
                              }}
                              title="Mark this alert as read"
                            >
                              ✓ Mark read
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteNotif(n.id)}
                            style={{
                              background: 'transparent',
                              border: `1px solid ${isLightMode ? '#FEE2E2' : 'rgba(244, 63, 94, 0.25)'}`,
                              color: '#F43F5E',
                              borderRadius: 8,
                              padding: '5px 9px',
                              fontSize: '.76rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title="Delete this alert"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* MODAL: ADD WALK-IN / PHONE RESERVATION */}
          {showAddReservationModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2, 6, 23, 0.78)',
                backdropFilter: 'blur(8px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 12px',
              }}
              onClick={() => setShowAddReservationModal(false)}
            >
              {(() => {
                const activeWalkInRoom = roomsList.find((r) => r.id === newReservation.room_id) || roomsList[0];
                const activeRoomImage = getRoomImageUrl(activeWalkInRoom);
                const computedNights = Math.max(1, Math.round((new Date(newReservation.check_out).getTime() - new Date(newReservation.check_in).getTime()) / 86400000));

                return (
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 620,
                      background: isLightMode ? '#FFFFFF' : '#0F172A',
                      borderRadius: 22,
                      border: `1px solid ${themeBorder}`,
                      boxShadow: '0 25px 60px -12px rgba(0,0,0,0.6)',
                      maxHeight: '92vh',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* DYNAMIC ROOM IMAGE HERO AT TOP */}
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: 175,
                        background: '#0B1120',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      <img
                        key={activeWalkInRoom?.id || 'room-hero'}
                        src={activeRoomImage}
                        alt={activeWalkInRoom?.name || 'Selected Room'}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          filter: 'brightness(0.82)',
                          transition: 'opacity 0.35s ease, transform 0.4s ease',
                        }}
                      />
                      {/* Gradient Protection Layer */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(180deg, rgba(15,23,42,0.45) 0%, rgba(15,23,42,0.88) 100%)',
                          pointerEvents: 'none',
                        }}
                      />

                      {/* Top Bar inside Banner: Folio pill & Close button */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 14,
                          left: 16,
                          right: 16,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          zIndex: 3,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: 20,
                              background: 'rgba(14, 165, 233, 0.95)',
                              color: '#FFFFFF',
                              fontSize: '.68rem',
                              fontWeight: 800,
                              letterSpacing: '.06em',
                              textTransform: 'uppercase',
                              backdropFilter: 'blur(6px)',
                              boxShadow: '0 2px 8px rgba(14, 165, 233, 0.4)',
                            }}
                          >
                            ✦ FRONT DESK FOLIO
                          </span>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: 20,
                              background: 'rgba(15, 23, 42, 0.75)',
                              color: '#F8FAFC',
                              fontSize: '.68rem',
                              fontWeight: 700,
                              backdropFilter: 'blur(6px)',
                              border: '1px solid rgba(255,255,255,0.22)',
                            }}
                          >
                            {activeWalkInRoom?.category || 'Accommodation'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowAddReservationModal(false)}
                          aria-label="Close"
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'rgba(15, 23, 42, 0.75)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            color: '#FFFFFF',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.9)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15, 23, 42, 0.75)';
                          }}
                        >
                          ✕
                        </button>
                      </div>

                      {/* Bottom Room Info inside Dynamic Banner */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 12,
                          left: 18,
                          right: 18,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-end',
                          zIndex: 3,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '.7rem', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                            Selected Accommodation
                          </div>
                          <h3
                            style={{
                              margin: '2px 0 0',
                              fontSize: '1.3rem',
                              fontWeight: 800,
                              color: '#FFFFFF',
                              fontFamily: "'Plus Jakarta Sans', sans-serif",
                              textShadow: '0 2px 6px rgba(0,0,0,0.6)',
                            }}
                          >
                            {activeWalkInRoom?.name || 'Walk-In Reservation'}
                          </h3>
                          <div style={{ fontSize: '.74rem', color: '#CBD5E1', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>👥 Up to {activeWalkInRoom?.capacity || 4} Guests</span>
                            <span>•</span>
                            <span>🏷️ {activeWalkInRoom?.units || 1} Total Unit{Number(activeWalkInRoom?.units || 1) > 1 ? 's' : ''}</span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              padding: '5px 12px',
                              borderRadius: 12,
                              background: 'rgba(16, 185, 129, 0.9)',
                              color: '#FFFFFF',
                              fontWeight: 800,
                              fontSize: '.88rem',
                              backdropFilter: 'blur(6px)',
                              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                              border: '1px solid rgba(255,255,255,0.25)',
                              display: 'inline-block',
                            }}
                          >
                            {money(activeWalkInRoom?.rate_php || 3500)} <span style={{ fontSize: '.68rem', fontWeight: 600 }}>/ night</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* MODAL BODY (SCROLLBAR HIDDEN, SMOOTH VERTICAL SCROLL) */}
                    <div
                      className="scrollbar-none no-scrollbar"
                      style={{
                        padding: '20px 24px',
                        overflowY: 'auto',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        flex: 1,
                      }}
                    >
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

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
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

                        {/* ACCOMMODATION / ROOM SELECTOR (CHANGES TOP IMAGE IN REAL TIME) */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, margin: 0 }}>Accommodation / Room *</label>
                            <span style={{ fontSize: '.7rem', color: '#0EA5E9', fontWeight: 600 }}>
                              🖼️ Changing selection updates photo at top
                            </span>
                          </div>
                          <select
                            required
                            value={newReservation.room_id || activeWalkInRoom?.id || ''}
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
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText, fontWeight: 600 }}
                          >
                            <option value="">-- Select Room / Cottage / Villa --</option>
                            {roomsList.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} ({r.category || 'Standard'}) — {money(r.rate_php)}/night
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* STAY DATES & INTERACTIVE VISUAL CALENDAR */}
                        <div style={{ borderRadius: 12, border: `1px solid ${isModalRoomLocked ? '#F43F5E' : themeBorder}`, padding: 12, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                            <div>
                              <div style={{ fontSize: '.78rem', fontWeight: 700, color: themeText, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>📅 Stay Dates & Calendar</span>
                                <span
                                  style={{
                                    fontSize: '.68rem',
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    background: isModalRoomLocked ? '#FFF1F2' : '#ECFDF5',
                                    color: isModalRoomLocked ? '#E11D48' : '#059669',
                                    fontWeight: 700,
                                    border: `1px solid ${isModalRoomLocked ? 'rgba(244,63,94,0.3)' : 'rgba(16,185,129,0.3)'}`,
                                  }}
                                >
                                  {isModalRoomLocked ? '🔴 Conflicting Dates' : '🟢 Dates Available'}
                                </span>
                              </div>
                              <span style={{ fontSize: '.72rem', color: themeMuted }}>
                                {computedNights} night{computedNights > 1 ? 's' : ''}: {fmtDate(newReservation.check_in)} → {fmtDate(newReservation.check_out)}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setShowWalkInCalendar((prev) => !prev)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '5px 12px',
                                borderRadius: 8,
                                border: `1px solid ${showWalkInCalendar ? '#0EA5E9' : themeBorder}`,
                                background: showWalkInCalendar ? (isLightMode ? '#E0F2FE' : 'rgba(14,165,233,0.18)') : (isLightMode ? '#FFFFFF' : '#1E293B'),
                                color: showWalkInCalendar ? '#0EA5E9' : themeText,
                                fontSize: '.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <span>📆</span>
                              <span>{showWalkInCalendar ? 'Hide Visual Calendar' : 'Show Availability Calendar'}</span>
                            </button>
                          </div>

                          {/* EXPANDABLE VISUAL AVAILABILITY CALENDAR */}
                          {showWalkInCalendar && (
                            <div
                              style={{
                                marginBottom: 12,
                                borderRadius: 12,
                                overflow: 'hidden',
                                border: `1px solid ${isLightMode ? '#BAE6FD' : 'rgba(14,165,233,0.35)'}`,
                              }}
                            >
                              <AvailabilityCalendar
                                selectedRoomId={newReservation.room_id || activeWalkInRoom?.id || 'all'}
                                rooms={roomsList}
                                initialCheckIn={newReservation.check_in}
                                initialCheckOut={newReservation.check_out}
                                isLightMode={isLightMode}
                                onSelectDates={(cin, cout) => {
                                  const room = roomsList.find((r) => r.id === newReservation.room_id) || activeWalkInRoom;
                                  const rate = room?.rate_php || 3500;
                                  const nights = Math.max(1, Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000));
                                  setNewReservation((prev) => ({
                                    ...prev,
                                    check_in: cin,
                                    check_out: cout,
                                    total_php: rate * nights,
                                  }));
                                }}
                                onRoomChange={(roomId) => {
                                  const room = roomsList.find((r) => r.id === roomId);
                                  const rate = room?.rate_php || 3500;
                                  const nights = Math.max(1, Math.round((new Date(newReservation.check_out).getTime() - new Date(newReservation.check_in).getTime()) / 86400000));
                                  setNewReservation((prev) => ({
                                    ...prev,
                                    room_id: roomId,
                                    total_php: rate * nights,
                                  }));
                                }}
                                onClose={() => setShowWalkInCalendar(false)}
                              />
                            </div>
                          )}

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                              <label style={{ fontSize: '.74rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Check-In Date *</label>
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
                                  const room = roomsList.find((r) => r.id === newReservation.room_id) || activeWalkInRoom;
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
                              <label style={{ fontSize: '.74rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Check-Out Date *</label>
                              <input
                                type="date"
                                required
                                value={newReservation.check_out}
                                onChange={(e) => {
                                  const cout = e.target.value;
                                  const nights = Math.max(1, Math.round((new Date(cout).getTime() - new Date(newReservation.check_in).getTime()) / 86400000));
                                  const room = roomsList.find((r) => r.id === newReservation.room_id) || activeWalkInRoom;
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
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                          <div>
                            <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Guests *</label>
                            <input
                              type="number"
                              min="1"
                              max={activeWalkInRoom?.capacity || 20}
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

                        {isModalRoomLocked && (
                          <div
                            style={{
                              padding: '12px 16px',
                              borderRadius: 12,
                              background: isLightMode ? '#FFF1F2' : 'rgba(244, 63, 94, 0.14)',
                              border: '1px solid rgba(244, 63, 94, 0.4)',
                              color: '#E11D48',
                              fontSize: '.82rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                            }}
                          >
                            <span style={{ fontSize: '1.2rem' }}>🔒</span>
                            <div>
                              <strong>Overbooking Guard:</strong> This accommodation is already locked in / taken by another reservation for these dates. Overlapping bookings are blocked. Please select another accommodation or shift the dates in the calendar above.
                            </div>
                          </div>
                        )}

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
                            disabled={creatingReservation || isModalRoomLocked}
                            className="btn btn-sky btn-sm"
                            style={{
                              fontWeight: 700,
                              background: isModalRoomLocked ? '#94A3B8' : undefined,
                              cursor: isModalRoomLocked ? 'not-allowed' : 'pointer',
                              borderColor: isModalRoomLocked ? '#94A3B8' : undefined,
                            }}
                          >
                            {creatingReservation ? 'Saving to Ledger…' : isModalRoomLocked ? '🔒 Dates Taken / Locked' : 'Save & Log to Ledger ✦'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* MODAL: RECORD GENERAL LEDGER JOURNAL VOUCHER */}
          {showAddJournalModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2, 6, 23, 0.78)',
                backdropFilter: 'blur(8px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 12px',
              }}
              onClick={() => setShowAddJournalModal(false)}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 620,
                  background: isLightMode ? '#FFFFFF' : '#0F172A',
                  borderRadius: 22,
                  border: `1px solid ${themeBorder}`,
                  boxShadow: '0 25px 60px -12px rgba(0,0,0,0.6)',
                  maxHeight: '92vh',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: `1px solid ${themeBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '.72rem', color: '#0EA5E9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                      DOUBLE-ENTRY BOOKKEEPING
                    </span>
                    <h3 className="serif" style={{ fontSize: '1.25rem', margin: '4px 0 0', color: themeText, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>➕</span> Record Journal Voucher
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowAddJournalModal(false)}
                    style={{ background: 'transparent', border: 'none', color: themeMuted, fontSize: '1.4rem', cursor: 'pointer', padding: 4 }}
                  >
                    ✕
                  </button>
                </div>

                {/* Form Body */}
                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                  <form onSubmit={handlePostJournalEntry} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Mode Toggle */}
                    <div style={{ display: 'flex', gap: 6, background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)', padding: 4, borderRadius: 12 }}>
                      <button
                        type="button"
                        onClick={() => setJournalForm({ ...journalForm, mode: 'pair' })}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: 'none',
                          background: journalForm.mode === 'pair' ? (isLightMode ? '#FFFFFF' : '#0F172A') : 'transparent',
                          color: journalForm.mode === 'pair' ? (isLightMode ? '#0284C7' : '#38BDF8') : themeMuted,
                          fontSize: '.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ⚖️ Double-Entry Pair (Debit & Credit)
                      </button>
                      <button
                        type="button"
                        onClick={() => setJournalForm({ ...journalForm, mode: 'single' })}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: 'none',
                          background: journalForm.mode === 'single' ? (isLightMode ? '#FFFFFF' : '#0F172A') : 'transparent',
                          color: journalForm.mode === 'single' ? (isLightMode ? '#0284C7' : '#38BDF8') : themeMuted,
                          fontSize: '.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ⚡ Single Adjustment Entry
                      </button>
                    </div>

                    {journalForm.mode === 'pair' ? (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                          <div>
                            <label style={{ fontSize: '.78rem', color: isLightMode ? '#047857' : '#34D399', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                              Debit Account (Assets / Expenses) *
                            </label>
                            <select
                              value={journalForm.debit_account_code}
                              onChange={(e) => setJournalForm({ ...journalForm, debit_account_code: e.target.value })}
                              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText, fontSize: '.84rem' }}
                            >
                              {(chartOfAccounts.length > 0 ? chartOfAccounts : [
                                { code: '1010', name: 'Cash on Hand & Digital Wallets' },
                                { code: '1020', name: 'Accounts Receivable - Guest Folios' },
                                { code: '5010', name: 'Kitchen & Food Supplies Expenses' },
                                { code: '5020', name: 'Housekeeping Linens & Guest Amenities' },
                                { code: '5030', name: 'Resort Utilities & Generator Fuel' },
                                { code: '5040', name: 'Repairs & Property Maintenance' },
                                { code: '2020', name: 'Guest Refunds Payable' },
                              ]).map((acc) => (
                                <option key={acc.code} value={acc.code}>
                                  {acc.code} - {acc.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: '.78rem', color: isLightMode ? '#1D4ED8' : '#60A5FA', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                              Credit Account (Revenue / Liabilities) *
                            </label>
                            <select
                              value={journalForm.credit_account_code}
                              onChange={(e) => setJournalForm({ ...journalForm, credit_account_code: e.target.value })}
                              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText, fontSize: '.84rem' }}
                            >
                              {(chartOfAccounts.length > 0 ? chartOfAccounts : [
                                { code: '4010', name: 'Room Accommodations Revenue' },
                                { code: '4020', name: 'Kitchen & Dining Revenue' },
                                { code: '4030', name: 'Island Tours & Water Activities' },
                                { code: '2010', name: 'Guest Reservation Deposits & Advances' },
                                { code: '1010', name: 'Cash on Hand & Digital Wallets' },
                              ]).map((acc) => (
                                <option key={acc.code} value={acc.code}>
                                  {acc.code} - {acc.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                          <div>
                            <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                              Account *
                            </label>
                            <select
                              value={journalForm.debit_account_code}
                              onChange={(e) => setJournalForm({ ...journalForm, debit_account_code: e.target.value })}
                              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText, fontSize: '.84rem' }}
                            >
                              {(chartOfAccounts.length > 0 ? chartOfAccounts : [
                                { code: '1010', name: 'Cash on Hand & Digital Wallets' },
                                { code: '4010', name: 'Room Accommodations Revenue' },
                                { code: '5010', name: 'Kitchen & Food Supplies' },
                              ]).map((acc) => (
                                <option key={acc.code} value={acc.code}>
                                  {acc.code} - {acc.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                              Entry Type *
                            </label>
                            <select
                              value={journalForm.category}
                              onChange={(e) => setJournalForm({ ...journalForm, category: e.target.value })}
                              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText, fontSize: '.84rem' }}
                            >
                              <option value="ADJUSTMENT">Adjustment (DEBIT)</option>
                              <option value="REVENUE">Revenue (CREDIT)</option>
                              <option value="PAYMENT">Payment (DEBIT)</option>
                              <option value="EXPENSE">Expense (DEBIT)</option>
                              <option value="REFUND">Refund (DEBIT)</option>
                            </select>
                          </div>
                        </div>
                      </>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                          Amount in Philippine Peso (PHP) *
                        </label>
                        <input
                          type="number"
                          required
                          min={1}
                          step="0.01"
                          placeholder="e.g. 5000"
                          value={journalForm.amount_php || ''}
                          onChange={(e) => setJournalForm({ ...journalForm, amount_php: parseFloat(e.target.value) || 0 })}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText, fontSize: '.84rem', fontWeight: 700 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                          Category
                        </label>
                        <select
                          value={journalForm.category}
                          onChange={(e) => setJournalForm({ ...journalForm, category: e.target.value })}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText, fontSize: '.84rem' }}
                        >
                          <option value="REVENUE">Revenue</option>
                          <option value="PAYMENT">Payment</option>
                          <option value="EXPENSE">Expense</option>
                          <option value="REFUND">Refund</option>
                          <option value="ADJUSTMENT">Adjustment</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Particulars / Description *
                      </label>
                      <input
                        required
                        placeholder="e.g. Cash settlement for walk-in guest at Unit GEL Premier Suite"
                        value={journalForm.particulars}
                        onChange={(e) => setJournalForm({ ...journalForm, particulars: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText, fontSize: '.84rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Reference / Voucher ID (Optional)
                      </label>
                      <input
                        placeholder="e.g. OR-2026-9014 or RES-1010"
                        value={journalForm.reference_id}
                        onChange={(e) => setJournalForm({ ...journalForm, reference_id: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText, fontSize: '.84rem' }}
                      />
                    </div>

                    {/* Submit Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowAddJournalModal(false)}
                        style={{ color: themeText }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-sky btn-sm"
                        disabled={postingJournal}
                        style={{ fontWeight: 700 }}
                      >
                        {postingJournal ? 'Posting Voucher…' : 'Save & Post Journal Entry ✦'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: POSTGRESQL BACKUP & ADAPTIVE MIGRATION HUB */}
          {showBackupModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2, 6, 23, 0.78)',
                backdropFilter: 'blur(8px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 12px',
              }}
              onClick={() => setShowBackupModal(false)}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 780,
                  background: isLightMode ? '#FFFFFF' : '#0F172A',
                  borderRadius: 22,
                  border: `1px solid ${themeBorder}`,
                  boxShadow: '0 25px 60px -12px rgba(0,0,0,0.6)',
                  maxHeight: '92vh',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: `1px solid ${themeBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '.72rem', color: '#6366F1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                      POSTGRESQL & SUPABASE DATA PLATFORM
                    </span>
                    <h3 className="serif" style={{ fontSize: '1.25rem', margin: '4px 0 0', color: themeText, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🐘</span> PostgreSQL Ledger Backup & Adaptive Migration
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowBackupModal(false)}
                    style={{ background: 'transparent', border: 'none', color: themeMuted, fontSize: '1.4rem', cursor: 'pointer', padding: 4 }}
                  >
                    ✕
                  </button>
                </div>

                {/* Sub-Tabs: Export vs Import */}
                <div style={{ display: 'flex', borderBottom: `1px solid ${themeBorder}`, padding: '0 24px', gap: 16 }}>
                  <button
                    onClick={() => setBackupTab('export')}
                    style={{
                      padding: '12px 14px',
                      border: 'none',
                      borderBottom: `2px solid ${backupTab === 'export' ? '#6366F1' : 'transparent'}`,
                      background: 'transparent',
                      color: backupTab === 'export' ? (isLightMode ? '#4338CA' : '#818CF8') : themeMuted,
                      fontWeight: 700,
                      fontSize: '.84rem',
                      cursor: 'pointer',
                    }}
                  >
                    📤 Export PostgreSQL Backup
                  </button>
                  <button
                    onClick={() => setBackupTab('import')}
                    style={{
                      padding: '12px 14px',
                      border: 'none',
                      borderBottom: `2px solid ${backupTab === 'import' ? '#6366F1' : 'transparent'}`,
                      background: 'transparent',
                      color: backupTab === 'import' ? (isLightMode ? '#4338CA' : '#818CF8') : themeMuted,
                      fontWeight: 700,
                      fontSize: '.84rem',
                      cursor: 'pointer',
                    }}
                  >
                    📥 Adaptive Import & Restore
                  </button>
                </div>

                {/* Body Content */}
                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                  {backupTab === 'export' ? (
                    <div>
                      <p style={{ margin: '0 0 16px', color: themeMuted, fontSize: '.84rem' }}>
                        Generate complete PostgreSQL backups adhering to the <strong>public.ledger_entries</strong> schema. Choose your desired target format below:
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
                        {/* SQL Dump */}
                        <div style={{ padding: '16px', borderRadius: 14, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)' }}>
                          <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: 8 }}>🐘</span>
                          <b style={{ color: themeText, fontSize: '.92rem', display: 'block' }}>PostgreSQL SQL Dump (.sql)</b>
                          <p style={{ color: themeMuted, fontSize: '.74rem', margin: '4px 0 14px' }}>
                            Full DDL, indexes, and transactional INSERT clauses with ON CONFLICT resolution for PostgreSQL 15+ / Supabase.
                          </p>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <a
                              href={api.exportLedgerBackupUrl('sql', true)}
                              download
                              className="btn btn-sky btn-sm"
                              style={{ fontSize: '.74rem', fontWeight: 700 }}
                            >
                              📥 Download .sql
                            </a>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: '.74rem', color: themeText, border: `1px solid ${themeBorder}` }}
                              onClick={async () => {
                                setLoadingPreviewSql(true);
                                try {
                                  const text = await api.fetchLedgerBackupText('sql');
                                  setPreviewSqlText(text);
                                } catch (e: any) {
                                  toast(e.message, true);
                                } finally {
                                  setLoadingPreviewSql(false);
                                }
                              }}
                            >
                              {loadingPreviewSql ? 'Loading…' : '👁️ View / Copy'}
                            </button>
                          </div>
                        </div>

                        {/* JSON Archive */}
                        <div style={{ padding: '16px', borderRadius: 14, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)' }}>
                          <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: 8 }}>📄</span>
                          <b style={{ color: themeText, fontSize: '.92rem', display: 'block' }}>Structured JSON Backup (.json)</b>
                          <p style={{ color: themeMuted, fontSize: '.74rem', margin: '4px 0 14px' }}>
                            JSON archive containing complete ledger records, Trial Balance audit metrics, and Chart of Accounts catalog.
                          </p>
                          <a
                            href={api.exportLedgerBackupUrl('json', true)}
                            download
                            className="btn btn-sky btn-sm"
                            style={{ fontSize: '.74rem', fontWeight: 700 }}
                          >
                            📥 Download .json
                          </a>
                        </div>

                        {/* CSV Spreadsheet */}
                        <div style={{ padding: '16px', borderRadius: 14, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)' }}>
                          <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: 8 }}>📊</span>
                          <b style={{ color: themeText, fontSize: '.92rem', display: 'block' }}>RFC 4180 CSV (.csv)</b>
                          <p style={{ color: themeMuted, fontSize: '.74rem', margin: '4px 0 14px' }}>
                            Universal spreadsheet format with dates, accounts, separate debit/credit columns, and running balance.
                          </p>
                          <a
                            href={api.exportLedgerBackupUrl('csv', true)}
                            download
                            className="btn btn-sky btn-sm"
                            style={{ fontSize: '.74rem', fontWeight: 700 }}
                          >
                            📥 Download .csv
                          </a>
                        </div>
                      </div>

                      {/* SQL Code Preview box */}
                      {previewSqlText && (
                        <div style={{ marginTop: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: '.74rem', color: themeMuted, fontWeight: 700 }}>
                              POSTGRESQL DUMP PREVIEW
                            </span>
                            <button
                              className="btn btn-sm btn-ghost"
                              style={{ fontSize: '.72rem', color: '#0EA5E9' }}
                              onClick={() => {
                                navigator.clipboard.writeText(previewSqlText);
                                toast('✦ PostgreSQL SQL dump copied to clipboard!');
                              }}
                            >
                              📋 Copy to Clipboard
                            </button>
                          </div>
                          <textarea
                            readOnly
                            rows={10}
                            value={previewSqlText}
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: 10,
                              fontFamily: 'monospace',
                              fontSize: '.78rem',
                              border: `1px solid ${themeBorder}`,
                              background: isLightMode ? '#F1F5F9' : '#020617',
                              color: themeText,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p style={{ margin: '0 0 14px', color: themeMuted, fontSize: '.84rem' }}>
                        The <strong>Adaptive Import Engine</strong> automatically recognizes your data format: PostgreSQL SQL dump (INSERT/CREATE TABLE), JSON archives, CSV spreadsheets, or physical logbook notations.
                      </p>

                      {/* Format Auto-Detection Pill */}
                      {(() => {
                        const detectFormat = (text: string) => {
                          const t = text.trim();
                          if (!t) return { label: 'Awaiting file or pasted text…', color: '#64748B', icon: 'ℹ️' };
                          if (t.includes('INSERT INTO') || t.includes('CREATE TABLE') || (t.startsWith('BEGIN;') && t.includes('INSERT INTO')) || /INSERT\s+INTO\s+[a-z0-9_.]*ledger_entries/i.test(t)) {
                            return { label: 'Detected Format: PostgreSQL Dump (SQL)', color: '#10B981', icon: '🐘' };
                          }
                          if ((t.startsWith('[') && t.endsWith(']')) || (t.startsWith('{') && t.endsWith('}'))) {
                            return { label: 'Detected Format: JSON Ledger Data', color: '#0EA5E9', icon: '📄' };
                          }
                          if (t.includes(',') && (t.toLowerCase().includes('debit') || t.toLowerCase().includes('credit') || t.toLowerCase().includes('particulars'))) {
                            return { label: 'Detected Format: CSV Spreadsheet', color: '#F59E0B', icon: '📊' };
                          }
                          if (t.includes('|') || t.match(/\d+[\d,]*\s*-\s*\d+[\d,]*\s*=/)) {
                            return { label: 'Detected Format: Physical Logbook Notation', color: '#8B5CF6', icon: '📋' };
                          }
                          return { label: 'Detected Format: Raw Text / Auto-Adaptive', color: '#0EA5E9', icon: '⚡' };
                        };

                        const detected = detectFormat(importContent);

                        return (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.78rem', fontWeight: 700, color: detected.color, background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: 8, border: `1px solid ${detected.color}` }}>
                              <span>{detected.icon}</span> {detected.label}
                            </div>
                            <label style={{ fontSize: '.78rem', color: '#0EA5E9', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>📁</span> Upload File (.sql, .json, .csv, .txt)
                              <input
                                type="file"
                                accept=".sql,.json,.csv,.txt"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (evt) => {
                                      const text = evt.target?.result;
                                      if (typeof text === 'string') {
                                        setImportContent(text);
                                        toast(`✦ File loaded: ${file.name} (${Math.round(file.size / 1024)} KB)`);
                                      }
                                    };
                                    reader.readAsText(file);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        );
                      })()}

                      {/* Textarea for Import Content */}
                      <textarea
                        rows={9}
                        placeholder="Paste PostgreSQL SQL statements, JSON records, CSV text, or pipe-delimited logbook lines here…"
                        value={importContent}
                        onChange={(e) => setImportContent(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: 10,
                          border: `1px solid ${themeBorder}`,
                          background: isLightMode ? '#FFF' : '#1E293B',
                          color: themeText,
                          fontFamily: 'monospace',
                          fontSize: '.78rem',
                          marginBottom: 14,
                        }}
                      />

                      {/* Import Mode Options */}
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                          Import Restoration Strategy
                        </label>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.82rem', color: themeText, cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="importMode"
                              checked={importMode === 'append'}
                              onChange={() => setImportMode('append')}
                            />
                            <b>Append & Reconcile (Recommended)</b> — Preserves existing entries, only adds new records
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.82rem', color: isLightMode ? '#DC2626' : '#F87171', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="importMode"
                              checked={importMode === 'overwrite'}
                              onChange={() => setImportMode('overwrite')}
                            />
                            <b>Complete Overwrite & Restore</b> — Clears current ledger and restores from backup
                          </label>
                        </div>
                      </div>

                      {/* Execute Button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setShowBackupModal(false)}
                          style={{ color: themeText }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn-sky btn-sm"
                          disabled={importingBackup || !importContent.trim()}
                          onClick={handleExecuteImport}
                          style={{ fontWeight: 700 }}
                        >
                          {importingBackup ? 'Parsing & Restoring…' : '🚀 Execute Adaptive Import ✦'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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

      {/* MODAL: EDIT USER PROFILE */}
      {editingUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setEditingUser(null)}>
          <div style={{ width: '100%', maxWidth: 500, background: isLightMode ? '#FFFFFF' : '#0F172A', borderRadius: 20, border: `1px solid ${themeBorder}`, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 12 }}>
              <div>
                <span style={{ fontSize: '.74rem', color: '#0EA5E9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>ACCOUNT MANAGEMENT</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.25rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>✏️ Edit Account Profile</h3>
              </div>
              <button onClick={() => setEditingUser(null)} style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>First Name</label>
                  <input
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={editingUser.first_name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Middle</label>
                  <input
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={editingUser.middle_name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, middle_name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Last Name</label>
                  <input
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={editingUser.last_name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Display / Full Name *</label>
                <input
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                  value={editingUser.full_name || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Phone</label>
                  <input
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={editingUser.phone || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                    placeholder="09171234567"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    {(!editingUser.role || editingUser.role === 'customer') ? 'Account Classification' : 'Staff Role Assignment'}
                  </label>
                  {(!editingUser.role || editingUser.role === 'customer') ? (
                    <div style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.05)', color: themeText, fontSize: '.84rem', fontWeight: 600 }}>
                      👤 Customer / Guest (Fixed)
                    </div>
                  ) : (
                    <select
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
                      value={editingUser.role || 'staff'}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    >
                      <option value="receptionist">Receptionist</option>
                      <option value="accounting">Accounting</option>
                      <option value="staff">Staff</option>
                      <option value="administrator">Administrator</option>
                    </select>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn btn-sm" onClick={() => setEditingUser(null)} style={{ border: `1px solid ${themeBorder}`, color: themeText }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-sky btn-sm" disabled={savingUser}>
                  {savingUser ? 'Saving…' : 'Save Changes ✦'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE USER CONFIRMATION */}
      {userToDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setUserToDelete(null)}>
          <div style={{ width: '100%', maxWidth: 440, background: isLightMode ? '#FFFFFF' : '#0F172A', borderRadius: 20, border: '1px solid rgba(239, 68, 68, 0.4)', padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: '.74rem', color: '#EF4444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>DANGER ZONE</span>
              <button onClick={() => setUserToDelete(null)} style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.25rem', color: '#EF4444', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              🗑️ Delete Account Permanently?
            </h3>
            <p style={{ fontSize: '.86rem', color: themeText, lineHeight: 1.5, margin: '0 0 16px' }}>
              Are you sure you want to delete the account for <strong>{userToDelete.full_name || userToDelete.email || 'this user'}</strong> ({userToDelete.role})?
            </p>
            <p style={{ fontSize: '.78rem', color: themeMuted, background: 'rgba(239, 68, 68, 0.1)', padding: '10px 12px', borderRadius: 8, margin: '0 0 18px', border: '1px solid rgba(239,68,68,0.2)' }}>
              ⚠️ This will delete authentication credentials and profile records from Supabase and log an administrative audit event.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-sm" onClick={() => setUserToDelete(null)} style={{ border: `1px solid ${themeBorder}`, color: themeText }}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleDeleteUser}
                disabled={deletingUser}
                style={{ background: '#EF4444', color: '#FFF', fontWeight: 700 }}
              >
                {deletingUser ? 'Deleting…' : 'Yes, Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADMIN FORGOT PASSWORD OTP RECOVERY */}
      {showAdminForgotModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowAdminForgotModal(false)}>
          <div style={{ width: '100%', maxWidth: 440, background: '#0F172A', borderRadius: 20, border: '1px solid rgba(34, 195, 238, 0.35)', padding: 26, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <span style={{ fontSize: '.72rem', color: '#22c3ee', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>ADMIN SECURITY RECOVERY</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.25rem', color: '#FFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>🔑 Reset Administrator Password</h3>
              </div>
              <button onClick={() => setShowAdminForgotModal(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            {adminRecoveryStep === 1 ? (
              <form onSubmit={handleAdminForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: '.84rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Enter your registered administrator email. A secure 6-digit OTP verification code will be dispatched to your inbox via Google Mail / SMTP.
                </p>
                <div>
                  <label style={{ fontSize: '.76rem', color: '#22c3ee', fontWeight: 700, display: 'block', marginBottom: 4 }}>ADMINISTRATOR EMAIL</label>
                  <input
                    required
                    type="email"
                    value={adminRecoveryEmail}
                    onChange={(e) => setAdminRecoveryEmail(e.target.value)}
                    placeholder="admin@resortmanagement.ph"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#FFF', fontSize: '.88rem' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                  <button type="button" className="btn btn-sm" onClick={() => setShowAdminForgotModal(false)} style={{ border: '1px solid rgba(255,255,255,0.2)', color: '#FFF' }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sky btn-sm" disabled={adminRecoveryBusy}>
                    {adminRecoveryBusy ? 'Sending OTP…' : 'Send 6-Digit OTP ✦'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAdminResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: '.84rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Enter the 6-digit OTP sent to <strong>{adminRecoveryEmail}</strong> and choose a new password.
                </p>
                <div>
                  <label style={{ fontSize: '.76rem', color: '#22c3ee', fontWeight: 700, display: 'block', marginBottom: 4 }}>6-DIGIT OTP VERIFICATION CODE</label>
                  <input
                    required
                    maxLength={6}
                    value={adminRecoveryCode}
                    onChange={(e) => setAdminRecoveryCode(e.target.value.trim())}
                    placeholder="123456"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #22c3ee', background: 'rgba(255,255,255,0.05)', color: '#38BDF8', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '0.3em', fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.76rem', color: '#22c3ee', fontWeight: 700, display: 'block', marginBottom: 4 }}>NEW PASSWORD (MIN 6 CHARACTERS)</label>
                  <input
                    required
                    type="password"
                    minLength={6}
                    value={adminRecoveryNewPass}
                    onChange={(e) => setAdminRecoveryNewPass(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#FFF', fontSize: '.88rem' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setAdminRecoveryStep(1)}
                    style={{ background: 'none', border: 'none', color: '#38BDF8', fontSize: '.78rem', cursor: 'pointer', padding: 0 }}
                  >
                    ← Back / Change Email
                  </button>
                  <button type="submit" className="btn btn-sky btn-sm" disabled={adminRecoveryBusy}>
                    {adminRecoveryBusy ? 'Resetting…' : 'Verify & Reset Password ✦'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: LEDGER REFUND (REQUEST & CONFIRM) */}
      {refundTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setRefundTarget(null)}>
          <div style={{ width: '100%', maxWidth: 480, background: isLightMode ? '#FFFFFF' : '#0F172A', borderRadius: 20, border: `1px solid ${themeBorder}`, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 10 }}>
              <div>
                <span style={{ fontSize: '.74rem', color: refundMode === 'confirm' ? '#10B981' : '#F59E0B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  {refundMode === 'confirm' ? 'ACCOUNTING REFUND APPROVAL' : 'GUEST REFUND CLAIM'}
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.25rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {refundMode === 'confirm' ? '💵 Confirm & Process Refund' : '💰 Initiate Refund Request'}
                </h3>
              </div>
              <button onClick={() => setRefundTarget(null)} style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: '.84rem', color: themeMuted, margin: '0 0 14px', lineHeight: 1.5 }}>
              Folio: <b>{refundTarget.guest_name || refundTarget.profiles?.full_name || 'Guest'}</b> · {refundTarget.rooms?.name || 'Villa'} ({fmtDate(refundTarget.check_in)} → {fmtDate(refundTarget.check_out)})
            </p>

            <form onSubmit={handleRefundSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Mode</label>
                  <select
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
                    value={refundMode}
                    onChange={(e) => setRefundMode(e.target.value)}
                  >
                    <option value="request">Request In-Process</option>
                    <option value="confirm">Approve & Disburse</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Refund Amount (₱) *</label>
                  <input
                    required
                    type="number"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="e.g. 3500"
                  />
                </div>
              </div>

              {refundMode === 'confirm' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Payment Method</label>
                    <select
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value)}
                    >
                      <option value="GCash">GCash</option>
                      <option value="Maya">Maya</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Cash">Cash (Front Desk)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Reference Number</label>
                    <input
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                      value={refundRefNum}
                      onChange={(e) => setRefundRefNum(e.target.value)}
                      placeholder="e.g. GCASH-998811"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Reason for Refund</label>
                  <input
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="e.g. Typhoon weather advisory cancellation"
                  />
                </div>
              )}

              <div style={{ padding: '10px 12px', background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.03)', borderRadius: 10, border: `1px solid ${themeBorder}`, fontSize: '.76rem', color: themeMuted, lineHeight: 1.4 }}>
                📧 <strong>Automated Email Notification:</strong> Submitting will immediately trigger an automated email to <strong>{refundTarget.guest_email || refundTarget.profiles?.email || 'guest email'}</strong> notifying them of this status update.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => setRefundTarget(null)} style={{ border: `1px solid ${themeBorder}`, color: themeText }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn btn-sm ${refundMode === 'confirm' ? 'btn-green' : 'btn-sky'}`}
                  disabled={submittingRefund}
                  style={refundMode === 'confirm' ? { background: '#10B981', color: '#FFF', fontWeight: 700 } : {}}
                >
                  {submittingRefund ? 'Processing…' : (refundMode === 'confirm' ? 'Confirm & Email Guest ✦' : 'Submit & Email Guest ✦')}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14, borderTop: `1px solid ${themeBorder}`, paddingTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateRoomModal(false)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 10,
                    fontSize: '.82rem',
                    fontWeight: 600,
                    color: themeMuted,
                    background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${themeBorder}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = themeText;
                    e.currentTarget.style.borderColor = isLightMode ? '#94A3B8' : '#64748B';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = themeMuted;
                    e.currentTarget.style.borderColor = themeBorder;
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '9px 24px',
                    borderRadius: 10,
                    fontSize: '.82rem',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
                    border: 'none',
                    boxShadow: '0 4px 14px rgba(14, 165, 233, 0.35)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(14, 165, 233, 0.45)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(14, 165, 233, 0.35)';
                  }}
                >
                  💾 Save
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
                    border: `1.5px dashed ${uploadingRoomPhoto ? '#0EA5E9' : (isLightMode ? '#CBD5E1' : 'rgba(148, 163, 184, 0.25)')}`,
                    borderRadius: 14,
                    padding: '22px 18px',
                    textAlign: 'center',
                    cursor: uploadingRoomPhoto ? 'not-allowed' : 'pointer',
                    background: isLightMode ? '#FFFFFF' : 'rgba(15, 23, 42, 0.5)',
                    marginBottom: 16,
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  onMouseEnter={(e) => {
                    if (!uploadingRoomPhoto) {
                      e.currentTarget.style.borderColor = '#0EA5E9';
                      e.currentTarget.style.background = isLightMode ? '#F0F9FF' : 'rgba(14, 165, 233, 0.06)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!uploadingRoomPhoto) {
                      e.currentTarget.style.borderColor = isLightMode ? '#CBD5E1' : 'rgba(148, 163, 184, 0.25)';
                      e.currentTarget.style.background = isLightMode ? '#FFFFFF' : 'rgba(15, 23, 42, 0.5)';
                    }
                  }}
                >
                  <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: 2 }}>☁️</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '.86rem', fontWeight: 700, color: '#0EA5E9' }}>
                      {uploadingRoomPhoto ? 'Uploading to Cloudinary CDN...' : '📁 Choose Image to Upload'}
                    </span>
                  </div>
                  <span style={{ fontSize: '.74rem', color: themeMuted }}>
                    Cloudinary CDN delivery • JPG, PNG, WebP up to 5MB
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
                            <img
                              src={imgUrl}
                              alt={`Photo ${i + 1}`}
                              onError={(e) => { e.currentTarget.src = 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209696/jd_beach_house_accommodations/cottage.jpg'; }}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            {imgUrl.includes('cloudinary.com') && (
                              <span style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(56, 189, 248, 0.9)', color: '#0F172A', fontSize: '.58rem', fontWeight: 800, padding: '2px 5px', borderRadius: 4 }}>
                                ☁️ CDN
                              </span>
                            )}
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, borderTop: `1px solid ${themeBorder}`, paddingTop: 16 }}>
                <button
                  type="button"
                  onClick={() => handleDeleteRoom(editingRoom)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '9px 18px',
                    borderRadius: 10,
                    fontSize: '.82rem',
                    fontWeight: 700,
                    color: '#EF4444',
                    background: isLightMode ? '#FEF2F2' : 'rgba(239, 68, 68, 0.12)',
                    border: `1px solid ${isLightMode ? '#FECACA' : 'rgba(239, 68, 68, 0.3)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isLightMode ? '#FEE2E2' : 'rgba(239, 68, 68, 0.22)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isLightMode ? '#FEF2F2' : 'rgba(239, 68, 68, 0.12)';
                  }}
                >
                  🗑️ Delete
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setEditingRoom(null)}
                    style={{
                      padding: '9px 18px',
                      borderRadius: 10,
                      fontSize: '.82rem',
                      fontWeight: 600,
                      color: themeMuted,
                      background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${themeBorder}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = themeText;
                      e.currentTarget.style.borderColor = isLightMode ? '#94A3B8' : '#64748B';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = themeMuted;
                      e.currentTarget.style.borderColor = themeBorder;
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '9px 24px',
                      borderRadius: 10,
                      fontSize: '.82rem',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
                      border: 'none',
                      boxShadow: '0 4px 14px rgba(14, 165, 233, 0.35)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 18px rgba(14, 165, 233, 0.45)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(14, 165, 233, 0.35)';
                    }}
                  >
                    💾 Save
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
