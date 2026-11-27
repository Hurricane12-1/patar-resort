import { ApiError } from '../middleware/errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOSED_STATUSES = ['cancelled', 'checked_out'];
const LINKED_TABLES = ['room_locks', 'reviews', 'department_tasks'];

function manilaToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

export function roomSnapshot(room) {
  return {
    name: room.name,
    category: room.category || null,
    rate_php: room.rate_php ?? null,
    capacity: room.capacity ?? null,
    units: room.units ?? null,
    is_active: room.is_active ?? null,
  };
}

/**
 * Permanently removes a unit. A unit with a guest in-house or an upcoming booking is never removed.
 * Past and cancelled bookings stay on record without a room, and only an administrator may remove a unit that has any.
 */
export async function removeRoom(client, roomId, { isAdministrator = false, today = manilaToday() } = {}) {
  if (!UUID_PATTERN.test(String(roomId || ''))) throw new ApiError(400, 'The unit ID must be a full UUID.');

  const { data: room, error: roomError } = await client
    .from('rooms')
    .select('id, name, category, rate_php, capacity, units, is_active')
    .eq('id', roomId)
    .maybeSingle();
  if (roomError) throw new ApiError(500, `Could not read the unit: ${roomError.message || 'unknown database error'}.`);
  if (!room) throw new ApiError(404, 'This unit was not found.');

  const { data: bookings, error: bookingsError } = await client
    .from('reservations')
    .select('id, status, check_in, check_out')
    .eq('room_id', roomId);
  if (bookingsError) throw new ApiError(500, `Could not check the unit's bookings: ${bookingsError.message || 'unknown database error'}.`);

  const onRecord = bookings || [];
  const live = onRecord.filter(
    (b) => !CLOSED_STATUSES.includes(b.status) && String(b.check_out || '').slice(0, 10) >= today
  );
  const snapshot = roomSnapshot(room);

  if (live.length > 0) {
    throw new ApiError(
      409,
      `${room.name} has ${plural(live.length, 'active or upcoming booking', 'active or upcoming bookings')}. Move or cancel ${live.length === 1 ? 'it' : 'them'} first, or take the unit offline.`,
      { code: 'ROOM_HAS_LIVE_BOOKINGS', details: { ...snapshot, live_bookings: live.length, bookings_on_record: onRecord.length } }
    );
  }
  if (!isAdministrator && onRecord.length > 0) {
    throw new ApiError(
      403,
      `${room.name} has ${plural(onRecord.length, 'booking', 'bookings')} on record. Only an administrator can remove it. Use Maint. to take it offline instead.`,
      { code: 'ROOM_HAS_BOOKING_HISTORY', details: { ...snapshot, bookings_on_record: onRecord.length } }
    );
  }

  const bookingIds = onRecord.map((b) => b.id);
  if (bookingIds.length > 0) {
    const { error: unlinkError } = await client.from('reservations').update({ room_id: null }).eq('room_id', roomId);
    if (unlinkError) {
      throw new ApiError(409, `Could not detach ${room.name} from its past bookings, so nothing was removed.`, { code: 'ROOM_UNLINK_FAILED' });
    }
  }

  // Some deployments lack these tables, so a failed cleanup is not fatal on its own.
  for (const table of LINKED_TABLES) {
    await client.from(table).delete().eq('room_id', roomId);
  }

  const { data: removed, error: removeError } = await client.from('rooms').delete().eq('id', roomId).select('id');
  if (removeError || !removed || removed.length === 0) {
    if (bookingIds.length > 0) {
      await client.from('reservations').update({ room_id: roomId }).in('id', bookingIds);
    }
    throw new ApiError(
      409,
      `${room.name} could not be removed${removeError?.message ? ` (${removeError.message})` : ''}. It is still linked to other records. Take it offline instead.`,
      { code: 'ROOM_REMOVE_FAILED' }
    );
  }

  return { id: room.id, ...snapshot, bookings_on_record: onRecord.length };
}
