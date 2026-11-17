import React, { useState, useEffect, useMemo } from 'react';
import { money, fmtDate, fmtTime } from '../../lib/format';
import { IconSearch } from '../../components/AdminIcons';
import StatusPill from '../../components/StatusPill';
import AvailabilityCalendar from '../../components/AvailabilityCalendar';
import { exportReservationsCSV } from '../../lib/ledgerUtils';
import { api } from '../../lib/api';
import { resolveReservationOfferingType, getOfferingLabel, OfferingType } from '../../lib/offeringSpecs';

export interface LedgerViewProps {
  ledgerSubView: 'stay_folios' | 'availability' | 'debit_credit';
  setLedgerSubView: (subView: 'stay_folios' | 'availability' | 'debit_credit') => void;
  allBookings: any[];
  activeRoomsList: any[];
  roomsList: any[];
  setRoomsList: React.Dispatch<React.SetStateAction<any[]>>;
  ledgerEntriesList: any[];
  trialBalance: any;
  chartOfAccounts: any[];
  loadingLedger: boolean;
  loadingReservations: boolean;
  reconcilingLedger: boolean;
  handleReconcileLedger: () => void;
  refreshReservations: () => void;
  refreshLedgerEntries: () => void;
  updateStatus: (id: string, status: string) => void;
  setTimelineBooking: (booking: any) => void;
  setReceiptModalBooking: (booking: any) => void;
  setReservationToRemove: (booking: any) => void;
  setRefundTarget: (booking: any) => void;
  setRefundMode: (mode: 'request' | 'confirm') => void;
  setRefundAmount: (amount: any) => void;
  setRefundMethod: (method: string) => void;
  setShowAddReservationModal: (show: boolean) => void;
  setShowAddJournalModal: (show: boolean) => void;
  setShowBackupModal: (show: boolean) => void;
  setBackupTab: (tab: 'export' | 'import' | 'notation' | 'auto') => void;
  newReservation: any;
  setNewReservation: React.Dispatch<React.SetStateAction<any>>;
  isLightMode: boolean;
  themeCardBg: string;
  themeBorder: string;
  themeShadow: string;
  themeText: string;
  themeMuted: string;
  toast: (msg: string, isError?: boolean) => void;
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  ledgerSubView,
  setLedgerSubView,
  allBookings,
  activeRoomsList,
  roomsList,
  setRoomsList,
  ledgerEntriesList,
  trialBalance,
  chartOfAccounts,
  loadingLedger,
  loadingReservations,
  reconcilingLedger,
  handleReconcileLedger,
  refreshReservations,
  refreshLedgerEntries,
  updateStatus,
  setTimelineBooking,
  setReceiptModalBooking,
  setReservationToRemove,
  setRefundTarget,
  setRefundMode,
  setRefundAmount,
  setRefundMethod,
  setShowAddReservationModal,
  setShowAddJournalModal,
  setShowBackupModal,
  setBackupTab,
  newReservation,
  setNewReservation,
  isLightMode,
  themeCardBg,
  themeBorder,
  themeShadow,
  themeText,
  themeMuted,
  toast,
}) => {
  const [reservationFilter, setReservationFilter] = useState<string>(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_res_filter');
      return (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_res_filter') : 'all') || 'all';
    } catch {
      return 'all';
    }
  });
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_res_filter');
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('jd_admin_res_filter', reservationFilter);
    } catch {}
  }, [reservationFilter]);

  const [reservationSearch, setReservationSearch] = useState<string>(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_res_search');
      return (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_res_search') : '') || '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_res_search');
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('jd_admin_res_search', reservationSearch);
    } catch {}
  }, [reservationSearch]);

  const [folioViewLimit, setFolioViewLimit] = useState<number | 'all'>(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_folio_limit');
      const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_folio_limit') : null;
      if (saved === 'all') return 'all';
      if (saved && !isNaN(Number(saved))) return Number(saved);
    } catch {}
    return 25;
  });
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_folio_limit');
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('jd_admin_folio_limit', String(folioViewLimit));
    } catch {}
  }, [folioViewLimit]);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [savingBookingEdit, setSavingBookingEdit] = useState<boolean>(false);

  const [ledgerAccountFilter, setLedgerAccountFilter] = useState<string>('');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState<string>('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | 'debit' | 'credit'>('all');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [bookingTypeFilter, setBookingTypeFilter] = useState<'all' | OfferingType>('all');

  // Dynamic PMS Analytics Selected Month (defaulting to current month, e.g. "2026-11")
  const [analyticsYearMonth, setAnalyticsYearMonth] = useState<string>(() => {
    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      return `${yyyy}-${mm}`;
    } catch {
      return '2026-11';
    }
  });

  const handlePrevAnalyticsMonth = () => {
    const [y, m] = analyticsYearMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    const prevY = d.getFullYear();
    const prevM = String(d.getMonth() + 1).padStart(2, '0');
    setAnalyticsYearMonth(`${prevY}-${prevM}`);
  };

  const handleNextAnalyticsMonth = () => {
    const [y, m] = analyticsYearMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    const nextY = d.getFullYear();
    const nextM = String(d.getMonth() + 1).padStart(2, '0');
    setAnalyticsYearMonth(`${nextY}-${nextM}`);
  };

  const handleThisAnalyticsMonth = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    setAnalyticsYearMonth(`${yyyy}-${mm}`);
  };

  const filteredBookings = allBookings.filter((b: any) => {
    if (bookingTypeFilter !== 'all' && resolveReservationOfferingType(b) !== bookingTypeFilter) return false;
    if (reservationFilter !== 'all') {
      if (reservationFilter === 'maintenance') {
        if (b.status !== 'maintenance' && !b.is_maintenance) return false;
      } else if (reservationFilter === 'disputed') {
        if (b.status !== 'disputed' && b.status !== 'escalated') return false;
      } else if (b.status !== reservationFilter) {
        return false;
      }
    }
    if (reservationSearch.trim()) {
      const q = reservationSearch.toLowerCase();
      const guestName = (b.guest_name || b.profiles?.full_name || '').toLowerCase();
      const phone = (b.phone || b.profiles?.phone || '').toLowerCase();
      const room = (b.rooms?.name || '').toLowerCase();
      const id = (b.id || '').toLowerCase();
      const code = (b.booking_code || '').toLowerCase();
      if (!guestName.includes(q) && !phone.includes(q) && !room.includes(q) && !id.includes(q) && !code.includes(q)) return false;
    }
    return true;
  });

  const statusCounts = useMemo(() => {
    const all = allBookings.length;
    const confirmed = allBookings.filter((b: any) => b.status === 'confirmed').length;
    const pending = allBookings.filter((b: any) => b.status === 'pending').length;
    const checkedIn = allBookings.filter((b: any) => b.status === 'checked_in').length;
    const checkedOut = allBookings.filter((b: any) => b.status === 'checked_out').length;
    const onHold = allBookings.filter((b: any) => b.status === 'on_hold').length;
    const maintenance = allBookings.filter((b: any) => b.status === 'maintenance' || b.is_maintenance).length;
    const disputed = allBookings.filter((b: any) => b.status === 'disputed' || b.status === 'escalated').length;
    const noShow = allBookings.filter((b: any) => b.status === 'no_show').length;
    const cancelled = allBookings.filter((b: any) => b.status === 'cancelled').length;
    return { all, confirmed, pending, checkedIn, checkedOut, onHold, maintenance, disputed, noShow, cancelled };
  }, [allBookings]);

  const filterOptions = [
    { key: 'all', label: 'All', count: statusCounts.all },
    { key: 'confirmed', label: 'Confirmed', count: statusCounts.confirmed },
    { key: 'pending', label: 'Pending', count: statusCounts.pending },
    { key: 'checked_in', label: 'Checked in', count: statusCounts.checkedIn },
    { key: 'checked_out', label: 'Checked out', count: statusCounts.checkedOut },
    { key: 'on_hold', label: 'On Hold', count: statusCounts.onHold },
    { key: 'maintenance', label: 'Maintenance', count: statusCounts.maintenance },
    { key: 'disputed', label: 'Disputed', count: statusCounts.disputed },
    { key: 'no_show', label: 'No Show', count: statusCounts.noShow },
    { key: 'cancelled', label: 'Cancelled', count: statusCounts.cancelled },
  ];

  return (
    <div className="ledger-view-wrapper">
      {/* 1. TOP VIEW SWITCHER & ACTIONS BAR (MATCHING SCREENSHOT) */}
      <div className="pms-view-bar">
        {/* Left: Segmented Switcher */}
        <div className={`pms-view-switcher ${!isLightMode ? 'dark' : ''}`}>
          <button
            type="button"
            className={`pms-view-tab ${ledgerSubView === 'stay_folios' ? 'active' : ''} ${!isLightMode ? 'dark' : ''}`}
            onClick={() => setLedgerSubView('stay_folios')}
          >
            <i className="fas fa-list-ul" />
            <span>List (Reservations)</span>
          </button>
          <button
            type="button"
            className={`pms-view-tab ${ledgerSubView === 'availability' ? 'active' : ''} ${!isLightMode ? 'dark' : ''}`}
            onClick={() => setLedgerSubView('availability')}
          >
            <i className="far fa-calendar-alt" />
            <span>Calendar</span>
          </button>
          <button
            type="button"
            className={`pms-view-tab ${ledgerSubView === 'debit_credit' ? 'active' : ''} ${!isLightMode ? 'dark' : ''}`}
            onClick={() => setLedgerSubView('debit_credit')}
          >
            <i className="fas fa-chart-simple" />
            <span>Analytics</span>
          </button>
        </div>

        {/* Right: Export & New Booking Actions */}
        <div className="pms-header-actions">
          <button
            type="button"
            className={`pms-export-btn ${!isLightMode ? 'dark' : ''}`}
            onClick={() => {
              const ok = exportReservationsCSV(allBookings);
              if (ok) {
                toast('✓ Reservations CSV exported successfully');
              } else {
                toast('No reservations to export', true);
              }
            }}
          >
            <i className="fas fa-arrow-down-to-line" />
            <span>Export</span>
          </button>

          <button
            type="button"
            className="pms-primary-btn"
            onClick={() => {
              if (activeRoomsList.length === 0) {
                toast("There's no present room around. Please add a room in Room Management first.", true);
                return;
              }
              const activeRoom = activeRoomsList[0];
              setNewReservation((prev: any) => ({
                ...prev,
                room_id: prev.room_id || activeRoom?.id || '',
                check_in: prev.check_in || '2026-10-20',
                check_out: prev.check_out || '2026-10-21',
                total_php: activeRoom?.rate_php || 3500,
              }));
              setShowAddReservationModal(true);
            }}
          >
            <i className="fas fa-plus" />
            <span>New booking</span>
          </button>
        </div>
      </div>

      {/* 2. STATUS FILTER PILL STRIP (Displayed for Stay Folios List view) */}
      {ledgerSubView === 'stay_folios' && (
        <div className={`pms-filter-strip ${!isLightMode ? 'dark' : ''}`}>
          {filterOptions.map((f) => {
            const isActive = reservationFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setReservationFilter(f.key)}
                className={`pms-filter-chip ${isActive ? 'active' : ''} ${!isLightMode ? 'dark' : ''}`}
              >
                <span>{f.label}</span>
                <span className="pms-filter-count">
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* VIEW 1: EXECUTIVE HOSPITALITY PMS ANALYTICS & REVENUE FORECASTING */}
      {ledgerSubView === 'debit_credit' && (() => {
        const totalDebits = trialBalance?.total_debits_php ?? ledgerEntriesList.reduce((acc, e) => acc + (Number(e.debit_php) || 0), 0);
        const totalCredits = trialBalance?.total_credits_php ?? ledgerEntriesList.reduce((acc, e) => acc + (Number(e.credit_php) || 0), 0);
        const netDifference = Math.abs(totalDebits - totalCredits);
        const isBalanced = trialBalance ? trialBalance.is_balanced : netDifference === 0;

        const totalResortUnits = Math.max(1, activeRoomsList.reduce((acc, r) => acc + (Number(r.units) || 1), 0));

        // Dynamic Year and Month Parsing
        const [selYearStr, selMonthStr] = analyticsYearMonth.split('-');
        const selYear = parseInt(selYearStr, 10);
        const selMonth = parseInt(selMonthStr, 10);
        const monthDate = new Date(selYear, selMonth - 1, 1);
        const monthNameFull = monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        const monthShort = monthDate.toLocaleString('en-US', { month: 'short' });
        const daysInMonth = new Date(selYear, selMonth, 0).getDate();

        const monthStartStr = `${selYearStr}-${selMonthStr}-01`;
        const monthEndStr = `${selYearStr}-${selMonthStr}-${String(daysInMonth).padStart(2, '0')}`;
        const availableUnitNights = totalResortUnits * daysInMonth;

        // Calculate dynamic real analytics from allBookings for selected month
        const nonCancelled = (Array.isArray(allBookings) ? allBookings : []).filter((b: any) => b.status !== 'cancelled');
        const selectedMonthStays = nonCancelled.filter((b: any) => {
          const cin = String(b.check_in || '').slice(0, 10);
          const cout = String(b.check_out || '').slice(0, 10);
          return (cin <= monthEndStr && cout >= monthStartStr);
        });

        // Exact stay revenue and nights prorated across this selected month
        let computedRevenue = 0;
        let computedNights = 0;

        selectedMonthStays.forEach((b: any) => {
          const cin = String(b.check_in || '').slice(0, 10);
          const cout = String(b.check_out || '').slice(0, 10);
          const totalStayNights = Math.max(1, Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000));
          const totalAmount = Number(b.total_php) || 0;
          const nightlyRate = totalAmount / totalStayNights;

          const startD = cin < monthStartStr ? monthStartStr : cin;
          const endD = cout > monthEndStr ? monthEndStr : cout;
          const overlapDays = Math.max(0, Math.round((new Date(endD).getTime() - new Date(startD).getTime()) / 86400000));

          computedNights += overlapDays;
          computedRevenue += (overlapDays * nightlyRate);
        });

        const roomRevenue = Math.round(computedRevenue);
        const roomNightsSold = computedNights;
        const occupiedUnitNights = Math.min(roomNightsSold, availableUnitNights);
        const occupancyPct = availableUnitNights > 0 ? Number(((occupiedUnitNights / availableUnitNights) * 100).toFixed(1)) : 0;
        const adr = roomNightsSold > 0 ? Math.round(roomRevenue / roomNightsSold) : 0;
        const revPar = availableUnitNights > 0 ? Math.round(roomRevenue / availableUnitNights) : 0;

        const arrivalsCount = selectedMonthStays.filter((b: any) => {
          const cin = String(b.check_in || '').slice(0, 10);
          return cin >= monthStartStr && cin <= monthEndStr;
        }).length;
        const avgLengthOfStay = arrivalsCount > 0 ? (roomNightsSold / arrivalsCount).toFixed(1) : (selectedMonthStays.length > 0 ? (roomNightsSold / selectedMonthStays.length).toFixed(1) : '0.0');
        const totalGuests = selectedMonthStays.reduce((sum: number, b: any) => sum + (Number(b.guests) || 0), 0);
        const avgPartySize = arrivalsCount > 0 ? (totalGuests / arrivalsCount).toFixed(1) : (selectedMonthStays.length > 0 ? (totalGuests / selectedMonthStays.length).toFixed(1) : '0.0');

        // Dynamic Lead Time
        let totalLeadDays = 0;
        let leadCount = 0;
        selectedMonthStays.forEach((b: any) => {
          if (b.check_in && b.created_at) {
            const cin = new Date(String(b.check_in).slice(0, 10)).getTime();
            const created = new Date(b.created_at).getTime();
            const diffDays = Math.max(0, Math.round((cin - created) / 86400000));
            totalLeadDays += diffDays;
            leadCount++;
          }
        });
        const avgLeadTime = leadCount > 0 ? (totalLeadDays / leadCount).toFixed(1) : '0.0';

        // Dynamic Cancellation Rate
        const monthBookings = (Array.isArray(allBookings) ? allBookings : []).filter((b: any) => {
          const cin = String(b.check_in || '').slice(0, 10);
          return cin >= monthStartStr && cin <= monthEndStr;
        });
        const cancelledCount = monthBookings.filter((b: any) => b.status === 'cancelled').length;
        const cancellationRate = monthBookings.length > 0
          ? ((cancelledCount / monthBookings.length) * 100).toFixed(1)
          : '0.0';

        // Dynamic Billed & Collected:
        const billedAmount = selectedMonthStays.reduce((sum: number, b: any) => sum + (Number(b.total_php) || 0), 0);
        const collectedAmount = selectedMonthStays
          .filter((b: any) => ['confirmed', 'checked_in', 'checked_out'].includes(String(b.payment_status || b.status || '').toLowerCase()))
          .reduce((sum: number, b: any) => sum + (Number(b.total_php) || 0), 0);
        const outstandingAmount = Math.max(0, billedAmount - collectedAmount);
        const collectionRate = billedAmount > 0
          ? ((collectedAmount / billedAmount) * 100).toFixed(1)
          : '0.0';

        // Daily real occupancy (1..daysInMonth)
        const dailyOccupancy = Array.from({ length: daysInMonth }, (_, i) => {
          const dayNum = i + 1;
          const dateStr = `${selYearStr}-${selMonthStr}-${String(dayNum).padStart(2, '0')}`;
          const realOccupied = selectedMonthStays.filter((b: any) => {
            const cin = String(b.check_in || '').slice(0, 10);
            const cout = String(b.check_out || '').slice(0, 10);
            return cin <= dateStr && cout > dateStr;
          }).length;
          const occupied = realOccupied;
          const pct = totalResortUnits > 0 ? Math.min(100, Math.round((occupied / totalResortUnits) * 100)) : 0;
          return { dayNum, dateStr, occupied, pct };
        });

        // Arrivals by weekday distribution (Mon - Sun) derived from real stays
        const dayCounts: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        selectedMonthStays.forEach((b: any) => {
          if (b.check_in) {
            const d = new Date(String(b.check_in).slice(0, 10) + 'T00:00:00');
            const dayName = dayNames[d.getDay()];
            if (dayName && dayCounts[dayName] !== undefined) {
              dayCounts[dayName]++;
            }
          }
        });

        const weekdayArrivals = [
          { day: 'Mon', count: dayCounts.Mon },
          { day: 'Tue', count: dayCounts.Tue },
          { day: 'Wed', count: dayCounts.Wed },
          { day: 'Thu', count: dayCounts.Thu },
          { day: 'Fri', count: dayCounts.Fri },
          { day: 'Sat', count: dayCounts.Sat },
          { day: 'Sun', count: dayCounts.Sun },
        ];
        const maxArrivals = Math.max(1, ...weekdayArrivals.map((w) => w.count));

        // ────────────────────────────────────────────────────────────
        // FORECAST ENGINE: Calculate literal next period revenue projections
        // ────────────────────────────────────────────────────────────
        const nextDate = new Date(selYear, selMonth, 1);
        const nextYearStr = String(nextDate.getFullYear());
        const nextMonthStr = String(nextDate.getMonth() + 1).padStart(2, '0');
        const nextDaysInMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        const nextMonthStartStr = `${nextYearStr}-${nextMonthStr}-01`;
        const nextMonthEndStr = `${nextYearStr}-${nextMonthStr}-${String(nextDaysInMonth).padStart(2, '0')}`;
        const nextMonthName = nextDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

        const nextMonthStays = nonCancelled.filter((b: any) => {
          const cin = String(b.check_in || '').slice(0, 10);
          const cout = String(b.check_out || '').slice(0, 10);
          return (cin <= nextMonthEndStr && cout >= nextMonthStartStr);
        });

        let nextMonthBookedRev = 0;
        let nextMonthBookedNights = 0;
        nextMonthStays.forEach((b: any) => {
          const cin = String(b.check_in || '').slice(0, 10);
          const cout = String(b.check_out || '').slice(0, 10);
          const totalStayNights = Math.max(1, Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000));
          const totalAmount = Number(b.total_php) || 0;
          const nightlyRate = totalAmount / totalStayNights;

          const startD = cin < nextMonthStartStr ? nextMonthStartStr : cin;
          const endD = cout > nextMonthEndStr ? nextMonthEndStr : cout;
          const overlapDays = Math.max(0, Math.round((new Date(endD).getTime() - new Date(startD).getTime()) / 86400000));

          nextMonthBookedNights += overlapDays;
          nextMonthBookedRev += (overlapDays * nightlyRate);
        });

        const nextMonthCapacity = totalResortUnits * nextDaysInMonth;
        const nextMonthRemainingCapacity = Math.max(0, nextMonthCapacity - nextMonthBookedNights);
        
        const catalogAvgRate = Math.round(activeRoomsList.reduce((acc, r) => acc + (Number(r.rate_php) || 3500), 0) / (activeRoomsList.length || 1));
        const baselineADR = adr > 0 ? adr : catalogAvgRate;

        // 3-Tier Forecast
        const forecastConservative = Math.round(nextMonthBookedRev + (nextMonthRemainingCapacity * 0.25 * baselineADR));
        const forecastExpected = Math.round(nextMonthBookedRev + (nextMonthRemainingCapacity * 0.50 * baselineADR));
        const forecastOptimistic = Math.round(nextMonthBookedRev + (nextMonthRemainingCapacity * 0.80 * baselineADR));

        // Current Month Run-Rate & Month-End Forecast:
        const now = new Date();
        const isCurrentMonthActive = (analyticsYearMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
        const currentDay = isCurrentMonthActive ? now.getDate() : daysInMonth;
        const daysLeftInMonth = Math.max(0, daysInMonth - currentDay);
        const remainingCapacityCurrentMonth = daysLeftInMonth * totalResortUnits;
        const currentMonthEndForecast = Math.round(roomRevenue + (remainingCapacityCurrentMonth * 0.40 * baselineADR));

        const renderBadge = (val: number, label: string) => {
          if (!val || val === 0) {
            return (
              <span style={{ fontSize: '.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: isLightMode ? '#F1F5F9' : 'rgba(148, 163, 184, 0.15)', color: themeMuted, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                ● Live
              </span>
            );
          }
          return (
            <span style={{ fontSize: '.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 9999, background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              ▲ {label}
            </span>
          );
        };

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* MONTH SELECTOR & COMPARISON HEADER ROW */}
            <div className="pms-analytics-header">
              <div className="pms-analytics-month-nav">
                <button
                  type="button"
                  className="pms-month-btn"
                  onClick={handlePrevAnalyticsMonth}
                  title="Previous Month"
                >
                  <i className="fas fa-chevron-left" />
                </button>
                <button
                  type="button"
                  className="pms-month-btn"
                  onClick={handleThisAnalyticsMonth}
                  title="Jump to Current Month"
                >
                  This month
                </button>
                <button
                  type="button"
                  className="pms-month-btn"
                  onClick={handleNextAnalyticsMonth}
                  title="Next Month"
                >
                  <i className="fas fa-chevron-right" />
                </button>
                <span className="pms-analytics-month-title">{monthNameFull}</span>
              </div>

              <div className="pms-analytics-subtext">
                Live Resort Ledger &amp; PMS Metrics · Real-time Database Synchronization
              </div>
            </div>

            {/* 12 EXECUTIVE HOSPITALITY KPI METRIC CARDS */}
            <div className="pms-analytics-kpi-grid">
              {/* CARD 1: Room revenue */}
              <div className="pms-analytics-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '.84rem', fontWeight: 600, color: themeMuted }}>Room revenue</span>
                  {renderBadge(roomRevenue, 'Active')}
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em', margin: '6px 0 4px' }}>
                  {money(roomRevenue)}
                </div>
                <div style={{ fontSize: '.74rem', color: themeMuted, lineHeight: 1.4 }}>
                  Each stay's total spread evenly over its nights in this month
                </div>
              </div>

              {/* CARD 2: Occupancy */}
              <div className="pms-analytics-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '.84rem', fontWeight: 600, color: themeMuted }}>Occupancy</span>
                  {renderBadge(occupancyPct, `${occupancyPct}%`)}
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em', margin: '6px 0 4px' }}>
                  {occupancyPct}%
                </div>
                <div style={{ fontSize: '.74rem', color: themeMuted, lineHeight: 1.4 }}>
                  {occupiedUnitNights} occupied ÷ {availableUnitNights} available unit-nights ({totalResortUnits} units × {daysInMonth} days)
                </div>
              </div>

              {/* CARD 3: ADR */}
              <div className="pms-analytics-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '.84rem', fontWeight: 600, color: themeMuted }}>ADR</span>
                  {renderBadge(adr, 'Active')}
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em', margin: '6px 0 4px' }}>
                  {money(adr)}
                </div>
                <div style={{ fontSize: '.74rem', color: themeMuted, lineHeight: 1.4 }}>
                  Average daily rate · room revenue ÷ room-nights sold
                </div>
              </div>

              {/* CARD 4: RevPAR */}
              <div className="pms-analytics-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '.84rem', fontWeight: 600, color: themeMuted }}>RevPAR</span>
                  {renderBadge(revPar, 'Active')}
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em', margin: '6px 0 4px' }}>
                  {money(revPar)}
                </div>
                <div style={{ fontSize: '.74rem', color: themeMuted, lineHeight: 1.4 }}>
                  Revenue per available unit-night · revenue ÷ available unit-nights
                </div>
              </div>

              {/* CARD 5: Room-nights sold */}
              <div className="pms-analytics-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '.84rem', fontWeight: 600, color: themeMuted }}>Room-nights sold</span>
                  {renderBadge(roomNightsSold, `${roomNightsSold} sold`)}
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em', margin: '6px 0 4px' }}>
                  {roomNightsSold}
                </div>
                <div style={{ fontSize: '.74rem', color: themeMuted, lineHeight: 1.4 }}>
                  Nights of non-cancelled stays falling in this month
                </div>
              </div>

              {/* CARD 6: Arrivals */}
              <div className="pms-analytics-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '.84rem', fontWeight: 600, color: themeMuted }}>Arrivals</span>
                  {renderBadge(arrivalsCount, `${arrivalsCount} arrivals`)}
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em', margin: '6px 0 4px' }}>
                  {arrivalsCount}
                </div>
                <div style={{ fontSize: '.74rem', color: themeMuted, lineHeight: 1.4 }}>
                  Non-cancelled bookings checking in this month
                </div>
              </div>

              {/* CARD 7: Avg. length of stay */}
              <div className="pms-analytics-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '.84rem', fontWeight: 600, color: themeMuted }}>Avg. length of stay</span>
                  {renderBadge(Number(avgLengthOfStay), `${avgLengthOfStay} nights`)}
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em', margin: '6px 0 4px' }}>
                  {avgLengthOfStay} nights
                </div>
                <div style={{ fontSize: '.74rem', color: themeMuted, lineHeight: 1.4 }}>
                  Total nights ÷ arrivals
                </div>
              </div>

              {/* CARD 8: Avg. lead time */}
              <div className="pms-analytics-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '.84rem', fontWeight: 600, color: themeMuted }}>Avg. lead time</span>
                  {renderBadge(Number(avgLeadTime), `${avgLeadTime} days`)}
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em', margin: '6px 0 4px' }}>
                  {avgLeadTime} days
                </div>
                <div style={{ fontSize: '.74rem', color: themeMuted, lineHeight: 1.4 }}>
                  Days between booking and check-in
                </div>
              </div>

              {/* CARD 9: Avg. party size */}
              <div className="pms-analytics-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '.84rem', fontWeight: 600, color: themeMuted }}>Avg. party size</span>
                  {renderBadge(Number(avgPartySize), `${avgPartySize} guests`)}
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em', margin: '6px 0 4px' }}>
                  {avgPartySize} guests
                </div>
                <div style={{ fontSize: '.74rem', color: themeMuted, lineHeight: 1.4 }}>
                  Guests per arriving booking
                </div>
              </div>

              {/* CARD 10: Cancellation rate */}
              <div className="pms-analytics-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '.84rem', fontWeight: 600, color: themeMuted }}>Cancellation rate</span>
                  {cancelledCount > 0 ? (
                    <span style={{ fontSize: '.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 9999, background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      ▲ {cancellationRate}%
                    </span>
                  ) : (
                    <span style={{ fontSize: '.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: isLightMode ? '#F1F5F9' : 'rgba(148, 163, 184, 0.15)', color: themeMuted, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      ● 0.0%
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em', margin: '6px 0 4px' }}>
                  {cancellationRate}%
                </div>
                <div style={{ fontSize: '.74rem', color: themeMuted, lineHeight: 1.4 }}>
                  {cancelledCount} of {monthBookings.length} bookings for this month cancelled
                </div>
              </div>

              {/* CARD 11: Collection rate */}
              <div className="pms-analytics-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '.84rem', fontWeight: 600, color: themeMuted }}>Collection rate</span>
                  {billedAmount > 0 ? (
                    <span style={{ fontSize: '.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 9999, background: Number(collectionRate) >= 80 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', color: Number(collectionRate) >= 80 ? '#10B981' : '#EF4444', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      {collectionRate}%
                    </span>
                  ) : (
                    <span style={{ fontSize: '.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: isLightMode ? '#F1F5F9' : 'rgba(148, 163, 184, 0.15)', color: themeMuted, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      ● Live
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em', margin: '6px 0 4px' }}>
                  {collectionRate}%
                </div>
                <div style={{ fontSize: '.74rem', color: themeMuted, lineHeight: 1.4 }}>
                  ₱{collectedAmount.toLocaleString()} collected of ₱{billedAmount.toLocaleString()} billed for arrivals
                </div>
              </div>

              {/* CARD 12: Outstanding */}
              <div className="pms-analytics-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '.84rem', fontWeight: 600, color: themeMuted }}>Outstanding</span>
                  {outstandingAmount > 0 ? (
                    <span style={{ fontSize: '.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 9999, background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      Pending
                    </span>
                  ) : (
                    <span style={{ fontSize: '.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      Settled
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em', margin: '6px 0 4px' }}>
                  {money(outstandingAmount)}
                </div>
                <div style={{ fontSize: '.74rem', color: themeMuted, lineHeight: 1.4 }}>
                  Billed – collected for this month's arrivals
                </div>
              </div>
            </div>

            {/* 2 CHARTS: DAILY OCCUPANCY & ARRIVALS BY WEEKDAY */}
            <div className="pms-analytics-charts-grid">
              {/* CHART 1: Daily occupancy */}
              <div className="pms-chart-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: themeText }}>Daily occupancy</h4>
                    <span style={{ fontSize: '.76rem', color: themeMuted }}>Share of {totalResortUnits} units occupied each night</span>
                  </div>
                  <span style={{ fontSize: '.74rem', fontWeight: 700, color: '#4F46E5', background: isLightMode ? '#EEF2FF' : 'rgba(79, 70, 229, 0.2)', padding: '3px 10px', borderRadius: 8 }}>
                    avg {occupancyPct}%
                  </span>
                </div>

                {/* 31-day visual occupancy bar matrix */}
                <div style={{ height: 160, display: 'flex', alignItems: 'flex-end', gap: 3, marginTop: 24, paddingBottom: 22, borderBottom: `1px solid ${themeBorder}`, position: 'relative' }}>
                  {dailyOccupancy.map((d) => {
                    const hasOccupancy = d.occupied > 0;
                    const isPeak = d.occupied >= 4;
                    const barColor = isPeak ? '#D97706' : d.occupied >= 2 ? '#6366F1' : hasOccupancy ? '#0EA5E9' : (isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.06)');
                    const barHeightPct = hasOccupancy ? Math.max(10, Math.round((d.occupied / totalResortUnits) * 100)) : 3;

                    return (
                      <div
                        key={d.dayNum}
                        title={`${monthShort} ${d.dayNum}: ${d.occupied} of ${totalResortUnits} units occupied (${d.pct}%)`}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          height: '100%',
                          justifyContent: 'flex-end',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: `${barHeightPct}%`,
                            background: barColor,
                            borderRadius: '3px 3px 0 0',
                            transition: 'height 0.25s ease',
                          }}
                        />
                        <span style={{ position: 'absolute', bottom: 2, fontSize: '.62rem', color: themeMuted, fontWeight: 500, display: d.dayNum % 5 === 1 || d.dayNum === daysInMonth ? 'block' : 'none' }}>
                          {d.dayNum}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: '.72rem', color: themeMuted }}>
                  <span>{monthShort} 1</span>
                  <span>{monthShort} {Math.round(daysInMonth / 2)}</span>
                  <span>{monthShort} {daysInMonth}</span>
                </div>
              </div>

              {/* CHART 2: Arrivals by weekday */}
              <div className="pms-chart-card">
                <div style={{ marginBottom: 6 }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: themeText }}>Arrivals by weekday</h4>
                  <span style={{ fontSize: '.76rem', color: themeMuted }}>When guests check in</span>
                </div>

                {/* 7-weekday vertical bar chart */}
                <div style={{ height: 160, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 10, marginTop: 24, paddingBottom: 22, borderBottom: `1px solid ${themeBorder}` }}>
                  {weekdayArrivals.map((w) => {
                    const hasArrivals = w.count > 0;
                    const barHeightPct = hasArrivals ? Math.max(16, Math.round((w.count / maxArrivals) * 100)) : 3;
                    const barColor = hasArrivals ? '#059669' : (isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.06)');

                    return (
                      <div
                        key={w.day}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          height: '100%',
                          justifyContent: 'flex-end',
                          position: 'relative',
                        }}
                      >
                        {/* Number badge on top of bar */}
                        <span style={{ fontSize: '.78rem', fontWeight: 700, color: hasArrivals ? themeText : themeMuted, marginBottom: 4 }}>
                          {w.count}
                        </span>
                        <div
                          style={{
                            width: 22,
                            height: `${barHeightPct}%`,
                            background: barColor,
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.25s ease',
                          }}
                        />
                        <span style={{ position: 'absolute', bottom: -20, fontSize: '.74rem', color: themeMuted, fontWeight: 600 }}>
                          {w.day}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ textAlign: 'center', marginTop: 8, fontSize: '.72rem', color: themeMuted }}>
                  Total Arrivals: {arrivalsCount}
                </div>
              </div>
            </div>

            {/* EXECUTIVE REVENUE FORECAST & PREDICTIVE PACE ENGINE */}
            <div className="pms-forecast-section">
              <div className="pms-forecast-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.2rem', color: '#4F46E5' }}>
                      <i className="fas fa-chart-line" />
                    </span>
                    <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      Revenue Forecast &amp; Predictive Pace Model
                    </h3>
                    <span style={{ fontSize: '.72rem', fontWeight: 800, padding: '3px 10px', borderRadius: 9999, background: 'rgba(79, 70, 229, 0.12)', color: '#4F46E5' }}>
                      Pace Intelligence
                    </span>
                  </div>
                  <div style={{ fontSize: '.78rem', color: themeMuted, marginTop: 4 }}>
                    Automated on-the-books (OTB) pace, remaining capacity pickup velocity, and dynamic pricing yield projections.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '.7rem', color: themeMuted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                      Forecast Baseline ADR
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: themeText }}>
                      {money(baselineADR)} <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 500 }}>/ night</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pms-forecast-grid">
                {/* FORECAST CARD 1: Current Month-End Run Rate */}
                <div className="pms-forecast-card">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '.82rem', fontWeight: 700, color: themeMuted }}>Month-End Projection</span>
                        <div style={{ fontSize: '.72rem', color: themeMuted }}>{monthNameFull}</div>
                      </div>
                      <span style={{ fontSize: '.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 9999, background: 'rgba(14, 165, 233, 0.12)', color: '#0EA5E9' }}>
                        {isCurrentMonthActive ? `${daysLeftInMonth}d remaining` : 'Full Month'}
                      </span>
                    </div>

                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: themeText, margin: '12px 0 4px', letterSpacing: '-0.02em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {money(isCurrentMonthActive ? currentMonthEndForecast : roomRevenue)}
                    </div>

                    <div style={{ fontSize: '.75rem', color: themeMuted, lineHeight: 1.4 }}>
                      {isCurrentMonthActive
                        ? `Realized ${money(roomRevenue)} + projected pickup of ${money(currentMonthEndForecast - roomRevenue)} across remaining nights.`
                        : `Finalized reconciled room revenue across all ${roomNightsSold} unit-nights sold.`}
                    </div>
                  </div>

                  <div className="pms-forecast-scenario-track">
                    <div className="pms-forecast-scenario-row">
                      <span style={{ color: themeMuted }}>Realized Bookings (OTB):</span>
                      <strong style={{ color: themeText }}>{money(roomRevenue)}</strong>
                    </div>
                    <div className="pms-forecast-scenario-row">
                      <span style={{ color: themeMuted }}>Remaining Unsold Nights:</span>
                      <strong style={{ color: themeText }}>{isCurrentMonthActive ? remainingCapacityCurrentMonth : 0} units</strong>
                    </div>
                    <div className="pms-forecast-scenario-row">
                      <span style={{ color: themeMuted }}>Estimated Month-End RevPAR:</span>
                      <strong style={{ color: '#0EA5E9' }}>{money(Math.round((isCurrentMonthActive ? currentMonthEndForecast : roomRevenue) / Math.max(1, availableUnitNights)))}</strong>
                    </div>
                  </div>
                </div>

                {/* FORECAST CARD 2: Next Month Forecast (Scenarios) */}
                <div className="pms-forecast-card" style={{ border: '1px solid rgba(79, 70, 229, 0.25)', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: -10, right: 16, background: '#4F46E5', color: '#fff', fontSize: '.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Next Month Pace
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '.82rem', fontWeight: 700, color: '#4F46E5' }}>Expected Target Revenue</span>
                        <div style={{ fontSize: '.72rem', color: themeMuted }}>{nextMonthName} (50% Pickup)</div>
                      </div>
                    </div>

                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: themeText, margin: '12px 0 4px', letterSpacing: '-0.02em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {money(forecastExpected)}
                    </div>

                    <div style={{ fontSize: '.75rem', color: themeMuted, lineHeight: 1.4 }}>
                      Based on {nextMonthBookedNights} on-the-books nights ({money(nextMonthBookedRev)}) plus 50% absorption of {nextMonthRemainingCapacity} available unit-nights.
                    </div>
                  </div>

                  <div className="pms-forecast-scenario-track">
                    <div className="pms-forecast-scenario-row">
                      <span style={{ color: themeMuted }}>Conservative (25% Pickup):</span>
                      <strong style={{ color: '#D97706' }}>{money(forecastConservative)}</strong>
                    </div>
                    <div className="pms-forecast-scenario-row">
                      <span style={{ color: themeMuted }}>Expected Pace (50% Pickup):</span>
                      <strong style={{ color: '#4F46E5' }}>{money(forecastExpected)}</strong>
                    </div>
                    <div className="pms-forecast-scenario-row">
                      <span style={{ color: themeMuted }}>Optimistic Surge (80% Pickup):</span>
                      <strong style={{ color: '#059669' }}>{money(forecastOptimistic)}</strong>
                    </div>
                  </div>
                </div>

                {/* FORECAST CARD 3: Pace & Revenue Management Insights */}
                <div className="pms-forecast-card">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '.82rem', fontWeight: 700, color: themeMuted }}>Yield Management Strategy</span>
                        <div style={{ fontSize: '.72rem', color: themeMuted }}>Algorithmic Pricing Advisory</div>
                      </div>
                      <span style={{ fontSize: '.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 9999, background: occupancyPct >= 50 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(217, 119, 6, 0.12)', color: occupancyPct >= 50 ? '#10B981' : '#D97706' }}>
                        {occupancyPct >= 50 ? 'High Demand' : 'Value Push'}
                      </span>
                    </div>

                    <div style={{ margin: '12px 0 8px' }}>
                      <div style={{ fontSize: '.85rem', fontWeight: 700, color: themeText, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <i className={occupancyPct >= 50 ? "fas fa-arrow-trend-up text-emerald-500" : "fas fa-bolt text-amber-500"} />
                        {occupancyPct >= 50 ? 'Increase weekend rates +15%' : 'Activate mid-week package discounts'}
                      </div>
                      <div style={{ fontSize: '.75rem', color: themeMuted, marginTop: 4, lineHeight: 1.45 }}>
                        {occupancyPct >= 50
                          ? `High booking velocity detected (${occupancyPct}% occupancy). Maximize yield by raising rates on peak dates.`
                          : `Inventory utilization is at ${occupancyPct}%. Recommend flash promotions or cottage bundle incentives to accelerate pickup.`}
                      </div>
                    </div>
                  </div>

                  <div className="pms-forecast-scenario-track">
                    <div className="pms-forecast-scenario-row">
                      <span style={{ color: themeMuted }}>On-the-Books (OTB) Revenue:</span>
                      <strong style={{ color: themeText }}>{money(nextMonthBookedRev)}</strong>
                    </div>
                    <div className="pms-forecast-scenario-row">
                      <span style={{ color: themeMuted }}>Unsold Next Month Nights:</span>
                      <strong style={{ color: themeText }}>{nextMonthRemainingCapacity} unit-nights</strong>
                    </div>
                    <div className="pms-forecast-scenario-row">
                      <span style={{ color: themeMuted }}>Target Next Month RevPAR:</span>
                      <strong style={{ color: '#059669' }}>{money(Math.round(forecastExpected / Math.max(1, nextMonthCapacity)))}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* EXPANDABLE ACCORDION: GENERAL LEDGER DEBIT & CREDIT JOURNAL */}
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  padding: '16px 20px',
                  background: isLightMode ? '#F8FAFC' : 'rgba(15,23,42,0.6)',
                  border: `1px solid ${themeBorder}`,
                  borderRadius: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  const el = document.getElementById('pms-dr-cr-ledger-table');
                  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
                }}
              >
                <div>
                  <b style={{ fontSize: '.88rem', color: themeText, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fas fa-book-journal-whills" style={{ color: '#0EA5E9' }} />
                    Double-Entry Debit &amp; Credit General Ledger (Chart of Accounts)
                  </b>
                  <small style={{ color: themeMuted, fontSize: '.72rem', display: 'block', marginTop: 2 }}>
                    Trial balance: {isBalanced ? 'Balanced (0.00)' : `Imbalance: ${money(netDifference)}`} • {ledgerEntriesList.length} journal transactions recorded
                  </small>
                </div>
                <button
                  type="button"
                  style={{ background: 'transparent', border: `1px solid ${themeBorder}`, borderRadius: 8, padding: '4px 10px', fontSize: '.74rem', fontWeight: 700, color: themeText, cursor: 'pointer' }}
                >
                  Toggle Ledger Table ▾
                </button>
              </div>

              <div id="pms-dr-cr-ledger-table" style={{ display: 'none', marginTop: 12 }}>
                {/* 4 Financial KPI Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 16 }}>
                  <div style={{ padding: '14px 16px', background: isLightMode ? '#ECFDF5' : 'rgba(16,185,129,0.1)', borderRadius: 12, border: `1px solid ${isLightMode ? '#A7F3D0' : 'rgba(16,185,129,0.2)'}` }}>
                    <small style={{ color: isLightMode ? '#047857' : '#34D399', textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800 }}>Total Debits (DR)</small>
                    <b style={{ display: 'block', fontSize: '1.4rem', color: isLightMode ? '#065F46' : '#10B981', marginTop: 2 }}>{money(totalDebits)}</b>
                  </div>
                  <div style={{ padding: '14px 16px', background: isLightMode ? '#EFF6FF' : 'rgba(59,130,246,0.1)', borderRadius: 12, border: `1px solid ${isLightMode ? '#BFDBFE' : 'rgba(59,130,246,0.2)'}` }}>
                    <small style={{ color: isLightMode ? '#1D4ED8' : '#60A5FA', textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800 }}>Total Credits (CR)</small>
                    <b style={{ display: 'block', fontSize: '1.4rem', color: isLightMode ? '#1E40AF' : '#3B82F6', marginTop: 2 }}>{money(totalCredits)}</b>
                  </div>
                  <div style={{ padding: '14px 16px', background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.04)', borderRadius: 12, border: `1px solid ${themeBorder}` }}>
                    <small style={{ color: themeMuted, textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800 }}>Net Balance</small>
                    <b style={{ display: 'block', fontSize: '1.4rem', color: themeText, marginTop: 2 }}>{money(totalDebits - totalCredits)}</b>
                  </div>
                  <div style={{ padding: '14px 16px', background: isBalanced ? (isLightMode ? '#F0FDF4' : 'rgba(34,197,94,0.1)') : (isLightMode ? '#FFFBEB' : 'rgba(245,158,11,0.1)'), borderRadius: 12, border: `1px solid ${isBalanced ? (isLightMode ? '#BBF7D0' : 'rgba(34,197,94,0.25)') : (isLightMode ? '#FDE68A' : 'rgba(245,158,11,0.25)')}` }}>
                    <small style={{ color: isBalanced ? '#15803D' : '#B45309', textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800 }}>Trial Balance</small>
                    <b style={{ display: 'block', fontSize: '1.25rem', color: isBalanced ? '#166534' : '#92400E', marginTop: 2 }}>
                      {isBalanced ? '✓ Balanced (0.00)' : `Imbalance: ${money(netDifference)}`}
                    </b>
                  </div>
                </div>

                {/* Debit & Credit Ledger Table */}
                <div className="table-wrap" style={{ background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.85)', border: `1px solid ${themeBorder}`, borderRadius: 12, overflowX: 'auto' }}>
                  <table className="table" style={{ color: themeText, width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)', textAlign: 'left' }}>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '10px 12px' }}>Entry #</th>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '10px 12px' }}>Date</th>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '10px 12px' }}>Account</th>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '10px 12px' }}>Particulars</th>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '10px 12px' }}>Category</th>
                        <th style={{ color: isLightMode ? '#047857' : '#34D399', padding: '10px 12px', textAlign: 'right' }}>Debit (₱)</th>
                        <th style={{ color: isLightMode ? '#1D4ED8' : '#60A5FA', padding: '10px 12px', textAlign: 'right' }}>Credit (₱)</th>
                        <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '10px 12px', textAlign: 'right' }}>Balance (₱)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerEntriesList.slice(0, 50).map((e: any) => (
                        <tr key={e.id} style={{ borderBottom: `1px solid ${themeBorder}` }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '.8rem', color: '#0EA5E9' }}>{e.entry_number}</td>
                          <td style={{ padding: '10px 12px', fontSize: '.78rem', color: themeMuted }}>{fmtDate(e.posted_at)}</td>
                          <td style={{ padding: '10px 12px', fontSize: '.82rem' }}><b>{e.account_code}</b> {e.account_name}</td>
                          <td style={{ padding: '10px 12px', fontSize: '.82rem' }}>{e.particulars}</td>
                          <td style={{ padding: '10px 12px', fontSize: '.74rem', textTransform: 'uppercase' }}>{e.category}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#10B981' }}>{e.debit_php > 0 ? money(e.debit_php) : '—'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#3B82F6' }}>{e.credit_php > 0 ? money(e.credit_php) : '—'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{money(e.running_balance_php)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* VIEW 2: GUEST STAY FOLIOS & RESERVATIONS */}
      {ledgerSubView === 'stay_folios' && (
        <div>
          {/* 4 KPI Summary Cards for Stays (CLICKABLE & INTERACTIVE FILTER TRIGGERS) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
            {/* CARD 1: TOTAL RESERVATIONS */}
            <div
              className="kpi-card-clickable"
              onClick={() => setReservationFilter('all')}
              style={{
                padding: '18px 20px',
                background: reservationFilter === 'all'
                  ? (isLightMode ? '#EFF6FF' : 'rgba(14,165,233,0.14)')
                  : (isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.04)'),
                borderRadius: 20,
                border: `1.5px solid ${reservationFilter === 'all' ? '#0EA5E9' : themeBorder}`,
                boxShadow: reservationFilter === 'all' ? '0 0 0 3px rgba(14,165,233,0.2)' : 'none',
              }}
              title="Click to view all reservations"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <small style={{ color: themeMuted, textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Total Reservations</small>
                {reservationFilter === 'all' && (
                  <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#0EA5E9', background: 'rgba(14,165,233,0.15)', padding: '2px 8px', borderRadius: 9999 }}>
                    Active
                  </span>
                )}
              </div>
              <b style={{ display: 'block', fontSize: '1.65rem', color: themeText, marginTop: 4 }}>{allBookings.length} stays</b>
              <span style={{ fontSize: '.74rem', color: '#0EA5E9', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <i className="fas fa-layer-group" style={{ fontSize: '.7rem' }} /> All active & past folios
              </span>
            </div>

            {/* CARD 2: IN-HOUSE / CHECKED IN */}
            <div
              className="kpi-card-clickable"
              onClick={() => setReservationFilter('checked_in')}
              style={{
                padding: '18px 20px',
                background: reservationFilter === 'checked_in'
                  ? (isLightMode ? '#D1FAE5' : 'rgba(16,185,129,0.2)')
                  : (isLightMode ? '#ECFDF5' : 'rgba(16,185,129,0.08)'),
                borderRadius: 20,
                border: `1.5px solid ${reservationFilter === 'checked_in' ? '#10B981' : (isLightMode ? '#A7F3D0' : 'rgba(16,185,129,0.25)')}`,
                boxShadow: reservationFilter === 'checked_in' ? '0 0 0 3px rgba(16,185,129,0.2)' : 'none',
              }}
              title="Click to filter In-House / Checked In guests"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <small style={{ color: isLightMode ? '#047857' : '#34D399', textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>In-House / Checked In</small>
                {reservationFilter === 'checked_in' && (
                  <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#10B981', background: 'rgba(16,185,129,0.2)', padding: '2px 8px', borderRadius: 9999 }}>
                    Active
                  </span>
                )}
              </div>
              <b style={{ display: 'block', fontSize: '1.65rem', color: isLightMode ? '#065F46' : '#10B981', marginTop: 4 }}>
                {allBookings.filter((b) => b.status === 'checked_in').length} guests
              </b>
              <span style={{ fontSize: '.74rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <i className="fas fa-hotel" style={{ fontSize: '.7rem' }} /> Currently staying in resort
              </span>
            </div>

            {/* CARD 3: UPCOMING CONFIRMED */}
            <div
              className="kpi-card-clickable"
              onClick={() => setReservationFilter('confirmed')}
              style={{
                padding: '18px 20px',
                background: reservationFilter === 'confirmed'
                  ? (isLightMode ? '#DBEAFE' : 'rgba(59,130,246,0.2)')
                  : (isLightMode ? '#EFF6FF' : 'rgba(59,130,246,0.08)'),
                borderRadius: 20,
                border: `1.5px solid ${reservationFilter === 'confirmed' ? '#3B82F6' : (isLightMode ? '#BFDBFE' : 'rgba(59,130,246,0.25)')}`,
                boxShadow: reservationFilter === 'confirmed' ? '0 0 0 3px rgba(59,130,246,0.2)' : 'none',
              }}
              title="Click to filter upcoming confirmed bookings"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <small style={{ color: isLightMode ? '#1D4ED8' : '#60A5FA', textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Upcoming Confirmed</small>
                {reservationFilter === 'confirmed' && (
                  <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#3B82F6', background: 'rgba(59,130,246,0.2)', padding: '2px 8px', borderRadius: 9999 }}>
                    Active
                  </span>
                )}
              </div>
              <b style={{ display: 'block', fontSize: '1.65rem', color: isLightMode ? '#1E40AF' : '#3B82F6', marginTop: 4 }}>
                {allBookings.filter((b) => b.status === 'confirmed').length} bookings
              </b>
              <span style={{ fontSize: '.74rem', color: '#3B82F6', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <i className="fas fa-calendar-check" style={{ fontSize: '.7rem' }} /> Awaiting arrival date
              </span>
            </div>

            {/* CARD 4: GROSS STAY VALUE */}
            <div
              className="kpi-card-clickable"
              onClick={() => setReservationFilter(reservationFilter === 'pending' ? 'all' : 'pending')}
              style={{
                padding: '18px 20px',
                background: reservationFilter === 'pending'
                  ? (isLightMode ? '#FEF3C7' : 'rgba(245,158,11,0.2)')
                  : (isLightMode ? '#FFFBEB' : 'rgba(245,158,11,0.08)'),
                borderRadius: 20,
                border: `1.5px solid ${reservationFilter === 'pending' ? '#F59E0B' : (isLightMode ? '#FDE68A' : 'rgba(245,158,11,0.25)')}`,
                boxShadow: reservationFilter === 'pending' ? '0 0 0 3px rgba(245,158,11,0.2)' : 'none',
              }}
              title="Click to filter pending stays or inspect revenue"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <small style={{ color: isLightMode ? '#B45309' : '#FBBF24', textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Gross Stay Value</small>
                {reservationFilter === 'pending' && (
                  <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#F59E0B', background: 'rgba(245,158,11,0.2)', padding: '2px 8px', borderRadius: 9999 }}>
                    Pending Filter
                  </span>
                )}
              </div>
              <b style={{ display: 'block', fontSize: '1.65rem', color: isLightMode ? '#92400E' : '#F59E0B', marginTop: 4 }}>
                {money(allBookings.filter((b) => b.status !== 'cancelled').reduce((acc, b) => acc + (b.total_php || 0), 0))}
              </b>
              <span style={{ fontSize: '.74rem', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <i className="fas fa-sack-dollar" style={{ fontSize: '.7rem' }} /> Total booking revenue
              </span>
            </div>
          </div>

          {/* Search Bar & Clean Filter Dropdown */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: '.8rem', fontWeight: 800, color: themeText, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-filter" style={{ color: '#0EA5E9' }} /> Filter Status:
              </label>
              <select
                value={reservationFilter}
                onChange={(e) => setReservationFilter(e.target.value)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 9999,
                  border: `1.5px solid ${themeBorder}`,
                  background: isLightMode ? '#FFFFFF' : '#1E293B',
                  color: themeText,
                  fontSize: '.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: isLightMode ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  outline: 'none',
                }}
              >
                <option value="all">All Folios ({allBookings.length})</option>
                <option value="confirmed">Upcoming Confirmed ({statusCounts.confirmed})</option>
                <option value="checked_in">In-House / Checked In ({statusCounts.checkedIn})</option>
                <option value="checked_out">Checked Out ({statusCounts.checkedOut})</option>
                <option value="pending">Pending Approval ({statusCounts.pending})</option>
                <option value="on_hold">On Hold / In Review ({statusCounts.onHold})</option>
                <option value="maintenance">Under Maintenance ({statusCounts.maintenance})</option>
                <option value="disputed">Disputed / Escalated ({statusCounts.disputed})</option>
                <option value="no_show">No Show ({statusCounts.noShow})</option>
                <option value="cancelled">Cancelled ({statusCounts.cancelled})</option>
              </select>
              <select
                aria-label="Filter Offering Type"
                value={bookingTypeFilter}
                onChange={(e) => setBookingTypeFilter(e.target.value as 'all' | OfferingType)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 9999,
                  border: `1px solid ${themeBorder}`,
                  background: isLightMode ? '#FFFFFF' : '#0F172A',
                  color: themeText,
                  fontSize: '.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Types ({allBookings.length})</option>
                <option value="room">Rooms ({allBookings.filter((b: any) => resolveReservationOfferingType(b) === 'room').length})</option>
                <option value="villa">Villas ({allBookings.filter((b: any) => resolveReservationOfferingType(b) === 'villa').length})</option>
                <option value="suite">Suites ({allBookings.filter((b: any) => resolveReservationOfferingType(b) === 'suite').length})</option>
                <option value="cottage">Cottages ({allBookings.filter((b: any) => resolveReservationOfferingType(b) === 'cottage').length})</option>
                <option value="cabana">Cabanas ({allBookings.filter((b: any) => resolveReservationOfferingType(b) === 'cabana').length})</option>
                <option value="offer">Island Tours &amp; Offers ({allBookings.filter((b: any) => resolveReservationOfferingType(b) === 'offer').length})</option>
                <option value="event">Event Pavilions ({allBookings.filter((b: any) => resolveReservationOfferingType(b) === 'event').length})</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '.76rem', color: themeMuted, fontWeight: 700 }}>
                Showing {folioViewLimit === 'all' ? filteredBookings.length : Math.min(folioViewLimit, filteredBookings.length)} of {filteredBookings.length} bookings
              </span>

              <div style={{ position: 'relative', width: 240, maxWidth: '100%' }}>
                <input
                  className="search"
                  placeholder="Search guest, room, phone…"
                  value={reservationSearch}
                  onChange={(e) => setReservationSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    borderRadius: 14,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.6)',
                    color: themeText,
                    fontSize: '.82rem',
                  }}
                />
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                  <IconSearch size={14} />
                </span>
              </div>
            </div>
          </div>

          {/* Reservations Ledger Table */}
          {loadingReservations && allBookings.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: themeMuted }}>
              <p>Loading Guest Reservations Folios…</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)', borderRadius: 14, border: `1px dashed ${themeBorder}` }}>
              <p className="muted" style={{ margin: '0 0 8px', fontSize: '1rem' }}>No reservations match your search or filter.</p>
              <small style={{ color: themeMuted }}>Use the Booking Actions dropdown above to create a walk-in reservation.</small>
            </div>
          ) : (
            <div className="table-wrap" style={{ background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.85)', border: `1px solid ${themeBorder}`, borderRadius: 12 }}>
              <table className="table" style={{ color: themeText }}>
                <thead>
                  <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)' }}>
                    <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Guest Folio</th>
                    <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Room</th>
                    <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Stay Dates</th>
                    <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Party</th>
                    <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Total Amount</th>
                    <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Status</th>
                    <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Front Desk Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(folioViewLimit === 'all' ? filteredBookings : filteredBookings.slice(0, folioViewLimit)).map((b: any) => (
                    <tr key={b.id} style={{ borderBottom: `1px solid ${themeBorder}` }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 32, height: 32, borderRadius: '50%', background: isLightMode ? '#E2E8F0' : '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.8rem', fontWeight: 800 }}>
                            {(b.guest_name || b.profiles?.full_name || 'G').charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <b>{b.guest_name || b.profiles?.full_name || 'Guest User'}</b>
                            <span style={{ display: 'block', fontSize: '.72rem', color: '#0EA5E9', fontFamily: 'monospace', fontWeight: 600 }}>
                              {b.booking_code || ('RV-' + String(b.id || '').slice(0, 8).toUpperCase())}
                            </span>
                            <small style={{ color: themeMuted, display: 'block' }}>{b.phone || b.profiles?.phone || 'No phone recorded'}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {(() => {
                          const oType = resolveReservationOfferingType(b);
                          const badgeStyles: Record<string, { bg: string; color: string }> = {
                            room: { bg: '#E0F2FE', color: '#00517A' },
                            villa: { bg: '#EDE9FE', color: '#5B21B6' },
                            suite: { bg: '#FEF3C7', color: '#92400E' },
                            cottage: { bg: '#D1FAE5', color: '#065F46' },
                            cabana: { bg: '#CCFBF1', color: '#115E59' },
                            offer: { bg: '#FFEDD5', color: '#9A3412' },
                            event: { bg: '#F3E8FF', color: '#6B21A8' },
                          };
                          const currentBadge = badgeStyles[oType] || badgeStyles.room;
                          return (
                            <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 9999, fontSize: '.68rem', fontWeight: 700, marginBottom: 3, marginRight: 6, background: currentBadge.bg, color: currentBadge.color }}>
                              {getOfferingLabel(oType)}
                            </span>
                          );
                        })()}
                        <b>{b.rooms?.name || 'Assigned Room'}</b>
                        {b.notes && (b.notes.toLowerCase().includes('pool') || b.notes.toLowerCase().includes('swimming')) ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '.7rem', background: 'rgba(56,189,248,0.15)', color: '#0EA5E9', border: '1px solid rgba(56,189,248,0.35)', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>
                            <i className="fas fa-person-swimming" style={{ marginRight: 4 }} />Pool Pass
                          </span>
                        ) : (
                          <span style={{ display: 'block', marginTop: 2, fontSize: '.68rem', color: themeMuted }}>
                            Room Only
                          </span>
                        )}
                      </td>
                      <td>
                        <div>
                          <span>{fmtDate(b.check_in)} → {fmtDate(b.check_out)}</span>
                          <span style={{ marginLeft: 6, fontSize: '.72rem', background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 6, color: themeMuted }}>
                            {b.nights || 1} {b.nights === 1 ? 'night' : 'nights'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '.82rem' }}>{b.guests || 2} Guests</span>
                      </td>
                      <td>
                        <b>{money(b.total_php)}</b>
                        <small style={{ display: 'block', color: themeMuted, fontSize: '.72rem' }}>{b.payment_method || 'GCash'}</small>
                      </td>
                      <td>
                        <StatusPill
                          status={b.status}
                          paymentStatus={b.payment_status}
                          onClick={() => setTimelineBooking(b)}
                        />
                      </td>
                      <td>
                        <select
                          aria-label="Front Desk Actions"
                          value=""
                          onChange={(e) => {
                            const action = e.target.value;
                            if (!action) return;
                            if (action === 'edit') {
                              setEditingBooking({
                                ...b,
                                guest_name: b.guest_name || b.profiles?.full_name || 'Guest',
                                phone: b.phone || b.profiles?.phone || '',
                                room_id: b.room_id || activeRoomsList[0]?.id || '',
                                check_in: (b.check_in || '').slice(0, 10),
                                check_out: (b.check_out || '').slice(0, 10),
                                guests: b.guests || 2,
                                total_php: b.total_php || 3500,
                                status: b.status || 'confirmed',
                                payment_method: b.payment_method || 'GCash',
                                notes: b.notes || '',
                              });
                            } else if (action === 'receipt') {
                              setReceiptModalBooking(b);
                            } else if (action === 'timeline') {
                              setTimelineBooking(b);
                            } else if (action === 'checked_in') {
                              updateStatus(b.id, 'checked_in');
                            } else if (action === 'checked_out') {
                              updateStatus(b.id, 'checked_out');
                            } else if (action === 'confirmed') {
                              updateStatus(b.id, 'confirmed');
                            } else if (action === 'pending') {
                              updateStatus(b.id, 'pending');
                            } else if (action === 'on_hold') {
                              updateStatus(b.id, 'on_hold');
                            } else if (action === 'maintenance') {
                              updateStatus(b.id, 'maintenance');
                            } else if (action === 'no_show') {
                              updateStatus(b.id, 'no_show');
                            } else if (action === 'cancelled') {
                              updateStatus(b.id, 'cancelled');
                            } else if (action === 'refund_request') {
                              setRefundTarget(b);
                              setRefundMode('request');
                              setRefundAmount(b.downpayment_php || b.total_php || '');
                            } else if (action === 'refund_confirm') {
                              setRefundTarget(b);
                              setRefundMode('confirm');
                              setRefundAmount(b.downpayment_php || b.total_php || '');
                              setRefundMethod(b.payment_method || 'GCash');
                            } else if (action === 'remove') {
                              setReservationToRemove(b);
                            }
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 10,
                            border: `1.5px solid ${isLightMode ? '#CBD5E1' : '#334155'}`,
                            background: isLightMode ? '#F8FAFC' : '#1E293B',
                            color: themeText,
                            fontSize: '.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            minWidth: 165,
                            outline: 'none',
                          }}
                        >
                          <option value="">⚡ Front Desk Actions ▾</option>
                          <option value="edit">✏️ Edit Reservation</option>
                          <option value="receipt">🧾 Receipt &amp; Folio</option>
                          <option value="timeline">🕒 Status Timeline</option>
                          <option value="checked_in">
                            🛎️ Check-in{b.status === 'checked_in' ? ' (Active)' : ''}
                          </option>
                          <option value="checked_out">
                            🚪 Check-out{b.status === 'checked_out' ? ' (Active)' : ''}
                          </option>
                          <option value="confirmed">
                            ✅ Confirm{b.status === 'confirmed' ? ' (Active)' : ''}
                          </option>
                          <option value="pending">
                            ⏳ Mark Pending{b.status === 'pending' ? ' (Active)' : ''}
                          </option>
                          <option value="on_hold">
                            ⏸️ Put On Hold{b.status === 'on_hold' ? ' (Active)' : ''}
                          </option>
                          <option value="maintenance">
                            🔧 Mark Under Maintenance{b.status === 'maintenance' ? ' (Active)' : ''}
                          </option>
                          <option value="no_show">
                            🚫 Mark No-Show{b.status === 'no_show' ? ' (Active)' : ''}
                          </option>
                          <option value="refund_request">💰 Request Refund</option>
                          <option value="refund_confirm">
                            ✔️ Confirm Refund{b.payment_status === 'refund_pending' ? ' (Pending)' : ''}
                          </option>
                          <option value="cancelled">
                            ❌ Cancel{b.status === 'cancelled' ? ' (Cancelled)' : ''}
                          </option>
                          <option value="remove">🗑️ Remove Permanently</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: VISUAL AVAILABILITY & LOCK CALENDAR */}
      {ledgerSubView === 'availability' && (
        <div>
          <AvailabilityCalendar
            rooms={activeRoomsList}
            bookings={allBookings}
            isLightMode={isLightMode}
            showMetrics={true}
            showNewBookingInTopBar={true} allowSameDay={true}
            onClose={() => setLedgerSubView('stay_folios')}
            onViewList={() => setLedgerSubView('stay_folios')}
            onNewBooking={() => {
              if (activeRoomsList.length === 0) {
                toast("There's no present room around. Please add a room in Room Management first.", true);
                return;
              }
              const activeRoom = activeRoomsList[0];
              setNewReservation((prev: any) => ({
                ...prev,
                room_id: prev.room_id || activeRoom?.id || '',
                check_in: prev.check_in || '2026-10-20',
                check_out: prev.check_out || '2026-10-21',
                total_php: activeRoom?.rate_php || 3500,
              }));
              setShowAddReservationModal(true);
            }}
            onSelectBooking={(stay) => {
              const foundBooking = allBookings.find((b: any) => b.id === stay.id);
              if (foundBooking) {
                toast(`Selected reservation for ${stay.guestName} (${stay.unitName})`);
              }
            }}
            onSelectDates={(cin, cout, targetRoomId, unitInfo) => {
              if (activeRoomsList.length === 0) {
                toast("There's no present room around. Please add a room in Room Management first.", true);
                return;
              }
              const activeRoom = (targetRoomId ? activeRoomsList.find((r) => r.id === targetRoomId) : null) || activeRoomsList.find((r) => r.id === newReservation.room_id) || activeRoomsList[0];
              const nights = Math.max(1, Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000));
              const unitTag = unitInfo && unitInfo.unitNumber ? `[Unit ${unitInfo.unitNumber}]` : '';
              const cleanNotes = (newReservation.notes || '').replace(/\[Unit\s*\d+\]\s*/g, '').trim();
              const nextNotes = unitTag ? `${unitTag} ${cleanNotes}`.trim() : cleanNotes;

              setNewReservation((prev: any) => ({
                ...prev,
                room_id: targetRoomId || prev.room_id || activeRoom?.id || '',
                check_in: cin,
                check_out: cout,
                total_php: (activeRoom?.rate_php || 3500) * nights,
                notes: nextNotes || prev.notes,
              }));
              setShowAddReservationModal(true);
            }}
          />
        </div>
      )}

      {/* EDIT BOOKING MODAL (FROM LIST VIEW) */}
      {editingBooking && (
        <div
          onClick={() => setEditingBooking(null)}
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
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              const missing: string[] = [];
              if (!String(editingBooking.guest_name || '').trim()) missing.push('Guest Full Name');
              if (!String(editingBooking.phone || '').trim()) missing.push('Contact Phone');
              if (!editingBooking.check_in || !editingBooking.check_out) missing.push('Check-in & Check-out Dates');
              if (missing.length > 0) {
                toast(`⚠️ Please fill in required information: ${missing.join(', ')}`, true);
                return;
              }
              try {
                setSavingBookingEdit(true);
                await api.updateReservation(editingBooking.id, {
                  guest_name: editingBooking.guest_name.trim(),
                  phone: editingBooking.phone.trim(),
                  room_id: editingBooking.room_id,
                  check_in: editingBooking.check_in,
                  check_out: editingBooking.check_out,
                  guests: Number(editingBooking.guests) || 2,
                  total_php: Number(editingBooking.total_php) || 3500,
                  status: editingBooking.status,
                  payment_method: editingBooking.payment_method,
                  notes: editingBooking.notes,
                });
                toast(`✦ Updated booking for ${editingBooking.guest_name}!`);
                setEditingBooking(null);
                refreshReservations();
              } catch (err: any) {
                toast(err.message || 'Could not update booking', true);
              } finally {
                setSavingBookingEdit(false);
              }
            }}
            style={{
              background: isLightMode ? '#FFFFFF' : '#0F172A',
              color: themeText,
              border: `1px solid ${themeBorder}`,
              borderRadius: 16,
              maxWidth: 520,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: '.72rem', fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  RESERVATION EDITOR
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.25rem', fontWeight: 800 }}>
                  Edit Booking Folio #{String(editingBooking.id).slice(0, 8)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: themeMuted }}
              >
                <i className="fas fa-xmark" />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '.76rem', fontWeight: 700, color: themeMuted }}>Guest Full Name</span>
                <input
                  required
                  value={editingBooking.guest_name || ''}
                  onChange={(e) => setEditingBooking({ ...editingBooking, guest_name: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '.76rem', fontWeight: 700, color: themeMuted }}>Contact Phone</span>
                <input
                  value={editingBooking.phone || ''}
                  onChange={(e) => setEditingBooking({ ...editingBooking, phone: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '.76rem', fontWeight: 700, color: themeMuted }}>Accommodation Room</span>
                <select
                  value={editingBooking.room_id || ''}
                  onChange={(e) => setEditingBooking({ ...editingBooking, room_id: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
                >
                  {roomsList.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({money(r.rate_php)}/night)
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '.76rem', fontWeight: 700, color: themeMuted }}>Reservation Status</span>
                <select
                  value={editingBooking.status || 'confirmed'}
                  onChange={(e) => setEditingBooking({ ...editingBooking, status: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText, fontWeight: 700 }}
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="checked_in">Checked In</option>
                  <option value="checked_out">Checked Out</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '.76rem', fontWeight: 700, color: themeMuted }}>Check-in Date</span>
                <input
                  type="date"
                  required
                  value={editingBooking.check_in || ''}
                  onChange={(e) => setEditingBooking({ ...editingBooking, check_in: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '.76rem', fontWeight: 700, color: themeMuted }}>Check-out Date</span>
                <input
                  type="date"
                  required
                  value={editingBooking.check_out || ''}
                  onChange={(e) => setEditingBooking({ ...editingBooking, check_out: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '.76rem', fontWeight: 700, color: themeMuted }}>Guests</span>
                <input
                  type="number"
                  min={1}
                  value={editingBooking.guests || 2}
                  onChange={(e) => setEditingBooking({ ...editingBooking, guests: Number(e.target.value) })}
                  style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '.76rem', fontWeight: 700, color: themeMuted }}>Payment Method</span>
                <select
                  value={editingBooking.payment_method || 'GCash'}
                  onChange={(e) => setEditingBooking({ ...editingBooking, payment_method: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
                >
                  <option value="GCash">GCash</option>
                  <option value="Cash">Cash</option>
                  <option value="Maya">Maya</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card">Card</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '.76rem', fontWeight: 700, color: themeMuted }}>Total Amount (₱)</span>
                <input
                  type="number"
                  min={0}
                  value={editingBooking.total_php || 0}
                  onChange={(e) => setEditingBooking({ ...editingBooking, total_php: Number(e.target.value) })}
                  style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: '#10B981', fontWeight: 800 }}
                />
              </label>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 18 }}>
              <span style={{ fontSize: '.76rem', fontWeight: 700, color: themeMuted }}>Special Notes & Unit Tag</span>
              <input
                value={editingBooking.notes || ''}
                onChange={(e) => setEditingBooking({ ...editingBooking, notes: e.target.value })}
                placeholder="e.g. [Unit 2] Pool Pass included"
                style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
              />
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                style={{ padding: '10px 16px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: 'transparent', color: themeText, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingBookingEdit}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#4F46E5', color: '#FFF', fontWeight: 700, cursor: 'pointer' }}
              >
                {savingBookingEdit ? 'Saving…' : '💾 Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
