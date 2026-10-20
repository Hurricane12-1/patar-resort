import { useEffect, useRef, useState } from 'react';
import { useAuth, to11Digits } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { money, fmtDate, addDaysISO } from '../lib/format.ts';
import { roomImg, getRoomImageUrl, handleImageError } from '../lib/images.ts';
import { toast } from './Toasts.tsx';
import { CANONICAL_ROOMS } from '../lib/canonicalRooms.ts';
import AvailabilityCalendar from './AvailabilityCalendar.tsx';

export const POOL_ADDON_OPTIONS = [
  { id: 'none', label: 'Room Only (No Swimming Pool Access) — ₱0', shortName: 'Room Only', pricePerGuest: 0 },
  { id: 'day_pool', label: 'Day Swimming Pool Pass (8:00 AM – 5:00 PM) — +₱150 / guest', shortName: 'Day Pool Pass', pricePerGuest: 150 },
  { id: 'night_pool', label: 'Night Swimming Pool Pass (6:00 PM – 10:00 PM) — +₱200 / guest', shortName: 'Night Pool Pass', pricePerGuest: 200 },
  { id: 'unlimited_pool', label: 'All-Day Unlimited Swimming Pool Pass (Day & Night) — +₱300 / guest', shortName: 'Unlimited Pool Pass', pricePerGuest: 300 },
];

export default function BookingFlow({ initialSlug }) {
  const { session, profile, setAuthOpen } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [checkIn, setCheckIn] = useState(addDaysISO(today, 1));
  const [checkOut, setCheckOut] = useState(addDaysISO(today, 3));
  const [guests, setGuests] = useState(2);
  const [poolAddonId, setPoolAddonId] = useState('none');
  const [catalog, setCatalog] = useState<any[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [stage, setStage] = useState('search');   // search | results | details | done
  const [room, setRoom] = useState(null);
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedUnitNumber, setSelectedUnitNumber] = useState<number | 'auto'>('auto');
  const preferred = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    api.rooms()
      .then((data) => {
        const activeOnly = (Array.isArray(data) ? data : []).filter((r: any) => r && r.is_active !== false);
        setCatalog(activeOnly);
      })
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoaded(true));
  }, []);
  useEffect(() => { setPhone(to11Digits(profile?.phone || '')); }, [profile]);

  const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
  const meta = (r) => catalog.find((c) => c.id === r.room_id);

  const selectedPoolOption = POOL_ADDON_OPTIONS.find((o) => o.id === poolAddonId) || POOL_ADDON_OPTIONS[0];
  const poolAdjustment = selectedPoolOption.pricePerGuest * guests;
  const baseRoomTotal = (room?.rate_php || 0) * nights;
  const totalWithAdjustments = baseRoomTotal + poolAdjustment;

  async function search(slug?: string, overrideCin?: string, overrideCout?: string) {
    if (catalogLoaded && catalog.length === 0) {
      toast("There's no present room around at the moment. Please check back later.", true);
      setSearching(false);
      setStage('results');
      setResults([]);
      setRoom(null);
      return;
    }
    if (slug) preferred.current = slug;
    const targetCin = overrideCin || checkIn;
    const targetCout = overrideCout || checkOut;
    setSearching(true); setStage('results'); setRoom(null);
    try {
      const list = await api.availability(targetCin, targetCout, guests);
      // Strictly exclude any absent/inactive rooms
      const activeList = (Array.isArray(list) ? list : []).filter((x: any) => {
        const c = catalog.find((cat) => cat.id === x.room_id);
        return c && c.is_active !== false;
      });
      setResults(activeList);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      const want = slug || preferred.current;
      if (want) {
        const hit = activeList.find((x) => catalog.find((c) => c.id === x.room_id)?.slug === want);
        if (hit && !hit.is_locked && hit.units_left > 0) {
          setRoom(hit);
          setStage('details');
        } else if (!catalog.some((c) => c.slug === want)) {
          toast(`Room "${want}" is absent or no longer present around. Please browse our active rooms.`, true);
        }
      }
    } catch (e: any) { toast(e.message, true); setResults([]); }
    finally { setSearching(false); }
  }

  useEffect(() => {
    if (!catalogLoaded) return;
    if (initialSlug) {
      const exists = catalog.some((c) => c.slug === initialSlug);
      if (!exists) {
        toast(`The requested room ("${initialSlug}") is absent or no longer present around.`, true);
      }
      search(initialSlug);
    }
  }, [initialSlug, catalogLoaded]); // eslint-disable-line

  async function confirm() {
    if (!session) { setAuthOpen(true); return; }
    if (!room || !catalog.some((c) => c.id === room.room_id && c.is_active !== false)) {
      toast("There's no present room around for this booking. Please select an active room.", true);
      setStage('results');
      return;
    }
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
      const unitTag = selectedUnitNumber !== 'auto'
        ? `[Unit ${selectedUnitNumber}]`
        : (room.available_unit_numbers?.[0] ? `[Unit ${room.available_unit_numbers[0]}]` : '');

      let fullNotes = notes;
      if (unitTag && !fullNotes.includes(unitTag)) {
        fullNotes = `${unitTag} ${fullNotes}`.trim();
      }
      if (poolAdjustment > 0) {
        fullNotes = `[Pool Add-on: ${selectedPoolOption.shortName} (+₱${poolAdjustment.toLocaleString()})] ${fullNotes}`.trim();
      }

      const stay = await api.createReservation({
        roomId: room.room_id,
        check_in: checkIn,
        check_out: checkOut,
        guests,
        notes: fullNotes,
        phone,
        total_php: totalWithAdjustments,
        guest_name: (profile?.full_name || '').trim(),
        guest_email: profile?.email || '',
      });
      setDone(stay); setStage('done');
      toast(`Reserved! SMS ping sent${phone ? ` to ${phone}` : ''} ✦`);
    } catch (e: any) { toast(e.message, true); }
    finally { setBusy(false); }
  }

  function reset() {
    setStage('search');
    setDone(null);
    setRoom(null);
    setResults([]);
    setPoolAddonId('none');
    setSelectedUnitNumber('auto');
  }

  return (
    <section id="reserve" className="reserve">
      <div className="container">
        {/* ——— NOTICE: IF NO ROOMS PRESENT AT ALL ——— */}
        {catalogLoaded && catalog.length === 0 && (
          <div
            style={{
              maxWidth: 960,
              margin: '0 auto 16px',
              padding: '14px 20px',
              borderRadius: 14,
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1.5px solid rgba(244, 63, 94, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              color: '#FECDD3',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <i className="fas fa-triangle-exclamation" style={{ color: '#F43F5E', fontSize: '1.35rem', flexShrink: 0 }} />
              <div>
                <strong style={{ color: '#F43F5E', fontSize: '.94rem', display: 'block', marginBottom: 2 }}>
                  There's No Present Room Around
                </strong>
                <span style={{ fontSize: '.83rem', color: '#CBD5E1', lineHeight: 1.5 }}>
                  There are currently no active accommodations or rooms available in the resort system. Reservations are temporarily closed until rooms are published.
                </span>
              </div>
            </div>
            <span
              style={{
                background: 'rgba(244, 63, 94, 0.25)',
                color: '#F43F5E',
                border: '1px solid rgba(244, 63, 94, 0.5)',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: '.72rem',
                fontWeight: 800,
                whiteSpace: 'nowrap',
              }}
            >
              0 Rooms Present
            </span>
          </div>
        )}

        {/* ——— the reservation bar ——— */}
        <div className="reserve-bar">
          <div className="rb-cell" onClick={() => setShowCalendar(true)} style={{ cursor: 'pointer' }} title="Tap to select check-in date on marked calendar">
            <span className="rb-label">Check-in</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', fontSize: '0.9rem', fontWeight: 600, marginTop: 4 }}>
              <span>{checkIn}</span>
              <span style={{ fontSize: '0.8rem', color: '#38BDF8' }}><i className="fas fa-calendar-alt" /></span>
            </div>
          </div>
          <div className="rb-cell" onClick={() => setShowCalendar(true)} style={{ cursor: 'pointer' }} title="Tap to select check-out date on marked calendar">
            <span className="rb-label">Check-out</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', fontSize: '0.9rem', fontWeight: 600, marginTop: 4 }}>
              <span>{checkOut}</span>
              <span style={{ fontSize: '0.8rem', color: '#38BDF8' }}><i className="fas fa-calendar-alt" /></span>
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
          <button
            className="btn btn-sky rb-btn"
            disabled={searching || checkOut <= checkIn || (catalogLoaded && catalog.length === 0)}
            onClick={() => {
              if (catalogLoaded && catalog.length === 0) {
                toast("There's no present room around at the moment. Please check back later.", true);
                return;
              }
              search();
            }}
            style={catalogLoaded && catalog.length === 0 ? { opacity: 0.65, cursor: 'not-allowed', background: '#475569' } : undefined}
          >
            {catalogLoaded && catalog.length === 0 ? "No Rooms Around" : searching ? 'Searching…' : 'Check availability'}
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
            <i className="fas fa-calendar-alt" /> {showCalendar ? 'Hide Availability Calendar' : 'View Calendar & Locked-In (Taken) Dates'}
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
            onSelectDates={(cin, cout, _targetRoomId, unitInfo) => {
              setCheckIn(cin);
              setCheckOut(cout);
              if (unitInfo?.unitNumber) {
                setSelectedUnitNumber(unitInfo.unitNumber);
              }
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
              catalog.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '42px 24px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 16, border: '1.5px dashed rgba(244, 63, 94, 0.45)', margin: '14px 0' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(244, 63, 94, 0.18)', color: '#F43F5E', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '1.6rem' }}>
                    <i className="fas fa-triangle-exclamation" />
                  </div>
                  <h3 style={{ margin: '0 0 8px', fontSize: '1.3rem', color: '#F43F5E', fontWeight: 800, fontFamily: 'var(--font-serif)' }}>
                    There's No Present Room Around
                  </h3>
                  <p className="muted small" style={{ margin: '0 auto 18px', maxWidth: 480, lineHeight: 1.6, color: '#CBD5E1' }}>
                    No accommodations are currently active or present in the resort system. Check back soon or contact our concierge for booking assistance.
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <a href="/contact" className="btn btn-sky btn-sm" style={{ fontWeight: 700 }}>
                      <i className="fas fa-headset" style={{ marginRight: 6 }} /> Contact Reception
                    </a>
                    <a href="/rooms" className="btn btn-ghost btn-sm" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
                      Browse Catalog
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px dashed rgba(255,255,255,0.15)' }}>
                  <p className="empty" style={{ margin: '0 0 10px', fontSize: '1.05rem', color: '#F43F5E', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <i className="fas fa-lock" /> All rooms are reserved / locked in until checkout for those dates.
                  </p>
                  <p className="muted small" style={{ margin: '0 0 14px' }}>
                    Rooms are locked exclusively once reserved by a guest and remain locked until their checkout date. Check the calendar for open dates.
                  </p>
                  <button
                    className="btn btn-sky btn-sm"
                    onClick={() => setShowCalendar(true)}
                    style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <i className="fas fa-calendar-alt" /> Browse Open Dates on Calendar
                  </button>
                </div>
              )
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
                  <div className="im" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0B132B' }}>
                    {getRoomImageUrl(m || r) ? (
                      <img
                        src={getRoomImageUrl(m || r)}
                        alt={r.name}
                        loading="lazy"
                        onError={handleImageError}
                      />
                    ) : (
                      <i className="fas fa-bed" style={{ fontSize: '1.4rem', color: 'rgba(255,255,255,0.3)' }} />
                    )}
                  </div>
                  <div>
                    <span className="label">{r.category}</span>
                    <h3 className="serif">{r.name}</h3>
                    <p className="muted small"><i className="fas fa-users" style={{ marginRight: 4 }} />Sleeps {r.capacity} · <i className="fas fa-star" style={{ color: '#F59E0B', margin: '0 4px' }} />{Number(r.rating_avg).toFixed(1)}</p>
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
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <i className="fas fa-lock" /> Taken Until Checkout
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
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title="Reserved by another guest until checkout"
                        >
                          <i className="fas fa-lock" /> Taken
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
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title="View calendar to see which dates are available"
                        >
                          <i className="fas fa-calendar-day" /> View Free Dates
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
          !catalog.some((c) => c.id === room.room_id && c.is_active !== false) ? (
            <div style={{ textAlign: 'center', padding: '42px 24px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 16, border: '1.5px dashed rgba(244, 63, 94, 0.45)', margin: '14px 0' }}>
              <i className="fas fa-triangle-exclamation" style={{ fontSize: '2rem', color: '#F43F5E', display: 'block', marginBottom: 12 }} />
              <h3 style={{ color: '#F43F5E', margin: '0 0 8px', fontSize: '1.3rem' }}>There's No Present Room Around</h3>
              <p className="muted small" style={{ marginBottom: 18, color: '#CBD5E1' }}>
                The accommodation you selected is absent or no longer active in the resort catalog.
              </p>
              <button className="btn btn-sky btn-sm" onClick={() => setStage('results')}>
                ← Choose Available Room
              </button>
            </div>
          ) : (
          <div className="detail-grid">
            <div className="detail-sum">
              <span className="label light">Your stay</span>
              <h3 className="serif">{meta(room)?.name || room.name}</h3>
              <p className="dates serif">{fmtDate(checkIn)} → {fmtDate(checkOut)}</p>
              <p className="muted" style={{ color: '#BFD8F2' }}>{nights} night{nights > 1 ? 's' : ''} · {guests} guest{guests > 1 ? 's' : ''}</p>
              
              <div className="total" style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 12, marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.84rem', color: '#CBD5E1' }}>
                  <span>Room Accommodation ({nights} night{nights > 1 ? 's' : ''}):</span>
                  <b>{money(baseRoomTotal)}</b>
                </div>

                {poolAdjustment > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.84rem', color: '#38BDF8', background: 'rgba(56, 189, 248, 0.12)', padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                    <span><i className="fas fa-person-swimming" style={{ marginRight: 6 }} />Pool Add-on ({selectedPoolOption.shortName}):</span>
                    <b>+{money(poolAdjustment)}</b>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', color: '#94A3B8' }}>
                    <span><i className="fas fa-person-swimming" style={{ marginRight: 6 }} />Pool Access:</span>
                    <span>Room Only (₱0)</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <span className="label light" style={{ fontSize: '.85rem' }}>Adjusted Total</span>
                  <b className="serif" style={{ fontSize: '1.45rem', color: '#10B981' }}>{money(totalWithAdjustments)}</b>
                </div>
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
                  <span style={{ fontSize: '0.9rem' }}><i className="fas fa-check" /></span>
                  <span>
                    Connected to verified Guest Manifest for <strong>{profile.full_name || 'Guest'}</strong>
                  </span>
                </div>
              )}

              {/* AVAILABLE PHYSICAL UNIT SELECTION */}
              {Number(room?.total_units || meta(room)?.units || 1) > 1 && (
                <div className="field">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span><i className="fas fa-layer-group" style={{ marginRight: 6 }} />ASSIGNED RESORT UNIT</span>
                      <span style={{ fontSize: '.7rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                        {room.units_left || (room.available_unit_numbers?.length ?? 1)} Unit{(room.units_left || 1) > 1 ? 's' : ''} Open
                      </span>
                    </span>
                    <span style={{ fontSize: '.74rem', color: '#38BDF8', fontWeight: 600 }}>
                      Physical Unit Allocation
                    </span>
                  </label>
                  <select
                    value={selectedUnitNumber}
                    onChange={(e) => setSelectedUnitNumber(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: 10,
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1.5px solid rgba(16, 185, 129, 0.45)',
                      color: '#FFFFFF',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="auto">⚡ Auto-assign first available unit (Unit {room.available_unit_numbers?.[0] || 1})</option>
                    {(room.available_unit_numbers || Array.from({ length: Number(room.total_units || meta(room)?.units || 1) }, (_, i) => i + 1)).map((uNum: number) => (
                      <option key={uNum} value={uNum} style={{ background: '#0F172A', color: '#FFF' }}>
                        Unit {uNum} (Available: {fmtDate(checkIn)} → {fmtDate(checkOut)})
                      </option>
                    ))}
                  </select>
                  <small className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: '.76rem', color: '#94A3B8' }}>
                    <i className="fas fa-circle-check" style={{ color: '#10B981' }} /> Reflects strictly confirmed available units. Guaranteed no uneven or overlapping reservation.
                  </small>
                </div>
              )}

              {/* SWIMMING POOL ADD-ON DROPDOWN SELECTION */}
              <div className="field">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span><i className="fas fa-person-swimming" style={{ marginRight: 6 }} />SWIMMING POOL ADD-ON OPTIONS</span>
                    <span style={{ fontSize: '.7rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                      Optional Dropdown
                    </span>
                  </span>
                  {poolAdjustment > 0 && (
                    <span style={{ color: '#10B981', fontSize: '0.76rem', fontWeight: 700 }}>
                      +₱{poolAdjustment.toLocaleString()} ({guests} guest{guests > 1 ? 's' : ''})
                    </span>
                  )}
                </label>
                <select
                  value={poolAddonId}
                  onChange={(e) => setPoolAddonId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 10,
                    background: 'rgba(15, 23, 42, 0.85)',
                    border: '1.5px solid rgba(56, 189, 248, 0.45)',
                    color: '#FFFFFF',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {POOL_ADDON_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id} style={{ background: '#0F172A', color: '#FFF' }}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <small className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: '.76rem', color: '#94A3B8' }}>
                  <i className="fas fa-lightbulb" style={{ color: '#38BDF8' }} /> Select swimming pool pass if you wish to add pool privileges to this room reservation.
                </small>
              </div>

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
          )
        )}

        {/* ——— confirmation ——— */}
        {stage === 'done' && done && (
          <div className="done-cine">
            <span className="label">Confirmed</span>
            <h3 className="serif">Mabuhay — see you on the sand.</h3>
            <p>{done.rooms?.name || 'Room'} · {fmtDate(done.check_in)} → {fmtDate(done.check_out)} · {money(done.total_php)}</p>
            {selectedPoolOption.pricePerGuest > 0 && (
              <p style={{ color: '#38BDF8', fontSize: '0.9rem', fontWeight: 700, margin: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <i className="fas fa-person-swimming" /> Swimming Pool Privileges: {selectedPoolOption.shortName} (+₱{poolAdjustment.toLocaleString()})
              </p>
            )}
            <p className="muted" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <i className="fas fa-comment-sms" /> SMS ping sent{phone ? ` to ${phone}` : ''} · check-in 2:00 PM
            </p>
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
