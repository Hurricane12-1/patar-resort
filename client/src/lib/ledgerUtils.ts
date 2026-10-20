export interface PoolAddonOption {
  id: string;
  label: string;
  shortName: string;
  pricePerGuest: number;
}

export const POOL_ADDON_OPTIONS: PoolAddonOption[] = [
  { id: 'none', label: 'Room Only (No Swimming Pool Access) - ₱0', shortName: 'Room Only', pricePerGuest: 0 },
  { id: 'day_pool', label: 'Day Swimming Pool Pass (8:00 AM - 5:00 PM) - +₱150 / guest', shortName: 'Day Pool Pass', pricePerGuest: 150 },
  { id: 'night_pool', label: 'Night Swimming Pool Pass (6:00 PM - 10:00 PM) - +₱200 / guest', shortName: 'Night Pool Pass', pricePerGuest: 200 },
  { id: 'unlimited_pool', label: 'All-Day Unlimited Swimming Pool Pass (Day & Night) - +₱300 / guest', shortName: 'Unlimited Pool Pass', pricePerGuest: 300 },
];

/**
 * Ledger & Reservation Financial Utilities - Rock View Beach Resort
 * Provides enterprise arithmetic calculations, VAT partitioning, overlap validation,
 * format auto-detection, and RFC-4180 CSV generation.
 */

export interface VatBreakdown {
  totalAmt: number;
  vatableSales: number;
  vatAmount: number;
  vatExempt: number;
  ratePerNight: number;
  diffDays: number;
}

/**
 * Computes non-VAT and standard BIR Philippines tax breakdowns
 */
export function computeVatBreakdown(totalAmt: number, checkIn?: string, checkOut?: string): VatBreakdown {
  const dIn = checkIn ? new Date(checkIn).getTime() : 0;
  const dOut = checkOut ? new Date(checkOut).getTime() : 0;
  const diffDays = Math.max(1, Math.round((dOut - dIn) / 86400000)) || 1;
  const ratePerNight = Math.round(totalAmt / diffDays);
  const vatableSales = totalAmt / 1.12;
  const vatAmount = totalAmt - vatableSales;

  return {
    totalAmt,
    vatableSales,
    vatAmount,
    vatExempt: 0,
    ratePerNight,
    diffDays,
  };
}

/**
 * Validates whether requested dates collide with existing active bookings
 */
export function validateBookingOverlap(
  checkIn: string,
  checkOut: string,
  existingBookings: any[],
  roomId?: string,
  excludeBookingId?: string
): { hasOverlap: boolean; conflictingBooking?: any } {
  if (!checkIn || !checkOut || !existingBookings || existingBookings.length === 0) {
    return { hasOverlap: false };
  }

  for (const b of existingBookings) {
    if (excludeBookingId && b.id === excludeBookingId) continue;
    if (b.status === 'cancelled') continue;
    if (roomId && b.room_id && b.room_id !== roomId) continue;

    const bIn = (b.check_in || '').slice(0, 10);
    const bOut = (b.check_out || '').slice(0, 10);

    if (!bIn || !bOut) continue;

    // Standard interval overlap condition: [A_start, A_end) overlaps [B_start, B_end)
    if (checkIn < bOut && checkOut > bIn) {
      return { hasOverlap: true, conflictingBooking: b };
    }
  }

  return { hasOverlap: false };
}

/**
 * Heuristically detects the incoming file format (SQL dump, JSON dataset, or CSV tabular)
 */
export function detectImportFormat(content: string): 'sql' | 'json' | 'csv' {
  const trimmed = content.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }

  const sqlKeywords = ['create table', 'insert into', 'select ', 'begin;', 'commit;', 'copy '];
  const lower = trimmed.toLowerCase();
  if (sqlKeywords.some((kw) => lower.includes(kw)) || trimmed.startsWith('--')) {
    return 'sql';
  }

  if (trimmed.includes(',') && trimmed.includes('\n')) {
    return 'csv';
  }

  return 'sql';
}

export interface DailySalesMetric {
  date: string;
  day: number;
  label: string;
  revenue: number;
  bookings: number;
}

/**
 * Calculates October 2026 daily resort room revenues from real booking records
 */
export function calculateOctoberMetrics(
  allBookings: any[],
  apiDailyData?: any[]
): DailySalesMetric[] {
  const daysInOct = 31;
  const days: DailySalesMetric[] = [];

  for (let day = 1; day <= daysInOct; day++) {
    const dStr = `2026-10-${String(day).padStart(2, '0')}`;
    let revOnDay = 0;
    let bookingsOnDay = 0;

    allBookings.forEach((b: any) => {
      if (b.status === 'cancelled') return;
      const cin = (b.check_in || '').slice(0, 10);
      const cout = (b.check_out || '').slice(0, 10);

      if (cin <= dStr && cout >= dStr) {
        const nights = Math.max(1, Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000));
        const dailyRate = (Number(b.total_php) || 0) / nights;
        revOnDay += dailyRate;
        bookingsOnDay += 1;
      }
    });

    const apiDaily = apiDailyData?.find((d: any) => d.date === dStr);
    if (apiDaily && apiDaily.revenue_php > 0) {
      revOnDay = Math.max(revOnDay, Number(apiDaily.revenue_php));
      bookingsOnDay = Math.max(bookingsOnDay, Number(apiDaily.bookings));
    }

    days.push({
      date: dStr,
      day,
      label: `Oct ${day}`,
      revenue: Math.round(revOnDay),
      bookings: bookingsOnDay,
    });
  }

  return days;
}

/**
 * Exports current reservations collection into RFC-4180 compliant CSV and triggers browser download
 */
export function exportReservationsCSV(allBookings: any[]): boolean {
  if (!allBookings || allBookings.length === 0) {
    return false;
  }

  const headers = [
    'Booking ID',
    'Guest Name',
    'Room',
    'Check In',
    'Check Out',
    'Total PHP',
    'Status',
    'Payment Status',
    'Payment Method',
    'Phone',
    'Email',
  ];

  const rows = allBookings.map((b: any) => [
    b.id || '',
    `"${(b.guest_name || b.profiles?.full_name || 'Guest').replace(/"/g, '""')}"`,
    `"${(b.rooms?.name || 'Room').replace(/"/g, '""')}"`,
    b.check_in || '',
    b.check_out || '',
    b.total_php || 0,
    b.status || 'confirmed',
    b.payment_status || 'unpaid',
    b.payment_method || 'Cash',
    `"${(b.phone || b.profiles?.phone || '').replace(/"/g, '""')}"`,
    `"${(b.guest_email || b.profiles?.email || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rockview_reservations_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
