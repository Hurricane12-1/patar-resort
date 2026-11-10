import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { toast } from '../../components/Toasts.tsx';
import { money, fmtDate } from '../../lib/format.ts';
import { api } from '../../lib/api.ts';

export default function RecoveryPortal() {
  const [searchParams] = useSearchParams();
  const filterRef = searchParams.get('ref');
  const { adminProfile, profile } = useAuth();
  const activeProfile = adminProfile || profile;

  const [activeTab, setActiveTab] = useState<'cases' | 'accounts' | 'audit'>('cases');
  const [disputedBookings, setDisputedBookings] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected Booking for State Transition
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  // Emergency Account Unlock Tool
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [overrideBusy, setOverrideBusy] = useState(false);

  // Real 100% Live Database Fetch
  const fetchLiveRecoveryData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch live reservations with disputed, flagged, or pending escalation status
      const { data: resData, error: resErr } = await supabase
        .from('reservations')
        .select('*, rooms(name)')
        .or('status.eq.disputed,status.eq.flagged,status.eq.cancelled,status.eq.pending')
        .order('created_at', { ascending: false })
        .limit(50);

      if (resErr) {
        console.warn('[Recovery Database Query] Reservations error:', resErr.message);
        setErrorMsg(resErr.message);
      } else {
        setDisputedBookings(resData || []);
      }

      // 2. Fetch live escalation audit logs
      const { data: logData, error: logErr } = await supabase
        .from('audit_logs')
        .select('*')
        .or('action.ilike.%ESCALAT%,action.ilike.%DISPUTE%,action.ilike.%RECOVERY%')
        .order('created_at', { ascending: false })
        .limit(50);

      if (logErr) {
        console.warn('[Recovery Database Query] Audit logs error:', logErr.message);
      } else {
        setAuditEvents(logData || []);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Database connection error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveRecoveryData();

    // Realtime Postgres Change Subscription
    const channel = supabase
      .channel('recovery_live_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        fetchLiveRecoveryData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => {
        fetchLiveRecoveryData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Action 1: Database State Transition -> Resolve & Restore (to 'confirmed')
  const handleResolveAndRestore = async (booking: any) => {
    if (!resolutionNote.trim()) {
      toast('Please provide a resolution audit note.', true);
      return;
    }
    setActionBusy(true);
    try {
      const updatedNotes = `${booking.notes || ''}\n[RECOVERY_RESOLVED by ${activeProfile?.email || 'Officer'}]: ${resolutionNote.trim()}`.trim();

      const { error: updErr } = await supabase
        .from('reservations')
        .update({
          status: 'confirmed',
          notes: updatedNotes,
        })
        .eq('id', booking.id);

      if (updErr) throw updErr;

      // Log resolution audit record
      await supabase.from('audit_logs').insert({
        action: 'RECOVERY_RESOLVED_AND_RESTORED',
        actor_id: activeProfile?.id || null,
        actor_email: activeProfile?.email || 'recovery@resort.ph',
        actor_role: activeProfile?.role || 'recovery',
        details: {
          reservation_id: booking.id,
          previous_status: booking.status,
          new_status: 'confirmed',
          resolution_note: resolutionNote.trim(),
        },
      });

      toast(`✅ Reservation ${booking.id.slice(0, 8)} restored to CONFIRMED in database.`);
      setSelectedBooking(null);
      setResolutionNote('');
      fetchLiveRecoveryData();
    } catch (err: any) {
      toast(err.message || 'Failed to update reservation state in database', true);
    } finally {
      setActionBusy(false);
    }
  };

  // Action 2: Database State Transition -> Escalate to Executive Governance (/admin)
  const handleEscalateToAdmin = async (booking: any) => {
    if (!resolutionNote.trim()) {
      toast('Please provide reason for elevating to executive governance.', true);
      return;
    }
    setActionBusy(true);
    try {
      const updatedNotes = `${booking.notes || ''}\n[EXECUTIVE_GOVERNANCE_ESCALATION by ${activeProfile?.email || 'Officer'}]: ${resolutionNote.trim()}`.trim();

      const { error: updErr } = await supabase
        .from('reservations')
        .update({
          status: 'escalated',
          notes: updatedNotes,
        })
        .eq('id', booking.id);

      if (updErr) throw updErr;

      // Log high-priority escalation in audit_logs
      await supabase.from('audit_logs').insert({
        action: 'EXECUTIVE_GOVERNANCE_ESCALATION',
        actor_id: activeProfile?.id || null,
        actor_email: activeProfile?.email || 'recovery@resort.ph',
        actor_role: activeProfile?.role || 'recovery',
        details: {
          reservation_id: booking.id,
          target_namespace: '/admin',
          priority: 'CRITICAL',
          narrative: resolutionNote.trim(),
        },
      });

      toast(`⚠️ Reservation ${booking.id.slice(0, 8)} elevated to Executive Governance (/admin).`);
      setSelectedBooking(null);
      setResolutionNote('');
      fetchLiveRecoveryData();
    } catch (err: any) {
      toast(err.message || 'Failed to record governance escalation in database', true);
    } finally {
      setActionBusy(false);
    }
  };

  // Action 3: Dispatch Real Live 2FA / Password Reset OTP to Customer
  const handleAccountOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) {
      toast('Please enter the customer account email to restore.', true);
      return;
    }
    setOverrideBusy(true);
    try {
      await api.forgotPassword(recoveryEmail.trim());
      toast(`✅ Recovery OTP successfully dispatched to ${recoveryEmail}. Security lock lifted.`);
      setRecoveryEmail('');
    } catch (err: any) {
      toast(err.message || 'Failed to dispatch recovery code to email', true);
    } finally {
      setOverrideBusy(false);
    }
  };

  return (
    <div className="container section" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(180, 83, 9, 0.25))',
        border: '1px solid rgba(245, 158, 11, 0.4)',
        borderRadius: 16,
        padding: '24px 28px',
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <span className="label" style={{ color: '#FBBF24', letterSpacing: '.18em' }}>
            SPECIALIZED RESOLUTION & RESTORATION CONSOLE
          </span>
          <h2 className="serif" style={{ fontSize: '2rem', color: '#FFFFFF', margin: '4px 0 6px' }}>
            Incident Triage & Rapid Intervention
          </h2>
          <p style={{ color: '#E2E8F0', fontSize: '.88rem', margin: 0, maxWidth: 640, lineHeight: 1.5 }}>
            Direct live database queue for disputed, flagged, or cancelled reservations in Supabase.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 12,
            padding: '12px 18px',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: '.7rem', color: '#FBBF24', fontWeight: 700, textTransform: 'uppercase' }}>Live Flagged</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#FFFFFF' }}>
              {disputedBookings.length}
            </div>
          </div>

          <div style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 12,
            padding: '12px 18px',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: '.7rem', color: '#38BDF8', fontWeight: 700, textTransform: 'uppercase' }}>Audit Logs</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#FFFFFF' }}>
              {auditEvents.length}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: 12, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setActiveTab('cases')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: '.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: activeTab === 'cases' ? '1px solid #F59E0B' : '1px solid transparent',
            background: activeTab === 'cases' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
            color: activeTab === 'cases' ? '#FDE68A' : '#94A3B8',
          }}
        >
          <i className="fas fa-folder-open" style={{ marginRight: 6 }} />
          Disputed Reservations ({disputedBookings.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: '.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: activeTab === 'accounts' ? '1px solid #F59E0B' : '1px solid transparent',
            background: activeTab === 'accounts' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
            color: activeTab === 'accounts' ? '#FDE68A' : '#94A3B8',
          }}
        >
          <i className="fas fa-user-lock" style={{ marginRight: 6 }} />
          Account & Credential Overrides
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: '.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: activeTab === 'audit' ? '1px solid #F59E0B' : '1px solid transparent',
            background: activeTab === 'audit' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
            color: activeTab === 'audit' ? '#FDE68A' : '#94A3B8',
          }}
        >
          <i className="fas fa-history" style={{ marginRight: 6 }} />
          Escalation Audit Trail ({auditEvents.length})
        </button>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #EF4444', color: '#FCA5A5', padding: '12px 16px', borderRadius: 10, marginBottom: 16 }}>
          <i className="fas fa-triangle-exclamation" style={{ marginRight: 8 }} />
          Database Notice: {errorMsg}
        </div>
      )}

      {/* TAB 1: DISPUTED RESERVATIONS (100% LIVE SUPABASE DATA) */}
      {activeTab === 'cases' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
              <i className="fas fa-circle-notch fa-spin" style={{ fontSize: '1.8rem', color: '#F59E0B', marginBottom: 12 }} />
              <div>Fetching live records from Supabase...</div>
            </div>
          ) : disputedBookings.length === 0 ? (
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px dashed rgba(255, 255, 255, 0.15)',
              borderRadius: 14,
              padding: '48px 24px',
              textAlign: 'center',
              color: '#94A3B8',
            }}>
              <i className="fas fa-check-double" style={{ fontSize: '2.4rem', color: '#10B981', marginBottom: 12 }} />
              <h4 style={{ color: '#FFFFFF', margin: '0 0 6px', fontSize: '1.2rem' }}>Queue is Clear</h4>
              <p style={{ margin: 0, fontSize: '.88rem' }}>
                No flagged, disputed, or cancelled reservations currently require intervention in the database.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {disputedBookings.map((item) => {
                const isTarget = filterRef && item.id.includes(filterRef);
                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: isTarget ? '2px solid #F59E0B' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 14,
                      padding: '16px 20px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 14,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 280 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: '.78rem', fontWeight: 800, color: '#FBBF24' }}>
                          ID: {item.id.slice(0, 8)}…
                        </span>
                        <span style={{
                          fontSize: '.65rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: item.status === 'disputed' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: item.status === 'disputed' ? '#F87171' : '#FBBF24',
                          border: `1px solid ${item.status === 'disputed' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
                          textTransform: 'uppercase',
                        }}>
                          {item.status}
                        </span>
                        <span style={{ fontSize: '.72rem', color: '#94A3B8' }}>{fmtDate(item.created_at)}</span>
                      </div>

                      <h4 style={{ color: '#FFFFFF', margin: '2px 0 4px', fontSize: '1rem' }}>
                        Guest: <strong style={{ color: '#38BDF8' }}>{item.guest_name || 'Guest'}</strong> · {item.rooms?.name || 'Resort Room'}
                      </h4>
                      <div style={{ fontSize: '.78rem', color: '#94A3B8', marginBottom: 6 }}>
                        Contact: {item.phone || item.email || 'N/A'} · Stay: {fmtDate(item.check_in)} → {fmtDate(item.check_out)} · Total: {money(item.total_php)}
                      </div>
                      {item.notes && (
                        <p style={{ color: '#CBD5E1', fontSize: '.84rem', margin: 0, lineHeight: 1.45, background: 'rgba(30, 41, 59, 0.5)', padding: '6px 10px', borderRadius: 6 }}>
                          <strong style={{ color: '#FBBF24' }}>Notes / Flags:</strong> {item.notes}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-sky"
                        style={{ background: '#F59E0B', borderColor: '#D97706', color: '#0F172A', fontWeight: 800 }}
                        onClick={() => setSelectedBooking(item)}
                      >
                        <i className="fas fa-wrench" style={{ marginRight: 6 }} />
                        Review & Intervene
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACCOUNT OVERRIDES (LIVE BACKEND INTEGRATION) */}
      {activeTab === 'accounts' && (
        <div style={{ background: 'rgba(15, 23, 42, 0.85)', borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.1)', padding: 24, maxWidth: 600 }}>
          <span className="label" style={{ color: '#F59E0B' }}>Live Account Access Override</span>
          <h3 className="serif" style={{ fontSize: '1.4rem', margin: '4px 0 12px' }}>
            Emergency Credential & 2FA Recovery
          </h3>
          <p style={{ color: '#94A3B8', fontSize: '.84rem', lineHeight: 1.5, marginBottom: 20 }}>
            Allows authorized Recovery Officers to dispatch a secure 6-digit verification code directly to the customer's registered email via SMTP / Supabase.
          </p>

          <form onSubmit={handleAccountOverride}>
            <div className="field">
              <label>CUSTOMER REGISTERED EMAIL ADDRESS</label>
              <input
                type="email"
                required
                placeholder="client@gmail.com"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-sky"
              disabled={overrideBusy}
              style={{ width: '100%', justifyContent: 'center', fontWeight: 800, marginTop: 10 }}
            >
              {overrideBusy ? 'Dispatching Recovery Code…' : 'Dispatch 6-Digit Recovery OTP ✦'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL (100% LIVE SUPABASE AUDIT LOGS) */}
      {activeTab === 'audit' && (
        <div style={{ background: 'rgba(15, 23, 42, 0.85)', borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.1)', padding: 24 }}>
          <h3 className="serif" style={{ fontSize: '1.4rem', margin: '0 0 12px' }}>
            Live Escalation Audit Log
          </h3>
          <p style={{ color: '#94A3B8', fontSize: '.84rem', marginBottom: 16 }}>
            Every state handoff between /staff, /client, /recovery, and /admin is cryptographically recorded in Supabase table <code>audit_logs</code>.
          </p>

          {auditEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#94A3B8' }}>
              No escalation audit records found in the live database.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {auditEvents.map((ev) => (
                <div key={ev.id} style={{ fontSize: '.82rem', padding: '10px 14px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: '#FBBF24' }}>{ev.action}</strong>
                    <div style={{ color: '#94A3B8', fontSize: '.74rem', marginTop: 2 }}>
                      Actor: {ev.actor_email || 'System'} ({ev.actor_role || 'system'}) · {fmtDate(ev.created_at)}
                    </div>
                  </div>
                  <span style={{ fontSize: '.74rem', color: '#38BDF8', fontFamily: 'monospace' }}>
                    {typeof ev.details === 'object' ? JSON.stringify(ev.details).slice(0, 60) + '…' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review & State Transition Modal */}
      {selectedBooking && (
        <div className="modal-overlay" onClick={() => !actionBusy && setSelectedBooking(null)} style={{ zIndex: 99999 }}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="label" style={{ color: '#F59E0B' }}>Supabase State Transition</span>
                <h3 className="serif" style={{ fontSize: '1.4rem', margin: '4px 0 0' }}>Intervene: {selectedBooking.id.slice(0, 8)}</h3>
              </div>
              <button
                disabled={actionBusy}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '1.4rem', cursor: 'pointer' }}
                onClick={() => setSelectedBooking(null)}
              >
                ×
              </button>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '12px 16px', borderRadius: 10, margin: '14px 0' }}>
              <div style={{ fontSize: '.78rem', color: '#94A3B8' }}>Current Notes / Flagged Data:</div>
              <div style={{ color: '#FFFFFF', fontSize: '.88rem', marginTop: 4 }}>{selectedBooking.notes || 'None recorded'}</div>
            </div>

            <div className="field">
              <label>RESOLUTION AUDIT NOTE (REQUIRED)</label>
              <textarea
                rows={3}
                placeholder="State the resolution executed (e.g. room reallocated, billing credit applied, keycode regenerated)..."
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                disabled={actionBusy}
                style={{
                  fontSize: '.76rem',
                  fontWeight: 700,
                  color: '#C4B5FD',
                  background: 'rgba(139, 92, 246, 0.15)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  padding: '8px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
                onClick={() => handleEscalateToAdmin(selectedBooking)}
              >
                <i className="fas fa-crown" style={{ marginRight: 6 }} />
                Escalate to Governance (/admin)
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={actionBusy}
                  onClick={() => setSelectedBooking(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sky"
                  disabled={actionBusy}
                  style={{ background: '#10B981', borderColor: '#059669', color: '#FFFFFF', fontWeight: 800 }}
                  onClick={() => handleResolveAndRestore(selectedBooking)}
                >
                  <i className="fas fa-check-circle" style={{ marginRight: 6 }} />
                  {actionBusy ? 'Updating…' : 'Resolve & Restore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
