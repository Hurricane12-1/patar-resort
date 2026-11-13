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
  const { profile, adminProfile } = useAuth();
  const currentProf = adminProfile || profile;
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
          <div className="staff-denied-icon" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24' }}>
            <i className="fas fa-calculator" />
          </div>
          <span className="label" style={{ color: '#FBBF24' }}>Finance &amp; Audit Boundary</span>
          <h2 className="serif" style={{ fontSize: '1.8rem', margin: '8px 0 12px', color: '#FFFFFF' }}>
            Accounting Clearance Required
          </h2>
          <p className="muted" style={{ marginBottom: 24, fontSize: '.88rem', lineHeight: 1.6 }}>
            You do not have active Finance &amp; Accounting clearance to inspect financial ledgers, audit logs, or revenue transactions.
          </p>
          <Link to="/staff/login" className="btn btn-sky" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
            <i className="fas fa-right-to-bracket" />
            <span>Go to Staff Station Sign In</span>
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="container" style={{ padding: '40px 16px' }}>
        <div className="skel" style={{ height: 380, borderRadius: 18 }} />
      </div>
    );
  }

  const { overview: ov = {} } = data;

  return (
    <div className="container" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px 60px' }}>
      {/* Header */}
      <div className="sec-head">
        <div>
          <span className="label" style={{ color: '#FBBF24' }}>
            <i className="fas fa-coins" /> Finance &amp; Revenue Control
          </span>
          <h2 className="serif" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.2rem)' }}>
            Financial Audit <em style={{ fontStyle: 'italic', color: '#FBBF24' }}>&amp; Ledgers Portal</em>
          </h2>
        </div>
        <button
          type="button"
          className="btn btn-sky btn-sm"
          onClick={api.exportAnalyticsCSV}
        >
          <i className="fas fa-file-arrow-down" />
          <span>Export Financial Audit CSV</span>
        </button>
      </div>

      {/* FINANCIAL KPIS */}
      <div className="stat-cards" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <small>Gross Resort Revenue</small>
          <b>{money(ov.total_revenue_php || 0)}</b>
        </div>
        <div className="stat-card">
          <small>ADR (Avg Daily Rate)</small>
          <b>{money(ov.adr_php || 0)} <span style={{ fontSize: '.75rem', fontWeight: 500, color: '#64748B' }}>/ night</span></b>
        </div>
        <div className="stat-card">
          <small>RevPAR (Rev per Room)</small>
          <b>{money(ov.revpar_php || 0)}</b>
        </div>
        <div className="stat-card">
          <small>Weekly Revenue Total</small>
          <b>{money(ov.revenue_week_php || 0)}</b>
        </div>
      </div>

      {/* REVENUE BREAKDOWN & AUDIT SUMMARY */}
      <div className="admin-grid">
        <div className="panel">
          <h3 className="serif" style={{ fontSize: '1.45rem', margin: '0 0 16px' }}>
            Revenue Stream Breakdown
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="bk-row">
              <div className="bk-main">
                <h4>Room Stays &amp; Lodging</h4>
                <p className="muted small">Overnight rooms and verified day-use cottage reservations</p>
              </div>
              <b className="serif" style={{ fontSize: '1.25rem', color: '#38BDF8' }}>
                {money(ov.room_revenue_php || 0)}
              </b>
            </div>

            <div className="bk-row">
              <div className="bk-main">
                <h4>Resort Amenities &amp; Pool Access</h4>
                <p className="muted small">Day &amp; night pool access add-ons and guest amenities</p>
              </div>
              <b className="serif" style={{ fontSize: '1.25rem', color: '#38BDF8' }}>
                {money(ov.dining_revenue_php || 0)}
              </b>
            </div>

            <div className="bk-row">
              <div className="bk-main">
                <h4>Island Outrigger Tours</h4>
                <p className="muted small">Patar excursions, boat charters, and island tours</p>
              </div>
              <b className="serif" style={{ fontSize: '1.25rem', color: '#38BDF8' }}>
                {money(ov.tour_revenue_php || 0)}
              </b>
            </div>
          </div>
        </div>

        <div className="panel">
          <h3 className="serif" style={{ fontSize: '1.45rem', margin: '0 0 12px' }}>
            Accounting Audit Summary
          </h3>
          <p className="muted small" style={{ marginBottom: 20, lineHeight: 1.6 }}>
            All payments are reconciled against Supabase database constraints, verified front-desk check-ins, and guest folio vouchers.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="muted small">Reconciliation Status</span>
              <span className="pill confirmed">Fully Reconciled</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="muted small">Operational Currency</span>
              <strong style={{ color: '#FFFFFF' }}>Philippine Pesos (PHP ₱)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="muted small">Tax &amp; Compliance Rule</span>
              <span className="tag" style={{ margin: 0 }}>Standard Resort Lodging Rate</span>
            </div>
          </div>
        </div>
      </div>

      {/* CSV FINANCIAL AUDIT AUTO-READER */}
      <div style={{ marginTop: 28 }}>
        <CsvTableViewer
          title="Financial Audit & Transaction Ledger CSV Reader"
          defaultFilename="jd_financial_audit.csv"
        />
      </div>

      {/* RATE CHANGE PERMISSION REQUESTS & ADMIN CODE REDEMPTION */}
      <PriceChangeRequestPanel />
    </div>
  );
}
