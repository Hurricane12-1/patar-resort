/**
 * AI Guardrails, Anti-Hacking Security, and System Intent Analyzer
 * for Rock View Beach Resort AI Concierge
 */

export interface GuardrailEvaluation {
  blocked: boolean;
  category?: 'PROMPT_INJECTION' | 'SYSTEM_EXFILTRATION' | 'CODE_INJECTION' | 'OFFENSIVE' | 'OUT_OF_SCOPE';
  reason?: string;
  safeMessage?: string;
}

export interface SystemIntent {
  intent: 'SYSTEM_BOOKING' | 'SYSTEM_PAYMENT' | 'SYSTEM_RFID' | 'SYSTEM_AUTH' | 'CONCERN_REPORT' | 'CONTACT_US' | 'GENERAL';
  title?: string;
  summary?: string;
  contactQuickAction?: boolean;
}

export const RESORT_CONTACT_INFO = {
  primaryPhone: '+63 900 555 0123',
  viberWhatsapp: '+63 917 123 4567',
  supportEmail: 'support@jdbeachhouse.com',
  receptionDesk: 'Front Desk Lobby, Patar White Beach, Bolinao, Pangasinan, Philippines',
  hours: '24/7 Everyday (Reception & Security on-site)',
};

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

// Dangerous code injection patterns
const CODE_INJECTION_PATTERNS = [
  /<\s*script\b[^>]*>/i,
  /javascript\s*:\s*[a-z0-9_]/i,
  /on(error|load|click|mouseover)\s*=\s*['"][^'"]*['"]/i,
  /\b(eval\s*\(|new\s+Function\(|document\.cookie|window\.localStorage)\b/i,
];

// Patterns indicative of questions strictly outside hotel & resort operations
const OUT_OF_SCOPE_PATTERNS = [
  /\b(write|create|debug|generate|fix|run|execute)\s+(a\s+|an\s+|the\s+|my\s+|some\s+)?(code|script|program|function|python|javascript|typescript|c\+\+|java|html|css|sql|algorithm|regex|app|website)\b/i,
  /\b(python|javascript|typescript|c\+\+|golang|html|css|sql)\s+(code|script|program|function|syntax|error|bug)\b/i,
  /\b(solve|calculate)\s+(the\s+|this\s+|my\s+)?(math|equation|calculus|derivative|integral|algebra|problem)\b/i,
  /\b(write\s+an?\s+essay|homework\s+help|do\s+my\s+assignment|thesis\s+statement)\b/i,
  /\b(who\s+won|latest\s+score|nba\s+finals|world\s+cup|super\s+bowl|premier\s+league)\b/i,
  /\b(presidential\s+election|political\s+debate|democrats|republicans|congress\s+vote|who\s+is\s+the\s+president)\b/i,
  /\b(stock\s+market|cryptocurrency|crypto|bitcoin|ethereum|trading\s+strategy)\b/i,
  /\b(quantum\s+physics|theory\s+of\s+relativity|speed\s+of\s+light|thermodynamics|black\s+holes)\b/i,
  /\b(medical\s+diagnosis|symptoms\s+of\s+cancer|prescribe\s+medication)\b/i,
];

/**
 * Evaluate guest prompt against anti-hacking and security guardrails
 */
export function evaluateClientGuardrails(input: string): GuardrailEvaluation {
  const text = (input || '').trim();
  if (!text) return { blocked: false };

  // 1. Check Code Injection
  for (const pat of CODE_INJECTION_PATTERNS) {
    if (pat.test(text)) {
      return {
        blocked: true,
        category: 'CODE_INJECTION',
        reason: 'Detected potential code injection payload.',
        safeMessage:
          '🛡️ Security Notice: Script or markup execution is strictly prohibited. If you are experiencing technical difficulties, please contact our Front Desk at +63 900 555 0123.',
      };
    }
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

  // 4. Hotel Business Domain Guardrail
  for (const pat of OUT_OF_SCOPE_PATTERNS) {
    if (pat.test(text)) {
      return {
        blocked: true,
        category: 'OUT_OF_SCOPE',
        reason: 'Question outside hotel and beach resort business scope.',
        safeMessage:
          '🌊 Mabuhay! I am Rock View Bot, the dedicated 24/7 AI Concierge for Rock View Beach Resort in Bolinao, Pangasinan.\n\nMy assistance is strictly focused on our hotel operations: room rates, booking reservations, beachfront amenities, dining, check-in policies, and local Bolinao travel activities. I cannot assist with topics outside the resort business.\n\nHow may I help you plan your beach stay or room reservation today?',
      };
    }
  }

  return { blocked: false };
}

/**
 * Detect straight questions about the system, concerns, or need to contact staff
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

  // 3. System: Digital Pass & RFID Keycard
  if (/rfid|keycard|key\s*card|door|unlock|passcode|digital\s*pass|keycode/i.test(t)) {
    return {
      intent: 'SYSTEM_RFID',
      title: 'Digital Pass & RFID Keycard System',
      summary: 'How room access and the contactless RFID keycard work.',
    };
  }

  // 4. System: Payment & Downpayment
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

  // 5. System: Booking & Reservation Flow
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

  // 6. System: Auth, Google Login & 2FA Recovery
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
