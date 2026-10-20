import React, { useState } from 'react';
import { LiveClock, FloatingWelcome } from '../LiveClock';
import { fmtDate, fmtTime } from '../../lib/format';
import { optimizeCloudinaryUrl } from '../../lib/cloudinary';

export interface AdminHeaderProps {
  themeHeaderBg: string;
  themeBorder: string;
  themeText: string;
  themeMuted: string;
  isLightMode: boolean;
  toggleThemeMode: () => void;
  sidebarHidden: boolean;
  setSidebarHidden: (hidden: boolean) => void;
  sidebarMobileOpen: boolean;
  setSidebarMobileOpen: (open: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  unreadNotifsCount: number;
  notifications: any[];
  handleMarkAllNotifsRead: () => void;
  handleMarkNotifRead: (id: string) => void;
  handleDeleteNotif: (id: string) => void;
  adminProfileState: any;
  profile: any;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  themeHeaderBg,
  themeBorder,
  themeText,
  themeMuted,
  isLightMode,
  toggleThemeMode,
  sidebarHidden,
  setSidebarHidden,
  sidebarMobileOpen,
  setSidebarMobileOpen,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  unreadNotifsCount,
  notifications,
  handleMarkAllNotifsRead,
  handleMarkNotifRead,
  handleDeleteNotif,
  adminProfileState,
  profile,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  const getTabLabel = (key: string) => {
    switch (key) {
      case 'overview':
        return 'Dashboard & Analytics';
      case 'ledger':
        return 'Reservations';
      case 'notifications':
        return 'Notifications';
      case 'inventory':
        return 'Room Management';
      case 'conversations':
        return 'Customer Services';
      case 'accounts':
        return 'Staff & Accounts';
      case 'audit':
        return 'System Audit Logs';
      case 'csv':
        return 'Backup & Data Explorer';
      case 'settings':
        return 'Profile & Settings';
      default:
        return 'Dashboard';
    }
  };

  return (
    <header
      className="admin-header"
      style={{
        background: themeHeaderBg,
        borderBottom: `1px solid ${themeBorder}`,
        position: 'relative',
        zIndex: 100,
        overflow: 'visible',
      }}
    >
      {/* SIDEBAR TOGGLE, BREADCRUMB & SEARCH */}
      <div className="admin-header-left" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              setSidebarMobileOpen(!sidebarMobileOpen);
            } else {
              setSidebarHidden(!sidebarHidden);
            }
          }}
          className="sidebar-toggle-btn"
          title={sidebarHidden ? 'Show sidebar menu' : 'Hide sidebar menu'}
          aria-label="Toggle navigation menu"
          style={{
            background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${themeBorder}`,
            borderRadius: 10,
            width: 38,
            height: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: themeText,
          }}
        >
          <i className="fas fa-bars" style={{ fontSize: '.95rem' }} />
        </button>

        {/* BREADCRUMB & TITLE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.72rem', color: themeMuted, fontWeight: 600 }}>
            <span>Executive hub</span>
            <i className="fas fa-chevron-right" style={{ fontSize: '.55rem', opacity: 0.5 }} />
            <span style={{ color: themeText, fontWeight: 700 }}>
              {activeTab === 'overview' ? 'Dashboard' : getTabLabel(activeTab)}
            </span>
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 800,
              color: themeText,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {getTabLabel(activeTab)}
          </h2>
        </div>

        {/* SEARCH INPUT */}
        <div className="admin-header-search-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: 14 }}>
          <i
            className="fas fa-magnifying-glass"
            style={{ position: 'absolute', left: 14, color: themeMuted, fontSize: '.8rem', pointerEvents: 'none' }}
          />
          <input
            className="search admin-header-search"
            placeholder="Search guests, rooms, references"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: 36,
              paddingRight: 38,
              height: 38,
              borderRadius: 20,
              fontSize: '.82rem',
              minWidth: 260,
              background: isLightMode ? '#F8FAFC' : 'rgba(15,23,42,0.6)',
              border: `1px solid ${themeBorder}`,
              color: themeText,
            }}
          />
          <kbd
            style={{
              position: 'absolute',
              right: 12,
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: '.68rem',
              fontWeight: 700,
              color: themeMuted,
              background: isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${isLightMode ? '#CBD5E1' : 'rgba(255,255,255,0.15)'}`,
              fontFamily: 'monospace',
              pointerEvents: 'none',
            }}
          >
            /
          </kbd>
        </div>
      </div>

      {/* TOP RIGHT CONTROLS */}
      <div className="admin-header-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* REAL-TIME EXECUTIVE CLOCK */}
        <LiveClock isLightMode={isLightMode} showSeconds={false} style={{ height: 38, padding: '0 12px' }} />

        {/* FLOATING & FADING ANIMATED WELCOME USERNAME */}
        <FloatingWelcome
          username={adminProfileState.fullName?.split(' ')[0] || profile?.full_name?.split(' ')[0] || 'Overseer'}
          isLightMode={isLightMode}
        />

        {/* LIGHT MODE / DARK MODE TOGGLE */}
        <button
          onClick={toggleThemeMode}
          className="admin-header-btn admin-theme-toggle-btn"
          title={isLightMode ? 'Switch to Dark Luxury Theme' : 'Switch to Executive White Theme'}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${themeBorder}`,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {isLightMode ? (
            <i className="fas fa-moon" style={{ color: '#6366F1', fontSize: '.9rem' }} />
          ) : (
            <i className="fas fa-sun" style={{ color: '#F59E0B', fontSize: '.9rem' }} />
          )}
        </button>

        {/* NOTIFICATION BAR ICON & DROPDOWN */}
        <div className="admin-header-notif-wrap" style={{ position: 'relative', zIndex: 102 }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`admin-header-btn admin-header-notif-btn ${unreadNotifsCount > 0 ? 'has-alerts' : ''}`}
            title="Executive Notifications & SMS Alerts"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${themeBorder}`,
              cursor: 'pointer',
              position: 'relative',
              padding: 0,
            }}
          >
            <i
              className="fas fa-bell"
              style={{ fontSize: '.95rem', color: unreadNotifsCount > 0 ? '#E11D48' : themeText }}
            />
            {unreadNotifsCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#E11D48',
                  border: `2px solid ${isLightMode ? '#FFFFFF' : '#0F172A'}`,
                }}
              />
            )}
          </button>

          {/* NOTIFICATION DROPDOWN */}
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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: `1px solid ${themeBorder}`,
                    paddingBottom: 10,
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <b style={{ fontSize: '.9rem', color: themeText, letterSpacing: '.01em' }}>Executive Notifications</b>
                    <small style={{ color: '#0EA5E9', fontSize: '.72rem', display: 'block', fontWeight: 600 }}>
                      SMS &amp; Live System Alerts
                    </small>
                  </div>
                  {unreadNotifsCount > 0 && (
                    <button
                      onClick={handleMarkAllNotifsRead}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#0EA5E9',
                        fontSize: '.74rem',
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <p className="muted small" style={{ margin: 0, padding: '24px 16px', textAlign: 'center' }}>
                    No new notifications.
                  </p>
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
                          background: !n.is_read
                            ? isLightMode
                              ? '#F1F5F9'
                              : 'rgba(99,102,241,0.14)'
                            : isLightMode
                            ? '#F8FAFC'
                            : 'rgba(255,255,255,0.03)',
                          border: isLightMode ? '1px solid #E2E8F0' : '1px solid rgba(255,255,255,0.07)',
                          fontSize: '.78rem',
                          overflow: 'hidden',
                          boxSizing: 'border-box',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 4,
                            flexWrap: 'wrap',
                          }}
                        >
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
                                style={{
                                  background: 'rgba(16,185,129,0.12)',
                                  border: 'none',
                                  color: '#10B981',
                                  cursor: 'pointer',
                                  fontSize: '.72rem',
                                  width: 20,
                                  height: 20,
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 800,
                                }}
                              >
                                <i className="fas fa-check" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteNotif(n.id)}
                              title="Delete alert"
                              style={{
                                background: 'rgba(244,63,94,0.12)',
                                border: 'none',
                                color: '#F43F5E',
                                cursor: 'pointer',
                                fontSize: '.72rem',
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <i className="fas fa-xmark" />
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
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      padding: '9px 16px',
                      fontWeight: 700,
                      fontSize: '.8rem',
                    }}
                  >
                    Open Full Alerts Center <i className="fas fa-arrow-right" style={{ marginLeft: 6 }} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ADMIN PROFILE AVATAR & PILL */}
        <div
          className="admin-header-profile"
          onClick={() => setActiveTab('settings')}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '4px 14px 4px 6px',
            borderRadius: 24,
            background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${themeBorder}`,
            transition: 'all 0.2s ease',
          }}
          title={`Administrator: ${adminProfileState.fullName} (${adminProfileState.domainAccount}) - Click to edit profile`}
        >
          {adminProfileState.customAvatarUrl ? (
            <img
              src={adminProfileState.customAvatarUrl}
              alt="Admin Avatar"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: isLightMode ? '#EEF2FF' : '#312E81',
                color: '#6366F1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '.8rem',
              }}
            >
              {adminProfileState.fullName
                ? adminProfileState.fullName
                    .split(' ')
                    .filter(Boolean)
                    .map((n: string) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                : 'LF'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <b style={{ fontSize: '.84rem', color: themeText, fontWeight: 700 }}>
              {adminProfileState.fullName || 'Julian Nygel De Leon'}
            </b>
            <span style={{ fontSize: '.68rem', color: themeMuted, fontWeight: 600 }}>Administrator</span>
          </div>
        </div>
      </div>
    </header>
  );
};
