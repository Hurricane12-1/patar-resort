# Backup & Disaster Recovery Repository

This dedicated directory manages all database schema snapshots, system configuration backups, and emergency rollback assets for the **J & D Beach House** application.

---

## Directory Structure

```
backups/
├── database/                   <-- SQL dumps and JSON configuration backups
│   ├── schema_backup_v1.0.0.sql    <-- Baseline PostgreSQL schema backup
│   └── system_config_v1.0.0.json   <-- Core system config snapshot
├── snapshots/                  <-- Timestamped ZIP/TAR code archives (gitignored)
└── README.md                   <-- This manual
```

---

## Backup Types

### 1. Database Schema Backup (`backups/database/`)
Contains full SQL DDL exports including:
- PostgreSQL extension declarations (`pgcrypto`, `btree_gist`).
- Custom enums (`stay_status`, `user_role`, `dept_name`, etc.).
- Relational tables with GiST exclusion constraints (`no_overbooking`).
- Row-Level Security (RLS) policies and security definer functions.
- Automated triggers (`sync_room_rating`, `handle_new_user`).
- Materialized analytics views.

### 2. Automated Snapshot Script (`scripts/backup.bat`)
Run the automated backup script from the repository root:
```bash
.\scripts\backup.bat
```
This automatically exports a timestamped backup containing the current schema and configuration into `backups/database/`.

---

## Restoration Procedure

If a future update or database migration causes unexpected issues:

1. **Database Schema Restore**:
   - Open your Supabase Dashboard SQL Editor or run via `psql`:
     ```bash
     psql -h <SUPABASE_HOST> -U postgres -d postgres -f backups/database/schema_backup_v1.0.0.sql
     ```
2. **Rollback Git State**:
   - To return the codebase to the verified `v1.0.0` release:
     ```bash
     git checkout v1.0.0-stable
     ```
3. **Rebuild Frontend**:
   ```bash
   cd client && npm run build
   ```
4. **Verify System Health**:
   ```bash
   cd ../server && node test/verify-all.test.js
   ```
