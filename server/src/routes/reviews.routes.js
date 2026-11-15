import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { admin } from '../lib/supabase.js';
import { logAuditEvent } from '../lib/auditLogger.js';

const r = Router();

const MODERATION_STATES = ['pending', 'approved', 'rejected', 'flagged'];

const PUBLIC_FIELDS =
  'id, rating, comment, created_at, admin_reply, admin_reply_at, rooms(name), profiles(full_name)';
const ADMIN_FIELDS =
  'id, rating, comment, created_at, is_approved, moderation_status, moderation_note, ' +
  'moderated_at, admin_reply, admin_reply_at, guest_id, room_id, reservation_id, ' +
  'rooms(name, slug, category), profiles(full_name, email)';

// Public wall — only approved reviews, newest first, with any official reply.
r.get('/reviews/recent', asyncH(async (_req, res) => {
  const { data, error } = await admin.from('reviews')
    .select(PUBLIC_FIELDS)
    .eq('is_approved', true)
    .order('created_at', { ascending: false }).limit(9);
  if (error) {
    throw new ApiError(500, error.message);
  }
  return res.json(data || []);
}));

// A guest submits a review for a checked-out stay. It enters the moderation
// queue as 'pending' and stays off the public wall until an admin approves it.
r.post('/reviews', authenticate,
  validate(z.object({
    reservationId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(600).default(''),
  })),
  asyncH(async (req, res) => {
    const { reservationId, rating, comment } = req.body;
    const { data: b } = await req.sb.from('reservations').select('*')
      .eq('id', reservationId).single();
    if (!b) throw new ApiError(404, 'Reservation not found');
    if (b.status !== 'checked_out')
      throw new ApiError(409, 'You can review after you check out.');
    const { data, error } = await req.sb.from('reviews')
      .insert({ reservation_id: reservationId, guest_id: req.user.id,
                room_id: b.room_id,
                // reviews.guest_name is NOT NULL; fall back to the reservation's guest name.
                guest_name: req.user.full_name || b.guest_name || 'Verified Guest',
                rating, comment,
                moderation_status: 'pending', is_approved: false })
      .select().single();
    if (error) throw new ApiError(error.code === '23505' ? 409 : 500,
      error.code === '23505' ? 'You already reviewed this stay.' : error.message);
    return res.status(201).json(data);
  }));

// ---------------------------------------------------------------------------
// Moderation console (management only)
// ---------------------------------------------------------------------------

// List reviews for the moderation queue, optionally filtered by status.
r.get('/reviews/admin', authenticate, requireAdmin,
  asyncH(async (req, res) => {
    const status = String(req.query.status || 'all').toLowerCase();
    let query = admin.from('reviews')
      .select(ADMIN_FIELDS)
      .order('created_at', { ascending: false })
      .limit(200);
    if (MODERATION_STATES.includes(status)) {
      query = query.eq('moderation_status', status);
    }
    const { data, error } = await query;
    if (error) throw new ApiError(500, error.message);

    const counts = { pending: 0, approved: 0, rejected: 0, flagged: 0, total: 0 };
    const { data: allRows, error: countErr } = await admin.from('reviews')
      .select('moderation_status');
    if (!countErr && Array.isArray(allRows)) {
      for (const row of allRows) {
        const s = MODERATION_STATES.includes(row.moderation_status) ? row.moderation_status : 'pending';
        counts[s] += 1;
        counts.total += 1;
      }
    }
    return res.json({ reviews: data || [], counts });
  }));

// Approve / reject / flag / re-queue a review.
r.patch('/reviews/admin/:id/moderation', authenticate, requireAdmin,
  validate(z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'flagged']),
    note: z.string().max(400).optional(),
  })),
  asyncH(async (req, res) => {
    const { id } = req.params;
    const { status, note } = req.body;
    const { data, error } = await admin.from('reviews')
      .update({
        moderation_status: status,
        is_approved: status === 'approved',
        moderation_note: note ?? null,
        moderated_at: new Date().toISOString(),
        moderated_by: req.user.id,
      })
      .eq('id', id)
      .select(ADMIN_FIELDS)
      .single();
    if (error) throw new ApiError(error.code === 'PGRST116' ? 404 : 500,
      error.code === 'PGRST116' ? 'Review not found' : error.message);

    await logAuditEvent({
      req,
      action: `REVIEW_${status.toUpperCase()}`,
      resourceType: 'review',
      resourceId: id,
      details: { status, note: note || null, rating: data?.rating },
    }).catch(() => {});

    return res.json({ review: data });
  }));

// Post, edit, or clear the resort's official public reply to a review.
r.put('/reviews/admin/:id/reply', authenticate, requireAdmin,
  validate(z.object({
    reply: z.string().max(600).default(''),
  })),
  asyncH(async (req, res) => {
    const { id } = req.params;
    const reply = (req.body.reply || '').trim();
    const cleared = reply.length === 0;
    const { data, error } = await admin.from('reviews')
      .update({
        admin_reply: cleared ? null : reply,
        admin_reply_at: cleared ? null : new Date().toISOString(),
        admin_reply_by: cleared ? null : req.user.id,
      })
      .eq('id', id)
      .select(ADMIN_FIELDS)
      .single();
    if (error) throw new ApiError(error.code === 'PGRST116' ? 404 : 500,
      error.code === 'PGRST116' ? 'Review not found' : error.message);

    await logAuditEvent({
      req,
      action: cleared ? 'REVIEW_REPLY_CLEARED' : 'REVIEW_REPLY_POSTED',
      resourceType: 'review',
      resourceId: id,
      details: { cleared },
    }).catch(() => {});

    return res.json({ review: data });
  }));

export default r;
