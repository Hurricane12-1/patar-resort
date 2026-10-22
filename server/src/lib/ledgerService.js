import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { admin, getSystemAdminClient } from './supabase.js';
import { logAuditEvent } from './auditLogger.js';
import { parseFinancialEquation, resolveRoomSlug } from '../agents/ledgerIngestionAgent.js';
import { getLocalReservations } from './reservationStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbDir = path.resolve(__dirname, '../db');
const ledgerFile = path.join(dbDir, 'ledger_entries.json');

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch {}
}

/**
 * -------------------------------------------------------------------------------------
 * CHART OF ACCOUNTS · ROCK VIEW BEACH RESORT
 * Standard double-entry chart with normal balance designations:
 * - Assets & Expenses: Normal Balance = DEBIT (Increase via Debit, Decrease via Credit)
 * - Liabilities, Revenue & Equity: Normal Balance = CREDIT (Increase via Credit, Decrease via Debit)
 * -------------------------------------------------------------------------------------
 */
export const CHART_OF_ACCOUNTS = [
  { code: '1010', name: 'Cash on Hand & Digital Wallets', type: 'ASSET', normal: 'DEBIT', description: 'Cash register, GCash, Maya, and bank accounts' },
  { code: '1020', name: 'Accounts Receivable - Guest Folios', type: 'ASSET', normal: 'DEBIT', description: 'Pending stay balances and uncollected guest folios' },
  { code: '2010', name: 'Guest Reservation Deposits & Advances', type: 'LIABILITY', normal: 'CREDIT', description: 'Downpayments and advance deposits held for future stays' },
  { code: '2020', name: 'Guest Refunds Payable', type: 'LIABILITY', normal: 'CREDIT', description: 'Approved cancellation refunds awaiting disbursement' },
  { code: '4010', name: 'Room Accommodations Revenue', type: 'REVENUE', normal: 'CREDIT', description: 'Recognized accommodation revenue from villas, suites, cottages' },
  { code: '4020', name: 'Kitchen & Dining Revenue', type: 'REVENUE', normal: 'CREDIT', description: 'Food and beverage orders and restaurant sales' },
  { code: '4030', name: 'Island Tours & Water Activities Revenue', type: 'REVENUE', normal: 'CREDIT', description: 'Island hopping, boat tours, and watersport rentals' },
  { code: '5010', name: 'Kitchen & Food Supplies Expenses', type: 'EXPENSE', normal: 'DEBIT', description: 'Procurement of restaurant ingredients, groceries, and provisions' },
  { code: '5020', name: 'Housekeeping Linens & Guest Amenities', type: 'EXPENSE', normal: 'DEBIT', description: 'Towels, beddings, toiletries, and cleaning consumables' },
  { code: '5030', name: 'Resort Utilities & Generator Fuel', type: 'EXPENSE', normal: 'DEBIT', description: 'Electricity bills, generator diesel fuel, and water delivery' },
  { code: '5040', name: 'Repairs & Property Maintenance', type: 'EXPENSE', normal: 'DEBIT', description: 'Hardware, facility servicing, plumbing, and structural upkeep' },
];

export const ACCOUNT_MAP = new Map(CHART_OF_ACCOUNTS.map((a) => [a.code, a]));

/**
 * In-memory ledger buffer with persistent file backing
 */
let inMemoryEntries = [];

/**
 * Load entries from local ledger_entries.json
 */
function loadPersistedEntries() {
  try {
    if (fs.existsSync(ledgerFile)) {
      const raw = fs.readFileSync(ledgerFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        inMemoryEntries = parsed;
        return;
      }
    }
  } catch (err) {
    console.warn('[LedgerService] Failed to load local ledger file:', err.message);
  }

  // Start with clean empty entries - lively populated from actual reservations
  inMemoryEntries = [];
}

/**
 * Save in-memory ledger to local JSON file
 */
function savePersistedEntries() {
  try {
    fs.writeFileSync(ledgerFile, JSON.stringify(inMemoryEntries, null, 2), 'utf8');
  } catch (err) {
    console.warn('[LedgerService] Failed to save local ledger file:', err.message);
  }
}

/**
 * Generate sequential entry number (e.g. LED-2026-0001)
 */
function generateEntryNumber(index = 0) {
  const currentYear = new Date().getFullYear();
  const seq = String((inMemoryEntries.length + index + 1)).padStart(4, '0');
  return `LED-${currentYear}-${seq}`;
}

/**
 * Compute running balances across all entries in chronological order
 */
export function recalculateRunningBalances(entries) {
  let running = 0;
  return entries.map((entry) => {
    const debit = Number(entry.debit_php) || 0;
    const credit = Number(entry.credit_php) || 0;
    // Net cash/asset flow: Debits add, Credits subtract
    running += (debit - credit);
    return {
      ...entry,
      debit_php: debit,
      credit_php: credit,
      running_balance_php: running,
    };
  });
}

/**
 * Seed realistic baseline entries for Rock View Beach Resort
 */
function seedBaselineEntries() {
  const baseTime = new Date('2026-10-01T08:00:00Z').getTime();
  const rawSeed = [
    // 1. Initial Cash Capital & Floats
    {
      id: 'f1000000-0000-4000-8000-000000000001',
      entry_number: 'LED-2026-0001',
      posted_at: new Date(baseTime).toISOString(),
      account_code: '1010',
      account_name: 'Cash on Hand & Digital Wallets',
      account_type: 'ASSET',
      entry_type: 'DEBIT',
      debit_php: 150000,
      credit_php: 0,
      category: 'ADJUSTMENT',
      particulars: 'Opening Operating Cash Float & Vault Reserves - October Season',
      reference_id: 'REF-CAP-2026-10',
      status: 'RECONCILED',
      created_by: 'admin@rockviewresort.ph',
    },
    // 2. Unit TEV Grand Villa Reservation Deposit
    {
      id: 'f1000000-0000-4000-8000-000000000002',
      entry_number: 'LED-2026-0002',
      posted_at: new Date(baseTime + 3600000 * 2).toISOString(),
      account_code: '1010',
      account_name: 'Cash on Hand & Digital Wallets',
      account_type: 'ASSET',
      entry_type: 'DEBIT',
      debit_php: 5000,
      credit_php: 0,
      category: 'PAYMENT',
      particulars: 'GCash Advance Deposit for Unit TEV Grand Villa - Guest: Juan Dela Cruz',
      reference_id: 'RES-TEV-1001',
      status: 'POSTED',
      created_by: 'frontdesk@rockviewresort.ph',
    },
    {
      id: 'f1000000-0000-4000-8000-000000000003',
      entry_number: 'LED-2026-0003',
      posted_at: new Date(baseTime + 3600000 * 2).toISOString(),
      account_code: '2010',
      account_name: 'Guest Reservation Deposits & Advances',
      account_type: 'LIABILITY',
      entry_type: 'CREDIT',
      debit_php: 0,
      credit_php: 5000,
      category: 'PAYMENT',
      particulars: 'Unearned Advance Reservation Liability - Guest: Juan Dela Cruz (Unit TEV)',
      reference_id: 'RES-TEV-1001',
      status: 'POSTED',
      created_by: 'frontdesk@rockviewresort.ph',
    },
    // 3. Generator Diesel Fuel Expense
    {
      id: 'f1000000-0000-4000-8000-000000000004',
      entry_number: 'LED-2026-0004',
      posted_at: new Date(baseTime + 3600000 * 6).toISOString(),
      account_code: '5030',
      account_name: 'Resort Utilities & Generator Fuel',
      account_type: 'EXPENSE',
      entry_type: 'DEBIT',
      debit_php: 6500,
      credit_php: 0,
      category: 'EXPENSE',
      particulars: 'Purchase of 100L Diesel for Resort Backup Generator (Petron Bolinao)',
      reference_id: 'EXP-FUEL-081',
      status: 'POSTED',
      created_by: 'staff@rockviewresort.ph',
    },
    {
      id: 'f1000000-0000-4000-8000-000000000005',
      entry_number: 'LED-2026-0005',
      posted_at: new Date(baseTime + 3600000 * 6).toISOString(),
      account_code: '1010',
      account_name: 'Cash on Hand & Digital Wallets',
      account_type: 'ASSET',
      entry_type: 'CREDIT',
      debit_php: 0,
      credit_php: 6500,
      category: 'EXPENSE',
      particulars: 'Cash Disbursement for Generator Diesel Fuel',
      reference_id: 'EXP-FUEL-081',
      status: 'POSTED',
      created_by: 'staff@rockviewresort.ph',
    },
    // 4. Kitchen & Dining Breakfast Buffet Sales
    {
      id: 'f1000000-0000-4000-8000-000000000006',
      entry_number: 'LED-2026-0006',
      posted_at: new Date(baseTime + 3600000 * 24).toISOString(),
      account_code: '1010',
      account_name: 'Cash on Hand & Digital Wallets',
      account_type: 'ASSET',
      entry_type: 'DEBIT',
      debit_php: 14200,
      credit_php: 0,
      category: 'REVENUE',
      particulars: 'Daily Breakfast & Seaside Dining Receipts (Oct 2 Morning Service)',
      reference_id: 'ORD-DINE-20261002',
      status: 'POSTED',
      created_by: 'kitchen@rockviewresort.ph',
    },
    {
      id: 'f1000000-0000-4000-8000-000000000007',
      entry_number: 'LED-2026-0007',
      posted_at: new Date(baseTime + 3600000 * 24).toISOString(),
      account_code: '4020',
      account_name: 'Kitchen & Dining Revenue',
      account_type: 'REVENUE',
      entry_type: 'CREDIT',
      debit_php: 0,
      credit_php: 14200,
      category: 'REVENUE',
      particulars: 'Kitchen Food & Beverage Sales Realized',
      reference_id: 'ORD-DINE-20261002',
      status: 'POSTED',
      created_by: 'kitchen@rockviewresort.ph',
    },
    // 5. Unit GEL Stay Realization & Balance Settlement
    {
      id: 'f1000000-0000-4000-8000-000000000008',
      entry_number: 'LED-2026-0008',
      posted_at: new Date(baseTime + 3600000 * 28).toISOString(),
      account_code: '1010',
      account_name: 'Cash on Hand & Digital Wallets',
      account_type: 'ASSET',
      entry_type: 'DEBIT',
      debit_php: 12000,
      credit_php: 0,
      category: 'REVENUE',
      particulars: 'Cash Payment at Check-In for Unit GEL Premier Suite - Guest: Maria Santos',
      reference_id: 'RES-GEL-2004',
      status: 'POSTED',
      created_by: 'frontdesk@rockviewresort.ph',
    },
    {
      id: 'f1000000-0000-4000-8000-000000000009',
      entry_number: 'LED-2026-0009',
      posted_at: new Date(baseTime + 3600000 * 28).toISOString(),
      account_code: '4010',
      account_name: 'Room Accommodations Revenue',
      account_type: 'REVENUE',
      entry_type: 'CREDIT',
      debit_php: 0,
      credit_php: 12000,
      category: 'REVENUE',
      particulars: 'Earned Room Accommodation Revenue - Unit GEL Premier Suite',
      reference_id: 'RES-GEL-2004',
      status: 'POSTED',
      created_by: 'frontdesk@rockviewresort.ph',
    },
  ];

  inMemoryEntries = recalculateRunningBalances(rawSeed);
  savePersistedEntries();
}

// Initial load
loadPersistedEntries();

/**
 * -------------------------------------------------------------------------------------
 * QUERY LEDGER ENTRIES
 * -------------------------------------------------------------------------------------
 */
export async function getLedgerEntries(params = {}) {
  const {
    account_code = '',
    category = '',
    entry_type = '',
    search = '',
    limit = 500,
    offset = 0,
    sort = 'desc',
  } = params;

  // Try sync/query from Supabase if table exists
  try {
    const sb = getSystemAdminClient() || admin;
    if (sb) {
      let q = sb.from('ledger_entries').select('*');
      if (account_code) q = q.eq('account_code', account_code);
      if (category) q = q.eq('category', category.toUpperCase());
      if (entry_type) q = q.eq('entry_type', entry_type.toUpperCase());
      if (search) {
        q = q.or(`particulars.ilike.%${search}%,entry_number.ilike.%${search}%,reference_id.ilike.%${search}%,account_name.ilike.%${search}%`);
      }
      q = q.order('posted_at', { ascending: sort === 'asc' }).range(offset, offset + limit - 1);
      const { data, error } = await q;
      if (!error && Array.isArray(data) && data.length > 0) {
        // Return Supabase data with calculated running balances
        return recalculateRunningBalances(data);
      }
    }
  } catch {}

  // Fallback to local in-memory/file entries
  let filtered = [...inMemoryEntries];

  if (account_code) {
    filtered = filtered.filter((e) => e.account_code === account_code);
  }
  if (category) {
    filtered = filtered.filter((e) => String(e.category).toUpperCase() === category.toUpperCase());
  }
  if (entry_type) {
    filtered = filtered.filter((e) => String(e.entry_type).toUpperCase() === entry_type.toUpperCase());
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.particulars?.toLowerCase().includes(s) ||
        e.entry_number?.toLowerCase().includes(s) ||
        e.account_name?.toLowerCase().includes(s) ||
        e.account_code?.includes(s) ||
        e.reference_id?.toLowerCase().includes(s)
    );
  }

  // Sort
  filtered.sort((a, b) => {
    const timeA = new Date(a.posted_at).getTime();
    const timeB = new Date(b.posted_at).getTime();
    return sort === 'asc' ? timeA - timeB : timeB - timeA;
  });

  const sliced = filtered.slice(offset, offset + limit);
  return recalculateRunningBalances(sliced);
}

/**
 * -------------------------------------------------------------------------------------
 * POST A SINGLE OR BALANCED JOURNAL ENTRY
 * -------------------------------------------------------------------------------------
 */
export async function createLedgerEntry(entry, user = {}) {
  const account = ACCOUNT_MAP.get(entry.account_code) || {
    name: entry.account_name || 'General Accounts',
    type: entry.account_type || 'ASSET',
  };

  const debit = Math.max(0, Number(entry.debit_php) || 0);
  const credit = Math.max(0, Number(entry.credit_php) || 0);

  if (debit === 0 && credit === 0) {
    throw new Error('Either debit_php or credit_php must be greater than zero.');
  }
  if (debit > 0 && credit > 0) {
    throw new Error('A single entry cannot have both debit and credit. Create a compound journal pair instead.');
  }

  const entryType = debit > 0 ? 'DEBIT' : 'CREDIT';
  const now = entry.posted_at ? new Date(entry.posted_at).toISOString() : new Date().toISOString();
  const entryId = entry.id || crypto.randomUUID();
  const entryNumber = entry.entry_number || generateEntryNumber();

  const record = {
    id: entryId,
    entry_number: entryNumber,
    posted_at: now,
    account_code: entry.account_code || '1010',
    account_name: account.name,
    account_type: account.type,
    entry_type: entryType,
    debit_php: debit,
    credit_php: credit,
    running_balance_php: 0,
    category: (entry.category || 'ADJUSTMENT').toUpperCase(),
    particulars: entry.particulars || entry.description || 'Journal transaction',
    reference_id: entry.reference_id || `REF-${Date.now()}`,
    status: entry.status || 'POSTED',
    created_by: user.email || user.username || 'admin@rockviewresort.ph',
    created_at: now,
  };

  inMemoryEntries.push(record);
  inMemoryEntries = recalculateRunningBalances(inMemoryEntries);
  savePersistedEntries();

  // Dual write to Supabase if connected
  try {
    const sb = getSystemAdminClient() || admin;
    if (sb) {
      await sb.from('ledger_entries').insert([record]);
    }
  } catch {}

  // Audit Log
  try {
    await logAuditEvent({
      actor: user,
      action: 'LEDGER_ENTRY_CREATED',
      resourceType: 'ledger_entry',
      resourceId: record.entry_number,
      details: {
        account_code: record.account_code,
        entry_type: record.entry_type,
        amount: debit || credit,
        particulars: record.particulars,
      },
    });
  } catch {}

  return record;
}

/**
 * Post a balanced double-entry transaction pair (Debit and Credit)
 */
export async function createJournalPair(pairPayload, user = {}) {
  const {
    debit_account_code,
    credit_account_code,
    amount_php,
    particulars,
    reference_id,
    category = 'ADJUSTMENT',
    posted_at = new Date().toISOString(),
  } = pairPayload;

  const amt = Number(amount_php) || 0;
  if (amt <= 0) {
    throw new Error('Transaction amount must be greater than zero.');
  }

  const debitAcc = ACCOUNT_MAP.get(debit_account_code);
  const creditAcc = ACCOUNT_MAP.get(credit_account_code);

  if (!debitAcc || !creditAcc) {
    throw new Error(`Invalid account codes specified. Debit: ${debit_account_code}, Credit: ${credit_account_code}`);
  }

  const ref = reference_id || `TRX-${Date.now()}`;
  const debitRecord = await createLedgerEntry({
    account_code: debitAcc.code,
    account_name: debitAcc.name,
    account_type: debitAcc.type,
    debit_php: amt,
    credit_php: 0,
    category,
    particulars: `${particulars} [DEBIT]`,
    reference_id: ref,
    posted_at,
  }, user);

  const creditRecord = await createLedgerEntry({
    account_code: creditAcc.code,
    account_name: creditAcc.name,
    account_type: creditAcc.type,
    debit_php: 0,
    credit_php: amt,
    category,
    particulars: `${particulars} [CREDIT]`,
    reference_id: ref,
    posted_at,
  }, user);

  return {
    success: true,
    reference_id: ref,
    debit: debitRecord,
    credit: creditRecord,
  };
}

/**
 * -------------------------------------------------------------------------------------
 * TRIAL BALANCE CALCULATOR
 * Verifies that Total Debits == Total Credits across the entire General Ledger
 * -------------------------------------------------------------------------------------
 */
export function calculateTrialBalance(entries = inMemoryEntries) {
  let totalDebits = 0;
  let totalCredits = 0;

  const accountBreakdown = {};
  for (const acc of CHART_OF_ACCOUNTS) {
    accountBreakdown[acc.code] = {
      code: acc.code,
      name: acc.name,
      type: acc.type,
      normal: acc.normal,
      total_debit: 0,
      total_credit: 0,
      net_balance: 0,
    };
  }

  for (const entry of entries) {
    const d = Number(entry.debit_php) || 0;
    const c = Number(entry.credit_php) || 0;
    totalDebits += d;
    totalCredits += c;

    const code = entry.account_code || '1010';
    if (!accountBreakdown[code]) {
      accountBreakdown[code] = {
        code,
        name: entry.account_name || 'Other Account',
        type: entry.account_type || 'ASSET',
        normal: 'DEBIT',
        total_debit: 0,
        total_credit: 0,
        net_balance: 0,
      };
    }
    accountBreakdown[code].total_debit += d;
    accountBreakdown[code].total_credit += c;
  }

  // Calculate net balances based on normal balance designations
  for (const code of Object.keys(accountBreakdown)) {
    const item = accountBreakdown[code];
    if (item.normal === 'DEBIT') {
      item.net_balance = item.total_debit - item.total_credit;
    } else {
      item.net_balance = item.total_credit - item.total_debit;
    }
  }

  const difference = Math.abs(totalDebits - totalCredits);
  const isBalanced = difference === 0;

  return {
    total_debits_php: totalDebits,
    total_credits_php: totalCredits,
    net_difference_php: difference,
    is_balanced: isBalanced,
    status: isBalanced ? 'BALANCED' : 'IMBALANCE_DETECTED',
    accounts: Object.values(accountBreakdown),
    entry_count: entries.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * -------------------------------------------------------------------------------------
 * AUTO-RECONCILIATION WITH RESERVATIONS AND ORDERS
 * Syncs any unposted room stays or guest food orders into balanced double entries
 * -------------------------------------------------------------------------------------
 */
export async function reconcileSystemTransactions(user = {}) {
  let newEntriesCount = 0;
  const existingRefs = new Set(inMemoryEntries.map((e) => e.reference_id).filter(Boolean));

  // 1. Fetch Reservations from Supabase and resilient local store
  try {
    let reservations = [];
    const sb = getSystemAdminClient() || admin;
    if (sb) {
      const { data } = await sb
        .from('reservations')
        .select('*, rooms(name, slug, rate_php), profiles(full_name, email)')
        .limit(100);
      if (Array.isArray(data)) reservations = [...data];
    }

    try {
      const localRes = getLocalReservations();
      if (Array.isArray(localRes)) {
        for (const lr of localRes) {
          if (!reservations.some((r) => r.id === lr.id)) {
            reservations.push(lr);
          }
        }
      }
    } catch {}

    if (Array.isArray(reservations)) {
      for (const res of reservations) {
        const refId = `RES-${String(res.id || '').slice(0, 8)}`;
        if (existingRefs.has(refId)) continue;

          const total = Number(res.total_php) || 0;
          const deposit = Number(res.downpayment_php) || 0;
          const guestName = res.guest_name || res.profiles?.full_name || 'Guest';
          const roomName = res.rooms?.name || 'Room Stay';

          if (total > 0) {
            // Check-in or confirmed stay
            if (res.status === 'checked_in' || res.status === 'checked_out' || res.status === 'confirmed') {
              // Recognized Revenue Entry: Debit Cash 1010, Credit Revenue 4010
              await createJournalPair({
                debit_account_code: '1010',
                credit_account_code: '4010',
                amount_php: total,
                particulars: `Accommodation Stays Settlement: ${roomName} (${guestName})`,
                reference_id: refId,
                category: 'REVENUE',
                posted_at: res.created_at || new Date().toISOString(),
              }, user);
              existingRefs.add(refId);
              newEntriesCount += 2;
            } else if (deposit > 0) {
              // Pending/Unconfirmed booking with downpayment: Debit Cash 1010, Credit Deposit Liability 2010
              await createJournalPair({
                debit_account_code: '1010',
                credit_account_code: '2010',
                amount_php: deposit,
                particulars: `Advance Booking Deposit: ${roomName} (${guestName})`,
                reference_id: refId,
                category: 'PAYMENT',
                posted_at: res.created_at || new Date().toISOString(),
              }, user);
              existingRefs.add(refId);
              newEntriesCount += 2;
            }
          }
        }
      }
  } catch (err) {
    console.warn('[LedgerService] Reservation reconciliation notice:', err.message);
  }

  return {
    success: true,
    new_entries_posted: newEntriesCount,
    total_entries: inMemoryEntries.length,
    trial_balance: calculateTrialBalance(),
  };
}

/**
 * -------------------------------------------------------------------------------------
 * POSTGRESQL BACKUP & EXPORT ENGINE
 * Generates valid PostgreSQL 15+ dump (.sql), JSON (.json), and CSV (.csv)
 * -------------------------------------------------------------------------------------
 */
export function exportPostgresSQL(entries = inMemoryEntries) {
  const exportTime = new Date().toISOString();
  const safeEntries = recalculateRunningBalances(entries);

  let sql = `-- ==============================================================================
-- Rock View Beach Resort · Automated PostgreSQL Ledger Backup Dump
-- Schema: public.ledger_entries (Double-Entry Debit & Credit Architecture)
-- Target: PostgreSQL 15+ / Supabase Cloud Engine
-- Export Timestamp: ${exportTime}
-- Total Records: ${safeEntries.length}
-- ==============================================================================

BEGIN;

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Ledger Entries Table (Idempotent DDL)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_number VARCHAR(64) UNIQUE NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  account_code VARCHAR(16) NOT NULL,
  account_name VARCHAR(128) NOT NULL,
  account_type VARCHAR(32) NOT NULL DEFAULT 'ASSET',
  entry_type VARCHAR(16) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
  debit_php NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (debit_php >= 0),
  credit_php NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (credit_php >= 0),
  running_balance_php NUMERIC(14, 2) NOT NULL DEFAULT 0,
  category VARCHAR(32) NOT NULL DEFAULT 'ADJUSTMENT',
  particulars TEXT NOT NULL DEFAULT '',
  reference_id VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'POSTED',
  created_by VARCHAR(128) DEFAULT 'system@rockviewresort.ph',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. High Performance Indexes
CREATE INDEX IF NOT EXISTS idx_ledger_entries_posted_at ON public.ledger_entries (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_code ON public.ledger_entries (account_code);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_entry_type ON public.ledger_entries (entry_type);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_category ON public.ledger_entries (category);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_reference_id ON public.ledger_entries (reference_id);

-- 4. Transactional Data Restoration
`;

  if (safeEntries.length > 0) {
    sql += `INSERT INTO public.ledger_entries (
  id, entry_number, posted_at, account_code, account_name, account_type,
  entry_type, debit_php, credit_php, running_balance_php, category,
  particulars, reference_id, status, created_by, created_at
) VALUES\n`;

    const rowStrings = safeEntries.map((e) => {
      const escape = (val) => `'${String(val || '').replace(/'/g, "''")}'`;
      return `  (${escape(e.id)}, ${escape(e.entry_number)}, ${escape(e.posted_at)}, ${escape(e.account_code)}, ${escape(e.account_name)}, ${escape(e.account_type)}, ${escape(e.entry_type)}, ${Number(e.debit_php || 0).toFixed(2)}, ${Number(e.credit_php || 0).toFixed(2)}, ${Number(e.running_balance_php || 0).toFixed(2)}, ${escape(e.category)}, ${escape(e.particulars)}, ${escape(e.reference_id)}, ${escape(e.status)}, ${escape(e.created_by)}, ${escape(e.created_at || e.posted_at)})`;
    });

    sql += rowStrings.join(',\n') + '\nON CONFLICT (entry_number) DO UPDATE SET\n' +
      '  debit_php = EXCLUDED.debit_php,\n' +
      '  credit_php = EXCLUDED.credit_php,\n' +
      '  running_balance_php = EXCLUDED.running_balance_php,\n' +
      '  particulars = EXCLUDED.particulars,\n' +
      '  status = EXCLUDED.status;\n';
  } else {
    sql += `-- No records to insert.\n`;
  }

  sql += `\nCOMMIT;\n\n-- End of PostgreSQL Ledger Backup\n`;
  return sql;
}

export function exportJSON(entries = inMemoryEntries) {
  const safeEntries = recalculateRunningBalances(entries);
  return {
    system: 'Rock View Beach Resort Management System',
    schema_version: '2.0.0',
    table: 'public.ledger_entries',
    architecture: 'Isolated Modular Framework (IMF) Debit & Credit Engine',
    exported_at: new Date().toISOString(),
    record_count: safeEntries.length,
    trial_balance: calculateTrialBalance(safeEntries),
    chart_of_accounts: CHART_OF_ACCOUNTS,
    records: safeEntries,
  };
}

export function exportCSV(entries = inMemoryEntries) {
  const safeEntries = recalculateRunningBalances(entries);
  const headers = [
    'entry_number',
    'posted_at',
    'account_code',
    'account_name',
    'account_type',
    'entry_type',
    'debit_php',
    'credit_php',
    'running_balance_php',
    'category',
    'particulars',
    'reference_id',
    'status',
    'created_by',
  ];

  const escapeCell = (val) => {
    const s = String(val ?? '').replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };

  const rows = safeEntries.map((e) =>
    headers.map((h) => escapeCell(e[h])).join(',')
  );

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * -------------------------------------------------------------------------------------
 * ADAPTIVE IMPORT ENGINE
 * Detects payload format automatically:
 * 1. PostgreSQL SQL Dump (CREATE TABLE / INSERT INTO / VALUES / BEGIN)
 * 2. JSON (Array or Wrapped records object)
 * 3. CSV (Comma, tab, or semicolon separated with headers)
 * 4. Physical Logbook Notation (Pipe-delimited text with financial equations)
 * -------------------------------------------------------------------------------------
 */
export async function importAdaptiveBackup(rawContent, options = {}, user = {}) {
  const { mode = 'append' } = options; // 'append' or 'overwrite'
  if (!rawContent || typeof rawContent !== 'string') {
    throw new Error('Import content must be a non-empty string or file buffer.');
  }

  const trimmed = rawContent.trim();
  let detectedFormat = 'unknown';
  let parsedRecords = [];

  // 1. Check for PostgreSQL SQL Dump
  if (
    trimmed.includes('INSERT INTO public.ledger_entries') ||
    trimmed.includes('CREATE TABLE') ||
    (trimmed.startsWith('BEGIN;') && trimmed.includes('INSERT INTO')) ||
    /INSERT\s+INTO\s+[a-z0-9_.]*ledger_entries/i.test(trimmed)
  ) {
    detectedFormat = 'sql';
    parsedRecords = parsePostgresDump(trimmed);
  }
  // 2. Check for JSON format
  else if (
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
  ) {
    detectedFormat = 'json';
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed)
        ? parsed
        : (parsed.records || parsed.data || parsed.entries || []);
      parsedRecords = normalizeParsedRecords(list);
    } catch (e) {
      throw new Error(`Invalid JSON format: ${e.message}`);
    }
  }
  // 3. Check for CSV format
  else if (
    trimmed.includes(',') &&
    (trimmed.toLowerCase().includes('debit') ||
     trimmed.toLowerCase().includes('credit') ||
     trimmed.toLowerCase().includes('entry_number') ||
     trimmed.toLowerCase().includes('particulars'))
  ) {
    detectedFormat = 'csv';
    parsedRecords = parseCsvFormat(trimmed);
  }
  // 4. Fallback: Physical Logbook Notation / Raw text lines
  else {
    detectedFormat = 'logbook';
    parsedRecords = parseLogbookLines(trimmed);
  }

  if (parsedRecords.length === 0) {
    throw new Error(`Failed to extract any valid ledger entries from the provided ${detectedFormat.toUpperCase()} input.`);
  }

  // Handle overwrite vs append
  if (mode === 'overwrite') {
    inMemoryEntries = [];
  }

  const existingEntryNums = new Set(inMemoryEntries.map((e) => e.entry_number));
  let importedCount = 0;

  for (const record of parsedRecords) {
    let entryNum = record.entry_number;
    if (!entryNum || (mode === 'append' && existingEntryNums.has(entryNum))) {
      entryNum = generateEntryNumber(importedCount);
    }
    existingEntryNums.add(entryNum);

    const safeRecord = {
      ...record,
      id: record.id || crypto.randomUUID(),
      entry_number: entryNum,
      posted_at: record.posted_at || new Date().toISOString(),
      debit_php: Number(record.debit_php) || 0,
      credit_php: Number(record.credit_php) || 0,
      created_by: record.created_by || user.email || 'import_agent@rockviewresort.ph',
      status: record.status || 'POSTED',
    };

    inMemoryEntries.push(safeRecord);
    importedCount++;
  }

  // Recalculate running balances
  inMemoryEntries = recalculateRunningBalances(inMemoryEntries);
  savePersistedEntries();

  // Dual sync to Supabase if available
  try {
    const sb = getSystemAdminClient() || admin;
    if (sb) {
      if (mode === 'overwrite') {
        await sb.from('ledger_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }
      await sb.from('ledger_entries').upsert(inMemoryEntries, { onConflict: 'entry_number' });
    }
  } catch {}

  // Log audit event
  try {
    await logAuditEvent({
      actor: user,
      action: 'LEDGER_BACKUP_IMPORTED',
      resourceType: 'ledger_backup',
      resourceId: detectedFormat,
      details: {
        mode,
        detected_format: detectedFormat,
        imported_count: importedCount,
        total_records: inMemoryEntries.length,
      },
    });
  } catch {}

  return {
    success: true,
    detected_format: detectedFormat,
    imported_count: importedCount,
    total_records: inMemoryEntries.length,
    trial_balance: calculateTrialBalance(),
  };
}

/**
 * -------------------------------------------------------------------------------------
 * SUB-PARSERS FOR ADAPTIVE IMPORT
 * -------------------------------------------------------------------------------------
 */

/** Parse SQL VALUES clauses from PostgreSQL dump */
function parsePostgresDump(sqlText) {
  const records = [];
  // Find INSERT INTO ... VALUES (...)
  const insertRegex = /INSERT\s+INTO\s+[a-z0-9_.]*ledger_entries[^(]*\(([^)]+)\)\s+VALUES\s*([\s\S]+?);/gi;
  let match;

  while ((match = insertRegex.exec(sqlText)) !== null) {
    const columns = match[1].split(',').map((c) => c.trim().toLowerCase());
    const valuesBlock = match[2];

    // Match each tuple ( ... )
    const tupleRegex = /\(([\s\S]+?)\)(?:,\s*|\s*$)/g;
    let tupleMatch;

    while ((tupleMatch = tupleRegex.exec(valuesBlock)) !== null) {
      const rawVals = parseSqlTupleValues(tupleMatch[1]);
      if (rawVals.length === columns.length) {
        const row = {};
        columns.forEach((col, idx) => {
          row[col] = rawVals[idx];
        });
        records.push(row);
      }
    }
  }

  return normalizeParsedRecords(records);
}

/** Helper to split SQL tuple respecting quoted strings */
function parseSqlTupleValues(tupleStr) {
  const results = [];
  let current = '';
  let inString = false;

  for (let i = 0; i < tupleStr.length; i++) {
    const char = tupleStr[i];
    if (char === "'") {
      if (inString && tupleStr[i + 1] === "'") {
        current += "'";
        i++; // skip escaped quote
      } else {
        inString = !inString;
      }
    } else if (char === ',' && !inString) {
      results.push(cleanSqlValue(current));
      current = '';
    } else {
      current += char;
    }
  }
  if (current) results.push(cleanSqlValue(current));
  return results;
}

function cleanSqlValue(val) {
  const t = val.trim();
  if (t.toUpperCase() === 'NULL') return null;
  if (t.startsWith("'") && t.endsWith("'")) {
    return t.slice(1, -1).replace(/''/g, "'");
  }
  const num = Number(t);
  return isNaN(num) ? t : num;
}

/** Parse CSV text */
function parseCsvFormat(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvRow(lines[0]).map((h) => h.toLowerCase().trim());
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvRow(lines[i]);
    if (vals.length >= headers.length) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = vals[idx];
      });
      records.push(row);
    }
  }

  return normalizeParsedRecords(records);
}

function parseCsvRow(rowStr) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < rowStr.length; i++) {
    const c = rowStr[i];
    if (c === '"') {
      if (inQuotes && rowStr[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** Parse pipe-delimited physical logbook notation */
function parseLogbookLines(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const records = [];

  for (const line of lines) {
    // Expected format: Guest Name | Dates | Room/Unit | Equation | Notes
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length >= 3) {
      const guestName = parts[0];
      const datesOrRoom = parts[1];
      const roomOrEq = parts[2];
      const eqOrNotes = parts[3] || '';
      const notes = parts[4] || '';

      const financialText = `${roomOrEq} ${eqOrNotes}`;
      const math = parseFinancialEquation(financialText);
      const roomInfo = resolveRoomSlug(roomOrEq || datesOrRoom);

      if (math.total_php > 0 || math.downpayment_php > 0) {
        const refId = `LOG-${crypto.randomUUID().slice(0, 8)}`;
        const now = new Date().toISOString();

        // 1. Debit Entry (Cash received)
        const cashAmount = math.downpayment_php > 0 ? math.downpayment_php : math.total_php;
        records.push({
          account_code: '1010',
          account_name: 'Cash on Hand & Digital Wallets',
          account_type: 'ASSET',
          entry_type: 'DEBIT',
          debit_php: cashAmount,
          credit_php: 0,
          category: 'PAYMENT',
          particulars: `Logbook Ingestion: Payment for ${roomInfo.room_slug} (${guestName})`,
          reference_id: refId,
          posted_at: now,
        });

        // 2. Credit Entry (Liability or Revenue)
        const creditAccount = math.payment_status === 'paid' ? '4010' : '2010';
        const accountDef = ACCOUNT_MAP.get(creditAccount);
        records.push({
          account_code: creditAccount,
          account_name: accountDef.name,
          account_type: accountDef.type,
          entry_type: 'CREDIT',
          debit_php: 0,
          credit_php: cashAmount,
          category: math.payment_status === 'paid' ? 'REVENUE' : 'PAYMENT',
          particulars: `Logbook Ingestion: ${accountDef.name} (${guestName} - ${notes})`,
          reference_id: refId,
          posted_at: now,
        });
      }
    }
  }

  return records;
}

/** Normalize flexible field names into canonical ledger entry structure */
function normalizeParsedRecords(rawList) {
  return rawList.map((r, idx) => {
    const code = String(r.account_code || r.code || r.account || '1010').trim();
    const account = ACCOUNT_MAP.get(code) || {
      name: r.account_name || 'General Accounts',
      type: r.account_type || 'ASSET',
    };

    let debit = Number(r.debit_php ?? r.debit ?? r.debit_amount ?? 0);
    let credit = Number(r.credit_php ?? r.credit ?? r.credit_amount ?? 0);

    // If only 'amount' and 'type' provided
    if (debit === 0 && credit === 0 && r.amount !== undefined) {
      const amt = Math.abs(Number(r.amount) || 0);
      const t = String(r.entry_type || r.type || '').toUpperCase();
      if (t === 'DEBIT' || t === 'DR') debit = amt;
      else credit = amt;
    }

    const entryType = (r.entry_type || (debit > 0 ? 'DEBIT' : 'CREDIT')).toUpperCase();

    return {
      id: r.id || crypto.randomUUID(),
      entry_number: r.entry_number || `LED-IMP-${String(idx + 1).padStart(4, '0')}`,
      posted_at: r.posted_at || r.date || new Date().toISOString(),
      account_code: code,
      account_name: r.account_name || account.name,
      account_type: r.account_type || account.type,
      entry_type: entryType,
      debit_php: debit,
      credit_php: credit,
      running_balance_php: Number(r.running_balance_php || 0),
      category: String(r.category || 'ADJUSTMENT').toUpperCase(),
      particulars: r.particulars || r.description || r.notes || 'Imported ledger transaction',
      reference_id: r.reference_id || r.ref || `IMP-${Date.now()}-${idx}`,
      status: r.status || 'POSTED',
      created_by: r.created_by || 'system@rockviewresort.ph',
    };
  });
}

/** Clear all ledger entries (admin maintenance) */
export async function clearLedgerEntries(user = {}) {
  inMemoryEntries = [];
  savePersistedEntries();
  try {
    const sb = getSystemAdminClient() || admin;
    if (sb) {
      await sb.from('ledger_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
  } catch {}

  try {
    await logAuditEvent({
      actor: user,
      action: 'LEDGER_RESET_CLEARED',
      resourceType: 'ledger',
      details: { message: 'All ledger entries cleared by administrator' },
    });
  } catch {}

  return { success: true };
}
