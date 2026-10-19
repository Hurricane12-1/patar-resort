import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import '../styles/my-bookings.css';
import Stars from '../components/Stars.tsx';
import { api } from '../lib/api.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { money, fmtDate } from '../lib/format.ts';
import { toast } from '../components/Toasts.tsx';

function to11Digits(val: string): string {
  if (!val) return '';
  let digits = val.replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length >= 12) {
    digits = '0' + digits.slice(2);
  }
  return digits.slice(0, 11);
}

export default function MyBookings() {
  const { session, profile, setAuthOpen, updateProfile, deleteAccount, refreshProfile } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revModal, setRevModal] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  // Guest Refund Modal State
  const [refundModal, setRefundModal] = useState<any>(null);
  const [refundReason, setRefundReason] = useState('Change of travel schedule / personal emergency');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundPayoutMethod, setRefundPayoutMethod] = useState('GCash');
  const [refundAccountDetails, setRefundAccountDetails] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  // Profile Edit Modal State
  const [profOpen, setProfOpen] = useState(false);
  const [savingProf, setSavingProf] = useState(false);
  const [confirmDeleteProf, setConfirmDeleteProf] = useState(false);
  const [deletingProf, setDeletingProf] = useState(false);
  const [profForm, setProfForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    phone: '',
    address: '',
    city: '',
    emergency_contact: '',
  });

  useEffect(() => {
    if (profile) {
      setProfForm({
        first_name: (profile.first_name || '').replace(/[^a-zA-Z\s\-]/g, ''),
        middle_name: (profile.middle_name || '').replace(/[^a-zA-Z\s\-]/g, ''),
        last_name: (profile.last_name || '').replace(/[^a-zA-Z\s\-]/g, ''),
        phone: to11Digits(profile.phone || ''),
        address: profile.address || '',
        city: (profile.city || '').replace(/[^a-zA-Z\s\-]/g, ''),
        emergency_contact: to11Digits(profile.emergency_contact || ''),
      });
    }
  }, [profile]);

  useEffect(() => {
    if (refreshProfile) refreshProfile();
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
    <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
      <div className="gate" style={{ maxWidth: 500, margin: '0 auto', background: 'rgba(15, 23, 42, 0.75)', padding: 36, borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
        <span style={{ fontSize: '2.4rem', display: 'block', marginBottom: 12 }}>🌴</span>
        <h2 className="serif" style={{ fontSize: '2rem', color: '#FFFFFF', marginBottom: 8 }}>Your Resort Stays</h2>
        <p style={{ color: 'var(--muted)', margin: '0 0 24px', fontSize: '.95rem', lineHeight: 1.5 }}>
          Sign in to view your upcoming bookings, access your active stay digital keycode, and leave reviews.
        </p>
        <button className="btn btn-sky" style={{ padding: '12px 28px', fontSize: '.92rem' }} onClick={() => setAuthOpen(true)}>
          Sign in to View Stays ✦
        </button>
      </div>
    </div>
  );

  async function cancel(id) {
    if (!confirm('Are you sure you want to cancel this reservation?')) return;
    try {
      await api.cancelReservation(id);
      toast('Reservation cancelled successfully.');
      setList((x) => x.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)));
    } catch (e) { toast(e.message, true); }
  }

  async function submitGuestRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!refundModal) return;
    setSubmittingRefund(true);
    try {
      const amountNum = Number(refundAmount) || refundModal.downpayment_php || refundModal.total_php || 0;
      const fullReason = `${refundReason} (Payout via ${refundPayoutMethod}: ${refundAccountDetails || 'As registered on booking'})`.trim();
      const res = await api.requestRefund(refundModal.id, fullReason, amountNum);
      toast(res.message || 'Refund request registered! Automated confirmation email dispatched ✦');
      setList((prev: any[]) => prev.map((x) => x.id === refundModal.id ? { ...x, payment_status: 'refund_pending' } : x));
      setRefundModal(null);
      setRefundReason('Change of travel schedule / personal emergency');
      setRefundAmount('');
      setRefundAccountDetails('');
    } catch (err: any) {
      toast(err.message, true);
    } finally {
      setSubmittingRefund(false);
    }
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

  async function saveProfile(e) {
    e.preventDefault();
    if (profForm.phone && profForm.phone.length !== 11) {
      toast('Phone number must be strictly an 11-digit number (e.g. 09XXXXXXXXX).', true);
      return;
    }
    if (profForm.emergency_contact && profForm.emergency_contact.length !== 11) {
      toast('Emergency contact must be strictly an 11-digit number (e.g. 09XXXXXXXXX).', true);
      return;
    }
    setSavingProf(true);
    try {
      const full_name = [profForm.first_name, profForm.middle_name, profForm.last_name].filter(Boolean).join(' ');
      await updateProfile({ ...profForm, full_name });
      setProfOpen(false);
      toast('Guest profile updated successfully ✦');
    } catch (err) {
      toast(err.message, true);
    } finally {
      setSavingProf(false);
    }
  }


  const activeStay = list.find((b) => ['confirmed', 'checked_in'].includes(b.status));

  return (
    <div className="container section my-bookings-page" style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px' }}>
      {/* HEADER WITH PROFILE SHORTCUT */}
      <div className="sec-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <span className="eyebrow" style={{ color: '#38BDF8', letterSpacing: '.14em', textTransform: 'uppercase', fontSize: '.76rem', fontWeight: 700 }}>
            Guest Portal
          </span>
          <h2 className="serif" style={{ fontSize: '2.4rem', color: '#F8FAFC', margin: '4px 0 0' }}>
            My Reservations
          </h2>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38BDF8' }}
            onClick={() => setProfOpen(true)}
          >
            📋 Guest Manifest ({profile?.full_name?.split(' ')[0] || 'Profile'})
          </button>
          <Link to="/rooms" className="btn btn-sky btn-sm">
            + Book Another Room
          </Link>
        </div>
      </div>

      {/* CONNECTED GUEST MANIFEST PROFILE CARD */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(30, 41, 59, 0.75))',
        border: '1px solid rgba(56, 189, 248, 0.28)',
        borderRadius: 14,
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(14, 165, 233, 0.35))',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            flexShrink: 0,
          }}>
            📋
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                {profile?.full_name || 'Guest Resident'}
              </span>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#6EE7B7',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 999,
                letterSpacing: '.05em',
                textTransform: 'uppercase',
              }}>
                ✓ Verified Manifest for Check-In
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 4, fontSize: '0.82rem', color: '#94A3B8' }}>
              <span>📞 Mobile: <b style={{ color: '#F1F5F9' }}>{profile?.phone || '09XXXXXXXXX'}</b></span>
              <span>🚨 Emergency: <b style={{ color: '#F1F5F9' }}>{profile?.emergency_contact || 'None'}</b></span>
              <span>📍 Location: <b style={{ color: '#F1F5F9' }}>{[profile?.address, profile?.city].filter(Boolean).join(', ') || 'Bolinao, Pangasinan'}</b></span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ borderColor: '#38BDF8', color: '#38BDF8', fontWeight: 600, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setProfOpen(true)}
        >
          ✏️ Edit Manifest Profile
        </button>
      </div>

      {/* ACTIVE RESORT STAY DIGITAL KEYCARD */}
      {activeStay && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.92))',
          border: '1.5px solid rgba(56, 189, 248, 0.45)',
          borderRadius: 16,
          padding: '24px 28px',
          marginBottom: 32,
          boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 18 }}>
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 12px',
                borderRadius: 999,
                background: 'rgba(16, 185, 129, 0.18)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#6EE7B7',
                fontSize: '0.74rem',
                fontWeight: 800,
                letterSpacing: '.06em',
                marginBottom: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                ACTIVE RESORT STAY
              </div>
              <h3 className="serif" style={{ fontSize: '1.9rem', color: '#FFFFFF', margin: 0 }}>
                {activeStay.rooms?.name || 'Beachfront Room'}
              </h3>
              <p style={{ color: '#94A3B8', fontSize: '0.88rem', margin: '4px 0 0' }}>
                {activeStay.rooms?.category || 'Accommodation'} · {fmtDate(activeStay.check_in)} to {fmtDate(activeStay.check_out)} ({activeStay.nights} nights, {activeStay.guests} guests)
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.14em', display: 'block', marginBottom: 4 }}>
                RFID / ROOM KEYCODE
              </span>
              <div className="keycode-badge" style={{ fontSize: '1.25rem', letterSpacing: '.14em', padding: '10px 18px' }}>
                {`JD-${activeStay.id.slice(0, 4).toUpperCase()}-${activeStay.check_in.replace(/-/g, '')}`}
              </div>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            padding: '14px 18px',
            borderRadius: 12,
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div>
              <small style={{ color: '#64748B', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block' }}>CHECK-IN</small>
              <div style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '.9rem' }}>2:00 PM (Front Desk 24/7)</div>
            </div>
            <div>
              <small style={{ color: '#64748B', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block' }}>CHECK-OUT</small>
              <div style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '.9rem' }}>12:00 NN</div>
            </div>
            <div>
              <small style={{ color: '#64748B', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block' }}>FRONT DESK HOTLINE</small>
              <div style={{ color: '#38BDF8', fontWeight: 600, fontSize: '.9rem' }}>+63 900 555 0123</div>
            </div>
            <div>
              <small style={{ color: '#64748B', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block' }}>LOCATION</small>
              <div style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '.9rem' }}>Brgy. Patar, Bolinao</div>
            </div>
          </div>

          {/* CONNECTED VERIFIED GUEST MANIFEST STRIP IN STAY CARD */}
          <div style={{
            marginTop: 14,
            padding: '10px 16px',
            borderRadius: 10,
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.22)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#BAE6FD' }}>
              <span>🛡️</span>
              <span>
                <strong>Manifest Pass:</strong> {profile?.full_name || 'Guest'} · <strong>Phone:</strong> {profile?.phone || '09XXXXXXXXX'} · <strong>Emergency:</strong> {profile?.emergency_contact || 'None'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setProfOpen(true)}
              style={{ background: 'none', border: 'none', color: '#38BDF8', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
            >
              Update Pass Details →
            </button>
          </div>
        </div>
      )}

      {/* BOOKINGS LIST */}
      {loading ? (
        [...Array(3)].map((_, i) => <div key={i} className="skel" style={{ height: 80, borderRadius: 12, marginBottom: 14 }} />)
      ) : list.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '64px 24px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          maxWidth: 580,
          margin: '30px auto',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏖️</div>
          <h3 className="serif" style={{ fontSize: '1.6rem', color: '#FFFFFF', marginBottom: 8 }}>
            No Reservations Yet
          </h3>
          <p style={{ color: '#94A3B8', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: 24 }}>
            Ready for white sand, salt air, and sunset at Cape Bolinao? Discover our beachfront cottages, group villas, and sea-view suites.
          </p>
          <Link to="/rooms" className="btn btn-sky" style={{ display: 'inline-flex', padding: '12px 24px', fontSize: '0.92rem' }}>
            Browse Accommodations ✦
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map((b) => {
            const d = new Date(b.check_in + 'T00:00:00');
            return (
              <div className="bk-row" key={b.id} style={{
                background: 'rgba(15, 23, 42, 0.7)',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className="bk-date" style={{
                    minWidth: 54,
                    textAlign: 'center',
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: 10,
                    padding: '8px 10px',
                  }}>
                    <b style={{ display: 'block', fontSize: '1.25rem', color: '#F8FAFC', lineHeight: 1 }}>{d.getDate()}</b>
                    <small style={{ fontSize: '.7rem', color: '#38BDF8', fontWeight: 700 }}>{d.toLocaleDateString([], { month: 'short' }).toUpperCase()}</small>
                  </div>
                  <div className="bk-main">
                    <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#FFFFFF' }}>{b.rooms?.name || 'Room'}</h4>
                    <p style={{ margin: '4px 0 0', fontSize: '.84rem', color: '#94A3B8' }}>
                      {fmtDate(b.check_in)} → {fmtDate(b.check_out)} · {b.nights} night(s) · {b.guests} guest(s) · <b style={{ color: '#38BDF8' }}>{money(b.total_php)}</b>
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    <span className={`pill ${b.status}`} style={{ textTransform: 'capitalize' }}>
                      {b.status.replace('_', ' ')}
                    </span>
                    {b.payment_status === 'refund_pending' && (
                      <span className="pill" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.35)', fontSize: '.72rem', fontWeight: 700 }}>
                        ⏳ Refund In Process
                      </span>
                    )}
                    {b.payment_status === 'refunded' && (
                      <span className="pill" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.35)', fontSize: '.72rem', fontWeight: 700 }}>
                        ✅ Refunded
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {['pending', 'confirmed'].includes(b.status) && b.payment_status !== 'refund_pending' && b.payment_status !== 'refunded' && (
                      <button className="act-btn" style={{ padding: '6px 14px', borderRadius: 8, fontSize: '.82rem' }} onClick={() => cancel(b.id)}>
                        Cancel
                      </button>
                    )}
                    {b.payment_status !== 'refund_pending' && b.payment_status !== 'refunded' && (
                      <button
                        className="act-btn"
                        style={{ padding: '6px 14px', borderRadius: 8, fontSize: '.82rem', borderColor: '#F59E0B', color: '#F59E0B', background: 'rgba(245, 158, 11, 0.08)' }}
                        onClick={() => {
                          setRefundModal(b);
                          setRefundAmount(b.downpayment_php || b.total_php || '');
                          setRefundPayoutMethod(b.payment_method || 'GCash');
                          setRefundAccountDetails(profile?.phone || '');
                        }}
                        title="Submit refund claim for this reservation"
                      >
                        💰 Request Refund
                      </button>
                    )}
                    {b.status === 'checked_out' && !b.reviews && (
                      <button className="act-btn" style={{ padding: '6px 14px', borderRadius: 8, fontSize: '.82rem', borderColor: '#38BDF8', color: '#38BDF8' }} onClick={() => { setRevModal(b); setRating(5); }}>
                        Write Review
                      </button>
                    )}
                    {b.reviews && (
                      <span style={{ fontSize: '.82rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}>
                        Reviewed <Stars value={b.reviews.rating} size={13} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* REVIEW MODAL */}
      {revModal && (
        <div className="modal-overlay" onClick={() => setRevModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="serif" style={{ fontSize: '1.5rem', margin: 0 }}>How was your stay?</h3>
              <p style={{ fontSize: '.85rem', color: '#94A3B8', margin: '4px 0 0' }}>{revModal.rooms?.name}</p>
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
              <button className="btn btn-sky" style={{ width: '100%', justifyContent: 'center' }}>Submit review ✦</button>
            </form>
          </div>
        </div>
      )}

      {/* GUEST PROFILE DETAILS MODAL */}
      {profOpen && (
        <div className="modal-overlay" onClick={() => setProfOpen(false)}>
          <div className="modal" style={{ maxWidth: 580, borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(56, 189, 248, 0.35)', boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head" style={{
              background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.95), rgba(14, 165, 233, 0.9))',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
            }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#BAE6FD', fontWeight: 800, marginBottom: 2 }}>
                  <span>🛡️</span> RESORT CHECK-IN MANIFEST
                </div>
                <h3 className="serif" style={{ fontSize: '1.6rem', color: '#FFFFFF', margin: 0 }}>Guest Manifest Profile</h3>
                <p style={{ fontSize: '.82rem', color: 'rgba(255,255,255,0.85)', margin: '4px 0 0' }}>
                  Manage verified guest identity & emergency contact details for resort RFID pass check-in.
                </p>
              </div>
              <button
                type="button"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: 'rgba(0,0,0,0.2)',
                  color: '#FFFFFF',
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  padding: 0,
                  lineHeight: 1,
                }}
                aria-label="Close"
                onClick={() => setProfOpen(false)}
              >
                ✕
              </button>
            </div>

            <form className="modal-body" onSubmit={saveProfile} style={{ padding: '22px 24px' }}>
              {/* ROW 1: Symmetrical 3-column names */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div className="field">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                    <span>FIRST NAME * (CHAR ONLY)</span>
                    {profForm.first_name && <span style={{ color: '#10B981' }}>✓</span>}
                  </label>
                  <input
                    required
                    value={profForm.first_name}
                    placeholder="Juan"
                    onChange={(e) => setProfForm({ ...profForm, first_name: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') })}
                  />
                </div>
                <div className="field">
                  <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>MIDDLE NAME (CHAR ONLY)</label>
                  <input
                    value={profForm.middle_name}
                    placeholder="Dela"
                    onChange={(e) => setProfForm({ ...profForm, middle_name: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') })}
                  />
                </div>
                <div className="field">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                    <span>LAST NAME * (CHAR ONLY)</span>
                    {profForm.last_name && <span style={{ color: '#10B981' }}>✓</span>}
                  </label>
                  <input
                    required
                    value={profForm.last_name}
                    placeholder="Cruz"
                    onChange={(e) => setProfForm({ ...profForm, last_name: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') })}
                  />
                </div>
              </div>

              {/* ROW 2: Symmetrical 2-column numbers (Phone & Emergency Contact) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="field">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                    <span>PHONE (11-DIGIT NUMBER ONLY)</span>
                    {profForm.phone && (
                      <span style={{ color: profForm.phone.length === 11 ? '#10B981' : '#F59E0B', fontSize: '0.74rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {profForm.phone.length}/11 digits
                      </span>
                    )}
                  </label>
                  <input
                    required
                    inputMode="numeric"
                    maxLength={11}
                    value={profForm.phone}
                    placeholder="09XXXXXXXXX"
                    onChange={(e) => setProfForm({ ...profForm, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                  />
                </div>

                <div className="field">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                    <span>EMERGENCY CONTACT (11-DIGIT NUMBER ONLY)</span>
                    {profForm.emergency_contact && (
                      <span style={{ color: profForm.emergency_contact.length === 11 ? '#10B981' : '#F59E0B', fontSize: '0.74rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {profForm.emergency_contact.length}/11 digits
                      </span>
                    )}
                  </label>
                  <input
                    inputMode="numeric"
                    maxLength={11}
                    value={profForm.emergency_contact}
                    placeholder="09XXXXXXXXX"
                    onChange={(e) => setProfForm({ ...profForm, emergency_contact: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                  />
                </div>
              </div>

              {/* ROW 3: Symmetrical 2-column locations (City & Address) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="field">
                  <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>CITY / PROVINCE (CHAR ONLY)</label>
                  <input
                    value={profForm.city}
                    placeholder="e.g. Bolinao, Pangasinan"
                    onChange={(e) => setProfForm({ ...profForm, city: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') })}
                  />
                </div>
                <div className="field">
                  <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>ADDRESS / STREET</label>
                  <input
                    value={profForm.address}
                    placeholder="e.g. Patar Beach"
                    onChange={(e) => setProfForm({ ...profForm, address: e.target.value })}
                  />
                </div>
              </div>

              {confirmDeleteProf ? (
                <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 12, padding: 14, textAlign: 'center', marginTop: 10 }}>
                  <b style={{ color: '#F87171', display: 'block', fontSize: '.92rem', marginBottom: 4 }}>
                    ⚠️ Permanently Delete Account?
                  </b>
                  <p style={{ color: '#FECACA', fontSize: '.78rem', margin: '0 0 12px' }}>
                    This action is permanent and cannot be undone. All your profile info and stay history will be deleted.
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button
                      type="button"
                      disabled={deletingProf}
                      onClick={async () => {
                        setDeletingProf(true);
                        try {
                          await deleteAccount();
                          setProfOpen(false);
                        } catch (err: any) {
                          toast(err.message, true);
                        } finally {
                          setDeletingProf(false);
                          setConfirmDeleteProf(false);
                        }
                      }}
                      className="btn"
                      style={{ background: '#EF4444', color: '#FFF', fontWeight: 700, padding: '8px 18px', borderRadius: 8 }}
                    >
                      {deletingProf ? 'Deleting…' : 'Yes, Delete Account'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteProf(false)}
                      className="btn btn-ghost"
                      style={{ border: '1px solid rgba(255,255,255,0.2)', padding: '8px 18px', borderRadius: 8 }}
                    >
                      No, Keep It
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
                  <button
                    type="submit"
                    className="btn btn-sky"
                    disabled={savingProf}
                    style={{ justifyContent: 'center', padding: '12px', fontSize: '.92rem', fontWeight: 700 }}
                  >
                    {savingProf ? 'Saving…' : '💾 Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteProf(true)}
                    className="btn"
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#F87171',
                      justifyContent: 'center',
                      padding: '12px',
                      fontSize: '.92rem',
                      fontWeight: 700,
                    }}
                  >
                    🗑️ Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfOpen(false)}
                    className="btn btn-ghost"
                    style={{
                      border: '1px solid rgba(255,255,255,0.2)',
                      justifyContent: 'center',
                      padding: '12px',
                      fontSize: '.92rem',
                      fontWeight: 700,
                    }}
                  >
                    ✕ Cancel
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* GUEST REFUND REQUEST MODAL */}
      {refundModal && (
        <div className="modal-overlay" onClick={() => setRefundModal(null)}>
          <div
            className="modal"
            style={{
              maxWidth: 540,
              borderRadius: 20,
              overflow: 'hidden',
              border: '1.5px solid rgba(245, 158, 11, 0.45)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-head"
              style={{
                background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.95), rgba(245, 158, 11, 0.9))',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              <div>
                <span style={{ fontSize: '.72rem', letterSpacing: '.12em', color: '#FEF3C7', fontWeight: 800, textTransform: 'uppercase' }}>
                  Accounting & Guest Refund Office
                </span>
                <h3 className="serif" style={{ fontSize: '1.45rem', color: '#FFFFFF', margin: '4px 0 0' }}>
                  💰 Request a Booking Refund
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRefundModal(null)}
                style={{ background: 'none', border: 'none', color: '#FFFFFF', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '14px 24px', background: 'rgba(245, 158, 11, 0.1)', borderBottom: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '.82rem', color: '#FDE68A' }}>
              Folio: <b>{refundModal.rooms?.name || 'Beachfront Unit'}</b> ({fmtDate(refundModal.check_in)} → {fmtDate(refundModal.check_out)}) · Booking Total: <b>{money(refundModal.total_php)}</b>
            </div>

            <form className="modal-body" onSubmit={submitGuestRefund} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '.78rem', color: '#94A3B8', lineHeight: 1.45 }}>
                ℹ️ <strong>Rock View Refund Guidelines:</strong> Cancellations made 7+ days prior are eligible for 100% refund. Within 3–6 days are eligible for 50%. Free full refund or rebooking applies under official storm/force majeure advisories.
              </div>

              <div className="field">
                <label style={{ fontSize: '.76rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Refund Amount (₱) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={refundModal.total_php || 50000}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF', fontSize: '.95rem' }}
                />
              </div>

              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label style={{ fontSize: '.76rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Payout Channel *</label>
                  <select
                    value={refundPayoutMethod}
                    onChange={(e) => setRefundPayoutMethod(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF', fontSize: '.88rem' }}
                  >
                    <option value="GCash">GCash</option>
                    <option value="Maya">Maya</option>
                    <option value="Bank Transfer">BDO / BPI / UnionBank</option>
                    <option value="Cash at Front Desk">Cash at Front Desk</option>
                  </select>
                </div>
                <div className="field">
                  <label style={{ fontSize: '.76rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Account / Mobile Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 0917XXXXXXX or Account #"
                    value={refundAccountDetails}
                    onChange={(e) => setRefundAccountDetails(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF', fontSize: '.88rem' }}
                  />
                </div>
              </div>

              <div className="field">
                <label style={{ fontSize: '.76rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Reason for Refund *</label>
                <textarea
                  rows={2}
                  required
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Habagat heavy rain, personal medical emergency, schedule conflict..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF', fontSize: '.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setRefundModal(null)}
                  disabled={submittingRefund}
                >
                  ✕ Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-sky btn-sm"
                  disabled={submittingRefund}
                  style={{ background: '#F59E0B', borderColor: '#D97706', color: '#FFFFFF', fontWeight: 700 }}
                >
                  {submittingRefund ? 'Submitting…' : '💾 Submit Refund Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
