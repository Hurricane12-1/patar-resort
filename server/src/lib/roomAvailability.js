import { ApiError } from '../middleware/errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOSED_STATUSES = ['cancelled', 'checked_out'];

async function assertNoGuestInside(client, roomId) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const { data: stays, error } = await client
    .from('reservations')
    .select('id, status, check_in, check_out')
    .eq('room_id', roomId)
    .lte('check_in', today)
    .gt('check_out', today);
  if (error) throw new ApiError(500, `Could not check the unit's guests: ${error.message || 'unknown database error'}.`);
  if ((stays || []).some((stay) => !CLOSED_STATUSES.includes(stay.status))) {
    throw new ApiError(409, 'A guest is in this unit. Check them out before putting it offline.');
  }
}

export async function setRoomAvailability(client, roomId, isActive) {
  if (!UUID_PATTERN.test(String(roomId || ''))) throw new ApiError(400, 'The unit ID must be a full UUID.');

  const { data: current, error: readError } = await client
    .from('rooms')
    .select('id, name, is_active')
    .eq('id', roomId)
    .maybeSingle();
  if (readError) throw new ApiError(500, `Could not read the unit: ${readError.message || 'unknown database error'}.`);
  if (!current) throw new ApiError(404, 'This unit was not found.');
  if (!isActive) await assertNoGuestInside(client, roomId);

  const { data, error } = await client
    .from('rooms')
    .update({ is_active: isActive })
    .eq('id', roomId)
    .select('id, name, is_active')
    .maybeSingle();
  if (error) throw new ApiError(500, `Could not update the unit: ${error.message || 'unknown database error'}.`);
  if (!data) throw new ApiError(409, 'The unit was not updated. Refresh the page and try again.');

  return {
    id: data.id,
    name: data.name,
    is_active: data.is_active,
    previous_is_active: current.is_active,
  };
}
