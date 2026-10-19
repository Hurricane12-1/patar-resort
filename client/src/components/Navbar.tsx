import { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { fmtTime } from '../lib/format.ts';
import { LiveClock, FloatingWelcome } from './LiveClock.tsx';

export default function Navbar() {
  const { session, profile, adminSession, adminProfile, signOut, signOutCustomer, signOutAdmin, setAuthOpen } = useAuth();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    if (!session) { setNotes([]); return; }
    let live = true;
    const load = () => api.myNotifications().then((n) => live && setNotes(n)).catch(() => {});
    load();
    const t = setInterval(load, 45000);
    return () => { live = false; clearInterval(t); };
  }, [session]);

  const isStaffOrAdmin = Boolean(adminSession && adminProfile && ['administrator', 'admin', 'receptionist', 'accounting', 'staff'].includes(adminProfile?.role));
  const links = [
    ['/', 'Home'],
    ['/rooms', 'Rooms'],
    ['/my-bookings', 'My Bookings'],
    ...(isStaffOrAdmin ? [['/administrator', 'Admin Console'], ['/resort-department', 'Operations']] : []),
  ];

  return (
    <>
      <div className="tagbar">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span>☀️ Bolinao 29°C · Sunset 6:24 PM · High Tide 4:15 PM · Front desk 24/7</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LiveClock isLightMode={false} showSeconds={true} style={{ padding: '2px 10px', fontSize: '.72rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.18)' }} />
            <span>📟 SMS pings on every reservation · +63 900 555 0123</span>
          </div>
        </div>
      </div>

      <header className="navbar">
        <div className="container">
          <Link to="/" className="logo" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <span className="logo-mark" style={{ background: 'linear-gradient(135deg, rgba(56,189,248,.25), rgba(14,165,233,.4))', border: '1px solid rgba(255,255,255,.35)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="7" r="3" fill="#F59E0B" />
                <path d="M2 17c3-3 6-3 9 0s6 3 9 0" stroke="#7DD3FC" strokeWidth="2" strokeLinecap="round" />
                <path d="M2 12c3-2 6-2 9 0s6 2 9 0" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
              <span className="serif" style={{ fontSize: '1.32rem', lineHeight: 1.15, letterSpacing: '.06em', fontWeight: 600, color: '#FFFFFF' }}>Rock View</span>
              <span style={{ fontSize: '.62rem', lineHeight: 1, letterSpacing: '.22em', color: '#7DD3FC', fontWeight: 700, textTransform: 'uppercase' }}>BEACH RESORT</span>
            </span>
          </Link>

          <nav className={`nav-links ${open ? 'open' : ''}`}>
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}
                onClick={() => setOpen(false)}>{label}</NavLink>
            ))}
          </nav>

          <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {session && !['administrator', 'receptionist', 'accounting', 'staff'].includes(profile?.role) && (
              <div style={{ position: 'relative' }}>
                <button className="bell" aria-label="Notifications" onClick={() => setMenu((m) => !m)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
                  </svg>
                  {notes.length > 0 && <span className="bell-badge">{notes.length}</span>}
                </button>
                {menu && (
                  <div className="bell-panel">
                    {notes.length === 0 && <div className="bell-item">No SMS pings yet.</div>}
                    {notes.slice(0, 6).map((n) => (
                      <div className="bell-item" key={n.id}>
                        <span className={`pill ${n.status}`}>{n.status}</span>{' '}
                        {fmtTime(n.created_at)} — {n.body.slice(0, 64)}…
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {session ? (
              <>
                <FloatingWelcome
                  username={profile?.full_name?.split(' ')[0] || session?.user?.email?.split('@')[0] || 'Guest'}
                  isLightMode={false}
                />
                <Link
                  to="/my-bookings"
                  className="nav-user"
                  style={{
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.32)',
                    color: '#BAE6FD',
                    transition: 'all 0.2s ease',
                  }}
                  title="View My Bookings & Guest Manifest Profile"
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                  <span>Hi, <b style={{ color: '#FFFFFF' }}>{profile?.full_name?.split(' ')[0] || 'Guest'}</b></span>
                </Link>
                <button
                  className="btn btn-sm"
                  style={{ color: '#fff', background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.3)' }}
                  onClick={signOutCustomer}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                {adminSession && (
                  <Link
                    to="/administrator"
                    className="btn btn-sm"
                    style={{
                      color: '#FDE047',
                      background: 'rgba(234, 179, 8, 0.15)',
                      border: '1px solid rgba(234, 179, 8, 0.4)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      textDecoration: 'none',
                    }}
                    title="Active Executive Administrator Session"
                  >
                    <span>🛡️</span>
                    <span>Admin Console</span>
                  </Link>
                )}
                <button
                  className="btn btn-sm"
                  style={{ color: '#fff', background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.3)' }}
                  onClick={() => setAuthOpen(true)}
                >
                  Sign in
                </button>
              </>
            )}

            <Link to="/" className="btn btn-sky btn-sm">Book stay</Link>
            <button className="burger" aria-label="Menu" onClick={() => setOpen((o) => !o)}>☰</button>
          </div>
        </div>
      </header>
    </>
  );
}
