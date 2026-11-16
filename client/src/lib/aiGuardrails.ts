/**
 * AI Guardrails, Anti-Cross Script (XSS) Security, and System Intent Analyzer
 * for Rock View Beach Resort AI Concierge
 */

export interface GuardrailEvaluation {
  blocked: boolean;
  category?: 'CROSS_SITE_SCRIPTING' | 'PROMPT_INJECTION' | 'SYSTEM_EXFILTRATION' | 'CODE_INJECTION' | 'OFFENSIVE' | 'OUT_OF_SCOPE';
  reason?: string;
  safeMessage?: string;
}

export interface SystemIntent {
  intent: 'SYSTEM_BOOKING' | 'SYSTEM_PAYMENT' | 'SYSTEM_RFID' | 'SYSTEM_AUTH' | 'SYSTEM_ACCOMMODATION' | 'SYSTEM_PORTAL' | 'CONCERN_REPORT' | 'CONTACT_US' | 'GENERAL';
  title?: string;
  summary?: string;
  contactQuickAction?: boolean;
}

export const RESORT_CONTACT_INFO = {
  primaryPhone: '+63 900 555 0123',
  viberWhatsapp: '+63 917 123 4567',
  supportEmail: 'hello@jdbeachhouse.ph',
  receptionDesk: 'Front Desk Lobby, Patar Coastal Road, Bolinao, Pangasinan, Philippines',
  hours: '24/7 Everyday (Front Desk, Security & Generator on-site)',
};

// Comprehensive Anti-Cross Script (XSS) patterns covering tags, attributes, event handlers, protocols, sinks, and encoded variants
export const ANTI_CROSS_SCRIPT_PATTERNS = [
  // 1. Script tags (open, close, unclosed, self-closing)
  /<\s*\/?\s*script\b[^>]*>/i,
  /<\s*script\b/i,
  // 2. Dangerous HTML element injections
  /<\s*(iframe|embed|object|link|meta|style|base|form|svg|body|input|applet)\b[^>]*>/i,
  // 3. Inline event handler execution on any tag (e.g. <img src=x onerror=...>, <body onload=...>)
  /<\s*[a-z0-9_-]+(\s+[^>]*)?\son[a-z]{3,20}\s*=/i,
  /\bon(error|load|click|mouseover|mouseenter|mouseleave|focus|blur|change|submit|input|pointerdown|animationstart|touchstart)\s*=/i,
  // 4. JavaScript execution protocols & data URIs
  /(?:javascript|vbscript|livescript)\s*:/i,
  /data\s*:\s*(?:text\/html|image\/svg\+xml)\b/i,
  // 5. DOM sinks and evaluation primitives
  /\b(?:eval|new\s+Function)\s*\(/i,
  /\b(?:document\.(?:cookie|location|write|writeln|domain)|window\.(?:location|open|localStorage|sessionStorage))\b/i,
  /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/i,
  // 6. Markdown XSS execution payloads [label](javascript:...)
  /\[.*?\]\(\s*(?:javascript|vbscript|data):/i,
  // 7. Encoded & obfuscated XSS variants (URL encoded, HTML entities, hex/unicode)
  /(?:%3c|%253c|\\x3c|\\u003c)\s*(?:script|iframe|img|svg|object|embed)/i,
  /(?:&lt;|&#60;|&#x3c;)\s*(?:script|iframe|img|svg)/i,
  /(?:%22|%27|&#34;|&#39;|&quot;).*?(?:onload|onerror|onclick)/i,
];

// Patterns indicative of prompt injection, jailbreaking, or unauthorized system overrides
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+|any\s+|previous\s+|prior\s+)*(instructions|directives|prompts|rules)/i,
  /disregard\s+(all\s+|any\s+|previous\s+|prior\s+)*(instructions|directives|prompts|rules)/i,
  /you\s+are\s+now\s+(in\s+)?(developer\s+mode|dan\s+mode|unrestricted|god\s+mode|root)/i,
  /\b(act\s+as\s+dan|jailbreak|bypass\s+safety|override\s+security)\b/i,
  /\b(pretend\s+you\s+have\s+no\s+rules|unfiltered\s+mode|raw\s+mode)\b/i,
  /\bsystem\s*prompt\s*override\b/i,
];

// Patterns indicative of secret extraction or internal infrastructure probing
const EXFILTRATION_PATTERNS = [
  /(print|show|reveal|repeat|output|leak|give\s+me)\s+(your\s+)?(system\s+prompt|initial\s+instructions|internal\s+instructions)/i,
  /(what\s+is\s+your|tell\s+me\s+your)\s+(hidden\s+|system\s+)?(prompt|instruction)/i,
  /\b(gemini[-_]?api[-_]?key|supabase[-_]?(service[-_]?role|anon)?[-_]?key|jwt[-_]?secret)\b/i,
  /\b(process\.env|env\.GEMINI|env\.SUPABASE|database[-_]?password|db[-_]?password)\b/i,
  /\b(select\s+\*\s+from\s+(auth\.)?users|select\s+password|union\s+select|information_schema)\b/i,
  /\b(drop\s+table|delete\s+from\s+profiles|update\s+profiles\s+set)\b/i,
];

function decodeURIComponentSafe(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

/**
 * Checks if an input string contains Cross-Site Scripting (XSS) vectors or payloads
 */
export function isCrossScriptAttempt(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const decoded = decodeURIComponentSafe(input);
  return ANTI_CROSS_SCRIPT_PATTERNS.some((pat) => pat.test(input) || pat.test(decoded));
}

/**
 * Strips and HTML-escapes malicious scripts and cross-site scripting markup
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

export function evaluateClientGuardrails(input: string): GuardrailEvaluation {
  const text = (input || '').trim();
  if (!text) return { blocked: false };

  // 1. Strict Anti-Cross Script (XSS) Guardrail Check
  if (isCrossScriptAttempt(text)) {
    return {
      blocked: true,
      category: 'CROSS_SITE_SCRIPTING',
      reason: 'Anti-Cross Script Guardrail: Detected Cross-Site Scripting (XSS) payload or script execution attempt.',
      safeMessage:
        '🛡️ Anti-Cross Script (XSS) Guardrail Triggered: Executable script injection, inline event handlers, and cross-site markup are strictly blocked to protect application and session integrity.\n\nRock View Bot is ready to help you with accommodations, room rates, or booking details in plain text!',
    };
  }

  // 2. Check System Secret Exfiltration
  for (const pat of EXFILTRATION_PATTERNS) {
    if (pat.test(text)) {
      return {
        blocked: true,
        category: 'SYSTEM_EXFILTRATION',
        reason: 'Detected attempt to probe system credentials or internal prompts.',
        safeMessage:
          '🛡️ Security Notice: I am Rock View Bot, dedicated exclusively to assisting with Rock View Beach Resort inquiries and guest bookings. Internal system credentials and configuration prompts are protected and cannot be shared. For assistance with your account, please reach our Front Desk.',
      };
    }
  }

  // 3. Check Prompt Injection & Jailbreaks
  for (const pat of PROMPT_INJECTION_PATTERNS) {
    if (pat.test(text)) {
      return {
        blocked: true,
        category: 'PROMPT_INJECTION',
        reason: 'Detected prompt injection or persona override attempt.',
        safeMessage:
          '🛡️ Security Guardrail: I am designed specifically to serve as your 24/7 Rock View Beach Resort concierge. I cannot alter my core safety guidelines or adopt unrestricted personas. How may I assist your stay in Bolinao today?',
      };
    }
  }

  return { blocked: false };
}

/**
 * Detect questions about the system, concerns, or need to contact staff
 */
export function detectSystemIntent(input: string): SystemIntent {
  const t = (input || '').toLowerCase();

  // 1. Contact Us / Need Help / Human Escalation
  if (
    /contact|help|reach|talk to (a )?(human|person|agent|staff|manager)|call|phone|telephone|hotline|cellphone|number|front\s*desk|reception|tawag|kausap/i.test(
      t
    )
  ) {
    return {
      intent: 'CONTACT_US',
      title: 'Contact Front Desk & Helpdesk',
      summary: 'Get in direct touch with Rock View Beach Resort 24/7 staff.',
      contactQuickAction: true,
    };
  }

  // 2. Guest Concerns & Complaints
  if (
    /concern|complain|problem|issue|broken|not working|aircon|air\s*conditioner|leaking|dirty|smell|noise|delay|refund|wrong|damage|emergency|saklolo|reklamo/i.test(
      t
    )
  ) {
    return {
      intent: 'CONCERN_REPORT',
      title: 'Guest Concern & Resolution',
      summary: 'Prompt guest issue resolution and immediate staff notification.',
      contactQuickAction: true,
    };
  }

  // 3. System: Digital Pass & RFID Keycard & Barcode
  if (/rfid|keycard|key\s*card|barcode|digital\s*pass|passcode|door|unlock|scan|voucher/i.test(t)) {
    return {
      intent: 'SYSTEM_RFID',
      title: 'Digital Pass & RFID Keycard System',
      summary: 'Express front desk check-in with scannable barcode and contactless RFID room keycard pass.',
    };
  }

  // 4. System: Accommodations & Categories (Rooms vs Cottages)
  if (/chason|unit\s*3|unit\s*5|sunset|cottage|room\s*types|category|categories|accommodations/i.test(t)) {
    return {
      intent: 'SYSTEM_ACCOMMODATION',
      title: 'Resort Accommodations & Categories',
      summary: 'Rooms (chason room, Unit 3, Unit 5) and Beachfront Cottages (Sunset) at flat ₱3,500/night.',
    };
  }

  // 5. System: Resident Guest Portal (/client) & Staff / Admin Hubs
  if (/portal|dashboard|my\s*stays|resident|client|user\s*dashboard|staff\s*login|admin\s*login|executive/i.test(t)) {
    return {
      intent: 'SYSTEM_PORTAL',
      title: 'Resident Guest & Operations Portals',
      summary: 'Access /client for guest stay management and barcode pass; /staff and /admin for resort operations.',
    };
  }

  // 6. System: Payment & Downpayment
  if (
    /payment|downpayment|down\s*payment|gcash|maya|bank|credit\s*card|deposit|balance|30%|bayad|pera/i.test(
      t
    )
  ) {
    return {
      intent: 'SYSTEM_PAYMENT',
      title: 'System Payment & Downpayment Guide',
      summary: 'How 30% reservation downpayment, GCash, Maya, and cash work.',
    };
  }

  // 7. System: Booking & Reservation Flow
  if (
    /how\s*(do|can)\s*i\s*book|booking\s*process|system\s*work|how\s*to\s*reserve|reserve\s*a\s*room|paano\s*mag\s*book/i.test(
      t
    )
  ) {
    return {
      intent: 'SYSTEM_BOOKING',
      title: 'Online Booking System Guide',
      summary: 'Step-by-step walk-through of the online reservation process.',
    };
  }

  // 8. System: Auth, Google Login & 2FA Recovery
  if (/sign\s*in|login|log\s*in|google|account|2fa|otp|password|manifest/i.test(t)) {
    return {
      intent: 'SYSTEM_AUTH',
      title: 'Account, Google Sign-In & 2FA',
      summary: 'How 1-click Google sign-in and email OTP 2FA work.',
    };
  }

  return {
    intent: 'GENERAL',
  };
}
