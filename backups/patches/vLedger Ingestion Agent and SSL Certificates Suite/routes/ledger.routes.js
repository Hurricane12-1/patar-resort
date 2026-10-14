import express from 'express';
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

const router = express.Router();

/**
 * GET /api/ledger/spec
 * Returns System Prompt, JSON Schema Tool Declarations & Catalog
 */
router.get('/ledger/spec', (_req, res) => {
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
router.get('/ledger/catalog', (_req, res) => {
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
router.post('/ledger/ingest', async (req, res) => {
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
router.post('/ledger/tools/lookup-guest', async (req, res) => {
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
router.post('/ledger/tools/insert-reservation', async (req, res) => {
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
router.post('/ledger/availability', (req, res) => {
  try {
    const { room_slug, check_in, check_out } = req.body;
    const result = checkRoomAvailability(room_slug, check_in, check_out);
    res.json({ status: 'success', result });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

export default router;
