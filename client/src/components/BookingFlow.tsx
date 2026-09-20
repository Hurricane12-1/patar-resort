import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { money, fmtDate, addDaysISO } from '../lib/format.ts';
import { roomImg } from '../lib/images.ts';
import { toast } from './Toasts.tsx';

export default function BookingFlow({ initialSlug }) {
  const { session, profile, setAuthOpen } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [checkIn, setCheckIn] = useState(addDaysISO(today, 1));
  const [checkOut, setCheckOut] = useState(addDaysISO(today, 3));
  const [guests, setGuests] = useState(2);
  const [catalog, setCatalog] = useState([]);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [stage, setStage] = useState('search');   // search | results | details | done
  const [room, setRoom] = useState(null);
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const preferred = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => { api.rooms().then(setCatalog).catch(() => {}); }, []);
  useEffect(() => { setPhone(profile?.phone || ''); }, [profile]);

  const nights = Math.max(1, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000));
  const meta = (r) => catalog.find((c) => c.id === r.room_id);

  async function search(slug) {
    if (slug) preferred.current = slug;
    setSearching(true); setStage('results'); setRoom(null);
    try {
      const list = await api.availability(checkIn, checkOut, guests);
      setResults(list);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      const want = slug || preferred.current;
      if (want) {
        const hit = list.find((x) => catalog.find((c) => c.id === x.room_id)?.slug === want);
        if (hit) { setRoom(hit); setStage('details'); }
      }
    } catch (e) { toast(e.message, true); setResults([]); }
    finally { setSearching(false); }
  }

  useEffect(() => { if (initialSlug) search(initialSlug); }, [initialSlug]); // eslint-disable-line

  async function confirm() {
    if (!session) { setAuthOpen(true); return; }
    setBusy(true);
    try {
      const stay = await api.createReservation({
        roomId: room.room_id, check_in: checkIn, check_out: checkOut, guests, notes, phone,
      });
      setDone(stay); setStage('done');
      toast(`Reserved! SMS ping sent${phone ? ` to ${phone}` : ''} ✦`);
    } catch (e) { toast(e.message, true); }
    finally { setBusy(false); }
  }

  function reset() { setStage('search'); setDone(null); setRoom(null); setResults([]); }

  return (
    <section id="reserve" className="reserve">
      <div className="container">
        {/* ——— the reservation bar ——— */}
        <div className="reserve-bar">
          <div className="rb-cell">
            <span className="rb-label">Check-in</span>
            <input type="date" min={today} value={checkIn} onChange={(e) => {
              const v = e.target.value; setCheckIn(v);
              if (v >= checkOut) setCheckOut(addDaysISO(v, 1));
            }} />
          </div>
          <div className="rb-cell">
            <span className="rb-label">Check-out</span>
            <input type="date" min={addDaysISO(checkIn, 1)} value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)} />
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
              <p className="empty">Fully booked for those dates — try shifting your stay.</p>
            )}
            {!searching && results.map((r) => {
              const m = meta(r);
              return (
                <div className="room-option" key={r.room_id}>
                  <div className="im"><img src={roomImg(m?.slug)} alt={r.name} loading="lazy" /></div>
                  <div>
                    <span className="label">{r.category}</span>
                    <h3 className="serif">{r.name}</h3>
                    <p className="muted small">Sleeps {r.capacity} · ★ {Number(r.rating_avg).toFixed(1)}</p>
                  </div>
                  <div className="ro-right">
                    <span className="rate serif">{money(r.rate_php)}<small> /night</small></span>
                    {r.units_left <= 2
                      ? <span className="units-left">Only {r.units_left} left</span>
                      : <span className="muted small">{r.units_left} units left</span>}
                    <button className="btn btn-sky btn-sm"
                      onClick={() => { setRoom(r); setStage('details'); }}>Select</button>
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
              <div className="field">
                <label>PHONE FOR SMS PINGS</label>
                <input value={phone} placeholder="+63 9XX XXX XXXX" onChange={(e) => setPhone(e.target.value)} />
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
