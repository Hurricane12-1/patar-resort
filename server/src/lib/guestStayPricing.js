// Same rules as computeStayPrice in client/src/lib/guestRooms.ts, which the booking page shows.
// Change both files together, or the price on the page and the price the server stores will drift apart.
export const CLEANING_FEE_PHP = 500;
export const COASTAL_FEE_PHP = 150;
export const WEEKEND_RATE_MULTIPLIER = 1.15;

const DAY_MS = 86400000;

function utcMidnight(isoDate) {
  return Date.parse(`${String(isoDate).slice(0, 10)}T00:00:00Z`);
}

export function computeGuestStayTotal({ rate_php, check_in, check_out }) {
  const baseRate = Math.max(0, Number(rate_php) || 0);
  const start = utcMidnight(check_in);
  const nights = Math.max(0, Math.round((utcMidnight(check_out) - start) / DAY_MS));
  if (nights <= 0) {
    return { nights: 0, nightsTotal: 0, cleaningFee: CLEANING_FEE_PHP, coastalFee: COASTAL_FEE_PHP, grandTotal: 0 };
  }

  let nightsTotal = 0;
  for (let i = 0; i < nights; i += 1) {
    const weekday = new Date(start + i * DAY_MS).getUTCDay();
    const isWeekendNight = weekday === 5 || weekday === 6;
    nightsTotal += isWeekendNight ? Math.round(baseRate * WEEKEND_RATE_MULTIPLIER) : baseRate;
  }

  return {
    nights,
    nightsTotal,
    cleaningFee: CLEANING_FEE_PHP,
    coastalFee: COASTAL_FEE_PHP,
    grandTotal: nightsTotal + CLEANING_FEE_PHP + COASTAL_FEE_PHP,
  };
}
