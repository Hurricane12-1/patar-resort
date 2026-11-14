/**
 * ============================================================================
 * Centralized authorization policy
 * ----------------------------------------------------------------------------
 * One place for "who may do what" so the rules stop being copy-pasted across
 * routes. Identity resolution (verifying the token, normalizing the role and
 * department) stays in middleware/auth.js; this module only decides, given
 * those primitives, whether an action is allowed. Keeping it free of DB/Express
 * imports makes every function pure and unit-testable.
 *
 * Mirrors the row-level-security policies in server/supabase/rls_policies.sql,
 * so the same rules are enforced both in the API layer and at the database.
 * ============================================================================
 */

/** Roles with full executive oversight. */
export const ADMIN_ROLES = ['administrator', 'admin'];

/** Roles that may act on any guest's booking at the front desk. */
export const CANCEL_STAFF_ROLES = ['administrator', 'receptionist', 'accounting'];

/** A guest may self-cancel their booking only within this window after it was made. */
export const GUEST_CANCEL_WINDOW_MS = 5 * 60 * 60 * 1000; // 5 hours

const lc = (v) => String(v || '').trim().toLowerCase();

export const isAdminRole = (role) => ADMIN_ROLES.includes(lc(role));

/**
 * Staff who can cancel/modify any booking. Mirrors the reservation routes:
 * the three desk roles, plus a generic "staff" member only when assigned to
 * the front desk.
 */
export function isCancelStaff(role, department) {
  const r = lc(role);
  if (CANCEL_STAFF_ROLES.includes(r)) return true;
  return r === 'staff' && lc(department) === 'front_desk';
}

/**
 * True when `user` owns `row` — by profile id (guest_id) or, as a fallback,
 * by matching email. Accepts either `guest_email` or legacy `email` on the row.
 */
export function ownsReservation(user, row) {
  if (!user || !row) return false;
  if (row.guest_id && user.id && row.guest_id === user.id) return true;
  const ue = lc(user.email);
  const re = lc(row.guest_email || row.email);
  return Boolean(ue && re && ue === re);
}

/**
 * Decide whether a cancellation is allowed.
 * @returns {{ok: boolean, status?: number, message?: string}}
 *   ok:true  → allowed.
 *   ok:false → status is the HTTP code and message the guest-facing reason.
 *
 * Rules (identical to the previous inline logic, now in one testable place):
 *   • must be the owner or cancel-staff;
 *   • the stay must still be upcoming (pending/confirmed);
 *   • a guest (owner, non-staff) may only cancel within GUEST_CANCEL_WINDOW_MS
 *     of booking. A missing/unparseable created_at fails OPEN (treated as
 *     just-created) so a real booking is never trapped. Staff are never
 *     time-limited.
 */
export function evaluateCancellation({ isOwner, isStaff, status, createdAt }, now = Date.now()) {
  if (!isOwner && !isStaff) {
    return { ok: false, status: 403, message: 'Unauthorized to cancel this booking' };
  }
  if (!['pending', 'confirmed'].includes(String(status))) {
    return { ok: false, status: 409, message: 'Only upcoming stays can be cancelled.' };
  }
  if (isOwner && !isStaff) {
    const createdMs = Date.parse(createdAt || '');
    const elapsed = Number.isFinite(createdMs) ? now - createdMs : 0;
    if (elapsed > GUEST_CANCEL_WINDOW_MS) {
      return {
        ok: false,
        status: 409,
        message:
          'The 5-hour self-cancellation window for this booking has closed. Please contact the front desk at +63 900 555 0123 to cancel.',
      };
    }
  }
  return { ok: true };
}

/** Whether `user` may view the reservation `row` (owner or any staff). */
export function canViewReservation(user, row, { staff } = {}) {
  return Boolean(staff) || ownsReservation(user, row);
}
