import express from 'express';
import { authenticate, requireStaffOrAdmin } from '../middleware/auth.js';
import {
  SYSTEM_PROMPT,
  TOOL_DECLARATIONS,
  ROOMS_CATALOG,
  lookupOrCreateGuest,
  insertLedgerReservation,
  runReActLedgerIngestion,
  checkRoomAvailability,
  parseFinancialEquation,
  normalizeLedgerDates,
  resolveRoomSlug,
  memoryStore,
} from '../agents/ledgerIngestionAgent.js';
import {
  CHART_OF_ACCOUNTS,
  getLedgerEntries,
  createLedgerEntry,
  createJournalPair,
  calculateTrialBalance,
  reconcileSystemTransactions,
  exportPostgresSQL,
  exportJSON,
  exportCSV,
  importAdaptiveBackup,
  clearLedgerEntries,
} from '../lib/ledgerService.js';

const router = express.Router();

/**
 * -------------------------------------------------------------------------------------
 * RE-EXPORT AGENT UTILITIES FOR BACKWARD COMPATIBILITY & TEST SUITES
 * -------------------------------------------------------------------------------------
 */
export {
  SYSTEM_PROMPT,
  TOOL_DECLARATIONS,
  ROOMS_CATALOG,
  lookupOrCreateGuest,
  insertLedgerReservation,
  runReActLedgerIngestion,
  checkRoomAvailability,
  parseFinancialEquation,
  normalizeLedgerDates,
  resolveRoomSlug,
  memoryStore,
};

/**
 * GET /api/ledger/spec
 * Returns System Prompt, JSON Schema Tool Declarations & Catalog
 */
router.get('/ledger/spec', authenticate, requireStaffOrAdmin, (_req, res) => {
  res.json({
    status: 'success',
    system_prompt: SYSTEM_PROMPT,
    tools: TOOL_DECLARATIONS,
    catalog: ROOMS_CATALOG,
  });
});

/**
 * GET /api/ledger/catalog
 * Returns Canonical Rooms Catalog with physical units
 */
router.get('/ledger/catalog', authenticate, requireStaffOrAdmin, (_req, res) => {
  res.json({
    status: 'success',
    catalog: ROOMS_CATALOG,
    aliases: {
      'Unit Papang': 'unit-cat (Unit CAT Cottage, Capacity: 10)',
      'Unit Gorgio': 'unit-tev (Multi-unit / Whole House note, Capacity: 60)',
      'Whole House': 'unit-tev (Grand Villa reservation, Capacity: 60)',
    },
  });
});

/**
 * POST /api/ledger/ingest
 * Ingests physical logbook raw text/lines and executes autonomous ReAct loop
 */
router.post('/ledger/ingest', authenticate, requireStaffOrAdmin, async (req, res) => {
  try {
    const rawInput = req.body.raw_text || req.body.lines || req.body.text;
    if (!rawInput) {
      return res.status(400).json({
        status: 'error',
        message: 'Request body must contain "raw_text" or "lines" property with ledger data.',
      });
    }

    const result = await runReActLedgerIngestion(rawInput);
    res.json({
      status: result.success ? 'success' : 'partial_success',
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

/**
 * POST /api/ledger/tools/lookup-guest
 * Executes lookup_or_create_guest tool
 */
router.post('/ledger/tools/lookup-guest', authenticate, requireStaffOrAdmin, async (req, res) => {
  try {
    const { full_name, phone } = req.body;
    const profile = await lookupOrCreateGuest({ full_name, phone });
    res.json({ status: 'success', profile });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

/**
 * POST /api/ledger/tools/insert-reservation
 * Executes insert_ledger_reservation tool
 */
router.post('/ledger/tools/insert-reservation', authenticate, requireStaffOrAdmin, async (req, res) => {
  try {
    const result = await insertLedgerReservation(req.body);
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

/**
 * POST /api/ledger/availability
 * Checks room availability with GiST range exclusion constraint
 */
router.post('/ledger/availability', authenticate, requireStaffOrAdmin, (req, res) => {
  try {
    const { room_slug, check_in, check_out } = req.body;
    const result = checkRoomAvailability(room_slug, check_in, check_out);
    res.json({ status: 'success', result });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

/**
 * -------------------------------------------------------------------------------------
 * DEBIT & CREDIT GENERAL LEDGER ROUTES
 * -------------------------------------------------------------------------------------
 */

/**
 * GET /api/ledger/entries
 * Returns debit/credit ledger records with running balances and trial balance summary
 */
router.get('/ledger/entries', authenticate, requireStaffOrAdmin, async (req, res) => {
  try {
    const { account_code, category, entry_type, search, limit, offset, sort } = req.query;
    const entries = await getLedgerEntries({
      account_code: account_code ? String(account_code) : undefined,
      category: category ? String(category) : undefined,
      entry_type: entry_type ? String(entry_type) : undefined,
      search: search ? String(search) : undefined,
      limit: limit ? parseInt(limit, 10) : 500,
      offset: offset ? parseInt(offset, 10) : 0,
      sort: sort === 'asc' ? 'asc' : 'desc',
    });

    const trialBalance = calculateTrialBalance();

    res.json({
      status: 'success',
      data: entries,
      trial_balance: trialBalance,
      chart_of_accounts: CHART_OF_ACCOUNTS,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * POST /api/ledger/entries
 * Posts a single entry or a balanced double-entry journal pair
 */
router.post('/ledger/entries', authenticate, requireStaffOrAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    let result;

    // Check if posting compound journal pair (Debit & Credit)
    if (body.debit_account_code && body.credit_account_code) {
      result = await createJournalPair(body, req.user);
    } else {
      result = await createLedgerEntry(body, req.user);
    }

    const trialBalance = calculateTrialBalance();
    res.status(201).json({
      status: 'success',
      data: result,
      trial_balance: trialBalance,
    });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

/**
 * POST /api/ledger/reconcile
 * Scans system reservations & orders and creates matching double entries
 */
router.post('/ledger/reconcile', authenticate, requireStaffOrAdmin, async (req, res) => {
  try {
    const result = await reconcileSystemTransactions(req.user);
    res.json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * GET /api/ledger/trial-balance
 * Returns real-time Trial Balance statement
 */
router.get('/ledger/trial-balance', authenticate, requireStaffOrAdmin, (_req, res) => {
  try {
    const trialBalance = calculateTrialBalance();
    res.json({
      status: 'success',
      data: trialBalance,
      chart_of_accounts: CHART_OF_ACCOUNTS,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * -------------------------------------------------------------------------------------
 * POSTGRESQL BACKUP & MIGRATION EXPORT / IMPORT (ADAPTIVE FORMAT)
 * -------------------------------------------------------------------------------------
 */

/**
 * GET /api/ledger/backup/export
 * Exports complete ledger in PostgreSQL SQL dump, JSON, or CSV
 */
router.get('/ledger/backup/export', authenticate, requireStaffOrAdmin, async (req, res) => {
  try {
    const format = String(req.query.format || 'sql').toLowerCase();
    const shouldDownload = req.query.download === 'true' || req.query.dl === '1';
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    if (format === 'json') {
      const data = exportJSON();
      if (shouldDownload) {
        res.setHeader('Content-Disposition', `attachment; filename="rockview_ledger_backup_${dateStamp}.json"`);
      }
      return res.json(data);
    }

    if (format === 'csv') {
      const csv = exportCSV();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      if (shouldDownload) {
        res.setHeader('Content-Disposition', `attachment; filename="rockview_ledger_backup_${dateStamp}.csv"`);
      }
      return res.send(csv);
    }

    // Default: PostgreSQL Dump (.sql)
    const sql = exportPostgresSQL();
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    if (shouldDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="rockview_ledger_backup_${dateStamp}.sql"`);
    }
    return res.send(sql);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * POST /api/ledger/backup/import
 * Adaptive format import: Accepts PostgreSQL SQL dump, JSON, CSV, or raw Logbook text
 */
router.post('/ledger/backup/import', authenticate, requireStaffOrAdmin, async (req, res) => {
  try {
    const { content, mode } = req.body || {};
    if (!content) {
      return res.status(400).json({
        status: 'error',
        message: 'Request body must contain "content" with PostgreSQL SQL, JSON, CSV, or logbook text.',
      });
    }

    const result = await importAdaptiveBackup(content, { mode: mode || 'append' }, req.user);
    res.json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    res.status(400).json({
      status: 'error',
      message: err.message,
    });
  }
});

/**
 * POST /api/ledger/clear
 * Maintenance endpoint to reset ledger
 */
router.post('/ledger/clear', authenticate, requireStaffOrAdmin, async (req, res) => {
  try {
    await clearLedgerEntries(req.user);
    res.json({ status: 'success', message: 'All ledger entries cleared.' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
