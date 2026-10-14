import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { admin } from '../server/src/lib/supabase.js';
import { isSupabaseConfigured } from '../server/src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Standard Existing Schema Hierarchy Model
const CANONICAL_HIERARCHY = {
  tier0: {
    name: 'Tier 0 · Core PostgreSQL & Auth Identity',
    nodes: [
      { id: 'auth.users', type: 'system', desc: 'Supabase GoTrue Auth Identity Core (UUID PK, email, raw_user_meta_data)' },
      { id: 'user_role', type: 'enum', desc: "ENUM ('customer','staff','receptionist','accounting','administrator','admin')" },
      { id: 'stay_status', type: 'enum', desc: "ENUM ('pending','confirmed','checked_in','checked_out','cancelled','no_show')" },
      { id: 'dept_name', type: 'enum', desc: "ENUM ('front_desk','housekeeping','kitchen','tours','maintenance')" },
      { id: 'order_status', type: 'enum', desc: "ENUM ('placed','preparing','delivering','delivered','cancelled')" },
      { id: 'task_status', type: 'enum', desc: "ENUM ('pending','in_progress','completed','cancelled')" },
      { id: 'task_priority', type: 'enum', desc: "ENUM ('low','normal','high','urgent')" },
    ],
  },
  tier1: {
    name: 'Tier 1 · Catalogs & Physical Inventory',
    nodes: [
      { id: 'rooms', table: 'rooms', pk: 'id', desc: 'Room Inventory, slug, rates, units, GiST exclusion anchor' },
      { id: 'resort_inventory', table: 'resort_inventory', pk: 'id', desc: 'Resort Inventory tracking & category reorder thresholds' },
      { id: 'resort_services', table: 'resort_services', pk: 'id', desc: 'Services catalog (dining, amenities, tours)' },
    ],
  },
  tier2: {
    name: 'Tier 2 · Profile Identity Linkage',
    nodes: [
      {
        id: 'profiles',
        table: 'profiles',
        pk: 'id',
        fk: [{ column: 'id', target: 'auth.users(id)', on_delete: 'CASCADE' }],
        desc: 'Public user profile (first_name, last_name, full_name, role, phone, address, city)',
        trigger: 'handle_new_user() on auth.users',
      },
    ],
  },
  tier3: {
    name: 'Tier 3 · Relational Transactions & Operations',
    nodes: [
      {
        id: 'reservations',
        table: 'reservations',
        pk: 'id',
        fk: [
          { column: 'guest_id', target: 'profiles(id)', on_delete: 'CASCADE' },
          { column: 'room_id', target: 'rooms(id)', on_delete: 'RESTRICT' },
        ],
        constraints: ['no_overbooking (EXCLUDE USING gist room_id WITH =, daterange WITH &&)'],
        desc: 'Booking transactions, check_in/out, payment_status, total_php',
      },
      {
        id: 'resort_orders',
        table: 'resort_orders',
        pk: 'id',
        fk: [{ column: 'guest_id', target: 'profiles(id)', on_delete: 'CASCADE' }],
        desc: 'Guest room/resort service orders (dining, tours, amenities)',
      },
      {
        id: 'department_tasks',
        table: 'department_tasks',
        pk: 'id',
        fk: [
          { column: 'created_by', target: 'profiles(id)', on_delete: 'SET NULL' },
          { column: 'room_id', target: 'rooms(id)', on_delete: 'SET NULL' },
        ],
        desc: 'Inter-departmental operational task log',
      },
    ],
  },
  tier4: {
    name: 'Tier 4 · Leaf Logs & Interactions',
    nodes: [
      {
        id: 'reviews',
        table: 'reviews',
        pk: 'id',
        fk: [
          { column: 'reservation_id', target: 'reservations(id)', on_delete: 'CASCADE' },
          { column: 'guest_id', target: 'profiles(id)', on_delete: 'CASCADE' },
          { column: 'room_id', target: 'rooms(id)', on_delete: 'CASCADE' },
        ],
        desc: 'Guest post-checkout ratings and reviews (triggers sync_room_rating)',
      },
      {
        id: 'chat_messages',
        table: 'chat_messages',
        pk: 'id',
        fk: [{ column: 'profile_id', target: 'profiles(id)', on_delete: 'CASCADE' }],
        desc: 'AI Concierge & executive guest dialogue thread',
      },
      {
        id: 'notifications',
        table: 'notifications',
        pk: 'id',
        fk: [
          { column: 'profile_id', target: 'profiles(id)', on_delete: 'CASCADE' },
          { column: 'reservation_id', target: 'reservations(id)', on_delete: 'CASCADE' },
        ],
        desc: 'SMS and email dispatch audit log',
      },
    ],
  },
  tier5: {
    name: 'Tier 5 · Analytical Materialized / Dynamic Views',
    nodes: [
      { id: 'analytics_overview', desc: 'Real-time KPIs: arrivals, departures, occupancy_pct, revenue_week_php' },
      { id: 'analytics_daily', desc: '14-day trailing and 7-day forecast occupancy & night revenue series' },
      { id: 'analytics_top_rooms', desc: 'Top performing accommodations by total revenue & stay count' },
    ],
  },
};

/**
 * Parse an SQL file and extract its schema objects
 */
function parseSqlFile(content) {
  const tables = {};
  const enums = {};
  const triggers = [];
  const foreignKeys = [];

  // 1. Extract Enums
  const enumRegex = /create\s+type\s+([a-zA-Z0-9_]+)\s+as\s+enum\s*\(([^)]+)\);/gi;
  let match;
  while ((match = enumRegex.exec(content)) !== null) {
    const enumName = match[1].toLowerCase();
    const values = match[2].split(',').map((v) => v.trim().replace(/^'|'$/g, ''));
    enums[enumName] = values;
  }

  // 2. Extract Tables and Columns
  const tableRegex = /create\s+table(?:\s+if\s+not\s+exists)?\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\n\);/gi;
  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1].toLowerCase();
    const body = match[2];
    const columns = [];
    const constraints = [];

    const lines = body.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('--'));
    for (const line of lines) {
      if (/^(?:constraint|primary\s+key|foreign\s+key|check|unique|exclude)\b/i.test(line)) {
        constraints.push(line);
      } else {
        const colMatch = line.match(/^([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_()]+)/i);
        if (colMatch) {
          columns.push({
            name: colMatch[1].toLowerCase(),
            type: colMatch[2].toLowerCase(),
            raw: line,
          });
        }
      }

      // Check inline references
      const fkMatch = line.match(/([a-zA-Z0-9_]+)\s+[^,]+references\s+(?:public\.)?([a-zA-Z0-9_.]+)\s*\(([a-zA-Z0-9_]+)\)(?:\s+on\s+delete\s+([a-zA-Z0-9_ ]+))?/i);
      if (fkMatch) {
        foreignKeys.push({
          sourceTable: tableName,
          sourceColumn: fkMatch[1].toLowerCase(),
          targetTable: fkMatch[2].toLowerCase(),
          targetColumn: fkMatch[3].toLowerCase(),
          onDelete: (fkMatch[4] || 'NO ACTION').trim().toUpperCase(),
        });
      }
    }

    tables[tableName] = { columns, constraints };
  }

  // 3. Extract Triggers
  const trgRegex = /create\s+trigger\s+([a-zA-Z0-9_]+)\s+(after|before)\s+(insert|update|delete)\s+on\s+([a-zA-Z0-9_.]+)\s+for\s+each\s+row\s+execute\s+(?:function|procedure)\s+([a-zA-Z0-9_]+)\(\);/gi;
  while ((match = trgRegex.exec(content)) !== null) {
    triggers.push({
      name: match[1],
      timing: match[2].toUpperCase(),
      event: match[3].toUpperCase(),
      table: match[4].toLowerCase(),
      function: match[5],
    });
  }

  return { tables, enums, triggers, foreignKeys };
}

/**
 * Main Inspector
 */
async function main() {
  const targetSqlPath = process.argv[2];

  console.log('\n========================================================================================');
  console.log(' 🛡️ J & D BEACH HOUSE · SUPABASE SCHEMA HIERARCHY & COMPATIBILITY CHECKER 🛡️');
  console.log('========================================================================================\n');

  console.log('📌 CANONICAL EXISTING DATABASE HIERARCHY:');
  for (const [tierKey, tier] of Object.entries(CANONICAL_HIERARCHY)) {
    console.log(`\n  [${tier.name}]`);
    for (const node of tier.nodes) {
      const fkInfo = node.fk ? ` ➔ FK: ${node.fk.map((f) => `${f.column} -> ${f.target} [${f.on_delete}]`).join(', ')}` : '';
      console.log(`    • ${node.id.padEnd(20)}: ${node.desc}${fkInfo}`);
    }
  }

  // Live Supabase Connectivity Check
  console.log('\n----------------------------------------------------------------------------------------');
  console.log('📡 LIVE SUPABASE CLOUD AUDIT:');
  if (!isSupabaseConfigured) {
    console.log('  ⚠️ Supabase environment not fully configured in current session. Operating in offline inspection mode.');
  } else {
    const liveTables = [
      'profiles', 'rooms', 'reservations', 'reviews', 'notifications',
      'chat_messages', 'department_tasks', 'resort_orders', 'resort_inventory',
      'resort_services', 'analytics_overview'
    ];

    for (const tbl of liveTables) {
      try {
        const { count, error } = await admin.from(tbl).select('*', { count: 'exact', head: true });
        if (error) {
          console.log(`  ❌ [LIVE TABLE] ${tbl.padEnd(20)}: Error (${error.message})`);
        } else {
          console.log(`  ✅ [LIVE TABLE] ${tbl.padEnd(20)}: Healthy & Online (${count ?? 0} records)`);
        }
      } catch (err) {
        console.log(`  ⚠️ [LIVE TABLE] ${tbl.padEnd(20)}: Could not verify (${err.message})`);
      }
    }
  }

  // If user passed a file to check
  if (targetSqlPath) {
    const resolvedPath = path.resolve(process.cwd(), targetSqlPath);
    console.log('\n----------------------------------------------------------------------------------------');
    console.log(`🔎 AUDITING TARGET SQL FILE: "${resolvedPath}"`);
    console.log('----------------------------------------------------------------------------------------');

    if (!fs.existsSync(resolvedPath)) {
      console.error(`❌ Error: File not found at "${resolvedPath}". Please check the path and try again.`);
      process.exit(1);
    }

    const sqlContent = fs.readFileSync(resolvedPath, 'utf8');
    const parsed = parseSqlFile(sqlContent);

    console.log(`\n  📊 Extracted Objects:`);
    console.log(`     - Tables found:       ${Object.keys(parsed.tables).length} (${Object.keys(parsed.tables).join(', ') || 'none'})`);
    console.log(`     - Enums found:        ${Object.keys(parsed.enums).length} (${Object.keys(parsed.enums).join(', ') || 'none'})`);
    console.log(`     - Foreign Keys found: ${parsed.foreignKeys.length}`);
    console.log(`     - Triggers found:     ${parsed.triggers.length}`);

    console.log('\n  🧪 HIERARCHICAL COMPATIBILITY AUDIT:');
    let issuesFound = 0;

    // Check 1: profiles table connection to auth.users
    const profFk = parsed.foreignKeys.find((fk) => fk.sourceTable === 'profiles' && fk.targetTable.includes('auth.users'));
    if (parsed.tables['profiles']) {
      if (profFk) {
        console.log(`     ✅ [OK] profiles.id correctly references auth.users(id) [ON DELETE ${profFk.onDelete}]`);
      } else {
        console.log(`     ⚠️ [WARNING] profiles table is defined, but explicit FK references to auth.users(id) not detected in CREATE TABLE.`);
        issuesFound++;
      }

      // Check required name columns
      const profCols = parsed.tables['profiles'].columns.map((c) => c.name);
      const reqNames = ['first_name', 'last_name', 'full_name', 'role'];
      for (const req of reqNames) {
        if (profCols.includes(req)) {
          console.log(`     ✅ [OK] profiles contains mandatory column: "${req}"`);
        } else {
          console.log(`     ❌ [ERROR] profiles is missing mandatory column: "${req}" (Required for guest manifest & 2FA sync!)`);
          issuesFound++;
        }
      }
    }

    // Check 2: reservations table foreign key connections
    if (parsed.tables['reservations']) {
      const resGuestFk = parsed.foreignKeys.find((fk) => fk.sourceTable === 'reservations' && fk.sourceColumn === 'guest_id');
      const resRoomFk = parsed.foreignKeys.find((fk) => fk.sourceTable === 'reservations' && fk.sourceColumn === 'room_id');

      if (resGuestFk && resGuestFk.targetTable.includes('profiles')) {
        console.log(`     ✅ [OK] reservations.guest_id references profiles(id) [ON DELETE ${resGuestFk.onDelete}]`);
      } else {
        console.log(`     ⚠️ [WARNING] reservations.guest_id does not reference profiles(id) correctly.`);
        issuesFound++;
      }

      if (resRoomFk && resRoomFk.targetTable.includes('rooms')) {
        console.log(`     ✅ [OK] reservations.room_id references rooms(id)`);
      } else {
        console.log(`     ⚠️ [WARNING] reservations.room_id does not reference rooms(id).`);
        issuesFound++;
      }
    }

    // Check 3: handle_new_user trigger
    const newUserTrg = parsed.triggers.find((t) => t.table.includes('auth.users') || t.function.includes('handle_new_user'));
    if (newUserTrg) {
      console.log(`     ✅ [OK] handle_new_user() trigger detected on auth.users`);
    } else {
      console.log(`     ℹ️ [NOTE] on_auth_user_created trigger on auth.users not declared in this file (may already exist in database).`);
    }

    console.log('\n----------------------------------------------------------------------------------------');
    if (issuesFound === 0) {
      console.log(' 🏆 VERIFICATION PASSED: The provided SQL file is fully compatible with the schema hierarchy! 🟢');
    } else {
      console.log(` ⚠️ VERIFICATION WARNING: ${issuesFound} potential structural compatibility issue(s) detected. Please review above. 🟡`);
    }
  } else {
    console.log('\n💡 TIP: Run with your SQL file to perform an automated hierarchical check:');
    console.log('   node scripts/inspect_schema_hierarchy.js <path-to-your-file.sql>');
  }

  console.log('========================================================================================\n');
}

main().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
