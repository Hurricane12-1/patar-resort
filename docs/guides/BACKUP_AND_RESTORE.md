# J & D Beach House — Backup & Disaster Recovery Guide

This guide explains how to create, manage, and restore backups using the repository's dedicated `backups/` system and automated scripts.

---

## 1. Automated Backups

You can trigger an automated, timestamped backup at any time by running:
```bash
node scripts/backup.js [optional_label]
```
Or double-clicking `scripts/backup.bat` on Windows.

### What is backed up:
1. **PostgreSQL Schema DDL**: Preserved in `backups/database/schema_backup_<TIMESTAMP>_<LABEL>.sql`.
2. **System Configuration Snapshot**: Preserved in `backups/database/system_config_<TIMESTAMP>_<LABEL>.json`.

---

## 2. Emergency Restoration Guide

### Scenario A: Database Schema Corruption or Broken Migration
1. Locate the latest verified schema backup in `backups/database/` (e.g. `schema_backup_v1.0.0.sql`).
2. Open your Supabase Dashboard -> **SQL Editor**.
3. Paste the contents of the backup SQL file and click **Run**.
4. Run verification to confirm the system is operational:
   ```bash
   node scripts/verify.js
   ```

### Scenario B: Code Regression or Broken Update
1. Check available stable git release tags:
   ```bash
   git tag -l
   ```
2. Checkout the verified baseline tag:
   ```bash
   git checkout v1.0.0-stable
   ```
3. Re-bundle the frontend assets:
   ```bash
   cd client && npm run build
   ```
4. Restart the backend server.
