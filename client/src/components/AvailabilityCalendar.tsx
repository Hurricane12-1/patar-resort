import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api.ts';
import { money, fmtDate } from '../lib/format.ts';
import { toast } from './Toasts.tsx';

interface AvailabilityCalendarProps {
  selectedRoomId?: string;
  rooms?: any[];
  initialCheckIn?: string;
  initialCheckOut?: string;
  onSelectDates?: (checkIn: string, checkOut: string) => void;
  onRoomChange?: (roomId: string) => void;
  isLightMode?: boolean;
  onClose?: () => void;
}

export default function AvailabilityCalendar({
  selectedRoomId,
  rooms = [],
  initialCheckIn,
  initialCheckOut,
  onSelectDates,
  onRoomChange,
  isLightMode = true,
  onClose,
}: AvailabilityCalendarProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayDate = useMemo(() => new Date(), []);

  const [currentYear, setCurrentYear] = useState(() => todayDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => todayDate.getMonth()); // 0-indexed
  const [activeRoomId, setActiveRoomId] = useState<string>(selectedRoomId || 'all');
  const [calendarData, setCalendarData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [pickedCheckIn, setPickedCheckIn] = useState<string>(initialCheckIn || '');
  const [pickedCheckOut, setPickedCheckOut] = useState<string>(initialCheckOut || '');
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Sync activeRoomId when prop changes
  useEffect(() => {
    if (selectedRoomId) setActiveRoomId(selectedRoomId);
  }, [selectedRoomId]);

  // Sync initial dates from parent when they change
  useEffect(() => {
    if (initialCheckIn) setPickedCheckIn(initialCheckIn);
  }, [initialCheckIn]);

  useEffect(() => {
    if (initialCheckOut) setPickedCheckOut(initialCheckOut);
  }, [initialCheckOut]);

  // Fetch calendar availability data from live backend
  useEffect(() => {
    let active = true;
    setLoading(true);

    // Compute range from first day of visible month to 3 months forward
    const startOfVisible = new Date(currentYear, currentMonth, 1);
    const endOfRange = new Date(currentYear, currentMonth + 3, 0);

    const from = startOfVisible < todayDate ? today : startOfVisible.toISOString().slice(0, 10);
    const to = endOfRange.toISOString().slice(0, 10);

    api.availabilityCalendar({
      room_id: activeRoomId !== 'all' ? activeRoomId : undefined,
      from,
      to,
    })
      .then((data: any) => {
        if (active) setCalendarData(data);
      })
      .catch((err: any) => {
        console.warn('[Calendar] Fetch error:', err?.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentYear, currentMonth, activeRoomId, today, todayDate]);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Month metadata
  const monthName = new Date(currentYear, currentMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday

  // Helper: check if a date is locked in
  const getDateStatus = (dateStr: string) => {
    if (dateStr < today) {
      return { isPast: true, isLocked: false, label: 'Past', unitsLeft: 0 };
    }

    const dayInfo = calendarData?.daily_status?.[dateStr];
    if (!dayInfo) {
      return { isPast: false, isLocked: false, label: 'Available', unitsLeft: 1 };
    }

    if (activeRoomId !== 'all') {
      const roomStatus = dayInfo.rooms?.[activeRoomId];
      if (roomStatus) {
        const isLocked = Boolean(roomStatus.is_locked);
        return {
          isPast: false,
          isLocked,
          label: isLocked ? '🔴 Reserved' : `${roomStatus.units_left} left`,
          unitsLeft: roomStatus.units_left,
          totalUnits: roomStatus.total_units,
        };
      }
    } else {
      const isResortLocked = Boolean(dayInfo.resort_fully_booked);
      const unitsLeft = Math.max(0, (dayInfo.total_units || 0) - (dayInfo.total_occupied || 0));
      return {
        isPast: false,
        isLocked: isResortLocked,
        label: isResortLocked ? '🔴 Fully Reserved' : `${unitsLeft} open`,
        unitsLeft,
        totalUnits: dayInfo.total_units,
      };
    }

    return { isPast: false, isLocked: false, label: 'Available', unitsLeft: 1 };
  };

  // Check if a range contains any locked dates
  const rangeHasLockedDate = (cin: string, cout: string) => {
    let cur = new Date(cin);
    const end = new Date(cout);
    while (cur < end) {
      const dStr = cur.toISOString().slice(0, 10);
      const st = getDateStatus(dStr);
      if (st.isLocked) return dStr;
      cur.setDate(cur.getDate() + 1);
    }
    return null;
  };

  // Date click handler
  const handleDayClick = (dateStr: string) => {
    if (dateStr < today) {
      toast('Cannot select past dates.', true);
      return;
    }

    const status = getDateStatus(dateStr);
    if (status.isLocked) {
      const roomObj = rooms.find((r) => r.id === activeRoomId);
      const targetName = roomObj?.name || 'This accommodation';
      toast(`🔴 ${targetName} is already reserved on ${fmtDate(dateStr)}. Please select an open date.`, true);
      return;
    }

    // Step 1: If neither checkIn is selected, or both are already selected, start a new selection
    if (!pickedCheckIn || (pickedCheckIn && pickedCheckOut)) {
      setPickedCheckIn(dateStr);
      setPickedCheckOut('');
      toast(`📅 Check-in set: ${fmtDate(dateStr)}. Now click your Check-out date.`);
      return;
    }

    // Step 2: Check-in is selected, user is clicking Check-out
    if (pickedCheckIn && !pickedCheckOut) {
      if (dateStr === pickedCheckIn) {
        // Clicked same date
        toast('Check-out must be at least 1 night after check-in.', true);
        return;
      }

      if (dateStr < pickedCheckIn) {
        // Clicked an earlier date -> reset check-in to this date
        setPickedCheckIn(dateStr);
        setPickedCheckOut('');
        toast(`📅 Check-in updated: ${fmtDate(dateStr)}. Now click your Check-out date.`);
        return;
      }

      // Verify that no night in between is locked in!
      const lockedDate = rangeHasLockedDate(pickedCheckIn, dateStr);
      if (lockedDate) {
        const roomObj = rooms.find((r) => r.id === activeRoomId);
        const targetName = roomObj?.name || 'This accommodation';
        toast(`⚠️ Range cannot be booked: ${targetName} is already locked in / taken on ${fmtDate(lockedDate)}. Please select consecutive available dates.`, true);
        return;
      }

      setPickedCheckOut(dateStr);
      toast(`✦ Selected stay: ${fmtDate(pickedCheckIn)} → ${fmtDate(dateStr)}`);
      if (onSelectDates) {
        onSelectDates(pickedCheckIn, dateStr);
      }
    }
  };

  // Active room object
  const activeRoomObj = rooms.find((r) => r.id === activeRoomId);

  // Nights calculation
  const selectedNights = pickedCheckIn && pickedCheckOut
    ? Math.max(1, Math.round((new Date(pickedCheckOut).getTime() - new Date(pickedCheckIn).getTime()) / 86400000))
    : 0;

  // Theming
  const bgCard = isLightMode ? '#FFFFFF' : '#0F172A';
  const borderCard = isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.12)';
  const textTitle = isLightMode ? '#0F172A' : '#F8FAFC';
  const textMuted = isLightMode ? '#64748B' : '#94A3B8';

  return (
    <div
      className="availability-calendar-card"
      style={{
        background: bgCard,
        border: `1px solid ${borderCard}`,
        borderRadius: 18,
        padding: '20px 24px',
        boxShadow: isLightMode ? '0 12px 36px rgba(0,0,0,0.06)' : '0 16px 40px rgba(0,0,0,0.5)',
        position: 'relative',
        margin: '16px 0',
      }}
    >
      {/* Header with Title and Room Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <div style={{ minWidth: 0, flex: '1 1 180px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '1.1rem' }}>📅</span>
            <h3 style={{ margin: 0, fontSize: '.95rem', color: textTitle, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700 }}>
              Availability Calendar
            </h3>
          </div>
          <p style={{ margin: '1px 0 0', fontSize: '.72rem', color: textMuted }}>
            Live status. Reserved dates are locked to prevent double-booking.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* Accommodation Filter */}
          <select
            value={activeRoomId}
            onChange={(e) => {
              const val = e.target.value;
              setActiveRoomId(val);
              if (onRoomChange && val !== 'all') {
                onRoomChange(val);
              }
            }}
            style={{
              padding: '4px 12px',
              borderRadius: 9999,
              border: `1px solid ${borderCard}`,
              background: isLightMode ? '#F8FAFC' : '#1E293B',
              color: textTitle,
              fontSize: '.74rem',
              fontWeight: 600,
              cursor: 'pointer',
              maxWidth: 160,
            }}
          >
            <option value="all">All Rooms</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: `1px solid ${borderCard}`,
                color: textMuted,
                borderRadius: 6,
                padding: '3px 8px',
                cursor: 'pointer',
                fontSize: '.72rem',
              }}
              title="Close calendar"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Month Navigation & Legend Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          padding: '8px 10px',
          background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
          borderRadius: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handlePrevMonth}
            style={{
              background: 'transparent',
              border: `1px solid ${borderCard}`,
              color: textTitle,
              borderRadius: 6,
              padding: '2px 8px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '.75rem',
            }}
            title="Previous month"
          >
            ◀
          </button>
          <strong style={{ fontSize: '.88rem', color: textTitle, minWidth: 110, textAlign: 'center' }}>
            {monthName}
          </strong>
          <button
            onClick={handleNextMonth}
            style={{
              background: 'transparent',
              border: `1px solid ${borderCard}`,
              color: textTitle,
              borderRadius: 6,
              padding: '2px 8px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '.75rem',
            }}
            title="Next month"
          >
            ▶
          </button>
          {loading && <span style={{ fontSize: '.7rem', color: '#0EA5E9' }}>⏳</span>}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.68rem', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: isLightMode ? '#059669' : '#34D399', fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            Open
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#F43F5E', fontWeight: 700 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F43F5E', display: 'inline-block' }} />
            🔴 Reserved
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#0284C7', fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0284C7', display: 'inline-block' }} />
            Selected
          </span>
        </div>
      </div>

      {/* Weekday Column Headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 3,
          textAlign: 'center',
          marginBottom: 4,
        }}
      >
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} style={{ fontSize: '.65rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase', padding: '2px 0' }}>
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 3,
        }}
      >
        {/* Leading empty cells before the 1st of the month */}
        {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
          <div key={`empty-${idx}`} style={{ minHeight: 46, background: 'transparent' }} />
        ))}

        {/* Actual day cells */}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const dayNum = idx + 1;
          const monthPad = String(currentMonth + 1).padStart(2, '0');
          const dayPad = String(dayNum).padStart(2, '0');
          const dateStr = `${currentYear}-${monthPad}-${dayPad}`;

          const status = getDateStatus(dateStr);
          const isToday = dateStr === today;
          const isCheckIn = dateStr === pickedCheckIn;
          const isCheckOut = dateStr === pickedCheckOut;
          const isInRange = pickedCheckIn && pickedCheckOut && dateStr > pickedCheckIn && dateStr < pickedCheckOut;
          const isHoveredRange = pickedCheckIn && !pickedCheckOut && hoverDate && dateStr > pickedCheckIn && dateStr <= hoverDate;

          // Determine cell styling
          let cellBg = isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)';
          let cellBorder = `1px solid ${borderCard}`;
          let cellColor = textTitle;
          let cellCursor = 'pointer';

          if (status.isPast) {
            cellBg = isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.01)';
            cellColor = isLightMode ? '#CBD5E1' : '#475569';
            cellCursor = 'not-allowed';
          } else if (status.isLocked) {
            // Locked In / Taken
            cellBg = isLightMode ? '#FFF1F2' : 'rgba(244, 63, 94, 0.15)';
            cellBorder = '1px solid rgba(244, 63, 94, 0.4)';
            cellColor = '#E11D48';
          }

          if (isCheckIn || isCheckOut) {
            cellBg = '#0284C7';
            cellBorder = '1px solid #0369A1';
            cellColor = '#FFFFFF';
          } else if (isInRange || isHoveredRange) {
            cellBg = isLightMode ? '#E0F2FE' : 'rgba(2, 132, 199, 0.25)';
            cellBorder = '1px solid rgba(2, 132, 199, 0.35)';
            cellColor = isLightMode ? '#0369A1' : '#38BDF8';
          }

          return (
            <div
              key={dateStr}
              onClick={() => handleDayClick(dateStr)}
              onMouseEnter={() => setHoverDate(dateStr)}
              onMouseLeave={() => setHoverDate(null)}
              className="calendar-day-cell group relative flex flex-col justify-between transition-all select-none"
              style={{
                minHeight: 46,
                padding: '3px 3px',
                borderRadius: 8,
                background: cellBg,
                border: cellBorder,
                color: cellColor,
                cursor: cellCursor,
                boxShadow: isCheckIn || isCheckOut ? '0 3px 10px rgba(2, 132, 199, 0.3)' : 'none',
              }}
              title={
                status.isPast
                  ? 'Past date'
                  : status.isLocked
                  ? `Reserved on ${dateStr}`
                  : `Available on ${dateStr}`
              }
            >
              {/* Day Number and Today Indicator */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', lineHeight: 1 }}>
                <span style={{ fontSize: '.76rem', fontWeight: isToday || isCheckIn || isCheckOut ? 800 : 600 }}>
                  {dayNum}
                </span>
                {isToday && (
                  <span
                    style={{
                      fontSize: '.5rem',
                      fontWeight: 800,
                      background: isCheckIn ? '#FFFFFF' : '#0EA5E9',
                      color: isCheckIn ? '#0284C7' : '#FFFFFF',
                      borderRadius: 3,
                      padding: '0 2px',
                      lineHeight: 1.2,
                    }}
                  >
                    •
                  </span>
                )}
              </div>

              {/* Status / Lock Badge */}
              <div style={{ textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                {isCheckIn && (
                  <span style={{ fontSize: '.58rem', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase' }}>In</span>
                )}
                {isCheckOut && (
                  <span style={{ fontSize: '.58rem', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase' }}>Out</span>
                )}
                {!isCheckIn && !isCheckOut && (
                  <>
                    {status.isPast ? (
                      <span style={{ fontSize: '.55rem', color: isLightMode ? '#94A3B8' : '#475569' }}>—</span>
                    ) : status.isLocked ? (
                      <span
                        style={{
                          fontSize: '.56rem',
                          fontWeight: 800,
                          color: '#E11D48',
                          background: isLightMode ? 'rgba(244,63,94,0.1)' : 'rgba(244,63,94,0.25)',
                          padding: '1px 2px',
                          borderRadius: 3,
                          display: 'inline-block',
                          border: '1px solid rgba(244,63,94,0.3)',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        🔴 Booked
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '.56rem',
                          color: isLightMode ? '#059669' : '#34D399',
                          fontWeight: 600,
                          display: 'inline-block',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        Open
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Stay Bar */}
      <div
        style={{
          marginTop: 10,
          padding: '8px 10px',
          background: isLightMode ? '#EEF2FF' : 'rgba(99, 102, 241, 0.1)',
          border: `1px solid ${isLightMode ? '#C7D2FE' : 'rgba(99, 102, 241, 0.25)'}`,
          borderRadius: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '.64rem', color: textMuted, fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>
              Selected Stay:
            </span>
            <div style={{ fontSize: '.8rem', color: textTitle, fontWeight: 700, marginTop: 1, whiteSpace: 'nowrap' }}>
              {pickedCheckIn ? (
                <>
                  <span>{pickedCheckIn}</span>
                  <span style={{ margin: '0 4px', color: '#6366F1' }}>➔</span>
                  {pickedCheckOut ? (
                    <span>{pickedCheckOut}</span>
                  ) : (
                    <span style={{ color: '#0EA5E9', fontStyle: 'italic', fontSize: '.72rem' }}>Pick check-out</span>
                  )}
                  {selectedNights > 0 && (
                    <span style={{ marginLeft: 6, fontSize: '.72rem', color: '#6366F1', fontWeight: 800 }}>
                      ({selectedNights}n)
                    </span>
                  )}
                </>
              ) : (
                <span style={{ color: textMuted, fontWeight: 500, fontStyle: 'italic', fontSize: '.72rem' }}>
                  Click an open date on calendar
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(pickedCheckIn || pickedCheckOut) && (
            <button
              onClick={() => {
                setPickedCheckIn('');
                setPickedCheckOut('');
              }}
              style={{
                padding: '3px 8px',
                fontSize: '.7rem',
                borderRadius: 6,
                background: 'transparent',
                border: `1px solid ${borderCard}`,
                color: textMuted,
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          )}

          {pickedCheckIn && pickedCheckOut && onSelectDates && (
            <button
              onClick={() => {
                onSelectDates(pickedCheckIn, pickedCheckOut);
                toast(`✦ Dates applied: ${pickedCheckIn} → ${pickedCheckOut}`);
                if (onClose) onClose();
              }}
              style={{
                padding: '3px 10px',
                fontSize: '.72rem',
                borderRadius: 6,
                background: '#0284C7',
                color: '#FFFFFF',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Apply Dates ✦
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
