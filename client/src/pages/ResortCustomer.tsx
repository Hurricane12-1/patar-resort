import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import '../styles/resort-customer.css';
import { api } from '../lib/api.ts';
import { money, fmtDate, fmtTime } from '../lib/format.ts';
import { toast } from '../components/Toasts.tsx';
import { useReveal } from '../hooks/useReveal.ts';
import { useAutoDraft } from '../hooks/useAutoDraft.ts';
import { dispatchWordPrompt } from '../lib/wordPrompt.ts';

function to11Digits(val: string): string {
  if (!val) return '';
  let digits = val.replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length >= 12) {
    digits = '0' + digits.slice(2);
  }
  return digits.slice(0, 11);
}

export default function ResortCustomer() {
  const { session, profile, setAuthOpen, updateProfile, updatePassword } = useAuth();
  const [pass, setPass] = useState(null);
  const [services, setServices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile'); // profile | expect | pass | services | orders
  
  const [profForm, setProfForm, clearProfDraft] = useAutoDraft('customer_profile', {
    first_name: '', middle_name: '', last_name: '', full_name: '',
    phone: '', address: '', city: '', emergency_contact: '',
  });
  const [savingProf, setSavingProf] = useState(false);

  // Security Password Update
  const [newPass, setNewPass] = useState('');
  const [updatingPass, setUpdatingPass] = useState(false);

  useEffect(() => {
    if (profile) {
      setProfForm({
        first_name: (profile.first_name || '').replace(/[^a-zA-Z\s\-]/g, ''),
        middle_name: (profile.middle_name || '').replace(/[^a-zA-Z\s\-]/g, ''),
        last_name: (profile.last_name || '').replace(/[^a-zA-Z\s\-]/g, ''),
        full_name: profile.full_name || '',
        phone: to11Digits(profile.phone || ''),
        address: profile.address || '',
        city: (profile.city || '').replace(/[^a-zA-Z\s\-]/g, ''),
        emergency_contact: to11Digits(profile.emergency_contact || ''),
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    let live = true;
    Promise.all([api.digitalPass(), api.customerServices(), api.customerOrders(), api.customerStats()])
      .then(([p, s, o, st]) => {
        if (!live) return;
        setPass(p);
        setServices(s);
        setOrders(o);
        setStats(st);
      })
      .catch((e) => toast(e.message, true))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [session]);

  useReveal(!loading);

  if (!session) return (
    <div className="container">
      <div className="gate">
        <span className="label">Guest Portal</span>
        <h2 className="serif" style={{ fontSize: '2.4rem', margin: '8px 0 12px' }}>Resort Guest Profile & Dashboard</h2>
        <p className="muted" style={{ margin: '0 0 24px' }}>Sign in to view your customer profile, order counts, active room pass, and dining orders.</p>
        <button className="btn btn-sky" onClick={() => setAuthOpen(true)}>Sign in</button>
      </div>
    </div>
  );

  async function orderItem(svc) {
    try {
      const ord = await api.placeCustomerOrder({
        service_id: svc.id,
        item_name: svc.name,
        category: svc.category,
        price_php: svc.price_php,
      });
      setOrders((x) => [ord, ...x]);
      if (stats) {
        setStats((s) => ({ ...s, orders_count: s.orders_count + 1, active_orders_count: s.active_orders_count + 1 }));
      }
      toast(`Ordered ${svc.name} ✦ Staff will deliver shortly.`);
    } catch (err) { toast(err.message, true); }
  }

  async function saveProfileDetails(e) {
    e.preventDefault();
    if (profForm.phone && profForm.phone.length !== 11) {
      toast('Mobile phone must be strictly an 11-digit number (e.g. 09XXXXXXXXX).', true);
      return;
    }
    if (profForm.emergency_contact && profForm.emergency_contact.length !== 11) {
      toast('Emergency contact must be strictly an 11-digit number (e.g. 09XXXXXXXXX).', true);
      return;
    }
    setSavingProf(true);
    try {
      const full_name = [profForm.first_name, profForm.middle_name, profForm.last_name].filter(Boolean).join(' ') || profForm.full_name;
      await updateProfile({ ...profForm, full_name });
      clearProfDraft();
      toast('Customer Profile Updated ✦ (Draft Saved & Cleared)');
    } catch (err) { toast(err.message, true); }
    finally { setSavingProf(false); }
  }

  async function handlePasswordUpdate(e) {
    e.preventDefault();
    if (!newPass) return;
    setUpdatingPass(true);
    try {
      if (updatePassword) {
        await updatePassword(newPass);
      } else {
        await api.updatePassword(newPass);
      }
      toast(profile?.password_status === 'N/A' || !profile?.has_password ? 'Password Configured Successfully ✦' : 'Password Updated Successfully ✦');
      setNewPass('');
    } catch (err) { toast(err.message, true); }
    finally { setUpdatingPass(false); }
  }

  return (
    <section className="section">
      <div className="container">
        {/* HEAD */}
        <div className="sec-head reveal">
          <div>
            <span className="label">Guest Account & Dashboard</span>
            <h2 className="serif" style={{ fontSize: 'clamp(2.2rem,4.4vw,3.6rem)' }}>
              Guest <em style={{ fontStyle: 'italic' }}>Profile & Experience Hub</em>
            </h2>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => dispatchWordPrompt('Guest Concierge', { template: 'Hello Rock View Bot, what room services, dining, and tours can I book today?' })}
          >
            Ask Rock View Bot 💬
          </button>
        </div>

        {/* ORDER COUNTS & LIVE METRICS */}
        <div className="stat-cards reveal" style={{ marginBottom: 32 }}>
          <div className="stat-card">
            <small>Stays Booked</small>
            <b>{stats?.stays_count || 0} stays</b>
          </div>
          <div className="stat-card">
            <small>Total In-Room Orders</small>
            <b>{orders.length || stats?.orders_count || 0} orders</b>
          </div>
          <div className="stat-card">
            <small>Active Pending Orders</small>
            <b>{orders.filter((o) => o.status !== 'delivered').length || 0} orders</b>
          </div>
          <div className="stat-card">
            <small>Total Spent</small>
            <b>{money(stats?.total_spent_php || 0)}</b>
          </div>
        </div>

        {/* TABS */}
        <div className="chip-row reveal" style={{ marginBottom: 28 }}>
          <button className={`chip ${activeTab === 'profile' ? 'sel' : ''}`} onClick={() => setActiveTab('profile')}>My Profile & Security</button>
          <button className={`chip ${activeTab === 'expect' ? 'sel' : ''}`} onClick={() => setActiveTab('expect')}>What to Expect 🌴</button>
          <button className={`chip ${activeTab === 'pass' ? 'sel' : ''}`} onClick={() => setActiveTab('pass')}>Digital Keycode Pass</button>
          <button className={`chip ${activeTab === 'services' ? 'sel' : ''}`} onClick={() => setActiveTab('services')}>In-Room Services & Tours</button>
          <button className={`chip ${activeTab === 'orders' ? 'sel' : ''}`} onClick={() => setActiveTab('orders')}>Order Tracker ({orders.length})</button>
        </div>

        {/* PROFILE DASHBOARD & PASSWORD SECURITY TAB */}
        {activeTab === 'profile' && (
          <div className="admin-grid reveal">
            {/* PROFILE FORM */}
            <div className="panel">
              <h3 className="serif" style={{ fontSize: '1.5rem', marginBottom: 6 }}>Guest Profile Details</h3>
              <p className="muted small" style={{ marginBottom: 20 }}>Update your contact & address details for guest check-in & SMS pings.</p>
              <form onSubmit={saveProfileDetails}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 12 }}>
                  <div className="field">
                    <label>FIRST NAME * (CHAR ONLY)</label>
                    <input required value={profForm.first_name} placeholder="Juan" onChange={(e) => setProfForm({ ...profForm, first_name: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') })} />
                  </div>
                  <div className="field">
                    <label>MIDDLE NAME (CHAR ONLY)</label>
                    <input value={profForm.middle_name} placeholder="Dela" onChange={(e) => setProfForm({ ...profForm, middle_name: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') })} />
                  </div>
                  <div className="field">
                    <label>LAST NAME * (CHAR ONLY)</label>
                    <input required value={profForm.last_name} placeholder="Cruz" onChange={(e) => setProfForm({ ...profForm, last_name: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div className="field">
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.74rem' }}>PHONE (11 DIGITS)</span>
                      {profForm.phone && (
                        <span style={{ color: profForm.phone.length === 11 ? '#10B981' : '#F59E0B', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {profForm.phone.length}/11 digits
                        </span>
                      )}
                    </label>
                    <input
                      required
                      inputMode="numeric"
                      maxLength={11}
                      value={profForm.phone}
                      placeholder="09XXXXXXXXX"
                      onChange={(e) => setProfForm({ ...profForm, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                    />
                  </div>
                  <div className="field">
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.74rem' }}>EMERGENCY CONTACT</span>
                      {profForm.emergency_contact && (
                        <span style={{ color: profForm.emergency_contact.length === 11 ? '#10B981' : '#F59E0B', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {profForm.emergency_contact.length}/11 digits
                        </span>
                      )}
                    </label>
                    <input
                      inputMode="numeric"
                      maxLength={11}
                      value={profForm.emergency_contact}
                      placeholder="09XXXXXXXXX"
                      onChange={(e) => setProfForm({ ...profForm, emergency_contact: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <div className="field">
                    <label style={{ fontSize: '0.74rem' }}>CITY / PROVINCE (CHAR ONLY)</label>
                    <input value={profForm.city} placeholder="e.g. Manila" onChange={(e) => setProfForm({ ...profForm, city: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') })} />
                  </div>
                  <div className="field">
                    <label style={{ fontSize: '0.74rem' }}>HOME / STREET ADDRESS</label>
                    <input required value={profForm.address} placeholder="Street, Barangay, Subdivision" onChange={(e) => setProfForm({ ...profForm, address: e.target.value })} />
                  </div>
                </div>
                <button className="btn btn-sky" style={{ marginTop: 4 }} disabled={savingProf}>
                  {savingProf ? 'Saving Profile...' : 'Update Profile Details ✦'}
                </button>
              </form>
            </div>

            {/* PASSWORD SECURITY BOX */}
            <div className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <h3 className="serif" style={{ fontSize: '1.5rem', margin: 0 }}>Account Security</h3>
                <span style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: profile?.password_status === 'N/A' || !profile?.has_password ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: profile?.password_status === 'N/A' || !profile?.has_password ? '#F59E0B' : '#10B981',
                  border: `1px solid ${profile?.password_status === 'N/A' || !profile?.has_password ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                }}>
                  {profile?.password_status === 'N/A' || !profile?.has_password ? 'Status: N/A (Not Set)' : 'Status: Configured 🔒'}
                </span>
              </div>
              <p className="muted small" style={{ marginBottom: 20 }}>
                {profile?.password_status === 'N/A' || !profile?.has_password
                  ? 'Your account currently has no password configured (logged in via direct session). You can set your password below to enable credential login anytime.'
                  : 'Change your account password securely.'}
              </p>
              <form onSubmit={handlePasswordUpdate}>
                <div className="field">
                  <label>{profile?.password_status === 'N/A' || !profile?.has_password ? 'SET ACCOUNT PASSWORD (MIN. 6 CHARACTERS)' : 'NEW PASSWORD'}</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPass}
                    placeholder="Enter new password…"
                    onChange={(e) => setNewPass(e.target.value)}
                  />
                </div>
                <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={updatingPass}>
                  {updatingPass ? 'Saving Password…' : (profile?.password_status === 'N/A' || !profile?.has_password ? '✦ Set Account Password' : '🔑 Change Password')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* WHAT TO EXPECT TAB */}
        {activeTab === 'expect' && (
          <div className="panel reveal">
            <span className="label">Resort Guest Guide</span>
            <h3 className="serif" style={{ fontSize: '1.8rem', marginTop: 4, marginBottom: 20 }}>What to Expect During Your Stay</h3>
            
            <div className="grid-3">
              <div className="bk-row" style={{ padding: 18, flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '2rem' }}>🌊</span>
                <h4 style={{ fontSize: '1.15rem', margin: '8px 0 4px' }}>Beachfront & High Tide</h4>
                <p className="muted small">Patar Beach is just 50 steps from your room porch. High tide occurs around 4:15 PM daily for peak swimming.</p>
              </div>

              <div className="bk-row" style={{ padding: 18, flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '2rem' }}>🍳</span>
                <h4 style={{ fontSize: '1.15rem', margin: '8px 0 4px' }}>Complimentary Seafood Breakfast</h4>
                <p className="muted small">Grilled Bolinao Bangus breakfast is served daily from 6:30 AM to 10:00 AM at the open-air beach pavilion.</p>
              </div>

              <div className="bk-row" style={{ padding: 18, flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '2rem' }}>⛵</span>
                <h4 style={{ fontSize: '1.15rem', margin: '8px 0 4px' }}>Patar Outriggers & Shuttles</h4>
                <p className="muted small">Guided outrigger boats to Patar shallows depart twice daily at 9:00 AM and 2:00 PM. Book via In-Room Services & Tours tab.</p>
              </div>
            </div>
          </div>
        )}

        {/* DIGITAL PASS */}
        {activeTab === 'pass' && (
          <div className="detail-grid reveal">
            <div className="detail-sum" style={{ position: 'relative', overflow: 'hidden' }}>
              <span className="label light">Resort RFID Pass</span>
              <h3 className="serif">{pass?.active ? pass.room_name : 'No Active Stay'}</h3>
              {pass?.active ? (
                <>
                  <p className="dates serif" style={{ marginTop: 6 }}>{fmtDate(pass.check_in)} → {fmtDate(pass.check_out)}</p>
                  <div style={{ background: 'rgba(255,255,255,.12)', borderRadius: 10, padding: 16, marginTop: 20 }}>
                    <small style={{ letterSpacing: '.2em', color: '#9CD2F5' }}>DIGITAL KEYCODE</small>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', letterSpacing: '.12em', color: '#fff', marginTop: 4 }}>
                      {pass.pass_code}
                    </div>
                    <small style={{ color: '#BFD8F2' }}>RFID Room Key: {pass.rfid_key}</small>
                  </div>
                  <p className="muted" style={{ color: '#BFD8F2', marginTop: 14, fontSize: '.85rem' }}>
                    📟 Show this digital pass at the front desk or use keycode at room door touchpads.
                  </p>
                </>
              ) : (
                <p className="muted" style={{ color: '#BFD8F2', marginTop: 12 }}>
                  Book a room stay to unlock your digital room key & RFID check-in pass.
                </p>
              )}
            </div>

            <div className="panel">
              <h3 className="serif" style={{ fontSize: '1.4rem' }}>Resort Perks & Assistance</h3>
              <p className="muted" style={{ fontSize: '.92rem', marginBottom: 16 }}>
                Enjoy 24/7 front desk concierge, beachside dining, and automated SMS pings for every request.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="bk-row" style={{ padding: 12 }}>
                  <div><b>Front Desk Hotline</b><br /><small className="muted">+63 900 555 0123</small></div>
                </div>
                <div className="bk-row" style={{ padding: 12 }}>
                  <div><b>Check-in / Check-out</b><br /><small className="muted">2:00 PM / 12:00 NN</small></div>
                </div>
                <div className="bk-row" style={{ padding: 12 }}>
                  <div><b>Patar Beach Access</b><br /><small className="muted">50 steps from room porch</small></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* IN-ROOM SERVICES & TOURS */}
        {activeTab === 'services' && (
          <div className="grid-3 reveal">
            {services.map((svc) => (
              <div key={svc.id} className="svc-card">
                <div className="svc-body">
                  <span style={{ fontSize: '2.2rem' }}>{svc.icon}</span>
                  <span className="label" style={{ marginTop: 8 }}>{svc.category}</span>
                  <h3 style={{ fontSize: '1.25rem', marginTop: 4 }}>{svc.name}</h3>
                  <div className="svc-meta" style={{ marginTop: 16 }}>
                    <span className="svc-price">{svc.price_php ? money(svc.price_php) : 'Complimentary'}</span>
                  </div>
                  <button className="btn btn-sky btn-sm" style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => orderItem(svc)}>
                    Order Service
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ORDER TRACKER WITH LIVE TIMELINE */}
        {activeTab === 'orders' && (
          <div className="panel reveal">
            <h3 className="serif" style={{ fontSize: '1.4rem' }}>Recent Requests & Order Timeline ({orders.length} total)</h3>
            {orders.length === 0 ? (
              <p className="muted" style={{ padding: '24px 0' }}>No active orders placed yet.</p>
            ) : (
              orders.map((o) => (
                <div key={o.id} className="bk-row">
                  <div className="bk-main">
                    <span className="label">{o.category}</span>
                    <h4 style={{ fontSize: '1.1rem' }}>{o.item_name}</h4>
                    <p className="muted small">{fmtTime(o.created_at)} · {o.price_php ? money(o.price_php) : 'Complimentary'}</p>
                  </div>
                  <span className={`pill ${o.status === 'delivered' ? 'delivered' : 'sent'}`}>
                    {o.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}
