import React from 'react';
import { VoucherData } from './receiptTypes';
import { VoucherBarcode } from './VoucherBarcode';

interface LuxuryResortVoucherProps {
  voucher: VoucherData;
  isPrintMode?: boolean;
}

export const LuxuryResortVoucher: React.FC<LuxuryResortVoucherProps> = ({
  voucher,
  isPrintMode = false,
}) => {
  const peso = (val: number) => `₱${Number(val || 0).toLocaleString('en-PH')}`;

  const formattedCheckIn = React.useMemo(() => {
    try {
      return new Date(voucher.checkIn).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return voucher.checkIn;
    }
  }, [voucher.checkIn]);

  const formattedCheckOut = React.useMemo(() => {
    try {
      return new Date(voucher.checkOut).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return voucher.checkOut;
    }
  }, [voucher.checkOut]);

  const nightlyRate = Math.round(voucher.totalAmount / Math.max(1, voucher.nights));

  return (
    <div
      id="receipt-printable-area"
      className="luxury-resort-voucher relative mx-auto w-full max-w-[640px] overflow-hidden rounded-3xl border border-sky-400/30 bg-gradient-to-b from-[#0B1E38] via-[#09152A] to-[#060D1A] text-white shadow-2xl transition-all"
      style={{
        boxShadow: isPrintMode
          ? 'none'
          : '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(14, 165, 233, 0.15)',
      }}
    >
      {/* Background Watermark Wave Crest */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-[0.06]"
        style={{
          background: 'radial-gradient(circle, #38BDF8 0%, transparent 70%)',
        }}
      />

      {/* 1. RESORT HEADER & BRAND CREST */}
      <div className="relative border-b border-sky-500/20 bg-gradient-to-r from-sky-950/70 via-slate-900/80 to-sky-950/70 px-6 py-6 sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/40 bg-sky-500/15 text-sky-400 shadow-md">
              <i className="fas fa-umbrella-beach text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Rock View
                </span>
                <span className="rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-slate-950">
                  Resort Folio
                </span>
              </div>
              <span className="block text-[10px] font-medium uppercase tracking-[0.22em] text-sky-300/80">
                Patar Beach · Bolinao, Pangasinan
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400 block">
              VOUCHER REF
            </span>
            <span className="font-mono text-xs sm:text-sm font-bold text-sky-400 tracking-wider">
              {voucher.reference}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-slate-300">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold tracking-wide">
            <i className="fas fa-circle-check text-xs" /> Official Confirmed Reservation
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            Coordinates: 16.3042° N, 119.7821° E
          </span>
        </div>
      </div>

      {/* 2. ITINERARY & GUEST PASSPORT DETAILS */}
      <div className="px-6 py-5 sm:px-8">
        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs">
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Guest Resident
            </span>
            <span className="mt-0.5 block font-serif text-sm sm:text-base font-medium text-white truncate">
              {voucher.guestName}
            </span>
            {voucher.guestPhone && (
              <span className="text-[11px] text-sky-300/80 font-mono">
                {voucher.guestPhone}
              </span>
            )}
          </div>

          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Reserved Accommodation
            </span>
            <span className="mt-0.5 block font-serif text-sm sm:text-base font-medium text-sky-400 truncate">
              {voucher.roomName}
            </span>
            <span className="text-[10px] text-slate-300 uppercase tracking-wider">
              {voucher.roomCategory || 'Beachfront Suite'}
            </span>
          </div>

          <div className="border-t border-white/10 pt-3">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Check-in Date & Time
            </span>
            <span className="mt-0.5 block font-medium text-white">
              {formattedCheckIn}
            </span>
            <span className="text-[10px] text-amber-300 font-semibold">
              ✦ 2:00 PM Onwards
            </span>
          </div>

          <div className="border-t border-white/10 pt-3">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Check-out Date & Time
            </span>
            <span className="mt-0.5 block font-medium text-white">
              {formattedCheckOut}
            </span>
            <span className="text-[10px] text-slate-400">
              Until 12:00 PM Noon ({voucher.nights} {voucher.nights === 1 ? 'Night' : 'Nights'})
            </span>
          </div>
        </div>
      </div>

      {/* 3. TICKET PERFORATION DIVIDER WITH NOTCHES */}
      <div className="relative flex items-center justify-between px-2 my-1">
        {/* Left circular cutout */}
        <div className="h-6 w-6 -ml-3 rounded-full bg-[#070D1B] border-r border-sky-400/30" />
        {/* Dashed line */}
        <div className="flex-1 border-b-2 border-dashed border-sky-400/25 mx-2" />
        {/* Right circular cutout */}
        <div className="h-6 w-6 -mr-3 rounded-full bg-[#070D1B] border-l border-sky-400/30" />
      </div>

      {/* 4. FINANCIAL BREAKDOWN & PAYMENT RECEIPT */}
      <div className="px-6 py-5 sm:px-8">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3 flex items-center justify-between">
          <span>Billing Statement & Deposit Verification</span>
          <span className="text-sky-400 font-mono">{voucher.paymentMethod}</span>
        </h4>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span>Room Stay ({voucher.nights} nights @ {peso(nightlyRate)}/night)</span>
            <span className="font-mono text-white">{peso(voucher.totalAmount)}</span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span>Resort Amenities & Swimming Pool Access</span>
            <span className="text-emerald-400 font-medium font-mono">Complimentary</span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span>High-Speed Coastal Wi-Fi & Generator Backup</span>
            <span className="text-emerald-400 font-medium font-mono">Included 24/7</span>
          </div>

          <div className="my-2 border-t border-white/10" />

          {/* TOTAL */}
          <div className="flex items-center justify-between font-medium">
            <span className="text-white text-sm">Total Reservation Amount</span>
            <span className="font-serif text-lg font-bold text-white">
              {peso(voucher.totalAmount)}
            </span>
          </div>

          {/* 30% DOWNPAYMENT PAID */}
          <div className="flex items-center justify-between rounded-xl bg-emerald-950/40 border border-emerald-500/30 px-3.5 py-2.5 text-emerald-300">
            <div className="flex items-center gap-2">
              <i className="fas fa-shield-check text-emerald-400" />
              <div>
                <span className="block font-semibold">30% Downpayment (Verified)</span>
                <span className="text-[10px] opacity-80">Secured via {voucher.paymentMethod}</span>
              </div>
            </div>
            <span className="font-serif text-base font-bold text-emerald-300">
              {peso(voucher.downpaymentAmount)}
            </span>
          </div>

          {/* 70% BALANCE DUE UPON ARRIVAL */}
          <div className="flex items-center justify-between rounded-xl bg-amber-950/30 border border-amber-500/30 px-3.5 py-2.5 text-amber-200">
            <div className="flex items-center gap-2">
              <i className="fas fa-hand-holding-dollar text-amber-400" />
              <div>
                <span className="block font-semibold">70% Balance Due Upon Arrival</span>
                <span className="text-[10px] opacity-80">Payable at Front Desk check-in (Cash / GCash / Card)</span>
              </div>
            </div>
            <span className="font-serif text-base font-bold text-amber-300">
              {peso(voucher.balanceAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* 5. DIGITAL BARCODE & RFID ACTIVATION SEAL */}
      <div className="px-6 pb-6 sm:px-8">
        <VoucherBarcode reference={voucher.reference} />

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/40 p-3 text-[10px] text-slate-400 leading-relaxed">
          <p className="font-medium text-slate-200 mb-1 flex items-center gap-1.5">
            <i className="fas fa-bell-concierge text-sky-400" /> Front Desk House Guidelines & Arrival
          </p>
          <ul className="list-disc pl-4 space-y-0.5 text-slate-300/80">
            <li>Present this digital voucher or reference code upon arrival at the Reception Desk.</li>
            <li>Swimming pool open 7:00 AM – 10:00 PM. Quiet hours commence at 10:00 PM.</li>
            <li>Free secure on-site parking. Concierge hotline: <strong className="text-white">+63 900 555 0123</strong>.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
