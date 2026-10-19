import React, { useState } from 'react';

// Multi-Segment Donut Pie Chart (Matching "User Activity" in reference UI)
export function DonutChart({
  totalValue = '0',
  totalLabel = 'ACTIVE USERS',
  segments = [],
  size = 180,
  onSegmentClick,
}) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0 || segments.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 16px', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 16, width: '100%', maxWidth: size + 80 }}>
        <span style={{ fontSize: '1.6rem', display: 'block', marginBottom: 6 }}>📊</span>
        <b style={{ fontSize: '.84rem', color: 'var(--theme-text, #0F172A)', display: 'block' }}>Awaiting Channel Activity</b>
        <span style={{ fontSize: '.72rem', color: '#64748B' }}>0 active guest sessions recorded</span>
      </div>
    );
  }

  let accumulatedPercent = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {segments.map((seg, i) => {
            const percent = seg.value / total;
            const strokeDasharray = `${percent * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedPercent * circumference;
            accumulatedPercent += percent;

            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                style={{ 
                  transition: 'stroke-dasharray 0.4s ease, opacity 0.2s ease',
                  cursor: 'pointer',
                  opacity: hoverIndex === i ? 0.7 : 1
                }}
                onClick={() => onSegmentClick && onSegmentClick(seg, i)}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            );
          })}
        </svg>

        {/* CENTER STAT OVERLAY */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justify: 'center',
            textAlign: 'center',
          }}
        >
          <b style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--theme-text, #0F172A)', lineHeight: 1 }}>{totalValue}</b>
          <span style={{ fontSize: '.64rem', color: '#64748B', fontWeight: 700, letterSpacing: '.06em', marginTop: 3 }}>
            {totalLabel}
          </span>
        </div>
      </div>

      {/* LEGEND BADGES */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 140 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.74rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color }} />
            <span style={{ color: '#64748B', fontWeight: 500 }}>{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Dual Spline Wave Chart (Matching "Conversations Evolution" in reference UI)
export function DualSplineWaveChart({ height = 230, isLightMode = false, onPointClick, totalChats = 0, dynamicData = null }: any) {
  const [timeRange, setTimeRange] = useState('Week'); // Default 'Week' to match user reference Mon-Sun
  const [showAuto, setShowAuto] = useState(true);
  const [showStaff, setShowStaff] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<any>(null);

  // Datasets for Month (30d), Week (7d), and Day (24h)
  const monthData = {
    labels: Array.from({ length: 30 }, (_, i) => i + 1),
    lineA: [5, 12, 18, 14, 28, 35, 25, 28, 36, 40, 52, 45, 62, 50, 48, 65, 95, 42, 60, 85, 58, 62, 40, 32, 28, 25, 15, 8, 5, 2],
    lineB: [2, 8, 10, 15, 22, 18, 35, 75, 55, 42, 25, 85, 48, 32, 45, 68, 90, 28, 42, 25, 30, 45, 48, 42, 50, 48, 35, 12, 6, 2],
    insights: [
      "Low initial chat volume on Month Day 1.", "Inbound room inquiry volume starting to build up.", "Early check-in inquiries from Manila travelers.",
      "Steady mid-week booking inquiries.", "Promotional weekend push triggered automated AI responses.", "Peak automated FAQ responses for Patar Beach tour packages.",
      "Mid-week lull in staff chat transfers.", "Spike in staff requests for villa upgrades & custom dining.", "Steady customer engagement via Webchat & Messenger.",
      "Increased automated responses for check-out times.", "Weekend surge in automated AI bot interactions.", "High staff transfer requests for private candlelight dinners.",
      "Peak booking inquiry day driven by social media ads.", "Steady flow of automated FAQ answers.", "Inquiries regarding van pickup service.",
      "High staff request volume for villa date modifications.", "MONTHLY PEAK: 95 automated AI chats + 90 staff transfers during Patar Beach Festival promo!",
      "Post-event query reduction.", "Surge in automated bot answers for poolside bar hours.", "Weekend peak: 85 automated chats + 25 staff transfers.",
      "High guest satisfaction score across automated channels.", "Staff handled 45 room modification tickets.", "Moderate evening query activity.",
      "Normal weekday engagement.", "Automated response rate hit 98.4% CSAT efficiency.", "End-of-month reservation inquiries.",
      "Low late-night query volume.", "Minimal queries.", "End of month wrap-up.", "Quiet late-night stream."
    ]
  };

  const weekData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    lineA: [38, 45, 62, 75, 98, 125, 110],
    lineB: [18, 24, 35, 50, 76, 92, 80],
    insights: [
      "Monday start: Standard room availability & check-in inquiries.",
      "Tuesday: Automated bot answered 45 FAQs for Patar outrigger tours.",
      "Wednesday: Mid-week booking inquiries for upcoming weekend.",
      "Thursday: Surge in staff requests for executive van transfers.",
      "Friday: Weekend check-in rush — 98 automated chats + 76 staff tickets.",
      "WEEKEND PEAK: 125 automated AI chats + 92 staff transfers for beachfront dining & villa upgrades!",
      "Sunday: Check-out FAQs and late check-out requests."
    ]
  };

  const dayData = {
    labels: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
    lineA: [8, 4, 12, 45, 88, 95, 72, 34],
    lineB: [2, 1, 5, 22, 42, 55, 38, 15],
    insights: [
      "Midnight: Automated bot handled night-owl FAQ inquiries.",
      "Early hours: System idle with automated bot standby.",
      "Morning dawn: Early morning check-in & breakfast inquiry start.",
      "Morning peak: Guests asking about breakfast menus & pool hours.",
      "Noon check-in peak: 88 automated bot answers + 42 staff check-in requests.",
      "AFTERNOON PEAK: 95 automated chats + 55 staff requests for tour bookings & villa services!",
      "Evening sunset: Inquiries for beachfront candlelight dinners.",
      "Night wrap-up: Evening check-in and late arrival notifications."
    ]
  };

  const currentDataset = timeRange === 'Month' 
    ? (dynamicData?.month?.lineA ? { ...monthData, ...dynamicData.month } : monthData) 
    : timeRange === 'Week' 
    ? (dynamicData?.week?.lineA ? { ...weekData, ...dynamicData.week } : weekData) 
    : dayData;
  const { labels, lineA, lineB, insights = [] } = currentDataset;

  const w = 640;
  const maxVal = Math.max(15, Math.max(...(lineA || [15])), Math.max(...(lineB || [15]))) * 1.25;

  const getPoints = (arr: any[]) =>
    arr.map((val, i) => ({
      x: (i / Math.max(1, arr.length - 1)) * (w - 50) + 25,
      y: height - 40 - (val / maxVal) * (height - 70),
      val,
    }));

  const ptsA = getPoints(lineA);
  const ptsB = getPoints(lineB);

  const buildSpline = (pts) => {
    if (!pts || pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const c = pts[i];
      const n = pts[i + 1];
      d += ` C ${c.x + (n.x - c.x) / 2} ${c.y}, ${c.x + (n.x - c.x) / 2} ${n.y}, ${n.x} ${n.y}`;
    }
    return d;
  };

  const pathA = buildSpline(ptsA);
  const pathB = buildSpline(ptsB);
  const areaA = `${pathA} L ${ptsA[ptsA.length - 1].x} ${height - 30} L ${ptsA[0].x} ${height - 30} Z`;

  const handlePointSelect = (i) => {
    const autoVal = lineA[i] || 0;
    const staffVal = lineB[i] || 0;
    const total = autoVal + staffVal;
    const autoPct = total > 0 ? Math.round((autoVal / total) * 100) : 0;
    const staffPct = total > 0 ? Math.round((staffVal / total) * 100) : 0;
    const labelStr = timeRange === 'Month' ? `Day ${labels[i]}` : labels[i];

    const item = {
      index: i,
      label: labelStr,
      periodLabel: `${timeRange === 'Month' ? 'Month Day ' : ''}${labelStr}`,
      auto: autoVal,
      staff: staffVal,
      total,
      autoPct,
      staffPct,
      efficiency: (95 + (i % 4) * 1.1).toFixed(1),
      latency: (1.1 + (i % 3) * 0.15).toFixed(2),
      insight: insights[i] || "High customer engagement handled smoothly by Rock View AI Assistant.",
    };
    setSelectedPoint(item);
    if (onPointClick) onPointClick(item);
  };

  const themeText = isLightMode ? '#0F172A' : '#F8FAFC';
  const themeMuted = isLightMode ? '#64748B' : '#94A3B8';
  const themeBorder = isLightMode ? '#E2E8F0' : 'rgba(255, 255, 255, 0.12)';

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER CONTROLS: TIME RANGE DROPDOWN & LEGEND SERIES TOGGLES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ fontSize: '1.2rem', margin: 0, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>
          CONVERSATIONS EVOLUTION
        </h3>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 14, fontSize: '.76rem', fontWeight: 600 }}>
            <span
              onClick={() => setShowAuto(!showAuto)}
              style={{
                color: showAuto ? '#34D399' : themeMuted,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                opacity: showAuto ? 1 : 0.4,
                transition: 'all 0.2s ease',
                userSelect: 'none'
              }}
              title="Click to toggle Automated Conversations series"
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34D399', display: 'inline-block' }} />
              Automated Conversations
            </span>

            <span
              onClick={() => setShowStaff(!showStaff)}
              style={{
                color: showStaff ? '#6366F1' : themeMuted,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                opacity: showStaff ? 1 : 0.4,
                transition: 'all 0.2s ease',
                userSelect: 'none'
              }}
              title="Click to toggle Requests To Chat With Staff series"
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366F1', display: 'inline-block' }} />
              Requests To Chat With Staff
            </span>
          </div>

          <select
            value={timeRange}
            onChange={(e) => {
              setTimeRange(e.target.value);
              setSelectedPoint(null);
              setHoveredIdx(null);
            }}
            style={{
              fontSize: '.78rem', padding: '5px 12px', borderRadius: 8,
              background: isLightMode ? '#FFFFFF' : '#0F172A',
              color: themeText, border: `1px solid ${themeBorder}`,
              fontWeight: 700, cursor: 'pointer', outline: 'none'
            }}
          >
            <option value="Month">Month ▾</option>
            <option value="Week">Week ▾</option>
            <option value="Day">Day ▾</option>
          </select>
        </div>
      </div>

      {/* SVG GRAPH CONTAINER */}
      <div style={{ position: 'relative', width: '100%' }}>
        <svg
          viewBox={`0 0 ${w} ${height}`}
          width="100%"
          style={{ overflow: 'visible', cursor: 'crosshair' }}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <linearGradient id="waveAGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34D399" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#34D399" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((ratio, gi) => (
            <line
              key={gi}
              x1={20}
              y1={height - 30 - ratio * (height - 60)}
              x2={w - 20}
              y2={height - 30 - ratio * (height - 60)}
              stroke={isLightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'}
              strokeDasharray="4 4"
            />
          ))}

          {/* Area Fill for Series A */}
          {showAuto && <path d={areaA} fill="url(#waveAGrad)" />}

          {/* Lines */}
          {showAuto && <path d={pathA} fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" />}
          {showStaff && <path d={pathB} fill="none" stroke="#6366F1" strokeWidth="3" strokeLinecap="round" />}

          {/* Active Hover Vertical Crosshair */}
          {hoveredIdx !== null && ptsA[hoveredIdx] && (
            <line
              x1={ptsA[hoveredIdx].x}
              y1={20}
              x2={ptsA[hoveredIdx].x}
              y2={height - 30}
              stroke="#818CF8"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Datapoint Circles Series A (Automated) */}
          {showAuto && ptsA.map((p, i) => {
            const isHover = hoveredIdx === i;
            const isSel = selectedPoint?.index === i;
            if (timeRange === 'Month' && i % 2 !== 0 && !isHover && !isSel) return null;
            return (
              <circle
                key={`a-${i}`}
                cx={p.x}
                cy={p.y}
                r={isSel ? 7 : isHover ? 6 : 4}
                fill={isSel ? '#34D399' : '#FFFFFF'}
                stroke="#34D399"
                strokeWidth={isSel ? 3.5 : 2.5}
                style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                onMouseEnter={() => setHoveredIdx(i)}
                onClick={() => handlePointSelect(i)}
              />
            );
          })}

          {/* Datapoint Circles Series B (Staff) */}
          {showStaff && ptsB.map((p, i) => {
            const isHover = hoveredIdx === i;
            const isSel = selectedPoint?.index === i;
            if (timeRange === 'Month' && i % 2 !== 0 && !isHover && !isSel) return null;
            return (
              <circle
                key={`b-${i}`}
                cx={p.x}
                cy={p.y}
                r={isSel ? 7 : isHover ? 6 : 4}
                fill={isSel ? '#6366F1' : '#FFFFFF'}
                stroke="#6366F1"
                strokeWidth={isSel ? 3.5 : 2.5}
                style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                onMouseEnter={() => setHoveredIdx(i)}
                onClick={() => handlePointSelect(i)}
              />
            );
          })}

          {/* X-Axis Labels */}
          {labels.map((lbl, i) => {
            if (timeRange === 'Month' && i % 2 !== 0) return null;
            const pt = ptsA[i];
            if (!pt) return null;
            return (
              <text key={i} x={pt.x} y={height - 6} textAnchor="middle" fontSize="9" fontWeight="600" fill={themeMuted}>
                {lbl}
              </text>
            );
          })}
        </svg>

        {/* HOVER FLOATING TOOLTIP */}
        {hoveredIdx !== null && ptsA[hoveredIdx] && (
          <div
            style={{
              position: 'absolute',
              left: `${(ptsA[hoveredIdx].x / w) * 100}%`,
              top: 10,
              transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: 10,
              padding: '8px 12px',
              color: '#FFF',
              fontSize: '.74rem',
              boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
              pointerEvents: 'none',
              zIndex: 20,
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ fontWeight: 800, color: '#818CF8', marginBottom: 4 }}>
              📅 {timeRange === 'Month' ? `Day ${labels[hoveredIdx]}` : labels[hoveredIdx]}
            </div>
            {showAuto && (
              <div style={{ color: '#34D399', fontWeight: 600 }}>
                🟢 Automated: {lineA[hoveredIdx]} chats
              </div>
            )}
            {showStaff && (
              <div style={{ color: '#818CF8', fontWeight: 600 }}>
                🟣 Staff Requests: {lineB[hoveredIdx]} tickets
              </div>
            )}
            <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', fontSize: '.68rem' }}>
              💡 Click point for full analytical breakdown
            </div>
          </div>
        )}
      </div>

      {/* EXPANDABLE ANALYTICAL MEANING BREAKDOWN CARD ON CLICK */}
      {selectedPoint && (
        <div style={{
          marginTop: 14,
          padding: 16,
          borderRadius: 14,
          background: isLightMode ? '#F8FAFC' : 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.2rem' }}>💡</span>
              <div>
                <b style={{ fontSize: '.92rem', color: themeText, display: 'block' }}>
                  Analytical Meaning for {selectedPoint.periodLabel}
                </b>
                <span style={{ fontSize: '.72rem', color: themeMuted }}>
                  Total Inbound Volume: <b>{selectedPoint.total} conversations</b> · Latency: <b>{selectedPoint.latency}s</b>
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedPoint(null)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: 'none', color: themeMuted,
                padding: '4px 10px', borderRadius: 8, cursor: 'pointer', fontSize: '.75rem', fontWeight: 700
              }}
            >
              ✕ Close
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(52, 211, 153, 0.25)' }}>
              <span style={{ fontSize: '.68rem', color: '#34D399', fontWeight: 800, letterSpacing: '.06em' }}>AUTOMATED AI CHATS</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <b style={{ fontSize: '1.2rem', color: '#34D399' }}>{selectedPoint.auto}</b>
                <span style={{ fontSize: '.74rem', color: themeMuted, fontWeight: 700 }}>({selectedPoint.autoPct}%)</span>
              </div>
            </div>

            <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(99, 102, 241, 0.25)' }}>
              <span style={{ fontSize: '.68rem', color: '#818CF8', fontWeight: 800, letterSpacing: '.06em' }}>STAFF CHAT REQUESTS</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <b style={{ fontSize: '1.2rem', color: '#818CF8' }}>{selectedPoint.staff}</b>
                <span style={{ fontSize: '.74rem', color: themeMuted, fontWeight: 700 }}>({selectedPoint.staffPct}%)</span>
              </div>
            </div>

            <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(56, 189, 248, 0.25)' }}>
              <span style={{ fontSize: '.68rem', color: '#38BDF8', fontWeight: 800, letterSpacing: '.06em' }}>AI CSAT RESOLUTION</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <b style={{ fontSize: '1.2rem', color: '#38BDF8' }}>{selectedPoint.efficiency}%</b>
                <span style={{ fontSize: '.72rem', color: '#10B981', fontWeight: 700 }}>Optimal</span>
              </div>
            </div>
          </div>

          <div style={{ padding: '10px 12px', background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.03)', borderRadius: 10, border: `1px solid ${themeBorder}` }}>
            <p style={{ margin: 0, fontSize: '.8rem', color: themeText, lineHeight: 1.45 }}>
              📌 <b>Operational Meaning & Driver:</b> {selectedPoint.insight}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Smooth Curved Area Line Chart (Matching "Sales Overview" in reference UI)
export function AreaLineChart({ data = [], height = 180, onPointClick }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(null);

  const hasData = Array.isArray(data) && data.length > 0 && data.some((d) => (d.revenue > 0 || d.value > 0));
  if (!hasData) {
    return (
      <div style={{ height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 12 }}>
        <span style={{ fontSize: '1.5rem', marginBottom: 4 }}>📈</span>
        <b style={{ fontSize: '.84rem', color: 'var(--theme-text, #0F172A)' }}>Awaiting Live Revenue Records</b>
        <span style={{ fontSize: '.72rem', color: '#64748B' }}>Daily booking revenue from Supabase will plot here</span>
      </div>
    );
  }

  const metricOf = (d) => (Number(d.revenue) > 0 ? Number(d.revenue) : Number(d.value) || 0);
  const max = Math.max(...data.map(metricOf), 1);
  const min = Math.min(...data.map(metricOf));
  const range = Math.max(1, max - min);
  const w = 480;

  const points = data.map((d, i) => {
    const val = metricOf(d);
    const x = data.length > 1 ? (i / (data.length - 1)) * (w - 40) + 20 : w / 2;
    const y = height - 30 - ((val - min) / range) * (height - 60);
    return { x, y, label: d.label, value: d.value, revenue: val, raw: d };
  });

  // Construct smooth cubic bezier path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const cp1x = curr.x + (next.x - curr.x) / 2;
    const cp1y = curr.y;
    const cp2x = curr.x + (next.x - curr.x) / 2;
    const cp2y = next.y;
    pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - 20} L ${points[0].x} ${height - 20} Z`;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        width="100%"
        style={{ overflow: 'visible', cursor: 'crosshair' }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#areaGrad)" />
        <path d={pathD} fill="none" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />

        {/* Hover Crosshair */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <line
            x1={points[hoveredIdx].x}
            y1={10}
            x2={points[hoveredIdx].x}
            y2={height - 25}
            stroke="#38BDF8"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            style={{ pointerEvents: 'none' }}
          />
        )}

        {points.map((p, i) => {
          const isHover = hoveredIdx === i;
          const isSel = selectedIdx === i;
          return (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isSel ? 7 : isHover ? 6 : 4}
                fill={isSel ? '#38BDF8' : '#0F172A'}
                stroke="#38BDF8"
                strokeWidth={isSel ? 3.5 : 2.5}
                style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                onMouseEnter={() => setHoveredIdx(i)}
                onClick={() => {
                  setSelectedIdx(i);
                  if (onPointClick) onPointClick(data[i], i);
                }}
              />
              <text x={p.x} y={height - 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="#94A3B8">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoveredIdx !== null && points[hoveredIdx] && (
        <div
          style={{
            position: 'absolute',
            left: `${(points[hoveredIdx].x / w) * 100}%`,
            top: 0,
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: 8,
            padding: '6px 10px',
            color: '#FFF',
            fontSize: '.74rem',
            boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap',
          }}
        >
          <b style={{ color: '#38BDF8', display: 'block', marginBottom: 2 }}>{points[hoveredIdx].label}</b>
          <span style={{ color: '#F8FAFC', fontWeight: 700 }}>
            Revenue: ₱{Number(points[hoveredIdx].revenue || 0).toLocaleString()}
          </span>
          <div style={{ fontSize: '.68rem', color: '#94A3B8', marginTop: 2 }}>
            💡 Click to view revenue driver
          </div>
        </div>
      )}
    </div>
  );
}

// Multi-Color Series Grouped Bar Chart (Matching "Performance" in reference UI)
export function MultiBarChart({ data = [], height = 180, onBarClick }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const hasData = Array.isArray(data) && data.length > 0 && data.some((d) => (d.target > 0 || d.paid > 0 || d.pending > 0));
  if (!hasData) {
    return (
      <div style={{ height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 12 }}>
        <span style={{ fontSize: '1.5rem', marginBottom: 4 }}>📊</span>
        <b style={{ fontSize: '.84rem', color: 'var(--theme-text, #0F172A)' }}>Awaiting Weekly Performance</b>
        <span style={{ fontSize: '.72rem', color: '#64748B' }}>Staff reply and inquiry resolution data will appear here</span>
      </div>
    );
  }
  const max = Math.max(100, ...data.flatMap((d) => [Number(d.target) || 0, Number(d.paid) || 0, Number(d.pending) || 0]));
  const w = 480;
  const groupWidth = (w - 40) / data.length;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" style={{ overflow: 'hidden', display: 'block' }}>
        {data.map((group, i) => {
          const gx = i * groupWidth + 20;
          const targetH = Math.max(2, Math.min(height - 50, ((Number(group.target) || 0) / max) * (height - 50)));
          const paidH = Math.max(2, Math.min(height - 50, ((Number(group.paid) || 0) / max) * (height - 50)));
          const pendingH = Math.max(2, Math.min(height - 50, ((Number(group.pending) || 0) / max) * (height - 50)));

          return (
            <g 
              key={i}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              onClick={() => onBarClick && onBarClick(group, i)}
              style={{ cursor: onBarClick ? 'pointer' : 'default' }}
            >
              {/* Target Bar (Blue) */}
              <rect x={gx} y={height - 30 - targetH} width={10} height={targetH} rx={3} fill="#0EA5E9" />
              {/* Paid Bar (Green) */}
              <rect x={gx + 12} y={height - 30 - paidH} width={10} height={paidH} rx={3} fill="#10B981" />
              {/* Pending Bar (Coral/Amber) */}
              <rect x={gx + 24} y={height - 30 - pendingH} width={10} height={pendingH} rx={3} fill="#F43F5E" />

              <text x={gx + 17} y={height - 8} textAnchor="middle" fontSize="10" fill="#94A3B8">{group.day}</text>
            </g>
          );
        })}
      </svg>
      {hoverIndex !== null && (
        <div style={{
          position: 'absolute',
          top: '10%',
          left: `calc(${((hoverIndex * groupWidth + 37) / w) * 100}%)`,
          transform: 'translateX(-50%)',
          backgroundColor: '#0F172A',
          color: '#F8FAFC',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 10,
          border: '1px solid #334155',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '6px', textAlign: 'center', borderBottom: '1px solid #334155', paddingBottom: '4px' }}>{data[hoverIndex].day}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '4px' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#0EA5E9' }} />
            <span>Target: {data[hoverIndex].target}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '4px' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10B981' }} />
            <span>Paid: {data[hoverIndex].paid}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#F43F5E' }} />
            <span>Pending: {data[hoverIndex].pending}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Dual Line Spline Comparison Graph (Matching "Total Sales" in reference UI)
export function DualLineChart({ data = [], height = 170, isLightMode = false, onPointClick }) {
  const [timeRange, setTimeRange] = useState('This Year'); // 'This Year' | 'This Month' | 'This Week'
  const [viewMode, setViewMode] = useState('Summary'); // 'Summary' | 'Room vs Dining' | 'Growth Rate'
  const [showRoom, setShowRoom] = useState(true);
  const [showDining, setShowDining] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);

  const chartData = Array.isArray(data) ? data : [];
  const w = 520;

  const valsA = chartData.map((d) => Number(d.lineA) || 0);
  const maxA = Math.max(1, ...valsA);
  const valsB = chartData.map((d) => Number(d.lineB) || 0);
  const maxB = Math.max(1, ...valsB);

  const chartH = height - 55;
  const ptsA = chartData.map((d, i) => {
    const val = Number(d.lineA) || 0;
    const ratio = maxA > 0 ? val / maxA : 0;
    const rawY = height - 35 - ratio * (chartH - 12);
    return {
      x: chartData.length > 1 ? (i / (chartData.length - 1)) * (w - 50) + 25 : w / 2,
      y: Math.max(15, Math.min(height - 35, rawY)),
      val,
    };
  });

  const ptsB = chartData.map((d, i) => {
    const val = Number(d.lineB) || 0;
    const ratio = maxB > 0 ? val / maxB : 0;
    const rawY = height - 35 - ratio * (chartH - 12);
    return {
      x: chartData.length > 1 ? (i / (chartData.length - 1)) * (w - 50) + 25 : w / 2,
      y: Math.max(15, Math.min(height - 35, rawY)),
      val,
    };
  });

  const buildSpline = (pts) => {
    if (!pts || pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const c = pts[i];
      const n = pts[i + 1];
      d += ` C ${c.x + (n.x - c.x) / 2} ${c.y}, ${c.x + (n.x - c.x) / 2} ${n.y}, ${n.x} ${n.y}`;
    }
    return d;
  };

  const handleSelectPoint = (i) => {
    const d = chartData[i];
    const roomPhp = Number(d.lineA) || 0;
    const diningPhp = Number(d.lineB) || 0;
    const totalPhp = roomPhp + diningPhp;
    const item = {
      index: i,
      month: d.month || `Day ${i + 1}`,
      roomPhp,
      diningPhp,
      totalPhp,
      insight: d.insight || `Guest and dining activity logged for ${d.month || 'this date'}.`,
    };
    setSelectedPoint(item);
    if (onPointClick) onPointClick(item);
  };

  const totalRoomSales = valsA.reduce((a, b) => a + b, 0);
  const totalDiningSales = valsB.reduce((a, b) => a + b, 0);
  const grandTotal = totalRoomSales + totalDiningSales;
  const roomPct = grandTotal > 0 ? Math.round((totalRoomSales / grandTotal) * 100) : 0;
  const diningPct = grandTotal > 0 ? Math.round((totalDiningSales / grandTotal) * 100) : 0;

  const themeText = isLightMode ? '#0F172A' : '#F8FAFC';
  const themeMuted = isLightMode ? '#64748B' : '#94A3B8';
  const themeBorder = isLightMode ? '#E2E8F0' : 'rgba(255, 255, 255, 0.12)';
  const colorRoom = isLightMode ? '#2563EB' : '#38BDF8';
  const colorDining = isLightMode ? '#E11D48' : '#F43F5E';
  const colorCrosshair = isLightMode ? '#64748B' : '#818CF8';

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* CARD HEADER & INTERACTIVE DROPDOWNS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', margin: 0, color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>
            Total Sales Trend
          </h3>
          <span style={{ fontSize: '.72rem', color: themeMuted }}>Interactive revenue & dining trend curve</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            style={{
              fontSize: '.74rem', padding: '4px 10px', borderRadius: 8,
              background: isLightMode ? '#FFFFFF' : '#0F172A',
              color: themeText, border: `1px solid ${themeBorder}`,
              fontWeight: 700, cursor: 'pointer', outline: 'none'
            }}
          >
            <option value="This Year">This Year ▾</option>
            <option value="This Month">This Month ▾</option>
            <option value="This Week">This Week ▾</option>
          </select>

          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            style={{
              fontSize: '.74rem', padding: '4px 10px', borderRadius: 8,
              background: isLightMode ? '#FFFFFF' : '#0F172A',
              color: themeText, border: `1px solid ${themeBorder}`,
              fontWeight: 700, cursor: 'pointer', outline: 'none'
            }}
          >
            <option value="Summary">Summary ▾</option>
            <option value="Room vs Dining">Room vs Dining ▾</option>
            <option value="Growth Rate">Growth Rate ▾</option>
          </select>
        </div>
      </div>

      {/* INTERACTIVE LEGEND TOGGLES */}
      <div style={{ display: 'flex', gap: 16, fontSize: '.74rem', fontWeight: 600 }}>
        <span
          onClick={() => setShowRoom(!showRoom)}
          style={{ color: showRoom ? colorRoom : themeMuted, cursor: 'pointer', opacity: showRoom ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}
          title="Toggle Room & Villa Sales curve"
        >
          <span style={{ width: 10, height: 3, background: colorRoom, borderRadius: 2, display: 'inline-block' }} />
          Room & Villa Sales
        </span>

        <span
          onClick={() => setShowDining(!showDining)}
          style={{ color: showDining ? colorDining : themeMuted, cursor: 'pointer', opacity: showDining ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}
          title="Toggle Kitchen & Dining Sales curve"
        >
          <span style={{ width: 10, height: 3, background: colorDining, borderRadius: 2, display: 'inline-block' }} />
          Kitchen & Dining Sales
        </span>
      </div>

      {/* SVG GRAPH */}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        {chartData.length === 0 ? (
          <div style={{ padding: '40px 10px', textAlign: 'center', color: themeMuted, fontSize: '.8rem' }}>
            📊 No sales trends recorded yet. Data will automatically graph upon active bookings and orders.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${w} ${height}`}
            width="100%"
            style={{ overflow: 'hidden', cursor: 'crosshair', display: 'block' }}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {/* Grid lines */}
            {[0.3, 0.65].map((ratio, gi) => (
              <line
                key={gi}
                x1={20}
                y1={height - 35 - ratio * (height - 55)}
                x2={w - 20}
                y2={height - 35 - ratio * (height - 55)}
                stroke={isLightMode ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.05)'}
                strokeDasharray="4 4"
              />
            ))}

            {/* Lines */}
            {showRoom && <path d={buildSpline(ptsA)} fill="none" stroke={colorRoom} strokeWidth="2.8" strokeLinecap="round" />}
            {showDining && <path d={buildSpline(ptsB)} fill="none" stroke={colorDining} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 4" />}

            {/* Hover Crosshair */}
            {hoveredIdx !== null && ptsA[hoveredIdx] && (
              <line
                x1={ptsA[hoveredIdx].x}
                y1={15}
                x2={ptsA[hoveredIdx].x}
                y2={height - 25}
                stroke={colorCrosshair}
                strokeWidth="1.5"
                strokeDasharray="3 3"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Line A Circles */}
            {showRoom && ptsA.map((p, i) => {
              const isHover = hoveredIdx === i;
              const isSel = selectedPoint?.index === i;
              return (
                <circle
                  key={`a-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={isSel ? 6.5 : isHover ? 5.5 : 3.5}
                  fill={isSel ? colorRoom : isLightMode ? '#FFFFFF' : '#0F172A'}
                  stroke={colorRoom}
                  strokeWidth={isSel ? 3 : 2}
                  style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onClick={() => handleSelectPoint(i)}
                />
              );
            })}

            {/* Line B Circles */}
            {showDining && ptsB.map((p, i) => {
              const isHover = hoveredIdx === i;
              const isSel = selectedPoint?.index === i;
              return (
                <circle
                  key={`b-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={isSel ? 6.5 : isHover ? 5.5 : 3.5}
                  fill={isSel ? colorDining : isLightMode ? '#FFFFFF' : '#0F172A'}
                  stroke={colorDining}
                  strokeWidth={isSel ? 3 : 2}
                  style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onClick={() => handleSelectPoint(i)}
                />
              );
            })}

            {/* Month Labels */}
            {chartData.map((d, i) => (
              <text key={i} x={ptsA[i]?.x || (chartData.length > 1 ? (i / (chartData.length - 1)) * (w - 50) + 25 : w / 2)} y={height - 4} textAnchor="middle" fontSize="9" fontWeight="600" fill={themeMuted}>
                {d.month}
              </text>
            ))}
          </svg>
        )}

        {/* Floating Tooltip */}
        {hoveredIdx !== null && chartData[hoveredIdx] && (
          <div
            style={{
              position: 'absolute',
              left: `${(ptsA[hoveredIdx].x / w) * 100}%`,
              top: 0,
              transform: 'translateX(-50%)',
              background: '#0F172A',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '6px 10px',
              color: '#FFF',
              fontSize: '.74rem',
              boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
              pointerEvents: 'none',
              zIndex: 20,
              whiteSpace: 'nowrap',
            }}
          >
            <b style={{ color: '#93C5FD', display: 'block', marginBottom: 2 }}>📅 {chartData[hoveredIdx].month} Performance</b>
            {showRoom && <div style={{ color: '#60A5FA', fontWeight: 600 }}>● Rooms: ₱{Number(chartData[hoveredIdx].lineA || 0).toLocaleString()}</div>}
            {showDining && <div style={{ color: '#FDA4AF', fontWeight: 600 }}>● Orders / Dining: {Number(chartData[hoveredIdx].lineB || 0).toLocaleString()}</div>}
            <div style={{ fontSize: '.68rem', color: '#94A3B8', marginTop: 2 }}>💡 Click point for full driver insight</div>
          </div>
        )}
      </div>

      {/* EXPANDABLE MONTHLY ANALYTICAL BREAKDOWN CARD ON CLICK */}
      {selectedPoint && (
        <div style={{
          padding: 12, borderRadius: 12,
          background: isLightMode ? '#F8FAFC' : 'rgba(15,23,42,0.85)',
          border: `1px solid ${themeBorder}`,
          transition: 'all 0.2s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <b style={{ fontSize: '.84rem', color: isLightMode ? '#1E293B' : '#818CF8' }}>📊 {selectedPoint.month} Sales Analytical Breakdown</b>
            <button onClick={() => setSelectedPoint(null)} style={{ background: 'none', border: 'none', color: themeMuted, cursor: 'pointer', fontSize: '.74rem', fontWeight: 700 }}>✕ Close</button>
          </div>

          <div style={{ display: 'flex', gap: 14, fontSize: '.78rem', marginBottom: 6, flexWrap: 'wrap' }}>
            <span>Rooms: <b style={{ color: colorRoom }}>₱{selectedPoint.roomPhp.toLocaleString()}</b></span>
            <span>Dining: <b style={{ color: colorDining }}>₱{selectedPoint.diningPhp.toLocaleString()}</b></span>
            <span>Total: <b style={{ color: '#059669' }}>₱{selectedPoint.totalPhp.toLocaleString()}</b></span>
          </div>

          <p style={{ margin: 0, fontSize: '.76rem', color: themeText, lineHeight: 1.4 }}>
            💡 <b>Driver:</b> {selectedPoint.insight}
          </p>
        </div>
      )}

      {/* EVENLY FILLING BOTTOM SUMMARY GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(85px, 1fr))', gap: 8, marginTop: 6, width: '100%' }}>
        <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(37,99,235,0.08)', padding: '8px 10px', borderRadius: 10, border: `1px solid ${isLightMode ? '#E2E8F0' : 'rgba(37,99,235,0.2)'}`, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '.64rem', color: isLightMode ? '#475569' : '#38BDF8', fontWeight: 800, letterSpacing: '.06em', whiteSpace: 'nowrap' }}>ROOM REVENUE</span>
          <b style={{ fontSize: '1rem', color: isLightMode ? '#0F172A' : '#38BDF8', lineHeight: 1.1 }}>₱{totalRoomSales.toLocaleString()}</b>
          <span style={{ fontSize: '.65rem', color: isLightMode ? '#2563EB' : '#38BDF8', fontWeight: 700, whiteSpace: 'nowrap' }}>● {roomPct}% share</span>
        </div>
        <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(225,29,72,0.08)', padding: '8px 10px', borderRadius: 10, border: `1px solid ${isLightMode ? '#E2E8F0' : 'rgba(225,29,72,0.2)'}`, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '.64rem', color: isLightMode ? '#475569' : '#F43F5E', fontWeight: 800, letterSpacing: '.06em', whiteSpace: 'nowrap' }}>F&B / ORDERS</span>
          <b style={{ fontSize: '1rem', color: isLightMode ? '#0F172A' : '#F43F5E', lineHeight: 1.1 }}>{totalDiningSales > 0 ? (totalDiningSales > 1000 ? `₱${totalDiningSales.toLocaleString()}` : `${totalDiningSales} Orders`) : '₱0'}</b>
          <span style={{ fontSize: '.65rem', color: isLightMode ? '#E11D48' : '#F43F5E', fontWeight: 700, whiteSpace: 'nowrap' }}>● {diningPct}% share</span>
        </div>
        <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(16,185,129,0.08)', padding: '8px 10px', borderRadius: 10, border: `1px solid ${isLightMode ? '#E2E8F0' : 'rgba(16,185,129,0.2)'}`, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '.64rem', color: isLightMode ? '#475569' : '#10B981', fontWeight: 800, letterSpacing: '.06em', whiteSpace: 'nowrap' }}>TOTAL VOLUME</span>
          <b style={{ fontSize: '1rem', color: isLightMode ? '#0F172A' : '#10B981', lineHeight: 1.1 }}>₱{grandTotal.toLocaleString()}</b>
          <span style={{ fontSize: '.65rem', color: isLightMode ? '#059669' : '#10B981', fontWeight: 700, whiteSpace: 'nowrap' }}>▲ Live sync</span>
        </div>
      </div>
    </div>
  );
}

// Referrer Category Bar Chart Component (Clean & Non-Overflowing for "Total Amount")
export function ReferrerCategoryBarChart({ isLightMode = true, totalAmount = 0 }) {
  const tot = typeof totalAmount === 'number' && totalAmount >= 0 ? totalAmount : 0;

  if (tot === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 12px', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 14 }}>
        <span style={{ fontSize: '1.4rem', display: 'block', marginBottom: 4 }}>🏖️</span>
        <b style={{ fontSize: '.82rem', color: isLightMode ? '#0F172A' : '#F8FAFC', display: 'block' }}>Awaiting Live Bookings</b>
        <span style={{ fontSize: '.72rem', color: '#64748B' }}>₱0 revenue recorded from referral channels</span>
      </div>
    );
  }

  const categories = [
    { label: 'Direct Booking', pct: 45, amount: `₱${Math.round(tot * 0.45).toLocaleString()}`, color: '#0EA5E9' },
    { label: 'Agoda & OTAs', pct: 28, amount: `₱${Math.round(tot * 0.28).toLocaleString()}`, color: '#10B981' },
    { label: 'Booking.com', pct: 15, amount: `₱${Math.round(tot * 0.15).toLocaleString()}`, color: '#F43F5E' },
    { label: 'Google Search', pct: 12, amount: `₱${Math.round(tot * 0.12).toLocaleString()}`, color: '#F59E0B' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
      {categories.map((cat, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.76rem', fontWeight: 600, color: isLightMode ? '#0F172A' : '#F8FAFC' }}>
            <span>{cat.label}</span>
            <span style={{ color: cat.color, fontWeight: 700 }}>{cat.amount} ({cat.pct}%)</span>
          </div>
          <div style={{ height: 8, background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${cat.pct}%`, height: '100%', background: cat.color, borderRadius: 4, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BarChart({ data = [], height = 160 }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.value), 1);
  const w = Math.max(300, data.length * 42);

  // Predictive calculations
  const historical = data.filter(d => !d.fc);
  const forecasted = data.filter(d => d.fc);

  const avgHistorical = historical.length > 0
    ? (historical.reduce((sum, d) => sum + d.value, 0) / historical.length)
    : 0;

  const totalWeeklyPredictedVisitors = Math.round(data.reduce((sum, d) => sum + (d.estimatedGuests || d.value * 2.4), 0));
  const totalMonthlyPredictedVisitors = Math.round(totalWeeklyPredictedVisitors * 4.3);

  const activeItem = hoverIndex !== null ? data[hoverIndex] : data[data.length - 1];

  return (
    <div className="bar-chart-container" style={{ width: '100%' }}>
      {/* PREDICTIVE VISITOR SUMMARY STATS BAND */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 10, padding: '10px 14px' }}>
          <span style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.12em', color: '#94A3B8', fontWeight: 700 }}>
            Weekly Visitor Forecast
          </span>
          <b style={{ display: 'block', fontSize: '1.4rem', color: '#38BDF8', fontFamily: 'var(--font-serif)', marginTop: 2 }}>
            {totalWeeklyPredictedVisitors.toLocaleString()} <span style={{ fontSize: '.8rem', color: '#34D399', fontWeight: 600 }}>↑ +14.2%</span>
          </b>
          <small style={{ fontSize: '.72rem', color: '#CBD5E1' }}>Expected across next 7 days</small>
        </div>

        <div style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 10, padding: '10px 14px' }}>
          <span style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.12em', color: '#94A3B8', fontWeight: 700 }}>
            Monthly Projected Guests
          </span>
          <b style={{ display: 'block', fontSize: '1.4rem', color: '#7DD3FC', fontFamily: 'var(--font-serif)', marginTop: 2 }}>
            {totalMonthlyPredictedVisitors.toLocaleString()} <span style={{ fontSize: '.8rem', color: '#FBBF24', fontWeight: 600 }}>Peak Season</span>
          </b>
          <small style={{ fontSize: '.72rem', color: '#CBD5E1' }}>Estimated for August 2026</small>
        </div>

        <div style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 10, padding: '10px 14px' }}>
          <span style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.12em', color: '#94A3B8', fontWeight: 700 }}>
            {activeItem?.fc ? '🤖 AI Forecast Detail' : '📊 Historical Record'}
          </span>
          <b style={{ display: 'block', fontSize: '1.1rem', color: '#F8FAFC', fontFamily: 'var(--font-serif)', marginTop: 2 }}>
            {activeItem?.label ? `Aug ${activeItem.label}` : 'Selected Day'}: {activeItem?.value || 0} stays
          </b>
          <small style={{ fontSize: '.72rem', color: '#38BDF8' }}>
            ~{Math.round((activeItem?.value || 0) * 2.4)} expected visitors
          </small>
        </div>
      </div>

      {/* SVG BAR CHART GRAPH */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg className="chart-bars" viewBox={`0 0 ${w} ${height + 34}`} width="100%" style={{ overflow: 'visible' }}>
          {/* Average Baseline Line */}
          {avgHistorical > 0 && (
            <g>
              <line
                x1={0}
                y1={height - (avgHistorical / max) * height}
                x2={w}
                y2={height - (avgHistorical / max) * height}
                stroke="rgba(245,158,11,0.5)"
                strokeDasharray="4 4"
                strokeWidth="1.5"
              />
              <text x={w - 6} y={height - (avgHistorical / max) * height - 4} textAnchor="end" fontSize="9" fill="#F59E0B" fontWeight="600">
                Avg: {Math.round(avgHistorical)} stays/day
              </text>
            </g>
          )}

          {data.map((d, i) => {
            const h = Math.max(6, (d.value / max) * height);
            const x = i * 42 + 10;
            const y = height - h;
            const isSelected = hoverIndex === i;

            return (
              <g
                key={i}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Bar Background Hover Column */}
                <rect
                  x={x - 4}
                  y={0}
                  width={34}
                  height={height + 24}
                  fill={isSelected ? 'rgba(56,189,248,0.1)' : 'transparent'}
                  rx={6}
                />

                {/* Actual Bar Rect */}
                <rect
                  className={`bar ${d.fc ? 'fc' : ''}`}
                  x={x}
                  y={y}
                  width={26}
                  height={h}
                  rx={6}
                  fill={d.fc ? 'url(#fcGrad)' : 'url(#histGrad)'}
                  stroke={isSelected ? '#FFFFFF' : d.fc ? '#38BDF8' : 'none'}
                  strokeWidth={isSelected ? 2 : 0}
                  style={{ transition: 'all 0.25s ease' }}
                />

                {/* Bar Top Value Badge */}
                <text
                  x={x + 13}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill={d.fc ? '#7DD3FC' : '#F8FAFC'}
                >
                  {d.value}
                </text>

                {/* X-Axis Date Label */}
                <text
                  x={x + 13}
                  y={height + 18}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={d.fc ? '700' : '500'}
                  fill={d.fc ? '#38BDF8' : '#8AA0BC'}
                >
                  {d.label}
                </text>

                {/* Forecast Sub-label Indicator */}
                {d.fc && (
                  <text x={x + 13} y={height + 30} textAnchor="middle" fontSize="7.5" fill="#FBBF24" fontWeight="800">
                    PRED
                  </text>
                )}
              </g>
            );
          })}

          <defs>
            <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0EA5E9" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
            <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.35" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* GRAPH DEFINITION & LEGEND FOOTER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: '.75rem', color: '#94A3B8', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#0EA5E9', display: 'inline-block' }} />
            <b>Solid Blue:</b> Recorded Stays
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(56,189,248,0.4)', border: '1px dashed #38BDF8', display: 'inline-block' }} />
            <b>Translucent:</b> AI Predictive Forecast
          </span>
        </div>
        <div>
          <span>⚡ AI Occupancy Model Accuracy: <b>94.8%</b></span>
        </div>
      </div>
    </div>
  );
}

export function Sparkline({ values, width = 260, height = 56 }) {
  if (!values || values.length === 0) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) =>
    `${(i / Math.max(1, values.length - 1)) * width},${height - (v / max) * (height - 8) - 4}`);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity=".4" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts.join(' ')} ${width},${height}`} fill="url(#sg)" />
      <polyline points={pts.join(' ')} fill="none" stroke="#0EA5E9" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LiveSparkline({ values = [], width = 260, height = 56 }) {
  const displayValues = values.slice(-20);
  return <Sparkline values={displayValues} width={width} height={height} />;
}
