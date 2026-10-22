import React, { useState, useEffect } from 'react';
import { fmtDate, fmtTime } from '../../lib/format';
import { api } from '../../lib/api';

export interface NotificationsViewProps {
  notifications: any[];
  setNotifications: React.Dispatch<React.SetStateAction<any[]>>;
  handleMarkAllNotifsRead: () => void;
  handleClearReadNotifs: () => void;
  handleClearAllNotifs: () => void;
  handleMarkNotifRead: (id: string) => void;
  handleDeleteNotif: (id: string) => void;
  setViewingNotification: (n: any) => void;
  isLightMode: boolean;
  themeCardBg: string;
  themeBorder: string;
  themeShadow: string;
  themeText: string;
  themeMuted: string;
  toast: (msg: string, isError?: boolean) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  setNotifications,
  handleMarkAllNotifsRead,
  handleClearReadNotifs,
  handleClearAllNotifs,
  handleMarkNotifRead,
  handleDeleteNotif,
  setViewingNotification,
  isLightMode,
  themeCardBg,
  themeBorder,
  themeShadow,
  themeText,
  themeMuted,
  toast,
}) => {
  const [notifFilter, setNotifFilter] = useState<string>(() => {
    try {
      return localStorage.getItem('jd_admin_notif_filter') || 'unread';
    } catch {
      return 'unread';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_notif_filter', notifFilter);
    } catch {}
  }, [notifFilter]);

  const unreadNotifsCount = notifications.filter((n: any) => !n.is_read).length;
  const readNotifsCount = notifications.filter((n: any) => Boolean(n.is_read)).length;
  const smsNotifsCount = notifications.filter((n: any) => n.type === 'sms' || Boolean(n.to_phone)).length;
  const systemNotifsCount = notifications.filter((n: any) => n.type !== 'sms' && !n.to_phone).length;

  const filtered = notifications.filter((n: any) => {
    if (notifFilter === 'unread') return !n.is_read;
    if (notifFilter === 'read') return Boolean(n.is_read);
    if (notifFilter === 'sms') return n.type === 'sms' || Boolean(n.to_phone);
    if (notifFilter === 'system') return n.type !== 'sms' && !n.to_phone;
    return true;
  });

  return (
    <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24, boxShadow: themeShadow }}>
      <div className="admin-tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span style={{ fontSize: '.76rem', color: '#6366F1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            COMMUNICATIONS & ALERTS
          </span>
          <h3 className="serif" style={{ fontSize: '1.45rem', margin: '4px 0 0', color: themeText, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-bell" style={{ color: '#6366F1' }} /> Notifications
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Mark all notifications as read"
            >
              <i className="fas fa-check-double" /> Mark All Read
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Clear only read notifications"
            >
              <i className="fas fa-broom" /> Clear Read ({readNotifsCount})
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Clear all alerts permanently"
            >
              <i className="fas fa-trash-alt" /> Clear All
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
            style={{ fontWeight: 700, borderRadius: 8, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <i className="fas fa-sync-alt" /> Refresh Alerts
          </button>
        </div>
      </div>

      {/* FILTER DROPDOWN & REAL-TIME COUNTER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: '.78rem', fontWeight: 800, color: themeMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fas fa-filter" style={{ color: '#6366F1' }} /> FILTER NOTIFICATIONS:
          </label>
          <select
            value={notifFilter}
            onChange={(e) => setNotifFilter(e.target.value)}
            style={{
              padding: '7px 14px',
              borderRadius: 10,
              border: `1px solid ${themeBorder}`,
              background: isLightMode ? '#FFF' : '#1E293B',
              color: themeText,
              fontWeight: 700,
              fontSize: '.82rem',
              cursor: 'pointer',
            }}
          >
            <option value="unread">Unread ({unreadNotifsCount})</option>
            <option value="all">All Notifications ({notifications.length})</option>
            <option value="read">Read ({readNotifsCount})</option>
            <option value="sms">SMS Messages ({smsNotifsCount})</option>
            <option value="system">System Logs ({systemNotifsCount})</option>
          </select>
        </div>

        <span style={{ fontSize: '.76rem', color: themeMuted, fontWeight: 600 }}>
          Click any notification row to view full details
        </span>
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', color: themeMuted, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)', borderRadius: 14, border: `1px dashed ${themeBorder}` }}>
          <p style={{ fontSize: '1.2rem', margin: '0 0 6px' }}>
            <i className="fas fa-inbox" style={{ fontSize: '2rem', display: 'block', marginBottom: 8, opacity: 0.5 }} />
            No alerts or notifications recorded.
          </p>
          <small>SMS confirmations and system dispatches will appear here in real time.</small>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: themeMuted, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)', borderRadius: 14, border: `1px dashed ${themeBorder}` }}>
          <p style={{ fontSize: '1.1rem', margin: '0 0 6px', color: themeText, fontWeight: 700 }}>
            {notifFilter === 'unread' && <><i className="fas fa-trophy" style={{ color: '#F59E0B', marginRight: 6 }} />You're all caught up! No unread notifications.</>}
            {notifFilter === 'read' && <><i className="fas fa-book-open" style={{ color: '#0EA5E9', marginRight: 6 }} />No read notifications found in history.</>}
            {notifFilter === 'sms' && <><i className="fas fa-mobile-screen-button" style={{ color: '#10B981', marginRight: 6 }} />No SMS dispatch messages found.</>}
            {notifFilter === 'system' && <><i className="fas fa-gear" style={{ color: '#6366F1', marginRight: 6 }} />No system log alerts found.</>}
          </p>
          <small>
            {notifFilter === 'unread' ? 'All alerts have been marked as read. Switch filter above to "Read" or "All Notifications" to view history.' : 'Check other filters or wait for upcoming alerts.'}
          </small>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((n: any) => (
            <div
              key={n.id}
              onClick={() => setViewingNotification(n)}
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
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span className={`pill ${n.status || 'sent'}`}>{n.status || 'sent'}</span>
                  {n.to_phone && <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#0EA5E9' }}><i className="fas fa-mobile-alt" style={{ marginRight: 4 }} />{n.to_phone}</span>}
                  <span style={{ fontSize: '.75rem', color: themeMuted }}>• {fmtDate(n.created_at)} {fmtTime(n.created_at)}</span>
                  {!n.is_read ? (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F43F5E', display: 'inline-block' }} title="Unread alert" />
                  ) : (
                    <span style={{ fontSize: ".72rem", color: "#10B981", fontWeight: 600 }}><i className="fas fa-check" style={{ marginRight: 4 }} />Read</span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '.9rem', color: themeText, lineHeight: 1.4 }}>
                  {n.body || n.content || 'Notification message'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {/* Options Dropdown */}
                <select
                  value=""
                  onChange={(e) => {
                    const act = e.target.value;
                    e.target.value = '';
                    if (act === 'view') {
                      setViewingNotification(n);
                    } else if (act === 'toggle') {
                      if (n.is_read) {
                        setNotifications((prev: any[]) => prev.map((item: any) => item.id === n.id ? { ...item, is_read: false } : item));
                        toast('Alert marked as unread');
                      } else {
                        handleMarkNotifRead(n.id);
                      }
                    } else if (act === 'remove') {
                      handleDeleteNotif(n.id);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#FFF' : '#1E293B',
                    color: themeText,
                    fontSize: '.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Options ▾</option>
                  <option value="view">View Details</option>
                  <option value="toggle">{n.is_read ? 'Mark as Unread' : 'Mark as Read'}</option>
                  <option value="remove">Remove</option>
                </select>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNotif(n.id);
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: `1px solid ${isLightMode ? '#FEE2E2' : 'rgba(244, 63, 94, 0.25)'}`,
                    color: '#F43F5E',
                    borderRadius: 8,
                    padding: '5px 12px',
                    fontSize: '.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Remove this alert"
                >
                  <i className="fas fa-trash-alt" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
