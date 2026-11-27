export type UnitStatus = 'booked' | 'available' | 'offline';

interface UnitLike {
  id?: string;
  is_active?: boolean;
}

interface StayLike {
  room_id?: string;
  status?: string;
  check_in?: string;
  check_out?: string;
}

export function getUnitStatus(unit: UnitLike | null | undefined, stays: StayLike[], today: string): UnitStatus {
  if (!unit) return 'available';
  if (unit.is_active === false) return 'offline';

  const booked = stays.some(
    (stay) =>
      stay.room_id === unit.id &&
      stay.status !== 'cancelled' &&
      stay.status !== 'checked_out' &&
      Boolean(stay.check_in) &&
      Boolean(stay.check_out) &&
      String(stay.check_in).slice(0, 10) <= today &&
      today < String(stay.check_out).slice(0, 10)
  );
  return booked ? 'booked' : 'available';
}
