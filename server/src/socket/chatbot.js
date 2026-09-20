import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { admin } from '../lib/supabase.js';

const CHIPS = ['Room rates', 'Weekend availability', 'Amenities', 'How to get there'];

export function attachChatbot(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: [env.CLIENT_ORIGIN], credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        socket.userId = jwt.verify(token, env.SUPABASE_JWT_SECRET,
          { audience: 'authenticated' }).sub;
      } catch { /* guest */ }
    }
    next();
  });

  io.on('connection', (socket) => {
    socket.emit('bot:message', {
      text: "Mabuhay! I'm J & D Bot 🌊 Ask me about room rates, availability, amenities, or getting to Bolinao.",
      chips: CHIPS,
    });
    socket.on('chat:message', async ({ text }) => {
      socket.emit('bot:typing');
      const started = Date.now();
      const clean = String(text || '').slice(0, 500);
      const reply = await answer(socket.userId, clean);
      setTimeout(() => {
        socket.emit('bot:message', reply);
        persist(socket.userId, clean, reply.text);
      }, Math.max(0, 650 - (Date.now() - started)));
    });
  });
}

const iso = (d) => d.toISOString().slice(0, 10);

async function answer(userId, text) {
  const t = text.toLowerCase();
  try {
    if (/rate|price|cost|how much|magkano/.test(t)) {
      const { data, error } = await admin.from('rooms')
        .select('name, capacity, rate_php').eq('is_active', true)
        .order('rate_php').limit(6);
      if (error || !data || data.length === 0) {
        return { text: 'No rooms are listed in the database right now.', chips: CHIPS };
      }
      return {
        text: `Room rates (per night) ✦\n${data.map((s) => `• ${s.name} — sleeps ${s.capacity} — ₱${s.rate_php.toLocaleString()}`).join('\n')}`,
        chips: ['Weekend availability', 'Amenities'],
      };
    }
    if (/available|availability|vacan|weekend|room for|slot/.test(t)) {
      let inD, outD;
      if (/weekend/.test(t)) {
        const d = new Date();
        d.setDate(d.getDate() + (((6 - d.getDay()) + 7) % 7 || 7));
        inD = iso(d); outD = iso(new Date(d.getTime() + 2 * 86400000));
      } else {
        inD = iso(new Date(Date.now() + 86400000));
        outD = iso(new Date(Date.now() + 3 * 86400000));
      }
      const { data, error } = await admin.rpc('available_rooms',
        { p_check_in: inD, p_check_out: outD, p_guests: 1 });
      if (error || !data?.length) {
        return { text: `No rooms available ${inD} → ${outD} in database. 🏖️`, chips: ['Room rates'] };
      }
      return {
        text: `Available ${inD} → ${outD} 🌊\n${data.map((x) => `• ${x.name} — ₱${x.rate_php.toLocaleString()}/night — ${x.units_left} left`).join('\n')}`,
        chips: ['Room rates', 'How to get there'],
      };
    }
    if (/my booking|my reservation|status|booked/.test(t)) {
      if (!userId) return { text: 'Sign in to view your reservation.', chips: CHIPS };
      const { data: b } = await admin.from('reservations')
        .select('*, rooms(name)').eq('guest_id', userId)
        .order('check_in', { ascending: false }).limit(1).single();
      if (!b) return { text: 'No stays found in your account.', chips: ['Weekend availability'] };
      return { text: `Latest stay: ${b.rooms?.name || 'Reservation'} · ${b.check_in} → ${b.check_out} · ${b.guests} guest(s) · ${b.status.replace('_', ' ').toUpperCase()}`, chips: ['Amenities'] };
    }
    if (/amenit|pool|breakfast|wifi|parking|food/.test(t)) {
      return { text: 'Resort perks ✦ beachfront on Tambak, restaurant (bangus specials!), tour desk for Bolinao Falls + Enchanted Cave + Patar island hopping, free parking, WiFi in all rooms, 24/7 front desk.', chips: ['Room rates'] };
    }
    if (/where|location|get there|direction|manila|address|how.*reach/.test(t)) {
      return { text: 'From Manila: 4–5 hrs by car via SCTEX/TPLEX to Bolinao, Pangasinan; or bus to Alaminos, then van/tricycle. We are on Tambak Beach Road — 5 minutes from Cape Bolinao Lighthouse. 🗺️', chips: ['Room rates', 'Weekend availability'] };
    }
    if (/cancel/.test(t)) return { text: 'Open My Bookings → Cancel. Free before arrival; you get an SMS ping instantly.', chips: ['My booking'] };
    if (/check.?in|check.?out|hour|time/.test(t)) return { text: 'Check-in 2:00 PM · check-out 12:00 NN · front desk is open 24/7.', chips: ['Weekend availability'] };
    if (/human|agent|staff|call/.test(t)) return { text: 'Pinged the front desk 📟 We’ll SMS you shortly. Urgent? +63 900 555 0123.', chips: [] };
    if (/^(hi|hello|hey|kumusta)/.test(t)) return { text: 'Kumusta! Rates, availability, or directions to Bolinao?', chips: CHIPS };
    return { text: 'Ask me about room rates, availability, amenities, or directions:', chips: CHIPS };
  } catch {
    return { text: 'Database query failed.', chips: CHIPS };
  }
}

function persist(userId, userText, botText) {
  if (!userId) return;
  admin.from('chat_messages').insert([
    { profile_id: userId, role: 'user', content: userText },
    { profile_id: userId, role: 'bot', content: botText },
  ]).then(() => {});
}
