import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import {
  authenticate,
  requireAdmin,
  requireRole,
  normalizeEmployeeRole,
  resolveEmployeeDepartment,
} from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { admin, getSystemAdminClient } from '../lib/supabase.js';
import { redis } from '../lib/redis.js';
import { logAuditEvent } from '../lib/auditLogger.js';
import { getTransporter } from '../lib/mailer.js';
import { env } from '../config/env.js';
import {
  listPriceChangeRequests,
  getPriceChangeRequestById,
  createPriceChangeRequest,
  updatePriceChangeRequest,
  generatePriceApprovalCode,
} from '../lib/priceRequestStore.js';

const r = Router();

const requirePriceRequestAccess = (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Authentication required'));
  const role = normalizeEmployeeRole(req.user.role);
  const dept = resolveEmployeeDepartment(req.user);
  if (role === 'administrator' || role === 'accounting' || role === 'receptionist' || (role === 'staff' && dept === 'front_desk')) {
    return next();
  }
  return requireRole('administrator', 'accounting', 'receptionist')(req, res, next);
};

function sanitizeRequestForViewer(reqItem, isAdmin) {
  if (isAdmin) return reqItem;
  const copy = { ...reqItem };
  const hasCode = Boolean(copy.authorization_code);
  delete copy.authorization_code;
  copy.authorization_code_issued = hasCode;
  return copy;
}

async function applyRoomRateUpdate(roomId, newRatePhp) {
  const client = (await getSystemAdminClient().catch(() => null)) || admin;
  const { data, error } = await client
    .from('rooms')
    .update({ rate_php: Number(newRatePhp) })
    .eq('id', roomId)
    .select()
    .single();
  if (error) throw new ApiError(500, error.message || 'Failed to apply approved room price update.');
  await redis.clear();
  return data;
}

async function insertNotificationSafe({ profileId = null, title, body, recipient }) {
  try {
    const client = (await getSystemAdminClient().catch(() => null)) || admin;
    await client.from('notifications').insert({
      profile_id: profileId,
      title,
      body,
      type: 'sms',
      recipient,
      status: 'sent',
    });
  } catch (err) {
    console.warn('[PriceRequests] Notification notice:', err?.message || err);
  }
}

async function dispatchCodeEmail({ to, requesterName, roomName, currentRate, requestedRate, code }) {
  if (!to) return;
  try {
    const mail = getTransporter();
    await mail.sendMail({
      from: env.MAIL_FROM,
      to,
      subject: `Rock View Admin Price-Change Authorization Code (${code})`,
      text: [
        `Hello ${requesterName || 'Team Member'},`,
        '',
        `Administrator has approved your price change request for "${roomName}".`,
        `Current Rate: PHP ${Number(currentRate).toLocaleString()}`,
        `Approved New Rate: PHP ${Number(requestedRate).toLocaleString()}`,
        '',
        `Authorization Code: ${code}`,
        'Enter this code in your staff portal to apply the updated rate. This code is single-use and expires in 24 hours.',
      ].join('\n'),
    });
  } catch (err) {
    console.warn('[PriceRequests] Email dispatch notice:', err?.message || err);
  }
}

function timingSafeCodeMatch(expected, provided) {
  const a = Buffer.from(String(expected || '').trim().toUpperCase(), 'utf8');
  const b = Buffer.from(String(provided || '').trim().toUpperCase(), 'utf8');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// List price change requests (Admin sees all; authorized finance/front-desk see their own without raw code)
r.get('/price-requests', authenticate, requirePriceRequestAccess, asyncH(async (req, res) => {
  const role = normalizeEmployeeRole(req.user?.role);
  const isAdmin = role === 'administrator';
  const all = await listPriceChangeRequests();

  const filtered = isAdmin
    ? all
    : all.filter((item) => {
        const sameId = req.user?.id && item.requested_by_id === req.user.id;
        const sameEmail = req.user?.email && item.requested_by_email &&
          item.requested_by_email.toLowerCase() === req.user.email.toLowerCase();
        return Boolean(sameId || sameEmail);
      });

  return res.json(filtered.map((item) => sanitizeRequestForViewer(item, isAdmin)));
}));

// Submit a price change permission request to Administrator
r.post('/price-requests', authenticate, requirePriceRequestAccess,
  validate(z.object({
    room_id: z.string().min(1),
    requested_rate_php: z.coerce.number().int().min(50),
    reason: z.string().trim().min(5, 'Please explain why the price change is needed').max(400),
  })),
  asyncH(async (req, res) => {
    const role = normalizeEmployeeRole(req.user?.role);
    const dept = resolveEmployeeDepartment(req.user) || 'management';
    const client = (await getSystemAdminClient().catch(() => null)) || admin;

    const { data: room, error: roomErr } = await client
      .from('rooms')
      .select('id, name, category, rate_php, amenities')
      .eq('id', req.body.room_id)
      .maybeSingle();

    if (roomErr || !room) {
      throw new ApiError(404, 'Accommodation or offering not found.');
    }

    if (Number(room.rate_php) === Number(req.body.requested_rate_php)) {
      throw new ApiError(400, 'Requested rate must differ from the current rate.');
    }

    const created = await createPriceChangeRequest({
      room_id: room.id,
      room_name: room.name,
      category: room.category || 'Room',
      current_rate_php: Number(room.rate_php),
      requested_rate_php: Number(req.body.requested_rate_php),
      reason: req.body.reason,
      requested_by_id: req.user.id,
      requested_by_name: req.user.full_name || req.user.email || 'Staff Member',
      requested_by_email: req.user.email || '',
      requested_by_role: role,
      requested_by_department: dept,
    });

    await insertNotificationSafe({
      title: 'Price Change Approval Needed',
      body: `${created.requested_by_name} (${dept.replace('_', ' ')}) requested changing "${room.name}" from ₱${Number(room.rate_php).toLocaleString()} to ₱${Number(req.body.requested_rate_php).toLocaleString()}. Reason: ${req.body.reason}`,
      recipient: 'Administrator',
    });

    await logAuditEvent({
      actor: req.user,
      action: 'PRICE_CHANGE_REQUESTED',
      resourceType: 'price_request',
      resourceId: created.id,
      details: {
        room_id: room.id,
        room_name: room.name,
        current_rate_php: room.rate_php,
        requested_rate_php: req.body.requested_rate_php,
        reason: req.body.reason,
      },
      req,
    });

    return res.status(201).json(sanitizeRequestForViewer(created, role === 'administrator'));
  }));

// Admin Option A: Directly approve and immediately apply new rate
r.post('/price-requests/:id/approve-direct', authenticate, requireAdmin,
  validate(z.object({ review_note: z.string().max(300).optional() }).optional()),
  asyncH(async (req, res) => {
    const existing = await getPriceChangeRequestById(req.params.id);
    if (!existing) throw new ApiError(404, 'Price change request not found.');
    if (!['pending', 'code_issued'].includes(existing.status)) {
      throw new ApiError(409, `Request is already ${existing.status}.`);
    }

    const updatedRoom = await applyRoomRateUpdate(existing.room_id, existing.requested_rate_php);
    const now = new Date().toISOString();
    const updated = await updatePriceChangeRequest(existing.id, {
      status: 'approved_applied',
      approval_mode: 'direct',
      authorization_code: null,
      code_expires_at: null,
      reviewed_by_id: req.user.id,
      reviewed_by_name: req.user.full_name || 'Administrator',
      reviewed_by_email: req.user.email || '',
      review_note: req.body?.review_note || 'Approved directly by administrator.',
      reviewed_at: now,
      applied_at: now,
    });

    await insertNotificationSafe({
      profileId: existing.requested_by_id || null,
      title: 'Price Change Approved & Applied',
      body: `Administrator directly approved and applied ₱${Number(existing.requested_rate_php).toLocaleString()} for "${existing.room_name}".`,
      recipient: existing.requested_by_name,
    });

    await logAuditEvent({
      actor: req.user,
      action: 'PRICE_CHANGE_APPROVED_DIRECT',
      resourceType: 'price_request',
      resourceId: existing.id,
      details: {
        room_id: existing.room_id,
        room_name: existing.room_name,
        old_rate_php: existing.current_rate_php,
        new_rate_php: existing.requested_rate_php,
      },
      req,
    });

    return res.json({ request: updated, room: updatedRoom });
  }));

// Admin Option B: Approve by generating and sending a single-use authorization code
r.post('/price-requests/:id/issue-code', authenticate, requireAdmin,
  validate(z.object({ review_note: z.string().max(300).optional() }).optional()),
  asyncH(async (req, res) => {
    const existing = await getPriceChangeRequestById(req.params.id);
    if (!existing) throw new ApiError(404, 'Price change request not found.');
    if (!['pending', 'code_issued'].includes(existing.status)) {
      throw new ApiError(409, `Request is already ${existing.status}.`);
    }

    const code = generatePriceApprovalCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const updated = await updatePriceChangeRequest(existing.id, {
      status: 'code_issued',
      approval_mode: 'code',
      authorization_code: code,
      code_expires_at: expiresAt,
      reviewed_by_id: req.user.id,
      reviewed_by_name: req.user.full_name || 'Administrator',
      reviewed_by_email: req.user.email || '',
      review_note: req.body?.review_note || 'Authorization code issued by administrator.',
      reviewed_at: now,
    });

    await insertNotificationSafe({
      profileId: existing.requested_by_id || null,
      title: 'Price Change Authorization Code',
      body: `Admin approved "${existing.room_name}" rate change to ₱${Number(existing.requested_rate_php).toLocaleString()}. Use authorization code: ${code}`,
      recipient: existing.requested_by_name,
    });

    await dispatchCodeEmail({
      to: existing.requested_by_email,
      requesterName: existing.requested_by_name,
      roomName: existing.room_name,
      currentRate: existing.current_rate_php,
      requestedRate: existing.requested_rate_php,
      code,
    });

    await logAuditEvent({
      actor: req.user,
      action: 'PRICE_CHANGE_CODE_ISSUED',
      resourceType: 'price_request',
      resourceId: existing.id,
      details: {
        room_id: existing.room_id,
        room_name: existing.room_name,
        requested_rate_php: existing.requested_rate_php,
        expires_at: expiresAt,
      },
      req,
    });

    return res.json({ request: updated, authorization_code: code });
  }));

// Employee applies the approved price change using the code sent by Administrator
r.post('/price-requests/:id/apply-with-code', authenticate, requirePriceRequestAccess,
  validate(z.object({
    authorization_code: z.string().trim().min(4, 'Authorization code is required').max(32),
  })),
  asyncH(async (req, res) => {
    const role = normalizeEmployeeRole(req.user?.role);
    const isAdmin = role === 'administrator';
    const existing = await getPriceChangeRequestById(req.params.id);
    if (!existing) throw new ApiError(404, 'Price change request not found.');

    const isRequester =
      (req.user?.id && existing.requested_by_id === req.user.id) ||
      (req.user?.email && existing.requested_by_email && existing.requested_by_email.toLowerCase() === req.user.email.toLowerCase());

    if (!isAdmin && !isRequester) {
      throw new ApiError(403, 'Access denied: Only the requesting employee or administrator may redeem this code.');
    }

    if (existing.status !== 'code_issued' || !existing.authorization_code) {
      throw new ApiError(409, 'This request does not have an active authorization code.');
    }

    if (existing.code_expires_at && new Date(existing.code_expires_at).getTime() < Date.now()) {
      throw new ApiError(410, 'Authorization code has expired. Please request a new code from Administrator.');
    }

    if (!timingSafeCodeMatch(existing.authorization_code, req.body.authorization_code)) {
      await logAuditEvent({
        actor: req.user,
        action: 'PRICE_CHANGE_CODE_INVALID',
        resourceType: 'price_request',
        resourceId: existing.id,
        details: { room_id: existing.room_id },
        req,
      }).catch(() => {});
      throw new ApiError(403, 'Invalid authorization code.');
    }

    const updatedRoom = await applyRoomRateUpdate(existing.room_id, existing.requested_rate_php);
    const now = new Date().toISOString();
    const updated = await updatePriceChangeRequest(existing.id, {
      status: 'approved_applied',
      authorization_code: null,
      applied_at: now,
    });

    await insertNotificationSafe({
      title: 'Approved Price Change Applied',
      body: `${req.user.full_name || 'Employee'} applied approved rate ₱${Number(existing.requested_rate_php).toLocaleString()} to "${existing.room_name}" using admin code.`,
      recipient: 'Administrator',
    });

    await logAuditEvent({
      actor: req.user,
      action: 'PRICE_CHANGE_APPLIED_WITH_CODE',
      resourceType: 'price_request',
      resourceId: existing.id,
      details: {
        room_id: existing.room_id,
        room_name: existing.room_name,
        old_rate_php: existing.current_rate_php,
        new_rate_php: existing.requested_rate_php,
      },
      req,
    });

    return res.json({
      request: sanitizeRequestForViewer(updated, isAdmin),
      room: updatedRoom,
    });
  }));

// Admin rejects a price change request
r.post('/price-requests/:id/reject', authenticate, requireAdmin,
  validate(z.object({ review_note: z.string().max(300).optional() }).optional()),
  asyncH(async (req, res) => {
    const existing = await getPriceChangeRequestById(req.params.id);
    if (!existing) throw new ApiError(404, 'Price change request not found.');
    if (!['pending', 'code_issued'].includes(existing.status)) {
      throw new ApiError(409, `Request is already ${existing.status}.`);
    }

    const now = new Date().toISOString();
    const updated = await updatePriceChangeRequest(existing.id, {
      status: 'rejected',
      authorization_code: null,
      code_expires_at: null,
      reviewed_by_id: req.user.id,
      reviewed_by_name: req.user.full_name || 'Administrator',
      reviewed_by_email: req.user.email || '',
      review_note: req.body?.review_note || 'Declined by administrator.',
      reviewed_at: now,
    });

    await insertNotificationSafe({
      profileId: existing.requested_by_id || null,
      title: 'Price Change Request Declined',
      body: `Administrator declined rate change for "${existing.room_name}".${req.body?.review_note ? ` Note: ${req.body.review_note}` : ''}`,
      recipient: existing.requested_by_name,
    });

    await logAuditEvent({
      actor: req.user,
      action: 'PRICE_CHANGE_REJECTED',
      resourceType: 'price_request',
      resourceId: existing.id,
      details: {
        room_id: existing.room_id,
        room_name: existing.room_name,
        review_note: req.body?.review_note || '',
      },
      req,
    });

    return res.json({ request: updated });
  }));

export default r;
