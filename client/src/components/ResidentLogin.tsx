import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { toast } from './Toasts.tsx';
import GoogleAccountChooserModal, { GoogleAccount } from './GoogleAccountChooserModal.tsx';
import '../styles/resident-login.css';

interface ResidentLoginProps {
  returnTo?: string;
}

export default function ResidentLogin({ returnTo = '/user' }: ResidentLoginProps) {
  const navigate = useNavigate();
  const { customerSignIn, signInWithGoogle, signInWithFacebook, signUp, sendGmailOtp, verifyGmailOtp } = useAuth();

  // Mode: 'login' | 'signup' | 'forgot-request' | 'forgot-verify' | 'gmail-otp'
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot-request' | 'forgot-verify' | 'gmail-otp'>('login');

  // Manual Login Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Create Account (Sign Up) Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);

  // Manual Account Creation Validation & Caution State
  const [signupErrors, setSignupErrors] = useState<{
    firstName?: string;
    lastName?: string;
    phone?: string;
    signupEmail?: string;
    signupPassword?: string;
    termsAgreed?: string;
  }>({});
  const [showCautionSign, setShowCautionSign] = useState(false);
  const cautionSignRef = useRef<HTMLDivElement>(null);

  // Recovery Form State
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [latestOtpPreview, setLatestOtpPreview] = useState('');

  // Gmail OTP Passwordless Sign-In State
  const [gmailOtpEmail, setGmailOtpEmail] = useState('');
  const [gmailOtpName, setGmailOtpName] = useState('');
  const [gmailOtpCode, setGmailOtpCode] = useState('');
  const [gmailOtpStep, setGmailOtpStep] = useState<1 | 2>(1);
  const [gmailOtpLoading, setGmailOtpLoading] = useState(false);

  // Google Account Chooser State
  const [googleChooserOpen, setGoogleChooserOpen] = useState(false);
  const [googleChooserLoading, setGoogleChooserLoading] = useState(false);

  // 1. Handle Manual Login
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast('Please enter your email and password.', true);
      return;
    }
    setLoginLoading(true);
    try {
      const res = await customerSignIn(email.trim(), password);
      if (res?.error) throw res.error;
      toast('Welcome back to Rock View Beach Resort ✦');
      if (returnTo) navigate(returnTo, { replace: true });
    } catch (err: any) {
      toast(err.message || 'Authentication failed. Please check your credentials.', true);
    } finally {
      setLoginLoading(false);
    }
  };

  // 2. Handle Create Account (Sign Up) with Strict Field Validation & Caution Alerts
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof signupErrors = {};

    if (!firstName.trim()) {
      errors.firstName = 'First name is required.';
    } else if (!/^[a-zA-Z\s\-]+$/.test(firstName.trim())) {
      errors.firstName = 'First name must contain letters and hyphens only.';
    }

    if (!lastName.trim()) {
      errors.lastName = 'Last name is required.';
    } else if (!/^[a-zA-Z\s\-]+$/.test(lastName.trim())) {
      errors.lastName = 'Last name must contain letters and hyphens only.';
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(0, 11);
    if (!cleanPhone) {
      errors.phone = 'Philippine mobile phone number is required.';
    } else if (cleanPhone.length !== 11 || !cleanPhone.startsWith('09')) {
      errors.phone = 'Mobile must strictly be an 11-digit number starting with 09 (e.g. 09171234567).';
    }

    if (!signupEmail.trim()) {
      errors.signupEmail = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.trim())) {
      errors.signupEmail = 'Please provide a valid email format (e.g. resident@example.ph).';
    }

    if (!signupPassword) {
      errors.signupPassword = 'Password is required.';
    } else if (signupPassword.length < 8) {
      errors.signupPassword = 'Password must be at least 8 characters long.';
    } else if (!/[a-zA-Z]/.test(signupPassword) || !/[0-9]/.test(signupPassword)) {
      errors.signupPassword = 'Password must contain both letters and numbers for account security.';
    }

    if (!termsAgreed) {
      errors.termsAgreed = 'You must agree to the Resort Terms of Stay and Privacy Policy to proceed.';
    }

    if (Object.keys(errors).length > 0) {
      setSignupErrors(errors);
      setShowCautionSign(true);
      toast('⚠️ Caution: Please complete the required fields highlighted in red.', true);
      setTimeout(() => {
        cautionSignRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
      return;
    }

    setSignupErrors({});
    setShowCautionSign(false);
    setSignupLoading(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const res = await signUp(signupEmail.trim(), signupPassword, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: cleanPhone,
        full_name: fullName,
      });
      if (res?.error) throw res.error;

      // Automatically sign in the newly registered resident account
      const signRes = await customerSignIn(signupEmail.trim(), signupPassword);
      if (signRes?.error) {
        toast('Account created! Please enter your password to sign in.');
        setEmail(signupEmail.trim());
        setMode('login');
      } else {
        toast(`Welcome to Rock View Beach Resort, ${fullName}! ✦`);
        if (returnTo) navigate(returnTo, { replace: true });
      }
    } catch (err: any) {
      toast(err.message || 'Account registration failed. Please check your details.', true);
    } finally {
      setSignupLoading(false);
    }
  };

  // 3. Handle Google OAuth Account Chooser
  const handleGoogleAuth = () => {
    setGoogleChooserOpen(true);
  };

  const handleSelectGoogleAccount = async (account: GoogleAccount) => {
    setGoogleChooserLoading(true);
    try {
      const res: any = await signInWithGoogle({
        email: account.email,
        name: account.name,
      });
      if (res?.error) throw res.error;
      setGoogleChooserOpen(false);
      toast(`Welcome to Rock View Beach Resort, ${account.name}! ✦`);
      if (returnTo) navigate(returnTo, { replace: true });
      else navigate('/user', { replace: true });
    } catch (err: any) {
      toast(err.msg || err.message || 'Google Sign-In failed', true);
    } finally {
      setGoogleChooserLoading(false);
    }
  };

  // 4. Handle Facebook OAuth
  const handleFacebookAuth = async () => {
    try {
      toast('Connecting to Facebook Sign-In…');
      await signInWithFacebook();
    } catch (err: any) {
      const msg = err.msg || err.message || '';
      if (msg.includes('not enabled') || msg.includes('Unsupported provider') || err.error_code === 'validation_failed') {
        toast('Facebook OAuth is initializing. Please sign in or create an account with email below.', true);
      } else {
        toast(msg || 'Facebook Sign-In failed', true);
      }
    }
  };

  // 5. Step 1: Request Password Reset Code
  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) {
      toast('Please enter your registered email address.', true);
      return;
    }
    setRecoveryLoading(true);
    try {
      const res = await api.forgotPassword(recoveryEmail.trim());
      if (res?.otp_preview) {
        setLatestOtpPreview(res.otp_preview);
      }
      toast(res.message || 'Verification code dispatched to your email! Please check your inbox.');
      setMode('forgot-verify');
    } catch (err: any) {
      toast(err.message || 'Unable to request recovery code. Please check the email entered.', true);
    } finally {
      setRecoveryLoading(false);
    }
  };

  // 5b. Dispatch Resident Gmail OTP (Passwordless Login)
  const handleSendResidentGmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gmailOtpEmail.trim() || !gmailOtpEmail.includes('@')) {
      toast('Please enter a valid Gmail / Email address.', true);
      return;
    }
    setGmailOtpLoading(true);
    try {
      const res: any = await sendGmailOtp(gmailOtpEmail.trim(), gmailOtpName.trim());
      if (res?.otp_preview) {
        setLatestOtpPreview(res.otp_preview);
      }
      toast(res?.message || `6-digit OTP code dispatched to ${gmailOtpEmail}.`);
      setGmailOtpStep(2);
    } catch (err: any) {
      toast(err.message || 'Failed to dispatch Gmail OTP code.', true);
    } finally {
      setGmailOtpLoading(false);
    }
  };

  // 5c. Verify Resident Gmail OTP (Passwordless Login)
  const handleVerifyResidentGmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gmailOtpCode.trim() || gmailOtpCode.trim().length !== 6) {
      toast('Please enter the 6-digit OTP code.', true);
      return;
    }
    setGmailOtpLoading(true);
    try {
      const res: any = await verifyGmailOtp(gmailOtpEmail.trim(), gmailOtpCode.trim(), gmailOtpName.trim());
      if (res?.error) {
        toast(res.error.message || 'Invalid or expired OTP code.', true);
      } else {
        if (returnTo) navigate(returnTo, { replace: true });
      }
    } catch (err: any) {
      toast(err.message || 'Failed to verify OTP code.', true);
    } finally {
      setGmailOtpLoading(false);
    }
  };

  // 6. Step 2: Verify Code and Set New Password
  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCode.trim() || !recoveryNewPassword) {
      toast('Please enter both the verification code and your new password.', true);
      return;
    }
    if (recoveryNewPassword.length < 8) {
      toast('Password must be at least 8 characters long.', true);
      return;
    }
    setRecoveryLoading(true);
    try {
      const res = await api.resetPassword(recoveryEmail.trim(), recoveryCode.trim(), recoveryNewPassword);
      toast(res.message || 'Password reset successfully! Logging you in…');
      const signRes = await customerSignIn(recoveryEmail.trim(), recoveryNewPassword);
      if (signRes?.error) {
        toast('Password updated. Please sign in with your new password.');
        setMode('login');
        setEmail(recoveryEmail.trim());
        setPassword('');
      } else {
        if (returnTo) navigate(returnTo, { replace: true });
      }
    } catch (err: any) {
      toast(err.message || 'Password reset failed. Please check your recovery code.', true);
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div className="rl-viewport">
      {/* ============================================================ */}
      {/* LEFT HALF (50%): ATMOSPHERIC RESORT SHOWCASE                 */}
      {/* ============================================================ */}
      <div className="rl-showcase">
        <div className="rl-showcase__glow" aria-hidden="true" />
        <div className="rl-showcase__glow-bottom" aria-hidden="true" />

        {/* Top Branding Pill */}
        <div className="rl-showcase__header">
          <span className="rl-brand-pill">
            <i className="fas fa-umbrella-beach" />
            Rock View Beach Resort · Patar, Bolinao
          </span>
        </div>

        {/* Middle Editorial Showcase */}
        <div className="rl-showcase__content">
          <h1 className="rl-showcase__title">
            Where Limestone Cliffs Meet the <span>West Philippine Sea</span>.
          </h1>
          <p className="rl-showcase__lead">
            Welcome to the private Resident Guest Portal. Access your reservations,
            express check-in credentials, and personalized coastal concierge services.
          </p>

          <div className="rl-perks">
            <div className="rl-perk">
              <div className="rl-perk__icon">
                <i className="fas fa-calendar-check" />
              </div>
              <div>
                <h4 className="rl-perk__title">Villa Reservations & Live Rates</h4>
                <p className="rl-perk__desc">View your confirmed booking dates, guest counts, and official digital room vouchers.</p>
              </div>
            </div>

            <div className="rl-perk">
              <div className="rl-perk__icon">
                <i className="fas fa-key" />
              </div>
              <div>
                <h4 className="rl-perk__title">Express Digital Room Pass</h4>
                <p className="rl-perk__desc">Accelerated check-in upon arrival at Patar Road, Bolinao, Pangasinan.</p>
              </div>
            </div>

            <div className="rl-perk">
              <div className="rl-perk__icon">
                <i className="fas fa-concierge-bell" />
              </div>
              <div>
                <h4 className="rl-perk__title">Tailored Seaside Concierge</h4>
                <p className="rl-perk__desc">Request in-villa amenities, private dining experiences, and coastal island tours.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Showcase Footer Badges */}
        <div className="rl-showcase__footer">
          <div className="rl-rating-badge">
            <span className="rl-stars" style={{ color: '#38bdf8' }}>✦</span>
            <span><strong>Official</strong> Resident Guest Portal</span>
          </div>
          <div className="rl-location-badge">
            <i className="fas fa-location-dot" />
            <span>Patar Beach, Bolinao, Pangasinan</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* RIGHT HALF (50%): DEEP BLUE MARINE AUTHENTICATION CONTAINER  */}
      {/* ============================================================ */}
      <div className="rl-auth-pane">
        <div className="rl-card">
          <div className="rl-card__strip" aria-hidden="true" />

          {/* Top Header */}
          <div className="rl-card__head">
            <div className="rl-card__icon-box">
              <i className="fas fa-umbrella-beach" style={{ fontSize: '1.65rem', color: '#38bdf8' }} />
            </div>
            <h2 className="rl-card__resort-name">ROCK VIEW BEACH RESORT</h2>
            <span className="rl-card__portal-tag">Resident Guest Portal</span>
            
            <p className="rl-card__subtitle">
              {mode === 'login' && 'Sign in to access your resort bookings, services, and digital room pass.'}
              {mode === 'signup' && 'Create your resident guest account to unlock direct rates & instant vouchers.'}
              {mode === 'forgot-request' && 'Enter your registered email address to receive your 6-digit recovery code.'}
              {mode === 'forgot-verify' && `Enter the verification code sent to ${recoveryEmail} and your new password.`}
              {mode === 'gmail-otp' && 'Fast passwordless access with your Gmail address and 6-digit OTP.'}
            </p>
          </div>

          {/* ============================================================ */}
          {/* TABS: SIGN IN vs CREATE ACCOUNT                              */}
          {/* ============================================================ */}
          {(mode === 'login' || mode === 'signup') && (
            <div className="rl-tabs">
              <button
                type="button"
                className={`rl-tab ${mode === 'login' ? 'rl-tab--active' : ''}`}
                onClick={() => setMode('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`rl-tab ${mode === 'signup' ? 'rl-tab--active' : ''}`}
                onClick={() => setMode('signup')}
              >
                Create Account
              </button>
            </div>
          )}

          {/* ============================================================ */}
          {/* SHARED SOCIAL AUTH (GOOGLE & FACEBOOK)                       */}
          {/* ============================================================ */}
          {(mode === 'login' || mode === 'signup') && (
            <>
              <div className="rl-social-grid">
                <button
                  type="button"
                  className="rl-btn-social rl-btn-social--google"
                  onClick={handleGoogleAuth}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Google</span>
                </button>

                <button
                  type="button"
                  className="rl-btn-social rl-btn-social--facebook"
                  onClick={handleFacebookAuth}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  <span>Facebook</span>
                </button>
              </div>

              <div className="rl-divider">
                <span>{mode === 'login' ? 'or sign in with email' : 'or register with email'}</span>
              </div>
            </>
          )}

          {/* ============================================================ */}
          {/* MODE: SIGN IN FORM                                           */}
          {/* ============================================================ */}
          {mode === 'login' && (
            <form onSubmit={handleManualLogin}>
              <div className="rl-form-group">
                <label className="rl-label" htmlFor="rl-email">Email Address</label>
                <div className="rl-input-wrap">
                  <i className="fas fa-envelope rl-input-icon" />
                  <input
                    id="rl-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="rl-input"
                  />
                </div>
              </div>

              <div className="rl-form-group">
                <label className="rl-label" htmlFor="rl-password">Password</label>
                <div className="rl-input-wrap">
                  <i className="fas fa-key rl-input-icon" />
                  <input
                    id="rl-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="rl-input"
                  />
                  <button
                    type="button"
                    className="rl-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                  </button>
                </div>
              </div>

              <div className="rl-forgot-row">
                <button
                  type="button"
                  className="rl-forgot-link"
                  onClick={() => {
                    setRecoveryEmail(email || '');
                    setMode('forgot-request');
                  }}
                >
                  Forgot account or password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="rl-submit-btn"
              >
                {loginLoading && <span className="rl-spinner" aria-hidden="true" />}
                {loginLoading ? 'Authenticating…' : 'Sign In to Resident Guest Portal'}
              </button>
            </form>
          )}

          {/* ============================================================ */}
          {/* MODE: CREATE ACCOUNT FORM                                    */}
          {/* ============================================================ */}
          {mode === 'signup' && (
            <form onSubmit={handleCreateAccount} noValidate>
              {/* POPUP CAUTION SIGN BANNER */}
              {showCautionSign && Object.keys(signupErrors).length > 0 && (
                <div ref={cautionSignRef} className="rl-caution-popup" role="alert">
                  <div className="rl-caution-popup__header">
                    <div className="rl-caution-popup__title">
                      <i className="fas fa-triangle-exclamation rl-caution-popup__icon" />
                      <span>CAUTION: Required Fields Incomplete</span>
                    </div>
                    <button
                      type="button"
                      className="rl-caution-popup__close"
                      onClick={() => setShowCautionSign(false)}
                      aria-label="Dismiss caution"
                    >
                      <i className="fas fa-xmark" />
                    </button>
                  </div>
                  <p className="rl-caution-popup__desc">
                    Please fill out and correct the highlighted fields marked in red below to finalize your resident account.
                  </p>
                  <ul className="rl-caution-popup__list">
                    {signupErrors.firstName && <li><i className="fas fa-circle-exclamation" /> {signupErrors.firstName}</li>}
                    {signupErrors.lastName && <li><i className="fas fa-circle-exclamation" /> {signupErrors.lastName}</li>}
                    {signupErrors.phone && <li><i className="fas fa-circle-exclamation" /> {signupErrors.phone}</li>}
                    {signupErrors.signupEmail && <li><i className="fas fa-circle-exclamation" /> {signupErrors.signupEmail}</li>}
                    {signupErrors.signupPassword && <li><i className="fas fa-circle-exclamation" /> {signupErrors.signupPassword}</li>}
                    {signupErrors.termsAgreed && <li><i className="fas fa-circle-exclamation" /> {signupErrors.termsAgreed}</li>}
                  </ul>
                </div>
              )}

              <div className="rl-form-grid-2">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <label className={`rl-label ${signupErrors.firstName ? 'rl-label--error' : ''}`} htmlFor="rl-firstname">First Name</label>
                    {signupErrors.firstName && <span className="rl-badge-required">Required</span>}
                  </div>
                  <input
                    id="rl-firstname"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value.replace(/[^a-zA-Z\s\-]/g, ''));
                      if (signupErrors.firstName) setSignupErrors((prev) => ({ ...prev, firstName: undefined }));
                    }}
                    placeholder="Juan"
                    className={`rl-input ${signupErrors.firstName ? 'rl-input--error' : ''}`}
                    style={{ paddingLeft: '14px' }}
                  />
                  {signupErrors.firstName && (
                    <div className="rl-field-error">
                      <i className="fas fa-circle-exclamation" /> {signupErrors.firstName}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <label className={`rl-label ${signupErrors.lastName ? 'rl-label--error' : ''}`} htmlFor="rl-lastname">Last Name</label>
                    {signupErrors.lastName && <span className="rl-badge-required">Required</span>}
                  </div>
                  <input
                    id="rl-lastname"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value.replace(/[^a-zA-Z\s\-]/g, ''));
                      if (signupErrors.lastName) setSignupErrors((prev) => ({ ...prev, lastName: undefined }));
                    }}
                    placeholder="Cruz"
                    className={`rl-input ${signupErrors.lastName ? 'rl-input--error' : ''}`}
                    style={{ paddingLeft: '14px' }}
                  />
                  {signupErrors.lastName && (
                    <div className="rl-field-error">
                      <i className="fas fa-circle-exclamation" /> {signupErrors.lastName}
                    </div>
                  )}
                </div>
              </div>

              <div className="rl-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <label className={`rl-label ${signupErrors.phone ? 'rl-label--error' : ''}`} htmlFor="rl-phone">
                    Mobile Phone (11 Digits, 09XXXXXXXXX)
                  </label>
                  <span className={`text-[11px] font-semibold ${
                    phone.length === 11 && phone.startsWith('09')
                      ? 'text-emerald-400'
                      : signupErrors.phone
                      ? 'text-rose-400'
                      : phone.length > 0
                      ? 'text-amber-400'
                      : 'text-slate-400'
                  }`}>
                    {phone.length === 11 && phone.startsWith('09')
                      ? '✓ 11/11 digits'
                      : phone.length > 0
                      ? `${phone.length}/11 digits`
                      : '11 digits (09...)'}
                  </span>
                </div>
                <div className="rl-input-wrap">
                  <i className={`fas fa-phone rl-input-icon ${signupErrors.phone ? 'rl-input-icon--error' : ''}`} />
                  <input
                    id="rl-phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    required
                    value={phone}
                    onChange={(e) => {
                      let digits = e.target.value.replace(/\D/g, '');
                      if (digits.startsWith('63') && digits.length >= 3) {
                        digits = '0' + digits.slice(2);
                      }
                      setPhone(digits.slice(0, 11));
                      if (signupErrors.phone) setSignupErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                    placeholder="09171234567"
                    className={`rl-input ${signupErrors.phone ? 'rl-input--error' : ''}`}
                  />
                </div>
                {signupErrors.phone && (
                  <div className="rl-field-error">
                    <i className="fas fa-circle-exclamation" /> {signupErrors.phone}
                  </div>
                )}
              </div>

              <div className="rl-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <label className={`rl-label ${signupErrors.signupEmail ? 'rl-label--error' : ''}`} htmlFor="rl-signup-email">
                    Email Address
                  </label>
                  {signupErrors.signupEmail && <span className="rl-badge-required">Required</span>}
                </div>
                <div className="rl-input-wrap">
                  <i className={`fas fa-envelope rl-input-icon ${signupErrors.signupEmail ? 'rl-input-icon--error' : ''}`} />
                  <input
                    id="rl-signup-email"
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => {
                      setSignupEmail(e.target.value);
                      if (signupErrors.signupEmail) setSignupErrors((prev) => ({ ...prev, signupEmail: undefined }));
                    }}
                    placeholder="your@email.com"
                    className={`rl-input ${signupErrors.signupEmail ? 'rl-input--error' : ''}`}
                  />
                </div>
                {signupErrors.signupEmail && (
                  <div className="rl-field-error">
                    <i className="fas fa-circle-exclamation" /> {signupErrors.signupEmail}
                  </div>
                )}
              </div>

              <div className="rl-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <label className={`rl-label ${signupErrors.signupPassword ? 'rl-label--error' : ''}`} htmlFor="rl-signup-password">
                    Password (Min 8 Characters with Letters & Numbers)
                  </label>
                  {signupErrors.signupPassword && <span className="rl-badge-required">Required</span>}
                </div>
                <div className="rl-input-wrap">
                  <i className={`fas fa-key rl-input-icon ${signupErrors.signupPassword ? 'rl-input-icon--error' : ''}`} />
                  <input
                    id="rl-signup-password"
                    type={showSignupPassword ? 'text' : 'password'}
                    required
                    value={signupPassword}
                    onChange={(e) => {
                      setSignupPassword(e.target.value);
                      if (signupErrors.signupPassword) setSignupErrors((prev) => ({ ...prev, signupPassword: undefined }));
                    }}
                    placeholder="••••••••"
                    className={`rl-input ${signupErrors.signupPassword ? 'rl-input--error' : ''}`}
                  />
                  <button
                    type="button"
                    className="rl-eye-btn"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`fas ${showSignupPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                  </button>
                </div>
                {signupErrors.signupPassword && (
                  <div className="rl-field-error">
                    <i className="fas fa-circle-exclamation" /> {signupErrors.signupPassword}
                  </div>
                )}
              </div>

              <div className={signupErrors.termsAgreed ? 'rl-checkbox-container--error' : ''}>
                <label className="rl-checkbox-row" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    required
                    checked={termsAgreed}
                    onChange={(e) => {
                      setTermsAgreed(e.target.checked);
                      if (signupErrors.termsAgreed) setSignupErrors((prev) => ({ ...prev, termsAgreed: undefined }));
                    }}
                    className={`rl-checkbox ${signupErrors.termsAgreed ? 'rl-checkbox--error' : ''}`}
                  />
                  <span style={{ color: signupErrors.termsAgreed ? '#fca5a5' : undefined }}>
                    I agree to the Resort Terms of Stay and Privacy Policy.
                  </span>
                </label>
                {signupErrors.termsAgreed && (
                  <div className="rl-field-error" style={{ marginTop: 6 }}>
                    <i className="fas fa-circle-exclamation" /> {signupErrors.termsAgreed}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={signupLoading}
                className="rl-submit-btn"
                style={{ marginTop: 14 }}
              >
                {signupLoading && <span className="rl-spinner" aria-hidden="true" />}
                {signupLoading ? 'Creating Account…' : 'Create Resident Account'}
              </button>
            </form>
          )}

          {/* ============================================================ */}
          {/* MODE: RECOVERY STEP 1 (REQUEST OTP)                          */}
          {/* ============================================================ */}
          {mode === 'forgot-request' && (
            <div className="rl-recovery-box">
              <button
                type="button"
                className="rl-recovery-back"
                onClick={() => setMode('login')}
              >
                <i className="fas fa-arrow-left" /> Back to Sign In
              </button>

              <form onSubmit={handleRequestRecovery}>
                <div className="rl-form-group">
                  <label className="rl-label" htmlFor="rl-recovery-email">Registered Email Address</label>
                  <div className="rl-input-wrap">
                    <i className="fas fa-envelope rl-input-icon" />
                    <input
                      id="rl-recovery-email"
                      type="email"
                      required
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="rl-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="rl-submit-btn"
                >
                  {recoveryLoading && <span className="rl-spinner" aria-hidden="true" />}
                  {recoveryLoading ? 'Sending Recovery Code…' : 'Send Recovery Code'}
                </button>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* MODE: RECOVERY STEP 2 (VERIFY CODE & SET NEW PASSWORD)       */}
          {/* ============================================================ */}
          {mode === 'forgot-verify' && (
            <div className="rl-recovery-box">
              <button
                type="button"
                className="rl-recovery-back"
                onClick={() => setMode('forgot-request')}
              >
                <i className="fas fa-arrow-left" /> Re-enter Email
              </button>

              <form onSubmit={handleVerifyAndReset}>
                {/* LUXURY GLASSMORPHIC RECOVERY OTP PREVIEW WITH 1-CLICK AUTO-FILL */}
                {latestOtpPreview && (
                  <div style={{
                    margin: '0 0 16px 0',
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(56, 189, 248, 0.16))',
                    border: '1px solid rgba(16, 185, 129, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <i className="fas fa-envelope-circle-check" style={{ color: '#10B981', fontSize: '1.25rem' }} />
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', fontWeight: 700 }}>
                          Recovery OTP Code Dispatched
                        </span>
                        <span style={{ fontFamily: 'Consolas, monospace', fontSize: '1.2rem', fontWeight: 800, color: '#34D399', letterSpacing: '0.15em' }}>
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
                        fontSize: '0.8rem',
                        padding: '7px 14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      Auto-Fill
                    </button>
                  </div>
                )}

                <div className="rl-form-group">
                  <label className="rl-label" htmlFor="rl-recovery-code">6-Digit Verification Code</label>
                  <div className="rl-input-wrap">
                    <i className="fas fa-shield-halved rl-input-icon" />
                    <input
                      id="rl-recovery-code"
                      type="text"
                      maxLength={6}
                      required
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                      placeholder="e.g. 123456"
                      className="rl-input"
                    />
                  </div>
                </div>

                <div className="rl-form-group">
                  <label className="rl-label" htmlFor="rl-recovery-newpass">New Password (Min 8 Characters)</label>
                  <div className="rl-input-wrap">
                    <i className="fas fa-lock rl-input-icon" />
                    <input
                      id="rl-recovery-newpass"
                      type={showRecoveryPassword ? 'text' : 'password'}
                      required
                      value={recoveryNewPassword}
                      onChange={(e) => setRecoveryNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="rl-input"
                    />
                    <button
                      type="button"
                      className="rl-eye-btn"
                      onClick={() => setShowRecoveryPassword(!showRecoveryPassword)}
                      aria-label={showRecoveryPassword ? 'Hide password' : 'Show password'}
                    >
                      <i className={`fas ${showRecoveryPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="rl-submit-btn"
                >
                  {recoveryLoading && <span className="rl-spinner" aria-hidden="true" />}
                  {recoveryLoading ? 'Updating Password…' : 'Set New Password & Sign In'}
                </button>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* MODE: GMAIL OTP PASSWORDLESS ACCESS                          */}
          {/* ============================================================ */}
          {mode === 'gmail-otp' && (
            <div className="rl-recovery-box" style={{ marginTop: 4 }}>
              <button
                type="button"
                className="rl-recovery-back"
                onClick={() => { setMode('login'); setGmailOtpStep(1); }}
              >
                <i className="fas fa-arrow-left" /> Back to Sign In
              </button>

              {gmailOtpStep === 1 ? (
                <form onSubmit={handleSendResidentGmailOtp}>
                  <div style={{
                    background: 'rgba(234, 67, 53, 0.12)',
                    border: '1px solid rgba(234, 67, 53, 0.35)',
                    borderRadius: 14,
                    padding: '16px',
                    marginBottom: 18,
                    textAlign: 'center',
                  }}>
                    <i className="fas fa-envelope-open-text" style={{ fontSize: '1.8rem', display: 'block', marginBottom: 6, color: '#EA4335' }} />
                    <h4 style={{ color: '#FFFFFF', margin: '0 0 6px', fontSize: '1.15rem' }}>Gmail OTP Fast Access</h4>
                    <p style={{ color: '#CBD5E1', fontSize: '0.84rem', margin: 0, lineHeight: 1.5 }}>
                      Sign in instantly with a secure 6-digit one-time code delivered to your Gmail inbox via Supabase Auth & Google Mail.
                    </p>
                  </div>

                  <div className="rl-form-group">
                    <label className="rl-label" htmlFor="rl-gmail-otp-email">Gmail / Email Address *</label>
                    <div className="rl-input-wrap">
                      <i className="fas fa-envelope rl-input-icon" />
                      <input
                        id="rl-gmail-otp-email"
                        type="email"
                        required
                        autoFocus
                        value={gmailOtpEmail}
                        onChange={(e) => setGmailOtpEmail(e.target.value)}
                        placeholder="resident@gmail.com"
                        className="rl-input"
                      />
                    </div>
                  </div>

                  <div className="rl-form-group">
                    <label className="rl-label" htmlFor="rl-gmail-otp-name">Resident Name (Optional)</label>
                    <div className="rl-input-wrap">
                      <i className="fas fa-user rl-input-icon" />
                      <input
                        id="rl-gmail-otp-name"
                        type="text"
                        value={gmailOtpName}
                        onChange={(e) => setGmailOtpName(e.target.value)}
                        placeholder="e.g. Maria Santos"
                        className="rl-input"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={gmailOtpLoading}
                    className="rl-submit-btn"
                  >
                    {gmailOtpLoading && <span className="rl-spinner" aria-hidden="true" />}
                    {gmailOtpLoading ? 'Dispatching OTP…' : 'Send 6-Digit OTP to Gmail ✦'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyResidentGmailOtp}>
                  <div style={{
                    background: 'rgba(14, 165, 233, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: 14,
                    padding: '16px',
                    marginBottom: 16,
                    textAlign: 'center',
                  }}>
                    <i className="fas fa-shield-halved" style={{ fontSize: '1.8rem', display: 'block', marginBottom: 6, color: '#38BDF8' }} />
                    <h4 style={{ color: '#FFFFFF', margin: '0 0 6px', fontSize: '1.15rem' }}>Enter 6-Digit Gmail OTP</h4>
                    <p style={{ color: '#CBD5E1', fontSize: '0.84rem', margin: 0, lineHeight: 1.5 }}>
                      A secure one-time passcode was dispatched to <strong>{gmailOtpEmail}</strong>.
                    </p>
                  </div>

                  {/* LUXURY GLASSMORPHIC OTP PREVIEW WITH 1-CLICK AUTO-FILL */}
                  {latestOtpPreview && (
                    <div style={{
                      margin: '0 0 16px 0',
                      padding: '12px 16px',
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(56, 189, 248, 0.16))',
                      border: '1px solid rgba(16, 185, 129, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <i className="fas fa-envelope-circle-check" style={{ color: '#10B981', fontSize: '1.25rem' }} />
                        <div>
                          <span style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', fontWeight: 700 }}>
                            Gmail OTP Code Dispatched
                          </span>
                          <span style={{ fontFamily: 'Consolas, monospace', fontSize: '1.2rem', fontWeight: 800, color: '#34D399', letterSpacing: '0.15em' }}>
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
                          fontSize: '0.8rem',
                          padding: '7px 14px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        Auto-Fill
                      </button>
                    </div>
                  )}

                  <div className="rl-form-group">
                    <label className="rl-label" htmlFor="rl-gmail-otp-code">6-Digit Verification Code</label>
                    <div className="rl-input-wrap">
                      <i className="fas fa-shield-halved rl-input-icon" />
                      <input
                        id="rl-gmail-otp-code"
                        type="text"
                        maxLength={6}
                        required
                        autoFocus
                        value={gmailOtpCode}
                        onChange={(e) => setGmailOtpCode(e.target.value.trim())}
                        placeholder="••••••"
                        style={{
                          letterSpacing: '0.38em',
                          fontSize: '1.5rem',
                          textAlign: 'center',
                          fontWeight: 800,
                          color: '#38BDF8',
                        }}
                        className="rl-input"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={gmailOtpLoading}
                    className="rl-submit-btn"
                  >
                    {gmailOtpLoading && <span className="rl-spinner" aria-hidden="true" />}
                    {gmailOtpLoading ? 'Verifying OTP & Signing In…' : 'Verify OTP & Sign In ✦'}
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                    <button
                      type="button"
                      disabled={gmailOtpLoading}
                      onClick={handleSendResidentGmailOtp}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#38BDF8',
                        fontSize: '0.84rem',
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
                        color: '#94A3B8',
                        fontSize: '0.84rem',
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

          {/* Footer Return Link */}
          <div className="rl-card__footer">
            <Link to="/" className="rl-return-link">
              <i className="fas fa-arrow-left" /> Return to Public Guest Website
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="rl-trust-row">
            <span className="rl-trust-item"><i className="fas fa-shield-halved" /> SSL Encrypted</span>
            <span className="rl-trust-item"><i className="fas fa-hotel" /> Verified Resort</span>
            <span className="rl-trust-item"><i className="fas fa-bolt" /> Instant Pass</span>
          </div>
        </div>
      </div>

      {/* GOOGLE ACCOUNT CHOOSER POPUP DIALOG */}
      <GoogleAccountChooserModal
        isOpen={googleChooserOpen}
        onClose={() => setGoogleChooserOpen(false)}
        onSelectAccount={handleSelectGoogleAccount}
        isLoading={googleChooserLoading}
      />
    </div>
  );
}
