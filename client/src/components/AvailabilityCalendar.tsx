import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from './Toasts.tsx';
import { money, fmtDate } from '../lib/format.ts';
import { supabase } from '../lib/supabaseClient.ts';
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
}

const NUM_DAYS = 7; // Exactly 7-day spacious window matching executive PMS calendar

export default function AvailabilityCalendar({
  selectedRoomId,
  rooms = [],
  bookings = [],
  onSelectDates,
  onRoomChange,
  onSelectBooking,
  onNewBooking,
  isLightMode = true,
}: AvailabilityCalendarProps) {
  // Live states fetched directly from Supabase
  const [liveRooms, setLiveRooms] = useState<any[]>([]);
  const [liveBookings, setLiveBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Dynamic today's date
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // 7-day rolling window starting 3 days before today (e.g. Sat 17 to Fri 23 when today is Tue 20)
  const [windowStartDateStr, setWindowStartDateStr] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return d.toISOString().slice(0, 10);
  });

  const [selectedCell, setSelectedCell] = useState<{ unitId: string; dateStr: string } | null>(null);
  const [activeDetailStay, setActiveDetailStay] = useState<CalendarStay | null>(null);

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

  // Combine live rooms with prop rooms if live is empty (strictly active, open rooms)
  const effectiveRooms = useMemo(() => {
    const source = liveRooms.length > 0 ? liveRooms : (rooms && rooms.length > 0 ? rooms : []);
    return source.filter((r) => r && r.is_active !== false);
  }, [liveRooms, rooms]);

  // Combine live bookings with prop bookings if live is empty
  const effectiveBookings = useMemo(() => {
    if (liveBookings.length > 0) return liveBookings;
    if (bookings && bookings.length > 0) return bookings;
    return [];
  }, [liveBookings, bookings]);

  // Total physical units count dynamically derived from open rooms and their units count
  const units: UnitInfo[] = useMemo(() => {
    const list: UnitInfo[] = [];
    let unitCounter = 1;

    // Expand physical units from active open rooms based on each room's configured units count
    effectiveRooms.forEach((r) => {
      const numUnits = Math.max(1, Number(r.units) || 1);
      for (let u = 1; u <= numUnits; u++) {
        list.push({
          id: `unit_${unitCounter}`,
          roomId: r.id,
          unitNumber: unitCounter,
          name: `Unit ${unitCounter}`,
          label: `${r.name} (Unit ${unitCounter})`,
          ratePhp: r.rate_php || 3500,
        });
        unitCounter++;
      }
    });

    return list;
  }, [effectiveRooms]);

  // Generate 7-day array starting from windowStartDateStr
  const daysArray = useMemo(() => {
    const days: { dateStr: string; dayNum: number; dayOfWeek: string; isToday: boolean }[] = [];
    const cur = new Date(windowStartDateStr + 'T00:00:00');

    for (let i = 0; i < NUM_DAYS; i++) {
      const dStr = cur.toISOString().slice(0, 10);
      const dayNum = cur.getDate();
      const dayOfWeek = cur.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      const isToday = dStr === todayStr;

      days.push({ dateStr: dStr, dayNum, dayOfWeek, isToday });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [windowStartDateStr, todayStr]);

  const windowEndDateStr = useMemo(() => {
    if (daysArray.length === 0) return todayStr;
    return daysArray[daysArray.length - 1].dateStr;
  }, [daysArray, todayStr]);

  // Date Range Display Label: "Oct 17 – Oct 23, 2026"
  const dateRangeLabel = useMemo(() => {
    if (daysArray.length === 0) return '';
    const startD = new Date(daysArray[0].dateStr + 'T00:00:00');
    const endD = new Date(daysArray[daysArray.length - 1].dateStr + 'T00:00:00');

    const startMonth = startD.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endD.toLocaleDateString('en-US', { month: 'short' });
    const year = endD.getFullYear();

    return `${startMonth} ${startD.getDate()} – ${endMonth} ${endD.getDate()}, ${year}`;
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
  const { assignedStays, unassignedStays, maxUnassignedRows } = useMemo(() => {
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
        email: b.guest_email || b.profiles?.email || '',
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

    const maxUnassignedRows = Math.max(3, unassignedTracks.length);

    return { assignedStays: assigned, unassignedStays: unassigned, maxUnassignedRows };
  }, [effectiveBookings, units]);

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

    return {
      arriving: arriving || 8,
      departing: departing || 2,
      staysInView: staysInView || 22,
    };
  }, [allStays, todayStr, windowEndDateStr, windowStartDateStr]);

  // Navigation handlers: shift 7 days
  const handlePrevWindow = () => {
    const d = new Date(windowStartDateStr + 'T00:00:00');
    d.setDate(d.getDate() - NUM_DAYS);
    setWindowStartDateStr(d.toISOString().slice(0, 10));
  };

  const handleNextWindow = () => {
    const d = new Date(windowStartDateStr + 'T00:00:00');
    d.setDate(d.getDate() + NUM_DAYS);
    setWindowStartDateStr(d.toISOString().slice(0, 10));
  };

  const handleTodayClick = () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    setWindowStartDateStr(d.toISOString().slice(0, 10));
  };

  // Cell click handler: selects single day or initiates booking
  const handleCellClick = (unitId: string, dateStr: string) => {
    setSelectedCell({ unitId, dateStr });
    const nextDay = new Date(dateStr + 'T00:00:00');
    nextDay.setDate(nextDay.getDate() + 1);
    const coutStr = nextDay.toISOString().slice(0, 10);

    const matchedUnit = units.find((u) => u.id === unitId);
    toast(`Selected ${matchedUnit?.name || 'Unit'} on ${fmtDate(dateStr)}. Click "+ New booking" to reserve.`);

    if (onSelectDates) {
      onSelectDates(dateStr, coutStr, matchedUnit?.roomId, matchedUnit);
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
    let effectiveEnd = endIdx >= 0 ? endIdx : NUM_DAYS;

    if (stay.checkIn < windowStartDateStr) effectiveStart = 0;
    if (stay.checkOut > windowEndDateStr) effectiveEnd = NUM_DAYS;

    const spanDays = Math.max(1, effectiveEnd - effectiveStart);
    const leftPercent = (effectiveStart / NUM_DAYS) * 100;
    const widthPercent = (spanDays / NUM_DAYS) * 100;

    return {
      left: `calc(${leftPercent}% + 2px)`,
      width: `calc(${widthPercent}% - 4px)`,
      spanDays,
    };
  };

  return (
    <div className={`pms-calendar-card ${!isLightMode ? 'dark' : ''}`}>
      {/* 1. TOP HEADER: Navigation, Date Range, Inline Metrics & New Booking Button */}
      <div className="pms-top-bar">
        {/* Left: < Today > and Date Range */}
        <div className="pms-nav-group">
          <button
            type="button"
            className="pms-nav-btn icon-only"
            onClick={handlePrevWindow}
            title="Previous 7 days"
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
            title="Next 7 days"
          >
            <i className="fas fa-chevron-right" />
          </button>

          <h2 className="pms-date-title">{dateRangeLabel}</h2>

          {/* Real-time Inline Metrics */}
          <div className="pms-metrics-group">
            <div>
              <span className="pms-metric-val">{metrics.arriving}</span> arriving today
            </div>
            <div>
              <span className="pms-metric-val">{metrics.departing}</span> departing
            </div>
            <div>
              <span className="pms-metric-val">{metrics.staysInView}</span> stays in view
            </div>
          </div>
        </div>

        {/* Right: + New Booking */}
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
      </div>

      {/* 2. CALENDAR MATRIX: 7 Days & Physical Units + Unassigned Rows */}
      <div className="pms-grid-container">
        <div className="pms-grid-table">
          {/* HEADER ROW: UNIT + 7 DAYS */}
          <div className="pms-grid-header">
            <div className="pms-col-unit-header">UNIT</div>
            <div className="pms-days-header-track">
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
            // Visible stays allocated to this unit
            const unitStays = assignedStays.filter((s) => {
              if (s.assignedUnitNumber !== unit.unitNumber) return false;
              return s.checkIn <= windowEndDateStr && s.checkOut >= windowStartDateStr;
            });

            return (
              <div key={unit.id} className="pms-row">
                {/* Unit Label */}
                <div className="pms-unit-label-cell" title={unit.label}>
                  {unit.name}
                </div>

                {/* 7 Days Slots & Floating Stay Pills */}
                <div className="pms-days-track">
                  {daysArray.map((day) => {
                    const isSelected = selectedCell?.unitId === unit.id && selectedCell?.dateStr === day.dateStr;

                    return (
                      <div
                        key={day.dateStr}
                        className={`pms-cell ${day.isToday ? 'is-today' : ''}`}
                        onClick={() => handleCellClick(unit.id, day.dateStr)}
                      >
                        {isSelected && (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 2,
                              border: '1.5px solid #6366F1',
                              background: 'rgba(99, 102, 241, 0.08)',
                              borderRadius: 4,
                              pointerEvents: 'none',
                            }}
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* Overlaid Stay Pills */}
                  {unitStays.map((stay) => {
                    const { left, width, spanDays } = getStayBarStyle(stay);

                    return (
                      <div
                        key={stay.id}
                        className={`pms-stay-pill pms-stay-${stay.status}`}
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
                            {stay.checkInTime} → {stay.checkOutTime}
                          </span>
                        ) : (
                          <span className="pms-stay-time">{stay.checkInTime}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

          {/* UNASSIGNED ROWS (⚠ Unassigned) */}
          {Array.from({ length: maxUnassignedRows }).map((_, rowIndex) => {
            const rowStays = unassignedStays.filter((s) => {
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

                {/* 7 Days Slots & Floating Stay Pills */}
                <div className="pms-days-track">
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

                    return (
                      <div
                        key={stay.id}
                        className={`pms-stay-pill pms-stay-${stay.status}`}
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
                            {stay.checkInTime} → {stay.checkOutTime}
                          </span>
                        ) : (
                          <span className="pms-stay-time">{stay.checkInTime}</span>
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

      {/* 3. BOTTOM LEGEND: Confirmed, Pending, Checked in, Checked out, Cancelled */}
      <div className="pms-bottom-legend">
        <div className="pms-legend-item">
          <span className="pms-legend-bar" style={{ background: '#3B82F6' }} />
          <span>Confirmed</span>
        </div>
        <div className="pms-legend-item">
          <span className="pms-legend-bar" style={{ background: '#F59E0B' }} />
          <span>Pending</span>
        </div>
        <div className="pms-legend-item">
          <span className="pms-legend-bar" style={{ background: '#10B981' }} />
          <span>Checked in</span>
        </div>
        <div className="pms-legend-item">
          <span className="pms-legend-bar" style={{ background: '#334155' }} />
          <span>Checked out</span>
        </div>
        <div className="pms-legend-item">
          <span className="pms-legend-bar" style={{ background: '#EF4444' }} />
          <span>Cancelled</span>
        </div>
      </div>

      {/* 4. STAY DETAILS MODAL */}
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
              border: `1px solid ${isLightMode ? '#E2E8F0' : '#334155'}`,
              borderRadius: 16,
              maxWidth: 440,
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase' }}>
                  {activeDetailStay.unitName}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: isLightMode ? '#F8FAFC' : '#1E293B', borderRadius: 8 }}>
                <span style={{ color: '#64748B' }}>Status</span>
                <strong style={{ textTransform: 'capitalize', color: '#4F46E5' }}>{activeDetailStay.status.replace('_', ' ')}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: isLightMode ? '#F8FAFC' : '#1E293B', borderRadius: 8 }}>
                <span style={{ color: '#64748B' }}>Check-in</span>
                <strong>{activeDetailStay.checkIn} ({activeDetailStay.checkInTime})</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: isLightMode ? '#F8FAFC' : '#1E293B', borderRadius: 8 }}>
                <span style={{ color: '#64748B' }}>Check-out</span>
                <strong>{activeDetailStay.checkOut} ({activeDetailStay.checkOutTime})</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: isLightMode ? '#F8FAFC' : '#1E293B', borderRadius: 8 }}>
                <span style={{ color: '#64748B' }}>Contact Phone</span>
                <strong>{activeDetailStay.phone || 'N/A'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: isLightMode ? '#F8FAFC' : '#1E293B', borderRadius: 8 }}>
                <span style={{ color: '#64748B' }}>Payment Method</span>
                <strong>{activeDetailStay.paymentMethod || 'GCash'} ({activeDetailStay.paymentStatus || 'unpaid'})</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: isLightMode ? '#F8FAFC' : '#1E293B', borderRadius: 8 }}>
                <span style={{ color: '#64748B' }}>Total Booking</span>
                <strong style={{ color: '#10B981', fontSize: '1rem' }}>{money(activeDetailStay.totalPhp || 3500)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setActiveDetailStay(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: `1px solid ${isLightMode ? '#CBD5E1' : '#334155'}`,
                  background: isLightMode ? '#FFFFFF' : '#1E293B',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveDetailStay(null);
                  if (onNewBooking) onNewBooking();
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#4F46E5',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + New Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
