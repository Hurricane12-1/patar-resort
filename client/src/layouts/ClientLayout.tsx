import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { supabase } from '../lib/supabaseClient.ts';
import { toast } from '../components/Toasts.tsx';

interface ClientLayoutProps {
  children?: React.ReactNode;
}

/**
 * ClientLayout - End-User Self-Service Namespace Wrapper (/client)
 * Narrative: The client initiates requests, manages their profile, submits data, and tracks status in real time.
 * Clients NEVER see internal operational controls or staff routes.
 * Explicit State Handoff: Transfers disputed stays directly into Supabase and queues them for the /recovery team.
 */
export default function ClientLayout({ children }: ClientLayoutProps) {
  const { customerProfile, profile, signOutCustomer } = useAuth();
  const activeProfile = customerProfile || profile;

  // Dispute Request Handoff Modal
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [disputeForm, setDisputeForm] = useState({
    reservationId: '',
    category: 'Reservation Modification Dispute',
    description: '',
  });

  const handleClientDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeForm.description.trim()) {
      toast('Please describe the issue or dispute you would like resolved.', true);
      return;
    }

    setSubmitting(true);
    try {
      const resId = disputeForm.reservationId.trim();

      // Explicit State Transition in Supabase if a valid reservation ID was provided
      if (resId) {
        await supabase
          .from('reservations')
          .update({
            status: 'disputed',
            notes: `[CLIENT_DISPUTE]: ${disputeForm.description.trim()}`,
          })
          .eq('id', resId);
      }

      // Log dispute action into Supabase audit_logs
      await supabase.from('audit_logs').insert({
        action: 'CLIENT_DISPUTE_FILED',
        actor_id: activeProfile?.id || null,
        actor_email: activeProfile?.email || 'resident@guest.ph',
        actor_role: 'customer',
        details: {
          reservation_id: resId || 'unspecified',
          category: disputeForm.category,
          description: disputeForm.description.trim(),
          source_namespace: '/client',
          target_namespace: '/recovery',
        },
      });

      toast('✦ Your dispute resolution ticket has been securely transferred to the Recovery Team in Supabase.');
      setShowDisputeModal(false);
      setDisputeForm({ reservationId: '', category: 'Reservation Modification Dispute', description: '' });
    } catch (err: any) {
      toast(err.message || 'Failed to submit dispute to database', true);
    } finally {
      setSubmitting(false);
    }
  };

  const clientNavItems = [
    { to: '/client', label: 'Guest Pass & Hub', icon: 'fas fa-id-card' },
    { to: '/client/bookings', label: 'My Bookings & Keycodes', icon: 'fas fa-calendar-check' },
    { to: '/client/profile', label: 'Guest Manifest Profile', icon: 'fas fa-user-edit' },
    { to: '/client/requests', label: 'Concierge & Orders', icon: 'fas fa-bell-concierge' },
  ];

  return (
    <div className="client-namespace-wrapper" style={{ minHeight: '100vh', background: '#020617', color: '#F8FAFC' }}>
      {/* Top Client Portal Header */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.95)',
        borderBottom: '1px solid rgba(56, 189, 248, 0.28)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
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
          <Link to="/client" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <span style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.3), rgba(14, 165, 233, 0.5))',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(56, 189, 248, 0.25)',
            }}>
              <i className="fas fa-umbrella-beach" style={{ color: '#38BDF8', fontSize: '1.2rem' }} />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.2em', color: '#38BDF8', textTransform: 'uppercase' }}>
                  GUEST SELF-SERVICE
                </span>
                <span style={{
                  fontSize: '.62rem',
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#BAE6FD',
                  fontWeight: 700,
                }}>
                  /client
                </span>
              </div>
              <h1 className="serif" style={{ fontSize: '1.22rem', margin: 0, color: '#FFFFFF', letterSpacing: '.03em' }}>
                Rock View Resident Portal
              </h1>
            </div>
          </Link>

          {/* Client Navigation Tabs */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 20 }}>
            {clientNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/client'}
                className={({ isActive }) => `client-nav-btn ${isActive ? 'active' : ''}`}
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
                  background: isActive ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.4)',
                  border: isActive ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
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
          {/* Client -> Recovery Explicit Handoff Trigger */}
          <button
            type="button"
            onClick={() => setShowDisputeModal(true)}
            style={{
              fontSize: '.74rem',
              fontWeight: 700,
              color: '#FDE047',
              background: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              padding: '6px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Submit a stay issue or dispute for rapid resolution"
          >
            <i className="fas fa-hand-holding-hand" style={{ color: '#FBBF24' }} />
            Request Assistance / Dispute
          </button>

          <Link
            to="/rooms"
            style={{
              fontSize: '.74rem',
              fontWeight: 700,
              color: '#FFFFFF',
              background: 'linear-gradient(135deg, #0284C7, #0EA5E9)',
              padding: '6px 14px',
              borderRadius: 8,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <i className="fas fa-plus" />
            Book Stay
          </Link>

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
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            <span>Resident: <strong style={{ color: '#FFFFFF' }}>{activeProfile?.full_name?.split(' ')[0] || activeProfile?.username || 'Guest'}</strong></span>
          </div>

          <button
            onClick={signOutCustomer}
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

      {/* Main Client Self-Service Content */}
      <main style={{ minHeight: 'calc(100vh - 66px)', padding: '16px 0' }}>
        {children}
      </main>

      {/* Client Dispute Modal -> Hands off to /recovery in Supabase */}
      {showDisputeModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowDisputeModal(false)} style={{ zIndex: 99999 }}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="label" style={{ color: '#38BDF8' }}>Guest Support & Resolution</span>
                <h3 className="serif" style={{ fontSize: '1.4rem', margin: '4px 0 0' }}>Submit Issue for Recovery</h3>
              </div>
              <button
                disabled={submitting}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '1.4rem', cursor: 'pointer' }}
                onClick={() => setShowDisputeModal(false)}
              >
                ×
              </button>
            </div>

            <p style={{ color: '#CBD5E1', fontSize: '.84rem', margin: '12px 0 16px' }}>
              Experiencing an issue with your reservation, check-in, or digital keycode? Our specialized <strong>Recovery Team</strong> will review and restore your stay.
            </p>

            <form onSubmit={handleClientDisputeSubmit}>
              <div className="field">
                <label>RESERVATION ID (UUID, IF APPLICABLE)</label>
                <input
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  value={disputeForm.reservationId}
                  onChange={(e) => setDisputeForm({ ...disputeForm, reservationId: e.target.value })}
                />
              </div>

              <div className="field">
                <label>ISSUE CATEGORY</label>
                <select
                  value={disputeForm.category}
                  onChange={(e) => setDisputeForm({ ...disputeForm, category: e.target.value })}
                >
                  <option value="Reservation Modification Dispute">Reservation Date / Room Modification</option>
                  <option value="Digital Keycode Lockout">Digital Keycode Lockout</option>
                  <option value="Billing Inconsistency Appeal">Billing / Folio Payment Inconsistency</option>
                  <option value="Special Request Assistance">Special Request or Service Assistance</option>
                </select>
              </div>

              <div className="field">
                <label>DESCRIPTION OF ISSUE</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Tell us what happened so our recovery team can restore your booking..."
                  value={disputeForm.description}
                  onChange={(e) => setDisputeForm({ ...disputeForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={submitting}
                  onClick={() => setShowDisputeModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-sky"
                  disabled={submitting}
                  style={{ fontWeight: 800 }}
                >
                  {submitting ? 'Submitting to Database…' : 'Submit to Recovery Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
