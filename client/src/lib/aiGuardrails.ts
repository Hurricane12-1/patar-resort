/**
 * Structural Transport Sanitizer & Contact Metadata
 * for Rock View Beach Resort AI Concierge.
 *
 * All intent classification, grounding, and semantic guardrail decisions
 * are evaluated dynamically by the backend AI pipeline (not hardcoded client regexes).
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

// Structural HTML/URI patterns that represent actual executable DOM syntax (never plain English words)
const EXECUTABLE_DOM_PATTERNS = [
  /<\s*\/?\s*(?:script|iframe|object|embed|applet|meta|base)\b[^>]*>/i,
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

/**
 * Checks strictly for actual executable HTML/URI syntax (never English words).
 */
export function isCrossScriptAttempt(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const decoded = decodeURIComponentSafe(input);
  return EXECUTABLE_DOM_PATTERNS.some((pat) => pat.test(input) || pat.test(decoded));
}

/**
 * Escapes raw HTML characters and neutralizes executable URI schemes for safe display.
 */
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

/**
 * Inspects user input structurally without blocking it on the client,
 * allowing the backend semantic AI guardrail engine to evaluate intent in context.
 */
export function inspectStructuralInput(input: string): StructuralInspection {
  const raw = (input || '').trim();
  return {
    hasExecutableMarkup: isCrossScriptAttempt(raw),
    sanitizedText: raw,
  };
}
