import { supabase } from './supabaseClient';
import { parseOfferingTags } from './offeringSpecs';

/** A bookable stay as shown on the landing page and in the guest dashboard. */
export interface Room {
  id: string;
  name: string;
  category?: string;
  offering_type?: string;
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
  is_own?: boolean;
}

export const CLEANING_FEE_PHP = 500;
export const COASTAL_FEE_PHP = 150;
export const WEEKEND_RATE_MULTIPLIER = 1.15;

/** Empty fallback — all rooms come strictly from the live database. */
export const FALLBACK_ROOMS: Room[] = [];

// ---------------------------------------------------------------------------
// Live room inventory
// ---------------------------------------------------------------------------

const NON_STAY_CATEGORY = /\b(tours?|activit(y|ies)|excursions?)\b/i;

/** Offering type as the admin console stores it: the column when present, otherwise the `__type__` tag. */
export function offeringTypeOfRow(row: any): string {
  return String(row?.offering_type || parseOfferingTags(Array.isArray(row?.amenities) ? row.amenities : [], row || {}).offering_type);
}

/**
 * The rooms table also stores day tours and offers (tagged `__type__:offer` by the
 * admin console). Only active overnight accommodations can be booked as rooms.
 */
export function isBookableRoomRow(row: any): boolean {
  if (!row || row.is_active === false) return false;
  const type = offeringTypeOfRow(row);
  if (type !== 'room' && type !== 'cottage') return false;
  return !NON_STAY_CATEGORY.test(String(row.category || ''));
}

/** Maps a `rooms` row to the shape the guest UI uses. Photos, type, and category come from the tags the admin stores. */
export function mapLiveRoom(row: any, idx: number): Room {
  const parsed = parseOfferingTags(Array.isArray(row.amenities) ? row.amenities : [], row);
  const storedImages: string[] = Array.isArray(row.images)
    ? row.images.filter((u: any) => typeof u === 'string' && u.trim())
    : [];
  const images: string[] = parsed.imgList.length > 0 ? parsed.imgList : storedImages;
  const capacity = Math.floor(Number(row.capacity));
  return {
    id: String(row.id),
    name: String(row.name || `Room ${idx + 1}`).trim(),
    category: parsed.displayCategory || row.category || '',
    offering_type: offeringTypeOfRow(row),
    rate_php: Number(row.rate_php) || 3500,
    // A missing or invalid capacity stays 0 so the room is never auto-assigned to a party it may not fit.
    capacity: capacity > 0 ? capacity : 0,
    beds_count: Number(row.beds_count) || 2,
    baths_count: Number(row.baths_count) || 1,
    description: row.description || '',
    amenities: parsed.cleanAmenities,
    image_url: images[0] || '',
    images,
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

  const fitRank: Record<RoomFit, number> = { best: 0, fits: 1, 'too-small': 2, booked: 3 };
  const options: RoomOption[] = sorted
    .map((o) => {
      let fit: RoomFit = 'fits';
      if (!o.fitsParty) fit = 'too-small';
      else if (!o.available) fit = 'booked';
      else if (o === bestFree) fit = 'best';
      return { ...o, fit };
    })
    // Available rooms first; rooms already taken for these dates sink to the bottom.
    .sort((a, b) => fitRank[a.fit] - fitRank[b.fit]);

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
