export type NightLevel = 'none' | 'open' | 'partial' | 'full';

export interface NightSummary<T> {
  open: T[];
  booked: T[];
  level: NightLevel;
}

/** Splits places into open and booked for one night. With no places at all the level is "none". */
export function summarizeNight<T>(places: T[], isBooked: (place: T) => boolean): NightSummary<T> {
  const open: T[] = [];
  const booked: T[] = [];
  for (const place of places) (isBooked(place) ? booked : open).push(place);
  const level: NightLevel =
    places.length === 0 ? 'none' : booked.length === 0 ? 'open' : open.length === 0 ? 'full' : 'partial';
  return { open, booked, level };
}

const NON_BLOCKING_STATUSES = ['cancelled', 'rejected', 'checked_out', 'no_show'];

/** The check-out date is not a night, so a stay ending on it leaves that night free. A same-day stay holds its own date. */
export function stayBlocksNight(stay: { checkIn: string; checkOut: string; status?: string }, night: string): boolean {
  if (NON_BLOCKING_STATUSES.includes(String(stay.status || '').toLowerCase())) return false;
  const checkIn = String(stay.checkIn || '').slice(0, 10);
  const checkOut = String(stay.checkOut || '').slice(0, 10);
  if (!checkIn) return false;
  return checkOut > checkIn ? checkIn <= night && night < checkOut : checkIn === night;
}
