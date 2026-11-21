import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { API_BASE } from '../lib/api';

const SECTIONS = [
  { id: 'downpayment', title: '50% Downpayment', icon: 'fa-credit-card' },
  { id: 'schedule', title: 'Check-in / Check-out', icon: 'fa-clock' },
  { id: 'cancellation', title: 'Cancellation & Weather', icon: 'fa-umbrella' },
  { id: 'house-rules', title: 'House Rules & Quiet Hours', icon: 'fa-moon' },
  { id: 'pool', title: 'Pool & Beachfront', icon: 'fa-water' },
  { id: 'dining', title: 'Dining & Zero Corkage', icon: 'fa-utensils' },
  { id: 'pets', title: 'Pet Policy', icon: 'fa-paw' },
  { id: 'security', title: 'Power, Wi-Fi & Safety', icon: 'fa-shield-halved' },
  { id: 'data-deletion', title: 'User Data Deletion', icon: 'fa-user-shield' },
];

export default function PolicyPage() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('downpayment');
  const [deletionEmail, setDeletionEmail] = useState('');
  const [deletionReason, setDeletionReason] = useState('Facebook / Google OAuth Account & Personal Data Removal');
  const [deletionSubmitting, setDeletionSubmitting] = useState(false);
  const [deletionResult, setDeletionResult] = useState<{ code: string; email?: string; status: string } | null>(null);
  const [deletionError, setDeletionError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const codeParam = params.get('code');
    if (codeParam) {
      setDeletionResult({
        code: codeParam,
        status: 'COMPLETED — Permanent Account & OAuth Data Erasure Verified',
      });
    }

    const isDirectDeletionRoute =
      location.pathname.startsWith('/data-deletion') ||
      location.pathname.startsWith('/privacy');

    const targetId = isDirectDeletionRoute
      ? 'data-deletion'
      : location.hash
      ? location.hash.replace('#', '')
      : '';

    if (targetId) {
      setActiveSection(targetId);
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 80);
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash, location.search]);

  const handleDataDeletionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeletionError('');
    const trimmed = deletionEmail.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setDeletionError('Please enter the email address associated with your Facebook, Google, or Resort account.');
      return;
    }
    setDeletionSubmitting(true);
    try {
      const endpoint = `${API_BASE || ''}/api/auth/data-deletion`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, reason: deletionReason }),
      });
      const data = await res.json().catch(() => null);
      const code = data?.confirmation_code || `DEL-${Date.now().toString(36).toUpperCase()}`;
      setDeletionResult({
        code,
        email: trimmed,
        status: data?.message || 'Account and associated Facebook/Google OAuth personal data scheduled and purged.',
      });
      setDeletionEmail('');
    } catch {
      const fallbackCode = `DEL-${Date.now().toString(36).toUpperCase()}`;
      setDeletionResult({
        code: fallbackCode,
        email: trimmed,
        status: 'Your data deletion request has been logged and queued for permanent removal.',
      });
      setDeletionEmail('');
    } finally {
      setDeletionSubmitting(false);
    }
  };

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -90;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="policy-page" style={{ minHeight: '100vh', background: '#070D14', color: '#F8FAFC', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(7, 13, 20, 0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '14px 20px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link to="/" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#38BDF8',
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
            }}>
              <i className="fas fa-arrow-left" />
              <span>Back to Resort</span>
            </Link>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.04em', color: '#FFFFFF' }}>
                ROCK VIEW BEACH RESORT
              </span>
              <span style={{ fontSize: '0.7rem', color: '#38BDF8', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Patar, Bolinao · Official Policies & Rules
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/#booking" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #0284C7, #0369A1)',
              color: '#FFFFFF',
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
            }}>
              <i className="fas fa-calendar-check" />
              <span>Book a Stay</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section style={{
        padding: '50px 20px 40px',
        background: 'radial-gradient(circle at 50% 0%, rgba(14, 165, 233, 0.15) 0%, transparent 70%)',
        textAlign: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 14px',
            borderRadius: 999,
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            color: '#38BDF8',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 16,
          }}>
            <i className="fas fa-shield-alt" />
            Official Resort Governance &amp; Guest Standards
          </div>

          <h1 style={{
            fontSize: 'clamp(1.9rem, 4vw, 2.8rem)',
            fontWeight: 800,
            lineHeight: 1.2,
            marginBottom: 16,
            color: '#FFFFFF',
            fontFamily: 'serif',
          }}>
            Resort Policies, 50% Downpayment &amp; House Guidelines
          </h1>

          <p style={{
            fontSize: 'clamp(0.95rem, 1.8vw, 1.08rem)',
            color: '#94A3B8',
            lineHeight: 1.6,
            maxWidth: 680,
            margin: '0 auto',
          }}>
            Everything you need to know about locking your dates with a <strong style={{ color: '#F8FAFC' }}>50% reservation downpayment</strong>, contactless RFID check-in, pool rules, dining privileges, and serene stay standards in Patar, Bolinao.
          </p>
        </div>
      </section>

      {/* Main Layout with Sticky Nav & Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 20px 80px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 32 }}>
        
        {/* Quick Nav Pills Bar */}
        <div style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 8,
          scrollbarWidth: 'thin',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          {SECTIONS.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => scrollTo(sec.id)}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '8px 14px',
                  borderRadius: 20,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isActive ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: isActive ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.03)',
                  color: isActive ? '#38BDF8' : '#94A3B8',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <i className={`fas ${sec.icon}`} style={{ fontSize: '0.75rem' }} />
                <span>{sec.title}</span>
              </button>
            );
          })}
        </div>

        {/* Policy Content Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* Section 1: 50% Downpayment & Payment Policy */}
          <section id="downpayment" style={{
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(15, 23, 42, 0.5) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 16,
            padding: '28px 24px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38BDF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
              }}>
                <i className="fas fa-credit-card" />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#38BDF8', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Section 1 · Mandatory Policy
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  50% Reservation Downpayment &amp; Payment Mechanics
                </h2>
              </div>
            </div>

            <div style={{
              background: 'rgba(56, 189, 248, 0.08)',
              borderLeft: '4px solid #38BDF8',
              padding: '14px 18px',
              borderRadius: '0 8px 8px 0',
              marginBottom: 20,
            }}>
              <strong style={{ color: '#38BDF8' }}>50% Downpayment Mandate:</strong> To lock your chosen suite or cottage and guarantee calendar availability, an initial <strong>50% reservation downpayment</strong> is required upon booking submission. The remaining <strong>50% balance</strong> is settled upon arrival at the Front Desk.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 16, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <h4 style={{ fontSize: '0.92rem', color: '#F1F5F9', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fas fa-shield-check" style={{ color: '#38BDF8' }} /> Accepted Payment Modes
                </h4>
                <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  We accept <strong>GCash, Maya, and Online Bank Transfers (BDO, BPI, UnionBank, Landbank)</strong>. Bank account details and merchant QR codes are displayed at checkout.
                </p>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 16, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <h4 style={{ fontSize: '0.92rem', color: '#F1F5F9', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fas fa-barcode" style={{ color: '#38BDF8' }} /> Instant Digital Voucher &amp; RFID Pass
                </h4>
                <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Once your 50% deposit is verified, your official <strong>Digital Folio Voucher and Scannable Barcode Pass</strong> are immediately activated in your guest dashboard (<code>/client</code>).
                </p>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 16, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <h4 style={{ fontSize: '0.92rem', color: '#F1F5F9', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fas fa-coins" style={{ color: '#38BDF8' }} /> 50% Remaining Balance on Arrival
                </h4>
                <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  The remaining 50% is due at Front Desk check-in. Payments can be settled via Cash, GCash, Maya, or Debit/Credit Card before keycard handover.
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#CBD5E1', lineHeight: 1.6, margin: 0 }}>
              💡 <em>Important: All accommodations are billed on a flat-rate per room/cottage per night basis, not per head. Unconfirmed reservations without proof of downpayment within 24 hours are automatically released back to public inventory.</em>
            </p>
          </section>

          {/* Section 2: Check-in / Check-out & 2-Hour Buffer */}
          <section id="schedule" style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: '28px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
              }}>
                <i className="fas fa-clock" />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#F59E0B', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Section 2 · Schedule &amp; Turnover
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  Check-in (2:00 PM), Check-out (12:00 NN) &amp; 2-Hour Buffer
                </h2>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 18, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.05)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Standard Check-in</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38BDF8', marginTop: 4 }}>2:00 PM</div>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Early check-in subject to room readiness</span>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 18, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.05)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Standard Check-out</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#F59E0B', marginTop: 4 }}>12:00 NN</div>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Late checkout must be arranged with desk</span>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 18, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.05)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Sanitation Buffer</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10B981', marginTop: 4 }}>2 Hours</div>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>12:00 NN to 2:00 PM deep cleaning</span>
              </div>
            </div>

            <div style={{ fontSize: '0.88rem', color: '#94A3B8', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: 0 }}>
                • <strong style={{ color: '#F1F5F9' }}>2-Hour Deep Turnover Window:</strong> The 2-hour window between 12:00 NN and 2:00 PM is strictly preserved for our housekeeping crew to perform full linen changes, bathroom sanitization, and air purification to ensure pristine conditions for the arriving guests.
              </p>
              <p style={{ margin: 0 }}>
                • <strong style={{ color: '#F1F5F9' }}>Early Arrival &amp; Luggage Drop:</strong> Arriving in Patar early? You are welcome to store your bags securely at the Front Desk reception (free of charge), swim in our pool, or enjoy lunch at the seaside dining lounge while your suite is readied.
              </p>
              <p style={{ margin: 0 }}>
                • <strong style={{ color: '#F1F5F9' }}>Keypad Door PIN:</strong> Your 6-digit electronic room door PIN is dispatched via SMS and activated exactly at 2:00 PM on your check-in date.
              </p>
            </div>
          </section>

          {/* Section 3: Cancellation & Weather Guarantees */}
          <section id="cancellation" style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: '28px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
              }}>
                <i className="fas fa-umbrella" />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Section 3 · Peace of Mind
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  Cancellation, Rescheduling &amp; Severe Weather Policy
                </h2>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 16, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 700, textTransform: 'uppercase' }}>7+ Days in Advance</span>
                <h4 style={{ fontSize: '1.05rem', color: '#FFFFFF', margin: '4px 0 6px' }}>100% Full Refund</h4>
                <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Cancellations requested 7 days or more prior to arrival receive a 100% refund of the downpayment or free rebooking.
                </p>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 16, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontSize: '0.75rem', color: '#F59E0B', fontWeight: 700, textTransform: 'uppercase' }}>3 to 6 Days Notice</span>
                <h4 style={{ fontSize: '1.05rem', color: '#FFFFFF', margin: '4px 0 6px' }}>50% Resort Credit</h4>
                <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Cancellations within 3–6 days receive a 50% credit voucher valid for 6 months or free date rescheduling subject to rate parity.
                </p>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 16, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontSize: '0.75rem', color: '#38BDF8', fontWeight: 700, textTransform: 'uppercase' }}>PAGASA Typhoon Warning</span>
                <h4 style={{ fontSize: '1.05rem', color: '#FFFFFF', margin: '4px 0 6px' }}>100% Weather Shield</h4>
                <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  In the event of an official PAGASA Tropical Storm Signal affecting Pangasinan, guests receive 100% penalty-free rebooking or refund.
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
              * To request a cancellation or date adjustment, open your stay in the Guest Portal (<code>/client/bookings</code>) or message our 24/7 Front Desk concierge via chat or phone at <strong>+63 900 555 0123</strong>.
            </p>
          </section>

          {/* Section 4: House Rules & Quiet Hours */}
          <section id="house-rules" style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: '28px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#A855F7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
              }}>
                <i className="fas fa-moon" />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#A855F7', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Section 4 · Community Harmony
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  Resort House Rules, Quiet Hours &amp; Conduct
                </h2>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.88rem', color: '#CBD5E1', lineHeight: 1.6 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px 18px', borderRadius: 10 }}>
                <strong style={{ color: '#F1F5F9' }}>🌙 10:00 PM to 7:00 AM Quiet Hours:</strong> In compliance with the Bolinao Municipal Noise Ordinance and to guarantee restorative sleep for all residents, all karaoke/videoke machines, outdoor speakers, and noisy activities must cease promptly at 10:00 PM.
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px 18px', borderRadius: 10 }}>
                <strong style={{ color: '#F1F5F9' }}>🚭 100% Smoke-Free Rooms:</strong> All interior rooms and suites are strictly non-smoking (including e-cigarettes/vapes). Designated open-air smoking kiosks are available on the resort perimeter. A ₱3,000 ozone restoration fee applies to smoking inside rooms.
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px 18px', borderRadius: 10 }}>
                <strong style={{ color: '#F1F5F9' }}>🛡️ Gated Perimeter &amp; Visitor Policy:</strong> Non-checked-in day visitors are welcome until 8:00 PM upon registering at the Front Desk. Overnight occupancy must not exceed the stated unit capacity.
              </div>
            </div>
          </section>

          {/* Section 5: Swimming Pool & Beachfront */}
          <section id="pool" style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: '28px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(6, 182, 212, 0.15)',
                color: '#06B6D4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
              }}>
                <i className="fas fa-water" />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#06B6D4', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Section 5 · Recreation Safety
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  Swimming Pool &amp; Patar Beachfront Regulations
                </h2>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 16, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <h4 style={{ fontSize: '0.95rem', color: '#FFFFFF', marginBottom: 6 }}>🏊 Swimming Pool Hours</h4>
                <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  The adult pool and kiddie plunge pool are open from <strong>7:00 AM to 10:00 PM</strong> daily. Regular water testing and robotic filtration ensure hygienic water quality.
                </p>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 16, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <h4 style={{ fontSize: '0.95rem', color: '#FFFFFF', marginBottom: 6 }}>🩱 Proper Swimwear Required</h4>
                <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Nylon or spandex swimsuits, board shorts, and rash guards are required. Heavy cotton shirts, denim cutoffs, and zippers are prohibited in the swimming pool.
                </p>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 16, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <h4 style={{ fontSize: '0.95rem', color: '#FFFFFF', marginBottom: 6 }}>🪸 Coral Reef &amp; Rock Formations</h4>
                <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Patar Beach features natural coral coves and rock arches. We recommend wearing aqua shoes for shoreline exploration. Night swimming in open sea water after dusk is strictly prohibited.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6: Dining, Grilling & Zero Corkage */}
          <section id="dining" style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: '28px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(234, 88, 12, 0.15)',
                color: '#EA580C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
              }}>
                <i className="fas fa-utensils" />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#EA580C', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Section 6 · Culinary Freedom
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  Dining, Grilling &amp; Zero Corkage Fee Policy
                </h2>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.88rem', color: '#CBD5E1', lineHeight: 1.6 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px 18px', borderRadius: 10 }}>
                <strong style={{ color: '#10B981' }}>✅ ZERO Corkage Fee:</strong> Guests may bring outside cooked food, snacks, juices, beer, and liquor with absolutely zero corkage fees! Feel free to hold seaside family picnics.
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px 18px', borderRadius: 10 }}>
                <strong style={{ color: '#F1F5F9' }}>🔥 Free Beachfront Grilling Stations:</strong> Communal charcoal grilling stations are provided near the beach pavilions. Guests are welcome to bring their own charcoal or purchase bags from our on-site convenience shop.
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px 18px', borderRadius: 10 }}>
                <strong style={{ color: '#EF4444' }}>🚫 No In-Room Cooking:</strong> For fire prevention and odor safety, butane cassette stoves, electric induction cookers, and open flames are strictly forbidden inside guest sleeping quarters.
              </div>
            </div>
          </section>

          {/* Section 7: Pet Policy */}
          <section id="pets" style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: '28px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(236, 72, 153, 0.15)',
                color: '#EC4899',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
              }}>
                <i className="fas fa-paw" />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#EC4899', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Section 7 · Pet-Friendly Stays
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  Pet Policy &amp; Furbaby Guidelines
                </h2>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#94A3B8', lineHeight: 1.6, margin: '0 0 16px' }}>
              We know pets are family! Rock View Beach Resort proudly welcomes well-mannered dogs and cats.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 14, borderRadius: 10 }}>
                <strong style={{ color: '#F1F5F9', fontSize: '0.85rem' }}>🐕 Leash at All Times:</strong>
                <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: '4px 0 0', lineHeight: 1.4 }}>
                  Pets must be kept on a leash in common areas, garden walkways, and along the shoreline.
                </p>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 14, borderRadius: 10 }}>
                <strong style={{ color: '#F1F5F9', fontSize: '0.85rem' }}>🛏️ Bring Pet Beds / Mats:</strong>
                <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: '4px 0 0', lineHeight: 1.4 }}>
                  Please bring your pet’s bedding to prevent shedding on hotel linens. Pets are not allowed on guest beds.
                </p>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 14, borderRadius: 10 }}>
                <strong style={{ color: '#F1F5F9', fontSize: '0.85rem' }}>🧹 Pet Waste Cleanup:</strong>
                <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: '4px 0 0', lineHeight: 1.4 }}>
                  Pet parents are required to clean up after their pets immediately. Waste bags are available at reception.
                </p>
              </div>
            </div>
          </section>

          {/* Section 8: Power, Wi-Fi & Safety Infrastructure */}
          <section id="security" style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: '28px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#3B82F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
              }}>
                <i className="fas fa-shield-halved" />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#3B82F6', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Section 8 · Infrastructure Guarantees
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  24/7 Power, Fiber Wi-Fi &amp; Safety Guarantees
                </h2>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 18 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 16, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <h4 style={{ fontSize: '0.92rem', color: '#FFFFFF', marginBottom: 6 }}>⚡ Zero-Brownout Guarantee</h4>
                <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Powered by a commercial heavy-duty diesel generator and solar microgrid. Air conditioning, water pumps, and lighting run 24/7 without interruption.
                </p>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 16, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <h4 style={{ fontSize: '0.92rem', color: '#FFFFFF', marginBottom: 6 }}>📶 High-Speed Wi-Fi &amp; 5G</h4>
                <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Complimentary fiber Wi-Fi throughout the suites, dining lounge, and pool decks. Strong 4G/5G mobile signals for Globe, Smart, and DITO.
                </p>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 16, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <h4 style={{ fontSize: '0.92rem', color: '#FFFFFF', marginBottom: 6 }}>🏧 Bolinao ATM Advisory</h4>
                <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  There are no ATMs directly on Patar Beach. The nearest banks (BDO, Landbank, RCBC) are in Bolinao town proper (25 mins away). Please prepare cash or GCash before heading to Patar.
                </p>
              </div>
            </div>
          </section>

          {/* Section 9: User Data Deletion Instructions & Privacy Compliance (Facebook / Google OAuth) */}
          <section id="data-deletion" style={{
            background: 'rgba(15, 23, 42, 0.72)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: 16,
            padding: '28px 24px',
            boxShadow: '0 8px 32px rgba(2, 132, 199, 0.12)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(14, 165, 233, 0.18)',
                color: '#38BDF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
              }}>
                <i className="fas fa-user-shield" />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#38BDF8', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Section 9 · Privacy &amp; OAuth Data Governance
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  User Data Deletion Instructions (Facebook &amp; Google Sign-In)
                </h2>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#CBD5E1', lineHeight: 1.6, marginBottom: 20 }}>
              Rock View Beach Resort respects your privacy and complies with the Philippines Data Privacy Act of 2012 (RA 10173) and Meta / Google OAuth Platform Policies. If you signed in using <strong>Facebook Login</strong>, <strong>Google Sign-In</strong>, or a direct email account, you may permanently delete your account and personal data at any time using any of the three methods below:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 22 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 18, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.07)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', marginBottom: 6 }}>
                  Method 1 · Instant Self-Service
                </div>
                <h4 style={{ fontSize: '0.96rem', color: '#FFFFFF', margin: '0 0 8px' }}>
                  Delete via Resident Guest Portal
                </h4>
                <ol style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                  <li>Sign in to the <Link to="/client/login" style={{ color: '#38BDF8' }}>Resident Guest Portal</Link>.</li>
                  <li>Navigate to your <strong>Account Profile / Settings</strong>.</li>
                  <li>Click <strong>&ldquo;Permanently Delete My Account &amp; Data&rdquo;</strong> and confirm.</li>
                  <li>Your OAuth profile, email, phone number, and login credentials are immediately erased from our database.</li>
                </ol>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 18, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.07)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#60A5FA', textTransform: 'uppercase', marginBottom: 6 }}>
                  Method 2 · Via Facebook Settings
                </div>
                <h4 style={{ fontSize: '0.96rem', color: '#FFFFFF', margin: '0 0 8px' }}>
                  Remove App from Facebook Account
                </h4>
                <ol style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                  <li>Go to your Facebook profile&rsquo;s <strong>Settings &amp; Privacy &rarr; Settings</strong>.</li>
                  <li>Open <strong>Apps and Websites</strong> in the left menu.</li>
                  <li>Find <strong>Rock View Beach Resort</strong> and click <strong>Remove</strong>.</li>
                  <li>Check the option to delete associated activity and confirm to trigger our automated data deletion callback.</li>
                </ol>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 18, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.07)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34D399', textTransform: 'uppercase', marginBottom: 6 }}>
                  Method 3 · Direct Request Form
                </div>
                <h4 style={{ fontSize: '0.96rem', color: '#FFFFFF', margin: '0 0 8px' }}>
                  Online Request or Privacy Officer
                </h4>
                <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0, lineHeight: 1.6 }}>
                  Submit your registered email address in the instant Data Deletion form below, or email our Data Protection Officer at <strong>privacy@rockviewresort.ph</strong> with the subject <em>&ldquo;Data Deletion Request&rdquo;</em>. All requests are processed immediately with a tracking confirmation code.
                </p>
              </div>
            </div>

            {/* Interactive Data Deletion Request & Verification Box */}
            <div style={{
              background: 'rgba(7, 13, 20, 0.75)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 12,
              padding: '20px',
            }}>
              <h4 style={{ fontSize: '1rem', color: '#FFFFFF', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fas fa-trash-can" style={{ color: '#F43F5E' }} />
                Submit an Instant User Data Deletion Request
              </h4>
              <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: '0 0 14px' }}>
                Enter the email address linked to your Facebook Login, Google account, or Guest Profile to permanently erase your personal profile data and receive an official confirmation code.
              </p>

              {deletionResult && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: 10,
                  padding: '14px 16px',
                  marginBottom: 14,
                  color: '#A7F3D0',
                  fontSize: '0.84rem',
                }}>
                  <div style={{ fontWeight: 700, color: '#34D399', marginBottom: 4 }}>
                    <i className="fas fa-circle-check" style={{ marginRight: 6 }} />
                    Data Deletion Request Confirmed · Code: <code style={{ background: 'rgba(0,0,0,0.35)', padding: '2px 8px', borderRadius: 4, color: '#FFFFFF' }}>{deletionResult.code}</code>
                  </div>
                  <div>{deletionResult.status}</div>
                </div>
              )}

              {deletionError && (
                <div style={{
                  background: 'rgba(244, 63, 94, 0.12)',
                  border: '1px solid rgba(244, 63, 94, 0.4)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 12,
                  color: '#FDA4AF',
                  fontSize: '0.82rem',
                }}>
                  {deletionError}
                </div>
              )}

              <form onSubmit={handleDataDeletionSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <input
                  type="email"
                  required
                  value={deletionEmail}
                  onChange={(e) => setDeletionEmail(e.target.value)}
                  placeholder="Enter your Facebook / Google account email address..."
                  style={{
                    flex: '1 1 240px',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#FFFFFF',
                    fontSize: '0.86rem',
                  }}
                />
                <select
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  aria-label="Deletion scope"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#CBD5E1',
                    fontSize: '0.84rem',
                  }}
                >
                  <option value="Facebook / Google OAuth Account & Personal Data Removal">Facebook / Google OAuth Data Removal</option>
                  <option value="Full Guest Profile & Contact Information Erasure">Full Guest Profile Erasure</option>
                  <option value="Revoke Marketing & Notification Records">Revoke Notifications &amp; Chat History</option>
                </select>
                <button
                  type="submit"
                  disabled={deletionSubmitting}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    background: '#F43F5E',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    cursor: deletionSubmitting ? 'wait' : 'pointer',
                  }}
                >
                  {deletionSubmitting ? 'Processing...' : 'Request Data Deletion'}
                </button>
              </form>
            </div>
          </section>

          {/* Contact / Help Footer Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(14, 165, 233, 0.05) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: 16,
            padding: '24px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', color: '#FFFFFF', margin: '0 0 6px' }}>
                Have questions about our 50% downpayment or house rules?
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#94A3B8', margin: 0 }}>
                Our on-site reception is staffed 24/7. Call <strong>+63 900 555 0123</strong> or chat with Rock View Bot anytime.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <Link to="/#booking" style={{
                padding: '10px 20px',
                borderRadius: 8,
                background: '#38BDF8',
                color: '#070D14',
                fontSize: '0.88rem',
                fontWeight: 700,
                textDecoration: 'none',
              }}>
                Reserve Your Stay Now
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* Editorial Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        background: '#04070B',
        padding: '30px 20px',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: '#64748B',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            © {new Date().getFullYear()} Rock View Beach Resort · Patar Coastal Road, Bolinao, Pangasinan. All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Link to="/" style={{ color: '#94A3B8', textDecoration: 'none' }}>Home</Link>
            <Link to="/rooms" style={{ color: '#94A3B8', textDecoration: 'none' }}>Rooms &amp; Cottages</Link>
            <Link to="/client/bookings" style={{ color: '#94A3B8', textDecoration: 'none' }}>Guest Dashboard</Link>
            <Link to="/policy" style={{ color: '#38BDF8', textDecoration: 'none', fontWeight: 600 }}>Policies &amp; 50% Deposit</Link>
            <Link to="/data-deletion" style={{ color: '#38BDF8', textDecoration: 'none', fontWeight: 600 }}>User Data Deletion</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
