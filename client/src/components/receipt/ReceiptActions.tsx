import React, { useState } from 'react';
import { VoucherData } from './receiptTypes';

interface ReceiptActionsProps {
  voucher: VoucherData;
  onClose?: () => void;
  onViewBookings?: () => void;
}

export const ReceiptActions: React.FC<ReceiptActionsProps> = ({
  voucher,
  onClose,
  onViewBookings,
}) => {
  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = async () => {
    const summary = [
      `🌊 ROCK VIEW BEACH RESORT · OFFICIAL VOUCHER`,
      `Reference: ${voucher.reference}`,
      `Guest: ${voucher.guestName}`,
      `Room: ${voucher.roomName} (${voucher.roomCategory || 'Beachfront Suite'})`,
      `Stay: ${voucher.checkIn} → ${voucher.checkOut} (${voucher.nights} Nights)`,
      `Total Amount: ₱${voucher.totalAmount.toLocaleString()}`,
      `30% Downpayment Paid: ₱${voucher.downpaymentAmount.toLocaleString()} (${voucher.paymentMethod})`,
      `70% Check-in Balance: ₱${voucher.balanceAmount.toLocaleString()}`,
      `Location: Patar Beach, Bolinao, Pangasinan`,
      `Front Desk Hotline: +63 900 555 0123`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = summary;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadItinerary = () => {
    const content = [
      `=============================================================`,
      `       ROCK VIEW BEACH RESORT · OFFICIAL BOOKING VOUCHER     `,
      `       Patar Beach, Bolinao, Pangasinan · Philippines        `,
      `=============================================================`,
      ``,
      `BOOKING REFERENCE : ${voucher.reference}`,
      `STATUS            : CONFIRMED & GUARANTEED (30% DEPOSIT PAID)`,
      `DATE OF ISSUE     : ${new Date(voucher.createdAt || Date.now()).toLocaleDateString()}`,
      ``,
      `[GUEST DETAILS]`,
      `Guest Name        : ${voucher.guestName}`,
      `Contact Phone     : ${voucher.guestPhone || 'On File'}`,
      `Email Address     : ${voucher.guestEmail || 'On File'}`,
      ``,
      `[ACCOMMODATION & STAY]`,
      `Room / Villa      : ${voucher.roomName}`,
      `Category          : ${voucher.roomCategory || 'Beachfront Suite'}`,
      `Check-in Date     : ${voucher.checkIn} (From 2:00 PM)`,
      `Check-out Date    : ${voucher.checkOut} (Until 12:00 PM Noon)`,
      `Duration          : ${voucher.nights} Night(s)`,
      `Guests            : ${voucher.guests || 2} Person(s)`,
      ``,
      `[BILLING & PAYMENT BREAKDOWN]`,
      `Total Room Rate   : PHP ${voucher.totalAmount.toLocaleString()}`,
      `30% Downpayment   : PHP ${voucher.downpaymentAmount.toLocaleString()} [PAID via ${voucher.paymentMethod}]`,
      `70% Due at Checkin: PHP ${voucher.balanceAmount.toLocaleString()} [PAYABLE UPON ARRIVAL]`,
      ``,
      `[INCLUSIONS & PERKS]`,
      `✦ High-speed Coastal Wi-Fi throughout resort`,
      `✦ Full Swimming Pool & Beachfront access`,
      `✦ 24/7 Heavy-duty Generator Backup`,
      `✦ Free Secure Gated Parking`,
      ``,
      `[HOUSE GUIDELINES]`,
      `1. Please present this document or SMS confirmation at the Reception desk upon check-in.`,
      `2. Swimming pool is open daily from 7:00 AM to 10:00 PM.`,
      `3. Quiet hours strictly observed after 10:00 PM.`,
      `4. Front Desk Concierge: +63 900 555 0123`,
      `=============================================================`,
    ].join('\r\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Voucher-${voucher.reference}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="receipt-no-print mt-5 flex flex-wrap items-center justify-center gap-3">
      {/* 1. Print / Save as PDF */}
      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-400 to-cyan-400 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg shadow-sky-500/20 transition hover:brightness-110 active:scale-95 cursor-pointer"
        title="Print voucher or save as PDF"
      >
        <i className="fas fa-print" />
        <span>Save / Print PDF</span>
      </button>

      {/* 2. Copy Summary */}
      <button
        type="button"
        onClick={handleCopySummary}
        className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-950/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-sky-300 transition hover:bg-sky-900/60 active:scale-95 cursor-pointer"
        title="Copy SMS-ready summary"
      >
        <i className={copied ? 'fas fa-check text-emerald-400' : 'fas fa-copy'} />
        <span>{copied ? 'Copied to Clipboard!' : 'Copy Summary'}</span>
      </button>

      {/* 3. Download Itinerary Text */}
      <button
        type="button"
        onClick={handleDownloadItinerary}
        className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-slate-200 transition hover:bg-white/10 active:scale-95 cursor-pointer"
        title="Download text itinerary"
      >
        <i className="fas fa-file-arrow-down" />
        <span>Download Itinerary</span>
      </button>

      {/* 4. Optional View Bookings / Stays */}
      {onViewBookings && (
        <button
          type="button"
          onClick={onViewBookings}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-slate-200 transition hover:bg-white/10 active:scale-95 cursor-pointer"
        >
          <i className="fas fa-calendar-check" />
          <span>My Stays</span>
        </button>
      )}

      {/* 5. Close */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
        >
          <span>Done</span>
        </button>
      )}
    </div>
  );
};
