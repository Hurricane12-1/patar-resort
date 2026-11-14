import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import GuestIcon, { type GuestIconName } from '../../components/guest/GuestIcon';
import { PROBLEM_TOPIC, useGuestPortal } from '../../components/guest/GuestPortalContext';
import { toast } from '../../components/Toasts';
import { RESORT_CONTACT, formatDateRange, formatRelativeTime, stayPhase, type GuestRequest } from '../../lib/guestPortal';

const CARD_SHADOW = 'shadow-[0_1px_2px_rgba(24,34,43,0.04),0_10px_28px_rgba(24,34,43,0.06)]';

type FaqTopic = 'Booking & rooms' | 'Changes & cancellation' | 'Arrival' | 'Payments' | 'During your stay';

const FAQ_TOPICS: FaqTopic[] = ['Booking & rooms', 'Changes & cancellation', 'Arrival', 'Payments', 'During your stay'];

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
    a: 'Yes. Every stay includes Starlink Wi-Fi, and the resort has solar backup power.',
  },
  {
    topic: 'During your stay',
    q: "Something isn't right with my room. What should I do?",
    a: `Call or text the front desk at ${RESORT_CONTACT.phoneDisplay}, or send a "${PROBLEM_TOPIC}" request below so our guest recovery team can follow up.`,
  },
];

const REQUEST_TOPICS = ['Change my dates', 'Change room or guests', 'Cancellation or refund', 'Payment question', PROBLEM_TOPIC, 'Something else'];

function requestText(request: Pick<GuestRequest, 'topic' | 'message' | 'bookingRef'>, name: string): string {
  const about = request.bookingRef ? ` (${request.bookingRef})` : '';
  return `Hi Rock View, this is ${name}${about}. ${request.topic}: ${request.message}`;
}

export default function GuestHelp() {
  const portal = useGuestPortal();
  const [searchParams] = useSearchParams();
  const presetBooking = searchParams.get('booking') || '';
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<FaqTopic | 'All'>('All');
  const formRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!presetBooking) return;
    const timer = window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    return () => window.clearTimeout(timer);
  }, [presetBooking]);

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
      <section className="gp-animate-in relative overflow-hidden rounded-[26px] bg-[#18222B] px-6 py-8 text-white sm:px-10 sm:py-10">
        <img src="/images/hero.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#18222B] via-[#18222B]/85 to-[#18222B]/40" />
        <div className="relative max-w-2xl">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#D4B475]">Help & support</p>
          <h1 className="gp-display mt-2 text-[30px] font-semibold leading-tight text-white sm:text-[40px]">How can we help, {portal.firstName}?</h1>
          <p className="mt-2 text-[15px] text-white/75">Answers to common questions, or reach the front desk directly.</p>
          <label htmlFor="gp-help-search" className="sr-only">
            Search help topics
          </label>
          <div className="relative mt-6">
            <GuestIcon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8A857B]" />
            <input
              id="gp-help-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search: check-in time, cancellation, PIN…"
              className="h-12 w-full rounded-2xl border border-white/20 bg-white pl-12 pr-4 text-[15px] text-[#222222] outline-none placeholder:text-[#8A857B] focus:ring-4 focus:ring-[#D4B475]/40"
            />
          </div>
        </div>
      </section>

      <section aria-label="Contact the resort" className="gp-animate-in gp-delay-1 mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {contactCards.map((card) => (
          <a
            key={card.title}
            href={card.href}
            {...(card.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="group flex flex-col gap-3 rounded-[20px] border border-[#E8E2D6] bg-white p-4 transition hover:border-[#CFC5B2] hover:shadow-[0_10px_28px_rgba(24,34,43,0.07)] sm:flex-row sm:items-center sm:p-5"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F4EDE0] text-[#9E7E46] transition group-hover:bg-[#18222B] group-hover:text-white">
              <GuestIcon name={card.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[14.5px] font-semibold text-[#18222B]">{card.title}</span>
              <span className="block truncate text-[12.5px] text-[#6A6A6A]">{card.detail}</span>
            </span>
          </a>
        ))}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-labelledby="faq-title" className="gp-animate-in gp-delay-2 min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="faq-title" className="text-[21px] font-semibold tracking-[-0.02em] text-[#18222B]">
              Frequently asked
            </h2>
            <p className="text-[13px] text-[#6A6A6A]">
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
                  topic === t ? 'border-[#18222B] bg-[#18222B] text-white' : 'border-[#E2DCD0] bg-white text-[#4A4740] hover:border-[#BDB4A3]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className={`mt-5 overflow-hidden rounded-[22px] border border-[#E8E2D6] bg-white ${CARD_SHADOW}`}>
            {faqs.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-[15px] font-semibold text-[#18222B]">No answers match your search</p>
                <p className="mt-1 text-[13.5px] text-[#6A6A6A]">Try another word, or send the front desk a request.</p>
              </div>
            ) : (
              faqs.map((faq) => (
                <details key={faq.q} className="group border-b border-[#EFEAE0] last:border-b-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition hover:bg-[#FBFAF7] sm:px-6 [&::-webkit-details-marker]:hidden">
                    <span>
                      <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#9E7E46]">{faq.topic}</span>
                      <span className="mt-0.5 block text-[15px] font-semibold text-[#18222B]">{faq.q}</span>
                    </span>
                    <GuestIcon name="chevron-down" className="h-5 w-5 text-[#8A857B] transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="px-5 pb-5 text-[14.5px] leading-relaxed text-[#4A4740] sm:px-6">{faq.a}</p>
                </details>
              ))
            )}
          </div>
        </section>

        <div className="min-w-0 space-y-6">
          <RequestForm presetBooking={presetBooking} sectionRef={formRef} />
          <RequestList />
          <ResortInfo />
        </div>
      </div>
    </div>
  );
}

function RequestForm({ presetBooking, sectionRef }: { presetBooking: string; sectionRef: RefObject<HTMLElement> }) {
  const portal = useGuestPortal();
  const bookingOptions = useMemo(
    () =>
      [...portal.bookings]
        .filter((b) => stayPhase(b, portal.today) !== 'cancelled')
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
        .map((b) => ({
          id: b.id,
          label: `${portal.roomFor(b).name} · ${formatDateRange(b.checkIn, b.checkOut)}${b.source === 'sample' ? ' (sample)' : ''}`,
        })),
    [portal.bookings, portal.roomFor, portal.today]
  );
  const [bookingId, setBookingId] = useState(presetBooking);
  const [topic, setTopic] = useState(REQUEST_TOPICS[0]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState<GuestRequest | null>(null);

  useEffect(() => {
    if (presetBooking) setBookingId(presetBooking);
  }, [presetBooking]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (message.trim().length < 10) {
      setError('Tell us a little more (at least 10 characters).');
      return;
    }
    setError('');
    setSending(true);
    try {
      const request = await portal.submitRequest({ bookingId: bookingId || undefined, topic, message });
      setLastSent(request);
      setMessage('');
      toast(request.delivery === 'sent' ? 'Request sent to the front desk' : 'Request saved on this device');
    } finally {
      setSending(false);
    }
  };

  return (
    <section ref={sectionRef} aria-labelledby="request-title" className={`scroll-mt-28 rounded-[22px] border border-[#E8E2D6] bg-white p-5 sm:p-6 ${CARD_SHADOW}`}>
      <h2 id="request-title" className="text-[18px] font-semibold text-[#18222B]">
        Send the front desk a request
      </h2>
      <p className="mt-1 text-[13.5px] text-[#6A6A6A]">Changes, questions, or anything you need for your stay.</p>

      {lastSent && (
        <div className={`mt-4 flex gap-3 rounded-2xl px-4 py-3 text-[13.5px] ${lastSent.delivery === 'sent' ? 'bg-[#EAF6EF] text-[#185C3B]' : 'bg-[#FBF6EC] text-[#6E5328]'}`} role="status">
          <GuestIcon name={lastSent.delivery === 'sent' ? 'check' : 'info'} className="mt-0.5 h-4 w-4" strokeWidth={2.2} />
          <p>
            {lastSent.delivery === 'sent'
              ? "Thanks. The front desk team has your request and will get back to you."
              : 'Saved on this device. To make sure it reaches us, text or email it from Your requests below.'}
          </p>
        </div>
      )}

      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        <div>
          <label htmlFor="gp-request-booking" className="block text-[12.5px] font-semibold text-[#3D3A34]">
            About
          </label>
          <select
            id="gp-request-booking"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-[#DCD5C8] bg-white px-3 text-[14.5px] text-[#222222] outline-none focus:border-[#18222B] focus:ring-4 focus:ring-[#18222B]/10"
          >
            <option value="">A general question</option>
            {bookingOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="gp-request-topic" className="block text-[12.5px] font-semibold text-[#3D3A34]">
            Topic
          </label>
          <select
            id="gp-request-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-[#DCD5C8] bg-white px-3 text-[14.5px] text-[#222222] outline-none focus:border-[#18222B] focus:ring-4 focus:ring-[#18222B]/10"
          >
            {REQUEST_TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="gp-request-message" className="block text-[12.5px] font-semibold text-[#3D3A34]">
            Message
          </label>
          <textarea
            id="gp-request-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={800}
            placeholder="For example: can we move our stay one day later?"
            aria-invalid={error ? true : undefined}
            className={`mt-1.5 w-full resize-y rounded-xl border bg-white px-3.5 py-3 text-[14.5px] text-[#222222] outline-none placeholder:text-[#A8A398] focus:border-[#18222B] focus:ring-4 focus:ring-[#18222B]/10 ${error ? 'border-[#D9485F]' : 'border-[#DCD5C8]'}`}
          />
          {error && <p className="mt-1 text-[12px] text-[#B4233C]">{error}</p>}
        </div>
        <button type="submit" disabled={sending} className="w-full rounded-xl bg-[#18222B] py-3 text-[14.5px] font-semibold text-white transition hover:bg-[#273644] disabled:opacity-60">
          {sending ? 'Sending…' : 'Send request'}
        </button>
        <p className="text-[12px] leading-relaxed text-[#8A857B]">
          {portal.mode === 'preview'
            ? 'Preview: requests are saved on this device only. For anything urgent, call or text the front desk.'
            : `Requests go to the front desk team. For anything urgent, call ${RESORT_CONTACT.phoneDisplay}.`}
        </p>
      </form>
    </section>
  );
}

function RequestList() {
  const portal = useGuestPortal();
  const { requests } = portal.account;
  if (!requests.length) return null;

  return (
    <section aria-labelledby="requests-title" className="rounded-[22px] border border-[#E8E2D6] bg-white p-5 sm:p-6">
      <h2 id="requests-title" className="text-[16px] font-semibold text-[#18222B]">
        Your requests
      </h2>
      <ul className="mt-4 space-y-3">
        {requests.map((request) => {
          const text = requestText(request, portal.displayName);
          return (
            <li key={request.id} className="rounded-2xl border border-[#EFEAE0] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#18222B]">{request.topic}</p>
                  <p className="text-[12.5px] text-[#6A6A6A]">
                    {request.roomName ? `${request.roomName} · ` : ''}
                    {formatRelativeTime(request.createdAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    request.delivery === 'sent' ? 'bg-[#EAF6EF] text-[#1F7A4D]' : 'bg-[#FBF6EC] text-[#8A6A33]'
                  }`}
                >
                  {request.delivery === 'sent' ? 'Sent' : 'On this device'}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-[#4A4740]">{request.message}</p>
              {request.delivery === 'device' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`sms:${RESORT_CONTACT.phoneHref}?&body=${encodeURIComponent(text)}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E2DCD0] px-3 py-1.5 text-[12.5px] font-semibold text-[#18222B] hover:bg-[#F7F5F0]"
                  >
                    <GuestIcon name="message" className="h-3.5 w-3.5" /> Text it
                  </a>
                  <a
                    href={`mailto:${RESORT_CONTACT.email}?subject=${encodeURIComponent(`${request.topic}${request.bookingRef ? ` · ${request.bookingRef}` : ''}`)}&body=${encodeURIComponent(text)}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E2DCD0] px-3 py-1.5 text-[12.5px] font-semibold text-[#18222B] hover:bg-[#F7F5F0]"
                  >
                    <GuestIcon name="mail" className="h-3.5 w-3.5" /> Email it
                  </a>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ResortInfo() {
  const rows: { icon: GuestIconName; label: string; value: string }[] = [
    { icon: 'clock', label: 'Check-in / check-out', value: `From ${RESORT_CONTACT.checkInTime} · By ${RESORT_CONTACT.checkOutTime}` },
    { icon: 'calendar', label: 'Cancellation', value: 'Free up to 7 days before check-in' },
    { icon: 'wifi', label: 'Connectivity', value: 'Starlink Wi-Fi with solar backup power' },
    { icon: 'map-pin', label: 'Address', value: RESORT_CONTACT.addressLine },
  ];
  return (
    <section aria-labelledby="resort-info-title" className="rounded-[22px] border border-[#E8E2D6] bg-[#FBFAF7] p-5 sm:p-6">
      <h2 id="resort-info-title" className="text-[16px] font-semibold text-[#18222B]">
        Rock View at a glance
      </h2>
      <dl className="mt-4 space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-3">
            <GuestIcon name={row.icon} className="mt-0.5 h-5 w-5 text-[#9E7E46]" />
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A857B]">{row.label}</dt>
              <dd className="mt-0.5 text-[14px] font-medium text-[#18222B]">{row.value}</dd>
            </div>
          </div>
        ))}
      </dl>
      <Link to="/client" className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#1D4ED8] hover:underline">
        View my stays <GuestIcon name="arrow-right" className="h-4 w-4" />
      </Link>
    </section>
  );
}
