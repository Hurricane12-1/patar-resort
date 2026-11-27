import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from './Toasts.tsx';
import { fmtDate } from '../lib/format.ts';
import { supabase } from '../lib/supabaseClient.ts';
import {
  api,
  addDaysYMD,
  extractBookingTimes,
  parseBookingTimeMs,
  isBookingCollisionWithGap,
  TWO_HOURS_MS,
} from '../lib/api.ts';
import { getManilaTodayISO, inferOfferingType } from '../lib/offeringSpecs';
import { unitDisplayNames } from '../lib/unitNames';
import '../styles/availability-calendar.css';

const MIN_CALENDAR_ROWS = 11;

export interface CalendarStay {
  id: string;
  unitId: string;
  roomId?: string;
  assignedUnitId?: string;
  assignedUnitNumber?: number;
  isUnassigned?: boolean;
  unassignedRowIndex?: number;
  unitName: string;
  guestName: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  checkInTime?: string;
  checkOutTime?: string;
  status: 'confirmed' | 'pending' | 'checked_in' | 'checked_out' | 'cancelled';
  totalPhp?: number;
  phone?: string;
  email?: string;
  notes?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  colorType?: 'green' | 'orange' | 'purple' | 'gray' | 'blue';
}

export interface UnitInfo {
  id: string;
  roomId: string;
  unitNumber: number;
  name: string;
  label: string;
  ratePhp: number;
  kind: 'room' | 'cottage';
}

interface AvailabilityCalendarProps {
  selectedRoomId?: string;
  rooms?: any[];
  bookings?: any[];
  initialCheckIn?: string;
  initialCheckOut?: string;
  onSelectDates?: (
    checkIn: string,
    checkOut: string,
    roomId?: string,
    unitInfo?: UnitInfo
  ) => void;
  onReset?: () => void;
  onRoomChange?: (roomId: string) => void;
  onSelectBooking?: (booking: any) => void;
  onNewBooking?: () => void;
  onViewList?: () => void;
  isLightMode?: boolean;
  onClose?: () => void;
  mode?: 'timeline' | 'picker';
  numDays?: number;
  statusFilter?: string;
  showNewBookingInTopBar?: boolean;
  showMetrics?: boolean;
  selectionTarget?: 'checkIn' | 'checkOut' | 'auto';
  allowSameDay?: boolean;
}

const DEFAULT_NUM_DAYS = 14;

const getLocalDateString = (d: Date = new Date()): string => {
  return getManilaTodayISO(d);
};

export default function AvailabilityCalendar({
  selectedRoomId,
  rooms = [],
  bookings = [],
  initialCheckIn,
  initialCheckOut,
  onSelectDates,
  onReset,
  onSelectBooking,
  onNewBooking,
  isLightMode = true,
  numDays = DEFAULT_NUM_DAYS,
  statusFilter = 'all',
  showNewBookingInTopBar = false,
  showMetrics = false,
  selectionTarget = 'auto',
  allowSameDay = true,
}: AvailabilityCalendarProps) {
  const daysCount = numDays || DEFAULT_NUM_DAYS;

  const [liveRooms, setLiveRooms] = useState<any[]>([]);
  const [liveBookings, setLiveBookings] = useState<any[]>([]);
  const [, setLoading] = useState(false);

  const todayStr = useMemo(() => getLocalDateString(), []);

  const [windowStartDateStr, setWindowStartDateStr] = useState<string>(() => {
    return getLocalDateString();
  });

  const [kindFilter, setKindFilter] = useState<'all' | 'room' | 'cottage'>('all');
  const [selectedCell, setSelectedCell] = useState<{ unitId: string; dateStr: string } | null>(null);
  const [activeDetailStay, setActiveDetailStay] = useState<CalendarStay | null>(null);
  const [savingBookingEdit, setSavingBookingEdit] = useState(false);

  // Real-Time Supabase & Public Calendar API Fetcher
  const fetchRealtimeData = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Fetch active rooms from Supabase with API fallback
      let currentRooms: any[] = [];
      try {
        const { data: dbRooms, error: rErr } = await supabase
          .from('rooms')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (!rErr && Array.isArray(dbRooms)) {
          currentRooms = dbRooms;
          setLiveRooms(dbRooms);
        }
      } catch {}

      if (currentRooms.length === 0) {
        try {
          const apiRooms = await api.rooms();
          if (Array.isArray(apiRooms)) {
            currentRooms = apiRooms;
            setLiveRooms(apiRooms);
          }
        } catch {}
      }

      // 2. Fetch ALL active booked ranges across all users (bypasses RLS via backend sysClient)
      const bookingsMap = new Map<string, any>();

      try {
        const calData = await api.availabilityCalendar();
        if (calData && Array.isArray(calData.booked_ranges)) {
          calData.booked_ranges.forEach((b: any) => {
            if (!b?.id) return;
            bookingsMap.set(String(b.id), {
              id: String(b.id),
              room_id: b.room_id,
              check_in: (b.check_in || '').slice(0, 10),
              check_out: (b.check_out || '').slice(0, 10),
              status: b.status || 'confirmed',
              notes: b.notes || '',
              guest_name: b.guest_name || 'Reserved',
              rooms: { id: b.room_id, name: b.room_name || 'Villa' },
            });
          });
        }
      } catch {}

      // 3. Enrich with direct Supabase reservations (for staff/admin or own user records)
      try {
        const { data: dbReservations, error: bErr } = await supabase
          .from('reservations')
          .select('*, rooms(id, name, rate_php), profiles(id, full_name, email, phone)')
          .order('check_in', { ascending: true });

        if (!bErr && Array.isArray(dbReservations)) {
          dbReservations.forEach((b: any) => {
            if (!b?.id) return;
            const idStr = String(b.id);
            const existing = bookingsMap.get(idStr) || {};
            bookingsMap.set(idStr, {
              ...existing,
              ...b,
              id: idStr,
              check_in: (b.check_in || existing.check_in || '').slice(0, 10),
              check_out: (b.check_out || existing.check_out || '').slice(0, 10),
            });
          });
        }
      } catch {}

      // Always set merged array (even if empty) so cancelled/deleted stays clear immediately
      setLiveBookings(Array.from(bookingsMap.values()));
    } catch (err: any) {
      console.warn('[Realtime Calendar Notice]:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to real-time Postgres changes
  useEffect(() => {
    let active = true;
    fetchRealtimeData();

    const channelName = `pms_calendar_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        if (active) fetchRealtimeData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        if (active) fetchRealtimeData();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [fetchRealtimeData]);

  // Re-sync whenever parent rooms, bookings, or selectedRoomId changes
  useEffect(() => {
    fetchRealtimeData();
  }, [rooms?.length, bookings?.length, selectedRoomId, fetchRealtimeData]);

  // Merge prop rooms and live rooms by id (strictly active rooms, filtered by selectedRoomId if set)
  const activeRooms = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of liveRooms) {
      if (r && r.id) map.set(String(r.id), r);
    }
    for (const r of rooms || []) {
      if (r && r.id) map.set(String(r.id), { ...map.get(String(r.id)), ...r });
    }
    return Array.from(map.values()).filter((r) => r && r.is_active !== false);
  }, [liveRooms, rooms]);

  const effectiveRooms = useMemo(() => {
    if (selectedRoomId && selectedRoomId !== 'all') {
      const filtered = activeRooms.filter((r) => String(r.id) === String(selectedRoomId));
      if (filtered.length > 0) return filtered;
    }
    return activeRooms;
  }, [activeRooms, selectedRoomId]);

  const unitNames = useMemo(() => unitDisplayNames(activeRooms), [activeRooms]);

  // Merge prop bookings and live bookings by id, scoped to selectedRoomId when filtering a single room
  const effectiveBookings = useMemo(() => {
    const map = new Map<string, any>();
    for (const b of liveBookings) {
      if (b && b.id) map.set(String(b.id), b);
    }
    for (const b of bookings || []) {
      if (b && b.id) map.set(String(b.id), { ...map.get(String(b.id)), ...b });
    }
    const all = Array.from(map.values());
    if (selectedRoomId && selectedRoomId !== 'all') {
      return all.filter((b) => String(b.room_id) === String(selectedRoomId));
    }
    return all;
  }, [liveBookings, bookings, selectedRoomId]);

  // Physical units dynamically derived from open rooms and their units count
  const units: UnitInfo[] = useMemo(() => {
    const list: UnitInfo[] = [];
    let unitCounter = 1;

    effectiveRooms.forEach((r) => {
      const numUnits = Math.max(1, Number(r.units) || 1);
      for (let u = 1; u <= numUnits; u++) {
        const name = unitNames.get(`${r.id}:${u}`) || `Unit ${unitCounter}`;
        list.push({
          id: `unit_${unitCounter}`,
          roomId: String(r.id),
          unitNumber: unitCounter,
          name,
          label: `${r.name} (${name})`,
          ratePhp: r.rate_php || 3500,
          kind: inferOfferingType(r) === 'cottage' ? 'cottage' : 'room',
        });
        unitCounter++;
      }
    });

    return list;
  }, [effectiveRooms, unitNames]);

  const visibleUnits = useMemo(
    () => (kindFilter === 'all' ? units : units.filter((u) => u.kind === kindFilter)),
    [units, kindFilter]
  );
  const showKindFilter = !selectedRoomId || selectedRoomId === 'all';

  // Generate days array starting from windowStartDateStr
  const daysArray = useMemo(() => {
    const days: { dateStr: string; dayNum: number; dayOfWeek: string; isToday: boolean }[] = [];

    for (let i = 0; i < daysCount; i++) {
      const dStr = addDaysYMD(windowStartDateStr, i);
      const noonUtc = new Date(`${dStr}T12:00:00Z`);
      const dayNum = noonUtc.getUTCDate();
      const dayOfWeek = noonUtc.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase();
      const isToday = dStr === todayStr;

      days.push({ dateStr: dStr, dayNum, dayOfWeek, isToday });
    }
    return days;
  }, [windowStartDateStr, todayStr, daysCount]);

  const windowEndDateStr = useMemo(() => {
    if (daysArray.length === 0) return todayStr;
    return daysArray[daysArray.length - 1].dateStr;
  }, [daysArray, todayStr]);

  const dateRangeLabel = useMemo(() => {
    if (daysArray.length === 0) return '';
    const startD = new Date(`${daysArray[0].dateStr}T12:00:00Z`);
    const endD = new Date(`${daysArray[daysArray.length - 1].dateStr}T12:00:00Z`);

    const startMonth = startD.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const endMonth = endD.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const year = endD.getUTCFullYear();

    return `${startMonth} ${startD.getUTCDate()} – ${endMonth} ${endD.getUTCDate()}, ${year}`;
  }, [daysArray]);

  const parseTimes = (b: any) => {
    const notes = b.notes || '';
    const inMatch = notes.match(/In\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
    const outMatch = notes.match(/Out\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
    const timeMatch = notes.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);

    const checkInTime = inMatch ? `In ${inMatch[1]}` : timeMatch ? timeMatch[1] : 'In 2:00 PM';
    const checkOutTime = outMatch ? `Out ${outMatch[1]}` : 'Out 12:00 PM';

    return { checkInTime, checkOutTime };
  };

  // Stays & Unassigned Allocation (excludes cancelled/checked_out from blocking units)
  const { assignedStays, unassignedStays, unassignedTracksCount } = useMemo(() => {
    const assigned: CalendarStay[] = [];
    const unassigned: CalendarStay[] = [];

    const unitTimelines: Map<number, { checkIn: string; checkOut: string; startMs: number; endMs: number; id: string }[]> = new Map();
    units.forEach((u) => unitTimelines.set(u.unitNumber, []));

    effectiveBookings.forEach((b: any, bIdx: number) => {
      const cin = (b.check_in || '').slice(0, 10);
      const cout = (b.check_out || '').slice(0, 10);
      if (!cin || !cout) return;

      const normalizedStatus = String(b.status || 'confirmed').toLowerCase() as CalendarStay['status'];
      const isBlocking = !['cancelled', 'checked_out'].includes(normalizedStatus);

      const { checkInTime, checkOutTime } = parseTimes(b);
      const bTimes = extractBookingTimes(b);
      const bStartMs = parseBookingTimeMs(cin, bTimes.check_in_time);
      const bEndMs = parseBookingTimeMs(cout, bTimes.check_out_time);

      const roomUnits = units.filter((u) => String(u.roomId) === String(b.room_id));
      const candidateUnits = roomUnits.length > 0 ? roomUnits : units;

      const noteUnitMatch = (b.notes || '').match(/\[?(?:Unit\s*|u)(\d+)\]?/i);
      let targetUnitNum: number | null = noteUnitMatch ? parseInt(noteUnitMatch[1], 10) : null;

      let hasAssignedUnit = false;
      if (targetUnitNum) {
        const matched = candidateUnits.find((u) => u.unitNumber === targetUnitNum) || candidateUnits[targetUnitNum - 1];
        if (matched) {
          const timeline = unitTimelines.get(matched.unitNumber) || [];
          const hasCollision = isBlocking
            ? timeline.some((t) => isBookingCollisionWithGap(bStartMs, bEndMs, t.startMs, t.endMs, TWO_HOURS_MS))
            : false;
          if (!hasCollision) {
            if (isBlocking) {
              timeline.push({ checkIn: cin, checkOut: cout, startMs: bStartMs, endMs: bEndMs, id: b.id });
            }
            targetUnitNum = matched.unitNumber;
            hasAssignedUnit = true;
          }
        }
      }

      if (!hasAssignedUnit) {
        for (const u of candidateUnits) {
          const timeline = unitTimelines.get(u.unitNumber) || [];
          const hasCollision = isBlocking
            ? timeline.some((t) => isBookingCollisionWithGap(bStartMs, bEndMs, t.startMs, t.endMs, TWO_HOURS_MS))
            : false;
          if (!hasCollision) {
            if (isBlocking) {
              timeline.push({ checkIn: cin, checkOut: cout, startMs: bStartMs, endMs: bEndMs, id: b.id });
            }
            targetUnitNum = u.unitNumber;
            hasAssignedUnit = true;
            break;
          }
        }
      }

      const stayObj: CalendarStay = {
        id: b.id || `booking-${bIdx}`,
        unitId: hasAssignedUnit ? `unit_${targetUnitNum}` : 'unassigned',
        roomId: b.room_id || '',
        assignedUnitId: hasAssignedUnit ? `unit_${targetUnitNum}` : undefined,
        assignedUnitNumber: hasAssignedUnit && targetUnitNum ? targetUnitNum : undefined,
        isUnassigned: !hasAssignedUnit,
        unitName: hasAssignedUnit && targetUnitNum
          ? units.find((u) => u.unitNumber === targetUnitNum)?.name || `Unit ${targetUnitNum}`
          : 'Unassigned',
        guestName: b.guest_name || b.profiles?.full_name || 'Reserved',
        checkIn: cin,
        checkOut: cout,
        checkInTime,
        checkOutTime,
        status: normalizedStatus,
        totalPhp: b.total_php || b.rooms?.rate_php || 3500,
        phone: b.phone || b.profiles?.phone || '',
        email: b.email || b.guest_email || b.profiles?.email || '',
        notes: b.notes || '',
        paymentStatus: b.payment_status || 'unpaid',
        paymentMethod: b.payment_method || 'Cash',
      };

      if (hasAssignedUnit) {
        assigned.push(stayObj);
      } else {
        unassigned.push(stayObj);
      }
    });

    const unassignedTracks: { checkIn: string; checkOut: string }[][] = [];
    unassigned.forEach((stay) => {
      let placedTrack = -1;
      for (let t = 0; t < unassignedTracks.length; t++) {
        const collides = unassignedTracks[t].some((s) => stay.checkIn < s.checkOut && stay.checkOut > s.checkIn);
        if (!collides) {
          placedTrack = t;
          break;
        }
      }
      if (placedTrack === -1) {
        placedTrack = unassignedTracks.length;
        unassignedTracks.push([]);
      }
      unassignedTracks[placedTrack].push({ checkIn: stay.checkIn, checkOut: stay.checkOut });
      stay.unassignedRowIndex = placedTrack;
    });

    return {
      assignedStays: assigned,
      unassignedStays: unassigned,
      unassignedTracksCount: unassignedTracks.length,
    };
  }, [effectiveBookings, units]);

  const visibleAssignedStays = useMemo(() => {
    if (!statusFilter || statusFilter === 'all') return assignedStays;
    return assignedStays.filter((s) => s.status === statusFilter);
  }, [assignedStays, statusFilter]);

  const visibleUnassignedStays = useMemo(() => {
    if (!statusFilter || statusFilter === 'all') return unassignedStays;
    return unassignedStays.filter((s) => s.status === statusFilter);
  }, [unassignedStays, statusFilter]);

  const allStays = useMemo(() => {
    return [...assignedStays, ...unassignedStays];
  }, [assignedStays, unassignedStays]);

  // Active (blocking) stays only
  const activeBlockingStays = useMemo(() => {
    return allStays.filter((s) => !['cancelled', 'checked_out'].includes(s.status));
  }, [allStays]);

  const metrics = useMemo(() => {
    const arriving = activeBlockingStays.filter((s) => s.checkIn === todayStr).length;
    const departing = activeBlockingStays.filter((s) => s.checkOut === todayStr).length;
    const staysInView = activeBlockingStays.filter(
      (s) => s.checkIn <= windowEndDateStr && s.checkOut >= windowStartDateStr
    ).length;
    const occupiedToday = activeBlockingStays.filter(
      (s) => s.checkIn <= todayStr && s.checkOut > todayStr
    ).length;
    const availableToday = Math.max(0, units.length - occupiedToday);

    return {
      arriving,
      departing,
      staysInView,
      availableToday,
      totalUnits: units.length,
    };
  }, [activeBlockingStays, todayStr, windowEndDateStr, windowStartDateStr, units.length]);

  const stayNightsCount = useMemo(() => {
    if (!initialCheckIn || !initialCheckOut) return 1;
    const cin = new Date(`${initialCheckIn}T12:00:00Z`);
    const cout = new Date(`${initialCheckOut}T12:00:00Z`);
    const diffDays = Math.round((cout.getTime() - cin.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  }, [initialCheckIn, initialCheckOut]);

  const activeUnitId = useMemo(() => {
    if (selectedCell?.unitId && selectedCell.unitId !== 'unassigned') {
      return selectedCell.unitId;
    }
    if (selectedRoomId && selectedRoomId !== 'all') {
      const roomUnits = units.filter((u) => String(u.roomId) === String(selectedRoomId));
      if (roomUnits.length > 0) return roomUnits[0].id;
    }
    if (units.length > 0) {
      return units[0].id;
    }
    return null;
  }, [selectedCell, selectedRoomId, units]);

  const handleReset = useCallback(() => {
    setSelectedCell(null);
    if (onReset) {
      onReset();
    } else if (onSelectDates) {
      onSelectDates('', '', undefined, undefined);
    }
    toast('✦ Stay selection cleared. Pick an available date to start fresh.');
  }, [onReset, onSelectDates]);

  const handlePrevWindow = () => {
    setWindowStartDateStr(addDaysYMD(windowStartDateStr, -daysCount));
  };

  const handleNextWindow = () => {
    setWindowStartDateStr(addDaysYMD(windowStartDateStr, daysCount));
  };

  const handleTodayClick = () => {
    setWindowStartDateStr(todayStr);
  };

  const getStayColorClass = (stay: CalendarStay) => {
    if (stay.status === 'cancelled') return 'pms-stay-cancelled';
    if (stay.status === 'checked_out' || stay.checkOut < todayStr) return 'pms-stay-checked_out';
    if (stay.status === 'pending') return 'pms-stay-pending';
    if (stay.status === 'checked_in') return 'pms-stay-checked_in';

    const notesLower = (stay.notes || '').toLowerCase();
    if (notesLower.includes('purple') || notesLower.includes('channel') || notesLower.includes('online')) {
      return 'pms-stay-purple';
    }
    if (notesLower.includes('orange') || notesLower.includes('deposit') || notesLower.includes('pending')) {
      return 'pms-stay-pending';
    }

    return 'pms-stay-confirmed';
  };

  const handleCellClick = (unitId: string, dateStr: string) => {
    if (dateStr < todayStr) {
      toast('⚠️ That date has already passed. Please select an upcoming date for your stay.', true);
      return;
    }
    if (!allowSameDay && dateStr <= todayStr) {
      toast('Same-day bookings are walk-in only and unavailable online. Please select tomorrow or a later date.', true);
      return;
    }
    const matchedUnit = units.find((u) => u.id === unitId);

    // Block clicking any date already reserved by an active booking
    const unitReserved = activeBlockingStays.some(
      (s) =>
        (s.unitId === unitId || (matchedUnit && String(s.roomId) === String(matchedUnit.roomId) && s.isUnassigned)) &&
        dateStr >= s.checkIn &&
        dateStr < s.checkOut
    );
    if (unitReserved) {
      toast(`⚠️ ${matchedUnit?.name || 'Unit'} is already reserved on ${fmtDate(dateStr)}. Please pick an open date.`, true);
      return;
    }

    // Select / Unselect Toggle Logic
    const isSameCheckOut = initialCheckOut && dateStr === initialCheckOut;
    const isSameCheckIn = initialCheckIn && dateStr === initialCheckIn;
    const isSameCell = selectedCell?.unitId === unitId && selectedCell?.dateStr === dateStr;

    if (isSameCheckOut) {
      setSelectedCell(null);
      if (onSelectDates && initialCheckIn) {
        onSelectDates(initialCheckIn, '', matchedUnit?.roomId, matchedUnit);
      } else if (onReset) {
        onReset();
      }
      toast(`✦ Unselected Check-Out (${fmtDate(dateStr)}). Tap any open date to set Check-Out.`);
      return;
    }

    if (isSameCheckIn || isSameCell) {
      handleReset();
      return;
    }

    setSelectedCell({ unitId, dateStr });

    let newInStr = dateStr;
    let newOutStr = addDaysYMD(dateStr, 1);

    if (
      initialCheckIn &&
      dateStr > initialCheckIn &&
      (!initialCheckOut || initialCheckOut === addDaysYMD(initialCheckIn, 1) || selectionTarget === 'checkOut')
    ) {
      newInStr = initialCheckIn;
      newOutStr = dateStr;
    } else if (selectionTarget === 'checkOut') {
      if (initialCheckIn && dateStr > initialCheckIn) {
        newInStr = initialCheckIn;
        newOutStr = dateStr;
      } else {
        newInStr = dateStr;
        newOutStr = addDaysYMD(dateStr, 1);
      }
    } else if (selectionTarget === 'checkIn') {
      if (initialCheckOut && dateStr < initialCheckOut) {
        newInStr = dateStr;
        newOutStr = initialCheckOut;
      } else {
        newInStr = dateStr;
        newOutStr = addDaysYMD(dateStr, 1);
      }
    }

    const reqStartMs = parseBookingTimeMs(newInStr, '14:00');
    const reqEndMs = parseBookingTimeMs(newOutStr, '12:00');

    const activeStaysOnRange = activeBlockingStays.filter((s) => {
      const sTimes = extractBookingTimes(s);
      const sStartMs = parseBookingTimeMs(s.checkIn, sTimes.check_in_time);
      const sEndMs = parseBookingTimeMs(s.checkOut, sTimes.check_out_time);
      return isBookingCollisionWithGap(reqStartMs, reqEndMs, sStartMs, sEndMs, TWO_HOURS_MS);
    });

    const unitConflict = activeStaysOnRange.find((s) => s.unitId === unitId);
    const roomObj = effectiveRooms.find((r) => String(r.id) === String(matchedUnit?.roomId));
    const roomCapacityUnits = Math.max(1, Number(roomObj?.units) || 1);
    const roomStaysOnRange = activeStaysOnRange.filter(
      (s) => String(s.roomId) === String(matchedUnit?.roomId) || effectiveRooms.length <= 1
    );

    if (unitConflict) {
      const sTimes = extractBookingTimes(unitConflict);
      const sStartMs = parseBookingTimeMs(unitConflict.checkIn, sTimes.check_in_time);
      const sEndMs = parseBookingTimeMs(unitConflict.checkOut, sTimes.check_out_time);
      const isDirectOverlap = reqStartMs < sEndMs && reqEndMs > sStartMs;

      if (!isDirectOverlap) {
        toast(
          `⚠️ Mandatory 2-Hour Cleaning Buffer: ${matchedUnit?.name || 'Unit'} has a stay departing or checking in within 2 hours of ${fmtDate(newInStr)}. Housekeeping requires a 2-hour sanitation gap before next guest check-in.`,
          true
        );
      } else {
        toast(
          `⚠️ Already Booked: ${matchedUnit?.name || 'Unit'} is reserved between ${fmtDate(unitConflict.checkIn)} and ${fmtDate(unitConflict.checkOut)}.`,
          true
        );
      }
      return;
    }

    if (roomStaysOnRange.length >= roomCapacityUnits) {
      toast(
        `⚠️ Fully Booked (${fmtDate(newInStr)} → ${fmtDate(newOutStr)}): ${roomObj?.name || 'Room'} has no remaining units on those dates.`,
        true
      );
      return;
    }

    toast(`✦ Stay Range: ${fmtDate(newInStr)} → ${fmtDate(newOutStr)} (${matchedUnit?.name || 'Unit'}).`);

    if (onSelectDates) {
      onSelectDates(newInStr, newOutStr, matchedUnit?.roomId, matchedUnit);
    }
  };

  const handleBookingClick = (stay: CalendarStay) => {
    setActiveDetailStay(stay);
    if (onSelectBooking) {
      onSelectBooking(stay);
    }
  };

  const getStayBarStyle = (stay: CalendarStay) => {
    const startIdx = daysArray.findIndex((d) => d.dateStr === stay.checkIn);
    const endIdx = daysArray.findIndex((d) => d.dateStr === stay.checkOut);

    let effectiveStart = startIdx >= 0 ? startIdx : 0;
    let effectiveEnd = endIdx >= 0 ? endIdx : daysCount;

    if (stay.checkIn < windowStartDateStr) effectiveStart = 0;
    if (stay.checkOut > windowEndDateStr) effectiveEnd = daysCount;

    const spanDays = Math.max(1, effectiveEnd - effectiveStart);
    const leftPercent = (effectiveStart / daysCount) * 100;
    const widthPercent = (spanDays / daysCount) * 100;

    return {
      left: `calc(${leftPercent}% + 2px)`,
      width: `calc(${widthPercent}% - 4px)`,
      spanDays,
    };
  };

  return (
    <div className={`pms-calendar-card ${!isLightMode ? 'dark' : ''}`}>
      {/* 1. TOP HEADER */}
      <div className="pms-top-bar">
        <div className="pms-nav-group">
          <div className="pms-segmented-nav">
            <button
              type="button"
              className="pms-seg-btn icon-only"
              onClick={handlePrevWindow}
              title={`Previous ${daysCount} days`}
            >
              <i className="fas fa-chevron-left" />
            </button>

            <button
              type="button"
              className="pms-seg-btn text-btn"
              onClick={handleTodayClick}
              title="Jump to today's live date"
            >
              Today
            </button>

            <button
              type="button"
              className="pms-seg-btn icon-only"
              onClick={handleNextWindow}
              title={`Next ${daysCount} days`}
            >
              <i className="fas fa-chevron-right" />
            </button>
          </div>

          <h2 className="pms-date-title">{dateRangeLabel}</h2>

          {showKindFilter && (
            <select
              className="pms-kind-select"
              aria-label="Show rooms or cottages"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as 'all' | 'room' | 'cottage')}
            >
              <option value="all">All units ({units.length})</option>
              <option value="room">Rooms ({units.filter((u) => u.kind === 'room').length})</option>
              <option value="cottage">Cottages ({units.filter((u) => u.kind === 'cottage').length})</option>
            </select>
          )}
        </div>

        {/* Right: Metrics (Staff) OR Clean 3-Color Legend (White = Available, Red = Reserved, Blue = Selected) */}
        {showMetrics ? (
          <div className="pms-metrics-group">
            <div>
              <span className="pms-metric-val" style={{ color: '#10B981' }}>{metrics.availableToday}</span> of {units.length} available
            </div>
            <div>
              <span className="pms-metric-val">{metrics.arriving}</span> arriving today
            </div>
            <div>
              <span className="pms-metric-val">{metrics.departing}</span> departing
            </div>
            <div>
              <span className="pms-metric-val">{metrics.staysInView}</span> stays in view
            </div>

            <button
              type="button"
              className="pms-reset-pill"
              onClick={handleReset}
              title="Reset stay selection queue and start fresh"
            >
              <i className="fas fa-rotate-left" />
              <span>Reset</span>
            </button>

            {showNewBookingInTopBar && (
              <button
                type="button"
                className="pms-new-booking-btn"
                onClick={() => {
                  if (units.length === 0) {
                    toast("There's no present room around. Please add a room in Room Management first.", true);
                    return;
                  }
                  if (onNewBooking) {
                    onNewBooking();
                  } else if (onSelectDates) {
                    const startD = allowSameDay ? todayStr : addDaysYMD(todayStr, 1);
                    const nextDay = addDaysYMD(startD, 1);
                    onSelectDates(startD, nextDay, units[0]?.roomId);
                  }
                }}
                title={units.length === 0 ? "There's no present room around" : 'New booking'}
                style={units.length === 0 ? { opacity: 0.65, cursor: 'not-allowed' } : undefined}
              >
                <i className="fas fa-plus" />
                <span>New booking</span>
              </button>
            )}
          </div>
        ) : (
          <div className="pms-calendar-actions-right">
            <div className="pms-calendar-legend">
              <span className="pms-legend-item">
                <span
                  className="pms-legend-dot open"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1.5px solid #CBD5E1',
                  }}
                />
                Available
              </span>
              <span className="pms-legend-item">
                <span
                  className="pms-legend-dot reserved"
                  style={{
                    backgroundColor: '#EF4444',
                    border: '1.5px solid #DC2626',
                  }}
                />
                Reserved
              </span>
              <span className="pms-legend-item">
                <span
                  className="pms-legend-dot selected"
                  style={{
                    backgroundColor: '#3B82F6',
                    border: '1.5px solid #2563EB',
                  }}
                />
                Selected
              </span>
            </div>

            <button
              type="button"
              className="pms-reset-pill"
              onClick={handleReset}
              title="Reset stay selection queue and start fresh"
            >
              <i className="fas fa-rotate-left" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. CALENDAR MATRIX */}
      <div className="pms-grid-container">
        <div className="pms-grid-table">
          {/* HEADER ROW */}
          <div className="pms-grid-header">
            <div className="pms-col-unit-header">
              <i className="fas fa-door-open" style={{ marginRight: 6, fontSize: '0.72rem', opacity: 0.7 }} />
              <span>UNIT</span>
            </div>
            <div
              className="pms-days-header-track"
              style={{ gridTemplateColumns: `repeat(${daysCount}, 1fr)` }}
            >
              {daysArray.map((day) => {
                const isWeekend = day.dayOfWeek === 'SAT' || day.dayOfWeek === 'SUN';
                const isFirstOfMonth = day.dayNum === 1;
                const monthName = new Date(`${day.dateStr}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });

                return (
                  <div
                    key={day.dateStr}
                    className={`pms-day-header-cell ${day.isToday ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''}`}
                  >
                    <div className="pms-day-name">{day.dayOfWeek}</div>
                    {day.isToday ? (
                      <div className="pms-day-num-today-badge" title="Today">
                        {day.dayNum}
                      </div>
                    ) : (
                      <div className="pms-day-num">{isFirstOfMonth ? `${monthName} ${day.dayNum}` : day.dayNum}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* PHYSICAL UNIT ROWS */}
          {visibleUnits.map((unit) => {
              const isCurrentActiveUnit = unit.id === activeUnitId;

              // Stays rendered as pills on this unit row
              const unitStays = visibleAssignedStays.filter((s) => {
                if (s.assignedUnitNumber !== unit.unitNumber) return false;
                return s.checkIn <= windowEndDateStr && s.checkOut >= windowStartDateStr;
              });

              // Active blocking stays for this specific unit (so User 2 sees User 1's 10-15 dates as Reserved)
              const blockingUnitStays = activeBlockingStays.filter(
                (s) => s.assignedUnitNumber === unit.unitNumber
              );

              return (
                <div key={unit.id} className="pms-row">
                  <div className="pms-unit-label-cell" title={unit.label}>
                    <div className="pms-unit-chip">
                      <span className="pms-unit-title">{unit.name}</span>
                      <span className="pms-unit-sub">{unit.ratePhp ? `₱${unit.ratePhp.toLocaleString()}/nt` : 'Villa'}</span>
                    </div>
                  </div>

                  <div
                    className="pms-days-track"
                    style={{ gridTemplateColumns: `repeat(${daysCount}, 1fr)` }}
                  >
                    {daysArray.map((day) => {
                      const isCheckInDay = initialCheckIn ? day.dateStr === initialCheckIn : false;
                      const isCheckOutDay = initialCheckOut ? day.dateStr === initialCheckOut : false;
                      const isInStayRange = initialCheckIn && initialCheckOut && day.dateStr >= initialCheckIn && day.dateStr < initialCheckOut;
                      const isPast = day.dateStr < todayStr;
                      const isSameDayLocked = !allowSameDay && day.dateStr === todayStr;
                      const isDateBlocked = isPast || isSameDayLocked;
                      const isWeekend = day.dayOfWeek === 'SAT' || day.dayOfWeek === 'SUN';

                      // Check against ALL active blocking stays for this unit or unassigned stays for this room
                      const isReserved =
                        blockingUnitStays.some((s) => day.dateStr >= s.checkIn && day.dateStr < s.checkOut) ||
                        activeBlockingStays.some(
                          (s) => s.isUnassigned && String(s.roomId) === String(unit.roomId) && day.dateStr >= s.checkIn && day.dateStr < s.checkOut
                        );

                      const showStayRibbon = !isReserved && isCurrentActiveUnit && (isInStayRange || isCheckInDay);
                      const isLastNightOfStay = initialCheckOut && day.dateStr === addDaysYMD(initialCheckOut, -1);

                      return (
                        <div
                          key={day.dateStr}
                          className={`pms-cell ${day.isToday ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''} ${isDateBlocked ? 'is-past' : ''} ${isReserved ? 'is-reserved' : 'is-open'}`}
                          style={
                            isReserved
                              ? {
                                  backgroundColor: isLightMode ? '#FEE2E2' : 'rgba(239, 68, 68, 0.25)',
                                  borderColor: isLightMode ? '#FCA5A5' : 'rgba(239, 68, 68, 0.45)',
                                  cursor: 'not-allowed',
                                }
                              : showStayRibbon
                              ? {
                                  backgroundColor: isLightMode ? '#DBEAFE' : 'rgba(59, 130, 246, 0.3)',
                                }
                              : !isDateBlocked
                              ? {
                                  backgroundColor: isLightMode ? '#FFFFFF' : undefined,
                                }
                              : undefined
                          }
                          onClick={() => !isDateBlocked && !isReserved && handleCellClick(unit.id, day.dateStr)}
                          title={`${day.dateStr}: ${isReserved ? 'Reserved' : isCheckInDay ? 'Check-In' : isCheckOutDay ? 'Check-Out' : isInStayRange ? 'Selected Stay' : isPast ? 'Past Date' : isSameDayLocked ? 'Walk-In Only (Unavailable Online)' : 'Available — Click to select'}`}
                        >
                          {showStayRibbon && (
                            <div
                              className={`pms-selection-ribbon ${isCheckInDay ? 'is-checkin' : ''} ${isLastNightOfStay ? 'is-last-night' : ''}`}
                              style={{ backgroundColor: '#3B82F6', color: '#FFFFFF' }}
                            >
                              {isCheckInDay && (
                                <span className="pms-ribbon-badge">
                                  <i className="fas fa-door-open" />
                                  <span>IN</span>
                                </span>
                              )}
                            </div>
                          )}

                          {!isReserved && isCurrentActiveUnit && isCheckOutDay && (
                            <div className="pms-checkout-indicator">
                              <span className="pms-checkout-badge" style={{ backgroundColor: '#2563EB', color: '#FFFFFF' }}>
                                <i className="fas fa-arrow-right-from-bracket" />
                                <span>OUT</span>
                              </span>
                            </div>
                          )}

                          {!isDateBlocked && !isReserved && !showStayRibbon && (
                            <span className="pms-open-dot" />
                          )}
                        </div>
                      );
                    })}

                    {/* Overlaid Stay Pills (Red for Reserved) */}
                    {unitStays
                      .filter((s) => !['cancelled', 'checked_out'].includes(s.status))
                      .map((stay) => {
                        const { left, width, spanDays } = getStayBarStyle(stay);
                        const colorClass = getStayColorClass(stay);

                        return (
                          <div
                            key={stay.id}
                            className={`pms-stay-pill ${colorClass}`}
                            style={{
                              left,
                              width,
                              backgroundColor: '#EF4444',
                              borderColor: '#DC2626',
                              color: '#FFFFFF',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (showMetrics) {
                                handleBookingClick(stay);
                              } else {
                                toast(`⚠️ Reserved (${fmtDate(stay.checkIn)} → ${fmtDate(stay.checkOut)}). Please choose open white dates.`, true);
                              }
                            }}
                            title={`Reserved (${stay.checkIn} to ${stay.checkOut})`}
                          >
                            <span className="pms-stay-name">{showMetrics ? stay.guestName : 'Reserved'}</span>
                            {spanDays >= 2 ? (
                              <span className="pms-stay-time">
                                {stay.checkInTime} — {stay.checkOutTime}
                              </span>
                            ) : (
                              <span className="pms-stay-time">
                                {stay.checkInTime ? stay.checkInTime.replace(/^In\s*/i, '') : ''}
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}

          {/* Empty rows keep the grid at its full height; each new room takes the next one. */}
          {Array.from({ length: showKindFilter ? Math.max(0, MIN_CALENDAR_ROWS - visibleUnits.length) : 0 }).map((_, emptyIndex) => (
            <div key={`empty_${emptyIndex}`} className="pms-row" aria-hidden="true">
              <div className="pms-unit-label-cell">
                <div className="pms-unit-chip" style={{ opacity: 0.4 }}>
                  <span className="pms-unit-title">
                    {kindFilter === 'cottage' ? 'Cottage' : 'Room'} {units.filter((u) => u.kind === (kindFilter === 'cottage' ? 'cottage' : 'room')).length + emptyIndex + 1}
                  </span>
                </div>
              </div>
              <div className="pms-days-track" style={{ gridTemplateColumns: `repeat(${daysCount}, 1fr)` }}>
                {daysArray.map((day) => {
                  const isPast = day.dateStr < todayStr;
                  const isWeekend = day.dayOfWeek === 'SAT' || day.dayOfWeek === 'SUN';
                  return (
                    <div
                      key={day.dateStr}
                      className={`pms-cell ${day.isToday ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''} ${isPast ? 'is-past' : ''}`}
                      style={{ cursor: 'default' }}
                    >
                      {!isPast && <span className="pms-open-dot" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* UNASSIGNED ROWS */}
          {visibleUnassignedStays.length > 0 &&
            Array.from({ length: unassignedTracksCount }).map((_, rowIndex) => {
              const rowStays = visibleUnassignedStays.filter((s) => {
                if (s.unassignedRowIndex !== rowIndex) return false;
                return s.checkIn <= windowEndDateStr && s.checkOut >= windowStartDateStr;
              });

              return (
                <div key={`unassigned_${rowIndex}`} className="pms-row pms-row-unassigned">
                  <div className="pms-unit-label-cell">
                    <span className="pms-unit-label-unassigned">
                      <i className="fas fa-triangle-exclamation" /> Unassigned
                    </span>
                  </div>

                  <div
                    className="pms-days-track"
                    style={{ gridTemplateColumns: `repeat(${daysCount}, 1fr)` }}
                  >
                    {daysArray.map((day) => (
                      <div
                        key={day.dateStr}
                        className={`pms-cell ${day.isToday ? 'is-today' : ''}`}
                        onClick={() => handleCellClick('unassigned', day.dateStr)}
                      />
                    ))}

                    {rowStays.map((stay) => {
                      const { left, width, spanDays } = getStayBarStyle(stay);
                      const colorClass = getStayColorClass(stay);

                      return (
                        <div
                          key={stay.id}
                          className={`pms-stay-pill ${colorClass}`}
                          style={{
                            left,
                            width,
                            backgroundColor: '#EF4444',
                            borderColor: '#DC2626',
                            color: '#FFFFFF',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (showMetrics) {
                              handleBookingClick(stay);
                            } else {
                              toast(`⚠️ Reserved (${fmtDate(stay.checkIn)} → ${fmtDate(stay.checkOut)}). Please choose open white dates.`, true);
                            }
                          }}
                          title={`[Unassigned] Reserved (${stay.checkIn} to ${stay.checkOut})`}
                        >
                          <span className="pms-stay-name">{showMetrics ? stay.guestName : 'Reserved'}</span>
                          {spanDays >= 2 ? (
                            <span className="pms-stay-time">
                              {stay.checkInTime} — {stay.checkOutTime}
                            </span>
                          ) : (
                            <span className="pms-stay-time">
                              {stay.checkInTime ? stay.checkInTime.replace(/^In\s*/i, '') : ''}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* 3. INLINE SELECTED STAY SUMMARY BAR */}
      {initialCheckIn && initialCheckOut && (
        <div className="pms-calendar-summary-bar">
          <div className="pms-summary-pill">
            <span className="pms-summary-icon">✦</span>
            <span className="pms-summary-dates">
              {fmtDate(initialCheckIn)} → {fmtDate(initialCheckOut)}
            </span>
            <span className="pms-summary-nights">
              ({stayNightsCount} {stayNightsCount === 1 ? 'night' : 'nights'})
            </span>
            {activeUnitId && (
              <span className="pms-summary-unit">
                · {units.find((u) => u.id === activeUnitId)?.label || 'Selected Unit'}
              </span>
            )}
          </div>
          <button
            type="button"
            className="pms-summary-reset"
            onClick={handleReset}
            title="Clear selected stay dates"
          >
            <i className="fas fa-xmark" />
            <span>Clear</span>
          </button>
        </div>
      )}

      {/* 4. INTERACTIVE STAY DETAILS & EDIT BOOKING MODAL (Staff/Admin only) */}
      {activeDetailStay && showMetrics && (
        <div
          onClick={() => setActiveDetailStay(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isLightMode ? '#FFFFFF' : '#0F172A',
              color: isLightMode ? '#0F172A' : '#F8FAFC',
              border: `1px solid ${isLightMode ? '#E2E8F0' : '#334155'}`,
              borderRadius: 16,
              maxWidth: 500,
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  EDIT RESERVATION · {activeDetailStay.unitName}
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.25rem', fontWeight: 800 }}>
                  {activeDetailStay.guestName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveDetailStay(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  color: '#94A3B8',
                }}
              >
                <i className="fas fa-xmark" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '.74rem', fontWeight: 700, color: '#64748B' }}>Guest Name</span>
                  <input
                    value={activeDetailStay.guestName}
                    onChange={(e) => setActiveDetailStay({ ...activeDetailStay, guestName: e.target.value })}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${isLightMode ? '#CBD5E1' : '#334155'}`,
                      background: isLightMode ? '#F8FAFC' : '#1E293B',
                      color: isLightMode ? '#0F172A' : '#F8FAFC',
                    }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '.74rem', fontWeight: 700, color: '#64748B' }}>Contact Phone</span>
                  <input
                    value={activeDetailStay.phone || ''}
                    onChange={(e) => setActiveDetailStay({ ...activeDetailStay, phone: e.target.value })}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${isLightMode ? '#CBD5E1' : '#334155'}`,
                      background: isLightMode ? '#F8FAFC' : '#1E293B',
                      color: isLightMode ? '#0F172A' : '#F8FAFC',
                    }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '.74rem', fontWeight: 700, color: '#64748B' }}>Assigned Unit</span>
                  <select
                    value={activeDetailStay.assignedUnitNumber || ''}
                    onChange={(e) => {
                      const uNum = e.target.value ? Number(e.target.value) : undefined;
                      const matchedUnit = units.find((u) => u.unitNumber === uNum);
                      const cleanNotes = (activeDetailStay.notes || '').replace(/\[?(?:Unit\s*|u)\d+\]?\s*/gi, '').trim();
                      const nextNotes = uNum ? `[Unit ${uNum}] ${cleanNotes}`.trim() : cleanNotes;
                      setActiveDetailStay({
                        ...activeDetailStay,
                        assignedUnitNumber: uNum,
                        unitName: uNum ? matchedUnit?.name || `Unit ${uNum}` : 'Unassigned',
                        roomId: matchedUnit?.roomId || activeDetailStay.roomId,
                        notes: nextNotes,
                      });
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${isLightMode ? '#CBD5E1' : '#334155'}`,
                      background: isLightMode ? '#F8FAFC' : '#1E293B',
                      color: isLightMode ? '#0F172A' : '#F8FAFC',
                    }}
                  >
                    <option value="">Unassigned</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.unitNumber}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '.74rem', fontWeight: 700, color: '#64748B' }}>Booking Status</span>
                  <select
                    value={activeDetailStay.status}
                    onChange={(e) => setActiveDetailStay({ ...activeDetailStay, status: e.target.value as any })}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${isLightMode ? '#CBD5E1' : '#334155'}`,
                      background: isLightMode ? '#F8FAFC' : '#1E293B',
                      color: isLightMode ? '#0F172A' : '#F8FAFC',
                      fontWeight: 700,
                    }}
                  >
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="checked_in">Checked In</option>
                    <option value="checked_out">Checked Out</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '.74rem', fontWeight: 700, color: '#64748B' }}>Check-in Date</span>
                  <input
                    type="date"
                    value={activeDetailStay.checkIn}
                    onChange={(e) => setActiveDetailStay({ ...activeDetailStay, checkIn: e.target.value })}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${isLightMode ? '#CBD5E1' : '#334155'}`,
                      background: isLightMode ? '#F8FAFC' : '#1E293B',
                      color: isLightMode ? '#0F172A' : '#F8FAFC',
                    }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '.74rem', fontWeight: 700, color: '#64748B' }}>Check-out Date</span>
                  <input
                    type="date"
                    value={activeDetailStay.checkOut}
                    onChange={(e) => setActiveDetailStay({ ...activeDetailStay, checkOut: e.target.value })}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${isLightMode ? '#CBD5E1' : '#334155'}`,
                      background: isLightMode ? '#F8FAFC' : '#1E293B',
                      color: isLightMode ? '#0F172A' : '#F8FAFC',
                    }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '.74rem', fontWeight: 700, color: '#64748B' }}>Payment Method</span>
                  <select
                    value={activeDetailStay.paymentMethod || 'GCash'}
                    onChange={(e) => setActiveDetailStay({ ...activeDetailStay, paymentMethod: e.target.value })}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${isLightMode ? '#CBD5E1' : '#334155'}`,
                      background: isLightMode ? '#F8FAFC' : '#1E293B',
                      color: isLightMode ? '#0F172A' : '#F8FAFC',
                    }}
                  >
                    <option value="GCash">GCash</option>
                    <option value="Cash">Cash</option>
                    <option value="Maya">Maya</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Credit / Debit Card</option>
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '.74rem', fontWeight: 700, color: '#64748B' }}>Total Amount (₱)</span>
                  <input
                    type="number"
                    min={0}
                    value={activeDetailStay.totalPhp || 3500}
                    onChange={(e) => setActiveDetailStay({ ...activeDetailStay, totalPhp: Number(e.target.value) })}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${isLightMode ? '#CBD5E1' : '#334155'}`,
                      background: isLightMode ? '#F8FAFC' : '#1E293B',
                      color: '#10B981',
                      fontWeight: 800,
                    }}
                  />
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '.74rem', fontWeight: 700, color: '#64748B' }}>Notes & Unit Tags</span>
                <input
                  value={activeDetailStay.notes || ''}
                  onChange={(e) => setActiveDetailStay({ ...activeDetailStay, notes: e.target.value })}
                  placeholder="e.g. [Unit 3] Pool Pass included"
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: `1px solid ${isLightMode ? '#CBD5E1' : '#334155'}`,
                    background: isLightMode ? '#F8FAFC' : '#1E293B',
                    color: isLightMode ? '#0F172A' : '#F8FAFC',
                  }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setActiveDetailStay(null)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: `1px solid ${isLightMode ? '#CBD5E1' : '#334155'}`,
                  background: isLightMode ? '#FFFFFF' : '#1E293B',
                  color: isLightMode ? '#0F172A' : '#F8FAFC',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingBookingEdit}
                onClick={async () => {
                  const missing: string[] = [];
                  if (!String(activeDetailStay.guestName || '').trim()) missing.push('Guest Full Name');
                  if (!String(activeDetailStay.phone || '').trim()) missing.push('Contact Phone');
                  if (!activeDetailStay.checkIn || !activeDetailStay.checkOut) missing.push('Check-in & Check-out Dates');
                  if (missing.length > 0) {
                    toast(`⚠️ Please fill in required information: ${missing.join(', ')}`, true);
                    return;
                  }
                  try {
                    setSavingBookingEdit(true);
                    await api.updateReservation(activeDetailStay.id, {
                      guest_name: activeDetailStay.guestName.trim(),
                      phone: activeDetailStay.phone.trim(),
                      room_id: activeDetailStay.roomId || undefined,
                      check_in: activeDetailStay.checkIn,
                      check_out: activeDetailStay.checkOut,
                      status: activeDetailStay.status,
                      payment_method: activeDetailStay.paymentMethod,
                      total_php: activeDetailStay.totalPhp,
                      notes: activeDetailStay.notes,
                    });
                    toast(`✦ Updated booking for ${activeDetailStay.guestName}!`);
                    setActiveDetailStay(null);
                    fetchRealtimeData();
                  } catch (err: any) {
                    toast(err.message || 'Could not update booking', true);
                  } finally {
                    setSavingBookingEdit(false);
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#4F46E5',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {savingBookingEdit ? 'Saving…' : '💾 Save Booking Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}