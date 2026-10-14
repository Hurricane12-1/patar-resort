import { useEffect, useState } from 'react';
import { useAuth, generateAccountEmail } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { toast } from './Toasts.tsx';

export default function AuthModal() {
  const {
    session, profile, authOpen, setAuthOpen,
    needsProfileCompletion, setNeedsProfileCompletion,
    signIn, signUp, signInWithGoogle, updateProfile,
  } = useAuth();

  const [mode, setMode] = useState('in'); // 'in' | 'up' | 'recovery'
  const [f, setF] = useState({
    first_name: '', middle_name: '', last_name: '', full_name: '',
    email: '', password: '', phone: '', address: '', city: '', emergency_contact: '',
  });
  const [comp, setComp] = useState({
    first_name: '', middle_name: '', last_name: '', full_name: '',
    phone: '', address: '', city: '', emergency_contact: '',
  });
  const [busy, setBusy] = useState(false);

  // Account Recovery State
  const [recoveryStep, setRecoveryStep] = useState(1); // 1 = Request Code, 2 = Verify Code & Reset
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');

  useEffect(() => {
    if (profile) {
      setComp({
        first_name: profile.first_name || '',
        middle_name: profile.middle_name || '',
        last_name: profile.last_name || '',
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        address: profile.address || '',
        city: profile.city || '',
        emergency_contact: profile.emergency_contact || '',
      });
    }
  }, [profile]);

  // Auto-generate email preview for registration when names change if email is empty or matches auto pattern
  useEffect(() => {
    if (mode === 'up' && (f.first_name || f.last_name)) {
      const generated = generateAccountEmail(f.first_name, f.middle_name, f.last_name, 1, false);
      if (!f.email || f.email.endsWith('@gmail.com') || f.email.endsWith('@resortmanagement.ph')) {
        setF((prev) => ({ ...prev, email: generated }));
      }
    }
  }, [f.first_name, f.middle_name, f.last_name, mode]);

  async function submitAuth(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'in') {
        const { error } = await signIn(f.email, f.password);
        if (error) throw error;
        toast('Welcome back ✦');
      } else {
        const fullName = [f.first_name, f.middle_name, f.last_name].filter(Boolean).join(' ');
        const targetEmail = f.email || generateAccountEmail(f.first_name, f.middle_name, f.last_name, 1);
        const { data, error } = await signUp(targetEmail, f.password, {
          first_name: f.first_name, middle_name: f.middle_name, last_name: f.last_name,
          full_name: fullName, phone: f.phone, address: f.address,
          city: f.city, emergency_contact: f.emergency_contact,
        });
        if (error) throw error;
        toast(data.session ? 'Account created ✦' : 'Check your inbox to confirm your email.');
      }
      setAuthOpen(false);
    } catch (err) { toast(err.message, true); }
    finally { setBusy(false); }
  }

  async function handleGoogleLogin() {
    try {
      toast('Redirecting to Google Sign-In…');
      await signInWithGoogle();
    } catch (err) { toast(err.message, true); }
  }

  async function submitCompletion(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const fullName = [comp.first_name, comp.middle_name, comp.last_name].filter(Boolean).join(' ');
      await updateProfile({ ...comp, full_name: fullName });
      toast('Resort Profile Updated ✦');
      setNeedsProfileCompletion(false);
    } catch (err) { toast(err.message, true); }
    finally { setBusy(false); }
  }

  // Profile Completion Step
  if (session && needsProfileCompletion) {
    return (
      <div className="modal-overlay" onClick={() => setNeedsProfileCompletion(false)}>
        <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="label light">Guest Registration</span>
              <h3 className="serif" style={{ fontSize: '1.7rem', marginTop: 2 }}>Complete Profile</h3>
            </div>
            <button style={{ color: '#fff', fontSize: '1.6rem', border: 'none', background: 'none', cursor: 'pointer', lineHeight: 1 }}
              aria-label="Close" onClick={() => setNeedsProfileCompletion(false)}>×</button>
          </div>
          <form className="modal-body" onSubmit={submitCompletion}>
            <p className="muted small" style={{ marginBottom: 16 }}>
              Please complete your name & contact details for guest check-in & SMS pings.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div className="field">
                <label>FIRST NAME</label>
                <input required value={comp.first_name} placeholder="Johannes"
                  onChange={(e) => setComp({ ...comp, first_name: e.target.value })} />
              </div>
              <div className="field">
                <label>MIDDLE NAME</label>
                <input value={comp.middle_name} placeholder="Von"
                  onChange={(e) => setComp({ ...comp, middle_name: e.target.value })} />
              </div>
              <div className="field">
                <label>LAST NAME</label>
                <input required value={comp.last_name} placeholder="Shicksal"
                  onChange={(e) => setComp({ ...comp, last_name: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>MOBILE PHONE (for SMS pings)</label>
              <input required value={comp.phone} placeholder="+63 9XX XXX XXXX"
                onChange={(e) => setComp({ ...comp, phone: e.target.value })} />
            </div>
            <div className="field">
              <label>HOME / STREET ADDRESS</label>
              <input required value={comp.address} placeholder="e.g. 123 Sunset Drive"
                onChange={(e) => setComp({ ...comp, address: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field">
                <label>CITY / PROVINCE</label>
                <input value={comp.city} placeholder="e.g. Manila"
                  onChange={(e) => setComp({ ...comp, city: e.target.value })} />
              </div>
              <div className="field">
                <label>EMERGENCY CONTACT</label>
                <input value={comp.emergency_contact} placeholder="+63 9XX XXX XXXX"
                  onChange={(e) => setComp({ ...comp, emergency_contact: e.target.value })} />
              </div>
            </div>
            <button className="btn btn-sky" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} disabled={busy}>
              {busy ? 'Saving Profile…' : 'Save Profile ✦'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!authOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => setAuthOpen(false)}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        {/* MODAL HEADER */}
        <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="label light">{mode === 'in' ? 'Guest Access' : mode === 'up' ? 'Create Account' : 'Account Recovery'}</span>
            <h3 className="serif" style={{ fontSize: '1.7rem', marginTop: 2 }}>
              {mode === 'in' ? 'Welcome Back' : mode === 'up' ? 'Join Resort' : 'Reset Password'}
            </h3>
          </div>
          <button
            style={{ color: '#fff', fontSize: '1.6rem', border: 'none', background: 'none', cursor: 'pointer', lineHeight: 1, padding: 0 }}
            aria-label="Close"
            onClick={() => setAuthOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          {mode !== 'recovery' && (
            <>
              {/* GOOGLE AUTO LOGIN BUTTON */}
              <button
                className="google-btn"
                type="button"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  marginBottom: 16,
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontWeight: 700,
                  fontSize: '.9rem',
                  padding: '12px 18px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  transition: 'all 0.2s ease',
                }}
                onClick={handleGoogleLogin}
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.15C3.25 21.3 7.31 24 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.27C.46 8.2.005 10.04.005 12s.455 3.8 1.265 5.42l4.01-3.15z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.58l4.01 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                </svg>
                Continue with Google
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0 16px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                <span style={{ fontSize: '.72rem', letterSpacing: '.18em', color: 'var(--muted)', textTransform: 'uppercase' }}>or email</span>
                <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              </div>

              <form onSubmit={submitAuth}>
                <div className="modal-tabs">
                  <button type="button" className={mode === 'in' ? 'sel' : ''} onClick={() => setMode('in')}>Sign in</button>
                  <button type="button" className={mode === 'up' ? 'sel' : ''} onClick={() => setMode('up')}>Sign up</button>
                </div>

            {mode === 'up' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div className="field">
                    <label>FIRST NAME</label>
                    <input required value={f.first_name} placeholder="Johannes" onChange={(e) => setF({ ...f, first_name: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>MIDDLE NAME</label>
                    <input value={f.middle_name} placeholder="Von" onChange={(e) => setF({ ...f, middle_name: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>LAST NAME</label>
                    <input required value={f.last_name} placeholder="Shicksal" onChange={(e) => setF({ ...f, last_name: e.target.value })} />
                  </div>
                </div>
                <div className="field">
                  <label>MOBILE PHONE (for SMS pings)</label>
                  <input required value={f.phone} placeholder="+63 9XX XXX XXXX" onChange={(e) => setF({ ...f, phone: e.target.value })} />
                </div>
              </>
            )}

            <div className="field">
              <label>ACCOUNT EMAIL</label>
              <input type="email" required value={f.email} placeholder="user@gmail.com" onChange={(e) => setF({ ...f, email: e.target.value })} />
              {mode === 'up' && (
                <span className="small muted" style={{ display: 'block', marginTop: 4, fontSize: '0.75rem' }}>
                  Suggested email: <code>{generateAccountEmail(f.first_name, f.middle_name, f.last_name, 1, false)}</code>
                </span>
              )}
            </div>

            <div className="field">
              <label>PASSWORD</label>
              <input type="password" required minLength={6} value={f.password} placeholder="••••••••" onChange={(e) => setF({ ...f, password: e.target.value })} />
            </div>

            {mode === 'in' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => { setMode('recovery'); setRecoveryStep(1); setRecoveryEmail(f.email); }}
                  style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button className="btn btn-sky" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} disabled={busy}>
              {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account & continue'}
            </button>
          </form>
        </>
      )}

          {/* MODE: ACCOUNT RECOVERY */}
          {mode === 'recovery' && (
            <div style={{ marginTop: 8 }}>
              {recoveryStep === 1 ? (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!recoveryEmail) return toast('Please enter your account email', true);
                  setBusy(true);
                  try {
                    const res = await api.forgotPassword(recoveryEmail);
                    toast(res.message || 'Verification code sent!');
                    setRecoveryStep(2);
                  } catch (err) {
                    toast(err.message, true);
                  } finally {
                    setBusy(false);
                  }
                }}>
                  <p className="muted small" style={{ marginBottom: 16, lineHeight: 1.5 }}>
                    Enter your registered account email. A secure 6-digit recovery code will be dispatched to your email and verified phone number.
                  </p>
                  <div className="field">
                    <label>ACCOUNT EMAIL</label>
                    <input
                      type="email"
                      required
                      value={recoveryEmail}
                      placeholder="user@gmail.com"
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                    />
                  </div>
                  <button className="btn btn-sky" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} disabled={busy}>
                    {busy ? 'Dispatching Code…' : 'Send Recovery Code ✦'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('in')}
                    style={{ width: '100%', background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.84rem', marginTop: 12, cursor: 'pointer', textAlign: 'center' }}
                  >
                    ← Back to Sign In
                  </button>
                </form>
              ) : (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!recoveryCode || recoveryCode.length !== 6) return toast('Enter the 6-digit verification code', true);
                  if (!recoveryNewPassword || recoveryNewPassword.length < 6) return toast('New password must be at least 6 characters', true);
                  setBusy(true);
                  try {
                    const res = await api.resetPassword(recoveryEmail, recoveryCode, recoveryNewPassword);
                    toast(res.message || 'Password reset successful! Please sign in.');
                    setMode('in');
                    setRecoveryStep(1);
                    setF((prev) => ({ ...prev, email: recoveryEmail, password: recoveryNewPassword }));
                  } catch (err) {
                    toast(err.message, true);
                  } finally {
                    setBusy(false);
                  }
                }}>
                  <p className="muted small" style={{ marginBottom: 16, lineHeight: 1.5 }}>
                    Enter the 6-digit code dispatched to <strong>{recoveryEmail}</strong> and choose a new password.
                  </p>
                  <div className="field">
                    <label>6-DIGIT VERIFICATION CODE</label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={recoveryCode}
                      placeholder="123456"
                      style={{ letterSpacing: '0.3em', fontSize: '1.2rem', textAlign: 'center', fontWeight: 700 }}
                      onChange={(e) => setRecoveryCode(e.target.value.trim())}
                    />
                  </div>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label>NEW PASSWORD (MIN 6 CHARACTERS)</label>
                    <input
                      type="password"
                      minLength={6}
                      required
                      value={recoveryNewPassword}
                      placeholder="••••••••"
                      onChange={(e) => setRecoveryNewPassword(e.target.value)}
                    />
                  </div>
                  <button className="btn btn-sky" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} disabled={busy}>
                    {busy ? 'Resetting Password…' : 'Reset Password & Proceed ✦'}
                  </button>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
                    <button
                      type="button"
                      onClick={() => setRecoveryStep(1)}
                      style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.82rem', cursor: 'pointer', padding: 0 }}
                    >
                      Resend Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('in')}
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.82rem', cursor: 'pointer', padding: 0 }}
                    >
                      Cancel & Return
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
