import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getSystemAdminClient, admin } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbDir = path.resolve(__dirname, '../db');
const requestsFile = path.join(dbDir, 'price_change_requests.json');

if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch (err) {
    console.warn('[PriceRequestStore] Could not create db directory:', err.message);
  }
}

function readLocalRequests() {
  try {
    if (!fs.existsSync(requestsFile)) return [];
    const parsed = JSON.parse(fs.readFileSync(requestsFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[PriceRequestStore] Failed reading local price requests:', err.message);
    return [];
  }
}

function writeLocalRequests(list) {
  try {
    fs.writeFileSync(requestsFile, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.warn('[PriceRequestStore] Failed writing local price requests:', err.message);
  }
}

export async function listPriceChangeRequests() {
  const localList = readLocalRequests();
  try {
    const client = (await getSystemAdminClient().catch(() => null)) || admin;
    const { data, error } = await client
      .from('price_change_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && Array.isArray(data)) {
      const merged = new Map();
      for (const item of [...localList, ...data]) {
        if (item?.id) merged.set(item.id, item);
      }
      return Array.from(merged.values()).sort((a, b) =>
        String(b.created_at || '').localeCompare(String(a.created_at || ''))
      );
    }
  } catch {
    // Table may not exist yet in Supabase; local store keeps workflow operational.
  }
  return localList.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

export async function getPriceChangeRequestById(id) {
  const all = await listPriceChangeRequests();
  return all.find((r) => r.id === id) || null;
}

export async function createPriceChangeRequest(payload) {
  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    status: 'pending',
    approval_mode: null,
    authorization_code: null,
    code_expires_at: null,
    reviewed_by_id: null,
    reviewed_by_name: null,
    reviewed_by_email: null,
    review_note: '',
    reviewed_at: null,
    applied_at: null,
    created_at: now,
    updated_at: now,
    ...payload,
  };

  const localList = readLocalRequests();
  localList.unshift(record);
  writeLocalRequests(localList);

  try {
    const client = (await getSystemAdminClient().catch(() => null)) || admin;
    const { data, error } = await client.from('price_change_requests').insert(record).select().single();
    if (!error && data) return data;
  } catch {
    // Fallback already persisted locally
  }
  return record;
}

export async function updatePriceChangeRequest(id, updates) {
  const now = new Date().toISOString();
  const localList = readLocalRequests();
  const idx = localList.findIndex((r) => r.id === id);
  let updatedRecord = null;
  if (idx >= 0) {
    updatedRecord = { ...localList[idx], ...updates, updated_at: now };
    localList[idx] = updatedRecord;
    writeLocalRequests(localList);
  }

  try {
    const client = (await getSystemAdminClient().catch(() => null)) || admin;
    const { data, error } = await client
      .from('price_change_requests')
      .update({ ...updates, updated_at: now })
      .eq('id', id)
      .select()
      .single();
    if (!error && data) {
      if (idx < 0) {
        localList.unshift(data);
        writeLocalRequests(localList);
      }
      return data;
    }
  } catch {
    // Fallback already persisted locally
  }
  return updatedRecord;
}

export function generatePriceApprovalCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return `RV-${code}`;
}
