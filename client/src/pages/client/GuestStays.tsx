import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import GuestIcon, { type GuestIconName } from '../../components/guest/GuestIcon';
import { useGuestPortal, type RoomSnapshot } from '../../components/guest/GuestPortalContext';
import { usePageSettings } from '../../lib/pageSettings';
import { toast } from '../../components/Toasts';
import { VoucherBarcode } from '../../components/receipt/VoucherBarcode';
import { nightsBetween } from '../../lib/guestRooms';
import {
  RESORT_CONTACT,
  canGuestCancel,
  cancelWindowLabel,
  guestRefundPercent,
  countdownLabel,
  formatDateRange,
  formatPeso,
  formatStayDate,
  greetingForNow,
  guestCountLabel,
  paymentStatusLabel,
  stayPhase,
  type GuestBooking,
  type StayPhase,
} from '../../lib/guestPortal';

type Filter = 'upcoming' | 'past' | 'cancelled' | 'all';

interface StayItem {
  booking: GuestBooking;
  phase: StayPhase;
  room: RoomSnapshot;
}

const BOOK_A_STAY = { pathname: '/', hash: '#reserve' };

const CARD_SHADOW = 'shadow-[0_8px_32px_rgba(0,0,0,0.36)]';

function statusMeta(item: StayItem, today: string): { label: string; tone: string } {
  const { booking, phase } = item;
  if (phase === 'cancelled') return { label: 'Cancelled', tone: 'bg-rose-950/70 text-rose-300 ring-rose-500/30' };
  if (phase === 'past') return { label: 'Completed', tone: 'bg-slate-800/80 text-slate-300 ring-slate-600/40' };
  if (booking.status === 'disputed') return { label: 'Under review', tone: 'bg-amber-950/70 text-amber-300 ring-amber-500/30' };
  if (phase === 'current') {
    return { label: booking.checkOut === today ? 'Checking out today' : 'Staying now', tone: 'bg-sky-950/70 text-sky-300 ring-sky-500/30' };
  }
  if (booking.status === 'pending') return { label: 'Awaiting confirmation', tone: 'bg-amber-950/70 text-amber-300 ring-amber-500/30' };
  return { label: 'Confirmed', tone: 'bg-emerald-950/70 text-emerald-300 ring-emerald-500/30' };
}

function paymentLine(booking: GuestBooking): string {
  const status = paymentStatusLabel(booking.paymentStatus);
  return booking.paymentMethod ? `${status} · ${booking.paymentMethod}` : status;
}

export default function GuestStays() {
  const portal = useGuestPortal();
  const pageMedia = usePageSettings();
  const { today } = portal;
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter | null>(null);

  const items = useMemo<StayItem[]>(
    () => portal.bookings.map((booking) => ({ booking, phase: stayPhase(booking, today), room: portal.roomFor(booking) })),
    [portal.bookings, portal.roomFor, today]
  );

  const upcoming = items
    .filter((i) => i.phase === 'upcoming' || i.phase === 'current')
    .sort((a, b) => a.booking.checkIn.localeCompare(b.booking.checkIn));
  const past = items.filter((i) => i.phase === 'past').sort((a, b) => b.booking.checkOut.localeCompare(a.booking.checkOut));
  const cancelled = items.filter((i) => i.phase === 'cancelled').sort((a, b) => b.booking.checkIn.localeCompare(a.booking.checkIn));
  const lists: Record<Filter, StayItem[]> = { upcoming, past, cancelled, all: [...upcoming, ...past, ...cancelled] };
  const activeFilter: Filter = filter ?? (upcoming.length ? 'upcoming' : 'all');
  const visible = lists[activeFilter];
  const nextStay = upcoming[0];
  const nightsBooked = items.filter((i) => i.phase !== 'cancelled').reduce((sum, i) => sum + i.booking.nights, 0);
  const hasSamples = items.some((i) => i.booking.source === 'sample');

  const openId = searchParams.get('stay');
  const openItem = openId ? items.find((i) => i.booking.id === openId) : undefined;

  const openStay = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('stay', id);
    setSearchParams(next);
  };
  const closeStay = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('stay');
    setSearchParams(next, { replace: true });
  };

  const greeting = greetingForNow();
  let summary = 'Plan your first Bolinao getaway. We match a room to your party size automatically.';
  if (nextStay && nextStay.phase === 'current') {
    summary = `You're staying with us at ${nextStay.room.name}. Enjoy the tide.`;
  } else if (nextStay) {
    summary = `Your next stay at ${nextStay.room.name} starts ${countdownLabel(nextStay.booking.checkIn, today).toLowerCase()}, ${formatStayDate(nextStay.booking.checkIn)}.`;
  } else if (past.length) {
    summary = 'Welcome back. Ready for another Bolinao getaway?';
  }

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
    { id: 'past', label: 'Completed', count: past.length },
    { id: 'cancelled', label: 'Cancelled', count: cancelled.length },
    { id: 'all', label: 'All stays', count: items.length },
  ];

  return (
    <div>
      <section className="gp-animate-in flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#38BDF8]">
            {pageMedia.dashboardBadge || 'Guest dashboard'}
          </p>
          <h1 className="gp-display mt-2 text-[30px] font-semibold leading-[1.1] text-white sm:text-[40px]">
            {pageMedia.dashboardGreeting ? `${pageMedia.dashboardGreeting}, ${portal.firstName}` : `${greeting}, ${portal.firstName}`}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-300 sm:text-base">
            {portal.loading ? 'Loading your stays…' : (pageMedia.dashboardSubtitle || summary)}
          </p>
          {pageMedia.dashboardAnnouncement && (
            <div className="mt-4 rounded-xl bg-sky-950/60 border border-sky-500/30 px-3.5 py-2.5 flex items-center gap-2.5 text-sky-200 shadow-[0_0_15px_rgba(14,165,233,0.15)]">
              <i className="fas fa-bullhorn text-[#38BDF8] shrink-0 text-sm" />
              <div className="text-[12.5px] font-medium leading-snug">
                <span className="font-bold uppercase tracking-wider text-[#38BDF8] mr-1.5 text-[11px]">Notice:</span>
                {pageMedia.dashboardAnnouncement}
              </div>
            </div>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-[420px]">
          <StatTile label="Upcoming" value={portal.loading ? '–' : String(upcoming.length)} />
          <StatTile label="Nights booked" value={portal.loading ? '–' : String(nightsBooked)} />
          <StatTile label="Completed" value={portal.loading ? '–' : String(past.length)} />
        </dl>
      </section>

      <section aria-labelledby="booked-rooms-title" className="gp-animate-in gp-delay-1 mt-8 sm:mt-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 id="booked-rooms-title" className="text-[21px] font-semibold tracking-[-0.02em] text-white sm:text-[23px]">
              Your booked rooms
            </h2>
            <p className="mt-1 text-[14px] text-slate-400">
              {hasSamples ? 'Sample stays for this preview. Book a room and it replaces them here.' : 'Every room you have booked with Rock View, newest plans first.'}
            </p>
          </div>

          <div role="tablist" aria-label="Filter stays" className="gp-scroll-x -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            {tabs.map((tab) => {
              const active = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(tab.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[13.5px] font-semibold transition ${
                    active
                      ? 'border-[#0EA5E9] bg-gradient-to-r from-[#0284C7] to-[#2563EB] text-white shadow-[0_0_12px_rgba(14,165,233,0.35)]'
                      : 'border-white/15 bg-[#061533]/60 text-slate-300 hover:border-sky-400/40 hover:text-white'
                  }`}
                >
                  {tab.label}
                  <span className={`rounded-full px-1.5 text-[11.5px] ${active ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'}`}>{tab.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {portal.loading ? (
            <>
              <SkeletonCard featured />
              <SkeletonCard />
            </>
          ) : visible.length === 0 ? (
            <EmptyStays filter={activeFilter} hasAny={items.length > 0} />
          ) : (
            visible.map((item, index) => (
              <BookingCard
                key={item.booking.id}
                item={item}
                today={today}
                featured={index === 0 && (item.phase === 'upcoming' || item.phase === 'current')}
                onOpen={() => openStay(item.booking.id)}
              />
            ))
          )}
        </div>
      </section>

      <ArrivalStrip />

      <section className="gp-animate-in gp-delay-3 mt-6 grid gap-4 sm:grid-cols-2">
        <ShortcutCard
          to="/client/profile"
          icon="wallet"
          title="Profile & payment methods"
          detail="Keep your contact details, address, and preferred payment ready for check-in."
        />
        <ShortcutCard
          to="/client/help"
          icon="message"
          title="Help & support"
          detail="Change dates, ask about your room, or reach the front desk."
        />
      </section>

      {openItem && <BookingDrawer key={openItem.booking.id} item={openItem} today={today} onClose={closeStay} />}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#061533]/70 backdrop-blur-md px-3 py-3 sm:px-4 shadow-[0_4px_20px_rgba(0,0,0,0.25)] hover:border-sky-400/40 transition">
      <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</dt>
      <dd className="mt-1 text-[24px] font-bold leading-none tracking-[-0.02em] text-white">{value}</dd>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function BookingCard({ item, today, featured, onOpen }: { item: StayItem; today: string; featured: boolean; onOpen: () => void }) {
  const { booking, phase, room } = item;
  const status = statusMeta(item, today);
  const muted = phase === 'cancelled';

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#061533]/80 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-sky-400/50 hover:shadow-[0_12px_36px_rgba(14,165,233,0.18)] ${CARD_SHADOW} ${
        featured ? 'md:col-span-2 md:flex-row' : ''
      }`}
    >
      <div className={`relative overflow-hidden bg-[#040e22] ${featured ? 'aspect-[16/10] md:aspect-auto md:min-h-[340px] md:w-[52%]' : 'aspect-[16/10]'}`}>
        {room.image && (
          <img
            src={room.image}
            alt={`${room.name} at Rock View Beach Resort`}
            loading="lazy"
            className={`absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] ${muted ? 'opacity-70 grayscale' : ''}`}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#061533] via-black/20 to-black/30" />
        <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
          <StatusPill label={status.label} tone={status.tone} />
          {booking.source === 'sample' && (
            <span className="rounded-full bg-black/60 backdrop-blur-sm border border-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-300">Sample</span>
          )}
        </div>
        {phase === 'upcoming' && (
          <span className="absolute right-4 top-4 rounded-full bg-gradient-to-r from-[#0284C7] to-[#2563EB] px-3 py-1 text-[12px] font-bold text-white shadow-[0_0_12px_rgba(56,189,248,0.4)]">
            {countdownLabel(booking.checkIn, today)}
          </span>
        )}
        {featured && (
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#38BDF8]">{phase === 'current' ? 'Current stay' : 'Next stay'}</p>
            <p className="mt-1 text-[15px] font-semibold">{formatDateRange(booking.checkIn, booking.checkOut)}</p>
          </div>
        )}
      </div>

      <div className={`flex flex-1 flex-col p-5 ${featured ? 'sm:p-7' : 'sm:p-6'}`}>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#38BDF8]">
          {room.category} · Up to {room.capacity} guests
        </p>
        <h3 className={`mt-1.5 font-semibold tracking-[-0.02em] text-white ${featured ? 'text-[24px] sm:text-[28px]' : 'text-[19px]'}`}>
          {room.name}
        </h3>

        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-white/10 bg-[#040e22]/90 px-4 py-3.5">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400">Check-in</p>
            <p className="mt-1 text-[14.5px] font-semibold text-white">{formatStayDate(booking.checkIn)}</p>
            <p className="text-[12px] text-slate-400">from {RESORT_CONTACT.checkInTime}</p>
          </div>
          <div className="flex flex-col items-center text-[#38BDF8]">
            <GuestIcon name="arrow-right" className="h-4 w-4" />
            <span className="mt-1 whitespace-nowrap text-[11px] font-semibold text-slate-300">
              {booking.nights} night{booking.nights === 1 ? '' : 's'}
            </span>
          </div>
          <div className="text-right">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400">Check-out</p>
            <p className="mt-1 text-[14.5px] font-semibold text-white">{formatStayDate(booking.checkOut)}</p>
            <p className="text-[12px] text-slate-400">by {RESORT_CONTACT.checkOutTime}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <GuestIcon name="users" className="h-4 w-4 text-[#38BDF8]" />
            {guestCountLabel(booking)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <GuestIcon name="receipt" className="h-4 w-4 text-[#38BDF8]" />
            <span className="font-mono text-[12.5px] tracking-tight text-white">{booking.reference}</span>
          </span>
          {featured && booking.matchMode === 'auto' && (
            <span className="inline-flex items-center gap-1.5 text-sky-300">
              <GuestIcon name="sparkles" className="h-4 w-4 text-[#38BDF8]" />
              Matched to your party size
            </span>
          )}
        </div>

        <div className="mt-auto pt-5">
          <div className="flex items-end justify-between gap-3 border-t border-white/10 pt-4">
            <div className="min-w-0">
              <p className={`text-[19px] font-bold tracking-[-0.01em] ${muted ? 'text-slate-500 line-through' : 'text-white'}`}>{formatPeso(booking.total)}</p>
              <p className="truncate text-[12.5px] text-slate-400">{paymentLine(booking)}</p>
            </div>
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#2563EB] px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_0_12px_rgba(14,165,233,0.3)] transition hover:brightness-110"
              aria-label={`View details for ${room.name}, ${formatDateRange(booking.checkIn, booking.checkOut)}`}
            >
              View stay
              <GuestIcon name="chevron-right" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function SkeletonCard({ featured = false }: { featured?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-[22px] border border-white/10 bg-[#061533]/70 ${featured ? 'md:col-span-2' : ''}`} aria-hidden="true">
      <div className="aspect-[16/9] animate-pulse bg-white/5" />
      <div className="space-y-3 p-6">
        <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
        <div className="h-5 w-48 animate-pulse rounded bg-white/10" />
        <div className="h-16 animate-pulse rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}

function EmptyStays({ filter, hasAny }: { filter: Filter; hasAny: boolean }) {
  if (!hasAny || filter === 'all') {
    return (
      <div className={`relative overflow-hidden rounded-[22px] border border-white/10 bg-[#061533]/80 backdrop-blur-md md:col-span-2 xl:col-span-3 ${CARD_SHADOW}`}>
        <div className="grid md:grid-cols-2">
          <div className="relative min-h-[220px]">
            <img src="/images/hero.jpg" alt="Rock View coastline at Patar, Bolinao" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-transparent to-[#061533]" />
          </div>
          <div className="flex flex-col justify-center p-7 sm:p-10">
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#38BDF8]">No stays yet</p>
            <h3 className="gp-display mt-2 text-[28px] font-semibold leading-tight text-white">Your Bolinao room is waiting</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-300">
              Pick your dates and party size. We suggest the room that fits, or you can choose one yourself. Your booking shows up here right away.
            </p>
            <Link
              to={BOOK_A_STAY}
              className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl bg-gradient-to-r from-[#0284C7] via-[#2563EB] to-[#1D4ED8] px-5 py-3 text-[14px] font-semibold text-white shadow-[0_0_20px_rgba(14,165,233,0.4)] transition hover:brightness-110"
            >
              Book a room
              <GuestIcon name="arrow-right" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const copy: Record<Exclude<Filter, 'all'>, { title: string; body: string }> = {
    upcoming: { title: 'No upcoming stays', body: 'When you book a room, it appears here with your dates and arrival details.' },
    past: { title: 'No completed stays yet', body: 'Stays you finish with us are kept here for your records.' },
    cancelled: { title: 'No cancelled bookings', body: 'Good news. Nothing has been cancelled.' },
  };
  const { title, body } = copy[filter as Exclude<Filter, 'all'>];
  return (
    <div className="flex flex-col items-center rounded-[22px] border border-dashed border-white/20 bg-[#061533]/50 px-6 py-12 text-center md:col-span-2 xl:col-span-3">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-[#38BDF8]">
        <GuestIcon name="bed" className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-[17px] font-semibold text-white">{title}</h3>
      <p className="mt-1 max-w-sm text-[14px] text-slate-400">{body}</p>
      {filter === 'upcoming' && (
        <Link to={BOOK_A_STAY} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#2563EB] px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_0_12px_rgba(14,165,233,0.3)] transition hover:brightness-110">
          Book a room
          <GuestIcon name="arrow-right" className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function ArrivalStrip() {
  const tiles: { icon: GuestIconName; label: string; value: string; detail: ReactNode }[] = [
    { icon: 'clock', label: 'Check-in', value: `From ${RESORT_CONTACT.checkInTime}`, detail: 'Self check-in with your keypad PIN' },
    { icon: 'sun', label: 'Check-out', value: `By ${RESORT_CONTACT.checkOutTime}`, detail: 'Ask the front desk about late check-out' },
    {
      icon: 'map-pin',
      label: 'Find us',
      value: 'Brgy. Patar, Bolinao',
      detail: (
        <a href={RESORT_CONTACT.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#38BDF8] hover:underline">
          Get directions <GuestIcon name="external" className="h-3.5 w-3.5" />
        </a>
      ),
    },
    {
      icon: 'phone',
      label: 'Front desk',
      value: RESORT_CONTACT.phoneDisplay,
      detail: (
        <a href={`tel:${RESORT_CONTACT.phoneHref}`} className="font-semibold text-[#38BDF8] hover:underline">
          Call the resort
        </a>
      ),
    },
  ];

  return (
    <section aria-labelledby="arrival-title" className={`gp-animate-in gp-delay-2 mt-10 rounded-[22px] border border-white/10 bg-[#061533]/80 backdrop-blur-md p-5 sm:p-7 ${CARD_SHADOW}`}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="arrival-title" className="text-[18px] font-semibold text-white">Good to know before you arrive</h2>
        <p className="text-[13px] text-slate-400">{RESORT_CONTACT.addressLine}</p>
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/15 text-[#38BDF8]">
              <GuestIcon name={tile.icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{tile.label}</p>
              <p className="mt-0.5 text-[15px] font-semibold text-white">{tile.value}</p>
              <p className="mt-0.5 text-[13px] text-slate-400">{tile.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ShortcutCard({ to, icon, title, detail }: { to: string; icon: GuestIconName; title: string; detail: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-[22px] border border-white/10 bg-[#061533]/80 backdrop-blur-md p-5 transition hover:border-sky-400/50 hover:shadow-[0_8px_30px_rgba(14,165,233,0.18)]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0EA5E9] to-[#2563EB] text-white shadow-[0_0_12px_rgba(14,165,233,0.35)]">
        <GuestIcon name={icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-white">{title}</span>
        <span className="mt-0.5 block text-[13px] text-slate-400">{detail}</span>
      </span>
      <GuestIcon name="chevron-right" className="h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#38BDF8]" />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Booking detail drawer
// ---------------------------------------------------------------------------

function DetailRow({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</dt>
      <dd className="mt-1 text-[14.5px] font-semibold text-white">{value}</dd>
      {hint && <dd className="text-[12.5px] text-slate-400">{hint}</dd>}
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-white/10 px-5 py-5 sm:px-6">
      <h3 className="text-[13px] font-bold uppercase tracking-[0.14em] text-white">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BookingDrawer({ item, today, onClose }: { item: StayItem; today: string; onClose: () => void }) {
  const portal = useGuestPortal();
  const navigate = useNavigate();
  const { booking, phase, room } = item;
  const status = statusMeta(item, today);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const canCancel = phase === 'upcoming' && booking.status !== 'disputed' && canGuestCancel(booking);
  const cancelCountdown = cancelWindowLabel(booking.createdAt);
  const refundPct = guestRefundPercent(booking.createdAt);
  const showArrival = phase === 'upcoming' || phase === 'current';

  const steps = ['Booked', 'Confirmed', 'Checked in', 'Checked out'];
  let reached = booking.status === 'pending' ? 1 : 2;
  if (phase === 'current') reached = 3;
  if (phase === 'past') reached = 4;

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(booking.reference);
      toast('Booking reference copied');
    } catch {
      toast(`Booking reference: ${booking.reference}`);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    setError('');
    try {
      await portal.cancelBooking(booking);
      setConfirmCancel(false);
      toast('Your booking has been cancelled');
    } catch {
      setError(`We couldn't cancel this booking online. Please call the front desk at ${RESORT_CONTACT.phoneDisplay} and we'll take care of it.`);
    } finally {
      setCancelling(false);
    }
  };

  let recordNote = 'Saved with the resort. The front desk sees this booking.';
  if (booking.source === 'sample') recordNote = 'Sample stay for this preview. It is not a real reservation.';
  else if (booking.source === 'device' && !booking.dbId) {
    recordNote = `Saved on this device only. We couldn't reach the reservation system when you booked, so please call ${RESORT_CONTACT.phoneDisplay} to confirm.`;
  }

  return createPortal(
    <div className="guest-portal gp-overlay fixed inset-0 z-[90] flex items-end justify-center md:items-center md:p-6">
      <button type="button" aria-label="Close stay details" onClick={onClose} className="gp-backdrop absolute inset-0 cursor-default bg-[#020713]/80 backdrop-blur-md md:bg-[#020713]/30 md:backdrop-blur-none" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="stay-drawer-title"
        className="gp-dialog relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-[#040e22] text-white shadow-[0_-12px_40px_rgba(0,0,0,0.8)] md:h-auto md:max-h-[88vh] md:max-w-[520px] md:rounded-[28px] border border-white/15"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#38BDF8]">Stay details</p>
            <button type="button" onClick={copyReference} className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-[13px] font-semibold text-white hover:text-[#38BDF8] transition">
              {booking.reference}
              <GuestIcon name="copy" className="h-3.5 w-3.5" />
              <span className="sr-only">Copy booking reference</span>
            </button>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <GuestIcon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-5 pt-5 sm:px-6">
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-[#061533]">
              {room.image && <img src={room.image} alt={`${room.name} at Rock View Beach Resort`} className={`absolute inset-0 h-full w-full object-cover ${phase === 'cancelled' ? 'opacity-70 grayscale' : ''}`} />}
              <div className="absolute inset-0 bg-gradient-to-t from-[#040e22]/80 via-transparent to-transparent" />
              <div className="absolute left-3 top-3 flex gap-2">
                <StatusPill label={status.label} tone={status.tone} />
                {booking.source === 'sample' && <span className="rounded-full bg-black/60 border border-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-300">Sample</span>}
              </div>
            </div>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[#38BDF8]">
              {room.category} · Up to {room.capacity} guests
            </p>
            <h2 id="stay-drawer-title" className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-white">
              {room.name}
            </h2>
            <p className="mt-1 text-[14px] text-slate-300">
              {formatDateRange(booking.checkIn, booking.checkOut)} · {booking.nights} night{booking.nights === 1 ? '' : 's'} · {guestCountLabel(booking)}
            </p>

            {phase === 'cancelled' && (
              <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-950/60 px-4 py-3 text-[13.5px] text-rose-200">This booking was cancelled. The room is open for other guests again.</div>
            )}
            {booking.status === 'disputed' && phase !== 'cancelled' && (
              <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-950/60 px-4 py-3 text-[13.5px] text-amber-200">Our guest recovery team is reviewing the issue you reported and will contact you shortly.</div>
            )}

            {phase !== 'cancelled' && (
              <ol className="mt-5 grid grid-cols-4 gap-1" aria-label="Booking progress">
                {steps.map((step, index) => {
                  const done = index < reached;
                  return (
                    <li key={step} className="flex flex-col items-center text-center">
                      <div className="flex w-full items-center">
                        <span className={`h-[2px] flex-1 ${index === 0 ? 'opacity-0' : done ? 'bg-[#38BDF8]' : 'bg-white/15'}`} />
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${done ? 'border-[#38BDF8] bg-[#38BDF8] text-[#020713] shadow-[0_0_8px_#38bdf8]' : 'border-white/20 bg-white/5 text-slate-400'}`}>
                          {done ? <GuestIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.6} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                        </span>
                        <span className={`h-[2px] flex-1 ${index === steps.length - 1 ? 'opacity-0' : index + 1 < reached ? 'bg-[#38BDF8]' : 'bg-white/15'}`} />
                      </div>
                      <span className={`mt-1.5 text-[11.5px] font-semibold ${done ? 'text-white' : 'text-slate-400'}`}>{step}</span>
                    </li>
                  );
                })}
              </ol>
            )}

            {/* Scannable RFID Keycard & Barcode Digital Pass */}
            {phase !== 'cancelled' && (
              <div className="mt-5">
                <VoucherBarcode reference={booking.reference} />
              </div>
            )}
          </div>

          <div className="mt-5">
            <DrawerSection title="Your stay">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                <DetailRow label="Check-in" value={formatStayDate(booking.checkIn, true)} hint={`From ${RESORT_CONTACT.checkInTime}`} />
                <DetailRow label="Check-out" value={formatStayDate(booking.checkOut, true)} hint={`By ${RESORT_CONTACT.checkOutTime}`} />
                <DetailRow label="Guests" value={guestCountLabel(booking)} hint={`Room fits up to ${room.capacity}`} />
                <DetailRow
                  label="Room"
                  value={room.name}
                  hint={booking.matchMode === 'auto' ? 'Matched to your party size' : booking.matchMode === 'manual' ? 'Chosen by you' : room.category}
                />
              </dl>
            </DrawerSection>

            {showArrival && (
              <DrawerSection title="Arrival">
                {booking.arrivalPin ? (
                  <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-[#061533] to-[#081d45] p-4 text-white shadow-[0_0_20px_rgba(14,165,233,0.15)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#38BDF8]">Keypad PIN</p>
                        <p className="mt-1 font-mono text-[28px] font-bold tracking-[0.2em] text-white">{booking.arrivalPin}</p>
                      </div>
                      <GuestIcon name="key" className="h-8 w-8 text-[#38BDF8]" />
                    </div>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-slate-300">
                      Works from {RESORT_CONTACT.checkInTime} on {formatStayDate(booking.checkIn)}. Shown only on the device you booked with. Keep it private.
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-3 rounded-2xl border border-white/10 bg-[#061533]/60 p-4 text-[13.5px] text-slate-300">
                    <GuestIcon name="key" className="mt-0.5 h-5 w-5 text-[#38BDF8]" />
                    <p>Your keypad PIN is sent by SMS to {booking.guestPhone || 'your mobile number'} on check-in day.</p>
                  </div>
                )}
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <GuestIcon name="map-pin" className="mt-0.5 h-5 w-5 text-[#38BDF8]" />
                    <div>
                      <p className="text-[14px] font-semibold text-white">Rock View Beach Resort</p>
                      <p className="text-[13px] text-slate-400">{RESORT_CONTACT.addressLine}</p>
                    </div>
                  </div>
                  <a
                    href={RESORT_CONTACT.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-sky-400/30 bg-white/5 px-3 py-1.5 text-[12.5px] font-semibold text-sky-200 transition hover:bg-white/10"
                  >
                    <GuestIcon name="navigation" className="h-3.5 w-3.5" />
                    Directions
                  </a>
                </div>
              </DrawerSection>
            )}

            <DrawerSection title="Payment">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                <DetailRow label="Method" value={booking.paymentMethod || 'Choose at check-in'} />
                <DetailRow
                  label="Status"
                  value={paymentStatusLabel(booking.paymentStatus)}
                  hint={booking.paymentStatus === 'unpaid' && phase !== 'cancelled' ? "You won't be charged until you settle at the resort." : undefined}
                />
              </dl>
              <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-[#061533]/60 p-4 text-[14px]">
                {booking.nightsTotal > 0 && (
                  <>
                    <div className="flex justify-between text-slate-300">
                      <span>
                        Room · {booking.nights} night{booking.nights === 1 ? '' : 's'}
                      </span>
                      <span>{formatPeso(booking.nightsTotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Resort cleaning fee</span>
                      <span>{formatPeso(booking.cleaningFee)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Coastal conservation fee</span>
                      <span>{formatPeso(booking.coastalFee)}</span>
                    </div>
                    <div className="flex justify-between font-medium text-emerald-400">
                      <span>Direct booking tourism tax</span>
                      <span>Waived</span>
                    </div>
                  </>
                )}
                <div className={`flex justify-between text-[16px] font-bold text-white ${booking.nightsTotal > 0 ? 'border-t border-white/10 pt-3' : ''}`}>
                  <span>Total</span>
                  <span className={phase === 'cancelled' ? 'text-slate-500 line-through' : ''}>{formatPeso(booking.total)}</span>
                </div>
              </div>
            </DrawerSection>

            <DrawerSection title="Booked by">
              <dl className="space-y-3">
                <DetailRow label="Guest" value={booking.guestName || portal.displayName} />
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <DetailRow label="Mobile" value={booking.guestPhone || '—'} />
                  <DetailRow label="Email" value={<span className="break-all">{booking.guestEmail || '—'}</span>} />
                </div>
              </dl>
              <p className="mt-4 flex gap-2 text-[12.5px] leading-relaxed text-slate-400">
                <GuestIcon name="info" className="mt-0.5 h-4 w-4 text-[#38BDF8]" />
                {recordNote}
              </p>
            </DrawerSection>
          </div>
        </div>

        <div className="border-t border-white/10 bg-[#040e22] px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6">
          {error && <p className="mb-3 rounded-xl border border-rose-500/30 bg-rose-950/60 px-3 py-2 text-[13px] text-rose-200">{error}</p>}
          {confirmCancel ? (
            <div>
              <p className="text-[15px] font-semibold text-white">Cancel your stay at {room.name}?</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                {refundPct === 100
                  ? `Free cancellation within 5 hours of booking — you'll be refunded in full.${cancelCountdown ? ` ${cancelCountdown}.` : ''}`
                  : 'The 5-hour free window has passed, so this cancellation is refunded 50% per resort policy.'}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmCancel(false)}
                  disabled={cancelling}
                  className="rounded-xl border border-white/20 px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-white/10"
                >
                  Keep booking
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="rounded-xl bg-rose-600 px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60 shadow-[0_0_12px_rgba(225,29,72,0.3)]"
                >
                  {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              {phase === 'past' || phase === 'cancelled' ? (
                <Link
                  to={BOOK_A_STAY}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0284C7] via-[#2563EB] to-[#1D4ED8] px-4 py-3 text-[14px] font-semibold text-white transition hover:brightness-110 shadow-[0_0_16px_rgba(14,165,233,0.35)]"
                >
                  <GuestIcon name="calendar-plus" className="h-4 w-4" />
                  {phase === 'past' ? 'Book again' : 'Book a new stay'}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(`/client/help?booking=${encodeURIComponent(booking.id)}`)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#2563EB] px-4 py-3 text-[14px] font-semibold text-white transition hover:brightness-110 shadow-[0_0_12px_rgba(14,165,233,0.3)]"
                >
                  <GuestIcon name="message" className="h-4 w-4" />
                  Contact the resort
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="inline-flex items-center justify-center rounded-xl border border-rose-500/40 px-4 py-3 text-[14px] font-semibold text-rose-300 transition hover:bg-rose-500/10"
                >
                  Cancel booking
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}
