import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import GuestIcon from './GuestIcon';
import { useGuestPortal } from './GuestPortalContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { queryResilientConciergeAI } from '../../lib/aiGuardrails';
import { RESORT_CONTACT, formatDateRange, stayPhase } from '../../lib/guestPortal';

interface ChatLine {
  id: string;
  from: 'user' | 'bot' | 'agent';
  text: string;
  chips?: string[];
  needsTicket?: boolean;
  agentName?: string;
}

const STARTER_CHIPS = ['Room rates', 'Check-in time', 'How to cancel', 'My booking'];
const POLL_MS = 20000;

function fromServer(row: any): ChatLine | null {
  const text = String(row?.text || '').trim();
  if (!text || text.includes('momentarily reconnecting')) return null;
  const isAgent = Boolean(row?.is_agent);
  return {
    id: String(row?.id || `srv-${Math.random().toString(36).slice(2)}`),
    from: row?.from === 'user' ? 'user' : isAgent ? 'agent' : 'bot',
    text,
    agentName: isAgent ? row?.agent_name || 'Front desk' : undefined,
  };
}

/** The assistant on the Help & support page. It is on for every signed-in guest and keeps the conversation on their account. */
export default function GuestAssistant({ onFileTicket }: { onFileTicket: (subject?: string) => void }) {
  const portal = useGuestPortal();
  const { customerSession } = useAuth();
  const token: string | undefined = customerSession?.access_token;
  const signedIn = portal.mode === 'account';

  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(signedIn);
  const listRef = useRef<HTMLDivElement>(null);

  const stays = useMemo(
    () =>
      portal.bookings.map((booking) => ({
        roomName: portal.roomFor(booking).name,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        status: booking.status,
        guests: booking.guests,
        total: booking.total,
      })),
    [portal.bookings, portal.roomFor]
  );

  const welcome = useMemo<ChatLine>(() => {
    const next = [...portal.bookings]
      .filter((b) => ['upcoming', 'current'].includes(stayPhase(b, portal.today)))
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];
    const about = next
      ? `I can see your stay at ${portal.roomFor(next).name} on ${formatDateRange(next.checkIn, next.checkOut)}. `
      : '';
    return {
      id: 'welcome',
      from: 'bot',
      text: `Mabuhay, ${portal.firstName}! ${about}Ask me about rooms and rates, check-in, cancellations, directions or your bookings. If you need a person, I can help you file a ticket.`,
      chips: STARTER_CHIPS,
    };
  }, [portal.bookings, portal.firstName, portal.roomFor, portal.today]);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api
      .myChatMessages()
      .then((rows: any[]) => {
        if (!live) return;
        const history = (Array.isArray(rows) ? rows : []).map(fromServer).filter((l): l is ChatLine => Boolean(l)).slice(-30);
        setLines(history);
      })
      .catch(() => {})
      .finally(() => live && setLoadingHistory(false));
    return () => {
      live = false;
    };
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    const timer = window.setInterval(() => {
      api
        .myChatMessages()
        .then((rows: any[]) => {
          const replies = (Array.isArray(rows) ? rows : []).map(fromServer).filter((l): l is ChatLine => Boolean(l && l.from === 'agent'));
          if (replies.length === 0) return;
          setLines((current) => {
            const known = new Set(current.map((l) => l.id));
            const fresh = replies.filter((l) => !known.has(l.id));
            return fresh.length ? [...current, ...fresh] : current;
          });
        })
        .catch(() => {});
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [signedIn]);

  const shown = lines.length > 0 ? lines : loadingHistory ? [] : [welcome];

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [shown.length, sending]);

  const lastQuestion = [...lines].reverse().find((l) => l.from === 'user')?.text;

  const ask = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    const history = shown
      .filter((l) => l.id !== 'welcome')
      .slice(-8)
      .map((l) => ({ role: l.from === 'user' ? 'user' : 'model', text: l.text }));
    setLines([...(lines.length ? lines : [welcome]), { id: `u-${Date.now()}`, from: 'user', text }]);
    setDraft('');
    setSending(true);
    try {
      const reply = await queryResilientConciergeAI(text, history, token, { firstName: portal.firstName, stays });
      const answer = String(reply?.text || '').trim() || `I could not answer that just now. Please call the front desk at ${RESORT_CONTACT.phoneDisplay} or file a ticket.`;
      setLines((current) => [
        ...current,
        {
          id: reply?.id || `b-${Date.now()}`,
          from: 'bot',
          text: answer,
          chips: Array.isArray(reply?.chips) ? reply.chips : [],
          needsTicket: Boolean(reply?.needs_ticket || reply?.contact_card),
        },
      ]);
      api.saveChatMessage({ role: 'user', content: text }).catch(() => {});
      api.saveChatMessage({ role: 'bot', content: answer }).catch(() => {});
    } finally {
      setSending(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(draft);
  };

  const lastBotIndex = shown.reduce((found, line, i) => (line.from === 'bot' ? i : found), -1);

  return (
    <section
      aria-labelledby="assistant-title"
      className="gp-animate-in gp-delay-1 mt-6 rounded-[22px] border border-white/10 bg-[#061533]/80 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.36)] backdrop-blur-md sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="assistant-title" className="text-[18px] font-semibold text-white">
            Ask Rock View
          </h2>
          <p className="mt-0.5 flex items-center gap-2 text-[13px] text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
            {signedIn ? 'Online. Your chat is saved to your account and the front desk can see it.' : 'Sign in to chat.'}
          </p>
        </div>
        {signedIn && (
          <button
            type="button"
            onClick={() => onFileTicket(lastQuestion)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 px-3.5 py-2 text-[13px] font-semibold text-sky-200 transition hover:bg-white/10"
          >
            Talk to a person
            <GuestIcon name="arrow-right" className="h-4 w-4" />
          </button>
        )}
      </div>

      {!signedIn ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-[#040e22]/90 px-5 py-6 text-center">
          <p className="text-[14.5px] text-slate-300">Sign in to your guest account and the assistant answers right here, using your own bookings.</p>
          <Link
            to="/client/login"
            className="mt-4 inline-flex rounded-lg bg-[#006699] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#005580]"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <>
          <div
            ref={listRef}
            role="log"
            aria-live="polite"
            aria-label="Conversation with the assistant"
            className="mt-4 max-h-[340px] space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-[#040e22]/90 p-4"
          >
            {loadingHistory && <p className="text-[13px] text-slate-400">Loading your conversation…</p>}
            {shown.map((line, index) => (
              <div key={line.id} className={`flex ${line.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] ${line.from === 'user' ? '' : 'w-full sm:w-auto'}`}>
                  {line.from === 'agent' && (
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-300">{line.agentName || 'Front desk'}</p>
                  )}
                  <div
                    className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed ${
                      line.from === 'user'
                        ? 'bg-[#006699] text-white'
                        : line.from === 'agent'
                        ? 'border border-emerald-500/30 bg-emerald-950/60 text-emerald-50'
                        : 'border border-white/10 bg-white/5 text-slate-100'
                    }`}
                  >
                    {line.text}
                  </div>
                  {line.needsTicket && (
                    <button
                      type="button"
                      onClick={() => onFileTicket(lastQuestion)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 px-3 py-1.5 text-[12.5px] font-semibold text-sky-200 transition hover:bg-white/10"
                    >
                      File a ticket
                    </button>
                  )}
                  {index === lastBotIndex && !sending && (line.chips?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {line.chips!.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => (chip === 'Talk to a person' ? onFileTicket(lastQuestion) : void ask(chip))}
                          className="rounded-full border border-white/15 bg-[#061533]/60 px-3 py-1.5 text-[12.5px] font-semibold text-slate-200 transition hover:border-sky-400/40 hover:text-white"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && <p className="text-[13px] text-slate-400">Rock View is typing…</p>}
          </div>

          <form onSubmit={submit} className="mt-3 flex gap-2">
            <label htmlFor="gp-assistant-input" className="sr-only">
              Ask a question
            </label>
            <input
              id="gp-assistant-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={300}
              placeholder="Ask about rooms, rates, check-in, your booking…"
              className="h-12 min-w-0 flex-1 rounded-xl border border-white/20 bg-[#040e22]/90 px-4 text-[15px] text-white outline-none placeholder:text-slate-400 focus:border-[#38BDF8] focus:ring-4 focus:ring-sky-500/20"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-[#006699] px-5 text-[14.5px] font-semibold text-white transition hover:bg-[#005580] disabled:opacity-50"
            >
              Send
              <GuestIcon name="arrow-right" className="h-4 w-4" />
            </button>
          </form>
        </>
      )}
    </section>
  );
}
