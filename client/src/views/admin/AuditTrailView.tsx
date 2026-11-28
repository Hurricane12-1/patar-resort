import React, { useState, useEffect } from 'react';
import { getManilaTodayISO, addDaysISO } from '../../lib/offeringSpecs';
import { api } from '../../lib/api';
import { ResortSpinner, SkeletonTable } from '../../components/LoadingAnimations';

export interface AuditTrailViewProps {
  auditLogs: any[];
  setAuditLogs: React.Dispatch<React.SetStateAction<any[]>>;
  loadingAudit: boolean;
  fetchAuditLogs: () => void;
  auditAutoRefresh: boolean;
  setAuditAutoRefresh: (val: boolean) => void;
  securityPosture: any;
  handleUnbanIp: (ip: string) => void;
  toast: (msg: string, isError?: boolean) => void;
  isLightMode: boolean;
  themeCardBg: string;
  themeBorder: string;
  themeShadow: string;
  themeText: string;
  themeMuted: string;
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({
  auditLogs,
  setAuditLogs,
  loadingAudit,
  fetchAuditLogs,
  auditAutoRefresh,
  setAuditAutoRefresh,
  securityPosture,
  handleUnbanIp,
  toast,
  isLightMode,
  themeCardBg,
  themeBorder,
  themeShadow,
  themeText,
  themeMuted,
}) => {
  const [auditRoleFilter, setAuditRoleFilter] = useState<string>(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_audit_role_filter');
      return (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_audit_role_filter') : 'employee') || 'employee';
    } catch {
      return 'employee';
    }
  });
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_audit_role_filter');
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('jd_admin_audit_role_filter', auditRoleFilter);
    } catch {}
  }, [auditRoleFilter]);

  const [auditDateFilter, setAuditDateFilter] = useState<string>(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_audit_date_filter');
      return (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_audit_date_filter') : 'ALL') || 'ALL';
    } catch {
      return 'ALL';
    }
  });
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_audit_date_filter');
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('jd_admin_audit_date_filter', auditDateFilter);
    } catch {}
  }, [auditDateFilter]);

  const [auditSearchQuery, setAuditSearchQuery] = useState<string>(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_audit_search');
      return (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_audit_search') : '') || '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_audit_search');
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('jd_admin_audit_search', auditSearchQuery);
    } catch {}
  }, [auditSearchQuery]);

  const [auditActionFilter, setAuditActionFilter] = useState<string>(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_audit_action_filter');
      return (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_audit_action_filter') : 'ALL') || 'ALL';
    } catch {
      return 'ALL';
    }
  });
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_audit_action_filter');
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('jd_admin_audit_action_filter', auditActionFilter);
    } catch {}
  }, [auditActionFilter]);
  const [inspectAuditLog, setInspectAuditLog] = useState<any>(null);

  const filteredLogs = auditLogs.filter((log: any) => {
    // 1. Role / Category Scope Filter
    if (auditRoleFilter === 'employee') {
      const isCust = log.category === 'CLIENT' || log.action === 'CUSTOMER_LOGIN' || ['customer', 'client'].includes(log.role?.toLowerCase());
      if (isCust) return false;
    } else if (auditRoleFilter === 'client') {
      const isCust = log.category === 'CLIENT' || log.action === 'CUSTOMER_LOGIN' || ['customer', 'client'].includes(log.role?.toLowerCase());
      if (!isCust) return false;
    }

    // 2. Date Filter
    if (auditDateFilter !== 'ALL') {
      const rawTs = log.timestamp || log.created_at || '';
      const dStr = rawTs.slice(0, 10);
      if (auditDateFilter === 'WEEK') {
        if (dStr < addDaysISO(getManilaTodayISO(), -6) || dStr > getManilaTodayISO()) return false;
      } else if (dStr !== auditDateFilter) return false;
    }

    // 3. Action Type Filter
    if (auditActionFilter !== 'ALL') {
      const act = String(log.action || '').toUpperCase();
      if (!act.includes(auditActionFilter)) return false;
    }

    // 4. Search Query
    if (auditSearchQuery.trim()) {
      const q = auditSearchQuery.toLowerCase();
      const actorName = (log.actor_name || '').toLowerCase();
      const actorEmail = (log.actor_email || '').toLowerCase();
      const action = (log.action || '').toLowerCase();
      const ip = (log.ip_address || '').toLowerCase();
      const device = (log.device || '').toLowerCase();
      const details = typeof log.details === 'object' ? JSON.stringify(log.details).toLowerCase() : String(log.details || '').toLowerCase();
      if (!actorName.includes(q) && !actorEmail.includes(q) && !action.includes(q) && !ip.includes(q) && !device.includes(q) && !details.includes(q)) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24, boxShadow: themeShadow }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="label light" style={{ color: '#0EA5E9' }}>
              <i className="fas fa-list-check" style={{ marginRight: 6 }} /> User Activity & Audit Logs
            </span>
            <span style={{ fontSize: '.72rem', color: '#10B981', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 12, border: '1px solid rgba(16,185,129,0.3)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
              LIVE RECORDING
            </span>
          </div>
          <h3 className="serif" style={{ fontSize: '1.6rem', margin: '4px 0 0', color: themeText }}>System Audit Trail</h3>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Tamper-evident logs recording employee actions, client logins, devices, and execution branches.</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([JSON.stringify(auditLogs, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              toast('Audit logs exported to JSON');
            }}
            style={{ border: '1px solid #006699', background: 'transparent', color: isLightMode ? '#006699' : '#7DD3FC', fontWeight: 600, fontSize: '.84rem', borderRadius: 8, padding: '7px 14px', boxShadow: 'none', textTransform: 'none', letterSpacing: 'normal', cursor: 'pointer' }}
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* AUDIT KPIS ROW */}
      <div className="admin-grid-4-col" style={{ marginBottom: 20 }}>
        <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <i className="fas fa-list-check" style={{ color: '#0EA5E9', fontSize: '.85rem' }} />
            <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700 }}>TOTAL ACTIONS RECORDED</span>
          </div>
          <b style={{ display: 'block', fontSize: '1.5rem', color: '#0EA5E9', marginTop: 2 }}>{auditLogs.length}</b>
          <small style={{ fontSize: '.7rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
            <i className="fas fa-circle-check" /> Active Ring Buffer Synced
          </small>
        </div>
        <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <i className="fas fa-user-shield" style={{ color: '#8B5CF6', fontSize: '.85rem' }} />
            <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700 }}>ADMINISTRATOR PROCESSES</span>
          </div>
          <b style={{ display: 'block', fontSize: '1.5rem', color: '#8B5CF6', marginTop: 2 }}>
            {auditLogs.filter((l) => ['administrator', 'admin', 'system'].includes(l.role?.toLowerCase()) || ['administrator', 'admin', 'system'].includes(l.actor_role?.toLowerCase())).length}
          </b>
          <small style={{ fontSize: '.7rem', color: '#8B5CF6' }}>Executive Operations</small>
        </div>
        <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <i className="fas fa-user-tie" style={{ color: '#0EA5E9', fontSize: '.85rem' }} />
            <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700 }}>EMPLOYEE & STAFF ACTIONS</span>
          </div>
          <b style={{ display: 'block', fontSize: '1.5rem', color: '#0EA5E9', marginTop: 2 }}>
            {auditLogs.filter((l) => l.category === 'EMPLOYEE' || (!['customer', 'client'].includes(l.role?.toLowerCase()) && l.action !== 'CUSTOMER_LOGIN')).length}
          </b>
          <small style={{ fontSize: '.7rem', color: '#0EA5E9' }}>Front Desk, Billing & Rooms</small>
        </div>
        <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <i className="fas fa-users" style={{ color: '#10B981', fontSize: '.85rem' }} />
            <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700 }}>CLIENT RECORDINGS</span>
          </div>
          <b style={{ display: 'block', fontSize: '1.5rem', color: '#10B981', marginTop: 2 }}>
            {auditLogs.filter((l) => l.category === 'CLIENT' || l.action === 'CUSTOMER_LOGIN' || ['customer', 'client'].includes(l.role?.toLowerCase())).length}
          </b>
          <small style={{ fontSize: '.7rem', color: '#10B981' }}>Verified Guest Access Timestamps</small>
        </div>
      </div>

      {/* LOG FILTER CONTROLS BAR: USER DROPDOWN, DAY SELECTOR, SEARCH */}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {/* Primary Dropdown Filter for Category */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ fontSize: '.8rem', fontWeight: 800, color: themeText, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-filter" style={{ color: '#0EA5E9' }} /> ACTOR SCOPE:
            </label>
            <select
              value={auditRoleFilter}
              onChange={(e) => setAuditRoleFilter(e.target.value)}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                border: `1px solid ${themeBorder}`,
                background: isLightMode ? '#FFF' : '#1E293B',
                color: themeText,
                fontSize: '.84rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <option value="employee">Employee Recordings (Default)</option>
              <option value="client">Client Recordings</option>
              <option value="ALL">All Users</option>
            </select>

            {/* Specific Day Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 10 }}>
              <span style={{ fontSize: '.84rem', fontWeight: 800, color: themeText, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-calendar-alt" style={{ color: '#0EA5E9' }} /> SELECT DAY:
              </span>
              <input
                type="date"
                value={auditDateFilter === 'ALL' || auditDateFilter === 'WEEK' ? '' : auditDateFilter}
                onChange={(e) => setAuditDateFilter(e.target.value || 'ALL')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: `1px solid ${themeBorder}`,
                  background: isLightMode ? '#FFF' : 'rgba(30,41,59,0.9)',
                  color: themeText,
                  fontSize: '.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              />
              <select
                aria-label="Quick date range"
                value={
                  auditDateFilter === 'ALL' ? 'ALL'
                  : auditDateFilter === 'WEEK' ? 'WEEK'
                  : auditDateFilter === getManilaTodayISO() ? 'TODAY'
                  : auditDateFilter === addDaysISO(getManilaTodayISO(), -1) ? 'YESTERDAY'
                  : 'CUSTOM'
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'ALL') setAuditDateFilter('ALL');
                  else if (v === 'WEEK') setAuditDateFilter('WEEK');
                  else if (v === 'TODAY') setAuditDateFilter(getManilaTodayISO());
                  else if (v === 'YESTERDAY') setAuditDateFilter(addDaysISO(getManilaTodayISO(), -1));
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: `1px solid ${themeBorder}`,
                  background: isLightMode ? '#FFF' : '#1E293B',
                  color: themeText,
                  fontSize: '.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All Days</option>
                <option value="WEEK">This Week</option>
                <option value="YESTERDAY">Yesterday</option>
                <option value="TODAY">Today</option>
                {auditDateFilter !== 'ALL' && auditDateFilter !== 'WEEK' && auditDateFilter !== getManilaTodayISO() && auditDateFilter !== addDaysISO(getManilaTodayISO(), -1) && (
                  <option value="CUSTOM">Picked day</option>
                )}
              </select>
            </div>
          </div>

          {/* Real-time search */}
          <div style={{ position: 'relative', minWidth: 260 }}>
            <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: themeMuted, fontSize: '.8rem' }} />
            <input
              className="search"
              placeholder="Search actor, action, IP, device…"
              value={auditSearchQuery}
              onChange={(e) => setAuditSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: 32, height: 36, fontSize: '.82rem', background: isLightMode ? '#FFF' : undefined, color: themeText }}
            />
          </div>
        </div>

        {/* Secondary Action Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', borderTop: `1px solid ${themeBorder}`, paddingTop: 10 }}>
          <span style={{ fontSize: '.72rem', fontWeight: 700, color: themeMuted, marginRight: 4 }}>
            ACTION TYPE:
          </span>
          <select
            aria-label="Action type"
            value={auditActionFilter}
            onChange={(e) => setAuditActionFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: `1px solid ${themeBorder}`,
              background: isLightMode ? '#FFF' : '#1E293B',
              color: themeText,
              fontSize: '.82rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Actions</option>
            <option value="LOGIN">Logins</option>
            <option value="ROOM">Rooms</option>
            <option value="BOOKING">Reservations</option>
            <option value="INVENTORY">Supplies</option>
            <option value="PROVISIONED">Accounts</option>
          </select>
        </div>
      </div>

      {/* AUDIT LOG TABLE */}
      {loadingAudit && filteredLogs.length === 0 ? (
        <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <ResortSpinner size="md" variant="indigo" icon="shield-halved" message="Fetching immutable security audit logs…" submessage="Streaming verified access trails and administrative events." />
          <div style={{ width: '100%' }}>
            <SkeletonTable rows={5} />
          </div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', border: `1px dashed ${themeBorder}`, borderRadius: 12 }}>
          <i className="fas fa-clipboard-list" style={{ fontSize: '2.4rem', color: themeMuted, display: 'block', marginBottom: 10 }} />
          <h4 style={{ margin: '8px 0 4px', color: themeText }}>No Actions Recorded For Selected Criteria</h4>
          <p className="muted small">
            {auditRoleFilter === 'employee'
              ? 'No employee activity logs recorded for the selected date range.'
              : auditRoleFilter === 'client'
              ? 'No client access logs recorded for the selected date range.'
              : 'No activity logs found. Switch filters or click "All Days" to inspect all history.'}
          </p>
          <button
            className="btn btn-sky btn-sm"
            onClick={() => { setAuditDateFilter('ALL'); setAuditRoleFilter('employee'); setAuditActionFilter('ALL'); setAuditSearchQuery(''); }}
            style={{ marginTop: 12 }}
          >
            <i className="fas fa-rotate-left" style={{ marginRight: 6 }} /> Reset Filters
          </button>
        </div>
      ) : (
        <div style={{ maxHeight: 560, overflowY: 'auto', borderRadius: 12, border: `1px solid ${themeBorder}` }}>
          <table style={{ width: '100%', fontSize: '.8rem', borderCollapse: 'collapse', color: themeText }}>
            <thead>
              <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.9)', position: 'sticky', top: 0, zIndex: 10 }}>
                <th style={{ padding: '12px 14px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>DATE & TIME</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>ACTOR / USER</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>ACTION MADE</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>DEVICE & BROWSER</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>IP ADDRESS</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', color: themeMuted, fontWeight: 700, fontSize: '.72rem' }}>BRANCHES OF ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log: any) => {
                const act = String(log.action || '').toUpperCase();
                const isCustomer = log.category === 'CLIENT' || log.role === 'customer' || log.actor_role === 'customer' || act === 'CUSTOMER_LOGIN';
                const isAdmin = !isCustomer && (['administrator', 'admin', 'system'].includes(log.role?.toLowerCase()) || ['administrator', 'admin', 'system'].includes(log.actor_role?.toLowerCase()) || act.startsWith('ADMIN'));

                // Humanized process descriptions & FontAwesome icon
                let processTitle = act.replace(/_/g, ' ');
                let processColor = '#0EA5E9';
                let processBg = 'rgba(14,165,233,0.12)';
                let processBorder = 'rgba(14,165,233,0.3)';
                let processFaIcon: string | null = null;
                let processSummary = typeof log.details === 'object' ? (log.details.message || JSON.stringify(log.details)) : String(log.details || '');

                if (act === 'CUSTOMER_LOGIN') {
                  processTitle = 'Customer Sign-In';
                  processColor = '#10B981';
                  processBg = 'rgba(16,185,129,0.15)';
                  processBorder = 'rgba(16,185,129,0.35)';
                  processFaIcon = 'fa-user-check';
                  processSummary = 'Customer login timestamp recorded (credentials verified)';
                } else if (act === 'ADMIN_LOGIN') {
                  processTitle = 'Administrator Login';
                  processColor = '#8B5CF6';
                  processBg = 'rgba(139,92,246,0.15)';
                  processBorder = 'rgba(139,92,246,0.35)';
                  processSummary = log.details?.message || 'Executive administrator logged into administrative portal';
                } else if (act === 'STAFF_LOGIN') {
                  processTitle = 'Staff Authenticated';
                  processColor = '#0EA5E9';
                  processBg = 'rgba(14,165,233,0.15)';
                  processBorder = 'rgba(14,165,233,0.35)';
                  processFaIcon = 'fa-user-tie';
                  processSummary = log.details?.message || `Staff member (${log.details?.staff_role || log.role || 'staff'}) signed in`;
                } else if (act === 'ROOM_CREATE') {
                  processTitle = 'Created Room';
                  processColor = '#10B981';
                  processBg = 'rgba(16,185,129,0.15)';
                  processBorder = 'rgba(16,185,129,0.35)';
                  processFaIcon = 'fa-bed';
                  processSummary = log.details?.name ? `Created ${log.details.name} (₱${log.details.rate_php?.toLocaleString() || 0}/night)` : 'New room created in database';
                } else if (act === 'ROOM_UPDATE') {
                  processTitle = 'Updated Room / Villa';
                  processColor = '#0EA5E9';
                  processBg = 'rgba(14,165,233,0.15)';
                  processBorder = 'rgba(14,165,233,0.35)';
                  processFaIcon = 'fa-pen-to-square';
                  processSummary = typeof log.details === 'object' ? Object.keys(log.details).map((k) => `${k}: ${log.details[k]}`).slice(0, 3).join(', ') : String(log.details);
                } else if (act === 'ROOM_DEACTIVATE') {
                  processTitle = 'Deactivated Room';
                  processColor = '#F43F5E';
                  processBg = 'rgba(244,63,94,0.15)';
                  processBorder = 'rgba(244,63,94,0.35)';
                  processFaIcon = 'fa-ban';
                  processSummary = 'Room marked inactive and hidden from booking';
                } else if (act === 'ROOM_REMOVE' || act === 'ROOM_DELETE_PERMANENT') {
                  const d = log.details || {};
                  const facts = [d.category, Number(d.rate_php) > 0 ? `₱${Number(d.rate_php).toLocaleString()}/night` : ''].filter(Boolean).join(', ');
                  const kept = Number(d.bookings_on_record);
                  const history = kept > 0 ? `. ${kept} past booking${kept === 1 ? '' : 's'} kept without a room` : '';
                  processTitle = 'Removed Room';
                  processColor = '#F43F5E';
                  processBg = 'rgba(244,63,94,0.15)';
                  processBorder = 'rgba(244,63,94,0.35)';
                  processFaIcon = 'fa-trash-can';
                  processSummary = d.name ? `Removed ${d.name}${facts ? ` (${facts})` : ''}${history}` : 'Room permanently removed from the resort';
                } else if (act === 'ROOM_REMOVE_BLOCKED') {
                  processTitle = 'Room Removal Blocked';
                  processColor = '#F59E0B';
                  processBg = 'rgba(245,158,11,0.15)';
                  processBorder = 'rgba(245,158,11,0.35)';
                  processFaIcon = 'fa-ban';
                  processSummary = log.details?.message || 'A room removal was refused';
                } else if (act === 'BOOKING_CREATE') {
                  processTitle = 'Created Reservation';
                  processColor = '#10B981';
                  processBg = 'rgba(16,185,129,0.15)';
                  processBorder = 'rgba(16,185,129,0.35)';
                  processFaIcon = 'fa-calendar-plus';
                  processSummary = log.details?.room ? `${log.details.room} • Guest: ${log.details.guest_name || 'Guest'} • ₱${log.details.total_php?.toLocaleString() || 0}` : 'Reservation booked into system';
                } else if (act === 'BOOKING_STATUS_UPDATE') {
                  processTitle = `Booking: ${log.details?.status || 'Status Change'}`;
                  processColor = '#0EA5E9';
                  processBg = 'rgba(14,165,233,0.15)';
                  processBorder = 'rgba(14,165,233,0.35)';
                  processFaIcon = 'fa-arrows-rotate';
                  processSummary = `Updated to ${log.details?.status || 'status'} for ${log.details?.guest_name || 'guest'}`;
                } else if (act === 'REFUND_REQUESTED') {
                  processTitle = 'Refund Requested';
                  processColor = '#F59E0B';
                  processBg = 'rgba(245,158,11,0.15)';
                  processBorder = 'rgba(245,158,11,0.35)';
                  processFaIcon = 'fa-hand-holding-dollar';
                  processSummary = `Refund of ₱${log.details?.amount?.toLocaleString() || 0} requested for ${log.details?.guest_name || 'guest'}`;
                } else if (act === 'REFUND_CONFIRMED') {
                  processTitle = 'Refund Confirmed';
                  processColor = '#10B981';
                  processBg = 'rgba(16,185,129,0.15)';
                  processBorder = 'rgba(16,185,129,0.35)';
                  processFaIcon = 'fa-receipt';
                  processSummary = `Refund of ₱${log.details?.amount?.toLocaleString() || 0} confirmed (Ref: ${log.details?.ref || 'N/A'})`;
                } else if (act.startsWith('INVENTORY')) {
                  processTitle = act.replace(/_/g, ' ');
                  processColor = '#8B5CF6';
                  processBg = 'rgba(139,92,246,0.15)';
                  processBorder = 'rgba(139,92,246,0.35)';
                  processFaIcon = 'fa-boxes-stacked';
                }

                // Parse Device & Browser Telemetry
                const dev = log.device || (log.user_agent?.includes('Mobile') ? 'Mobile' : log.user_agent?.includes('Tablet') ? 'Tablet' : 'Desktop');
                const browser = log.browser || (log.user_agent?.includes('Edg') ? 'Edge' : log.user_agent?.includes('Chrome') ? 'Chrome' : log.user_agent?.includes('Safari') ? 'Safari' : log.user_agent?.includes('Firefox') ? 'Firefox' : 'Browser');
                const os = log.os || (log.user_agent?.includes('Windows') ? 'Windows' : log.user_agent?.includes('Mac') ? 'macOS' : log.user_agent?.includes('Android') ? 'Android' : log.user_agent?.includes('iPhone') ? 'iOS' : 'Linux');
                const devIcon = dev === 'Mobile' ? 'fa-mobile-screen' : dev === 'Tablet' ? 'fa-tablet-screen-button' : 'fa-desktop';

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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <i className="fas fa-calendar-day" style={{ color: '#0EA5E9', fontSize: '.75rem' }} />
                        <b style={{ fontSize: '.78rem', color: themeText }}>{logDateStr}</b>
                      </div>
                      <span style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontSize: '.72rem', color: themeMuted, paddingLeft: 18, display: 'block' }}>
                        {logTimeStr}
                      </span>
                    </td>

                    {/* 2. ACTOR & ROLE */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                              {isAdmin ? 'ADMIN' : isCustomer ? 'CLIENT' : 'STAFF'}
                            </span>
                          </div>
                          <span style={{ fontSize: '.7rem', color: themeMuted, display: 'block' }}>{log.actor_email}</span>
                        </div>
                      </div>
                    </td>

                    {/* 3. ACTION MADE */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 6, fontSize: '.68rem', fontWeight: 800,
                          background: processBg, color: processColor, border: `1px solid ${processBorder}`,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          {processFaIcon && <i className={`fas ${processFaIcon}`} />}
                          {act}
                        </span>
                      </div>
                      <span style={{ fontSize: '.78rem', fontWeight: 700, color: themeText, display: 'block' }}>
                        {processTitle}
                      </span>
                      <small style={{ fontSize: '.7rem', color: themeMuted, display: 'block', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {processSummary}
                      </small>
                    </td>

                    {/* 4. DEVICE & BROWSER */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: 6,
                          background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.06)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#0EA5E9', fontSize: '.8rem',
                        }}>
                          <i className={`fas ${devIcon}`} />
                        </div>
                        <div>
                          <b style={{ fontSize: '.78rem', color: themeText, display: 'block' }}>
                            {dev} ({os})
                          </b>
                          <small style={{ fontSize: '.7rem', color: themeMuted }}>
                            {browser}
                          </small>
                        </div>
                      </div>
                    </td>

                    {/* 5. IP ADDRESS */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontSize: '.75rem', color: themeText, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <i className="fas fa-network-wired" style={{ color: themeMuted, fontSize: '.7rem' }} />
                        {log.ip_address || '127.0.0.1'}
                      </span>
                    </td>

                    {/* 6. BRANCHES OF ACTION */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setInspectAuditLog(log)}
                        className="btn btn-ghost btn-sm"
                        style={{
                          fontSize: '.72rem',
                          padding: '4px 10px',
                          borderRadius: 8,
                          border: '1px solid #0EA5E9',
                          background: '#0EA5E9',
                          boxShadow: 'none',
                          color: '#000000',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <i className="fas fa-code-branch" /> View Branches
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* AUDIT RECORD INSPECT MODAL: 4 STRUCTURED BRANCHES OF ACTION */}
      {inspectAuditLog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            maxWidth: 680, width: '100%',
            background: isLightMode ? '#FFFFFF' : '#0B1426',
            border: `1px solid ${themeBorder}`, borderRadius: 18,
            padding: 24, boxShadow: '0 25px 60px -15px rgba(0,0,0,0.7)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 14 }}>
              <div>
                <span style={{
                  fontSize: '.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                  background: 'rgba(14,165,233,0.15)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.3)',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  <i className="fas fa-code-branch" /> AUDIT RECORD INSPECTION • ACTION BRANCH TELEMETRY
                </span>
                <h3 style={{ margin: '6px 0 2px', fontSize: '1.25rem', color: themeText }}>
                  {inspectAuditLog.action}
                </h3>
                <span style={{ fontSize: '.75rem', color: themeMuted, fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>
                  Record ID: #{inspectAuditLog.id} • {new Date(inspectAuditLog.timestamp || inspectAuditLog.created_at).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setInspectAuditLog(null)}
                style={{ background: 'transparent', border: 'none', color: themeMuted, fontSize: '1.4rem', cursor: 'pointer' }}
              >
                <i className="fas fa-xmark" />
              </button>
            </div>

            {/* 4 STRUCTURED BRANCHES */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* BRANCH 1: ACTOR & IDENTITY */}
              <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 10, border: `1px solid ${themeBorder}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <i className="fas fa-user-circle" style={{ color: '#0EA5E9' }} />
                  <b style={{ fontSize: '.8rem', color: themeText, textTransform: 'uppercase' }}>Branch 1: Actor & Identity Context</b>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <div>
                    <small style={{ fontSize: '.68rem', color: themeMuted, display: 'block' }}>NAME</small>
                    <span style={{ fontSize: '.8rem', fontWeight: 700, color: themeText }}>{inspectAuditLog.actor_name || 'System User'}</span>
                  </div>
                  <div>
                    <small style={{ fontSize: '.68rem', color: themeMuted, display: 'block' }}>EMAIL / DOMAIN</small>
                    <span style={{ fontSize: '.8rem', color: themeText }}>{inspectAuditLog.actor_email}</span>
                  </div>
                  <div>
                    <small style={{ fontSize: '.68rem', color: themeMuted, display: 'block' }}>ROLE / CLASSIFICATION</small>
                    <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#0EA5E9' }}>
                      {inspectAuditLog.role || inspectAuditLog.actor_role || 'STAFF'} ({inspectAuditLog.category || 'EMPLOYEE'})
                    </span>
                  </div>
                </div>
              </div>

              {/* BRANCH 2: TARGET RESOURCE */}
              <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 10, border: `1px solid ${themeBorder}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <i className="fas fa-cubes" style={{ color: '#8B5CF6' }} />
                  <b style={{ fontSize: '.8rem', color: themeText, textTransform: 'uppercase' }}>Branch 2: Target Resource & Operational Scope</b>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <div>
                    <small style={{ fontSize: '.68rem', color: themeMuted, display: 'block' }}>RESOURCE TYPE</small>
                    <span style={{ fontSize: '.8rem', fontWeight: 700, color: themeText }}>{inspectAuditLog.resource_type || 'System'}</span>
                  </div>
                  <div>
                    <small style={{ fontSize: '.68rem', color: themeMuted, display: 'block' }}>RESOURCE IDENTIFIER</small>
                    <span style={{ fontSize: '.8rem', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', color: themeMuted }}>#{inspectAuditLog.resource_id || 'N/A'}</span>
                  </div>
                  <div>
                    <small style={{ fontSize: '.68rem', color: themeMuted, display: 'block' }}>EXECUTION STATE</small>
                    <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#10B981' }}>COMPLETED & COMMITTED</span>
                  </div>
                </div>
              </div>

              {/* BRANCH 3: DEVICE & CLIENT TELEMETRY */}
              <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 10, border: `1px solid ${themeBorder}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <i className="fas fa-laptop" style={{ color: '#10B981' }} />
                  <b style={{ fontSize: '.8rem', color: themeText, textTransform: 'uppercase' }}>Branch 3: Device & Network Telemetry</b>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 8 }}>
                  <div>
                    <small style={{ fontSize: '.68rem', color: themeMuted, display: 'block' }}>DEVICE CLASS</small>
                    <span style={{ fontSize: '.8rem', fontWeight: 700, color: themeText }}>{inspectAuditLog.device || 'Desktop'}</span>
                  </div>
                  <div>
                    <small style={{ fontSize: '.68rem', color: themeMuted, display: 'block' }}>WEB BROWSER</small>
                    <span style={{ fontSize: '.8rem', fontWeight: 700, color: themeText }}>{inspectAuditLog.browser || 'Chrome'}</span>
                  </div>
                  <div>
                    <small style={{ fontSize: '.68rem', color: themeMuted, display: 'block' }}>OPERATING SYSTEM</small>
                    <span style={{ fontSize: '.8rem', fontWeight: 700, color: themeText }}>{inspectAuditLog.os || 'Windows'}</span>
                  </div>
                  <div>
                    <small style={{ fontSize: '.68rem', color: themeMuted, display: 'block' }}>IP ADDRESS</small>
                    <span style={{ fontSize: '.8rem', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', color: '#0EA5E9' }}>{inspectAuditLog.ip_address || '127.0.0.1'}</span>
                  </div>
                </div>
                <small style={{ fontSize: '.68rem', color: themeMuted, display: 'block', wordBreak: 'break-all' }}>
                  <b>Raw User Agent:</b> {inspectAuditLog.user_agent || 'Client'}
                </small>
              </div>

              {/* BRANCH 4: EXECUTION PAYLOAD */}
              <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 10, border: `1px solid ${themeBorder}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <i className="fas fa-code" style={{ color: '#F59E0B' }} />
                  <b style={{ fontSize: '.8rem', color: themeText, textTransform: 'uppercase' }}>Branch 4: Execution Payload & Action Mutation</b>
                </div>
                <pre style={{
                  background: isLightMode ? '#F1F5F9' : '#030712',
                  padding: 12, borderRadius: 8, fontSize: '.75rem',
                  fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', overflowX: 'auto', margin: 0,
                  border: `1px solid ${themeBorder}`, color: isLightMode ? '#0F172A' : '#38BDF8',
                }}>
                  {JSON.stringify(inspectAuditLog.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(inspectAuditLog, null, 2));
                  toast('Full audit record copied to clipboard');
                }}
                className="btn btn-sm"
                style={{ border: `1px solid ${themeBorder}`, color: themeText, fontWeight: 700 }}
              >
                <i className="fas fa-copy" style={{ marginRight: 6 }} /> Copy JSON
              </button>
              <button
                onClick={() => setInspectAuditLog(null)}
                className="btn btn-sky btn-sm"
                style={{ fontWeight: 700 }}
              >
                <i className="fas fa-check" style={{ marginRight: 6 }} /> Close Branches
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
