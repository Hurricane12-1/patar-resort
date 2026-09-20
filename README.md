# 🌊 J & D Beach House — Full-Stack Resort Management Platform

**Location**: Bolinao, Pangasinan, Philippines  
**Architecture**: React 18 (Vite + TypeScript) + Node.js (Express + Socket.io) + Supabase (PostgreSQL 15+ with RLS & GiST) + Twilio SMS

---

## 📁 Repository Architecture & Folder Organization

```
Capstone 1 sided/
├── backups/                    <-- Dedicated Backup & Disaster Recovery Repository
│   ├── database/               <-- SQL schema snapshots & system config backups
│   ├── snapshots/              <-- Codebase backup archives
│   └── README.md               <-- Backup & restore procedures
├── client/                     <-- Frontend Application (React 18 + Vite + TS)
│   ├── src/
│   │   ├── components/         <-- Reusable UI components (Navbar, Footer, Chatbot, etc.)
│   │   ├── context/            <-- Authentication & session state
│   │   ├── hooks/              <-- Custom React hooks
│   │   ├── lib/                <-- API client, formatting, socket engine
│   │   ├── pages/              <-- Route pages (Home, Rooms, Reception, Accounting, Admin)
│   │   └── styles/             <-- Global CSS & modular TSX style modules
│   │       └── modules/        <-- Extracted TypeScript styles (*.styles.ts, theme.ts)
│   └── dist/                   <-- Compiled static production build
├── docs/                       <-- Dedicated System Documentation Hub
│   ├── architecture/           <-- System & Data Hierarchy diagrams (PNG, SVG, HTML viewer)
│   ├── api/                    <-- Complete REST API & WebSocket specifications
│   ├── database/               <-- PostgreSQL schema, DATA_HIERARCHY.md, RLS policies
│   ├── guides/                 <-- Deployment, developer setup & disaster recovery
│   ├── roadmap/                <-- Phased feature roadmap & future milestones
│   └── README.md               <-- Master documentation directory index
├── scripts/                    <-- Automation & Utility Tooling
│   ├── backup.js / backup.bat  <-- One-click automated backup script
│   └── verify.js / verify.bat  <-- One-click system verification test runner
├── server/                     <-- Backend Server (Node.js + Express + Socket.io)
│   ├── src/
│   │   ├── config/             <-- Environment, TLS credentials, certs
│   │   ├── lib/                <-- Supabase client, Twilio SMS service
│   │   ├── middleware/         <-- Auth, NGWF firewall, Anti-XSS, error handlers
│   │   ├── routes/             <-- Modular REST API routes
│   │   └── socket/             <-- Real-time chatbot socket engine
│   └── test/                   <-- Backend test verification suite
├── supabase/                   <-- Supabase PostgreSQL database DDL & triggers
├── updates/                    <-- Version Releases & Migration Management
│   ├── releases/               <-- Version release manifests (v1.0.0, etc.)
│   ├── migrations/             <-- Sequential database migration scripts
│   └── README.md               <-- Safe update protocol & rollback SOP
├── UNFINISHED_FEATURES.txt     <-- Comprehensive audit checklist of pending features
└── .gitignore                  <-- Root repository ignore rules
```

---

## ⚡ Quick Start

### 1. One-Click Verification
To test both backend tests and client compilation in one command:
```bash
node scripts/verify.js
# Or double-click scripts\verify.bat
```

### 2. One-Click Backup
To create a timestamped backup before making updates:
```bash
node scripts/backup.js [optional_label]
# Or double-click scripts\backup.bat
```

### 3. Local Development Servers
- **Backend**: `cd server && npm start` (Running on `http://localhost:5000`)
- **Frontend**: `cd client && npm run dev` (Running on `http://localhost:5173`)

---

## 📖 Documentation Hub

All technical manuals, architecture diagrams, and API specifications are housed in the [**`docs/`**](./docs/README.md) directory:
- 📐 [**System Architecture & Diagrams**](./docs/architecture/README.md)
- 🔌 [**REST API & WebSocket Specifications**](./docs/api/API_REFERENCE.md)
- 🗄️ [**Database Schema & Security Policies**](./docs/database/DATABASE_SCHEMA.md)
- 🚀 [**Deployment & Setup Guide**](./docs/guides/DEPLOYMENT_AND_SETUP.md)
- 🛡️ [**Disaster Recovery & Rollback Guide**](./docs/guides/BACKUP_AND_RESTORE.md)
- 🗺️ [**Development Roadmap & Upcoming Releases**](./docs/roadmap/FEATURE_ROADMAP.md)

---

## 🏷️ Version Control

- **Baseline Release**: `v1.0.0-stable`
- **Changelog**: Documented in [`updates/releases/v1.0.0.md`](./updates/releases/v1.0.0.md)
- **License**: Proprietary — J & D Beach House
