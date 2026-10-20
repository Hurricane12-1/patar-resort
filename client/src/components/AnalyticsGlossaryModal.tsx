import { useState } from 'react';
import { IconTelemetry, IconTrendingUp, IconCreditCard, IconWallet, IconBuilding, IconLedger, IconStar } from './AdminIcons.tsx';

export function AnalyticsGlossaryModal({ isLightMode = false, onClose }) {
  const [activeTab, setActiveTab] = useState('all');

  const themeCardBg = isLightMode ? '#FFFFFF' : 'rgba(15, 23, 42, 0.95)';
  const themeText = isLightMode ? '#0F172A' : '#F8FAFC';
  const themeMuted = isLightMode ? '#64748B' : '#94A3B8';
  const themeBorder = isLightMode ? '#E2E8F0' : 'rgba(255, 255, 255, 0.12)';

  const definitions = [
    {
      id: 'kpi-1',
      category: 'kpi',
      title: 'TOTAL VISITORS ANALYTICS',
      icon: <IconTrendingUp size={22} color="#0EA5E9" />,
      tag: 'Traffic & Reach Metric',
      definition: 'The total count of unique digital user sessions and physical guest check-ins detected via real-time WebSocket telemetry pings.',
      formula: 'Unique IP Telemetry Sessions + Confirmed In-Person Guest Registrations',
      businessMeaning: 'Measures top-of-funnel marketing reach and guest interest. An upward trend (+6.65%) indicates high digital engagement and successful ad campaigns.',
      actionableGuidance: 'If visitor traffic spikes without booking conversions, inspect room pricing or deposit checkout friction.',
    },
    {
      id: 'kpi-2',
      category: 'kpi',
      title: 'TOTAL BOOKINGS ANALYTICS',
      icon: <IconCreditCard size={22} color="#38BDF8" />,
      tag: 'Reservation Demand Metric',
      definition: 'Gross monetary value of all confirmed, checked-in, and pending room reservations booked for the period.',
      formula: 'Sum(Nights Reserved × Room Rate PHP) - Discounts + Add-on Amenities',
      businessMeaning: 'Primary revenue driver for core lodging operations. Measures room demand and booking volume across cottages, villas, and suites.',
      actionableGuidance: 'Monitor booking growth (+8.60%). High booking velocity signals opportunity for dynamic peak-season pricing increases.',
    },
    {
      id: 'kpi-3',
      category: 'kpi',
      title: 'GROSS REVENUE ANALYTICS',
      icon: <IconWallet size={22} color="#F59E0B" />,
      tag: 'Financial Performance Metric',
      definition: 'Combined cumulative cash inflow from Room Stays, Kitchen & Dining F&B sales, and auxiliary resort services.',
      formula: 'Lodging Room Revenue + F&B Dining Sales + Event Hall & Amenities Rentals',
      businessMeaning: 'Represents overall top-line financial health. Evaluates how effectively room revenue is augmented by food and dining upsells.',
      actionableGuidance: 'Compare Gross Revenue against target budgets. Aim for F&B dining to contribute at least 30% of total gross revenue.',
    },
    {
      id: 'kpi-4',
      category: 'kpi',
      title: 'OCCUPANCY RATE ANALYTICS',
      icon: <IconBuilding size={22} color="#8B5CF6" />,
      tag: 'Capacity Utilization Metric',
      definition: 'The proportion of available room units sold versus total resort room capacity over the target timeframe.',
      formula: '(Total Sold Room Nights / Total Available Room Units) × 100 [Current: 78%]',
      businessMeaning: 'Measures room inventory efficiency. An occupancy rate above 75% signifies optimal asset utilization.',
      actionableGuidance: 'During low-season dips (-3.45%), launch weekend getaway promo packages or corporate retreat discounts.',
    },
    {
      id: 'chart-1',
      category: 'charts',
      title: 'SALES OVERVIEW (CUBIC SPLINE CURVE)',
      icon: <IconTelemetry size={22} color="#0EA5E9" />,
      tag: 'Revenue Velocity Graph',
      definition: 'Velocity curve visualizing daily revenue generation trends and acceleration over the current billing month.',
      formula: 'Cubic Bezier Smooth Curve Interpolation of Daily Settled Payments',
      businessMeaning: 'Helps management identify peak revenue days (e.g., Friday/Saturday surges) versus midweek lull periods.',
      actionableGuidance: 'Use peak curve insights to schedule extra kitchen staff and receptionists during predicted high-volume days.',
    },
    {
      id: 'chart-2',
      category: 'charts',
      title: 'WEEKLY PERFORMANCE (GROUPED MULTI-BAR)',
      icon: <IconLedger size={22} color="#10B981" />,
      tag: 'Payment Conversion Funnel',
      definition: 'Booking conversion funnel comparing weekly Target Revenue, Settled Paid Revenue, and Outstanding Pending Balances.',
      formula: 'Grouped Bar Comparison of Target PHP vs Settled Cash vs Uncollected Payments',
      businessMeaning: 'Pinpoints accounts receivable risks and payment collection bottlenecks before guest check-outs.',
      actionableGuidance: 'If red Pending bars exceed green Paid bars, dispatch automatic Twilio SMS payment reminder pings to guests.',
    },
    {
      id: 'chart-3',
      category: 'charts',
      title: 'TOTAL SALES TREND (DUAL LINE COMPARISON)',
      icon: <IconTrendingUp size={22} color="#F59E0B" />,
      tag: 'Budget Target Comparison',
      definition: 'Comparative dual-spline graph evaluating actual sales revenue performance against projected baseline targets.',
      formula: 'Line A (Actual Revenue Trend) vs Line B (Target Budget Baseline)',
      businessMeaning: 'Visually alerts general management whenever actual sales fall below budget targets.',
      actionableGuidance: 'When Line A crosses above Line B, budget targets are exceeded; allocate surplus to resort upgrades.',
    },
    {
      id: 'chart-4',
      category: 'charts',
      title: 'GUEST LIFETIME VALUE & USER RATING',
      icon: <IconStar size={22} color="#F59E0B" />,
      tag: 'VIP Loyalty Analytics',
      definition: 'Ranking of high-value repeat guests based on historical spend (CLV) and satisfaction rating feedback.',
      formula: 'Sum(Lifetime Spend PHP) sorted descending with 5-star weighted rating average',
      businessMeaning: 'Identifies top VIP clientele who drive repeat visits and word-of-mouth resort recommendations.',
      actionableGuidance: 'Provide automatic complimentary room upgrades or free dining vouchers to 5.0-star VIP guests.',
    },
  ];

  const filtered = definitions.filter(d => activeTab === 'all' || d.category === activeTab);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 20, width: '100%', maxWidth: 860, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', color: themeText }}>
        
        {/* MODAL HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${themeBorder}`, paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <span className="label light" style={{ letterSpacing: '.18em' }}>Executive Business Intelligence</span>
            <h2 style={{ fontSize: '1.6rem', margin: '4px 0 0', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>
              <><i className="fas fa-book-open" style={{ marginRight: 8, color: '#0EA5E9' }} />Executive Data Analytics Glossary & Definitions</>
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: `1px solid ${themeBorder}`, color: themeText, borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', cursor: 'pointer' }}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* CATEGORY FILTER TABS */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button onClick={() => setActiveTab('all')} className={`chip ${activeTab === 'all' ? 'sel' : ''}`}>
            ALL METRICS & CHARTS ({definitions.length})
          </button>
          <button onClick={() => setActiveTab('kpi')} className={`chip ${activeTab === 'kpi' ? 'sel' : ''}`}>
            KPI METRIC CARDS
          </button>
          <button onClick={() => setActiveTab('charts')} className={`chip ${activeTab === 'charts' ? 'sel' : ''}`}>
            GRAPHS & TREND CHARTS
          </button>
        </div>

        {/* DEFINITIONS LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map((item) => (
            <div key={item.id} style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 14, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {item.icon}
                  <b style={{ fontSize: '1rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{item.title}</b>
                </div>
                <span className="pill confirmed" style={{ fontSize: '.7rem' }}>{item.tag}</span>
              </div>

              <p style={{ fontSize: '.88rem', color: themeText, margin: '0 0 10px', lineHeight: 1.5 }}>
                <b>Definition:</b> {item.definition}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '.8rem', background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.8)', border: `1px solid ${themeBorder}`, borderRadius: 10, padding: 12 }}>
                <div>
                  <b style={{ color: '#0EA5E9', display: 'block', marginBottom: 2 }}><><i className="fas fa-calculator" style={{ marginRight: 6 }} />Formula / Calculation:</></b>
                  <code style={{ fontSize: '.78rem', color: themeText }}>{item.formula}</code>
                </div>
                <div>
                  <b style={{ color: '#F59E0B', display: 'block', marginBottom: 2 }}><><i className="fas fa-bullseye" style={{ marginRight: 6 }} />Executive Business Meaning:</></b>
                  <span style={{ color: themeMuted }}>{item.businessMeaning}</span>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: '.8rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: 6 }}>
                <b><i className="fas fa-lightbulb" style={{ marginRight: 6, color: '#F59E0B' }} />Recommended Management Action:</b> <span>{item.actionableGuidance}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <button className="btn btn-sky" onClick={onClose} style={{ padding: '8px 24px' }}>
            Close Glossary & Return to Dashboard ✦
          </button>
        </div>
      </div>
    </div>
  );
}
