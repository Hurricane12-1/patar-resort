import { useEffect, useRef, type ReactNode } from 'react';
import type { Room } from '../../lib/guestRooms';
import type { RoomNight } from '../../lib/stayCalendar';

const MAX_DOTS = 6;

/** Booked is a solid dot and available is a ring, so the two read apart without relying on colour. */
export const roomDotClass = (booked: boolean) =>
  `inline-block h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_1px_rgba(6,11,24,0.75)] ${
    booked ? 'bg-rose-500' : 'border-2 border-emerald-400 bg-emerald-400/30'
  }`;

interface CalendarRoomChipsProps {
  rooms: Room[];
  onRemove: (roomId: string) => void;
  onClear: () => void;
}

export function CalendarRoomChips({ rooms, onRemove, onClear }: CalendarRoomChipsProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const previousCount = useRef(rooms.length);

  // A removed chip takes keyboard focus with it, so hand focus to the next control in the row.
  useEffect(() => {
    if (rooms.length < previousCount.current && document.activeElement === document.body) {
      const next = rowRef.current?.querySelector<HTMLElement>('button');
      (next ?? rowRef.current)?.focus();
    }
    previousCount.current = rooms.length;
  }, [rooms.length]);

  return (
    <div
      ref={rowRef}
      tabIndex={-1}
      className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
    >
      <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan">Rooms</span>
      {rooms.length === 0 ? (
        <span className="text-xs text-white/70">
          None picked yet. Choose rooms above, or tap a date to see which are available.
        </span>
      ) : (
        <>
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => onRemove(room.id)}
              aria-label={`Remove ${room.name} from the calendar`}
              title={`Remove ${room.name}`}
              className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-cyan bg-cyan/15 px-3 text-xs font-bold text-cyan transition hover:bg-cyan/25 cursor-pointer sm:min-h-9"
            >
              <span className="truncate">{room.name}</span>
              <span aria-hidden="true" className="text-sm leading-none text-cyan/70">×</span>
            </button>
          ))}
          <span className="ml-auto flex items-center gap-2 text-xs text-white/70">
            <span>{rooms.length} selected</span>
            <button
              type="button"
              onClick={onClear}
              className="min-h-11 px-2 font-semibold text-white underline transition hover:text-cyan cursor-pointer sm:min-h-9"
            >
              Clear
            </button>
          </span>
        </>
      )}
    </div>
  );
}

export function NightDots({ nights }: { nights: RoomNight[] }) {
  const shown = nights.slice(0, MAX_DOTS);
  const extra = nights.length - shown.length;
  return (
    <span aria-hidden="true" className="flex flex-wrap items-center gap-[3px]">
      {shown.map(({ room, booked }) => (
        <span key={room.id} className={roomDotClass(booked)} />
      ))}
      {extra > 0 && <span className="text-[9px] font-bold leading-none">+{extra}</span>}
    </span>
  );
}

interface AvailableRoomsPanelProps {
  heading: string;
  summary: string;
  status: 'connecting' | 'connected' | 'offline';
  totalRooms: number;
  openRooms: Room[];
  bookedPicked: Room[];
  pickedIds: string[];
  partySize: number;
  formatRate: (amount: number) => string;
  onToggle: (roomId: string) => void;
  onClose: () => void;
}

export function AvailableRoomsPanel({
  heading,
  summary,
  status,
  totalRooms,
  openRooms,
  bookedPicked,
  pickedIds,
  partySize,
  formatRate,
  onToggle,
  onClose,
}: AvailableRoomsPanelProps) {
  let body: ReactNode;
  if (totalRooms === 0) {
    body = (
      <p className="mt-3 text-xs text-white/70">
        {status === 'offline'
          ? 'Rooms are unavailable right now. Try again in a moment.'
          : status === 'connecting'
          ? 'Loading rooms…'
          : 'No rooms are published yet.'}
      </p>
    );
  } else if (openRooms.length === 0) {
    body = <p className="mt-3 text-xs text-white/70">No rooms are available on these dates. Try other dates.</p>;
  } else {
    body = (
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {openRooms.map((room) => {
          const capacity = Number(room.capacity) || 0;
          const fits = capacity > 0 && capacity >= partySize;
          const picked = pickedIds.includes(room.id);
          const tone = picked
            ? 'border-cyan bg-cyan/15 cursor-pointer'
            : fits
            ? 'border-white/15 bg-white/5 hover:border-cyan/60 cursor-pointer'
            : 'border-white/10 bg-white/5 opacity-60 cursor-not-allowed';
          return (
            <button
              key={room.id}
              type="button"
              role="checkbox"
              aria-checked={picked}
              disabled={!fits}
              onClick={() => onToggle(room.id)}
              className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-xs text-white transition ${tone}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{room.name}</span>
                <span className="block text-white/70">
                  {capacity <= 0 ? 'Capacity not set' : fits ? `Up to ${capacity}` : `Too small for ${partySize}`}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-semibold text-cyan">{formatRate(room.rate_php || 0)}</span>
                <span className="block text-white/70">{picked ? 'Selected' : fits ? 'Add' : ''}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <section
      aria-label="Rooms available for the chosen dates"
      aria-live="polite"
      className="rounded-xl border border-cyan/30 bg-cyan/[0.06] p-3 sm:p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{heading}</p>
          <p className="mt-0.5 text-xs text-white/70">{summary}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the available rooms list"
          className="-mr-1.5 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {body}
      {bookedPicked.length > 0 && (
        <p className="mt-3 text-xs font-semibold text-rose-300">
          Already booked on these dates: {bookedPicked.map((room) => room.name).join(', ')}.
        </p>
      )}
    </section>
  );
}
