import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { supabase } from '../lib/supabaseClient.ts';
import { toast } from '../components/Toasts.tsx';

interface StaffLayoutProps {
  children?: React.ReactNode;
}

/**
 * StaffLayout - Daily Operations & Execution Namespace Wrapper (/staff)
 * Narrative: Staff members handle day-to-day queues, check-ins, accounting folios, and task fulfillment.
 * Staff cannot alter system-wide configurations or perform unrestricted overrides.
 * Explicit State Handoff: Dispatches unresolved operational disputes directly to Supabase and routes to /recovery.
 */
export default function StaffLayout({ children }: StaffLayoutProps) {
  const { adminProfile, profile, signOutAdmin } = useAuth();
  const navigate = useNavigate();
  const activeProfile = adminProfile || profile;

  // Escalation Handoff Modal State
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [escalationForm, setEscalationForm] = useState({
    reservationId: '',
    category: 'Inventory Overbooking Clash',
    reason: '',
    severity: 'urgent',
  });

  const handleEscalateToRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalationForm.reservationId.trim() || !escalationForm.reason.trim()) {
      toast('Please provide a valid reservation ID and reason for escalation.', true);
      return;
    }

    setSubmitting(true);
    try {
      const resId = escalationForm.reservationId.trim();

      // Explicit State Transition in Supabase:
      // Update reservation status to 'disputed' with escalation narrative
      const { error: updateErr } = await supabase
        .from('reservations')
        .update({
          status: 'disputed',
          notes: `[STAFF_ESCALATION (${escalationForm.severity.toUpperCase()})]: ${escalationForm.reason.trim()}`,
        })
        .eq('id', resId);

      if (updateErr) {
        console.warn('[Staff Escalation] Notice updating reservation:', updateErr.message);
      }

      // Record state handoff in Supabase audit_logs
      await supabase.from('audit_logs').insert({
        action: 'STAFF_ESCALATE_TO_RECOVERY',
        actor_id: activeProfile?.id || null,
        actor_email: activeProfile?.email || 'staff@resort.ph',
        actor_role: activeProfile?.role || 'staff',
        details: {
          reservation_id: resId,
          category: escalationForm.category,
          severity: escalationForm.severity,
          reason: escalationForm.reason.trim(),
          source_namespace: '/staff',
          target_namespace: '/recovery',
        },
      });

      toast(`✦ Case ${resId} successfully escalated to /recovery in Supabase!`);
      setShowEscalationModal(false);
      setEscalationForm({ reservationId: '', category: 'Inventory Overbooking Clash', reason: '', severity: 'urgent' });
      navigate(`/recovery/cases?ref=${encodeURIComponent(resId)}`);
    } catch (err: any) {
      toast(err.message || 'Failed to submit escalation to database', true);
    } finally {
      setSubmitting(false);
    }
  };

  const staffNavItems = [
    { to: '/staff/operations', label: 'Department Tasks & Dispatch', icon: 'fas fa-tasks-alt' },
    { to: '/staff/reception', label: 'Reception & Check-In Desk', icon: 'fas fa-bell-concierge' },
    { to: '/staff/accounting', label: 'Folios, Billing & Audit', icon: 'fas fa-calculator' },
  ];

  return (
    <div className="staff-namespace-wrapper" style={{ minHeight: '100vh', background: '#090D16', color: '#F8FAFC' }}>
      {/* Top Operations Header */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.96)',
        borderBottom: '1px solid rgba(14, 165, 233, 0.35)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.45)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(14px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/staff" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <span style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.4), rgba(2, 132, 199, 0.6))',
              border: '1px solid rgba(56, 189, 248, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(14, 165, 233, 0.35)',
            }}>
              <i className="fas fa-clipboard-user" style={{ color: '#7DD3FC', fontSize: '1.2rem' }} />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.2em', color: '#38BDF8', textTransform: 'uppercase' }}>
                  OPERATIONS & EXECUTION
                </span>
                <span style={{
                  fontSize: '.62rem',
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'rgba(14, 165, 233, 0.2)',
                  border: '1px solid rgba(14, 165, 233, 0.4)',
                  color: '#BAE6FD',
                  fontWeight: 700,
                }}>
                  /staff
                </span>
              </div>
              <h1 className="serif" style={{ fontSize: '1.22rem', margin: 0, color: '#FFFFFF', letterSpacing: '.03em' }}>
                Resort Operations Hub
              </h1>
            </div>
          </Link>

          {/* Operational Navigation Tabs */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 20 }}>
            {staffNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `staff-nav-btn ${isActive ? 'active' : ''}`}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '.78rem',
                  fontWeight: 700,
                  padding: '7px 14px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  color: isActive ? '#FFFFFF' : '#94A3B8',
                  background: isActive ? 'rgba(14, 165, 233, 0.22)' : 'rgba(30, 41, 59, 0.4)',
                  border: isActive ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                  transition: 'all 0.2s ease',
                })}
              >
                <i className={item.icon} style={{ fontSize: '.85rem' }} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Explicit State Handoff Trigger: Escalate to Recovery */}
          <button
            type="button"
            onClick={() => setShowEscalationModal(true)}
            style={{
              fontSize: '.76rem',
              fontWeight: 700,
              color: '#FDE047',
              background: 'rgba(234, 179, 8, 0.15)',
              border: '1px solid rgba(234, 179, 8, 0.45)',
              padding: '6px 14px',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 0 12px rgba(234, 179, 8, 0.15)',
              transition: 'all 0.2s ease',
            }}
            title="Escalate a disputed stay, hold, or guest issue to the Recovery namespace"
          >
            <i className="fas fa-triangle-exclamation" style={{ color: '#FBBF24' }} />
            Escalate to Recovery →
          </button>

          <div style={{
            fontSize: '.74rem',
            color: '#CBD5E1',
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '5px 12px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38BDF8', display: 'inline-block' }} />
            <span>Staff: <strong style={{ color: '#FFFFFF' }}>{activeProfile?.full_name || 'Active Duty'}</strong> ({activeProfile?.role || 'staff'})</span>
          </div>

          <button
            onClick={signOutAdmin}
            style={{
              fontSize: '.74rem',
              fontWeight: 700,
              color: '#F87171',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '6px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s ease',
            }}
          >
            <i className="fas fa-arrow-right-from-bracket" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Staff Portal Content */}
      <main style={{ minHeight: 'calc(100vh - 66px)', padding: '16px 0' }}>
        {children}
      </main>

      {/* Explicit Handoff Modal: Staff -> Recovery */}
      {showEscalationModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowEscalationModal(false)} style={{ zIndex: 99999 }}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="label" style={{ color: '#FBBF24' }}>Explicit State Handoff</span>
                <h3 className="serif" style={{ fontSize: '1.4rem', margin: '4px 0 0' }}>Escalate Case to /recovery</h3>
              </div>
              <button
                disabled={submitting}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '1.4rem', cursor: 'pointer' }}
                onClick={() => setShowEscalationModal(false)}
              >
                ×
              </button>
            </div>

            <p style={{ color: '#CBD5E1', fontSize: '.84rem', margin: '12px 0 16px' }}>
              Transitions reservation state to <code>disputed</code> in Supabase and routes to the specialized <strong>/recovery</strong> console.
            </p>

            <form onSubmit={handleEscalateToRecovery}>
              <div className="field">
                <label>RESERVATION ID (UUID)</label>
                <input
                  required
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  value={escalationForm.reservationId}
                  onChange={(e) => setEscalationForm({ ...escalationForm, reservationId: e.target.value })}
                />
              </div>

              <div className="field">
                <label>CASE CATEGORY</label>
                <select
                  value={escalationForm.category}
                  onChange={(e) => setEscalationForm({ ...escalationForm, category: e.target.value })}
                >
                  <option value="Inventory Overbooking Clash">Inventory Overbooking Clash</option>
                  <option value="Digital Keycode Lockout">Digital Keycode Lockout</option>
                  <option value="Billing Discrepancy Dispute">Billing Discrepancy Dispute</option>
                  <option value="Identity / Manifest Mismatch">Identity / Manifest Mismatch</option>
                  <option value="Security / Property Incident">Security / Property Incident</option>
                </select>
              </div>

              <div className="field">
                <label>SEVERITY LEVEL</label>
                <select
                  value={escalationForm.severity}
                  onChange={(e) => setEscalationForm({ ...escalationForm, severity: e.target.value })}
                >
                  <option value="medium">Medium Priority</option>
                  <option value="urgent">Urgent (Guest Waiting at Front Desk)</option>
                  <option value="critical">Critical (Financial / Legal Escalation)</option>
                </select>
              </div>

              <div className="field">
                <label>DISPATCH NOTE / INCIDENT NARRATIVE</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the operational conflict requiring recovery intervention..."
                  value={escalationForm.reason}
                  onChange={(e) => setEscalationForm({ ...escalationForm, reason: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={submitting}
                  onClick={() => setShowEscalationModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-sky"
                  disabled={submitting}
                  style={{ background: '#F59E0B', borderColor: '#D97706', color: '#0F172A', fontWeight: 800 }}
                >
                  {submitting ? 'Updating Database…' : 'Dispatch & Transfer to /recovery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
