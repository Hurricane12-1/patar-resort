import { Router } from 'express';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { admin, getSystemAdminClient } from '../lib/supabase.js';
import { logAuditEvent } from '../lib/auditLogger.js';

const r = Router();

const SETTINGS_KEY = 'page_media';
const MAX_URL_LEN = 1024;

// Allowlist of editable image slots. Unknown keys are ignored so the admin
// panel can never inflate the row with arbitrary data.
const ALLOWED_SLOTS = new Set([
  'heroImageUrl',
]);

// Only HTTPS references from trusted hosts, or safe app-relative paths, may be
// stored. This blocks javascript:/data: URIs and arbitrary third-party hosts,
// so an admin UI value can never become a stored-XSS or data-exfiltration vector.
const TRUSTED_HOSTS = [
  'res.cloudinary.com',
  'cloudinary.com',
  'patar-resort.pages.dev',
  'patar-resort.onrender.com',
];

function sanitizeImageUrl(value) {
  if (value === null || value === undefined) return '';     // clear slot
  if (typeof value !== 'string') return null;               // invalid type
  const v = value.trim();
  if (!v) return '';                                        // clear slot
  if (v.length > MAX_URL_LEN) return null;

  // App-relative uploads / bundled images.
  if (v.startsWith('/uploads/') || v.startsWith('/images/')) {
    if (v.includes('..') || v.includes('\\')) return null;
    return v;
  }

  // Absolute URLs: HTTPS + trusted host only.
  let u;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  const trusted = TRUSTED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  if (!trusted) return null;
  return u.toString();
}

async function readSettings() {
  try {
    const db = await getSystemAdminClient().catch(() => admin);
    const { data, error } = await db
      .from('site_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();
    if (error) return {};
    return data && data.value && typeof data.value === 'object' ? data.value : {};
  } catch {
    return {};
  }
}

function pickAllowed(settings) {
  const out = {};
  for (const k of ALLOWED_SLOTS) {
    if (settings[k]) out[k] = settings[k];
  }
  return out;
}

// GET /api/page-settings — PUBLIC. Returns only the curated, allowlisted
// image config (no secrets, no other rows).
r.get('/page-settings', asyncH(async (_req, res) => {
  const settings = await readSettings();
  res.json({ settings: pickAllowed(settings) });
}));

// PUT /api/page-settings — ADMINISTRATOR ONLY. Validates every value, merges,
// and persists through the service-role client.
r.put('/page-settings', authenticate, requireAdmin, asyncH(async (req, res) => {
  const incoming = req.body?.settings;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    throw new ApiError(400, 'A "settings" object is required.');
  }

  const current = await readSettings();
  const next = { ...current };
  const applied = {};

  for (const [key, rawVal] of Object.entries(incoming)) {
    if (!ALLOWED_SLOTS.has(key)) continue;
    const clean = sanitizeImageUrl(rawVal);
    if (clean === null) {
      throw new ApiError(
        400,
        `Invalid image URL for "${key}". Only HTTPS Cloudinary/resort URLs or /uploads and /images paths are allowed.`
      );
    }
    if (clean === '') {
      delete next[key];
      applied[key] = '';
    } else {
      next[key] = clean;
      applied[key] = clean;
    }
  }

  const db = await getSystemAdminClient().catch(() => admin);
  const { error } = await db.from('site_settings').upsert(
    {
      key: SETTINGS_KEY,
      value: next,
      updated_by: req.user?.id || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );

  if (error) {
    throw new ApiError(
      500,
      `Could not save page settings: ${error.message}. Ensure the site_settings table exists (run server/supabase/page_settings.sql).`
    );
  }

  logAuditEvent({
    actor: req.user,
    action: 'PAGE_SETTINGS_UPDATE',
    resourceType: 'site_settings',
    resourceId: SETTINGS_KEY,
    details: { applied },
    req,
  }).catch(() => {});

  res.json({ success: true, settings: pickAllowed(next) });
}));

export const version = '1.0.0';
export const description = 'Admin-managed public page media (Page Adjustment)';
export default r;
