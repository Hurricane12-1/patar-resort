import React, { useState, useMemo, useEffect } from 'react';
import { AreaLineChart, Sparkline } from '../../components/Charts';

export interface OverviewViewProps {
  roomsList: any[];
  activeRoomsList: any[];
  allBookings: any[];
  data: any;
  octoberSalesData: any[];
  isLightMode: boolean;
  themeCardBg: string;
  themeBorder: string;
  themeShadow: string;
  themeText: string;
  themeMuted: string;
  toast: (msg: string, isError?: boolean) => void;
  setActiveTab: (tab: string) => void;
  newReservation: any;
  setNewReservation: React.Dispatch<React.SetStateAction<any>>;
  setShowAddReservationModal: (show: boolean) => void;
  guestConversations: any[];
  setSelectedPanelGuest: (guest: any) => void;
  setActiveChatGuest: (guest: any) => void;
  loading?: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  roomsList,
  activeRoomsList,
  allBookings,
  data,
  octoberSalesData,
  isLightMode,
  themeCardBg,
  themeBorder,
  themeShadow,
  themeText,
  themeMuted,
  toast,
  setActiveTab,
  newReservation,
  setNewReservation,
  setShowAddReservationModal,
  guestConversations,
  setSelectedPanelGuest,
  setActiveChatGuest,
  loading = false,
}) => {
  const [selectedSalesItem, setSelectedSalesItem] = useState<any>(null);
  const [bookingStatusFilter, setBookingStatusFilter] = useState<'all' | 'confirmed' | 'checked_in' | 'pending' | 'cancelled'>('all');
  const [bookingSearch, setBookingSearch] = useState('');

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return String(d).slice(5, 10);
    }
  };

  const nonCancelledBookings = (allBookings || []).filter((b: any) => b.status !== 'cancelled');
  const filteredBookedList = (allBookings || []).filter((b: any) => {
    if (bookingStatusFilter !== 'all' && b.status !== bookingStatusFilter) return false;
    if (bookingSearch.trim()) {
      const q = bookingSearch.toLowerCase();
      const name = String(b.guest_name || b.profiles?.full_name || '').toLowerCase();
      const code = String(b.booking_code || b.id || '').toLowerCase();
      const room = String(b.rooms?.name || b.room_name || '').toLowerCase();
      return name.includes(q) || code.includes(q) || room.includes(q);
    }
    return true;
  });

  const totalUnitsCount = Math.max(1, roomsList.reduce((s: number, r: any) => s + (Number(r.units) || 1), 0));
  const activeBookings = (allBookings || []).filter((b: any) => b.status !== 'cancelled');

  // Find all calendar months with active bookings plus current month
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    set.add(curYm);

    activeBookings.forEach((b: any) => {
      const cin = String(b.check_in || '').slice(0, 7);
      const cout = String(b.check_out || '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(cin)) set.add(cin);
      if (/^\d{4}-\d{2}$/.test(cout)) set.add(cout);
    });

    return Array.from(set).sort();
  }, [activeBookings]);

  // Compute stats per available month to identify populated months
  const activeMonthStats = useMemo(() => {
    const stats: Record<string, { revenue: number; bookingsCount: number }> = {};
    availableMonths.forEach((ym) => {
      const [y, m] = ym.split('-').map(Number);
      const daysInM = new Date(y, m, 0).getDate();
      let rev = 0;
      let count = 0;
      activeBookings.forEach((b: any) => {
        const cin = String(b.check_in || '').slice(0, 10);
        const cout = String(b.check_out || cin).slice(0, 10);
        const cinYm = cin.slice(0, 7);
        const coutYm = cout.slice(0, 7);
        if (cinYm === ym || coutYm === ym || (cin < `${ym}-31` && cout > `${ym}-01`)) {
          count += 1;
          const cinMs = new Date(cin).getTime();
          const coutMs = new Date(cout).getTime();
          const totalNights = Math.max(1, Math.round((coutMs - cinMs) / 86400000));
          const dailyRate = (Number(b.total_php) || 0) / totalNights;
          // Count days falling in this month
          for (let d = 1; d <= daysInM; d++) {
            const dStr = `${ym}-${String(d).padStart(2, '0')}`;
            const occupies = (cin === cout) ? (cin === dStr) : (cin <= dStr && cout > dStr);
            if (occupies) rev += dailyRate;
          }
        }
      });
      stats[ym] = { revenue: Math.round(rev), bookingsCount: count };
    });
    return stats;
  }, [availableMonths, activeBookings]);

  // Smart initial month: selects current month if it has bookings; otherwise picks the month with the most recent live data
  const bestInitialMonth = useMemo(() => {
    const now = new Date();
    const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (activeMonthStats[curYm]?.revenue > 0) return curYm;

    const populated = Object.keys(activeMonthStats)
      .filter((ym) => activeMonthStats[ym].revenue > 0)
      .sort();
    if (populated.length > 0) {
      return populated[populated.length - 1];
    }
    return curYm;
  }, [activeMonthStats]);

  const [selectedYearMonth, setSelectedYearMonth] = useState<string>(() => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const saved = sessionStorage.getItem('jd_overview_ym');
        if (saved && /^\d{4}-\d{2}$/.test(saved)) return saved;
      }
    } catch {}
    return bestInitialMonth;
  });

  // Automatically sync to best month with data if current selection has no bookings
  useEffect(() => {
    if (bestInitialMonth && (!selectedYearMonth || (activeMonthStats[selectedYearMonth]?.revenue === 0 && activeMonthStats[bestInitialMonth]?.revenue > 0))) {
      setSelectedYearMonth(bestInitialMonth);
    }
  }, [bestInitialMonth, activeMonthStats, selectedYearMonth]);

  useEffect(() => {
    try {
      if (typeof sessionStorage !== 'undefined' && selectedYearMonth) {
        sessionStorage.setItem('jd_overview_ym', selectedYearMonth);
      }
    } catch {}
  }, [selectedYearMonth]);

  const handlePrevMonth = () => {
    const [y, m] = (selectedYearMonth || '2026-11').split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    const nextYm = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    setSelectedYearMonth(nextYm);
  };

  const handleNextMonth = () => {
    const [y, m] = (selectedYearMonth || '2026-11').split('-').map(Number);
    const next = new Date(y, m, 1);
    const nextYm = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    setSelectedYearMonth(nextYm);
  };

  const monthOptions = availableMonths.includes(selectedYearMonth)
    ? availableMonths
    : [...availableMonths, selectedYearMonth].sort();

  // Dynamic Sales Analytics for Selected Month
  const {
    salesData,
    monthRevenue,
    monthBookingsCount,
    monthBookedNights,
    monthOccupancyPct,
    monthName,
    yearStr,
    daysInMonth,
  } = useMemo(() => {
    const [yStr, mStr] = (selectedYearMonth || '2026-11').split('-');
    const y = parseInt(yStr, 10) || 2026;
    const m = parseInt(mStr, 10) || 11;
    const daysInM = new Date(y, m, 0).getDate();
    const mDate = new Date(y, m - 1, 1);
    const mName = mDate.toLocaleDateString('en-US', { month: 'long' });
    const mShort = mDate.toLocaleDateString('en-US', { month: 'short' });

    const days = [];
    let totRev = 0;
    let totNights = 0;
    const monthBookingsSet = new Set<string>();

    for (let day = 1; day <= daysInM; day++) {
      const dStr = `${yStr}-${mStr}-${String(day).padStart(2, '0')}`;
      let revOnDay = 0;
      let bookingsOnDay = 0;

      activeBookings.forEach((b: any) => {
        const rawCin = String(b.check_in || '').trim();
        const rawCout = String(b.check_out || rawCin).trim();
        const cin = rawCin.slice(0, 10);
        const cout = rawCout.slice(0, 10);
        if (!cin) return;

        const isSameDay = cin === cout;
        const occupiesDay = isSameDay ? (cin === dStr) : (cin <= dStr && cout > dStr);
        if (occupiesDay) {
          monthBookingsSet.add(b.id || `${cin}-${cout}`);
          const cinMs = new Date(cin).getTime();
          const coutMs = new Date(cout).getTime();
          const nights = Math.max(1, Math.round((coutMs - cinMs) / 86400000));
          const totalPhp = Number(b.total_php) || 0;
          const dailyRate = totalPhp / nights;
          revOnDay += dailyRate;
          bookingsOnDay += 1;
          totNights += 1;
        }
      });

      // Merge backend daily analytics if available for this specific date
      const apiDaily = data?.daily?.find((d: any) => d.date === dStr || d.day === dStr);
      if (apiDaily && Number(apiDaily.revenue_php) > 0) {
        revOnDay = Math.max(revOnDay, Number(apiDaily.revenue_php));
        bookingsOnDay = Math.max(bookingsOnDay, Number(apiDaily.bookings));
      }

      const roundedRev = Math.round(revOnDay);
      totRev += roundedRev;

      days.push({
        date: dStr,
        day,
        label: `${mShort} ${day}`,
        revenue: roundedRev,
        value: bookingsOnDay,
      });
    }

    const occupancy = Number(((totNights / (totalUnitsCount * daysInM)) * 100).toFixed(1));

    return {
      salesData: days,
      monthRevenue: totRev,
      monthBookingsCount: monthBookingsSet.size,
      monthBookedNights: totNights,
      monthOccupancyPct: occupancy,
      monthName: mName,
      yearStr: String(y),
      daysInMonth: daysInM,
    };
  }, [selectedYearMonth, activeBookings, data?.daily, totalUnitsCount]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const occupiedTonight = allBookings.filter((b: any) => b.status === 'checked_in' || (b.check_in <= todayIso && b.check_out > todayIso && b.status !== 'cancelled')).length;

  const revenueSparkline = salesData.map((d: any) => d.revenue);
  const occupancySparkline = salesData.map((d: any) => Math.min(100, Math.round((d.value / totalUnitsCount) * 100)));
  const bookingsSparkline = salesData.map((d: any) => d.value);

  const halfPoint = Math.floor(salesData.length / 2);
  const firstHalfRev = salesData.slice(0, halfPoint).reduce((s: number, d: any) => s + d.revenue, 0);
  const secondHalfRev = salesData.slice(halfPoint).reduce((s: number, d: any) => s + d.revenue, 0);
  const revGrowthPct = firstHalfRev > 0 ? Math.round(((secondHalfRev - firstHalfRev) / firstHalfRev) * 100) : (monthRevenue > 0 ? 100 : 0);

  const firstHalfBookings = salesData.slice(0, halfPoint).reduce((s: number, d: any) => s + d.value, 0);
  const secondHalfBookings = salesData.slice(halfPoint).reduce((s: number, d: any) => s + d.value, 0);
  const bookingsGrowthPct = firstHalfBookings > 0 ? Math.round(((secondHalfBookings - firstHalfBookings) / firstHalfBookings) * 100) : (monthBookingsCount > 0 ? 100 : 0);

  return (
    <>
      {/* ROW 1: SALES OVERVIEW (LEFT) + 3 STACKED KPI CARDS (RIGHT) */}
      <div className="admin-grid-split-2" style={{ marginBottom: 20 }}>
        {/* LEFT: SALES OVERVIEW CARD */}
        <div
          className="panel panel-card"
          style={{
            background: themeCardBg,
            border: `1px solid ${themeBorder}`,
            borderRadius: 18,
            padding: '20px 22px',
            boxShadow: themeShadow,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.2rem', margin: 0, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>
                  Sales overview
                </h3>

                {/* Dynamic Month Selector */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 10, border: `1px solid ${themeBorder}` }}>
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    title="Previous Month"
                    style={{ background: 'none', border: 'none', color: themeMuted, cursor: 'pointer', padding: '2px 6px', fontSize: '.75rem', fontWeight: 800 }}
                  >
                    ‹
                  </button>
                  <select
                    value={selectedYearMonth}
                    onChange={(e) => setSelectedYearMonth(e.target.value)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: themeText,
                      fontSize: '.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      outline: 'none',
                      padding: '2px 2px',
                    }}
                  >
                    {monthOptions.map((ym) => {
                      const [y, m] = ym.split('-').map(Number);
                      const label = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                      const hasData = activeMonthStats[ym]?.revenue > 0;
                      return (
                        <option key={ym} value={ym} style={{ background: isLightMode ? '#FFFFFF' : '#1E293B', color: themeText }}>
                          {label} {hasData ? `(₱${(activeMonthStats[ym].revenue / 1000).toFixed(1)}k)` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    title="Next Month"
                    style={{ background: 'none', border: 'none', color: themeMuted, cursor: 'pointer', padding: '2px 6px', fontSize: '.75rem', fontWeight: 800 }}
                  >
                    ›
                  </button>
                </div>
              </div>

              <span style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 500, display: 'block', marginTop: 4 }}>
                Daily room revenue, {monthName} {yearStr}
              </span>
            </div>

            <span
              onClick={() => toast(`📈 ${monthName} Revenue: ₱${monthRevenue.toLocaleString()} (${monthBookingsCount} active bookings)`)}
              style={{
                fontSize: '.88rem',
                color: '#10B981',
                fontWeight: 800,
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.28)',
                padding: '4px 12px',
                borderRadius: 12,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
              title="Click for revenue status"
            >
              ₱{monthRevenue.toLocaleString()}
            </span>
          </div>

          <AreaLineChart
            data={salesData}
            height={210}
            isLightMode={isLightMode}
            showYAxis={true}
            loading={loading}
            onPointClick={(item: any) => {
              const rev = item.revenue > 0 ? item.revenue : (item.value * 4500);
              const dynamicInsight = rev > 60000
                ? `Peak weekend demand: High villa & sea-view suite reservations on Patar beachfront.`
                : rev > 30000
                  ? `Steady inbound guest volume: Cottage rentals and beachfront dining orders.`
                  : rev > 0
                    ? `Active guest stays: Standard room bookings and coastal accommodations.`
                    : `Zero active guest check-ins recorded on this calendar date.`;

              setSelectedSalesItem({
                ...item,
                insight: dynamicInsight,
                revenuePhp: rev,
                nights: Math.max(1, Math.round(item.value * 1.5)),
              });
              toast(`📈 Sales Insight ${item.label}: ₱${rev.toLocaleString()}`);
            }}
          />

          {selectedSalesItem && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: isLightMode ? '#F1F5F9' : 'rgba(15,23,42,0.85)', border: '1px solid rgba(56,189,248,0.35)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <b style={{ fontSize: '.84rem', color: '#38BDF8' }}>
                  <i className="fas fa-chart-line" style={{ marginRight: 6 }} />Revenue Insight ({selectedSalesItem.label})
                </b>
                <button onClick={() => setSelectedSalesItem(null)} style={{ background: 'none', border: 'none', color: themeMuted, cursor: 'pointer', fontSize: '.74rem', fontWeight: 700 }}>✕ Close</button>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: '.78rem', marginBottom: 6 }}>
                <span>Revenue: <b style={{ color: '#10B981' }}>₱{selectedSalesItem.revenuePhp.toLocaleString()}</b></span>
                <span>Est. Room Nights: <b style={{ color: '#38BDF8' }}>{selectedSalesItem.nights} nights</b></span>
              </div>
              <p style={{ margin: 0, fontSize: '.76rem', color: themeText, lineHeight: 1.4 }}>
                <i className="fas fa-lightbulb" style={{ color: '#F59E0B', marginRight: 4 }} /><b>Driver:</b> {selectedSalesItem.insight}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: 3 STACKED KPI CARDS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* KPI Card 1: Revenue · Month */}
          <div
            className="panel-card kpi-card"
            style={{
              background: themeCardBg,
              border: `1px solid ${themeBorder}`,
              borderRadius: 16,
              padding: '16px 18px',
              boxShadow: themeShadow,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('ledger')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'rgba(59, 130, 246, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563EB',
                  fontSize: '.9rem',
                }}>
                  <i className="fas fa-file-invoice-dollar" />
                </span>
                <span style={{ fontSize: '.82rem', fontWeight: 700, color: themeMuted }}>
                  Revenue · {monthName}
                </span>
              </div>
              <span style={{
                fontSize: '.72rem',
                fontWeight: 800,
                color: revGrowthPct >= 0 ? '#10B981' : '#EF4444',
                background: revGrowthPct >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                padding: '2px 8px',
                borderRadius: 20,
              }}>
                {revGrowthPct >= 0 ? `▲ +${revGrowthPct}%` : `▼ ${revGrowthPct}%`}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '2px 0 2px' }}>
              <b style={{ fontSize: '1.85rem', fontWeight: 800, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.1 }}>
                ₱{(monthRevenue / 1000).toFixed(1)}k
              </b>
            </div>

            <div style={{ fontSize: '.74rem', color: themeMuted, marginBottom: 8 }}>
              Room revenue on the books · Real-time
            </div>

            <Sparkline values={revenueSparkline.length > 0 ? revenueSparkline : [0]} width={280} height={36} />
          </div>

          {/* KPI Card 2: Occupancy · Month */}
          <div
            className="panel-card kpi-card"
            style={{
              background: themeCardBg,
              border: `1px solid ${themeBorder}`,
              borderRadius: 16,
              padding: '16px 18px',
              boxShadow: themeShadow,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('inventory')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'rgba(16, 185, 129, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10B981',
                  fontSize: '.9rem',
                }}>
                  <i className="fas fa-bed" />
                </span>
                <span style={{ fontSize: '.82rem', fontWeight: 700, color: themeMuted }}>
                  Occupancy · {monthName}
                </span>
              </div>
              <span style={{
                fontSize: '.72rem',
                fontWeight: 800,
                color: monthOccupancyPct > 0 ? '#10B981' : '#94A3B8',
                background: monthOccupancyPct > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                padding: '2px 8px',
                borderRadius: 20,
              }}>
                {monthOccupancyPct > 0 ? `▲ ${monthOccupancyPct}%` : '• 0%'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '2px 0 2px' }}>
              <b style={{ fontSize: '1.85rem', fontWeight: 800, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.1 }}>
                {monthOccupancyPct}%
              </b>
            </div>

            <div style={{ fontSize: '.74rem', color: themeMuted, marginBottom: 8 }}>
              {monthBookedNights} of {totalUnitsCount * daysInMonth} unit-nights · Real-time
            </div>

            <Sparkline values={occupancySparkline.length > 0 ? occupancySparkline : [0]} width={280} height={36} />
          </div>

          {/* KPI Card 3: Bookings · Month */}
          <div
            className="panel-card kpi-card"
            style={{
              background: themeCardBg,
              border: `1px solid ${themeBorder}`,
              borderRadius: 16,
              padding: '16px 18px',
              boxShadow: themeShadow,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('ledger')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'rgba(245, 158, 11, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F59E0B',
                  fontSize: '.9rem',
                }}>
                  <i className="fas fa-calendar-check" />
                </span>
                <span style={{ fontSize: '.82rem', fontWeight: 700, color: themeMuted }}>
                  Bookings · {monthName}
                </span>
              </div>
              <span style={{
                fontSize: '.72rem',
                fontWeight: 800,
                color: bookingsGrowthPct >= 0 ? '#10B981' : '#EF4444',
                background: bookingsGrowthPct >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                padding: '2px 8px',
                borderRadius: 20,
              }}>
                {bookingsGrowthPct >= 0 ? `▲ +${bookingsGrowthPct}%` : `▼ ${bookingsGrowthPct}%`}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '2px 0 2px' }}>
              <b style={{ fontSize: '1.85rem', fontWeight: 800, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.1 }}>
                {monthBookingsCount}
              </b>
            </div>

            <div style={{ fontSize: '.74rem', color: themeMuted, marginBottom: 8 }}>
              {occupiedTonight} of {totalUnitsCount} units occupied tonight · Real-time
            </div>

            <Sparkline values={bookingsSparkline.length > 0 ? bookingsSparkline : [0]} width={280} height={36} />
          </div>
        </div>
      </div>

      {/* ROW 2: OPERATIONS DISPATCH & TURNAROUND (LEFT) + OPEN CONVERSATIONS (RIGHT) */}
      <div className="admin-grid-split-2">
        {/* LEFT: LIST OF BOOKED STAYS */}
        <div
          className="panel panel-card"
          style={{
            background: themeCardBg,
            border: `1px solid ${themeBorder}`,
            borderRadius: 18,
            padding: '20px 22px',
            boxShadow: themeShadow,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minWidth: 0,
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', margin: 0, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>
                  List of Booked Stays
                </h3>
              </div>
              <span style={{
                fontSize: '.72rem',
                color: '#10B981',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '3px 10px',
                borderRadius: 20,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}>
                ● {nonCancelledBookings.length} Booked
              </span>
            </div>

            <p style={{ margin: '0 0 12px', fontSize: '.78rem', color: themeMuted, lineHeight: 1.4 }}>
              Real-time overview of guest reservations, room units, scheduled dates, and check-in status.
            </p>

            {/* Filter pills & search */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { key: 'all', label: `All (${allBookings.length})` },
                  { key: 'confirmed', label: `Confirmed (${allBookings.filter((b: any) => b.status === 'confirmed').length})` },
                  { key: 'checked_in', label: `In-House (${allBookings.filter((b: any) => b.status === 'checked_in').length})` },
                  { key: 'pending', label: `Pending (${allBookings.filter((b: any) => b.status === 'pending').length})` },
                ].map((f) => {
                  const active = bookingStatusFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setBookingStatusFilter(f.key as any)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: 16,
                        border: `1px solid ${active ? '#0EA5E9' : themeBorder}`,
                        background: active ? (isLightMode ? 'rgba(14, 165, 233, 0.15)' : 'rgba(14, 165, 233, 0.25)') : (isLightMode ? '#F1F5F9' : 'rgba(255, 255, 255, 0.05)'),
                        color: active ? '#0EA5E9' : themeMuted,
                        fontSize: '.72rem',
                        fontWeight: active ? 700 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {allBookings.length > 3 && (
                <div style={{ position: 'relative', minWidth: 140 }}>
                  <input
                    type="text"
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    placeholder="Search guest, code..."
                    style={{
                      width: '100%',
                      padding: '4px 8px 4px 24px',
                      borderRadius: 10,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#FFFFFF' : 'rgba(15, 23, 42, 0.6)',
                      color: themeText,
                      fontSize: '.72rem',
                      outline: 'none',
                    }}
                  />
                  <i className="fas fa-search" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '.65rem', color: themeMuted }} />
                </div>
              )}
            </div>

            {/* Scrollable Booked List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
              {filteredBookedList.length > 0 ? (
                filteredBookedList.map((b: any, idx: number) => {
                  const guestName = b.guest_name || b.profiles?.full_name || 'Guest User';
                  const initials = guestName.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'GU';
                  const roomName = b.rooms?.name || b.room_name || 'Assigned Accommodation';
                  const bookingCode = b.booking_code || ('RV-' + String(b.id || '').slice(0, 8).toUpperCase());
                  const checkInStr = fmtDate(b.check_in);
                  const checkOutStr = fmtDate(b.check_out);
                  const nightsCount = b.nights || 1;
                  const total = Number(b.total_php) || 0;
                  const status = b.status || 'confirmed';

                  const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
                    confirmed: { label: 'Confirmed', bg: 'rgba(16, 185, 129, 0.12)', text: '#10B981', border: 'rgba(16, 185, 129, 0.3)' },
                    checked_in: { label: 'In-House', bg: 'rgba(59, 130, 246, 0.12)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.3)' },
                    pending: { label: 'Pending', bg: 'rgba(245, 158, 11, 0.12)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' },
                    checked_out: { label: 'Checked Out', bg: 'rgba(100, 116, 139, 0.12)', text: '#64748B', border: 'rgba(100, 116, 139, 0.3)' },
                    cancelled: { label: 'Cancelled', bg: 'rgba(239, 68, 68, 0.12)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.3)' },
                  };
                  const sc = statusConfig[status] || statusConfig.confirmed;

                  return (
                    <div
                      key={b.id || idx}
                      onClick={() => {
                        setActiveTab('ledger');
                        toast(`Booking ${bookingCode}: ${guestName} (${roomName})`);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        background: isLightMode ? '#F8FAFC' : 'rgba(15, 23, 42, 0.65)',
                        borderRadius: 14,
                        border: `1px solid ${themeBorder}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        gap: 12,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#0EA5E9';
                        e.currentTarget.style.boxShadow = isLightMode
                          ? '0 4px 12px rgba(14, 165, 233, 0.12)'
                          : '0 0 14px rgba(14, 165, 233, 0.25)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = themeBorder;
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          background: 'rgba(14, 165, 233, 0.12)',
                          color: '#0EA5E9',
                          fontWeight: 800,
                          fontSize: '.82rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          border: '1px solid rgba(14, 165, 233, 0.25)',
                        }}>
                          {initials}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <b style={{ fontSize: '.86rem', color: themeText, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {guestName}
                            </b>
                            <span style={{ fontSize: '.7rem', color: '#0EA5E9', fontFamily: 'monospace', fontWeight: 600 }}>
                              {bookingCode}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '.72rem',
                              color: themeText,
                              fontWeight: 600,
                              background: isLightMode ? '#E2E8F0' : 'rgba(255, 255, 255, 0.08)',
                              padding: '1px 6px',
                              borderRadius: 6,
                            }}>
                              🛏️ {roomName}
                            </span>
                            <span style={{ fontSize: '.72rem', color: themeMuted }}>
                              📅 {checkInStr} → {checkOutStr} ({nightsCount}n)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <b style={{ display: 'block', fontSize: '.88rem', color: themeText, fontWeight: 800 }}>
                          ₱{total.toLocaleString()}
                        </b>
                        <span style={{
                          fontSize: '.68rem',
                          color: sc.text,
                          background: sc.bg,
                          border: `1px solid ${sc.border}`,
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontWeight: 700,
                          display: 'inline-block',
                          marginTop: 3,
                        }}>
                          {sc.label}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{
                  padding: '36px 16px',
                  textAlign: 'center',
                  background: isLightMode ? '#F8FAFC' : 'rgba(15, 23, 42, 0.4)',
                  borderRadius: 14,
                  border: `1px dashed ${themeBorder}`,
                  color: themeMuted,
                  fontSize: '0.82rem',
                }}>
                  <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>📑</div>
                  <div style={{ fontWeight: 700, color: themeText, marginBottom: 2 }}>No Booked Stays Found</div>
                  <div style={{ fontSize: '0.74rem', opacity: 0.85, maxWidth: 320, margin: '0 auto 12px' }}>
                    {bookingStatusFilter !== 'all'
                      ? `There are no reservations currently matching "${bookingStatusFilter}".`
                      : 'Current and upcoming bookings will appear here.'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeRoomsList.length === 0) {
                        toast("There's no present room around. Please add a room in Room Management first.", true);
                        return;
                      }
                      const activeRoom = activeRoomsList[0];
                      const tmrIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
                      setNewReservation((prev: any) => ({
                        ...prev,
                        room_id: prev.room_id || activeRoom?.id || '',
                        check_in: prev.check_in || todayIso,
                        check_out: prev.check_out || tmrIso,
                        total_php: activeRoom?.rate_php || 3500,
                      }));
                      setShowAddReservationModal(true);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 10,
                      background: '#0EA5E9',
                      border: 'none',
                      color: '#031726',
                      fontWeight: 700,
                      fontSize: '.76rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <i className="fas fa-plus" />
                    <span>Create Reservation</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: `1px solid ${themeBorder}`, marginTop: 14 }}>
            <button
              onClick={() => {
                setActiveTab('ledger');
                toast('Opened Reservations');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#0EA5E9',
                fontSize: '.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: 0,
                transition: 'gap 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.gap = '10px')}
              onMouseLeave={(e) => (e.currentTarget.style.gap = '6px')}
            >
              view all reservations <i className="fas fa-arrow-right" style={{ marginLeft: 4 }} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeRoomsList.length === 0) {
                  toast("There's no present room around. Please add a room in Room Management first.", true);
                  return;
                }
                const activeRoom = activeRoomsList[0];
                const tmrIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
                setNewReservation((prev: any) => ({
                  ...prev,
                  room_id: prev.room_id || activeRoom?.id || '',
                  check_in: prev.check_in || todayIso,
                  check_out: prev.check_out || tmrIso,
                  total_php: activeRoom?.rate_php || 3500,
                }));
                setShowAddReservationModal(true);
              }}
              style={{
                padding: '7px 14px',
                borderRadius: 10,
                background: isLightMode ? '#F1F5F9' : 'rgba(255, 255, 255, 0.08)',
                border: `1px solid ${themeBorder}`,
                color: themeText,
                fontWeight: 700,
                fontSize: '.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <i className="fas fa-plus" />
              <span>New Booking</span>
            </button>
          </div>
        </div>

        {/* RIGHT: OPEN CONVERSATIONS PANEL */}
        <div
          className="panel panel-card"
          style={{
            background: themeCardBg,
            border: `1px solid ${themeBorder}`,
            borderRadius: 18,
            padding: '20px 22px',
            boxShadow: themeShadow,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minWidth: 0,
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div>
                <span style={{ fontSize: '.72rem', color: '#6366F1', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
                  GUEST MESSAGES
                </span>
                <h3 style={{ fontSize: '1.25rem', margin: 0, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>
                  {guestConversations.length === 0
                    ? 'No guest messages yet'
                    : `${guestConversations.length} guest ${guestConversations.length === 1 ? 'chat' : 'chats'}`}
                </h3>
              </div>
              {guestConversations.length > 0 && (
              <span style={{
                fontSize: '.72rem',
                color: '#10B981',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '3px 10px',
                borderRadius: 20,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}>
                ● {guestConversations.length} open
              </span>
              )}
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '.78rem', color: themeMuted, lineHeight: 1.4 }}>
              Chats from guests show up here. Click one to read it and reply.
            </p>

            {/* Guest conversation cards list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
              {guestConversations.length > 0 ? (
                guestConversations.slice(0, 5).map((g: any, idx: number) => {
                  const initials = g.name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'GU';
                  const avatarColors = [
                    { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563EB' },
                    { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669' },
                    { bg: 'rgba(245, 158, 11, 0.12)', text: '#D97706' },
                    { bg: 'rgba(139, 92, 246, 0.12)', text: '#7C3AED' },
                    { bg: 'rgba(236, 72, 153, 0.12)', text: '#DB2777' },
                  ];
                  const colorPair = avatarColors[idx % avatarColors.length];

                  return (
                    <div
                      key={g.id || idx}
                      onClick={() => {
                        setSelectedPanelGuest(g);
                        setActiveChatGuest(null);
                        setActiveTab('conversations');
                        toast(`Opened the chat with ${g.name}`);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        background: isLightMode ? '#F8FAFC' : 'rgba(15, 23, 42, 0.65)',
                        borderRadius: 14,
                        border: `1px solid ${themeBorder}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#3B82F6';
                        e.currentTarget.style.boxShadow = isLightMode ? '0 4px 12px rgba(59, 130, 246, 0.12)' : '0 0 12px rgba(59, 130, 246, 0.25)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = themeBorder;
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            background: colorPair.bg,
                            color: colorPair.text,
                            fontWeight: 800,
                            fontSize: '.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                          }}>
                            {initials}
                          </div>
                          <span style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            background: '#10B981',
                            border: `2px solid ${isLightMode ? '#FFFFFF' : '#0F172A'}`,
                          }} />
                        </div>

                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <b style={{ fontSize: '.86rem', color: themeText, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {g.name}
                            </b>
                          </div>
                          <span style={{ fontSize: '.74rem', color: themeMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', marginTop: 2 }}>
                            {g.lastMessage || `${g.channel} guest inquiry`}
                          </span>
                        </div>
                      </div>

                      <span style={{
                        fontSize: '.72rem',
                        color: themeMuted,
                        background: isLightMode ? '#F1F5F9' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${themeBorder}`,
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        marginLeft: 8,
                      }}>
                        {g.timeAgo || 'Just now'}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div style={{
                  padding: '36px 16px',
                  textAlign: 'center',
                  background: isLightMode ? '#F8FAFC' : 'rgba(15, 23, 42, 0.4)',
                  borderRadius: 12,
                  border: `1px dashed ${themeBorder}`,
                  color: themeMuted,
                  fontSize: '0.82rem',
                }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>💬</div>
                  <div>No guest messages yet</div>
                  <div style={{ fontSize: '0.74rem', marginTop: 4, opacity: 0.8 }}>New chats from guests will appear here.</div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Footer View More Link */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: `1px solid ${themeBorder}`, marginTop: 14 }}>
            <button
              onClick={() => {
                setSelectedPanelGuest(guestConversations[0] || null);
                setActiveChatGuest(null);
                setActiveTab('conversations');
                toast('Opened Customer Services');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6366F1',
                fontSize: '.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: 0,
                transition: 'gap 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.gap = '10px')}
              onMouseLeave={(e) => (e.currentTarget.style.gap = '6px')}
            >
              view more <i className="fas fa-arrow-right" style={{ marginLeft: 4 }} />
            </button>
            <small style={{ fontSize: '.72rem', color: themeMuted }}>Click a chat to open it</small>
          </div>
        </div>
      </div>
    </>
  );
};
