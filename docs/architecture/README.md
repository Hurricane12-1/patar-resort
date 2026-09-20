# System Architecture & Data Flow Diagram

**Platform**: J & D Beach House  
**Location**: Bolinao, Pangasinan  
**Architecture Pattern**: Decoupled Client-Server with Supabase BaaS (PostgreSQL + RLS + Realtime) & WebSocket Real-Time Chatbot  

---

## 1. High-Resolution Architecture Diagram

![System Architecture Diagram](./system_architecture_diagram.png)

> [!TIP]
> **Available Architecture Diagrams & Viewers in this folder:**
> - 🌐 **Interactive System Architecture Viewer**: Open [`view_diagram.html`](./view_diagram.html) in your browser for infinite vector zoom.
> - 🌲 **Interactive Data Hierarchy Explorer**: Open [`data_hierarchy_viewer.html`](./data_hierarchy_viewer.html) in your browser for tabbed entity trees and RBAC levels.
> - 📐 **Vector SVG (System Architecture)**: [`system_architecture_diagram.svg`](./system_architecture_diagram.svg)
> - 📐 **Vector SVG (Data Hierarchy)**: [`data_hierarchy_diagram.svg`](./data_hierarchy_diagram.svg)
> - 🖼️ **High-Res Raster Image**: [`system_architecture_diagram.png`](./system_architecture_diagram.png) (1904 × 1516 pixels).
> - 📄 **Data Hierarchy Technical Document**: [**`docs/database/DATA_HIERARCHY.md`**](../database/DATA_HIERARCHY.md)

---

## 2. Interactive Flowchart (Mermaid)

```mermaid
flowchart TD
    %% -------------------------------------------------------------
    %% CLIENT LAYER
    %% -------------------------------------------------------------
    subgraph ClientTier ["1. Frontend Client Layer (React 18 + Vite + TS)"]
        GuestPortal["Public Guest Portal\n(Booking Flow, Room Gallery, Ocean Synth)"]
        CustomerHub["Guest Experience Hub\n(In-Room Orders, Digital RFID Pass)"]
        StaffPortals["Multi-Role Operations Desks\n(Reception, Accounting, Depts, Executive Admin)"]
        SocketClient["Socket.io Client\n(Realtime Chatbot Socket)"]
        RealtimeClient["Supabase Realtime Client\n(PostgreSQL CDC Listener)"]
    end

    %% -------------------------------------------------------------
    %% SECURITY & GATEWAY PERIMETER
    %% -------------------------------------------------------------
    subgraph SecurityTier ["2. Security & Firewall Perimeter"]
        RateLimit["Rate Limiter\n(Global 300 req / 15m · Booking 5 req / m)"]
        NGWF["Next-Gen Web App Firewall (NGWF)\n(Deep Payload SQLi / XSS / Traversal Filter)"]
        AntiXSS["Anti-XSS Sanitizer\n(Recursive JSON & Query Scrubber)"]
        CSRF["Cookie Tokenizer\n(Double-Submit CSRF Protection)"]
    end

    %% -------------------------------------------------------------
    %% BACKEND APPLICATION SERVER
    %% -------------------------------------------------------------
    subgraph BackendTier ["3. Express.js Backend Server (Node.js)"]
        RESTApi["Modular REST Endpoints\n(/rooms, /reservations, /department, /analytics)"]
        SocketServer["Socket.io Engine\n(J & D Bot AI Concierge)"]
        TelemetryService["Telemetry & Forecasting Engine\n(Live Visitor Heartbeat & Surge Predictor)"]
        UploadEngine["Secure Media Upload Engine\n(MIME Type Whitelist & UUID Filenames)"]
    end

    %% -------------------------------------------------------------
    %% DATABASE & BAAS LAYER
    %% -------------------------------------------------------------
    subgraph DatabaseTier ["4. Supabase Database & BaaS (PostgreSQL 15+)"]
        Tables[("PostgreSQL Relational Tables\nprofiles, rooms, reservations, orders, tasks")]
        GiSTGuard["GiST Exclusion Constraint\n(Hard Overbooking Guard: 0 Double Bookings)"]
        RPC["Stored Procedure: available_rooms()\n(Dynamic Date-Range Availability Matrix)"]
        Triggers["Database Triggers\n(sync_room_rating, handle_new_user, touch_updated_at)"]
        RLS["Row-Level Security (RLS)\n(Self-Data Isolation & is_admin_or_staff Checks)"]
        RealtimePub["Supabase Realtime Engine\n(PostgreSQL WAL Change Data Capture)"]
    end

    %% -------------------------------------------------------------
    %% EXTERNAL SERVICES
    %% -------------------------------------------------------------
    subgraph ExternalServices ["5. External Cloud Integrations"]
        Twilio["Twilio SMS Gateway\n(Transactional Pings & Verification)"]
        Cloudinary["Cloudinary CDN\n(Optimized Image Asset Storage)"]
    end

    %% -------------------------------------------------------------
    %% RELATIONSHIPS & DATA FLOWS (ARROWS)
    %% -------------------------------------------------------------
    %% Client to Security
    GuestPortal -->|"1. HTTPS REST (Browse & Reserve)"| RateLimit
    CustomerHub -->|"1. HTTPS REST (Orders & Digital Key)"| RateLimit
    StaffPortals -->|"1. HTTPS REST (Task Dispatch & Reports)"| RateLimit

    %% Security Pipeline
    RateLimit -->|"2. Rate-Passed Request"| NGWF
    NGWF -->|"3. Threat Inspected"| AntiXSS
    AntiXSS -->|"4. Payload Sanitized"| CSRF
    CSRF -->|"5. CSRF Verified"| RESTApi

    %% WebSocket Bidirectional Chatbot
    SocketClient <=====>|"WSS Duplex (Instant Chat & Typing Events)"| SocketServer
    SocketServer -.->|"Query Room Rates & Info"| RESTApi

    %% Backend to Database
    RESTApi -->|"6. Service-Role SQL Operations"| RLS
    RLS -->|"7. Evaluated Query"| Tables
    RESTApi -->|"8. Availability Check"| RPC
    RPC -->|"9. Scan Active Date Spans"| Tables
    RESTApi -->|"10. Insert Stay Record"| GiSTGuard
    GiSTGuard -->|"11. Overlap Check Passed"| Tables
    Tables -->|"12. On Insert / Update / Delete"| Triggers

    %% Realtime Push (CDC)
    Tables -->|"13. WAL Log Changes"| RealtimePub
    RealtimePub ====>|"14. Realtime WSS Push (Live Table Sync)"| RealtimeClient
    RealtimeClient -.->|"15. Reactive State Refresh"| StaffPortals

    %% External Notifications & Storage
    RESTApi -->|"16. Outbound SMS Ping (Confirmation / Pass)"| Twilio
    Twilio -.->|"17. Inbound Status Webhook (/webhooks/sms/status)"| RESTApi
    UploadEngine -->|"18. Validated Photo Uploads"| Cloudinary
```

---

## 3. Data Flow & Arrow Legend

| Arrow | Protocol | From ➔ To | Purpose & Data Payload |
| :--- | :--- | :--- | :--- |
| **🔵 Blue Solid Arrow (`-->`)** | `HTTPS (REST / JSON)` | **Client Layer ➔ Backend API Gateway** | Transmits room availability inquiries, reservation submissions, in-room service orders, department work orders, and analytics reporting. |
| **🟢 Cyan Duplex Arrow (`<=====>`)** | `WebSocket (WSS)` | **Client Browser ⟷ Socket.io Server** | High-speed, bidirectional communication powering instant guest concierge chat and typing indicators without HTTP polling overhead. |
| **🟣 Purple Solid Arrow (`====>`)** | `WebSocket (CDC)` | **Supabase Realtime ➔ Client Browser** | Listens to PostgreSQL Write-Ahead Log (WAL) event changes on `reservations`, `department_tasks`, and `resort_orders`, pushing instant updates to front desk and staff screens. |
| **🟩 Green Downward Arrow (`-->`)** | `PostgreSQL Wire / REST` | **Backend API ➔ Supabase Database** | Executes administrative database queries using the service role key, invokes the `available_rooms()` stored procedure, and triggers SQL transactions. |
| **🟠 Amber Arrow (`-.->`)** | `HTTPS / Webhooks` | **Backend API ⟷ Twilio SMS Gateway** | Outbound transactional SMS notifications sent upon booking confirmations or check-in, and inbound Twilio delivery receipt callbacks (`sent`, `delivered`, `failed`). |

---

## 4. Architectural Highlights & Invariants

1. **Hard Overbooking Prevention (GiST Constraint)**:
   - PostgreSQL prevents double-booking at the database level using a GiST index exclusion constraint:
     ```sql
     alter table reservations add constraint no_overbooking
       exclude using gist (
         room_id with =,
         daterange(check_in, check_out) with &&
       ) where (status in ('pending','confirmed','checked_in'));
     ```
2. **Next-Generation Web Application Firewall (NGWF)**:
   - Middleware regex inspection layer filtering malicious SQL injection patterns (`UNION SELECT`, `DROP TABLE`), path traversal attacks, command execution, and recursive XSS injections before requests reach route handlers.
3. **Double-Submit CSRF Protection & Tokenization**:
   - Cryptographically random session cookies coupled with header token verification for all state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).
4. **Offline Resilient Client Architecture**:
   - Integrated client-side mock accounts and fallback data structures ensure the frontend remains functional and responsive during staging, offline demos, or network dropouts.
