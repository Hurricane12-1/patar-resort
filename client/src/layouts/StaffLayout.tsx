import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { supabase } from '../lib/supabaseClient.ts';
import { api } from '../lib/api.ts';
import { toast } from '../components/Toasts.tsx';
import { canAccessPortal, canEscalateToRecovery, formatDepartmentBadge, isAdministrator, PortalKey } from '../lib/rbac.ts';
import '../styles/staff-portal.css';

interface StaffLayoutProps {
  children?: React.ReactNode;
}

/**
 * StaffLayout - Clean, Friendly Executive Operations Terminal (/staff)
 * Narrative: Duty staff handle room readiness, guest manifest, walk-ins, and execution.
 * Modular CSS, collapsible 240px / 72px navigation rail, search bar & breadcrumbs.
 */
export default function StaffLayout({ children }: StaffLayoutProps) {
  const { staffSession, staffProfile, adminSession, adminProfile, signOutStaff, signOutAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeProfile = staffProfile || adminProfile;
  const isExecAdmin = isAdministrator(activeProfile);

  // Collapsible Sidebar States (Persistent in localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('jd_staff_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    if (window.innerWidth >= 1024) {
      setIsSidebarCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('jd_staff_sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    } else {
      setMobileSidebarOpen((prev) => !prev);
    }
  };

  // Close mobile sidebar drawer on navigation
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const handleSignOut = () => {
    if (staffSession) {
      signOutStaff();
    } else {
      signOutAdmin();
    }
  };

  // Global Quick Search Keybinding ('/')
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const searchInput = document.getElementById('staffGlobalSearchInput');
        searchInput?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (!location.pathname.startsWith('/staff/reception')) {
      navigate(`/staff/reception?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Dynamic Breadcrumb & Header Title
  const getPageMeta = () => {
    if (location.pathname.startsWith('/staff/reception')) {
      return {
        section: 'Front Desk',
        title: 'Reception & Check-In Terminal',
        subtitle: 'Live guest arrivals, allocations & folios',
      };
    }
    if (location.pathname.startsWith('/staff/accounting')) {
      return {
        section: 'Property Ops',
        title: 'Billing & Financial Ledgers',
        subtitle: 'Folio billing, audits & revenue control',
      };
    }
    if (location.search.includes('view=calendar')) {
      return {
        section: 'Schedule & Availability',
        title: 'Calendar & 14-Day Room Tape Chart',
        subtitle: 'Visual occupancy timeline across all villas & cottages',
      };
    }
    if (location.search.includes('view=rooms')) {
      return {
        section: 'Property Inventory',
        title: 'Rooms & Cottages',
        subtitle: 'Manage unit readiness & nightly rates',
      };
    }
    if (location.search.includes('view=reservations')) {
      return {
        section: 'Front Desk Ledger',
        title: 'Bookings & Reservations Hub',
        subtitle: 'Manual bookings, pending queue allocations & stay ledger',
      };
    }
    if (location.search.includes('view=messages')) {
      return {
        section: 'Guest Communications',
        title: 'Guest Messages Inbox',
        subtitle: 'Direct front desk & tour dispatch inquiries',
      };
    }
    if (location.search.includes('view=housekeeping')) {
      return {
        section: 'Property Operations',
        title: 'Housekeeping & Maintenance',
        subtitle: 'Turnovers, linen refresh & room repair dispatch',
      };
    }
    return {
      section: 'Command Center',
      title: 'Operations Terminal',
      subtitle: 'Room readiness, interactive calendar & queue dispatch',
    };
  };

  const pageMeta = getPageMeta();
  const allowEscalation = canEscalateToRecovery(activeProfile);
  const deptBadge = formatDepartmentBadge(activeProfile);

  // Live Metrics for Top Bar & Sidebar Navigation Badges
  const [headerMetrics, setHeaderMetrics] = useState<{
    occupancyPct: number | null;
    pendingCount: number | null;
    roomsCount: number | null;
    messagesCount: number | null;
    tasksCount: number | null;
  }>({
    occupancyPct: null,
    pendingCount: null,
    roomsCount: null,
    messagesCount: null,
    tasksCount: null,
  });

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api.frontDeskOverview().catch(() => null),
      api.rooms(false).catch(() => []),
      api.conversations().catch(() => []),
      api.departmentTasks().catch(() => []),
    ])
      .then(([res, roomsList, convos, tasksList]) => {
        if (!isMounted) return;
        const pct = res?.overview?.occupancy_pct ?? 0;
        const pending = (res?.bookings || []).filter((b: any) => b.status === 'pending' || b.payment_status === 'pending').length;
        const rCount = Array.isArray(roomsList) ? roomsList.length : 0;
        const mCount = Array.isArray(convos) ? convos.length : 0;
        const tCount = Array.isArray(tasksList) ? tasksList.filter((t: any) => t.status !== 'completed').length : 0;
        setHeaderMetrics({
          occupancyPct: pct,
          pendingCount: pending,
          roomsCount: rCount,
          messagesCount: mCount,
          tasksCount: tCount,
        });
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [location.pathname]);

  // Escalation Handoff Modal State (Preserved 100% of existing functionality)
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [escalationForm, setEscalationForm] = useState({
    reservationId: '',
    category: 'Inventory Overbooking Clash',
    reason: '',
    severity: 'urgent',
  });

  useEffect(() => {
    const handleEscalateEvent = (e: any) => {
      const d = e.detail || {};
      setEscalationForm({
        reservationId: d.reservationId || '',
        category: d.category || 'Inventory Overbooking Clash',
        reason: d.reason || '',
        severity: d.severity || 'urgent',
      });
      setShowEscalationModal(true);
    };
    window.addEventListener('open-staff-escalate', handleEscalateEvent);
    return () => window.removeEventListener('open-staff-escalate', handleEscalateEvent);
  }, []);

  const handleEscalateToRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalationForm.reservationId.trim() || !escalationForm.reason.trim()) {
      toast('Please provide a valid reservation ID and reason for escalation.', true);
      return;
    }

    setSubmitting(true);
    try {
      const resId = escalationForm.reservationId.trim();
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resId);

      if (isUUID) {
        const { error: updateErr } = await supabase
          .from('reservations')
          .update({
            status: 'disputed',
            notes: `[STAFF_ESCALATION (${escalationForm.severity.toUpperCase()})]: ${escalationForm.reason.trim()}`,
          })
          .eq('id', resId);

        if (updateErr) {
          console.warn('[Staff Escalation] Notice updating reservation:', updateErr.message);
        }
      }

      await supabase.from('audit_logs').insert({
        action: 'STAFF_ESCALATE_TO_RECOVERY',
        actor_id: activeProfile?.id || null,
        actor_email: activeProfile?.email || 'staff@resort.ph',
        actor_role: activeProfile?.role || 'staff',
        details: {
          reservation_id: resId,
          category: escalationForm.category,
          severity: escalationForm.severity,
          reason: escalationForm.reason.trim(),
          source_namespace: '/staff',
          target_namespace: '/recovery',
        },
      });

      toast(`✦ Case ${resId} successfully escalated to /recovery in Supabase!`);
      setShowEscalationModal(false);
      setEscalationForm({ reservationId: '', category: 'Inventory Overbooking Clash', reason: '', severity: 'urgent' });
      navigate(`/recovery/cases?ref=${encodeURIComponent(resId)}`);
    } catch (err: any) {
      toast(err.message || 'Failed to submit escalation to database', true);
    } finally {
      setSubmitting(false);
    }
  };

  const userInitials = (activeProfile?.full_name || 'Staff')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0].toUpperCase())
    .join('');

  return (
    <div className="staff-app-shell">
      {/* 1. TOP CLEAN HEADER BAR */}
      <header className="staff-header-bar">
        {/* Left: Sidebar Toggle + Dynamic Page Breadcrumb */}
        <div className="staff-header-left">
          <button
            type="button"
            onClick={toggleSidebar}
            className="staff-icon-btn staff-sidebar-toggle-btn"
            title="Toggle Sidebar Menu"
          >
            <i className="fas fa-table-columns" />
          </button>

          <div className="staff-breadcrumb-box">
            <div className="staff-breadcrumb-row">
              <span>Rock View Resort</span>
              <i className="fas fa-chevron-right staff-breadcrumb-sep" />
              <span className="staff-breadcrumb-active">{pageMeta.section}</span>
            </div>
            <h1 className="staff-header-page-title">{pageMeta.title}</h1>
          </div>
        </div>

        {/* Center: Global Quick Search Bar */}
        <div className="staff-header-center">
          <form onSubmit={handleSearchSubmit} className="staff-search-box">
            <i className="fas fa-magnifying-glass staff-search-icon" />
            <input
              type="text"
              id="staffGlobalSearchInput"
              placeholder="Search guests, rooms, cottages, or tickets…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="staff-search-input"
            />
            <kbd className="staff-search-kbd">/</kbd>
          </form>
        </div>

        {/* Right: Duty Profile & Navigation Actions */}
        <div className="staff-header-right">
          <div className="staff-duty-pill-box" title={`Logged in as ${activeProfile?.email || 'Staff'}`}>
            <div className="staff-duty-avatar">{userInitials || 'ST'}</div>
            <div className="staff-duty-info">
              <span className="staff-duty-name">{activeProfile?.full_name || 'Duty Staff'}</span>
              <span className="staff-duty-role">{deptBadge}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="staff-icon-btn staff-signout-btn"
            title="Sign out of staff terminal"
          >
            <i className="fas fa-arrow-right-from-bracket" />
          </button>
        </div>
      </header>

      {/* 2. BODY: COLLAPSIBLE SIDEBAR + VIEWPORT */}
      <div className="staff-body-wrap">
        {/* Mobile Backdrop */}
        {mobileSidebarOpen && (
          <div
            className="staff-sidebar-backdrop"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Collapsible Left Sidebar */}
        <aside
          className={`staff-sidebar ${isSidebarCollapsed ? 'staff-sidebar--collapsed' : ''} ${mobileSidebarOpen ? 'staff-sidebar--open' : ''}`}
        >
          <div className="staff-sidebar-top">
            {/* Brand Header */}
            <div className="staff-sidebar-brand">
              <div className="staff-brand-icon-box">
                <i className="fas fa-water" />
              </div>
              {!isSidebarCollapsed && (
                <div className="staff-brand-meta">
                  <div className="staff-brand-name">Rock View Resort</div>
                  <div className="staff-brand-loc">Bolinao, Pangasinan</div>
                </div>
              )}
            </div>

            {/* Navigation Section 1: Front Desk */}
            <div className="staff-nav-group">
              {!isSidebarCollapsed && <div className="staff-nav-group-title">Front Desk</div>}
              <nav className="staff-nav-menu">
                <Link
                  to="/staff/operations?view=dashboard"
                  className={`staff-nav-item ${location.pathname.startsWith('/staff/operations') && (!location.search || location.search.includes('view=dashboard')) ? 'active' : ''}`}
                  title="Operations Terminal"
                >
                  <i className="fas fa-table-columns staff-nav-icon" />
                  {!isSidebarCollapsed && <span className="staff-nav-text">Operations Terminal</span>}
                </Link>

                <Link
                  to="/staff/operations?view=calendar"
                  className={`staff-nav-item ${location.search.includes('view=calendar') ? 'active' : ''}`}
                  title="Calendar & Tape Chart"
                >
                  <i className="fas fa-calendar-days staff-nav-icon staff-nav-icon--sky" />
                  {!isSidebarCollapsed && <span className="staff-nav-text">Calendar &amp; Tape Chart</span>}
                </Link>

                <Link
                  to="/staff/operations?view=rooms"
                  className={`staff-nav-item ${location.search.includes('view=rooms') ? 'active' : ''}`}
                  title="Rooms & Cottages"
                >
                  <i className="fas fa-house staff-nav-icon" style={{ color: '#10B981' }} />
                  {!isSidebarCollapsed && (
                    <div className="flex items-center justify-between flex-1">
                      <span className="staff-nav-text">Rooms &amp; Cottages</span>
                      <span className="staff-ops-badge" style={{ fontSize: '10px' }}>
                        {headerMetrics.roomsCount !== null ? headerMetrics.roomsCount : 0}
                      </span>
                    </div>
                  )}
                </Link>

                <Link
                  to="/staff/operations?view=reservations"
                  className={`staff-nav-item ${location.search.includes('view=reservations') ? 'active' : ''}`}
                  title="Bookings & Reservations Queue"
                >
                  <i className="fas fa-calendar-check staff-nav-icon staff-nav-icon--amber" />
                  {!isSidebarCollapsed && (
                    <div className="flex items-center justify-between flex-1">
                      <span className="staff-nav-text">Bookings &amp; Queue</span>
                      <span className="staff-ops-badge" style={{ fontSize: '10px', background: '#FEF3C7', color: '#B45309', borderColor: '#FDE68A' }}>
                        {headerMetrics.pendingCount !== null ? headerMetrics.pendingCount : 0}
                      </span>
                    </div>
                  )}
                </Link>

                <Link
                  to="/staff/operations?view=messages"
                  className={`staff-nav-item ${location.search.includes('view=messages') ? 'active' : ''}`}
                  title="Guest Messages"
                >
                  <i className="fas fa-comments staff-nav-icon staff-nav-icon--indigo" />
                  {!isSidebarCollapsed && (
                    <div className="flex items-center justify-between flex-1">
                      <span className="staff-nav-text">Guest Messages</span>
                      <span className="staff-ops-badge" style={{ fontSize: '10px', background: '#E0F2FE', color: '#0369A1', borderColor: '#BAE6FD' }}>
                        {headerMetrics.messagesCount !== null ? headerMetrics.messagesCount : 0}
                      </span>
                    </div>
                  )}
                </Link>
              </nav>
            </div>

            {/* Navigation Section 2: Property Ops */}
            <div className="staff-nav-group">
              {!isSidebarCollapsed && <div className="staff-nav-group-title">Property Ops</div>}
              <nav className="staff-nav-menu">
                <NavLink
                  to="/staff/accounting"
                  className={({ isActive }) => `staff-nav-item ${isActive ? 'active' : ''}`}
                  title="Billing & Ledgers"
                >
                  <i className="fas fa-calculator staff-nav-icon staff-nav-icon--indigo" />
                  {!isSidebarCollapsed && <span className="staff-nav-text">Billing &amp; Ledgers</span>}
                </NavLink>

                {isExecAdmin && (
                  <Link
                    to="/admin"
                    className="staff-nav-item staff-nav-item--admin"
                    title="Executive Administrator Console"
                  >
                    <i className="fas fa-crown staff-nav-icon staff-nav-icon--purple" />
                    {!isSidebarCollapsed && <span className="staff-nav-text">Admin Console</span>}
                  </Link>
                )}
              </nav>
            </div>
          </div>

          {/* Duty Profile Footer */}
          <div className="staff-sidebar-footer">
            <div className="staff-footer-card">
              <div className="staff-footer-avatar">{userInitials || 'ST'}</div>
              {!isSidebarCollapsed && (
                <div className="staff-footer-meta">
                  <div className="staff-footer-name">{activeProfile?.full_name || 'Staff User'}</div>
                  <div className="staff-footer-role">{deptBadge}</div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* 3. MAIN WORKSPACE VIEWPORT (Separated Layout: Full-Width for Ledgers & Reception, Grid for Dashboard) */}
        <main
          className={`staff-main-viewport ${location.pathname.startsWith('/staff/accounting') ? 'staff-main-viewport--accounting' : ''} ${location.pathname.startsWith('/staff/reception') ? 'staff-main-viewport--reception' : ''}`}
        >
          <div
            className={`staff-page-container ${location.pathname.startsWith('/staff/accounting') ? 'staff-page-container--accounting' : ''} ${location.pathname.startsWith('/staff/reception') ? 'staff-page-container--reception' : ''}`}
          >
            {children}
          </div>
        </main>
      </div>

      {/* Explicit Handoff Modal: Staff -> Recovery */}
      {showEscalationModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowEscalationModal(false)} style={{ zIndex: 99999 }}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="label" style={{ color: '#D97706', fontWeight: 700 }}>Explicit State Handoff</span>
                <h3 className="serif" style={{ fontSize: '1.35rem', margin: '4px 0 0', color: '#0F172A', fontWeight: 700 }}>
                  Escalate Case to /recovery
                </h3>
              </div>
              <button
                disabled={submitting}
                style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '1.4rem', cursor: 'pointer' }}
                onClick={() => setShowEscalationModal(false)}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <p style={{ color: '#64748B', fontSize: '.84rem', margin: '0 0 16px', lineHeight: 1.5 }}>
                Transitions reservation state to <code>disputed</code> in Supabase and routes to the specialized <strong>/recovery</strong> console.
              </p>

              <form onSubmit={handleEscalateToRecovery} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label>RESERVATION ID (UUID)</label>
                  <input
                    required
                    placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                    value={escalationForm.reservationId}
                    onChange={(e) => setEscalationForm({ ...escalationForm, reservationId: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label>CASE CATEGORY</label>
                  <select
                    value={escalationForm.category}
                    onChange={(e) => setEscalationForm({ ...escalationForm, category: e.target.value })}
                  >
                    <option value="Inventory Overbooking Clash">Inventory Overbooking Clash</option>
                    <option value="Digital Keycode Lockout">Digital Keycode Lockout</option>
                    <option value="Billing Discrepancy Dispute">Billing Discrepancy Dispute</option>
                    <option value="Identity / Manifest Mismatch">Identity / Manifest Mismatch</option>
                    <option value="Security / Property Incident">Security / Property Incident</option>
                  </select>
                </div>

                <div className="field">
                  <label>SEVERITY LEVEL</label>
                  <select
                    value={escalationForm.severity}
                    onChange={(e) => setEscalationForm({ ...escalationForm, severity: e.target.value })}
                  >
                    <option value="medium">Medium Priority</option>
                    <option value="urgent">Urgent (Guest Waiting at Front Desk)</option>
                    <option value="critical">Critical (Financial / Legal Escalation)</option>
                  </select>
                </div>

                <div className="field">
                  <label>DISPATCH NOTE / INCIDENT NARRATIVE</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe the operational conflict requiring recovery intervention..."
                    value={escalationForm.reason}
                    onChange={(e) => setEscalationForm({ ...escalationForm, reason: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={submitting}
                    onClick={() => setShowEscalationModal(false)}
                    style={{ border: '1px solid #CBD5E1', color: '#475569', borderRadius: 8, padding: '8px 16px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      borderRadius: 8,
                      padding: '8px 18px',
                      cursor: 'pointer',
                    }}
                  >
                    {submitting ? 'Updating Database…' : 'Dispatch & Transfer →'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
