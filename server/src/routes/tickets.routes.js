import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate, requireFrontDeskOrAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getSystemAdminClient } from '../lib/supabase.js';
import { notifyStaff } from '../lib/notify.js';
import { insertNotification } from '../lib/notifications.js';

const r = Router();

const CATEGORIES = [
  'Change my dates',
  'Change room or guests',
  'Cancellation or refund',
  'Payment question',
  'Problem during my stay',
  'Something else',
];
const MAX_OPEN_TICKETS = 5;
const NOT_BOOKABLE_STATUSES = ['cancelled', 'rejected'];

const fileSchema = z.object({
  reservation_id: z.string().uuid('Choose the booking this ticket is about.'),
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Choose a category.' }) }),
  priority: z.enum(['normal', 'urgent']).default('normal'),
  subject: z.string().trim().min(4, 'Give the ticket a short title.').max(80),
  details: z.string().trim().min(10, 'Tell us a little more.').max(800),
});

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().trim().max(500).optional().default(''),
});

const staffSchema = z.object({
  action: z.enum(['take', 'progress', 'resolve', 'close']),
  note: z.string().trim().max(500).optional().default(''),
});

/** The employee ID (for example RV-STF-001) of a staff account. Null for guests and for accounts with no employee record. */
async function employeeIdFor(client, user) {
  if (!user) return null;
  try {
    const { data: byAuth } = await client.from('employee_accounts').select('employee_id').eq('auth_user_id', user.id).maybeSingle();
    if (byAuth?.employee_id) return byAuth.employee_id;
    if (user.email) {
      const { data: byEmail } = await client.from('employee_accounts').select('employee_id').eq('email', String(user.email).toLowerCase()).maybeSingle();
      if (byEmail?.employee_id) return byEmail.employee_id;
    }
  } catch (err) {
    console.warn('[Tickets] Could not look up the employee ID:', err.message);
  }
  return null;
}

/** Every step on a ticket is kept, so the ticket shows each staff member who handled it. Never blocks the action itself. */
async function logEvent(client, ticket, actor, action, note = '') {
  try {
    const actorEmployeeId = await employeeIdFor(client, actor);
    await client.from('ticket_events').insert({
      ticket_id: ticket.id,
      tracking_id: ticket.tracking_id,
      actor_id: actor?.id || null,
      actor_name: actor?.full_name || actor?.name || actor?.email || 'Guest',
      actor_employee_id: actorEmployeeId,
      actor_role: actor?.role || 'customer',
      action,
      note: note || null,
    });
  } catch (err) {
    console.warn('[Tickets] Could not record the ticket event:', err.message);
  }
}

const STAFF_ACTIONS = ['taken', 'in_progress', 'resolved', 'closed'];

/** Adds handlers: each staff member who acted on the ticket, with their employee ID, in the order they first acted. */
async function withHandlers(client, tickets) {
  if (!tickets.length) return tickets;
  const { data: events } = await client
    .from('ticket_events')
    .select('ticket_id, actor_name, actor_employee_id, action, created_at')
    .in('ticket_id', tickets.map((t) => t.id))
    .in('action', STAFF_ACTIONS)
    .order('created_at', { ascending: true });
  const byTicket = new Map();
  for (const e of events || []) {
    const handlers = byTicket.get(e.ticket_id) || [];
    const key = e.actor_employee_id || e.actor_name;
    if (!handlers.some((h) => (h.employee_id || h.name) === key)) {
      handlers.push({ name: e.actor_name, employee_id: e.actor_employee_id || null });
    }
    byTicket.set(e.ticket_id, handlers);
  }
  return tickets.map((t) => ({ ...t, handlers: byTicket.get(t.id) || [] }));
}

function staffName(user) {
  return user?.full_name || user?.name || user?.email || 'Front desk';
}

/** A ticket may only be filed by the person who made the booking. */
async function ownedBooking(client, reservationId, user) {
  const { data: booking } = await client
    .from('reservations')
    .select('id, booking_code, guest_id, email, guest_name, phone, status, rooms(name)')
    .eq('id', reservationId)
    .maybeSingle();
  if (!booking) throw new ApiError(404, 'We could not find that booking.');
  const sameEmail = booking.email && user.email && String(booking.email).toLowerCase() === String(user.email).toLowerCase();
  if (booking.guest_id !== user.id && !sameEmail) {
    throw new ApiError(403, 'Tickets can only be filed for your own bookings.');
  }
  if (NOT_BOOKABLE_STATUSES.includes(String(booking.status || '').toLowerCase())) {
    throw new ApiError(422, 'That booking was cancelled, so a ticket cannot be filed for it.');
  }
  return booking;
}

async function ownTicket(client, id, user) {
  const { data: ticket } = await client.from('tickets').select('*').eq('id', id).maybeSingle();
  if (!ticket || ticket.guest_id !== user.id) throw new ApiError(404, 'Ticket not found.');
  return ticket;
}

/** POST /api/tickets: file a ticket for one of the guest's own bookings. */
r.post('/tickets', authenticate, validate(fileSchema), asyncH(async (req, res) => {
  const client = await getSystemAdminClient();
  const { reservation_id, category, priority, subject, details } = req.body;
  const booking = await ownedBooking(client, reservation_id, req.user);

  const { count } = await client
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('guest_id', req.user.id)
    .in('status', ['open', 'in_progress']);
  if ((count || 0) >= MAX_OPEN_TICKETS) {
    throw new ApiError(429, `You already have ${MAX_OPEN_TICKETS} open tickets. Please wait for a reply or resolve one first.`);
  }

  const { data: ticket, error } = await client
    .from('tickets')
    .insert({
      guest_id: req.user.id,
      guest_name: booking.guest_name || req.user.full_name || req.user.name || 'Guest',
      guest_email: booking.email || req.user.email || null,
      guest_phone: booking.phone || null,
      reservation_id: booking.id,
      booking_code: booking.booking_code,
      room_name: booking.rooms?.name || null,
      category,
      priority,
      subject,
      details,
    })
    .select()
    .single();
  if (error) throw new ApiError(500, error.message);

  await logEvent(client, ticket, req.user, 'filed', subject);
  notifyStaff({
    type: 'ticket',
    title: `${ticket.tracking_id}${priority === 'urgent' ? ' (urgent)' : ''}`,
    body: `${subject} · ${category} · ${ticket.guest_name}`,
    reservationId: booking.id,
  });
  res.status(201).json(ticket);
}));

/** GET /api/tickets/mine: the signed-in guest's own tickets. */
r.get('/tickets/mine', authenticate, asyncH(async (req, res) => {
  const client = await getSystemAdminClient();
  const { data, error } = await client
    .from('tickets')
    .select('*')
    .eq('guest_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new ApiError(500, error.message);
  res.json(await withHandlers(client, data || []));
}));

/** POST /api/tickets/:id/rating: the guest rates a resolved ticket once. */
r.post('/tickets/:id/rating', authenticate, validate(ratingSchema), asyncH(async (req, res) => {
  const client = await getSystemAdminClient();
  const ticket = await ownTicket(client, req.params.id, req.user);
  if (ticket.status !== 'resolved') throw new ApiError(422, 'You can rate a ticket once it is resolved.');
  if (ticket.rating) throw new ApiError(409, 'This ticket was already rated.');
  const { data, error } = await client
    .from('tickets')
    .update({ rating: req.body.rating, feedback: req.body.feedback || null, rated_at: new Date().toISOString() })
    .eq('id', ticket.id)
    .select()
    .single();
  if (error) throw new ApiError(500, error.message);
  await logEvent(client, ticket, req.user, 'rated', `${req.body.rating}/5${req.body.feedback ? ` - ${req.body.feedback}` : ''}`);
  res.json(data);
}));

/** POST /api/tickets/:id/reopen: the guest says it is not solved. */
r.post('/tickets/:id/reopen', authenticate, asyncH(async (req, res) => {
  const client = await getSystemAdminClient();
  const ticket = await ownTicket(client, req.params.id, req.user);
  if (ticket.status !== 'resolved') throw new ApiError(422, 'Only a resolved ticket can be reopened.');
  const { data, error } = await client
    .from('tickets')
    .update({ status: 'open', resolved_at: null, rating: null, feedback: null, rated_at: null })
    .eq('id', ticket.id)
    .select()
    .single();
  if (error) throw new ApiError(500, error.message);
  await logEvent(client, ticket, req.user, 'reopened');
  notifyStaff({ type: 'ticket', title: `${ticket.tracking_id} reopened`, body: `${ticket.guest_name} says "${ticket.subject}" is not solved yet.` });
  res.json(data);
}));

/** GET /api/tickets: the staff list. */
r.get('/tickets', authenticate, requireFrontDeskOrAdmin, asyncH(async (req, res) => {
  const client = await getSystemAdminClient();
  let query = client.from('tickets').select('*').order('created_at', { ascending: false }).limit(200);
  const status = String(req.query.status || '');
  if (['open', 'in_progress', 'resolved', 'closed'].includes(status)) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new ApiError(500, error.message);
  res.json(await withHandlers(client, data || []));
}));

/** GET /api/tickets/:id/events: who did what on a ticket, oldest first. */
r.get('/tickets/:id/events', authenticate, asyncH(async (req, res) => {
  const client = await getSystemAdminClient();
  const { data: ticket } = await client.from('tickets').select('id, guest_id').eq('id', req.params.id).maybeSingle();
  if (!ticket) throw new ApiError(404, 'Ticket not found.');
  const role = String(req.user.role || '').toLowerCase();
  const isStaff = ['administrator', 'admin', 'staff', 'receptionist', 'accounting'].includes(role);
  if (!isStaff && ticket.guest_id !== req.user.id) throw new ApiError(404, 'Ticket not found.');
  const { data, error } = await client
    .from('ticket_events')
    .select('id, actor_name, actor_employee_id, actor_role, action, note, created_at')
    .eq('ticket_id', ticket.id)
    .order('created_at', { ascending: true });
  if (error) throw new ApiError(500, error.message);
  res.json(data || []);
}));

/** PATCH /api/tickets/:id: staff take, progress, resolve or close a ticket. */
r.patch('/tickets/:id', authenticate, requireFrontDeskOrAdmin, validate(staffSchema), asyncH(async (req, res) => {
  const client = await getSystemAdminClient();
  const { data: ticket } = await client.from('tickets').select('*').eq('id', req.params.id).maybeSingle();
  if (!ticket) throw new ApiError(404, 'Ticket not found.');

  const { action, note } = req.body;
  const now = new Date().toISOString();
  const patch = { updated_at: now };
  const employeeId = await employeeIdFor(client, req.user);
  const claim = () => {
    patch.assigned_to = req.user.id;
    patch.assigned_name = staffName(req.user);
    patch.assigned_employee_id = employeeId;
  };
  if (action === 'take') {
    patch.status = 'in_progress';
    claim();
  } else if (action === 'progress') {
    patch.status = 'in_progress';
    if (!ticket.assigned_to) claim();
  } else if (action === 'resolve') {
    patch.status = 'resolved';
    patch.resolved_at = now;
    patch.resolution_note = note || ticket.resolution_note || null;
    if (!ticket.assigned_to) claim();
  } else if (action === 'close') {
    patch.status = 'closed';
    patch.resolution_note = note || ticket.resolution_note || null;
  }

  const { data, error } = await client.from('tickets').update(patch).eq('id', ticket.id).select().single();
  if (error) throw new ApiError(500, error.message);
  await logEvent(client, ticket, req.user, { take: 'taken', progress: 'in_progress', resolve: 'resolved', close: 'closed' }[action], note);

  if (ticket.guest_id && (action === 'resolve' || action === 'take')) {
    insertNotification({
      userId: ticket.guest_id,
      title: `${ticket.tracking_id} ${action === 'resolve' ? 'resolved' : 'is being handled'}`,
      body: action === 'resolve' ? `Your ticket "${ticket.subject}" was resolved. Please rate the help you got.` : `${staffName(req.user)} picked up your ticket "${ticket.subject}".`,
      type: 'ticket',
      reservationId: ticket.reservation_id,
    }).catch(() => {});
  }
  res.json(data);
}));

export default r;
