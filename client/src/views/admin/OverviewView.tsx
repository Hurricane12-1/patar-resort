import React, { useState } from 'react';
import { AreaLineChart, Sparkline } from '../../components/Charts';
import AvailabilityCalendar from '../../components/AvailabilityCalendar';

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
}) => {
  const [selectedSalesItem, setSelectedSalesItem] = useState<any>(null);

  const totalUnitsCount = Math.max(1, roomsList.reduce((s: number, r: any) => s + (Number(r.units) || 1), 0));
  const activeBookings = allBookings.filter((b: any) => b.status !== 'cancelled');
  const octRevenue = activeBookings.reduce((acc: number, b: any) => acc + (Number(b.total_php) || 0), 0) || (Number(data?.overview?.total_revenue_php) || 0);
  const octBookedUnitNights = activeBookings.reduce((acc: number, b: any) => acc + (Number(b.nights) || 1), 0) || (Number(data?.overview?.nights_sold) || 0);
  const octOccupancyPct = totalUnitsCount > 0
    ? Number(((octBookedUnitNights / (totalUnitsCount * 31)) * 100).toFixed(1))
    : (Number(data?.overview?.occupancy_pct) || 0);
  const octBookingsCount = activeBookings.length || (Number(data?.overview?.total_stays) || 0);
  const todayIso = new Date().toISOString().slice(0, 10);
  const occupiedTonight = allBookings.filter((b: any) => b.status === 'checked_in' || (b.check_in <= todayIso && b.check_out > todayIso && b.status !== 'cancelled')).length;

  const revenueSparkline = octoberSalesData.map((d: any) => d.revenue);
  const occupancySparkline = octoberSalesData.map((d: any) => Math.min(100, Math.round((d.value / totalUnitsCount) * 100)));
  const bookingsSparkline = octoberSalesData.map((d: any) => d.value);

  const firstHalfRev = octoberSalesData.slice(0, 15).reduce((s: number, d: any) => s + d.revenue, 0);
  const secondHalfRev = octoberSalesData.slice(15).reduce((s: number, d: any) => s + d.revenue, 0);
  const revGrowthPct = firstHalfRev > 0 ? Math.round(((secondHalfRev - firstHalfRev) / firstHalfRev) * 100) : (octRevenue > 0 ? 100 : 0);

  const firstHalfBookings = octoberSalesData.slice(0, 15).reduce((s: number, d: any) => s + d.value, 0);
  const secondHalfBookings = octoberSalesData.slice(15).reduce((s: number, d: any) => s + d.value, 0);
  const bookingsGrowthPct = firstHalfBookings > 0 ? Math.round(((secondHalfBookings - firstHalfBookings) / firstHalfBookings) * 100) : (octBookingsCount > 0 ? 100 : 0);

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', margin: '0 0 3px', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>
                Sales overview
              </h3>
              <span style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 500 }}>
                Daily room revenue, October 2026
              </span>
            </div>

            <span
              onClick={() => toast(`📈 October Revenue: ₱${octRevenue.toLocaleString()} (${octBookingsCount} active bookings)`)}
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
              ₱{octRevenue.toLocaleString()}
            </span>
          </div>

          <AreaLineChart
            data={octoberSalesData}
            height={210}
            isLightMode={isLightMode}
            showYAxis={true}
            onPointClick={(item: any) => {
              const rev = item.revenue > 0 ? item.revenue : (item.value * 4500);
              const dynamicInsight = rev > 60000
                ? `Peak weekend demand: High villa & sea-view suite reservations on Patar beachfront.`
                : rev > 30000
                  ? `Steady inbound guest volume: Cottage rentals and beachfront dining orders.`
                  : `Mid-week baseline: Standard room stays and casual tour inquiries.`;

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
          {/* KPI Card 1: Revenue · October */}
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
                  Revenue · October
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
                ₱{(octRevenue / 1000).toFixed(1)}k
              </b>
            </div>

            <div style={{ fontSize: '.74rem', color: themeMuted, marginBottom: 8 }}>
              Room revenue on the books · Real-time
            </div>

            <Sparkline values={revenueSparkline.length > 0 ? revenueSparkline : [0]} width={280} height={36} />
          </div>

          {/* KPI Card 2: Occupancy · October */}
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
                  Occupancy · October
                </span>
              </div>
              <span style={{
                fontSize: '.72rem',
                fontWeight: 800,
                color: octOccupancyPct > 0 ? '#10B981' : '#94A3B8',
                background: octOccupancyPct > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                padding: '2px 8px',
                borderRadius: 20,
              }}>
                {octOccupancyPct > 0 ? `▲ ${octOccupancyPct}%` : '• 0%'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '2px 0 2px' }}>
              <b style={{ fontSize: '1.85rem', fontWeight: 800, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.1 }}>
                {octOccupancyPct}%
              </b>
            </div>

            <div style={{ fontSize: '.74rem', color: themeMuted, marginBottom: 8 }}>
              {octBookedUnitNights} of {totalUnitsCount * 31} unit-nights · Real-time
            </div>

            <Sparkline values={occupancySparkline.length > 0 ? occupancySparkline : [0]} width={280} height={36} />
          </div>

          {/* KPI Card 3: Bookings · October */}
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
                  Bookings · October
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
                {octBookingsCount}
              </b>
            </div>

            <div style={{ fontSize: '.74rem', color: themeMuted, marginBottom: 8 }}>
              {occupiedTonight} of {totalUnitsCount} units occupied tonight · Real-time
            </div>

            <Sparkline values={bookingsSparkline.length > 0 ? bookingsSparkline : [0]} width={280} height={36} />
          </div>
        </div>
      </div>

      {/* ROW 2: AVAILABILITY CALENDAR (LEFT) + OPEN CONVERSATIONS (RIGHT) */}
      <div className="admin-grid-split-2">
        {/* LEFT: RESORT AVAILABILITY & PMS CALENDAR */}
        <div style={{ minWidth: 0 }}>
          <AvailabilityCalendar
            rooms={activeRoomsList}
            bookings={allBookings}
            isLightMode={isLightMode}
            showMetrics={true}
            showNewBookingInTopBar={true}
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

              setNewReservation((prev: any) => ({
                ...prev,
                room_id: activeRoom?.id || prev.room_id || '',
                check_in: cin,
                check_out: cout,
                total_php: (activeRoom?.rate_php || 3500) * nights,
                notes: unitTag ? `${unitTag} ${cleanNotes}`.trim() : cleanNotes,
              }));
              setShowAddReservationModal(true);
            }}
          />
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
                  OPEN CONVERSATIONS
                </span>
                <h3 style={{ fontSize: '1.25rem', margin: 0, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>
                  {guestConversations.length > 0 ? `${guestConversations.length} conversations to resolve` : '5 conversations to resolve'}
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
                ● {guestConversations.length || 3} unread
              </span>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '.78rem', color: themeMuted, lineHeight: 1.4 }}>
              Start resolving your open conversations now and boost your average client's CSAT score.
            </p>

            {/* Guest conversation cards list */}
            <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
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
                        toast(`💬 Opened conversation thread for ${g.name}`);
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
                  <div>No open guest conversations</div>
                  <div style={{ fontSize: '0.74rem', marginTop: 4, opacity: 0.8 }}>Incoming guest chat inquiries will stream here in real time.</div>
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
                toast('💬 Navigated to Guest Conversations Inbox');
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
            <small style={{ fontSize: '.72rem', color: themeMuted }}>Click thread to open chat</small>
          </div>
        </div>
      </div>
    </>
  );
};
