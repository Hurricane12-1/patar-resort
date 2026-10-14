# Tri-API Architecture & High-Performance Caching · Version 1.1

The J & D Beach House resort platform implements a unified **Tri-API Stack** providing three complementary data communication protocols for distinct application workloads:

```
                               ┌──────────────────────────────────────────────┐
                               │       REACT 18 CLIENT WORKSPACES             │
                               │ [CustomerPortal]  [Desks]  [Admin Console]   │
                               └──────────────────────┬───────────────────────┘
                                                      │
                                                      │ Multi-Protocol Dispatch
                                                      ▼
                       ┌──────────────────────────────────────────────────────────────┐
                       │                   TRI-API CLIENT INTERFACE                   │
                       ├──────────────────────┬────────────────────────┬──────────────┤
                       │    HTTP / REST       │   NATIVE GRAPHQL       │  WEBSOCKETS  │
                       │    Fetch Engine      │   (No Apollo)          │  Socket.io   │
                       └──────────┬───────────┴───────────┬────────────┴──────┬───────┘
                                  │                       │                   │
                                  ▼                       ▼                   ▼
                       ┌──────────────────────────────────────────────────────────────┐
                       │                    EXPRESS INGRESS GATEWAY                   │
                       │          Helmet CSP · HSTS · NGWF L7 · Zod + Joi             │
                       └──────────┬───────────────────────┬───────────────────┬───────┘
                                  │                       │                   │
                                  │ /api/*                │ /api/graphql      │ /socket.io/*
                                  ▼                       ▼                   ▼
                       ┌──────────────────────┐ ┌───────────────────┐ ┌───────────────┐
                       │ REST Controllers     │ │ Native GraphQL    │ │ Real-Time AI  │
                       │ (CRUD Transactions)  │ │ Resolvers (Queries│ │ Concierge &   │
                       │                      │ │ & Flexible Shapes)│ │ Telemetry     │
                       └──────────┬───────────┘ └─────────┬─────────┘ └───────┬───────┘
                                  │                       │                   │
                                  └───────────┬───────────┘                   │
                                              │                               │
                                              ▼                               ▼
                       ┌───────────────────────────────────────┐ ┌────────────────────┐
                       │       REDIS IN-MEMORY CACHE           │ │ Bi-Directional     │
                       │ Availability & Analytics (60s TTL)   │ │ Duplex Event Loop  │
                       │ (Resilient In-Memory LRU Fallback)   │ └────────────────────┘
                       └──────────────────────┬────────────────┘
                                              │
                                              ▼
                       ┌──────────────────────────────────────────────────────────────┐
                       │            SUPABASE POSTGRESQL 15+ DATABASE                  │
                       │  Mathematical GiST Overbooking Guard · Row-Level Security    │
                       └──────────────────────────────────────────────────────────────┘
```

---

## 1. The Tri-API Components

### A. REST API (Transactional Mutations)
- **Protocol**: HTTP/1.1 & HTTP/2 over HTTPS (TLS v1.3).
- **Prefix**: `/api/*`.
- **Purpose**: Fast transactional operations, file uploads, authentication, and state mutations.
- **Key Routes**:
  - `POST /api/auth/login`, `GET /api/me`
  - `GET /api/rooms`, `GET /api/availability`
  - `POST /api/reservations` (ACID booking transaction)
  - `GET /api/network/status` (Circuit-breaker telemetry)

### B. Native GraphQL API (No Apollo Overhead)
- **Protocol**: HTTP POST / GET `/api/graphql`.
- **Engine**: Official `graphql` 17.0 reference implementation (`buildSchema`, `graphql()`).
- **Zero Apollo**: Does not pull in Apollo Server or heavy GraphQL wrappers.
- **Purpose**: Flexible, client-defined data shapes for executive dashboards, cross-table relational fetching, and custom reporting.
- **Example Query**:
  ```graphql
  query GetResortOverview {
    rooms {
      id
      name
      category
      rate_php
    }
    analytics {
      occupancy_pct
      total_revenue_php
      adr_php
    }
    networkStatus {
      status
      latency_ms
      db_status
    }
  }
  ```

### C. WebSockets API (Real-Time Duplex Streams)
- **Protocol**: Socket.io (`ws://` / `wss://`).
- **Endpoint**: `/socket.io/`.
- **Purpose**: 24/7 AI guest concierge dialogue, live typing status, and operational task notifications.

---

## 2. High-Performance Redis Caching & Resilient Fallback

Located in [`server/src/lib/redis.js`](file:///c:/Users/Sheep/OneDrive/Documents/Capstone%201%20sided/server/src/lib/redis.js):
- **Client**: `ioredis` with automated connection pooling and exponential backoff retry.
- **Cache Targets**:
  - `graphql:rooms:all`: 60 seconds TTL.
  - `graphql:analytics:overview`: 30 seconds TTL.
- **Resilient Fallback Policy**: If Redis daemon is not running (e.g., local development without Redis), requests instantly fall back to an in-memory TTL Map (`in-memory-lru`). The server maintains 100% uptime with zero crashes.
- **Cache Invalidation**: Mutations (`createReservation`, `updateTaskStatus`) automatically invalidate cache keys to guarantee freshness.

---

## 3. Network Status Controller (`/api/network/status`)

Monitors the real-time circuit state of all backend subsystems:
- **`db_latency_ms`**: Measured roundtrip latency to Supabase PostgreSQL.
- **`redis_latency_ms`**: Latency of cache read/ping.
- **`status`**:
  - `HEALTHY`: All subsystems online, latency < 300ms.
  - `DEGRADED`: Cache fallback active or DB latency elevated.
  - `CRITICAL`: Primary database unreachable.

Rendered in the frontend via [`client/src/components/NetworkStatusControl.tsx`](file:///c:/Users/Sheep/OneDrive/Documents/Capstone%201%20sided/client/src/components/NetworkStatusControl.tsx).
