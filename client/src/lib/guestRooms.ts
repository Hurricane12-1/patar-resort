import { supabase } from './supabaseClient';

/** A bookable stay as shown on the landing page and in the guest dashboard. */
export interface Room {
  id: string;
  name: string;
  category?: string;
  rate_php?: number;
  capacity?: number;
  beds_count?: number;
  baths_count?: number;
  description?: string;
  amenities?: string[];
  image_url?: string;
  images?: string[];
}

/** The reservation fields needed to work out whether a room is free. */
export interface ReservationWindow {
  id?: string;
  room_id: string;
  check_in: string;
  check_out: string;
  status?: string;
}

export const CLEANING_FEE_PHP = 500;
export const COASTAL_FEE_PHP = 150;
export const WEEKEND_RATE_MULTIPLIER = 1.15;

/** Used only when the live room inventory cannot be reached. */
export const FALLBACK_ROOMS: Room[] = [
  {
    id: 'chason-room',
    name: 'chason room',
    category: 'Suite',
    rate_php: 3500,
    capacity: 4,
    beds_count: 2,
    baths_count: 1,
    description: 'An executive oceanfront sanctuary villa with panoramic views of the West Philippine Sea, featuring handcrafted wood furnishings, private limestone terrace, and high-speed Starlink internet.',
    amenities: ['Oceanfront Balcony', 'Starlink High-Speed Wi-Fi', 'Air Conditioning', 'Private Coral Steps', 'Solar Microgrid Backup', 'Keypad Smart Lock', 'Complimentary Breakfast', 'Snorkeling Gear'],
    image_url: '/images/cottage.jpg',
    images: ['/images/cottage.jpg', '/images/suite.jpg', '/images/villa.jpg', '/images/island.jpg', '/images/garden.jpg']
  },
  {
    id: 'unit-3',
    name: 'Unit 3',
    category: 'Cottage',
    rate_php: 3200,
    capacity: 2,
    beds_count: 1,
    baths_count: 1,
    description: 'Charming coastal cottage nestled among tropical flora with direct garden walkway to the tidal rock pools and beach.',
    amenities: ['Garden View', 'Starlink Wi-Fi', 'Air Conditioning', 'King Bed', 'Private Bath', 'Breakfast Included'],
    image_url: '/images/suite.jpg',
    images: ['/images/suite.jpg', '/images/cottage.jpg', '/images/villa.jpg', '/images/room.jpg', '/images/island.jpg']
  },
  {
    id: 'sunset',
    name: 'Sunset',
    category: 'Villa',
    rate_php: 4500,
    capacity: 6,
    beds_count: 3,
    baths_count: 2,
    description: 'Our premier cliffside villa offering unobstructed 180-degree sunset panoramas, an expansive private viewing deck, and deluxe family amenities.',
    amenities: ['180° Sunset View', 'Private Living Deck', 'Starlink Wi-Fi', 'Air Conditioning', 'Full Kitchenette', 'Solar Backup', 'Dedicated Host'],
    image_url: '/images/villa.jpg',
    images: ['/images/villa.jpg', '/images/island.jpg', '/images/cottage.jpg', '/images/suite.jpg', '/images/garden.jpg']
  },
  {
    id: 'unit-5',
    name: 'Unit 5',
    category: 'Suite',
    rate_php: 3800,
    capacity: 4,
    beds_count: 2,
    baths_count: 1,
    description: 'Modern coastal sanctuary suite designed for peaceful retreats, with floor-to-ceiling glass doors opening directly to the ocean breeze.',
    amenities: ['Ocean Breeze Balcony', 'Starlink Wi-Fi', 'Air Conditioning', 'Work Desk', 'Rain Shower', 'Private Patio'],
    image_url: '/images/island.jpg',
    images: ['/images/island.jpg', '/images/villa.jpg', '/images/suite.jpg', '/images/cottage.jpg', '/images/bunk.jpg']
  }
];

// ---------------------------------------------------------------------------
// Live room inventory
// ---------------------------------------------------------------------------

const NON_STAY_CATEGORY = /\b(tours?|activit(y|ies)|excursions?)\b/i;

/**
 * The rooms table also stores day tours and offers (tagged `__type__:offer` by the
 * admin console). Only active overnight accommodations can be booked as rooms.
 */
export function isBookableRoomRow(row: any): boolean {
  if (!row || row.is_active === false) return false;
  const tags: unknown[] = Array.isArray(row.amenities) ? row.amenities : [];
  const isOffer = tags.some((tag) => typeof tag === 'string' && tag.trim().toLowerCase() === '__type__:offer');
  if (isOffer) return false;
  return !NON_STAY_CATEGORY.test(String(row.category || ''));
}

function resolveRoomImage(rawUrl: string, idx: number): string {
  const url = rawUrl || '';
  if (url.includes('cottage')) return '/images/cottage.jpg';
  if (url.includes('suite')) return '/images/suite.jpg';
  if (url.includes('villa')) return '/images/villa.jpg';
  if (url.includes('island')) return '/images/island.jpg';
  if (url) return url;
  return idx % 2 === 0 ? '/images/cottage.jpg' : '/images/suite.jpg';
}

/** Maps a `rooms` row to the shape the guest UI uses. Capacity is taken as-is from the row. */
export function mapLiveRoom(row: any, idx: number): Room {
  const primaryImg = resolveRoomImage(String(row.image_url || ''), idx);
  const capacity = Math.floor(Number(row.capacity));
  return {
    id: String(row.id),
    name: String(row.name || `Villa ${idx + 1}`).trim(),
    category: row.category || 'Oceanfront Sanctuary',
    rate_php: Number(row.rate_php) || 3500,
    // A missing or invalid capacity stays 0 so the room is never auto-assigned to a party it may not fit.
    capacity: capacity > 0 ? capacity : 0,
    beds_count: Number(row.beds_count) || 2,
    baths_count: Number(row.baths_count) || 1,
    description: row.description || 'Private oceanfront villa perched above Bolinao limestone coves.',
    amenities: Array.isArray(row.amenities) && row.amenities.length > 0
      ? row.amenities.filter((a: any) => typeof a === 'string' && !a.startsWith('__'))
      : ['Oceanfront Balcony', 'Starlink Wi-Fi', 'Air Conditioning', 'Solar Microgrid Backup'],
    image_url: primaryImg,
    images: Array.isArray(row.images) && row.images.length > 0
      ? row.images
      : [primaryImg, '/images/suite.jpg', '/images/villa.jpg', '/images/island.jpg', '/images/garden.jpg']
  };
}

/** Loads the active overnight rooms from the live inventory. Throws when the inventory is unreachable. */
export async function fetchBookableRooms(): Promise<Room[]> {
  const { data, error } = await supabase.from('rooms').select('*').order('name');
  if (error) throw error;
  return (data || []).filter(isBookableRoomRow).map(mapLiveRoom);
}

// ---------------------------------------------------------------------------
// Availability and capacity matching
// ---------------------------------------------------------------------------

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** True when no active reservation for the room overlaps the requested nights. */
export function isRoomFree(
  roomId: string,
  checkIn: string | null,
  checkOut: string | null,
  reservations: ReservationWindow[]
): boolean {
  if (!checkIn || !checkOut) return true;
  return !reservations.some(
    (res) =>
      String(res.room_id) === String(roomId) &&
      res.status !== 'cancelled' &&
      rangesOverlap(checkIn, checkOut, String(res.check_in).slice(0, 10), String(res.check_out).slice(0, 10))
  );
}

export type RoomFit = 'best' | 'fits' | 'booked' | 'too-small';

export interface RoomOption {
  room: Room;
  capacity: number;
  fitsParty: boolean;
  available: boolean;
  fit: RoomFit;
}

export interface RoomRanking {
  /** Every room, smallest capacity first. */
  options: RoomOption[];
  /** The room auto-match would choose, or null when there are no rooms. */
  best: Room | null;
  /** The largest capacity in the inventory; caps the guest steppers. */
  maxCapacity: number;
}

/**
 * Ranks rooms for a party. The best fit is the smallest free room that holds everyone,
 * which keeps larger rooms open for bigger groups. Capacity comes from the rooms table,
 * so changes made in the admin console change the match without a code change.
 * Infants are not part of `partySize`.
 */
export function rankRoomsForParty(
  rooms: Room[],
  partySize: number,
  checkIn: string | null,
  checkOut: string | null,
  reservations: ReservationWindow[]
): RoomRanking {
  const sorted = rooms
    .map((room) => {
      const capacity = Number(room.capacity) || 0;
      return {
        room,
        capacity,
        fitsParty: capacity > 0 && capacity >= partySize,
        available: isRoomFree(room.id, checkIn, checkOut, reservations),
      };
    })
    .sort(
      (a, b) =>
        a.capacity - b.capacity ||
        (a.room.rate_php || 0) - (b.room.rate_php || 0) ||
        a.room.name.localeCompare(b.room.name)
    );

  const bestFree = sorted.find((o) => o.fitsParty && o.available);
  // When nothing fitting is free, still point at the smallest fitting room so the calendar can show its gaps.
  const best = bestFree || sorted.find((o) => o.fitsParty) || sorted[sorted.length - 1] || null;

  const options: RoomOption[] = sorted.map((o) => {
    let fit: RoomFit = 'fits';
    if (!o.fitsParty) fit = 'too-small';
    else if (!o.available) fit = 'booked';
    else if (o === bestFree) fit = 'best';
    return { ...o, fit };
  });

  return {
    options,
    best: best ? best.room : null,
    maxCapacity: sorted.reduce((max, o) => Math.max(max, o.capacity), 0),
  };
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

function localISO(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function nightsBetween(checkIn?: string | null, checkOut?: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const diff = parseLocalDate(checkOut).getTime() - parseLocalDate(checkIn).getTime();
  return Math.max(0, Math.round(diff / 86400000));
}

/** Friday and Saturday nights use the weekend coastal tariff. */
export function isWeekendNight(iso: string): boolean {
  const dow = parseLocalDate(iso).getDay();
  return dow === 5 || dow === 6;
}

export interface StayPrice {
  baseRate: number;
  nights: number;
  nightsTotal: number;
  cleaningFee: number;
  coastalFee: number;
  taxWaived: number;
  grandTotal: number;
}

export function computeStayPrice(baseRate: number, checkIn?: string | null, checkOut?: string | null): StayPrice {
  const nights = nightsBetween(checkIn, checkOut);
  if (!checkIn || !checkOut || nights <= 0) {
    return { baseRate, nights: 0, nightsTotal: 0, cleaningFee: CLEANING_FEE_PHP, coastalFee: COASTAL_FEE_PHP, taxWaived: 0, grandTotal: 0 };
  }
  let nightsTotal = 0;
  const cursor = parseLocalDate(checkIn);
  for (let i = 0; i < nights; i++) {
    const night = localISO(cursor);
    nightsTotal += isWeekendNight(night) ? Math.round(baseRate * WEEKEND_RATE_MULTIPLIER) : baseRate;
    cursor.setDate(cursor.getDate() + 1);
  }
  return {
    baseRate,
    nights,
    nightsTotal,
    cleaningFee: CLEANING_FEE_PHP,
    coastalFee: COASTAL_FEE_PHP,
    taxWaived: Math.round(nightsTotal * 0.12),
    grandTotal: nightsTotal + CLEANING_FEE_PHP + COASTAL_FEE_PHP,
  };
}
