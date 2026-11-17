import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { money } from '../../lib/format';
import { EMPLOYEE_ROLE_PRESETS, formatDepartmentBadge, isInternalEmployee, normalizeDepartment, normalizeRole } from '../../lib/rbac';
import { ResortSpinner, SkeletonTable } from '../../components/LoadingAnimations';

export interface AccountDirectoryViewProps {
  users: any[];
  searchingUsers: boolean;
  fetchUsers: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleRoleChange: (userId: string, newRole: string, department?: string) => void;
  setNewStaff: (staff: any) => void;
  setShowCreateModal: (show: boolean) => void;
  setEditingUser: (user: any) => void;
  setRecoveryTarget: (user: any) => void;
  setNewPassword: (pwd: string) => void;
  setUserToDelete: (user: any) => void;
  isLightMode: boolean;
  themeCardBg: string;
  themeBorder: string;
  themeShadow: string;
  themeText: string;
  themeMuted: string;
}

export const AccountDirectoryView: React.FC<AccountDirectoryViewProps> = ({
  users,
  searchingUsers,
  fetchUsers,
  searchQuery,
  setSearchQuery,
  handleRoleChange,
  setNewStaff,
  setShowCreateModal,
  setEditingUser,
  setRecoveryTarget,
  setNewPassword,
  setUserToDelete,
  isLightMode,
  themeCardBg,
  themeBorder,
  themeShadow,
  themeText,
  themeMuted,
}) => {
  const [accountsSubTab, setAccountsSubTab] = useState<'staff' | 'customers'>(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_accounts_subtab');
      const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_accounts_subtab') : null;
      if (saved === 'staff' || saved === 'customers') return saved;
    } catch {}
    return 'staff';
  });
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_accounts_subtab');
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('jd_admin_accounts_subtab', accountsSubTab);
    } catch {}
  }, [accountsSubTab]);

  const [roleFilter, setRoleFilter] = useState<string>(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_accounts_role_filter');
      return (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_accounts_role_filter') : '') || '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_accounts_role_filter');
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('jd_admin_accounts_role_filter', roleFilter);
    } catch {}
  }, [roleFilter]);

  const [openActionMenu, setOpenActionMenu] = useState<{ id: string; rect: DOMRect; user: any } | null>(null);

  useEffect(() => {
    if (!openActionMenu) return;
    const handleClose = () => setOpenActionMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenActionMenu(null);
    };
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openActionMenu]);

  return (
    <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: '20px 24px', boxShadow: themeShadow }}>
      {/* Header */}
      <div className="admin-tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
        <div style={{ borderLeft: '3px solid #0284C7', paddingLeft: 10 }}>
          <h3 className="serif" style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: themeText, letterSpacing: '-0.01em' }}>Accounts Directory</h3>
          <p className="muted small" style={{ margin: '3px 0 0', fontSize: '.8rem', color: themeMuted }}>Manage staff credentials, customer profiles, and account recovery.</p>
        </div>
        <div className="admin-tab-header-actions" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <input
            className="search"
            placeholder="Search by name, email, or phone…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              minWidth: 200,
              maxWidth: 260,
              padding: '7px 12px',
              borderRadius: 8,
              border: `1px solid ${isLightMode ? '#CBD5E1' : themeBorder}`,
              background: isLightMode ? '#FFF' : 'rgba(255,255,255,0.05)',
              color: themeText,
              fontSize: '.8rem',
              outline: 'none',
            }}
          />
          <button
            type="button"
            title="Reload live accounts from database"
            onClick={() => fetchUsers()}
            disabled={searchingUsers}
            style={{
              border: `1px solid ${isLightMode ? '#CBD5E1' : themeBorder}`,
              color: themeText,
              background: isLightMode ? '#FFF' : 'rgba(255,255,255,0.05)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 8,
              fontSize: '.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <i className={`fas fa-rotate ${searchingUsers ? 'fa-spin' : ''}`} style={{ fontSize: '.75rem' }} /> {searchingUsers ? 'Loading…' : 'Refresh'}
          </button>
          {accountsSubTab === 'staff' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  boxShadow: '0 1px 3px rgba(217, 119, 6, 0.25)',
                  borderRadius: 8,
                  padding: '7px 14px',
                  fontSize: '.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
                onClick={() => {
                  setNewStaff({ first_name: '', middle_name: '', last_name: '', full_name: '', email: '', password: '', phone: '', role: 'administrator', department: 'management' });
                  setShowCreateModal(true);
                }}
              >
                <i className="fas fa-crown" style={{ fontSize: '.75rem' }} /> Provision Administrator
              </button>
              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: `1px solid ${isLightMode ? '#CBD5E1' : 'rgba(255,255,255,0.16)'}`,
                  color: isLightMode ? '#0F172A' : '#F8FAFC',
                  background: isLightMode ? '#FFF' : 'rgba(255,255,255,0.06)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  borderRadius: 8,
                  padding: '7px 14px',
                  fontSize: '.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
                onClick={() => {
                  setNewStaff({ first_name: '', middle_name: '', last_name: '', full_name: '', email: '', password: '', phone: '', role: 'staff', department: 'front_desk' });
                  setShowCreateModal(true);
                }}
              >
                <i className="fas fa-shield-halved" style={{ fontSize: '.75rem', color: isLightMode ? '#0284C7' : '#38BDF8' }} /> Provision Staff
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SUB-TAB SWITCHER */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.04)', border: `1px solid ${isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, padding: 3 }}>
        {[
          { key: 'staff' as const, label: 'Staff & Admins', icon: 'fas fa-shield-halved', count: users.filter((u) => isInternalEmployee(u)).length },
          { key: 'customers' as const, label: 'Customers & Guests', icon: 'fas fa-hotel', count: users.filter((u) => !isInternalEmployee(u)).length },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setAccountsSubTab(tab.key); setRoleFilter(''); setOpenActionMenu(null); }}
            style={{
              flex: 1, padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontSize: '.82rem', fontWeight: 700, transition: 'all 0.2s ease',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: accountsSubTab === tab.key ? (tab.key === 'staff' ? 'linear-gradient(135deg, #0284C7, #0EA5E9)' : 'linear-gradient(135deg, #4338CA, #6366F1)') : 'transparent',
              color: accountsSubTab === tab.key ? '#FFF' : (isLightMode ? '#475569' : themeMuted),
              boxShadow: accountsSubTab === tab.key ? '0 1px 4px rgba(2, 132, 199, 0.2)' : 'none',
            }}
          >
            <i className={tab.icon} />
            {tab.label} <span style={{ opacity: 0.9, fontSize: '.74rem', marginLeft: 4 }}>({tab.count})</span>
          </button>
        ))}
      </div>

      {/* ═══ STAFF & ADMINS SUB-TAB ═══ */}
      {accountsSubTab === 'staff' && (
        <>
          {/* Staff Role Filter Badges */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 14, scrollbarWidth: 'none' }}>
            {[
              { value: '', label: 'All Staff & Admins' },
              { value: 'administrator', label: 'Administrator' },
              { value: 'staff', label: 'Staff' },
            ].map((f) => {
              const isSel = roleFilter === f.value;
              return (
                <button
                  key={f.value || 'all'}
                  type="button"
                  onClick={() => setRoleFilter(f.value)}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '5px 14px',
                    borderRadius: 6,
                    fontSize: '.75rem',
                    fontWeight: isSel ? 700 : 600,
                    border: isSel
                      ? '1px solid #0284C7'
                      : `1px solid ${isLightMode ? '#CBD5E1' : 'rgba(255,255,255,0.12)'}`,
                    background: isSel
                      ? '#0284C7'
                      : (isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.04)'),
                    color: isSel
                      ? '#FFFFFF'
                      : (isLightMode ? '#475569' : '#94A3B8'),
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSel ? '0 1px 4px rgba(2, 132, 199, 0.25)' : 'none',
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {searchingUsers ? (
            <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <ResortSpinner size="md" variant="primary" icon="id-badge" message="Loading Staff Directory…" submessage="Verifying employee accounts and department roles." />
              <div style={{ width: '100%' }}>
                <SkeletonTable rows={4} />
              </div>
            </div>
          ) : (() => {
            const staffUsers = users
              .filter((u) => isInternalEmployee(u))
              .filter((u) => {
                if (!roleFilter) return true;
                const r = normalizeRole(u.role);
                if (roleFilter === 'administrator') return r === 'administrator';
                if (roleFilter === 'staff') return r === 'staff';
                return r === roleFilter;
              });
            return staffUsers.length === 0 ? (
              <p className="muted" style={{ padding: '30px 0' }}>No staff accounts match your filters.</p>
            ) : (
              <div className="table-wrap" style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${isLightMode ? '#E2E8F0' : themeBorder}`, background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.85)', boxShadow: isLightMode ? '0 1px 3px rgba(0,0,0,0.03)' : 'none' }}>
                <table className="table" style={{ minWidth: 780, width: '100%', borderCollapse: 'separate', borderSpacing: 0, color: themeText }}>
                  <thead>
                    <tr style={{ background: isLightMode ? '#F8FAFC' : 'rgba(30,41,59,0.8)', borderBottom: `1px solid ${isLightMode ? '#E2E8F0' : themeBorder}` }}>
                      <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: '.72rem', fontWeight: 700, color: isLightMode ? '#475569' : themeMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Full Name</th>
                      <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: '.72rem', fontWeight: 700, color: isLightMode ? '#475569' : themeMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: '.72rem', fontWeight: 700, color: isLightMode ? '#475569' : themeMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Phone</th>
                      <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: '.72rem', fontWeight: 700, color: isLightMode ? '#475569' : themeMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Role / Entity</th>
                      <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: '.72rem', fontWeight: 700, color: isLightMode ? '#475569' : themeMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: '.72rem', fontWeight: 700, color: isLightMode ? '#475569' : themeMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Role Assignment</th>
                      <th style={{ textAlign: 'right', padding: '11px 16px', fontSize: '.72rem', fontWeight: 700, color: isLightMode ? '#475569' : themeMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffUsers.map((u) => {
                      const isAdmin = normalizeRole(u.role) === 'administrator';
                      return (
                      <tr key={u.id} style={{ borderBottom: `1px solid ${isLightMode ? '#F1F5F9' : themeBorder}` }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '.72rem',
                              fontWeight: 700,
                              background: isAdmin ? 'rgba(139,92,246,0.12)' : 'rgba(14,165,233,0.12)',
                              color: isAdmin ? '#7C3AED' : '#0284C7',
                              border: `1px solid ${isAdmin ? 'rgba(139,92,246,0.25)' : 'rgba(14,165,233,0.25)'}`,
                            }}>
                              {(u.full_name || 'S').slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <b style={{ display: 'block', fontSize: '.84rem', color: themeText }}>{u.full_name || 'Staff User'}</b>
                              {u.employee_id && <span style={{ fontSize: '.7rem', color: themeMuted, display: 'block' }}>ID: {u.employee_id}</span>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '.78rem', color: isLightMode ? '#475569' : themeMuted }}>{u.email || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '.78rem', color: themeText, fontFamily: 'monospace' }}>{u.phone || 'N/A'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 9px',
                            borderRadius: 6,
                            fontSize: '.72rem',
                            fontWeight: 700,
                            letterSpacing: '.02em',
                            background: isAdmin ? (isLightMode ? '#F5F3FF' : 'rgba(139,92,246,0.15)') : (isLightMode ? '#F0F9FF' : 'rgba(14,165,233,0.15)'),
                            color: isAdmin ? '#6D28D9' : '#0284C7',
                            border: `1px solid ${isAdmin ? (isLightMode ? '#DDD6FE' : 'rgba(139,92,246,0.3)') : (isLightMode ? '#BAE6FD' : 'rgba(14,165,233,0.3)')}`,
                          }}>
                            <i className={isAdmin ? 'fas fa-crown' : 'fas fa-shield-halved'} style={{ fontSize: '.68rem' }} />
                            {isAdmin ? 'Administrator' : 'Staff'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '2.5px 8px',
                            borderRadius: 99,
                            fontSize: '.72rem',
                            fontWeight: 600,
                            background: '#ECFDF5',
                            color: '#047857',
                            border: '1px solid #A7F3D0',
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981' }} />
                            Active
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <select
                            value={isAdmin ? 'administrator' : 'staff'}
                            style={{
                              fontSize: '.75rem',
                              fontWeight: 600,
                              padding: '5px 10px',
                              borderRadius: 6,
                              border: `1px solid ${isLightMode ? '#CBD5E1' : themeBorder}`,
                              background: isLightMode ? '#F8FAFC' : '#0F172A',
                              color: themeText,
                              cursor: 'pointer',
                            }}
                            onChange={(e) => {
                              const newRole = e.target.value;
                              handleRoleChange(u.id, newRole, newRole === 'administrator' ? 'management' : 'front_desk');
                            }}
                          >
                            <option value="administrator">Administrator</option>
                            <option value="staff">Staff</option>
                          </select>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            title="Action Menu"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openActionMenu?.id === u.id) {
                                setOpenActionMenu(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setOpenActionMenu({ id: u.id, rect, user: u });
                              }
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '5px 12px',
                              borderRadius: 6,
                              fontSize: '.76rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              background: openActionMenu?.id === u.id
                                ? (isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.15)')
                                : (isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.06)'),
                              border: `1px solid ${openActionMenu?.id === u.id ? '#0284C7' : (isLightMode ? '#CBD5E1' : themeBorder)}`,
                              color: openActionMenu?.id === u.id ? '#0284C7' : themeText,
                              transition: 'all 0.15s ease',
                              boxShadow: openActionMenu?.id === u.id ? '0 0 0 2px rgba(2, 132, 199, 0.2)' : 'none',
                            }}
                          >
                            <span>Action</span>
                            <i className={`fas fa-chevron-${openActionMenu?.id === u.id ? 'up' : 'down'}`} style={{ fontSize: '.6rem', color: openActionMenu?.id === u.id ? '#0284C7' : themeMuted }} />
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

      {/* ═══ CUSTOMERS & GUESTS SUB-TAB ═══ */}
      {accountsSubTab === 'customers' && (
        <>
          {/* Customer Summary Stats */}
          <div className="admin-grid-3-col" style={{ gap: 14, marginBottom: 20 }}>
            {(() => {
              const custUsers = users.filter((u) => !u.role || u.role === 'customer');
              const totalCust = custUsers.length;
              const activeStays = custUsers.filter((u) => (u.stays_count || 0) > 0).length;
              const totalRev = custUsers.reduce((sum, u) => sum + (u.total_spent_php || 0), 0);
              return [
                { label: 'TOTAL CUSTOMERS', value: totalCust, icon: 'fas fa-users', color: '#0EA5E9' },
                { label: 'WITH ACTIVE STAYS', value: activeStays, icon: 'fas fa-hotel', color: '#10B981' },
                { label: 'TOTAL REVENUE', value: money(totalRev), icon: 'fas fa-money-bill-wave', color: '#F59E0B' },
              ].map((s, si) => (
                <div key={si} style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${isLightMode ? '#E2E8F0' : themeBorder}`, borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: "1.5rem" }}><i className={s.icon} style={{ color: s.color }} /></span>
                  <div>
                    <span style={{ fontSize: '.68rem', color: themeMuted, fontWeight: 700, letterSpacing: '.08em' }}>{s.label}</span>
                    <b style={{ display: 'block', fontSize: '1.25rem', color: s.color }}>{s.value}</b>
                  </div>
                </div>
              ));
            })()}
          </div>

          {searchingUsers ? (
            <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <ResortSpinner size="md" variant="primary" icon="id-badge" message="Loading Staff Directory…" submessage="Verifying employee accounts and department roles." />
              <div style={{ width: '100%' }}>
                <SkeletonTable rows={4} />
              </div>
            </div>
          ) : (() => {
            const custUsers = users.filter((u) => !u.role || u.role === 'customer');
            return custUsers.length === 0 ? (
              <p className="muted" style={{ padding: '30px 0' }}>No customer accounts found.</p>
            ) : (
              <div className="table-wrap" style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${isLightMode ? '#E2E8F0' : themeBorder}`, background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.85)', boxShadow: isLightMode ? '0 1px 3px rgba(0,0,0,0.03)' : 'none' }}>
                <table className="table" style={{ minWidth: 780, width: '100%', borderCollapse: 'separate', borderSpacing: 0, color: themeText }}>
                  <thead>
                    <tr style={{ background: isLightMode ? '#F8FAFC' : 'rgba(30,41,59,0.8)', borderBottom: `1px solid ${isLightMode ? '#E2E8F0' : themeBorder}` }}>
                      <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: '.72rem', fontWeight: 700, color: isLightMode ? '#475569' : themeMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Full Name</th>
                      <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: '.72rem', fontWeight: 700, color: isLightMode ? '#475569' : themeMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Phone</th>
                      <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: '.72rem', fontWeight: 700, color: isLightMode ? '#475569' : themeMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>City / Address</th>
                      <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: '.72rem', fontWeight: 700, color: isLightMode ? '#475569' : themeMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Stays</th>
                      <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: '.72rem', fontWeight: 700, color: isLightMode ? '#475569' : themeMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Orders</th>
                      <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: '.72rem', fontWeight: 700, color: isLightMode ? '#475569' : themeMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Total Spent (₱)</th>
                      <th style={{ textAlign: 'right', padding: '11px 16px', fontSize: '.72rem', fontWeight: 700, color: isLightMode ? '#475569' : themeMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {custUsers.map((u) => (
                      <tr key={u.id} style={{ borderBottom: `1px solid ${isLightMode ? '#F1F5F9' : themeBorder}` }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '.72rem',
                              fontWeight: 700,
                              background: 'rgba(14,165,233,0.12)',
                              color: '#0284C7',
                              border: '1px solid rgba(14,165,233,0.25)',
                            }}>
                              {(u.full_name || 'G').slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <b style={{ display: 'block', fontSize: '.84rem', color: themeText }}>{u.full_name || 'Guest'}</b>
                              {u.email && <span style={{ fontSize: '.7rem', color: themeMuted, display: 'block' }}>{u.email}</span>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '.78rem', color: themeText, fontFamily: 'monospace' }}>{u.phone || 'N/A'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '.78rem', color: isLightMode ? '#475569' : themeMuted }}>{u.address ? `${u.address}, ${u.city}` : 'N/A'}</td>
                        <td style={{ padding: '12px 16px' }}><b style={{ color: '#0EA5E9' }}>{u.stays_count || 0}</b></td>
                        <td style={{ padding: '12px 16px', fontSize: '.82rem' }}>{u.orders_count || 0}</td>
                        <td style={{ padding: '12px 16px' }}><b style={{ color: '#F59E0B' }}>{money(u.total_spent_php || 0)}</b></td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            title="Action Menu"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openActionMenu?.id === u.id) {
                                setOpenActionMenu(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setOpenActionMenu({ id: u.id, rect, user: u });
                              }
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '5px 12px',
                              borderRadius: 6,
                              fontSize: '.76rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              background: openActionMenu?.id === u.id
                                ? (isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.15)')
                                : (isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.06)'),
                              border: `1px solid ${openActionMenu?.id === u.id ? '#0284C7' : (isLightMode ? '#CBD5E1' : themeBorder)}`,
                              color: openActionMenu?.id === u.id ? '#0284C7' : themeText,
                              transition: 'all 0.15s ease',
                              boxShadow: openActionMenu?.id === u.id ? '0 0 0 2px rgba(2, 132, 199, 0.2)' : 'none',
                            }}
                          >
                            <span>Action</span>
                            <i className={`fas fa-chevron-${openActionMenu?.id === u.id ? 'up' : 'down'}`} style={{ fontSize: '.6rem', color: openActionMenu?.id === u.id ? '#0284C7' : themeMuted }} />
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

      {/* ═══ CONSOLIDATED ACTION DROPDOWN POPOVER (PORTAL TO DOCUMENT.BODY) ═══ */}
      {openActionMenu && typeof document !== 'undefined' && createPortal(
        (() => {
          const estimatedHeight = 195;
          const spaceBelow = window.innerHeight - openActionMenu.rect.bottom;
          const isNearBottom = spaceBelow < estimatedHeight + 12;

          const topPos = isNearBottom ? undefined : Math.max(10, openActionMenu.rect.bottom + 6);
          const bottomPos = isNearBottom ? Math.max(10, window.innerHeight - openActionMenu.rect.top + 6) : undefined;

          // Responsive horizontal alignment
          const dropdownWidth = 205;
          let rightPos = window.innerWidth - openActionMenu.rect.right;
          // Guard: ensure it doesn't push off left edge of screen
          if (window.innerWidth - rightPos < dropdownWidth + 16) {
            rightPos = Math.max(16, window.innerWidth - dropdownWidth - 16);
          }
          // Guard: ensure it doesn't push off right edge of screen
          rightPos = Math.max(16, rightPos);

          return (
            <>
              {/* Full-viewport invisible backdrop for click-outside dismissal */}
              <div
                onClick={() => setOpenActionMenu(null)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 99998,
                  background: 'transparent',
                }}
              />

              {/* Floating Dropdown Panel anchored precisely to trigger button */}
              <div
                style={{
                  position: 'fixed',
                  top: topPos,
                  bottom: bottomPos,
                  right: rightPos,
                  minWidth: dropdownWidth,
                  maxWidth: 'calc(100vw - 32px)',
                  background: isLightMode ? '#FFFFFF' : '#0F172A',
                  color: themeText,
                  border: `1px solid ${isLightMode ? '#CBD5E1' : 'rgba(255,255,255,0.18)'}`,
                  borderRadius: 12,
                  boxShadow: isLightMode
                    ? '0 12px 28px -4px rgba(0, 0, 0, 0.14), 0 6px 12px -4px rgba(0, 0, 0, 0.08)'
                    : '0 20px 35px -5px rgba(0, 0, 0, 0.7), 0 10px 15px -5px rgba(0, 0, 0, 0.6)',
                  padding: '6px',
                  zIndex: 99999,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  animation: 'fadein 0.15s ease',
                  boxSizing: 'border-box',
                }}
              >
                {/* Profile summary header */}
                <div style={{ padding: '6px 10px 8px', borderBottom: `1px solid ${themeBorder}`, marginBottom: 2 }}>
                  <span style={{ display: 'block', fontSize: '.76rem', fontWeight: 700, color: themeText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                    {openActionMenu.user.full_name || openActionMenu.user.email || 'User Account'}
                  </span>
                  <span style={{ fontSize: '.68rem', color: themeMuted, textTransform: 'capitalize' }}>
                    {openActionMenu.user.role || 'Guest'}
                  </span>
                </div>

                {/* 1. Edit */}
                <button
                  type="button"
                  onClick={() => {
                    const targetUser = openActionMenu.user;
                    setOpenActionMenu(null);
                    setEditingUser(targetUser);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'transparent',
                    color: themeText,
                    fontSize: '.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <i className="fas fa-pen-to-square" style={{ color: '#0EA5E9', width: 16 }} />
                  <span>Edit Profile</span>
                </button>

                {/* 2. Reset Password */}
                <button
                  type="button"
                  onClick={() => {
                    const targetUser = openActionMenu.user;
                    setOpenActionMenu(null);
                    setRecoveryTarget(targetUser);
                    setNewPassword('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'transparent',
                    color: themeText,
                    fontSize: '.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <i className="fas fa-key" style={{ color: '#F59E0B', width: 16 }} />
                  <span>Reset Password</span>
                </button>

                {/* Separator */}
                <div style={{ height: 1, background: themeBorder, margin: '2px 0' }} />

                {/* 3. Remove Account */}
                <button
                  type="button"
                  onClick={() => {
                    const targetUser = openActionMenu.user;
                    setOpenActionMenu(null);
                    setUserToDelete(targetUser);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'transparent',
                    color: '#EF4444',
                    fontSize: '.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isLightMode ? '#FEE2E2' : 'rgba(239,68,68,0.15)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <i className="fas fa-trash-can" style={{ color: '#EF4444', width: 16 }} />
                  <span>Remove Account</span>
                </button>
              </div>
            </>
          );
        })(),
        document.body
      )}
    </div>
  );
};
