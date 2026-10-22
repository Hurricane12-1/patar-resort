import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { memoryStore } from '../agents/ledgerIngestionAgent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbDir = path.resolve(__dirname, '../db');
const reservationsFile = path.join(dbDir, 'reservations.json');

// Ensure db directory exists
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch {}
}

let inMemoryReservations = [];

function loadPersistedReservations() {
  try {
    if (fs.existsSync(reservationsFile)) {
      const raw = fs.readFileSync(reservationsFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        inMemoryReservations = parsed;
        // Sync with agent memoryStore
        if (memoryStore && Array.isArray(memoryStore.reservations)) {
          for (const res of parsed) {
            if (!memoryStore.reservations.some((m) => m.id === res.id)) {
              memoryStore.reservations.push(res);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[ReservationStore] Failed to load local reservations:', err.message);
  }
}

function savePersistedReservations() {
  try {
    fs.writeFileSync(reservationsFile, JSON.stringify(inMemoryReservations, null, 2), 'utf8');
  } catch (err) {
    console.warn('[ReservationStore] Failed to save local reservations:', err.message);
  }
}

// Initial load
loadPersistedReservations();

export function getLocalReservations() {
  return inMemoryReservations;
}

export function addLocalReservation(res) {
  const normalized = {
    ...res,
    email: res.email || res.guest_email || '',
    guest_email: res.guest_email || res.email || '',
    created_at: res.created_at || new Date().toISOString(),
    updated_at: res.updated_at || new Date().toISOString(),
  };

  const existingIdx = inMemoryReservations.findIndex((r) => r.id === normalized.id);
  if (existingIdx >= 0) {
    inMemoryReservations[existingIdx] = normalized;
  } else {
    inMemoryReservations.unshift(normalized);
  }

  // Also sync with memoryStore
  if (memoryStore && Array.isArray(memoryStore.reservations)) {
    const memIdx = memoryStore.reservations.findIndex((r) => r.id === normalized.id);
    if (memIdx >= 0) {
      memoryStore.reservations[memIdx] = normalized;
    } else {
      memoryStore.reservations.unshift(normalized);
    }
  }

  savePersistedReservations();
  return normalized;
}

export function updateLocalReservation(id, updates) {
  const idx = inMemoryReservations.findIndex((r) => r.id === id);
  if (idx >= 0) {
    const updated = {
      ...inMemoryReservations[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    if (updates.email || updates.guest_email) {
      updated.email = updates.email || updates.guest_email || updated.email;
      updated.guest_email = updated.email;
    }
    inMemoryReservations[idx] = updated;

    if (memoryStore && Array.isArray(memoryStore.reservations)) {
      const memIdx = memoryStore.reservations.findIndex((r) => r.id === id);
      if (memIdx >= 0) memoryStore.reservations[memIdx] = updated;
    }

    savePersistedReservations();
    return updated;
  }
  return null;
}

export function deleteLocalReservation(id) {
  inMemoryReservations = inMemoryReservations.filter((r) => r.id !== id);
  if (memoryStore && Array.isArray(memoryStore.reservations)) {
    memoryStore.reservations = memoryStore.reservations.filter((r) => r.id !== id);
  }
  savePersistedReservations();
  return true;
}
