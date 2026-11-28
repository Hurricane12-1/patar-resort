import { supabase } from './supabaseClient';
import { API_BASE, api } from './api';
import { getManilaTodayISO } from './offeringSpecs';
import { RESORT_CONTACT } from './guestPortal';
import { answerFromResortFacts, type ConciergeStay } from './conciergeEngine';

/**
 * Structural Transport Sanitizer & Direct Edge AI Concierge Failover
 * for Rock View Beach Resort AI Concierge.
 */

export interface StructuralInspection {
  hasExecutableMarkup: boolean;
  sanitizedText: string;
}

export const RESORT_CONTACT_INFO = {
  primaryPhone: '+63 900 555 0123',
  viberWhatsapp: '+63 917 123 4567',
  supportEmail: 'support@rockviewresort.ph',
  receptionDesk: 'Front Desk Lobby, Patar Coastal Road, Bolinao, Pangasinan, Philippines',
  hours: '24/7 Everyday (Front Desk, Security & Generator on-site)',
};

const EXECUTABLE_DOM_PATTERNS = [
  /<\s*\/?\s*(?:script|iframe|object|embed|applet|meta|base|svg|form)\b[^>]*>/i,
  /<\s*[a-z0-9_-]+(?:\s+[^>]*)?\s+on[a-z]{3,20}\s*=/i,
  /(?:javascript|vbscript|livescript)\s*:/i,
  /data\s*:\s*(?:text\/html|image\/svg\+xml)\b/i,
];

function decodeURIComponentSafe(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

export function isCrossScriptAttempt(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const decoded = decodeURIComponentSafe(input);
  return EXECUTABLE_DOM_PATTERNS.some((pat) => pat.test(input) || pat.test(decoded));
}

export function sanitizeAntiXSS(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/(?:javascript|vbscript|livescript)\s*:/gi, 'blocked:')
    .replace(/data\s*:\s*(?:text\/html|image\/svg\+xml)/gi, 'blocked:');
}

export function inspectStructuralInput(input: string): StructuralInspection {
  const raw = (input || '').trim();
  return {
    hasExecutableMarkup: isCrossScriptAttempt(raw),
    sanitizedText: raw,
  };
}

export interface ConciergeOptions {
  firstName?: string;
  /** The guest's own stays, when the caller already has them. Loaded from the account otherwise. */
  stays?: ConciergeStay[];
}

async function loadOwnStays(accessToken?: string): Promise<ConciergeStay[]> {
  if (!accessToken) return [];
  try {
    const rows = await api.myReservations();
    if (!Array.isArray(rows)) return [];
    return rows.map((row: any) => ({
      roomName: row.rooms?.name || row.room_name || 'Your room',
      checkIn: String(row.check_in || '').slice(0, 10),
      checkOut: String(row.check_out || '').slice(0, 10),
      status: String(row.status || 'confirmed'),
      guests: Number(row.guests) || undefined,
      total: Number(row.total_php) || undefined,
    }));
  } catch {
    return [];
  }
}

/** Last resort: answer from the live room list and the stay rules, so the guest is never left without a reply. */
async function answerFromResortFactsFor(
  clean: string,
  liveAccommodations: any[],
  accessToken: string | undefined,
  options: ConciergeOptions
) {
  const stays = options.stays ?? (await loadOwnStays(accessToken));
  const answer = answerFromResortFacts(clean, {
    rooms: liveAccommodations.map((room) => ({
      name: String(room.name || ''),
      category: room.category,
      offering_type: room.offering_type,
      capacity: Number(room.capacity) || 0,
      rate_php: Number(room.rate_php) || 0,
    })),
    stays,
    today: getManilaTodayISO(),
    signedIn: Boolean(accessToken),
    firstName: options.firstName,
    contact: {
      phone: RESORT_CONTACT.phoneDisplay,
      checkIn: RESORT_CONTACT.checkInTime,
      checkOut: RESORT_CONTACT.checkOutTime,
      address: RESORT_CONTACT.addressLine,
      mapsUrl: RESORT_CONTACT.mapsUrl,
    },
  });
  return {
    from: 'bot',
    id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: answer.text,
    chips: answer.chips,
    is_ai: true,
    contact_card: Boolean(answer.needsPerson),
    needs_ticket: Boolean(answer.needsPerson),
    source: 'built_in',
  };
}

/**
 * Resilient AI Concierge query. It tries the backend HTTP endpoint (`/api/chat/ask`), then direct Supabase +
 * Gemini, and finally answers from the resort's own facts, so a question always gets a reply.
 */
export async function queryResilientConciergeAI(
  rawText: string,
  history: Array<{ role: string; text: string }> = [],
  accessToken?: string,
  options: ConciergeOptions = {}
): Promise<any> {
  const clean = (rawText || '').trim().slice(0, 600);

  // 1. Try Backend HTTP `/api/chat/ask` first
  try {
    const endpoint = API_BASE ? `${API_BASE}/api/chat/ask` : '/api/chat/ask';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: clean, history }),
      signal: AbortSignal.timeout(5500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.text === 'string' && !data.text.includes('momentarily reconnecting')) {
        return { ...data, source: 'server' };
      }
    }
  } catch {}

  // 2. Server unreachable: answer from the resort facts on this device. The browser never calls the
  // AI model itself, so the daily message limit and the server guardrails cannot be skipped.
  let liveAccommodations: any[] = [];
  try {
    const { data } = await supabase
      .from('rooms')
      .select('name, category, capacity, rate_php, description, amenities')
      .eq('is_active', true)
      .order('rate_php', { ascending: true });
    if (Array.isArray(data)) liveAccommodations = data;
  } catch {}

  return answerFromResortFactsFor(clean, liveAccommodations, accessToken, options);
}
