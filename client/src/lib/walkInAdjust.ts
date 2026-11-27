import { stayBlocksNight } from './dayAvailability.ts';
import { addDaysISO, inferOfferingType } from './offeringSpecs.ts';

export interface WalkInDraft {
  room_id: string;
  check_in: string;
  check_out: string;
  check_in_time?: string;
  guests: number;
  total_php: number;
  notes?: string;
}

export interface WalkInContext {
  today: string;
  nowTime: string;
  rooms: any[];
  reservations: any[];
  pool?: { perGuest: number; shortName: string };
}

export type WalkInEdit = 'room' | 'checkIn' | 'checkOut' | 'guests' | 'pool';

export interface WalkInOptions {
  edited?: WalkInEdit[];
  /** False while a date is still being typed, so the field is not rewritten under the cursor. */
  settle?: boolean;
  /** The staff member picked this room themselves, so it is never swapped for another. */
  keepRoom?: boolean;
  /** The staff member typed this check-in time themselves, so it is never moved. */
  keepTime?: boolean;
  /** The form was just opened: an empty total is filled in. */
  initial?: boolean;
}

export interface WalkInResult<T extends WalkInDraft> {
  draft: T;
  notices: string[];
  changed: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SEARCH_DAYS_AHEAD = 60;
const MAX_NIGHTS_CHECKED = 120;

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value);
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

function shortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Reads "14:00" or "2:30 PM" and returns minutes after midnight, or null when it is neither. */
function clockMinutes(value: unknown): number | null {
  const text = String(value || '').trim();
  const ampm = text.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (ampm) {
    let h = Number(ampm[1]) % 12;
    if (ampm[3].toUpperCase() === 'PM') h += 12;
    return h * 60 + Number(ampm[2]);
  }
  const plain = text.match(/^(\d{1,2}):(\d{2})$/);
  if (plain && Number(plain[1]) < 24 && Number(plain[2]) < 60) return Number(plain[1]) * 60 + Number(plain[2]);
  return null;
}

function clockLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  return `${h % 12 || 12}:${pad2(minutes % 60)} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function getManilaClock(now = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
}

function belongsToRoom(booking: any, room: any): boolean {
  if (booking?.room_id) return booking.room_id === room.id;
  const name = String(booking?.rooms?.name || '').toLowerCase();
  return Boolean(name) && name === String(room.name || '').toLowerCase();
}

/** A room is free when, for every night of the stay, fewer bookings hold it than it has units. */
export function isRoomFree(room: any, reservations: any[], checkIn: string, checkOut: string): boolean {
  const units = Math.max(1, Number(room?.units) || 1);
  const mine = (reservations || []).filter((b) => belongsToRoom(b, room));
  if (mine.length === 0) return true;
  const nights = Math.min(MAX_NIGHTS_CHECKED, Math.max(1, dayNumber(checkOut) - dayNumber(checkIn)));
  for (let i = 0; i < nights; i++) {
    const night = addDaysISO(checkIn, i);
    const taken = mine.filter((b) =>
      stayBlocksNight({ checkIn: b.check_in, checkOut: b.check_out, status: b.status }, night)
    ).length;
    if (taken >= units) return false;
  }
  return true;
}

export function findNextOpenStart(
  room: any,
  reservations: any[],
  from: string,
  nights: number,
  limitDays = SEARCH_DAYS_AHEAD
): string | null {
  for (let i = 1; i <= limitDays; i++) {
    const start = addDaysISO(from, i);
    if (isRoomFree(room, reservations, start, addDaysISO(start, nights))) return start;
  }
  return null;
}

function stripUnitTag(notes: string | undefined): string {
  return String(notes || '').replace(/\[Unit\s*\d+\]\s*/g, '').trim();
}

export function adjustWalkIn<T extends WalkInDraft>(
  input: T,
  ctx: WalkInContext,
  options: WalkInOptions = {}
): WalkInResult<T> {
  const { edited = [], settle = true, keepRoom = false, keepTime = false, initial = false } = options;
  const edit = (e: WalkInEdit) => edited.includes(e);
  const notices: string[] = [];
  const draft: T = { ...input };

  const hadIn = isIsoDate(draft.check_in);
  const hadOut = isIsoDate(draft.check_out);
  let cin = hadIn ? draft.check_in.slice(0, 10) : '';
  let cout = hadOut ? draft.check_out.slice(0, 10) : '';
  let room = ctx.rooms.find((r) => r.id === draft.room_id);

  if (settle) {
    if (!cin) cin = ctx.today;
    else if (cin < ctx.today) {
      cin = ctx.today;
      notices.push(`Check-in was in the past, so it was set to today (${shortDate(cin)}).`);
    }
    if (!cout || cout <= cin) {
      cout = addDaysISO(cin, 1);
      if (hadOut) notices.push(`Check-out has to be after check-in, so it was set to ${shortDate(cout)}.`);
    }
    if (room && inferOfferingType(room) === 'cottage' && dayNumber(cout) - dayNumber(cin) > 1) {
      cout = addDaysISO(cin, 1);
      notices.push(`Cottages are booked by the day, so check-out was set to ${shortDate(cout)}.`);
    }
    draft.check_in = cin;
    draft.check_out = cout;
  } else if (edit('checkIn') && !edit('checkOut') && hadIn && (!hadOut || cout <= cin)) {
    cout = addDaysISO(cin, 1);
    draft.check_out = cout;
  }

  const stayIn = cin || ctx.today;
  const stayOut = cout && cout > stayIn ? cout : addDaysISO(stayIn, 1);
  const nights = Math.max(1, dayNumber(stayOut) - dayNumber(stayIn));
  const wantedGuests = Math.max(1, Math.round(Number(draft.guests) || 1));

  if (settle && ctx.rooms.length > 0) {
    const mustFind = !room;
    const needsSwap = room && !keepRoom && !isRoomFree(room, ctx.reservations, stayIn, stayOut);
    if (mustFind || needsSwap) {
      const sameKind = (r: any) => !room || inferOfferingType(r) === inferOfferingType(room);
      const open = ctx.rooms.filter(
        (r) => r.id !== room?.id && sameKind(r) && isRoomFree(r, ctx.reservations, stayIn, stayOut)
      );
      const fits = open.filter((r) => !Number(r.capacity) || Number(r.capacity) >= wantedGuests);
      const pick = fits[0] || open[0] || (mustFind ? ctx.rooms[0] : undefined);
      if (pick) {
        if (room) notices.push(`${room.name} is already booked on those dates, so ${pick.name} was picked instead.`);
        room = pick;
        draft.room_id = pick.id;
        draft.notes = stripUnitTag(draft.notes);
      }
    }
    if (room && !isRoomFree(room, ctx.reservations, stayIn, stayOut)) {
      const next = findNextOpenStart(room, ctx.reservations, stayIn, nights);
      if (next) {
        notices.push(`${room.name} is booked on those dates. It is open from ${shortDate(next)} to ${shortDate(addDaysISO(next, nights))}.`);
      }
    }
  }

  let guests = wantedGuests;
  const capacity = Number(room?.capacity) || 0;
  if (room && capacity > 0 && guests > capacity) {
    guests = capacity;
    notices.push(`Guests lowered to ${capacity}, the most ${room.name} can hold.`);
  }
  draft.guests = guests;

  if (room) {
    const units = Math.max(1, Number(room.units) || 1);
    const unitTag = String(draft.notes || '').match(/\[Unit\s*(\d+)\]/i);
    if (unitTag && Number(unitTag[1]) > units) draft.notes = stripUnitTag(draft.notes);
  }

  if (settle && !keepTime && stayIn === ctx.today) {
    const planned = clockMinutes(draft.check_in_time || '14:00');
    const now = clockMinutes(ctx.nowTime);
    if (planned !== null && now !== null && planned < now) {
      const next = Math.min(23, Math.ceil(now / 60)) * 60;
      draft.check_in_time = `${pad2(next / 60)}:00`;
      notices.push(`Check-in time was set to ${clockLabel(next)}, the next hour. ${clockLabel(planned)} has already passed.`);
    }
  }

  const priceInputsMoved =
    edit('room') ||
    edit('checkIn') ||
    edit('checkOut') ||
    edit('guests') ||
    edit('pool') ||
    draft.room_id !== input.room_id ||
    draft.check_in !== input.check_in ||
    draft.check_out !== input.check_out ||
    draft.guests !== input.guests;
  if (room && (priceInputsMoved || (initial && !draft.total_php))) {
    const rate = Number(room.rate_php) || 0;
    const poolCost = ctx.pool ? ctx.pool.perGuest * guests : 0;
    draft.total_php = rate * nights + poolCost;
    if (ctx.pool) {
      const cleanNotes = String(draft.notes || '').replace(/\[Pool Add-on:[^\]]+\]\s*/g, '').trim();
      draft.notes =
        ctx.pool.perGuest > 0
          ? `[Pool Add-on: ${ctx.pool.shortName} (+₱${poolCost.toLocaleString()})] ${cleanNotes}`.trim()
          : cleanNotes;
    }
  }

  const changed =
    draft.room_id !== input.room_id ||
    draft.check_in !== input.check_in ||
    draft.check_out !== input.check_out ||
    draft.check_in_time !== input.check_in_time ||
    draft.guests !== input.guests ||
    draft.total_php !== input.total_php ||
    draft.notes !== input.notes;

  return { draft, notices, changed };
}
