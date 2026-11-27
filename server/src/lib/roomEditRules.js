import { ApiError } from '../middleware/errors.js';

export function assertRoomEditAllowed({ isAdministrator, existingRoom, body }) {
  if (isAdministrator) return;
  if (!existingRoom) throw new ApiError(404, 'This unit was not found.');

  if (body.rate_php !== undefined && Number(body.rate_php) !== Number(existingRoom.rate_php)) {
    throw new ApiError(403, "Only an administrator can change a unit's nightly rate. Send a price change request instead.");
  }
  if (body.is_active !== undefined && Boolean(body.is_active) !== Boolean(existingRoom.is_active)) {
    throw new ApiError(403, 'Use Maint. or Reactivate to switch a unit on or off.');
  }
}
