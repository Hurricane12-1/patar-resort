import React from 'react';
import { fmtDate, fmtTime, money } from '../lib/format.ts';

export interface StatusTimelineBooking {
  id: string;
  guest_name?: string;
  phone?: string;
  email?: string;
  room?: string;
  rooms?: { name?: string; slug?: string; rate_php?: number };
  check_in: string;
  check_out: string;
  guests?: number;
  nights?: number;
  status: string;
  payment_status?: string;
  payment_method?: string;
  total_php?: number;
  downpayment_php?: number;
  notes?: string;
  created_at?: string;
  ledger_voucher?: string;
  reviews?: { rating?: number; comment?: string };
  profiles?: { full_name?: string; phone?: string; email?: string };
}

interface StatusTimelineModalProps {
  booking: StatusTimelineBooking | null;
  isOpen: boolean;
  onClose: () => void;
  viewerRole?: string; // 'administrator' | 'general_manager' | 'receptionist' | 'staff' | 'customer'
  onUpdateStatus?: (bookingId: string, newStatus: string) => void;
}

export default function StatusTimelineModal({
  booking,
  isOpen,
  onClose,
  viewerRole = 'staff',
  onUpdateStatus,
}: StatusTimelineModalProps) {
  if (!isOpen || !booking) return null;

  const isOverseer = ['administrator', 'admin', 'general_manager', 'manager'].includes(viewerRole.toLowerCase());
  const isCustomer = viewerRole.toLowerCase() === 'customer';

  const guestName = (booking.guest_name || booking.profiles?.full_name || 'Valued Resort Guest').trim();
  const roomName = booking.room || booking.rooms?.name || 'Beachfront Room';
  const totalAmount = Number(booking.total_php || 3500);
  const folioId = `FOLIO-2026-${String(booking.id || '000000').slice(0, 6).toUpperCase()}`;
  const ledgerVoucher = booking.ledger_voucher || `LED-2026-${String(booking.id || '000000').slice(0, 6).toUpperCase()}`;

  const checkInDate = new Date(booking.check_in + 'T00:00:00');
  const checkOutDate = new Date(booking.check_out + 'T00:00:00');
  const durationNights = booking.nights || Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86400000));
  const guestCount = booking.guests || 2;

  // Extract pool add-on from notes if present
  const notesStr = String(booking.notes || '');
  const hasPoolAddon = notesStr.includes('Pool Add-on:');
  let poolPassName = 'None';
  let poolCost = 0;
  if (hasPoolAddon) {
    const match = notesStr.match(/\[Pool Add-on:\s*([^(\]]+)(?:\s*\(\+₱([0-9,]+)\))?\]/);
    if (match) {
      poolPassName = match[1].trim();
      if (match[2]) poolCost = Number(match[2].replace(/,/g, '')) || 0;
    }
  }

  // Parse booking inception date
  const createdDate = booking.created_at ? new Date(booking.created_at) : checkInDate;

  // State classification
  const status = (booking.status || 'pending').toLowerCase();
  const paymentStatus = (booking.payment_status || 'paid').toLowerCase();
  const isRefunded = paymentStatus === 'refunded';
  const isRefundPending = paymentStatus === 'refund_pending';
  const isCancelled = status === 'cancelled';
  const isCheckedIn = status === 'checked_in';
  const isCheckedOut = status === 'checked_out';
  const isConfirmed = status === 'confirmed';
  const isPending = status === 'pending';

  // Determine current active present stage title & color
  let activeStageLabel = 'CONFIRMED';
  let activeStageBadgeBg = '#D1FAE5';
  let activeStageBadgeText = '#065F46';
  let activeStageBorder = '#A7F3D0';
  let activeStageDescription = 'Guaranteed Room Reservation & Settled Accommodations';

  if (isRefunded) {
    activeStageLabel = 'REFUNDED';
    activeStageBadgeBg = '#064E3B';
    activeStageBadgeText = '#34D399';
    activeStageBorder = '#059669';
    activeStageDescription = 'Reservation Cancelled & Financial Refund Successfully Processed';
  } else if (isCancelled) {
    activeStageLabel = 'CANCELLED';
    activeStageBadgeBg = '#4C1D24';
    activeStageBadgeText = '#FCA5A5';
    activeStageBorder = '#7F1D1D';
    activeStageDescription = 'Booking Cancelled by Guest Request or Front Desk Operations';
  } else if (isCheckedOut) {
    activeStageLabel = 'CHECKED OUT';
    activeStageBadgeBg = '#312E81';
    activeStageBadgeText = '#C7D2FE';
    activeStageBorder = '#4338CA';
    activeStageDescription = 'Stay Completed, Room Inspected & Key Card Cleared';
  } else if (isCheckedIn) {
    activeStageLabel = 'CHECKED IN';
    activeStageBadgeBg = '#1E3A8A';
    activeStageBadgeText = '#93C5FD';
    activeStageBorder = '#2563EB';
    activeStageDescription = 'In-House Resort Guest Active in Room';
  } else if (isPending) {
    activeStageLabel = 'PENDING APPROVAL';
    activeStageBadgeBg = '#78350F';
    activeStageBadgeText = '#FDE68A';
    activeStageBorder = '#92400E';
    activeStageDescription = 'Awaiting Front Desk Verification & Room Assignment';
  }

  // AI & Agent Communication State
  const aiResolved = true;
  const ratingVal = booking.reviews?.rating || 5;
  const reviewComment = booking.reviews?.comment || (isCustomer ? '' : 'Guest enjoyed the beachfront sunset and quick room check-in.');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.82)',
        backdropFilter: 'blur(10px)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 780,
          background: '#0F172A',
          color: '#F8FAFC',
          borderRadius: 20,
          border: '1px solid rgba(56, 189, 248, 0.35)',
          padding: '28px',
          boxShadow: '0 25px 65px -15px rgba(0,0,0,0.85)',
          maxHeight: '92vh',
          overflowY: 'auto',
          position: 'relative',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-umbrella-beach" style={{ fontSize: '1.4rem', color: '#38BDF8' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                  Reservation Status & Lifecycle Architecture
                </h3>
                <small style={{ color: '#94A3B8', fontSize: '.78rem' }}>
                  J&D Beach House Resort • Bolinao, Pangasinan
                </small>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '.76rem', color: '#38BDF8', background: 'rgba(56, 189, 248, 0.12)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                {folioId}
              </span>
              <span style={{ fontSize: '.78rem', color: '#CBD5E1' }}>
                Guest: <strong>{guestName}</strong>
              </span>
              <span style={{ fontSize: '.78rem', color: '#CBD5E1' }}>
                Room: <strong style={{ color: '#38BDF8' }}>{roomName}</strong>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#94A3B8',
              borderRadius: '50%',
              width: 32,
              height: 32,
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            title="Close status timeline"
          >
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* 1. PRESENT ACTIVE STAGE CARD */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.85))',
            borderRadius: 14,
            border: `1.5px solid ${activeStageBorder}`,
            padding: '16px 20px',
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 14,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          <div>
            <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#38BDF8', letterSpacing: '.12em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38BDF8', display: 'inline-block', boxShadow: '0 0 8px #38BDF8' }} />
              LATEST / PRESENT ACTIVE STAGE
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <span
                style={{
                  display: 'inline-block',
                  background: activeStageBadgeBg,
                  color: activeStageBadgeText,
                  border: `1px solid ${activeStageBorder}`,
                  borderRadius: 9999,
                  padding: '6px 18px',
                  fontWeight: 800,
                  fontSize: '.82rem',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                }}
              >
                {activeStageLabel}
              </span>
              <b style={{ fontSize: '1.05rem', color: '#FFFFFF' }}>{roomName}</b>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '.8rem', color: '#94A3B8' }}>
              {activeStageDescription}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '.7rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>STAY DURATION</span>
            <b style={{ fontSize: '1.1rem', color: '#10B981', display: 'block' }}>{money(totalAmount)}</b>
            <small style={{ color: '#94A3B8', fontSize: '.74rem' }}>
              {durationNights} Night{durationNights > 1 ? 's' : ''} • {guestCount} Guest{guestCount > 1 ? 's' : ''}
            </small>
          </div>
        </div>

        {/* 2. BRANCHED STATUS LIFECYCLE TIMELINE (VERTICAL STEPPER) */}
        <h4 style={{ margin: '0 0 16px', fontSize: '.92rem', color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '.08em', display: 'flex', alignItems: 'center', gap: 8 }}>
          <><i className="fas fa-location-dot" style={{ color: '#0EA5E9', marginRight: 6 }} />Lifecycle Milestones & Chronological Branching</>
        </h4>

        <div style={{ position: 'relative', paddingLeft: 28, marginBottom: 26 }}>
          {/* Vertical Stepper Line */}
          <div
            style={{
              position: 'absolute',
              left: 11,
              top: 14,
              bottom: 14,
              width: 2,
              background: 'linear-gradient(to bottom, #0EA5E9 40%, rgba(56, 189, 248, 0.2))',
            }}
          />

          {/* STEP 1: BOOKING CREATED */}
          <div style={{ position: 'relative', marginBottom: 22 }}>
            <div
              style={{
                position: 'absolute',
                left: -28,
                top: 2,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#0EA5E9',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '.7rem',
                fontWeight: 800,
                boxShadow: '0 0 10px rgba(14, 165, 233, 0.5)',
              }}
            >
              <i className="fas fa-check" />
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <b style={{ fontSize: '.88rem', color: '#F8FAFC' }}>1. Booked at / Reservation Inception</b>
                <span style={{ fontSize: '.72rem', color: '#38BDF8', fontFamily: 'monospace' }}>
                  {fmtDate(createdDate)} • {fmtTime(createdDate)}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '.78rem', color: '#94A3B8' }}>
                Initiator: <strong>{notesStr.includes('Walk-in Guest') ? 'Front Desk Staff (Walk-In Entry)' : 'Guest Self-Service (Online Web Engine)'}</strong>
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '.7rem', background: 'rgba(56, 189, 248, 0.1)', color: '#38BDF8', padding: '2px 8px', borderRadius: 8, border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                  {guestCount} Registered Guest{guestCount > 1 ? 's' : ''}
                </span>
                {hasPoolAddon && (
                  <span style={{ fontSize: '.7rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', padding: '2px 8px', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                    <><i className="fas fa-person-swimming" style={{ marginRight: 4 }} />Pool: {poolPassName} (+₱{poolCost.toLocaleString()})</>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* STEP 2: CONFIRMED & GUARANTEED */}
          <div style={{ position: 'relative', marginBottom: 22 }}>
            <div
              style={{
                position: 'absolute',
                left: -28,
                top: 2,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: !isPending ? '#10B981' : 'rgba(255,255,255,0.2)',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '.7rem',
                fontWeight: 800,
                boxShadow: !isPending ? '0 0 10px rgba(16, 185, 129, 0.5)' : 'none',
              }}
            >
              {!isPending ? <i className="fas fa-check" /> : '•'}
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <b style={{ fontSize: '.88rem', color: '#F8FAFC' }}>2. Reserved & Confirmed at</b>
                <span style={{ fontSize: '.72rem', color: '#10B981', fontFamily: 'monospace' }}>
                  {fmtDate(createdDate)} • Instant Confirmation
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '.78rem', color: '#94A3B8' }}>
                Ledger Voucher: <strong style={{ color: '#38BDF8', fontFamily: 'monospace' }}>{ledgerVoucher}</strong> • Settled via {booking.payment_method || 'GCash'}
              </p>
              {isConfirmed && !isCancelled && (
                <span style={{ display: 'inline-block', marginTop: 6, fontSize: '.68rem', background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 9999, fontWeight: 800 }}>
                  ● PRESENT ACTIVE STAGE
                </span>
              )}
            </div>
          </div>

          {/* STEP 3: CHECKED IN */}
          <div style={{ position: 'relative', marginBottom: 22 }}>
            <div
              style={{
                position: 'absolute',
                left: -28,
                top: 2,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: isCheckedIn || isCheckedOut ? '#2563EB' : 'rgba(255,255,255,0.15)',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '.7rem',
                fontWeight: 800,
                boxShadow: isCheckedIn ? '0 0 12px rgba(37, 99, 235, 0.7)' : 'none',
              }}
            >
              {isCheckedIn || isCheckedOut ? <i className="fas fa-check" /> : '3'}
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <b style={{ fontSize: '.88rem', color: '#F8FAFC' }}>3. Check-In at</b>
                <span style={{ fontSize: '.72rem', color: isCheckedIn ? '#60A5FA' : '#94A3B8', fontFamily: 'monospace' }}>
                  {isCheckedIn ? 'Checked In Today' : `${fmtDate(checkInDate)} (2:00 PM)`}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '.78rem', color: '#94A3B8' }}>
                Handled by: <strong>Duty Receptionist & Front Desk Key Dispatch</strong>
              </p>
              {isCheckedIn && (
                <span style={{ display: 'inline-block', marginTop: 6, fontSize: '.68rem', background: '#1E3A8A', color: '#93C5FD', padding: '2px 8px', borderRadius: 9999, fontWeight: 800 }}>
                  ● PRESENT ACTIVE STAGE (IN-HOUSE GUEST)
                </span>
              )}
            </div>
          </div>

          {/* STEP 4: CHECKED OUT */}
          <div style={{ position: 'relative', marginBottom: isCancelled ? 22 : 0 }}>
            <div
              style={{
                position: 'absolute',
                left: -28,
                top: 2,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: isCheckedOut ? '#4338CA' : 'rgba(255,255,255,0.15)',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '.7rem',
                fontWeight: 800,
              }}
            >
              {isCheckedOut ? <i className="fas fa-check" /> : '4'}
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <b style={{ fontSize: '.88rem', color: '#F8FAFC' }}>4. Check-Out at</b>
                <span style={{ fontSize: '.72rem', color: isCheckedOut ? '#A5B4FC' : '#94A3B8', fontFamily: 'monospace' }}>
                  {isCheckedOut ? 'Completed' : `${fmtDate(checkOutDate)} (12:00 NN)`}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '.78rem', color: '#94A3B8' }}>
                Handled by: <strong>Housekeeping Inspection & Front Desk Clearance</strong>
              </p>
              {isCheckedOut && (
                <span style={{ display: 'inline-block', marginTop: 6, fontSize: '.68rem', background: '#312E81', color: '#C7D2FE', padding: '2px 8px', borderRadius: 9999, fontWeight: 800 }}>
                  ● FINAL COMPLETED STAGE
                </span>
              )}
            </div>
          </div>

          {/* CONDITIONAL BRANCH: CANCELLATION & REFUND LIFECYCLE */}
          {(isCancelled || isRefunded || isRefundPending) && (
            <div style={{ position: 'relative', marginTop: 18 }}>
              <div
                style={{
                  position: 'absolute',
                  left: -28,
                  top: 2,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: isRefunded ? '#059669' : '#EF4444',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '.7rem',
                  fontWeight: 800,
                  boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
                }}
              >
                <i className="fas fa-xmark" />
              </div>
              <div style={{ background: 'rgba(76, 29, 36, 0.35)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <b style={{ fontSize: '.88rem', color: '#FCA5A5' }}>
                    {isRefunded ? '5. Cancelled & Refunded at' : '5. Cancelled at'}
                  </b>
                  <span style={{ fontSize: '.72rem', color: '#FCA5A5', fontFamily: 'monospace' }}>
                    Resolution Settled
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '.78rem', color: '#CBD5E1' }}>
                  Reason: <em>{booking.notes || 'Travel schedule modification / personal emergency'}</em>
                </p>
                {isRefunded && (
                  <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(6, 78, 59, 0.5)', borderRadius: 8, border: '1px solid rgba(5, 150, 105, 0.4)', fontSize: '.74rem', color: '#34D399' }}>
                    <i className="fas fa-arrow-rotate-left" style={{ marginRight: 6 }} />REFUNDED: Payout of ₱{totalAmount.toLocaleString()} confirmed via {booking.payment_method || 'GCash'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. AI & AGENT COMMUNICATION RESOLUTION & CSAT RATING */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 14,
            padding: '16px 20px',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: '.78rem', fontWeight: 800, color: '#38BDF8', letterSpacing: '.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <><i className="fas fa-robot" style={{ marginRight: 6 }} />AI Concierge & Agent Communications</>
            </span>
            <span style={{ fontSize: '.72rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>
              {aiResolved ? <><i className="fas fa-circle-check" style={{ marginRight: 4 }} />Resolved by AI Concierge</> : <><i className="fas fa-user-tie" style={{ marginRight: 4 }} />Handled by Staff</>}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: '.8rem', color: '#CBD5E1', lineHeight: 1.5 }}>
            Guest communication channel: <strong>24/7 Socket.io AI Concierge & SMS Gateway</strong>.
            Verified room amenities, swimming pool pass inclusion, and automated check-in directions.
          </p>

          {/* GUEST CSAT RATING */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <span style={{ fontSize: '.72rem', color: '#94A3B8', display: 'block' }}>GUEST SATISFACTION RATING</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ color: '#F59E0B', fontSize: '.85rem' }}><i className="fas fa-star" /><i className="fas fa-star" /><i className="fas fa-star" /><i className="fas fa-star" /><i className="fas fa-star" /></span>
                <strong style={{ fontSize: '.85rem', color: '#FFFFFF' }}>{ratingVal}.0 / 5.0</strong>
              </div>
            </div>
            {reviewComment && (
              <div style={{ fontSize: '.76rem', color: '#94A3B8', fontStyle: 'italic', maxWidth: 400 }}>
                "{reviewComment}"
              </div>
            )}
          </div>
        </div>

        {/* 4. OVERSEER / GENERAL MANAGER PRIVILEGED TELEMETRY CARD */}
        {isOverseer && (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(67, 56, 202, 0.15), rgba(15, 23, 42, 0.95))',
              border: '1.5px solid rgba(99, 102, 241, 0.45)',
              borderRadius: 14,
              padding: '16px 20px',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: '.78rem', fontWeight: 800, color: '#A5B4FC', letterSpacing: '.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                <><i className="fas fa-crown" style={{ marginRight: 6 }} />General Manager & Overseer Control Box</>
              </span>
              <span style={{ fontSize: '.68rem', background: 'rgba(99, 102, 241, 0.25)', color: '#C7D2FE', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                OVERSEER PRIVILEGE ACTIVE
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: '.74rem', color: '#CBD5E1', marginTop: 10 }}>
              <div>
                <span style={{ color: '#64748B', display: 'block' }}>Ledger Account Mapping</span>
                <b>Acct 4010 (Room Revenue)</b>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block' }}>GiST Hard Constraint</span>
                <b style={{ color: '#10B981' }}>Verified Overlap-Free</b>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block' }}>Net Revenue / VAT Non-Entity</span>
                <b>₱{(totalAmount / 1.12).toFixed(2)} (Tax: ₱{(totalAmount - totalAmount / 1.12).toFixed(2)})</b>
              </div>
            </div>

            {onUpdateStatus && (
              <div style={{ display: 'flex', gap: 8, marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, flexWrap: 'wrap' }}>
                {['pending', 'confirmed'].includes(status) && (
                  <button
                    onClick={() => onUpdateStatus(booking.id, 'checked_in')}
                    style={{ background: '#2563EB', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: '.76rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <><i className="fas fa-hotel" style={{ marginRight: 6 }} />Advance to Checked-In</>
                  </button>
                )}
                {status === 'checked_in' && (
                  <button
                    onClick={() => onUpdateStatus(booking.id, 'checked_out')}
                    style={{ background: '#4338CA', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: '.76rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <><i className="fas fa-door-open" style={{ marginRight: 6 }} />Advance to Checked-Out</>
                  </button>
                )}
                {['pending', 'confirmed'].includes(status) && (
                  <button
                    onClick={() => onUpdateStatus(booking.id, 'cancelled')}
                    style={{ background: '#EF4444', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: '.76rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <><i className="fas fa-xmark" style={{ marginRight: 6 }} />Cancel Reservation</>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* MODAL FOOTER */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              background: '#0EA5E9',
              color: '#FFFFFF',
              border: 'none',
              padding: '9px 24px',
              borderRadius: 10,
              fontSize: '.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Close Timeline
          </button>
        </div>
      </div>
    </div>
  );
}
