/**
 * Professional Diagram Generator for J & D Beach House
 * Formats System Architecture & Data Hierarchy in Clean, High-Definition
 * Enterprise Diagramming Style (Draw.io XML + Vector SVG + 4K Raster PNG)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

/**
 * Generate Professional System Architecture SVG
 * Pixel-perfect alignment, zero overlaps, clean enterprise aesthetic
 */
function generateSystemArchitectureSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1950" width="1600" height="1950" style="background:#ffffff; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <defs>
    <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.07" />
    </filter>

    <marker id="arrowBlue" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#2563eb" />
    </marker>
    <marker id="arrowGray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
    </marker>
    <marker id="arrowDark" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#0f172a" />
    </marker>
  </defs>

  <style>
    .layer-box { fill: #f8fafc; stroke: #64748b; stroke-width: 1.5; rx: 8px; }
    .layer-title { font-size: 13px; font-weight: 700; fill: #1e293b; }
    .card-box { fill: #ffffff; stroke: #475569; stroke-width: 1.2; rx: 6px; }
    .card-box-accent { fill: #ffffff; stroke: #2563eb; stroke-width: 1.6; rx: 6px; }
    .node-title { font-size: 13px; font-weight: 700; fill: #0f172a; text-anchor: middle; }
    .node-sub { font-size: 11px; font-weight: 400; fill: #475569; text-anchor: middle; }
    .node-sub-blue { font-size: 11px; font-weight: 600; fill: #2563eb; text-anchor: middle; }
    .edge-label-bg { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1; rx: 4px; }
    .edge-text { font-size: 10px; font-weight: 600; fill: #334155; text-anchor: middle; }
    .conn-blue { stroke: #2563eb; stroke-width: 1.5; fill: none; }
    .conn-dashed { stroke: #64748b; stroke-width: 1.5; stroke-dasharray: 5 4; fill: none; }
    .conn-dark { stroke: #0f172a; stroke-width: 1.6; fill: none; }
  </style>

  <!-- Title Header -->
  <g transform="translate(800, 30)" text-anchor="middle">
    <text y="0" font-size="20" font-weight="800" fill="#0f172a">J &amp; D Beach House · Full System Architecture</text>
    <text y="20" font-size="12" font-weight="500" fill="#64748b">Complete Multi-Layer Security Perimeter, Node.js Engine &amp; PostgreSQL 15+ Supabase Infrastructure</text>
  </g>

  <!-- ================================================================= -->
  <!-- 1. FRONTEND CLIENT LAYER -->
  <!-- ================================================================= -->
  <g transform="translate(100, 70)">
    <rect width="1400" height="250" class="layer-box" />
    <text x="20" y="24" class="layer-title">1. Frontend Client Layer (React 18 + Vite + TS)</text>

    <!-- Socket.io Client -->
    <g transform="translate(40, 45)" filter="url(#cardShadow)">
      <rect width="260" height="60" class="card-box" />
      <text x="130" y="26" class="node-title">Socket.io Client</text>
      <text x="130" y="44" class="node-sub">(Realtime Chatbot Socket)</text>
    </g>

    <!-- Supabase Realtime Client -->
    <g transform="translate(340, 45)" filter="url(#cardShadow)">
      <rect width="260" height="60" class="card-box" />
      <text x="130" y="26" class="node-title">Supabase Realtime Client</text>
      <text x="130" y="44" class="node-sub">(PostgreSQL CDC Listener)</text>
    </g>

    <!-- Multi-Role Operations Desks -->
    <g transform="translate(180, 155)" filter="url(#cardShadow)">
      <rect width="320" height="70" class="card-box" />
      <text x="160" y="28" class="node-title">Multi-Role Operations Desks</text>
      <text x="160" y="48" class="node-sub">(Reception, Accounting, Depts, Executive Admin)</text>
    </g>

    <!-- Public Guest Portal -->
    <g transform="translate(540, 155)" filter="url(#cardShadow)">
      <rect width="320" height="70" class="card-box" />
      <text x="160" y="28" class="node-title">Public Guest Portal</text>
      <text x="160" y="48" class="node-sub">(Booking Flow, Room Gallery, Ocean Synth)</text>
    </g>

    <!-- Guest Experience Hub -->
    <g transform="translate(900, 155)" filter="url(#cardShadow)">
      <rect width="320" height="70" class="card-box" />
      <text x="160" y="28" class="node-title">Guest Experience Hub</text>
      <text x="160" y="48" class="node-sub">(In-Room Orders, Digital RFID Pass)</text>
    </g>

    <!-- Reactive Refresh Link: Realtime Client -> Operations Desks -->
    <path d="M 470, 105 L 470, 155" class="conn-dashed" marker-end="url(#arrowGray)" />
    <g transform="translate(470, 130)">
      <rect x="-65" y="-8" width="130" height="16" class="edge-label-bg" />
      <text y="4" class="edge-text">15. Reactive State Refresh</text>
    </g>
  </g>

  <!-- Connectors: L1 -> L2 Rate Limiter -->
  <path d="M 440, 295 L 440, 360 L 700, 360 L 700, 435" class="conn-blue" marker-end="url(#arrowBlue)" />
  <g transform="translate(490, 350)">
    <rect x="-95" y="-9" width="190" height="18" class="edge-label-bg" />
    <text y="4" class="edge-text">1. HTTPS REST (Task Dispatch &amp; Reports)</text>
  </g>

  <path d="M 800, 295 L 800, 435" class="conn-blue" marker-end="url(#arrowBlue)" />
  <g transform="translate(800, 350)">
    <rect x="-85" y="-9" width="170" height="18" class="edge-label-bg" />
    <text y="4" class="edge-text">1. HTTPS REST (Browse &amp; Reserve)</text>
  </g>

  <path d="M 1160, 295 L 1160, 360 L 900, 360 L 900, 435" class="conn-blue" marker-end="url(#arrowBlue)" />
  <g transform="translate(1110, 350)">
    <rect x="-90" y="-9" width="180" height="18" class="edge-label-bg" />
    <text y="4" class="edge-text">1. HTTPS REST (Orders &amp; Digital Key)</text>
  </g>

  <!-- ================================================================= -->
  <!-- 2. SECURITY & FIREWALL PERIMETER -->
  <!-- ================================================================= -->
  <g transform="translate(520, 390)">
    <rect width="560" height="420" class="layer-box" />
    <text x="20" y="24" class="layer-title">2. Security &amp; Firewall Perimeter</text>

    <!-- Rate Limiter -->
    <g transform="translate(50, 45)" filter="url(#cardShadow)">
      <rect width="460" height="55" class="card-box" />
      <text x="230" y="24" class="node-title">Rate Limiter</text>
      <text x="230" y="41" class="node-sub">(Global 300 req / 15m · Booking 5 req / m)</text>
    </g>

    <!-- NGWF -->
    <g transform="translate(50, 140)" filter="url(#cardShadow)">
      <rect width="460" height="55" class="card-box" />
      <text x="230" y="24" class="node-title">Next-Gen Web App Firewall (NGWF)</text>
      <text x="230" y="41" class="node-sub">(Deep Payload SQLi / XSS / Traversal Filter)</text>
    </g>

    <!-- Anti-XSS -->
    <g transform="translate(50, 235)" filter="url(#cardShadow)">
      <rect width="460" height="55" class="card-box" />
      <text x="230" y="24" class="node-title">Anti-XSS Sanitizer</text>
      <text x="230" y="41" class="node-sub">(Recursive JSON &amp; Query Scrubber)</text>
    </g>

    <!-- Cookie Tokenizer -->
    <g transform="translate(50, 330)" filter="url(#cardShadow)">
      <rect width="460" height="55" class="card-box" />
      <text x="230" y="24" class="node-title">Cookie Tokenizer</text>
      <text x="230" y="41" class="node-sub">(Double-Submit CSRF Protection)</text>
    </g>

    <!-- Internal lines -->
    <path d="M 280, 100 L 280, 140" class="conn-blue" marker-end="url(#arrowBlue)" />
    <g transform="translate(280, 120)">
      <rect x="-60" y="-8" width="120" height="16" class="edge-label-bg" />
      <text y="4" class="edge-text">2. Rate-Passed Request</text>
    </g>

    <path d="M 280, 195 L 280, 235" class="conn-blue" marker-end="url(#arrowBlue)" />
    <g transform="translate(280, 215)">
      <rect x="-55" y="-8" width="110" height="16" class="edge-label-bg" />
      <text y="4" class="edge-text">3. Threat Inspected</text>
    </g>

    <path d="M 280, 290 L 280, 330" class="conn-blue" marker-end="url(#arrowBlue)" />
    <g transform="translate(280, 310)">
      <rect x="-55" y="-8" width="110" height="16" class="edge-label-bg" />
      <text y="4" class="edge-text">4. Payload Sanitized</text>
    </g>
  </g>

  <!-- ================================================================= -->
  <!-- 3. EXPRESS.JS BACKEND SERVER -->
  <!-- ================================================================= -->
  <g transform="translate(100, 880)">
    <rect width="1400" height="260" class="layer-box" />
    <text x="20" y="24" class="layer-title">3. Express.js Backend Server (Node.js)</text>

    <!-- Telemetry & Forecasting Engine -->
    <g transform="translate(40, 45)" filter="url(#cardShadow)">
      <rect width="320" height="60" class="card-box" />
      <text x="160" y="26" class="node-title">Telemetry &amp; Forecasting Engine</text>
      <text x="160" y="44" class="node-sub">(Live Visitor Heartbeat &amp; Surge Predictor)</text>
    </g>

    <!-- Socket.io Engine -->
    <g transform="translate(400, 45)" filter="url(#cardShadow)">
      <rect width="340" height="60" class="card-box" />
      <text x="170" y="26" class="node-title">Socket.io Engine</text>
      <text x="170" y="44" class="node-sub">(Alan / J &amp; D Bot AI Concierge)</text>
    </g>

    <!-- Modular REST Endpoints -->
    <g transform="translate(400, 160)" filter="url(#cardShadow)">
      <rect width="440" height="65" class="card-box-accent" />
      <text x="220" y="28" class="node-title">Modular REST Endpoints</text>
      <text x="220" y="48" class="node-sub-blue">(/rooms, /reservations, /department, /analytics)</text>
    </g>

    <!-- Secure Media Upload Engine -->
    <g transform="translate(980, 45)" filter="url(#cardShadow)">
      <rect width="380" height="60" class="card-box" />
      <text x="190" y="26" class="node-title">Secure Media Upload Engine</text>
      <text x="190" y="44" class="node-sub">(MIME Type Whitelist &amp; UUID Filenames)</text>
    </g>

    <!-- Query Room Rates Link: Socket -> REST -->
    <path d="M 570, 105 L 570, 160" class="conn-dashed" marker-end="url(#arrowGray)" />
    <g transform="translate(570, 133)">
      <rect x="-65" y="-8" width="130" height="16" class="edge-label-bg" />
      <text y="4" class="edge-text">Query Room Rates &amp; Info</text>
    </g>
  </g>

  <!-- L2 Cookie Tokenizer -> L3 Modular REST Link -->
  <path d="M 800, 775 L 800, 845 L 720, 845 L 720, 1040" class="conn-blue" marker-end="url(#arrowBlue)" />
  <g transform="translate(760, 845)">
    <rect x="-50" y="-9" width="100" height="18" class="edge-label-bg" />
    <text y="4" class="edge-text">5. CSRF Verified</text>
  </g>

  <!-- Duplex Socket Link: Client -> Server -->
  <path d="M 230, 115 L 140, 115 L 140, 820 L 500, 820 L 500, 925" class="conn-dark" marker-end="url(#arrowDark)" />
  <g transform="translate(140, 520)">
    <rect x="-95" y="-9" width="190" height="18" class="edge-label-bg" />
    <text y="4" class="edge-text">WSS Duplex (Chat &amp; Typing Events)</text>
  </g>

  <!-- ================================================================= -->
  <!-- 4. SUPABASE DATABASE & BAAS (POSTGRESQL 15+) -->
  <!-- ================================================================= -->
  <g transform="translate(100, 1200)">
    <rect width="980" height="530" class="layer-box" />
    <text x="20" y="24" class="layer-title">4. Supabase Database &amp; BaaS (PostgreSQL 15+)</text>

    <!-- Row-Level Security (RLS) -->
    <g transform="translate(40, 50)" filter="url(#cardShadow)">
      <rect width="280" height="65" class="card-box" />
      <text x="140" y="26" class="node-title">Row-Level Security (RLS)</text>
      <text x="140" y="44" class="node-sub">(Self-Data Isolation &amp; is_admin_or_staff)</text>
    </g>

    <!-- Stored Procedure: available_rooms() -->
    <g transform="translate(350, 50)" filter="url(#cardShadow)">
      <rect width="290" height="65" class="card-box" />
      <text x="145" y="26" class="node-title">Stored Procedure: available_rooms()</text>
      <text x="145" y="44" class="node-sub">(Dynamic Date-Range Availability Matrix)</text>
    </g>

    <!-- GiST Exclusion Constraint -->
    <g transform="translate(670, 50)" filter="url(#cardShadow)">
      <rect width="270" height="65" class="card-box" />
      <text x="135" y="26" class="node-title">GiST Exclusion Constraint</text>
      <text x="135" y="44" class="node-sub">(Hard Overbooking Guard: 0 Double Bookings)</text>
    </g>

    <!-- PostgreSQL Relational Tables -->
    <g transform="translate(290, 205)" filter="url(#cardShadow)">
      <rect width="400" height="65" class="card-box-accent" />
      <text x="200" y="26" class="node-title">PostgreSQL Relational Tables</text>
      <text x="200" y="44" class="node-sub-blue">profiles, rooms, reservations, orders, tasks, inventory</text>
    </g>

    <!-- Database Triggers -->
    <g transform="translate(60, 360)" filter="url(#cardShadow)">
      <rect width="380" height="70" class="card-box" />
      <text x="190" y="26" class="node-title">Database Triggers</text>
      <text x="190" y="44" class="node-sub">(sync_room_rating, handle_new_user, touch_updated_at)</text>
    </g>

    <!-- Supabase Realtime Engine -->
    <g transform="translate(540, 360)" filter="url(#cardShadow)">
      <rect width="380" height="70" class="card-box" />
      <text x="190" y="26" class="node-title">Supabase Realtime Engine</text>
      <text x="190" y="44" class="node-sub">(PostgreSQL WAL Change Data Capture)</text>
    </g>

    <!-- Internal L4 Lines -->
    <path d="M 180, 115 L 180, 165 L 380, 165 L 380, 205" class="conn-blue" marker-end="url(#arrowBlue)" />
    <g transform="translate(240, 155)">
      <rect x="-45" y="-8" width="90" height="16" class="edge-label-bg" />
      <text y="4" class="edge-text">7. Evaluated Query</text>
    </g>

    <path d="M 495, 115 L 495, 205" class="conn-blue" marker-end="url(#arrowBlue)" />
    <g transform="translate(495, 160)">
      <rect x="-65" y="-8" width="130" height="16" class="edge-label-bg" />
      <text y="4" class="edge-text">9. Scan Active Date Spans</text>
    </g>

    <path d="M 805, 115 L 805, 165 L 610, 165 L 610, 205" class="conn-blue" marker-end="url(#arrowBlue)" />
    <g transform="translate(730, 155)">
      <rect x="-60" y="-8" width="120" height="16" class="edge-label-bg" />
      <text y="4" class="edge-text">11. Overlap Check Passed</text>
    </g>

    <path d="M 390, 270 L 390, 320 L 250, 320 L 250, 360" class="conn-blue" marker-end="url(#arrowBlue)" />
    <g transform="translate(280, 310)">
      <rect x="-65" y="-8" width="130" height="16" class="edge-label-bg" />
      <text y="4" class="edge-text">12. On Insert / Update / Delete</text>
    </g>

    <path d="M 590, 270 L 590, 320 L 730, 320 L 730, 360" class="conn-blue" marker-end="url(#arrowBlue)" />
    <g transform="translate(700, 310)">
      <rect x="-55" y="-8" width="110" height="16" class="edge-label-bg" />
      <text y="4" class="edge-text">13. WAL Log Changes</text>
    </g>
  </g>

  <!-- Connectors: L3 Modular REST -> L4 DB -->
  <path d="M 540, 1105 L 540, 1160 L 280, 1160 L 280, 1250" class="conn-blue" marker-end="url(#arrowBlue)" />
  <g transform="translate(360, 1150)">
    <rect x="-70" y="-8" width="140" height="16" class="edge-label-bg" />
    <text y="4" class="edge-text">6. Service-Role SQL Operations</text>
  </g>

  <path d="M 640, 1105 L 640, 1170 L 595, 1170 L 595, 1250" class="conn-blue" marker-end="url(#arrowBlue)" />
  <g transform="translate(640, 1175)">
    <rect x="-50" y="-8" width="100" height="16" class="edge-label-bg" />
    <text y="4" class="edge-text">8. Availability Check</text>
  </g>

  <path d="M 740, 1105 L 740, 1160 L 905, 1160 L 905, 1250" class="conn-blue" marker-end="url(#arrowBlue)" />
  <g transform="translate(840, 1150)">
    <rect x="-55" y="-8" width="110" height="16" class="edge-label-bg" />
    <text y="4" class="edge-text">10. Insert Stay Record</text>
  </g>

  <!-- ================================================================= -->
  <!-- 5. EXTERNAL CLOUD INTEGRATIONS -->
  <!-- ================================================================= -->
  <g transform="translate(1120, 1200)">
    <rect width="380" height="530" class="layer-box" />
    <text x="20" y="24" class="layer-title">5. External Cloud Integrations</text>

    <!-- Twilio SMS Gateway -->
    <g transform="translate(40, 80)" filter="url(#cardShadow)">
      <rect width="300" height="80" class="card-box" />
      <text x="150" y="32" class="node-title">Twilio SMS Gateway</text>
      <text x="150" y="54" class="node-sub">(Transactional Pings &amp; Verification)</text>
    </g>

    <!-- Cloudinary CDN -->
    <g transform="translate(40, 280)" filter="url(#cardShadow)">
      <rect width="300" height="80" class="card-box" />
      <text x="150" y="32" class="node-title">Cloudinary CDN</text>
      <text x="150" y="54" class="node-sub">(Optimized Image Asset Storage)</text>
    </g>
  </g>

  <!-- Connector: Modular REST -> Twilio -->
  <path d="M 840, 1070 L 1160, 1070 L 1160, 1280" class="conn-blue" marker-end="url(#arrowBlue)" />
  <g transform="translate(1000, 1060)">
    <rect x="-95" y="-8" width="190" height="16" class="edge-label-bg" />
    <text y="4" class="edge-text">16. Outbound SMS Ping (Confirmation / Pass)</text>
  </g>

  <!-- Connector: Twilio -> REST Webhook -->
  <path d="M 1200, 1280 L 1200, 1090 L 840, 1090" class="conn-dashed" marker-end="url(#arrowGray)" />
  <g transform="translate(1020, 1095)">
    <rect x="-95" y="-8" width="190" height="16" class="edge-label-bg" />
    <text y="4" class="edge-text">17. Inbound Status Webhook (/webhooks/sms/status)</text>
  </g>

  <!-- Connector: Upload Engine -> Cloudinary CDN -->
  <path d="M 1270, 985 L 1380, 985 L 1380, 1480" class="conn-blue" marker-end="url(#arrowBlue)" />
  <g transform="translate(1380, 1140)">
    <rect x="-70" y="-8" width="140" height="16" class="edge-label-bg" />
    <text y="4" class="edge-text">18. Validated Photo Uploads</text>
  </g>

  <!-- Realtime WSS Push: L4 Realtime Engine -> L1 Realtime Client -->
  <path d="M 740, 1630 L 60, 1630 L 60, 145 L 470, 145 L 470, 105" class="conn-dashed" marker-end="url(#arrowGray)" />
  <g transform="translate(60, 880)">
    <rect x="-85" y="-8" width="170" height="16" class="edge-label-bg" />
    <text y="4" class="edge-text">14. Realtime WSS Push (Live Table Sync)</text>
  </g>

  <!-- Footer Specification Info -->
  <g transform="translate(800, 1915)" text-anchor="middle">
    <text y="0" font-size="12" font-weight="600" fill="#64748b">J &amp; D Beach House · Official System Architecture Diagram · High-Definition Vector Specification</text>
    <text y="18" font-size="11" fill="#94a3b8">Solid Blue = Primary HTTPS &amp; SQL Query Flow · Dashed Gray = Realtime WebSockets &amp; Webhooks · Dark Border = Layer Boundaries</text>
  </g>
</svg>`;
}

/**
 * Generate Professional System Architecture Draw.io XML
 */
function generateSystemArchitectureDrawio() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="Antigravity Professional Diagram Tool" version="24.0.0" type="device">
  <diagram id="sys-arch" name="J &amp; D Beach House - System Architecture">
    <mxGraphModel dx="1600" dy="1100" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1950" background="#ffffff" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />

        <!-- ================= LAYER 1: CLIENT LAYER ================= -->
        <mxCell id="L1_Container" value="1. Frontend Client Layer (React 18 + Vite + TS)" style="swimlane;whiteSpace=wrap;html=1;startSize=28;fillColor=#f8fafc;strokeColor=#64748b;strokeWidth=1.5;fontStyle=1;fontSize=13;fontColor=#1e293b;collapsible=0;" vertex="1" parent="1">
          <mxGeometry x="100" y="70" width="1400" height="250" as="geometry" />
        </mxCell>
        <mxCell id="L1_SocketClient" value="&lt;b&gt;Socket.io Client&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(Realtime Chatbot Socket)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L1_Container">
          <mxGeometry x="40" y="45" width="260" height="60" as="geometry" />
        </mxCell>
        <mxCell id="L1_RealtimeClient" value="&lt;b&gt;Supabase Realtime Client&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(PostgreSQL CDC Listener)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L1_Container">
          <mxGeometry x="340" y="45" width="260" height="60" as="geometry" />
        </mxCell>
        <mxCell id="L1_StaffPortals" value="&lt;b&gt;Multi-Role Operations Desks&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(Reception, Accounting, Depts, Executive Admin)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L1_Container">
          <mxGeometry x="180" y="155" width="320" height="70" as="geometry" />
        </mxCell>
        <mxCell id="L1_GuestPortal" value="&lt;b&gt;Public Guest Portal&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(Booking Flow, Room Gallery, Ocean Synth)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L1_Container">
          <mxGeometry x="540" y="155" width="320" height="70" as="geometry" />
        </mxCell>
        <mxCell id="L1_CustomerHub" value="&lt;b&gt;Guest Experience Hub&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(In-Room Orders, Digital RFID Pass)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L1_Container">
          <mxGeometry x="900" y="155" width="320" height="70" as="geometry" />
        </mxCell>

        <!-- Edge 15: Realtime -> Desks -->
        <mxCell id="E15" value="15. Reactive State Refresh" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#64748b;strokeWidth=1.5;dashed=1;fontColor=#475569;fontSize=10;" edge="1" parent="L1_Container" source="L1_RealtimeClient" target="L1_StaffPortals">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- ================= LAYER 2: SECURITY PERIMETER ================= -->
        <mxCell id="L2_Container" value="2. Security &amp;amp; Firewall Perimeter" style="swimlane;whiteSpace=wrap;html=1;startSize=28;fillColor=#f8fafc;strokeColor=#64748b;strokeWidth=1.5;fontStyle=1;fontSize=13;fontColor=#1e293b;collapsible=0;" vertex="1" parent="1">
          <mxGeometry x="520" y="390" width="560" height="420" as="geometry" />
        </mxCell>
        <mxCell id="L2_RateLimit" value="&lt;b&gt;Rate Limiter&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(Global 300 req / 15m · Booking 5 req / m)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L2_Container">
          <mxGeometry x="50" y="45" width="460" height="55" as="geometry" />
        </mxCell>
        <mxCell id="L2_NGWF" value="&lt;b&gt;Next-Gen Web App Firewall (NGWF)&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(Deep Payload SQLi / XSS / Traversal Filter)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L2_Container">
          <mxGeometry x="50" y="140" width="460" height="55" as="geometry" />
        </mxCell>
        <mxCell id="L2_AntiXSS" value="&lt;b&gt;Anti-XSS Sanitizer&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(Recursive JSON &amp;amp; Query Scrubber)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L2_Container">
          <mxGeometry x="50" y="235" width="460" height="55" as="geometry" />
        </mxCell>
        <mxCell id="L2_CSRF" value="&lt;b&gt;Cookie Tokenizer&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(Double-Submit CSRF Protection)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L2_Container">
          <mxGeometry x="50" y="330" width="460" height="55" as="geometry" />
        </mxCell>

        <!-- Internal L2 edges -->
        <mxCell id="E2" value="2. Rate-Passed Request" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="L2_Container" source="L2_RateLimit" target="L2_NGWF">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="E3" value="3. Threat Inspected" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="L2_Container" source="L2_NGWF" target="L2_AntiXSS">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="E4" value="4. Payload Sanitized" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="L2_Container" source="L2_AntiXSS" target="L2_CSRF">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- L1 to L2 Connections -->
        <mxCell id="E1_Staff" value="1. HTTPS REST (Task Dispatch &amp;amp; Reports)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="1" source="L1_StaffPortals" target="L2_RateLimit">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="E1_Guest" value="1. HTTPS REST (Browse &amp;amp; Reserve)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="1" source="L1_GuestPortal" target="L2_RateLimit">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="E1_Hub" value="1. HTTPS REST (Orders &amp;amp; Digital Key)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="1" source="L1_CustomerHub" target="L2_RateLimit">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- ================= LAYER 3: EXPRESS.JS BACKEND ================= -->
        <mxCell id="L3_Container" value="3. Express.js Backend Server (Node.js)" style="swimlane;whiteSpace=wrap;html=1;startSize=28;fillColor=#f8fafc;strokeColor=#64748b;strokeWidth=1.5;fontStyle=1;fontSize=13;fontColor=#1e293b;collapsible=0;" vertex="1" parent="1">
          <mxGeometry x="100" y="880" width="1400" height="260" as="geometry" />
        </mxCell>
        <mxCell id="L3_Telemetry" value="&lt;b&gt;Telemetry &amp;amp; Forecasting Engine&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(Live Visitor Heartbeat &amp;amp; Surge Predictor)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L3_Container">
          <mxGeometry x="40" y="45" width="320" height="60" as="geometry" />
        </mxCell>
        <mxCell id="L3_SocketServer" value="&lt;b&gt;Socket.io Engine&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(Alan / J &amp;amp; D Bot AI Concierge)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L3_Container">
          <mxGeometry x="400" y="45" width="340" height="60" as="geometry" />
        </mxCell>
        <mxCell id="L3_RESTApi" value="&lt;b&gt;Modular REST Endpoints&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#2563eb&quot;&gt;&lt;b&gt;(/rooms, /reservations, /department, /analytics)&lt;/b&gt;&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#2563eb;strokeWidth=1.6;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L3_Container">
          <mxGeometry x="400" y="160" width="440" height="65" as="geometry" />
        </mxCell>
        <mxCell id="L3_UploadEngine" value="&lt;b&gt;Secure Media Upload Engine&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(MIME Type Whitelist &amp;amp; UUID Filenames)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L3_Container">
          <mxGeometry x="980" y="45" width="380" height="60" as="geometry" />
        </mxCell>

        <!-- L3 Internal Socket to REST -->
        <mxCell id="E_SocketQuery" value="Query Room Rates &amp;amp; Info" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#64748b;strokeWidth=1.5;dashed=1;fontColor=#475569;fontSize=10;" edge="1" parent="L3_Container" source="L3_SocketServer" target="L3_RESTApi">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- L2 to L3 Link -->
        <mxCell id="E5" value="5. CSRF Verified" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="1" source="L2_CSRF" target="L3_RESTApi">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Socket Duplex Link (Client to Engine) -->
        <mxCell id="E_SocketDuplex" value="WSS Duplex (Instant Chat &amp;amp; Typing Events)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#0f172a;strokeWidth=1.8;fontColor=#0f172a;fontSize=10;" edge="1" parent="1" source="L1_SocketClient" target="L3_SocketServer">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="140" y="115" />
              <mxPoint x="140" y="820" />
              <mxPoint x="570" y="820" />
            </Array>
          </mxGeometry>
        </mxCell>

        <!-- ================= LAYER 4: SUPABASE DATABASE ================= -->
        <mxCell id="L4_Container" value="4. Supabase Database &amp;amp; BaaS (PostgreSQL 15+)" style="swimlane;whiteSpace=wrap;html=1;startSize=28;fillColor=#f8fafc;strokeColor=#64748b;strokeWidth=1.5;fontStyle=1;fontSize=13;fontColor=#1e293b;collapsible=0;" vertex="1" parent="1">
          <mxGeometry x="100" y="1200" width="980" height="530" as="geometry" />
        </mxCell>
        <mxCell id="L4_RLS" value="&lt;b&gt;Row-Level Security (RLS)&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(Self-Data Isolation &amp;amp; is_admin_or_staff Checks)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L4_Container">
          <mxGeometry x="40" y="50" width="280" height="65" as="geometry" />
        </mxCell>
        <mxCell id="L4_RPC" value="&lt;b&gt;Stored Procedure: available_rooms()&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(Dynamic Date-Range Availability Matrix)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L4_Container">
          <mxGeometry x="350" y="50" width="290" height="65" as="geometry" />
        </mxCell>
        <mxCell id="L4_GiST" value="&lt;b&gt;GiST Exclusion Constraint&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(Hard Overbooking Guard: 0 Double Bookings)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L4_Container">
          <mxGeometry x="670" y="50" width="270" height="65" as="geometry" />
        </mxCell>

        <mxCell id="L4_Tables" value="&lt;b&gt;PostgreSQL Relational Tables&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#2563eb&quot;&gt;&lt;b&gt;profiles, rooms, reservations, orders, tasks, inventory&lt;/b&gt;&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#2563eb;strokeWidth=1.6;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L4_Container">
          <mxGeometry x="290" y="205" width="400" height="65" as="geometry" />
        </mxCell>

        <mxCell id="L4_Triggers" value="&lt;b&gt;Database Triggers&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(sync_room_rating, handle_new_user, touch_updated_at)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L4_Container">
          <mxGeometry x="60" y="360" width="380" height="70" as="geometry" />
        </mxCell>
        <mxCell id="L4_RealtimeEngine" value="&lt;b&gt;Supabase Realtime Engine&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(PostgreSQL WAL Change Data Capture)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L4_Container">
          <mxGeometry x="540" y="360" width="380" height="70" as="geometry" />
        </mxCell>

        <!-- L4 Internal Connections -->
        <mxCell id="E7" value="7. Evaluated Query" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="L4_Container" source="L4_RLS" target="L4_Tables">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="E9" value="9. Scan Active Date Spans" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="L4_Container" source="L4_RPC" target="L4_Tables">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="E11" value="11. Overlap Check Passed" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="L4_Container" source="L4_GiST" target="L4_Tables">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="E12" value="12. On Insert / Update / Delete" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="L4_Container" source="L4_Tables" target="L4_Triggers">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="E13" value="13. WAL Log Changes" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="L4_Container" source="L4_Tables" target="L4_RealtimeEngine">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- L3 to L4 Connections -->
        <mxCell id="E6" value="6. Service-Role SQL Operations" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="1" source="L3_RESTApi" target="L4_RLS">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="E8" value="8. Availability Check" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="1" source="L3_RESTApi" target="L4_RPC">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="E10" value="10. Insert Stay Record" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="1" source="L3_RESTApi" target="L4_GiST">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- ================= LAYER 5: EXTERNAL CLOUD ================= -->
        <mxCell id="L5_Container" value="5. External Cloud Integrations" style="swimlane;whiteSpace=wrap;html=1;startSize=28;fillColor=#f8fafc;strokeColor=#64748b;strokeWidth=1.5;fontStyle=1;fontSize=13;fontColor=#1e293b;collapsible=0;" vertex="1" parent="1">
          <mxGeometry x="1120" y="1200" width="380" height="530" as="geometry" />
        </mxCell>
        <mxCell id="L5_Twilio" value="&lt;b&gt;Twilio SMS Gateway&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(Transactional Pings &amp;amp; Verification)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L5_Container">
          <mxGeometry x="40" y="80" width="300" height="80" as="geometry" />
        </mxCell>
        <mxCell id="L5_Cloudinary" value="&lt;b&gt;Cloudinary CDN&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(Optimized Image Asset Storage)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="L5_Container">
          <mxGeometry x="40" y="280" width="300" height="80" as="geometry" />
        </mxCell>

        <!-- Cross connections to L5 -->
        <mxCell id="E16" value="16. Outbound SMS Ping (Confirmation / Pass)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="1" source="L3_RESTApi" target="L5_Twilio">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="840" y="1070" />
              <mxPoint x="1270" y="1070" />
            </Array>
          </mxGeometry>
        </mxCell>
        <mxCell id="E17" value="17. Inbound Status Webhook (/webhooks/sms/status)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#64748b;strokeWidth=1.5;dashed=1;fontColor=#475569;fontSize=10;" edge="1" parent="1" source="L5_Twilio" target="L3_RESTApi">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="1310" y="1090" />
              <mxPoint x="840" y="1090" />
            </Array>
          </mxGeometry>
        </mxCell>
        <mxCell id="E18" value="18. Validated Photo Uploads" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="1" source="L3_UploadEngine" target="L5_Cloudinary">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- L4 Realtime to L1 Client -->
        <mxCell id="E14" value="14. Realtime WSS Push (Live Table Sync)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#64748b;strokeWidth=1.5;dashed=1;fontColor=#475569;fontSize=10;" edge="1" parent="1" source="L4_RealtimeEngine" target="L1_RealtimeClient">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="60" y="1630" />
              <mxPoint x="60" y="145" />
              <mxPoint x="470" y="145" />
            </Array>
          </mxGeometry>
        </mxCell>

      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

/**
 * Generate Professional Clean Data Hierarchy SVG (Matching the same white enterprise format)
 */
function generateDataHierarchySvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" width="1600" height="1200" style="background:#ffffff; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <defs>
    <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.07" />
    </filter>
    <marker id="arrowBlue" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#2563eb" />
    </marker>
    <marker id="arrowGray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
    </marker>
  </defs>

  <style>
    .tier-box { fill: #f8fafc; stroke: #64748b; stroke-width: 1.5; rx: 8px; }
    .tier-title { font-size: 13px; font-weight: 700; fill: #1e293b; }
    .card-box { fill: #ffffff; stroke: #475569; stroke-width: 1.2; rx: 6px; }
    .card-box-accent { fill: #ffffff; stroke: #2563eb; stroke-width: 1.6; rx: 6px; }
    .node-title { font-size: 14px; font-weight: 700; fill: #0f172a; text-anchor: middle; }
    .node-sub { font-size: 11px; font-weight: 400; fill: #475569; text-anchor: middle; }
    .node-sub-blue { font-size: 11px; font-weight: 600; fill: #2563eb; text-anchor: middle; }
    .edge-label-bg { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1; rx: 4px; }
    .edge-text { font-size: 10px; font-weight: 600; fill: #334155; text-anchor: middle; }
    .conn-blue { stroke: #2563eb; stroke-width: 1.5; fill: none; }
    .conn-dashed { stroke: #64748b; stroke-width: 1.5; stroke-dasharray: 5 4; fill: none; }
  </style>

  <!-- Title Header -->
  <g transform="translate(800, 35)" text-anchor="middle">
    <text y="0" font-size="22" font-weight="800" fill="#0f172a">J &amp; D Beach House · Relational Data Hierarchy</text>
    <text y="22" font-size="12" font-weight="500" fill="#64748b">Multi-Tier Foreign Key Dependencies, PostgreSQL 15+ Schema Isolation &amp; Supabase Identity Roots</text>
  </g>

  <!-- TIER 0: DATABASE ROOT -->
  <g transform="translate(80, 75)">
    <rect width="1440" height="95" class="tier-box" />
    <text x="20" y="24" class="tier-title">Tier 0: Database &amp; Schema Root (PostgreSQL 15+ Supabase)</text>

    <g transform="translate(470, 35)" filter="url(#cardShadow)">
      <rect width="500" height="48" class="card-box" />
      <text x="250" y="20" class="node-title">Database: J &amp; D Beach House Core DB</text>
      <text x="250" y="38" class="node-sub">(Public Schema · pgcrypto · btree_gist extensions)</text>
    </g>
  </g>

  <!-- TIER 1: MASTER ROOTS -->
  <g transform="translate(80, 205)">
    <rect width="1440" height="120" class="tier-box" />
    <text x="20" y="24" class="tier-title">Tier 1: Master Roots (Identity &amp; Catalog Assets)</text>

    <!-- auth.users -->
    <g transform="translate(100, 42)" filter="url(#cardShadow)">
      <rect width="360" height="60" class="card-box-accent" />
      <text x="180" y="24" class="node-title">auth.users</text>
      <text x="180" y="44" class="node-sub-blue">(Supabase Cryptographic Identity Root · UUID)</text>
    </g>

    <!-- rooms catalog -->
    <g transform="translate(540, 42)" filter="url(#cardShadow)">
      <rect width="360" height="60" class="card-box" />
      <text x="180" y="24" class="node-title">rooms</text>
      <text x="180" y="44" class="node-sub">(Accommodation Master Catalog &amp; Unit Inventory)</text>
    </g>

    <!-- dept_name enum -->
    <g transform="translate(980, 42)" filter="url(#cardShadow)">
      <rect width="360" height="60" class="card-box" />
      <text x="180" y="24" class="node-title">dept_name (ENUM)</text>
      <text x="180" y="44" class="node-sub">(front_desk · housekeeping · kitchen · tours · maintenance)</text>
    </g>
  </g>

  <!-- TIER 2: IDENTITY PROFILES -->
  <g transform="translate(80, 360)">
    <rect width="1440" height="110" class="tier-box" />
    <text x="20" y="24" class="tier-title">Tier 2: User Profiles (1:1 Cryptographic Identity Mapping)</text>

    <g transform="translate(420, 35)" filter="url(#cardShadow)">
      <rect width="600" height="60" class="card-box-accent" />
      <text x="300" y="24" class="node-title">profiles</text>
      <text x="300" y="44" class="node-sub-blue">Full Name · Phone · Address · Role: customer | staff | receptionist | accounting | admin</text>
    </g>
  </g>

  <!-- Connectors: Tier 0 -> Tier 1 -->
  <path d="M 720, 170 L 720, 205" class="conn-blue" marker-end="url(#arrowBlue)" />

  <!-- Connectors: Tier 1 Auth -> Tier 2 Profiles -->
  <path d="M 360, 307 L 360, 335 L 600, 335 L 600, 395" class="conn-blue" marker-end="url(#arrowBlue)" />
  <g transform="translate(480, 335)">
    <rect x="-95" y="-8" width="190" height="16" class="edge-label-bg" />
    <text y="4" class="edge-text">1:1 On Delete Cascade (id = id)</text>
  </g>

  <!-- TIER 3: CORE TRANSACTIONAL & OPERATIONAL ENGINE -->
  <g transform="translate(80, 505)">
    <rect width="1440" height="145" class="tier-box" />
    <text x="20" y="24" class="tier-title">Tier 3: Core Transactional &amp; Operational Entities</text>

    <!-- reservations -->
    <g transform="translate(40, 42)" filter="url(#cardShadow)">
      <rect width="280" height="85" class="card-box-accent" />
      <text x="140" y="24" class="node-title">reservations</text>
      <text x="140" y="42" class="node-sub-blue">[GiST Exclusion Hard Guard]</text>
      <text x="140" y="58" class="node-sub">Check-In, Check-Out, Nights, Total PHP</text>
      <text x="140" y="74" class="node-sub">FK: guest_id &amp; room_id</text>
    </g>

    <!-- resort_orders -->
    <g transform="translate(340, 42)" filter="url(#cardShadow)">
      <rect width="250" height="85" class="card-box" />
      <text x="125" y="24" class="node-title">resort_orders</text>
      <text x="125" y="44" class="node-sub">Dining, Tour Bookings, Amenities</text>
      <text x="125" y="62" class="node-sub">Status: pending / confirmed</text>
      <text x="125" y="76" class="node-sub">FK: guest_id → profiles.id</text>
    </g>

    <!-- chat_messages -->
    <g transform="translate(610, 42)" filter="url(#cardShadow)">
      <rect width="250" height="85" class="card-box" />
      <text x="125" y="24" class="node-title">chat_messages</text>
      <text x="125" y="44" class="node-sub">AI Receptionist Dialogues</text>
      <text x="125" y="62" class="node-sub">Guest Inquiries &amp; Transcripts</text>
      <text x="125" y="76" class="node-sub">FK: profile_id → profiles.id</text>
    </g>

    <!-- department_tasks -->
    <g transform="translate(880, 42)" filter="url(#cardShadow)">
      <rect width="260" height="85" class="card-box" />
      <text x="130" y="24" class="node-title">department_tasks</text>
      <text x="130" y="44" class="node-sub">Housekeeping &amp; Maint Queue</text>
      <text x="130" y="62" class="node-sub">Task Priority, Status, Assignee</text>
      <text x="130" y="76" class="node-sub">FK: room_id, dept_name</text>
    </g>

    <!-- resort_inventory -->
    <g transform="translate(1160, 42)" filter="url(#cardShadow)">
      <rect width="240" height="85" class="card-box" />
      <text x="120" y="24" class="node-title">resort_inventory</text>
      <text x="120" y="44" class="node-sub">Stock Item Name, Unit Qty</text>
      <text x="120" y="62" class="node-sub">Reorder Thresholds</text>
      <text x="120" y="76" class="node-sub">Category: dept_name ENUM</text>
    </g>
  </g>

  <!-- Connectors: Tier 2 Profiles -> Tier 3 Entities -->
  <path d="M 600, 455 L 600, 485 L 260, 485 L 260, 545" class="conn-blue" marker-end="url(#arrowBlue)" />
  <path d="M 600, 455 L 600, 485 L 545, 485 L 545, 545" class="conn-blue" marker-end="url(#arrowBlue)" />
  <path d="M 720, 455 L 720, 485 L 815, 485 L 815, 545" class="conn-blue" marker-end="url(#arrowBlue)" />
  <path d="M 800, 455 L 800, 485 L 1090, 485 L 1090, 545" class="conn-blue" marker-end="url(#arrowBlue)" />

  <!-- Connectors: Rooms Catalog -> Reservations -->
  <path d="M 800, 325 L 800, 345 L 220, 345 L 220, 545" class="conn-dashed" marker-end="url(#arrowGray)" />

  <!-- TIER 4: LEAF TRANSACTIONS & AUDIT TRAILS -->
  <g transform="translate(80, 690)">
    <rect width="1440" height="130" class="tier-box" />
    <text x="20" y="24" class="tier-title">Tier 4: Leaf Transactions &amp; Audit Trails</text>

    <!-- reviews -->
    <g transform="translate(200, 38)" filter="url(#cardShadow)">
      <rect width="460" height="70" class="card-box" />
      <text x="230" y="26" class="node-title">reviews</text>
      <text x="230" y="44" class="node-sub">(1 to 5 Star Rating · Verified Stay Comments · 1:1 per Stay)</text>
      <text x="230" y="58" class="node-sub">FK: reservation_id → reservations.id</text>
    </g>

    <!-- notifications -->
    <g transform="translate(780, 38)" filter="url(#cardShadow)">
      <rect width="460" height="70" class="card-box" />
      <text x="230" y="26" class="node-title">notifications</text>
      <text x="230" y="44" class="node-sub">(Twilio Outbound SMS · Digital Key Delivery · Audit Log)</text>
      <text x="230" y="58" class="node-sub">FK: reservation_id &amp; profile_id</text>
    </g>
  </g>

  <!-- Connectors: Reservations -> Tier 4 -->
  <path d="M 260, 632 L 260, 665 L 510, 665 L 510, 728" class="conn-blue" marker-end="url(#arrowBlue)" />
  <g transform="translate(380, 665)">
    <rect x="-60" y="-8" width="120" height="16" class="edge-label-bg" />
    <text y="4" class="edge-text">1:1 Verified Stay</text>
  </g>

  <path d="M 260, 632 L 260, 675 L 1090, 675 L 1090, 728" class="conn-blue" marker-end="url(#arrowBlue)" />
  <g transform="translate(720, 675)">
    <rect x="-60" y="-8" width="120" height="16" class="edge-label-bg" />
    <text y="4" class="edge-text">1:N Delivery Audit</text>
  </g>

  <!-- TIER 5: ANALYTICAL AGGREGATION VIEWS -->
  <g transform="translate(80, 860)">
    <rect width="1440" height="130" class="tier-box" />
    <text x="20" y="24" class="tier-title">Tier 5: Business Intelligence &amp; Analytics Aggregation Views</text>

    <!-- analytics_overview -->
    <g transform="translate(100, 38)" filter="url(#cardShadow)">
      <rect width="600" height="70" class="card-box-accent" />
      <text x="300" y="26" class="node-title">analytics_overview (SQL View)</text>
      <text x="300" y="44" class="node-sub-blue">Real-Time Occupancy Rate % · Weekly Revenue (PHP) · Arrivals / Departures</text>
      <text x="300" y="58" class="node-sub">Aggregates reservations, rooms catalog, reviews, notifications</text>
    </g>

    <!-- analytics_daily -->
    <g transform="translate(740, 38)" filter="url(#cardShadow)">
      <rect width="600" height="70" class="card-box-accent" />
      <text x="300" y="26" class="node-title">analytics_daily (SQL View)</text>
      <text x="300" y="44" class="node-sub-blue">Timeseries Nights Sold · Revenue Projections · 7-Day Forecast Flags</text>
      <text x="300" y="58" class="node-sub">Aggregates daily reservation pacing &amp; room rate calendar</text>
    </g>
  </g>

  <!-- Connectors: Tier 3/4 -> Tier 5 -->
  <path d="M 180, 632 L 180, 898" class="conn-dashed" marker-end="url(#arrowGray)" />
  <g transform="translate(180, 840)">
    <rect x="-85" y="-8" width="170" height="16" class="edge-label-bg" />
    <text y="4" class="edge-text">Aggregates Stays &amp; Nightly Rev</text>
  </g>

  <!-- Footer Specification Info -->
  <g transform="translate(800, 1160)" text-anchor="middle">
    <text y="0" font-size="12" font-weight="600" fill="#64748b">J &amp; D Beach House · Data Hierarchy &amp; Schema Isolation Specification</text>
    <text y="18" font-size="11" fill="#94a3b8">Solid Blue = Foreign Key Hierarchy · Dashed Gray = Cross-Tier Dependency &amp; SQL Aggregations · White Cards = Entity Tables &amp; Views</text>
  </g>
</svg>`;
}

/**
 * Generate Professional Data Hierarchy Draw.io XML
 */
function generateDataHierarchyDrawio() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="Antigravity Professional Diagram Tool" version="24.0.0" type="device">
  <diagram id="data-hierarchy" name="J &amp; D Beach House - Data Hierarchy">
    <mxGraphModel dx="1600" dy="1100" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1200" background="#ffffff" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />

        <!-- Tier 0: Database Root -->
        <mxCell id="T0_Box" value="Tier 0: Database &amp;amp; Schema Root (PostgreSQL 15+ Supabase)" style="swimlane;whiteSpace=wrap;html=1;startSize=26;fillColor=#f8fafc;strokeColor=#64748b;strokeWidth=1.5;fontStyle=1;fontSize=13;fontColor=#1e293b;collapsible=0;" vertex="1" parent="1">
          <mxGeometry x="80" y="70" width="1440" height="95" as="geometry" />
        </mxCell>
        <mxCell id="T0_DB" value="&lt;b&gt;Database: J &amp;amp; D Beach House Core DB&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(Public Schema · pgcrypto · btree_gist extensions)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="T0_Box">
          <mxGeometry x="470" y="35" width="500" height="48" as="geometry" />
        </mxCell>

        <!-- Tier 1: Master Roots -->
        <mxCell id="T1_Box" value="Tier 1: Master Roots (Identity &amp;amp; Catalog Assets)" style="swimlane;whiteSpace=wrap;html=1;startSize=26;fillColor=#f8fafc;strokeColor=#64748b;strokeWidth=1.5;fontStyle=1;fontSize=13;fontColor=#1e293b;collapsible=0;" vertex="1" parent="1">
          <mxGeometry x="80" y="200" width="1440" height="120" as="geometry" />
        </mxCell>
        <mxCell id="T1_Auth" value="&lt;b&gt;auth.users&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#2563eb&quot;&gt;&lt;b&gt;(Supabase Cryptographic Identity Root · UUID)&lt;/b&gt;&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#2563eb;strokeWidth=1.6;fontColor=#0f172a;fontSize=12;" vertex="1" parent="T1_Box">
          <mxGeometry x="100" y="40" width="360" height="60" as="geometry" />
        </mxCell>
        <mxCell id="T1_Rooms" value="&lt;b&gt;rooms&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(Accommodation Master Catalog &amp;amp; Unit Inventory)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="T1_Box">
          <mxGeometry x="540" y="40" width="360" height="60" as="geometry" />
        </mxCell>
        <mxCell id="T1_Dept" value="&lt;b&gt;dept_name (ENUM)&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(front_desk · housekeeping · kitchen · tours · maintenance)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="T1_Box">
          <mxGeometry x="980" y="40" width="360" height="60" as="geometry" />
        </mxCell>

        <!-- Tier 2: Profiles -->
        <mxCell id="T2_Box" value="Tier 2: User Profiles (1:1 Cryptographic Identity Mapping)" style="swimlane;whiteSpace=wrap;html=1;startSize=26;fillColor=#f8fafc;strokeColor=#64748b;strokeWidth=1.5;fontStyle=1;fontSize=13;fontColor=#1e293b;collapsible=0;" vertex="1" parent="1">
          <mxGeometry x="80" y="355" width="1440" height="110" as="geometry" />
        </mxCell>
        <mxCell id="T2_Profiles" value="&lt;b&gt;profiles&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#2563eb&quot;&gt;&lt;b&gt;Full Name · Phone · Address · Role: customer | staff | receptionist | accounting | admin&lt;/b&gt;&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#2563eb;strokeWidth=1.6;fontColor=#0f172a;fontSize=12;" vertex="1" parent="T2_Box">
          <mxGeometry x="420" y="35" width="600" height="60" as="geometry" />
        </mxCell>

        <mxCell id="E_Auth_Prof" value="1:1 On Delete Cascade (id = id)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="1" source="T1_Auth" target="T2_Profiles">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Tier 3: Core Transactional -->
        <mxCell id="T3_Box" value="Tier 3: Core Transactional &amp;amp; Operational Entities" style="swimlane;whiteSpace=wrap;html=1;startSize=26;fillColor=#f8fafc;strokeColor=#64748b;strokeWidth=1.5;fontStyle=1;fontSize=13;fontColor=#1e293b;collapsible=0;" vertex="1" parent="1">
          <mxGeometry x="80" y="500" width="1440" height="145" as="geometry" />
        </mxCell>
        <mxCell id="T3_Reservations" value="&lt;b&gt;reservations&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#2563eb&quot;&gt;&lt;b&gt;[GiST Exclusion Hard Guard]&lt;/b&gt;&lt;/font&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;Check-In, Check-Out, Nights, Total PHP&lt;br&gt;FK: guest_id &amp;amp; room_id&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#2563eb;strokeWidth=1.8;fontColor=#0f172a;fontSize=12;" vertex="1" parent="T3_Box">
          <mxGeometry x="40" y="40" width="280" height="85" as="geometry" />
        </mxCell>
        <mxCell id="T3_Orders" value="&lt;b&gt;resort_orders&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;Dining, Tour Bookings, Amenities&lt;br&gt;Status: pending / confirmed&lt;br&gt;FK: guest_id → profiles.id&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="T3_Box">
          <mxGeometry x="340" y="40" width="250" height="85" as="geometry" />
        </mxCell>
        <mxCell id="T3_Chat" value="&lt;b&gt;chat_messages&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;AI Receptionist Dialogues&lt;br&gt;Guest Inquiries &amp;amp; Transcripts&lt;br&gt;FK: profile_id → profiles.id&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="T3_Box">
          <mxGeometry x="610" y="40" width="250" height="85" as="geometry" />
        </mxCell>
        <mxCell id="T3_Tasks" value="&lt;b&gt;department_tasks&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;Housekeeping &amp;amp; Maint Queue&lt;br&gt;Task Priority, Status, Assignee&lt;br&gt;FK: room_id, dept_name&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="T3_Box">
          <mxGeometry x="880" y="40" width="260" height="85" as="geometry" />
        </mxCell>
        <mxCell id="T3_Inventory" value="&lt;b&gt;resort_inventory&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;Stock Item Name, Unit Qty&lt;br&gt;Reorder Thresholds&lt;br&gt;Category: dept_name ENUM&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="T3_Box">
          <mxGeometry x="1160" y="40" width="240" height="85" as="geometry" />
        </mxCell>

        <!-- Tier 2 to Tier 3 Connections -->
        <mxCell id="E_Prof_Res" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;" edge="1" parent="1" source="T2_Profiles" target="T3_Reservations">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="E_Prof_Orders" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;" edge="1" parent="1" source="T2_Profiles" target="T3_Orders">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="E_Prof_Chat" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;" edge="1" parent="1" source="T2_Profiles" target="T3_Chat">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="E_Prof_Tasks" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;" edge="1" parent="1" source="T2_Profiles" target="T3_Tasks">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Tier 4: Leaf Transactions -->
        <mxCell id="T4_Box" value="Tier 4: Leaf Transactions &amp;amp; Audit Trails" style="swimlane;whiteSpace=wrap;html=1;startSize=26;fillColor=#f8fafc;strokeColor=#64748b;strokeWidth=1.5;fontStyle=1;fontSize=13;fontColor=#1e293b;collapsible=0;" vertex="1" parent="1">
          <mxGeometry x="80" y="685" width="1440" height="130" as="geometry" />
        </mxCell>
        <mxCell id="T4_Reviews" value="&lt;b&gt;reviews&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(1 to 5 Star Rating · Verified Stay Comments · 1:1 per Stay)&lt;br&gt;FK: reservation_id → reservations.id&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="T4_Box">
          <mxGeometry x="200" y="38" width="460" height="70" as="geometry" />
        </mxCell>
        <mxCell id="T4_Notifications" value="&lt;b&gt;notifications&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;(Twilio Outbound SMS · Digital Key Delivery · Audit Log)&lt;br&gt;FK: reservation_id &amp;amp; profile_id&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;fontColor=#0f172a;fontSize=12;" vertex="1" parent="T4_Box">
          <mxGeometry x="780" y="38" width="460" height="70" as="geometry" />
        </mxCell>

        <mxCell id="E_Res_Reviews" value="1:1 Verified Stay" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="1" source="T3_Reservations" target="T4_Reviews">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="E_Res_Notifs" value="1:N Delivery Audit" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2563eb;strokeWidth=1.5;fontColor=#475569;fontSize=10;" edge="1" parent="1" source="T3_Reservations" target="T4_Notifications">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Tier 5: Analytics -->
        <mxCell id="T5_Box" value="Tier 5: Business Intelligence &amp;amp; Analytics Aggregation Views" style="swimlane;whiteSpace=wrap;html=1;startSize=26;fillColor=#f8fafc;strokeColor=#64748b;strokeWidth=1.5;fontStyle=1;fontSize=13;fontColor=#1e293b;collapsible=0;" vertex="1" parent="1">
          <mxGeometry x="80" y="855" width="1440" height="130" as="geometry" />
        </mxCell>
        <mxCell id="T5_Overview" value="&lt;b&gt;analytics_overview (SQL View)&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#2563eb&quot;&gt;&lt;b&gt;Real-Time Occupancy Rate % · Weekly Revenue (PHP) · Arrivals / Departures&lt;/b&gt;&lt;/font&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;Aggregates reservations, rooms catalog, reviews, notifications&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#2563eb;strokeWidth=1.6;fontColor=#0f172a;fontSize=12;" vertex="1" parent="T5_Box">
          <mxGeometry x="100" y="38" width="600" height="70" as="geometry" />
        </mxCell>
        <mxCell id="T5_Daily" value="&lt;b&gt;analytics_daily (SQL View)&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#2563eb&quot;&gt;&lt;b&gt;Timeseries Nights Sold · Revenue Projections · 7-Day Forecast Flags&lt;/b&gt;&lt;/font&gt;&lt;br&gt;&lt;font color=&quot;#475569&quot;&gt;Aggregates daily reservation pacing &amp;amp; room rate calendar&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#2563eb;strokeWidth=1.6;fontColor=#0f172a;fontSize=12;" vertex="1" parent="T5_Box">
          <mxGeometry x="740" y="38" width="600" height="70" as="geometry" />
        </mxCell>

        <mxCell id="E_Res_Analytics" value="Aggregates Stays &amp;amp; Nightly Rev" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#64748b;strokeWidth=1.5;dashed=1;fontColor=#475569;fontSize=10;" edge="1" parent="1" source="T3_Reservations" target="T5_Overview">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="180" y="660" />
              <mxPoint x="180" y="855" />
            </Array>
          </mxGeometry>
        </mxCell>

      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

/**
 * Render an SVG to high-resolution PNG using Headless Microsoft Edge
 */
function renderSvgToPng(svgPath, pngPath, width = 1600, height = 1950, scale = 2) {
  const fileUrl = 'file:///' + svgPath.replace(/\\/g, '/');
  const args = [
    '--headless=new',
    '--disable-gpu',
    `--force-device-scale-factor=${scale}`,
    `--window-size=${width},${height}`,
    `--screenshot=${pngPath}`,
    fileUrl
  ];
  console.log(`[Renderer] Rendering ${path.basename(svgPath)} -> ${path.basename(pngPath)}...`);
  execFileSync(EDGE_PATH, args, { stdio: 'inherit' });
  const stats = fs.statSync(pngPath);
  console.log(`[Renderer] Created: ${pngPath} (${(stats.size / 1024).toFixed(1)} KB)`);
  return pngPath;
}

/**
 * Main execution
 */
function runAll() {
  const rootDir = path.resolve(__dirname, '..');
  const archDir = path.join(rootDir, 'docs', 'architecture');
  const hierarchyDir = path.join(rootDir, 'docs', 'data-hierarchy');

  fs.mkdirSync(archDir, { recursive: true });
  fs.mkdirSync(hierarchyDir, { recursive: true });

  console.log('=== Generating Clean Professional Diagrams for J & D Beach House ===');

  // 1. System Architecture Diagram
  const sysSvg = generateSystemArchitectureSvg();
  const sysSvgPath = path.join(archDir, 'system_architecture_diagram.svg');
  fs.writeFileSync(sysSvgPath, sysSvg, 'utf8');

  const sysDrawio = generateSystemArchitectureDrawio();
  const sysDrawioPath = path.join(archDir, 'system_architecture_diagram.drawio');
  fs.writeFileSync(sysDrawioPath, sysDrawio, 'utf8');
  fs.writeFileSync(path.join(archDir, 'system_architecture.drawio'), sysDrawio, 'utf8');

  const sysPngPath = path.join(archDir, 'system_architecture_diagram.png');
  renderSvgToPng(sysSvgPath, sysPngPath, 1600, 1950, 2);
  fs.copyFileSync(sysPngPath, path.join(archDir, 'system_architecture_diagram_high_res.png'));
  fs.copyFileSync(sysPngPath, path.join(archDir, 'system_architecture_diagram_4k.png'));
  console.log('✓ System Architecture diagram finished.');

  // 2. Data Hierarchy Diagram
  const dataSvg = generateDataHierarchySvg();
  const dataSvgPath = path.join(hierarchyDir, 'data_hierarchy_diagram.svg');
  fs.writeFileSync(dataSvgPath, dataSvg, 'utf8');
  fs.copyFileSync(dataSvgPath, path.join(archDir, 'data_hierarchy_diagram.svg'));

  const dataDrawio = generateDataHierarchyDrawio();
  const dataDrawioPath = path.join(hierarchyDir, 'data_hierarchy_diagram.drawio');
  fs.writeFileSync(dataDrawioPath, dataDrawio, 'utf8');
  fs.copyFileSync(dataDrawioPath, path.join(archDir, 'data_hierarchy_diagram.drawio'));

  const dataPngPath = path.join(hierarchyDir, 'data_hierarchy_diagram.png');
  renderSvgToPng(dataSvgPath, dataPngPath, 1600, 1200, 2);
  fs.copyFileSync(dataPngPath, path.join(hierarchyDir, 'data_hierarchy_diagram.jpg'));
  fs.copyFileSync(dataPngPath, path.join(archDir, 'data_hierarchy_diagram.png'));
  console.log('✓ Data Hierarchy diagram finished.');

  console.log('=== All diagrams generated in professional clean format! ===');
}

if (require.main === module) {
  runAll();
}

module.exports = {
  generateSystemArchitectureSvg,
  generateSystemArchitectureDrawio,
  generateDataHierarchySvg,
  generateDataHierarchyDrawio,
  renderSvgToPng,
  runAll
};
