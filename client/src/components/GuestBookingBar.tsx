import React, { useState, useRef, useEffect, useMemo } from 'react';
import '../styles/guest-calendar.css';
import { toast } from './Toasts.tsx';

interface GuestBookingBarProps {
  checkIn: string;
  checkOut: string;
  onSelectDates: (cin: string, cout: string) => void;
  adults: number;
  onAdultsChange: (count: number) => void;
  childrenCount: number;
  onChildrenChange: (count: number) => void;
  roomsCount: number;
  onRoomsChange: (count: number) => void;
  promoCode: string;
  onPromoCodeChange: (code: string) => void;
  onSearch: () => void;
  searching: boolean;
  catalog?: any[];
  today: string;
  disabledSearch?: boolean;
}

export default function GuestBookingBar({
  checkIn,
  checkOut,
  onSelectDates,
  adults,
  onAdultsChange,
  childrenCount,
  onChildrenChange,
  roomsCount,
  onRoomsChange,
  promoCode,
  onPromoCodeChange,
  onSearch,
  searching,
  catalog = [],
  today,
  disabledSearch = false,
}: GuestBookingBarProps) {
  // Popover open states
  const [showCalendarPopover, setShowCalendarPopover] = useState(false);
  const [showGuestsPopover, setShowGuestsPopover] = useState(false);
  const [showCodePopover, setShowCodePopover] = useState(false);
  const [datesFlexible, setDatesFlexible] = useState(false);

  // Month navigation: viewMonthDate represents the 1st of the left month
  const [viewMonthDate, setViewMonthDate] = useState<Date>(() => {
    if (checkIn) {
      const [y, m] = checkIn.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    const [y, m] = today.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  // Calendar selection in-progress state
  const [pendingCheckIn, setPendingCheckIn] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close popovers on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowCalendarPopover(false);
        setShowGuestsPopover(false);
        setShowCodePopover(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute number of nights
  const nights = useMemo(() => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return 1;
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
  }, [checkIn, checkOut]);

  // Format date helper: "Nov 15, 2026"
  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '';
    const [y, m, d] = dStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Base starting rate from active catalog
  const baseStartingRate = useMemo(() => {
    if (!catalog || catalog.length === 0) return 2800;
    const rates = catalog.map((r) => Number(r.rate_php) || 0).filter((r) => r > 0);
    return rates.length > 0 ? Math.min(...rates) : 2800;
  }, [catalog]);

  // Calculate daily price display (e.g., "2.8k" or "3.2k")
  const getDayPriceTag = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = d.getDay();
    // Weekend adjustment (Friday / Saturday)
    const multiplier = dayOfWeek === 5 || dayOfWeek === 6 ? 1.15 : 1.0;
    const rate = Math.round(baseStartingRate * multiplier);
    return `${(rate / 1000).toFixed(rate >= 10000 ? 0 : 1)}k`;
  };

  // Navigation handlers for dual months
  const handlePrevMonth = () => {
    setViewMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Minimum allowed month is current month
  const isPrevDisabled = useMemo(() => {
    const [todayY, todayM] = today.split('-').map(Number);
    const minMonth = new Date(todayY, todayM - 1, 1);
    return viewMonthDate <= minMonth;
  }, [viewMonthDate, today]);

  // Date click handler
  const handleDateClick = (dateStr: string) => {
    if (dateStr <= today) {
      toast('Same-day bookings are walk-in only. Please select tomorrow or a later date.', true);
      return;
    }

    if (!pendingCheckIn) {
      // Step 1: select checkIn
      setPendingCheckIn(dateStr);
      setHoverDate(null);
    } else {
      // Step 2: select checkOut
      if (dateStr > pendingCheckIn) {
        onSelectDates(pendingCheckIn, dateStr);
        setPendingCheckIn(null);
        setHoverDate(null);
        setShowCalendarPopover(false);
        const nightsCount = Math.round((new Date(dateStr).getTime() - new Date(pendingCheckIn).getTime()) / 86400000);
        toast(`✦ Dates chosen: ${formatDisplayDate(pendingCheckIn)} → ${formatDisplayDate(dateStr)} (${nightsCount} night${nightsCount > 1 ? 's' : ''})`);
      } else {
        // If clicked date is before or same as pendingCheckIn, make it the new checkIn
        setPendingCheckIn(dateStr);
      }
    }
  };

  // Helper to render one month calendar pane
  const renderMonthPane = (offsetMonth: number) => {
    const targetMonth = new Date(viewMonthDate.getFullYear(), viewMonthDate.getMonth() + offsetMonth, 1);
    const year = targetMonth.getFullYear();
    const month = targetMonth.getMonth(); // 0-indexed
    const monthName = targetMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 is Sunday

    const cells: React.ReactNode[] = [];

    // Empty cells before first day
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(<div key={`empty-${i}`} className="gbb-day-cell is-empty" />);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isPast = dateStr < today;
      const isToday = dateStr === today;

      const activeIn = pendingCheckIn || checkIn;
      const activeOut = pendingCheckIn ? null : checkOut;

      const isStart = activeIn === dateStr;
      const isEnd = activeOut === dateStr;
      const isInRange = activeIn && activeOut && dateStr > activeIn && dateStr < activeOut;
      const isHoverRange = pendingCheckIn && hoverDate && dateStr > pendingCheckIn && dateStr <= hoverDate;

      const priceTag = isPast ? '' : getDayPriceTag(dateStr);

      cells.push(
        <div
          key={dateStr}
          className={`gbb-day-cell ${isPast ? 'is-past' : ''} ${isStart ? 'is-selected-start' : ''} ${
            isEnd ? 'is-selected-end' : ''
          } ${isInRange ? 'is-in-range' : ''} ${isHoverRange ? 'is-hover-range' : ''}`}
          onClick={() => !isPast && handleDateClick(dateStr)}
          onMouseEnter={() => pendingCheckIn && !isPast && setHoverDate(dateStr)}
        >
          <span className="gbb-day-num">{day}</span>
          {!isPast && <span className="gbb-day-price">{priceTag}</span>}
        </div>
      );
    }

    return (
      <div className="gbb-month-pane" key={monthName}>
        <div className="gbb-month-title">{monthName}</div>
        <div className="gbb-weekdays">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w) => (
            <div key={w} className="gbb-weekday">
              {w}
            </div>
          ))}
        </div>
        <div className="gbb-days-grid">{cells}</div>
      </div>
    );
  };

  return (
    <div className="guest-booking-bar-container" ref={containerRef}>
      <div className="guest-booking-bar">
        {/* ── 1. DATES RANGE SELECTOR ── */}
        <div
          className={`gbb-cell ${showCalendarPopover ? 'is-active' : ''}`}
          onClick={() => {
            setShowCalendarPopover((prev) => !prev);
            setShowGuestsPopover(false);
            setShowCodePopover(false);
            setPendingCheckIn(null);
          }}
          title="Click to select stay dates"
        >
          <span className="gbb-cell-label">Stay Dates</span>
          <div className="gbb-dates-display">
            <i className="fas fa-calendar-days gbb-date-icon" />
            <span className="gbb-date-text">{formatDisplayDate(checkIn) || 'Select Check-in'}</span>
            <span className="gbb-nights-pill">
              {nights} night{nights > 1 ? 's' : ''}
            </span>
            <span className="gbb-date-text">{formatDisplayDate(checkOut) || 'Select Check-out'}</span>
          </div>
        </div>

        {/* ── 2. GUESTS & ROOMS SELECTOR ── */}
        <div
          className={`gbb-cell ${showGuestsPopover ? 'is-active' : ''}`}
          onClick={() => {
            setShowGuestsPopover((prev) => !prev);
            setShowCalendarPopover(false);
            setShowCodePopover(false);
          }}
          title="Click to adjust guest and room occupancy"
        >
          <span className="gbb-cell-label">Guests &amp; Rooms</span>
          <div className="gbb-guests-display">
            <i className="fas fa-user-group gbb-guest-icon" />
            <span>
              {roomsCount} Room{roomsCount > 1 ? 's' : ''}, {adults} Adult{adults > 1 ? 's' : ''}
              {childrenCount > 0 ? `, ${childrenCount} Child${childrenCount > 1 ? 'ren' : ''}` : ', 0 Children'}
            </span>
          </div>
        </div>

        {/* ── 3. SPECIAL PROMO / VOUCHER CODE ── */}
        <div
          className={`gbb-cell ${showCodePopover ? 'is-active' : ''}`}
          onClick={() => {
            setShowCodePopover((prev) => !prev);
            setShowCalendarPopover(false);
            setShowGuestsPopover(false);
          }}
          title="Click to enter special booking code or promo voucher"
        >
          <span className="gbb-cell-label">Special Code</span>
          <div className="gbb-code-display">
            <i className="fas fa-tag gbb-code-icon" />
            <span>{promoCode ? `Code: ${promoCode}` : 'Special Code'}</span>
          </div>
        </div>

        {/* ── 4. CTA CHECK AVAILABILITY BUTTON ── */}
        <button
          type="button"
          className="gbb-submit-btn"
          disabled={searching || disabledSearch || checkOut <= checkIn}
          onClick={onSearch}
        >
          {searching ? (
            <>
              <i className="fas fa-spinner fa-spin" />
              <span>Checking…</span>
            </>
          ) : (
            <>
              <span>Check Availability</span>
              <i className="fas fa-arrow-right" style={{ fontSize: '.75rem' }} />
            </>
          )}
        </button>

        {/* ── 2-MONTH SIDE-BY-SIDE CALENDAR POPOVER ── */}
        {showCalendarPopover && (
          <div className="gbb-calendar-popover">
            {/* Top Navigation Arrows */}
            <div className="gbb-cal-nav">
              <button
                type="button"
                className="gbb-cal-nav-btn"
                disabled={isPrevDisabled}
                onClick={handlePrevMonth}
                aria-label="Previous Month"
              >
                <i className="fas fa-chevron-left" />
              </button>

              <span style={{ fontSize: '.8rem', color: '#38BDF8', fontWeight: 700, letterSpacing: '.06em' }}>
                {pendingCheckIn
                  ? 'Select Check-Out Date'
                  : 'Select Check-In & Check-Out Dates'}
              </span>

              <button
                type="button"
                className="gbb-cal-nav-btn"
                onClick={handleNextMonth}
                aria-label="Next Month"
              >
                <i className="fas fa-chevron-right" />
              </button>
            </div>

            {/* Dual Month Side-by-Side Panes */}
            <div className="gbb-dual-months">
              {renderMonthPane(0)}
              {renderMonthPane(1)}
            </div>

            {/* Footer */}
            <div className="gbb-cal-footer">
              <span className="gbb-cal-disclaimer">
                <i className="fas fa-circle-info" style={{ color: '#38BDF8' }} />
                <span>Price is for reference starting rate per night.</span>
              </span>

              <label className="gbb-cal-flexible">
                <input
                  type="checkbox"
                  checked={datesFlexible}
                  onChange={(e) => setDatesFlexible(e.target.checked)}
                />
                <span>My dates are flexible</span>
              </label>

              <button
                type="button"
                className="gbb-cal-done-btn"
                onClick={() => {
                  setPendingCheckIn(null);
                  setShowCalendarPopover(false);
                }}
              >
                Apply Dates
              </button>
            </div>
          </div>
        )}

        {/* ── GUESTS & ROOMS POPOVER ── */}
        {showGuestsPopover && (
          <div className="gbb-guests-popover">
            <div className="gbb-popover-head">
              <p className="gbb-popover-subtitle">Max. 6 guests per unit</p>
              <div className="gbb-popover-room-strip">
                <h4 className="gbb-popover-room-title">Room 1 · Allocation</h4>
                <span className="gbb-popover-room-badge">{roomsCount} {roomsCount > 1 ? 'Units' : 'Unit'}</span>
              </div>
            </div>

            {/* Adult Stepper */}
            <div className="gbb-stepper-row">
              <div className="gbb-stepper-label">
                <span className="gbb-stepper-title">Adult(s)</span>
                <span className="gbb-stepper-hint">Ages 13 and above</span>
              </div>
              <div className="gbb-stepper-controls">
                <button
                  type="button"
                  className="gbb-stepper-btn"
                  disabled={adults <= 1}
                  onClick={() => onAdultsChange(Math.max(1, adults - 1))}
                >
                  −
                </button>
                <span className="gbb-stepper-val">{adults}</span>
                <button
                  type="button"
                  className="gbb-stepper-btn"
                  disabled={adults >= 10}
                  onClick={() => onAdultsChange(Math.min(10, adults + 1))}
                >
                  +
                </button>
              </div>
            </div>

            {/* Children Stepper */}
            <div className="gbb-stepper-row">
              <div className="gbb-stepper-label">
                <span className="gbb-stepper-title">Children</span>
                <span className="gbb-stepper-hint">Under 12 years old</span>
              </div>
              <div className="gbb-stepper-controls">
                <button
                  type="button"
                  className="gbb-stepper-btn"
                  disabled={childrenCount <= 0}
                  onClick={() => onChildrenChange(Math.max(0, childrenCount - 1))}
                >
                  −
                </button>
                <span className="gbb-stepper-val">{childrenCount}</span>
                <button
                  type="button"
                  className="gbb-stepper-btn"
                  disabled={childrenCount >= 6}
                  onClick={() => onChildrenChange(Math.min(6, childrenCount + 1))}
                >
                  +
                </button>
              </div>
            </div>

            {/* Room Count Stepper */}
            <div className="gbb-stepper-row">
              <div className="gbb-stepper-label">
                <span className="gbb-stepper-title">Number of Units</span>
                <span className="gbb-stepper-hint">Rooms / Cottages</span>
              </div>
              <div className="gbb-stepper-controls">
                <button
                  type="button"
                  className="gbb-stepper-btn"
                  disabled={roomsCount <= 1}
                  onClick={() => onRoomsChange(Math.max(1, roomsCount - 1))}
                >
                  −
                </button>
                <span className="gbb-stepper-val">{roomsCount}</span>
                <button
                  type="button"
                  className="gbb-stepper-btn"
                  disabled={roomsCount >= 4}
                  onClick={() => onRoomsChange(Math.min(4, roomsCount + 1))}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <button
                type="button"
                className="gbb-occupancy-done-btn"
                onClick={() => setShowGuestsPopover(false)}
              >
                <span>Confirm Occupancy</span>
                <i className="fas fa-check" style={{ fontSize: '.75rem' }} />
              </button>
            </div>
          </div>
        )}

        {/* ── SPECIAL CODE POPOVER ── */}
        {showCodePopover && (
          <div className="gbb-code-popover">
            <h4 style={{ margin: '0 0 4px', fontSize: '.9rem', color: '#FFFFFF' }}>
              Special Promo Code
            </h4>
            <p style={{ margin: '0 0 12px', fontSize: '.72rem', color: '#64748B' }}>
              Enter corporate partner or early-bird code.
            </p>
            <input
              type="text"
              placeholder="e.g. PATAR2026"
              value={promoCode}
              onChange={(e) => onPromoCodeChange(e.target.value.toUpperCase())}
              className="gbb-code-input"
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="gbb-cal-done-btn"
                style={{ flex: 1, padding: '8px' }}
                onClick={() => {
                  if (promoCode) {
                    toast(`✦ Special code "${promoCode}" active for rates`);
                  }
                  setShowCodePopover(false);
                }}
              >
                Apply Code
              </button>
              {promoCode && (
                <button
                  type="button"
                  onClick={() => {
                    onPromoCodeChange('');
                    setShowCodePopover(false);
                  }}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#94A3B8',
                    padding: '8px 12px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: '.72rem',
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
