// Deterministic guards around the AI concierge. They run before the model (so obvious attacks never
// reach it) and after it (so code, secrets or prompt text never reach the guest). Nothing here touches
// the network, so all of it is covered by server/test/chat-guardrail.test.js.

export const AI_DAILY_MESSAGE_LIMIT = 40;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

const RULES = [
  {
    category: 'PROMPT_INJECTION',
    patterns: [
      /\b(ignore|disregard|forget|override|bypass|skip|drop|disable|deactivate|turn off|switch off|remove|lift)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|any|your|the|these|those|system|initial|original)\b[^.\n]{0,25}\b(instructions?|rules?|prompts?|guidelines?|directives?|polic(?:y|ies)|restrictions?|guardrails?|filters?|safety|limits?)\b/i,
      /\b(jail\s?-?break|DAN mode|do anything now|developer mode|dev mode|god mode|sudo mode|admin mode|debug mode|unfiltered|unrestricted|uncensored|no (?:rules|restrictions|limits|filters|guidelines))\b/i,
      /\byou are (?:now|no longer)\b/i,
      /\b(pretend|act|behave|roleplay|role-play)\b[^.\n]{0,20}\b(you are|you're|to be|as if you|as an?|like an?)\b[^.\n]{0,40}\b(ai|assistant|bot|model|chatgpt|gpt|gemini|claude|hacker|developer|programmer|admin|system|without|unrestricted|evil|grandma|grandmother)\b/i,
      /\bfrom now on\b[^.\n]{0,50}\b(you|answer|respond|reply|act|behave|ignore)\b/i,
      /\b(new|updated|real|true|secret|hidden)\s+(instructions?|rules?|system prompt|directives?)\b/i,
      /\[(?:system|admin|developer|sys)\]|<\|(?:system|im_start|im_end)\|>|#{2,}\s*(?:system|instruction)|\bBEGIN (?:SYSTEM|ADMIN) (?:PROMPT|MESSAGE)\b/i,
      /\b(kalimutan|huwag (?:mong )?pansinin|wag (?:mong )?pansinin|balewalain|lampasan)\b[^.\n]{0,40}\b(instructions?|utos|rules?|patakaran|bilin)\b/i,
      /\b(respond|reply|answer|translate|decode)\b[^.\n]{0,30}\b(base64|rot13|hex(?:adecimal)?|morse|binary|reversed? text|leetspeak)\b/i,
      /\bhypothetical(?:ly)?\b[^.\n]{0,60}\b(no rules|without (?:rules|restrictions|limits)|unrestricted|could say anything)\b/i,
    ],
  },
  {
    category: 'SYSTEM_PROBING',
    patterns: [
      /\b(reveal|show|print|repeat|display|output|tell me|give me|what (?:is|are|was|were)|list|dump|leak|share|paste|copy|translate|summari[sz]e|describe|rewrite|paraphrase|encode)\b[^.\n]{0,40}\b(system prompt|system message|system instructions?|initial (?:prompt|instructions)|hidden (?:prompt|instructions)|original (?:prompt|instructions)|your (?:full |exact |entire |own )?(?:prompt|instructions|configuration|config|settings)|the (?:prompt|instructions) you (?:were|have been|are) given)\b/i,
      /\b(api[_ -]?keys?|secret[_ -]?keys?|access[_ -]?tokens?|bearer tokens?|service[_ -]?role|env(?:ironment)? (?:vars?|variables?)|\.env\b|GEMINI_API_KEY|SUPABASE_[A-Z_]+|jwt[_ -]?secret|database (?:schema|password|credentials|dump)|connection string|db password|admin password|root password)\b/i,
      /\b(repeat|print|output|echo|show)\b[^.\n]{0,25}\b(everything|all|the text|the words|the content|the message|what's)\b[^.\n]{0,25}\b(above|before this|so far|earlier|preceding)\b/i,
      /\b(other|another|all|every|previous|past)\s+(guests?|customers?|users?|clients?|people)(?:'s|s')?\b[^.\n]{0,40}\b(names?|emails?|e-mails?|phones?|phone numbers?|numbers?|bookings?|reservations?|details|data|records|addresses?|payments?|ids?)\b/i,
      /\b(names?|emails?|e-mails?|phones?|phone numbers?|contact (?:details|numbers?)|addresses?|records|ids?)\b[^.\n]{0,40}\b(?:of|for|from)\s+(?:the\s+)?(other|another|all|every|previous|past)\s+(guests?|customers?|users?|clients?|people)\b/i,
      /\bwho (?:booked|reserved|is staying|stayed|is booked)\b[^\n]{0,60}\b(names?|emails?|phones?|numbers?|contact|address)\b/i,
      /\b(what|which)\s+(model|llm|ai model|language model|version|engine)\s+(are you|is this|do you use|powers you|runs you)\b/i,
      /\b(database|db|table|schema|backend|server)\b[^.\n]{0,30}\b(structure|tables?|columns?|schema|endpoints?|routes?|source code)\b/i,
      /\b(live database context|input telemetry|guest message:|system instruction)\b/i,
    ],
  },
  {
    category: 'CODE_REQUEST',
    patterns: [
      /\b(write|create|generate|give me|show me|make|build|produce|send|output|debug|fix|refactor|optimi[sz]e|explain|review|convert|gumawa|gawan|gawin|isulat|sumulat)\b[^.\n]{0,40}\b(sql|html|css|javascript|typescript|python|php|c\+\+|c#|golang|kotlin|swift|bash|powershell|regex(?:es)?|regular expressions?|json schema|api endpoints?|source code|react components?|scripts?|snippets?|algorithms?|code snippets?|lines of code|piece of code)\b/i,
      /\b(javascript|typescript|python|php|java|sql|html|css|bash|powershell|c\+\+|c#|react|node(?:\.js)?)\s+(code|script|snippet|function|program|query|component|app)\b/i,
      /\bcode\s+(?:for|of)\s+(?:a |an |the |my |your |this )?(website|web ?site|app|application|bot|chatbot|program|script|function|form|page|calendar|booking (?:form|system|widget|page)|login|api|database|game)\b/i,
      /\bhow (?:do|can|to|would) (?:i |you |we |one )?(code|program|implement|script|hack|exploit|inject|scrape|crawl|ddos)\b/i,
      /```|\bconsole\.log\(|\bfunction\s+\w*\s*\(|=>\s*\{|\bimport\s+[\w{}*,\s]+\s+from\s+['"]|\bdef\s+\w+\s*\(|#include\s*<|\bpublic static void\b|<\?php|\breturn\s+fetch\(/,
      /\bSELECT\s+(?:\*|[\w.]+(?:\s*,\s*[\w.]+)*)\s+FROM\s+[\w.]+/,
      /\b(?:DROP|TRUNCATE)\s+TABLE\b|\bUNION\s+(?:ALL\s+)?SELECT\b/i,
      /\bDELETE\s+FROM\s+\w|\bINSERT\s+INTO\s+\w/,
      /'\s*(?:OR|AND)\s*'?\d+'?\s*=\s*'?\d+|;\s*--/i,
      /\b(exploit|payload|reverse shell|keylogger|malware|ransomware|phishing (?:page|email|kit|site)|sql injection|xss payload|ddos|brute[ -]?force|crack (?:a |the |his |her |my )?password)\b/i,
    ],
  },
  {
    category: 'OUT_OF_SCOPE',
    patterns: [
      /\b(homework|assignment|essay|thesis|term paper|research paper|book report)\b/i,
      /\bsolve\b[^.\n]{0,25}(?:=|\bequation\b|\bfor x\b|\d\s*[x+*/^-]\s*\d)/i,
    ],
  },
];

const XSS_PATTERN = /<\s*\/?\s*(script|iframe|object|embed|svg|img|style|link|meta|form|input|body|html)\b|\bon(?:error|load|click|mouseover|focus|blur)\s*=|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html/i;

export function screenGuestMessage(rawText) {
  const text = String(rawText ?? '');
  if (XSS_PATTERN.test(text)) return { blocked: true, category: 'XSS_ATTEMPT' };
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) return { blocked: true, category: rule.category };
  }
  return { blocked: false, category: null };
}

const REFUSALS = {
  PROMPT_INJECTION:
    "I can only help with Rock View Beach Resort: rooms, rates, availability, bookings, policies, and trips around Bolinao. I can't change how I work. What would you like to know about your stay?",
  SYSTEM_PROBING:
    "I can't share how this assistant is set up, any system details, or other guests' information. I'm happy to help with rooms, bookings, and your stay in Bolinao.",
  CODE_REQUEST:
    "I don't write, explain, or review code. I'm here for questions about Rock View Beach Resort and trips to Bolinao, like rooms, rates, availability, and bookings.",
  XSS_ATTEMPT:
    "I couldn't read that message because it contains code or markup. Please send your question again as plain text.",
  OUT_OF_SCOPE:
    "That's outside what I can help with. I can answer questions about Rock View Beach Resort, your bookings, and travel around Bolinao.",
  OUTPUT_FILTERED:
    "I can't help with that here. I can answer questions about Rock View Beach Resort, your bookings, and travel around Bolinao.",
};

export function refusalFor(category) {
  return REFUSALS[category] || REFUSALS.OUT_OF_SCOPE;
}

const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z_-]{30,}/,
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/,
  /\b(?:SUPABASE_[A-Z_]+|GEMINI_API_KEY|SMTP_PASS|SUPABASE_SERVICE_ROLE_KEY|JWT_SECRET|ADMIN_TOKEN_KEY)\b/,
  /\bservice[_ -]role\b/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

const PROMPT_MARKERS = /LIVE DATABASE CONTEXT|INPUT TELEMETRY|guardrail_triggered|guardrail_category|REQUIRED JSON OUTPUT SCHEMA|SEMANTIC GUARDRAIL|STRICT LIVE DATA GROUNDING|HUMAN ESCALATION POLICY|escalate_to_agent|authenticatedViewerOwnBookings|upcomingBookedDateWindows/i;

const CODE_LINE = /^\s*(?:const|let|var|function|import|export|def|class|public|private|return|if\s*\(|for\s*\(|while\s*\(|SELECT\s|INSERT\s|UPDATE\s|DELETE\s|CREATE\s+TABLE|<\/?[a-z]+[^>]*>|#include|\$[a-z_]+\s*=|print\(|console\.)/i;

// Returns { safe: true } or { safe: false, reason }.
export function screenModelReply(rawText) {
  const text = String(rawText ?? '');
  if (/```/.test(text)) return { safe: false, reason: 'code_block' };
  if (/<\s*script\b/i.test(text)) return { safe: false, reason: 'script_tag' };
  if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) return { safe: false, reason: 'secret' };
  if (PROMPT_MARKERS.test(text)) return { safe: false, reason: 'prompt_leak' };
  const codeLines = text.split('\n').filter((line) => CODE_LINE.test(line)).length;
  if (codeLines >= 2) return { safe: false, reason: 'code_lines' };
  return { safe: true };
}

// The browser can send earlier turns. Only the guest's own words are kept, so nobody can write fake
// "assistant" turns that pretend the bot already agreed to something.
export function sanitizeClientHistory(history, { maxTurns = 6, maxChars = 600 } = {}) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((turn) => turn && turn.role === 'user' && typeof turn.text === 'string')
    .slice(-maxTurns)
    .map((turn) => ({ role: 'user', text: turn.text.slice(0, maxChars).replace(/</g, '‹').replace(/>/g, '›') }));
}

export function manilaDay(nowMs) {
  return new Date(nowMs + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

export function nextManilaMidnight(nowMs) {
  const local = new Date(nowMs + MANILA_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) - MANILA_OFFSET_MS;
}

// Daily message counter. Keys are "user:<id>" for signed-in guests and "ip:<address>" for visitors.
export function createDailyQuota({ limit = AI_DAILY_MESSAGE_LIMIT, maxKeys = 20000 } = {}) {
  const entries = new Map();

  function current(key, nowMs) {
    const day = manilaDay(nowMs);
    const entry = entries.get(key);
    return entry && entry.day === day ? entry : { day, used: 0, seeded: false };
  }

  function snapshot(entry, allowed) {
    return { allowed, used: entry.used, limit, remaining: Math.max(0, limit - entry.used) };
  }

  return {
    limit,
    peek(key, nowMs = Date.now()) {
      const entry = current(key, nowMs);
      return snapshot(entry, entry.used < limit);
    },
    isSeeded(key, nowMs = Date.now()) {
      return current(key, nowMs).seeded;
    },
    seed(key, used, nowMs = Date.now()) {
      const entry = current(key, nowMs);
      entries.set(key, { day: entry.day, used: Math.max(entry.used, Math.max(0, Number(used) || 0)), seeded: true });
    },
    consume(key, nowMs = Date.now()) {
      if (entries.size > maxKeys) {
        const today = manilaDay(nowMs);
        for (const [k, v] of entries) if (v.day !== today) entries.delete(k);
      }
      const entry = current(key, nowMs);
      if (entry.used >= limit) {
        entries.set(key, entry);
        return snapshot(entry, false);
      }
      const next = { ...entry, used: entry.used + 1 };
      entries.set(key, next);
      return snapshot(next, true);
    },
  };
}

export function limitReachedText() {
  return `You've used today's ${AI_DAILY_MESSAGE_LIMIT} messages with Rock View Bot. The limit resets at midnight, Manila time. For anything urgent, call the front desk at +63 900 555 0123 or file a ticket from your dashboard.`;
}
