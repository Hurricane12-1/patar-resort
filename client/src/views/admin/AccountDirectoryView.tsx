import React, { useState } from 'react';
import { money } from '../../lib/format';

export interface AccountDirectoryViewProps {
  users: any[];
  searchingUsers: boolean;
  fetchUsers: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleRoleChange: (userId: string, newRole: string) => void;
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
  const [accountsSubTab, setAccountsSubTab] = useState<'staff' | 'customers'>('staff');
  const [roleFilter, setRoleFilter] = useState<string>('');

  return (
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
            <i className={`fas fa-rotate ${searchingUsers ? 'fa-spin' : ''}`} /> {searchingUsers ? 'Loading…' : 'Refresh'}
          </button>
          {accountsSubTab === 'staff' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-sky btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => {
                  setNewStaff({ first_name: '', middle_name: '', last_name: '', full_name: '', email: '', password: '', phone: '', role: 'administrator' });
                  setShowCreateModal(true);
                }}
              >
                <i className="fas fa-crown" /> Provision Administrator
              </button>
              <button
                className="btn btn-sm"
                style={{ border: `1px solid ${themeBorder}`, color: themeText, background: isLightMode ? '#FFF' : 'rgba(255,255,255,0.05)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => {
                  setNewStaff({ first_name: '', middle_name: '', last_name: '', full_name: '', email: '', password: '', phone: '', role: 'receptionist' });
                  setShowCreateModal(true);
                }}
              >
                <i className="fas fa-shield-halved" /> Provision Staff
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SUB-TAB SWITCHER */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4 }}>
        {[
          { key: 'staff' as const, label: 'Staff & Admins', icon: 'fas fa-shield-halved', count: users.filter((u) => ['administrator', 'receptionist', 'accounting', 'staff'].includes(u.role)).length },
          { key: 'customers' as const, label: 'Customers & Guests', icon: 'fas fa-hotel', count: users.filter((u) => !u.role || u.role === 'customer').length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setAccountsSubTab(tab.key); setRoleFilter(''); }}
            style={{
              flex: 1, padding: '10px 16px', border: 'none', borderRadius: 10, cursor: 'pointer',
              fontSize: '.84rem', fontWeight: 700, transition: 'all 0.25s ease',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: accountsSubTab === tab.key ? (tab.key === 'staff' ? 'linear-gradient(135deg, #0284C7, #0EA5E9)' : 'linear-gradient(135deg, #4338CA, #6366F1)') : 'transparent',
              color: accountsSubTab === tab.key ? '#FFF' : themeMuted,
              boxShadow: accountsSubTab === tab.key ? '0 4px 12px rgba(14,165,233,0.25)' : 'none',
            }}
          >
            <i className={tab.icon} />
            {tab.label} <span style={{ opacity: 0.85, fontSize: '.74rem', marginLeft: 4 }}>({tab.count})</span>
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
              .filter((u) => ['administrator', 'receptionist', 'accounting', 'staff'].includes(u.role))
              .filter((u) => !roleFilter || u.role === roleFilter);
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
                        <td><span style={{ color: "#10B981", fontWeight: 600, fontSize: ".78rem" }}><i className="fas fa-circle" style={{ fontSize: ".6rem", color: "#10B981", marginRight: 4 }} />Active</span></td>
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
                              <i className="fas fa-pen-to-square" style={{ marginRight: 4 }} />Edit
                            </button>
                            <button className="act-btn" style={{ color: '#0EA5E9', borderColor: '#38BDF8' }}
                              title="Reset user password"
                              onClick={() => { setRecoveryTarget(u); setNewPassword(''); }}>
                              <i className="fas fa-key" style={{ marginRight: 4 }} />Reset
                            </button>
                            <button className="act-btn" style={{ color: '#EF4444', borderColor: '#EF4444' }}
                              title="Remove account permanently"
                              aria-label="Delete"
                              onClick={() => setUserToDelete(u)}>
                              Remove
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
              const custUsers = users.filter((u) => !u.role || u.role === 'customer');
              const totalCust = custUsers.length;
              const activeStays = custUsers.filter((u) => (u.stays_count || 0) > 0).length;
              const totalRev = custUsers.reduce((sum, u) => sum + (u.total_spent_php || 0), 0);
              return [
                { label: 'TOTAL CUSTOMERS', value: totalCust, icon: 'fas fa-users', color: '#0EA5E9' },
                { label: 'WITH ACTIVE STAYS', value: activeStays, icon: 'fas fa-hotel', color: '#10B981' },
                { label: 'TOTAL REVENUE', value: money(totalRev), icon: 'fas fa-money-bill-wave', color: '#F59E0B' },
              ].map((s, si) => (
                <div key={si} style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: "1.6rem" }}><i className={s.icon} style={{ color: s.color }} /></span>
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
            const custUsers = users.filter((u) => !u.role || u.role === 'customer');
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
                              <i className="fas fa-pen-to-square" style={{ marginRight: 4 }} />Edit
                            </button>
                            <button className="act-btn" style={{ color: '#0EA5E9', borderColor: '#38BDF8' }}
                              title="Reset guest password"
                              onClick={() => { setRecoveryTarget(u); setNewPassword(''); }}>
                              <i className="fas fa-key" style={{ marginRight: 4 }} />Reset
                            </button>
                            <button className="act-btn" style={{ color: '#EF4444', borderColor: '#EF4444' }}
                              title="Remove account permanently"
                              aria-label="Delete"
                              onClick={() => setUserToDelete(u)}>
                              Remove
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
  );
};
