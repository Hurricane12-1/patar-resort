import React from 'react';
import { VoucherData } from './receiptTypes';
import { LuxuryResortVoucher } from './LuxuryResortVoucher';
import { ReceiptActions } from './ReceiptActions';

interface VoucherModalProps {
  voucher: VoucherData | null;
  isOpen: boolean;
  onClose: () => void;
  onViewBookings?: () => void;
}

export const VoucherModal: React.FC<VoucherModalProps> = ({
  voucher,
  isOpen,
  onClose,
  onViewBookings,
}) => {
  if (!isOpen || !voucher) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Official Resort Booking Voucher"
    >
      <div
        className="relative max-h-[94vh] w-full max-w-[680px] overflow-y-auto rounded-3xl border border-sky-400/25 bg-[#071324] p-4 sm:p-6 shadow-2xl no-scrollbar scrollbar-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Close Bar */}
        <div className="receipt-no-print mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">
              Official Guest Voucher
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Voucher"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <i className="fas fa-xmark text-sm" />
          </button>
        </div>

        {/* The Luxury Voucher Component */}
        <LuxuryResortVoucher voucher={voucher} />

        {/* Action Buttons: Save PDF, Copy Summary, Download */}
        <ReceiptActions
          voucher={voucher}
          onClose={onClose}
          onViewBookings={onViewBookings}
        />
      </div>
    </div>
  );
};
