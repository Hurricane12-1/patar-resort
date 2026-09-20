# J & D Beach House — System Documentation Repository

Welcome to the comprehensive technical documentation repository for **J & D Beach House** (Bolinao, Pangasinan). This folder is organized as an independent, self-contained documentation hub.

---

## Documentation Directory Map

```
docs/
├── architecture/                   <-- System Architecture Diagrams & Flowcharts
│   ├── README.md                   <-- High-level architecture specification
│   ├── system_architecture_diagram.png  <-- 1904x1516 high-res raster diagram
│   ├── system_architecture_diagram.svg  <-- Infinite vector zoom diagram
│   └── view_diagram.html           <-- Browser viewer for architecture diagram
├── api/                            <-- REST API & WebSocket Specifications
│   └── API_REFERENCE.md            <-- All endpoints, request schemas & socket events
├── database/                       <-- PostgreSQL Schemas & BaaS Specifications
│   └── DATABASE_SCHEMA.md          <-- Tables, enums, triggers, RLS, & GiST constraints
├── guides/                         <-- Setup, Deployment & Disaster Recovery
│   ├── DEPLOYMENT_AND_SETUP.md     <-- Installation, dev setup & production deployment
│   └── BACKUP_AND_RESTORE.md       <-- Backup procedures, snapshots & emergency rollback
├── roadmap/                        <-- Feature Milestones & Future Updates
│   └── FEATURE_ROADMAP.md          <-- Phased implementation checklist (from UNFINISHED_FEATURES.txt)
└── README.md                       <-- This root document
```

---

## Quick Navigation

| Topic | Document Link | Description |
| :--- | :--- | :--- |
| **System Architecture** | [Architecture Guide](./architecture/README.md) | High-res diagrams, system layers, and edge data flows. |
| **Interactive Diagram** | [View Diagram (HTML)](./architecture/view_diagram.html) | Interactive vector visualizer for system components. |
| **API Endpoints** | [API Reference](./api/API_REFERENCE.md) | Full endpoint contracts, payloads, and WebSocket events. |
| **Database Design** | [Database Schema](./database/DATABASE_SCHEMA.md) | Supabase PostgreSQL tables, RLS security, and GiST guard. |
| **Setup & Deploy** | [Deployment Guide](./guides/DEPLOYMENT_AND_SETUP.md) | Environment configuration, running locally and production. |
| **Disaster Recovery** | [Backup & Restore Guide](./guides/BACKUP_AND_RESTORE.md) | How to execute one-click backups and restore previous states. |
| **Upcoming Features** | [Feature Roadmap](./roadmap/FEATURE_ROADMAP.md) | Prioritized phases for payments, AI, and smart door locks. |

---

## Repository Governance & Versioning

- **Version Strategy**: Semantic Versioning (`v1.0.0`, `v1.1.0`, etc.).
- **Backups**: Stored in `backups/database/` via `scripts/backup.bat` / `scripts/backup.js`.
- **Updates**: Release notes and migrations tracked in `updates/`.
- **Styles**: Modular TypeScript styling housed in `client/src/styles/modules/`.
