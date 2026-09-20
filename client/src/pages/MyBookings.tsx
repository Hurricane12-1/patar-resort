import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import '../styles/my-bookings.css';
import Stars from '../components/Stars.tsx';
import { api } from '../lib/api.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { money, fmtDate } from '../lib/format.ts';
import { toast } from '../components/Toasts.tsx';

export default function MyBookings() {
  const { session, setAuthOpen } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revModal, setRevModal] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    let live = true;
    const load = () => api.myReservations().then((d) => live && setList(d)).finally(() => live && setLoading(false));
    load();
    const ch = supabase.channel('my-res')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, load)
      .subscribe();
    return () => { live = false; supabase.removeChannel(ch); };
  }, [session]);

  if (!session) return (
    <div className="container">
      <div className="gate">
        <h2>Your resort stays</h2>
        <p style={{ color: 'var(--muted)', margin: '10px 0 20px' }}>Sign in to view your upcoming and past reservations.</p>
        <button className="btn btn-sky" onClick={() => setAuthOpen(true)}>Sign in</button>
      </div>
    </div>
  );

  async function cancel(id) {
    if (!confirm('Cancel this reservation?')) return;
    try {
      await api.cancelReservation(id);
      toast('Reservation cancelled');
      setList((x) => x.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)));
    } catch (e) { toast(e.message, true); }
  }

  async function submitReview(e) {
    e.preventDefault();
    try {
      await api.addReview({ reservationId: revModal.id, rating, comment });
      toast('Salamat for your review ✦');
      setRevModal(null); setComment('');
      setList((x) => x.map((b) => (b.id === revModal.id ? { ...b, reviews: { rating, comment } } : b)));
    } catch (err) { toast(err.message, true); }
  }

  return (
    <div className="container section">
      <div className="sec-head">
        <div>
          <span className="eyebrow">Guest portal</span>
          <h2>My reservations</h2>
        </div>
      </div>

      {loading ? (
        [...Array(3)].map((_, i) => <div key={i} className="skel" style={{ height: 76, marginBottom: 12 }} />)
      ) : list.length === 0 ? (
        <div style={{ textStyle: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          No reservations yet. Check out our rooms and plan your Bolinao beach trip! 🌊
        </div>
      ) : (
        list.map((b) => {
          const d = new Date(b.check_in + 'T00:00:00');
          return (
            <div className="bk-row" key={b.id}>
              <div className="bk-date">
                <b>{d.getDate()}</b>
                <small>{d.toLocaleDateString([], { month: 'short' }).toUpperCase()}</small>
              </div>
              <div className="bk-main">
                <h4>{b.rooms?.name || 'Room'}</h4>
                <p>
                  {fmtDate(b.check_in)} → {fmtDate(b.check_out)} · {b.nights} night(s) · {b.guests} guest(s) · {money(b.total_php)}
                </p>
              </div>
              <span className={`pill ${b.status}`}>{b.status.replace('_', ' ')}</span>
              <div>
                {['pending', 'confirmed'].includes(b.status) && (
                  <button className="act-btn" onClick={() => cancel(b.id)}>Cancel</button>
                )}
                {b.status === 'checked_out' && !b.reviews && (
                  <button className="act-btn" onClick={() => { setRevModal(b); setRating(5); }}>Write review</button>
                )}
                {b.reviews && (
                  <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>
                    Reviewed <Stars value={b.reviews.rating} size={13} />
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}

      {revModal && (
        <div className="modal-overlay" onClick={() => setRevModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>How was your stay?</h3>
              <p style={{ fontSize: '.85rem', opacity: .85 }}>{revModal.rooms?.name}</p>
            </div>
            <form className="modal-body" onSubmit={submitReview}>
              <div className="field">
                <label>RATING</label>
                <Stars value={rating} onChange={setRating} size={28} />
              </div>
              <div className="field">
                <label>COMMENT</label>
                <textarea rows={3} required value={comment} onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us about the room, beach, staff, sunset…" />
              </div>
              <button className="btn btn-sky" style={{ width: '100%', justifyContent: 'center' }}>Submit review</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
