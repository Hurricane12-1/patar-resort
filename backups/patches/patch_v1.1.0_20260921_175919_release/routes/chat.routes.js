import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { admin } from '../lib/supabase.js';

const r = Router();

/**
 * GET /api/chat/conversations
 * Lists distinct conversations with last message, profile info, and unread counts.
 */
r.get('/chat/conversations', authenticate, asyncH(async (req, res) => {
  try {
    // Fetch recent chat messages from database
    const { data: messages, error } = await admin
      .from('chat_messages')
      .select('id, profile_id, role, content, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error || !messages || messages.length === 0) {
      return res.json([]);
    }

    // Group messages by profile_id
    const conversationMap = new Map();

    for (const msg of messages) {
      const pid = msg.profile_id || 'guest-anon';
      if (!conversationMap.has(pid)) {
        conversationMap.set(pid, {
          id: pid,
          profile_id: pid,
          last_message: msg.content,
          last_message_time: msg.created_at,
          role: msg.role,
          message_count: 1,
        });
      } else {
        const entry = conversationMap.get(pid);
        entry.message_count += 1;
      }
    }

    const conversationList = Array.from(conversationMap.values());
    const validProfileIds = conversationList
      .map((c) => c.profile_id)
      .filter((id) => id && id !== 'guest-anon');

    // Fetch guest profile information
    let profilesMap = new Map();
    if (validProfileIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, first_name, last_name, full_name, phone, role')
        .in('id', validProfileIds);

      if (profiles) {
        profiles.forEach((p) => profilesMap.set(p.id, p));
      }
    }

    // Format conversations with real guest profiles
    const formatted = conversationList.map((conv) => {
      const prof = profilesMap.get(conv.profile_id);
      const name = prof?.full_name || (prof ? `${prof.first_name} ${prof.last_name}`.trim() : null) || 'Guest Inquirer';
      return {
        id: conv.id,
        profile_id: conv.profile_id,
        name,
        phone: prof?.phone || null,
        channel: 'Webchat',
        resort: 'J & D Beach House',
        lastMessage: conv.last_message,
        timeAgo: conv.last_message_time,
        messageCount: conv.message_count,
        status: 'Active',
      };
    });

    return res.json(formatted);
  } catch (err) {
    // If table is empty or error occurs, return clean empty list
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
    const { data: messages, error } = await admin
      .from('chat_messages')
      .select('id, profile_id, role, content, created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return res.json(messages || []);
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
      const { data, error } = await admin
        .from('chat_messages')
        .insert({
          profile_id: profileId,
          role: 'bot',
          content: content.trim(),
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    } catch (err) {
      throw new ApiError(500, `Failed to post message: ${err.message}`);
    }
  }));

export default r;
