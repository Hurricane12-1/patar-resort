import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const outDir = path.resolve(rootDir, 'mid-fidelity-prototype/figma-svg-frames');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('Generating Updated Figma Mid-Fidelity Vector Prototypes (TEV, CAT, GEL, CATH)...');

// Helper for SVG generation
function wrapSvg(width, height, content, title = 'J & D Reserve Mid-Fi Frame') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <title>${title}</title>
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;family=Playfair+Display:ital,wght@0,600;0,700;1,600&amp;family=JetBrains+Mono:wght@500;700&amp;display=swap');
      .font-sans { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .font-serif { font-family: 'Playfair Display', Georgia, serif; }
      .font-mono { font-family: 'JetBrains Mono', Consolas, monospace; }
    </style>
    <linearGradient id="grad-sky" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284C7" />
      <stop offset="100%" stop-color="#0EA5E9" />
    </linearGradient>
    <linearGradient id="grad-dark" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="grad-card" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
    <filter id="shadow-soft" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.3" />
    </filter>
    <filter id="shadow-modal" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="32" flood-color="#000000" flood-opacity="0.6" />
    </filter>
  </defs>
  ${content}
</svg>`;
}

// -------------------------------------------------------------
// 1. UI KIT & DESIGN SYSTEM (00_figma_ui_kit_and_components.svg)
// -------------------------------------------------------------
const uiKitContent = `
  <rect width="1440" height="1080" fill="#090D16" />
  
  <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E293B" stroke-width="0.75" />
  </pattern>
  <rect width="1440" height="1080" fill="url(#grid-pattern)" opacity="0.6" />

  <!-- Frame Header -->
  <g transform="translate(80, 60)">
    <rect x="0" y="0" width="1280" height="90" rx="16" fill="#0F172A" stroke="#1E293B" stroke-width="1.5" />
    <text x="32" y="42" fill="#38BDF8" class="font-sans" font-size="12" font-weight="700" letter-spacing="2">FIGMA DESIGN SYSTEM · J &amp; D BEACH HOUSE SPECIFICATION</text>
    <text x="32" y="68" fill="#F8FAFC" class="font-sans" font-size="24" font-weight="800">UI Kit, Color Tokens &amp; Canonical Room Roster (TEV, CAT, GEL, CATH)</text>
    <rect x="1100" y="28" width="148" height="34" rx="8" fill="#0284C7" />
    <text x="1174" y="50" fill="#FFFFFF" class="font-sans" font-size="12" font-weight="700" text-anchor="middle">v2.0 Production</text>
  </g>

  <!-- Color Palette Swatches -->
  <g transform="translate(80, 180)">
    <text x="0" y="24" fill="#F8FAFC" class="font-sans" font-size="16" font-weight="700">01 · Resort Color Palette &amp; Surface Tokens</text>
    
    <g transform="translate(0, 44)">
      <rect width="140" height="90" rx="12" fill="#0EA5E9" />
      <text x="12" y="112" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="600">Sky Primary</text>
      <text x="12" y="128" fill="#94A3B8" class="font-mono" font-size="11">#0EA5E9</text>
    </g>
    <g transform="translate(160, 44)">
      <rect width="140" height="90" rx="12" fill="#0284C7" />
      <text x="12" y="112" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="600">Sky Strong</text>
      <text x="12" y="128" fill="#94A3B8" class="font-mono" font-size="11">#0284C7</text>
    </g>
    <g transform="translate(320, 44)">
      <rect width="140" height="90" rx="12" fill="#0F172A" stroke="#334155" stroke-width="1" />
      <text x="12" y="112" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="600">Deep Blue</text>
      <text x="12" y="128" fill="#94A3B8" class="font-mono" font-size="11">#0F172A</text>
    </g>
    <g transform="translate(480, 44)">
      <rect width="140" height="90" rx="12" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <text x="12" y="112" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="600">Card Surface</text>
      <text x="12" y="128" fill="#94A3B8" class="font-mono" font-size="11">#1E293B</text>
    </g>
    <g transform="translate(640, 44)">
      <rect width="140" height="90" rx="12" fill="#10B981" />
      <text x="12" y="112" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="600">Emerald Clean</text>
      <text x="12" y="128" fill="#94A3B8" class="font-mono" font-size="11">#10B981</text>
    </g>
    <g transform="translate(800, 44)">
      <rect width="140" height="90" rx="12" fill="#F59E0B" />
      <text x="12" y="112" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="600">Amber Sand</text>
      <text x="12" y="128" fill="#94A3B8" class="font-mono" font-size="11">#F59E0B</text>
    </g>
    <g transform="translate(960, 44)">
      <rect width="140" height="90" rx="12" fill="#EF4444" />
      <text x="12" y="112" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="600">Alert Red</text>
      <text x="12" y="128" fill="#94A3B8" class="font-mono" font-size="11">#EF4444</text>
    </g>
    <g transform="translate(1120, 44)">
      <rect width="140" height="90" rx="12" fill="#FFFFFF" />
      <text x="12" y="112" fill="#0F172A" class="font-sans" font-size="13" font-weight="600">Exec White</text>
      <text x="12" y="128" fill="#64748B" class="font-mono" font-size="11">#FFFFFF</text>
    </g>
  </g>

  <!-- Canonical Resort Rooms Roster -->
  <g transform="translate(80, 370)">
    <text x="0" y="24" fill="#F8FAFC" class="font-sans" font-size="16" font-weight="700">02 · Canonical Project Accommodations (Only Real Units)</text>
    <rect x="0" y="44" width="1280" height="260" rx="14" fill="#0F172A" stroke="#1E293B" stroke-width="1.5" />

    <!-- Unit TEV -->
    <g transform="translate(32, 70)">
      <rect width="280" height="200" rx="12" fill="#1E293B" stroke="#0284C7" stroke-width="1.5" />
      <text x="20" y="32" fill="#38BDF8" class="font-mono" font-size="12" font-weight="700">UNIT CODE: TEV</text>
      <text x="20" y="60" fill="#F8FAFC" class="font-sans" font-size="20" font-weight="800">Unit TEV Grand Villa</text>
      <text x="20" y="85" fill="#94A3B8" class="font-sans" font-size="13">Category: Beachfront Villa</text>
      <text x="20" y="107" fill="#94A3B8" class="font-sans" font-size="13">Capacity: Up to 60 Guests</text>
      <text x="20" y="148" fill="#F8FAFC" class="font-sans" font-size="22" font-weight="800">₱18,000</text>
      <text x="110" y="148" fill="#64748B" class="font-sans" font-size="12">/night (Whole Villa)</text>
      <rect x="20" y="162" width="90" height="22" rx="4" fill="#0284C7" fill-opacity="0.2" />
      <text x="65" y="177" fill="#38BDF8" class="font-sans" font-size="10" font-weight="700" text-anchor="middle">EXCLUSIVE</text>
    </g>

    <!-- Unit CAT -->
    <g transform="translate(340, 70)">
      <rect width="280" height="200" rx="12" fill="#1E293B" stroke="#F59E0B" stroke-width="1.5" />
      <text x="20" y="32" fill="#F59E0B" class="font-mono" font-size="12" font-weight="700">UNIT CODE: CAT</text>
      <text x="20" y="60" fill="#F8FAFC" class="font-sans" font-size="20" font-weight="800">Unit CAT Cottage</text>
      <text x="20" y="85" fill="#94A3B8" class="font-sans" font-size="13">Alias: Unit Papang</text>
      <text x="20" y="107" fill="#94A3B8" class="font-sans" font-size="13">Capacity: Up to 10 Guests</text>
      <text x="20" y="148" fill="#F8FAFC" class="font-sans" font-size="22" font-weight="800">₱6,000</text>
      <text x="100" y="148" fill="#64748B" class="font-sans" font-size="12">/night (Cottage)</text>
      <rect x="20" y="162" width="100" height="22" rx="4" fill="#F59E0B" fill-opacity="0.2" />
      <text x="70" y="177" fill="#FBBF24" class="font-sans" font-size="10" font-weight="700" text-anchor="middle">BEACH COTTAGE</text>
    </g>

    <!-- Unit GEL -->
    <g transform="translate(650, 70)">
      <rect width="280" height="200" rx="12" fill="#1E293B" stroke="#10B981" stroke-width="1.5" />
      <text x="20" y="32" fill="#10B981" class="font-mono" font-size="12" font-weight="700">UNIT CODE: GEL</text>
      <text x="20" y="60" fill="#F8FAFC" class="font-sans" font-size="20" font-weight="800">Unit GEL Premier</text>
      <text x="20" y="85" fill="#94A3B8" class="font-sans" font-size="13">Category: Coastal Suite</text>
      <text x="20" y="107" fill="#94A3B8" class="font-sans" font-size="13">Capacity: Up to 25 Guests</text>
      <text x="20" y="148" fill="#F8FAFC" class="font-sans" font-size="22" font-weight="800">₱12,000</text>
      <text x="110" y="148" fill="#64748B" class="font-sans" font-size="12">/night (Suite)</text>
      <rect x="20" y="162" width="90" height="22" rx="4" fill="#10B981" fill-opacity="0.2" />
      <text x="65" y="177" fill="#34D399" class="font-sans" font-size="10" font-weight="700" text-anchor="middle">PREMIER</text>
    </g>

    <!-- Unit CATH -->
    <g transform="translate(960, 70)">
      <rect width="280" height="200" rx="12" fill="#1E293B" stroke="#A855F7" stroke-width="1.5" />
      <text x="20" y="32" fill="#C084FC" class="font-mono" font-size="12" font-weight="700">UNIT CODE: CATH</text>
      <text x="20" y="60" fill="#F8FAFC" class="font-sans" font-size="20" font-weight="800">Unit CATH Veranda</text>
      <text x="20" y="85" fill="#94A3B8" class="font-sans" font-size="13">Category: Veranda Villa</text>
      <text x="20" y="107" fill="#94A3B8" class="font-sans" font-size="13">Capacity: Up to 15 Guests</text>
      <text x="20" y="148" fill="#F8FAFC" class="font-sans" font-size="22" font-weight="800">₱8,500</text>
      <text x="100" y="148" fill="#64748B" class="font-sans" font-size="12">/night (Veranda)</text>
      <rect x="20" y="162" width="90" height="22" rx="4" fill="#A855F7" fill-opacity="0.2" />
      <text x="65" y="177" fill="#C084FC" class="font-sans" font-size="10" font-weight="700" text-anchor="middle">VERANDA</text>
    </g>
  </g>

  <!-- Typography & Components Row -->
  <g transform="translate(80, 680)">
    <text x="0" y="24" fill="#F8FAFC" class="font-sans" font-size="16" font-weight="700">03 · UI Controls &amp; Verified Type Scale</text>
    <rect x="0" y="44" width="1280" height="300" rx="14" fill="#0F172A" stroke="#1E293B" stroke-width="1.5" />

    <!-- Button Variants -->
    <g transform="translate(36, 75)">
      <rect width="150" height="44" rx="10" fill="url(#grad-sky)" />
      <text x="75" y="27" fill="#FFFFFF" class="font-sans" font-size="13" font-weight="700" text-anchor="middle">Reserve Unit</text>

      <rect x="170" width="150" height="44" rx="10" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <text x="245" y="27" fill="#E2E8F0" class="font-sans" font-size="13" font-weight="600" text-anchor="middle">View Unit Details</text>

      <rect x="340" width="130" height="44" rx="10" fill="transparent" stroke="#0284C7" stroke-width="1.5" />
      <text x="405" y="27" fill="#38BDF8" class="font-sans" font-size="13" font-weight="600" text-anchor="middle">Cancel</text>
    </g>

    <!-- Inputs & Steppers -->
    <g transform="translate(36, 145)">
      <rect width="280" height="44" rx="10" fill="#090D16" stroke="#334155" stroke-width="1.2" />
      <text x="16" y="27" fill="#E2E8F0" class="font-sans" font-size="13">Check-in: Oct 12, 2026</text>

      <rect x="300" width="180" height="44" rx="10" fill="#090D16" stroke="#334155" stroke-width="1.2" />
      <text x="320" y="27" fill="#38BDF8" class="font-sans" font-size="16" font-weight="700">−</text>
      <text x="390" y="27" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="700" text-anchor="middle">4 Guests</text>
      <text x="460" y="27" fill="#38BDF8" class="font-sans" font-size="16" font-weight="700">+</text>
    </g>

    <!-- Status Badges -->
    <g transform="translate(36, 215)">
      <rect width="100" height="30" rx="15" fill="#10B981" fill-opacity="0.15" stroke="#10B981" stroke-width="1" />
      <text x="50" y="19" fill="#34D399" class="font-sans" font-size="11" font-weight="700" text-anchor="middle">VACANT CLEAN</text>

      <rect x="115" width="86" height="30" rx="15" fill="#0EA5E9" fill-opacity="0.15" stroke="#0EA5E9" stroke-width="1" />
      <text x="158" y="19" fill="#38BDF8" class="font-sans" font-size="11" font-weight="700" text-anchor="middle">OCCUPIED</text>

      <rect x="216" width="108" height="30" rx="15" fill="#F59E0B" fill-opacity="0.15" stroke="#F59E0B" stroke-width="1" />
      <text x="270" y="19" fill="#FBBF24" class="font-sans" font-size="11" font-weight="700" text-anchor="middle">HOUSEKEEPING</text>

      <rect x="339" width="102" height="30" rx="15" fill="#EF4444" fill-opacity="0.15" stroke="#EF4444" stroke-width="1" />
      <text x="390" y="19" fill="#F87171" class="font-sans" font-size="11" font-weight="700" text-anchor="middle">MAINTENANCE</text>
    </g>

    <!-- Typography Specs on Right -->
    <g transform="translate(600, 75)">
      <text x="0" y="20" fill="#38BDF8" class="font-sans" font-size="11" font-weight="700" letter-spacing="1.5">EDITORIAL DISPLAY (PLAYFAIR DISPLAY 34PX)</text>
      <text x="0" y="55" fill="#F8FAFC" class="font-serif" font-size="30" font-weight="700">Where sunrise paints the cape</text>
      
      <text x="0" y="95" fill="#38BDF8" class="font-sans" font-size="11" font-weight="700" letter-spacing="1.5">BODY &amp; INTERFACE COPY (PLUS JAKARTA SANS 14PX)</text>
      <text x="0" y="120" fill="#94A3B8" class="font-sans" font-size="14">Flawless grammar and spelling across all guest touchpoints, checkout, and AI concierge.</text>
      
      <text x="0" y="160" fill="#38BDF8" class="font-sans" font-size="11" font-weight="700" letter-spacing="1.5">TECHNICAL MONOSPACE (JETBRAINS MONO 12PX)</text>
      <text x="0" y="185" fill="#F8FAFC" class="font-mono" font-size="12">ROSTER: [UNIT-TEV, UNIT-CAT, UNIT-GEL, UNIT-CATH]</text>
    </g>
  </g>
`;

fs.writeFileSync(path.join(outDir, '00_figma_ui_kit_and_components.svg'), wrapSvg(1440, 1080, uiKitContent, '00 - Figma UI Kit & Canonical Room Roster'));
console.log('✓ Created 00_figma_ui_kit_and_components.svg');

// -------------------------------------------------------------
// 2. GUEST LANDING HOME (01_guest_landing_home.svg)
// -------------------------------------------------------------
const landingContent = `
  <rect width="1440" height="1520" fill="#0A0F1D" />

  <!-- TOP NAVBAR -->
  <g transform="translate(0, 0)">
    <rect width="1440" height="74" fill="#0A0F1D" fill-opacity="0.95" />
    <line x1="0" y1="74" x2="1440" y2="74" stroke="#1E293B" stroke-width="1" />
    
    <g transform="translate(80, 20)">
      <circle cx="17" cy="17" r="17" fill="url(#grad-sky)" />
      <text x="17" y="23" fill="#FFFFFF" class="font-sans" font-size="16" font-weight="800" text-anchor="middle">J</text>
      <text x="46" y="24" fill="#F8FAFC" class="font-sans" font-size="17" font-weight="800" letter-spacing="-0.5">J &amp; D RESERVE</text>
      <text x="182" y="24" fill="#38BDF8" class="font-mono" font-size="11" font-weight="700">· PATAR BEACH</text>
    </g>

    <g transform="translate(560, 28)">
      <text x="0" y="16" fill="#38BDF8" class="font-sans" font-size="14" font-weight="600">Home</text>
      <text x="75" y="16" fill="#94A3B8" class="font-sans" font-size="14" font-weight="500">Accommodations</text>
      <text x="215" y="16" fill="#94A3B8" class="font-sans" font-size="14" font-weight="500">Dining</text>
      <text x="295" y="16" fill="#94A3B8" class="font-sans" font-size="14" font-weight="500">Resort Map</text>
      <text x="405" y="16" fill="#94A3B8" class="font-sans" font-size="14" font-weight="500">Experiences</text>
    </g>

    <g transform="translate(1080, 18)">
      <rect width="130" height="38" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <circle cx="16" cy="19" r="4" fill="#10B981" />
      <text x="28" y="24" fill="#E2E8F0" class="font-mono" font-size="11">11:45 AM PST</text>

      <rect x="146" width="134" height="38" rx="8" fill="url(#grad-sky)" />
      <text x="213" y="24" fill="#FFFFFF" class="font-sans" font-size="13" font-weight="700" text-anchor="middle">Sign In / Register</text>
    </g>
  </g>

  <!-- HERO SECTION -->
  <g transform="translate(80, 110)">
    <rect width="1280" height="480" rx="24" fill="url(#grad-dark)" stroke="#1E293B" stroke-width="1.5" />
    <circle cx="980" cy="240" r="220" fill="#0284C7" fill-opacity="0.12" filter="blur(60px)" />
    <circle cx="1140" cy="180" r="140" fill="#F59E0B" fill-opacity="0.08" filter="blur(40px)" />

    <!-- Scene Switcher Overlay -->
    <g transform="translate(48, 48)">
      <rect width="420" height="36" rx="8" fill="#090D16" fill-opacity="0.8" stroke="#334155" stroke-width="1" />
      <text x="20" y="23" fill="#38BDF8" class="font-mono" font-size="11" font-weight="700">01 · SUNSET CAPE</text>
      <text x="140" y="23" fill="#64748B" class="font-mono" font-size="11">02 · SEA BALCONY</text>
      <text x="270" y="23" fill="#64748B" class="font-mono" font-size="11">03 · NIPA COVE</text>
    </g>

    <!-- Headline & Body -->
    <g transform="translate(48, 125)">
      <text x="0" y="32" fill="#38BDF8" class="font-sans" font-size="13" font-weight="700" letter-spacing="2">BOLINAO, PANGASINAN · WHITE SAND HIDEAWAY</text>
      <text x="0" y="90" fill="#FFFFFF" class="font-serif" font-size="52" font-weight="700">Where sunrise paints</text>
      <text x="0" y="150" fill="#38BDF8" class="font-serif" font-size="52" font-weight="700" font-style="italic">the pristine cape.</text>
      <text x="0" y="200" fill="#94A3B8" class="font-sans" font-size="16" font-weight="400">Experience raw coastal serenity just minutes away from Cape Bolinao Lighthouse</text>
      <text x="0" y="226" fill="#94A3B8" class="font-sans" font-size="16" font-weight="400">and Patar's iconic golden-sand reef.</text>
    </g>

    <!-- Ocean Sound Synthesizer CTA -->
    <g transform="translate(48, 400)">
      <rect width="190" height="42" rx="10" fill="#1E293B" stroke="#0284C7" stroke-width="1.2" />
      <text x="20" y="26" fill="#38BDF8" class="font-sans" font-size="13" font-weight="700">🌊 Ocean Sound: Active</text>
    </g>

    <!-- HERO SEARCH BAR DOCK (Floating) -->
    <g transform="translate(300, 375)" filter="url(#shadow-soft)">
      <rect width="932" height="74" rx="16" fill="#0F172A" stroke="#334155" stroke-width="1.5" />
      
      <g transform="translate(24, 18)">
        <text x="0" y="12" fill="#94A3B8" class="font-sans" font-size="10" font-weight="700" letter-spacing="1">CHECK-IN</text>
        <text x="0" y="32" fill="#F8FAFC" class="font-sans" font-size="14" font-weight="600">Oct 12, 2026</text>
      </g>
      <line x1="210" y1="16" x2="210" y2="58" stroke="#1E293B" stroke-width="1" />

      <g transform="translate(230, 18)">
        <text x="0" y="12" fill="#94A3B8" class="font-sans" font-size="10" font-weight="700" letter-spacing="1">CHECK-OUT</text>
        <text x="0" y="32" fill="#F8FAFC" class="font-sans" font-size="14" font-weight="600">Oct 14, 2026</text>
      </g>
      <line x1="420" y1="16" x2="420" y2="58" stroke="#1E293B" stroke-width="1" />

      <g transform="translate(440, 18)">
        <text x="0" y="12" fill="#94A3B8" class="font-sans" font-size="10" font-weight="700" letter-spacing="1">GUESTS</text>
        <text x="0" y="32" fill="#F8FAFC" class="font-sans" font-size="14" font-weight="600">4 Guests</text>
      </g>
      <line x1="630" y1="16" x2="630" y2="58" stroke="#1E293B" stroke-width="1" />

      <g transform="translate(650, 18)">
        <text x="0" y="12" fill="#94A3B8" class="font-sans" font-size="10" font-weight="700" letter-spacing="1">UNIT ROSTER</text>
        <text x="0" y="32" fill="#F8FAFC" class="font-sans" font-size="14" font-weight="600">Unit TEV / CAT / GEL / CATH</text>
      </g>

      <g transform="translate(790, 14)">
        <rect width="124" height="46" rx="10" fill="url(#grad-sky)" />
        <text x="62" y="28" fill="#FFFFFF" class="font-sans" font-size="13" font-weight="700" text-anchor="middle">Search Units</text>
      </g>
    </g>
  </g>

  <!-- STATS ROW -->
  <g transform="translate(80, 630)">
    <rect width="1280" height="96" rx="16" fill="#0F172A" stroke="#1E293B" stroke-width="1" />
    
    <g transform="translate(60, 28)">
      <text x="0" y="28" fill="#F8FAFC" class="font-sans" font-size="28" font-weight="800">4.9 ★</text>
      <text x="0" y="48" fill="#94A3B8" class="font-sans" font-size="12">Average Guest Rating (280+ Verified Reviews)</text>
    </g>
    <line x1="360" y1="20" x2="360" y2="76" stroke="#1E293B" stroke-width="1" />

    <g transform="translate(420, 28)">
      <text x="0" y="28" fill="#F8FAFC" class="font-sans" font-size="28" font-weight="800">100%</text>
      <text x="0" y="48" fill="#94A3B8" class="font-sans" font-size="12">Direct Beachfront Access to Patar White Sand</text>
    </g>
    <line x1="720" y1="20" x2="720" y2="76" stroke="#1E293B" stroke-width="1" />

    <g transform="translate(780, 28)">
      <text x="0" y="28" fill="#F8FAFC" class="font-sans" font-size="28" font-weight="800">4 Units</text>
      <text x="0" y="48" fill="#94A3B8" class="font-sans" font-size="12">Private Accommodations: TEV, CAT, GEL, CATH</text>
    </g>
    <line x1="1020" y1="20" x2="1020" y2="76" stroke="#1E293B" stroke-width="1" />

    <g transform="translate(1080, 28)">
      <text x="0" y="28" fill="#38BDF8" class="font-sans" font-size="28" font-weight="800">24/7</text>
      <text x="0" y="48" fill="#94A3B8" class="font-sans" font-size="12">Smart AI Concierge &amp; Reception Desk</text>
    </g>
  </g>

  <!-- FEATURED ACCOMMODATIONS (EXACT CANONICAL ROSTER: TEV, CAT, GEL, CATH) -->
  <g transform="translate(80, 770)">
    <text x="0" y="24" fill="#38BDF8" class="font-sans" font-size="12" font-weight="700" letter-spacing="2">AUTHENTIC RESORT ROSTER</text>
    <text x="0" y="56" fill="#F8FAFC" class="font-serif" font-size="32" font-weight="700">Official Project Accommodations</text>

    <!-- Card 1: Unit TEV -->
    <g transform="translate(0, 80)">
      <rect width="300" height="440" rx="16" fill="#0F172A" stroke="#0284C7" stroke-width="1.5" />
      <rect width="300" height="190" rx="16" fill="#1E293B" />
      <path d="M 0 0 L 300 190 M 300 0 L 0 190" stroke="#334155" stroke-width="0.75" />
      <rect x="16" y="16" width="70" height="24" rx="5" fill="#0284C7" />
      <text x="51" y="32" fill="#FFFFFF" class="font-sans" font-size="11" font-weight="700" text-anchor="middle">TEV</text>

      <g transform="translate(20, 214)">
        <text x="0" y="20" fill="#F8FAFC" class="font-sans" font-size="18" font-weight="700">Unit TEV Grand Villa</text>
        <text x="0" y="42" fill="#94A3B8" class="font-sans" font-size="12">Beachfront grand villa with expansive ocean views and private veranda.</text>
        <text x="0" y="74" fill="#38BDF8" class="font-sans" font-size="11" font-weight="600">Capacity: Up to 60 Guests</text>

        <g transform="translate(0, 110)">
          <text x="0" y="24" fill="#F8FAFC" class="font-sans" font-size="22" font-weight="800">₱18,000</text>
          <text x="96" y="24" fill="#64748B" class="font-sans" font-size="12">/night</text>
          <rect y="38" width="260" height="38" rx="8" fill="url(#grad-sky)" />
          <text x="130" y="62" fill="#FFFFFF" class="font-sans" font-size="12" font-weight="700" text-anchor="middle">Reserve Unit TEV</text>
        </g>
      </g>
    </g>

    <!-- Card 2: Unit CAT -->
    <g transform="translate(326, 80)">
      <rect width="300" height="440" rx="16" fill="#0F172A" stroke="#F59E0B" stroke-width="1.5" />
      <rect width="300" height="190" rx="16" fill="#1E293B" />
      <path d="M 0 0 L 300 190 M 300 0 L 0 190" stroke="#334155" stroke-width="0.75" />
      <rect x="16" y="16" width="70" height="24" rx="5" fill="#F59E0B" />
      <text x="51" y="32" fill="#FFFFFF" class="font-sans" font-size="11" font-weight="700" text-anchor="middle">CAT</text>

      <g transform="translate(20, 214)">
        <text x="0" y="20" fill="#F8FAFC" class="font-sans" font-size="18" font-weight="700">Unit CAT Cottage</text>
        <text x="0" y="42" fill="#94A3B8" class="font-sans" font-size="12">Authentic beach cottage (Unit Papang) with cool sea breeze flow.</text>
        <text x="0" y="74" fill="#FBBF24" class="font-sans" font-size="11" font-weight="600">Capacity: Up to 10 Guests</text>

        <g transform="translate(0, 110)">
          <text x="0" y="24" fill="#F8FAFC" class="font-sans" font-size="22" font-weight="800">₱6,000</text>
          <text x="80" y="24" fill="#64748B" class="font-sans" font-size="12">/night</text>
          <rect y="38" width="260" height="38" rx="8" fill="url(#grad-sky)" />
          <text x="130" y="62" fill="#FFFFFF" class="font-sans" font-size="12" font-weight="700" text-anchor="middle">Reserve Unit CAT</text>
        </g>
      </g>
    </g>

    <!-- Card 3: Unit GEL -->
    <g transform="translate(652, 80)">
      <rect width="300" height="440" rx="16" fill="#0F172A" stroke="#10B981" stroke-width="1.5" />
      <rect width="300" height="190" rx="16" fill="#1E293B" />
      <path d="M 0 0 L 300 190 M 300 0 L 0 190" stroke="#334155" stroke-width="0.75" />
      <rect x="16" y="16" width="70" height="24" rx="5" fill="#10B981" />
      <text x="51" y="32" fill="#FFFFFF" class="font-sans" font-size="11" font-weight="700" text-anchor="middle">GEL</text>

      <g transform="translate(20, 214)">
        <text x="0" y="20" fill="#F8FAFC" class="font-sans" font-size="18" font-weight="700">Unit GEL Premier</text>
        <text x="0" y="42" fill="#94A3B8" class="font-sans" font-size="12">Modern premier suite with connected family lounge and kitchen facilities.</text>
        <text x="0" y="74" fill="#34D399" class="font-sans" font-size="11" font-weight="600">Capacity: Up to 25 Guests</text>

        <g transform="translate(0, 110)">
          <text x="0" y="24" fill="#F8FAFC" class="font-sans" font-size="22" font-weight="800">₱12,000</text>
          <text x="96" y="24" fill="#64748B" class="font-sans" font-size="12">/night</text>
          <rect y="38" width="260" height="38" rx="8" fill="url(#grad-sky)" />
          <text x="130" y="62" fill="#FFFFFF" class="font-sans" font-size="12" font-weight="700" text-anchor="middle">Reserve Unit GEL</text>
        </g>
      </g>
    </g>

    <!-- Card 4: Unit CATH -->
    <g transform="translate(978, 80)">
      <rect width="300" height="440" rx="16" fill="#0F172A" stroke="#A855F7" stroke-width="1.5" />
      <rect width="300" height="190" rx="16" fill="#1E293B" />
      <path d="M 0 0 L 300 190 M 300 0 L 0 190" stroke="#334155" stroke-width="0.75" />
      <rect x="16" y="16" width="70" height="24" rx="5" fill="#A855F7" />
      <text x="51" y="32" fill="#FFFFFF" class="font-sans" font-size="11" font-weight="700" text-anchor="middle">CATH</text>

      <g transform="translate(20, 214)">
        <text x="0" y="20" fill="#F8FAFC" class="font-sans" font-size="18" font-weight="700">Unit CATH Veranda</text>
        <text x="0" y="42" fill="#94A3B8" class="font-sans" font-size="12">Panoramic sunset veranda villa tailored for family gatherings.</text>
        <text x="0" y="74" fill="#C084FC" class="font-sans" font-size="11" font-weight="600">Capacity: Up to 15 Guests</text>

        <g transform="translate(0, 110)">
          <text x="0" y="24" fill="#F8FAFC" class="font-sans" font-size="22" font-weight="800">₱8,500</text>
          <text x="88" y="24" fill="#64748B" class="font-sans" font-size="12">/night</text>
          <rect y="38" width="260" height="38" rx="8" fill="url(#grad-sky)" />
          <text x="130" y="62" fill="#FFFFFF" class="font-sans" font-size="12" font-weight="700" text-anchor="middle">Reserve Unit CATH</text>
        </g>
      </g>
    </g>
  </g>

  <!-- RESORT MAP & EXPERIENCES STRIP -->
  <g transform="translate(80, 1330)">
    <rect width="1280" height="130" rx="16" fill="#0F172A" stroke="#1E293B" stroke-width="1.5" />
    <g transform="translate(36, 32)">
      <text x="0" y="22" fill="#F8FAFC" class="font-sans" font-size="18" font-weight="700">Explore Bolinao &amp; Patar Wonders</text>
      <text x="0" y="44" fill="#94A3B8" class="font-sans" font-size="13">Convenient proximity to Bolinao's most famous natural destinations</text>
    </g>
    <g transform="translate(480, 36)">
      <rect width="180" height="54" rx="10" fill="#1E293B" />
      <text x="16" y="24" fill="#F8FAFC" class="font-sans" font-size="12" font-weight="700">Cape Bolinao Light</text>
      <text x="16" y="42" fill="#38BDF8" class="font-mono" font-size="11">⏱️ 10 min away</text>

      <rect x="196" width="180" height="54" rx="10" fill="#1E293B" />
      <text x="212" y="24" fill="#F8FAFC" class="font-sans" font-size="12" font-weight="700">Bolinao Falls</text>
      <text x="212" y="42" fill="#38BDF8" class="font-mono" font-size="11">⏱️ 15 min away</text>

      <rect x="392" width="180" height="54" rx="10" fill="#1E293B" />
      <text x="408" y="24" fill="#F8FAFC" class="font-sans" font-size="12" font-weight="700">Enchanted Cave</text>
      <text x="408" y="42" fill="#38BDF8" class="font-mono" font-size="11">⏱️ 20 min away</text>

      <rect x="588" width="180" height="54" rx="10" fill="#1E293B" />
      <text x="604" y="24" fill="#F8FAFC" class="font-sans" font-size="12" font-weight="700">Island Hopping</text>
      <text x="604" y="42" fill="#38BDF8" class="font-mono" font-size="11">⏱️ 25 min away</text>
    </g>
  </g>
`;

fs.writeFileSync(path.join(outDir, '01_guest_landing_home.svg'), wrapSvg(1440, 1520, landingContent, '01 - Guest Landing Page (TEV, CAT, GEL, CATH)'));
console.log('✓ Created 01_guest_landing_home.svg');

// -------------------------------------------------------------
// 3. ROOMS & RATES CATALOG (02_rooms_and_rates_catalog.svg)
// -------------------------------------------------------------
const catalogContent = `
  <rect width="1440" height="1200" fill="#0A0F1D" />

  <!-- Navbar Clone -->
  <g transform="translate(0, 0)">
    <rect width="1440" height="74" fill="#0A0F1D" />
    <line x1="0" y1="74" x2="1440" y2="74" stroke="#1E293B" stroke-width="1" />
    <g transform="translate(80, 20)">
      <circle cx="17" cy="17" r="17" fill="url(#grad-sky)" />
      <text x="17" y="23" fill="#FFFFFF" class="font-sans" font-size="16" font-weight="800" text-anchor="middle">J</text>
      <text x="46" y="24" fill="#F8FAFC" class="font-sans" font-size="17" font-weight="800">J &amp; D RESERVE</text>
    </g>
    <g transform="translate(560, 28)">
      <text x="0" y="16" fill="#94A3B8" class="font-sans" font-size="14">Home</text>
      <text x="75" y="16" fill="#38BDF8" class="font-sans" font-size="14" font-weight="700">Accommodations</text>
      <text x="215" y="16" fill="#94A3B8" class="font-sans" font-size="14">Dining</text>
      <text x="295" y="16" fill="#94A3B8" class="font-sans" font-size="14">Resort Map</text>
    </g>
  </g>

  <!-- Page Header -->
  <g transform="translate(80, 110)">
    <text x="0" y="24" fill="#38BDF8" class="font-sans" font-size="12" font-weight="700" letter-spacing="2">AUTHENTIC RESORT ROSTER</text>
    <text x="0" y="64" fill="#F8FAFC" class="font-serif" font-size="36" font-weight="700">Official Rooms &amp; Rates Catalog</text>
    
    <g transform="translate(940, 18)">
      <rect width="340" height="44" rx="10" fill="#0F172A" stroke="#334155" stroke-width="1.2" />
      <text x="20" y="27" fill="#64748B" class="font-sans" font-size="13">Filter by unit code: TEV, CAT, GEL, CATH…</text>
    </g>
  </g>

  <!-- Filter Chips Row (Only TEV, CAT, GEL, CATH) -->
  <g transform="translate(80, 210)">
    <rect width="68" height="34" rx="17" fill="url(#grad-sky)" />
    <text x="34" y="22" fill="#FFFFFF" class="font-sans" font-size="12" font-weight="700" text-anchor="middle">All (4)</text>

    <rect x="80" width="110" height="34" rx="17" fill="#1E293B" stroke="#334155" stroke-width="1" />
    <text x="135" y="22" fill="#E2E8F0" class="font-sans" font-size="12" font-weight="600" text-anchor="middle">Unit TEV</text>

    <rect x="202" width="110" height="34" rx="17" fill="#1E293B" stroke="#334155" stroke-width="1" />
    <text x="257" y="22" fill="#E2E8F0" class="font-sans" font-size="12" font-weight="600" text-anchor="middle">Unit CAT</text>

    <rect x="324" width="110" height="34" rx="17" fill="#1E293B" stroke="#334155" stroke-width="1" />
    <text x="379" y="22" fill="#E2E8F0" class="font-sans" font-size="12" font-weight="600" text-anchor="middle">Unit GEL</text>

    <rect x="446" width="110" height="34" rx="17" fill="#1E293B" stroke="#334155" stroke-width="1" />
    <text x="501" y="22" fill="#E2E8F0" class="font-sans" font-size="12" font-weight="600" text-anchor="middle">Unit CATH</text>
  </g>

  <!-- 2x2 Clean Catalog Grid (Exact 4 Units) -->
  <!-- 1. Unit TEV -->
  <g transform="translate(80, 280)">
    <rect width="620" height="410" rx="18" fill="#0F172A" stroke="#0284C7" stroke-width="1.5" />
    <rect width="620" height="220" rx="18" fill="#1E293B" />
    <path d="M 0 0 L 620 220 M 620 0 L 0 220" stroke="#334155" stroke-width="0.75" />
    
    <g transform="translate(28, 244)">
      <text x="0" y="20" fill="#38BDF8" class="font-sans" font-size="11" font-weight="700">CANONICAL UNIT: TEV · GRAND VILLA</text>
      <text x="500" y="20" fill="#F59E0B" class="font-sans" font-size="12" font-weight="700">★ 5.0 (48 reviews)</text>
      
      <text x="0" y="50" fill="#F8FAFC" class="font-sans" font-size="22" font-weight="700">Unit TEV Grand Beachfront Villa</text>
      <text x="0" y="74" fill="#94A3B8" class="font-sans" font-size="13">Expansive beachfront property with private dining pavilion. Ideal for large groups and retreats.</text>

      <g transform="translate(0, 110)">
        <text x="0" y="24" fill="#F8FAFC" class="font-sans" font-size="24" font-weight="800">₱18,000</text>
        <text x="110" y="24" fill="#64748B" class="font-sans" font-size="12">/night · Capacity: 60 guests</text>
        
        <rect x="420" y="0" width="144" height="42" rx="10" fill="url(#grad-sky)" />
        <text x="492" y="26" fill="#FFFFFF" class="font-sans" font-size="13" font-weight="700" text-anchor="middle">Reserve TEV</text>
      </g>
    </g>
  </g>

  <!-- 2. Unit CAT -->
  <g transform="translate(740, 280)">
    <rect width="620" height="410" rx="18" fill="#0F172A" stroke="#F59E0B" stroke-width="1.5" />
    <rect width="620" height="220" rx="18" fill="#1E293B" />
    <path d="M 0 0 L 620 220 M 620 0 L 0 220" stroke="#334155" stroke-width="0.75" />
    
    <g transform="translate(28, 244)">
      <text x="0" y="20" fill="#F59E0B" class="font-sans" font-size="11" font-weight="700">CANONICAL UNIT: CAT · ALIAS UNIT PAPANG</text>
      <text x="500" y="20" fill="#F59E0B" class="font-sans" font-size="12" font-weight="700">★ 4.9 (32 reviews)</text>
      
      <text x="0" y="50" fill="#F8FAFC" class="font-sans" font-size="22" font-weight="700">Unit CAT Beachfront Cottage</text>
      <text x="0" y="74" fill="#94A3B8" class="font-sans" font-size="13">Traditional Bolinao beachfront cottage featuring native bamboo veranda and sea breeze airflow.</text>

      <g transform="translate(0, 110)">
        <text x="0" y="24" fill="#F8FAFC" class="font-sans" font-size="24" font-weight="800">₱6,000</text>
        <text x="100" y="24" fill="#64748B" class="font-sans" font-size="12">/night · Capacity: 10 guests</text>
        
        <rect x="420" y="0" width="144" height="42" rx="10" fill="url(#grad-sky)" />
        <text x="492" y="26" fill="#FFFFFF" class="font-sans" font-size="13" font-weight="700" text-anchor="middle">Reserve CAT</text>
      </g>
    </g>
  </g>

  <!-- 3. Unit GEL -->
  <g transform="translate(80, 720)">
    <rect width="620" height="410" rx="18" fill="#0F172A" stroke="#10B981" stroke-width="1.5" />
    <rect width="620" height="220" rx="18" fill="#1E293B" />
    <path d="M 0 0 L 620 220 M 620 0 L 0 220" stroke="#334155" stroke-width="0.75" />
    
    <g transform="translate(28, 244)">
      <text x="0" y="20" fill="#10B981" class="font-sans" font-size="11" font-weight="700">CANONICAL UNIT: GEL · PREMIER SUITE</text>
      <text x="500" y="20" fill="#F59E0B" class="font-sans" font-size="12" font-weight="700">★ 4.9 (29 reviews)</text>
      
      <text x="0" y="50" fill="#F8FAFC" class="font-sans" font-size="22" font-weight="700">Unit GEL Premier Coastal Suite</text>
      <text x="0" y="74" fill="#94A3B8" class="font-sans" font-size="13">Modern multi-room suite with connected private veranda and family dining setup.</text>

      <g transform="translate(0, 110)">
        <text x="0" y="24" fill="#F8FAFC" class="font-sans" font-size="24" font-weight="800">₱12,000</text>
        <text x="110" y="24" fill="#64748B" class="font-sans" font-size="12">/night · Capacity: 25 guests</text>
        
        <rect x="420" y="0" width="144" height="42" rx="10" fill="url(#grad-sky)" />
        <text x="492" y="26" fill="#FFFFFF" class="font-sans" font-size="13" font-weight="700" text-anchor="middle">Reserve GEL</text>
      </g>
    </g>
  </g>

  <!-- 4. Unit CATH -->
  <g transform="translate(740, 720)">
    <rect width="620" height="410" rx="18" fill="#0F172A" stroke="#A855F7" stroke-width="1.5" />
    <rect width="620" height="220" rx="18" fill="#1E293B" />
    <path d="M 0 0 L 620 220 M 620 0 L 0 220" stroke="#334155" stroke-width="0.75" />
    
    <g transform="translate(28, 244)">
      <text x="0" y="20" fill="#C084FC" class="font-sans" font-size="11" font-weight="700">CANONICAL UNIT: CATH · VERANDA VILLA</text>
      <text x="500" y="20" fill="#F59E0B" class="font-sans" font-size="12" font-weight="700">★ 4.8 (21 reviews)</text>
      
      <text x="0" y="50" fill="#F8FAFC" class="font-sans" font-size="22" font-weight="700">Unit CATH Executive Veranda</text>
      <text x="0" y="74" fill="#94A3B8" class="font-sans" font-size="13">Sunset-facing private villa with dedicated patio and outdoor dining amenities.</text>

      <g transform="translate(0, 110)">
        <text x="0" y="24" fill="#F8FAFC" class="font-sans" font-size="24" font-weight="800">₱8,500</text>
        <text x="100" y="24" fill="#64748B" class="font-sans" font-size="12">/night · Capacity: 15 guests</text>
        
        <rect x="420" y="0" width="144" height="42" rx="10" fill="url(#grad-sky)" />
        <text x="492" y="26" fill="#FFFFFF" class="font-sans" font-size="13" font-weight="700" text-anchor="middle">Reserve CATH</text>
      </g>
    </g>
  </g>
`;

fs.writeFileSync(path.join(outDir, '02_rooms_and_rates_catalog.svg'), wrapSvg(1440, 1200, catalogContent, '02 - Rooms & Rates Catalog (TEV, CAT, GEL, CATH)'));
console.log('✓ Created 02_rooms_and_rates_catalog.svg');

// -------------------------------------------------------------
// 4. BOOKING & CHECKOUT MODAL (03_booking_and_checkout_modal.svg)
// -------------------------------------------------------------
const checkoutContent = `
  <rect width="1440" height="1024" fill="#0A0F1D" fill-opacity="0.85" />
  
  <g transform="translate(280, 80)" filter="url(#shadow-modal)">
    <rect width="880" height="864" rx="20" fill="#0F172A" stroke="#334155" stroke-width="1.5" />
    
    <g transform="translate(40, 36)">
      <text x="0" y="24" fill="#38BDF8" class="font-sans" font-size="12" font-weight="700" letter-spacing="2">STEP 2 OF 3 · RESERVATION CHECKOUT</text>
      <text x="0" y="56" fill="#F8FAFC" class="font-sans" font-size="26" font-weight="800">Confirm Booking: Unit TEV Grand Villa</text>
      
      <circle cx="780" cy="30" r="16" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <text x="780" y="35" fill="#94A3B8" class="font-sans" font-size="14" font-weight="700" text-anchor="middle">✕</text>
    </g>
    <line x1="40" y1="110" x2="840" y2="110" stroke="#1E293B" stroke-width="1" />

    <!-- Column 1: Info Inputs -->
    <g transform="translate(40, 136)">
      <text x="0" y="16" fill="#F8FAFC" class="font-sans" font-size="15" font-weight="700">1. Guest &amp; Schedule Details</text>

      <g transform="translate(0, 32)">
        <rect width="195" height="48" rx="10" fill="#1E293B" stroke="#334155" stroke-width="1" />
        <text x="14" y="18" fill="#94A3B8" class="font-sans" font-size="10" font-weight="700">CHECK-IN</text>
        <text x="14" y="36" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="600">Oct 12, 2026</text>

        <rect x="210" width="195" height="48" rx="10" fill="#1E293B" stroke="#334155" stroke-width="1" />
        <text x="224" y="18" fill="#94A3B8" class="font-sans" font-size="10" font-weight="700">CHECK-OUT</text>
        <text x="224" y="36" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="600">Oct 14, 2026 (2 Nights)</text>
      </g>

      <g transform="translate(0, 96)">
        <text x="0" y="14" fill="#94A3B8" class="font-sans" font-size="12" font-weight="600">Primary Guest Full Name</text>
        <rect y="24" width="405" height="44" rx="8" fill="#090D16" stroke="#334155" stroke-width="1" />
        <text x="14" y="51" fill="#F8FAFC" class="font-sans" font-size="13">Juan Dela Cruz</text>
      </g>

      <g transform="translate(0, 180)">
        <text x="0" y="14" fill="#94A3B8" class="font-sans" font-size="12" font-weight="600">Email Address (Nodemailer OTP Delivery)</text>
        <rect y="24" width="405" height="44" rx="8" fill="#090D16" stroke="#0284C7" stroke-width="1" />
        <text x="14" y="51" fill="#F8FAFC" class="font-sans" font-size="13">noreplyemailrecoveryjandd@gmail.com</text>
      </g>

      <g transform="translate(0, 264)">
        <text x="0" y="14" fill="#38BDF8" class="font-sans" font-size="12" font-weight="700">Enter 6-Digit Email Verification Code</text>
        <rect y="24" width="250" height="44" rx="8" fill="#090D16" stroke="#0284C7" stroke-width="1.2" />
        <text x="14" y="52" fill="#38BDF8" class="font-mono" font-size="16" font-weight="700" letter-spacing="4">849201</text>
        
        <rect x="264" y="24" width="141" height="44" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
        <text x="334" y="51" fill="#34D399" class="font-sans" font-size="12" font-weight="700" text-anchor="middle">✓ Verified</text>
      </g>

      <g transform="translate(0, 350)">
        <text x="0" y="14" fill="#94A3B8" class="font-sans" font-size="12" font-weight="600">Mobile Phone (Twilio SMS Confirmation)</text>
        <rect y="24" width="405" height="44" rx="8" fill="#090D16" stroke="#334155" stroke-width="1" />
        <text x="14" y="51" fill="#F8FAFC" class="font-sans" font-size="13">+63 917 555 0192</text>
      </g>

      <g transform="translate(0, 434)">
        <text x="0" y="14" fill="#94A3B8" class="font-sans" font-size="12" font-weight="600">Special Notes &amp; Requests</text>
        <rect y="24" width="405" height="60" rx="8" fill="#090D16" stroke="#334155" stroke-width="1" />
        <text x="14" y="50" fill="#64748B" class="font-sans" font-size="12">Please prepare Bolinao Grilled Bangus for our dinner arrival…</text>
      </g>
    </g>

    <line x1="475" y1="136" x2="475" y2="720" stroke="#1E293B" stroke-width="1" />

    <!-- Column 2: Math & Payment (Unit TEV Rate ₱18,000) -->
    <g transform="translate(505, 136)">
      <text x="0" y="16" fill="#F8FAFC" class="font-sans" font-size="15" font-weight="700">2. Breakdown &amp; Payment</text>

      <rect y="32" width="335" height="240" rx="12" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <g transform="translate(20, 56)">
        <text x="0" y="16" fill="#94A3B8" class="font-sans" font-size="13">Unit TEV: 2 Nights @ ₱18,000</text>
        <text x="295" y="16" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="600" text-anchor="end">₱36,000.00</text>

        <text x="0" y="46" fill="#94A3B8" class="font-sans" font-size="13">12% Value Added Tax (VAT)</text>
        <text x="295" y="46" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="600" text-anchor="end">₱4,320.00</text>

        <text x="0" y="76" fill="#94A3B8" class="font-sans" font-size="13">Bolinao Environmental Fee</text>
        <text x="295" y="76" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="600" text-anchor="end">₱100.00</text>

        <line x1="0" y1="102" x2="295" y2="102" stroke="#334155" stroke-width="1" />

        <text x="0" y="132" fill="#38BDF8" class="font-sans" font-size="16" font-weight="800">Total Net Amount</text>
        <text x="295" y="132" fill="#38BDF8" class="font-sans" font-size="20" font-weight="800" text-anchor="end">₱40,420.00</text>

        <text x="0" y="164" fill="#94A3B8" class="font-sans" font-size="12">50% Reservation Deposit</text>
        <text x="295" y="164" fill="#FBBF24" class="font-sans" font-size="13" font-weight="700" text-anchor="end">₱20,210.00</text>
      </g>

      <g transform="translate(0, 290)">
        <text x="0" y="16" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="700">Settlement Gateway</text>
        
        <rect y="28" width="335" height="48" rx="8" fill="#0EA5E9" fill-opacity="0.15" stroke="#0284C7" stroke-width="1.5" />
        <circle cx="24" cy="52" r="8" fill="#0284C7" />
        <text x="44" y="56" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="700">GCash Instant QR Settlement</text>

        <rect y="84" width="335" height="48" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
        <circle cx="24" cy="108" r="8" fill="#334155" />
        <text x="44" y="112" fill="#94A3B8" class="font-sans" font-size="13">Maya / Visa / Mastercard</text>

        <rect y="140" width="335" height="48" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
        <circle cx="24" cy="164" r="8" fill="#334155" />
        <text x="44" y="168" fill="#94A3B8" class="font-sans" font-size="13">Cash on Arrival (Deposit Required)</text>
      </g>

      <g transform="translate(0, 500)">
        <rect width="335" height="52" rx="10" fill="url(#grad-sky)" />
        <text x="167" y="32" fill="#FFFFFF" class="font-sans" font-size="14" font-weight="800" text-anchor="middle">Authorize &amp; Complete Booking</text>
        <text x="167" y="74" fill="#64748B" class="font-sans" font-size="11" text-anchor="middle">🔒 Encrypted via Supabase SSL · Instant Voucher Generated</text>
      </g>
    </g>
  </g>
`;

fs.writeFileSync(path.join(outDir, '03_booking_and_checkout_modal.svg'), wrapSvg(1440, 1024, checkoutContent, '03 - Booking & Checkout Modal (Unit TEV)'));
console.log('✓ Created 03_booking_and_checkout_modal.svg');

// -------------------------------------------------------------
// 5. GUEST SELF-SERVICE PORTAL (04_guest_self_service_portal.svg)
// -------------------------------------------------------------
const portalContent = `
  <rect width="1440" height="1024" fill="#0A0F1D" />

  <g transform="translate(0, 0)">
    <rect width="1440" height="74" fill="#0A0F1D" />
    <line x1="0" y1="74" x2="1440" y2="74" stroke="#1E293B" stroke-width="1" />
    <g transform="translate(80, 20)">
      <circle cx="17" cy="17" r="17" fill="url(#grad-sky)" />
      <text x="17" y="23" fill="#FFFFFF" class="font-sans" font-size="16" font-weight="800" text-anchor="middle">J</text>
      <text x="46" y="24" fill="#F8FAFC" class="font-sans" font-size="17" font-weight="800">J &amp; D RESERVE</text>
    </g>
    <g transform="translate(1080, 20)">
      <rect width="180" height="38" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <circle cx="22" cy="19" r="10" fill="#0284C7" />
      <text x="22" y="23" fill="#FFFFFF" class="font-sans" font-size="10" font-weight="700" text-anchor="middle">JD</text>
      <text x="42" y="24" fill="#F8FAFC" class="font-sans" font-size="12" font-weight="600">Juan Dela Cruz ▾</text>
    </g>
  </g>

  <g transform="translate(80, 105)">
    <text x="0" y="24" fill="#38BDF8" class="font-sans" font-size="12" font-weight="700" letter-spacing="2">GUEST EXPERIENCE HUB · MY BOOKINGS</text>
    <text x="0" y="58" fill="#F8FAFC" class="font-sans" font-size="28" font-weight="800">Mabuhay, Juan! Here is your upcoming stay.</text>
  </g>

  <!-- ACTIVE BOOKING VOUCHER CARD (Unit TEV Grand Villa) -->
  <g transform="translate(80, 190)">
    <rect width="1280" height="340" rx="20" fill="#0F172A" stroke="#0284C7" stroke-width="1.5" />
    
    <g transform="translate(40, 40)">
      <rect width="116" height="28" rx="6" fill="#10B981" fill-opacity="0.2" stroke="#10B981" stroke-width="1" />
      <text x="58" y="18" fill="#34D399" class="font-sans" font-size="11" font-weight="700" text-anchor="middle">CONFIRMED 🟢</text>
      
      <text x="0" y="65" fill="#F8FAFC" class="font-sans" font-size="26" font-weight="800">Unit TEV Grand Beachfront Villa</text>
      <text x="0" y="90" fill="#94A3B8" class="font-sans" font-size="14">Booking Reference: <tspan fill="#38BDF8" class="font-mono">JND-2026-8942</tspan> · Brgy. Patar, Bolinao</text>

      <g transform="translate(0, 120)">
        <rect width="160" height="64" rx="10" fill="#1E293B" />
        <text x="16" y="24" fill="#94A3B8" class="font-sans" font-size="10" font-weight="700">CHECK-IN</text>
        <text x="16" y="46" fill="#F8FAFC" class="font-sans" font-size="14" font-weight="700">Oct 12, 2026 (2PM)</text>

        <rect x="176" width="160" height="64" rx="10" fill="#1E293B" />
        <text x="192" y="24" fill="#94A3B8" class="font-sans" font-size="10" font-weight="700">CHECK-OUT</text>
        <text x="192" y="46" fill="#F8FAFC" class="font-sans" font-size="14" font-weight="700">Oct 14, 2026 (11AM)</text>

        <rect x="352" width="180" height="64" rx="10" fill="#1E293B" />
        <text x="368" y="24" fill="#94A3B8" class="font-sans" font-size="10" font-weight="700">PAID DEPOSIT (50%)</text>
        <text x="368" y="46" fill="#34D399" class="font-sans" font-size="14" font-weight="700">₱20,210.00 (GCash)</text>
      </g>

      <g transform="translate(0, 215)">
        <rect width="180" height="42" rx="8" fill="url(#grad-sky)" />
        <text x="90" y="26" fill="#FFFFFF" class="font-sans" font-size="13" font-weight="700" text-anchor="middle">Download PDF Voucher</text>

        <rect x="196" width="160" height="42" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
        <text x="276" y="26" fill="#E2E8F0" class="font-sans" font-size="13" font-weight="600" text-anchor="middle">View Check-in QR</text>

        <rect x="372" width="160" height="42" rx="8" fill="transparent" stroke="#EF4444" stroke-width="1" />
        <text x="452" y="26" fill="#F87171" class="font-sans" font-size="13" font-weight="600" text-anchor="middle">Cancel Booking</text>
      </g>
    </g>

    <g transform="translate(980, 40)">
      <rect width="240" height="260" rx="14" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <text x="120" y="32" fill="#38BDF8" class="font-sans" font-size="12" font-weight="700" text-anchor="middle">EXPRESS CHECK-IN QR</text>
      
      <rect x="35" y="50" width="170" height="170" rx="10" fill="#FFFFFF" />
      <rect x="50" y="65" width="40" height="40" fill="#0F172A" />
      <rect x="145" y="65" width="40" height="40" fill="#0F172A" />
      <rect x="50" y="160" width="40" height="40" fill="#0F172A" />
      <circle cx="120" cy="135" r="14" fill="#0284C7" />
      <text x="120" y="240" fill="#94A3B8" class="font-mono" font-size="10" text-anchor="middle">UNIT: TEV · JND-8942</text>
    </g>
  </g>

  <!-- KITCHEN & DINING PRE-ORDERS -->
  <g transform="translate(80, 570)">
    <text x="0" y="24" fill="#38BDF8" class="font-sans" font-size="12" font-weight="700" letter-spacing="2">RESORT DINING PRE-ORDERS</text>
    <text x="0" y="56" fill="#F8FAFC" class="font-sans" font-size="22" font-weight="700">Add Bolinao Specialties to Your Arrival</text>

    <g transform="translate(0, 80)">
      <rect width="400" height="180" rx="14" fill="#0F172A" stroke="#1E293B" stroke-width="1.2" />
      <g transform="translate(24, 24)">
        <text x="0" y="20" fill="#F8FAFC" class="font-sans" font-size="18" font-weight="700">Bolinao Grilled Bangus</text>
        <text x="0" y="44" fill="#94A3B8" class="font-sans" font-size="13">Fresh Dagupan/Bolinao milkfish with tomatoes &amp; onions.</text>
        <text x="0" y="90" fill="#34D399" class="font-sans" font-size="20" font-weight="800">₱450.00</text>
        
        <rect x="230" y="66" width="120" height="38" rx="8" fill="url(#grad-sky)" />
        <text x="290" y="90" fill="#FFFFFF" class="font-sans" font-size="12" font-weight="700" text-anchor="middle">+ Add to Stay</text>
      </g>
    </g>

    <g transform="translate(440, 80)">
      <rect width="400" height="180" rx="14" fill="#0F172A" stroke="#1E293B" stroke-width="1.2" />
      <g transform="translate(24, 24)">
        <text x="0" y="20" fill="#F8FAFC" class="font-sans" font-size="18" font-weight="700">Seafood Sinigang Platter</text>
        <text x="0" y="44" fill="#94A3B8" class="font-sans" font-size="13">Sour tamarind broth with wild shrimp, squid, and kangkong.</text>
        <text x="0" y="90" fill="#34D399" class="font-sans" font-size="20" font-weight="800">₱620.00</text>
        
        <rect x="230" y="66" width="120" height="38" rx="8" fill="url(#grad-sky)" />
        <text x="290" y="90" fill="#FFFFFF" class="font-sans" font-size="12" font-weight="700" text-anchor="middle">+ Add to Stay</text>
      </g>
    </g>

    <g transform="translate(880, 80)">
      <rect width="400" height="180" rx="14" fill="#0F172A" stroke="#1E293B" stroke-width="1.2" />
      <g transform="translate(24, 24)">
        <text x="0" y="20" fill="#F8FAFC" class="font-sans" font-size="18" font-weight="700">Tropical Breakfast Basket</text>
        <text x="0" y="44" fill="#94A3B8" class="font-sans" font-size="13">Garlic rice, longganisa, fried eggs, and fresh mangoes.</text>
        <text x="0" y="90" fill="#34D399" class="font-sans" font-size="20" font-weight="800">₱280.00</text>
        
        <rect x="230" y="66" width="120" height="38" rx="8" fill="url(#grad-sky)" />
        <text x="290" y="90" fill="#FFFFFF" class="font-sans" font-size="12" font-weight="700" text-anchor="middle">+ Add to Stay</text>
      </g>
    </g>
  </g>
`;

fs.writeFileSync(path.join(outDir, '04_guest_self_service_portal.svg'), wrapSvg(1440, 1024, portalContent, '04 - Guest Self-Service Portal (Unit TEV Voucher)'));
console.log('✓ Created 04_guest_self_service_portal.svg');

// -------------------------------------------------------------
// 6. FRONT DESK RECEPTIONIST MATRIX (05_front_desk_receptionist_matrix.svg)
// -------------------------------------------------------------
const deskContent = `
  <rect width="1440" height="1024" fill="#090D16" />

  <g transform="translate(0, 0)">
    <rect width="1440" height="68" fill="#0F172A" />
    <line x1="0" y1="68" x2="1440" y2="68" stroke="#1E293B" stroke-width="1" />
    <g transform="translate(80, 18)">
      <text x="0" y="22" fill="#38BDF8" class="font-sans" font-size="18" font-weight="800">J &amp; D FRONT DESK CONTROL</text>
      <text x="280" y="22" fill="#94A3B8" class="font-sans" font-size="12">· Receptionist Operations Matrix</text>
    </g>
    <g transform="translate(1080, 16)">
      <rect width="180" height="36" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <circle cx="20" cy="18" r="6" fill="#10B981" />
      <text x="36" y="22" fill="#E2E8F0" class="font-sans" font-size="12">Staff: Front Desk Lead</text>
    </g>
  </g>

  <g transform="translate(80, 95)">
    <text x="0" y="24" fill="#38BDF8" class="font-sans" font-size="12" font-weight="700" letter-spacing="2">REAL-TIME ROOM MATRIX</text>
    <text x="0" y="56" fill="#F8FAFC" class="font-sans" font-size="24" font-weight="800">Status &amp; Key Allocation (TEV, CAT, GEL, CATH)</text>

    <g transform="translate(680, 18)">
      <rect width="130" height="38" rx="8" fill="#10B981" fill-opacity="0.15" stroke="#10B981" stroke-width="1" />
      <text x="65" y="24" fill="#34D399" class="font-sans" font-size="12" font-weight="700" text-anchor="middle">1 Vacant Clean</text>

      <rect x="144" width="130" height="38" rx="8" fill="#0284C7" fill-opacity="0.15" stroke="#0284C7" stroke-width="1" />
      <text x="209" y="24" fill="#38BDF8" class="font-sans" font-size="12" font-weight="700" text-anchor="middle">2 Occupied</text>

      <rect x="288" width="130" height="38" rx="8" fill="#F59E0B" fill-opacity="0.15" stroke="#F59E0B" stroke-width="1" />
      <text x="353" y="24" fill="#FBBF24" class="font-sans" font-size="12" font-weight="700" text-anchor="middle">1 Turnover</text>

      <rect x="432" width="150" height="38" rx="8" fill="url(#grad-sky)" />
      <text x="507" y="24" fill="#FFFFFF" class="font-sans" font-size="12" font-weight="700" text-anchor="middle">+ 60s Fast Walk-in</text>
    </g>
  </g>

  <!-- 4 CANONICAL UNITS STATUS CARDS (TEV, CAT, GEL, CATH) -->
  <g transform="translate(80, 180)">
    <!-- Room TEV -->
    <rect width="300" height="180" rx="14" fill="#0F172A" stroke="#0284C7" stroke-width="1.5" />
    <g transform="translate(20, 24)">
      <text x="0" y="16" fill="#F8FAFC" class="font-sans" font-size="18" font-weight="800">Unit TEV · Grand Villa</text>
      <rect y="28" width="80" height="22" rx="4" fill="#0284C7" fill-opacity="0.2" />
      <text x="40" y="43" fill="#38BDF8" class="font-sans" font-size="10" font-weight="700" text-anchor="middle">OCCUPIED</text>
      
      <text x="0" y="76" fill="#94A3B8" class="font-sans" font-size="12">Guest: Juan Dela Cruz (40 pax)</text>
      <text x="0" y="96" fill="#94A3B8" class="font-sans" font-size="12">Stay: Oct 12 - 14 · Key #TEV-01</text>
      
      <rect y="112" width="120" height="28" rx="6" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <text x="60" y="130" fill="#E2E8F0" class="font-sans" font-size="11" font-weight="600" text-anchor="middle">View Guest Folio</text>
    </g>

    <!-- Room CAT -->
    <g transform="translate(326, 0)">
      <rect width="300" height="180" rx="14" fill="#0F172A" stroke="#10B981" stroke-width="1.5" />
      <g transform="translate(20, 24)">
        <text x="0" y="16" fill="#F8FAFC" class="font-sans" font-size="18" font-weight="800">Unit CAT · Cottage</text>
        <rect y="28" width="100" height="22" rx="4" fill="#10B981" fill-opacity="0.2" />
        <text x="50" y="43" fill="#34D399" class="font-sans" font-size="10" font-weight="700" text-anchor="middle">VACANT CLEAN</text>
        
        <text x="0" y="76" fill="#94A3B8" class="font-sans" font-size="12">Sanitized: 10:15 AM by Elena R.</text>
        <text x="0" y="96" fill="#94A3B8" class="font-sans" font-size="12">Ready for walk-in or guest check-in</text>
        
        <rect y="112" width="120" height="28" rx="6" fill="url(#grad-sky)" />
        <text x="60" y="130" fill="#FFFFFF" class="font-sans" font-size="11" font-weight="700" text-anchor="middle">Assign Walk-in</text>
      </g>
    </g>

    <!-- Room GEL -->
    <g transform="translate(652, 0)">
      <rect width="300" height="180" rx="14" fill="#0F172A" stroke="#F59E0B" stroke-width="1.5" />
      <g transform="translate(20, 24)">
        <text x="0" y="16" fill="#F8FAFC" class="font-sans" font-size="18" font-weight="800">Unit GEL · Premier</text>
        <rect y="28" width="112" height="22" rx="4" fill="#F59E0B" fill-opacity="0.2" />
        <text x="56" y="43" fill="#FBBF24" class="font-sans" font-size="10" font-weight="700" text-anchor="middle">HOUSEKEEPING</text>
        
        <text x="0" y="76" fill="#94A3B8" class="font-sans" font-size="12">Guest Departed: 11:00 AM</text>
        <text x="0" y="96" fill="#94A3B8" class="font-sans" font-size="12">Linen strip in progress (ETA 20m)</text>
        
        <rect y="112" width="120" height="28" rx="6" fill="#1E293B" stroke="#334155" stroke-width="1" />
        <text x="60" y="130" fill="#FBBF24" class="font-sans" font-size="11" font-weight="600" text-anchor="middle">Mark Clean ✓</text>
      </g>
    </g>

    <!-- Room CATH -->
    <g transform="translate(978, 0)">
      <rect width="300" height="180" rx="14" fill="#0F172A" stroke="#0284C7" stroke-width="1.5" />
      <g transform="translate(20, 24)">
        <text x="0" y="16" fill="#F8FAFC" class="font-sans" font-size="18" font-weight="800">Unit CATH · Veranda</text>
        <rect y="28" width="80" height="22" rx="4" fill="#0284C7" fill-opacity="0.2" />
        <text x="40" y="43" fill="#38BDF8" class="font-sans" font-size="10" font-weight="700" text-anchor="middle">OCCUPIED</text>
        
        <text x="0" y="76" fill="#94A3B8" class="font-sans" font-size="12">Guest: Roberto Silva (12 pax)</text>
        <text x="0" y="96" fill="#94A3B8" class="font-sans" font-size="12">Stay: Oct 11 - 13 · Key #CATH-01</text>
        
        <rect y="112" width="120" height="28" rx="6" fill="#1E293B" stroke="#334155" stroke-width="1" />
        <text x="60" y="130" fill="#E2E8F0" class="font-sans" font-size="11" font-weight="600" text-anchor="middle">View Guest Folio</text>
      </g>
    </g>
  </g>

  <!-- QUICK 60-SECOND WALK-IN DOCK -->
  <g transform="translate(80, 400)">
    <rect width="1280" height="540" rx="18" fill="#0F172A" stroke="#1E293B" stroke-width="1.5" />
    <g transform="translate(36, 32)">
      <text x="0" y="24" fill="#38BDF8" class="font-sans" font-size="12" font-weight="700" letter-spacing="2">FAST RECEPTION INGESTION</text>
      <text x="0" y="56" fill="#F8FAFC" class="font-sans" font-size="22" font-weight="800">Walk-In Guest Registration &amp; Physical Key Ingestion</text>

      <g transform="translate(0, 80)">
        <g>
          <text x="0" y="14" fill="#94A3B8" class="font-sans" font-size="12" font-weight="600">Walk-In Guest Full Name</text>
          <rect y="24" width="370" height="42" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
          <text x="14" y="50" fill="#F8FAFC" class="font-sans" font-size="13">Michael Tan</text>

          <text x="0" y="94" fill="#94A3B8" class="font-sans" font-size="12" font-weight="600">Contact Number</text>
          <rect y="104" width="370" height="42" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
          <text x="14" y="130" fill="#F8FAFC" class="font-sans" font-size="13">+63 918 222 3841</text>
        </g>

        <g transform="translate(410, 0)">
          <text x="0" y="14" fill="#94A3B8" class="font-sans" font-size="12" font-weight="600">Assigned Clean Unit (TEV, CAT, GEL, CATH)</text>
          <rect y="24" width="370" height="42" rx="8" fill="#1E293B" stroke="#0284C7" stroke-width="1.2" />
          <text x="14" y="50" fill="#38BDF8" class="font-sans" font-size="13" font-weight="700">Unit CAT Cottage (Unit Papang)</text>

          <text x="0" y="94" fill="#94A3B8" class="font-sans" font-size="12" font-weight="600">Number of Nights / Departure</text>
          <rect y="104" width="370" height="42" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
          <text x="14" y="130" fill="#F8FAFC" class="font-sans" font-size="13">1 Night · Departure: Tomorrow 11:00 AM</text>
        </g>

        <g transform="translate(820, 0)">
          <text x="0" y="14" fill="#94A3B8" class="font-sans" font-size="12" font-weight="600">Initial Downpayment Received</text>
          <rect y="24" width="370" height="42" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
          <text x="14" y="50" fill="#34D399" class="font-sans" font-size="14" font-weight="700">₱6,000.00 (Cash Settled)</text>

          <text x="0" y="94" fill="#94A3B8" class="font-sans" font-size="12" font-weight="600">Physical Key ID Issued</text>
          <rect y="104" width="370" height="42" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
          <text x="14" y="130" fill="#F8FAFC" class="font-sans" font-size="13">KEY-CAT-01</text>
        </g>
      </g>

      <g transform="translate(0, 260)">
        <rect width="240" height="48" rx="10" fill="url(#grad-sky)" />
        <text x="120" y="30" fill="#FFFFFF" class="font-sans" font-size="14" font-weight="700" text-anchor="middle">Execute Walk-in Check-in</text>

        <rect x="260" width="180" height="48" rx="10" fill="#1E293B" stroke="#334155" stroke-width="1" />
        <text x="350" y="30" fill="#94A3B8" class="font-sans" font-size="13" font-weight="600" text-anchor="middle">Print Guest Folio</text>
      </g>
    </g>
  </g>
`;

fs.writeFileSync(path.join(outDir, '05_front_desk_receptionist_matrix.svg'), wrapSvg(1440, 1024, deskContent, '05 - Front Desk Receptionist Matrix (TEV, CAT, GEL, CATH)'));
console.log('✓ Created 05_front_desk_receptionist_matrix.svg');

// -------------------------------------------------------------
// 7. EXECUTIVE ANALYTICS DASHBOARD (06_executive_analytics_dashboard.svg)
// -------------------------------------------------------------
const adminContent = `
  <rect width="1440" height="1100" fill="#0B132B" />

  <!-- Admin Sidebar -->
  <g transform="translate(0, 0)">
    <rect width="260" height="1100" fill="#0F172A" />
    <line x1="260" y1="0" x2="260" y2="1100" stroke="#1E293B" stroke-width="1" />
    
    <g transform="translate(24, 28)">
      <circle cx="16" cy="16" r="16" fill="url(#grad-sky)" />
      <text x="16" y="21" fill="#FFFFFF" class="font-sans" font-size="14" font-weight="800" text-anchor="middle">J</text>
      <text x="44" y="22" fill="#F8FAFC" class="font-sans" font-size="16" font-weight="800">J &amp; D ADMIN</text>
      <text x="144" y="22" fill="#38BDF8" class="font-mono" font-size="10">EXEC</text>
    </g>

    <g transform="translate(16, 90)">
      <rect width="228" height="40" rx="8" fill="#0284C7" />
      <text x="44" y="25" fill="#FFFFFF" class="font-sans" font-size="13" font-weight="700">📊 Overview Analytics</text>

      <rect y="48" width="228" height="40" rx="8" fill="transparent" />
      <text x="44" y="73" fill="#94A3B8" class="font-sans" font-size="13">🍳 Kitchen &amp; Dining BI</text>

      <rect y="96" width="228" height="40" rx="8" fill="transparent" />
      <text x="44" y="121" fill="#94A3B8" class="font-sans" font-size="13">📡 System Telemetry HUD</text>

      <rect y="144" width="228" height="40" rx="8" fill="transparent" />
      <text x="44" y="169" fill="#94A3B8" class="font-sans" font-size="13">👥 User &amp; Staff Roles</text>

      <rect y="192" width="228" height="40" rx="8" fill="transparent" />
      <text x="44" y="217" fill="#94A3B8" class="font-sans" font-size="13">📖 Ledger Ingestion</text>

      <rect y="240" width="228" height="40" rx="8" fill="transparent" />
      <text x="44" y="265" fill="#94A3B8" class="font-sans" font-size="13">📑 CSV Export / Import</text>

      <rect y="288" width="228" height="40" rx="8" fill="transparent" />
      <text x="44" y="313" fill="#94A3B8" class="font-sans" font-size="13">⚙️ Resort Settings</text>
    </g>

    <g transform="translate(20, 1020)">
      <rect width="220" height="42" rx="10" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <text x="36" y="26" fill="#F8FAFC" class="font-sans" font-size="12" font-weight="600">☀️ Executive White / Dark</text>
    </g>
  </g>

  <!-- Admin Main Content Area -->
  <g transform="translate(290, 0)">
    <rect width="1120" height="74" fill="#0B132B" />
    <line x1="0" y1="74" x2="1120" y2="74" stroke="#1E293B" stroke-width="1" />
    
    <text x="0" y="44" fill="#F8FAFC" class="font-sans" font-size="22" font-weight="800">Executive Business Intelligence &amp; Yield HUD</text>
    
    <g transform="translate(860, 20)">
      <rect width="180" height="36" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <text x="90" y="22" fill="#38BDF8" class="font-mono" font-size="11" font-weight="700" text-anchor="middle">Live DB Sync: 100%</text>
    </g>

    <!-- 4 EXECUTIVE KPI CARDS -->
    <g transform="translate(0, 100)">
      <rect width="260" height="120" rx="14" fill="#0F172A" stroke="#1E293B" stroke-width="1.2" />
      <g transform="translate(20, 24)">
        <text x="0" y="16" fill="#94A3B8" class="font-sans" font-size="11" font-weight="700" letter-spacing="1">OCCUPANCY RATE</text>
        <text x="0" y="52" fill="#F8FAFC" class="font-sans" font-size="28" font-weight="800">75.0%</text>
        <text x="0" y="74" fill="#34D399" class="font-sans" font-size="11" font-weight="700">3 of 4 Units Occupied (TEV, CAT, CATH)</text>
      </g>

      <g transform="translate(280, 0)">
        <rect width="260" height="120" rx="14" fill="#0F172A" stroke="#1E293B" stroke-width="1.2" />
        <g transform="translate(20, 24)">
          <text x="0" y="16" fill="#94A3B8" class="font-sans" font-size="11" font-weight="700" letter-spacing="1">AVERAGE DAILY RATE (ADR)</text>
          <text x="0" y="52" fill="#F8FAFC" class="font-sans" font-size="28" font-weight="800">₱10,833</text>
          <text x="0" y="74" fill="#38BDF8" class="font-sans" font-size="11" font-weight="700">Average of active bookings</text>
        </g>
      </g>

      <g transform="translate(560, 0)">
        <rect width="260" height="120" rx="14" fill="#0F172A" stroke="#1E293B" stroke-width="1.2" />
        <g transform="translate(20, 24)">
          <text x="0" y="16" fill="#94A3B8" class="font-sans" font-size="11" font-weight="700" letter-spacing="1">REVPAR YIELD</text>
          <text x="0" y="52" fill="#38BDF8" class="font-sans" font-size="28" font-weight="800">₱8,125</text>
          <text x="0" y="74" fill="#34D399" class="font-sans" font-size="11" font-weight="700">ADR × 75.0% Occupancy</text>
        </g>
      </g>

      <g transform="translate(840, 0)">
        <rect width="260" height="120" rx="14" fill="#0F172A" stroke="#1E293B" stroke-width="1.2" />
        <g transform="translate(20, 24)">
          <text x="0" y="16" fill="#94A3B8" class="font-sans" font-size="11" font-weight="700" letter-spacing="1">GROSS REVENUE (WTD)</text>
          <text x="0" y="52" fill="#34D399" class="font-sans" font-size="28" font-weight="800">₱482,500</text>
          <text x="0" y="74" fill="#94A3B8" class="font-sans" font-size="11">Dining: ₱94.2k · Rooms: ₱388.3k</text>
        </g>
      </g>
    </g>

    <!-- 7-DAY REVENUE DUAL SPLINE CHART -->
    <g transform="translate(0, 244)">
      <rect width="720" height="380" rx="16" fill="#0F172A" stroke="#1E293B" stroke-width="1.5" />
      <g transform="translate(24, 24)">
        <text x="0" y="20" fill="#F8FAFC" class="font-sans" font-size="16" font-weight="700">7-Day Revenue Trendline vs Dining Yield</text>
        <text x="0" y="40" fill="#94A3B8" class="font-sans" font-size="12">Dynamic Supabase aggregations from resort_orders &amp; reservations</text>
        
        <g transform="translate(20, 70)">
          <line x1="0" y1="40" x2="620" y2="40" stroke="#1E293B" stroke-width="1" />
          <line x1="0" y1="90" x2="620" y2="90" stroke="#1E293B" stroke-width="1" />
          <line x1="0" y1="140" x2="620" y2="140" stroke="#1E293B" stroke-width="1" />
          <line x1="0" y1="190" x2="620" y2="190" stroke="#1E293B" stroke-width="1" />

          <path d="M 0 160 Q 100 80, 200 120 T 400 60 T 620 30 L 620 210 L 0 210 Z" fill="#0284C7" fill-opacity="0.2" />
          <path d="M 0 160 Q 100 80, 200 120 T 400 60 T 620 30" fill="none" stroke="#38BDF8" stroke-width="3" />
          <path d="M 0 190 Q 100 160, 200 170 T 400 130 T 620 110" fill="none" stroke="#F59E0B" stroke-width="2" stroke-dasharray="4,4" />

          <circle cx="200" cy="120" r="5" fill="#38BDF8" />
          <circle cx="400" cy="60" r="5" fill="#38BDF8" />
          <circle cx="620" cy="30" r="6" fill="#34D399" />
          
          <rect x="520" y="0" width="110" height="24" rx="4" fill="#0284C7" />
          <text x="575" y="16" fill="#FFFFFF" class="font-sans" font-size="11" font-weight="700" text-anchor="middle">₱84,200 (Peak)</text>
        </g>
      </g>
    </g>

    <!-- DINING SALES LEADERBOARD -->
    <g transform="translate(744, 244)">
      <rect width="356" height="380" rx="16" fill="#0F172A" stroke="#1E293B" stroke-width="1.5" />
      <g transform="translate(24, 24)">
        <text x="0" y="20" fill="#F8FAFC" class="font-sans" font-size="16" font-weight="700">Top Bolinao Dishes</text>
        <text x="0" y="40" fill="#94A3B8" class="font-sans" font-size="12">Live dining revenue distribution</text>

        <g transform="translate(0, 60)">
          <text x="0" y="16" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="600">Bolinao Grilled Bangus</text>
          <text x="300" y="16" fill="#38BDF8" class="font-sans" font-size="12" font-weight="700" text-anchor="end">48 Orders</text>
          <rect y="24" width="300" height="8" rx="4" fill="#1E293B" />
          <rect y="24" width="250" height="8" rx="4" fill="#0284C7" />
        </g>

        <g transform="translate(0, 114)">
          <text x="0" y="16" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="600">Seafood Sinigang Platter</text>
          <text x="300" y="16" fill="#38BDF8" class="font-sans" font-size="12" font-weight="700" text-anchor="end">32 Orders</text>
          <rect y="24" width="300" height="8" rx="4" fill="#1E293B" />
          <rect y="24" width="180" height="8" rx="4" fill="#0EA5E9" />
        </g>

        <g transform="translate(0, 168)">
          <text x="0" y="16" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="600">Tropical Breakfast Baskets</text>
          <text x="300" y="16" fill="#38BDF8" class="font-sans" font-size="12" font-weight="700" text-anchor="end">28 Orders</text>
          <rect y="24" width="300" height="8" rx="4" fill="#1E293B" />
          <rect y="24" width="150" height="8" rx="4" fill="#10B981" />
        </g>

        <g transform="translate(0, 222)">
          <text x="0" y="16" fill="#F8FAFC" class="font-sans" font-size="13" font-weight="600">Fresh Buko Coconut Drinks</text>
          <text x="300" y="16" fill="#38BDF8" class="font-sans" font-size="12" font-weight="700" text-anchor="end">56 Orders</text>
          <rect y="24" width="300" height="8" rx="4" fill="#1E293B" />
          <rect y="24" width="280" height="8" rx="4" fill="#F59E0B" />
        </g>
      </g>
    </g>

    <!-- SYSTEM TELEMETRY HUD BAR -->
    <g transform="translate(0, 646)">
      <rect width="1100" height="110" rx="16" fill="#0F172A" stroke="#1E293B" stroke-width="1.5" />
      <g transform="translate(32, 28)">
        <text x="0" y="20" fill="#38BDF8" class="font-sans" font-size="12" font-weight="700" letter-spacing="2">REAL-TIME CLOUD TELEMETRY</text>
        <text x="0" y="48" fill="#F8FAFC" class="font-sans" font-size="16" font-weight="800">Supabase DB Latency: 16ms · Memory: 4.2MB · HTTP 200 OK</text>

        <g transform="translate(680, 8)">
          <rect width="180" height="42" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
          <text x="24" y="26" fill="#34D399" class="font-mono" font-size="12">WS Sockets: 14 Active</text>

          <rect x="196" width="180" height="42" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
          <text x="220" y="26" fill="#38BDF8" class="font-mono" font-size="12">PostgreSQL: 4/20 Pool</text>
        </g>
      </g>
    </g>
  </g>
`;

fs.writeFileSync(path.join(outDir, '06_executive_analytics_dashboard.svg'), wrapSvg(1440, 1100, adminContent, '06 - Executive Analytics Dashboard (4 Units)'));
console.log('✓ Created 06_executive_analytics_dashboard.svg');

// -------------------------------------------------------------
// 8. AMBIENT AI CONCIERGE WIDGET (07_ambient_ai_concierge_widget.svg)
// -------------------------------------------------------------
// POLISHED GRAMMAR, SPELLING, AND CLEAR CANONICAL ROOM RESPONSES
const botContent = `
  <rect width="1440" height="1024" fill="#0A0F1D" fill-opacity="0.75" />

  <!-- FLOATING CONCIERGE CHAT DRAWER -->
  <g transform="translate(960, 240)" filter="url(#shadow-modal)">
    <rect width="400" height="680" rx="20" fill="#0F172A" stroke="#0284C7" stroke-width="1.5" />
    
    <!-- Chat Header -->
    <g transform="translate(0, 0)">
      <path d="M 0 20 Q 0 0, 20 0 L 380 0 Q 400 0, 400 20 L 400 74 L 0 74 Z" fill="url(#grad-sky)" />
      
      <circle cx="40" cy="37" r="18" fill="#FFFFFF" />
      <text x="40" y="44" fill="#0284C7" class="font-sans" font-size="18" font-weight="800" text-anchor="middle">🤖</text>
      
      <text x="70" y="32" fill="#FFFFFF" class="font-sans" font-size="15" font-weight="800">J &amp; D AI Concierge</text>
      <text x="70" y="50" fill="rgba(255,255,255,0.85)" class="font-sans" font-size="11">● Online · Patar Beachfront Assistant</text>

      <circle cx="365" cy="37" r="14" fill="rgba(0,0,0,0.2)" />
      <text x="365" y="42" fill="#FFFFFF" class="font-sans" font-size="14" font-weight="700" text-anchor="middle">✕</text>
    </g>

    <!-- Message Bubble Stream with Perfect English & Room Roster -->
    <g transform="translate(20, 95)">
      <!-- Bot Intro Bubble -->
      <g>
        <rect width="320" height="74" rx="14" fill="#1E293B" stroke="#334155" stroke-width="1" />
        <text x="16" y="24" fill="#F8FAFC" class="font-sans" font-size="12" font-weight="500">Mabuhay! Welcome to J &amp; D Beach House.</text>
        <text x="16" y="44" fill="#F8FAFC" class="font-sans" font-size="12">How may I assist you with your booking today?</text>
        <text x="16" y="62" fill="#64748B" class="font-mono" font-size="10">11:42 AM · Concierge Assistant</text>
      </g>

      <!-- User Inquiry Bubble -->
      <g transform="translate(70, 90)">
        <rect width="290" height="54" rx="14" fill="#0284C7" />
        <text x="16" y="24" fill="#FFFFFF" class="font-sans" font-size="12" font-weight="500">Do you have beachfront rooms available</text>
        <text x="16" y="42" fill="#FFFFFF" class="font-sans" font-size="12">for this upcoming weekend?</text>
      </g>

      <!-- Bot AI Response Bubble (Reflects TEV, CAT, GEL, CATH) -->
      <g transform="translate(0, 160)">
        <rect width="330" height="150" rx="14" fill="#1E293B" stroke="#0284C7" stroke-width="1.2" />
        <text x="16" y="24" fill="#38BDF8" class="font-sans" font-size="12" font-weight="700">Unit TEV and Unit CAT are available!</text>
        <text x="16" y="46" fill="#F8FAFC" class="font-sans" font-size="12">· Unit TEV Grand Villa: ₱18,000 /night (up to 60 pax)</text>
        <text x="16" y="68" fill="#F8FAFC" class="font-sans" font-size="12">· Unit CAT Beach Cottage: ₱6,000 /night (up to 10 pax)</text>
        <text x="16" y="90" fill="#F8FAFC" class="font-sans" font-size="12">Would you like me to reserve one for you?</text>

        <rect x="16" y="104" width="130" height="32" rx="6" fill="#0284C7" />
        <text x="81" y="124" fill="#FFFFFF" class="font-sans" font-size="11" font-weight="700" text-anchor="middle">Reserve Unit TEV</text>
        
        <text x="160" y="124" fill="#64748B" class="font-mono" font-size="10">11:43 AM · Verified</text>
      </g>
    </g>

    <!-- Quick Suggestion Action Chips -->
    <g transform="translate(20, 520)">
      <rect width="170" height="30" rx="15" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <text x="85" y="19" fill="#38BDF8" class="font-sans" font-size="11" font-weight="600" text-anchor="middle">⚡ Lighthouse Directions</text>

      <rect x="180" width="170" height="30" rx="15" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <text x="265" y="19" fill="#38BDF8" class="font-sans" font-size="11" font-weight="600" text-anchor="middle">🐟 Grilled Bangus Menu</text>

      <rect y="38" width="160" height="30" rx="15" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <text x="80" y="57" fill="#38BDF8" class="font-sans" font-size="11" font-weight="600" text-anchor="middle">💳 Payment &amp; GCash QR</text>

      <rect x="170" y="38" width="180" height="30" rx="15" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <text x="260" y="57" fill="#38BDF8" class="font-sans" font-size="11" font-weight="600" text-anchor="middle">🕒 Check-in &amp; Check-out</text>
    </g>

    <!-- Input Footer Bar -->
    <g transform="translate(20, 606)">
      <rect width="360" height="50" rx="12" fill="#090D16" stroke="#334155" stroke-width="1.2" />
      <text x="16" y="30" fill="#E2E8F0" class="font-sans" font-size="13">What time is check-out tomorrow?</text>
      <rect x="238" y="16" width="2" height="18" fill="#38BDF8" />
      
      <rect x="306" y="8" width="46" height="34" rx="8" fill="url(#grad-sky)" />
      <text x="329" y="30" fill="#FFFFFF" class="font-sans" font-size="16" font-weight="800" text-anchor="middle">→</text>
    </g>
  </g>

  <!-- Persistent Floating Trigger Button -->
  <g transform="translate(1310, 890)" filter="url(#shadow-soft)">
    <circle cx="36" cy="36" r="36" fill="url(#grad-sky)" />
    <circle cx="36" cy="36" r="44" fill="none" stroke="#38BDF8" stroke-width="2" stroke-dasharray="4,4" opacity="0.6" />
    <text x="36" y="44" fill="#FFFFFF" class="font-sans" font-size="28" font-weight="800" text-anchor="middle">💬</text>
  </g>
`;

fs.writeFileSync(path.join(outDir, '07_ambient_ai_concierge_widget.svg'), wrapSvg(1440, 1024, botContent, '07 - Ambient AI Concierge Widget (Flawless Grammar)'));
console.log('✓ Created 07_ambient_ai_concierge_widget.svg');

// -------------------------------------------------------------
// 9. MASTER FIGMA BOARD (master_figma_prototype_board.svg)
// -------------------------------------------------------------
// Streamlined to exactly the 3 core screens side-by-side:
// 1. Guest Landing & Accommodations Discovery
// 2. Booking & Nodemailer OTP Checkout Modal
// 3. Front Desk Receptionist Status Matrix
// + Ambient AI Concierge Widget
// Room names completely removed from project title header
const masterBoardContent = `
  <rect width="4000" height="1750" fill="#060911" />
  
  <pattern id="master-grid" width="60" height="60" patternUnits="userSpaceOnUse">
    <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#131D31" stroke-width="1" />
  </pattern>
  <rect width="4000" height="1750" fill="url(#master-grid)" />

  <!-- Clean Title Block (Zero Room Names in Title) -->
  <g transform="translate(120, 70)">
    <rect width="3760" height="130" rx="20" fill="#0F172A" stroke="#1E293B" stroke-width="2" />
    <text x="48" y="52" fill="#38BDF8" class="font-sans" font-size="14" font-weight="800" letter-spacing="3">FIGMA MID-FIDELITY ARCHITECTURAL PROTOTYPE</text>
    <text x="48" y="96" fill="#F8FAFC" class="font-sans" font-size="34" font-weight="800">J &amp; D Beach House · Web-Based Reservation and Booking Management System</text>
    <text x="2720" y="78" fill="#94A3B8" class="font-mono" font-size="14">3 Core Production Screens · Verified Roster: TEV, CAT, GEL, CATH · AI Concierge</text>
  </g>

  <!-- 3 Primary Screens Side-by-Side -->
  <g transform="translate(120, 240)">
    <!-- Screen 1: Guest Landing Experience -->
    <g transform="scale(0.8)">
      <rect x="-6" y="-50" width="460" height="38" rx="8" fill="#0284C7" />
      <text x="14" y="-26" fill="#FFFFFF" class="font-mono" font-size="15" font-weight="800">SCREEN 01 · GUEST DISCOVERY &amp; ROOMS</text>
      ${landingContent}
    </g>

    <!-- Screen 2: Booking & Nodemailer OTP Checkout -->
    <g transform="translate(1280, 0) scale(0.8)">
      <rect x="-6" y="-50" width="470" height="38" rx="8" fill="#0284C7" />
      <text x="14" y="-26" fill="#FFFFFF" class="font-mono" font-size="15" font-weight="800">SCREEN 02 · BOOKING &amp; OTP CHECKOUT</text>
      ${checkoutContent}
    </g>

    <!-- Screen 3: Front Desk Receptionist Status Matrix -->
    <g transform="translate(2560, 0) scale(0.8)">
      <rect x="-6" y="-50" width="480" height="38" rx="8" fill="#0284C7" />
      <text x="14" y="-26" fill="#FFFFFF" class="font-mono" font-size="15" font-weight="800">SCREEN 03 · FRONT DESK STATUS MATRIX</text>
      ${deskContent}
    </g>
  </g>

  <!-- Floating Ambient AI Concierge Widget (Docked in Lower Right of Board) -->
  <g transform="translate(3520, 1020) scale(0.72)" filter="url(#shadow-modal)">
    ${botContent}
  </g>
`;

fs.writeFileSync(path.join(outDir, 'master_figma_prototype_board.svg'), wrapSvg(4000, 1750, masterBoardContent, 'Master Figma Prototype Board - J & D Beach House (3 Core Screens)'));
console.log('✓ Created master_figma_prototype_board.svg (Streamlined 3-Screen Edition)');
console.log('✓ Created master_figma_prototype_board.svg');

console.log('\n🎉 Successfully updated all Figma Mid-Fidelity Vector Frames in:', outDir);
