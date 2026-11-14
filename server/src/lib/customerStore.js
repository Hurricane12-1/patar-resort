import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPassword, verifyPassword } from './passwords.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbDir = path.resolve(__dirname, '../db');
const customersFile = path.join(dbDir, 'customers.json');

// Ensure db directory exists
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch {}
}

let inMemoryCustomers = [];

function loadCustomers() {
  try {
    if (fs.existsSync(customersFile)) {
      const raw = fs.readFileSync(customersFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        inMemoryCustomers = parsed;
      }
    }
  } catch (err) {
    console.warn('[CustomerStore] Load notice:', err.message);
  }
}

function saveCustomers() {
  try {
    fs.writeFileSync(customersFile, JSON.stringify(inMemoryCustomers, null, 2), 'utf8');
  } catch (err) {
    console.warn('[CustomerStore] Save notice:', err.message);
  }
}

// Initial load
loadCustomers();

export function findCustomerByEmail(email) {
  if (!email) return null;
  const clean = email.trim().toLowerCase();
  loadCustomers();
  return inMemoryCustomers.find(c => c.email && c.email.toLowerCase() === clean) || null;
}

export function findCustomerById(id) {
  if (!id) return null;
  loadCustomers();
  return inMemoryCustomers.find(c => c.id === id) || null;
}

export function saveCustomer(cust) {
  if (!cust || !cust.email) return null;
  loadCustomers();
  const cleanEmail = cust.email.trim().toLowerCase();
  const idx = inMemoryCustomers.findIndex(c => c.email && c.email.toLowerCase() === cleanEmail);

  const record = {
    id: cust.id || crypto.randomUUID(),
    email: cleanEmail,
    password: cust.password ? (cust.password.startsWith('$2') || cust.password.startsWith('pbkdf2$') || cust.password.startsWith('sha256$') ? cust.password : hashPassword(cust.password)) : '',
    full_name: cust.full_name || [cust.first_name, cust.last_name].filter(Boolean).join(' ') || cleanEmail.split('@')[0],
    first_name: cust.first_name || '',
    last_name: cust.last_name || '',
    phone: cust.phone || '',
    role: 'customer',
    position: 'Resident Guest',
    is_verified: true,
    has_password: true,
    created_at: cust.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (idx >= 0) {
    inMemoryCustomers[idx] = { ...inMemoryCustomers[idx], ...record };
  } else {
    inMemoryCustomers.push(record);
  }

  saveCustomers();
  return record;
}

export function verifyCustomerCredentials(emailOrIdentifier, password) {
  if (!emailOrIdentifier || !password) return null;
  const target = (emailOrIdentifier || '').trim().toLowerCase();
  loadCustomers();

  const customer = inMemoryCustomers.find(c => 
    (c.email && c.email.toLowerCase() === target) ||
    (c.phone && c.phone === target) ||
    (c.full_name && c.full_name.toLowerCase() === target)
  );

  if (!customer || !customer.password) return null;

  const valid = verifyPassword(password, customer.password);
  if (valid) {
    return customer;
  }
  return null;
}
