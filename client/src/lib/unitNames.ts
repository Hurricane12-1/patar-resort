import { inferOfferingType } from './offeringSpecs';

/**
 * Names each bookable unit by its kind and a running count: Room 1, Room 2, Cottage 1.
 * The key is `${roomId}:${n}` where n is the unit's position inside that room record.
 */
export function unitDisplayNames(rooms: any[]): Map<string, string> {
  const counts = { room: 0, cottage: 0 };
  const names = new Map<string, string>();

  for (const room of rooms) {
    const kind = inferOfferingType(room) === 'cottage' ? 'cottage' : 'room';
    const unitCount = Math.max(1, Number(room?.units) || 1);
    for (let n = 1; n <= unitCount; n++) {
      counts[kind] += 1;
      names.set(`${room.id}:${n}`, `${kind === 'cottage' ? 'Cottage' : 'Room'} ${counts[kind]}`);
    }
  }

  return names;
}
