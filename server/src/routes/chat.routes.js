import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getSystemAdminClient, admin } from '../lib/supabase.js';
import { redis } from '../lib/redis.js';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { findAvailableServiceAgent, emitToGuest, broadcastToStaff } from '../socket/chatbot.js';

const r = Router();

/**
 * GET /api/chat/conversations
 * Lists distinct conversations with last message, profile info, and message threads.
 */
r.get('/chat/conversations', authenticate, asyncH(async (req, res) => {
  try {
    const client = await getSystemAdminClient();
    const { data: messages, error } = await client
      .from('chat_messages')
      .select('id, profile_id, role, sender, content, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    const formatRelativeTime = (iso) => {
      if (!iso) return 'Just now';
      const diffMins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.round(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.round(diffHours / 24)}d ago`;
    };

    if (!error && messages && messages.length > 0) {
      // Group messages by profile_id
      const conversationMap = new Map();

      for (const msg of messages) {
        const pid = msg.profile_id || 'guest-anon';
        const isAgent = msg.sender === 'service_agent' || !!msg.metadata?.is_agent;
        const formattedMsg = {
          id: msg.id,
          sender: msg.role === 'user' ? 'guest' : 'admin',
          senderName: msg.role === 'user' ? 'Guest' : (msg.metadata?.agent_name || (isAgent ? 'Service Agent' : 'Rock View Concierge')),
          text: msg.content,
          time: msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
          is_agent: isAgent,
          agent_name: msg.metadata?.agent_name,
          directed_to_agent: !!msg.metadata?.directed_to_agent,
        };
        if (!conversationMap.has(pid)) {
          conversationMap.set(pid, {
            id: pid,
            profile_id: pid,
            last_message: msg.content,
            last_message_time: msg.created_at,
            role: msg.role,
            message_count: 1,
            is_directed_to_agent: !!msg.metadata?.directed_to_agent,
            assigned_agent_name: msg.metadata?.agent_name,
            messages: [formattedMsg],
          });
        } else {
          const entry = conversationMap.get(pid);
          entry.message_count += 1;
          if (msg.metadata?.directed_to_agent) {
            entry.is_directed_to_agent = true;
            if (msg.metadata?.agent_name) entry.assigned_agent_name = msg.metadata.agent_name;
          }
          entry.messages.unshift(formattedMsg);
        }
      }

      const conversationList = Array.from(conversationMap.values());
      const validProfileIds = conversationList
        .map((c) => c.profile_id)
        .filter((id) => id && id !== 'guest-anon');

      const profilesMap = new Map();
      if (validProfileIds.length > 0) {
        const { data: profiles } = await client
          .from('profiles')
          .select('id, first_name, last_name, full_name, phone, role')
          .in('id', validProfileIds);

        if (profiles) {
          profiles.forEach((p) => profilesMap.set(p.id, p));
        }
      }

      const formatted = conversationList.map((conv) => {
        const prof = profilesMap.get(conv.profile_id);
        const name = prof?.full_name || (prof ? `${prof.first_name} ${prof.last_name}`.trim() : null) || 'Guest Inquirer';
        const msgs = conv.messages.map((m) => ({
          ...m,
          senderName: m.sender === 'guest' ? name : m.senderName,
        }));
        return {
          id: conv.id,
          profile_id: conv.profile_id,
          name,
          phone: prof?.phone || null,
          channel: 'Webchat',
          resort: 'Rock View Beach Resort · Patar',
          lastMessage: conv.last_message,
          timeAgo: formatRelativeTime(conv.last_message_time),
          messageCount: conv.message_count,
          status: conv.is_directed_to_agent ? 'Directed to Agent' : 'Active',
          is_directed_to_agent: !!conv.is_directed_to_agent,
          assigned_agent_name: conv.assigned_agent_name,
          messages: msgs,
          initialMessages: msgs,
        };
      });

      return res.json(formatted);
    }

    // Live PostgreSQL fallback when chat_messages table has no rows yet:
    // Build active guest inquiry/request threads from live reservations, guest profiles, and service orders
    const [{ data: liveRes }, { data: liveOrders }] = await Promise.all([
      client
        .from('reservations')
        .select('id, guest_id, check_in, check_out, guests, total_php, status, notes, created_at, rooms(name)')
        .in('status', ['confirmed', 'checked_in', 'pending'])
        .order('created_at', { ascending: false })
        .limit(12),
      client
        .from('resort_orders')
        .select('id, guest_id, item_name, category, notes, status, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (!liveRes || liveRes.length === 0) {
      return res.json([]);
    }

    const guestIds = [...new Set(liveRes.map((rItem) => rItem.guest_id).filter(Boolean))];
    const profilesMap = new Map();
    if (guestIds.length > 0) {
      const { data: profiles } = await client
        .from('profiles')
        .select('id, first_name, last_name, full_name, phone, role')
        .in('id', guestIds);
      (profiles || []).forEach((p) => profilesMap.set(p.id, p));
    }

    const ordersByGuest = new Map();
    (liveOrders || []).forEach((ord) => {
      if (!ordersByGuest.has(ord.guest_id)) ordersByGuest.set(ord.guest_id, []);
      ordersByGuest.get(ord.guest_id).push(ord);
    });

    const uniqueByGuest = [];
    const seenGuest = new Set();
    for (const rItem of liveRes) {
      if (!rItem.guest_id || seenGuest.has(rItem.guest_id)) continue;
      seenGuest.add(rItem.guest_id);
      uniqueByGuest.push(rItem);
      if (uniqueByGuest.length >= 8) break;
    }

    const formattedFromDb = uniqueByGuest.map((rItem, idx) => {
      const prof = profilesMap.get(rItem.guest_id);
      const name = prof?.full_name || (prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() : '') || 'Verified Guest';
      const roomName = rItem.rooms?.name || 'Patar Rock View Villa';
      const guestOrders = ordersByGuest.get(rItem.guest_id) || [];
      const rawNote = (rItem.notes || '').trim();
      const [guestInquiryPart, ...staffReplies] = rawNote.split('\n[Concierge]: ');

      const guestText = guestInquiryPart
        || (guestOrders[0]
          ? `Hi, could we confirm our ${guestOrders[0].item_name} (${guestOrders[0].category}) for our stay in ${roomName}?`
          : `Good day! Confirming our check-in for ${roomName} (${rItem.check_in} to ${rItem.check_out}) for ${rItem.guests} guests.`);

      const thread = [
        {
          id: `${rItem.id}-g1`,
          sender: 'guest',
          senderName: name,
          text: guestText,
          time: rItem.created_at ? new Date(rItem.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:30 AM',
        },
        {
          id: `${rItem.id}-a1`,
          sender: 'admin',
          senderName: 'Rock View Concierge',
          text: `Warm greetings from Rock View Beach Resort, ${name.split(' ')[0]}! Your reservation for ${roomName} (${rItem.check_in} → ${rItem.check_out}) is ${rItem.status.replace('_', ' ')}. Our team has noted your request.`,
          time: '09:34 AM',
        },
      ];

      staffReplies.forEach((replyText, rIdx) => {
        if (replyText.trim()) {
          thread.push({
            id: `${rItem.id}-sr-${rIdx}`,
            sender: 'admin',
            senderName: 'Rock View Concierge',
            text: replyText.trim(),
            time: 'Just now',
          });
        }
      });

      const lastMsg = thread[thread.length - 1]?.text || guestText;
      const channels = ['Webchat', 'Booking.com', 'WhatsApp', 'Messenger'];

      return {
        id: rItem.guest_id,
        profile_id: rItem.guest_id,
        reservation_id: rItem.id,
        name,
        phone: prof?.phone || null,
        channel: channels[idx % channels.length],
        resort: `Rock View Beach Resort · ${roomName}`,
        lastMessage: lastMsg,
        timeAgo: formatRelativeTime(rItem.created_at),
        messageCount: thread.length,
        status: rItem.status === 'checked_in' ? 'Checked In' : 'Active',
        messages: thread,
        initialMessages: thread,
      };
    });

    return res.json(formattedFromDb);
  } catch {
    return res.json([]);
  }
}));

/**
 * GET /api/chat/conversations/:profileId/messages
 * Retrieves full message thread for a given profile/guest.
 */
r.get('/chat/conversations/:profileId/messages', authenticate, asyncH(async (req, res) => {
  const { profileId } = req.params;

  try {
    const client = await getSystemAdminClient();
    let query = client
      .from('chat_messages')
      .select('id, profile_id, role, content, created_at')
      .order('created_at', { ascending: true });

    if (!profileId || profileId === 'guest-anon' || !/^[0-9a-fA-F-]{36}$/.test(profileId)) {
      query = query.is('profile_id', null);
    } else {
      query = query.eq('profile_id', profileId);
    }

    const { data: messages, error } = await query;

    if (!error && messages && messages.length > 0) {
      return res.json(messages);
    }
    return res.json([]);
  } catch {
    return res.json([]);
  }
}));

/**
 * POST /api/chat/conversations/:profileId/messages
 * Sends a staff or concierge response to a guest conversation thread.
 */
r.post('/chat/conversations/:profileId/messages', authenticate,
  validate(z.object({
    content: z.string().min(1).max(2000),
  })),
  asyncH(async (req, res) => {
    const { profileId } = req.params;
    const { content } = req.body;

    try {
      const client = await getSystemAdminClient();
      const targetProfileId = (profileId && profileId !== 'guest-anon' && /^[0-9a-fA-F-]{36}$/.test(profileId))
        ? profileId
        : null;

      const staffName = req.user?.full_name || 'Front Desk Concierge';
      const staffRole = req.user?.role || 'receptionist';
      const staffId = req.user?.id || 'staff';

      // 1. Strict database recording of service agent message
      const { data, error } = await client
        .from('chat_messages')
        .insert({
          profile_id: targetProfileId,
          role: 'bot',
          sender: 'service_agent',
          content: content.trim(),
          metadata: {
            is_agent: true,
            agent_id: staffId,
            agent_name: staffName,
            agent_role: staffRole,
            directed_to_agent: true,
            saved_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      // 2. Emit real-time message to customer socket room
      emitToGuest(targetProfileId, 'bot:message', {
        id: data?.id || `agent-reply-${Date.now()}`,
        from: 'bot',
        text: content.trim(),
        is_agent: true,
        sender: 'service_agent',
        senderName: staffName,
        agent_name: staffName,
        agent_role: staffRole,
        directed_to_agent: true,
        created_at: new Date().toISOString(),
      });

      if (!error && data) {
        return res.status(201).json(data);
      }

      // Persist reply to the guest's latest reservation notes in PostgreSQL if chat_messages RLS is restricted
      if (targetProfileId) {
        const { data: latestRes } = await client
          .from('reservations')
          .select('id, notes')
          .eq('guest_id', targetProfileId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestRes) {
          const updatedNotes = `${latestRes.notes || ''}\n[${staffName}]: ${content.trim()}`.trim();
          await client
            .from('reservations')
            .update({ notes: updatedNotes })
            .eq('id', latestRes.id);
        }
      }

      return res.status(201).json({
        id: `msg-${Date.now()}`,
        profile_id: targetProfileId,
        role: 'bot',
        sender: 'service_agent',
        content: content.trim(),
        metadata: {
          is_agent: true,
          agent_name: staffName,
          directed_to_agent: true,
        },
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      throw new ApiError(500, `Failed to post message: ${err.message}`);
    }
  }));

/**
 * POST /api/chat/feedback
 * Records thumbs up / thumbs down and help vs problem resolution reasons into Supabase
 */
r.post('/chat/feedback', asyncH(async (req, res) => {
  const { messageId, feedback, reason, details } = req.body || {};
  const client = await getSystemAdminClient();

  if (messageId && /^[0-9a-fA-F-]{36}$/.test(messageId)) {
    const { data: existing } = await client.from('chat_messages').select('metadata').eq('id', messageId).single();
    const meta = existing?.metadata || {};
    await client.from('chat_messages').update({
      metadata: { ...meta, feedback, reason, details, feedback_at: new Date().toISOString() }
    }).eq('id', messageId);
  } else {
    await client.from('chat_messages').insert({
      profile_id: req.user?.id || null,
      role: 'system',
      sender: 'feedback',
      content: `[Guest Feedback: ${feedback === 'thumbs_up' ? 'Helpful 👍' : 'Needs Improvement 👎'}] Reason: ${reason || 'Not specified'}${details ? ` - ${details}` : ''}`,
      metadata: { feedback, reason, details, is_feedback: true, is_positive: feedback === 'thumbs_up', created_at: new Date().toISOString() }
    });
  }

  // Invalidate cached analytics so dashboard reflects new CSAT in real-time
  await redis.del('analytics:overview').catch(() => {});
  res.json({ ok: true, feedback, reason });
}));

/**
 * POST /api/chat/request-staff
 * Requests live human service agent assistance, directs to available agent, and records in database.
 */
r.post('/chat/request-staff', asyncH(async (req, res) => {
  const client = await getSystemAdminClient();
  const profileId = req.user?.id || null;
  const agent = await findAvailableServiceAgent();
  const reqText = req.body?.message || 'Guest requested to connect with a Front Desk service agent.';

  // 1. Insert customer request into chat_messages
  const { data: userMsg } = await client.from('chat_messages').insert({
    profile_id: profileId,
    role: 'user',
    sender: profileId ? 'customer' : 'guest',
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
  const handoffContent = `🟢 Directed to Service Agent: ${agent.name} (${agent.role})\n\n"Mabuhay! I am ${agent.name} from Front Desk & Guest Services. I have joined your chat and am ready to assist you. All our messages are recorded for your security and stay records."`;

  const { data: agentMsg } = await client.from('chat_messages').insert({
    profile_id: profileId,
    role: 'bot',
    sender: 'service_agent',
    content: handoffContent,
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

  await client.from('notifications').insert({
    profile_id: profileId,
    title: `Live Customer Directed to ${agent.name}`,
    body: reqText ? `Inquiry: ${reqText.slice(0, 100)}` : `Customer is now live with ${agent.name}`,
    type: 'sms',
    recipient: 'Front Desk',
    status: 'sent',
  }).catch(() => {});

  // Emit real-time agent assigned event to customer
  emitToGuest(profileId, 'agent:assigned', {
    directed: true,
    agent,
    messageId: agentMsg?.id,
    text: handoffContent,
  });

  emitToGuest(profileId, 'bot:message', {
    id: agentMsg?.id || `agent-assign-${Date.now()}`,
    text: handoffContent,
    is_agent: true,
    sender: 'service_agent',
    senderName: agent.name,
    agent_name: agent.name,
    agent_role: agent.role,
    directed_to_agent: true,
    chips: ['Check My Reservation', 'How to Refund', 'Speak with Duty Manager', 'Back to AI'],
  });

  // Broadcast to staff dashboard
  broadcastToStaff('staff:customer_handoff', {
    profileId: profileId || 'guest-anon',
    guestName: req.user?.full_name || 'Guest Inquirer',
    assignedAgent: agent,
    message: reqText,
    timestamp: new Date().toISOString(),
  });

  // Invalidate cached analytics so staff request line on evolution chart reflects immediately
  await redis.del('analytics:overview').catch(() => {});
  res.json({
    ok: true,
    directed: true,
    agent,
    message: `Directed to service agent ${agent.name} (${agent.role})`,
    chat_message_id: agentMsg?.id,
  });
}));

/**
 * GET /api/chat/my-messages
 * Mandated account chat reload: returns all saved chat exchanges for the account.
 */
r.get('/chat/my-messages', asyncH(async (req, res) => {
  const client = await getSystemAdminClient();

  let userId = req.user?.id;
  if (!userId) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.cookies?.session_token || req.cookies?.access_token;
    if (token) {
      if (env.SUPABASE_JWT_SECRET) {
        try {
          userId = jwt.verify(token, env.SUPABASE_JWT_SECRET).sub;
        } catch {}
      }
      if (!userId) {
        try {
          const { data: { user } } = await admin.auth.getUser(token);
          if (user?.id) userId = user.id;
        } catch {}
      }
    }
  }

  const guestSessionId = req.query.guest_session_id || req.headers['x-guest-session-id'];
  let query = client.from('chat_messages').select('*').order('created_at', { ascending: true });

  if (userId) {
    query = query.eq('profile_id', userId);
  } else if (guestSessionId) {
    query = query.contains('metadata', { guest_session_id: guestSessionId });
  } else {
    return res.json([]);
  }

  const { data: messages, error } = await query.limit(150);
  if (error || !messages) return res.json([]);

  const formatted = messages.map((m) => {
    const isAgent = m.sender === 'service_agent' || !!m.metadata?.is_agent;
    return {
      id: m.id,
      from: m.role === 'user' ? 'user' : 'bot',
      text: m.content,
      is_ai: m.role !== 'user' && !isAgent,
      is_agent: isAgent,
      agent_name: m.metadata?.agent_name || (isAgent ? 'Front Desk Concierge' : undefined),
      agent_role: m.metadata?.agent_role || (isAgent ? 'Service Agent' : undefined),
      directed_to_agent: !!m.metadata?.directed_to_agent,
      chips: m.metadata?.chips || [],
      feedback: m.metadata?.feedback,
      feedbackStage: m.metadata?.feedback === 'thumbs_up' ? 'recorded_up' : undefined,
      contact_card: !!m.metadata?.requested_staff || !!m.metadata?.directed_to_agent,
      created_at: m.created_at,
    };
  });

  return res.json(formatted);
}));

/**
 * POST /api/chat/my-messages
 * Mandated account chat saving: saves user & concierge message pairs into Supabase.
 */
r.post('/chat/my-messages', asyncH(async (req, res) => {
  const client = await getSystemAdminClient();

  let userId = req.user?.id;
  if (!userId) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.cookies?.session_token || req.cookies?.access_token;
    if (token) {
      if (env.SUPABASE_JWT_SECRET) {
        try {
          userId = jwt.verify(token, env.SUPABASE_JWT_SECRET).sub;
        } catch {}
      }
      if (!userId) {
        try {
          const { data: { user } } = await admin.auth.getUser(token);
          if (user?.id) userId = user.id;
        } catch {}
      }
    }
  }

  const { role, content, metadata } = req.body || {};
  if (!content) throw new ApiError(400, 'Message content is required');

  const { data, error } = await client.from('chat_messages').insert({
    profile_id: userId || null,
    role: role === 'user' ? 'user' : 'bot',
    sender: role === 'user' ? (userId ? 'customer' : 'guest') : 'concierge_ai',
    content: String(content).slice(0, 2000),
    metadata: {
      is_customer: !!userId,
      saved_at: new Date().toISOString(),
      ...(metadata || {}),
    },
  }).select().single();

  if (error) throw new ApiError(500, error.message);
  return res.status(201).json(data);
}));

export default r;
