import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { admin, getSystemAdminClient } from '../lib/supabase.js';
import { logAuditEvent } from '../lib/auditLogger.js';

const r = Router();

const SETTINGS_KEY = 'page_media';
const MAX_URL_LEN = 2048;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbDir = path.resolve(__dirname, '../db');
const settingsFile = path.join(dbDir, 'site_settings.json');

// Ensure db directory exists
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch {}
}

function readLocalSettings() {
  try {
    if (fs.existsSync(settingsFile)) {
      const raw = fs.readFileSync(settingsFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[PageSettings] Failed to read local site_settings.json:', err.message);
  }
  return {};
}

function writeLocalSettings(data) {
  try {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    fs.writeFileSync(settingsFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('[PageSettings] Failed to write local site_settings.json:', err.message);
  }
}

// Allowlist of editable slots for landing page media, hero titles, and guest/user dashboard layout.
const ALLOWED_SLOTS = new Set([
  'heroImageUrl',
  'heroHeadline',
  'heroSubtitle',
  'heroKicker',
  'dashboardGreeting',
  'dashboardSubtitle',
  'dashboardAnnouncement',
  'dashboardBadge',
  'dashboardShowQuickBooking',
  'dashboardThemeAccent',
]);

const IMAGE_SLOTS = new Set(['heroImageUrl']);

function sanitizeImageUrl(value) {
  if (value === null || value === undefined) return '';     // clear slot
  if (typeof value !== 'string') return null;               // invalid type
  const v = value.trim();
  if (!v) return '';                                        // clear slot
  if (v.length > MAX_URL_LEN) return null;

  // App-relative uploads / bundled images
  if (v.startsWith('/uploads/') || v.startsWith('/images/')) {
    if (v.includes('..') || v.includes('\\')) return null;
    return v;
  }

  // Base64 data image URL fallback
  if (v.startsWith('data:image/') && v.includes(';base64,')) {
    return v;
  }

  // Absolute URLs: HTTP/HTTPS allowed (supports Cloudinary, Supabase, Unsplash, Google, CDNs)
  let u;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  return u.toString();
}

function sanitizeText(value, maxLen = 600) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') return String(value || '').slice(0, maxLen);
  const v = value.trim().slice(0, maxLen);
  // strip potential script tags
  return v.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
}

async function readSettings() {
  const local = readLocalSettings();
  try {
    const db = await getSystemAdminClient().catch(() => admin);
    const { data, error } = await db
      .from('site_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();
    if (!error && data && data.value && typeof data.value === 'object') {
      return { ...local, ...data.value };
    }
  } catch {
    // fallback to local file
  }
  return local;
}

function pickAllowed(settings) {
  const out = {};
  for (const k of ALLOWED_SLOTS) {
    if (settings && settings[k] !== undefined) {
      out[k] = settings[k];
    }
  }
  return out;
}

// GET /api/page-settings — PUBLIC. Returns only the curated, allowlisted
// image & layout config (no secrets, no other rows).
r.get('/page-settings', asyncH(async (_req, res) => {
  const settings = await readSettings();
  res.json({ settings: pickAllowed(settings) });
}));

// PUT /api/page-settings — ADMINISTRATOR ONLY. Validates every value, merges,
// persists locally first and mirrors to Supabase when available.
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

    if (IMAGE_SLOTS.has(key)) {
      const cleanImg = sanitizeImageUrl(rawVal);
      if (cleanImg === null) {
        throw new ApiError(
          400,
          `Invalid image URL for "${key}". Supported: HTTPS/HTTP image URLs, /uploads, /images, or base64 data URLs.`
        );
      }
      if (cleanImg === '') {
        delete next[key];
        applied[key] = '';
      } else {
        next[key] = cleanImg;
        applied[key] = cleanImg;
      }
    } else if (key === 'dashboardShowQuickBooking') {
      next[key] = Boolean(rawVal);
      applied[key] = next[key];
    } else {
      const cleanText = sanitizeText(rawVal);
      if (cleanText === '') {
        delete next[key];
        applied[key] = '';
      } else {
        next[key] = cleanText;
        applied[key] = cleanText;
      }
    }
  }

  // 1. Resilient local persistence (guarantees update is saved immediately)
  writeLocalSettings(next);

  // 2. Mirror to Supabase if site_settings table exists
  try {
    const db = await getSystemAdminClient().catch(() => admin);
    await db.from('site_settings').upsert(
      {
        key: SETTINGS_KEY,
        value: next,
        updated_by: req.user?.id || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
  } catch (dbErr) {
    console.warn('[PageSettings] Mirroring to Supabase skipped (persisted locally):', dbErr?.message);
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

export const version = '1.1.0';
export const description = 'Admin-managed public page media and dashboard layout customization';
export default r;
