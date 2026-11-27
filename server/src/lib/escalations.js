import { ApiError } from '../middleware/errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CASE_STATUSES = ['disputed', 'flagged', 'cancelled', 'pending', 'escalated'];
const ESCALATION_EVENTS = 'action.ilike.%ESCALAT%,action.ilike.%DISPUTE%,action.ilike.%RECOVERY%';

const cleanText = (value) => String(value ?? '').trim();
const dbError = (action, error) =>
  new ApiError(500, `Could not ${action}: ${error?.message || 'unknown database error'}.`);

function appendNote(existing, line) {
  return [cleanText(existing), line].filter(Boolean).join('\n');
}

function actorFields(user) {
  const id = cleanText(user?.id);
  return {
    actor_id: UUID_PATTERN.test(id) ? id : null,
    actor_email: user?.email || user?.domain_account || null,
    actor_role: user?.role || null,
  };
}

async function writeAudit(client, user, action, details) {
  const { error } = await client.from('audit_logs').insert({ action, ...actorFields(user), details });
  return error ? error.message || 'unknown database error' : null;
}

async function saveCaseStatus(client, reservationId, { status, line, requireOpenCase = false }) {
  if (!UUID_PATTERN.test(reservationId)) throw new ApiError(400, 'The reservation ID must be a full UUID.');

  const { data: current, error: readError } = await client
    .from('reservations')
    .select('id, status, notes')
    .eq('id', reservationId)
    .maybeSingle();
  if (readError) throw dbError('read the reservation', readError);
  if (!current) throw new ApiError(404, 'No reservation has that ID. Check the ID and try again.');
  if (requireOpenCase && !CASE_STATUSES.includes(current.status)) {
    throw new ApiError(409, 'This reservation is not an open recovery case.');
  }

  const { data, error } = await client
    .from('reservations')
    .update({ status, notes: appendNote(current.notes, line) })
    .eq('id', reservationId)
    .select('id, status')
    .maybeSingle();
  if (error) throw dbError('save the case', error);
  if (!data) throw new ApiError(409, 'The case was not saved. Refresh the page and try again.');

  return { previousStatus: current.status };
}

export async function createEscalation(client, user, input) {
  const reservationId = cleanText(input.reservation_id);
  const roomId = cleanText(input.room_id);
  const severity = cleanText(input.severity);
  const reason = cleanText(input.reason);
  const details = {
    category: input.category,
    severity,
    reason,
    room_id: roomId || null,
    source_namespace: '/staff',
    target_namespace: '/recovery',
  };

  if (reservationId) {
    const { previousStatus } = await saveCaseStatus(client, reservationId, {
      status: 'disputed',
      line: `[STAFF_ESCALATION (${severity.toUpperCase()})]: ${reason}`,
    });
    const auditError = await writeAudit(client, user, 'STAFF_ESCALATE_TO_RECOVERY', {
      ...details,
      reservation_id: reservationId,
      previous_status: previousStatus,
    });
    return {
      reservation_id: reservationId,
      room_id: roomId || null,
      status: 'disputed',
      attached: true,
      audit_recorded: !auditError,
      audit_error: auditError,
    };
  }

  if (!UUID_PATTERN.test(roomId)) throw new ApiError(400, 'Choose a reservation or a room.');
  const { data: room, error: roomError } = await client
    .from('rooms')
    .select('id, name')
    .eq('id', roomId)
    .maybeSingle();
  if (roomError) throw dbError('read the room', roomError);
  if (!room) throw new ApiError(404, 'No room has that ID.');

  const auditError = await writeAudit(client, user, 'STAFF_ESCALATE_TO_RECOVERY', {
    ...details,
    reservation_id: null,
    room_id: room.id,
    room_name: room.name,
  });
  if (auditError) throw dbError('record the room escalation', { message: auditError });

  return {
    reservation_id: null,
    room_id: room.id,
    room_name: room.name,
    attached: false,
    audit_recorded: true,
    audit_error: null,
  };
}

function toEvent(row) {
  const details = row.details || {};
  return {
    id: row.id,
    action: row.action,
    actor_email: row.actor_email || details.actor_email || '',
    actor_role: row.actor_role || details.actor_role || '',
    created_at: row.created_at,
    details,
  };
}

export async function listEscalationCases(client) {
  const { data: cases, error: caseError } = await client
    .from('reservations')
    .select('*, rooms(name)')
    .in('status', CASE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(50);
  if (caseError) throw dbError('load the recovery cases', caseError);

  const { data: events, error: eventError } = await client
    .from('audit_logs')
    .select('*')
    .or(ESCALATION_EVENTS)
    .order('created_at', { ascending: false })
    .limit(50);

  return {
    cases: cases || [],
    events: eventError ? [] : (events || []).map(toEvent),
    events_error: eventError ? eventError.message || 'unknown database error' : null,
  };
}

async function decideCase(client, user, reservationId, { status, label, auditAction, note, priority = null }) {
  const cleanNote = cleanText(note);
  const line = `[${label} by ${user?.email || 'Officer'}]: ${cleanNote}`;
  const { previousStatus } = await saveCaseStatus(client, reservationId, {
    status,
    line,
    requireOpenCase: true,
  });
  const auditError = await writeAudit(client, user, auditAction, {
    reservation_id: reservationId,
    previous_status: previousStatus,
    new_status: status,
    note: cleanNote,
    ...(priority ? { priority } : {}),
  });
  return { reservation_id: reservationId, status, audit_recorded: !auditError, audit_error: auditError };
}

export function resolveEscalationCase(client, user, reservationId, note) {
  return decideCase(client, user, reservationId, {
    status: 'confirmed',
    label: 'RECOVERY_RESOLVED',
    auditAction: 'RECOVERY_RESOLVED_AND_RESTORED',
    note,
  });
}

export function escalateCaseToGovernance(client, user, reservationId, note) {
  return decideCase(client, user, reservationId, {
    status: 'escalated',
    label: 'EXECUTIVE_GOVERNANCE_ESCALATION',
    auditAction: 'EXECUTIVE_GOVERNANCE_ESCALATION',
    note,
    priority: 'CRITICAL',
  });
}
