import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import '../styles/accounting.css';
import CsvTableViewer from '../components/CsvTableViewer.tsx';
import { api } from '../lib/api.ts';
import { money, fmtDate } from '../lib/format.ts';
import { toast } from '../components/Toasts.tsx';
import PriceChangeRequestPanel from '../components/PriceChangeRequestPanel.tsx';
import { canAccessPortal } from '../lib/rbac.ts';

export default function Accounting() {
  const { staffProfile, adminProfile } = useAuth();
  const currentProf = staffProfile || adminProfile;
  const isAuthorized = canAccessPortal(currentProf, 'accounting');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthorized) {
      api.analyticsOverview()
        .then(setData)
        .catch((e) => toast(e.message, true))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isAuthorized]);

  if (!isAuthorized) {
    return (
      <div className="staff-denied-container">
        <div className="staff-denied-card">
          <div className="staff-denied-icon" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.15)', color: '#D97706' }}>
            <i className="fas fa-calculator" />
          </div>
          <span className="label" style={{ color: '#D97706', fontWeight: 700 }}>Finance &amp; Audit Boundary</span>
          <h2 className="serif" style={{ fontSize: '1.6rem', margin: '8px 0 12px', color: '#0F172A', fontWeight: 800 }}>
            Accounting Clearance Required
          </h2>
          <p style={{ marginBottom: 24, fontSize: '.88rem', lineHeight: 1.6, color: '#64748B' }}>
            You do not have active Finance &amp; Accounting clearance to inspect financial ledgers, audit logs, or revenue transactions.
          </p>
          <Link to="/staff/login" className="btn btn-sky" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'linear-gradient(135deg, #0284C7, #0369A1)', color: '#FFFFFF', borderRadius: 12, textDecoration: 'none', fontWeight: 700 }}>
            <i className="fas fa-right-to-bracket" />
            <span>Go to Staff Station Sign In</span>
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="staff-accounting-workspace" style={{ padding: '24px 0' }}>
        <div className="skel" style={{ height: 380, borderRadius: 18 }} />
      </div>
    );
  }

  const { overview: ov = {} } = data;

  return (
    <div className="staff-accounting-workspace">
      {/* Executive Header Banner */}
      <div className="accounting-header-banner">
        <div>
          <span className="label" style={{ color: '#D97706', fontWeight: 700, fontSize: '11px', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            <i className="fas fa-coins" style={{ marginRight: 6 }} /> Finance &amp; Revenue Control
          </span>
          <h2 className="accounting-header-title">
            Financial Audit <em style={{ fontStyle: 'italic', color: '#0284C7' }}>&amp; Ledgers Portal</em>
          </h2>
          <p className="accounting-header-sub">
            Real-time resort financial health, revenue stream breakdown, and Supabase audit reconciliation
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sky btn-sm"
          onClick={api.exportAnalyticsCSV}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, fontWeight: 700 }}
        >
          <i className="fas fa-file-arrow-down" />
          <span>Export Financial Audit CSV</span>
        </button>
      </div>

      {/* FINANCIAL KPIS (4-Column Executive Grid) */}
      <div className="accounting-stat-grid">
        <div className="accounting-kpi-card">
          <span className="accounting-kpi-label">Gross Resort Revenue</span>
          <b className="accounting-kpi-val">{money(ov.total_revenue_php || 0)}</b>
          <span className="accounting-kpi-hint">All reconciled stays &amp; add-ons</span>
        </div>
        <div className="accounting-kpi-card">
          <span className="accounting-kpi-label">ADR (Avg Daily Rate)</span>
          <b className="accounting-kpi-val">
            {money(ov.adr_php || 0)} <span style={{ fontSize: '.75rem', fontWeight: 500, color: '#64748B' }}>/ night</span>
          </b>
          <span className="accounting-kpi-hint">Across active rooms</span>
        </div>
        <div className="accounting-kpi-card">
          <span className="accounting-kpi-label">RevPAR (Rev per Room)</span>
          <b className="accounting-kpi-val">{money(ov.revpar_php || 0)}</b>
          <span className="accounting-kpi-hint">Capacity performance index</span>
        </div>
        <div className="accounting-kpi-card">
          <span className="accounting-kpi-label">Weekly Revenue Total</span>
          <b className="accounting-kpi-val">{money(ov.revenue_week_php || 0)}</b>
          <span className="accounting-kpi-hint">Current 7-day operational cycle</span>
        </div>
      </div>

      {/* REVENUE BREAKDOWN & AUDIT SUMMARY */}
      <div className="admin-grid">
        <div className="panel">
          <h3 className="serif" style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 16px', color: '#0F172A' }}>
            Revenue Stream Breakdown
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="bk-row">
              <div className="bk-main">
                <h4>Room Stays &amp; Lodging</h4>
                <p className="muted small">Overnight rooms and verified day-use cottage reservations</p>
              </div>
              <b className="serif" style={{ fontSize: '1.25rem', color: '#0284C7' }}>
                {money(ov.room_revenue_php || 0)}
              </b>
            </div>

            <div className="bk-row">
              <div className="bk-main">
                <h4>Resort Amenities &amp; Pool Access</h4>
                <p className="muted small">Day &amp; night pool access add-ons and guest amenities</p>
              </div>
              <b className="serif" style={{ fontSize: '1.25rem', color: '#0284C7' }}>
                {money(ov.dining_revenue_php || 0)}
              </b>
            </div>

            <div className="bk-row">
              <div className="bk-main">
                <h4>Island Outrigger Tours</h4>
                <p className="muted small">Patar excursions, boat charters, and island tours</p>
              </div>
              <b className="serif" style={{ fontSize: '1.25rem', color: '#0284C7' }}>
                {money(ov.tour_revenue_php || 0)}
              </b>
            </div>
          </div>
        </div>

        <div className="panel">
          <h3 className="serif" style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 12px', color: '#0F172A' }}>
            Accounting Audit Summary
          </h3>
          <p className="muted small" style={{ marginBottom: 20, lineHeight: 1.6, color: '#64748B' }}>
            All payments are reconciled against Supabase database constraints, verified front-desk check-ins, and guest folio vouchers.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="muted small" style={{ color: '#64748B' }}>Reconciliation Status</span>
              <span className="pill confirmed" style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontWeight: 700 }}>Fully Reconciled</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="muted small" style={{ color: '#64748B' }}>Operational Currency</span>
              <strong style={{ color: '#0F172A', fontWeight: 700 }}>Philippine Pesos (PHP ₱)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="muted small" style={{ color: '#64748B' }}>Tax &amp; Compliance Rule</span>
              <span className="tag" style={{ margin: 0, background: '#F1F5F9', color: '#334155' }}>Standard Resort Lodging Rate</span>
            </div>
          </div>
        </div>
      </div>

      {/* CSV FINANCIAL AUDIT AUTO-READER (Executive Light Theme) */}
      <div style={{ marginTop: 8 }}>
        <CsvTableViewer
          title="Financial Audit & Transaction Ledger CSV Reader"
          defaultFilename="jd_financial_audit.csv"
          isLightMode={true}
        />
      </div>

      {/* RATE CHANGE PERMISSION REQUESTS & ADMIN CODE REDEMPTION */}
      <PriceChangeRequestPanel />
    </div>
  );
}
