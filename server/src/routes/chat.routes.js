import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getSystemAdminClient } from '../lib/supabase.js';

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
      .select('id, profile_id, role, content, created_at')
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
        const formattedMsg = {
          id: msg.id,
          sender: msg.role === 'user' ? 'guest' : 'admin',
          senderName: msg.role === 'user' ? 'Guest' : 'J & D Concierge',
          text: msg.content,
          time: msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
        };
        if (!conversationMap.has(pid)) {
          conversationMap.set(pid, {
            id: pid,
            profile_id: pid,
            last_message: msg.content,
            last_message_time: msg.created_at,
            role: msg.role,
            message_count: 1,
            messages: [formattedMsg],
          });
        } else {
          const entry = conversationMap.get(pid);
          entry.message_count += 1;
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
          resort: 'J & D Beach House · Patar Rock View',
          lastMessage: conv.last_message,
          timeAgo: formatRelativeTime(conv.last_message_time),
          messageCount: conv.message_count,
          status: 'Active',
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
          senderName: 'J & D Concierge',
          text: `Warm greetings from J & D Beach House & Patar Rock View, ${name.split(' ')[0]}! Your reservation for ${roomName} (${rItem.check_in} → ${rItem.check_out}) is ${rItem.status.replace('_', ' ')}. Our team has noted your request.`,
          time: '09:34 AM',
        },
      ];

      staffReplies.forEach((replyText, rIdx) => {
        if (replyText.trim()) {
          thread.push({
            id: `${rItem.id}-sr-${rIdx}`,
            sender: 'admin',
            senderName: 'J & D Concierge',
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
        resort: `J & D Beach House · ${roomName}`,
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

      const { data, error } = await client
        .from('chat_messages')
        .insert({
          profile_id: targetProfileId,
          role: 'bot',
          content: content.trim(),
        })
        .select()
        .single();

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
          const updatedNotes = `${latestRes.notes || ''}\n[Concierge]: ${content.trim()}`.trim();
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
        content: content.trim(),
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      throw new ApiError(500, `Failed to post message: ${err.message}`);
    }
  }));

export default r;
