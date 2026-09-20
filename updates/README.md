# Update Management & Deployment Workflow

This dedicated directory manages version releases, changelogs, and database migrations for the **J & D Beach House** platform.

---

## Directory Structure

```
updates/
├── releases/               <-- Version release manifests & release notes
│   ├── v1.0.0.md           <-- Baseline stable release notes
│   └── ...
├── migrations/             <-- Incremental, numbered SQL database migrations
│   ├── 001_initial_baseline.sql
│   └── ...
└── README.md               <-- This update protocol guide
```

---

## Safe Update Protocol (Step-by-Step)

Before deploying any future update or feature change, follow this 5-step protocol to prevent breaking changes:

### Step 1: Create a Pre-Update Backup
Always run the backup script before touching code or database schema:
```bash
.\scripts\backup.bat
```
Verify that a new backup appears in `backups/database/`.

### Step 2: Write Incremental Migration (If Database Schema Changes)
1. Add a new sequentially numbered file in `updates/migrations/` (e.g. `002_add_payment_gateway.sql`).
2. Run the migration on your staging/production Supabase database.
3. Keep `supabase/schema.sql` synchronized with the latest full schema.

### Step 3: Implement & Test Code Changes
1. Make your component or backend changes.
2. If styling changes are introduced, place them in `client/src/styles/modules/`.
3. Standardize imports to `.tsx` / `.ts`.

### Step 4: Run Verification Tests
```bash
.\scripts\verify.bat
```
Ensure all 5 suite tests pass and the client builds with 0 errors.

### Step 5: Version Control Commit & Tag
```bash
git add .
git commit -m "feat(module): describe update cleanly"
git tag -a v1.X.X -m "Release v1.X.X"
```
Record release notes in `updates/releases/v1.X.X.md`.
