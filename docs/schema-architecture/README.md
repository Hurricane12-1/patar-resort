# 🗄️ J & D Reserve · Schema Collection Architecture

**System**: J & D Reserve (Online Reservation and Booking Management System)  
**Location**: J & D Beach House, Barangay Patar, Bolinao, Pangasinan  
**Architecture Spec**: 4-Tier Distributed Schema Collection (PostgreSQL, Joi/Zod, GraphQL, Redis)

---

## 1. Schema Collection Overview

The **Schema Collection** of J & D Reserve is organized into four synchronized tiers ensuring strict validation, type safety, relational integrity, and microsecond caching performance:

```
+---------------------------------------------------------------------------------------+
|                TIER 1: VALIDATION SCHEMA & DTO COLLECTION (JOI / ZOD)                 |
|    - AuthValidationSchema (E.164 phone, email, password strength, user roles)         |
|    - ReservationSchema (ISO8601 date logic, capacity constraints, guest counts)      |
|    - AccountRecoverySchema (6-digit OTP verification, phone regex, session tokens)   |
|    - DepartmentOperationsSchema (Department enums, task priority, status machines)    |
+---------------------------------------------------------------------------------------+
                                           │ (Validated Input)
                                           ▼
+---------------------------------------------------------------------------------------+
|               TIER 2: API CONTRACT SCHEMA COLLECTION (GRAPHQL & REST)                 |
|    - GraphQL Query / Mutation / Subscription SDL Type Definitions                     |
|    - Standard REST API Response Envelopes: { status, data, message, error }           |
|    - RFC 6585 RateLimit Headers (Limit, Remaining, Reset, Retry-After)                |
+---------------------------------------------------------------------------------------+
                                           │ (Evaluated Query / Mutex)
                                           ▼
+---------------------------------------------------------------------------------------+
|            TIER 3: RELATIONAL DATABASE SCHEMA COLLECTION (POSTGRESQL 15+)             |
|    - profiles (UUID PK references auth.users, full_name, phone, role enum)           |
|    - rooms (Villas, Suites, Cottages, rate_php, capacity, denormalized rating_avg)    |
|    - reservations (Date ranges, nights, status enum, total_php)                       |
|      🛡️ GiST CONSTRAINT no_overbooking (Zero overlapping dates per room unit)         |
|    - reviews (1:1 verified stay binding, ratings 1..5, trigger sync_room_rating)     |
|    - notifications (SMS/Email dispatch records, Twilio provider SID, notif_status)   |
|    - department_tasks (Front desk, housekeeping, kitchen, maintenance operations)     |
|    - resort_orders (In-room dining, bangus specials, amenity rentals, tour booking)   |
|    - resort_inventory (Asset management, reorder thresholds, units)                   |
|    - chat_messages (Real-time Socket.io customer care transcripts)                    |
+---------------------------------------------------------------------------------------+
                                           │ (Cached Queries & State)
                                           ▼
+---------------------------------------------------------------------------------------+
|          TIER 4: IN-MEMORY & DISTRIBUTED CACHE KEY SCHEMA COLLECTION (REDIS)          |
|    - room:{id} & rooms:catalog (Sub-millisecond room metadata, TTL: 300s - 600s)     |
|    - analytics:overview & analytics:trends (Occupancy % & revenue, TTL: 60s - 300s)  |
|    - limiter:gcra:{key} (Generalized Cell Rate Algorithm state, microsecond checks)   |
|    - session:{jwt_hash} & otp:{phone} (Auth token state, rolling 24h & 300s TTLs)    |
+---------------------------------------------------------------------------------------+
```

---

## 2. Diagram Files in this Directory

| File Name | Format | Purpose | How to View / Open |
| :--- | :---: | :--- | :--- |
| **`view_schema_architecture.html`** | Interactive HTML | Complete interactive web viewer with zoom & controls | Double-click to open in any web browser |
| **`schema_collection_architecture.svg`** | Vector SVG | Lossless, scalable high-definition vector diagram | Open in browser, Illustrator, or Figma |
| **`schema_collection_architecture.png`** | 4K Raster PNG | High-resolution image for presentations and thesis binder | Open in Windows Photos or insert into Word/PowerPoint |
| **`schema_collection_architecture.drawio`** | Draw.io XML | Editable diagram project file | Open in [app.diagrams.net](https://app.diagrams.net) |

---

## 3. Key Relational Safeguards in the Schema

1. **Hard Overbooking Prevention via GiST Constraint**:
   ```sql
   alter table reservations add constraint no_overbooking
     exclude using gist (
       room_id with =,
       daterange(check_in, check_out) with &&
     ) where (status in ('pending','confirmed','checked_in'));
   ```
   *Prevents double bookings directly at the database engine level with mathematical certainty.*

2. **Denormalized Rating Recalculation Trigger**:
   Whenever a verified review is inserted or updated, a PostgreSQL trigger automatically recalculates `rating_avg` and `rating_count` on the corresponding `rooms` record in $O(1)$ read time.

3. **Row-Level Security (RLS)**:
   Guests can only inspect and modify their own bookings and orders, while Staff and Administrators possess role-based access across department queues.
