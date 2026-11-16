import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { admin, getSystemAdminClient } from '../lib/supabase.js';
import { redis } from '../lib/redis.js';

let ioInstance = null;

export function getChatbotIO() {
  return ioInstance;
}

export function emitToGuest(profileId, event, data) {
  if (!ioInstance) return false;
  if (profileId && profileId !== 'guest-anon') {
    ioInstance.to(`guest_${profileId}`).emit(event, data);
  }
  ioInstance.to('guest_guest-anon').emit(event, data);
  return true;
}

export function broadcastToStaff(event, data) {
  if (!ioInstance) return false;
  ioInstance.to('staff_agents').emit(event, data);
  return true;
}

/**
 * Discovers and resolves an active, available service agent from Supabase profiles.
 * Prioritizes on-duty Receptionist, then Front Desk Staff, then Duty Manager.
 */
export async function findAvailableServiceAgent() {
  try {
    const client = await getSystemAdminClient();
    const { data: agents, error } = await client
      .from('profiles')
      .select('id, full_name, first_name, last_name, role, phone, email')
      .in('role', ['receptionist', 'staff', 'administrator'])
      .order('role', { ascending: false });

    if (!error && Array.isArray(agents) && agents.length > 0) {
      // 1. Prioritize receptionist on duty
      const receptionist = agents.find((a) => a.role === 'receptionist');
      if (receptionist) {
        return {
          id: receptionist.id,
          name: receptionist.full_name || `${receptionist.first_name || ''} ${receptionist.last_name || ''}`.trim() || 'Maria Santos',
          role: 'Front Desk Receptionist',
          phone: receptionist.phone || '+63 900 555 0123',
          email: receptionist.email || 'receptionist@rockviewresort.ph',
          is_online: true,
        };
      }
      // 2. Front Desk Concierge / Staff
      const staffAgent = agents.find((a) => a.role === 'staff');
      if (staffAgent) {
        return {
          id: staffAgent.id,
          name: staffAgent.full_name || `${staffAgent.first_name || ''} ${staffAgent.last_name || ''}`.trim() || 'Elena Reyes',
          role: 'Front Desk & Guest Concierge',
          phone: staffAgent.phone || '+63 900 555 0123',
          email: staffAgent.email || 'staff@rockviewresort.ph',
          is_online: true,
        };
      }
      // 3. Front Desk Duty Manager / Administrator
      const adminAgent = agents[0];
      return {
        id: adminAgent.id,
        name: adminAgent.full_name || 'Executive Duty Manager',
        role: 'Front Desk Duty Manager',
        phone: adminAgent.phone || '+63 900 555 0123',
        email: adminAgent.email || 'admin@rockviewresort.ph',
        is_online: true,
      };
    }
  } catch (err) {
    console.warn('[Find Service Agent Warning]', err.message);
  }

  // Resilient High-Availability Concierge Fallback
  return {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Maria Santos',
    role: 'Front Desk Receptionist & Guest Concierge',
    phone: '+63 900 555 0123',
    email: 'receptionist@rockviewresort.ph',
    is_online: true,
  };
}

export function attachChatbot(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: [
        env.CLIENT_ORIGIN,
        'https://patar-resort.pages.dev',
        'https://patar-resort.onrender.com',
        /^https:\/\/([a-z0-9-]+\.)?patar-resort\.pages\.dev$/,
      ].filter(Boolean),
      credentials: true,
    },
  });
  io.engine.on('headers', (headers) => {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
    headers['X-Content-Type-Options'] = 'nosniff';
    headers['X-Frame-Options'] = 'DENY';
    headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=(), payment=()';
  });
  ioInstance = io;

  // Resilient token authentication with Supabase Auth verification fallback
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token && typeof token === 'string') {
      try {
        socket.userId = jwt.verify(token, env.SUPABASE_JWT_SECRET, { audience: 'authenticated' }).sub;
      } catch {
        // Fallback: Verify directly with Supabase Auth
        try {
          const { data: { user }, error } = await admin.auth.getUser(token);
          if (!error && user?.id) {
            socket.userId = user.id;
          }
        } catch { /* guest / anonymous */ }
      }
    }

    if (socket.userId) {
      try {
        const { data: prof } = await admin.from('profiles').select('full_name, role').eq('id', socket.userId).single();
        if (prof) {
          socket.userRole = prof.role;
          socket.guestName = prof.full_name;
        }
      } catch {}
    }
    next();
  });

  io.on('connection', (socket) => {
    // Room registration: Staff to staff_agents, guests to their unique guest room
    const isStaff = ['staff', 'receptionist', 'administrator', 'admin', 'accounting'].includes(socket.userRole);
    if (isStaff) {
      socket.join('staff_agents');
    }

    const guestRoom = socket.userId ? `guest_${socket.userId}` : `guest_${socket.id}`;
    socket.join(guestRoom);
    if (!socket.userId) {
      socket.join('guest_guest-anon');
    }

    socket.emit('bot:message', {
      text: "Mabuhay! I'm Rock View Bot 🌊 How can I help you plan your stay, recommend rooms for your family or group, or answer questions about Rock View Beach Resort?",
      chips: [],
    });

    let pendingTimeout = null;
    const msgHistory = []; // Rate limiting window per socket

    // Direct customer to service agent helper
    const handleDirectToAgent = async (payload) => {
      try {
        const agent = await findAvailableServiceAgent();
        socket.assignedAgent = agent;
        socket.isDirectedToAgent = true;

        const reqText = payload?.message || 'Guest requested to connect with a Front Desk service agent.';

        // 1. Insert customer request into chat_messages
        const { data: reqMsg } = await admin.from('chat_messages').insert({
          profile_id: socket.userId || null,
          role: 'user',
          sender: socket.userId ? 'customer' : 'guest',
          content: reqText,
          metadata: {
            requested_staff: true,
            directed_to_agent: true,
            agent_id: agent.id,
            agent_name: agent.name,
            status: 'pending_staff',
            saved_at: new Date().toISOString(),
          },
        }).select().single();

        // 2. Insert service agent greeting into chat_messages
        const handoffText = `🟢 Directed to Service Agent: ${agent.name} (${agent.role})\n\n"Mabuhay! I am ${agent.name} from Front Desk & Guest Services. I am now directly connected to your chat and ready to assist you. All our messages are recorded for your security and stay records."`;

        const { data: handoffMsg } = await admin.from('chat_messages').insert({
          profile_id: socket.userId || null,
          role: 'bot',
          sender: 'service_agent',
          content: handoffText,
          metadata: {
            directed_to_agent: true,
            is_agent: true,
            agent_id: agent.id,
            agent_name: agent.name,
            agent_role: agent.role,
            status: 'connected',
            saved_at: new Date().toISOString(),
          },
        }).select().single();

        // 3. Create persistent executive notification
        await admin.from('notifications').insert({
          profile_id: socket.userId || null,
          title: `Live Customer Directed to ${agent.name}`,
          body: `Customer ${socket.guestName || 'Guest'} (${socket.userId || 'webchat'}) is now connected live with service agent ${agent.name}.`,
          type: 'sms',
          recipient: 'Front Desk',
          status: 'sent',
        }).catch(() => {});

        await redis.del('analytics:overview').catch(() => {});

        // 4. Emit assignment & greeting to customer socket
        socket.emit('agent:assigned', {
          directed: true,
          agent,
          messageId: handoffMsg?.id,
          text: handoffText,
        });

        socket.emit('bot:message', {
          id: handoffMsg?.id || `agent-assign-${Date.now()}`,
          text: handoffText,
          is_agent: true,
          sender: 'service_agent',
          senderName: agent.name,
          agent_name: agent.name,
          agent_role: agent.role,
          directed_to_agent: true,
          chips: ['Check My Reservation', 'How to Refund', 'Speak with Duty Manager', 'Back to AI'],
        });

        // 5. Notify all staff/receptionists in the staff_agents room
        io.to('staff_agents').emit('staff:customer_handoff', {
          profileId: socket.userId || 'guest-anon',
          guestName: socket.guestName || 'Guest Inquirer',
          assignedAgent: agent,
          message: reqText,
          messageId: reqMsg?.id,
          timestamp: new Date().toISOString(),
        });

        return { agent, handoffMsg };
      } catch (err) {
        console.warn('[Direct Customer To Agent Error]', err.message);
      }
    };

    socket.on('chat:message', async (payload) => {
      if (!socket.connected) return;

      // 1. Rate Limiting Check: max 10 messages per 10 seconds
      const now = Date.now();
      while (msgHistory.length > 0 && now - msgHistory[0] > 10000) {
        msgHistory.shift();
      }
      if (msgHistory.length >= 10) {
        socket.emit('bot:message', {
          text: "⏳ You're sending inquiries too quickly. Please pause a moment before asking again.",
          chips: ['Recommend a room for a family', 'How far is Cape Bolinao lighthouse?', 'What are the resort amenities?'],
        });
        return;
      }
      msgHistory.push(now);

      // 2. Safe Payload Extraction & Truncation (Anti-Crash & Anti-Buffer Overflow)
      const rawText = typeof payload === 'string'
        ? payload
        : (payload && typeof payload === 'object' && typeof payload.text === 'string')
          ? payload.text
          : '';

      const clean = rawText.trim().slice(0, 500);
      if (!clean) return;

      // 3. Prevent Overlapping Pending Timeouts
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }

      // Check for user switching back to AI
      if (socket.isDirectedToAgent && /^(back to ai|exit agent|talk to bot|switch to ai)$/i.test(clean)) {
        socket.isDirectedToAgent = false;
        socket.assignedAgent = null;
        socket.emit('bot:message', {
          text: "Returned to Rock View Bot AI Concierge. How can I assist you with your booking or resort inquiries?",
          chips: ['Recommend a room for a family', 'How to refund', 'Resort Amenities'],
          is_ai: true,
        });
        return;
      }

      // 4. Live Service Agent Direction Routing & Database Recording
      if (socket.isDirectedToAgent && socket.assignedAgent) {
        // Record customer message permanently into database
        const { data: savedCustomerMsg } = await admin.from('chat_messages').insert({
          profile_id: socket.userId || null,
          role: 'user',
          sender: socket.userId ? 'customer' : 'guest',
          content: clean,
          metadata: {
            directed_to_agent: true,
            is_customer: !!socket.userId,
            agent_id: socket.assignedAgent.id,
            agent_name: socket.assignedAgent.name,
            agent_role: socket.assignedAgent.role,
            saved_at: new Date().toISOString(),
          },
        }).select().single();

        // Forward to staff_agents room for real-time operator visibility
        io.to('staff_agents').emit('agent:guest_message', {
          id: savedCustomerMsg?.id || `msg-${Date.now()}`,
          profileId: socket.userId || 'guest-anon',
          guestName: socket.guestName || 'Guest Inquirer',
          text: clean,
          agentId: socket.assignedAgent.id,
          agentName: socket.assignedAgent.name,
          timestamp: new Date().toISOString(),
        });

        // Acknowledge receipt to guest
        socket.emit('agent:guest_ack', {
          messageId: savedCustomerMsg?.id,
          text: clean,
          delivered: true,
          agentName: socket.assignedAgent.name,
        });

        // Also answer informational queries without leaving guest in dark
        const reply = await answer(socket.userId, clean);
        if (reply && !reply.direct_to_agent && !reply.guardrail) {
          socket.emit('bot:message', {
            ...reply,
            text: `[Staff Agent ${socket.assignedAgent.name} is connected]

${reply.text}`,
            chips: [...(reply.chips || []), 'Back to AI'],
          });
        }

        await redis.del('analytics:overview').catch(() => {});
        return;
      }

      socket.emit('bot:typing');
      const started = Date.now();
      const reply = await answer(socket.userId, clean);

      // Check if answer directs customer to service agent
      if (reply.direct_to_agent || reply.requested_staff) {
        await handleDirectToAgent({ message: clean });
        return;
      }

      pendingTimeout = setTimeout(() => {
        if (!socket.connected) return;
        socket.emit('bot:message', reply);
        persist(socket.userId, clean, reply.text, { requested_staff: !!reply.requested_staff });
        pendingTimeout = null;
      }, Math.max(0, 550 - (Date.now() - started)));
    });

    // Handle interactive guest thumbs up / thumbs down feedback
    socket.on('chat:feedback', async (payload) => {
      try {
        const { messageId, feedback, reason, details } = payload || {};
        if (messageId && /^[0-9a-fA-F-]{36}$/.test(messageId)) {
          const { data: existing } = await admin.from('chat_messages').select('metadata').eq('id', messageId).single();
          const meta = existing?.metadata || {};
          await admin.from('chat_messages').update({
            metadata: { ...meta, feedback, reason, details, feedback_at: new Date().toISOString() }
          }).eq('id', messageId);
        } else {
          await admin.from('chat_messages').insert({
            profile_id: socket.userId || null,
            role: 'system',
            sender: 'feedback',
            content: `[Guest Feedback: ${feedback === 'thumbs_up' ? 'Helpful 👍' : 'Needs Improvement 👎'}] Reason: ${reason || 'Not specified'}${details ? ` - ${details}` : ''}`,
            metadata: { feedback, reason, details, is_feedback: true, is_positive: feedback === 'thumbs_up', created_at: new Date().toISOString() }
          });
        }
        await redis.del('analytics:overview').catch(() => {});
        socket.emit('feedback:recorded', { ok: true, feedback, reason });
      } catch (err) {
        console.warn('[Chatbot Feedback Error]', err.message);
      }
    });

    // Handle explicit guest request to connect with staff / service agent
    socket.on('chat:request_staff', async (payload) => {
      await handleDirectToAgent(payload);
    });

    // Service agent replies via socket
    socket.on('staff:reply', async (payload) => {
      try {
        const { targetProfileId, text } = payload || {};
        if (!text || !text.trim()) return;
        const cleanReply = text.trim();
        const staffName = socket.guestName || 'Front Desk Concierge';
        const staffId = socket.userId || 'staff';

        const targetPid = (targetProfileId && targetProfileId !== 'guest-anon' && /^[0-9a-fA-F-]{36}$/.test(targetProfileId)) ? targetProfileId : null;

        const { data: savedReply } = await admin.from('chat_messages').insert({
          profile_id: targetPid,
          role: 'bot',
          sender: 'service_agent',
          content: cleanReply,
          metadata: {
            is_agent: true,
            agent_id: staffId,
            agent_name: staffName,
            directed_to_agent: true,
            saved_at: new Date().toISOString(),
          },
        }).select().single();

        const targetRoom = targetPid ? `guest_${targetPid}` : 'guest_guest-anon';
        io.to(targetRoom).emit('bot:message', {
          id: savedReply?.id || `agent-reply-${Date.now()}`,
          from: 'bot',
          text: cleanReply,
          is_agent: true,
          sender: 'service_agent',
          senderName: staffName,
          agent_name: staffName,
          agent_role: 'Service Agent',
          directed_to_agent: true,
        });

        socket.emit('staff:reply_sent', { ok: true, id: savedReply?.id });
      } catch (err) {
        console.warn('[Staff Socket Reply Error]', err.message);
      }
    });

    socket.on('disconnect', () => {
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }
    });
  });
}

// Comprehensive Anti-Cross Script (XSS), Jailbreak & Exfiltration Guardrail Patterns
const ANTI_CROSS_SCRIPT_PATTERNS = [
  /<\s*\/?\s*script\b[^>]*>/i,
  /<\s*script\b/i,
  /<\s*(iframe|embed|object|link|meta|style|base|form|svg|body|input|applet)\b[^>]*>/i,
  /<\s*[a-z0-9_-]+(\s+[^>]*)?\son[a-z]{3,20}\s*=/i,
  /\bon(error|load|click|mouseover|mouseenter|mouseleave|focus|blur|change|submit|input|pointerdown|animationstart|touchstart)\s*=/i,
  /(?:javascript|vbscript|livescript)\s*:/i,
  /data\s*:\s*(?:text\/html|image\/svg\+xml)\b/i,
  /\b(?:eval|new\s+Function)\s*\(/i,
  /\b(?:document\.(?:cookie|location|write|writeln|domain)|window\.(?:location|open|localStorage|sessionStorage))\b/i,
  /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/i,
  /\[.*?\]\(\s*(?:javascript|vbscript|data):/i,
  /(?:%3c|%253c|\\x3c|\\u003c)\s*(?:script|iframe|img|svg|object|embed)/i,
  /(?:&lt;|&#60;|&#x3c;)\s*(?:script|iframe|img|svg)/i,
  /(?:%22|%27|&#34;|&#39;|&quot;).*?(?:onload|onerror|onclick)/i,
];

const BACKEND_GUARDRAIL_PATTERNS = [
  /ignore\s+(all\s+|any\s+|previous\s+|prior\s+)*(instructions|directives|prompts|rules)/i,
  /disregard\s+(all\s+|any\s+|previous\s+|prior\s+)*(instructions|directives|prompts|rules)/i,
  /you\s+are\s+now\s+(in\s+)?(developer\s+mode|dan\s+mode|unrestricted|god\s+mode|root)/i,
  /\b(act\s+as\s+dan|jailbreak|bypass\s+safety|override\s+security)\b/i,
  /(print|show|reveal|repeat|output|leak|give\s+me)\s+(your\s+)?(system\s+prompt|initial\s+instructions|internal\s+instructions)/i,
  /(what\s+is\s+your|tell\s+me\s+your)\s+(hidden\s+|system\s+)?(prompt|instruction)/i,
  /\b(gemini[-_]?api[-_]?key|supabase[-_]?(service[-_]?role|anon)?[-_]?key|jwt[-_]?secret)\b/i,
  /\b(process\.env|env\.GEMINI|env\.SUPABASE|database[-_]?password|db[-_]?password)\b/i,
  /\b(select\s+\*\s+from\s+(auth\.)?users|union\s+select|information_schema)\b/i,
  /\b(drop\s+table|delete\s+from\s+profiles)\b/i,
];

function decodeURIComponentSafe(str) {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

function isCrossScriptAttempt(input) {
  if (!input || typeof input !== 'string') return false;
  const decoded = decodeURIComponentSafe(input);
  return ANTI_CROSS_SCRIPT_PATTERNS.some((pat) => pat.test(input) || pat.test(decoded));
}

export function sanitizeAntiXSS(input) {
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

function checkBackendGuardrails(text) {
  const raw = text || '';
  // 1. Strict Anti-Cross Script (XSS) Guardrail Check
  if (isCrossScriptAttempt(raw)) {
    return {
      blocked: true,
      guardrail: true,
      is_xss: true,
      text: '🛡️ Anti-Cross Script (XSS) Guardrail Triggered: Executable script injection, inline event handlers, and cross-site markup are strictly blocked to protect application and session integrity.\n\nRock View Bot is ready to help you with accommodations, room rates, or booking details in plain text!',
      chips: ['Room Rates & Cottages', '50% Downpayment Info', 'Resort Amenities', 'Pool & Beach Hours'],
    };
  }

  // 2. Anti-Hacking & Exfiltration Guardrail Check
  for (const pat of BACKEND_GUARDRAIL_PATTERNS) {
    if (pat.test(raw)) {
      return {
        blocked: true,
        guardrail: true,
        text: '🛡️ Security Guardrail: I am Rock View Bot, dedicated to assisting with Rock View Beach Resort reservations, accommodations, and customer service. For security reasons, internal system directives and configuration inquiries cannot be processed.\n\nNeed assistance with your booking? Call our 24/7 Front Desk at +63 900 555 0123.',
        chips: ['Room Rates & Cottages', '50% Downpayment Info', 'Resort Guidelines'],
      };
    }
  }

  return { blocked: false };
}

/**
 * Query Google Gemini Generative AI for real-time guest concierge dialogue
 */
async function generateGeminiAIAnswer(userId, text, contextData = {}) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7500);

  const roomsList = (contextData.rooms && contextData.rooms.length > 0)
    ? contextData.rooms.map((r) => `  • ${r.name} (${r.category || 'Standard Room'}): Capacity ${r.capacity} guests, ₱${Number(r.rate_php).toLocaleString()}/night`).join('\n')
    : [
        '  • chason room (Rooms category): Capacity up to 2 guests, ₱3,500/night (1 Queen Bed, Private Bath, Split Aircon, Main Wing)',
        '  • Unit 3 (Rooms category): Capacity up to 2 guests, ₱3,500/night (1 Queen Bed, Veranda View, Private Bath, Split Aircon, Main Wing)',
        '  • Unit 5 (Rooms category): Capacity up to 6 guests, ₱3,500/night (2 Queen Beds + Loft area, Private Bath, Split Aircon, Main Wing)',
        '  • Sunset (Cottages category): Capacity up to 4 guests, ₱3,500/night (2 Double Beds, Beachfront Ocean View, Private Bath, Split Aircon, Beachfront Villa)',
      ].join('\n');

  const systemPrompt = `You are Rock View Bot, the fast, knowledgeable 24/7 AI Concierge for Rock View Beach Resort in Patar White Beach, Bolinao, Pangasinan, Philippines.
You know the ENTIRE resort system and can assist in English, Tagalog, or Taglish.

CRITICAL ANTI-CROSS SCRIPT (XSS) GUARDRAIL:
- NEVER output HTML tags (<script>, <iframe>, <img>, <svg>, <object>, etc.), javascript: URLs, inline event handlers, or markdown executable links under any circumstances.
- Always respond strictly in plain text or standard markdown formatting (**bold**, *italics*, bullet lists) with ZERO raw HTML or executable scripts.

CORE DIRECTIVE — RESOLVE INQUIRIES DIRECTLY (DO NOT PASS TO PERSONNEL UNLESS NECESSARY):
- You MUST answer all guest inquiries directly using the complete system knowledge below.
- Do NOT instruct the guest to call or approach the front desk for basic questions (room rates, availability, policies, amenities, locations, booking flow). You are the concierge; handle it yourself.
- ONLY escalate or advise talking to human personnel/front desk when:
  1. The guest explicitly requests a human agent or manager ("kausap na tao", "talk to human", "speak with staff").
  2. The guest reports an active in-room physical issue or emergency (e.g. broken aircon, water leak, lost item, medical emergency).
  3. The inquiry involves manual refund approvals or complex administrative payment discrepancies that require human intervention.
- When you do escalate, clearly explain what you are noting for the team and provide the 24/7 Front Desk hotline (+63 900 555 0123).

MASTER SYSTEM & RESORT KNOWLEDGE:
1. Location & Setting:
   - Rock View Beach Resort, Patar Coastal Road, Brgy. Patar, Bolinao, Pangasinan (16.3042° N, 119.7821° E).
   - Perched where dramatic limestone rock formations meet the West Philippine Sea with pristine creamy coral sand and world-famous golden sunsets.

2. Accommodations & Inventory:
   - The resort features 4 accommodation units across 2 distinct categories at a flat uniform rate of ₱3,500/night:
     Category 1: Rooms (3 units)
       • chason room: Standard Room, fits up to 2 guests, ₱3,500/night (1 Queen Bed, Private En-suite bathroom, Split Air-conditioned, Main Wing)
       • Unit 3: Standard Room, fits up to 2 guests, ₱3,500/night (1 Queen Bed, Veranda view, Private En-suite bathroom, Split Air-conditioned, Main Wing)
       • Unit 5: Family Suite, fits up to 6 guests, ₱3,500/night (2 Queen Beds + Loft area, Private En-suite bathroom, Split Air-conditioned, Main Wing)
     Category 2: Cottages (1 unit)
       • Sunset: Beachfront Cottage, fits up to 4 guests, ₱3,500/night (2 Double Beds, Beachfront ocean & sunset view, Private En-suite bathroom, Split Air-conditioned, Beachfront Villa)
   - Real-time database catalog:
${roomsList}
   - Check-in: 2:00 PM | Check-out: 12:00 NN. Complimentary early arrival luggage drop at front desk subject to room turnover.

3. Online Booking & 50% Downpayment Policy:
   - Direct conflict-free online reservations via the resort app (/#reserve or /guest).
   - 50% Downpayment required to lock and guarantee reservation via GCash, Maya, or Online Bank Transfer.
   - Remaining 50% balance settled upon check-in at the Front Desk (Cash, GCash, or Card).
   - Official booking reference (e.g. RV-BOL-2026-6362) generated upon confirmation.
   - Pricing is per room/unit per night (₱3,500/night flat), not per person. Kids 7 and under stay free with existing bedding. Senior/PWD 20% statutory room discount honored upon check-in with valid ID.

4. Resident Guest Portal (/client) & Express RFID Barcode Digital Pass:
   - Dedicated portal for guests at /client (/client/bookings, /client/profile, /client/help).
   - Features a scannable SVG Barcode & RFID Digital Keycard Pass inside the Stay Details drawer!
   - Guests can show their digital pass barcode to the Front Desk upon arrival for instant contactless room keycard issuance and zero-paperwork check-in.
   - Automated SMS with room keypad PIN sent on check-in day.

5. Staff & Management Station Hubs:
   - Operational Staff Desk (/staff / /staff/login): Front Desk Reception, Housekeeping, Kitchen, and Accounting operational consoles for live check-ins, dining orders, and room cleaning tracking.
   - Executive Portal (/admin / /admin/login): Executive management, financial ledgers, catalog and room availability management, and page settings editor.

6. Resort Amenities & Facilities:
   - Swimming Pool: Open daily 7:00 AM – 10:00 PM (regularly sanitized, night swimming allowed until 10 PM).
   - 24/7 Generator Power: Heavy-duty on-site backup generator guarantees zero brownouts for all air conditioners and lighting.
   - Beachfront Access: Direct access to Patar White Beach; safe swimming during low/mid tides, snorkeling gear available.
   - Parking: Free secure gated parking with 24/7 roving security guards and CCTV monitoring.
   - Food & Dining:
     • ZERO corkage fee on outside cooked food, snacks, and drinks!
     • Beachfront grilling stations are free for guests (bring charcoal or purchase from resort store).
     • In-house seaside kitchen serves Filipino silog breakfasts, grilled seafood (bangus, pusit, hipon), fruit shakes, and snacks.
   - Videoke & Quiet Hours: Videoke and loud audio permitted until 10:00 PM per Bolinao municipal noise ordinance. Quiet hours strictly observed after 10:00 PM.
   - Pet-Friendly: Fur-babies (dogs and cats) welcome with NO extra pet fee! Must be leashed in common areas and owners should bring pet beddings.

7. Nearby Tourist Spots in Bolinao:
   - Patar Rock Formations (5 min walk)
   - Cape Bolinao Lighthouse (10 min drive)
   - Enchanted Cave (15-20 min away)
   - Bolinao Falls 1 & 2 (25 min away)
   - Balingasay River Cruise (20 min away)

8. Refund & Cancellation Policy:
   - 100% Full Refund: Cancellations made 7+ days prior to check-in.
   - 50% Refund: Cancellations made 3 to 6 days prior.
   - Free Rebooking: Date changes accommodated free of charge based on room availability.
   - Typhoon / Force Majeure: Automatic 100% refund or free rebooking if PAGASA raises an official storm signal in Bolinao / Pangasinan.

9. Contact Hotlines:
   - 24/7 Front Desk Hotline: +63 900 555 0123
   - Viber / WhatsApp: +63 917 123 4567
   - Email: hello@jdbeachhouse.ph / support@rockviewresort.ph

COMMUNICATION STYLE:
- Direct, friendly, concise (2 to 4 sentences max). Zero corporate fluff.
- Warm Filipino hospitality ("Mabuhay!").
- At the very end of your response, on a new line, always provide 2 to 3 actionable suggestions:
SUGGESTIONS: [Option 1] | [Option 2] | [Option 3]`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${systemPrompt}\n\nGuest Stay Context:\n${JSON.stringify(contextData.guestStay || 'No active reservation on record for this user', null, 2)}\n\nGuest Inquiry: "${text}"`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 350,
    }
  };

  // High-availability verified active Gemini models
  const models = [
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
    'gemini-pro-latest',
  ];

  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) continue;
      const data = await res.json();
      clearTimeout(timeoutId);
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidateText && candidateText.trim()) {
        return candidateText.trim();
      }
    } catch {
      // Continue to next available high-tier model
    }
  }
  clearTimeout(timeoutId);
  return null;
}

/**
 * Deterministic Resort Knowledge Engine (Zero-Downtime Fallback)
 * Resolves questions with full system facts even if external AI network is unreachable.
 */
function resortKnowledgeFallback(text, rooms = []) {
  const raw = (text || '').trim();
  const t = raw.toLowerCase();
  const has = (...words) => words.some((w) => t.includes(w.toLowerCase()));

  const defaultRate = (rooms && rooms.length > 0 && Number(rooms[0].rate_php) > 0)
    ? Number(rooms[0].rate_php)
    : 3500;

  // 0A. SPECIFIC ACCOMMODATIONS & CATEGORIES (chason room, Unit 3, Unit 5, Sunset Cottage)
  if (has('chason', 'unit 3', 'unit 5', 'sunset', 'cottage', 'cottages', 'room category', 'kategorya', 'ano ang mga kwarto', 'anong kwarto', 'available rooms', 'list of rooms', 'listahan')) {
    return {
      text: `🏖️ **Mga Akomodasyon sa Rock View Beach Resort (Flat ₱${defaultRate.toLocaleString()} / gabi)**:\n\nMayroon kaming **4 accommodation units** sa **2 categories**:\n\n🏨 **Rooms Category (3 units)**:\n• **chason room**: Standard Room (up to 2 guests, 1 Queen Bed, Private En-suite bath, Split Aircon, Main Wing)\n• **Unit 3**: Standard Room (up to 2 guests, 1 Queen Bed, Veranda view, Private En-suite bath, Split Aircon, Main Wing)\n• **Unit 5**: Family Suite (up to 6 guests, 2 Queen Beds + Loft area, Private En-suite bath, Split Aircon, Main Wing)\n\n🏡 **Cottages Category (1 unit)**:\n• **Sunset**: Beachfront Cottage (up to 4 guests, 2 Double Beds, Beachfront & sunset ocean view, Private En-suite bath, Split Aircon, Beachfront Villa)\n\nLahat ay may 24/7 backup generator, libreng Wi-Fi, at swimming pool access! 50% downpayment via GCash/Maya para ma-secure ang inyong reservation pass.`,
      chips: ['Book chason room', 'Book Sunset Cottage', '50% Downpayment Info', 'Pool & Beach Hours'],
    };
  }

  // 0B. RESIDENT GUEST PORTAL, BARCODE PASS & RFID KEYCARD
  if (has('portal', 'client', 'resident', 'barcode', 'rfid', 'keycard', 'digital pass', 'my stays', 'stay details', 'pass', 'qr code', 'keypad', 'pin')) {
    return {
      text: `📱 **Resident Guest Portal (/client) & Express RFID Barcode Pass**:\n\n• **Guest Dashboard (/client)**: Dito makikita ang inyong active, upcoming, at past reservations, payment receipts, at stay details.\n• **Express RFID & Barcode Pass**: Sa loob ng inyong Stay Details drawer sa /client, may opisyal na scannable Barcode at digital pass (**RFID KEYCARD & DIGITAL PASS READY**). Pagdating sa resort, i-scan lamang ito sa Front Desk para sa instant, contactless keycard handover nang walang papeles!\n• **Keypad PIN**: Awtomatikong ipinapadala sa inyong rehistradong mobile number via SMS ang room door PIN sa araw ng check-in.\n• **Staff & Admin**: Ang operations team ay gumagamit ng /staff (Front Desk/Housekeeping) at /admin (Executive Portal) para sa real-time stay coordination.`,
      chips: ['Check My Stays (/client)', 'Room Rates & Cottages', '50% Downpayment Info', 'Contact Front Desk'],
    };
  }

  // 0C. CROSS SCRIPTING / SECURITY QUERY
  if (has('cross script', 'xss', 'script', 'inject', 'security', 'guardrail')) {
    return {
      text: `🛡️ **Security & Anti-Cross Script (XSS) Guardrail Active**:\n\nAng Rock View Resort platform ay may real-time Anti-Cross Script (XSS) guardrails, input sanitization, at session encryption para protektahan ang lahat ng mga booking data at guest accounts laban sa malicious markup o script injection.\n\nMaaari kang magtanong tungkol sa aming mga kuwarto, presyo, swimming pool, o pag-book sa Patar Beach!`,
      chips: ['Room Rates & Cottages', '50% Downpayment Info', 'Resort Amenities'],
    };
  }

  // 1. ALL ROOMS ARE UNIFORM (Disambiguate comparisons - all rooms share identical standard & amenities)
  if (has('pinagkaiba', 'difference', 'compare', 'kumpara', 'ano mas maganda', 'alin ang mas', 'pareho', 'pare-pareho', 'parehas', 'iba-iba', 'anong kaibahan')) {
    return {
      text: `🏠 **Lahat ng kuwarto sa Rock View Beach Resort ay pare-pareho ang standard at amenities**:\n\nWalang pagkakaiba sa kalidad o comfort — bawat kuwarto ay may parehong kumpletong amenities:\n• **100% Fully Air-Conditioned** na suportado ng 24/7 backup generator\n• **Private Bathroom** na may hot & cold shower\n• **Malinis na Beddings** at maaliwalas na interior\n• **Direct Access** sa swimming pool at puting buhangin ng Patar Beach\n• **Libreng High-Speed Wi-Fi** at secure gated parking\n\nUniform rate: **₱${defaultRate.toLocaleString()} / night** (50% downpayment via GCash/Maya para ma-reserve). Pare-pareho ang ganda at relaxing experience ng bawat kuwarto!`,
      chips: ['Book a Room', '50% Downpayment Info', 'Resort Amenities', 'Pool & Beach Hours'],
    };
  }

  // 2. DISCOUNTS, SENIOR CITIZEN, PWD & PROMO
  if (has('discount', 'promo', 'senior', 'pwd', 'bawas', 'mura', 'tawad', 'libre ba bata', 'bata')) {
    return {
      text: '🏷️ **Discounts & Special Rates sa Rock View Beach Resort**:\n\n• **Senior Citizen & PWD Discount**: Alinsunod sa batas ng Pilipinas (RA 9994 at RA 10754), ipinagkakaloob ang **20% statutory discount** sa kuwarto para sa lehitimong cardholders pagka-presenta ng valid Senior/PWD ID sa Front Desk upon check-in.\n• **Mga Bata (Kids)**: Libre ang accommodation para sa mga batang edad **7 taon pababa** (kasama sa existing beddings).\n• **Direct Booking Advantage**: Walang dagdag na booking surcharge o hidden service fees kapag nag-book sa aming website gamit ang 50% downpayment.',
      chips: ['Book a Room', 'Room Rates', '50% Downpayment'],
    };
  }

  // 3. PARKING & VEHICLE SAFETY
  if (has('parking', 'sasakyan', 'kotse', 'van', 'motor', 'garahe', 'park')) {
    return {
      text: '🚗 **Resort Parking & Vehicle Security**:\n\n• **Libreng Gated Parking**: May malawak at secure na paradahan ang resort para sa mga kotse, SUVs, vans, at motorsiklo ng aming mga checked-in guests at day visitors (FREE of charge!).\n• **24/7 Security**: May nakatalagang roving security guards sa gabi at CCTV cameras sa paligid ng parking grounds para sa inyong kapanatagan.',
      chips: ['How to Get Here', 'Check-in Schedule', 'Room Rates'],
    };
  }

  // 4. DAY TOUR, ENTRANCE FEE, WALK-IN & CAMPING / TENTS
  if (has('day tour', 'daytour', 'entrance', 'walk in', 'walk-in', 'camping', 'tent', 'walang reservation', 'overnight lang ba', 'pasyal lang')) {
    return {
      text: '🏖️ **Day Tour, Walk-Ins & Beach Guidelines**:\n\n• **Day Tour (8:00 AM – 5:00 PM)**: Tumatanggap kami ng day visitors! Entrance fee: ₱150/adult at ₱100/bata (inclusive of white beach and swimming pool use). May mga day picnic tables at cottages na maaaring arkilahin mula ₱800 hanggang ₱1,500.\n• **Walk-Ins**: Tumatanggap kami ng walk-in guests kung may bakanteng silid. Gayunpaman, mas mainam mag-book online nang maaga (50% downpayment) upang masigurado ang inyong kwarto lalo na tuwing weekends at holidays.\n• **Tent / Camping**: Pinapayagan ang paglatag ng sariling tent sa designated beachfront camping area (₱300–₱500 pitching fee) na may access sa common shower at CR.',
      chips: ['Book Overnight Room', 'Swimming Pool Hours', 'Directions to Resort'],
    };
  }

  // 5. ROOM APPLIANCES & AMENITIES (Ref, Heater, Aircon, Kettle, TV)
  if (has('ref', 'refrigerator', 'freezer', 'heater', 'hot water', 'shower', 'kettle', 'takure', 'tv', 'appliances')) {
    return {
      text: '🛏️ **Room Amenities & Inclusions**:\n\n• **Air Conditioning**: Lahat ng kuwarto ay 100% fully air-conditioned na may backup generator.\n• **Hot & Cold Shower**: Lahat ng kuwarto ay may sariling private bathroom na may hot & cold shower.\n• **Refrigerator / Freezer**: May malaking common refrigerator at freezer sa aming seaside kitchen na libreng gamitin ng guests para sa sariwang pagkain at inumin.\n• **Electric Kettle**: Maaaring humiram ng electric kettle sa Front Desk para sa mainit na tubig o kape.',
      chips: ['Room Rates', 'Resort Facilities', 'Food Guidelines'],
    };
  }

  // 6. CONTACT NUMBER, HOTLINE, PHONE & VIBER (Informational - Does NOT lock chat)
  if (has('number', 'cellphone', 'contact', 'telepono', 'phone', 'hotline', 'viber', 'whatsapp', 'email', 'tawag', 'tawagan')) {
    return {
      text: '🛎️ **Rock View Beach Resort 24/7 Contact Channels**:\n\n• **Front Desk Hotline**: **+63 900 555 0123**\n• **Viber / WhatsApp**: **+63 917 123 4567**\n• **Email**: support@rockviewresort.ph\n• **Address**: Front Desk Lobby, Patar White Beach, Bolinao, Pangasinan\n\nNakatutok ang aming on-site reception at front desk team 24 oras araw-araw para mag-assist sa inyong inquiries at booking!',
      chips: ['Call Front Desk (+63 900 555 0123)', 'Room Rates', 'How to Get Here'],
      contact_card: true,

      is_ai: true,
    };
  }

  // 7. STORES, PALENGKE, YELO, ULING & SUPPLIES
  if (has('tindahan', 'store', 'sari-sari', 'palengke', 'market', 'yelo', 'ice', 'uling', 'tubig', 'bilihin', 'bili')) {
    return {
      text: '🛒 **Tindahan & Lokal na Pamilihan**:\n\n• **Resort Convenience Store**: May in-house store kami na nagbebenta ng yelo, sako ng uling para sa ihawan, mineral water, softdrinks, kape, toiletries, at meryenda.\n• **Bolinao Public Market**: Kung nais ninyong mamili ng sariwang isda, bangus, pusit, hipon, at gulay, 25 minuto lamang ang Bolinao Town Market. Pwedeng dumaan bago mag-check in sa resort!',
      chips: ['Food & Grilling Guidelines', 'Directions to Resort', 'Room Rates'],
    };
  }

  // 8. SAFETY, SECURITY, GUARDS & ATMS
  if (has('safe', 'safety', 'guard', 'security', 'bantay', 'atm', 'bangko', 'cash')) {
    return {
      text: '🛡️ **Resort Safety & ATM Advisory**:\n\n• **Resort Safety**: Ligtas at tahimik ang paligid ng Rock View Beach Resort. May gated perimeter, maliwanag na ilaw, at 24/7 roving security guards.\n• **ATM Advisory**: Mahalagang paalala na WALANG ATM sa Patar Beach area. Ang pinakamalapit na mga bangko at ATM (BDO, Landbank, RCBC) ay nasa Bolinao Town Proper (25 mins mula sa resort). Pinapayuhan ang mga bisita na magdala ng sapat na cash o maghanda ng GCash/Maya bago magtungo sa beach.',
      chips: ['50% Downpayment Info', 'How to Get Here', 'Contact Front Desk'],
    };
  }

  // 9. FOOD, DRINKS, CORKAGE, GRILLING, SEASIDE DINING & PALUTO
  if (has('pagkain', 'food', 'cook', 'luto', 'lutuan', 'ihaw', 'grill', 'corkage', 'magdala', 'drinks', 'alak', 'inuman', 'beer', 'restaurant', 'almusal', 'breakfast', 'dinner', 'lunch', 'menu', 'paluto', 'gasul')) {
    return {
      text: '🍽️ **Food, Dining & Grilling Guidelines**:\n\n• **Pwedeng Magdala ng Pagkain**: Libreng magdala ng sariling cooked food, meryenda, at inumin (ZERO corkage fee!).\n• **Grilling Stations**: May mga ihawan malapit sa tabing-dagat na libreng magamit ng guests. Magdala lamang ng sariling uling o bumili sa aming sari-sari store.\n• **In-house Seaside Kitchen**: Naghahain kami ng sariwang inihaw na bangus, pusit, hipon, crispy lechon kawali, at all-day Filipino silog breakfasts.\n• **Inuman / Alak**: Pinapayagan ang inuman sa inyong kuwarto o veranda. Moderate drinking at strictly 10:00 PM quiet hours ordinance.',
      chips: ['Room Rates', 'Videoke Policy', 'Pool Hours'],
    };
  }

  // 10. SWIMMING POOL & WHITE BEACH (Including Night Swim)
  if (has('pool', 'swimming', 'liguan', 'dagat', 'beach', 'sand', 'buhangin', 'snorkeling', 'alon', 'tide', 'night swim')) {
    return {
      text: '🏊 **Swimming Pool & Patar Beachfront**:\n\n• **Pool Hours**: Bukas ang aming swimming pool araw-araw mula **7:00 AM hanggang 10:00 PM** (regular na nililinis at sanitized).\n• **Patar White Beach**: Nasa harapan lamang ng resort ang tanyag na creamy white sand ng Patar, Bolinao. Swimmable sa low at mid-tide na may crystal-clear water.\n• **Night Swim**: Bukas ang pool hanggang 10:00 PM. Ipinagbabawal ang paglangoy sa malalim na bahagi ng dagat pagdilim para sa inyong kaligtasan.',
      chips: ['Book a Stay', 'Check In Schedule', 'Cape Bolinao Lighthouse'],
    };
  }

  // 11. PETS
  if (has('pet', 'aso', 'pusa', 'dog', 'furbaby', 'hayop')) {
    return {
      text: '🐾 **Pet Policy (Pet-Friendly Resort)**:\n\n• Malugod naming tinatanggap ang inyong mga furbabies (aso at pusa) sa Rock View Beach Resort!\n• Paalala lamang na nakatali (on leash) sila sa common areas at responsibilidad ng fur-parents ang paglinis.\n• Mangyaring magdala ng sariling pet bed o banig upang mapanatiling malinis ang beddings ng kuwarto. Walang karagdagang pet fee!',
      chips: ['Book Pet-Friendly Room', 'Beach Guidelines', 'Room Rates'],
    };
  }

  // 12. VIDEOKE, MUSIC, NOISE ORDINANCE & CURFEW
  if (has('videoke', 'karaoke', 'kantahan', 'sound', 'music', 'ingay', 'quiet hour', 'curfew')) {
    return {
      text: '🎤 **Videoke, Music & Quiet Hours Policy**:\n\n• **10:00 PM Ordinance**: Pinapayagan ang videoke at musika sa mga designated areas hanggang **10:00 PM** lamang alinsunod sa lokal na barangay noise ordinance ng Bolinao.\n• **Curfew**: Walang gate curfew para sa mga nakacheck-in, ngunit pagpatak ng 10:00 PM ay pinapanatili ang katahimikan upang makapagpahinga nang mahimbing ang lahat ng guests.',
      chips: ['Resort Guidelines', 'Food & Grilling', 'Room Rates'],
    };
  }

  // 13. CHECK-IN / CHECK-OUT SCHEDULE & EARLY ARRIVAL
  if (has('check in', 'check out', 'checkin', 'checkout', 'oras', 'early check', 'late check', 'luggage', 'maaga')) {
    return {
      text: '⏰ **Check-in & Check-out Schedule**:\n\n• **Standard Check-in**: **2:00 PM**\n• **Standard Check-out**: **12:00 NN (Noon)**\n• **Early Arrival**: Kung maagang bakante at malinis na ang inyong silid, pinapayagan namin ang early check-in nang walang dagdag bayad. Pwede rin kayong mag-iwan ng gamit sa reception habang nagpapalipas ng oras sa beach o pool.',
      chips: ['Directions to Resort', 'Book a Stay', '50% Downpayment Info'],
    };
  }

  // 14. COMMUTE & DRIVING DIRECTIONS (From Manila, Dau, Pampanga, Tarlac, etc.)
  if (has('commute', 'paano pumunta', 'how to get here', 'directions', 'saan', 'location', 'address', 'route', 'bus', 'tricycle', 'waze', 'maps', 'sakay', 'transport', 'pampanga', 'dau', 'tarlac', 'clark', 'baguio', 'subic', 'la union', 'manila', 'cubao', 'pasay')) {
    return {
      text: '📍 **Paano Pumunta sa Rock View Beach Resort (Patar, Bolinao, Pangasinan)**:\n\n• **Private Vehicle (Mula Manila / Pampanga / Tarlac)**: NLEX → SCTEX → TPLEX (Exit Paniqui o Urdaneta) → Camiling → Alaminos → Bolinao. I-search sa Waze o Google Maps ang "Rock View Beach Resort Patar". May libreng gated parking.\n• **Public Bus**: Sumakay ng Victory Liner o Five Star bus (galing Cubao, Pasay, o Dau Terminal) papuntang Bolinao town proper (5–6 oras, pamasahe humigit-kumulang ₱550–₱650).\n• **Tricycle Mula Town Proper**: Mula sa Bolinao bus terminal, sumakay ng tricycle direkta sa aming resort sa Patar (25–30 mins, ₱250–₱300 kada tricycle para sa 3–4 pax kasama ang bagahe).\n• **Landmark**: Katabi ng Patar Rock Formations at 10 minuto mula sa Cape Bolinao Lighthouse.',
      chips: ['Check-in Schedule', 'Room Rates', '50% Downpayment'],
    };
  }

  // 15. TOURIST ATTRACTIONS & ITINERARY IN BOLINAO
  if (has('pasyalan', 'attraction', 'tourist', 'puntahan', 'gala', 'lighthouse', 'enchanted', 'falls', 'rock formation', 'itinerary', 'bapor', 'sightseeing', 'parola', 'kuweba', 'talon', 'river')) {
    return {
      text: '📍 **Mga Magagandang Pasyalan sa Patar, Bolinao**:\n\n1. **Patar Rock Formations**: 5 minutong lakad lamang sa tabi ng resort. Natural limestone rock arches na pinakasikat na sunset photo spot.\n2. **Cape Bolinao Lighthouse**: 10 minutong biyahe. Makasaysayang 1905 parola na may 360° panoramic view ng West Philippine Sea.\n3. **Enchanted Cave**: 15–20 minuto. Natural freshwater underground swimming pool sa loob ng kuweba.\n4. **Bolinao Falls 1 & 2**: 25 minuto. Malamig at malinaw na talon para sa swimming at cliff jumping.\n5. **Balingasay River Cruise**: 20 minuto. Binisitang mangrove river eco-tour.',
      chips: ['Cape Bolinao Lighthouse', 'Patar Rock Formations', 'Room Rates'],
    };
  }

  // 16. 50% DOWNPAYMENT & PAYMENT MECHANICS
  if (has('downpayment', 'down payment', '50%', '30%', 'paano magbayad', 'payment method', 'mode of payment', 'gcash', 'maya', 'bank transfer', 'installment', 'balance', 'balanse', 'paano mag book', 'reserve', 'reservation', 'pila ang bayad', 'per head')) {
    return {
      text: '💳 **50% Downpayment & Payment Process**:\n\n• **50% Downpayment**: Kailangan upang ma-secure at ma-guarantee ang inyong reservation slot gamit ang GCash, Maya, o Online Bank Transfer. Pagka-confirm, agad ma-iissue ang inyong opisyal na Digital Voucher at RFID booking pass.\n• **50% Remaining Balance**: Babayaran na lamang pagdating ninyo sa resort Front Desk upon check-in (Cash, GCash, o Card).\n• **Per Room, Hindi Per Head**: Ang aming mga presyo ay flat rate kada kwarto bawat gabi, kaya mas matipid para sa buong pamilya o barkada!',
      chips: ['Book a Room Now', 'Check In & Out Times', 'Refund Policy'],
    };
  }

  // 17. REFUNDS & CANCELLATION
  if (has('refund', 'soli', 'cancel', 'kanselasyon', 'ibalik ang pera')) {
    return {
      text: '📋 **Rock View Beach Resort Refund & Cancellation Policy**:\n\n• **100% Full Refund**: Kanselasyon na ginawa 7 araw o higit pa bago ang check-in date.\n• **50% Refund**: Kanselasyon 3 hanggang 6 na araw bago ang check-in.\n• **Rebooking**: Pinapayagan ang libreng rebooking ng petsa depende sa availability ng kuwarto.\n• **Typhoon / Force Majeure**: Sakaling magkaroon ng opisyal na babala ng bagyo (PAGASA storm signal), libreng full refund o free rebooking ang ipagkakaloob.',
      chips: ['How to Refund', 'Contact Front Desk', 'Room Rates'],
    };
  }

  // 18. WI-FI, 24/7 GENERATOR & AMENITIES
  if (has('wifi', 'internet', 'generator', 'kuryente', 'brownout', 'signal', 'data', 'amenities', 'facility')) {
    return {
      text: '⚡ **Resort Facilities & 24/7 Power Guarantee**:\n\n• **24/7 Heavy-Duty Generator**: Zero-brownout guarantee! Kahit mawalan ng kuryente sa bayan, laging may ilaw at tuluy-tuloy ang malamig na aircon sa mga kuwarto.\n• **High-Speed Wi-Fi**: Libreng internet access sa lobby, restaurant, at cottages.\n• **Cellular Signal**: Malakas ang 4G at 5G coverage para sa Smart at Globe.',
      chips: ['Room Rates', 'Pool Hours', 'How to Get Here'],
    };
  }

  // 19. GREETINGS & PLEASANTRIES
  if (/^(hi|hello|hey|musta|kamusta|good morning|good afternoon|good evening|magandang umaga|magandang hapon|magandang gabi|magandang araw|uy|hoy|yo)\b/i.test(t) || t === 'hi' || t === 'hello') {
    return {
      text: 'Mabuhay! Ako si Rock View Bot, ang iyong 24/7 AI Concierge dito sa Rock View Beach Resort sa Patar, Bolinao 🌊\n\nPaano kita matutulungan sa iyong beach getaway ngayon? Pwede kitang tulungan sa room rates, booking, swimming pool, in-house dining, o mga magagandang pasyalan dito sa Bolinao!',
      chips: ['🏠 Room Rates', '🏊 Swimming Pool & Beach', '💳 50% Downpayment Info', '📍 Bolinao Attractions'],
    };
  }

  // 20. ROOM RATES & NIGHTS CALCULATION (Uniform Standard Room Rate)
  if (has('room', 'rate', 'magkano', 'how much', 'price', 'villa', 'cottage', 'stay', 'capacity', 'pax', 'pamilya', 'family', 'barkada', 'couple', 'tao', 'night', 'gabi', 'bunk', 'available', 'presyo')) {
    const numMatch = t.match(/\b(\d+)\s*(pax|tao|guest|person|people|katao)?\b/);
    const count = numMatch ? parseInt(numMatch[1], 10) : 0;

    const nightsMatch = t.match(/\b(\d+)\s*(night|nights|gabi|araw)\b/);
    const nights = nightsMatch ? parseInt(nightsMatch[1], 10) : 1;

    if (count > 6) {
      const roomsNeeded = Math.ceil(count / 4);
      const total = defaultRate * roomsNeeded * nights;
      return {
        text: `🏠 **Para sa ${count} guests (${nights} night${nights > 1 ? 's' : ''})**:\n\nLahat ng aming kuwarto ay standard at pare-pareho ang amenities. Para sa inyong grupo, inirerekomenda namin ang **${roomsNeeded} rooms**:\n• Rate: ₱${defaultRate.toLocaleString()} / room kada gabi\n• Kabuuang Halaga (${roomsNeeded} rooms × ${nights} nights): **₱${total.toLocaleString()}**\n• 50% Downpayment: **₱${Math.round(total * 0.5).toLocaleString()}** (GCash/Maya)\n• 50% Balanse sa Check-in: **₱${Math.round(total * 0.5).toLocaleString()}**\n\nKasama na ang swimming pool access, white beach, 24/7 generator, at libreng parking!`,
        chips: ['Book Rooms Now', '50% Downpayment Info', 'Check-in Schedule'],
      };
    }

    if (nights > 1 || count > 0) {
      const total = defaultRate * nights;
      return {
        text: `🏠 **Resort Accommodation Rate (${nights} night${nights > 1 ? 's' : ''}${count > 0 ? `, ${count} guests` : ''})**:\n\nLahat ng kuwarto ay pare-pareho ang standard, ganda, at amenities:\n• Standard Room Rate: **₱${defaultRate.toLocaleString()} / night**\n• Kabuuang Halaga para sa ${nights} night(s): **₱${total.toLocaleString()}**\n• 50% Downpayment: **₱${Math.round(total * 0.5).toLocaleString()}** (via GCash o Maya)\n• 50% Balanse: **₱${Math.round(total * 0.5).toLocaleString()}** (upon check-in)\n\nInclusions: Fully air-conditioned room, private bathroom, swimming pool privileges, direct white beach access, at zero corkage sa pagkain!`,
        chips: ['Book a Room', '50% Downpayment Info', 'Resort Guidelines'],
      };
    }

    return {
      text: `🏠 **Mga Kuwarto at Presyo sa Rock View Beach Resort**:\n\nLahat ng aming mga silid ay pare-pareho ang standard, disenyo, at amenities:\n• **Standard Room Rate**: **₱${defaultRate.toLocaleString()} / night**\n• **Amenities**: 100% Fully air-conditioned, private bathroom, backup generator, high-speed Wi-Fi\n• **Resort Perks**: Swimming pool access (7 AM–10 PM), white beach, beachfront grilling, at libreng parking\n\nKailangan lamang ng **50% downpayment** via GCash, Maya, o Online Bank Transfer para ma-secure ang inyong reservation pass!`,
      chips: ['Book a Room', '50% Downpayment Info', 'Pool & Beach Hours', 'Directions to Resort'],
    };
  }

  // 21. RELAX / VACATION VIBES
  if (has('relax', 'pahinga', 'bakasyon', 'ganda', 'view', 'tahimik', 'chill')) {
    return {
      text: '🌊 Dito sa Rock View Beach Resort sa Patar, Bolinao, sadyang idinisenyo ang paligid para sa tahimik at unhurried na bakasyon. Ilang hakbang lamang ang puting buhangin, sariwang simoy ng hanging-dagat, at ginintuang paglubog ng araw sa West Philippine Sea.\n\nNais mo bang mag-book ng kuwarto o may iba ka pang nais itanong?',
      chips: ['🏠 Book a Room', '📍 Bolinao Attractions', '💳 50% Downpayment'],
    };
  }

  // Default Warm Helpful Local Concierge Guidance
  return {
    text: `Salamat sa inyong mensahe! Nandito ako bilang 24/7 AI Concierge ng Rock View Beach Resort sa Patar, Bolinao.\n\nMatutulungan kita sa:\n• **Kuwarto & Presyo**: Standard room rate (₱${defaultRate.toLocaleString()}/night), lahat ng kuwarto ay pare-pareho ang ganda at amenities\n• **50% Downpayment**: GCash, Maya, at Bank Transfer booking process\n• **Resort Guidelines**: Swimming pool (7 AM–10 PM), pet policy, libreng pagkain/corkage, at ihawan\n• **Bolinao Attractions**: Cape Bolinao Lighthouse, Patar Rock Formations, at Enchanted Cave\n\nAno ang nais mong malaman para sa iyong bakasyon?`,
    chips: ['🏠 Room Rates', '🏊 Pool & Amenities', '💳 50% Downpayment', '📍 Bolinao Attractions'],
  };
}

async function answer(userId, text) {
  const t = text.toLowerCase();
  try {
    // 0. Anti-Hacking & Exfiltration Guardrail Check
    const guard = checkBackendGuardrails(text);
    if (guard.blocked) {
      return guard;
    }

    // 1. Live Context Assembly (Live Inventory & Guest Stay)
    let liveRooms = [];
    try {
      const { data } = await admin.from('rooms').select('name, category, capacity, rate_php').eq('is_active', true).order('rate_php', { ascending: true });
      if (data && data.length > 0) liveRooms = data;
    } catch {}

    let userStay = null;
    if (userId) {
      try {
        const { data } = await admin.from('reservations').select('id, check_in, check_out, status, payment_status, total_php, downpayment_php, rooms(name, category)').eq('guest_id', userId).order('check_in', { ascending: false }).limit(1).single();
        if (data) userStay = data;
      } catch {}
    }

    // 2. Strict Escalation Check: ONLY pass to human personnel when beyond AI capacity or explicitly requested
    const isExplicitStaffRequest = /\b(talk to (a )?(human|person|staff|manager)|speak with (a )?(human|staff|person)|gusto ko (ng )?tao|makausap ang (staff|tao|admin|manager)|transfer to (an )?agent|connect me to (a )?(live )?agent|connect me to staff|kausap na tao)\b/i.test(t);
    const isPhysicalEmergency = /emergency|saklolo|nasusunog|magnanakaw|aircon sira|aircon not working|tulo ang tubig|baha sa kwarto|leaking pipe|hospital|police/i.test(t);

    if (isExplicitStaffRequest || isPhysicalEmergency) {
      return {
        text: isPhysicalEmergency
          ? '🚨 Nauunawaan ko ang inyong emergency / concern. Agad kong inaabisuhan ang aming 24/7 Front Desk at Maintenance team para puntahan kayo. Maaari rin kayong tumawag agad sa aming hotline: +63 900 555 0123.'
          : 'Ikinokonekta kita sa aming 24/7 Front Desk Reception at Concierge Team. Maaari mo rin silang tawagan o i-message nang direkta sa +63 900 555 0123 para sa agarang tulong.',
        chips: ['Call Front Desk (+63 900 555 0123)', 'Back to Room Inquiries'],
        is_ai: true,
        contact_card: true,
        is_concern: true,
        requested_staff: true,
        direct_to_agent: true,
      };
    }

    // 3. Query Gemini AI with Full System Knowledge
    if (env.GEMINI_API_KEY) {
      const geminiReply = await generateGeminiAIAnswer(userId, text, {
        rooms: liveRooms,
        guestStay: userStay,
        timestamp: new Date().toISOString(),
      });

      if (geminiReply) {
        let responseText = geminiReply;
        let dynamicChips = [];

        const suggestionsMatch = responseText.match(/SUGGESTIONS:\s*(.+)$/i);
        if (suggestionsMatch) {
          const rawChips = suggestionsMatch[1]
            .split('|')
            .map((s) => s.replace(/\[|\]/g, '').trim())
            .filter((s) => s.length > 0 && s.length <= 40);
          if (rawChips.length > 0) {
            dynamicChips = rawChips.slice(0, 4);
          }
          responseText = responseText.replace(/SUGGESTIONS:\s*.+$/i, '').trim();
        }

        return {
          text: sanitizeAntiXSS(responseText),
          chips: dynamicChips.length > 0 ? dynamicChips : ['Room Rates & Cottages', '50% Downpayment Info', 'Resort Amenities'],
          is_ai: true,
        };
      }
    }

    // 4. Deterministic Knowledge Fallback (Guarantees Answer with Zero 503/404 Failure)
    const fallback = resortKnowledgeFallback(text, liveRooms);
    return {
      text: fallback.text,
      chips: fallback.chips,
      is_ai: true,
    };
  } catch (err) {
    console.warn('[Chatbot Query Error]', err.message);
    const fallback = resortKnowledgeFallback(text);
    return {
      text: fallback.text,
      chips: fallback.chips,
      is_ai: true,
    };
  }
}

/**
 * Persist chat message exchange into Supabase chat_messages
 * Registered customer chats are permanently preserved; unlinked ephemeral guest chats
 * are automatically purged by database trigger once no longer needed.
 */
function persist(userId, userText, botText, extraMeta = {}) {
  const profileId = userId || null;
  admin.from('chat_messages').insert([
    {
      profile_id: profileId,
      role: 'user',
      sender: profileId ? 'customer' : 'guest',
      content: userText,
      metadata: { is_customer: !!profileId, saved_at: new Date().toISOString(), ...extraMeta },
    },
    {
      profile_id: profileId,
      role: 'bot',
      sender: 'concierge_ai',
      content: botText,
      metadata: { is_customer: !!profileId, saved_at: new Date().toISOString(), ...extraMeta },
    },
  ]).then(() => {
    redis.del('analytics:overview').catch(() => {});
  }).catch(() => {});
}

/**
 * Broadcast Real-Time Data Payload 1 over TCP WebSocket channel
 * Transmits live room lock changes, booking signals, and ledger notifications
 */
export function broadcastPayload1(topic, payload) {
  if (ioInstance) {
    ioInstance.emit('payload1:stream', { topic, data: payload, timestamp: new Date().toISOString() });
    ioInstance.emit(`payload1:${topic}`, payload);
  }
}
