import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { toast } from './Toasts.tsx';
import '../styles/resident-login.css';

interface ResidentLoginProps {
  returnTo?: string;
}

export default function ResidentLogin({ returnTo = '/user' }: ResidentLoginProps) {
  const navigate = useNavigate();
  const { customerSignIn, signInWithGoogle, signInWithFacebook, signUp } = useAuth();

  // Mode: 'login' | 'signup' | 'forgot-request' | 'forgot-verify'
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot-request' | 'forgot-verify'>('login');

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

  // Recovery Form State
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

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

  // 2. Handle Create Account (Sign Up)
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast('Please enter both your first name and last name.', true);
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(0, 11);
    if (!cleanPhone || cleanPhone.length !== 11 || !cleanPhone.startsWith('09')) {
      toast('Philippine mobile number must be 11 digits starting with 09 (e.g. 09171234567).', true);
      return;
    }
    if (!signupEmail.trim()) {
      toast('Please enter your email address.', true);
      return;
    }
    if (!signupPassword || signupPassword.length < 8) {
      toast('Password must be at least 8 characters long with letters and numbers.', true);
      return;
    }
    if (!termsAgreed) {
      toast('Please agree to the Resort Terms of Stay and Privacy Policy to create your account.', true);
      return;
    }

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

  // 3. Handle Google OAuth
  const handleGoogleAuth = async () => {
    try {
      toast('Connecting to Google Sign-In…');
      await signInWithGoogle();
    } catch (err: any) {
      const msg = err.msg || err.message || '';
      if (msg.includes('not enabled') || msg.includes('Unsupported provider') || err.error_code === 'validation_failed') {
        toast('Google OAuth is initializing. Please sign in or create an account with email below.', true);
      } else {
        toast(msg || 'Google Sign-In failed', true);
      }
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
      toast(res.message || 'Verification code dispatched to your email! Please check your inbox.');
      setMode('forgot-verify');
    } catch (err: any) {
      toast(err.message || 'Unable to request recovery code. Please check the email entered.', true);
    } finally {
      setRecoveryLoading(false);
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
            <span className="rl-stars">★★★★★</span>
            <span><strong>4.98</strong> / 5.0 · 48 Verified Reviews</span>
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
            <form onSubmit={handleCreateAccount}>
              <div className="rl-form-grid-2">
                <div>
                  <label className="rl-label" htmlFor="rl-firstname">First Name</label>
                  <input
                    id="rl-firstname"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value.replace(/[^a-zA-Z\s\-]/g, ''))}
                    placeholder="Juan"
                    className="rl-input"
                    style={{ paddingLeft: '14px' }}
                  />
                </div>
                <div>
                  <label className="rl-label" htmlFor="rl-lastname">Last Name</label>
                  <input
                    id="rl-lastname"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value.replace(/[^a-zA-Z\s\-]/g, ''))}
                    placeholder="Cruz"
                    className="rl-input"
                    style={{ paddingLeft: '14px' }}
                  />
                </div>
              </div>

              <div className="rl-form-group">
                <label className="rl-label" htmlFor="rl-phone">Mobile Phone (11 Digits, 09XXXXXXXXX)</label>
                <div className="rl-input-wrap">
                  <i className="fas fa-phone rl-input-icon" />
                  <input
                    id="rl-phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="09171234567"
                    className="rl-input"
                  />
                </div>
              </div>

              <div className="rl-form-group">
                <label className="rl-label" htmlFor="rl-signup-email">Email Address</label>
                <div className="rl-input-wrap">
                  <i className="fas fa-envelope rl-input-icon" />
                  <input
                    id="rl-signup-email"
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="rl-input"
                  />
                </div>
              </div>

              <div className="rl-form-group">
                <label className="rl-label" htmlFor="rl-signup-password">Password (Min 8 Characters)</label>
                <div className="rl-input-wrap">
                  <i className="fas fa-key rl-input-icon" />
                  <input
                    id="rl-signup-password"
                    type={showSignupPassword ? 'text' : 'password'}
                    required
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="••••••••"
                    className="rl-input"
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
              </div>

              <label className="rl-checkbox-row">
                <input
                  type="checkbox"
                  required
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="rl-checkbox"
                />
                <span>I agree to the Resort Terms of Stay and Privacy Policy.</span>
              </label>

              <button
                type="submit"
                disabled={signupLoading}
                className="rl-submit-btn"
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
    </div>
  );
}
