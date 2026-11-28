import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import GuestIcon, { type GuestIconName } from '../../components/guest/GuestIcon';
import GuestAssistant from '../../components/guest/GuestAssistant';
import { PROBLEM_TOPIC, useGuestPortal } from '../../components/guest/GuestPortalContext';
import { toast } from '../../components/Toasts';
import { RESORT_CONTACT, formatDateRange, formatRelativeTime, stayPhase, type GuestTicket } from '../../lib/guestPortal';

const CARD_SHADOW = 'shadow-[0_8px_32px_rgba(0,0,0,0.36)]';

type FaqTopic = 'Booking & rooms' | 'Changes & cancellation' | 'Arrival' | 'Payments' | 'During your stay' | 'Tickets';

const FAQ_TOPICS: FaqTopic[] = ['Booking & rooms', 'Changes & cancellation', 'Arrival', 'Payments', 'During your stay', 'Tickets'];

const FAQS: { topic: FaqTopic; q: string; a: string }[] = [
  {
    topic: 'Booking & rooms',
    q: 'How is my room chosen?',
    a: "Tell us your dates and how many adults and children are coming. We suggest the smallest open room that fits everyone, based on each room's current capacity. You can also pick a room yourself. We only let you book rooms that fit your party and are free on your dates.",
  },
  {
    topic: 'Booking & rooms',
    q: 'Do children count toward room capacity?',
    a: "Yes. Adults and children (ages 2–12) count toward a room's capacity. Infants under 2 stay free and don't count.",
  },
  {
    topic: 'Booking & rooms',
    q: 'Where can I see my booking?',
    a: "Under My stays, as soon as you reserve. If you booked without signing in, the booking is kept on the device you used. Sign in to a resident account to see reservations linked to your email on any device.",
  },
  {
    topic: 'Changes & cancellation',
    q: 'Can I change my dates, room, or number of guests?',
    a: 'Send a request below or call the front desk. We check availability for the new dates or room and confirm the change with you.',
  },
  {
    topic: 'Changes & cancellation',
    q: 'What is the cancellation policy?',
    a: 'Cancellation is free up to 7 days before check-in. Cancel from your stay details under My stays. Closer to arrival, the front desk will tell you if any terms apply.',
  },
  {
    topic: 'Arrival',
    q: 'What time are check-in and check-out?',
    a: `Check-in is from ${RESORT_CONTACT.checkInTime} and check-out is by ${RESORT_CONTACT.checkOutTime}. Ask the front desk if you need an early arrival or a late check-out.`,
  },
  {
    topic: 'Arrival',
    q: 'How does self check-in work?',
    a: `Each room has a keypad lock. Your PIN appears in your stay details on the device you booked with and is sent by SMS on check-in day. It works from ${RESORT_CONTACT.checkInTime} on your arrival date.`,
  },
  {
    topic: 'Arrival',
    q: 'How do I get to the resort?',
    a: "We're on Patar Coastal Road in Brgy. Patar, Bolinao, Pangasinan, about 4 minutes from Patar White Beach. Use Get directions on this page for turn-by-turn navigation.",
  },
  {
    topic: 'Payments',
    q: 'When will I be charged?',
    a: 'Not when you book. You settle your stay at the resort using cash, GCash, Maya, or card.',
  },
  {
    topic: 'Payments',
    q: 'Are my saved payment methods safe?',
    a: 'Saved payment methods keep only the brand, the last 4 digits, and the expiry, and only on your device. We never ask for your CVV or PIN online.',
  },
  {
    topic: 'During your stay',
    q: 'Is there Wi-Fi and backup power?',
    a: 'Yes. Every stay includes Wi-Fi, and the resort has solar backup power.',
  },
  {
    topic: 'During your stay',
    q: "Something isn't right with my room. What should I do?",
    a: `Call or text the front desk at ${RESORT_CONTACT.phoneDisplay}, or file a "${PROBLEM_TOPIC}" ticket below so our guest recovery team can follow up.`,
  },
  {
    topic: 'Tickets',
    q: 'Who can file a ticket?',
    a: 'Only guests who have booked a room or cottage. A ticket is always about one of your own bookings, so you choose the booking when you file it. Cancelled bookings cannot be used.',
  },
  {
    topic: 'Tickets',
    q: 'How do I file a ticket?',
    a: 'Open File a ticket on this page, pick your booking, choose a category and how urgent it is, then add a short title and the details. When you press File ticket, your ticket gets a tracking ID.',
  },
  {
    topic: 'Tickets',
    q: 'What is the tracking ID?',
    a: 'Every ticket gets its own number in the form R-000-000-001. The next ticket is R-000-000-002, and the number keeps counting up on its own. Quote it when you call or text so the front desk can find your ticket straight away.',
  },
  {
    topic: 'Tickets',
    q: 'What do Open, In progress, Resolved and Closed mean?',
    a: 'Open: we have it and nobody has picked it up yet. In progress: a staff member is working on it. Resolved: we think it is done. Closed: the front desk closed it. You see the status under Your tickets.',
  },
  {
    topic: 'Tickets',
    q: 'How do I rate a ticket or reopen it?',
    a: 'When a ticket is Resolved, Your tickets shows a rating from 1 to 5 and a box for feedback. If the problem is not actually solved, choose Not solved? Reopen and the front desk gets it again.',
  },
  {
    topic: 'Tickets',
    q: 'Is there a limit on tickets?',
    a: 'You can have up to 5 open tickets at once. For an emergency at the resort, call the front desk first.',
  },
];

const REQUEST_TOPICS = ['Change my dates', 'Change room or guests', 'Cancellation or refund', 'Payment question', PROBLEM_TOPIC, 'Something else'];

export default function GuestHelp() {
  const portal = useGuestPortal();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const presetBooking = searchParams.get('booking') || '';
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<FaqTopic | 'All'>('All');
  const [ticketSubject, setTicketSubject] = useState('');
  const formRef = useRef<HTMLElement>(null);
  const wantsTicket = location.hash === '#file-ticket' || searchParams.get('ticket') === '1';

  useEffect(() => {
    if (!presetBooking && !wantsTicket) return;
    const timer = window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    return () => window.clearTimeout(timer);
  }, [presetBooking, wantsTicket]);

  const openTicketForm = (subject?: string) => {
    if (subject) setTicketSubject(subject);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const term = query.trim().toLowerCase();
  const faqs = FAQS.filter((f) => (topic === 'All' || f.topic === topic) && (!term || `${f.q} ${f.a}`.toLowerCase().includes(term)));

  const contactCards: { icon: GuestIconName; title: string; detail: string; href: string; external?: boolean }[] = [
    { icon: 'phone', title: 'Call the front desk', detail: RESORT_CONTACT.phoneDisplay, href: `tel:${RESORT_CONTACT.phoneHref}` },
    { icon: 'message', title: 'Send a text', detail: 'SMS the front desk', href: `sms:${RESORT_CONTACT.phoneHref}` },
    { icon: 'mail', title: 'Email the resort', detail: RESORT_CONTACT.email, href: `mailto:${RESORT_CONTACT.email}?subject=${encodeURIComponent('Rock View guest question')}` },
    { icon: 'navigation', title: 'Get directions', detail: 'Brgy. Patar, Bolinao', href: RESORT_CONTACT.mapsUrl, external: true },
  ];

  return (
    <div>
      <section className="gp-animate-in relative overflow-hidden rounded-[26px] border border-white/10 bg-gradient-to-r from-[#061533] via-[#040e22] to-[#081d45] px-6 py-8 text-white sm:px-10 sm:py-10 shadow-[0_8px_32px_rgba(0,0,0,0.36)]">
        <img src="/images/hero.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#061533] via-[#061533]/85 to-transparent" />
        <div className="relative max-w-2xl">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#38BDF8]">Help & support</p>
          <h1 className="gp-display mt-2 text-[30px] font-semibold leading-tight text-white sm:text-[40px]">How can we help, {portal.firstName}?</h1>
          <p className="mt-2 text-[15px] text-slate-300">Answers to common questions, or reach the front desk directly.</p>
          <label htmlFor="gp-help-search" className="sr-only">
            Search help topics
          </label>
          <div className="relative mt-6">
            <GuestIcon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="gp-help-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search: check-in time, cancellation, PIN…"
              className="h-12 w-full rounded-2xl border border-white/20 bg-[#040e22]/90 pl-12 pr-4 text-[15px] text-white outline-none placeholder:text-slate-400 focus:border-[#38BDF8] focus:ring-4 focus:ring-sky-500/20"
            />
          </div>
        </div>
      </section>

      <GuestAssistant onFileTicket={openTicketForm} />

      <section aria-label="Contact the resort" className="gp-animate-in gp-delay-1 mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {contactCards.map((card) => (
          <a
            key={card.title}
            href={card.href}
            {...(card.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="group flex flex-col gap-3 rounded-[20px] border border-white/10 bg-[#061533]/80 backdrop-blur-md p-4 transition hover:border-sky-400/50 hover:shadow-[0_8px_30px_rgba(14,165,233,0.18)] sm:flex-row sm:items-center sm:p-5"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-500/15 text-[#38BDF8] transition group-hover:bg-gradient-to-r group-hover:from-[#0284C7] group-hover:to-[#2563EB] group-hover:text-white shadow-[0_0_12px_rgba(56,189,248,0.25)]">
              <GuestIcon name={card.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[14.5px] font-semibold text-white">{card.title}</span>
              <span className="block truncate text-[12.5px] text-slate-400">{card.detail}</span>
            </span>
          </a>
        ))}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-labelledby="faq-title" className="gp-animate-in gp-delay-2 min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="faq-title" className="text-[21px] font-semibold tracking-[-0.02em] text-white">
              Frequently asked
            </h2>
            <p className="text-[13px] text-slate-400">
              {faqs.length} answer{faqs.length === 1 ? '' : 's'}
              {term ? ` for “${query.trim()}”` : ''}
            </p>
          </div>
          <div className="gp-scroll-x -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {(['All', ...FAQ_TOPICS] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={topic === t}
                onClick={() => setTopic(t)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${
                  topic === t ? 'border-[#0EA5E9] bg-gradient-to-r from-[#0284C7] to-[#2563EB] text-white shadow-[0_0_12px_rgba(14,165,233,0.35)]' : 'border-white/15 bg-[#061533]/60 text-slate-300 hover:border-sky-400/40 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className={`mt-5 overflow-hidden rounded-[22px] border border-white/10 bg-[#061533]/80 backdrop-blur-md ${CARD_SHADOW}`}>
            {faqs.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-[15px] font-semibold text-white">No answers match your search</p>
                <p className="mt-1 text-[13.5px] text-slate-400">Try another word, or send the front desk a request.</p>
              </div>
            ) : (
              faqs.map((faq) => (
                <details key={faq.q} className="group border-b border-white/10 last:border-b-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/5 sm:px-6 [&::-webkit-details-marker]:hidden">
                    <span>
                      <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#38BDF8]">{faq.topic}</span>
                      <span className="mt-0.5 block text-[15px] font-semibold text-white">{faq.q}</span>
                    </span>
                    <GuestIcon name="chevron-down" className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="px-5 pb-5 text-[14.5px] leading-relaxed text-slate-300 sm:px-6">{faq.a}</p>
                </details>
              ))
            )}
          </div>
        </section>

        <div className="min-w-0 space-y-6">
          <RequestForm presetBooking={presetBooking} presetSubject={ticketSubject} sectionRef={formRef} />
          <TicketList />
          <TicketGuidelines />
          <ResortInfo />
        </div>
      </div>
    </div>
  );
}

function RequestForm({
  presetBooking,
  presetSubject,
  sectionRef,
}: {
  presetBooking: string;
  presetSubject: string;
  sectionRef: RefObject<HTMLElement>;
}) {
  const portal = useGuestPortal();
  const bookingOptions = useMemo(
    () =>
      [...portal.bookings]
        .filter((b) => b.dbId && stayPhase(b, portal.today) !== 'cancelled')
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
        .map((b) => ({
          id: b.id,
          label: `${portal.roomFor(b).name} · ${formatDateRange(b.checkIn, b.checkOut)}`,
        })),
    [portal.bookings, portal.roomFor, portal.today]
  );
  const eligible = portal.mode === 'account' && bookingOptions.length > 0;
  const [bookingId, setBookingId] = useState(presetBooking);
  const [topic, setTopic] = useState(REQUEST_TOPICS[0]);
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState<GuestTicket | null>(null);

  useEffect(() => {
    if (presetBooking) setBookingId(presetBooking);
  }, [presetBooking]);

  useEffect(() => {
    if (!bookingId && bookingOptions.length > 0) setBookingId(bookingOptions[0].id);
  }, [bookingId, bookingOptions]);

  useEffect(() => {
    if (presetSubject) setSubject(presetSubject.slice(0, 80));
  }, [presetSubject]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!bookingId) {
      setError('Choose the booking this ticket is about.');
      return;
    }
    if (subject.trim().length < 4) {
      setError('Give your ticket a short title (at least 4 characters).');
      return;
    }
    if (message.trim().length < 10) {
      setError('Tell us a little more (at least 10 characters).');
      return;
    }
    setError('');
    setSending(true);
    try {
      const ticket = await portal.fileTicket({ bookingId, topic, subject, message, priority });
      setLastSent(ticket);
      setSubject('');
      setMessage('');
      setPriority('normal');
      toast(`Ticket ${ticket.tracking_id} filed`);
    } catch (err: any) {
      setError(String(err?.message || 'We could not file your ticket. Please try again, or call the front desk.'));
    } finally {
      setSending(false);
    }
  };

  const fieldClass =
    'mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-[#040e22]/90 px-3 text-[14.5px] text-white outline-none focus:border-[#38BDF8] focus:ring-2 focus:ring-sky-500/20';

  return (
    <section
      id="file-ticket"
      ref={sectionRef}
      aria-labelledby="request-title"
      className={`scroll-mt-28 rounded-[22px] border border-white/10 bg-[#061533]/80 backdrop-blur-md p-5 sm:p-6 ${CARD_SHADOW}`}
    >
      <h2 id="request-title" className="text-[18px] font-semibold text-white">
        File a ticket
      </h2>
      <p className="mt-1 text-[13.5px] text-slate-400">
        For changes, refunds, problems with your room, or anything the assistant cannot settle. Every ticket gets a tracking ID like R-000-000-001.
      </p>

      {!eligible ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-[#040e22]/90 px-4 py-5 text-[14px] leading-relaxed text-slate-300">
          <p className="font-semibold text-white">Tickets are for guests with a booking.</p>
          <p className="mt-1">
            {portal.mode === 'account'
              ? 'Once you have booked a room or cottage, you can file a ticket about that stay here.'
              : 'Sign in to your guest account. Once you have booked a room or cottage, you can file a ticket about that stay.'}
          </p>
          <Link
            to={portal.mode === 'account' ? { pathname: '/', hash: '#reserve' } : '/client/login'}
            className="mt-3 inline-flex rounded-lg bg-[#006699] px-4 py-2 text-[13.5px] font-semibold text-white transition hover:bg-[#005580]"
          >
            {portal.mode === 'account' ? 'Book a stay' : 'Sign in'}
          </Link>
        </div>
      ) : (
        <>
          {lastSent && (
            <div className="mt-4 flex gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/60 px-4 py-3 text-[13.5px] text-emerald-200" role="status">
              <GuestIcon name="check" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
              <p>
                Ticket <span className="font-mono font-semibold">{lastSent.tracking_id}</span> is filed. Quote this ID when you call. The front desk will reply here and in your chat above.
              </p>
            </div>
          )}

          <form onSubmit={submit} noValidate className="mt-5 space-y-4">
            <div>
              <label htmlFor="gp-request-booking" className="block text-[12.5px] font-semibold text-slate-300">
                Booking
              </label>
              <select id="gp-request-booking" value={bookingId} onChange={(e) => setBookingId(e.target.value)} className={fieldClass}>
                {bookingOptions.map((option) => (
                  <option key={option.id} value={option.id} className="bg-[#040e22] text-white">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="gp-request-topic" className="block text-[12.5px] font-semibold text-slate-300">
                Category
              </label>
              <select id="gp-request-topic" value={topic} onChange={(e) => setTopic(e.target.value)} className={fieldClass}>
                {REQUEST_TOPICS.map((t) => (
                  <option key={t} value={t} className="bg-[#040e22] text-white">
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="block p-0 text-[12.5px] font-semibold text-slate-300">How urgent is it?</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {(['normal', 'urgent'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={priority === level}
                    onClick={() => setPriority(level)}
                    className={`h-11 rounded-xl border px-3 text-[14px] font-semibold transition ${
                      priority === level
                        ? level === 'urgent'
                          ? 'border-rose-400 bg-rose-950/70 text-rose-100'
                          : 'border-[#38BDF8] bg-[#006699] text-white'
                        : 'border-white/15 bg-[#040e22]/90 text-slate-300 hover:border-sky-400/40'
                    }`}
                  >
                    {level === 'urgent' ? 'Urgent (I am at the resort)' : 'Normal'}
                  </button>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="gp-request-subject" className="block text-[12.5px] font-semibold text-slate-300">
                Title
              </label>
              <input
                id="gp-request-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={80}
                placeholder="For example: move my stay one day later"
                className={`${fieldClass} placeholder:text-slate-500`}
              />
            </div>
            <div>
              <label htmlFor="gp-request-message" className="block text-[12.5px] font-semibold text-slate-300">
                Details
              </label>
              <textarea
                id="gp-request-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={800}
                placeholder="Tell us what happened and what you need."
                aria-invalid={error ? true : undefined}
                className={`mt-1.5 w-full resize-y rounded-xl border bg-[#040e22]/90 px-3.5 py-3 text-[14.5px] text-white outline-none placeholder:text-slate-500 focus:border-[#38BDF8] focus:ring-2 focus:ring-sky-500/20 ${error ? 'border-rose-500/50' : 'border-white/15'}`}
              />
              {error && <p className="mt-1 text-[12px] text-rose-400">{error}</p>}
            </div>
            <button type="submit" disabled={sending} className="w-full rounded-xl bg-[#006699] py-3 text-[14.5px] font-semibold text-white transition hover:bg-[#005580] disabled:opacity-60">
              {sending ? 'Filing…' : 'File ticket'}
            </button>
            <p className="text-[12px] leading-relaxed text-slate-400">
              Read <a href="#ticket-guidelines" className="font-semibold text-[#38BDF8] hover:underline">how tickets work</a> below. For anything urgent, call {RESORT_CONTACT.phoneDisplay}.
            </p>
          </form>
        </>
      )}
    </section>
  );
}

const STATUS_LABEL: Record<string, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };

function TicketList() {
  const portal = useGuestPortal();
  const { tickets } = portal;
  if (!tickets.length) return null;

  return (
    <section aria-labelledby="requests-title" className="rounded-[22px] border border-white/10 bg-[#061533]/80 backdrop-blur-md p-5 sm:p-6">
      <h2 id="requests-title" className="text-[16px] font-semibold text-white">
        Your tickets
      </h2>
      <ul className="mt-4 space-y-3">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}
      </ul>
    </section>
  );
}

function TicketCard({ ticket }: { ticket: GuestTicket }) {
  const portal = useGuestPortal();
  const [stars, setStars] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const resolved = ticket.status === 'resolved';
  const active = ticket.status === 'open' || ticket.status === 'in_progress';

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err: any) {
      setError(String(err?.message || 'That did not go through. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-2xl border border-white/10 bg-[#040e22]/90 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[12px] font-semibold tracking-tight text-[#38BDF8]">{ticket.tracking_id}</p>
          <p className="text-[14px] font-semibold text-white">{ticket.subject}</p>
          <p className="text-[12.5px] text-slate-400">
            {ticket.category}
            {ticket.room_name ? ` · ${ticket.room_name}` : ''} · {formatRelativeTime(ticket.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
              active ? 'border-emerald-500/30 bg-emerald-950/60 text-emerald-300' : 'border-slate-500/40 bg-slate-800/70 text-slate-300'
            }`}
          >
            {STATUS_LABEL[ticket.status] || ticket.status}
          </span>
          {ticket.priority === 'urgent' && active && (
            <span className="rounded-full border border-rose-500/40 bg-rose-950/60 px-2.5 py-0.5 text-[11px] font-semibold text-rose-200">Urgent</span>
          )}
        </div>
      </div>
      <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-slate-300">{ticket.details}</p>
      {(ticket.handlers?.length ?? 0) > 0 && (
        <p className="mt-2 text-[12.5px] text-slate-400">
          Handled by{' '}
          {ticket.handlers!.map((h) => (h.employee_id ? `${h.name} (${h.employee_id})` : h.name)).join(', ')}
        </p>
      )}
      {resolved && ticket.resolution_note && (
        <p className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-slate-200">Reply: {ticket.resolution_note}</p>
      )}

      {resolved && !ticket.rating && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="text-[13px] font-semibold text-white">How was the help you got?</p>
          <div className="mt-1.5 flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={stars === n}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                onClick={() => setStars(n)}
                className={`h-9 w-9 rounded-lg border text-[15px] font-bold transition ${stars >= n ? 'border-amber-400 bg-amber-500/20 text-amber-300' : 'border-white/15 text-slate-400 hover:border-white/30'}`}
              >
                {n}
              </button>
            ))}
          </div>
          <label htmlFor={`fb-${ticket.id}`} className="sr-only">
            Feedback
          </label>
          <textarea
            id={`fb-${ticket.id}`}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Anything we could do better? (optional)"
            className="mt-2 w-full resize-y rounded-xl border border-white/15 bg-[#061533]/60 px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-slate-500 focus:border-[#38BDF8]"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || stars === 0}
              onClick={() => run(() => portal.rateTicket(ticket.id, stars, feedback))}
              className="rounded-lg bg-[#006699] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#005580] disabled:opacity-50"
            >
              Send rating
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => portal.reopenTicket(ticket.id))}
              className="rounded-lg border border-white/20 px-4 py-2 text-[13px] font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              Not solved? Reopen
            </button>
          </div>
        </div>
      )}
      {resolved && ticket.rating ? (
        <p className="mt-3 text-[12.5px] text-slate-400">
          You rated this {ticket.rating} out of 5{ticket.feedback ? `: "${ticket.feedback}"` : ''}.
        </p>
      ) : null}
      {error && <p className="mt-2 text-[12px] text-rose-400">{error}</p>}
    </li>
  );
}

function TicketGuidelines() {
  const steps = [
    'Only guests with a booking can file a ticket, and it is always about one of your own bookings.',
    'Fill in the booking, a category, how urgent it is, a short title and the details. The ticket gets a tracking ID such as R-000-000-001.',
    'The front desk sees it right away and replies here and in your chat. Quote the tracking ID if you call.',
    'When it is resolved, rate the help you got. If it is not actually solved, reopen it.',
  ];
  const statuses: [string, string][] = [
    ['Open', 'We have your ticket and nobody has picked it up yet.'],
    ['In progress', 'A staff member is working on it.'],
    ['Resolved', 'We think it is done. Rate it, or reopen it if it is not.'],
    ['Closed', 'The ticket was closed by the front desk.'],
  ];
  return (
    <section id="ticket-guidelines" aria-labelledby="ticket-guidelines-title" className="rounded-[22px] border border-white/10 bg-[#061533]/80 backdrop-blur-md p-5 sm:p-6">
      <h2 id="ticket-guidelines-title" className="text-[16px] font-semibold text-white">
        How tickets work
      </h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13.5px] leading-relaxed text-slate-300">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <dl className="mt-4 space-y-2 text-[13px]">
        {statuses.map(([name, text]) => (
          <div key={name} className="flex gap-2">
            <dt className="w-24 shrink-0 font-semibold text-white">{name}</dt>
            <dd className="text-slate-400">{text}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[12.5px] leading-relaxed text-slate-400">
        You can have up to 5 open tickets at a time. For an emergency at the resort, call {RESORT_CONTACT.phoneDisplay} first.
      </p>
    </section>
  );
}

function ResortInfo() {
  const rows: { icon: GuestIconName; label: string; value: string }[] = [
    { icon: 'clock', label: 'Check-in / check-out', value: `From ${RESORT_CONTACT.checkInTime} · By ${RESORT_CONTACT.checkOutTime}` },
    { icon: 'calendar', label: 'Cancellation', value: 'Free up to 7 days before check-in' },
    { icon: 'wifi', label: 'Connectivity', value: 'Wi-Fi with solar backup power' },
    { icon: 'map-pin', label: 'Address', value: RESORT_CONTACT.addressLine },
  ];
  return (
    <section aria-labelledby="resort-info-title" className="rounded-[22px] border border-white/10 bg-[#061533]/80 backdrop-blur-md p-5 sm:p-6">
      <h2 id="resort-info-title" className="text-[16px] font-semibold text-white">
        Rock View at a glance
      </h2>
      <dl className="mt-4 space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-3">
            <GuestIcon name={row.icon} className="mt-0.5 h-5 w-5 text-[#38BDF8]" />
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{row.label}</dt>
              <dd className="mt-0.5 text-[14px] font-medium text-white">{row.value}</dd>
            </div>
          </div>
        ))}
      </dl>
      <Link to="/client" className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#38BDF8] hover:underline">
        View my stays <GuestIcon name="arrow-right" className="h-4 w-4" />
      </Link>
    </section>
  );
}
