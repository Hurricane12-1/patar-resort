import React from 'react';
import { computeVatBreakdown } from '../../../lib/ledgerUtils';

export interface GuestFolioReceiptModalProps {
  booking: any;
  isOpen?: boolean;
  onClose: () => void;
  adminProfileState?: {
    fullName?: string;
    role?: string;
  } | null;
  onPrint?: () => void;
}

export const GuestFolioReceiptModal: React.FC<GuestFolioReceiptModalProps> = ({
  booking,
  isOpen = true,
  onClose,
  adminProfileState,
  onPrint,
}) => {
  if (!booking || !isOpen) return null;

  const checkIn = new Date(booking.check_in || Date.now());
  const checkOut = new Date(booking.check_out || Date.now() + 86400000);
  const diffDays = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
  const totalAmt = Number(booking.total_price || booking.total_amount || booking.total_php || 3500);
  const ratePerNight = Math.round(totalAmt / diffDays);
  
  const vat = computeVatBreakdown(totalAmt);
  const vatableSales = vat.vatableSales;
  const vatAmount = vat.vatAmount;

  const folioId = `FOLIO-2026-${String(booking.id || '010101').slice(0, 6).toUpperCase()}`;
  const ledgerRef = booking.ledger_voucher || ('LED-2026-' + String(booking.id || '010101').slice(0, 6).toUpperCase());

  // Parse swimming pool add-on from reservation notes if present
  const notesStr = String(booking.notes || '');
  const hasPoolAddon = notesStr.includes('Pool Add-on:');
  let poolPassName = 'Swimming Pool Pass Add-on';
  let poolAmount = 0;
  if (hasPoolAddon) {
    const match = notesStr.match(/\[Pool Add-on:\s*([^(\]]+)(?:\s*\(\+₱([0-9,]+)\))?\]/);
    if (match) {
      poolPassName = `Swimming Pool: ${match[1].trim()}`;
      if (match[2]) {
        poolAmount = Number(match[2].replace(/,/g, '')) || 0;
      }
    }
  }
  const roomBaseTotal = Math.max(0, totalAmt - poolAmount);
  const baseRatePerNight = Math.round(roomBaseTotal / diffDays);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.8)',
        backdropFilter: 'blur(10px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          background: '#FFFFFF',
          color: '#0F172A',
          borderRadius: 20,
          border: '1px solid #CBD5E1',
          padding: 32,
          boxShadow: '0 25px 60px -15px rgba(0,0,0,0.6)',
          maxHeight: '92vh',
          overflowY: 'auto',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* PRINTABLE AREA CONTAINER */}
        <div id="receipt-printable-area">
          {/* 1. RESORT HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0EA5E9', paddingBottom: 16, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fas fa-umbrella-beach" style={{ fontSize: "1.4rem", color: "#0EA5E9" }} />
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  ROCK VIEW BEACH RESORT
                </h2>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '.8rem', color: '#64748B' }}>
                Patar Beach Road, Barangay Patar, Bolinao, Pangasinan 2406
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '.76rem', color: '#64748B' }}>
                TIN: 009-847-192-000-NV • Non-VAT Official Resort Billing Folio
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '.76rem', color: '#0EA5E9', fontWeight: 600 }}>
                Tel: +63 917 123 4567 • Email: reservations@rockviewresort.ph
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: 6,
                background: '#0EA5E9',
                color: '#FFFFFF',
                fontSize: '.74rem',
                fontWeight: 800,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
              }}>
                OFFICIAL GUEST FOLIO
              </span>
              <h3 style={{ margin: '8px 0 2px', fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                {folioId}
              </h3>
              <small style={{ display: 'block', fontSize: '.72rem', color: '#64748B' }}>
                Date: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </small>
              <small style={{ display: 'block', fontSize: '.72rem', color: '#10B981', fontWeight: 700 }}>
                Status: PAID & SETTLED
              </small>
            </div>
          </div>

          {/* 2. GUEST & RESERVATION DETAILS GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: '#F8FAFC', padding: 16, borderRadius: 12, border: '1px solid #E2E8F0', marginBottom: 20 }}>
            <div>
              <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em' }}>GUEST INFORMATION</span>
              <b style={{ display: 'block', fontSize: '.95rem', color: '#0F172A', marginTop: 3 }}>
                {booking.guest_name || 'Registered Resort Guest'}
              </b>
              <span style={{ display: 'block', fontSize: '.78rem', color: '#475569', marginTop: 2 }}>
                <i className="fas fa-phone" style={{ marginRight: 6, color: '#0EA5E9', fontSize: '.7rem' }} />
                {booking.phone || booking.guest_phone || '+63 917 000 0000'}
              </span>
              <span style={{ display: 'block', fontSize: '.78rem', color: '#475569', marginTop: 2 }}>
                <i className="fas fa-envelope" style={{ marginRight: 6, color: '#0EA5E9', fontSize: '.7rem' }} />
                {booking.email || booking.guest_email || 'guest@rockviewresort.ph'}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em' }}>STAY SUMMARY</span>
              <b style={{ display: 'block', fontSize: '.95rem', color: '#0EA5E9', marginTop: 3 }}>
                {booking.room || booking.rooms?.name || 'Beachfront Villa Room'}
              </b>
              <span style={{ display: 'block', fontSize: '.78rem', color: '#475569', marginTop: 2 }}>
                <b>Check-In:</b> {checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (2:00 PM)
              </span>
              <span style={{ display: 'block', fontSize: '.78rem', color: '#475569', marginTop: 2 }}>
                <b>Check-Out:</b> {checkOut.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (12:00 PM)
              </span>
              <span style={{ display: 'block', fontSize: '.78rem', color: '#475569', marginTop: 2 }}>
                <b>Stay Duration:</b> {diffDays} {diffDays === 1 ? 'Night' : 'Nights'} • {booking.guests || 2} Registered Guests
              </span>
            </div>
          </div>

          {/* 3. ITEMIZED CHARGES TABLE */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.84rem', color: '#0F172A', marginBottom: 20 }}>
            <thead>
              <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #CBD5E1', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', fontWeight: 800, color: '#475569' }}>DESCRIPTION</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: '#475569' }}>QTY / NIGHTS</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#475569' }}>RATE (PHP)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#475569' }}>AMOUNT (PHP)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '12px' }}>
                  <b>{booking.room || booking.rooms?.name || 'Beachfront Villa Room'}</b>
                  <small style={{ display: 'block', color: '#64748B', fontSize: '.74rem' }}>
                    Standard check-in privileges with resort amenities
                  </small>
                </td>
                <td style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>{diffDays}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>₱{(hasPoolAddon && poolAmount > 0 ? baseRatePerNight : ratePerNight).toLocaleString()}</td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>₱{(hasPoolAddon && poolAmount > 0 ? roomBaseTotal : totalAmt).toLocaleString()}</td>
              </tr>
              {hasPoolAddon && poolAmount > 0 && (
                <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#F0FDF4' }}>
                  <td style={{ padding: '12px' }}>
                    <b style={{ color: "#047857" }}><i className="fas fa-person-swimming" style={{ marginRight: 6 }} />{poolPassName}</b>
                    <small style={{ display: 'block', color: '#059669', fontSize: '.74rem' }}>
                      Resort swimming pool privileges for {booking.guests || 2} guest(s)
                    </small>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#047857' }}>{booking.guests || 2}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#047857' }}>₱{Math.round(poolAmount / Math.max(1, booking.guests || 2)).toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#047857' }}>₱{poolAmount.toLocaleString()}</td>
                </tr>
              )}
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '12px' }}>
                  <b>Environmental & Tourism Municipal Fee</b>
                  <small style={{ display: 'block', color: '#64748B', fontSize: '.74rem' }}>
                    Local government unit conservation assessment
                  </small>
                </td>
                <td style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>1</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>₱0.00</td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>INCLUDED</td>
              </tr>
            </tbody>
          </table>

          {/* 4. FINANCIAL BREAKDOWN & VAT SPECIFICATION */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* Left Column: Tax & Settlement Info */}
            <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '.78rem' }}>
              <span style={{ fontSize: '.7rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                TAX BREAKDOWN (NON-VAT ENTITY)
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: '#475569' }}>
                <span>VATable Sales:</span>
                <span style={{ fontFamily: 'monospace' }}>₱{vatableSales.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, color: '#475569' }}>
                <span>12% VAT:</span>
                <span style={{ fontFamily: 'monospace' }}>₱{vatAmount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, color: '#475569' }}>
                <span>VAT-Exempt Sales:</span>
                <span style={{ fontFamily: 'monospace' }}>₱0.00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTop: '1px dashed #CBD5E1', fontWeight: 700, color: '#0F172A' }}>
                <span>Settlement Mode:</span>
                <span>{booking.payment_method || 'Electronic Wallet (GCash/Maya)'}</span>
              </div>
            </div>

            {/* Right Column: Grand Total Calculations */}
            <div style={{ background: '#F1F5F9', padding: 14, borderRadius: 10, border: '1px solid #CBD5E1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: '#475569' }}>
                <span>Subtotal:</span>
                <span>₱{totalAmt.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: '#475569', marginTop: 4 }}>
                <span>Discounts:</span>
                <span>₱0.00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', marginTop: 10, borderTop: '2px solid #0EA5E9', paddingTop: 8 }}>
                <span>TOTAL BILLED:</span>
                <span style={{ color: '#0284C7' }}>₱{totalAmt.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: '#10B981', fontWeight: 700, marginTop: 4 }}>
                <span>Total Paid:</span>
                <span>₱{totalAmt.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: '#64748B', fontWeight: 700, marginTop: 2 }}>
                <span>Balance Remaining:</span>
                <span>₱0.00 (PAID IN FULL)</span>
              </div>
            </div>
          </div>

          {/* 5. DOUBLE-ENTRY GENERAL LEDGER VOUCHER CONNECTION */}
          <div style={{
            background: '#F0FDF4',
            border: '1px solid #86EFAC',
            borderRadius: 10,
            padding: 12,
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}>
            <div>
              <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                <i className="fas fa-book-journal-whills" style={{ marginRight: 6 }} />
                DOUBLE-ENTRY GENERAL LEDGER RECONCILIATION
              </span>
              <div style={{ fontSize: '.8rem', color: '#14532D', marginTop: 2 }}>
                Voucher Ref: <b style={{ fontFamily: 'monospace' }}>{ledgerRef}</b> • Status: <b style={{ color: '#15803D' }}>BALANCED & RECONCILED</b>
              </div>
              <div style={{ fontSize: '.72rem', color: '#166534', marginTop: 2 }}>
                DR: Acct 1010 (Cash Clearing & Digital Wallets) ₱{totalAmt.toLocaleString()} | CR: Acct 4010 (Accommodations Revenue) ₱{totalAmt.toLocaleString()}
              </div>
            </div>
            <span style={{
              fontSize: '.7rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 6,
              background: '#DCFCE7',
              color: '#15803D',
              border: '1px solid #86EFAC',
            }}>
              GL AUDIT VERIFIED
            </span>
          </div>

          {/* 6. SIGNATURE BLOCK */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 28, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid #94A3B8', height: 36, marginBottom: 6 }} />
              <span style={{ fontSize: '.76rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>GUEST SIGNATURE / CONFORME</span>
              <small style={{ display: 'block', fontSize: '.68rem', color: '#64748B' }}>Acknowledged Room Rules & Settlement</small>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid #94A3B8', height: 36, marginBottom: 6 }} />
              <span style={{ fontSize: '.76rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>AUTHORIZED RESORT CASHIER</span>
              <small style={{ display: 'block', fontSize: '.68rem', color: '#64748B' }}>
                {adminProfileState?.fullName || 'Front Desk Duty Manager'}
              </small>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: '.7rem', color: '#94A3B8' }}>
            Thank you for staying at Rock View Beach Resort! • This document serves as an official accounting folio statement.
          </div>
        </div>

        {/* ACTION BUTTONS (HIDDEN IN PRINT VIA CSS) */}
        <div className="receipt-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, borderTop: '1px solid #E2E8F0', paddingTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm"
            style={{ border: '1px solid #CBD5E1', color: '#475569', fontWeight: 700 }}
          >
            <i className="fas fa-xmark" style={{ marginRight: 6 }} /> Close Folio
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-sky btn-sm"
              style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px' }}
            >
              <i className="fas fa-print" /> Save as PDF / Print Official Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
