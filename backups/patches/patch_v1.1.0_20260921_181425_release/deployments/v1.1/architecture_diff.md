# 📊 Architectural Evolution Differential: v1.0.0 ➔ v1.1.0

This document tracks all system modifications, additions, and refactorings between the **Version 1.0 Baseline** and **Version 1.1 Enterprise** releases.

---

## 🔄 Core Changes Matrix

| Subsystem / Area | Version 1.0.0 (Baseline) | Version 1.1.0 (Enterprise) | Impact & Rationale |
| :--- | :--- | :--- | :--- |
| **API Protocol Stack** | REST Only (`/api/*`) | **Tri-API**: REST + Native GraphQL (`/api/graphql`) + WebSockets | Allows flexible data fetching via standard GraphQL without Apollo overhead. |
| **Data Integrity** | Fallback to hardcoded mock arrays (`FALLBACK_*`) on error | **100% Pure Live Data**: Mock data eliminated from client | Prevents silent failures and guarantees UI reflects true database state. |
| **Caching Layer** | No dedicated cache layer | **Redis In-Memory Caching** (`ioredis`) with memory fallback | Caches high-volume room queries and analytics calculations with 60s TTL. |
| **Request Validation** | Zod schemas on selected controllers | **Dual Defense**: Zod + **Joi Schema Validation** (`validateJoi`) | Defense-in-depth input validation preventing malformed or malicious payloads. |
| **Load Balancing** | Single Node process | **Node.js Cluster Load Balancer** + Nginx upstream configuration | Distributes HTTP requests across CPU cores using Round-Robin scheduling. |
| **System Telemetry** | Basic health endpoint (`/api/system/health`) | **Network Status Controller** (`/api/network/status`) + Frontend Widget | Real-time circuit-breaker monitoring database and cache latency. |
| **Security Envelope** | Standard Helmet headers | **Hardened CSP + HSTS (1 yr) + Permissions-Policy + forceHttps** | Strict protection against XSS, clickjacking, open redirects, and non-TLS traffic. |

---

## 📦 Removed Static Mock Collections
The following 10 static fallback datasets were permanently removed from `client/src/lib/api.ts`:
1. `FALLBACK_ROOMS` (hardcoded room inventory)
2. `FALLBACK_ANALYTICS` (synthetic financial curves)
3. `FALLBACK_USERS` (pre-baked staff & customer identities)
4. `FALLBACK_PASS` (static RFID keycard simulator)
5. `FALLBACK_SERVICES` (dining menu fixtures)
6. `FALLBACK_ORDERS` (mock room service tasks)
7. `FALLBACK_TASKS` (mock housekeeping tickets)
8. `FALLBACK_ROOM_STATUS` (mock room status indicators)
9. `FALLBACK_INVENTORY` (mock stock levels)
10. `FALLBACK_REVIEWS` (mock guest reviews)

---

## 🛡️ Security Protections Verified
- `safeRedirect`: Strictly prevents Open Redirect exploits (`//evil.com`, `javascript:`, non-whitelisted hosts).
- `forceHttps`: Automatically redirects HTTP traffic to HTTPS in production environments.
- `joiValidation.js`: Enforces strict payload contracts on reservations, orders, task status, and auth.
- `Permissions-Policy`: Shuts down hardware device exposure (`camera=(), microphone=(), geolocation=()`).

---
*Archived as part of Version 1.1 Enterprise Deployment control.*
