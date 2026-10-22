import React, { useState, useEffect, useMemo } from 'react';
import { money, fmtDate, fmtTime } from '../../lib/format';
import { IconSearch } from '../../components/AdminIcons';
import StatusPill from '../../components/StatusPill';
import AvailabilityCalendar from '../../components/AvailabilityCalendar';
import { exportReservationsCSV } from '../../lib/ledgerUtils';
import { api } from '../../lib/api';

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
      return localStorage.getItem('jd_admin_res_filter') || 'all';
    } catch {
      return 'all';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_res_filter', reservationFilter);
    } catch {}
  }, [reservationFilter]);

  const [reservationSearch, setReservationSearch] = useState<string>(() => {
    try {
      return localStorage.getItem('jd_admin_res_search') || '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_res_search', reservationSearch);
    } catch {}
  }, [reservationSearch]);

  const [folioViewLimit, setFolioViewLimit] = useState<number | 'all'>(() => {
    try {
      const saved = localStorage.getItem('jd_admin_folio_limit');
      if (saved === 'all') return 'all';
      if (saved && !isNaN(Number(saved))) return Number(saved);
    } catch {}
    return 25;
  });
  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_folio_limit', String(folioViewLimit));
    } catch {}
  }, [folioViewLimit]);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [savingBookingEdit, setSavingBookingEdit] = useState<boolean>(false);

  const [ledgerAccountFilter, setLedgerAccountFilter] = useState<string>('');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState<string>('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | 'debit' | 'credit'>('all');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  const filteredBookings = allBookings.filter((b: any) => {
    if (reservationFilter !== 'all' && b.status !== reservationFilter) return false;
    if (reservationSearch.trim()) {
      const q = reservationSearch.toLowerCase();
      const guestName = (b.guest_name || b.profiles?.full_name || '').toLowerCase();
      const phone = (b.phone || b.profiles?.phone || '').toLowerCase();
      const room = (b.rooms?.name || '').toLowerCase();
      const id = (b.id || '').toLowerCase();
      if (!guestName.includes(q) && !phone.includes(q) && !room.includes(q) && !id.includes(q)) return false;
    }
    return true;
  });

  const statusCounts = useMemo(() => {
    const all = allBookings.length;
    const confirmed = allBookings.filter((b: any) => b.status === 'confirmed').length;
    const pending = allBookings.filter((b: any) => b.status === 'pending').length;
    const checkedIn = allBookings.filter((b: any) => b.status === 'checked_in').length;
    const checkedOut = allBookings.filter((b: any) => b.status === 'checked_out').length;
    const cancelled = allBookings.filter((b: any) => b.status === 'cancelled').length;
    return { all, confirmed, pending, checkedIn, checkedOut, cancelled };
  }, [allBookings]);

  const filterOptions = [
    { key: 'all', label: 'All', count: statusCounts.all },
    { key: 'confirmed', label: 'Confirmed', count: statusCounts.confirmed },
    { key: 'pending', label: 'Pending', count: statusCounts.pending },
    { key: 'checked_in', label: 'Checked in', count: statusCounts.checkedIn },
    { key: 'checked_out', label: 'Checked out', count: statusCounts.checkedOut },
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
            className={`pms-view-tab ${ledgerSubView === 'availability' ? 'active' : ''} ${!isLightMode ? 'dark' : ''}`}
            onClick={() => setLedgerSubView('availability')}
          >
            <i className="far fa-calendar-alt" />
            <span>Calendar</span>
          </button>
          <button
            type="button"
            className={`pms-view-tab ${ledgerSubView === 'stay_folios' ? 'active' : ''} ${!isLightMode ? 'dark' : ''}`}
            onClick={() => setLedgerSubView('stay_folios')}
          >
            <i className="fas fa-list-ul" />
            <span>List</span>
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

      {/* VIEW 1: EXECUTIVE HOSPITALITY PMS ANALYTICS (MATCHING SCREENSHOT) */}
      {ledgerSubView === 'debit_credit' && (() => {
        const totalDebits = trialBalance?.total_debits_php ?? ledgerEntriesList.reduce((acc, e) => acc + (Number(e.debit_php) || 0), 0);
        const totalCredits = trialBalance?.total_credits_php ?? ledgerEntriesList.reduce((acc, e) => acc + (Number(e.credit_php) || 0), 0);
        const netDifference = Math.abs(totalDebits - totalCredits);
        const isBalanced = trialBalance ? trialBalance.is_balanced : netDifference === 0;

        const totalResortUnits = Math.max(1, activeRoomsList.reduce((acc, r) => acc + (Number(r.units) || 1), 0));
        const daysInMonth = 31;
        const availableUnitNights = totalResortUnits * daysInMonth;

        // Calculate dynamic real analytics from allBookings
        const nonCancelled = allBookings.filter((b: any) => b.status !== 'cancelled');
        const octoberStays = nonCancelled.filter((b: any) => {
          const cin = String(b.check_in || '').slice(0, 10);
          const cout = String(b.check_out || '').slice(0, 10);
          return (cin >= '2026-10-01' && cin <= '2026-10-31') || (cout >= '2026-10-01' && cout <= '2026-10-31') || (cin < '2026-10-01' && cout > '2026-10-31');
        });

        const computedRevenue = octoberStays.reduce((sum: number, b: any) => sum + (Number(b.total_php) || 0), 0);
        const roomRevenue = computedRevenue;

        let computedNights = 0;
        octoberStays.forEach((b: any) => {
          const cin = String(b.check_in || '').slice(0, 10);
          const cout = String(b.check_out || '').slice(0, 10);
          const startD = Math.max(1, cin.startsWith('2026-10') ? parseInt(cin.slice(8, 10), 10) : 1);
          const endD = Math.min(31, cout.startsWith('2026-10') ? parseInt(cout.slice(8, 10), 10) : 31);
          computedNights += Math.max(1, endD - startD);
        });
        const roomNightsSold = computedNights;
        const occupiedUnitNights = Math.min(roomNightsSold, availableUnitNights);
        const occupancyPct = availableUnitNights > 0 ? Number(((occupiedUnitNights / availableUnitNights) * 100).toFixed(1)) : 0;
        const adr = roomNightsSold > 0 ? Math.round(roomRevenue / roomNightsSold) : 0;
        const revPar = availableUnitNights > 0 ? Math.round(roomRevenue / availableUnitNights) : 0;

        const arrivalsCount = octoberStays.filter((b: any) => String(b.check_in || '').startsWith('2026-10')).length;
        const avgLengthOfStay = arrivalsCount > 0 ? (roomNightsSold / arrivalsCount).toFixed(1) : '0.0';
        const totalGuests = octoberStays.reduce((sum: number, b: any) => sum + (Number(b.guests) || 0), 0);
        const avgPartySize = arrivalsCount > 0 ? (totalGuests / arrivalsCount).toFixed(1) : (octoberStays.length > 0 ? (totalGuests / octoberStays.length).toFixed(1) : '0.0');

        // Dynamic Lead Time
        let totalLeadDays = 0;
        let leadCount = 0;
        octoberStays.forEach((b: any) => {
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
        const monthBookings = allBookings.filter((b: any) => {
          const cin = String(b.check_in || '').slice(0, 10);
          return cin >= '2026-10-01' && cin <= '2026-10-31';
        });
        const cancelledCount = monthBookings.filter((b: any) => b.status === 'cancelled').length;
        const cancellationRate = monthBookings.length > 0
          ? ((cancelledCount / monthBookings.length) * 100).toFixed(1)
          : '0.0';

        // Dynamic Billed & Collected:
        const billedAmount = octoberStays.reduce((sum: number, b: any) => sum + (Number(b.total_php) || 0), 0);
        const collectedAmount = octoberStays
          .filter((b: any) => ['confirmed', 'checked_in', 'checked_out'].includes(String(b.payment_status || b.status || '').toLowerCase()))
          .reduce((sum: number, b: any) => sum + (Number(b.total_php) || 0), 0);
        const outstandingAmount = Math.max(0, billedAmount - collectedAmount);
        const collectionRate = billedAmount > 0
          ? ((collectedAmount / billedAmount) * 100).toFixed(1)
          : '0.0';

        // Daily real occupancy (31 days) matching actual reservations
        const dailyOccupancy = Array.from({ length: 31 }, (_, i) => {
          const dayNum = i + 1;
          const dateStr = `2026-10-${String(dayNum).padStart(2, '0')}`;
          const realOccupied = octoberStays.filter((b: any) => {
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
        octoberStays.forEach((b: any) => {
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
                <button type="button" className="pms-month-btn" title="Previous Month">
                  <i className="fas fa-chevron-left" />
                </button>
                <button type="button" className="pms-month-btn">
                  This month
                </button>
                <button type="button" className="pms-month-btn" title="Next Month">
                  <i className="fas fa-chevron-right" />
                </button>
                <span className="pms-analytics-month-title">October 2026</span>
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
                  {occupiedUnitNights} occupied ÷ {availableUnitNights} available unit-nights ({totalResortUnits} units × 31 days)
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
                        title={`Oct ${d.dayNum}: ${d.occupied} of ${totalResortUnits} units occupied (${d.pct}%)`}
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
                        <span style={{ position: 'absolute', bottom: 2, fontSize: '.62rem', color: themeMuted, fontWeight: 500, display: d.dayNum % 5 === 1 || d.dayNum === 31 ? 'block' : 'none' }}>
                          {d.dayNum}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: '.72rem', color: themeMuted }}>
                  <span>Oct 1</span>
                  <span>Oct 15</span>
                  <span>Oct 31</span>
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
                <option value="confirmed">Upcoming Confirmed ({allBookings.filter(b => b.status === 'confirmed').length})</option>
                <option value="checked_in">In-House / Checked In ({allBookings.filter(b => b.status === 'checked_in').length})</option>
                <option value="checked_out">Checked Out ({allBookings.filter(b => b.status === 'checked_out').length})</option>
                <option value="pending">Pending Approval ({allBookings.filter(b => b.status === 'pending').length})</option>
                <option value="cancelled">Cancelled ({allBookings.filter(b => b.status === 'cancelled').length})</option>
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
                            <small style={{ color: themeMuted, display: 'block' }}>{b.phone || b.profiles?.phone || 'No phone recorded'}</small>
                          </div>
                        </div>
                      </td>
                      <td>
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
