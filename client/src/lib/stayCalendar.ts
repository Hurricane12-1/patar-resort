import { isRoomFree, type ReservationWindow, type Room } from './guestRooms';

export interface RoomNight {
  room: Room;
  booked: boolean;
}

export type NightLevel = 'open' | 'partial' | 'full';

function nextDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function roomNights(rooms: Room[], night: string, reservations: ReservationWindow[]): RoomNight[] {
  const next = nextDay(night);
  return rooms.map((room) => ({ room, booked: !isRoomFree(room.id, night, next, reservations) }));
}

/** No rooms at all counts as open, so an empty pick never paints a date as booked. */
export function nightLevel(nights: RoomNight[]): NightLevel {
  const booked = nights.filter((n) => n.booked).length;
  if (booked === 0) return 'open';
  return booked === nights.length ? 'full' : 'partial';
}

export function describeNights(nights: RoomNight[]): string {
  return nights.map((n) => `${n.room.name} ${n.booked ? 'booked' : 'available'}`).join(', ');
}

/** `end` is the check-out date, which is not a night, so a reservation starting on it does not block the range. */
export function openRoomsForRange(
  rooms: Room[],
  start: string,
  end: string,
  reservations: ReservationWindow[]
): Room[] {
  return rooms.filter((room) => isRoomFree(room.id, start, end, reservations));
}
