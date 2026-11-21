import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const dbRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-import-'));
process.env.SERVER_DB_DIR = dbRoot;
process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';

const {
  parseAdaptiveBackup,
  importAdaptiveBackup,
  exportJSON,
  exportPostgresSQL,
  exportCSV,
  clearLedgerEntries,
} = await import('../src/lib/ledgerService.js');

const ACTOR = { email: 'auditor@rockviewresort.ph', role: 'admin' };

const RECORDS = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    entry_number: 'LED-2026-0001',
    posted_at: '2026-03-01T08:00:00.000Z',
    account_code: '1010',
    entry_type: 'DEBIT',
    debit_php: 5000,
    credit_php: 0,
    category: 'PAYMENT',
    particulars: 'Downpayment, Habagat Suite',
    reference_id: 'RES-1',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    entry_number: 'LED-2026-0002',
    posted_at: '2026-03-02T08:00:00.000Z',
    account_code: '4010',
    entry_type: 'CREDIT',
    debit_php: 0,
    credit_php: 5000,
    category: 'REVENUE',
    particulars: "Room revenue, O'Brien party",
    reference_id: 'RES-1',
  },
];

const ONE_RECORD = [
  {
    id: 'b0000000-0000-4000-8000-000000000009',
    entry_number: 'LED-2026-0009',
    posted_at: '2026-04-10T08:00:00.000Z',
    account_code: '1010',
    entry_type: 'DEBIT',
    debit_php: 1200,
    credit_php: 0,
    category: 'PAYMENT',
    particulars: 'Walk-in cottage night',
    reference_id: 'RES-9',
  },
];

function fakeSupabase({ initialRows = [], failUpsert = false, failDelete = false } = {}) {
  const rows = [...initialRows];
  return {
    rows,
    from(table) {
      assert.equal(table, 'ledger_entries');
      return {
        upsert: async (payload) => {
          if (failUpsert) return { error: { message: 'upsert rejected' } };
          for (const incoming of payload) {
            const index = rows.findIndex((r) => r.entry_number === incoming.entry_number);
            if (index >= 0) rows[index] = incoming;
            else rows.push(incoming);
          }
          return { error: null };
        },
        select: () => ({
          order: () => ({
            range: async (from, to) => ({
              data: rows.slice(from, to + 1).map((r) => ({ id: r.id, entry_number: r.entry_number })),
              error: null,
            }),
          }),
        }),
        delete: () => ({
          neq: async () => {
            if (failDelete) return { error: { message: 'delete rejected' } };
            rows.length = 0;
            return { error: null };
          },
          in: async (_column, ids) => {
            const doomed = new Set(ids);
            for (let i = rows.length - 1; i >= 0; i -= 1) {
              if (doomed.has(rows[i].id)) rows.splice(i, 1);
            }
            return { error: null };
          },
        }),
      };
    },
  };
}

const json = (records) => JSON.stringify(records);
const localEntryNumbers = () => exportJSON().records.map((r) => r.entry_number);

test('detects SQL, JSON and CSV input and extracts the same rows', () => {
  const fromJson = parseAdaptiveBackup(json(RECORDS));
  assert.equal(fromJson.detectedFormat, 'json');
  assert.equal(fromJson.parsedRecords.length, 2);

  const fromSql = parseAdaptiveBackup(exportPostgresSQL(RECORDS));
  assert.equal(fromSql.detectedFormat, 'sql');
  assert.equal(fromSql.parsedRecords.length, 2);
  assert.equal(fromSql.parsedRecords[0].entry_number, 'LED-2026-0001');

  const fromCsv = parseAdaptiveBackup(exportCSV(RECORDS));
  assert.equal(fromCsv.detectedFormat, 'csv');
  assert.equal(fromCsv.parsedRecords.length, 2);
  assert.equal(fromCsv.parsedRecords[1].particulars, "Room revenue, O'Brien party");
});

test('SQL dump keeps semicolons and parentheses inside quoted values', () => {
  const records = [{ ...RECORDS[0], particulars: 'Paid; balance due (cash)' }, RECORDS[1]];
  const parsed = parseAdaptiveBackup(exportPostgresSQL(records));
  assert.equal(parsed.parsedRecords.length, 2);
  assert.equal(parsed.parsedRecords[0].particulars, 'Paid; balance due (cash)');
});

test('rejects input with no ledger rows and leaves the ledger unchanged', async () => {
  await importAdaptiveBackup(json(RECORDS), { mode: 'overwrite', syncClient: null }, ACTOR);
  await assert.rejects(
    importAdaptiveBackup('just some notes with no ledger rows', { mode: 'append', syncClient: null }, ACTOR),
    /Failed to extract any valid ledger entries/,
  );
  assert.deepEqual(localEntryNumbers(), ['LED-2026-0001', 'LED-2026-0002']);
});

test('overwrite restores exactly the backup contents', async () => {
  await importAdaptiveBackup(json(RECORDS), { mode: 'overwrite', syncClient: null }, ACTOR);
  const restored = exportJSON().records;
  assert.equal(restored.length, 2);
  assert.equal(restored[0].id, RECORDS[0].id);
  assert.equal(restored[0].debit_php, 5000);
  assert.equal(restored[1].credit_php, 5000);
});

test('appending the same backup twice adds nothing the second time', async () => {
  await importAdaptiveBackup(json(RECORDS), { mode: 'overwrite', syncClient: null }, ACTOR);
  const second = await importAdaptiveBackup(json(RECORDS), { mode: 'append', syncClient: null }, ACTOR);
  assert.equal(second.imported_count, 0);
  assert.equal(second.skipped_duplicates, 2);
  assert.equal(second.total_records, 2);
  assert.deepEqual(localEntryNumbers(), ['LED-2026-0001', 'LED-2026-0002']);
});

test('dry run reports what would change and writes nothing', async () => {
  await clearLedgerEntries(ACTOR, { syncClient: null });
  const preview = await importAdaptiveBackup(json(RECORDS), { mode: 'append', dryRun: true, syncClient: null }, ACTOR);
  assert.equal(preview.dry_run, true);
  assert.equal(preview.would_insert_count, 2);
  assert.equal(preview.imported_count, 0);
  assert.equal(preview.sample.length, 2);
  assert.equal(exportJSON().record_count, 0);
});

test('overwrite saves a snapshot of the previous ledger first', async () => {
  await importAdaptiveBackup(json(RECORDS), { mode: 'overwrite', syncClient: null }, ACTOR);
  const result = await importAdaptiveBackup(json(ONE_RECORD), { mode: 'overwrite', syncClient: null }, ACTOR);
  assert.ok(result.snapshot_file, 'snapshot file name is returned');

  const snapshot = JSON.parse(
    fs.readFileSync(path.join(dbRoot, 'ledger_snapshots', result.snapshot_file), 'utf8'),
  );
  assert.equal(snapshot.record_count, 2);
  assert.deepEqual(localEntryNumbers(), ['LED-2026-0009']);
});

test('a failed Supabase upsert keeps the local ledger unchanged', async () => {
  await importAdaptiveBackup(json(RECORDS), { mode: 'overwrite', syncClient: null }, ACTOR);
  await assert.rejects(
    importAdaptiveBackup(json(ONE_RECORD), { mode: 'overwrite', syncClient: fakeSupabase({ failUpsert: true }) }, ACTOR),
    (err) => err.code === 'SYNC_FAILED' && /upsert rejected/.test(err.message),
  );
  assert.deepEqual(localEntryNumbers(), ['LED-2026-0001', 'LED-2026-0002']);
});

test('overwrite syncs to Supabase and removes stale remote rows', async () => {
  await importAdaptiveBackup(json(RECORDS), { mode: 'overwrite', syncClient: null }, ACTOR);
  const remote = fakeSupabase({
    initialRows: RECORDS.map((r) => ({ ...r })),
  });
  const result = await importAdaptiveBackup(json(ONE_RECORD), { mode: 'overwrite', syncClient: remote }, ACTOR);
  assert.equal(result.sync, 'supabase');
  assert.deepEqual(remote.rows.map((r) => r.entry_number), ['LED-2026-0009']);
});

test('a failed Supabase delete during clear keeps the local ledger', async () => {
  await importAdaptiveBackup(json(RECORDS), { mode: 'overwrite', syncClient: null }, ACTOR);
  await assert.rejects(
    clearLedgerEntries(ACTOR, { syncClient: fakeSupabase({ failDelete: true }) }),
    (err) => err.code === 'SYNC_FAILED',
  );
  assert.equal(exportJSON().record_count, 2);
});

after(() => {
  fs.rmSync(dbRoot, { recursive: true, force: true });
});
