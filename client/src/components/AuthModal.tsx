import { useEffect, useState } from 'react';
import { useAuth, generateAccountEmail, to11Digits } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { toast } from './Toasts.tsx';
import GoogleAccountChooserModal, { GoogleAccount } from './GoogleAccountChooserModal.tsx';

export default function AuthModal() {
  const {
    session, profile, authOpen, setAuthOpen,
    needsProfileCompletion, setNeedsProfileCompletion,
    signIn, signInWithGoogle, signInWithFacebook, updateProfile,
    sendGmailOtp, verifyGmailOtp,
  } = useAuth();

  const [mode, setMode] = useState<'in' | 'up' | '2fa' | 'recovery' | 'gmail-otp'>('in');
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
  const [modalErrors, setModalErrors] = useState<Record<string, string>>({});
  const [showCautionBanner, setShowCautionBanner] = useState(false);

  // 2FA Confirmation State
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupCode, setSignupCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [confirmationTimeLeft, setConfirmationTimeLeft] = useState(60); // 1-minute (60s) confirmation gate
  const [confirmationExpiredMsg, setConfirmationExpiredMsg] = useState('');
  const [latestOtpPreview, setLatestOtpPreview] = useState('');

  // Gmail OTP Direct Sign-In State
  const [gmailOtpEmail, setGmailOtpEmail] = useState('');
  const [gmailOtpName, setGmailOtpName] = useState('');
  const [gmailOtpCode, setGmailOtpCode] = useState('');
  const [gmailOtpStep, setGmailOtpStep] = useState<1 | 2>(1);

  // Account Recovery State
  const [recoveryStep, setRecoveryStep] = useState(1); // 1 = Request Code, 2 = Verify Code & Reset
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');

  // Express Google Account Chooser State
  const [googleChooserOpen, setGoogleChooserOpen] = useState(false);
  const [googleChooserLoading, setGoogleChooserLoading] = useState(false);

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
  const handleGoogleLogin = () => {
    setGoogleChooserOpen(true);
  };

  const handleSelectGoogleAccount = async (account: GoogleAccount) => {
    try {
      setGoogleChooserLoading(true);
      toast('Connecting to Google Sign-In…');
      const res: any = await signInWithGoogle({
        email: account.email,
        name: account.name,
      });
      if (res?.error) throw res.error;
      setGoogleChooserOpen(false);
      setAuthOpen(false);
      toast(`Welcome to Rock View Beach Resort, ${account.name}! ✦`);
    } catch (err: any) {
      const msg = err.msg || err.message || '';
      toast(msg || 'Google Sign-In failed', true);
    } finally {
      setGoogleChooserLoading(false);
    }
  };

  async function handleFacebookLogin() {
    try {
      toast('Connecting to Facebook Sign-In…');
      const res: any = await signInWithFacebook();
      if (res?.needsPrompt) {
        let initialEmail = f.email || recoveryEmail || '';
        let initialName = [f.first_name, f.last_name].filter(Boolean).join(' ');
        const emailInput = window.prompt('Enter your Facebook account email to connect:', initialEmail);
        if (emailInput && emailInput.includes('@')) {
          await signInWithFacebook({
            email: emailInput.trim(),
            name: initialName || emailInput.split('@')[0],
          });
        }
      }
    } catch (err: any) {
      const msg = err.msg || err.message || '';
      toast(msg || 'Facebook Sign-In failed', true);
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
        // Sign-Up Mode: STRICT FIELD VALIDATION & CAUTION POPUP ALERT
        const firstName = f.first_name.trim();
        const lastName = f.last_name.trim();
        const errs: Record<string, string> = {};

        if (!firstName) {
          errs.first_name = 'First name is required.';
        } else if (!/^[a-zA-Z\s\-]+$/.test(firstName)) {
          errs.first_name = 'First name must contain letters only.';
        }

        if (!lastName) {
          errs.last_name = 'Last name is required.';
        } else if (!/^[a-zA-Z\s\-]+$/.test(lastName)) {
          errs.last_name = 'Last name must contain letters only.';
        }

        let targetEmail = f.email.trim();
        if (signupProvider === 'gmail') {
          if (!targetEmail.toLowerCase().endsWith('@gmail.com') && !targetEmail.includes('@')) {
            targetEmail = `${targetEmail}@gmail.com`;
          } else if (!targetEmail.toLowerCase().endsWith('@gmail.com')) {
            errs.email = 'Please enter a valid Gmail address (@gmail.com).';
          }
        } else if (!targetEmail) {
          errs.email = 'Account email is required.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
          errs.email = 'Please enter a valid email address.';
        }

        if (!f.phone || f.phone.length !== 11 || !f.phone.startsWith('09')) {
          errs.phone = '11-digit Philippine mobile starting with 09 is required (e.g. 09171234567).';
        }

        if (!f.password || f.password.length < 8) {
          errs.password = 'Password must be at least 8 characters long.';
        } else if (!/[a-zA-Z]/.test(f.password) || !/[0-9]/.test(f.password)) {
          errs.password = 'Password must contain both letters and numbers.';
        }

        if (!termsAccepted) {
          errs.terms = 'Please accept the Website Terms of Stay and Privacy Policy.';
        }

        if (Object.keys(errs).length > 0) {
          setModalErrors(errs);
          setShowCautionBanner(true);
          toast('⚠️ Caution: Please complete the required fields highlighted in red.', true);
          setBusy(false);
          return;
        }

        setModalErrors({});
        setShowCautionBanner(false);
        const fullName = [firstName, f.middle_name?.trim(), lastName].filter(Boolean).join(' ');

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
        });

        setSignupEmail(targetEmail);
        setSignupPassword(f.password);
        setSignupName(fullName);
        if (res?.otp_preview) {
          setLatestOtpPreview(res.otp_preview);
        }
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
      if (res?.otp_preview) {
        setLatestOtpPreview(res.otp_preview);
      }
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

  // Handle Dispatching Gmail OTP Code (Direct Sign-In)
  async function handleSendGmailOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!gmailOtpEmail || !gmailOtpEmail.includes('@')) {
      toast('Please enter a valid Gmail / Email address.', true);
      return;
    }
    setBusy(true);
    try {
      const res: any = await sendGmailOtp(gmailOtpEmail, gmailOtpName);
      if (res?.otp_preview) {
        setLatestOtpPreview(res.otp_preview);
      }
      toast(res?.message || `6-digit OTP code dispatched to ${gmailOtpEmail}.`);
      setGmailOtpStep(2);
    } catch (err: any) {
      toast(err.message || 'Failed to dispatch Gmail OTP code.', true);
    } finally {
      setBusy(false);
    }
  }

  // Handle Verifying Gmail OTP Code (Direct Sign-In)
  async function handleVerifyGmailOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!gmailOtpCode || gmailOtpCode.trim().length !== 6) {
      toast('Please enter the 6-digit OTP code.', true);
      return;
    }
    setBusy(true);
    try {
      const res: any = await verifyGmailOtp(gmailOtpEmail, gmailOtpCode.trim(), gmailOtpName);
      if (res?.error) {
        toast(res.error.message || 'Invalid or expired OTP code.', true);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to verify OTP code.', true);
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
              {mode === 'in' ? 'Guest Access' : mode === 'up' ? 'Client Sign-Up' : mode === '2fa' ? '2FA Confirmation' : mode === 'gmail-otp' ? 'Gmail OTP Access' : 'Account Recovery'}
            </span>
            <h3 className="serif" style={{ fontSize: '1.7rem', marginTop: 2 }}>
              {mode === 'in' ? 'Welcome Back' : mode === 'up' ? 'Join Resort' : mode === '2fa' ? 'Verify & Finalize' : mode === 'gmail-otp' ? 'Instant Sign In' : 'Reset Password'}
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
          {mode !== 'recovery' && mode !== '2fa' && mode !== 'gmail-otp' && (
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

              {/* POPUP CAUTION SIGN BANNER */}
              {showCautionBanner && Object.keys(modalErrors).length > 0 && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  marginBottom: 14,
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(245, 158, 11, 0.14) 100%)',
                  border: '1.5px solid rgba(239, 68, 68, 0.55)',
                  boxShadow: '0 6px 20px rgba(239, 68, 68, 0.18)',
                  animation: 'rlCautionShake 0.4s ease-out'
                }} role="alert">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#FCA5A5', fontWeight: 700, fontSize: '0.85rem' }}>
                      <i className="fas fa-triangle-exclamation" style={{ color: '#EF4444', fontSize: '1.05rem', filter: 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.6))' }} />
                      <span>CAUTION: Incomplete Required Fields</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCautionBanner(false)}
                      style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '0.9rem', padding: 2 }}
                      aria-label="Dismiss caution"
                    >
                      <i className="fas fa-xmark" />
                    </button>
                  </div>
                  <p style={{ margin: '0 0 6px 0', fontSize: '0.76rem', color: '#E2E8F0', lineHeight: 1.4 }}>
                    Please fill out and correct the highlighted fields marked in red below to continue registration:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.74rem', color: '#FCA5A5', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {modalErrors.first_name && <li>• {modalErrors.first_name}</li>}
                    {modalErrors.last_name && <li>• {modalErrors.last_name}</li>}
                    {modalErrors.phone && <li>• {modalErrors.phone}</li>}
                    {modalErrors.email && <li>• {modalErrors.email}</li>}
                    {modalErrors.password && <li>• {modalErrors.password}</li>}
                    {modalErrors.terms && <li>• {modalErrors.terms}</li>}
                  </ul>
                </div>
              )}

              {/* FORM FIELDS */}
              <form onSubmit={submitAuth} noValidate>
                {mode === 'up' && (
                  <>
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
                        <label style={{ display: 'flex', justifyContent: 'space-between', color: modalErrors.first_name ? '#F87171' : undefined }}>
                          <span>FIRST NAME * (CHAR ONLY)</span>
                          {f.first_name && !modalErrors.first_name && <i className="fas fa-check" style={{ color: '#10B981' }} />}
                        </label>
                        <input
                          required
                          value={f.first_name}
                          placeholder="Juan"
                          style={{
                            borderColor: modalErrors.first_name ? '#EF4444' : undefined,
                            boxShadow: modalErrors.first_name ? '0 0 0 3px rgba(239, 68, 68, 0.25)' : undefined
                          }}
                          onChange={(e) => {
                            setF({ ...f, first_name: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') });
                            if (modalErrors.first_name) setModalErrors(prev => ({ ...prev, first_name: '' }));
                          }}
                        />
                        {modalErrors.first_name && (
                          <span style={{ color: '#F87171', fontSize: '0.72rem', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <i className="fas fa-circle-exclamation" style={{ color: '#EF4444' }} /> {modalErrors.first_name}
                          </span>
                        )}
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
                        <label style={{ display: 'flex', justifyContent: 'space-between', color: modalErrors.last_name ? '#F87171' : undefined }}>
                          <span>LAST NAME * (CHAR ONLY)</span>
                          {f.last_name && !modalErrors.last_name && <i className="fas fa-check" style={{ color: '#10B981' }} />}
                        </label>
                        <input
                          required
                          value={f.last_name}
                          placeholder="Cruz"
                          style={{
                            borderColor: modalErrors.last_name ? '#EF4444' : undefined,
                            boxShadow: modalErrors.last_name ? '0 0 0 3px rgba(239, 68, 68, 0.25)' : undefined
                          }}
                          onChange={(e) => {
                            setF({ ...f, last_name: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') });
                            if (modalErrors.last_name) setModalErrors(prev => ({ ...prev, last_name: '' }));
                          }}
                        />
                        {modalErrors.last_name && (
                          <span style={{ color: '#F87171', fontSize: '0.72rem', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <i className="fas fa-circle-exclamation" style={{ color: '#EF4444' }} /> {modalErrors.last_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ROW 2: Symmetrical 2-column numbers (Phone & Emergency Contact) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                      <div className="field">
                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: modalErrors.phone ? '#F87171' : undefined }}>
                          <span>MOBILE PHONE (11-DIGIT NUMBER ONLY)</span>
                          {f.phone && (
                            <span style={{ color: f.phone.length === 11 && f.phone.startsWith('09') ? '#10B981' : modalErrors.phone ? '#F87171' : '#F59E0B', fontSize: '0.74rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
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
                          style={{
                            borderColor: modalErrors.phone ? '#EF4444' : undefined,
                            boxShadow: modalErrors.phone ? '0 0 0 3px rgba(239, 68, 68, 0.25)' : undefined
                          }}
                          onChange={(e) => {
                            setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 11) });
                            if (modalErrors.phone) setModalErrors(prev => ({ ...prev, phone: '' }));
                          }}
                        />
                        {modalErrors.phone && (
                          <span style={{ color: '#F87171', fontSize: '0.72rem', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <i className="fas fa-circle-exclamation" style={{ color: '#EF4444' }} /> {modalErrors.phone}
                          </span>
                        )}
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
                  <label style={{ color: modalErrors.email ? '#F87171' : undefined }}>
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
                    style={{
                      borderColor: modalErrors.email ? '#EF4444' : undefined,
                      boxShadow: modalErrors.email ? '0 0 0 3px rgba(239, 68, 68, 0.25)' : undefined
                    }}
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
                      if (modalErrors.email) setModalErrors(prev => ({ ...prev, email: '' }));
                    }}
                  />
                  {modalErrors.email && (
                    <span style={{ color: '#F87171', fontSize: '0.72rem', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <i className="fas fa-circle-exclamation" style={{ color: '#EF4444' }} /> {modalErrors.email}
                    </span>
                  )}
                  {mode === 'up' && (
                    <span className="small muted" style={{ display: 'block', marginTop: 4, fontSize: '0.74rem' }}>
                      Suggested email: <code>{generateAccountEmail(f.first_name, f.middle_name, f.last_name, 1, false, signupProvider === 'facebook' ? 'facebook' : 'gmail')}</code>
                    </span>
                  )}
                </div>

                <div className="field">
                  <label style={{ color: modalErrors.password ? '#F87171' : undefined }}>PASSWORD</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={f.password}
                    style={{
                      borderColor: modalErrors.password ? '#EF4444' : undefined,
                      boxShadow: modalErrors.password ? '0 0 0 3px rgba(239, 68, 68, 0.25)' : undefined
                    }}
                    placeholder="••••••••"
                    onChange={(e) => {
                      setF({ ...f, password: e.target.value });
                      if (modalErrors.password) setModalErrors(prev => ({ ...prev, password: '' }));
                    }}
                  />
                  {modalErrors.password && (
                    <span style={{ color: '#F87171', fontSize: '0.72rem', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <i className="fas fa-circle-exclamation" style={{ color: '#EF4444' }} /> {modalErrors.password}
                    </span>
                  )}
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
                  <div>
                    <label style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      fontSize: '0.78rem',
                      color: modalErrors.terms ? '#FCA5A5' : '#94A3B8',
                      marginTop: 12,
                      cursor: 'pointer',
                      userSelect: 'none',
                      padding: modalErrors.terms ? '8px 10px' : undefined,
                      background: modalErrors.terms ? 'rgba(239, 68, 68, 0.08)' : undefined,
                      border: modalErrors.terms ? '1px dashed rgba(239, 68, 68, 0.5)' : undefined,
                      borderRadius: 8
                    }}>
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => {
                          setTermsAccepted(e.target.checked);
                          if (modalErrors.terms) setModalErrors(prev => ({ ...prev, terms: '' }));
                        }}
                        style={{ marginTop: 2, outline: modalErrors.terms ? '2px solid #EF4444' : undefined }}
                      />
                      <span>
                        I have read, understood, and accept the Rock View Beach Resort Website Terms of Stay & Privacy Policy (RA 10173).
                      </span>
                    </label>
                    {modalErrors.terms && (
                      <span style={{ color: '#F87171', fontSize: '0.72rem', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <i className="fas fa-circle-exclamation" style={{ color: '#EF4444' }} /> {modalErrors.terms}
                      </span>
                    )}
                  </div>
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

              {/* LUXURY GLASSMORPHIC 2FA OTP PREVIEW WITH 1-CLICK AUTO-FILL */}
              {latestOtpPreview && (
                <div style={{
                  margin: '0 0 14px 0',
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(56, 189, 248, 0.16))',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <i className="fas fa-envelope-circle-check" style={{ color: '#10B981', fontSize: '1.2rem' }} />
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', fontWeight: 700 }}>
                        Gmail 2FA Code Dispatched
                      </span>
                      <span style={{ fontFamily: 'Consolas, monospace', fontSize: '1.15rem', fontWeight: 800, color: '#34D399', letterSpacing: '0.15em' }}>
                        {latestOtpPreview}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSignupCode(latestOtpPreview)}
                    style={{
                      background: 'rgba(16, 185, 129, 0.25)',
                      border: '1px solid #10B981',
                      borderRadius: 8,
                      color: '#A7F3D0',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    Auto-Fill
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
                    if (res?.otp_preview) {
                      setLatestOtpPreview(res.otp_preview);
                    }
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

                  {/* LUXURY GLASSMORPHIC RECOVERY OTP PREVIEW WITH 1-CLICK AUTO-FILL */}
                  {latestOtpPreview && (
                    <div style={{
                      margin: '0 0 14px 0',
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(56, 189, 248, 0.16))',
                      border: '1px solid rgba(16, 185, 129, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <i className="fas fa-envelope-circle-check" style={{ color: '#10B981', fontSize: '1.2rem' }} />
                        <div>
                          <span style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', fontWeight: 700 }}>
                            Recovery OTP Dispatched
                          </span>
                          <span style={{ fontFamily: 'Consolas, monospace', fontSize: '1.15rem', fontWeight: 800, color: '#34D399', letterSpacing: '0.15em' }}>
                            {latestOtpPreview}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRecoveryCode(latestOtpPreview)}
                        style={{
                          background: 'rgba(16, 185, 129, 0.25)',
                          border: '1px solid #10B981',
                          borderRadius: 8,
                          color: '#A7F3D0',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        Auto-Fill
                      </button>
                    </div>
                  )}

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
                          if (res?.otp_preview) {
                            setLatestOtpPreview(res.otp_preview);
                          }
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

          {/* ============================================================ */}
          {/* MODE: GMAIL OTP DIRECT PASSWORDLESS SIGN IN                  */}
          {/* ============================================================ */}
          {mode === 'gmail-otp' && (
            <div style={{ marginTop: 6 }}>
              {gmailOtpStep === 1 ? (
                <form onSubmit={handleSendGmailOtp}>
                  <div style={{
                    background: 'rgba(234, 67, 53, 0.12)',
                    border: '1px solid rgba(234, 67, 53, 0.35)',
                    borderRadius: 12,
                    padding: '16px',
                    marginBottom: 16,
                    textAlign: 'center',
                  }}>
                    <i className="fas fa-envelope-open-text" style={{ fontSize: '1.6rem', display: 'block', marginBottom: 6, color: '#EA4335' }} />
                    <h4 style={{ color: '#FFFFFF', margin: '0 0 6px', fontSize: '1.1rem' }}>Gmail OTP Fast Sign-In</h4>
                    <p style={{ color: '#CBD5E1', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>
                      Sign in instantly with a secure 6-digit one-time code delivered to your Gmail inbox via Supabase Auth & Google Mail.
                    </p>
                  </div>

                  <div className="field">
                    <label>GMAIL / EMAIL ADDRESS *</label>
                    <input
                      type="email"
                      required
                      autoFocus
                      value={gmailOtpEmail}
                      placeholder="resident@gmail.com"
                      onChange={(e) => setGmailOtpEmail(e.target.value)}
                    />
                  </div>

                  <div className="field" style={{ marginTop: 10 }}>
                    <label>RESIDENT NAME (OPTIONAL)</label>
                    <input
                      type="text"
                      value={gmailOtpName}
                      placeholder="e.g. Maria Santos"
                      onChange={(e) => setGmailOtpName(e.target.value)}
                    />
                  </div>

                  <button
                    className="btn btn-sky"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 14, padding: '12px' }}
                    disabled={busy}
                  >
                    {busy ? 'Dispatching OTP…' : 'Send 6-Digit OTP to Gmail ✦'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('in')}
                    style={{ width: '100%', background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.82rem', marginTop: 12, cursor: 'pointer', textAlign: 'center' }}
                  >
                    ← Back to Sign In
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyGmailOtp}>
                  <div style={{
                    background: 'rgba(14, 165, 233, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: 12,
                    padding: '16px',
                    marginBottom: 16,
                    textAlign: 'center',
                  }}>
                    <i className="fas fa-shield-halved" style={{ fontSize: '1.6rem', display: 'block', marginBottom: 6, color: '#38BDF8' }} />
                    <h4 style={{ color: '#FFFFFF', margin: '0 0 6px', fontSize: '1.1rem' }}>Enter 6-Digit Gmail OTP</h4>
                    <p style={{ color: '#CBD5E1', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>
                      A secure one-time passcode was dispatched to <strong>{gmailOtpEmail}</strong>.
                    </p>
                  </div>

                  {/* LUXURY GLASSMORPHIC OTP PREVIEW WITH 1-CLICK AUTO-FILL */}
                  {latestOtpPreview && (
                    <div style={{
                      margin: '0 0 14px 0',
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(56, 189, 248, 0.16))',
                      border: '1px solid rgba(16, 185, 129, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <i className="fas fa-envelope-circle-check" style={{ color: '#10B981', fontSize: '1.2rem' }} />
                        <div>
                          <span style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', fontWeight: 700 }}>
                            Gmail OTP Code Dispatched
                          </span>
                          <span style={{ fontFamily: 'Consolas, monospace', fontSize: '1.15rem', fontWeight: 800, color: '#34D399', letterSpacing: '0.15em' }}>
                            {latestOtpPreview}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGmailOtpCode(latestOtpPreview)}
                        style={{
                          background: 'rgba(16, 185, 129, 0.25)',
                          border: '1px solid #10B981',
                          borderRadius: 8,
                          color: '#A7F3D0',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        Auto-Fill
                      </button>
                    </div>
                  )}

                  <div className="field">
                    <label style={{ textAlign: 'center', display: 'block', letterSpacing: '0.08em' }}>
                      ENTER 6-DIGIT VERIFICATION CODE
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      autoFocus
                      value={gmailOtpCode}
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
                      onChange={(e) => setGmailOtpCode(e.target.value.trim())}
                    />
                  </div>

                  <button
                    className="btn btn-sky"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 14, padding: '12px', fontSize: '0.96rem' }}
                    disabled={busy}
                  >
                    {busy ? 'Verifying OTP & Signing In…' : 'Verify OTP & Sign In ✦'}
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleSendGmailOtp}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#38BDF8',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Resend OTP Code
                    </button>
                    <button
                      type="button"
                      onClick={() => { setGmailOtpStep(1); setGmailOtpCode(''); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--muted)',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      ← Change Email
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      <GoogleAccountChooserModal
        isOpen={googleChooserOpen}
        onClose={() => setGoogleChooserOpen(false)}
        onSelectAccount={handleSelectGoogleAccount}
        loading={googleChooserLoading}
      />
    </div>
  );
}
