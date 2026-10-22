export const money = (n: any) => `₱${Number(n || 0).toLocaleString()}`;

export const parseSafeDate = (d: any): Date | null => {
  if (!d) return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
  if (typeof d === 'number') {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  }
  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (!trimmed) return null;
    // Pure YYYY-MM-DD date without time (e.g. check_in '2026-10-17')
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const dt = new Date(trimmed + 'T00:00:00');
      if (!isNaN(dt.getTime())) return dt;
    }
    // Direct parse for ISO strings or valid date representations
    let dt = new Date(trimmed);
    if (!isNaN(dt.getTime())) return dt;
    // Pure numeric epoch timestamp string
    if (/^\d+$/.test(trimmed)) {
      dt = new Date(Number(trimmed));
      if (!isNaN(dt.getTime())) return dt;
    }
  }
  return null;
};

export const fmtDate = (d: any) => {
  const dt = parseSafeDate(d);
  if (!dt) return 'Recently';
  return dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

export const fmtTime = (d: any) => {
  const dt = parseSafeDate(d);
  if (!dt) return '';
  return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export const formatTime12Hour = (timeStr?: string) => {
  if (!timeStr) return '';
  const trimmed = String(timeStr).trim();
  if (/am|pm/i.test(trimmed)) {
    return trimmed.replace(/\s*(am|pm)/i, (_, p1) => ` ${p1.toUpperCase()}`).trim();
  }
  const [hStr, mStr] = trimmed.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${mStr ? mStr.slice(0, 2) : '00'} ${period}`;
};

export const initials = (n = '?') => n.trim().split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

export function to11Digits(val: string): string {
  if (!val) return '';
  let digits = String(val).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('63')) {
    digits = '0' + digits.slice(2);
  }
  if (!digits.startsWith('0')) {
    digits = '0' + digits;
  }
  return digits.slice(0, 11);
}

export const addDaysISO = (base: any, days: number) => {
  const d = parseSafeDate(base) || new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
