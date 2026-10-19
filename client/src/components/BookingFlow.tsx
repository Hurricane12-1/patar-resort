import { useEffect, useRef, useState } from 'react';
import { useAuth, to11Digits } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { money, fmtDate, addDaysISO } from '../lib/format.ts';
import { roomImg, getRoomImageUrl, handleImageError } from '../lib/images.ts';
import { toast } from './Toasts.tsx';
import { CANONICAL_ROOMS } from '../lib/canonicalRooms.ts';
import AvailabilityCalendar from './AvailabilityCalendar.tsx';

export default function BookingFlow({ initialSlug }) {
  const { session, profile, setAuthOpen } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [checkIn, setCheckIn] = useState(addDaysISO(today, 1));
  const [checkOut, setCheckOut] = useState(addDaysISO(today, 3));
  const [guests, setGuests] = useState(2);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [stage, setStage] = useState('search');   // search | results | details | done
  const [room, setRoom] = useState(null);
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const preferred = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => { api.rooms().then(setCatalog).catch(() => {}); }, []);
  useEffect(() => { setPhone(to11Digits(profile?.phone || '')); }, [profile]);

  const nights = Math.max(1, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000));
  const meta = (r) => catalog.find((c) => c.id === r.room_id);

  async function search(slug?: string, overrideCin?: string, overrideCout?: string) {
    if (slug) preferred.current = slug;
    const targetCin = overrideCin || checkIn;
    const targetCout = overrideCout || checkOut;
    setSearching(true); setStage('results'); setRoom(null);
    try {
      const list = await api.availability(targetCin, targetCout, guests);
      setResults(list);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      const want = slug || preferred.current;
      if (want) {
        const hit = list.find((x) => catalog.find((c) => c.id === x.room_id)?.slug === want);
        if (hit && !hit.is_locked && hit.units_left > 0) { setRoom(hit); setStage('details'); }
      }
    } catch (e: any) { toast(e.message, true); setResults([]); }
    finally { setSearching(false); }
  }

  useEffect(() => { if (initialSlug) search(initialSlug); }, [initialSlug]); // eslint-disable-line

  async function confirm() {
    if (!session) { setAuthOpen(true); return; }
    if (room?.is_locked || room?.units_left <= 0) {
      toast('This room is already reserved / locked in for those dates. Please check the calendar for available dates.', true);
      return;
    }
    if (phone && phone.length !== 11) {
      toast('Phone number must be strictly an 11-digit number (e.g. 09XXXXXXXXX).', true);
      return;
    }
    setBusy(true);
    try {
      const stay = await api.createReservation({
        roomId: room.room_id,
        check_in: checkIn,
        check_out: checkOut,
        guests,
        notes,
        phone,
        guest_name: (profile?.full_name || '').trim(),
        guest_email: profile?.email || '',
      });
      setDone(stay); setStage('done');
      toast(`Reserved! SMS ping sent${phone ? ` to ${phone}` : ''} ✦`);
    } catch (e: any) { toast(e.message, true); }
    finally { setBusy(false); }
  }

  function reset() { setStage('search'); setDone(null); setRoom(null); setResults([]); }

  return (
    <section id="reserve" className="reserve">
      <div className="container">
        {/* ——— the reservation bar ——— */}
        <div className="reserve-bar">
          <div className="rb-cell" onClick={() => setShowCalendar(true)} style={{ cursor: 'pointer' }} title="Tap to select check-in date on marked calendar">
            <span className="rb-label">Check-in</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', fontSize: '0.9rem', fontWeight: 600, marginTop: 4 }}>
              <span>{checkIn}</span>
              <span style={{ fontSize: '0.8rem', color: '#38BDF8' }}>📅</span>
            </div>
          </div>
          <div className="rb-cell" onClick={() => setShowCalendar(true)} style={{ cursor: 'pointer' }} title="Tap to select check-out date on marked calendar">
            <span className="rb-label">Check-out</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', fontSize: '0.9rem', fontWeight: 600, marginTop: 4 }}>
              <span>{checkOut}</span>
              <span style={{ fontSize: '0.8rem', color: '#38BDF8' }}>📅</span>
            </div>
          </div>
          <div className="rb-cell rb-guests">
            <span className="rb-label">Guests</span>
            <div className="qty">
              <button onClick={() => setGuests((g) => Math.max(1, g - 1))}>−</button>
              <b>{guests}</b>
              <button onClick={() => setGuests((g) => Math.min(12, g + 1))}>+</button>
            </div>
          </div>
          <button className="btn btn-sky rb-btn" disabled={searching || checkOut <= checkIn}
            onClick={() => search()}>
            {searching ? 'Searching…' : 'Check availability'}
          </button>
        </div>

        {/* Visual Calendar Toggle Bar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10, marginBottom: 14 }}>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setShowCalendar((s) => !s)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: `1px solid ${showCalendar ? '#0EA5E9' : 'rgba(255,255,255,0.2)'}`,
              background: showCalendar ? 'rgba(14, 165, 233, 0.12)' : 'rgba(255,255,255,0.03)',
              color: showCalendar ? '#38BDF8' : '#E2E8F0',
              padding: '6px 16px',
              borderRadius: 20,
              fontSize: '.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            📅 {showCalendar ? 'Hide Availability Calendar' : 'View Calendar & Locked-In (Taken) Dates'}
          </button>
        </div>

        {/* Interactive Month Availability Calendar */}
        {showCalendar && (
          <AvailabilityCalendar
            rooms={catalog}
            selectedRoomId={room?.room_id}
            initialCheckIn={checkIn}
            initialCheckOut={checkOut}
            isLightMode={false}
            onSelectDates={(cin, cout) => {
              setCheckIn(cin);
              setCheckOut(cout);
              search(undefined, cin, cout);
            }}
            onClose={() => setShowCalendar(false)}
          />
        )}

        {/* ——— available rooms ——— */}
        {stage === 'results' && (
          <div ref={resultsRef} className="results">
            <p className="results-note">
              {results.length > 0 &&
                `${results.length} room type${results.length > 1 ? 's' : ''} · ${fmtDate(checkIn)} → ${fmtDate(checkOut)} · ${nights} night${nights > 1 ? 's' : ''}`}
            </p>
            {searching && [...Array(2)].map((_, i) =>
              <div key={i} className="skel" style={{ height: 170, marginBottom: 16 }} />)}
            {!searching && results.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px dashed rgba(255,255,255,0.15)' }}>
                <p className="empty" style={{ margin: '0 0 10px', fontSize: '1.05rem', color: '#F43F5E' }}>
                  🔒 All rooms are reserved / locked in until checkout for those dates.
                </p>
                <p className="muted small" style={{ margin: '0 0 14px' }}>
                  Rooms are locked exclusively once reserved by a guest and remain locked until their checkout date. Check the calendar for open dates.
                </p>
                <button
                  className="btn btn-sky btn-sm"
                  onClick={() => setShowCalendar(true)}
                  style={{ fontWeight: 700 }}
                >
                  📅 Browse Open Dates on Calendar
                </button>
              </div>
            )}
            {!searching && results.map((r: any) => {
              const m = meta(r);
              const isLocked = Boolean(r.is_locked || r.units_left <= 0);

              return (
                <div
                  className="room-option"
                  key={r.room_id}
                  style={{
                    opacity: isLocked ? 0.72 : 1,
                    border: isLocked ? '1px solid rgba(244, 63, 94, 0.3)' : undefined,
                  }}
                >
                  <div className="im">
                    <img
                      src={getRoomImageUrl(m || r)}
                      alt={r.name}
                      loading="lazy"
                      onError={handleImageError}
                    />
                  </div>
                  <div>
                    <span className="label">{r.category}</span>
                    <h3 className="serif">{r.name}</h3>
                    <p className="muted small">Sleeps {r.capacity} · ★ {Number(r.rating_avg).toFixed(1)}</p>
                  </div>
                  <div className="ro-right">
                    <span className="rate serif">{money(r.rate_php)}<small> /night</small></span>
                    {isLocked ? (
                      <span
                        className="units-left"
                        style={{
                          background: 'rgba(244, 63, 94, 0.15)',
                          color: '#F43F5E',
                          border: '1px solid #F43F5E',
                          fontWeight: 800,
                        }}
                      >
                        🔒 Taken Until Checkout
                      </span>
                    ) : r.units_left <= 2 ? (
                      <span className="units-left">Only {r.units_left} left</span>
                    ) : (
                      <span className="muted small">{r.units_left} units left</span>
                    )}

                    {isLocked ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled
                          style={{
                            opacity: 0.6,
                            cursor: 'not-allowed',
                            color: '#F43F5E',
                            border: '1px solid rgba(244, 63, 94, 0.4)',
                          }}
                          title="Reserved by another guest until checkout"
                        >
                          🔒 Taken
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => {
                            setShowCalendar(true);
                            window.scrollTo({ top: 380, behavior: 'smooth' });
                          }}
                          style={{
                            fontSize: '.74rem',
                            padding: '4px 8px',
                            background: 'transparent',
                            border: '1px solid rgba(56,189,248,0.4)',
                            color: '#38BDF8',
                            cursor: 'pointer',
                            borderRadius: 6,
                          }}
                          title="View calendar to see which dates are available"
                        >
                          📅 View Free Dates
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-sky btn-sm"
                        onClick={() => { setRoom(r); setStage('details'); }}
                      >
                        Select
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ——— stay summary + confirm ——— */}
        {stage === 'details' && room && (
          <div className="detail-grid">
            <div className="detail-sum">
              <span className="label light">Your stay</span>
              <h3 className="serif">{meta(room)?.name || room.name}</h3>
              <p className="dates serif">{fmtDate(checkIn)} → {fmtDate(checkOut)}</p>
              <p className="muted" style={{ color: '#BFD8F2' }}>{nights} night{nights > 1 ? 's' : ''} · {guests} guest{guests > 1 ? 's' : ''}</p>
              <div className="total">
                <span className="label light">Total</span>
                <b className="serif">{money(room.rate_php * nights)}</b>
              </div>
            </div>
            <div>
              {session && profile && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  fontSize: '0.78rem',
                  color: '#BAE6FD',
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{ fontSize: '1rem' }}>✓</span>
                  <span>
                    Connected to verified Guest Manifest for <strong>{profile.full_name || 'Guest'}</strong>
                  </span>
                </div>
              )}
              <div className="field">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>PHONE FOR SMS PINGS (11-DIGIT NUMBER ONLY)</span>
                  {phone && (
                    <span style={{ color: phone.length === 11 ? '#10B981' : '#F59E0B', fontSize: '0.74rem', fontWeight: 600 }}>
                      {phone.length}/11 digits
                    </span>
                  )}
                </label>
                <input
                  inputMode="numeric"
                  maxLength={11}
                  value={phone}
                  placeholder="09XXXXXXXXX"
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                />
              </div>
              <div className="field">
                <label>SPECIAL REQUESTS</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="early check-in, extra bed, anniversary setup…" />
              </div>
              <div className="bc-nav" style={{ marginTop: 22 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setStage('results')}>← Rooms</button>
                <button className="btn btn-sky" disabled={busy} onClick={confirm}>
                  {busy ? 'Reserving…' : session ? 'Confirm reservation ✦' : 'Sign in to confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ——— confirmation ——— */}
        {stage === 'done' && done && (
          <div className="done-cine">
            <span className="label">Confirmed</span>
            <h3 className="serif">Mabuhay — see you on the sand.</h3>
            <p>{done.rooms?.name} · {fmtDate(done.check_in)} → {fmtDate(done.check_out)} · {money(done.total_php)}</p>
            <p className="muted">📟 SMS ping sent{phone ? ` to ${phone}` : ''} · check-in 2:00 PM</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 26 }}>
              <button className="btn btn-ghost btn-sm" onClick={reset}>Book another stay</button>
              <a className="btn btn-sky btn-sm" href="/my-bookings">My bookings</a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
