# Frontend API Architecture · J & D Beach House

This directory contains the **Frontend API Architecture Diagrams and Specifications** for the J & D Beach House resort management system.

The architecture describes the 5-layer reactive data and communication pipeline connecting role-based client UI workspaces with the backend Express engine and Supabase PostgreSQL persistence layer.

---

## 🗺️ Visual Architecture Diagram

The frontend API architecture diagram is available in five normalized formats:

| Format | File Path | Usage & Characteristics |
| :--- | :--- | :--- |
| **Interactive HTML Viewer** | [`view_frontend_api_architecture.html`](./view_frontend_api_architecture.html) | Interactive browser viewer with format toggle, zoom controls & layer tabs |
| **Draw.io Native XML** | [`frontend_api_architecture.drawio`](./frontend_api_architecture.drawio) | Native editable file for VS Code Draw.io Extension or [diagrams.net](https://app.diagrams.net/) |
| **Universal XML** | [`frontend_api_architecture.xml`](./frontend_api_architecture.xml) | Universal schema export matching the Draw.io XML structure |
| **Vector SVG** | [`frontend_api_architecture.svg`](./frontend_api_architecture.svg) | Crisp, loss-free vector graphic with infinite zoom |
| **High-Res PNG (4K UHD)** | [`frontend_api_architecture.png`](./frontend_api_architecture.png) | 4K ultra-high-resolution raster rendered via headless browser engine |

---

## 🏛️ The 5 Architectural Layers

```
┌───────────────────────────────────────────────────────────────────────────────┐
│              LAYER 1: UI PRESENTATION & ROLE-BASED WORKSPACES                 │
│  [CustomerPortal]  [ReceptionDesk]  [OperationsDesk]  [Accounting]  [Admin]   │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ React Hooks & Context Consumption
┌──────────────────────────────────────▼────────────────────────────────────────┐
│               LAYER 2: CLIENT STATE & REACT CONTEXT PROVIDERS                 │
│  [AuthContext.tsx]      [TelemetryTracker.tsx]      [useAutoDraft / Toasts]   │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Central Request Invocations
┌──────────────────────────────────────▼────────────────────────────────────────┐
│            LAYER 3: CENTRAL API CLIENT FACADE (client/src/lib/api.ts)          │
│  api.me() · api.rooms() · api.reservations() · api.customer() · api.dept()   │
│  api.analytics() · api.telemetry() · api.admin() · Intelligent Mock Failovers │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Tri-Protocol Gateways
┌──────────────────────────────────────▼────────────────────────────────────────┐
│                 LAYER 4: CLIENT TRANSPORT PROTOCOL GATEWAYS                    │
│   [HTTP/REST Fetch Client]      [Socket.io (WebSockets)]    [Supabase BaaS]   │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Network Boundary (/api/*)
┌──────────────────────────────────────▼────────────────────────────────────────┐
│         LAYER 5: NETWORK INGRESS, REVERSE PROXY & SECURITY BOUNDARY           │
│   [Vite Reverse Proxy] ➔ [Express 4.x Server] ➔ [NGWF L7 Firewall & JWT]      │
│   ➔ [Supabase PostgreSQL 15+ GiST Guard] · [Twilio SMS Gateway]              │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 1. Layer 1: UI Presentation & Role-Based Workspaces
- **Customer Portal**: Direct guest booking flow, room catalog inspection, in-room dining orders, verified reviews, and digital pass access.
- **Reception Desk**: Front desk operations, walk-in reservations, check-in and check-out status transitions, key handovers, and SMS pass re-dispatching.
- **Operations Desk**: Housekeeping task assignments, maintenance request queues, room turnover inspections, and resort inventory stock logging.
- **Accounting & Finance**: Revenue metrics, Average Daily Rate (ADR), Revenue per Available Room (RevPAR), cashier reconciliations, and financial CSV exports.
- **Administrator Console**: Complete Role-Based Access Control (RBAC) management, staff profile creation, role escalation, and system health monitoring.
- **AI Guest Receptionist Widget**: Interactive 24/7 chat concierge providing resort FAQs, pricing details, and live availability assistance.

### 2. Layer 2: Client State & React Context Providers
- **`AuthContext.tsx`**: Manages the JSON Web Token (JWT) lifecycle, user session persistence in `localStorage` (`jd_session`), multi-role RBAC authorization, and offline guest fallback state.
- **`TelemetryTracker.tsx`**: Emits real-time client heartbeat telemetry (`/api/telemetry`), tracking user interaction latency and UI responsiveness.
- **`useAutoDraft.ts`**: Provides automatic form debouncing and draft persistence to avoid data loss during user booking flows.
- **`Toasts.tsx`**: Centralized toast notification system for instant feedback on API mutations.

### 3. Layer 3: Central API Facade (`client/src/lib/api.ts`)
- **Central Request Dispatcher (`req`)**: Unified wrapper over `fetch` that automatically injects `Authorization: Bearer <token>`, manages `Content-Type: application/json`, and parses JSON responses (or handles HTTP 204 No Content).
- **8 Modular Sub-APIs**:
  - `me`: Authenticated profile & session status
  - `rooms`: Accommodation catalog & date-range availability queries
  - `reservations`: Booking creation, stay lifecycle transitions, cancellations
  - `customer`: Resort services catalog, dining orders, digital passes, reviews
  - `department`: Task queues (housekeeping/maintenance), department room status
  - `analytics`: Executive dashboard metrics, RevPAR, weekly revenue, CSV export
  - `telemetry`: Client heartbeats, latency statistics, 7-day predictive pacing
  - `admin`: User management, staff account provisioning, role updates
- **Intelligent Offline Failover**: Built-in mock data collections (`FALLBACK_ROOMS`, `FALLBACK_ANALYTICS`, `FALLBACK_SERVICES`, `FALLBACK_ORDERS`, `FALLBACK_TASKS`, `FALLBACK_USERS`) that guarantee zero client crashes even when the backend server is temporarily unreachable.

### 4. Layer 4: Client Transport Protocol Gateways
- **HTTP / REST (`window.fetch`)**: Standard synchronous CRUD operations over HTTP verbs (`GET`, `POST`, `PATCH`, `DELETE`).
- **WebSockets (`lib/socket.ts`)**: Socket.io duplex connection (`ws://`) for real-time AI guest chat, live typing indicators, and instant receptionist messaging.
- **Supabase BaaS Client (`lib/supabaseClient.ts`)**: Direct database access library for auth state synchronization and PostgreSQL Change Data Capture (CDC) Realtime Broadcast channels.

### 5. Layer 5: Network Ingress, Reverse Proxy & Security Boundary
- **Vite Reverse Proxy**: In development, proxies `/api/*` traffic transparently to the backend Express server on `http://localhost:5000`.
- **Security Perimeter**: Express middleware stack including Next-Generation Web Firewall (NGWF Layer 7 rules), anti-XSS request sanitization, and cryptographic JWT verification.
- **Core Database & External Services**: Supabase PostgreSQL 15+ engine enforced by mathematical GiST exclusion constraints (zero overbooking guarantee), Row-Level Security (RLS), and Twilio Cloud SMS dispatch.

---

## ⚡ Handlers Architecture (Presentation ➔ Facade ➔ Express Routes)

The architecture establishes a tri-tier handler pipeline to cleanly decouple user interaction, client protocol dispatching, resilience handling, and server execution:

```
[UI Component Event] ──(Dispatches)──> [UI Action Handler]
                                              │
                                              ▼
                                 [Client Facade Pipeline Handler]
                                 • req(path, opts) master dispatch
                                 • bearerTokenHandler() JWT injection
                                 • responseHandler() status validation
                                 • mockFallbackHandler() failover
                                              │
                                              ▼ (HTTP / WS Wire)
                                 [Express Route Handler / Controller]
                                 • authRouteHandler
                                 • roomsRouteHandler
                                 • reservationsHandler
                                 • customerOrdersHandler
                                 • departmentTasksHandler
                                 • globalErrorHandlerMiddleware
```

### Tier 1: UI Event Handlers (Presentation Layer)
- `handleBookingSubmit(e)`: Form submit event in `CustomerPortal`; validates check-in/out dates, adult/child headcounts, and triggers `api.createReservation()`.
- `handleCheckInOut(resId, status)`: Reception Desk table action handler; confirms guest arrival or departure, updating reservation status via `api.setReservationStatus()`.
- `handleTaskUpdate(taskId, status)`: Operations Desk task board handler; shifts housekeeping or maintenance jobs between *Pending*, *In Progress*, and *Completed* via `api.updateTaskStatus()`.
- `handleChatSubmit(message)`: AI Concierge widget handler; dispatches real-time guest prompt via `socket.emit('chat:message')`.
- `handleLoginSubmit(credentials)`: Authentication modal handler; dispatches credentials to `AuthContext.login()`.
- `handleOrderSubmit(cart)`: In-room dining and activity booking handler; submits order payload via `api.placeCustomerOrder()`.

### Tier 2: Client Interceptor & Error Handlers (`lib/api.ts`)
- `req(path, options)`: Master fetch handler wrapping native `window.fetch`, JSON serialization, headers merging, and query string formatting.
- `bearerTokenHandler()`: Token injection handler that resolves JWT from `localStorage` (`jd_session`) and prepends `Authorization: Bearer <token>`.
- `responseHandler(res)`: HTTP response interceptor that evaluates response codes (200, 201, 204 No Content) and formats JSON payloads or instantiates typed `ApiError`.
- `mockFallbackHandler(err)`: Intelligent error recovery handler; detects server unavailability (HTTP 500, network disconnects) and returns cached memory fixtures (`FALLBACK_*`) without throwing unhandled exceptions to UI views.
- `wsEventHandler(event, payload)`: Socket interceptor for bi-directional event stream management, auto-reconnects, and typing indicators.

### Tier 3: Express Backend Route Handlers & Controllers
- `authRouteHandler`: Mounted at `/api/auth/*` and `/api/me`; executes password hash comparison (bcrypt), token issuance, and authenticated identity lookup.
- `roomsRouteHandler`: Mounted at `/api/rooms` and `/api/availability`; queries room catalog and executes PostgreSQL GiST range overlap queries.
- `reservationsHandler`: Mounted at `/api/reservations/*`; manages transactional room booking, status changes, and dispatches Twilio SMS confirmation passes.
- `customerOrdersHandler`: Mounted at `/api/orders` and `/api/services`; validates resort service requests and posts room billing charges.
- `departmentTasksHandler`: Mounted at `/api/tasks/*`; manages role-restricted housekeeping and maintenance assignment workflows.
- `globalErrorHandler`: Terminal Express error middleware; intercepts uncaught exceptions and formats RFC 7807-compliant error payloads (`{ error, message, statusCode }`).

---

## 🛠️ Automated Diagram Regeneration via MCP

To regenerate or update diagrams across the repository, use the custom `command-prompt` MCP server or node CLI:

```bash
# Regenerate all diagrams:
node scripts/diagram-tool.js --target=all

# Regenerate frontend API architecture diagram only:
node scripts/diagram-tool.js --target=api

# Regenerate data hierarchy diagram only:
node scripts/diagram-tool.js --target=data-hierarchy

# Regenerate ER diagram only:
node scripts/diagram-tool.js --target=er
```

This compiles:
1. `docs/data-hierarchy/data_hierarchy_diagram.*` (Data Hierarchy Flowchart)
2. `docs/data-hierarchy/entity_relationship_diagram.*` (ER Diagram)
3. `docs/api/frontend_api_architecture.*` (Frontend API Architecture Diagram)

