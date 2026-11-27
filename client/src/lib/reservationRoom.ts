interface NamedRoom {
  id?: string | null;
  name?: string | null;
}

/** Maps room id to room name, so a booking without the joined room can still show where the guest is staying. */
export function roomNameLookup(...roomLists: Array<NamedRoom[] | undefined>): Map<string, string> {
  const names = new Map<string, string>();
  for (const list of roomLists) {
    for (const room of list || []) {
      const name = String(room?.name || '').trim();
      if (room?.id && name) names.set(String(room.id), name);
    }
  }
  return names;
}

/** The room's name for a booking, or an empty string when no room is linked to it. */
export function reservationRoomName(booking: any, namesById: Map<string, string>): string {
  const joined = String(booking?.rooms?.name || '').trim();
  if (joined) return joined;
  const linked = booking?.room_id ? namesById.get(String(booking.room_id)) : undefined;
  if (linked) return linked;
  return String(booking?.room_name || '').trim();
}
