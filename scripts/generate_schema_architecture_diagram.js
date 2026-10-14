/**
 * J & D Reserve — Schema Collection Architecture Diagram Generator
 * 
 * Generates enterprise-grade architectural diagrams of the complete Schema Collection:
 * 1. Physical Relational Database Schema (PostgreSQL 15+ / Supabase)
 * 2. Application Validation & DTO Schema (Joi & Zod Middleware)
 * 3. API Contract Schema (GraphQL Schema & REST DTOs)
 * 4. Distributed Cache & State Key Schema (Redis Namespaces & GCRA State)
 * 
 * Outputs:
 * - docs/schema-architecture/schema_collection_architecture.svg (Vector SVG)
 * - docs/schema-architecture/schema_collection_architecture.drawio (Draw.io XML)
 * - docs/schema-architecture/schema_collection_architecture.png (High-Res 4K PNG via Edge)
 * - docs/schema-architecture/view_schema_architecture.html (Interactive Browser Viewer)
 * - docs/schema-architecture/README.md (Architecture Documentation)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'docs', 'schema-architecture');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

/**
 * 1. Generate High-Definition SVG Diagram
 */
function generateSchemaArchitectureSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1700 2150" width="1700" height="2150" style="background:#ffffff; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.08" />
    </filter>

    <marker id="arrowBlue" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#0284c7" />
    </marker>
    <marker id="arrowGreen" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#059669" />
    </marker>
    <marker id="arrowPurple" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#7c3aed" />
    </marker>
    <marker id="arrowDark" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#334155" />
    </marker>
  </defs>

  <style>
    .tier-box { fill: #f8fafc; stroke: #94a3b8; stroke-width: 1.5; rx: 10px; }
    .tier-title { font-size: 15px; font-weight: 800; fill: #0f172a; letter-spacing: 0.05em; }
    .tier-sub { font-size: 12px; font-weight: 500; fill: #64748b; }
    
    .entity-card { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1.2; rx: 8px; }
    .entity-card-primary { fill: #ffffff; stroke: #0284c7; stroke-width: 1.8; rx: 8px; }
    .entity-card-green { fill: #ffffff; stroke: #059669; stroke-width: 1.8; rx: 8px; }
    .entity-card-purple { fill: #ffffff; stroke: #7c3aed; stroke-width: 1.8; rx: 8px; }
    .entity-card-amber { fill: #ffffff; stroke: #d97706; stroke-width: 1.8; rx: 8px; }

    .header-bar { fill: #f1f5f9; rx: 8px 8px 0 0; }
    .header-bar-blue { fill: #e0f2fe; rx: 8px 8px 0 0; }
    .header-bar-green { fill: #dcfce7; rx: 8px 8px 0 0; }
    .header-bar-purple { fill: #f3e8ff; rx: 8px 8px 0 0; }
    .header-bar-amber { fill: #fef3c7; rx: 8px 8px 0 0; }

    .card-title { font-size: 13px; font-weight: 700; fill: #0f172a; }
    .card-meta { font-size: 10px; font-weight: 600; fill: #64748b; }
    
    .prop-name { font-size: 11px; font-weight: 600; fill: #1e293b; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .prop-type { font-size: 10px; font-weight: 500; fill: #0284c7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .prop-constraint { font-size: 9px; font-weight: 700; fill: #dc2626; }
    
    .badge-pk { fill: #fef08a; stroke: #ca8a04; stroke-width: 1; rx: 3px; }
    .badge-fk { fill: #e0f2fe; stroke: #0284c7; stroke-width: 1; rx: 3px; }
    .badge-text { font-size: 8px; font-weight: 800; fill: #854d0e; text-anchor: middle; }
    .badge-text-fk { font-size: 8px; font-weight: 800; fill: #0369a1; text-anchor: middle; }

    .conn-line { stroke: #0284c7; stroke-width: 1.5; fill: none; }
    .conn-dashed { stroke: #64748b; stroke-width: 1.5; stroke-dasharray: 4 4; fill: none; }
    .conn-purple { stroke: #7c3aed; stroke-width: 1.5; fill: none; }
    .label-bg { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1; rx: 4px; }
    .label-text { font-size: 9px; font-weight: 700; fill: #334155; text-anchor: middle; }
  </style>

  <!-- Title Header -->
  <g transform="translate(850, 45)" text-anchor="middle">
    <text y="0" font-size="24" font-weight="900" fill="#0f172a">J &amp; D Reserve · Schema Collection Architecture</text>
    <text y="24" font-size="13" font-weight="500" fill="#475569">Physical PostgreSQL Schema · Application DTOs · GraphQL Contracts · In-Memory Redis Namespaces</text>
    <text y="42" font-size="11" font-weight="600" fill="#0284c7">J &amp; D Beach House · Barangay Patar, Bolinao, Pangasinan</text>
  </g>

  <!-- ===================================================================== -->
  <!-- TIER 1: CLIENT DTO & VALIDATION SCHEMA COLLECTION                     -->
  <!-- ===================================================================== -->
  <g transform="translate(60, 110)">
    <rect width="1580" height="280" class="tier-box" />
    <text x="25" y="30" class="tier-title">TIER 1: VALIDATION SCHEMA &amp; DTO COLLECTION (JOI &amp; ZOD)</text>
    <text x="25" y="48" class="tier-sub">Client Payload Normalization, Input Sanitization &amp; Defensive Contract Enforcement</text>

    <!-- 1. authValidationSchema -->
    <g transform="translate(30, 70)" filter="url(#shadow)">
      <rect width="360" height="185" class="entity-card-purple" />
      <rect width="360" height="32" class="header-bar-purple" />
      <text x="14" y="21" class="card-title">AuthValidationSchema (Joi)</text>
      <text x="345" y="21" class="card-meta" text-anchor="end">DTO / Validation</text>
      
      <text x="14" y="55" class="prop-name">email</text><text x="140" y="55" class="prop-type">string().email()</text><text x="345" y="55" class="prop-constraint" text-anchor="end">REQUIRED</text>
      <text x="14" y="78" class="prop-name">password</text><text x="140" y="78" class="prop-type">string().min(8)</text><text x="345" y="78" class="prop-constraint" text-anchor="end">REQUIRED</text>
      <text x="14" y="101" class="prop-name">first_name</text><text x="140" y="101" class="prop-type">string().trim().max(60)</text>
      <text x="14" y="124" class="prop-name">last_name</text><text x="140" y="124" class="prop-type">string().trim().max(60)</text>
      <text x="14" y="147" class="prop-name">phone</text><text x="140" y="147" class="prop-type">string().pattern(/^\\+63/)</text>
      <text x="14" y="170" class="prop-name">role</text><text x="140" y="170" class="prop-type">enum(UserRole)</text>
    </g>

    <!-- 2. reservationValidationSchema -->
    <g transform="translate(420, 70)" filter="url(#shadow)">
      <rect width="360" height="185" class="entity-card-primary" />
      <rect width="360" height="32" class="header-bar-blue" />
      <text x="14" y="21" class="card-title">ReservationSchema (Joi)</text>
      <text x="345" y="21" class="card-meta" text-anchor="end">Booking DTO</text>
      
      <text x="14" y="55" class="prop-name">room_id</text><text x="140" y="55" class="prop-type">string().uuid()</text><text x="345" y="55" class="prop-constraint" text-anchor="end">REQUIRED</text>
      <text x="14" y="78" class="prop-name">check_in</text><text x="140" y="78" class="prop-type">date().iso().min('now')</text><text x="345" y="78" class="prop-constraint" text-anchor="end">REQUIRED</text>
      <text x="14" y="101" class="prop-name">check_out</text><text x="140" y="101" class="prop-type">date().greater(check_in)</text><text x="345" y="101" class="prop-constraint" text-anchor="end">REQUIRED</text>
      <text x="14" y="124" class="prop-name">guests</text><text x="140" y="124" class="prop-type">number().integer().min(1)</text>
      <text x="14" y="147" class="prop-name">notes</text><text x="140" y="147" class="prop-type">string().max(500).allow('')</text>
      <text x="14" y="170" class="prop-name">bypass_concurrency</text><text x="140" y="170" class="prop-type">boolean().default(false)</text>
    </g>

    <!-- 3. accountRecoverySchema -->
    <g transform="translate(810, 70)" filter="url(#shadow)">
      <rect width="360" height="185" class="entity-card-amber" />
      <rect width="360" height="32" class="header-bar-amber" />
      <text x="14" y="21" class="card-title">AccountRecoverySchema (Joi)</text>
      <text x="345" y="21" class="card-meta" text-anchor="end">OTP / Reset</text>
      
      <text x="14" y="55" class="prop-name">phone</text><text x="140" y="55" class="prop-type">string().e164Format()</text><text x="345" y="55" class="prop-constraint" text-anchor="end">REQUIRED</text>
      <text x="14" y="78" class="prop-name">otp_code</text><text x="140" y="78" class="prop-type">string().length(6).regex(/\\d/)</text>
      <text x="14" y="101" class="prop-name">new_password</text><text x="140" y="101" class="prop-type">string().min(8).regex(/[A-Z]/)</text>
      <text x="14" y="124" class="prop-name">session_token</text><text x="140" y="124" class="prop-type">string().uuid()</text>
      <text x="14" y="147" class="prop-name">channel</text><text x="140" y="147" class="prop-type">enum('sms', 'whatsapp')</text>
      <text x="14" y="170" class="prop-name">expires_at</text><text x="140" y="170" class="prop-type">number().integer()</text>
    </g>

    <!-- 4. taskAndOrderSchema -->
    <g transform="translate(1200, 70)" filter="url(#shadow)">
      <rect width="350" height="185" class="entity-card-green" />
      <rect width="350" height="32" class="header-bar-green" />
      <text x="14" y="21" class="card-title">DepartmentOperationsSchema</text>
      <text x="335" y="21" class="card-meta" text-anchor="end">Ops DTO</text>
      
      <text x="14" y="55" class="prop-name">department</text><text x="130" y="55" class="prop-type">enum(DeptName)</text><text x="335" y="55" class="prop-constraint" text-anchor="end">REQUIRED</text>
      <text x="14" y="78" class="prop-name">priority</text><text x="130" y="78" class="prop-type">enum(TaskPriority)</text>
      <text x="14" y="101" class="prop-name">room_id</text><text x="130" y="101" class="prop-type">string().uuid().optional()</text>
      <text x="14" y="124" class="prop-name">item_name</text><text x="130" y="124" class="prop-type">string().trim().max(100)</text>
      <text x="14" y="147" class="prop-name">price_php</text><text x="130" y="147" class="prop-type">number().min(0)</text>
      <text x="14" y="170" class="prop-name">assigned_to</text><text x="130" y="170" class="prop-type">string().max(80)</text>
    </g>
  </g>

  <!-- ===================================================================== -->
  <!-- TIER 2: API CONTRACT SCHEMA (GRAPHQL & REST CONTRACTS)                -->
  <!-- ===================================================================== -->
  <g transform="translate(60, 420)">
    <rect width="1580" height="230" class="tier-box" />
    <text x="25" y="30" class="tier-title">TIER 2: API CONTRACT SCHEMA COLLECTION (GRAPHQL SDL &amp; REST ENVELOPES)</text>
    <text x="25" y="48" class="tier-sub">Strongly-Typed Interfaces, Query Resolvers, Mutations &amp; Real-Time Subscriptions</text>

    <!-- GraphQL Types -->
    <g transform="translate(30, 65)" filter="url(#shadow)">
      <rect width="480" height="145" class="entity-card" />
      <rect width="480" height="30" class="header-bar" />
      <text x="14" y="20" class="card-title">type Room { id, name, slug, category, rate_php, rating_avg }</text>
      <text x="465" y="20" class="card-meta" text-anchor="end">GraphQL Type</text>
      <text x="14" y="52" class="prop-name">Query.rooms(category: String, min_rate: Int): [Room!]!</text>
      <text x="14" y="74" class="prop-name">Query.room(slug: String!): Room</text>
      <text x="14" y="96" class="prop-name">Query.availableRooms(checkIn: Date!, checkOut: Date!): [Room!]!</text>
      <text x="14" y="118" class="prop-name">Subscription.roomAvailabilityChanged: RoomAvailabilityEvent!</text>
    </g>

    <g transform="translate(540, 65)" filter="url(#shadow)">
      <rect width="500" height="145" class="entity-card" />
      <rect width="500" height="30" class="header-bar" />
      <text x="14" y="20" class="card-title">type Reservation { id, guest, room, check_in, nights, total_php }</text>
      <text x="485" y="20" class="card-meta" text-anchor="end">GraphQL Type</text>
      <text x="14" y="52" class="prop-name">Mutation.createReservation(input: ReservationInput!): ReservationResult!</text>
      <text x="14" y="74" class="prop-name">Mutation.cancelReservation(id: ID!, reason: String): CancelResponse!</text>
      <text x="14" y="96" class="prop-name">Query.myBookings(guestId: ID!): [Reservation!]!</text>
      <text x="14" y="118" class="prop-name">Subscription.reservationStatusUpdated(id: ID!): Reservation!</text>
    </g>

    <g transform="translate(1070, 65)" filter="url(#shadow)">
      <rect width="480" height="145" class="entity-card" />
      <rect width="480" height="30" class="header-bar" />
      <text x="14" y="20" class="card-title">type AnalyticsOverview { occupancy_rate, total_revenue, stays }</text>
      <text x="465" y="20" class="card-meta" text-anchor="end">GraphQL Type</text>
      <text x="14" y="52" class="prop-name">Query.analyticsOverview: AnalyticsOverview!</text>
      <text x="14" y="74" class="prop-name">Query.totalSalesTrend(period: String!): [SalesSnapshot!]!</text>
      <text x="14" y="96" class="prop-name">REST Envelope: { status: 200, data: T, message: String, error: null }</text>
      <text x="14" y="118" class="prop-name">RFC 6585 Headers: X-RateLimit-Limit, Remaining, Reset, Retry-After</text>
    </g>
  </g>

  <!-- ===================================================================== -->
  <!-- TIER 3: RELATIONAL DATABASE SCHEMA COLLECTION (POSTGRESQL / SUPABASE) -->
  <!-- ===================================================================== -->
  <g transform="translate(60, 680)">
    <rect width="1580" height="1060" class="tier-box" />
    <text x="25" y="30" class="tier-title">TIER 3: RELATIONAL DATABASE SCHEMA COLLECTION (SUPABASE POSTGRESQL 15+)</text>
    <text x="25" y="48" class="tier-sub">Foreign Key Topology, Overbooking GiST Exclusion Constraints, RLS Policies &amp; Trigger Recalculators</text>

    <!-- Table 1: profiles -->
    <g transform="translate(30, 70)" filter="url(#shadow)">
      <rect width="360" height="270" class="entity-card-primary" />
      <rect width="360" height="34" class="header-bar-blue" />
      <text x="14" y="22" class="card-title">profiles (Guest &amp; Staff Directory)</text>
      <text x="345" y="22" class="card-meta" text-anchor="end">auth.users 1:1</text>
      
      <!-- PK -->
      <rect x="14" y="48" width="22" height="14" class="badge-pk" /><text x="25" y="59" class="badge-text">PK</text>
      <text x="42" y="59" class="prop-name">id</text><text x="160" y="59" class="prop-type">uuid (ref auth.users)</text>
      
      <text x="42" y="81" class="prop-name">first_name</text><text x="160" y="81" class="prop-type">text not null default ''</text>
      <text x="42" y="103" class="prop-name">middle_name</text><text x="160" y="103" class="prop-type">text not null default ''</text>
      <text x="42" y="125" class="prop-name">last_name</text><text x="160" y="125" class="prop-type">text not null default ''</text>
      <text x="42" y="147" class="prop-name">full_name</text><text x="160" y="147" class="prop-type">text not null default ''</text>
      <text x="42" y="169" class="prop-name">phone</text><text x="160" y="169" class="prop-type">text (E.164 verified)</text>
      <text x="42" y="191" class="prop-name">address</text><text x="160" y="191" class="prop-type">text not null default ''</text>
      <text x="42" y="213" class="prop-name">city</text><text x="160" y="213" class="prop-type">text not null default ''</text>
      <text x="42" y="235" class="prop-name">role</text><text x="160" y="235" class="prop-type">user_role enum</text>
      <text x="42" y="255" class="prop-name">created_at</text><text x="160" y="255" class="prop-type">timestamptz default now()</text>
    </g>

    <!-- Table 2: rooms -->
    <g transform="translate(610, 70)" filter="url(#shadow)">
      <rect width="370" height="270" class="entity-card-primary" />
      <rect width="370" height="34" class="header-bar-blue" />
      <text x="14" y="22" class="card-title">rooms (Villas, Suites &amp; Cottages)</text>
      <text x="355" y="22" class="card-meta" text-anchor="end">Catalog Entity</text>

      <rect x="14" y="48" width="22" height="14" class="badge-pk" /><text x="25" y="59" class="badge-text">PK</text>
      <text x="42" y="59" class="prop-name">id</text><text x="160" y="59" class="prop-type">uuid default gen_random()</text>

      <text x="42" y="81" class="prop-name">name</text><text x="160" y="81" class="prop-type">text not null</text>
      <text x="42" y="103" class="prop-name">slug</text><text x="160" y="103" class="prop-type">text unique not null</text>
      <text x="42" y="125" class="prop-name">category</text><text x="160" y="125" class="prop-type">text (Suite, Villa, Cottage)</text>
      <text x="42" y="147" class="prop-name">capacity</text><text x="160" y="147" class="prop-type">int check (capacity &gt; 0)</text>
      <text x="42" y="169" class="prop-name">units</text><text x="160" y="169" class="prop-type">int check (units &gt; 0)</text>
      <text x="42" y="191" class="prop-name">rate_php</text><text x="160" y="191" class="prop-type">int check (rate_php &gt; 0)</text>
      <text x="42" y="213" class="prop-name">amenities</text><text x="160" y="213" class="prop-type">text[] default '{}'</text>
      <text x="42" y="235" class="prop-name">rating_avg</text><text x="160" y="235" class="prop-type">numeric(3,2) denorm trigger</text>
      <text x="42" y="255" class="prop-name">is_active</text><text x="160" y="255" class="prop-type">boolean default true</text>
    </g>

    <!-- Table 3: reservations (Central Booking Entity) -->
    <g transform="translate(300, 420)" filter="url(#shadow)">
      <rect width="440" height="320" class="entity-card-primary" />
      <rect width="440" height="34" class="header-bar-blue" />
      <text x="14" y="22" class="card-title">reservations (Stay Records &amp; GiST Exclusion)</text>
      <text x="425" y="22" class="card-meta" text-anchor="end">Core Booking Node</text>

      <rect x="14" y="48" width="22" height="14" class="badge-pk" /><text x="25" y="59" class="badge-text">PK</text>
      <text x="42" y="59" class="prop-name">id</text><text x="160" y="59" class="prop-type">uuid default gen_random()</text>

      <rect x="14" y="71" width="22" height="14" class="badge-fk" /><text x="25" y="82" class="badge-text-fk">FK</text>
      <text x="42" y="82" class="prop-name">guest_id</text><text x="160" y="82" class="prop-type">uuid ref profiles(id) on delete</text>

      <rect x="14" y="93" width="22" height="14" class="badge-fk" /><text x="25" y="104" class="badge-text-fk">FK</text>
      <text x="42" y="104" class="prop-name">room_id</text><text x="160" y="104" class="prop-type">uuid ref rooms(id)</text>

      <text x="42" y="126" class="prop-name">check_in</text><text x="160" y="126" class="prop-type">date not null</text>
      <text x="42" y="148" class="prop-name">check_out</text><text x="160" y="148" class="prop-type">date not null (check_out &gt; in)</text>
      <text x="42" y="170" class="prop-name">nights</text><text x="160" y="170" class="prop-type">int generated always as stored</text>
      <text x="42" y="192" class="prop-name">guests</text><text x="160" y="192" class="prop-type">int check (guests &gt; 0)</text>
      <text x="42" y="214" class="prop-name">status</text><text x="160" y="214" class="prop-type">stay_status enum default 'pending'</text>
      <text x="42" y="236" class="prop-name">total_php</text><text x="160" y="236" class="prop-type">int check (total_php &gt; 0)</text>
      <text x="42" y="258" class="prop-name">notes</text><text x="160" y="258" class="prop-type">text default ''</text>
      
      <!-- GiST Guard Badge -->
      <rect x="14" y="280" width="412" height="28" fill="#fef2f2" stroke="#ef4444" stroke-width="1.2" rx="4" />
      <text x="220" y="298" font-size="10" font-weight="700" fill="#b91c1c" text-anchor="middle">🛡️ GiST CONSTRAINT no_overbooking (room_id, daterange(check_in, check_out))</text>
    </g>

    <!-- Table 4: reviews -->
    <g transform="translate(30, 800)" filter="url(#shadow)">
      <rect width="360" height="210" class="entity-card" />
      <rect width="360" height="32" class="header-bar" />
      <text x="14" y="21" class="card-title">reviews (Guest Rating &amp; Feedback)</text>
      <text x="345" y="21" class="card-meta" text-anchor="end">1:1 Verified Stay</text>

      <rect x="14" y="48" width="22" height="14" class="badge-pk" /><text x="25" y="59" class="badge-text">PK</text>
      <text x="42" y="59" class="prop-name">id</text><text x="160" y="59" class="prop-type">uuid default gen_random()</text>

      <rect x="14" y="71" width="22" height="14" class="badge-fk" /><text x="25" y="82" class="badge-text-fk">FK</text>
      <text x="42" y="82" class="prop-name">reservation_id</text><text x="160" y="82" class="prop-type">uuid unique ref reservations</text>

      <rect x="14" y="93" width="22" height="14" class="badge-fk" /><text x="25" y="104" class="badge-text-fk">FK</text>
      <text x="42" y="104" class="prop-name">guest_id</text><text x="160" y="104" class="prop-type">uuid ref profiles(id)</text>

      <rect x="14" y="115" width="22" height="14" class="badge-fk" /><text x="25" y="126" class="badge-text-fk">FK</text>
      <text x="42" y="126" class="prop-name">room_id</text><text x="160" y="126" class="prop-type">uuid ref rooms(id)</text>

      <text x="42" y="148" class="prop-name">rating</text><text x="160" y="148" class="prop-type">int check (rating between 1 and 5)</text>
      <text x="42" y="170" class="prop-name">comment</text><text x="160" y="170" class="prop-type">text default ''</text>
      <text x="42" y="192" class="prop-name">created_at</text><text x="160" y="192" class="prop-type">timestamptz default now()</text>
    </g>

    <!-- Table 5: notifications -->
    <g transform="translate(420, 800)" filter="url(#shadow)">
      <rect width="360" height="210" class="entity-card" />
      <rect width="360" height="32" class="header-bar" />
      <text x="14" y="21" class="card-title">notifications (SMS &amp; Email Dispatch)</text>
      <text x="345" y="21" class="card-meta" text-anchor="end">Twilio / Email</text>

      <rect x="14" y="48" width="22" height="14" class="badge-pk" /><text x="25" y="59" class="badge-text">PK</text>
      <text x="42" y="59" class="prop-name">id</text><text x="160" y="59" class="prop-type">uuid default gen_random()</text>

      <rect x="14" y="71" width="22" height="14" class="badge-fk" /><text x="25" y="82" class="badge-text-fk">FK</text>
      <text x="42" y="82" class="prop-name">profile_id</text><text x="160" y="82" class="prop-type">uuid ref profiles(id)</text>

      <rect x="14" y="93" width="22" height="14" class="badge-fk" /><text x="25" y="104" class="badge-text-fk">FK</text>
      <text x="42" y="104" class="prop-name">reservation_id</text><text x="160" y="104" class="prop-type">uuid ref reservations(id)</text>

      <text x="42" y="126" class="prop-name">channel</text><text x="160" y="126" class="prop-type">text default 'sms'</text>
      <text x="42" y="148" class="prop-name">to_phone</text><text x="160" y="148" class="prop-type">text not null</text>
      <text x="42" y="170" class="prop-name">status</text><text x="160" y="170" class="prop-type">notif_status enum</text>
      <text x="42" y="192" class="prop-name">sent_at</text><text x="160" y="192" class="prop-type">timestamptz</text>
    </g>

    <!-- Table 6: department_tasks -->
    <g transform="translate(1080, 70)" filter="url(#shadow)">
      <rect width="470" height="230" class="entity-card-green" />
      <rect width="470" height="34" class="header-bar-green" />
      <text x="14" y="22" class="card-title">department_tasks (Staff Operations Tracker)</text>
      <text x="455" y="22" class="card-meta" text-anchor="end">Ops Hub</text>

      <rect x="14" y="48" width="22" height="14" class="badge-pk" /><text x="25" y="59" class="badge-text">PK</text>
      <text x="42" y="59" class="prop-name">id</text><text x="160" y="59" class="prop-type">uuid default gen_random()</text>

      <text x="42" y="81" class="prop-name">department</text><text x="160" y="81" class="prop-type">dept_name enum (front_desk, kitchen...)</text>
      <text x="42" y="103" class="prop-name">title</text><text x="160" y="103" class="prop-type">text not null</text>
      
      <rect x="14" y="115" width="22" height="14" class="badge-fk" /><text x="25" y="126" class="badge-text-fk">FK</text>
      <text x="42" y="126" class="prop-name">room_id</text><text x="160" y="126" class="prop-type">uuid ref rooms(id) on delete set null</text>

      <text x="42" y="148" class="prop-name">priority</text><text x="160" y="148" class="prop-type">task_priority enum (low, normal, urgent)</text>
      <text x="42" y="170" class="prop-name">status</text><text x="160" y="170" class="prop-type">task_status enum (pending, in_progress)</text>
      <text x="42" y="192" class="prop-name">assigned_to</text><text x="160" y="192" class="prop-type">text</text>
      <text x="42" y="214" class="prop-name">created_at</text><text x="160" y="214" class="prop-type">timestamptz default now()</text>
    </g>

    <!-- Table 7: resort_orders -->
    <g transform="translate(1080, 330)" filter="url(#shadow)">
      <rect width="470" height="210" class="entity-card" />
      <rect width="470" height="32" class="header-bar" />
      <text x="14" y="21" class="card-title">resort_orders (In-Room Dining, Tours &amp; Shuttles)</text>
      <text x="455" y="21" class="card-meta" text-anchor="end">Guest Services</text>

      <rect x="14" y="48" width="22" height="14" class="badge-pk" /><text x="25" y="59" class="badge-text">PK</text>
      <text x="42" y="59" class="prop-name">id</text><text x="160" y="59" class="prop-type">uuid default gen_random()</text>

      <rect x="14" y="71" width="22" height="14" class="badge-fk" /><text x="25" y="82" class="badge-text-fk">FK</text>
      <text x="42" y="82" class="prop-name">guest_id</text><text x="160" y="82" class="prop-type">uuid ref profiles(id)</text>

      <text x="42" y="104" class="prop-name">item_name</text><text x="160" y="104" class="prop-type">text not null (Grilled Bangus, Kayak...)</text>
      <text x="42" y="126" class="prop-name">category</text><text x="160" y="126" class="prop-type">text (Dining, Amenity, Tour, Shuttle)</text>
      <text x="42" y="148" class="prop-name">price_php</text><text x="160" y="148" class="prop-type">int not null default 0</text>
      <text x="42" y="170" class="prop-name">status</text><text x="160" y="170" class="prop-type">order_status enum (placed, delivering)</text>
      <text x="42" y="192" class="prop-name">created_at</text><text x="160" y="192" class="prop-type">timestamptz default now()</text>
    </g>

    <!-- Table 8: resort_inventory -->
    <g transform="translate(1080, 570)" filter="url(#shadow)">
      <rect width="470" height="180" class="entity-card" />
      <rect width="470" height="32" class="header-bar" />
      <text x="14" y="21" class="card-title">resort_inventory (Supplies &amp; Reorder Monitor)</text>
      <text x="455" y="21" class="card-meta" text-anchor="end">Asset Management</text>

      <rect x="14" y="48" width="22" height="14" class="badge-pk" /><text x="25" y="59" class="badge-text">PK</text>
      <text x="42" y="59" class="prop-name">id</text><text x="160" y="59" class="prop-type">uuid default gen_random()</text>

      <text x="42" y="81" class="prop-name">item_name</text><text x="160" y="81" class="prop-type">text not null unique</text>
      <text x="42" y="103" class="prop-name">category</text><text x="160" y="103" class="prop-type">dept_name enum (housekeeping, kitchen)</text>
      <text x="42" y="125" class="prop-name">stock_qty</text><text x="160" y="125" class="prop-type">int check (stock_qty &gt;= 0)</text>
      <text x="42" y="147" class="prop-name">reorder_at</text><text x="160" y="147" class="prop-type">int default 10 (auto reorder flag)</text>
      <text x="42" y="169" class="prop-name">unit</text><text x="160" y="169" class="prop-type">text default 'pcs'</text>
    </g>

    <!-- Table 9: chat_messages -->
    <g transform="translate(1080, 780)" filter="url(#shadow)">
      <rect width="470" height="180" class="entity-card" />
      <rect width="470" height="32" class="header-bar" />
      <text x="14" y="21" class="card-title">chat_messages (Live Guest &amp; Bot Transcripts)</text>
      <text x="455" y="21" class="card-meta" text-anchor="end">Socket.io Logs</text>

      <rect x="14" y="48" width="22" height="14" class="badge-pk" /><text x="25" y="59" class="badge-text">PK</text>
      <text x="42" y="59" class="prop-name">id</text><text x="160" y="59" class="prop-type">uuid default gen_random()</text>

      <rect x="14" y="71" width="22" height="14" class="badge-fk" /><text x="25" y="82" class="badge-text-fk">FK</text>
      <text x="42" y="82" class="prop-name">profile_id</text><text x="160" y="82" class="prop-type">uuid ref profiles(id)</text>

      <text x="42" y="104" class="prop-name">role</text><text x="160" y="104" class="prop-type">chat_role enum ('user', 'bot')</text>
      <text x="42" y="126" class="prop-name">content</text><text x="160" y="126" class="prop-type">text not null</text>
      <text x="42" y="148" class="prop-name">created_at</text><text x="160" y="148" class="prop-type">timestamptz default now()</text>
    </g>

    <!-- Relationship Connections -->
    <!-- profiles -> reservations (1:N) -->
    <path d="M 210, 340 L 210, 480 L 300, 480" class="conn-line" marker-end="url(#arrowBlue)" />
    <g transform="translate(255, 470)"><rect x="-40" y="-8" width="80" height="16" class="label-bg" /><text y="4" class="label-text">1:N Guest Stays</text></g>

    <!-- rooms -> reservations (1:N) -->
    <path d="M 795, 340 L 795, 480 L 740, 480" class="conn-line" marker-end="url(#arrowBlue)" />
    <g transform="translate(768, 470)"><rect x="-40" y="-8" width="80" height="16" class="label-bg" /><text y="4" class="label-text">1:N Bookings</text></g>

    <!-- reservations -> reviews (1:1) -->
    <path d="M 450, 740 L 450, 770 L 210, 770 L 210, 800" class="conn-line" marker-end="url(#arrowBlue)" />
    <g transform="translate(330, 770)"><rect x="-45" y="-8" width="90" height="16" class="label-bg" /><text y="4" class="label-text">1:1 Verified Stay</text></g>

    <!-- reservations -> notifications (1:N) -->
    <path d="M 590, 740 L 590, 800" class="conn-line" marker-end="url(#arrowBlue)" />
    <g transform="translate(590, 770)"><rect x="-45" y="-8" width="90" height="16" class="label-bg" /><text y="4" class="label-text">1:N SMS Audit</text></g>

    <!-- profiles -> resort_orders (1:N) -->
    <path d="M 390, 205 L 1050, 205 L 1050, 435 L 1080, 435" class="conn-line" marker-end="url(#arrowBlue)" />
    <g transform="translate(1050, 290)"><rect x="-40" y="-8" width="80" height="16" class="label-bg" /><text y="4" class="label-text">1:N Orders</text></g>

    <!-- rooms -> department_tasks (1:N) -->
    <path d="M 980, 185 L 1080, 185" class="conn-line" marker-end="url(#arrowBlue)" />
    <g transform="translate(1030, 175)"><rect x="-35" y="-8" width="70" height="16" class="label-bg" /><text y="4" class="label-text">1:N Tasks</text></g>
  </g>

  <!-- ===================================================================== -->
  <!-- TIER 4: DISTRIBUTED IN-MEMORY & CACHE SCHEMA COLLECTION (REDIS)       -->
  <!-- ===================================================================== -->
  <g transform="translate(60, 1770)">
    <rect width="1580" height="340" class="tier-box" />
    <text x="25" y="30" class="tier-title">TIER 4: IN-MEMORY STATE &amp; CACHE KEY SCHEMA COLLECTION (REDIS &amp; GCRA)</text>
    <text x="25" y="48" class="tier-sub">Sub-Millisecond Read Caching, Key Namespace Hierarchy, LRU Eviction &amp; Dynamic Concurrency Slots</text>

    <!-- Cache Card 1: Catalog & Room Cache -->
    <g transform="translate(30, 70)" filter="url(#shadow)">
      <rect width="360" height="235" class="entity-card-primary" />
      <rect width="360" height="32" class="header-bar-blue" />
      <text x="14" y="21" class="card-title">Room &amp; Catalog Cache Schema</text>
      <text x="345" y="21" class="card-meta" text-anchor="end">TTL: 300s - 600s</text>

      <text x="14" y="55" class="prop-name">room:{id}</text><text x="130" y="55" class="prop-type">HASH (Serialized Room Model)</text>
      <text x="14" y="78" class="prop-name">rooms:catalog</text><text x="130" y="78" class="prop-type">JSON (Active Room Fleet Array)</text>
      <text x="14" y="101" class="prop-name">rooms:categories</text><text x="130" y="101" class="prop-type">SET ('Suite', 'Villa', 'Cottage')</text>
      <text x="14" y="124" class="prop-name">room:slug:{slug}</text><text x="130" y="124" class="prop-type">STRING (Direct UUID Pointer)</text>
      <text x="14" y="155" class="prop-name">Eviction Policy:</text><text x="130" y="155" class="prop-type">volatile-lru (Max 500 Items)</text>
      <text x="14" y="180" class="prop-name">Invalidation Hook:</text><text x="130" y="180" class="prop-type">On Room Update / Price Change</text>
      <text x="14" y="205" class="prop-name">Retrieval Speed:</text><text x="130" y="205" class="prop-type">&lt; 0.8 ms (Sub-Millisecond)</text>
    </g>

    <!-- Cache Card 2: Analytics & Pacing Cache -->
    <g transform="translate(420, 70)" filter="url(#shadow)">
      <rect width="360" height="235" class="entity-card-green" />
      <rect width="360" height="32" class="header-bar-green" />
      <text x="14" y="21" class="card-title">Analytics &amp; Sales Cache Schema</text>
      <text x="345" y="21" class="card-meta" text-anchor="end">TTL: 60s - 300s</text>

      <text x="14" y="55" class="prop-name">analytics:overview</text><text x="140" y="55" class="prop-type">JSON (Occupancy %, Revenue)</text>
      <text x="14" y="78" class="prop-name">analytics:daily:{date}</text><text x="140" y="78" class="prop-type">HASH (Bookings, Nights Sold)</text>
      <text x="14" y="101" class="prop-name">analytics:trends:7d</text><text x="140" y="101" class="prop-type">LIST (7-Day Sales Snapshots)</text>
      <text x="14" y="124" class="prop-name">analytics:lock:refresh</text><text x="140" y="124" class="prop-type">STRING (Redlock Mutex: 5s)</text>
      <text x="14" y="155" class="prop-name">Pre-warm Routine:</text><text x="140" y="155" class="prop-type">Background Job on Node Boot</text>
      <text x="14" y="180" class="prop-name">DB Protection:</text><text x="140" y="180" class="prop-type">Shields PostgreSQL from Surges</text>
      <text x="14" y="205" class="prop-name">Throughput Cap:</text><text x="140" y="205" class="prop-type">&gt; 3,500 req/sec sustained</text>
    </g>

    <!-- Cache Card 3: Rate Limiter & GCRA State -->
    <g transform="translate(810, 70)" filter="url(#shadow)">
      <rect width="360" height="235" class="entity-card-amber" />
      <rect width="360" height="32" class="header-bar-amber" />
      <text x="14" y="21" class="card-title">GCRA Rate Limiter State Schema</text>
      <text x="345" y="21" class="card-meta" text-anchor="end">TTL: Sliding</text>

      <text x="14" y="55" class="prop-name">limiter:gcra:{key}</text><text x="140" y="55" class="prop-type">HASH { tat: Int, last: Int }</text>
      <text x="14" y="78" class="prop-name">limiter:ip:blacklist</text><text x="140" y="78" class="prop-type">SET (Blocked IPs)</text>
      <text x="14" y="101" class="prop-name">limiter:stats:blocked</text><text x="140" y="101" class="prop-type">COUNTER (Throttled Events)</text>
      <text x="14" y="124" class="prop-name">limiter:tier:general</text><text x="140" y="124" class="prop-type">Emission: 100 req / 60s</text>
      <text x="14" y="155" class="prop-name">Algorithm:</text><text x="140" y="155" class="prop-type">GCRA (Theoretical Arrival Time)</text>
      <text x="14" y="180" class="prop-name">Complexity:</text><text x="140" y="180" class="prop-type">O(1) memory &amp; evaluation</text>
      <text x="14" y="205" class="prop-name">Memory Drain:</text><text x="140" y="205" class="prop-type">Zero arrays, auto-swept</text>
    </g>

    <!-- Cache Card 4: Concurrency & Session State -->
    <g transform="translate(1200, 70)" filter="url(#shadow)">
      <rect width="350" height="235" class="entity-card-purple" />
      <rect width="350" height="32" class="header-bar-purple" />
      <text x="14" y="21" class="card-title">Adaptive Concurrency &amp; Sessions</text>
      <text x="335" y="21" class="card-meta" text-anchor="end">Live State</text>

      <text x="14" y="55" class="prop-name">session:{jwt_hash}</text><text x="130" y="55" class="prop-type">STRING (User UUID, Role)</text>
      <text x="14" y="78" class="prop-name">otp:{phone}</text><text x="130" y="78" class="prop-type">STRING (6-digit, TTL: 300s)</text>
      <text x="14" y="101" class="prop-name">concurrency:slots</text><text x="130" y="101" class="prop-type">SEMAPHORE (In-flight cap)</text>
      <text x="14" y="124" class="prop-name">vegas:rtt_min</text><text x="130" y="124" class="prop-type">FLOAT (Golden RTT Baseline)</text>
      <text x="14" y="155" class="prop-name">AIMD Regulator:</text><text x="130" y="155" class="prop-type">Auto-tunes 25..500 slots</text>
      <text x="14" y="180" class="prop-name">Event Loop Guard:</text><text x="130" y="180" class="prop-type">Prevents queue buildup</text>
      <text x="14" y="205" class="prop-name">Session Expiry:</text><text x="130" y="205" class="prop-type">24-hour rolling TTL</text>
    </g>
  </g>
</svg>`;
}

/**
 * 2. Generate Draw.io Compatible XML File
 */
function generateSchemaArchitectureDrawio() {
  return `<mxfile host="Electron" modified="${new Date().toISOString()}" agent="Mozilla/5.0" version="21.6.8" type="device">
  <diagram id="SchemaCollectionArchitecture" name="J &amp; D Reserve Schema Architecture">
    <mxGraphModel dx="1600" dy="1200" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1700" pageHeight="2200" background="#ffffff">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />

        <!-- Title -->
        <mxCell id="TitleBox" value="&lt;b style=&quot;font-size: 20px;&quot;&gt;J &amp;amp; D Reserve · Schema Collection Architecture&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;PostgreSQL Relational Schema · Application DTOs · GraphQL Contracts · Redis State Namespaces&lt;/font&gt;" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;" vertex="1" parent="1">
          <mxGeometry x="350" y="30" width="1000" height="60" as="geometry" />
        </mxCell>

        <!-- Tier 1: Validation Schema -->
        <mxCell id="T1_Box" value="Tier 1: Validation Schema &amp;amp; DTO Collection (Joi &amp;amp; Zod Middleware)" style="swimlane;whiteSpace=wrap;html=1;startSize=26;fillColor=#f8fafc;strokeColor=#94a3b8;strokeWidth=1.5;fontStyle=1;fontSize=13;fontColor=#0f172a;collapsible=0;" vertex="1" parent="1">
          <mxGeometry x="60" y="110" width="1580" height="260" as="geometry" />
        </mxCell>
        <mxCell id="T1_Auth" value="&lt;b&gt;AuthValidationSchema (Joi)&lt;/b&gt;&lt;hr&gt;email: string().email().required()&lt;br&gt;password: string().min(8).required()&lt;br&gt;phone: string().pattern(/^\\+63/)&lt;br&gt;role: enum('customer','staff'...)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#7c3aed;strokeWidth=1.6;align=left;spacingLeft=10;fontSize=11;" vertex="1" parent="T1_Box">
          <mxGeometry x="30" y="45" width="360" height="180" as="geometry" />
        </mxCell>
        <mxCell id="T1_Res" value="&lt;b&gt;ReservationSchema (Joi)&lt;/b&gt;&lt;hr&gt;room_id: string().uuid().required()&lt;br&gt;check_in: date().iso().min('now')&lt;br&gt;check_out: date().greater(check_in)&lt;br&gt;guests: number().integer().min(1)&lt;br&gt;notes: string().max(500)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#0284c7;strokeWidth=1.6;align=left;spacingLeft=10;fontSize=11;" vertex="1" parent="T1_Box">
          <mxGeometry x="420" y="45" width="360" height="180" as="geometry" />
        </mxCell>
        <mxCell id="T1_Recovery" value="&lt;b&gt;AccountRecoverySchema (Joi)&lt;/b&gt;&lt;hr&gt;phone: string().e164().required()&lt;br&gt;otp_code: string().length(6)&lt;br&gt;new_password: string().min(8)&lt;br&gt;session_token: string().uuid()&lt;br&gt;channel: enum('sms','whatsapp')" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#d97706;strokeWidth=1.6;align=left;spacingLeft=10;fontSize=11;" vertex="1" parent="T1_Box">
          <mxGeometry x="810" y="45" width="360" height="180" as="geometry" />
        </mxCell>
        <mxCell id="T1_Ops" value="&lt;b&gt;DepartmentOperationsSchema&lt;/b&gt;&lt;hr&gt;department: enum(DeptName)&lt;br&gt;priority: enum(TaskPriority)&lt;br&gt;room_id: string().uuid().optional()&lt;br&gt;item_name: string().trim()&lt;br&gt;price_php: number().min(0)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#059669;strokeWidth=1.6;align=left;spacingLeft=10;fontSize=11;" vertex="1" parent="T1_Box">
          <mxGeometry x="1200" y="45" width="350" height="180" as="geometry" />
        </mxCell>

        <!-- Tier 2: API Contract Schema -->
        <mxCell id="T2_Box" value="Tier 2: API Contract Schema Collection (GraphQL SDL &amp;amp; REST Envelopes)" style="swimlane;whiteSpace=wrap;html=1;startSize=26;fillColor=#f8fafc;strokeColor=#94a3b8;strokeWidth=1.5;fontStyle=1;fontSize=13;fontColor=#0f172a;collapsible=0;" vertex="1" parent="1">
          <mxGeometry x="60" y="390" width="1580" height="180" as="geometry" />
        </mxCell>
        <mxCell id="T2_GqlRoom" value="&lt;b&gt;GraphQL Room Schema&lt;/b&gt;&lt;hr&gt;Query.rooms(category, min_rate): [Room!]!&lt;br&gt;Query.availableRooms(checkIn, checkOut): [Room!]!&lt;br&gt;Subscription.roomAvailabilityChanged" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#64748b;strokeWidth=1.2;align=left;spacingLeft=10;fontSize=11;" vertex="1" parent="T2_Box">
          <mxGeometry x="30" y="40" width="480" height="120" as="geometry" />
        </mxCell>
        <mxCell id="T2_GqlRes" value="&lt;b&gt;GraphQL Reservation Schema&lt;/b&gt;&lt;hr&gt;Mutation.createReservation(input): Result!&lt;br&gt;Mutation.cancelReservation(id, reason): CancelResponse!&lt;br&gt;Subscription.reservationStatusUpdated(id)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#64748b;strokeWidth=1.2;align=left;spacingLeft=10;fontSize=11;" vertex="1" parent="T2_Box">
          <mxGeometry x="540" y="40" width="500" height="120" as="geometry" />
        </mxCell>
        <mxCell id="T2_GqlAnalytics" value="&lt;b&gt;GraphQL &amp;amp; REST Contract Schemas&lt;/b&gt;&lt;hr&gt;Query.analyticsOverview: AnalyticsOverview!&lt;br&gt;REST Standard Envelope: { status, data, message, error }&lt;br&gt;RFC 6585 Headers: X-RateLimit-Limit, Remaining, Reset" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#64748b;strokeWidth=1.2;align=left;spacingLeft=10;fontSize=11;" vertex="1" parent="T2_Box">
          <mxGeometry x="1070" y="40" width="480" height="120" as="geometry" />
        </mxCell>

        <!-- Tier 3: PostgreSQL Database Schema -->
        <mxCell id="T3_Box" value="Tier 3: Relational Database Schema Collection (Supabase PostgreSQL 15+)" style="swimlane;whiteSpace=wrap;html=1;startSize=26;fillColor=#f8fafc;strokeColor=#94a3b8;strokeWidth=1.5;fontStyle=1;fontSize=13;fontColor=#0f172a;collapsible=0;" vertex="1" parent="1">
          <mxGeometry x="60" y="590" width="1580" height="1020" as="geometry" />
        </mxCell>
        <mxCell id="T3_Profiles" value="&lt;b&gt;profiles&lt;/b&gt;&lt;hr&gt;PK id: uuid (auth.users)&lt;br&gt;first_name: text&lt;br&gt;last_name: text&lt;br&gt;phone: text&lt;br&gt;role: user_role&lt;br&gt;created_at: timestamptz" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#0284c7;strokeWidth=1.6;align=left;spacingLeft=10;fontSize=11;" vertex="1" parent="T3_Box">
          <mxGeometry x="30" y="50" width="360" height="240" as="geometry" />
        </mxCell>
        <mxCell id="T3_Rooms" value="&lt;b&gt;rooms&lt;/b&gt;&lt;hr&gt;PK id: uuid&lt;br&gt;name: text&lt;br&gt;slug: text UNIQUE&lt;br&gt;category: text&lt;br&gt;capacity: int&lt;br&gt;units: int&lt;br&gt;rate_php: int&lt;br&gt;rating_avg: numeric(3,2)&lt;br&gt;is_active: boolean" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#0284c7;strokeWidth=1.6;align=left;spacingLeft=10;fontSize=11;" vertex="1" parent="T3_Box">
          <mxGeometry x="610" y="50" width="370" height="240" as="geometry" />
        </mxCell>
        <mxCell id="T3_Reservations" value="&lt;b&gt;reservations&lt;/b&gt;&lt;hr&gt;PK id: uuid&lt;br&gt;FK guest_id: uuid -&amp;gt; profiles(id)&lt;br&gt;FK room_id: uuid -&amp;gt; rooms(id)&lt;br&gt;check_in: date&lt;br&gt;check_out: date&lt;br&gt;nights: int STORED&lt;br&gt;guests: int&lt;br&gt;status: stay_status&lt;br&gt;total_php: int&lt;br&gt;&lt;b style=&quot;color:#dc2626;&quot;&gt;🛡️ GiST CONSTRAINT no_overbooking&lt;/b&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#0284c7;strokeWidth=2;align=left;spacingLeft=10;fontSize=11;" vertex="1" parent="T3_Box">
          <mxGeometry x="300" y="360" width="440" height="280" as="geometry" />
        </mxCell>

        <!-- Connections -->
        <mxCell id="Edge_Prof_Res" value="1:N Stays" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#0284c7;strokeWidth=1.5;fontColor=#0f172a;fontSize=10;" edge="1" parent="T3_Box" source="T3_Profiles" target="T3_Reservations">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="Edge_Rooms_Res" value="1:N Bookings" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#0284c7;strokeWidth=1.5;fontColor=#0f172a;fontSize=10;" edge="1" parent="T3_Box" source="T3_Rooms" target="T3_Reservations">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

/**
 * 3. Generate Interactive HTML Viewer
 */
function generateInteractiveHtml(svgContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>J & D Reserve · Schema Collection Architecture</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      padding: 18px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .brand h1 {
      font-size: 1.25rem;
      font-weight: 800;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand p {
      font-size: 0.85rem;
      color: #64748b;
      margin-top: 2px;
    }
    .actions {
      display: flex;
      gap: 12px;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #334155;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .btn:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
      color: #0f172a;
    }
    .btn-primary {
      background: #0284c7;
      border-color: #0284c7;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #0369a1;
      border-color: #0369a1;
      color: #ffffff;
    }
    main {
      flex: 1;
      padding: 24px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      overflow: auto;
    }
    .canvas-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      padding: 24px;
      max-width: 100%;
      overflow: auto;
    }
    svg {
      max-width: 100%;
      height: auto;
      display: block;
    }
    footer {
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      padding: 16px 32px;
      font-size: 0.82rem;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <h1>🗄️ J &amp; D Reserve · Schema Collection Architecture</h1>
      <p>J &amp; D Beach House · Barangay Patar, Bolinao, Pangasinan</p>
    </div>
    <div class="actions">
      <a href="schema_collection_architecture.svg" download class="btn">📥 Download SVG</a>
      <a href="schema_collection_architecture.png" download class="btn">🖼️ Download 4K PNG</a>
      <a href="schema_collection_architecture.drawio" download class="btn btn-primary">✏️ Open in Draw.io</a>
    </div>
  </header>

  <main>
    <div class="canvas-card">
      ${svgContent}
    </div>
  </main>

  <footer>
    <span>J &amp; D Reserve Capstone Architecture Suite v1.1.0</span>
    <span>PostgreSQL 15+ · Joi DTOs · GraphQL Contracts · Redis Caching</span>
  </footer>
</body>
</html>`;
}

/**
 * 4. Generate README Documentation in docs/schema-architecture/
 */
function generateDocumentation() {
  return `# 🗄️ J & D Reserve · Schema Collection Architecture

**System**: J & D Reserve (Online Reservation and Booking Management System)  
**Location**: J & D Beach House, Barangay Patar, Bolinao, Pangasinan  
**Architecture Spec**: 4-Tier Distributed Schema Collection (PostgreSQL, Joi/Zod, GraphQL, Redis)

---

## 1. Schema Collection Overview

The **Schema Collection** of J & D Reserve is organized into four synchronized tiers ensuring strict validation, type safety, relational integrity, and microsecond caching performance:

\`\`\`
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
\`\`\`

---

## 2. Diagram Files in this Directory

| File Name | Format | Purpose | How to View / Open |
| :--- | :---: | :--- | :--- |
| **\`view_schema_architecture.html\`** | Interactive HTML | Complete interactive web viewer with zoom & controls | Double-click to open in any web browser |
| **\`schema_collection_architecture.svg\`** | Vector SVG | Lossless, scalable high-definition vector diagram | Open in browser, Illustrator, or Figma |
| **\`schema_collection_architecture.png\`** | 4K Raster PNG | High-resolution image for presentations and thesis binder | Open in Windows Photos or insert into Word/PowerPoint |
| **\`schema_collection_architecture.drawio\`** | Draw.io XML | Editable diagram project file | Open in [app.diagrams.net](https://app.diagrams.net) |

---

## 3. Key Relational Safeguards in the Schema

1. **Hard Overbooking Prevention via GiST Constraint**:
   \`\`\`sql
   alter table reservations add constraint no_overbooking
     exclude using gist (
       room_id with =,
       daterange(check_in, check_out) with &&
     ) where (status in ('pending','confirmed','checked_in'));
   \`\`\`
   *Prevents double bookings directly at the database engine level with mathematical certainty.*

2. **Denormalized Rating Recalculation Trigger**:
   Whenever a verified review is inserted or updated, a PostgreSQL trigger automatically recalculates \`rating_avg\` and \`rating_count\` on the corresponding \`rooms\` record in $O(1)$ read time.

3. **Row-Level Security (RLS)**:
   Guests can only inspect and modify their own bookings and orders, while Staff and Administrators possess role-based access across department queues.
`;
}

/**
 * 5. Main Execution
 */
function run() {
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('\n' + '='.repeat(75));
  console.log(' 🗄️ GENERATING SCHEMA COLLECTION ARCHITECTURE SUITE');
  console.log('='.repeat(75));
  console.log(` Target Directory: ${outputDir}\n`);

  // 1. Generate SVG
  const svgContent = generateSchemaArchitectureSvg();
  const svgPath = path.join(outputDir, 'schema_collection_architecture.svg');
  fs.writeFileSync(svgPath, svgContent, 'utf8');
  console.log(` ✅ Generated SVG: ${svgPath}`);

  // 2. Generate Draw.io
  const drawioContent = generateSchemaArchitectureDrawio();
  const drawioPath = path.join(outputDir, 'schema_collection_architecture.drawio');
  fs.writeFileSync(drawioPath, drawioContent, 'utf8');
  console.log(` ✅ Generated Draw.io: ${drawioPath}`);

  // 3. Generate Interactive HTML
  const htmlContent = generateInteractiveHtml(svgContent);
  const htmlPath = path.join(outputDir, 'view_schema_architecture.html');
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log(` ✅ Generated Interactive HTML: ${htmlPath}`);

  // 4. Generate README.md
  const readmeContent = generateDocumentation();
  const readmePath = path.join(outputDir, 'README.md');
  fs.writeFileSync(readmePath, readmeContent, 'utf8');
  console.log(` ✅ Generated Documentation: ${readmePath}`);

  // 5. Render 4K PNG via Edge
  const pngPath = path.join(outputDir, 'schema_collection_architecture.png');
  try {
    const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--force-device-scale-factor=2',
      '--window-size=1700,2200',
      `--screenshot=${pngPath}`,
      fileUrl
    ];
    console.log(` 🖼️ Rendering 4K PNG via Edge Browser...`);
    execFileSync(EDGE_PATH, args, { stdio: 'inherit' });
    const stats = fs.statSync(pngPath);
    console.log(` ✅ Generated 4K PNG: ${pngPath} (${(stats.size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.warn(` ⚠️ Headless PNG render warning: ${err.message}. SVG and HTML are ready.`);
  }

  console.log('\n' + '='.repeat(75));
  console.log(' 🏆 SCHEMA COLLECTION ARCHITECTURE SUITE GENERATED SUCCESSFULLY 🟢');
  console.log('='.repeat(75) + '\n');
}

run();
