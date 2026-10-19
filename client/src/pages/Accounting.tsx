import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import '../styles/accounting.css';
import CsvTableViewer from '../components/CsvTableViewer.tsx';
import { api } from '../lib/api.ts';
import { money, fmtDate } from '../lib/format.ts';
import { toast } from '../components/Toasts.tsx';

export default function Accounting() {
  const { profile, adminProfile, signIn, adminSignIn } = useAuth();
  const currentProf = adminProfile || profile;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (currentProf && ['accounting', 'administrator', 'admin'].includes(currentProf.role)) {
      api.analyticsOverview()
        .then(setData)
        .catch((e) => toast(e.message, true))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [currentProf]);

  async function handleAccountingLogin(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = adminSignIn ? await adminSignIn(email, password) : await signIn(email, password);
      if (res?.error) throw res.error;
      toast('Accounting Portal Authenticated ✦');
    } catch (err) {
      toast(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  // DEDICATED SEPARATE ACCOUNTING LOGIN PORTAL
  if (!currentProf || !['accounting', 'administrator', 'admin'].includes(currentProf.role)) {
    return (
      <div className="container section">
        <div className="gate" style={{ maxWidth: 460, borderTop: '5px solid var(--amber)' }}>
          <span className="label" style={{ color: 'var(--amber)' }}>Finance & Audit Portal</span>
          <h2 className="serif" style={{ fontSize: '2.2rem', margin: '8px 0 12px' }}>Accounting Sign-In</h2>
          <p className="muted" style={{ marginBottom: 24, fontSize: '.92rem' }}>
            Dedicated portal for accounting officers, financial auditors, and revenue managers.
          </p>

          <form onSubmit={handleAccountingLogin} style={{ textAlign: 'left' }}>
            <div className="field">
              <label>ACCOUNTING EMAIL</label>
              <input
                type="email"
                required
                value={email}
                placeholder="accounting@jdbeachhouse.ph"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label>PASSWORD</label>
              <input
                type="password"
                required
                value={password}
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className="btn btn-sky" style={{ width: '100%', justifyContent: 'center', marginTop: 12, background: 'var(--amber)' }} disabled={busy}>
              {busy ? 'Authenticating…' : 'Sign In to Accounting Portal 📊'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="container section">
        <div className="skel" style={{ height: 320 }} />
      </div>
    );
  }

  const { overview: ov = {} } = data;

  return (
    <div className="container section">
      <div className="sec-head">
        <div>
          <span className="label" style={{ color: 'var(--amber)' }}>Finance & Revenue Control</span>
          <h2 className="serif" style={{ fontSize: 'clamp(2.2rem,4.4vw,3.6rem)' }}>
            Accounting <em style={{ fontStyle: 'italic' }}>Audit & Ledger Portal</em>
          </h2>
        </div>
        <button className="btn btn-sky btn-sm" onClick={api.exportAnalyticsCSV}>
          📥 Export Financial Audit CSV
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
          <b>{money(ov.adr_php || 0)} / night</b>
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

      {/* REVENUE BREAKDOWN */}
      <div className="admin-grid">
        <div className="panel">
          <h3 className="serif" style={{ fontSize: '1.4rem', marginBottom: 16 }}>Revenue Category Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="bk-row">
              <div className="bk-main">
                <h4>Room Accommodations</h4>
                <p className="muted small">Suite, Villa & Cottage Night Stays</p>
              </div>
              <b className="serif" style={{ fontSize: '1.2rem', color: 'var(--blue)' }}>{money(ov.room_revenue_php || 0)}</b>
            </div>

            <div className="bk-row">
              <div className="bk-main">
                <h4>In-Room Dining & Kitchen</h4>
                <p className="muted small">Fresh Bangus & Seafood Orders</p>
              </div>
              <b className="serif" style={{ fontSize: '1.2rem', color: 'var(--blue)' }}>{money(ov.dining_revenue_php || 0)}</b>
            </div>

            <div className="bk-row">
              <div className="bk-main">
                <h4>Island Outrigger Tours</h4>
                <p className="muted small">Patar Excursions & Shuttles</p>
              </div>
              <b className="serif" style={{ fontSize: '1.2rem', color: 'var(--blue)' }}>{money(ov.tour_revenue_php || 0)}</b>
            </div>
          </div>
        </div>

        <div className="panel" style={{ background: 'var(--sky-mist)', border: '1px dashed #BAE6FD' }}>
          <h3 className="serif" style={{ fontSize: '1.4rem', marginBottom: 12 }}>Accounting Audit Summary</h3>
          <p className="muted small" style={{ marginBottom: 16 }}>
            All payments are reconciled against Supabase database constraints and verified check-ins.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '.88rem' }}>
            <div><b>Audit Status:</b> <span className="pill confirmed">Reconciled</span></div>
            <div><b>Currency:</b> Philippine Pesos (₱)</div>
            <div><b>Tax Compliance:</b> Standard Resort Rate</div>
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
    </div>
  );
}
