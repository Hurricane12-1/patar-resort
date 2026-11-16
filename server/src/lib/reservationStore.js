// Local file caching disabled: all reservations are read and written strictly through Supabase
// to prevent ghost reservations from persisting after database rows are deleted.

export function getLocalReservations() {
  return [];
}

export function addLocalReservation(res) {
  return res;
}

export function updateLocalReservation(_id, _updates) {
  return null;
}

export function deleteLocalReservation(_id) {
  return true;
}
