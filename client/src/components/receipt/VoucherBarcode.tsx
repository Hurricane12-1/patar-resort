import React from 'react';

interface VoucherBarcodeProps {
  reference: string;
}

export const VoucherBarcode: React.FC<VoucherBarcodeProps> = ({ reference }) => {
  // Generate deterministic barcode bar widths from the reference string
  const bars = React.useMemo(() => {
    const clean = (reference || 'RV-RES-2026').replace(/[^A-Z0-9]/gi, '');
    const pattern: number[] = [2, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1, 3, 2, 1, 2, 3, 1, 2, 2, 1];
    for (let i = 0; i < clean.length; i++) {
      pattern.push((clean.charCodeAt(i) % 3) + 1);
    }
    return pattern;
  }, [reference]);

  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900/60 border border-white/10 text-center">
      <div className="flex items-center gap-2 mb-2">
        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-mono tracking-widest text-emerald-300 uppercase font-semibold">
          RFID Keycard & Digital Pass Ready
        </span>
      </div>

      {/* SVG Barcode */}
      <svg
        className="h-10 w-full max-w-[260px] text-slate-200"
        viewBox="0 0 280 40"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Voucher Barcode"
      >
        {bars.map((width, idx) => {
          let x = 8;
          for (let prev = 0; prev < idx; prev++) {
            x += bars[prev] * 3.4;
          }
          if (x > 268) return null;
          return (
            <rect
              key={idx}
              x={x}
              y={2}
              width={Math.max(1.5, width * 1.8)}
              height={36}
              rx={0.5}
            />
          );
        })}
      </svg>

      <span className="mt-1.5 font-mono text-[11px] font-bold tracking-[0.25em] text-cyan-400">
        {reference}
      </span>
      <span className="text-[9px] text-white/40 tracking-wider mt-0.5">
        SCAN AT FRONT DESK FOR DIRECT ROOM ACCESS
      </span>
    </div>
  );
};
