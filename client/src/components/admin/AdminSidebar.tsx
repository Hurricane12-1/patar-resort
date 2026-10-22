import React from 'react';
import { IconSignOut } from '../AdminIcons';

export interface AdminSidebarProps {
  sidebarHidden: boolean;
  setSidebarHidden: (hidden: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  sidebarMobileOpen: boolean;
  setSidebarMobileOpen: (open: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  themeSidebarBg: string;
  themeBorder: string;
  themeText: string;
  themeMuted: string;
  allBookingsCount: number;
  unreadNotifsCount: number;
  usersCount: number;
  conversationsCount: number;
  setShowGlossaryModal: (show: boolean) => void;
  signOut: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  sidebarHidden,
  setSidebarHidden,
  sidebarCollapsed,
  setSidebarCollapsed,
  sidebarMobileOpen,
  setSidebarMobileOpen,
  activeTab,
  setActiveTab,
  themeSidebarBg,
  themeBorder,
  themeText,
  themeMuted,
  allBookingsCount,
  unreadNotifsCount,
  usersCount,
  conversationsCount,
  setShowGlossaryModal,
  signOut,
}) => {
  const sidebarItems = [
    {
      key: 'overview',
      label: 'Dashboard & Analytics',
      icon: <i className="fas fa-chart-line" style={{ fontSize: 17 }} />,
    },
    {
      key: 'ledger',
      label: 'Reservations',
      icon: <i className="fas fa-calendar-check" style={{ fontSize: 17 }} />,
      count: allBookingsCount,
      badgeColor: '#0EA5E9',
    },
    {
      key: 'notifications',
      label: 'Notifications',
      icon: <i className="fas fa-bell" style={{ fontSize: 17 }} />,
      count: unreadNotifsCount,
      badgeColor: '#F43F5E',
    },
    {
      key: 'inventory',
      label: 'Room Management',
      icon: <i className="fas fa-bed" style={{ fontSize: 17 }} />,
    },
    {
      key: 'conversations',
      label: 'Customer Services',
      icon: <i className="fas fa-comments" style={{ fontSize: 17 }} />,
      count: conversationsCount,
      badgeColor: '#6366F1',
    },
    {
      key: 'accounts',
      label: 'Staff & Accounts',
      icon: <i className="fas fa-users-gear" style={{ fontSize: 17 }} />,
      count: usersCount,
      badgeColor: '#8B5CF6',
    },
    {
      key: 'audit',
      label: 'System Audit Logs',
      icon: <i className="fas fa-shield-halved" style={{ fontSize: 17 }} />,
    },
    {
      key: 'csv',
      label: 'Backup & Data Explorer',
      icon: <i className="fas fa-database" style={{ fontSize: 17 }} />,
    },
    {
      key: 'settings',
      label: 'Profile & Settings',
      icon: <i className="fas fa-sliders" style={{ fontSize: 17 }} />,
    },
  ];

  return (
    <aside
      className={`sidebar ${sidebarMobileOpen ? 'mobile-open' : ''} ${sidebarHidden ? 'hidden' : ''}`}
      style={{
        width: sidebarHidden ? 0 : sidebarCollapsed ? 76 : 268,
        minWidth: sidebarHidden ? 0 : sidebarCollapsed ? 76 : 268,
        maxWidth: sidebarHidden ? 0 : sidebarCollapsed ? 76 : 268,
        background: themeSidebarBg,
        borderRight: sidebarHidden ? 'none' : `1px solid ${themeBorder}`,
      }}
    >
      {/* SIDEBAR LOGO BRANDING & DOCK CONTROLS */}
      <div
        style={{
          padding: '16px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          borderBottom: `1px solid ${themeBorder}`,
        }}
      >
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
              <b
                style={{
                  fontSize: '1.05rem',
                  color: themeText,
                  display: 'block',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  lineHeight: 1,
                }}
              >
                ROCK VIEW RESORT
              </b>
              <span style={{ fontSize: '.62rem', color: '#6366F1', fontWeight: 800, letterSpacing: '.08em' }}>
                EXECUTIVE HUB
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="sidebar-action-btn"
            title={sidebarCollapsed ? 'Expand sidebar menu' : 'Collapse to icon rail'}
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
              <i className="fas fa-xmark" />
            </button>
          )}
        </div>
      </div>

      {/* SIDEBAR MENU NAVIGATION ITEMS */}
      <nav style={{ padding: '16px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {!sidebarCollapsed && (
          <span
            style={{
              fontSize: '.68rem',
              color: themeMuted,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '.18em',
              margin: '4px 8px 8px',
            }}
          >
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flex: sidebarCollapsed ? 'none' : 1,
                  minWidth: 0,
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                    color: isActive ? '#FFFFFF' : '#6366F1',
                  }}
                >
                  {item.icon}
                </span>
                {!sidebarCollapsed && (
                  <span
                    style={{
                      color: isActive ? '#FFFFFF' : themeText,
                      fontWeight: isActive ? 800 : 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      textAlign: 'left',
                    }}
                  >
                    {item.label}
                  </span>
                )}
              </div>

              {/* NOTIFICATION BADGE / ACTIVE PILL DOT */}
              {!sidebarCollapsed && (item.count !== undefined ? item.count > 0 : false) && (
                <span
                  style={{
                    marginLeft: 8,
                    flexShrink: 0,
                    background: item.badgeColor || '#F43F5E',
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
                  {item.count}
                </span>
              )}
              {sidebarCollapsed && (item.count !== undefined ? item.count > 0 : false) && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: item.badgeColor || '#F43F5E',
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* SIDEBAR FOOTER: HELP BUTTON & SIGN OUT */}
      <div
        style={{
          padding: 14,
          borderTop: `1px solid ${themeBorder}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
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
  );
};
