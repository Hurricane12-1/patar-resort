export interface PartyRoom {
  id: string;
  capacity?: number;
}

function capacityOf(room: PartyRoom): number {
  return Math.floor(Number(room.capacity) || 0);
}

/** Guests the picked rooms hold together. */
export function combinedCapacity(rooms: PartyRoom[]): number {
  return rooms.reduce((sum, room) => sum + capacityOf(room), 0);
}

/**
 * Splits a party across rooms: one guest in every room first, then each room fills up to its
 * capacity in the order picked. Returns null when a room has no known capacity, when there are
 * fewer guests than rooms, or when the rooms together are too small.
 */
export function splitPartyAcrossRooms(partySize: number, rooms: PartyRoom[]): number[] | null {
  if (rooms.length === 0 || partySize < rooms.length) return null;
  if (rooms.some((room) => capacityOf(room) < 1)) return null;
  if (combinedCapacity(rooms) < partySize) return null;
  const shares = rooms.map(() => 1);
  let left = partySize - rooms.length;
  rooms.forEach((room, i) => {
    const extra = Math.min(left, capacityOf(room) - 1);
    shares[i] += extra;
    left -= extra;
  });
  return shares;
}
