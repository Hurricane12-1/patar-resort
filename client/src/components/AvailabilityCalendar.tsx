import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from './Toasts.tsx';
import { money, fmtDate } from '../lib/format.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { api, addDaysYMD } from '../lib/api.ts';
import '../styles/availability-calendar.css';

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
  selectionTarget?: 'checkIn' | 'checkOut' | 'auto';
}

const DEFAULT_NUM_DAYS = 14; // Default 14-day spacious window matching modern PMS calendar

export default function AvailabilityCalendar({
  selectedRoomId,
  rooms = [],
  bookings = [],
  initialCheckIn,
  initialCheckOut,
  onSelectDates,
  onRoomChange,
  onSelectBooking,
  onNewBooking,
  isLightMode = true,
  numDays = DEFAULT_NUM_DAYS,
  statusFilter = 'all',
  showNewBookingInTopBar = false,
  selectionTarget = 'auto',
}: AvailabilityCalendarProps) {
  const daysCount = numDays || DEFAULT_NUM_DAYS;

  // Live states fetched directly from Supabase
  const [liveRooms, setLiveRooms] = useState<any[]>([]);
  const [liveBookings, setLiveBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Dynamic today's date (defaults to October 2026 operational period)
  const todayStr = useMemo(() => {
    const now = new Date();
    if (now.getFullYear() === 2026 && now.getMonth() === 9) {
      return now.toISOString().slice(0, 10);
    }
    return '2026-10-20';
  }, []);

  // 14-day rolling window starting 3 days before today (e.g. Sat 17 to Fri 30 when today is Tue 20)
  const [windowStartDateStr, setWindowStartDateStr] = useState<string>(() => {
    return addDaysYMD('2026-10-20', -3);
  });

  const [selectedCell, setSelectedCell] = useState<{ unitId: string; dateStr: string } | null>(null);
  const [activeDetailStay, setActiveDetailStay] = useState<CalendarStay | null>(null);
  const [savingBookingEdit, setSavingBookingEdit] = useState(false);

  // Real-Time Supabase Fetcher
  const fetchRealtimeData = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Fetch Rooms directly from Supabase (strictly active, open rooms)
      const { data: dbRooms, error: rErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (rErr) throw rErr;
      if (dbRooms) {
        setLiveRooms(dbRooms);
      }

      // 2. Fetch Reservations with relations from Supabase
      const { data: dbReservations, error: bErr } = await supabase
        .from('reservations')
        .select('*, rooms(id, name, rate_php), profiles(id, full_name, email, phone)')
        .order('check_in', { ascending: true });

      if (bErr) throw bErr;
      if (dbReservations) {
        setLiveBookings(dbReservations);
      }
    } catch (err: any) {
      console.warn('[Realtime Calendar Notice]:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to real-time postgres changes
  useEffect(() => {
    fetchRealtimeData();

    const channel = supabase
      .channel('realtime:availability_pms_calendar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        fetchRealtimeData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRealtimeData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRealtimeData]);

  // Re-sync whenever parent rooms or bookings props change
  useEffect(() => {
    fetchRealtimeData();
  }, [rooms?.length, bookings?.length, fetchRealtimeData]);

  // Merge prop rooms and live rooms by id (strictly active, open rooms)
  const effectiveRooms = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of liveRooms) {
      if (r && r.id) map.set(r.id, r);
    }
    for (const r of rooms || []) {
      if (r && r.id) map.set(r.id, { ...map.get(r.id), ...r });
    }
    const all = Array.from(map.values()).filter((r) => r && r.is_active !== false);
    if (selectedRoomId && selectedRoomId !== 'all') {
      const filtered = all.filter((r) => r.id === selectedRoomId);
      if (filtered.length > 0) return filtered;
    }
    return all;
  }, [liveRooms, rooms, selectedRoomId]);

  // Merge prop bookings and live bookings by id so newly created/edited bookings appear immediately
  const effectiveBookings = useMemo(() => {
    const map = new Map<string, any>();
    for (const b of liveBookings) {
      if (b && b.id) map.set(b.id, b);
    }
    for (const b of bookings || []) {
      if (b && b.id) map.set(b.id, { ...map.get(b.id), ...b });
    }
    return Array.from(map.values());
  }, [liveBookings, bookings]);

  // Total physical units count dynamically derived from open rooms and their units count
  const units: UnitInfo[] = useMemo(() => {
    const list: UnitInfo[] = [];
    let unitCounter = 1;

    // Expand physical units from active open rooms based strictly on each room's configured units count
    effectiveRooms.forEach((r) => {
      const numUnits = Math.max(1, Number(r.units) || 1);
      for (let u = 1; u <= numUnits; u++) {
        list.push({
          id: `unit_${unitCounter}`,
          roomId: r.id,
          unitNumber: unitCounter,
          name: numUnits > 1 ? `Unit ${u}` : (effectiveRooms.length === 1 ? `Unit 1` : `Unit ${unitCounter}`),
          label: numUnits > 1 ? `${r.name} (Unit ${u})` : `${r.name} (Unit ${unitCounter})`,
          ratePhp: r.rate_php || 3500,
        });
        unitCounter++;
      }
    });

    return list;
  }, [effectiveRooms]);

  // Generate days array starting from windowStartDateStr (Timezone-safe UTC noon math)
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

  // Date Range Display Label: "Oct 17 – Oct 30, 2026"
  const dateRangeLabel = useMemo(() => {
    if (daysArray.length === 0) return '';
    const startD = new Date(`${daysArray[0].dateStr}T12:00:00Z`);
    const endD = new Date(`${daysArray[daysArray.length - 1].dateStr}T12:00:00Z`);

    const startMonth = startD.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const endMonth = endD.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const year = endD.getUTCFullYear();

    return `${startMonth} ${startD.getUTCDate()} – ${endMonth} ${endD.getUTCDate()}, ${year}`;
  }, [daysArray]);

  // Parse check-in & check-out time annotations
  const parseTimes = (b: any) => {
    const notes = b.notes || '';
    const inMatch = notes.match(/In\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
    const outMatch = notes.match(/Out\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
    const timeMatch = notes.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);

    const checkInTime = inMatch ? `In ${inMatch[1]}` : (timeMatch ? timeMatch[1] : 'In 2:00 PM');
    const checkOutTime = outMatch ? `Out ${outMatch[1]}` : 'Out 12:00 PM';

    return { checkInTime, checkOutTime };
  };

  // Stays & Unassigned Allocation
  const { assignedStays, unassignedStays, unassignedTracksCount } = useMemo(() => {
    const assigned: CalendarStay[] = [];
    const unassigned: CalendarStay[] = [];

    // Track active timelines for physical units
    const unitTimelines: Map<number, { checkIn: string; checkOut: string; id: string }[]> = new Map();
    units.forEach((u) => unitTimelines.set(u.unitNumber, []));

    effectiveBookings.forEach((b: any, bIdx: number) => {
      const cin = (b.check_in || '').slice(0, 10);
      const cout = (b.check_out || '').slice(0, 10);
      if (!cin || !cout) return;

      const { checkInTime, checkOutTime } = parseTimes(b);

      // Check for explicit unit tag: "[Unit 5]" or "Unit 5"
      const noteUnitMatch = (b.notes || '').match(/\[?(?:Unit\s*|u)(\d+)\]?/i);
      let targetUnitNum: number | null = noteUnitMatch ? parseInt(noteUnitMatch[1], 10) : null;

      // Check if requested unit exists and has collision
      let hasAssignedUnit = false;
      if (targetUnitNum && targetUnitNum >= 1 && targetUnitNum <= units.length) {
        const timeline = unitTimelines.get(targetUnitNum) || [];
        const hasCollision = timeline.some((t) => cin < t.checkOut && cout > t.checkIn);
        if (!hasCollision) {
          timeline.push({ checkIn: cin, checkOut: cout, id: b.id });
          hasAssignedUnit = true;
        }
      }

      // If no explicit unit specified, attempt to assign first free unit
      if (!hasAssignedUnit && !noteUnitMatch) {
        for (let u = 1; u <= units.length; u++) {
          const timeline = unitTimelines.get(u) || [];
          const hasCollision = timeline.some((t) => cin < t.checkOut && cout > t.checkIn);
          if (!hasCollision) {
            timeline.push({ checkIn: cin, checkOut: cout, id: b.id });
            targetUnitNum = u;
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
        unitName: hasAssignedUnit && targetUnitNum ? `Unit ${targetUnitNum}` : 'Unassigned',
        guestName: b.guest_name || b.profiles?.full_name || 'Guest',
        checkIn: cin,
        checkOut: cout,
        checkInTime,
        checkOutTime,
        status: (b.status || 'confirmed') as CalendarStay['status'],
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

    // Layout unassigned stays onto separate non-colliding unassigned tracks
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

    const unassignedTracksCount = unassignedTracks.length;

    return { assignedStays: assigned, unassignedStays: unassigned, unassignedTracksCount };
  }, [effectiveBookings, units]);

  // Filter stays by statusFilter if specified
  const visibleAssignedStays = useMemo(() => {
    if (!statusFilter || statusFilter === 'all') return assignedStays;
    return assignedStays.filter((s) => s.status === statusFilter);
  }, [assignedStays, statusFilter]);

  const visibleUnassignedStays = useMemo(() => {
    if (!statusFilter || statusFilter === 'all') return unassignedStays;
    return unassignedStays.filter((s) => s.status === statusFilter);
  }, [unassignedStays, statusFilter]);

  // Combined stays in view
  const allStays = useMemo(() => {
    return [...assignedStays, ...unassignedStays];
  }, [assignedStays, unassignedStays]);

  // Real-time summary metrics calculated directly from records in view
  const metrics = useMemo(() => {
    const arriving = allStays.filter((s) => s.checkIn === todayStr && s.status !== 'cancelled').length;
    const departing = allStays.filter((s) => s.checkOut === todayStr && s.status !== 'cancelled').length;
    const staysInView = allStays.filter(
      (s) => s.checkIn <= windowEndDateStr && s.checkOut >= windowStartDateStr && s.status !== 'cancelled'
    ).length;
    const occupiedToday = allStays.filter(
      (s) => s.checkIn <= todayStr && s.checkOut > todayStr && s.status !== 'cancelled'
    ).length;
    const availableToday = Math.max(0, units.length - occupiedToday);

    return {
      arriving,
      departing,
      staysInView,
      availableToday,
      totalUnits: units.length,
    };
  }, [allStays, todayStr, windowEndDateStr, windowStartDateStr, units.length]);

  // Navigation handlers: shift by daysCount
  const handlePrevWindow = () => {
    setWindowStartDateStr(addDaysYMD(windowStartDateStr, -daysCount));
  };

  const handleNextWindow = () => {
    setWindowStartDateStr(addDaysYMD(windowStartDateStr, daysCount));
  };

  const handleTodayClick = () => {
    setWindowStartDateStr(addDaysYMD(todayStr, -3));
  };

  // Determine stay badge color variant matching PMS palette
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

  // Cell click handler: selects single day or initiates booking
  const handleCellClick = (unitId: string, dateStr: string) => {
    setSelectedCell({ unitId, dateStr });
    const matchedUnit = units.find((u) => u.id === unitId);

    let newInStr = dateStr;
    let newOutStr = addDaysYMD(dateStr, 1);

    if (selectionTarget === 'checkOut') {
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
    } else {
      if (initialCheckIn && dateStr > initialCheckIn) {
        newInStr = initialCheckIn;
        newOutStr = dateStr;
      } else {
        newInStr = dateStr;
        newOutStr = addDaysYMD(dateStr, 1);
      }
    }

    const activeStaysOnDate = allStays.filter(
      (s) => !['cancelled', 'checked_out'].includes(String(s.status || '').toLowerCase()) && s.checkIn < newOutStr && s.checkOut > newInStr
    );
    const unitConflict = activeStaysOnDate.find((s) => s.unitId === unitId);
    const roomObj = effectiveRooms.find((r) => r.id === matchedUnit?.roomId);
    const roomCapacityUnits = Math.max(1, Number(roomObj?.units) || 1);
    const roomStaysOnDate = activeStaysOnDate.filter(
      (s) => s.roomId === matchedUnit?.roomId || effectiveRooms.length <= 1
    );

    if (unitConflict) {
      toast(
        `⚠️ Already Booked: ${matchedUnit?.name || 'Unit'} is reserved between ${fmtDate(newInStr)} and ${fmtDate(newOutStr)} by ${unitConflict.guestName}!`,
        true
      );
    } else if (roomStaysOnDate.length >= roomCapacityUnits) {
      const names = roomStaysOnDate.map((s) => s.guestName).join(', ');
      toast(
        `⚠️ Fully Booked (${fmtDate(newInStr)} → ${fmtDate(newOutStr)}): ${roomObj?.name || 'Room'} is occupied by ${names}!`,
        true
      );
    } else {
      toast(`✦ Stay Range: ${fmtDate(newInStr)} → ${fmtDate(newOutStr)} (${matchedUnit?.name || 'Unit'}).`);
    }

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

  // Calculate stay bar coordinates directly within .pms-days-track (0% to 100%)
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
      {/* 1. TOP HEADER: Navigation, Date Range, Inline Metrics & Optional New Booking */}
      <div className="pms-top-bar">
        {/* Left: < Today > and Date Range */}
        <div className="pms-nav-group">
          <button
            type="button"
            className="pms-nav-btn icon-only"
            onClick={handlePrevWindow}
            title={`Previous ${daysCount} days`}
          >
            <i className="fas fa-chevron-left" />
          </button>

          <button
            type="button"
            className="pms-nav-btn"
            onClick={handleTodayClick}
          >
            Today
          </button>

          <button
            type="button"
            className="pms-nav-btn icon-only"
            onClick={handleNextWindow}
            title={`Next ${daysCount} days`}
          >
            <i className="fas fa-chevron-right" />
          </button>

          <h2 className="pms-date-title">{dateRangeLabel}</h2>
        </div>

        {/* Right: Real-time Inline Metrics & Optional New Booking */}
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
                  const nextDay = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
                  onSelectDates(todayStr, nextDay, units[0]?.roomId);
                }
              }}
              title={units.length === 0 ? "There's no present room around" : "New booking"}
              style={units.length === 0 ? { opacity: 0.65, cursor: 'not-allowed' } : undefined}
            >
              <i className="fas fa-plus" />
              <span>New booking</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. CALENDAR MATRIX: 14 Days & Physical Units + Unassigned Rows */}
      <div className="pms-grid-container">
        <div className="pms-grid-table">
          {/* HEADER ROW: UNIT + 14 DAYS */}
          <div className="pms-grid-header">
            <div className="pms-col-unit-header">UNIT</div>
            <div
              className="pms-days-header-track"
              style={{ gridTemplateColumns: `repeat(${daysCount}, 1fr)` }}
            >
              {daysArray.map((day) => (
                <div
                  key={day.dateStr}
                  className={`pms-day-header-cell ${day.isToday ? 'is-today' : ''}`}
                >
                  <div className="pms-day-name">{day.dayOfWeek}</div>
                  {day.isToday ? (
                    <div className="pms-day-num-today-badge">{day.dayNum}</div>
                  ) : (
                    <div className="pms-day-num">{day.dayNum}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* PHYSICAL UNIT ROWS (Dynamically generated based on open rooms count) */}
          {units.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#F43F5E', fontSize: '.88rem' }}>
              <i className="fas fa-triangle-exclamation" style={{ fontSize: '1.8rem', display: 'block', marginBottom: 10, color: '#F43F5E' }} />
              <strong style={{ display: 'block', marginBottom: 4, fontSize: '1rem', color: isLightMode ? '#DC2626' : '#F87171' }}>
                There's No Present Room Around
              </strong>
              <span style={{ color: isLightMode ? '#64748B' : '#94A3B8', fontSize: '.82rem' }}>
                No open accommodation units are currently configured or active in resort inventory. Open or create rooms in Room Management.
              </span>
            </div>
          ) : (
            units.map((unit) => {
            // Visible stays allocated to this unit filtered by status
            const unitStays = visibleAssignedStays.filter((s) => {
              if (s.assignedUnitNumber !== unit.unitNumber) return false;
              return s.checkIn <= windowEndDateStr && s.checkOut >= windowStartDateStr;
            });

            return (
              <div key={unit.id} className="pms-row">
                {/* Unit Label */}
                <div className="pms-unit-label-cell" title={unit.label}>
                  {unit.name}
                </div>

                {/* Days Slots & Floating Stay Pills */}
                <div
                  className="pms-days-track"
                  style={{ gridTemplateColumns: `repeat(${daysCount}, 1fr)` }}
                >
                  {daysArray.map((day) => {
                    const isCheckInDay = initialCheckIn ? day.dateStr === initialCheckIn : false;
                    const isCheckOutDay = initialCheckOut ? day.dateStr === initialCheckOut : false;
                    const isInStayRange = initialCheckIn && initialCheckOut && day.dateStr >= initialCheckIn && day.dateStr < initialCheckOut;
                    const isSelected = (selectedCell?.unitId === unit.id && selectedCell?.dateStr === day.dateStr) || isCheckInDay;

                    return (
                      <div
                        key={day.dateStr}
                        className={`pms-cell ${day.isToday ? 'is-today' : ''}`}
                        onClick={() => handleCellClick(unit.id, day.dateStr)}
                        title={`${day.dateStr}: ${isCheckInDay ? 'Check-In' : isCheckOutDay ? 'Check-Out' : isInStayRange ? 'Stay Date' : 'Click to select'}`}
                      >
                        {isInStayRange && (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 1,
                              borderTop: '2px solid rgba(34, 195, 238, 0.85)',
                              borderBottom: '2px solid rgba(34, 195, 238, 0.85)',
                              background: isCheckInDay ? 'rgba(34, 195, 238, 0.32)' : 'rgba(34, 195, 238, 0.16)',
                              borderRadius: isCheckInDay ? '4px 0 0 4px' : 0,
                              pointerEvents: 'none',
                              zIndex: 1,
                            }}
                          >
                            {isCheckInDay && (
                              <span style={{ position: 'absolute', top: 2, left: 3, fontSize: '8px', fontWeight: 800, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                IN
                              </span>
                            )}
                          </div>
                        )}
                        {!isInStayRange && isCheckOutDay && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 1,
                              bottom: 1,
                              left: 0,
                              width: 3,
                              background: '#38bdf8',
                              borderRadius: '0 4px 4px 0',
                              pointerEvents: 'none',
                              zIndex: 1,
                            }}
                          />
                        )}
                        {isSelected && !isInStayRange && (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 2,
                              border: '1.5px solid #22d3ee',
                              background: 'rgba(34, 211, 238, 0.12)',
                              borderRadius: 4,
                              pointerEvents: 'none',
                              zIndex: 1,
                            }}
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* Overlaid Stay Pills */}
                  {unitStays.map((stay) => {
                    const { left, width, spanDays } = getStayBarStyle(stay);
                    const colorClass = getStayColorClass(stay);

                    return (
                      <div
                        key={stay.id}
                        className={`pms-stay-pill ${colorClass}`}
                        style={{ left, width }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBookingClick(stay);
                        }}
                        title={`${stay.guestName} (${stay.checkIn} to ${stay.checkOut}) · Status: ${stay.status}`}
                      >
                        <span className="pms-stay-name">{stay.guestName}</span>
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
          })
        )}

          {/* UNASSIGNED ROWS (Render ONLY if there are visible unassigned stays) */}
          {visibleUnassignedStays.length > 0 && Array.from({ length: unassignedTracksCount }).map((_, rowIndex) => {
            const rowStays = visibleUnassignedStays.filter((s) => {
              if (s.unassignedRowIndex !== rowIndex) return false;
              return s.checkIn <= windowEndDateStr && s.checkOut >= windowStartDateStr;
            });

            return (
              <div key={`unassigned_${rowIndex}`} className="pms-row pms-row-unassigned">
                {/* Left Label with Warning Icon */}
                <div className="pms-unit-label-cell">
                  <span className="pms-unit-label-unassigned">
                    <i className="fas fa-triangle-exclamation" /> Unassigned
                  </span>
                </div>

                {/* Days Slots & Floating Stay Pills */}
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

                  {/* Overlaid Unassigned Stay Pills */}
                  {rowStays.map((stay) => {
                    const { left, width, spanDays } = getStayBarStyle(stay);
                    const colorClass = getStayColorClass(stay);

                    return (
                      <div
                        key={stay.id}
                        className={`pms-stay-pill ${colorClass}`}
                        style={{ left, width }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBookingClick(stay);
                        }}
                        title={`[Unassigned] ${stay.guestName} (${stay.checkIn} to ${stay.checkOut}) · Status: ${stay.status}`}
                      >
                        <span className="pms-stay-name">{stay.guestName}</span>
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

      {/* 4. INTERACTIVE STAY DETAILS & EDIT BOOKING MODAL */}
      {activeDetailStay && (
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
                        unitName: uNum ? `Unit ${uNum}` : 'Unassigned',
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
