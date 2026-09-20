# J & D Beach House — Data Hierarchy Diagram

This document contains the native **Mermaid Data Hierarchy Diagram** for the J & D Beach House management system. It renders directly in markdown viewers without requiring raster or static image files.

---

## 1. System Data Hierarchy Diagram (Flowchart TD)

```mermaid
flowchart TD
    %% =============================================================
    %% TIER 0: DATABASE & ENTERPRISE ROOT
    %% =============================================================
    subgraph Tier0 ["Tier 0: Database & Schema Root (PostgreSQL 15+ Supabase)"]
        DBRoot["Database: J & D Beach House Core DB\n(Public Schema · Pgcrypto · Btree_gist)"]
    end

    %% =============================================================
    %% TIER 1: MASTER ASSETS & AUTH ROOTS
    %% =============================================================
    subgraph Tier1 ["Tier 1: Master Roots (Identity & Catalog Assets)"]
        AuthUsers["auth.users\n(Supabase Cryptographic Identity Root)"]
        RoomsCatalog["rooms\n(Accommodation Master Catalog & Unit Inventory)"]
        DeptEnum["dept_name ENUM\n(front_desk · housekeeping · kitchen · tours · maintenance)"]
    end

    %% =============================================================
    %% TIER 2: IDENTITY PROFILES
    %% =============================================================
    subgraph Tier2 ["Tier 2: User Profiles (1:1 Identity Mapping)"]
        Profiles["profiles\n(Full Name · Phone · Address · Emergency Contact)\nRole: customer | staff | receptionist | accounting | administrator"]
    end

    %% =============================================================
    %% TIER 3: CORE TRANSACTIONAL & OPERATIONAL ENGINE
    %% =============================================================
    subgraph Tier3 ["Tier 3: Core Transactional & Operational Entities"]
        Reservations["reservations\n(Check-In · Check-Out · Nights · Total PHP · Stay Status)\n[GiST Exclusion Guard: Zero Double Bookings]"]
        ResortOrders["resort_orders\n(In-Room Dining · Tour Bookings · Amenities · Order Status)"]
        ChatMessages["chat_messages\n(AI Receptionist Dialogues · User / Bot Transcripts)"]
        DeptTasks["department_tasks\n(Task Title · Room Target · Priority · Status · Assigned Staff)"]
        ResortInventory["resort_inventory\n(Supply Item Name · Stock Quantity · Reorder Threshold)"]
    end

    %% =============================================================
    %% TIER 4: LEAF AUDIT & ENGAGEMENT RECORDS
    %% =============================================================
    subgraph Tier4 ["Tier 4: Leaf Transactions & Audit Trails"]
        Reviews["reviews\n(1 to 5 Star Rating · Verified Stay Comment · 1:1 per Stay)"]
        Notifications["notifications\n(Twilio Outbound SMS · Digital Pass Delivery · Status Log)"]
    end

    %% =============================================================
    %% TIER 5: ANALYTICAL AGGREGATION VIEWS
    %% =============================================================
    subgraph Tier5 ["Tier 5: Business Intelligence & Analytics Aggregations"]
        AnalyticsOverview["analytics_overview (View)\n(Occupancy % · Weekly Revenue · Arrivals/Departures · Avg Rating)"]
        AnalyticsDaily["analytics_daily (View)\n(Timeseries Nights Sold · Revenue Projections · Forecast Flag)"]
    end

    %% =============================================================
    %% HIERARCHICAL RELATIONSHIPS & FOREIGN KEYS
    %% =============================================================
    DBRoot -->|"Initializes Schemas & Extensions"| AuthUsers
    DBRoot -->|"Initializes Schemas & Extensions"| RoomsCatalog
    DBRoot -->|"Defines Static Types"| DeptEnum

    AuthUsers -->|"1:1 On Delete Cascade (id -> id)"| Profiles

    Profiles -->|"1:N (guest_id -> profiles.id)"| Reservations
    RoomsCatalog -->|"1:N (room_id -> rooms.id)"| Reservations

    Profiles -->|"1:N (guest_id -> profiles.id)"| ResortOrders
    Profiles -->|"1:N (profile_id -> profiles.id)"| ChatMessages
    Profiles -->|"1:N Optional (created_by -> profiles.id)"| DeptTasks

    DeptEnum -->|"1:N (department -> dept_name)"| DeptTasks
    RoomsCatalog -.->|"0..1:N (room_id -> rooms.id)"| DeptTasks
    DeptEnum -->|"1:N (category -> dept_name)"| ResortInventory

    Reservations -->|"1:1 (reservation_id -> reservations.id)"| Reviews
    RoomsCatalog -->|"1:N (room_id -> rooms.id)"| Reviews
    Profiles -->|"1:N (guest_id -> profiles.id)"| Reviews

    Reservations -->|"1:N (reservation_id -> reservations.id)"| Notifications
    Profiles -->|"1:N (profile_id -> profiles.id)"| Notifications

    Reservations -.->|"Aggregates Stays & Revenue"| AnalyticsOverview
    RoomsCatalog -.->|"Aggregates Active Units"| AnalyticsOverview
    Reviews -.->|"Calculates Overall Avg Rating"| AnalyticsOverview
    Notifications -.->|"Counts Delivered SMS Logs"| AnalyticsOverview

    Reservations -.->|"Aggregates Nightly Pacing"| AnalyticsDaily
```

---

## 2. Entity-Relationship Data Hierarchy (ER Diagram)

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "creates 1:1"
    PROFILES ||--o{ RESERVATIONS : "books (1:N)"
    ROOMS ||--o{ RESERVATIONS : "allocated to (1:N)"
    
    RESERVATIONS ||--o| REVIEWS : "evaluated by (1:1)"
    ROOMS ||--o{ REVIEWS : "rated under (1:N)"
    PROFILES ||--o{ REVIEWS : "written by (1:N)"

    RESERVATIONS ||--o{ NOTIFICATIONS : "triggers (1:N)"
    PROFILES ||--o{ NOTIFICATIONS : "recipient (1:N)"

    PROFILES ||--o{ RESORT_ORDERS : "places (1:N)"
    PROFILES ||--o{ CHAT_MESSAGES : "authors (1:N)"

    PROFILES ||--o{ DEPARTMENT_TASKS : "created by (1:N)"
    ROOMS ||--o{ DEPARTMENT_TASKS : "targeted at (0..1:N)"
    
    DEPT_NAME ||--o{ DEPARTMENT_TASKS : "categorizes (1:N)"
    DEPT_NAME ||--o{ RESORT_INVENTORY : "tracks stock (1:N)"

    AUTH_USERS {
        uuid id PK
        string email
        string encrypted_password
        timestamp created_at
    }

    PROFILES {
        uuid id PK,FK "references auth.users(id)"
        string full_name
        string phone
        string role "customer|staff|receptionist|accounting|administrator"
        string emergency_contact
    }

    ROOMS {
        uuid id PK
        string name
        string category "Cottage | Suite | Villa | Dorm"
        int capacity
        int units "Physical room inventory count"
        int rate_php
        numeric rating_avg
    }

    RESERVATIONS {
        uuid id PK
        uuid guest_id FK "references profiles(id)"
        uuid room_id FK "references rooms(id)"
        date check_in
        date check_out
        int nights "Generated check_out - check_in"
        string status "pending|confirmed|checked_in|checked_out|cancelled"
        int total_php
        daterange no_overbooking "GiST Exclusion Constraint"
    }

    REVIEWS {
        uuid id PK
        uuid reservation_id FK "Unique (1:1 per stay)"
        uuid room_id FK
        uuid guest_id FK
        int rating "1 to 5 stars"
        string comment
    }

    NOTIFICATIONS {
        uuid id PK
        uuid profile_id FK
        uuid reservation_id FK
        string to_phone
        string body
        string status "queued|sent|delivered|failed"
    }

    RESORT_ORDERS {
        uuid id PK
        uuid guest_id FK
        string item_name
        string category "Dining | Tour | Amenity"
        int price_php
        string status "placed|preparing|delivered|cancelled"
    }

    DEPARTMENT_TASKS {
        uuid id PK
        string department "dept_name ENUM"
        string title
        uuid room_id FK "nullable"
        string priority "low|normal|high|urgent"
        string status "pending|in_progress|completed|cancelled"
        string assigned_to
    }

    RESORT_INVENTORY {
        uuid id PK
        string item_name UK
        string category "dept_name ENUM"
        int stock_qty
        int reorder_at
    }
```
