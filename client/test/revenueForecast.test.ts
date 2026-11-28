import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  monthOnTheBooks,
  collectedFor,
  bookingPace,
  forecastMonth,
  nightsInWindow,
  monthWindow,
  dayIndex,
  isoFromIndex,
  nextYearMonth,
  type ForecastBooking,
} from '../src/lib/revenueForecast.ts';

const stay = (check_in: string, check_out: string, total_php: number, extra: Partial<ForecastBooking> = {}): ForecastBooking => ({
  check_in,
  check_out,
  total_php,
  status: 'confirmed',
  created_at: '2026-10-01T02:00:00Z',
  ...extra,
});

describe('month totals', () => {
  test('a stay across the month end counts the last night of the month (old code dropped it)', () => {
    const b = [stay('2026-11-30', '2026-12-02', 6000)];
    assert.equal(monthOnTheBooks(b, '2026-11', 1).soldNights, 1);
    assert.equal(monthOnTheBooks(b, '2026-11', 1).revenue, 3000);
    assert.equal(monthOnTheBooks(b, '2026-12', 1).soldNights, 1);
    assert.equal(legacyMonthNights(b, '2026-11'), 0, 'the old formula loses this night');
  });

  test('a same-day stay counts once, in its own month', () => {
    const b = [stay('2026-11-15', '2026-11-15', 1500)];
    assert.equal(monthOnTheBooks(b, '2026-11', 2).soldNights, 1);
    assert.equal(monthOnTheBooks(b, '2026-11', 2).revenue, 1500);
  });

  test('cancelled stays are ignored; occupancy, ADR and RevPAR follow from the nights', () => {
    const b = [stay('2026-11-01', '2026-11-11', 30000), stay('2026-11-05', '2026-11-07', 9999, { status: 'cancelled' })];
    const m = monthOnTheBooks(b, '2026-11', 2);
    assert.deepEqual(m, { soldNights: 10, revenue: 30000, availableNights: 60, occupancyPct: 16.7, adr: 3000, revpar: 500 });
  });

  test('nightsInWindow handles stays fully before, after and around a window', () => {
    const w = monthWindow('2026-11');
    assert.equal(nightsInWindow(stay('2026-10-20', '2026-10-25', 1), w.start, w.endExclusive), 0);
    assert.equal(nightsInWindow(stay('2026-10-30', '2026-11-03', 1), w.start, w.endExclusive), 2);
    assert.equal(nightsInWindow(stay('2026-10-15', '2026-12-15', 1), w.start, w.endExclusive), 30);
  });
});

describe('collected money', () => {
  test('counts only money received', () => {
    assert.equal(collectedFor({ total_php: 6000, downpayment_php: 3000, payment_status: 'unpaid' }), 0, 'old code counted 3000');
    assert.equal(collectedFor({ total_php: 6000, downpayment_php: 3000, payment_status: 'partially_paid' }), 3000);
    assert.equal(collectedFor({ total_php: 6000, downpayment_php: 3000, payment_status: 'paid' }), 6000);
    assert.equal(collectedFor({ total_php: 6000, downpayment_php: 3000, payment_status: 'refunded' }), 0);
    assert.equal(collectedFor({ total_php: 6000, downpayment_php: 9000, payment_status: 'partially_paid' }), 6000);
  });
});

describe('booking pace', () => {
  test('counts room-nights booked in the last 28 days for stays within 60 days of booking', () => {
    const today = '2026-11-29';
    const b = [
      stay('2026-12-05', '2026-12-07', 1, { created_at: '2026-11-20T00:00:00Z' }),
      stay('2026-12-10', '2026-12-13', 1, { created_at: '2026-11-02T00:00:00Z' }),
      stay('2026-12-10', '2026-12-11', 1, { created_at: '2026-10-20T00:00:00Z' }),
      stay('2027-04-01', '2027-04-03', 1, { created_at: '2026-11-25T00:00:00Z' }),
      stay('2026-12-01', '2026-12-04', 1, { created_at: '2026-11-25T00:00:00Z', status: 'cancelled' }),
    ];
    const pace = bookingPace(b, today);
    assert.equal(pace.bookings, 2);
    assert.equal(pace.nights, 5);
    assert.equal(pace.nightsPerDay, 5 / 28);
  });
});

describe('forecast rules', () => {
  const units = 4;

  test('a finished month shows what happened, with no pickup', () => {
    const b = [stay('2026-10-10', '2026-10-12', 6000)];
    const f = forecastMonth({ bookings: b, units, yearMonth: '2026-10', todayIso: '2026-11-29', roomListRate: 3000 });
    assert.equal(f.status, 'past');
    assert.deepEqual(f.revenue, { low: 6000, expected: 6000, high: 6000 });
    assert.equal(f.pickupNights.expected, 0);
  });

  test('booked future nights are not counted twice and pickup only fills open nights', () => {
    const today = '2026-11-02';
    const b: ForecastBooking[] = [];
    for (let d = 10; d <= 29; d += 1) {
      b.push(stay(`2026-11-${String(d).padStart(2, '0')}`, `2026-11-${String(d + 1).padStart(2, '0')}`, 3000, { created_at: '2026-11-01T00:00:00Z' }));
    }
    const f = forecastMonth({ bookings: b, units, yearMonth: '2026-11', todayIso: today, roomListRate: 3000 });
    const fullMonth = units * 30 * 3000;
    assert.equal(f.onTheBooks.revenue, 20 * 3000);
    assert.ok(f.revenue.expected >= f.onTheBooks.revenue);
    assert.ok(f.revenue.high <= fullMonth);
    assert.ok(f.pickupNights.high <= f.openNights);
    const legacy = legacyCurrentMonthForecast(b, units, '2026-11', today, 3000);
    assert.ok(legacy > f.revenue.high, `old projection ${legacy} is above the new high estimate ${f.revenue.high}`);
  });

  test('the range is wider when the pace rests on fewer bookings', () => {
    const make = (count: number) =>
      Array.from({ length: count }, (_, i) => stay(isoFromIndex(dayIndex('2026-12-01') + (i % 25)), isoFromIndex(dayIndex('2026-12-01') + (i % 25) + 2), 6000, {
        created_at: isoFromIndex(dayIndex('2026-11-29') - (i % 27)),
      }));
    const few = forecastMonth({ bookings: make(4), units: 20, yearMonth: '2027-01', todayIso: '2026-11-29', roomListRate: 3000 });
    const many = forecastMonth({ bookings: make(64), units: 20, yearMonth: '2027-01', todayIso: '2026-11-29', roomListRate: 3000 });
    const relative = (f: typeof few) => (f.pickupNights.high - f.pickupNights.low) / Math.max(1, f.pickupNights.expected);
    assert.ok(relative(few) > relative(many));
  });

  test('with no recent bookings the expected pickup is zero but the high end is not', () => {
    const f = forecastMonth({ bookings: [], units, yearMonth: '2026-12', todayIso: '2026-11-29', roomListRate: 3000 });
    assert.equal(f.pickupNights.expected, 0);
    assert.ok(f.pickupNights.high > 0);
    assert.equal(f.rateSource, 'room list');
  });
});

describe('backtest on simulated booking history', () => {
  test('new forecast is closer to what happened than the old one, and its range is honest', () => {
    const runs: { actual: number; next: { low: number; expected: number; high: number }; legacy: number; current: number; currentActual: number }[] = [];
    let seed = 1;
    for (const demand of [0.7, 1.4, 2.4]) {
      for (let i = 0; i < 25; i += 1) {
        runs.push(simulateAndForecast(seed, demand));
        seed += 1;
      }
    }
    const ape = (forecast: number, actual: number) => Math.abs(forecast - actual) / Math.max(1, actual);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const newError = mean(runs.map((r) => ape(r.next.expected, r.actual)));
    const oldError = mean(runs.map((r) => ape(r.legacy, r.actual)));
    const currentError = mean(runs.map((r) => ape(r.current, r.currentActual)));
    const covered = mean(runs.map((r) => (r.actual >= r.next.low && r.actual <= r.next.high ? 1 : 0)));
    console.log(`    next month: new forecast off by ${(newError * 100).toFixed(1)}% on average, old forecast off by ${(oldError * 100).toFixed(1)}%`);
    console.log(`    this month (from mid-month): new forecast off by ${(currentError * 100).toFixed(1)}% on average`);
    console.log(`    actual revenue landed inside the low–high range in ${(covered * 100).toFixed(0)}% of ${runs.length} runs`);
    assert.ok(newError < oldError, 'new forecast must beat the old one');
    assert.ok(newError < 0.25, 'next-month error should stay under 25%');
    assert.ok(covered >= 0.6, 'the range should contain the result most of the time');
  });
});

describe('backtest under other booking habits', () => {
  test('still beats the old forecast when guests book earlier or later, or demand falls', () => {
    const scenarios = [
      { name: 'guests book ~7 days ahead', lead: 7, growth: 1.25 },
      { name: 'guests book ~30 days ahead', lead: 30, growth: 1.25 },
      { name: 'demand flat', lead: 14, growth: 1 },
      { name: 'demand falls 20%', lead: 14, growth: 0.8 },
    ];
    const ape = (forecast: number, actual: number) => Math.abs(forecast - actual) / Math.max(1, actual);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    let allNew: number[] = [];
    let allOld: number[] = [];
    let allCovered: number[] = [];
    let seed = 500;
    for (const sc of scenarios) {
      const runs = [];
      for (const demand of [0.7, 1.4, 2.4]) {
        for (let i = 0; i < 12; i += 1) {
          runs.push(simulateAndForecast(seed, demand, sc.lead, sc.growth));
          seed += 1;
        }
      }
      const newErr = runs.map((r) => ape(r.next.expected, r.actual));
      const oldErr = runs.map((r) => ape(r.legacy, r.actual));
      const covered = runs.map((r) => (r.actual >= r.next.low && r.actual <= r.next.high ? 1 : 0));
      allNew = allNew.concat(newErr);
      allOld = allOld.concat(oldErr);
      allCovered = allCovered.concat(covered);
      console.log(`    ${sc.name.padEnd(28)} new ${(mean(newErr) * 100).toFixed(1)}% · old ${(mean(oldErr) * 100).toFixed(1)}% · in range ${(mean(covered) * 100).toFixed(0)}%`);
    }
    assert.ok(mean(allNew) < mean(allOld));
    assert.ok(mean(allCovered) >= 0.6);
  });
});

// ---------------------------------------------------------------------------------------------------
// Simulation. Guests book mostly close to arrival (mean 14 days ahead), Fridays and Saturdays get 1.6x
// the arrivals, and demand grows 25% into the target month. None of this matches the forecast's
// "spread evenly over 60 days" assumption, which keeps the test fair.

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(lambda: number, rand: () => number): number {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rand();
  } while (p > limit);
  return k - 1;
}

function simulateAndForecast(seed: number, baseDemand: number, leadMeanDays = 14, growthIntoTarget = 1.25) {
  const rand = rng(seed);
  const units = 6;
  const start = dayIndex('2026-01-01');
  const today = dayIndex('2026-04-15');
  const end = dayIndex('2026-06-01');
  const occupancy = new Map<number, number>();
  const bookings: ForecastBooking[] = [];

  for (let created = start; created < end; created += 1) {
    const growth = created >= dayIndex('2026-04-01') ? growthIntoTarget : 1;
    const n = poisson(baseDemand * growth, rand);
    for (let k = 0; k < n; k += 1) {
      const lead = Math.min(89, Math.floor(-Math.log(1 - rand()) * leadMeanDays));
      const checkIn = created + lead;
      const weekday = new Date(checkIn * 86400000).getUTCDay();
      if ((weekday !== 5 && weekday !== 6) && rand() > 1 / 1.6) continue;
      const nights = 1 + Math.floor(rand() * 3);
      let free = true;
      for (let d = checkIn; d < checkIn + nights; d += 1) if ((occupancy.get(d) || 0) >= units) free = false;
      if (!free) continue;
      for (let d = checkIn; d < checkIn + nights; d += 1) occupancy.set(d, (occupancy.get(d) || 0) + 1);
      const rate = 2500 + Math.floor(rand() * 4) * 500;
      bookings.push({
        check_in: isoFromIndex(checkIn),
        check_out: isoFromIndex(checkIn + nights),
        total_php: rate * nights,
        status: 'confirmed',
        created_at: `${isoFromIndex(created)}T03:00:00Z`,
      });
    }
  }

  const known = bookings.filter((b) => dayIndex(String(b.created_at)) <= today);
  const todayIso = isoFromIndex(today);
  const nextMonth = forecastMonth({ bookings: known, units, yearMonth: nextYearMonth('2026-04'), todayIso, roomListRate: 3500 });
  const thisMonth = forecastMonth({ bookings: known, units, yearMonth: '2026-04', todayIso, roomListRate: 3500 });
  return {
    actual: monthOnTheBooks(bookings, '2026-05', units).revenue,
    currentActual: monthOnTheBooks(bookings, '2026-04', units).revenue,
    next: nextMonth.revenue,
    current: thisMonth.revenue.expected,
    legacy: legacyNextMonthForecast(known, units, '2026-04', todayIso, 3500),
  };
}

// ---------------------------------------------------------------------------------------------------
// The forecast as it was in LedgerView.tsx before this change, ported line for line for comparison.

function legacyOverlap(b: ForecastBooking, monthStartStr: string, monthEndStr: string): number {
  const cin = String(b.check_in || '').slice(0, 10);
  const cout = String(b.check_out || '').slice(0, 10);
  if (cin === cout) return cin >= monthStartStr && cin <= monthEndStr ? 1 : 0;
  const startD = cin < monthStartStr ? monthStartStr : cin;
  const endD = cout > monthEndStr ? monthEndStr : cout;
  return Math.max(0, Math.round((new Date(endD).getTime() - new Date(startD).getTime()) / 86400000));
}

function legacyMonth(bookings: ForecastBooking[], yearMonth: string) {
  const [y, m] = yearMonth.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const startStr = `${yearMonth}-01`;
  const endStr = `${yearMonth}-${String(days).padStart(2, '0')}`;
  const stays = bookings.filter((b) => {
    if (b.status === 'cancelled') return false;
    const cin = String(b.check_in || '').slice(0, 10);
    const cout = String(b.check_out || '').slice(0, 10);
    return cin === cout ? cin >= startStr && cin <= endStr : cin <= endStr && cout >= startStr;
  });
  let nights = 0;
  let revenue = 0;
  for (const b of stays) {
    const cin = String(b.check_in).slice(0, 10);
    const cout = String(b.check_out).slice(0, 10);
    const total = Math.max(1, Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000));
    const overlap = legacyOverlap(b, startStr, endStr);
    nights += overlap;
    revenue += overlap * (Number(b.total_php) / total);
  }
  return { stays, nights, revenue: Math.round(revenue), days, startStr, endStr };
}

function legacyMonthNights(bookings: ForecastBooking[], yearMonth: string): number {
  return legacyMonth(bookings, yearMonth).nights;
}

function legacyInputs(bookings: ForecastBooking[], units: number, yearMonth: string, todayIso: string, roomListRate: number) {
  const cur = legacyMonth(bookings, yearMonth);
  const available = units * cur.days;
  const occupied = Math.min(cur.nights, available);
  const adr = cur.nights > 0 ? Math.round(cur.revenue / cur.nights) : 0;
  const weight = cur.nights / (cur.nights + 4);
  const baselineADR = Math.round(adr > 0 ? weight * adr + (1 - weight) * roomListRate : roomListRate);
  const isCurrent = todayIso.slice(0, 7) === yearMonth;
  const currentDay = isCurrent ? Number(todayIso.slice(8, 10)) : cur.days;
  const dailyVelocity = cur.nights / Math.max(1, currentDay);
  const arrivals = cur.stays.filter((b) => String(b.check_in).slice(0, 10) >= cur.startStr).length;
  const weekend = cur.stays.filter((b) => [0, 5, 6].includes(new Date(`${String(b.check_in).slice(0, 10)}T00:00:00`).getDay())).length;
  const weekendRatio = weekend / Math.max(1, arrivals);
  const dowWeight = Math.min(1.35, Math.max(0.85, 1 + (weekendRatio - 0.4285) * 0.5));
  let leadTotal = 0;
  let leadCount = 0;
  for (const b of cur.stays) {
    if (!b.created_at) continue;
    leadTotal += Math.max(0, Math.round((new Date(String(b.check_in).slice(0, 10)).getTime() - new Date(String(b.created_at)).getTime()) / 86400000));
    leadCount += 1;
  }
  const avgLead = leadCount > 0 ? Number((leadTotal / leadCount).toFixed(1)) : 0;
  return { cur, available, occupied, baselineADR, isCurrent, currentDay, dailyVelocity, dowWeight, leadCount, avgLead };
}

function legacyCurrentMonthForecast(bookings: ForecastBooking[], units: number, yearMonth: string, todayIso: string, roomListRate: number): number {
  const x = legacyInputs(bookings, units, yearMonth, todayIso, roomListRate);
  const daysLeft = x.isCurrent ? Math.max(0, x.cur.days - x.currentDay) : 0;
  const capacity = daysLeft * units;
  const pickup = x.isCurrent ? Math.min(capacity, Math.round(x.dailyVelocity * daysLeft * x.dowWeight)) : 0;
  return Math.round(x.cur.revenue + pickup * x.baselineADR);
}

function legacyNextMonthForecast(bookings: ForecastBooking[], units: number, yearMonth: string, todayIso: string, roomListRate: number): number {
  const x = legacyInputs(bookings, units, yearMonth, todayIso, roomListRate);
  const next = legacyMonth(bookings, nextYearMonth(yearMonth));
  const nextCapacity = units * next.days;
  const remaining = Math.max(0, nextCapacity - next.nights);
  const occupancyRatio = x.available > 0 ? x.occupied / x.available : 0;
  const velocityAbsorption = nextCapacity > 0 ? (x.dailyVelocity * next.days) / nextCapacity : 0;
  const leadDecay = x.leadCount > 0 ? 1 / (1 + Math.exp(-0.12 * (14 - x.avgLead))) : 0;
  const pHat = Math.min(0.85, Math.max(0, Number((0.45 * occupancyRatio + 0.4 * velocityAbsorption + 0.15 * leadDecay).toFixed(4))));
  const pickup = Math.min(remaining, Math.max(0, Math.round(Math.max(1, remaining) * pHat)));
  return Math.round(next.revenue + pickup * x.baselineADR);
}
