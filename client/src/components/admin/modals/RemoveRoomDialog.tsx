import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Phase = 'confirm' | 'processing' | 'done' | 'error';

interface RemovableRoom {
  id: string;
  name: string;
  category?: string;
  rate_php?: number | string;
}

interface RemoveRoomDialogProps {
  room: RemovableRoom;
  /** Resolves once the unit is removed. A rejection shows its message and keeps the unit. */
  onConfirm: (room: RemovableRoom) => Promise<void>;
  onClose: () => void;
}

const DONE_CLOSE_MS = 2200;
const BLOCKED_STATUSES = [400, 403, 404, 409];

const STYLES = `
.rv-remove-dialog button:focus-visible { outline: 3px solid #0369A1; outline-offset: 2px; }
.rv-remove-dialog button { cursor: pointer; }
.rv-remove-dialog button:disabled { cursor: not-allowed; opacity: .6; }
@keyframes rv-remove-spin { to { transform: rotate(360deg); } }
.rv-remove-spinner { animation: rv-remove-spin .9s linear infinite; }
@media (prefers-reduced-motion: reduce) { .rv-remove-spinner { animation: none; } }
`;

const buttonBase = {
  minHeight: 44,
  padding: '10px 18px',
  borderRadius: 10,
  fontSize: '.92rem',
  fontWeight: 700,
  lineHeight: 1.2,
} as const;

function peso(value: number | string | undefined): string {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? `₱${Math.round(amount).toLocaleString('en-US')} per night` : '';
}

function Badge({ tone, children }: { tone: 'danger' | 'success' | 'busy'; children: ReactNode }) {
  const palette = {
    danger: { background: '#FEE2E2', color: '#B91C1C' },
    success: { background: '#DCFCE7', color: '#15803D' },
    busy: { background: '#E0F2FE', color: '#0369A1' },
  }[tone];
  return (
    <span
      aria-hidden="true"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px', ...palette }}
    >
      {children}
    </span>
  );
}

const iconProps = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function RemoveRoomDialog({ room, onConfirm, onClose }: RemoveRoomDialogProps) {
  const [phase, setPhase] = useState<Phase>('confirm');
  const [message, setMessage] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const busy = phase === 'processing';

  useEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    return () => opener.current?.focus?.();
  }, []);

  // Keyboard focus follows the dialog: the safe choice first, then the dialog itself while it works, then Close.
  useEffect(() => {
    if (phase === 'confirm') keepRef.current?.focus();
    else if (phase === 'processing') dialogRef.current?.focus();
    else closeRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (phase !== 'done') return undefined;
    const timer = window.setTimeout(() => onCloseRef.current(), DONE_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const remove = async () => {
    if (busy) return;
    setPhase('processing');
    try {
      await onConfirm(room);
      setPhase('done');
    } catch (err: any) {
      setMessage(err?.message || 'Something went wrong. Nothing was removed.');
      setCanRetry(!BLOCKED_STATUSES.includes(Number(err?.status)));
      setPhase('error');
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!busy) onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? []);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const detail = [room.category, peso(room.rate_php)].filter(Boolean).join(', ');

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15, 23, 42, 0.6)' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <style>{STYLES}</style>
      <div
        ref={dialogRef}
        className="rv-remove-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="rv-remove-title"
        aria-describedby="rv-remove-text"
        aria-busy={busy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={{ width: '100%', maxWidth: 420, maxHeight: '100%', overflowY: 'auto', background: '#FFFFFF', color: '#0F172A', borderRadius: 16, padding: 24, textAlign: 'center', boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.45)' }}
      >
        {phase === 'confirm' && (
          <>
            <Badge tone="danger">
              <svg {...iconProps}>
                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
              </svg>
            </Badge>
            <h2 id="rv-remove-title" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#0F172A', fontFamily: 'inherit' }}>
              Are you sure?
            </h2>
            <p id="rv-remove-text" style={{ margin: '10px 0 0', fontSize: '.95rem', lineHeight: 1.5, color: '#334155' }}>
              Remove <strong style={{ color: '#0F172A' }}>{room.name}</strong>
              {detail ? ` (${detail})` : ''} from the resort? This can&apos;t be undone. The removal is recorded in the audit trail with your name and the time.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
              <button ref={keepRef} type="button" onClick={onClose} style={{ ...buttonBase, flex: '1 1 140px', background: '#FFFFFF', color: '#0F172A', border: '1px solid #64748B' }}>
                No, keep it
              </button>
              <button type="button" onClick={remove} style={{ ...buttonBase, flex: '1 1 140px', background: '#B91C1C', color: '#FFFFFF', border: '1px solid #B91C1C' }}>
                Yes, remove it
              </button>
            </div>
          </>
        )}

        {phase === 'processing' && (
          <div role="status">
            <Badge tone="busy">
              <svg {...iconProps} className="rv-remove-spinner">
                <path d="M21 12a9 9 0 1 1-6.2-8.56" />
              </svg>
            </Badge>
            <h2 id="rv-remove-title" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#0F172A', fontFamily: 'inherit' }}>
              Removing {room.name}…
            </h2>
            <p id="rv-remove-text" style={{ margin: '10px 0 0', fontSize: '.95rem', lineHeight: 1.5, color: '#334155' }}>
              Please wait. This takes a few seconds, and the page should stay open.
            </p>
          </div>
        )}

        {phase === 'done' && (
          <div role="status">
            <Badge tone="success">
              <svg {...iconProps}>
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </Badge>
            <h2 id="rv-remove-title" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#0F172A', fontFamily: 'inherit' }}>
              {room.name} was removed
            </h2>
            <p id="rv-remove-text" style={{ margin: '10px 0 0', fontSize: '.95rem', lineHeight: 1.5, color: '#334155' }}>
              The removal was recorded in the audit trail.
            </p>
            <div style={{ marginTop: 22 }}>
              <button ref={closeRef} type="button" onClick={onClose} style={{ ...buttonBase, width: '100%', background: '#0F172A', color: '#FFFFFF', border: '1px solid #0F172A' }}>
                Close
              </button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div role="alert">
            <Badge tone="danger">
              <svg {...iconProps}>
                <path d="M12 8v5M12 16.5v.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
              </svg>
            </Badge>
            <h2 id="rv-remove-title" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#0F172A', fontFamily: 'inherit' }}>
              Couldn&apos;t remove {room.name}
            </h2>
            <p id="rv-remove-text" style={{ margin: '10px 0 0', fontSize: '.95rem', lineHeight: 1.5, color: '#334155' }}>
              {message}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
              <button ref={closeRef} type="button" onClick={onClose} style={{ ...buttonBase, flex: '1 1 140px', background: '#FFFFFF', color: '#0F172A', border: '1px solid #64748B' }}>
                Close
              </button>
              {canRetry && (
                <button type="button" onClick={remove} style={{ ...buttonBase, flex: '1 1 140px', background: '#B91C1C', color: '#FFFFFF', border: '1px solid #B91C1C' }}>
                  Try again
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
