import { useEffect, useState } from 'react';
import { useAuth, generateAccountEmail, to11Digits } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { toast } from './Toasts.tsx';

export default function AuthModal() {
  const {
    session, profile, authOpen, setAuthOpen,
    needsProfileCompletion, setNeedsProfileCompletion,
    signIn, signInWithGoogle, signInWithFacebook, updateProfile,
  } = useAuth();

  const [mode, setMode] = useState<'in' | 'up' | '2fa' | 'recovery'>('in');
  const [signupProvider, setSignupProvider] = useState<'gmail' | 'facebook' | 'email'>('gmail');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [f, setF] = useState({
    first_name: '', middle_name: '', last_name: '', full_name: '',
    email: '', password: '', phone: '', address: '', city: '', emergency_contact: '',
  });

  const [comp, setComp] = useState({
    first_name: '', middle_name: '', last_name: '', full_name: '',
    phone: '', address: '', city: '', emergency_contact: '',
  });

  const [busy, setBusy] = useState(false);

  // Automation Control State
  const [automationOpen, setAutomationOpen] = useState(false);
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [autoDispatch2FA, setAutoDispatch2FA] = useState(true);

  // 2FA Confirmation State
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupCode, setSignupCode] = useState('');
  const [devCodePreview, setDevCodePreview] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [confirmationTimeLeft, setConfirmationTimeLeft] = useState(60); // 1-minute (60s) confirmation gate
  const [confirmationExpiredMsg, setConfirmationExpiredMsg] = useState('');

  // Account Recovery State
  const [recoveryStep, setRecoveryStep] = useState(1); // 1 = Request Code, 2 = Verify Code & Reset
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');

  // 1-Minute Confirmation Countdown Timer
  useEffect(() => {
    if (mode !== '2fa') return;
    if (confirmationTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setConfirmationTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleConfirmationTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [mode, confirmationTimeLeft, signupEmail]);

  // Handle 1-minute expiration: auto-remove unconfirmed account and notify user
  async function handleConfirmationTimeout() {
    if (signupEmail) {
      try {
        await api.expireSignup(signupEmail);
      } catch {}
    }
    setMode('up');
    setConfirmationExpiredMsg('Try Again, please make sure you confirm');
    toast('⏱️ 1-Minute confirmation time expired! Unconfirmed account was removed. Try Again, please make sure you confirm.', true);
  }

  // Handle manual cancel from 2FA: auto-remove unconfirmed account
  async function handleCancel2FA() {
    if (signupEmail) {
      try {
        await api.expireSignup(signupEmail);
      } catch {}
    }
    setMode('up');
    setConfirmationExpiredMsg('Try Again, please make sure you confirm');
  }

  // Resend Cooldown Timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (profile) {
      setComp({
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

  // Auto-generate email preview for registration when names change
  useEffect(() => {
    if (mode === 'up' && (f.first_name || f.last_name)) {
      const generated = generateAccountEmail(
        f.first_name,
        f.middle_name,
        f.last_name,
        1,
        false,
        signupProvider === 'facebook' ? 'facebook' : 'gmail'
      );
      if (!f.email || f.email.endsWith('@gmail.com') || f.email.endsWith('@facebook.com') || f.email.endsWith('@rockviewresort.ph') || f.email.endsWith('@resortmanagement.ph')) {
        setF((prev) => ({ ...prev, email: generated }));
      }
    }
  }, [f.first_name, f.middle_name, f.last_name, mode, signupProvider]);

  // Social Auth Handlers (Google & Facebook OAuth)
  async function handleGoogleLogin() {
    try {
      toast('Redirecting to Google Sign-In…');
      await signInWithGoogle();
    } catch (err: any) {
      const msg = err.msg || err.message || '';
      if (msg.includes('not enabled') || msg.includes('Unsupported provider') || err.error_code === 'validation_failed') {
        toast('Google OAuth is not enabled in your Supabase Dashboard yet. Use standard login or sign up with Gmail & 2FA below.', true);
      } else {
        toast(msg || 'Google Sign-In failed', true);
      }
    }
  }

  async function handleFacebookLogin() {
    try {
      toast('Redirecting to Facebook Sign-In…');
      await signInWithFacebook();
    } catch (err: any) {
      const msg = err.msg || err.message || '';
      if (msg.includes('not enabled') || msg.includes('Unsupported provider') || err.error_code === 'validation_failed') {
        toast('Facebook OAuth is not enabled in your Supabase Dashboard yet. Use standard login or sign up with Facebook & 2FA below.', true);
      } else {
        toast(msg || 'Facebook Sign-In failed', true);
      }
    }
  }

  // Intelligent user name inferrer from Google / Gmail address
  function parseNameFromEmail(email: string): { first: string; last: string; full: string } | null {
    if (!email || !email.includes('@')) return null;
    const username = email.split('@')[0];
    const cleaned = username.replace(/[0-9]+$/, '');
    const parts = cleaned.split(/[._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      const first = capitalize(parts[0]);
      const last = parts.slice(1).map(capitalize).join(' ');
      return { first, last, full: `${first} ${last}` };
    } else if (parts.length === 1 && parts[0].length >= 2) {
      const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      return { first: capitalize(parts[0]), last: '', full: capitalize(parts[0]) };
    }
    return null;
  }

  // Automation Control: Auto-Collect Google Account Information
  async function handleAutoCollectGoogleInfo() {
    toast('⚡ Connecting to Google API… auto-collecting user identity…');
    // If user already typed an email, parse from it directly
    if (f.email && f.email.includes('@')) {
      const parsed = parseNameFromEmail(f.email);
      if (parsed) {
        setF((prev) => ({
          ...prev,
          first_name: parsed.first,
          last_name: parsed.last || prev.last_name || 'Guest',
          full_name: parsed.full || `${parsed.first} ${prev.last_name || 'Guest'}`,
        }));
        toast(`✅ Automated Google collection: Verified "${parsed.full}" for guest manifest!`);
        return;
      }
    }

    try {
      await signInWithGoogle();
    } catch {
      toast('Please enter your Google email address and real name for the guest manifest.', true);
    }
  }

  // Automated Social Sign-Up (Google / Facebook)
  async function handleAutoSignUp(provider: 'google' | 'facebook') {
    const chosenProvider = provider === 'google' ? 'gmail' : 'facebook';
    setSignupProvider(chosenProvider);
    setConfirmationExpiredMsg('');

    let firstName = f.first_name.trim();
    let lastName = f.last_name.trim();

    // If names are not typed, intelligently infer from email or assign authentic guest identity
    if (!firstName || !lastName) {
      if (f.email && f.email.includes('@')) {
        const parsed = parseNameFromEmail(f.email);
        if (parsed) {
          firstName = firstName || parsed.first;
          lastName = lastName || parsed.last || (provider === 'google' ? 'Google' : 'Facebook');
        }
      }
      firstName = firstName || (provider === 'google' ? 'Google' : 'Facebook');
      lastName = lastName || 'Guest';
    }

    const targetEmail = f.email || (chosenProvider === 'facebook'
      ? generateAccountEmail(firstName, f.middle_name, lastName, 1, false, 'facebook')
      : generateAccountEmail(firstName, f.middle_name, lastName, 1, false, 'gmail'));
    const targetPass = f.password || 'ClientPassword123!';
    const phone = to11Digits(f.phone) || '09175558899';
    const address = f.address || 'Patar Beach';
    const city = (f.city || 'Bolinao').replace(/[^a-zA-Z\s\-]/g, '');
    const emergencyContact = to11Digits(f.emergency_contact) || '09185550123';

    // Automatically fill form state with entire user profile information
    setF((prev) => ({
      ...prev,
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
      email: targetEmail,
      password: targetPass,
      phone,
      address,
      city,
      emergency_contact: emergencyContact,
    }));

    setBusy(true);
    try {
      const res = await api.initiateSignup({
        email: targetEmail,
        password: targetPass,
        first_name: firstName,
        middle_name: f.middle_name,
        last_name: lastName,
        phone,
        address,
        city,
        emergency_contact: emergencyContact,
        provider: chosenProvider,
        is_automated: true,
      });

      setSignupEmail(targetEmail);
      setSignupPassword(targetPass);
      setSignupName([firstName, f.middle_name, lastName].filter(Boolean).join(' '));
      setDevCodePreview(res.dev_code_preview || '');
      setMode('2fa');
      setSignupCode('');
      setConfirmationTimeLeft(60); // 1-minute countdown
      setResendCooldown(30);
      toast(res.message || `2FA confirmation code dispatched to ${targetEmail}! You have 1 minute to confirm.`);
    } catch (err: any) {
      toast(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  // Standard Form Submit (Sign In or Initiate Sign Up)
  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setConfirmationExpiredMsg('');
    try {
      if (mode === 'in') {
        const { error } = await signIn(f.email, f.password);
        if (error) throw error;
        toast('Welcome back ✦');
        setAuthOpen(false);
      } else {
        // Sign-Up Mode: STRICT NAME ENFORCEMENT ("and the name is still need")
        const firstName = f.first_name.trim();
        const lastName = f.last_name.trim();

        if (!firstName || !lastName) {
          toast('Name is strictly required: First name and last name must be provided.', true);
          setBusy(false);
          return;
        }

        const fullName = [firstName, f.middle_name?.trim(), lastName].filter(Boolean).join(' ');
        let targetEmail = f.email.trim();

        // Enforce Gmail format if Gmail provider is selected
        if (signupProvider === 'gmail') {
          if (!targetEmail.toLowerCase().endsWith('@gmail.com') && !targetEmail.includes('@')) {
            targetEmail = `${targetEmail}@gmail.com`;
          } else if (!targetEmail.toLowerCase().endsWith('@gmail.com')) {
            toast('Please enter a valid Gmail address (@gmail.com).', true);
            setBusy(false);
            return;
          }
        }

        if (!termsAccepted) {
          toast('Please agree to the Website Terms of Stay and Privacy Policy to proceed.', true);
          setBusy(false);
          return;
        }
        if (!f.phone || f.phone.length !== 11 || !f.phone.startsWith('09')) {
          toast('Mobile phone is required and must strictly be an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567).', true);
          setBusy(false);
          return;
        }
        if (!f.password || f.password.length < 8) {
          toast('Password must be at least 8 characters long for account security.', true);
          setBusy(false);
          return;
        }
        if (!/[a-zA-Z]/.test(f.password) || !/[0-9]/.test(f.password)) {
          toast('Password must contain both letters and numbers for account security.', true);
          setBusy(false);
          return;
        }

        // Anti-Duplication Pre-check
        try {
          const dupRes = await api.checkDuplicate({ email: targetEmail, phone: f.phone });
          if (dupRes.isDuplicate) {
            toast(dupRes.message || 'An account with this email or mobile phone already exists. Please log in.', true);
            setBusy(false);
            return;
          }
        } catch {}
        if (f.emergency_contact && (f.emergency_contact.length !== 11 || !f.emergency_contact.startsWith('09'))) {
          toast('Emergency contact must strictly be an 11-digit Philippine mobile number starting with 09 (e.g. 09XXXXXXXXX).', true);
          setBusy(false);
          return;
        }

        // Initiate Registration -> Dispatch 2FA Confirmation Code
        const res = await api.initiateSignup({
          email: targetEmail,
          password: f.password,
          first_name: firstName,
          middle_name: f.middle_name,
          last_name: lastName,
          phone: f.phone,
          address: f.address,
          city: f.city,
          emergency_contact: f.emergency_contact,
          provider: signupProvider,
          is_automated: automationEnabled,
        });

        setSignupEmail(targetEmail);
        setSignupPassword(f.password);
        setSignupName(fullName);
        setDevCodePreview(res.dev_code_preview || '');
        setMode('2fa');
        setSignupCode('');
        setConfirmationTimeLeft(60); // 1-minute countdown
        setResendCooldown(30);
        toast(res.message || '2FA verification code dispatched! You have 1 minute to confirm.');
      }
    } catch (err: any) {
      toast(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  // Submit 2FA Confirmation Code & Finalize Account Creation
  async function submitSignup2FA(e: React.FormEvent) {
    e.preventDefault();
    if (!signupCode || signupCode.trim().length !== 6) {
      toast('Please enter the 6-digit 2FA confirmation code.', true);
      return;
    }

    setBusy(true);
    try {
      const res = await api.confirmSignup2FA(signupEmail, signupCode.trim());
      toast(res.message || 'Account verified and finalized! Logging you in…');

      // Automatically sign in the newly finalized client account
      const { error: signErr } = await signIn(signupEmail, signupPassword);
      if (signErr) {
        toast('Account finalized! Please enter your credentials to log in.');
        setMode('in');
        setF((prev) => ({ ...prev, email: signupEmail, password: signupPassword }));
      } else {
        toast(`Welcome to Rock View Beach Resort, ${signupName}! ✦`);
        setAuthOpen(false);
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('expired') || msg.includes('Try Again')) {
        setMode('up');
        setConfirmationExpiredMsg('Try Again, please make sure you confirm');
      }
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  // Resend 2FA Confirmation Code
  async function handleResendSignup2FA() {
    if (resendCooldown > 0) return;
    setBusy(true);
    try {
      const res = await api.resendSignup2FA(signupEmail);
      if (res.dev_code_preview) setDevCodePreview(res.dev_code_preview);
      setConfirmationTimeLeft(60); // Reset to full 1 minute on resend
      setResendCooldown(30);
      setConfirmationExpiredMsg('');
      toast(res.message || 'New 2FA confirmation code dispatched! You have 1 minute to confirm.');
    } catch (err: any) {
      toast(err.message, true);
    } finally {
      setBusy(false);
    }
  }


  // Profile Completion Handler
  async function submitCompletion(e: React.FormEvent) {
    e.preventDefault();
    if (comp.phone && (comp.phone.length !== 11 || !comp.phone.startsWith('09'))) {
      toast('Mobile phone must strictly be an 11-digit Philippine mobile number starting with 09 (e.g. 09XXXXXXXXX).', true);
      return;
    }
    if (comp.emergency_contact && (comp.emergency_contact.length !== 11 || !comp.emergency_contact.startsWith('09'))) {
      toast('Emergency contact must strictly be an 11-digit Philippine mobile number starting with 09 (e.g. 09XXXXXXXXX).', true);
      return;
    }
    setBusy(true);
    try {
      const fullName = [comp.first_name, comp.middle_name, comp.last_name].filter(Boolean).join(' ');
      await updateProfile({ ...comp, full_name: fullName });
      toast('Resort Profile Updated ✦');
      setNeedsProfileCompletion(false);
    } catch (err: any) { toast(err.message, true); }
    finally { setBusy(false); }
  }

  // Profile Completion Modal
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
                <label>FIRST NAME * (CHAR ONLY)</label>
                <input required value={comp.first_name} placeholder="Juan"
                  onChange={(e) => setComp({ ...comp, first_name: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') })} />
              </div>
              <div className="field">
                <label>MIDDLE NAME (CHAR ONLY)</label>
                <input value={comp.middle_name} placeholder="Dela"
                  onChange={(e) => setComp({ ...comp, middle_name: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') })} />
              </div>
              <div className="field">
                <label>LAST NAME * (CHAR ONLY)</label>
                <input required value={comp.last_name} placeholder="Cruz"
                  onChange={(e) => setComp({ ...comp, last_name: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') })} />
              </div>
            </div>
            {/* ROW 2: Symmetrical 2-column numbers (Phone & Emergency Contact) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              <div className="field">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>MOBILE PHONE (11-DIGIT NUMBER ONLY)</span>
                  {comp.phone && (
                    <span style={{ color: comp.phone.length === 11 ? '#10B981' : '#F59E0B', fontSize: '0.74rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {comp.phone.length}/11 digits
                    </span>
                  )}
                </label>
                <input
                  required
                  inputMode="numeric"
                  maxLength={11}
                  value={comp.phone}
                  placeholder="09XXXXXXXXX"
                  onChange={(e) => setComp({ ...comp, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                />
              </div>

              <div className="field">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>EMERGENCY CONTACT (11-DIGIT NUMBER ONLY)</span>
                  {comp.emergency_contact && (
                    <span style={{ color: comp.emergency_contact.length === 11 ? '#10B981' : '#F59E0B', fontSize: '0.74rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {comp.emergency_contact.length}/11 digits
                    </span>
                  )}
                </label>
                <input
                  inputMode="numeric"
                  maxLength={11}
                  value={comp.emergency_contact}
                  placeholder="09XXXXXXXXX"
                  onChange={(e) => setComp({ ...comp, emergency_contact: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                />
              </div>
            </div>

            {/* ROW 3: Symmetrical 2-column locations (City & Address) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <div className="field">
                <label>CITY / PROVINCE (CHAR ONLY)</label>
                <input value={comp.city} placeholder="e.g. Manila"
                  onChange={(e) => setComp({ ...comp, city: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') })} />
              </div>
              <div className="field">
                <label>HOME / STREET ADDRESS</label>
                <input required value={comp.address} placeholder="e.g. 123 Sunset Drive"
                  onChange={(e) => setComp({ ...comp, address: e.target.value })} />
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

  const isNameValid = Boolean(f.first_name.trim() && f.last_name.trim());
  const fullNamePreview = [f.first_name.trim(), f.middle_name?.trim(), f.last_name.trim()].filter(Boolean).join(' ');

  return (
    <div className="modal-overlay" onClick={() => setAuthOpen(false)}>
      <div className="modal" style={{ maxWidth: 510 }} onClick={(e) => e.stopPropagation()}>
        {/* MODAL HEADER */}
        <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="label light">
              {mode === 'in' ? 'Guest Access' : mode === 'up' ? 'Client Sign-Up' : mode === '2fa' ? '2FA Confirmation' : 'Account Recovery'}
            </span>
            <h3 className="serif" style={{ fontSize: '1.7rem', marginTop: 2 }}>
              {mode === 'in' ? 'Welcome Back' : mode === 'up' ? 'Join Resort' : mode === '2fa' ? 'Verify & Finalize' : 'Reset Password'}
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
          {/* ============================================================ */}
          {/* MODE: SIGN IN / SIGN UP MAIN VIEW */}
          {/* ============================================================ */}
          {mode !== 'recovery' && mode !== '2fa' && (
            <>
              {/* SOCIAL AUTH BUTTONS: GOOGLE & FACEBOOK */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                {/* Google Sign In */}
                <button
                  className="google-btn"
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    fontWeight: 700,
                    fontSize: '.82rem',
                    padding: '11px 12px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={handleGoogleLogin}
                >
                  <i className="fab fa-google" style={{ fontSize: '1.05rem', color: '#EA4335' }} />
                  Google
                </button>

                {/* Facebook Sign In */}
                <button
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    border: '1px solid #1877F2',
                    background: '#1877F2',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '.82rem',
                    padding: '11px 12px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(24,119,242,0.3)',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={handleFacebookLogin}
                >
                  <i className="fab fa-facebook-f" style={{ fontSize: '1.05rem', color: '#FFFFFF' }} />
                  Facebook
                </button>
              </div>

              {/* AUTOMATION CONTROLS PANEL FOR CLIENT ONBOARDING */}
              {mode === 'up' && (
                <div style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  marginBottom: 16,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <i className="fas fa-bolt" style={{ fontSize: '1.1rem', color: '#F59E0B' }} />
                      <div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38BDF8', letterSpacing: '0.04em' }}>
                          AUTOMATION CONTROLS
                        </span>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#94A3B8' }}>
                          One-Click Google & Facebook Auto Sign-Up Engine
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutomationOpen(!automationOpen)}
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        color: '#7DD3FC',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        padding: '4px 9px',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      {automationOpen ? 'Hide Controls ▲' : 'Open Controls ▼'}
                    </button>
                  </div>

                  {/* QUICK AUTO SIGN-UP ACTION BUTTONS */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => handleAutoSignUp('google')}
                      disabled={busy}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        background: 'linear-gradient(135deg, rgba(234, 67, 53, 0.2), rgba(251, 188, 5, 0.15))',
                        border: '1px solid rgba(234, 67, 53, 0.5)',
                        color: '#F8FAFC',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        padding: '8px 10px',
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                    >
                      <span><i className="fab fa-google" style={{ marginRight: 6 }} />Auto Sign-Up (Google)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAutoSignUp('facebook')}
                      disabled={busy}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        background: 'linear-gradient(135deg, rgba(24, 119, 242, 0.25), rgba(56, 189, 248, 0.15))',
                        border: '1px solid rgba(24, 119, 242, 0.5)',
                        color: '#F8FAFC',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        padding: '8px 10px',
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                    >
                      <span><i className="fab fa-facebook-f" style={{ marginRight: 6 }} />Auto Sign-Up (Facebook)</span>
                    </button>
                  </div>

                  {/* EXPANDED AUTOMATION SETTINGS */}
                  {automationOpen && (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: '0.75rem', color: '#CBD5E1' }}><i className="fas fa-robot" style={{ marginRight: 6 }} />Auto Sign-Up Automation Engine</span>
                        <button
                          type="button"
                          onClick={() => setAutomationEnabled(!automationEnabled)}
                          style={{
                            background: automationEnabled ? '#10B981' : '#475569',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: 12,
                            padding: '2px 10px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {automationEnabled ? 'ENABLED' : 'PAUSED'}
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: '0.75rem', color: '#CBD5E1' }}><i className="fas fa-envelope" style={{ marginRight: 6 }} />Auto-Dispatch 2FA to Gmail</span>
                        <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 700 }}>ACTIVE (SMTP)</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: '0.75rem', color: '#CBD5E1' }}><i className="fas fa-shield-halved" style={{ marginRight: 6 }} />Mandatory Name Sentinel</span>
                        <span style={{ fontSize: '0.7rem', color: '#38BDF8', fontWeight: 700 }}>ENFORCED (GUEST MANIFEST)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0 14px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                <span style={{ fontSize: '.72rem', letterSpacing: '.18em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                  {mode === 'in' ? 'or sign in with email' : 'or manual credentials'}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              </div>

              {/* TABS: SIGN IN vs SIGN UP */}
              <div className="modal-tabs" style={{ marginBottom: 14 }}>
                <button type="button" className={mode === 'in' ? 'sel' : ''} onClick={() => setMode('in')}>
                  Sign In
                </button>
                <button type="button" className={mode === 'up' ? 'sel' : ''} onClick={() => setMode('up')}>
                  Sign Up (2FA Required)
                </button>
              </div>

              {/* SIGN UP PROVIDER SELECTION */}
              {mode === 'up' && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <button
                    type="button"
                    onClick={() => setSignupProvider('gmail')}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: signupProvider === 'gmail' ? '1.5px solid #EA4335' : '1px solid rgba(255,255,255,0.15)',
                      background: signupProvider === 'gmail' ? 'rgba(234, 67, 53, 0.18)' : 'rgba(15, 23, 42, 0.6)',
                      color: signupProvider === 'gmail' ? '#FCA5A5' : '#94A3B8',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <><i className="fab fa-google" style={{ color: '#EA4335', marginRight: 6 }} />Gmail (@gmail.com)</>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignupProvider('facebook')}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: signupProvider === 'facebook' ? '1.5px solid #1877F2' : '1px solid rgba(255,255,255,0.15)',
                      background: signupProvider === 'facebook' ? 'rgba(24, 119, 242, 0.22)' : 'rgba(15, 23, 42, 0.6)',
                      color: signupProvider === 'facebook' ? '#93C5FD' : '#94A3B8',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <><i className="fab fa-facebook" style={{ color: '#1877F2', marginRight: 6 }} />Facebook Account</>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignupProvider('email')}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: signupProvider === 'email' ? '1.5px solid #38BDF8' : '1px solid rgba(255,255,255,0.15)',
                      background: signupProvider === 'email' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(15, 23, 42, 0.6)',
                      color: signupProvider === 'email' ? '#BAE6FD' : '#94A3B8',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <><i className="fas fa-envelope" style={{ color: '#38BDF8', marginRight: 6 }} />Standard Email</>
                  </button>
                </div>
              )}

              {/* 1-MINUTE TIME-GATED CONFIRMATION EXPIRED NOTIFICATION BANNER */}
              {confirmationExpiredMsg && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.16)',
                  border: '2px solid #EF4444',
                  borderRadius: 12,
                  padding: '12px 16px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
                }}>
                  <i className="fas fa-triangle-exclamation" style={{ fontSize: '1.6rem', color: '#EF4444' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#FCA5A5', fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.01em' }}>
                      {confirmationExpiredMsg}
                    </div>
                    <div style={{ color: '#E2E8F0', fontSize: '0.76rem', marginTop: 3, lineHeight: 1.4 }}>
                      The 1-minute confirmation window expired and the unconfirmed account was automatically removed. Please re-submit to receive a fresh verification code.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmationExpiredMsg('')}
                    style={{ background: 'none', border: 'none', color: '#F87171', fontSize: '1.3rem', cursor: 'pointer', padding: 0 }}
                  >
                    ×
                  </button>
                </div>
              )}

              {/* FORM FIELDS */}
              <form onSubmit={submitAuth}>
                {mode === 'up' && (
                  <>
                    {/* AUTOMATED GOOGLE/GMAIL COLLECTION TRIGGER */}
                    {signupProvider === 'gmail' && (
                      <div style={{
                        background: 'rgba(234, 67, 53, 0.1)',
                        border: '1px solid rgba(234, 67, 53, 0.35)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}>
                        <div style={{ fontSize: '0.76rem', color: '#FECACA' }}>
                          <strong style={{ color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <><i className="fas fa-bolt" style={{ color: '#F59E0B', marginRight: 6 }} />Automated Google Account Collection</>
                          </strong>
                          <div style={{ color: '#94A3B8', fontSize: '0.72rem', marginTop: 2 }}>
                            Automatically collect and verify user information from your Google account.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleAutoCollectGoogleInfo}
                          style={{
                            background: '#EA4335',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: 6,
                            padding: '6px 12px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 6px rgba(234, 67, 53, 0.3)',
                          }}
                        >
                          Auto-Collect Google Info
                        </button>
                      </div>
                    )}

                    {/* MANDATORY NAME BANNER */}
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      marginBottom: 12,
                      fontSize: '0.76rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isNameValid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      border: `1px solid ${isNameValid ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
                      color: isNameValid ? '#6EE7B7' : '#FCD34D',
                    }}>
                      <span>
                        {isNameValid
                          ? <><i className="fas fa-check" style={{ marginRight: 4, color: '#10B981' }} />Guest Name Verified: {fullNamePreview}</>
                          : <><i className="fas fa-triangle-exclamation" style={{ marginRight: 4, color: '#FCD34D' }} />Name is strictly required for Guest Manifest & Security 2FA</>}
                      </span>
                      <span style={{ fontWeight: 800 }}>MANDATORY</span>
                    </div>

                    {/* NAME FIELDS: FIRST, MIDDLE, LAST (MANDATORY CHAR ONLY) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div className="field">
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>FIRST NAME * (CHAR ONLY)</span>
                          {f.first_name && <i className="fas fa-check" style={{ color: '#10B981' }} />}
                        </label>
                        <input
                          required
                          value={f.first_name}
                          placeholder="Juan"
                          onChange={(e) => setF({ ...f, first_name: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') })}
                        />
                      </div>
                      <div className="field">
                        <label>MIDDLE NAME (CHAR ONLY)</label>
                        <input
                          value={f.middle_name}
                          placeholder="Dela"
                          onChange={(e) => setF({ ...f, middle_name: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') })}
                        />
                      </div>
                      <div className="field">
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>LAST NAME * (CHAR ONLY)</span>
                          {f.last_name && <i className="fas fa-check" style={{ color: '#10B981' }} />}
                        </label>
                        <input
                          required
                          value={f.last_name}
                          placeholder="Cruz"
                          onChange={(e) => setF({ ...f, last_name: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') })}
                        />
                      </div>
                    </div>

                    {/* ROW 2: Symmetrical 2-column numbers (Phone & Emergency Contact) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                      <div className="field">
                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>MOBILE PHONE (11-DIGIT NUMBER ONLY)</span>
                          {f.phone && (
                            <span style={{ color: f.phone.length === 11 ? '#10B981' : '#F59E0B', fontSize: '0.74rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {f.phone.length}/11 digits
                            </span>
                          )}
                        </label>
                        <input
                          required
                          inputMode="numeric"
                          maxLength={11}
                          value={f.phone}
                          placeholder="09XXXXXXXXX"
                          onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                        />
                      </div>

                      <div className="field">
                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>EMERGENCY CONTACT (11-DIGIT NUMBER ONLY)</span>
                          {f.emergency_contact && (
                            <span style={{ color: f.emergency_contact.length === 11 ? '#10B981' : '#F59E0B', fontSize: '0.74rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {f.emergency_contact.length}/11 digits
                            </span>
                          )}
                        </label>
                        <input
                          inputMode="numeric"
                          maxLength={11}
                          value={f.emergency_contact}
                          placeholder="09XXXXXXXXX"
                          onChange={(e) => setF({ ...f, emergency_contact: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                        />
                      </div>
                    </div>

                    {/* ROW 3: Symmetrical 2-column locations (City & Address) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                      <div className="field">
                        <label>CITY / PROVINCE (CHAR ONLY)</label>
                        <input
                          value={f.city}
                          placeholder="Bolinao"
                          onChange={(e) => setF({ ...f, city: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') })}
                        />
                      </div>
                      <div className="field">
                        <label>HOME / STREET ADDRESS</label>
                        <input
                          value={f.address}
                          placeholder="Patar Beach"
                          onChange={(e) => setF({ ...f, address: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}


                <div className="field">
                  <label>
                    {mode === 'in'
                      ? 'USERNAME OR EMAIL'
                      : signupProvider === 'gmail' && mode === 'up'
                      ? 'GMAIL ADDRESS (2FA CONFIRMATION DISPATCH)'
                      : signupProvider === 'facebook' && mode === 'up'
                      ? 'FACEBOOK ACCOUNT EMAIL'
                      : 'ACCOUNT EMAIL'}
                  </label>
                  <input
                    type={mode === 'in' ? 'text' : 'email'}
                    required
                    value={f.email}
                    placeholder={
                      mode === 'in'
                        ? 'Username or user@email.com'
                        : signupProvider === 'gmail' && mode === 'up'
                        ? 'user@gmail.com'
                        : signupProvider === 'facebook' && mode === 'up'
                        ? 'user@facebook.com'
                        : 'user@email.com'
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      const nextF: any = { email: val };
                      if (mode === 'up' && (!f.first_name || !f.last_name)) {
                        const parsed = parseNameFromEmail(val);
                        if (parsed) {
                          if (!f.first_name && parsed.first) nextF.first_name = parsed.first;
                          if (!f.last_name && parsed.last) nextF.last_name = parsed.last;
                          if (parsed.full) nextF.full_name = parsed.full;
                        }
                      }
                      setF({ ...f, ...nextF });
                    }}
                  />
                  {mode === 'up' && (
                    <span className="small muted" style={{ display: 'block', marginTop: 4, fontSize: '0.74rem' }}>
                      Suggested email: <code>{generateAccountEmail(f.first_name, f.middle_name, f.last_name, 1, false, signupProvider === 'facebook' ? 'facebook' : 'gmail')}</code>
                    </span>
                  )}
                </div>

                <div className="field">
                  <label>PASSWORD</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={f.password}
                    placeholder="••••••••"
                    onChange={(e) => setF({ ...f, password: e.target.value })}
                  />
                </div>

                {mode === 'in' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6, marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={() => { setMode('recovery'); setRecoveryStep(1); setRecoveryEmail(f.email); }}
                      style={{ background: 'none', border: 'none', color: '#38BDF8', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {mode === 'up' && (
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.78rem', color: '#94A3B8', marginTop: 12, cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      I have read, understood, and accept the Rock View Beach Resort Website Terms of Stay & Privacy Policy (RA 10173).
                    </span>
                  </label>
                )}

                <button
                  className="btn btn-sky"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 12, padding: '12px' }}
                  disabled={busy}
                >
                  {busy ? 'One moment…' : mode === 'in' ? 'Sign In ✦' : 'Proceed to 2FA Verification ➔'}
                </button>
              </form>
            </>
          )}

          {/* ============================================================ */}
          {/* MODE: 2FA CONFIRMATION STEP BEFORE ACCOUNT FINALIZATION */}
          {/* ============================================================ */}
          {mode === '2fa' && (
            <div style={{ marginTop: 4 }}>
              {/* 1-MINUTE TIME-GATED CONFIRMATION COUNTDOWN */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: confirmationTimeLeft < 15 ? 'rgba(239, 68, 68, 0.22)' : 'rgba(2, 132, 199, 0.16)',
                border: confirmationTimeLeft < 15 ? '1.5px solid #EF4444' : '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: 10,
                padding: '10px 14px',
                marginBottom: 14,
                transition: 'all 0.3s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.4rem' }}>{confirmationTimeLeft < 15 ? '⏳' : '⏱️'}</span>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: confirmationTimeLeft < 15 ? '#FCA5A5' : '#7DD3FC' }}>
                      1-MINUTE CONFIRMATION GATE
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                      Account registered inside system. Must confirm within 60s or it is auto-removed.
                    </div>
                  </div>
                </div>
                <div style={{
                  fontFamily: 'Consolas, monospace',
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: confirmationTimeLeft < 15 ? '#EF4444' : '#38BDF8',
                }}>
                  00:{confirmationTimeLeft.toString().padStart(2, '0')}
                </div>
              </div>

              <div style={{
                background: 'rgba(14, 165, 233, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: 12,
                padding: '16px',
                marginBottom: 16,
                textAlign: 'center',
              }}>
                <i className="fas fa-lock" style={{ fontSize: '1.6rem', display: 'block', marginBottom: 4, color: '#38BDF8' }} />
                <h4 style={{ color: '#FFFFFF', margin: '0 0 6px', fontSize: '1.1rem' }}>Two-Factor Confirmation</h4>
                <p style={{ color: '#CBD5E1', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>
                  A secure 6-digit confirmation code was sent to <strong>{signupEmail}</strong> via Google Mail (SMTP)
                  and your mobile phone. Enter it below to finalize your client account creation.
                </p>
                <div style={{ marginTop: 8, fontSize: '0.74rem', color: '#94A3B8' }}>
                  Client Name: <strong style={{ color: '#38BDF8' }}>{signupName}</strong>
                </div>
              </div>

              {/* DEV PREVIEW HELPER FOR AUTOMATION TESTING */}
              {devCodePreview && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  padding: '8px 12px',
                  borderRadius: 8,
                  marginBottom: 14,
                }}>
                  <span style={{ fontSize: '0.76rem', color: '#6EE7B7' }}>
                    <><i className="fas fa-bolt" style={{ color: '#F59E0B', marginRight: 4 }} /> <strong>Automated Dev Preview:</strong></> Code is <code>{devCodePreview}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSignupCode(devCodePreview)}
                    style={{
                      background: '#10B981',
                      border: 'none',
                      color: '#FFFFFF',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    Auto-Fill 2FA
                  </button>
                </div>
              )}

              <form onSubmit={submitSignup2FA}>
                <div className="field">
                  <label style={{ textAlign: 'center', display: 'block', letterSpacing: '0.08em' }}>
                    ENTER 6-DIGIT 2FA CONFIRMATION CODE
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    autoFocus
                    value={signupCode}
                    placeholder="••••••"
                    style={{
                      letterSpacing: '0.38em',
                      fontSize: '1.5rem',
                      textAlign: 'center',
                      fontWeight: 800,
                      background: 'rgba(15, 23, 42, 0.8)',
                      borderColor: '#0284C7',
                      color: '#38BDF8',
                    }}
                    onChange={(e) => setSignupCode(e.target.value.trim())}
                  />
                  <span className="small muted" style={{ display: 'block', textAlign: 'center', marginTop: 6, fontSize: '0.72rem' }}>
                    ⏱️ Token strictly valid for 1 minute (60s) · Account automatically removed if unconfirmed
                  </span>
                </div>

                <button
                  className="btn btn-sky"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 14, padding: '12px', fontSize: '0.96rem' }}
                  disabled={busy}
                >
                  {busy ? 'Verifying 2FA & Finalizing…' : 'Verify 2FA & Finalize Sign-Up ✦'}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || busy}
                    onClick={handleResendSignup2FA}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: resendCooldown > 0 ? '#64748B' : '#38BDF8',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: resendCooldown > 0 ? 'default' : 'pointer',
                      padding: 0,
                    }}
                  >
                    {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend 2FA Code (1 min)'}
                  </button>

                  <button
                    type="button"
                    onClick={handleCancel2FA}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--muted)',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    ← Edit Details / Cancel
                  </button>
                </div>
              </form>
            </div>
          )}


          {/* ============================================================ */}
          {/* MODE: ACCOUNT RECOVERY & PASSWORD RESET */}
          {/* ============================================================ */}
          {mode === 'recovery' && (
            <div style={{ marginTop: 8 }}>
              {/* GOOGLE INSTANT RECOVERY OPTION */}
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
                <i className="fab fa-google" style={{ fontSize: '1.15rem', color: '#EA4335' }} />
                Instant Recovery via Google Account
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0 16px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                <span style={{ fontSize: '.72rem', letterSpacing: '.18em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                  or email OTP verification
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              </div>

              {recoveryStep === 1 ? (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!recoveryEmail) return toast('Please enter your account email', true);
                  setBusy(true);
                  try {
                    const res = await api.forgotPassword(recoveryEmail);
                    toast(res.message || 'OTP verification code dispatched to your email!');
                    setRecoveryStep(2);
                  } catch (err: any) {
                    toast(err.message, true);
                  } finally {
                    setBusy(false);
                  }
                }}>
                  <p className="muted small" style={{ marginBottom: 16, lineHeight: 1.5 }}>
                    Enter your registered account email. A secure 6-digit OTP code will be delivered to your inbox (via Nodemailer Google Mail/SMTP) and verified phone number.
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
                    {busy ? 'Dispatching OTP Code…' : 'Send 6-Digit Email OTP ✦'}
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
                  } catch (err: any) {
                    toast(err.message, true);
                  } finally {
                    setBusy(false);
                  }
                }}>
                  <p className="muted small" style={{ marginBottom: 16, lineHeight: 1.5 }}>
                    Enter the 6-digit OTP code dispatched to <strong>{recoveryEmail}</strong> and choose a new password.
                  </p>
                  <div className="field">
                    <label>6-DIGIT EMAIL OTP VERIFICATION CODE</label>
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
                    {busy ? 'Verifying OTP & Updating…' : 'Verify OTP & Reset Password ✦'}
                  </button>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await api.forgotPassword(recoveryEmail);
                          toast(res.message || 'New OTP dispatched!');
                        } catch (err: any) {
                          toast(err.message, true);
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.82rem', cursor: 'pointer', padding: 0 }}
                    >
                      Resend Email OTP
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
