/**
 * Diagram Generator and Renderer for J & D Beach House
 * Generates Draw.io XML (.drawio), Vector SVG (.svg), and High-Res Raster (.png)
 * Supports both:
 *  1. Data Hierarchy Tier Flowchart (Tier 0 to Tier 5)
 *  2. Entity-Relationship (ER) Diagram (Exact 11 tables with crow's foot relationships)
 * Uses Microsoft Edge Headless engine for pixel-perfect 4K rasterization.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

/**
 * =========================================================================
 * 1. DATA HIERARCHY TIER FLOWCHART (DIAGRAM 2)
 * =========================================================================
 */
function generateDataHierarchyDrawio() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="Antigravity Draw.io MCP Server" version="24.0.0" type="device">
  <diagram id="data-hierarchy" name="J &amp; D Beach House - Data Hierarchy">
    <mxGraphModel dx="1600" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1100" background="#0b132b" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />

        <!-- Title Header -->
        <mxCell id="hdr_badge" value="&lt;font color=&quot;#38bdf8&quot;&gt;&lt;b&gt;DATA HIERARCHY &amp;amp; ENTITY DEPENDENCY SPECIFICATION&lt;/b&gt;&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1e293b;strokeColor=#38bdf8;strokeWidth=2;fontColor=#38bdf8;arcSize=50;" vertex="1" parent="1">
          <mxGeometry x="500" y="20" width="450" height="30" as="geometry" />
        </mxCell>
        <mxCell id="hdr_title" value="&lt;font color=&quot;#ffffff&quot; style=&quot;font-size: 24px;&quot;&gt;&lt;b&gt;J &amp;amp; D Beach House · Relational Data Hierarchy&lt;/b&gt;&lt;/font&gt;&lt;br&gt;&lt;font color=&quot;#94a3b8&quot; style=&quot;font-size: 13px;&quot;&gt;Multi-Tier Foreign Key Dependencies, Cryptographic Identity &amp;amp; PostgreSQL 15+ Schema Isolation&lt;/font&gt;" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;" vertex="1" parent="1">
          <mxGeometry x="400" y="55" width="650" height="50" as="geometry" />
        </mxCell>

        <!-- Tier 0: Root Schema -->
        <mxCell id="t0_db" value="&lt;b&gt;&lt;font style=&quot;font-size: 15px;&quot; color=&quot;#ffffff&quot;&gt;Core PostgreSQL 15+ Database&lt;/font&gt;&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#cbd5e1&quot;&gt;Supabase Core Instance · Public Schema&lt;br&gt;Extensions: pgcrypto · btree_gist&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#0f172a;strokeColor=#0284c7;strokeWidth=2;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="540" y="120" width="370" height="60" as="geometry" />
        </mxCell>

        <!-- Tier 1: Master Roots -->
        <mxCell id="t1_rooms" value="&lt;b&gt;&lt;font style=&quot;font-size: 14px;&quot; color=&quot;#ffffff&quot;&gt;rooms&lt;/font&gt;&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#a7f3d0&quot;&gt;Accommodation Catalog&lt;br&gt;Unit Inventory, Base Rates &amp;amp; Capacity&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#064e3b;strokeColor=#10b981;strokeWidth=2;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="120" y="230" width="280" height="70" as="geometry" />
        </mxCell>

        <mxCell id="t1_auth" value="&lt;b&gt;&lt;font style=&quot;font-size: 14px;&quot; color=&quot;#ffffff&quot;&gt;auth.users&lt;/font&gt;&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#bae6fd&quot;&gt;Supabase Cryptographic Identity Root&lt;br&gt;Managed OAuth / Passwords (UUID)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#075985;strokeColor=#38bdf8;strokeWidth=2;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="585" y="230" width="280" height="70" as="geometry" />
        </mxCell>

        <mxCell id="t1_dept" value="&lt;b&gt;&lt;font style=&quot;font-size: 14px;&quot; color=&quot;#ffffff&quot;&gt;dept_name (ENUM)&lt;/font&gt;&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#fde68a&quot;&gt;5 Operational Departments&lt;br&gt;front_desk · housekeeping · kitchen · tours · maint&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#78350f;strokeColor=#f59e0b;strokeWidth=2;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="1050" y="230" width="300" height="70" as="geometry" />
        </mxCell>

        <!-- Tier 2: Profiles (1:1 Auth) -->
        <mxCell id="t2_profiles" value="&lt;b&gt;&lt;font style=&quot;font-size: 15px;&quot; color=&quot;#ffffff&quot;&gt;profiles&lt;/font&gt;&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#99f6e4&quot;&gt;Full Name · Phone · Address · Emergency Contact&lt;br&gt;&lt;b&gt;Role:&lt;/b&gt; customer | staff | receptionist | accounting | administrator&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#134e4a;strokeColor=#2dd4bf;strokeWidth=2.5;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="525" y="350" width="400" height="70" as="geometry" />
        </mxCell>

        <!-- Tier 3: Core Transactional Entities -->
        <mxCell id="t3_orders" value="&lt;b&gt;&lt;font style=&quot;font-size: 14px;&quot; color=&quot;#ffffff&quot;&gt;resort_orders&lt;/font&gt;&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#bfdbfe&quot;&gt;In-Room Dining · Tour Bookings · Amenities&lt;br&gt;FK: guest_id → profiles.id&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1e3a8a;strokeColor=#60a5fa;strokeWidth=2;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="80" y="480" width="240" height="80" as="geometry" />
        </mxCell>

        <mxCell id="t3_reservations" value="&lt;b&gt;&lt;font style=&quot;font-size: 14px;&quot; color=&quot;#ffffff&quot;&gt;reservations&lt;/font&gt;&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#38bdf8&quot;&gt;&lt;b&gt;Date-Range Stay Engine (GiST Guard)&lt;/b&gt;&lt;/font&gt;&lt;br&gt;&lt;font color=&quot;#bfdbfe&quot;&gt;Check-In · Check-Out · Total PHP · Status&lt;br&gt;FK: guest_id &amp;amp; room_id&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1e3a8a;strokeColor=#38bdf8;strokeWidth=3;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="360" y="480" width="270" height="80" as="geometry" />
        </mxCell>

        <mxCell id="t3_chat" value="&lt;b&gt;&lt;font style=&quot;font-size: 14px;&quot; color=&quot;#ffffff&quot;&gt;chat_messages&lt;/font&gt;&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#bfdbfe&quot;&gt;AI Receptionist Dialogues &amp;amp; Transcripts&lt;br&gt;FK: profile_id → profiles.id&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1e3a8a;strokeColor=#60a5fa;strokeWidth=2;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="670" y="480" width="240" height="80" as="geometry" />
        </mxCell>

        <mxCell id="t3_tasks" value="&lt;b&gt;&lt;font style=&quot;font-size: 14px;&quot; color=&quot;#ffffff&quot;&gt;department_tasks&lt;/font&gt;&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#bfdbfe&quot;&gt;Housekeeping &amp;amp; Maintenance Queue&lt;br&gt;FK: created_by, room_id, dept_name&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1e3a8a;strokeColor=#60a5fa;strokeWidth=2;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="950" y="480" width="250" height="80" as="geometry" />
        </mxCell>

        <mxCell id="t3_inventory" value="&lt;b&gt;&lt;font style=&quot;font-size: 14px;&quot; color=&quot;#ffffff&quot;&gt;resort_inventory&lt;/font&gt;&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#fde68a&quot;&gt;Stock Qty &amp;amp; Reorder Triggers&lt;br&gt;Category: dept_name ENUM&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#78350f;strokeColor=#f59e0b;strokeWidth=2;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="1240" y="480" width="220" height="80" as="geometry" />
        </mxCell>

        <!-- Tier 4: Grandchild Transactions -->
        <mxCell id="t4_reviews" value="&lt;b&gt;&lt;font style=&quot;font-size: 14px;&quot; color=&quot;#ffffff&quot;&gt;reviews&lt;/font&gt;&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#c7d2fe&quot;&gt;Verified Stay 1-5 Star Ratings &amp;amp; Feedback&lt;br&gt;FK: 1:1 per stay (reservation_id)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#312e81;strokeColor=#818cf8;strokeWidth=2;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="270" y="630" width="260" height="75" as="geometry" />
        </mxCell>

        <mxCell id="t4_notifs" value="&lt;b&gt;&lt;font style=&quot;font-size: 14px;&quot; color=&quot;#ffffff&quot;&gt;notifications&lt;/font&gt;&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#c7d2fe&quot;&gt;Twilio SMS Logs &amp;amp; Pass Dispatch&lt;br&gt;FK: reservation_id &amp;amp; profile_id&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#312e81;strokeColor=#818cf8;strokeWidth=2;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="570" y="630" width="260" height="75" as="geometry" />
        </mxCell>

        <!-- Tier 5: Analytics Views -->
        <mxCell id="t5_analytics" value="&lt;b&gt;&lt;font style=&quot;font-size: 15px;&quot; color=&quot;#ffffff&quot;&gt;analytics_overview &amp;amp; analytics_daily (SQL Views)&lt;/font&gt;&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#fde68a&quot;&gt;Real-Time Occupancy Rate % · Weekly Revenue (PHP) · RevPAR · Check-Ins/Check-Outs · SMS Delivery Health&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#451a03;strokeColor=#fbbf24;strokeWidth=2.5;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="380" y="770" width="690" height="70" as="geometry" />
        </mxCell>

        <!-- CONNECTORS -->
        <mxCell id="e_db_auth" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#0284c7;strokeWidth=2;" edge="1" parent="1" source="t0_db" target="t1_auth">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="e_db_rooms" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#0284c7;strokeWidth=2;" edge="1" parent="1" source="t0_db" target="t1_rooms">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="e_db_dept" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#0284c7;strokeWidth=2;" edge="1" parent="1" source="t0_db" target="t1_dept">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <mxCell id="e_auth_prof" value="1:1 (id = id) CASCADE" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#38bdf8;strokeWidth=2.5;fontColor=#bae6fd;" edge="1" parent="1" source="t1_auth" target="t2_profiles">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <mxCell id="e_prof_orders" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2dd4bf;strokeWidth=2;" edge="1" parent="1" source="t2_profiles" target="t3_orders">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="e_prof_res" value="1:N guest_id" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2dd4bf;strokeWidth=2.5;fontColor=#99f6e4;" edge="1" parent="1" source="t2_profiles" target="t3_reservations">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="e_prof_chat" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2dd4bf;strokeWidth=2;" edge="1" parent="1" source="t2_profiles" target="t3_chat">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="e_prof_tasks" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#2dd4bf;strokeWidth=2;" edge="1" parent="1" source="t2_profiles" target="t3_tasks">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <mxCell id="e_rooms_res" value="1:N room_id" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#10b981;strokeWidth=2;dashed=1;fontColor=#a7f3d0;" edge="1" parent="1" source="t1_rooms" target="t3_reservations">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="e_dept_tasks" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#f59e0b;strokeWidth=2;dashed=1;" edge="1" parent="1" source="t1_dept" target="t3_tasks">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="e_dept_inv" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#f59e0b;strokeWidth=2;dashed=1;" edge="1" parent="1" source="t1_dept" target="t3_inventory">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <mxCell id="e_res_rev" value="1:1 Stay" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#38bdf8;strokeWidth=2;fontColor=#7dd3fc;" edge="1" parent="1" source="t3_reservations" target="t4_reviews">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="e_res_notif" value="1:N Audit" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#38bdf8;strokeWidth=2;fontColor=#7dd3fc;" edge="1" parent="1" source="t3_reservations" target="t4_notifs">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <mxCell id="e_res_analytics" value="Aggregates Stays, Nightly Revenue, Occupancy" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#fbbf24;strokeWidth=2;dashed=1;fontColor=#fde68a;" edge="1" parent="1" source="t3_reservations" target="t5_analytics">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="495" y="600" />
              <mxPoint x="200" y="600" />
              <mxPoint x="200" y="805" />
            </Array>
          </mxGeometry>
        </mxCell>

      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

function generateDataHierarchySvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1100" width="1600" height="1100" style="background:#0b132b; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <defs>
    <linearGradient id="dbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="roomsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064e3b" />
      <stop offset="100%" stop-color="#022c22" />
    </linearGradient>
    <linearGradient id="authGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#075985" />
      <stop offset="100%" stop-color="#0c4a6e" />
    </linearGradient>
    <linearGradient id="deptGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#78350f" />
      <stop offset="100%" stop-color="#451a03" />
    </linearGradient>
    <linearGradient id="profGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#134e4a" />
      <stop offset="100%" stop-color="#042f2e" />
    </linearGradient>
    <linearGradient id="coreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a" />
      <stop offset="100%" stop-color="#172554" />
    </linearGradient>
    <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#312e81" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </linearGradient>
    <linearGradient id="aggGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#451a03" />
      <stop offset="100%" stop-color="#290f02" />
    </linearGradient>

    <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.45" />
    </filter>
    <marker id="arrowSky" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#38bdf8" />
    </marker>
    <marker id="arrowTeal" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#2dd4bf" />
    </marker>
    <marker id="arrowGold" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#fbbf24" />
    </marker>
  </defs>

  <!-- Title Header -->
  <g transform="translate(800, 50)" text-anchor="middle">
    <rect x="-220" y="-30" width="440" height="28" rx="14" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" />
    <text y="-11" fill="#38bdf8" font-size="12" font-weight="700" letter-spacing="1.5">DATA HIERARCHY &amp; SYSTEM SPECIFICATION</text>
    <text y="28" fill="#ffffff" font-size="28" font-weight="800">J &amp; D Beach House · Entity Dependency Tree</text>
    <text y="54" fill="#94a3b8" font-size="14">Multi-Tier Relational Structure · Foreign Key Isolation · Supabase / PostgreSQL 15+</text>
  </g>

  <!-- Connecting Lines -->
  <!-- DB Root to Tier 1 -->
  <path d="M 800, 180 L 800, 230" stroke="#0284c7" stroke-width="2" marker-end="url(#arrowSky)" />
  <path d="M 615, 150 L 260, 150 L 260, 230" stroke="#0284c7" stroke-width="2" marker-end="url(#arrowSky)" />
  <path d="M 985, 150 L 1340, 150 L 1340, 230" stroke="#0284c7" stroke-width="2" marker-end="url(#arrowSky)" />

  <!-- Auth to Profiles -->
  <path d="M 800, 300 L 800, 350" stroke="#38bdf8" stroke-width="3" marker-end="url(#arrowSky)" />

  <!-- Profiles to Tier 3 Children -->
  <path d="M 800, 420 L 800, 450 L 200, 450 L 200, 480" stroke="#2dd4bf" stroke-width="2" marker-end="url(#arrowTeal)" />
  <path d="M 800, 420 L 800, 450 L 495, 450 L 495, 480" stroke="#2dd4bf" stroke-width="2.5" marker-end="url(#arrowTeal)" />
  <path d="M 800, 420 L 800, 480" stroke="#2dd4bf" stroke-width="2" marker-end="url(#arrowTeal)" />
  <path d="M 800, 420 L 800, 450 L 1075, 450 L 1075, 480" stroke="#2dd4bf" stroke-width="2" marker-end="url(#arrowTeal)" />

  <!-- Rooms Catalog to Reservations -->
  <path d="M 260, 300 L 260, 370 L 430, 370 L 430, 480" stroke="#10b981" stroke-width="2" stroke-dasharray="6 4" />

  <!-- Dept Enum to Tasks & Inventory -->
  <path d="M 1340, 300 L 1340, 370 L 1150, 370 L 1150, 480" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 4" />
  <path d="M 1340, 300 L 1340, 480" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 4" />

  <!-- Reservations to Tier 4 (Reviews & Notifications) -->
  <path d="M 495, 560 L 495, 595 L 400, 595 L 400, 630" stroke="#818cf8" stroke-width="2" marker-end="url(#arrowSky)" />
  <path d="M 495, 560 L 495, 595 L 700, 595 L 700, 630" stroke="#818cf8" stroke-width="2" marker-end="url(#arrowSky)" />

  <!-- Reservations & Units to Analytics -->
  <path d="M 495, 560 L 495, 605 L 140, 605 L 140, 805 L 440, 805" stroke="#fbbf24" stroke-width="2.5" stroke-dasharray="6 4" marker-end="url(#arrowGold)" />
  <path d="M 700, 705 L 700, 770" stroke="#fbbf24" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#arrowGold)" />

  <!-- TIER 0: ROOT DATABASE -->
  <g transform="translate(615, 120)" filter="url(#shadow)">
    <rect width="370" height="60" rx="10" fill="url(#dbGrad)" stroke="#0284c7" stroke-width="2" />
    <rect x="14" y="10" width="80" height="18" rx="4" fill="#0369a1" />
    <text x="54" y="23" fill="#38bdf8" font-size="10" font-weight="700" text-anchor="middle">TIER 0 · ROOT</text>
    <text x="14" y="44" fill="#ffffff" font-size="15" font-weight="700">Core PostgreSQL 15+ Database</text>
    <text x="14" y="56" fill="#94a3b8" font-size="11">Supabase Public Schema · pgcrypto · btree_gist</text>
  </g>

  <!-- TIER 1: MASTER ASSETS & AUTH -->
  <!-- Rooms Catalog -->
  <g transform="translate(120, 230)" filter="url(#shadow)">
    <rect width="280" height="70" rx="10" fill="url(#roomsGrad)" stroke="#10b981" stroke-width="2" />
    <rect x="14" y="10" width="85" height="18" rx="4" fill="#064e3b" />
    <text x="56" y="23" fill="#34d399" font-size="10" font-weight="700" text-anchor="middle">TIER 1 · MASTER</text>
    <text x="14" y="45" fill="#ffffff" font-size="16" font-weight="700">rooms</text>
    <text x="14" y="60" fill="#a7f3d0" font-size="11">Accommodations Master Catalog &amp; Rates</text>
  </g>

  <!-- Supabase Auth Root -->
  <g transform="translate(660, 230)" filter="url(#shadow)">
    <rect width="280" height="70" rx="10" fill="url(#authGrad)" stroke="#38bdf8" stroke-width="2.5" />
    <rect x="14" y="10" width="85" height="18" rx="4" fill="#0369a1" />
    <text x="56" y="23" fill="#38bdf8" font-size="10" font-weight="700" text-anchor="middle">TIER 1 · IDENTITY</text>
    <text x="14" y="45" fill="#ffffff" font-size="16" font-weight="700">auth.users</text>
    <text x="14" y="60" fill="#bae6fd" font-size="11">Cryptographic Identity Root (UUID)</text>
  </g>

  <!-- Dept Name Enum -->
  <g transform="translate(1200, 230)" filter="url(#shadow)">
    <rect width="280" height="70" rx="10" fill="url(#deptGrad)" stroke="#f59e0b" stroke-width="2" />
    <rect x="14" y="10" width="75" height="18" rx="4" fill="#78350f" />
    <text x="51" y="23" fill="#fbbf24" font-size="10" font-weight="700" text-anchor="middle">TIER 1 · ENUM</text>
    <text x="14" y="45" fill="#ffffff" font-size="16" font-weight="700">dept_name (ENUM)</text>
    <text x="14" y="60" fill="#fde68a" font-size="11">5 Operational Department Divisions</text>
  </g>

  <!-- TIER 2: IDENTITY PROFILES -->
  <g transform="translate(560, 350)" filter="url(#shadow)">
    <rect width="480" height="70" rx="10" fill="url(#profGrad)" stroke="#2dd4bf" stroke-width="2.5" />
    <rect x="14" y="10" width="105" height="18" rx="4" fill="#0f766e" />
    <text x="66" y="23" fill="#5eead4" font-size="10" font-weight="700" text-anchor="middle">TIER 2 · 1:1 AUTH</text>
    <text x="14" y="45" fill="#ffffff" font-size="16" font-weight="700">profiles</text>
    <text x="14" y="60" fill="#ccfbf1" font-size="11">Full Name · Phone · Role: customer | staff | receptionist | admin</text>
  </g>

  <!-- TIER 3: CORE OPERATIONAL ENGINE -->
  <g transform="translate(80, 480)" filter="url(#shadow)">
    <rect width="240" height="80" rx="10" fill="url(#coreGrad)" stroke="#60a5fa" stroke-width="2" />
    <rect x="12" y="10" width="80" height="18" rx="4" fill="#1e40af" />
    <text x="52" y="23" fill="#93c5fd" font-size="10" font-weight="700" text-anchor="middle">TIER 3 · 1:N</text>
    <text x="12" y="46" fill="#ffffff" font-size="15" font-weight="700">resort_orders</text>
    <text x="12" y="62" fill="#bfdbfe" font-size="11">Dining, Tours &amp; Amenities</text>
    <text x="12" y="74" fill="#60a5fa" font-size="10">FK: guest_id → profiles.id</text>
  </g>

  <g transform="translate(360, 480)" filter="url(#shadow)">
    <rect width="270" height="80" rx="10" fill="url(#coreGrad)" stroke="#38bdf8" stroke-width="3" />
    <rect x="12" y="10" width="115" height="18" rx="4" fill="#0369a1" />
    <text x="69" y="23" fill="#38bdf8" font-size="10" font-weight="700" text-anchor="middle">TIER 3 · CORE ENGINE</text>
    <text x="12" y="46" fill="#ffffff" font-size="15" font-weight="700">reservations</text>
    <text x="12" y="62" fill="#bae6fd" font-size="11">Date-Range Stay Engine (GiST Guard)</text>
    <text x="12" y="74" fill="#38bdf8" font-size="10">FK: guest_id &amp; room_id</text>
  </g>

  <g transform="translate(670, 480)" filter="url(#shadow)">
    <rect width="240" height="80" rx="10" fill="url(#coreGrad)" stroke="#60a5fa" stroke-width="2" />
    <rect x="12" y="10" width="80" height="18" rx="4" fill="#1e40af" />
    <text x="52" y="23" fill="#93c5fd" font-size="10" font-weight="700" text-anchor="middle">TIER 3 · 1:N</text>
    <text x="12" y="46" fill="#ffffff" font-size="15" font-weight="700">chat_messages</text>
    <text x="12" y="62" fill="#bfdbfe" font-size="11">AI Receptionist Transcripts</text>
    <text x="12" y="74" fill="#60a5fa" font-size="10">FK: profile_id → profiles.id</text>
  </g>

  <g transform="translate(950, 480)" filter="url(#shadow)">
    <rect width="250" height="80" rx="10" fill="url(#coreGrad)" stroke="#60a5fa" stroke-width="2" />
    <rect x="12" y="10" width="80" height="18" rx="4" fill="#1e40af" />
    <text x="52" y="23" fill="#93c5fd" font-size="10" font-weight="700" text-anchor="middle">TIER 3 · 1:N</text>
    <text x="12" y="46" fill="#ffffff" font-size="15" font-weight="700">department_tasks</text>
    <text x="12" y="62" fill="#bfdbfe" font-size="11">Housekeeping / Maint Queue</text>
    <text x="12" y="74" fill="#60a5fa" font-size="10">FK: created_by, room_id, dept</text>
  </g>

  <g transform="translate(1240, 480)" filter="url(#shadow)">
    <rect width="240" height="80" rx="10" fill="url(#deptGrad)" stroke="#f59e0b" stroke-width="2" />
    <rect x="12" y="10" width="80" height="18" rx="4" fill="#78350f" />
    <text x="52" y="23" fill="#fbbf24" font-size="10" font-weight="700" text-anchor="middle">TIER 3 · 1:N</text>
    <text x="12" y="46" fill="#ffffff" font-size="15" font-weight="700">resort_inventory</text>
    <text x="12" y="62" fill="#fde68a" font-size="11">Stock Qty &amp; Reorder Triggers</text>
    <text x="12" y="74" fill="#f59e0b" font-size="10">Category: dept_name ENUM</text>
  </g>

  <!-- TIER 4: LEAF TRANSACTIONS -->
  <g transform="translate(270, 630)" filter="url(#shadow)">
    <rect width="260" height="75" rx="10" fill="url(#leafGrad)" stroke="#818cf8" stroke-width="2" />
    <rect x="12" y="10" width="90" height="18" rx="4" fill="#3730a3" />
    <text x="57" y="23" fill="#c7d2fe" font-size="10" font-weight="700" text-anchor="middle">TIER 4 · 1:1 STAY</text>
    <text x="12" y="46" fill="#ffffff" font-size="15" font-weight="700">reviews</text>
    <text x="12" y="62" fill="#e0e7ff" font-size="11">Verified Stay Rating (1-5 Stars)</text>
  </g>

  <g transform="translate(570, 630)" filter="url(#shadow)">
    <rect width="260" height="75" rx="10" fill="url(#leafGrad)" stroke="#818cf8" stroke-width="2" />
    <rect x="12" y="10" width="80" height="18" rx="4" fill="#3730a3" />
    <text x="52" y="23" fill="#c7d2fe" font-size="10" font-weight="700" text-anchor="middle">TIER 4 · 1:N</text>
    <text x="12" y="46" fill="#ffffff" font-size="15" font-weight="700">notifications</text>
    <text x="12" y="62" fill="#e0e7ff" font-size="11">Twilio SMS Logs &amp; Pass Sent</text>
  </g>

  <!-- TIER 5: ANALYTICS AGGREGATION VIEWS -->
  <g transform="translate(440, 770)" filter="url(#shadow)">
    <rect width="720" height="75" rx="10" fill="url(#aggGrad)" stroke="#fbbf24" stroke-width="2.5" />
    <rect x="14" y="10" width="140" height="18" rx="4" fill="#92400e" />
    <text x="84" y="23" fill="#fde68a" font-size="10" font-weight="700" text-anchor="middle">TIER 5 · AGGREGATION</text>
    <text x="14" y="46" fill="#ffffff" font-size="16" font-weight="700">analytics_overview &amp; analytics_daily (SQL Views)</text>
    <text x="14" y="62" fill="#fef3c7" font-size="11">Live Occupancy %, Weekly Revenue (PHP), RevPAR, Stay Arrivals &amp; SMS Logs</text>
  </g>

  <!-- Footer Legend -->
  <g transform="translate(800, 1020)" text-anchor="middle" font-size="13" fill="#64748b">
    <rect x="-420" y="-20" width="840" height="40" rx="8" fill="#0f172a" stroke="#1e293b" />
    <text y="5" fill="#94a3b8">Solid Arrows = Foreign Key Hierarchies · Dashed Lines = Asset Links / Aggregations · Colors denote Tier 0 to Tier 5 Isolation</text>
  </g>
</svg>`;
}

/**
 * =========================================================================
 * 2. ENTITY-RELATIONSHIP (ER) DIAGRAM (DIAGRAM 1 - FROM USER'S SPECIFICATION)
 * =========================================================================
 */
function generateERDiagramDrawio() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="Antigravity Draw.io MCP Server" version="24.0.0" type="device">
  <diagram id="er-diagram" name="J &amp; D Beach House - Entity Relationship Diagram">
    <mxGraphModel dx="1800" dy="1200" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="2000" pageHeight="1600" background="#ffffff" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />

        <!-- 1. DEPT NAME -->
        <mxCell id="t_dept" value="DEPT NAME&#xa;(no attributes)" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;html=1;whiteSpace=wrap;fillColor=#f8fafc;strokeColor=#475569;strokeWidth=1.5;fontColor=#0f172a;" vertex="1" parent="1">
          <mxGeometry x="470" y="100" width="160" height="60" as="geometry" />
        </mxCell>

        <!-- 2. RESORT_INVENTORY -->
        <mxCell id="t_inventory" value="RESORT_INVENTORY" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;html=1;whiteSpace=wrap;fillColor=#f8fafc;strokeColor=#475569;strokeWidth=1.5;fontColor=#0f172a;" vertex="1" parent="1">
          <mxGeometry x="840" y="50" width="220" height="150" as="geometry" />
        </mxCell>
        <mxCell id="r_inv_1" value="PK  uuid    id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_inventory">
          <mxGeometry y="26" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_inv_2" value="UK  string  item_name" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_inventory">
          <mxGeometry y="50" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_inv_3" value="    string  category" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_inventory">
          <mxGeometry y="74" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_inv_4" value="    int     stock_qty" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_inventory">
          <mxGeometry y="98" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_inv_5" value="    int     reorder_at" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_inventory">
          <mxGeometry y="122" width="220" height="24" as="geometry" />
        </mxCell>

        <!-- 3. DEPARTMENT_TASKS -->
        <mxCell id="t_tasks" value="DEPARTMENT_TASKS" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;html=1;whiteSpace=wrap;fillColor=#f8fafc;strokeColor=#475569;strokeWidth=1.5;fontColor=#0f172a;" vertex="1" parent="1">
          <mxGeometry x="840" y="270" width="220" height="195" as="geometry" />
        </mxCell>
        <mxCell id="r_task_1" value="PK  uuid    id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_tasks">
          <mxGeometry y="26" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_task_2" value="    string  department" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_tasks">
          <mxGeometry y="50" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_task_3" value="    string  title" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_tasks">
          <mxGeometry y="74" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_task_4" value="FK  uuid    room_id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_tasks">
          <mxGeometry y="98" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_task_5" value="    string  priority" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_tasks">
          <mxGeometry y="122" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_task_6" value="    string  status" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_tasks">
          <mxGeometry y="146" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_task_7" value="    string  assigned_to" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_tasks">
          <mxGeometry y="170" width="220" height="24" as="geometry" />
        </mxCell>

        <!-- 4. ROOMS -->
        <mxCell id="t_rooms" value="ROOMS" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;html=1;whiteSpace=wrap;fillColor=#f8fafc;strokeColor=#475569;strokeWidth=1.5;fontColor=#0f172a;" vertex="1" parent="1">
          <mxGeometry x="440" y="440" width="220" height="195" as="geometry" />
        </mxCell>
        <mxCell id="r_rm_1" value="PK  uuid     id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_rooms">
          <mxGeometry y="26" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_rm_2" value="    string   name" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_rooms">
          <mxGeometry y="50" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_rm_3" value="    string   category" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_rooms">
          <mxGeometry y="74" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_rm_4" value="    int      capacity" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_rooms">
          <mxGeometry y="98" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_rm_5" value="    int      units" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_rooms">
          <mxGeometry y="122" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_rm_6" value="    int      rate_php" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_rooms">
          <mxGeometry y="146" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_rm_7" value="    numeric  rating_avg" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_rooms">
          <mxGeometry y="170" width="220" height="24" as="geometry" />
        </mxCell>

        <!-- 5. RESERVATIONS -->
        <mxCell id="t_res" value="RESERVATIONS" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;html=1;whiteSpace=wrap;fillColor=#f8fafc;strokeColor=#475569;strokeWidth=1.5;fontColor=#0f172a;" vertex="1" parent="1">
          <mxGeometry x="840" y="660" width="240" height="245" as="geometry" />
        </mxCell>
        <mxCell id="r_res_1" value="PK  uuid       id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_res">
          <mxGeometry y="26" width="240" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_res_2" value="FK  uuid       guest_id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_res">
          <mxGeometry y="50" width="240" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_res_3" value="FK  uuid       room_id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_res">
          <mxGeometry y="74" width="240" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_res_4" value="    date       check_in" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_res">
          <mxGeometry y="98" width="240" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_res_5" value="    date       check_out" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_res">
          <mxGeometry y="122" width="240" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_res_6" value="    int        nights" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_res">
          <mxGeometry y="146" width="240" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_res_7" value="    string     status" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_res">
          <mxGeometry y="170" width="240" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_res_8" value="    int        total_php" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_res">
          <mxGeometry y="194" width="240" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_res_9" value="    daterange  no_overbooking" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_res">
          <mxGeometry y="218" width="240" height="24" as="geometry" />
        </mxCell>

        <!-- 6. REVIEWS -->
        <mxCell id="t_reviews" value="REVIEWS" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;html=1;whiteSpace=wrap;fillColor=#f8fafc;strokeColor=#475569;strokeWidth=1.5;fontColor=#0f172a;" vertex="1" parent="1">
          <mxGeometry x="1300" y="490" width="230" height="170" as="geometry" />
        </mxCell>
        <mxCell id="r_rev_1" value="PK  uuid    id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_reviews">
          <mxGeometry y="26" width="230" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_rev_2" value="FK  uuid    reservation_id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_reviews">
          <mxGeometry y="50" width="230" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_rev_3" value="FK  uuid    room_id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_reviews">
          <mxGeometry y="74" width="230" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_rev_4" value="FK  uuid    guest_id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_reviews">
          <mxGeometry y="98" width="230" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_rev_5" value="    int     rating" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_reviews">
          <mxGeometry y="122" width="230" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_rev_6" value="    string  comment" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_reviews">
          <mxGeometry y="146" width="230" height="24" as="geometry" />
        </mxCell>

        <!-- 7. AUTH USERS -->
        <mxCell id="t_auth" value="AUTH USERS" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;html=1;whiteSpace=wrap;fillColor=#f8fafc;strokeColor=#475569;strokeWidth=1.5;fontColor=#0f172a;" vertex="1" parent="1">
          <mxGeometry x="80" y="780" width="230" height="125" as="geometry" />
        </mxCell>
        <mxCell id="r_auth_1" value="PK  uuid       id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_auth">
          <mxGeometry y="26" width="230" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_auth_2" value="    string     email" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_auth">
          <mxGeometry y="50" width="230" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_auth_3" value="    string     encrypted_password" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_auth">
          <mxGeometry y="74" width="230" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_auth_4" value="    timestamp  created_at" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_auth">
          <mxGeometry y="98" width="230" height="24" as="geometry" />
        </mxCell>

        <!-- 8. PROFILES -->
        <mxCell id="t_profiles" value="PROFILES" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;html=1;whiteSpace=wrap;fillColor=#f8fafc;strokeColor=#475569;strokeWidth=1.5;fontColor=#0f172a;" vertex="1" parent="1">
          <mxGeometry x="440" y="770" width="220" height="150" as="geometry" />
        </mxCell>
        <mxCell id="r_prof_1" value="    uuid    id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_profiles">
          <mxGeometry y="26" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_prof_2" value="    string  full_name" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_profiles">
          <mxGeometry y="50" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_prof_3" value="    string  phone" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_profiles">
          <mxGeometry y="74" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_prof_4" value="    string  role" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_profiles">
          <mxGeometry y="98" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_prof_5" value="    string  emergency_contact" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_profiles">
          <mxGeometry y="122" width="220" height="24" as="geometry" />
        </mxCell>

        <!-- 9. CHAT_MESSAGES -->
        <mxCell id="t_chat" value="CHAT_MESSAGES&#xa;(no attributes)" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;html=1;whiteSpace=wrap;fillColor=#f8fafc;strokeColor=#475569;strokeWidth=1.5;fontColor=#0f172a;" vertex="1" parent="1">
          <mxGeometry x="850" y="990" width="180" height="60" as="geometry" />
        </mxCell>

        <!-- 10. NOTIFICATIONS -->
        <mxCell id="t_notif" value="NOTIFICATIONS" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;html=1;whiteSpace=wrap;fillColor=#f8fafc;strokeColor=#475569;strokeWidth=1.5;fontColor=#0f172a;" vertex="1" parent="1">
          <mxGeometry x="1300" y="780" width="230" height="170" as="geometry" />
        </mxCell>
        <mxCell id="r_not_1" value="PK  uuid    id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_notif">
          <mxGeometry y="26" width="230" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_not_2" value="FK  uuid    profile_id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_notif">
          <mxGeometry y="50" width="230" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_not_3" value="FK  uuid    reservation_id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_notif">
          <mxGeometry y="74" width="230" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_not_4" value="    string  to_phone" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_notif">
          <mxGeometry y="98" width="230" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_not_5" value="    string  body" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_notif">
          <mxGeometry y="122" width="230" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_not_6" value="    string  status" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_notif">
          <mxGeometry y="146" width="230" height="24" as="geometry" />
        </mxCell>

        <!-- 11. RESORT ORDERS -->
        <mxCell id="t_orders" value="RESORT ORDERS" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;html=1;whiteSpace=wrap;fillColor=#f8fafc;strokeColor=#475569;strokeWidth=1.5;fontColor=#0f172a;" vertex="1" parent="1">
          <mxGeometry x="840" y="1130" width="220" height="170" as="geometry" />
        </mxCell>
        <mxCell id="r_ord_1" value="PK  uuid    id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_orders">
          <mxGeometry y="26" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_ord_2" value="FK  uuid    guest_id" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_orders">
          <mxGeometry y="50" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_ord_3" value="    string  item_name" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_orders">
          <mxGeometry y="74" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_ord_4" value="    string  category" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_orders">
          <mxGeometry y="98" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_ord_5" value="    int     price_php" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_orders">
          <mxGeometry y="122" width="220" height="24" as="geometry" />
        </mxCell>
        <mxCell id="r_ord_6" value="    string  status" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=monospace;fontSize=11;" vertex="1" parent="t_orders">
          <mxGeometry y="146" width="220" height="24" as="geometry" />
        </mxCell>

        <!-- ========================================================================= -->
        <!-- EDGES / RELATIONSHIPS -->
        <!-- ========================================================================= -->

        <!-- 1. AUTH USERS -> PROFILES : creates 1:1 -->
        <mxCell id="e_auth_prof" value="creates 1:1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=1.5;fontColor=#334155;fontSize=11;startArrow=ERmandOne;startFill=0;endArrow=ERmandOne;endFill=0;" edge="1" parent="1" source="t_auth" target="t_profiles">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- 2. DEPT NAME -> RESORT_INVENTORY : tracks stock (1:N) -->
        <mxCell id="e_dept_inv" value="tracks stock (1:N)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=1.5;fontColor=#334155;fontSize=11;startArrow=ERmandOne;startFill=0;endArrow=ERmany;endFill=0;" edge="1" parent="1" source="t_dept" target="t_inventory">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- 3. DEPT NAME -> DEPARTMENT_TASKS : categorizes (1:N) -->
        <mxCell id="e_dept_tasks" value="categorizes (1:N)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=1.5;fontColor=#334155;fontSize=11;startArrow=ERmandOne;startFill=0;endArrow=ERmany;endFill=0;" edge="1" parent="1" source="t_dept" target="t_tasks">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="550" y="240" />
              <mxPoint x="750" y="240" />
              <mxPoint x="750" y="320" />
            </Array>
          </mxGeometry>
        </mxCell>

        <!-- 4. ROOMS -> DEPARTMENT_TASKS : targeted at (0..1:N) -->
        <mxCell id="e_rooms_tasks" value="targeted at (0..1:N)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=1.5;fontColor=#334155;fontSize=11;startArrow=ERmandOne;startFill=0;endArrow=ERmany;endFill=0;" edge="1" parent="1" source="t_rooms" target="t_tasks">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="680" y="470" />
              <mxPoint x="750" y="470" />
              <mxPoint x="750" y="380" />
            </Array>
          </mxGeometry>
        </mxCell>

        <!-- 5. PROFILES -> DEPARTMENT_TASKS : created by (1:N) -->
        <mxCell id="e_prof_tasks" value="created by (1:N)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=1.5;fontColor=#334155;fontSize=11;startArrow=ERmandOne;startFill=0;endArrow=ERmany;endFill=0;" edge="1" parent="1" source="t_profiles" target="t_tasks">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="660" y="790" />
              <mxPoint x="720" y="790" />
              <mxPoint x="720" y="420" />
            </Array>
          </mxGeometry>
        </mxCell>

        <!-- 6. ROOMS -> REVIEWS : rated under (1:N) -->
        <mxCell id="e_rooms_reviews" value="rated under (1:N)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=1.5;fontColor=#334155;fontSize=11;startArrow=ERmandOne;startFill=0;endArrow=ERmany;endFill=0;" edge="1" parent="1" source="t_rooms" target="t_reviews">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="660" y="530" />
              <mxPoint x="1200" y="530" />
            </Array>
          </mxGeometry>
        </mxCell>

        <!-- 7. PROFILES -> REVIEWS : written by (1:N) -->
        <mxCell id="e_prof_reviews" value="written by (1:N)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=1.5;fontColor=#334155;fontSize=11;startArrow=ERmandOne;startFill=0;endArrow=ERmany;endFill=0;" edge="1" parent="1" source="t_profiles" target="t_reviews">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="660" y="810" />
              <mxPoint x="760" y="810" />
              <mxPoint x="760" y="600" />
              <mxPoint x="1250" y="600" />
            </Array>
          </mxGeometry>
        </mxCell>

        <!-- 8. ROOMS -> RESERVATIONS : allocated to (1:N) -->
        <mxCell id="e_rooms_res" value="allocated to (1:N)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=1.5;fontColor=#334155;fontSize=11;startArrow=ERmandOne;startFill=0;endArrow=ERmany;endFill=0;" edge="1" parent="1" source="t_rooms" target="t_res">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="660" y="610" />
              <mxPoint x="780" y="610" />
              <mxPoint x="780" y="700" />
            </Array>
          </mxGeometry>
        </mxCell>

        <!-- 9. PROFILES -> RESERVATIONS : books (1:N) -->
        <mxCell id="e_prof_res" value="books (1:N)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=1.5;fontColor=#334155;fontSize=11;startArrow=ERmandOne;startFill=0;endArrow=ERmany;endFill=0;" edge="1" parent="1" source="t_profiles" target="t_res">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="660" y="840" />
              <mxPoint x="750" y="840" />
              <mxPoint x="750" y="760" />
            </Array>
          </mxGeometry>
        </mxCell>

        <!-- 10. RESERVATIONS -> REVIEWS : evaluated by (1:1) -->
        <mxCell id="e_res_reviews" value="evaluated by (1:1)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=1.5;fontColor=#334155;fontSize=11;startArrow=ERmandOne;startFill=0;endArrow=ERmandOne;endFill=0;" edge="1" parent="1" source="t_res" target="t_reviews">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="1080" y="710" />
              <mxPoint x="1220" y="710" />
              <mxPoint x="1220" y="640" />
            </Array>
          </mxGeometry>
        </mxCell>

        <!-- 11. RESERVATIONS -> NOTIFICATIONS : triggers (1:N) -->
        <mxCell id="e_res_notif" value="triggers (1:N)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=1.5;fontColor=#334155;fontSize=11;startArrow=ERmandOne;startFill=0;endArrow=ERmany;endFill=0;" edge="1" parent="1" source="t_res" target="t_notif">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="1080" y="810" />
              <mxPoint x="1200" y="810" />
              <mxPoint x="1200" y="830" />
            </Array>
          </mxGeometry>
        </mxCell>

        <!-- 12. PROFILES -> CHAT_MESSAGES : authors (1:N) -->
        <mxCell id="e_prof_chat" value="authors (1:N)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=1.5;fontColor=#334155;fontSize=11;startArrow=ERmandOne;startFill=0;endArrow=ERmany;endFill=0;" edge="1" parent="1" source="t_profiles" target="t_chat">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="660" y="890" />
              <mxPoint x="740" y="890" />
              <mxPoint x="740" y="1020" />
            </Array>
          </mxGeometry>
        </mxCell>

        <!-- 13. PROFILES -> RESORT ORDERS : places (1:N) -->
        <mxCell id="e_prof_orders" value="places (1:N)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=1.5;fontColor=#334155;fontSize=11;startArrow=ERmandOne;startFill=0;endArrow=ERmany;endFill=0;" edge="1" parent="1" source="t_profiles" target="t_orders">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="550" y="920" />
              <mxPoint x="550" y="1210" />
            </Array>
          </mxGeometry>
        </mxCell>

        <!-- 14. PROFILES -> NOTIFICATIONS : recipient (1:N) -->
        <mxCell id="e_prof_notif" value="recipient (1:N)" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=1.5;fontColor=#334155;fontSize=11;startArrow=ERmandOne;startFill=0;endArrow=ERmany;endFill=0;" edge="1" parent="1" source="t_profiles" target="t_notif">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="500" y="920" />
              <mxPoint x="500" y="1390" />
              <mxPoint x="1415" y="1390" />
            </Array>
          </mxGeometry>
        </mxCell>

      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

function generateERDiagramSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1750 1520" width="1750" height="1520" style="background:#ffffff; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <defs>
    <!-- Card Shadow -->
    <filter id="tableShadow" x="-5%" y="-5%" width="110%" height="112%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.08" />
    </filter>

    <!-- Crow's Foot & Cardinality Markers -->
    <!-- 1:1 (Two parallel vertical bars) -->
    <marker id="one-one-start" markerWidth="14" markerHeight="16" refX="2" refY="8" orient="auto">
      <line x1="3" y1="1" x2="3" y2="15" stroke="#475569" stroke-width="1.8" />
      <line x1="9" y1="1" x2="9" y2="15" stroke="#475569" stroke-width="1.8" />
    </marker>
    <marker id="one-one-end" markerWidth="14" markerHeight="16" refX="12" refY="8" orient="auto">
      <line x1="5" y1="1" x2="5" y2="15" stroke="#475569" stroke-width="1.8" />
      <line x1="11" y1="1" x2="11" y2="15" stroke="#475569" stroke-width="1.8" />
    </marker>

    <!-- 1:N Crow's foot with bar (Mandatory One to Many) -->
    <marker id="crow-many-end" markerWidth="18" markerHeight="16" refX="16" refY="8" orient="auto">
      <!-- circle for zero/many or bar for one/many -->
      <circle cx="5" cy="8" r="3.5" fill="#ffffff" stroke="#475569" stroke-width="1.5" />
      <path d="M 16, 2 L 6, 8 L 16, 14" fill="none" stroke="#475569" stroke-width="1.8" />
    </marker>

    <!-- Crow's foot start (for bidirectional) -->
    <marker id="crow-many-start" markerWidth="18" markerHeight="16" refX="2" refY="8" orient="auto">
      <circle cx="13" cy="8" r="3.5" fill="#ffffff" stroke="#475569" stroke-width="1.5" />
      <path d="M 2, 2 L 12, 8 L 2, 14" fill="none" stroke="#475569" stroke-width="1.8" />
    </marker>
  </defs>

  <style>
    .tbl-header-bg { fill: #f8fafc; stroke: #334155; stroke-width: 1.6; }
    .tbl-body-bg { fill: #ffffff; stroke: #334155; stroke-width: 1.6; }
    .tbl-header-txt { font-size: 13px; font-weight: 800; fill: #0f172a; text-anchor: middle; letter-spacing: 0.5px; }
    .tbl-sub-txt { font-size: 11px; font-style: italic; fill: #94a3b8; text-anchor: middle; }
    .key-pk { font-size: 10px; font-weight: 800; fill: #b91c1c; font-family: monospace; }
    .key-fk { font-size: 10px; font-weight: 700; fill: #0284c7; font-family: monospace; }
    .key-uk { font-size: 10px; font-weight: 700; fill: #d97706; font-family: monospace; }
    .type-txt { font-size: 11px; font-weight: 500; fill: #64748b; font-family: monospace; }
    .col-txt { font-size: 11px; font-weight: 600; fill: #1e293b; font-family: monospace; }
    .row-line { stroke: #f1f5f9; stroke-width: 1; }
    
    .rel-line { stroke: #64748b; stroke-width: 1.6; fill: none; }
    .lbl-box { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1; rx: 4px; }
    .lbl-txt { font-size: 10px; font-weight: 700; fill: #475569; text-anchor: middle; }
  </style>

  <!-- Title Watermark -->
  <g transform="translate(875, 28)" text-anchor="middle">
    <text y="0" font-size="22" font-weight="900" fill="#0f172a">J &amp; D Beach House · Entity Relationship Data Model</text>
    <text y="20" font-size="12" font-weight="500" fill="#64748b">Normalized Schema Topology · Exact Foreign Key Constraints &amp; Cardinality</text>
  </g>

  <!-- ========================================================================= -->
  <!-- RELATIONSHIP PATHS & LABELS -->
  <!-- ========================================================================= -->

  <!-- 1. AUTH USERS -> PROFILES : creates 1:1 -->
  <path d="M 270, 835 L 440, 835" class="rel-line" marker-start="url(#one-one-start)" marker-end="url(#one-one-end)" />
  <g transform="translate(355, 835)">
    <rect x="-42" y="-10" width="84" height="20" class="lbl-box" />
    <text y="4" class="lbl-txt">creates 1:1</text>
  </g>

  <!-- 2. DEPT NAME -> RESORT_INVENTORY : tracks stock (1:N) -->
  <path d="M 640, 105 L 860, 105" class="rel-line" marker-start="url(#one-one-start)" marker-end="url(#crow-many-end)" />
  <g transform="translate(750, 105)">
    <rect x="-60" y="-10" width="120" height="20" class="lbl-box" />
    <text y="4" class="lbl-txt">tracks stock (1:N)</text>
  </g>

  <!-- 3. DEPT NAME -> DEPARTMENT_TASKS : categorizes (1:N) -->
  <path d="M 555, 135 L 555, 210 L 780, 210 L 780, 290 L 860, 290" class="rel-line" marker-start="url(#one-one-start)" marker-end="url(#crow-many-end)" />
  <g transform="translate(680, 210)">
    <rect x="-55" y="-10" width="110" height="20" class="lbl-box" />
    <text y="4" class="lbl-txt">categorizes (1:N)</text>
  </g>

  <!-- 4. ROOMS -> DEPARTMENT_TASKS : targeted at (0..1:N) -->
  <path d="M 660, 470 L 750, 470 L 750, 355 L 860, 355" class="rel-line" marker-start="url(#one-one-start)" marker-end="url(#crow-many-end)" />
  <g transform="translate(710, 470)">
    <rect x="-65" y="-10" width="130" height="20" class="lbl-box" />
    <text y="4" class="lbl-txt">targeted at (0..1:N)</text>
  </g>

  <!-- 5. PROFILES -> DEPARTMENT_TASKS : created by (1:N) -->
  <path d="M 550, 770 L 550, 720 L 710, 720 L 710, 415 L 860, 415" class="rel-line" marker-start="url(#one-one-start)" marker-end="url(#crow-many-end)" />
  <g transform="translate(780, 415)">
    <rect x="-55" y="-10" width="110" height="20" class="lbl-box" />
    <text y="4" class="lbl-txt">created by (1:N)</text>
  </g>

  <!-- 6. ROOMS -> REVIEWS : rated under (1:N) -->
  <path d="M 660, 520 L 1320, 520" class="rel-line" marker-start="url(#one-one-start)" marker-end="url(#crow-many-end)" />
  <g transform="translate(1210, 520)">
    <rect x="-55" y="-10" width="110" height="20" class="lbl-box" />
    <text y="4" class="lbl-txt">rated under (1:N)</text>
  </g>

  <!-- 7. PROFILES -> REVIEWS : written by (1:N) -->
  <path d="M 660, 790 L 680, 790 L 680, 565 L 1320, 565" class="rel-line" marker-start="url(#one-one-start)" marker-end="url(#crow-many-end)" />
  <g transform="translate(1210, 565)">
    <rect x="-55" y="-10" width="110" height="20" class="lbl-box" />
    <text y="4" class="lbl-txt">written by (1:N)</text>
  </g>

  <!-- 8. ROOMS -> RESERVATIONS : allocated to (1:N) -->
  <path d="M 660, 610 L 770, 610 L 770, 690 L 860, 690" class="rel-line" marker-start="url(#one-one-start)" marker-end="url(#crow-many-end)" />
  <g transform="translate(740, 650)">
    <rect x="-55" y="-10" width="110" height="20" class="lbl-box" />
    <text y="4" class="lbl-txt">allocated to (1:N)</text>
  </g>

  <!-- 9. PROFILES -> RESERVATIONS : books (1:N) -->
  <path d="M 660, 830 L 780, 830 L 780, 765 L 860, 765" class="rel-line" marker-start="url(#one-one-start)" marker-end="url(#crow-many-end)" />
  <g transform="translate(775, 830)">
    <rect x="-42" y="-10" width="84" height="20" class="lbl-box" />
    <text y="4" class="lbl-txt">books (1:N)</text>
  </g>

  <!-- 10. RESERVATIONS -> REVIEWS : evaluated by (1:1) -->
  <path d="M 1110, 705 L 1230, 705 L 1230, 610 L 1320, 610" class="rel-line" marker-start="url(#one-one-start)" marker-end="url(#one-one-end)" />
  <g transform="translate(1230, 660)">
    <rect x="-55" y="-10" width="110" height="20" class="lbl-box" />
    <text y="4" class="lbl-txt">evaluated by (1:1)</text>
  </g>

  <!-- 11. RESERVATIONS -> NOTIFICATIONS : triggers (1:N) -->
  <path d="M 1110, 810 L 1320, 810" class="rel-line" marker-start="url(#one-one-start)" marker-end="url(#crow-many-end)" />
  <g transform="translate(1215, 810)">
    <rect x="-48" y="-10" width="96" height="20" class="lbl-box" />
    <text y="4" class="lbl-txt">triggers (1:N)</text>
  </g>

  <!-- 12. PROFILES -> CHAT_MESSAGES : authors (1:N) -->
  <path d="M 660, 870 L 760, 870 L 760, 1020 L 860, 1020" class="rel-line" marker-start="url(#one-one-start)" marker-end="url(#crow-many-end)" />
  <g transform="translate(760, 945)">
    <rect x="-45" y="-10" width="90" height="20" class="lbl-box" />
    <text y="4" class="lbl-txt">authors (1:N)</text>
  </g>

  <!-- 13. PROFILES -> RESORT ORDERS : places (1:N) -->
  <path d="M 660, 905 L 730, 905 L 730, 1175 L 860, 1175" class="rel-line" marker-start="url(#one-one-start)" marker-end="url(#crow-many-end)" />
  <g transform="translate(730, 1100)">
    <rect x="-42" y="-10" width="84" height="20" class="lbl-box" />
    <text y="4" class="lbl-txt">places (1:N)</text>
  </g>

  <!-- 14. PROFILES -> NOTIFICATIONS : recipient (1:N) -->
  <path d="M 520, 895 L 520, 1420 L 1440, 1420 L 1440, 930" class="rel-line" marker-start="url(#one-one-start)" marker-end="url(#crow-many-end)" />
  <g transform="translate(980, 1420)">
    <rect x="-50" y="-10" width="100" height="20" class="lbl-box" />
    <text y="4" class="lbl-txt">recipient (1:N)</text>
  </g>


  <!-- ========================================================================= -->
  <!-- TABLE CARDS -->
  <!-- ========================================================================= -->

  <!-- 1. DEPT NAME -->
  <g transform="translate(470, 75)" filter="url(#tableShadow)">
    <rect width="170" height="30" class="tbl-header-bg" rx="4" />
    <rect y="30" width="170" height="30" class="tbl-body-bg" rx="4" />
    <text x="85" y="20" class="tbl-header-txt">DEPT NAME</text>
    <text x="85" y="50" class="tbl-sub-txt">(no attributes)</text>
  </g>

  <!-- 2. RESORT_INVENTORY -->
  <g transform="translate(860, 50)" filter="url(#tableShadow)">
    <rect width="240" height="30" class="tbl-header-bg" rx="4" />
    <rect y="30" width="240" height="125" class="tbl-body-bg" rx="4" />
    <text x="120" y="20" class="tbl-header-txt">RESORT_INVENTORY</text>
    <!-- rows -->
    <text x="12" y="52" class="key-pk">PK</text><text x="40" y="52" class="type-txt">uuid</text><text x="105" y="52" class="col-txt">id</text><line x1="0" y1="58" x2="240" y2="58" class="row-line" />
    <text x="12" y="76" class="key-uk">UK</text><text x="40" y="76" class="type-txt">string</text><text x="105" y="76" class="col-txt">item_name</text><line x1="0" y1="82" x2="240" y2="82" class="row-line" />
    <text x="40" y="100" class="type-txt">string</text><text x="105" y="100" class="col-txt">category</text><line x1="0" y1="106" x2="240" y2="106" class="row-line" />
    <text x="40" y="124" class="type-txt">int</text><text x="105" y="124" class="col-txt">stock_qty</text><line x1="0" y1="130" x2="240" y2="130" class="row-line" />
    <text x="40" y="148" class="type-txt">int</text><text x="105" y="148" class="col-txt">reorder_at</text>
  </g>

  <!-- 3. DEPARTMENT_TASKS -->
  <g transform="translate(860, 240)" filter="url(#tableShadow)">
    <rect width="240" height="30" class="tbl-header-bg" rx="4" />
    <rect y="30" width="240" height="175" class="tbl-body-bg" rx="4" />
    <text x="120" y="20" class="tbl-header-txt">DEPARTMENT_TASKS</text>
    <!-- rows -->
    <text x="12" y="52" class="key-pk">PK</text><text x="40" y="52" class="type-txt">uuid</text><text x="105" y="52" class="col-txt">id</text><line x1="0" y1="58" x2="240" y2="58" class="row-line" />
    <text x="40" y="76" class="type-txt">string</text><text x="105" y="76" class="col-txt">department</text><line x1="0" y1="82" x2="240" y2="82" class="row-line" />
    <text x="40" y="100" class="type-txt">string</text><text x="105" y="100" class="col-txt">title</text><line x1="0" y1="106" x2="240" y2="106" class="row-line" />
    <text x="12" y="124" class="key-fk">FK</text><text x="40" y="124" class="type-txt">uuid</text><text x="105" y="124" class="col-txt">room_id</text><line x1="0" y1="130" x2="240" y2="130" class="row-line" />
    <text x="40" y="148" class="type-txt">string</text><text x="105" y="148" class="col-txt">priority</text><line x1="0" y1="154" x2="240" y2="154" class="row-line" />
    <text x="40" y="172" class="type-txt">string</text><text x="105" y="172" class="col-txt">status</text><line x1="0" y1="178" x2="240" y2="178" class="row-line" />
    <text x="40" y="196" class="type-txt">string</text><text x="105" y="196" class="col-txt">assigned_to</text>
  </g>

  <!-- 4. ROOMS -->
  <g transform="translate(440, 440)" filter="url(#tableShadow)">
    <rect width="220" height="30" class="tbl-header-bg" rx="4" />
    <rect y="30" width="220" height="175" class="tbl-body-bg" rx="4" />
    <text x="110" y="20" class="tbl-header-txt">ROOMS</text>
    <!-- rows -->
    <text x="12" y="52" class="key-pk">PK</text><text x="40" y="52" class="type-txt">uuid</text><text x="105" y="52" class="col-txt">id</text><line x1="0" y1="58" x2="220" y2="58" class="row-line" />
    <text x="40" y="76" class="type-txt">string</text><text x="105" y="76" class="col-txt">name</text><line x1="0" y1="82" x2="220" y2="82" class="row-line" />
    <text x="40" y="100" class="type-txt">string</text><text x="105" y="100" class="col-txt">category</text><line x1="0" y1="106" x2="220" y2="106" class="row-line" />
    <text x="40" y="124" class="type-txt">int</text><text x="105" y="124" class="col-txt">capacity</text><line x1="0" y1="130" x2="220" y2="130" class="row-line" />
    <text x="40" y="148" class="type-txt">int</text><text x="105" y="148" class="col-txt">units</text><line x1="0" y1="154" x2="220" y2="154" class="row-line" />
    <text x="40" y="172" class="type-txt">int</text><text x="105" y="172" class="col-txt">rate_php</text><line x1="0" y1="178" x2="220" y2="178" class="row-line" />
    <text x="40" y="196" class="type-txt">numeric</text><text x="105" y="196" class="col-txt">rating_avg</text>
  </g>

  <!-- 5. RESERVATIONS -->
  <g transform="translate(860, 640)" filter="url(#tableShadow)">
    <rect width="250" height="30" class="tbl-header-bg" rx="4" />
    <rect y="30" width="250" height="225" class="tbl-body-bg" rx="4" />
    <text x="125" y="20" class="tbl-header-txt">RESERVATIONS</text>
    <!-- rows -->
    <text x="12" y="52" class="key-pk">PK</text><text x="40" y="52" class="type-txt">uuid</text><text x="110" y="52" class="col-txt">id</text><line x1="0" y1="58" x2="250" y2="58" class="row-line" />
    <text x="12" y="76" class="key-fk">FK</text><text x="40" y="76" class="type-txt">uuid</text><text x="110" y="76" class="col-txt">guest_id</text><line x1="0" y1="82" x2="250" y2="82" class="row-line" />
    <text x="12" y="100" class="key-fk">FK</text><text x="40" y="100" class="type-txt">uuid</text><text x="110" y="100" class="col-txt">room_id</text><line x1="0" y1="106" x2="250" y2="106" class="row-line" />
    <text x="40" y="124" class="type-txt">date</text><text x="110" y="124" class="col-txt">check_in</text><line x1="0" y1="130" x2="250" y2="130" class="row-line" />
    <text x="40" y="148" class="type-txt">date</text><text x="110" y="148" class="col-txt">check_out</text><line x1="0" y1="154" x2="250" y2="154" class="row-line" />
    <text x="40" y="172" class="type-txt">int</text><text x="110" y="172" class="col-txt">nights</text><line x1="0" y1="178" x2="250" y2="178" class="row-line" />
    <text x="40" y="196" class="type-txt">string</text><text x="110" y="196" class="col-txt">status</text><line x1="0" y1="202" x2="250" y2="202" class="row-line" />
    <text x="40" y="220" class="type-txt">int</text><text x="110" y="220" class="col-txt">total_php</text><line x1="0" y1="226" x2="250" y2="226" class="row-line" />
    <text x="40" y="244" class="type-txt">daterange</text><text x="110" y="244" class="col-txt">no_overbooking</text>
  </g>

  <!-- 6. REVIEWS -->
  <g transform="translate(1320, 470)" filter="url(#tableShadow)">
    <rect width="240" height="30" class="tbl-header-bg" rx="4" />
    <rect y="30" width="240" height="150" class="tbl-body-bg" rx="4" />
    <text x="120" y="20" class="tbl-header-txt">REVIEWS</text>
    <!-- rows -->
    <text x="12" y="52" class="key-pk">PK</text><text x="40" y="52" class="type-txt">uuid</text><text x="110" y="52" class="col-txt">id</text><line x1="0" y1="58" x2="240" y2="58" class="row-line" />
    <text x="12" y="76" class="key-fk">FK</text><text x="40" y="76" class="type-txt">uuid</text><text x="110" y="76" class="col-txt">reservation_id</text><line x1="0" y1="82" x2="240" y2="82" class="row-line" />
    <text x="12" y="100" class="key-fk">FK</text><text x="40" y="100" class="type-txt">uuid</text><text x="110" y="100" class="col-txt">room_id</text><line x1="0" y1="106" x2="240" y2="106" class="row-line" />
    <text x="12" y="124" class="key-fk">FK</text><text x="40" y="124" class="type-txt">uuid</text><text x="110" y="124" class="col-txt">guest_id</text><line x1="0" y1="130" x2="240" y2="130" class="row-line" />
    <text x="40" y="148" class="type-txt">int</text><text x="110" y="148" class="col-txt">rating</text><line x1="0" y1="154" x2="240" y2="154" class="row-line" />
    <text x="40" y="172" class="type-txt">string</text><text x="110" y="172" class="col-txt">comment</text>
  </g>

  <!-- 7. AUTH USERS -->
  <g transform="translate(60, 770)" filter="url(#tableShadow)">
    <rect width="210" height="30" class="tbl-header-bg" rx="4" />
    <rect y="30" width="210" height="100" class="tbl-body-bg" rx="4" />
    <text x="105" y="20" class="tbl-header-txt">AUTH USERS</text>
    <!-- rows -->
    <text x="12" y="52" class="key-pk">PK</text><text x="35" y="52" class="type-txt">uuid</text><text x="95" y="52" class="col-txt">id</text><line x1="0" y1="58" x2="210" y2="58" class="row-line" />
    <text x="35" y="76" class="type-txt">string</text><text x="95" y="76" class="col-txt">email</text><line x1="0" y1="82" x2="210" y2="82" class="row-line" />
    <text x="35" y="100" class="type-txt">string</text><text x="95" y="100" class="col-txt">encrypted_password</text><line x1="0" y1="106" x2="210" y2="106" class="row-line" />
    <text x="35" y="124" class="type-txt">timestamp</text><text x="95" y="124" class="col-txt">created_at</text>
  </g>

  <!-- 8. PROFILES -->
  <g transform="translate(440, 770)" filter="url(#tableShadow)">
    <rect width="220" height="30" class="tbl-header-bg" rx="4" />
    <rect y="30" width="220" height="125" class="tbl-body-bg" rx="4" />
    <text x="110" y="20" class="tbl-header-txt">PROFILES</text>
    <!-- rows -->
    <text x="35" y="52" class="type-txt">uuid</text><text x="95" y="52" class="col-txt">id</text><line x1="0" y1="58" x2="220" y2="58" class="row-line" />
    <text x="35" y="76" class="type-txt">string</text><text x="95" y="76" class="col-txt">full_name</text><line x1="0" y1="82" x2="220" y2="82" class="row-line" />
    <text x="35" y="100" class="type-txt">string</text><text x="95" y="100" class="col-txt">phone</text><line x1="0" y1="106" x2="220" y2="106" class="row-line" />
    <text x="35" y="124" class="type-txt">string</text><text x="95" y="124" class="col-txt">role</text><line x1="0" y1="130" x2="220" y2="130" class="row-line" />
    <text x="35" y="148" class="type-txt">string</text><text x="95" y="148" class="col-txt">emergency_contact</text>
  </g>

  <!-- 9. CHAT_MESSAGES -->
  <g transform="translate(860, 990)" filter="url(#tableShadow)">
    <rect width="180" height="30" class="tbl-header-bg" rx="4" />
    <rect y="30" width="180" height="30" class="tbl-body-bg" rx="4" />
    <text x="90" y="20" class="tbl-header-txt">CHAT MESSAGES</text>
    <text x="90" y="50" class="tbl-sub-txt">(no attributes)</text>
  </g>

  <!-- 10. NOTIFICATIONS -->
  <g transform="translate(1320, 750)" filter="url(#tableShadow)">
    <rect width="240" height="30" class="tbl-header-bg" rx="4" />
    <rect y="30" width="240" height="150" class="tbl-body-bg" rx="4" />
    <text x="120" y="20" class="tbl-header-txt">NOTIFICATIONS</text>
    <!-- rows -->
    <text x="12" y="52" class="key-pk">PK</text><text x="40" y="52" class="type-txt">uuid</text><text x="110" y="52" class="col-txt">id</text><line x1="0" y1="58" x2="240" y2="58" class="row-line" />
    <text x="12" y="76" class="key-fk">FK</text><text x="40" y="76" class="type-txt">uuid</text><text x="110" y="76" class="col-txt">profile_id</text><line x1="0" y1="82" x2="240" y2="82" class="row-line" />
    <text x="12" y="100" class="key-fk">FK</text><text x="40" y="100" class="type-txt">uuid</text><text x="110" y="100" class="col-txt">reservation_id</text><line x1="0" y1="106" x2="240" y2="106" class="row-line" />
    <text x="40" y="124" class="type-txt">string</text><text x="110" y="124" class="col-txt">to_phone</text><line x1="0" y1="130" x2="240" y2="130" class="row-line" />
    <text x="40" y="148" class="type-txt">string</text><text x="110" y="148" class="col-txt">body</text><line x1="0" y1="154" x2="240" y2="154" class="row-line" />
    <text x="40" y="172" class="type-txt">string</text><text x="110" y="172" class="col-txt">status</text>
  </g>

  <!-- 11. RESORT ORDERS -->
  <g transform="translate(860, 1100)" filter="url(#tableShadow)">
    <rect width="230" height="30" class="tbl-header-bg" rx="4" />
    <rect y="30" width="230" height="150" class="tbl-body-bg" rx="4" />
    <text x="115" y="20" class="tbl-header-txt">RESORT ORDERS</text>
    <!-- rows -->
    <text x="12" y="52" class="key-pk">PK</text><text x="40" y="52" class="type-txt">uuid</text><text x="105" y="52" class="col-txt">id</text><line x1="0" y1="58" x2="230" y2="58" class="row-line" />
    <text x="12" y="76" class="key-fk">FK</text><text x="40" y="76" class="type-txt">uuid</text><text x="105" y="76" class="col-txt">guest_id</text><line x1="0" y1="82" x2="230" y2="82" class="row-line" />
    <text x="40" y="100" class="type-txt">string</text><text x="105" y="100" class="col-txt">item_name</text><line x1="0" y1="106" x2="230" y2="106" class="row-line" />
    <text x="40" y="124" class="type-txt">string</text><text x="105" y="124" class="col-txt">category</text><line x1="0" y1="130" x2="230" y2="130" class="row-line" />
    <text x="40" y="148" class="type-txt">int</text><text x="105" y="148" class="col-txt">price_php</text><line x1="0" y1="154" x2="230" y2="154" class="row-line" />
    <text x="40" y="172" class="type-txt">string</text><text x="105" y="172" class="col-txt">status</text>
  </g>

</svg>`;
}

/**
 * Render an SVG or HTML file to high-resolution PNG using headless Microsoft Edge
 */
function renderToPng(inputFilePath, outputPngPath, width = 1750, height = 1520, scale = 2) {
  const fileUrl = 'file:///' + inputFilePath.replace(/\\/g, '/');
  const args = [
    '--headless=new',
    '--disable-gpu',
    `--force-device-scale-factor=${scale}`,
    `--window-size=${width},${height}`,
    `--screenshot=${outputPngPath}`,
    fileUrl
  ];
  console.log(`[Renderer] Converting ${path.basename(inputFilePath)} -> ${path.basename(outputPngPath)} (${width}x${height} @ ${scale}x scale)...`);
  execFileSync(EDGE_PATH, args, { stdio: 'inherit' });
  const stats = fs.statSync(outputPngPath);
  console.log(`[Renderer] Successfully created ${outputPngPath} (${(stats.size / 1024).toFixed(1)} KB)`);
  return outputPngPath;
}

/**
 * Build all project diagrams across docs folders
 */
function buildAll() {
  const rootDir = path.resolve(__dirname, '..');
  const dataHierarchyDir = path.join(rootDir, 'docs', 'data-hierarchy');
  const archDir = path.join(rootDir, 'docs', 'architecture');

  fs.mkdirSync(dataHierarchyDir, { recursive: true });
  fs.mkdirSync(archDir, { recursive: true });

  console.log('============================================================');
  console.log(' 📊 GENERATING NORMALIZED DIAGRAM SUITES');
  console.log('============================================================');

  // -------------------------------------------------------------
  // 1. DATA HIERARCHY TIER FLOWCHART (DIAGRAM 2)
  // -------------------------------------------------------------
  console.log('\n[1/2] Building Data Hierarchy Tier Flowchart...');
  const dhDrawioXml = generateDataHierarchyDrawio();
  const dhDrawioPath = path.join(dataHierarchyDir, 'data_hierarchy_diagram.drawio');
  const dhXmlPath = path.join(dataHierarchyDir, 'data_hierarchy_diagram.xml');
  fs.writeFileSync(dhDrawioPath, dhDrawioXml, 'utf8');
  fs.writeFileSync(dhXmlPath, dhDrawioXml, 'utf8');

  const dhSvgContent = generateDataHierarchySvg();
  const dhSvgPath = path.join(dataHierarchyDir, 'data_hierarchy_diagram.svg');
  fs.writeFileSync(dhSvgPath, dhSvgContent, 'utf8');

  const dhPngPath = path.join(dataHierarchyDir, 'data_hierarchy_diagram.png');
  renderToPng(dhSvgPath, dhPngPath, 1600, 1100, 2);

  // -------------------------------------------------------------
  // 2. ENTITY-RELATIONSHIP (ER) DIAGRAM (DIAGRAM 1 - FROM SPEC)
  // -------------------------------------------------------------
  console.log('\n[2/2] Building Entity-Relationship (ER) Diagram...');
  const erDrawioXml = generateERDiagramDrawio();
  const erDrawioPath = path.join(dataHierarchyDir, 'entity_relationship_diagram.drawio');
  const erXmlPath = path.join(dataHierarchyDir, 'entity_relationship_diagram.xml');
  fs.writeFileSync(erDrawioPath, erDrawioXml, 'utf8');
  fs.writeFileSync(erXmlPath, erDrawioXml, 'utf8');

  const erSvgContent = generateERDiagramSvg();
  const erSvgPath = path.join(dataHierarchyDir, 'entity_relationship_diagram.svg');
  fs.writeFileSync(erSvgPath, erSvgContent, 'utf8');

  const erPngPath = path.join(dataHierarchyDir, 'entity_relationship_diagram.png');
  renderToPng(erSvgPath, erPngPath, 1750, 1520, 2);

  // Also copy ER diagram to docs/architecture for unified reference
  fs.copyFileSync(erDrawioPath, path.join(archDir, 'entity_relationship_diagram.drawio'));
  fs.copyFileSync(erSvgPath, path.join(archDir, 'entity_relationship_diagram.svg'));
  fs.copyFileSync(erPngPath, path.join(archDir, 'entity_relationship_diagram.png'));

  console.log('\n============================================================');
  console.log(' 🏆 ALL DIAGRAMS BUILT AND NORMALIZED SUCCESSFULLY! 🟢');
  console.log('============================================================');
}

if (require.main === module) {
  buildAll();
}

module.exports = {
  generateDataHierarchyDrawio,
  generateDataHierarchySvg,
  generateERDiagramDrawio,
  generateERDiagramSvg,
  renderToPng,
  buildAll
};
