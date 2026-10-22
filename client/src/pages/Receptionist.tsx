import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import '../styles/receptionist.css';
import { api } from '../lib/api.ts';
import { fmtDate } from '../lib/format.ts';
import { toast } from '../components/Toasts.tsx';
import { VoucherModal, normalizeVoucherData } from '../components/receipt';

export default function Receptionist() {
  const { profile, adminProfile, signIn, adminSignIn } = useAuth();
  const currentProf = adminProfile || profile;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [inspectedVoucher, setInspectedVoucher] = useState<any>(null);

  useEffect(() => {
    if (currentProf && ['receptionist', 'administrator', 'staff', 'admin'].includes(currentProf.role)) {
      api.analyticsOverview()
        .then(setData)
        .catch((e) => toast(e.message, true))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [currentProf]);

  async function handleReceptionistLogin(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = adminSignIn ? await adminSignIn(email, password) : await signIn(email, password);
      if (res?.error) throw res.error;
      toast('Receptionist Desk Authenticated ✦');
    } catch (err) {
      toast(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(id, status) {
    try {
      await api.setReservationStatus(id, status);
      toast(`Reservation updated to ${status.replace('_', ' ')}`);
      setData((x) => ({
        ...x,
        bookings: x.bookings.map((b) => (b.id === id ? { ...b, status } : b)),
      }));
    } catch (e) { toast(e.message, true); }
  }

  // DEDICATED SEPARATE RECEPTIONIST LOGIN PORTAL
  if (!currentProf || !['receptionist', 'administrator', 'staff', 'admin'].includes(currentProf.role)) {
    return (
      <div className="container section">
        <div className="gate" style={{ maxWidth: 460, borderTop: '5px solid var(--sky)' }}>
          <span className="label">Front Desk Command</span>
          <h2 className="serif" style={{ fontSize: '2.2rem', margin: '8px 0 12px' }}>Receptionist Sign-In</h2>
          <p className="muted" style={{ marginBottom: 24, fontSize: '.92rem' }}>
            Dedicated portal for front desk receptionists, guest check-in officers, and concierge staff.
          </p>

          <form onSubmit={handleReceptionistLogin} style={{ textAlign: 'left' }}>
            <div className="field">
              <label>RECEPTIONIST EMAIL</label>
              <input
                type="email"
                required
                value={email}
                placeholder="receptionist@jdbeachhouse.ph"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label>PASSWORD</label>
              <input
                type="password"
                required
                value={password}
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className="btn btn-sky" style={{ width: '100%', justifyContent: 'center', marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }} disabled={busy}>
              {busy ? 'Authenticating…' : <><i className="fas fa-bell-concierge" /> Sign In to Reception Desk</>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="container section">
        <div className="skel" style={{ height: 320 }} />
      </div>
    );
  }

  const { overview: ov = {}, bookings = [] } = data;

  return (
    <div className="container section">
      <div className="sec-head">
        <div>
          <span className="label">Front Desk Reception</span>
          <h2 className="serif" style={{ fontSize: 'clamp(2.2rem,4.4vw,3.6rem)' }}>
            Guest Check-In <em style={{ fontStyle: 'italic' }}>& Desk Portal</em>
          </h2>
        </div>
        <span style={{ fontSize: '.83rem', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-comment-sms" style={{ color: '#38BDF8' }} /> SMS Pings Active for Check-ins
        </span>
      </div>

      {/* RECEPTION KPIS */}
      <div className="stat-cards" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <small>Arrivals Today</small>
          <b>{ov.arrivals_today || 0} guests</b>
        </div>
        <div className="stat-card">
          <small>Departures Today</small>
          <b>{ov.departures_today || 0} guests</b>
        </div>
        <div className="stat-card">
          <small>Resort Occupancy</small>
          <b>{ov.occupancy_pct || 0}%</b>
        </div>
        <div className="stat-card">
          <small>SMS Pings Sent</small>
          <b>{ov.sms_delivered || 0} sent</b>
        </div>
      </div>

      {/* CHECK-IN LEDGER */}
      <div className="panel">
        <h3 className="serif" style={{ fontSize: '1.4rem', marginBottom: 14 }}>Live Check-In & Check-Out Operations</h3>
        {bookings.length === 0 ? (
          <p className="muted" style={{ padding: '24px 0' }}>No active stay reservations found.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Guest Name</th>
                  <th>Room</th>
                  <th>Check In / Out</th>
                  <th>Status</th>
                  <th>Front Desk Action</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <b>{b.profiles?.full_name || 'Guest'}</b><br />
                      <small className="muted">{b.profiles?.phone || 'No phone'}</small>
                    </td>
                    <td>{b.rooms?.name || 'Room'}</td>
                    <td>{fmtDate(b.check_in)} → {fmtDate(b.check_out)}</td>
                    <td><span className={`pill ${b.status}`}>{b.status.replace('_', ' ')}</span></td>
                    <td>
                      {b.status === 'confirmed' && (
                        <button className="act-btn" onClick={() => updateStatus(b.id, 'checked_in')}>
                          <i className="fas fa-bell-concierge" style={{ marginRight: 5 }} /> Check-in
                        </button>
                      )}
                      {b.status === 'checked_in' && (
                        <button className="act-btn" onClick={() => updateStatus(b.id, 'checked_out')}>
                          <i className="fas fa-key" style={{ marginRight: 5 }} /> Check-out
                        </button>
                      )}
                      <button
                        className="act-btn"
                        onClick={() => setInspectedVoucher(b)}
                        style={{
                          marginLeft: 6,
                          borderColor: '#38BDF8',
                          color: '#38BDF8',
                          background: 'rgba(56, 189, 248, 0.08)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        title="Inspect or print guest folio voucher"
                      >
                        <i className="fas fa-receipt" /> Folio
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GUEST FOLIO VOUCHER INSPECTION MODAL */}
      <VoucherModal
        isOpen={Boolean(inspectedVoucher)}
        voucher={inspectedVoucher ? normalizeVoucherData(inspectedVoucher) : null}
        onClose={() => setInspectedVoucher(null)}
      />
    </div>
  );
}
