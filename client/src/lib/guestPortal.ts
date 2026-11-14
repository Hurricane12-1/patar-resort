import { addDaysISO, getManilaTodayISO } from './offeringSpecs';
import { computeStayPrice, nightsBetween, type Room } from './guestRooms';

/**
 * Review switch for the guest dashboard. While true, /client opens without signing in
 * and shows a clearly labelled preview guest (bookings made on this device, or sample
 * stays). Signed-in residents always see their own account. Set to false to require
 * a resident sign-in again.
 */
export const CLIENT_DIRECT_ACCESS = true;

export const RESORT_CONTACT = {
  phoneDisplay: '+63 900 555 0123',
  phoneHref: '+639005550123',
  email: 'hello@jdbeachhouse.ph',
  addressLine: 'Patar Coastal Road, Brgy. Patar, Bolinao, Pangasinan',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Rock+View+Beach+Resort,+Patar+Road,+Bolinao,+Pangasinan',
  checkInTime: '2:00 PM',
  checkOutTime: '12:00 NN',
} as const;

export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'disputed';
/** device: booked on this browser · account: loaded from the signed-in resident's reservations · sample: preview data */
export type BookingSource = 'device' | 'account' | 'sample';
export type StayPhase = 'upcoming' | 'current' | 'past' | 'cancelled';

export interface GuestBooking {
  id: string;
  /** Reservation id in the resort database, when the booking reached it. */
  dbId?: string;
  reference: string;
  source: BookingSource;
  roomId: string;
  roomName: string;
  roomCategory: string;
  roomImage: string;
  roomCapacity: number;
  rate: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  guests: number;
  nightsTotal: number;
  cleaningFee: number;
  coastalFee: number;
  total: number;
  status: BookingStatus;
  paymentMethod: string;
  paymentStatus: string;
  /** Keypad PIN shown only on the device that made the booking; never written to shared reservation notes. */
  arrivalPin?: string;
  matchMode?: 'auto' | 'manual';
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  notes?: string;
  createdAt: string;
}

export interface GuestPaymentMethod {
  id: string;
  type: 'gcash' | 'maya' | 'card';
  label: string;
  brand?: string;
  holder: string;
  /** Only the last four digits are ever stored. */
  last4: string;
  expiry?: string;
  isDefault: boolean;
  addedAt: string;
}

export interface GuestProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  province: string;
  zip: string;
  country: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  specialRequests: string;
  notifySms: boolean;
  notifyEmail: boolean;
  notifyOffers: boolean;
  memberSince: string;
}

export interface GuestRequest {
  id: string;
  bookingId?: string;
  bookingRef?: string;
  roomName?: string;
  topic: string;
  message: string;
  createdAt: string;
  /** sent: logged with the resort · device: saved on this device only */
  delivery: 'sent' | 'device';
}

/** Profile details, saved payment methods, and help requests kept on this device. */
export interface GuestAccount {
  isSample: boolean;
  profile: GuestProfile;
  payments: GuestPaymentMethod[];
  requests: GuestRequest[];
}

// ---------------------------------------------------------------------------
// Device storage
// ---------------------------------------------------------------------------

export const PREVIEW_SCOPE = 'preview';
const BOOKINGS_KEY = 'rv_guest_bookings_v1';
const ACCOUNT_KEY_PREFIX = 'rv_guest_account_v1:';
export const GUEST_BOOKINGS_STORAGE_KEY = BOOKINGS_KEY;

/** Device-storage scope for a signed-in resident's profile extras. */
export function accountScopeFor(profile: any): string {
  return String(profile?.id || profile?.email || 'account');
}

function readStore<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked (private mode); the UI keeps working from memory.
  }
}

export function loadDeviceBookings(): GuestBooking[] {
  const list = readStore<GuestBooking[]>(BOOKINGS_KEY, []);
  return Array.isArray(list) ? list.filter((b) => b && b.id && b.checkIn && b.checkOut) : [];
}

export function saveDeviceBookings(list: GuestBooking[]) {
  writeStore(BOOKINGS_KEY, list);
}

/** Stores a booking made on this device. A real booking replaces any sample stays. */
export function addDeviceBooking(booking: GuestBooking) {
  const kept = loadDeviceBookings().filter((b) => b.source !== 'sample' && b.id !== booking.id);
  saveDeviceBookings([booking, ...kept]);
}

export function emptyProfile(): GuestProfile {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    province: '',
    zip: '',
    country: 'Philippines',
    emergencyName: '',
    emergencyRelation: '',
    emergencyPhone: '',
    specialRequests: '',
    notifySms: true,
    notifyEmail: true,
    notifyOffers: false,
    memberSince: new Date().toISOString(),
  };
}

function normalizeAccount(raw: any): GuestAccount {
  return {
    isSample: Boolean(raw?.isSample),
    profile: { ...emptyProfile(), ...(raw?.profile || {}) },
    payments: Array.isArray(raw?.payments) ? raw.payments : [],
    requests: Array.isArray(raw?.requests) ? raw.requests : [],
  };
}

export function loadGuestAccount(scope: string): GuestAccount | null {
  const raw = readStore<any>(ACCOUNT_KEY_PREFIX + scope, null);
  return raw && raw.profile ? normalizeAccount(raw) : null;
}

export function saveGuestAccount(scope: string, account: GuestAccount) {
  writeStore(ACCOUNT_KEY_PREFIX + scope, account);
}

/** Removes preview bookings and the preview profile from this device. */
export function clearPreviewData() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(BOOKINGS_KEY);
    window.localStorage.removeItem(ACCOUNT_KEY_PREFIX + PREVIEW_SCOPE);
  } catch {
    // Ignore blocked storage.
  }
}

export function splitName(fullName: string): { first: string; last: string } {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
}

/**
 * Keeps the preview guest's name and contact details in step with the details used to book.
 * Sample data is replaced; details the guest already entered are never overwritten.
 */
export function rememberBookingGuest(details: { name: string; email: string; phone: string }) {
  const { first, last } = splitName(details.name);
  const current = loadGuestAccount(PREVIEW_SCOPE);
  if (!current || current.isSample) {
    saveGuestAccount(PREVIEW_SCOPE, {
      isSample: false,
      profile: { ...emptyProfile(), firstName: first, lastName: last, email: details.email, phone: details.phone },
      payments: [],
      requests: [],
    });
    return;
  }
  const p = current.profile;
  saveGuestAccount(PREVIEW_SCOPE, {
    ...current,
    profile: {
      ...p,
      firstName: p.firstName || first,
      lastName: p.lastName || last,
      email: p.email || details.email,
      phone: p.phone || details.phone,
    },
  });
}

// ---------------------------------------------------------------------------
// Preview sample data
// ---------------------------------------------------------------------------

export function createSampleAccount(): GuestAccount {
  return {
    isSample: true,
    profile: {
      ...emptyProfile(),
      firstName: 'Maria',
      lastName: 'Santos',
      email: 'maria.santos@example.com',
      phone: '09171234567',
      street: '12 Mabini Street, Brgy. San Antonio',
      city: 'Quezon City',
      province: 'Metro Manila',
      zip: '1105',
      emergencyName: 'Carlos Santos',
      emergencyRelation: 'Spouse',
      emergencyPhone: '09189876543',
      specialRequests: 'Extra pillows and a quiet room, please.',
      memberSince: '2024-06-12T08:00:00.000Z',
    },
    payments: [
      { id: 'pm-sample-gcash', type: 'gcash', label: 'GCash', holder: 'Maria Santos', last4: '4567', isDefault: true, addedAt: '2024-06-12T08:00:00.000Z' },
      { id: 'pm-sample-visa', type: 'card', label: 'Visa', brand: 'Visa', holder: 'Maria Santos', last4: '4242', expiry: '08/28', isDefault: false, addedAt: '2025-01-20T08:00:00.000Z' },
    ],
    requests: [],
  };
}

/** Three sample stays relative to today, built from the live rooms so names and capacities match. */
export function createSampleBookings(rooms: Room[], today = getManilaTodayISO()): GuestBooking[] {
  const usable = rooms.filter((r) => (Number(r.capacity) || 0) > 0);
  if (!usable.length) return [];
  const byCapacity = [...usable].sort((a, b) => (a.capacity || 0) - (b.capacity || 0));
  const small = byCapacity[0];
  const family = byCapacity.find((r) => (r.capacity || 0) >= 4) || byCapacity[byCapacity.length - 1];
  const large = byCapacity[byCapacity.length - 1];

  const plans = [
    { key: 'next', room: small, startIn: 3, nights: 2, adults: Math.min(2, small.capacity || 2), children: 0, status: 'confirmed' as BookingStatus, paymentStatus: 'unpaid', method: 'GCash •••• 4567', ref: 'RV-BOL-2026-4821', match: 'auto' as const },
    { key: 'family', room: family, startIn: 34, nights: 3, adults: 2, children: Math.max(0, Math.min(2, (family.capacity || 4) - 2)), status: 'confirmed' as BookingStatus, paymentStatus: 'unpaid', method: 'Visa •••• 4242', ref: 'RV-BOL-2026-5307', match: 'manual' as const },
    { key: 'past', room: large, startIn: -62, nights: 3, adults: Math.min(4, large.capacity || 4), children: Math.max(0, Math.min(1, (large.capacity || 4) - 4)), status: 'checked_out' as BookingStatus, paymentStatus: 'paid', method: 'GCash •••• 4567', ref: 'RV-BOL-2026-2194', match: 'auto' as const },
  ];

  return plans.map((plan) => {
    const checkIn = addDaysISO(today, plan.startIn);
    const checkOut = addDaysISO(checkIn, plan.nights);
    const rate = plan.room.rate_php || 3500;
    const price = computeStayPrice(rate, checkIn, checkOut);
    return {
      id: `sample-${plan.key}`,
      reference: plan.ref,
      source: 'sample',
      roomId: plan.room.id,
      roomName: plan.room.name,
      roomCategory: plan.room.category || 'Room',
      roomImage: plan.room.image_url || '/images/suite.jpg',
      roomCapacity: plan.room.capacity || plan.adults + plan.children,
      rate,
      checkIn,
      checkOut,
      nights: plan.nights,
      adults: plan.adults,
      children: plan.children,
      guests: plan.adults + plan.children,
      nightsTotal: price.nightsTotal,
      cleaningFee: price.cleaningFee,
      coastalFee: price.coastalFee,
      total: price.grandTotal,
      status: plan.status,
      paymentMethod: plan.method,
      paymentStatus: plan.paymentStatus,
      arrivalPin: plan.key === 'next' ? '#4821' : undefined,
      matchMode: plan.match,
      guestName: 'Maria Santos',
      guestEmail: 'maria.santos@example.com',
      guestPhone: '09171234567',
      createdAt: new Date(`${addDaysISO(today, plan.startIn - 21)}T09:30:00+08:00`).toISOString(),
    } satisfies GuestBooking;
  });
}

export function makeBookingReference(checkIn?: string | null): string {
  const year = (checkIn || getManilaTodayISO()).slice(0, 4);
  return `RV-BOL-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function makeArrivalPin(): string {
  return `#${Math.floor(1000 + Math.random() * 9000)}`;
}

// ---------------------------------------------------------------------------
// Reservation rows from the resort database
// ---------------------------------------------------------------------------

const KNOWN_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'disputed'];

export function normalizeStatus(status: unknown): BookingStatus {
  const value = String(status || '').toLowerCase();
  if ((KNOWN_STATUSES as string[]).includes(value)) return value as BookingStatus;
  if (value === 'flagged') return 'disputed';
  if (value === 'completed') return 'checked_out';
  return 'pending';
}

function guestSplitFromNotes(notes: string, total: number) {
  const adults = Number(notes.match(/(\d+)\s+adults?/i)?.[1]) || 0;
  const children = Number(notes.match(/(\d+)\s+(?:child|children)\b/i)?.[1]) || 0;
  if (adults > 0 && adults + children === total) return { adults, children };
  return { adults: total, children: 0 };
}

/** Converts a reservation row (with optional embedded `rooms`) into a dashboard booking. */
export function mapReservationRow(row: any, rooms: Room[]): GuestBooking {
  const room = rooms.find((r) => String(r.id) === String(row.room_id));
  const notes = String(row.notes || '');
  const guests = Math.max(1, Number(row.guests) || 1);
  const { adults, children } = guestSplitFromNotes(notes, guests);
  const checkIn = String(row.check_in || '').slice(0, 10);
  const checkOut = String(row.check_out || '').slice(0, 10);
  const rate = Number(room?.rate_php || row.rooms?.rate_php) || 0;
  const total = Number(row.total_php) || 0;
  const price = rate ? computeStayPrice(rate, checkIn, checkOut) : null;
  // Only show an itemised breakdown when it adds up to what the resort recorded.
  const itemised = price && price.grandTotal === total ? price : null;
  const reference = notes.match(/\bRef\s+(RV-[A-Z0-9-]+)/i)?.[1] || `RV-${String(row.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;

  return {
    id: String(row.id),
    dbId: String(row.id),
    reference,
    source: 'account',
    roomId: String(row.room_id || ''),
    roomName: String(room?.name || row.rooms?.name || 'Rock View stay').trim(),
    roomCategory: room?.category || row.rooms?.category || 'Room',
    roomImage: room?.image_url || '/images/suite.jpg',
    roomCapacity: Number(room?.capacity || row.rooms?.capacity) || guests,
    rate,
    checkIn,
    checkOut,
    nights: nightsBetween(checkIn, checkOut),
    adults,
    children,
    guests,
    nightsTotal: itemised ? itemised.nightsTotal : 0,
    cleaningFee: itemised ? itemised.cleaningFee : 0,
    coastalFee: itemised ? itemised.coastalFee : 0,
    total,
    status: normalizeStatus(row.status),
    paymentMethod: String(row.payment_method || ''),
    paymentStatus: String(row.payment_status || 'unpaid'),
    guestName: String(row.guest_name || ''),
    guestEmail: String(row.email || row.guest_email || ''),
    guestPhone: String(row.phone || ''),
    notes,
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

/** Applies the latest resort-side status and dates to a booking stored on this device. */
export function applyReservationRow(booking: GuestBooking, row: any): GuestBooking {
  const checkIn = row.check_in ? String(row.check_in).slice(0, 10) : booking.checkIn;
  const checkOut = row.check_out ? String(row.check_out).slice(0, 10) : booking.checkOut;
  return {
    ...booking,
    status: row.status ? normalizeStatus(row.status) : booking.status,
    paymentStatus: row.payment_status ? String(row.payment_status) : booking.paymentStatus,
    checkIn,
    checkOut,
    nights: nightsBetween(checkIn, checkOut),
    guests: Number(row.guests) || booking.guests,
    total: Number(row.total_php) || booking.total,
  };
}

export function stayPhase(booking: Pick<GuestBooking, 'status' | 'checkIn' | 'checkOut'>, today: string): StayPhase {
  if (booking.status === 'cancelled') return 'cancelled';
  if (booking.status === 'checked_out' || booking.checkOut < today) return 'past';
  if (booking.status === 'checked_in' || booking.checkIn <= today) return 'current';
  return 'upcoming';
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dateParts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y, m, d, dow: new Date(y, m - 1, d, 12).getDay() };
}

/** "Tue, Nov 17" or "Tue, Nov 17, 2026" */
export function formatStayDate(iso: string, withYear = false): string {
  if (!iso) return '';
  const { y, m, d, dow } = dateParts(iso);
  return `${WEEKDAYS[dow]}, ${MONTHS[m - 1]} ${d}${withYear ? `, ${y}` : ''}`;
}

/** "Nov 17 – 19, 2026", "Nov 28 – Dec 2, 2026", or "Dec 30, 2026 – Jan 2, 2027" */
export function formatDateRange(checkIn: string, checkOut: string): string {
  if (!checkIn || !checkOut) return '';
  const a = dateParts(checkIn);
  const b = dateParts(checkOut);
  if (a.y !== b.y) return `${MONTHS[a.m - 1]} ${a.d}, ${a.y} – ${MONTHS[b.m - 1]} ${b.d}, ${b.y}`;
  if (a.m !== b.m) return `${MONTHS[a.m - 1]} ${a.d} – ${MONTHS[b.m - 1]} ${b.d}, ${b.y}`;
  return `${MONTHS[a.m - 1]} ${a.d} – ${b.d}, ${b.y}`;
}

export function formatPeso(amount: number): string {
  return '₱' + Math.round(amount || 0).toLocaleString('en-US');
}

export function countdownLabel(checkIn: string, today: string): string {
  const days = nightsBetween(today, checkIn);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 14) return `In ${days} days`;
  if (days < 60) return `In ${Math.round(days / 7)} weeks`;
  if (days < 365) return `In ${Math.round(days / 30)} months`;
  return 'In over a year';
}

export function memberSinceLabel(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return `${MONTHS_LONG[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function formatRelativeTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const minutes = Math.round((Date.now() - dt.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

export function greetingForNow(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hourCycle: 'h23' }).format(now)
  ) % 24;
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function guestCountLabel(booking: Pick<GuestBooking, 'adults' | 'children' | 'guests'>): string {
  const { adults, children, guests } = booking;
  if (children > 0 && adults + children === guests) {
    return `${adults} adult${adults === 1 ? '' : 's'} · ${children} ${children === 1 ? 'child' : 'children'}`;
  }
  return `${guests} guest${guests === 1 ? '' : 's'}`;
}

export function paymentStatusLabel(status: string): string {
  switch (status) {
    case 'paid':
      return 'Paid in full';
    case 'refunded':
      return 'Refunded';
    case 'refund_pending':
      return 'Refund in progress';
    case 'failed':
      return 'Payment failed';
    default:
      return 'Pay at the resort';
  }
}

// ---------------------------------------------------------------------------
// Payment methods (masked metadata only)
// ---------------------------------------------------------------------------

export function detectCardBrand(digits: string): string {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^35/.test(digits)) return 'JCB';
  return 'Card';
}

export function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

export function paymentDisplay(method: GuestPaymentMethod): string {
  const name = method.type === 'card' ? method.brand || 'Card' : method.label;
  return `${name} •••• ${method.last4}`;
}

/** The plain method name written to the reservation record. */
export function paymentDbLabel(method: GuestPaymentMethod): string {
  if (method.type === 'gcash') return 'GCash';
  if (method.type === 'maya') return 'Maya';
  return 'Card';
}

// ---------------------------------------------------------------------------
// Self-cancellation window
// ---------------------------------------------------------------------------

/**
 * A guest may cancel their own booking only within this window after it was made.
 * Mirrors GUEST_CANCEL_WINDOW_MS on the server (reservations.routes.js); once it
 * passes, only the front desk / admin can cancel.
 */
export const GUEST_CANCEL_WINDOW_MS = 5 * 60 * 60 * 1000; // 5 hours

/** When the guest's self-cancellation window closes (ms since epoch), or null if the time is unknown. */
export function guestCancelDeadline(createdAt?: string): number | null {
  if (!createdAt) return null;
  const made = Date.parse(createdAt);
  return Number.isFinite(made) ? made + GUEST_CANCEL_WINDOW_MS : null;
}

/**
 * True while the guest can still self-cancel. Sample stays and bookings that never
 * reached the resort database are never cancellable here. An unknown createdAt fails
 * open so a real booking is never trapped — the server still has the final say.
 */
export function canGuestCancel(
  booking: Pick<GuestBooking, 'source' | 'dbId' | 'createdAt'>,
  now = Date.now()
): boolean {
  if (booking.source === 'sample') return false;
  if (!booking.dbId) return false;
  const deadline = guestCancelDeadline(booking.createdAt);
  return deadline === null ? true : now <= deadline;
}

/** Short remaining-time label for the cancel window, e.g. "4h 12m left to cancel"; empty once closed. */
export function cancelWindowLabel(createdAt?: string, now = Date.now()): string {
  const deadline = guestCancelDeadline(createdAt);
  if (deadline === null) return '';
  const remaining = deadline - now;
  if (remaining <= 0) return '';
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m left to cancel` : `${minutes}m left to cancel`;
}
