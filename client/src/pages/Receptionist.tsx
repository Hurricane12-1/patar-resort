import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import '../styles/receptionist.css';
import { api } from '../lib/api.ts';
import { fmtDate } from '../lib/format.ts';
import { toast } from '../components/Toasts.tsx';
import { VoucherModal, normalizeVoucherData } from '../components/receipt';
import PriceChangeRequestPanel from '../components/PriceChangeRequestPanel.tsx';
import { canAccessPortal } from '../lib/rbac.ts';

export default function Receptionist() {
  const { profile, adminProfile } = useAuth();
  const currentProf = adminProfile || profile;
  const isAuthorized = canAccessPortal(currentProf, 'reception');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inspectedVoucher, setInspectedVoucher] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'checked_in' | 'checked_out'>('all');

  useEffect(() => {
    if (isAuthorized) {
      api.frontDeskOverview()
        .then(setData)
        .catch((e) => toast(e.message, true))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isAuthorized]);

  async function updateStatus(id: string, status: string) {
    try {
      await api.setReservationStatus(id, status);
      toast(`Reservation marked as ${status.replace('_', ' ').toUpperCase()}`);
      setData((prev: any) => ({
        ...prev,
        bookings: (prev?.bookings || []).map((b: any) => (b.id === id ? { ...b, status } : b)),
      }));
    } catch (e: any) {
      toast(e.message, true);
    }
  }

  const { overview: ov = {}, bookings = [] } = data || {};

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b: any) => {
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      const query = searchQuery.trim().toLowerCase();
      if (!query) return matchesStatus;

      const guestName = (b.profiles?.full_name || '').toLowerCase();
      const guestPhone = (b.profiles?.phone || '').toLowerCase();
      const roomName = (b.rooms?.name || '').toLowerCase();
      const matchesQuery = guestName.includes(query) || guestPhone.includes(query) || roomName.includes(query);

      return matchesStatus && matchesQuery;
    });
  }, [bookings, statusFilter, searchQuery]);

  // Counts for status pills
  const confirmedCount = bookings.filter((b: any) => b.status === 'confirmed').length;
  const checkedInCount = bookings.filter((b: any) => b.status === 'checked_in').length;
  const checkedOutCount = bookings.filter((b: any) => b.status === 'checked_out').length;

  // Clearance Gate fallback
  if (!isAuthorized) {
    return (
      <div className="staff-denied-container">
        <div className="staff-denied-card">
          <div className="staff-denied-icon">
            <i className="fas fa-shield-halved" />
          </div>
          <span className="label" style={{ color: '#FB7185' }}>Front Desk Boundary</span>
          <h2 className="serif" style={{ fontSize: '1.8rem', margin: '8px 0 12px', color: '#FFFFFF' }}>
            Front Desk Clearance Required
          </h2>
          <p className="muted" style={{ marginBottom: 24, fontSize: '.88rem', lineHeight: 1.6 }}>
            You do not have active Front Desk clearance to access the guest check-in terminal. Please sign in with receptionist credentials.
          </p>
          <Link to="/staff/login" className="btn btn-sky" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px' }}>
            <i className="fas fa-right-to-bracket" />
            <span>Go to Staff Station Sign In</span>
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="container" style={{ padding: '40px 16px' }}>
        <div className="skel" style={{ height: 380, borderRadius: 18 }} />
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px 60px' }}>
      {/* Page Header */}
      <div className="sec-head">
        <div>
          <span className="label">
            <i className="fas fa-bell-concierge" /> Front Desk Operations Desk
          </span>
          <h2 className="serif" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.2rem)' }}>
            Guest Arrivals <em style={{ fontStyle: 'italic', color: '#38BDF8' }}>&amp; Check-In Terminal</em>
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: '.78rem',
            color: '#38BDF8',
            background: 'rgba(14, 165, 233, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            padding: '6px 14px',
            borderRadius: 9999,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 0 12px rgba(14, 165, 233, 0.15)',
          }}>
            <i className="fas fa-tower-broadcast" style={{ color: '#38BDF8' }} />
            <span>SMS Alerts Active for Check-ins</span>
          </span>
        </div>
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
          <b>{ov.sms_delivered || 0} alerts</b>
        </div>
      </div>

      {/* CHECK-IN LEDGER PANEL */}
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <h3 className="serif" style={{ fontSize: '1.45rem', margin: 0 }}>
              Live Guest Manifest &amp; Room Allocations
            </h3>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '.82rem' }}>
              Process walk-ins, digital check-ins, key allocations, and folio vouchers.
            </p>
          </div>

          {/* Quick Search */}
          <div style={{ position: 'relative', minWidth: 260 }}>
            <i className="fas fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B', fontSize: '.82rem' }} />
            <input
              type="text"
              placeholder="Search guest, room, or phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="staff-input-control"
              style={{ padding: '8px 12px 8px 34px', fontSize: '.82rem', borderRadius: 10 }}
            />
          </div>
        </div>

        {/* Operational Filter Tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`chip ${statusFilter === 'all' ? 'sel' : ''}`}
          >
            All Manifest ({bookings.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('confirmed')}
            className={`chip ${statusFilter === 'confirmed' ? 'sel' : ''}`}
          >
            <i className="fas fa-clock" style={{ fontSize: '.7rem' }} />
            Due In ({confirmedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('checked_in')}
            className={`chip ${statusFilter === 'checked_in' ? 'sel' : ''}`}
          >
            <i className="fas fa-key" style={{ fontSize: '.7rem' }} />
            In-House ({checkedInCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('checked_out')}
            className={`chip ${statusFilter === 'checked_out' ? 'sel' : ''}`}
          >
            <i className="fas fa-check" style={{ fontSize: '.7rem' }} />
            Departed ({checkedOutCount})
          </button>
        </div>

        {/* Guest Manifest Table */}
        {filteredBookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748B' }}>
            <i className="fas fa-clipboard-question" style={{ fontSize: '2.4rem', opacity: 0.4, marginBottom: 12, display: 'block' }} />
            <p style={{ margin: 0, fontSize: '.9rem' }}>
              {searchQuery ? `No guests found matching "${searchQuery}".` : 'No active reservations under this status filter.'}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Guest / Contact</th>
                  <th>Accommodation Unit</th>
                  <th>Stay Schedule</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Front Desk Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b: any) => (
                  <tr key={b.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#38BDF8',
                          fontSize: '.78rem',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}>
                          {(b.profiles?.full_name || 'G').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <b style={{ color: '#FFFFFF', fontSize: '.88rem' }}>{b.profiles?.full_name || 'Guest'}</b>
                          <div style={{ fontSize: '.74rem', color: '#64748B' }}>
                            <i className="fas fa-phone" style={{ fontSize: '.68rem', marginRight: 4 }} />
                            {b.profiles?.phone || 'No phone recorded'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="tag" style={{ margin: 0, background: 'rgba(14, 165, 233, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38BDF8' }}>
                          {b.rooms?.name || 'Unit Allocation'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '.82rem', color: '#E2E8F0' }}>
                        <span>{fmtDate(b.check_in)}</span>
                        <span style={{ color: '#64748B', margin: '0 6px' }}>→</span>
                        <span>{fmtDate(b.check_out)}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`pill ${b.status}`}>
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {b.status === 'confirmed' && (
                          <button
                            type="button"
                            className="act-btn"
                            onClick={() => updateStatus(b.id, 'checked_in')}
                            style={{
                              background: 'rgba(16, 185, 129, 0.2)',
                              borderColor: 'rgba(52, 211, 153, 0.45)',
                              color: '#34D399',
                            }}
                            title="Confirm guest arrival and issue room key"
                          >
                            <i className="fas fa-bell-concierge" /> Check-in
                          </button>
                        )}
                        {b.status === 'checked_in' && (
                          <button
                            type="button"
                            className="act-btn"
                            onClick={() => updateStatus(b.id, 'checked_out')}
                            style={{
                              background: 'rgba(99, 102, 241, 0.2)',
                              borderColor: 'rgba(129, 140, 248, 0.45)',
                              color: '#A5B4FC',
                            }}
                            title="Release room and dispatch housekeeping turnaround"
                          >
                            <i className="fas fa-key" /> Check-out
                          </button>
                        )}
                        <button
                          type="button"
                          className="act-btn"
                          onClick={() => setInspectedVoucher(b)}
                          style={{
                            borderColor: 'rgba(56, 189, 248, 0.4)',
                            color: '#38BDF8',
                            background: 'rgba(56, 189, 248, 0.1)',
                          }}
                          title="Inspect or print guest folio voucher"
                        >
                          <i className="fas fa-receipt" /> Folio
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RATE CHANGE PERMISSION REQUESTS & ADMIN CODE REDEMPTION */}
      <PriceChangeRequestPanel />

      {/* GUEST FOLIO VOUCHER INSPECTION MODAL */}
      <VoucherModal
        isOpen={Boolean(inspectedVoucher)}
        voucher={inspectedVoucher ? normalizeVoucherData(inspectedVoucher) : null}
        onClose={() => setInspectedVoucher(null)}
      />
    </div>
  );
}
