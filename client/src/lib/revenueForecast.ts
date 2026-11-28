// Revenue and occupancy forecast for the ledger page. Every number is built from bookings the resort
// already has, in steps that can be explained to the owner:
//   1. On the books: room-nights already booked for the month and their revenue.
//   2. Booking pace: room-nights guests booked per day over the last 4 weeks. In a steady month that is
//      also how many room-nights each date ends up with.
//   3. Booking curve: from nights that already passed, the share of a night's bookings that arrive
//      within N days of it. A date 10 days away still has the bookings made inside those 10 days to come.
//   4. Pickup: pace x share still to come, for every open night, never more than the rooms left.
//   5. Range: day-to-day randomness plus how sure the pace is, given how many bookings it rests on.
// Covered by client/test/revenueForecast.test.ts, including a simulated backtest against the old model.

export interface ForecastBooking {
  check_in?: string | null;
  check_out?: string | null;
  total_php?: number | string | null;
  downpayment_php?: number | string | null;
  payment_status?: string | null;
  status?: string | null;
  created_at?: string | null;
}

export interface MonthStats {
  soldNights: number;
  revenue: number;
  availableNights: number;
  occupancyPct: number;
  adr: number;
  revpar: number;
}

export interface ForecastRange {
  low: number;
  expected: number;
  high: number;
}

export interface MonthForecast {
  month: string;
  status: 'past' | 'current' | 'future';
  onTheBooks: MonthStats;
  openNights: number;
  pickupNights: ForecastRange;
  revenue: ForecastRange;
  occupancyPct: ForecastRange;
  rateUsed: number;
  rateSource: 'this month' | 'recent bookings' | 'room list';
  pace: BookingPace;
  curve: BookingCurve;
}

export interface BookingCurve {
  source: 'history' | 'default';
  nightsUsed: number;
  medianLeadDays: number;
  shareWithin: (days: number) => number;
}

export interface BookingPace {
  windowDays: number;
  horizonDays: number;
  bookings: number;
  nights: number;
  nightsPerDay: number;
}

const DAY_MS = 86400000;
const Z80 = 1.2816;
const POISSON_P90_FOR_ZERO = 2.3;
const DEFAULT_NIGHTS_PER_BOOKING = 2;

export const PACE_WINDOW_DAYS = 28;
export const PACE_HORIZON_DAYS = 60;

export function dayIndex(iso: string): number {
  return Math.floor(Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`) / DAY_MS);
}

export function isoFromIndex(index: number): string {
  return new Date(index * DAY_MS).toISOString().slice(0, 10);
}

export function monthWindow(yearMonth: string): { start: number; endExclusive: number; days: number } {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = Math.floor(Date.UTC(y, m - 1, 1) / DAY_MS);
  const endExclusive = Math.floor(Date.UTC(y, m, 1) / DAY_MS);
  return { start, endExclusive, days: endExclusive - start };
}

function isActive(b: ForecastBooking): boolean {
  return b.status !== 'cancelled' && Boolean(b.check_in);
}

function stayBounds(b: ForecastBooking): { checkIn: number; checkOut: number; dayUse: boolean } {
  const checkIn = dayIndex(String(b.check_in));
  const rawOut = b.check_out ? dayIndex(String(b.check_out)) : checkIn;
  const dayUse = rawOut <= checkIn;
  return { checkIn, checkOut: dayUse ? checkIn + 1 : rawOut, dayUse };
}

// Nights of a stay that fall inside [windowStart, windowEndExclusive). A same-day stay counts as one
// night on its date, as the rest of the system does.
export function nightsInWindow(b: ForecastBooking, windowStart: number, windowEndExclusive: number): number {
  const { checkIn, checkOut } = stayBounds(b);
  return Math.max(0, Math.min(checkOut, windowEndExclusive) - Math.max(checkIn, windowStart));
}

function stayNights(b: ForecastBooking): number {
  const { checkIn, checkOut } = stayBounds(b);
  return Math.max(1, checkOut - checkIn);
}

function money(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function monthOnTheBooks(bookings: ForecastBooking[], yearMonth: string, units: number): MonthStats {
  const { start, endExclusive, days } = monthWindow(yearMonth);
  let soldNights = 0;
  let revenue = 0;
  for (const b of bookings) {
    if (!isActive(b)) continue;
    const nights = nightsInWindow(b, start, endExclusive);
    if (nights === 0) continue;
    soldNights += nights;
    revenue += (money(b.total_php) / stayNights(b)) * nights;
  }
  const availableNights = Math.max(0, units) * days;
  const occupied = Math.min(soldNights, availableNights);
  return {
    soldNights,
    revenue: Math.round(revenue),
    availableNights,
    occupancyPct: availableNights > 0 ? Number(((occupied / availableNights) * 100).toFixed(1)) : 0,
    adr: soldNights > 0 ? Math.round(revenue / soldNights) : 0,
    revpar: availableNights > 0 ? Math.round(revenue / availableNights) : 0,
  };
}

// Money actually received for a booking. Unpaid bookings have received nothing, even though their
// downpayment amount is already filled in.
export function collectedFor(b: ForecastBooking): number {
  const total = money(b.total_php);
  const down = Math.min(total, money(b.downpayment_php));
  const status = String(b.payment_status || '').trim().toLowerCase();
  if (status === 'paid') return total;
  if (status === 'partially_paid' || status === 'partial' || status === 'refund_pending') return down;
  return 0;
}

export function bookingPace(
  bookings: ForecastBooking[],
  todayIso: string,
  windowDays = PACE_WINDOW_DAYS,
  horizonDays = PACE_HORIZON_DAYS
): BookingPace {
  const today = dayIndex(todayIso);
  let count = 0;
  let nights = 0;
  for (const b of bookings) {
    if (!isActive(b) || !b.created_at) continue;
    const created = dayIndex(String(b.created_at));
    if (created > today || created <= today - windowDays) continue;
    const { checkIn } = stayBounds(b);
    if (checkIn - created >= horizonDays) continue;
    count += 1;
    nights += stayNights(b);
  }
  return { windowDays, horizonDays, bookings: count, nights, nightsPerDay: nights / windowDays };
}

const CURVE_LOOKBACK_DAYS = 90;
const CURVE_MIN_NIGHTS = 20;

// Built only from nights that already passed, so every booking for those nights is known.
export function bookingCurve(bookings: ForecastBooking[], todayIso: string): BookingCurve {
  const today = dayIndex(todayIso);
  const leads: number[] = [];
  for (const b of bookings) {
    if (!isActive(b) || !b.created_at) continue;
    const created = dayIndex(String(b.created_at));
    const { checkIn, checkOut } = stayBounds(b);
    for (let night = checkIn; night < checkOut; night += 1) {
      if (night >= today || night < today - CURVE_LOOKBACK_DAYS) continue;
      leads.push(Math.max(0, night - created));
    }
  }
  if (leads.length < CURVE_MIN_NIGHTS) {
    return {
      source: 'default',
      nightsUsed: leads.length,
      medianLeadDays: Math.round(PACE_HORIZON_DAYS / 2),
      shareWithin: (days) => Math.min(1, Math.max(0, days + 1) / PACE_HORIZON_DAYS),
    };
  }
  leads.sort((a, b) => a - b);
  const shareWithin = (days: number) => {
    let lo = 0;
    let hi = leads.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (leads[mid] <= days) lo = mid + 1;
      else hi = mid;
    }
    return lo / leads.length;
  };
  return { source: 'history', nightsUsed: leads.length, medianLeadDays: leads[Math.floor(leads.length / 2)], shareWithin };
}

function soldOnEachDate(bookings: ForecastBooking[], from: number, toExclusive: number): Map<number, number> {
  const sold = new Map<number, number>();
  for (const b of bookings) {
    if (!isActive(b)) continue;
    const { checkIn, checkOut } = stayBounds(b);
    for (let d = Math.max(checkIn, from); d < Math.min(checkOut, toExclusive); d += 1) {
      sold.set(d, (sold.get(d) || 0) + 1);
    }
  }
  return sold;
}

function recentRate(bookings: ForecastBooking[], todayIso: string): number {
  const today = dayIndex(todayIso);
  let revenue = 0;
  let nights = 0;
  for (const b of bookings) {
    if (!isActive(b)) continue;
    const { checkIn } = stayBounds(b);
    if (checkIn < today - 90 || checkIn > today + PACE_HORIZON_DAYS) continue;
    revenue += money(b.total_php);
    nights += stayNights(b);
  }
  return nights >= 3 ? Math.round(revenue / nights) : 0;
}

export function forecastMonth(input: {
  bookings: ForecastBooking[];
  units: number;
  yearMonth: string;
  todayIso: string;
  roomListRate: number;
}): MonthForecast {
  const { bookings, units, yearMonth, todayIso, roomListRate } = input;
  const { start, endExclusive } = monthWindow(yearMonth);
  const today = dayIndex(todayIso);
  const otb = monthOnTheBooks(bookings, yearMonth, units);
  const pace = bookingPace(bookings, todayIso);

  const thisMonthRate = otb.soldNights >= 3 ? otb.adr : 0;
  const recent = recentRate(bookings, todayIso);
  const rateUsed = thisMonthRate || recent || Math.round(roomListRate) || 0;
  const rateSource: MonthForecast['rateSource'] = thisMonthRate ? 'this month' : recent ? 'recent bookings' : 'room list';

  const status: MonthForecast['status'] = endExclusive <= today ? 'past' : start > today ? 'future' : 'current';
  const firstSellable = Math.max(start, today);
  const sold = soldOnEachDate(bookings, firstSellable, endExclusive);

  const curve = bookingCurve(bookings, todayIso);
  let openNights = 0;
  let expected = 0;
  if (status !== 'past') {
    for (let d = firstSellable; d < endExclusive; d += 1) {
      const open = Math.max(0, units - (sold.get(d) || 0));
      openNights += open;
      expected += Math.min(open, pace.nightsPerDay * curve.shareWithin(d - today));
    }
  }

  const nightsPerBooking = pace.bookings > 0 ? pace.nights / pace.bookings : DEFAULT_NIGHTS_PER_BOOKING;
  let low = 0;
  let high = 0;
  if (status !== 'past') {
    if (pace.bookings === 0) {
      high = Math.min(openNights, POISSON_P90_FOR_ZERO * nightsPerBooking);
    } else {
      const paceShare = 1 / Math.sqrt(pace.bookings);
      const sd = Math.sqrt(nightsPerBooking * expected + (expected * paceShare) ** 2);
      low = Math.max(0, expected - Z80 * sd);
      high = Math.min(openNights, expected + Z80 * sd);
    }
  }

  const pickupNights: ForecastRange = {
    low: Math.round(low),
    expected: Math.round(expected),
    high: Math.round(high),
  };
  const revenue: ForecastRange = {
    low: otb.revenue + pickupNights.low * rateUsed,
    expected: otb.revenue + pickupNights.expected * rateUsed,
    high: otb.revenue + pickupNights.high * rateUsed,
  };
  const pct = (nights: number) =>
    otb.availableNights > 0 ? Number((Math.min(100, ((otb.soldNights + nights) / otb.availableNights) * 100)).toFixed(1)) : 0;

  return {
    month: yearMonth,
    status,
    onTheBooks: otb,
    openNights,
    pickupNights,
    revenue,
    occupancyPct: { low: pct(pickupNights.low), expected: pct(pickupNights.expected), high: pct(pickupNights.high) },
    rateUsed,
    rateSource,
    pace,
    curve,
  };
}

export function nextYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function manilaTodayIso(nowMs = Date.now()): string {
  return new Date(nowMs + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
