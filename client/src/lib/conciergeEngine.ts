/**
 * Answers guest questions from facts the resort already holds: the live room list, the guest's own
 * stays and the stay rules shown on the site. It needs no outside service, so the assistant can
 * always reply, even when the AI service is down or has no key.
 */

export interface ConciergeRoom {
  name: string;
  category?: string;
  offering_type?: string;
  capacity?: number;
  rate_php?: number;
}

export interface ConciergeStay {
  roomName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  guests?: number;
  total?: number;
}

export interface ConciergeContact {
  phone: string;
  checkIn: string;
  checkOut: string;
  address: string;
  mapsUrl: string;
}

export interface ConciergeContext {
  rooms: ConciergeRoom[];
  stays: ConciergeStay[];
  /** Today in Manila, YYYY-MM-DD. */
  today: string;
  signedIn: boolean;
  firstName?: string;
  contact: ConciergeContact;
}

export interface ConciergeAnswer {
  text: string;
  chips: string[];
  /** The guest asked for a person or reported a problem: show the front desk contact and the ticket form. */
  needsPerson?: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUS_LABEL: Record<string, string> = {
  pending: 'waiting for confirmation',
  confirmed: 'confirmed',
  checked_in: 'checked in',
  checked_out: 'completed',
  disputed: 'under review',
};
const MAX_LIST = 6;

const byRateThenName = (a: ConciergeRoom, b: ConciergeRoom) =>
  Number(a.rate_php) - Number(b.rate_php) || String(a.name).localeCompare(String(b.name), undefined, { numeric: true });

const money = (amount: number | undefined) => '₱' + Math.round(Number(amount) || 0).toLocaleString('en-US');

function dateLabel(iso: string): string {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${MONTHS[m - 1]} ${d}`;
}

function rangeLabel(checkIn: string, checkOut: string): string {
  const year = String(checkOut || checkIn || '').slice(0, 4);
  return `${dateLabel(checkIn)} – ${dateLabel(checkOut)}, ${year}`;
}

const isCottage = (room: ConciergeRoom) =>
  room.offering_type === 'cottage' || /cottage|cabana/i.test(`${room.category || ''} ${room.name || ''}`);

const unitLine = (room: ConciergeRoom) =>
  `• ${room.name} — ${money(room.rate_php)} / night${room.capacity ? ` · up to ${room.capacity} ${room.capacity === 1 ? 'guest' : 'guests'}` : ''}`;

/** "family of 4", "5 pax", "4 people", "kami ay 6". Returns 0 when no party size is given. */
export function partySizeIn(text: string): number {
  const patterns = [
    /\b(?:family|group|party|barkada)\s+(?:of|na)\s+(\d{1,2})\b/i,
    /\b(\d{1,2})\s*(?:pax|people|persons?|guests?|adults?|kids?|children|tao|katao)\b/i,
    /\b(?:kami|kaming|for|good for|fit)\s+(?:ay\s+)?(\d{1,2})\b(?!\s*(?:night|nights|day|days|hour|hours|gabi|araw))/i,
  ];
  for (const pattern of patterns) {
    const found = text.match(pattern);
    if (found) {
      const size = Number(found[1]);
      if (size >= 1 && size <= 60) return size;
    }
  }
  return 0;
}

type UnitKind = 'room' | 'cottage' | undefined;

function roomsForParty(size: number, ctx: ConciergeContext, kind: UnitKind): ConciergeAnswer {
  const priced = ctx.rooms.filter((room) => Number(room.capacity) > 0);
  const wanted = priced.filter((room) => (kind === 'cottage' ? isCottage(room) : kind === 'room' ? !isCottage(room) : true));
  const fits = wanted.filter((room) => Number(room.capacity) >= size).sort(byRateThenName);
  if (fits.length > 0) {
    const fitRooms = fits.filter((room) => !isCottage(room)).slice(0, 3);
    const fitCottages = fits.filter(isCottage).slice(0, 3);
    const blocks = [
      fitRooms.length ? `Rooms:\n${fitRooms.map(unitLine).join('\n')}` : '',
      fitCottages.length ? `Cottages:\n${fitCottages.map(unitLine).join('\n')}` : '',
    ].filter(Boolean);
    return {
      text: `For ${size} ${size === 1 ? 'guest' : 'guests'}, these fit:\n\n${blocks.join('\n\n')}\n\nOn the booking page we suggest the smallest open room that fits everyone, and the calendar shows which nights are open.`,
      chips: ['Room rates', 'How to cancel', 'Check-in time'],
    };
  }
  const biggestFirst = [...priced].sort((a, b) => Number(b.capacity) - Number(a.capacity));
  const combo: ConciergeRoom[] = [];
  let seats = 0;
  for (const room of biggestFirst) {
    if (seats >= size || combo.length >= 4) break;
    combo.push(room);
    seats += Number(room.capacity);
  }
  if (seats >= size) {
    return {
      text: `No single room holds ${size} guests. You can book more than one room for the same dates, for example ${combo.map((room) => `${room.name} (up to ${room.capacity})`).join(' + ')}. On the booking page, turn on "Book more than one room", and your guests are shared across the rooms.`,
      chips: ['Room rates', 'Where is the resort'],
    };
  }
  return {
    text: `That is a big group. Please call the front desk at ${ctx.contact.phone} so we can arrange it, or file a ticket and we will get back to you.`,
    chips: ['Talk to a person'],
    needsPerson: true,
  };
}

function ratesAnswer(ctx: ConciergeContext): ConciergeAnswer {
  const rooms = ctx.rooms.filter((room) => !isCottage(room)).sort(byRateThenName);
  const cottages = ctx.rooms.filter(isCottage).sort(byRateThenName);
  if (ctx.rooms.length === 0) {
    return {
      text: `I cannot load the room list right now. Please check again in a moment, or call the front desk at ${ctx.contact.phone}.`,
      chips: ['Talk to a person'],
    };
  }
  const blocks: string[] = [];
  if (rooms.length) blocks.push(`Rooms:\n${rooms.slice(0, MAX_LIST).map(unitLine).join('\n')}`);
  if (cottages.length) blocks.push(`Cottages:\n${cottages.slice(0, MAX_LIST).map(unitLine).join('\n')}`);
  const more = rooms.length > MAX_LIST || cottages.length > MAX_LIST ? '\n\nThe booking page lists every room.' : '';
  return {
    text: `${blocks.join('\n\n')}${more}\n\nTell me how many guests are coming and I will suggest a room.`,
    chips: ['Room for 4 guests', 'Check-in time', 'How to cancel'],
  };
}

function staysAnswer(ctx: ConciergeContext): ConciergeAnswer {
  if (!ctx.signedIn) {
    return {
      text: 'Sign in to your guest account and I can show your bookings here. You can also open My stays from the menu.',
      chips: ['Room rates', 'Check-in time'],
    };
  }
  const live = ctx.stays.filter((stay) => stay.status !== 'cancelled');
  if (live.length === 0) {
    return {
      text: 'I do not see any bookings on your account yet. Pick your dates on the booking page and your stay will show up under My stays.',
      chips: ['Room rates', 'Room for 4 guests'],
    };
  }
  const sorted = [...live].sort((a, b) => {
    const aUpcoming = a.checkOut >= ctx.today ? 0 : 1;
    const bUpcoming = b.checkOut >= ctx.today ? 0 : 1;
    return aUpcoming - bUpcoming || a.checkIn.localeCompare(b.checkIn);
  });
  const lines = sorted.slice(0, 3).map(
    (stay) =>
      `• ${stay.roomName} — ${rangeLabel(stay.checkIn, stay.checkOut)} · ${STATUS_LABEL[stay.status] || stay.status}${stay.total ? ` · ${money(stay.total)}` : ''}`
  );
  return {
    text: `${ctx.firstName ? `${ctx.firstName}, here` : 'Here'} ${live.length === 1 ? 'is your booking' : 'are your bookings'}:\n${lines.join('\n')}\n\nOpen My stays for the full details, including your keypad PIN.`,
    chips: ['How to cancel', 'Check-in time', 'Talk to a person'],
  };
}

const has = (text: string, pattern: RegExp) => pattern.test(text);

export function answerFromResortFacts(question: string, ctx: ConciergeContext): ConciergeAnswer {
  const text = String(question || '').trim();
  const lower = text.toLowerCase();
  const { contact } = ctx;

  if (!text) {
    return { text: 'Ask me about rooms and rates, check-in, cancellations, directions or your bookings.', chips: ['Room rates', 'Check-in time'] };
  }

  const reportsProblem =
    /\b(human|agent|staff|(?:real|live|a) person|someone|receptionist|manager|ticket|complain|complaint|reklamo|problem|issue|broken|sira|emergency|urgent|asap)\b/.test(lower) ||
    /\b(not working|isn'?t working|doesn'?t work|won'?t work|stopped working|no (?:water|power|electricity|hot water|aircon|wifi|wi-fi)|leak|leaking|dirty|smell|noisy|damaged|stolen|lost my|walang (?:tubig|kuryente|aircon))\b/.test(lower);
  if (reportsProblem) {
    return {
      text: `I will get you to the front desk. For anything urgent, call ${contact.phone}. Otherwise file a ticket below with the details, and the team will reply to you here.`,
      chips: ['Room rates', 'How to cancel'],
      needsPerson: true,
    };
  }

  if (has(lower, /^(hi|hello|hey|good (morning|afternoon|evening)|kumusta|musta|mabuhay)\b/) && lower.split(/\s+/).length <= 5) {
    return {
      text: `Mabuhay${ctx.firstName ? `, ${ctx.firstName}` : ''}! I can help with rooms and rates, check-in and check-out, cancellations, directions and your bookings. What would you like to know?`,
      chips: ['Room rates', 'Check-in time', 'How to cancel', 'My booking'],
    };
  }

  if (has(lower, /\b(thanks|thank you|thx|salamat)\b/)) {
    return { text: 'You are welcome! Is there anything else I can help with?', chips: ['Room rates', 'Where is the resort'] };
  }

  if (has(lower, /\b(my (booking|bookings|reservation|reservations|stay|stays)|booking status|reservation status|reference|saan ang booking)\b/)) {
    return staysAnswer(ctx);
  }

  if (has(lower, /\b(cancel|cancellation|refund|ibalik|i-cancel)\b/)) {
    return {
      text: 'You can cancel an upcoming stay yourself: open My stays, choose the stay, then Cancel booking. Cancel within 5 hours of booking and you get a full refund. After that the refund is 50%. If something unusual came up, like bad weather, file a ticket or call the front desk and we will look at it.',
      chips: ['Talk to a person', 'Check-in time'],
    };
  }

  if (has(lower, /\b(pin|keypad|lock|self check|self-check)\b/)) {
    return {
      text: `Each room has a keypad lock. Your PIN is in your stay details on the device you booked with, and it is sent by SMS on check-in day. It works from ${contact.checkIn} on your arrival date.`,
      chips: ['Check-in time', 'My booking'],
    };
  }

  if (has(lower, /\b(check[- ]?in|check[- ]?out|arrival|arrive|early|late|what time|anong oras)\b/)) {
    return {
      text: `Check-in is from ${contact.checkIn} and check-out is by ${contact.checkOut}. Need an early arrival or a late check-out? Call the front desk at ${contact.phone} and we will see what is possible.`,
      chips: ['Room rates', 'Where is the resort'],
    };
  }

  if (has(lower, /\b(pay|payment|gcash|maya|downpayment|down payment|deposit|bayad|card|cash|bank)\b/)) {
    return {
      text: 'You are not charged online when you reserve. The booking page shows your total and the 50% downpayment before you confirm, and the balance is settled at the resort. We accept cash, GCash, Maya and card. For the downpayment steps, call the front desk or file a ticket.',
      chips: ['How to cancel', 'Talk to a person'],
    };
  }

  if (has(lower, /\b(where|location|direction|directions|how to get|address|map|saan|malapit|bolinao|patar|lighthouse|route)\b/)) {
    return {
      text: `We are on ${contact.address}. It is about 4 minutes to Patar White Beach and 6 minutes to the Cape Bolinao Lighthouse.\nMap: ${contact.mapsUrl}`,
      chips: ['Check-in time', 'Room rates'],
    };
  }

  const party = partySizeIn(text);
  if (party > 0) {
    const kind: UnitKind = /\b(cottage|cottages|cabana)\b/.test(lower) ? 'cottage' : /\b(room|rooms|kwarto)\b/.test(lower) ? 'room' : undefined;
    return roomsForParty(party, ctx, kind);
  }

  if (has(lower, /\b(wifi|wi-fi|internet|pool|swim|amenit|facility|facilities|parking|pet|pets|beach|food|restaurant|breakfast|kuryente|power)\b/)) {
    return {
      text: `Every stay includes Wi-Fi with solar backup power and a keypad lock for self check-in. We are right by the beach and have a swimming pool. For details like pool hours, parking, pets or food, call the front desk at ${contact.phone}.`,
      chips: ['Room rates', 'Where is the resort'],
    };
  }

  if (has(lower, /\b(room|rooms|cottage|cottages|rate|rates|price|prices|cost|magkano|presyo|how much|available|availability|vacant|vacancy|book|booking|reserve|reservation|stay)\b/)) {
    const askedAvailability = has(lower, /\b(available|availability|vacant|vacancy|open)\b/);
    const answer = ratesAnswer(ctx);
    return askedAvailability
      ? {
          ...answer,
          text: `Open nights show on the booking calendar, so you always see live availability. ${answer.text}`,
        }
      : answer;
  }

  return {
    text: `I am not sure about that one. I can help with rooms and rates, check-in and check-out, cancellations, directions and your bookings. For anything else, file a ticket and the front desk will reply, or call ${contact.phone}.`,
    chips: ['Room rates', 'Check-in time', 'How to cancel', 'Talk to a person'],
    needsPerson: true,
  };
}
