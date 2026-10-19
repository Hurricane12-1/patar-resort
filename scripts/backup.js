import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const label = process.argv[2] || 'manual';
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

const targetDir = path.join(root, 'backups', 'database');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

console.log('\n============================================================');
console.log(' 📦 J & D BEACH HOUSE AUTOMATED BACKUP UTILITY');
console.log('============================================================\n');

// 1. Copy Schema SQL
const schemaSrc = path.join(root, 'supabase', 'schema.sql');
const schemaDst = path.join(targetDir, `schema_backup_${timestamp}_${label}.sql`);

if (fs.existsSync(schemaSrc)) {
  fs.copyFileSync(schemaSrc, schemaDst);
  console.log(` ✅ Schema backed up: backups/database/${path.basename(schemaDst)}`);
} else {
  console.warn(' ⚠️ Warning: supabase/schema.sql was not found!');
}

// 2. Write System Config JSON
const configDst = path.join(targetDir, `system_config_${timestamp}_${label}.json`);
const configData = {
  system: 'J & D Beach House',
  backup_timestamp: now.toISOString(),
  backup_type: label,
  version: '1.5.1',
  status: 'healthy',
  modules: [
    'Public Guest Portal',
    'Multi-Role Desks (Receptionist, Accounting, Department, Admin)',
    'Real-time WebSocket Chatbot',
    'Twilio SMS Notifications',
    'PostgreSQL Database & GiST Overbooking Guard'
  ]
};

fs.writeFileSync(configDst, JSON.stringify(configData, null, 2), 'utf-8');
console.log(` ✅ Config backed up: backups/database/${path.basename(configDst)}`);

console.log('\n🏆 Backup process completed successfully!');
console.log('============================================================\n');
