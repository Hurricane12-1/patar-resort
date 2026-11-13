import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { supabase } from '../lib/supabaseClient.ts';
import { toast } from '../components/Toasts.tsx';
import { canAccessPortal, canEscalateToRecovery, formatDepartmentBadge, PortalKey } from '../lib/rbac.ts';
import '../styles/staff-portal.css';

interface StaffLayoutProps {
  children?: React.ReactNode;
}

/**
 * StaffLayout - Daily Operations & Execution Namespace Wrapper (/staff)
 * Narrative: Staff members handle day-to-day queues, check-ins, accounting folios, and task fulfillment.
 * Fully modular CSS styling, clean design parity with executive portal.
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

  const allStaffNavItems: Array<{ to: string; label: string; icon: string; portal: PortalKey }> = [
    { to: '/staff/operations', label: 'Department Dispatch', icon: 'fas fa-tasks', portal: 'operations' },
    { to: '/staff/reception', label: 'Reception & Check-In', icon: 'fas fa-bell-concierge', portal: 'reception' },
    { to: '/staff/accounting', label: 'Billing & Ledgers', icon: 'fas fa-calculator', portal: 'accounting' },
  ];
  const staffNavItems = allStaffNavItems.filter((item) => canAccessPortal(activeProfile, item.portal));

  const allowEscalation = canEscalateToRecovery(activeProfile);
  const deptBadge = formatDepartmentBadge(activeProfile);

  return (
    <div className="staff-namespace-wrapper">
      {/* Top Operations Header */}
      <header className="staff-header">
        <div className="staff-header-left">
          <Link to="/staff" className="staff-brand-link">
            <span className="staff-brand-icon">
              <i className="fas fa-clipboard-user" />
            </span>
            <div className="staff-brand-text">
              <div className="staff-brand-badge">
                <span>OPERATIONS &amp; EXECUTION</span>
                <span className="staff-brand-badge-tag">/staff</span>
              </div>
              <h1 className="staff-brand-title">
                Resort Operations Hub
              </h1>
            </div>
          </Link>

          {/* Operational Navigation Tabs */}
          <nav className="staff-nav-pills">
            {staffNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `staff-nav-link ${isActive ? 'active' : ''}`}
              >
                <i className={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="staff-header-right">
          {/* Explicit State Handoff Trigger: Escalate to Recovery */}
          {allowEscalation && (
            <button
              type="button"
              onClick={() => setShowEscalationModal(true)}
              className="staff-escalate-btn"
              title="Escalate a disputed stay, hold, or guest issue to the Recovery namespace"
            >
              <i className="fas fa-triangle-exclamation" />
              <span>Escalate Case →</span>
            </button>
          )}

          {/* Active Duty Status Pill */}
          <div className="staff-duty-pill">
            <span className="staff-duty-dot" />
            <span className="staff-duty-label">{deptBadge}:</span>
            <span className="staff-duty-name">{activeProfile?.full_name || 'Active Duty'}</span>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={signOutAdmin}
            className="staff-signout-btn"
            title="Sign out of staff operational station"
          >
            <i className="fas fa-arrow-right-from-bracket" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Staff Portal Content */}
      <main style={{ minHeight: 'calc(100vh - 66px)', padding: '24px 0' }}>
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
