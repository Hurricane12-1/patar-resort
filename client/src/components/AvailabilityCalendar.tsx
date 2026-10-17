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
  isLightMode?: boolean;
  onClose?: () => void;
}

export default function AvailabilityCalendar({
  selectedRoomId,
  rooms = [],
  initialCheckIn,
  initialCheckOut,
  onSelectDates,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.25rem' }}>📅</span>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: textTitle, fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              Resort Availability & Locked-In Calendar
            </h3>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: '.82rem', color: textMuted }}>
            Real-time calendar view. Dates reserved by guests are locked in (taken) to guarantee zero overbooking.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Accommodation Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: '.78rem', color: textMuted, fontWeight: 700 }}>Villa / Room:</label>
            <select
              value={activeRoomId}
              onChange={(e) => setActiveRoomId(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 10,
                border: `1px solid ${borderCard}`,
                background: isLightMode ? '#F8FAFC' : '#1E293B',
                color: textTitle,
                fontSize: '.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value="all">Resort-Wide (All Accommodations)</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.category || 'Cottage'})
                </option>
              ))}
            </select>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: `1px solid ${borderCard}`,
                color: textMuted,
                borderRadius: 8,
                padding: '5px 10px',
                cursor: 'pointer',
                fontSize: '.8rem',
              }}
              title="Close calendar"
            >
              ✕ Close
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
          gap: 12,
          padding: '10px 14px',
          background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handlePrevMonth}
            style={{
              background: 'transparent',
              border: `1px solid ${borderCard}`,
              color: textTitle,
              borderRadius: 8,
              padding: '4px 10px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '.85rem',
            }}
            title="Previous month"
          >
            ◀
          </button>
          <strong style={{ fontSize: '1rem', color: textTitle, minWidth: 140, textAlign: 'center' }}>
            {monthName}
          </strong>
          <button
            onClick={handleNextMonth}
            style={{
              background: 'transparent',
              border: `1px solid ${borderCard}`,
              color: textTitle,
              borderRadius: 8,
              padding: '4px 10px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '.85rem',
            }}
            title="Next month"
          >
            ▶
          </button>
          {loading && <span style={{ fontSize: '.75rem', color: '#0EA5E9' }}>⏳ Syncing locks…</span>}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '.75rem', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: isLightMode ? '#059669' : '#34D399', fontWeight: 600 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            🟢 Available (Open)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#F43F5E', fontWeight: 700 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F43F5E', display: 'inline-block' }} />
            🔴 Reserved / Booked
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#0284C7', fontWeight: 600 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#0284C7', display: 'inline-block' }} />
            🔵 Selected Stay Range
          </span>
        </div>
      </div>

      {/* Weekday Column Headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 6,
          textAlign: 'center',
          marginBottom: 6,
        }}
      >
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} style={{ fontSize: '.74rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase', padding: '4px 0' }}>
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 6,
        }}
      >
        {/* Leading empty cells before the 1st of the month */}
        {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
          <div key={`empty-${idx}`} style={{ height: 62, background: 'transparent' }} />
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
            cellBg = isLightMode ? '#FFF1F2' : 'rgba(244, 63, 94, 0.12)';
            cellBorder = '1px solid rgba(244, 63, 94, 0.35)';
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
              style={{
                height: 64,
                padding: '6px 8px',
                borderRadius: 10,
                background: cellBg,
                border: cellBorder,
                color: cellColor,
                cursor: cellCursor,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
                position: 'relative',
                boxShadow: isCheckIn || isCheckOut ? '0 4px 12px rgba(2, 132, 199, 0.3)' : 'none',
              }}
              title={
                status.isPast
                  ? 'Past date'
                  : status.isLocked
                  ? `Locked in / Taken: ${status.label}`
                  : `Available: ${status.label}`
              }
            >
              {/* Day Number and Today Indicator */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '.84rem', fontWeight: isToday || isCheckIn || isCheckOut ? 800 : 600 }}>
                  {dayNum}
                </span>
                {isToday && (
                  <span
                    style={{
                      fontSize: '.62rem',
                      fontWeight: 800,
                      background: isCheckIn ? '#FFFFFF' : '#0EA5E9',
                      color: isCheckIn ? '#0284C7' : '#FFFFFF',
                      borderRadius: 4,
                      padding: '1px 4px',
                    }}
                  >
                    Today
                  </span>
                )}
              </div>

              {/* Status / Lock Badge */}
              <div style={{ textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isCheckIn && (
                  <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#FFFFFF' }}>Check-In</span>
                )}
                {isCheckOut && (
                  <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#FFFFFF' }}>Check-Out</span>
                )}
                {!isCheckIn && !isCheckOut && (
                  <>
                    {status.isPast ? (
                      <span style={{ fontSize: '.65rem', color: isLightMode ? '#94A3B8' : '#475569' }}>—</span>
                    ) : status.isLocked ? (
                      <span
                        style={{
                          fontSize: '.65rem',
                          fontWeight: 800,
                          color: '#E11D48',
                          background: isLightMode ? 'rgba(244,63,94,0.1)' : 'rgba(244,63,94,0.25)',
                          padding: '2px 5px',
                          borderRadius: 4,
                          display: 'inline-block',
                          border: '1px solid rgba(244,63,94,0.4)',
                        }}
                      >
                        🔴 Reserved
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '.65rem',
                          color: isLightMode ? '#059669' : '#34D399',
                          fontWeight: 600,
                        }}
                      >
                        {status.unitsLeft !== undefined ? (status.unitsLeft === 1 ? '1 unit' : `${status.unitsLeft} units`) : 'Available'}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Stay Bar & Action Confirm Button */}
      <div
        style={{
          marginTop: 18,
          padding: '12px 18px',
          background: isLightMode ? '#EEF2FF' : 'rgba(99, 102, 241, 0.1)',
          border: `1px solid ${isLightMode ? '#C7D2FE' : 'rgba(99, 102, 241, 0.25)'}`,
          borderRadius: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '.74rem', color: textMuted, fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>
              Selected Reservation Stay
            </span>
            <div style={{ fontSize: '.92rem', color: textTitle, fontWeight: 700, marginTop: 2 }}>
              {pickedCheckIn ? (
                <>
                  <span>{fmtDate(pickedCheckIn)}</span>
                  <span style={{ margin: '0 6px', color: '#6366F1' }}>➔</span>
                  {pickedCheckOut ? (
                    <span>{fmtDate(pickedCheckOut)}</span>
                  ) : (
                    <span style={{ color: '#0EA5E9', fontStyle: 'italic' }}>Select Check-Out Date</span>
                  )}
                  {selectedNights > 0 && (
                    <span style={{ marginLeft: 8, fontSize: '.8rem', color: '#6366F1', fontWeight: 800 }}>
                      ({selectedNights} night{selectedNights > 1 ? 's' : ''})
                    </span>
                  )}
                </>
              ) : (
                <span style={{ color: textMuted, fontWeight: 500, fontStyle: 'italic' }}>
                  Click an open date on the calendar to set your Check-In
                </span>
              )}
            </div>
          </div>

          {activeRoomObj && (
            <div style={{ borderLeft: `1px solid ${borderCard}`, paddingLeft: 12 }}>
              <span style={{ fontSize: '.72rem', color: textMuted, fontWeight: 700, display: 'block' }}>Rate Preview:</span>
              <span style={{ fontSize: '.92rem', color: '#10B981', fontWeight: 800 }}>
                {selectedNights > 0 ? money(activeRoomObj.rate_php * selectedNights) : `${money(activeRoomObj.rate_php)}/night`}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {(pickedCheckIn || pickedCheckOut) && (
            <button
              onClick={() => {
                setPickedCheckIn('');
                setPickedCheckOut('');
              }}
              className="btn btn-sm btn-ghost"
              style={{ color: textMuted, border: `1px solid ${borderCard}` }}
            >
              Reset
            </button>
          )}

          {pickedCheckIn && pickedCheckOut && onSelectDates && (
            <button
              onClick={() => {
                onSelectDates(pickedCheckIn, pickedCheckOut);
                toast(`✦ Dates locked & applied to booking: ${fmtDate(pickedCheckIn)} → ${fmtDate(pickedCheckOut)}`);
                if (onClose) onClose();
              }}
              className="btn btn-sm btn-sky"
              style={{ fontWeight: 700 }}
            >
              Apply Dates to Booking ✦
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
