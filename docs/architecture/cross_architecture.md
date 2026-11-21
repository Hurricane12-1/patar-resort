# Cross Architecture Map

patar-resort, `main` at commit `0550fc7`. The ledger import changes are uncommitted and included in layers 02 to 05. Dashed borders mark optional services.

```mermaid
flowchart LR
  subgraph L1["LAYER 01 · Client"]
    direction TB
    c1["Guest portal<br/>/ · /guest · /rooms · /policy"]
    c2["Admin console<br/>/admin/* · ledger, rooms, accounts"]
    c3["Staff desks<br/>/staff/operations · /reception · /accounting"]
    c4["Guest account<br/>/client/bookings · /profile · /help"]
    c5["Recovery portal<br/>/recovery/*"]
    c6["Route guards<br/>AdminGuard · StaffGuard · RecoveryGuard · ClientGuard"]
    c7["Backup modal<br/>Export SQL, JSON, CSV · dry-run import"]
    c8["Frontend adapters<br/>REST · GraphQL · WebSocket"]
    c9["Browser Supabase session<br/>Sign-in and fallback reads"]
    c1 ~~~ c2 ~~~ c3 ~~~ c4 ~~~ c5 ~~~ c6 ~~~ c7 ~~~ c8 ~~~ c9
  end

  subgraph L2["LAYER 02 · Edge and security"]
    direction TB
    p1["1 · pathNormalizer<br/>Normalises incoming paths"]
    p2["2 · securityHeaders<br/>Helmet headers, CSP, HSTS"]
    p3["3 · apiCacheControl<br/>Cache rules for API responses"]
    p4["4 · corsPolicy<br/>Allowed client origins"]
    p5["5 · globalLimiter<br/>Request rate limit per client"]
    p6["6 · concurrencyLimiter<br/>Caps in-flight requests at 250"]
    p7["7 · cookieTokenizer<br/>Parses cookies, issues CSRF token"]
    p8["8 · ngwfFirewall<br/>URL, query, params scan · strikes per IP"]
    p9["9 · express.json<br/>Body limit 5 MB"]
    p10["10 · antiXssSanitizer<br/>Sanitises request input"]
    a1["Auth and access<br/>authenticate · requireAdmin · requireFinanceOrAdmin"]
    a2["Brute-force and validation<br/>5 failures lock for 15 min · Joi and Zod"]
    a3["Error handling<br/>notFound and errorHandler"]
    p1 --> p2 --> p3 --> p4 --> p5 --> p6 --> p7 --> p8 --> p9 --> p10
    p10 ~~~ a1 ~~~ a2 ~~~ a3
  end

  subgraph L3["LAYER 03 · API surfaces"]
    direction TB
    r1["REST API<br/>/api/* · 22 route modules"]
    r2["GraphQL<br/>/api/graphql · schema and resolvers"]
    r3["Socket.io<br/>chat:message · staff:customer_handoff"]
    r4["Framework loader<br/>Mounts routes and modules at boot"]
    r5["Ledger endpoints<br/>export · import with dry_run · clear"]
    r1 ~~~ r2 ~~~ r3 ~~~ r4 ~~~ r5
  end

  subgraph L4["LAYER 04 · Domain services"]
    direction TB
    s1["Ledger service<br/>Double-entry, adaptive import, snapshots"]
    s2["Ledger ingestion agent<br/>Logbook and financial equation parsing"]
    s3["Reservations<br/>Supabase-backed, local cache off"]
    s4["Price requests<br/>Rate-change approvals and codes"]
    s5["Customer accounts<br/>bcrypt password hashes"]
    s6["Audit logger<br/>2,000 in memory · audit_logs.json · Supabase"]
    s7["Authorization rules<br/>Mirrors Supabase RLS policies"]
    s8["Schema collector<br/>Introspects tables every 60 s"]
    s1 ~~~ s2 ~~~ s3 ~~~ s4 ~~~ s5 ~~~ s6 ~~~ s7 ~~~ s8
  end

  subgraph L5["LAYER 05 · Data and cache"]
    direction TB
    d1["Supabase PostgreSQL<br/>Service-role and per-user RLS clients"]
    d2["Redis cache (optional)<br/>Falls back to in-memory cache"]
    d3["Local ledger file<br/>ledger_entries.json · written on every commit"]
    d4["Ledger snapshots<br/>Saved before import into a non-empty ledger"]
    d5["Audit log file<br/>audit_logs.json"]
    d6["Telemetry<br/>In-memory map, lost on restart"]
    d7["Uploads<br/>server/uploads · served at /uploads"]
    d1 ~~~ d2 ~~~ d3 ~~~ d4 ~~~ d5 ~~~ d6 ~~~ d7
  end

  subgraph L6["LAYER 06 · External services"]
    direction TB
    x1["Supabase Auth (required)<br/>Sign-in, Google and Facebook OAuth"]
    x2["Twilio SMS (optional)<br/>Enabled by environment settings"]
    x3["SMTP email (optional)<br/>nodemailer, enabled by environment settings"]
    x4["Cloudinary (optional)<br/>Cloud image hosting"]
    x5["Not connected<br/>Payment gateway, see UNFINISHED_FEATURES.txt"]
    x1 ~~~ x2 ~~~ x3 ~~~ x4 ~~~ x5
  end

  L1 -- "Browser requests" --> L2
  L2 -- "Checked requests" --> L3
  L3 -- "Route handlers" --> L4
  L4 -- "Reads and writes" --> L5
  L4 -. "Auth, SMS, mail, images" .-> L6

  classDef item fill:#FFFFFF,stroke:#D5E0EA,color:#0B1120
  classDef optional fill:#FFFFFF,stroke:#D97706,stroke-dasharray:4 3,color:#0B1120
  classDef planned fill:#FFF7E6,stroke:#D5E0EA,color:#0B1120
  classDef lane fill:#E0F0F7,stroke:#006699,color:#0B1120
  class L1,L2,L3,L4,L5,L6 lane
  class c1,c2,c3,c4,c5,c6,c7,c8,c9,p1,p2,p3,p4,p5,p6,p7,p8,p9,p10,a1,a2,a3,r1,r2,r3,r4,r5,s1,s2,s3,s4,s5,s6,s7,s8,d1,d2,d3,d4,d5,d6,d7,x1 item
  class x2,x3,x4 optional
  class x5 planned
```

## Request paths

1. **Ledger import (admin):** backup modal → `POST /api/ledger/backup/import` with `dry_run` → `requireAdmin` → parse and plan → snapshot → Supabase sync if configured → commit ledger file.
2. **Ledger export (admin):** backup modal → `GET /api/ledger/backup/export` → `requireAdmin` → `ledgerService` → SQL, JSON or CSV file.
3. **Live guest chat:** chat widget → Socket.io `chat:message` → `chatbot.js` → `staff:customer_handoff` → `staff_agents` room.
4. **Protected page load:** route guard → session token → edge middleware → `authenticate` → REST or GraphQL → Supabase or local data.

## Boot sequence

1. Load environment (`server/src/config/env.js`).
2. Register the security middleware chain (`server/src/index.js`).
3. Run `bootstrapFramework(app)`.
4. Create the HTTP or HTTPS server and attach the chat socket with `attachChatbot(server)`.
5. Listen on `PORT` (default 4000).
6. Start the schema collector with `startSchemaCollector(60000)`.
