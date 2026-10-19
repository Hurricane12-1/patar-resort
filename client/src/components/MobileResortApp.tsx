import React, { useState, useEffect, useRef } from 'react';
import site from '../content/site.json';
import { useAuth, to11Digits } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { CANONICAL_ROOMS } from '../lib/canonicalRooms.ts';
import { toast } from './Toasts.tsx';
import { getRoomImageUrl, handleImageError } from '../lib/images.ts';
import AvailabilityCalendar from './AvailabilityCalendar.tsx';

// ==========================================================================
// LAYOUT TOKENS
// Mobile-first; widens at sm (640) / md (768) / lg (1024) / xl (1280).
// ==========================================================================
const WRAP = 'mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10';
const SECTION = 'pt-16 md:pt-24';
const BTN_PRIMARY =
  'inline-flex items-center justify-center rounded-full bg-cyan px-6 py-3.5 text-navy text-xs font-semibold uppercase tracking-[0.18em] shadow-[0_10px_30px_-8px_rgba(34,195,238,.7)] hover:brightness-110 active:scale-[.98] transition';
const BTN_GHOST =
  'inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3.5 text-white text-xs font-semibold uppercase tracking-[0.18em] backdrop-blur hover:bg-white/10 active:scale-[.98] transition';
const CARD = 'rounded-3xl border border-white/10 bg-ink overflow-hidden';
const FIELD =
  'w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-cyan/60 transition';
const LABEL = 'block text-[10px] uppercase tracking-[0.2em] text-white/50 font-medium';
// Horizontal snap carousel on phones, real grid on desktop
const RAIL =
  'flex gap-4 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 sm:-mx-8 sm:px-8 pb-2 lg:mx-0 lg:px-0 lg:grid lg:overflow-visible';

// ==========================================================================
// PRIMITIVES
// ==========================================================================
export function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <span
      className={`block text-[11px] font-medium uppercase tracking-[0.28em] ${light ? 'text-sky-700' : 'text-cyan'}`}
    >
      {children}
    </span>
  );
}

export function SectionTitle({
  title,
  accent,
  light = false,
}: {
  title: string;
  accent?: string;
  light?: boolean;
}) {
  return (
    <h2
      className={`mt-3 font-serif text-4xl md:text-5xl font-medium leading-tight ${light ? 'text-navy' : 'text-white'}`}
    >
      {title}
      {accent && (
        <>
          <br />
          <em className={`font-serif italic ${light ? 'text-sky-700' : 'text-cyan'}`}>{accent}</em>
        </>
      )}
    </h2>
  );
}

export function formatRoomTitle(name?: string) {
  if (!name) return 'Coastal Sanctuary';
  const trimmed = name.trim();
  if (/^room\s*(\d+)$/i.test(trimmed)) {
    return trimmed.replace(/^room\s*(\d+)$/i, 'Villa Room $1');
  }
  return trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const mark =
    size === 'lg' ? 'w-20 h-20 rounded-3xl' : size === 'sm' ? 'w-9 h-9 rounded-xl' : 'w-11 h-11 rounded-xl';
  const word = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-xl' : 'text-2xl';

  return (
    <div className="flex items-center gap-3">
      <div
        className={`${mark} shrink-0 flex items-center justify-center border border-cyan/30 bg-gradient-to-br from-cyan/20 to-transparent`}
      >
        <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="3" fill="#f6b74a" />
          <path d="M4 14C7 12 9 16 12 14C15 12 17 16 20 14" stroke="#22c3ee" strokeWidth="2" strokeLinecap="round" />
          <path
            d="M4 18C7 16 9 20 12 18C15 16 17 20 20 18"
            stroke="#22c3ee"
            strokeWidth="2"
            strokeLinecap="round"
            strokeOpacity="0.7"
          />
        </svg>
      </div>
      {size !== 'lg' && (
        <div className="whitespace-nowrap leading-none">
          <span className={`block font-serif ${word} font-medium text-white`}>{site.brand.name}</span>
          <span className="mt-1 block text-[9px] uppercase tracking-[0.25em] text-cyan/80">{site.brand.sub}</span>
        </div>
      )}
    </div>
  );
}

function AmenityIcon({ name }: { name: string }) {
  const common = {
    viewBox: '0 0 24 24',
    className: 'w-4 h-4',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'wifi':
      return (
        <svg {...common}>
          <path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
          <circle cx="12" cy="19" r="1" fill="currentColor" />
        </svg>
      );
    case 'utensils':
      return (
        <svg {...common}>
          <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9" />
        </svg>
      );
    case 'cocktail':
      return (
        <svg {...common}>
          <path d="M4 4h16l-8 9-8-9zM12 13v7M8 20h8" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case 'compass':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M2 12c3-3 5 3 8 0s5 3 8 0 3-1 4 0M2 17c3-3 5 3 8 0s5 3 8 0 3-1 4 0" />
        </svg>
      );
  }
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

// ==========================================================================
// MAIN APP — 4-stage state machine: loading → intro → auth → app
// ==========================================================================
export default function MobileResortApp() {
  const [stage, setStage] = useState<'loading' | 'intro' | 'auth' | 'app'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash?.includes('access_token=') || window.location.search?.includes('code=')) {
        return 'app';
      }
      // Dev-only preview helper: /?stage=app — production always starts at "loading"
      if (import.meta.env.DEV) {
        const s = new URLSearchParams(window.location.search).get('stage');
        if (s === 'intro' || s === 'auth' || s === 'app') return s as any;
      }
    }
    return 'loading';
  });
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [activeScene, setActiveScene] = useState(0);
  const [ambientPlaying, setAmbientPlaying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterDone, setNewsletterDone] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');

  // Booking card state
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  const addDays = (iso: string, days: number) => {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return toISO(d);
  };
  const today = toISO(new Date());
  const [checkIn, setCheckIn] = useState(addDays(today, 1));
  const [checkOut, setCheckOut] = useState(addDays(today, 3));
  const [guests, setGuests] = useState('2 Guests');
  const [selectedRoom, setSelectedRoom] = useState(site.rooms.items[0]?.name ?? '');
  const [quote, setQuote] = useState<{ ok: boolean; text: string } | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);

  useEffect(() => {
    api.rooms().then((data) => {
      if (Array.isArray(data)) {
        setRooms(data);
        if (data.length > 0 && !selectedRoom) {
          setSelectedRoom(data[0].name);
        }
      }
    }).catch(() => {});
  }, []);

  const displayRooms = rooms.length > 0 ? rooms : (site.rooms.items || []);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const roomsRailRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  const scrollRoomsRail = (direction: 'left' | 'right') => {
    if (!roomsRailRef.current) return;
    const offset = direction === 'left' ? -380 : 380;
    roomsRailRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  // Real Authentication Integration via AuthContext
  const auth = (useAuth ? useAuth() : null) as any;
  const session = auth?.session;
  const profile = auth?.profile;
  const signInWithGoogle = auth?.signInWithGoogle;
  const signInWithFacebook = auth?.signInWithFacebook;
  const signIn = auth?.signIn;
  const signUp = auth?.signUp;
  const signOut = auth?.signOut;
  const deleteAccount = auth?.deleteAccount;

  const [confirmDeleteProf, setConfirmDeleteProf] = useState(false);
  const [deletingProf, setDeletingProf] = useState(false);

  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Forgot Password / OTP Recovery State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryStep, setRecoveryStep] = useState(1);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  // Guest Profile & Manifest State
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'manifest' | 'bookings' | 'contact'>('manifest');
  const [profFirstName, setProfFirstName] = useState('');
  const [profLastName, setProfLastName] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profAddress, setProfAddress] = useState('');
  const [profCity, setProfCity] = useState('');
  const [profEmergency, setProfEmergency] = useState('');
  const [profSaving, setProfSaving] = useState(false);

  // My Bookings State
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Contact Services & Special Request State
  const [contactSubject, setContactSubject] = useState('Front Desk Inquiry');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSending, setContactSending] = useState(false);

  // Live Availability & Reservation Checkout Modal State
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [resRoom, setResRoom] = useState<any>(null);
  const [resNotes, setResNotes] = useState('');
  const [resPhone, setResPhone] = useState('');
  const [resName, setResName] = useState('');
  const [resEmail, setResEmail] = useState('');
  const [resPaymentMethod, setResPaymentMethod] = useState('GCash');
  const [resSubmitting, setResSubmitting] = useState(false);
  const [resConfirmed, setResConfirmed] = useState<any | null>(null);
  const [showModalCalendar, setShowModalCalendar] = useState(false);
  const [showHeroCalendar, setShowHeroCalendar] = useState(false);

  // Sync profile fields whenever profile/session changes
  useEffect(() => {
    if (profile) {
      setProfFirstName(profile.first_name || '');
      setProfLastName(profile.last_name || '');
      setProfPhone(profile.phone ? to11Digits(profile.phone) : '');
      setProfAddress(profile.address || '');
      setProfCity(profile.city || '');
      setProfEmergency(profile.emergency_contact ? to11Digits(profile.emergency_contact) : '');
      const full = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || '';
      setResName(full);
      setResPhone(profile.phone ? to11Digits(profile.phone) : '');
      setResEmail(profile.email || session?.user?.email || '');
    } else if (session?.user) {
      const meta = session.user.user_metadata || {};
      const full = meta.full_name || meta.name || '';
      const [first, ...rest] = full.split(' ');
      setProfFirstName(first || '');
      setProfLastName(rest.join(' ') || '');
      setResName(full || '');
      setResEmail(session.user.email || '');
    }
  }, [profile, session]);

  // Fetch guest's active and past bookings
  const fetchMyBookings = async () => {
    if (!session) return;
    setLoadingBookings(true);
    try {
      const list = await api.myReservations();
      setMyBookings(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.warn('[Reservations] Mine query notice:', err.message);
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    if (profileModalOpen && profileTab === 'bookings') {
      fetchMyBookings();
    }
  }, [profileModalOpen, profileTab]);

  // Automatically advance to app if user returned from OAuth callback
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash?.includes('access_token=') || window.location.search?.includes('code=')) {
        setStage('app');
      }
    }
  }, []);

  // When session is active, automatically advance to app so user is immediately in resort experience
  useEffect(() => {
    if (session && (stage === 'auth' || stage === 'intro')) {
      setStage('app');
      const name = profile?.first_name || session?.user?.user_metadata?.full_name || session?.user?.email || 'Guest';
      toast(`Welcome back, ${name} ✦`);
    }
  }, [session, profile, stage]);

  const handleGoogleAuth = async () => {
    try {
      setAuthBusy(true);
      setAuthError(null);
      toast('Redirecting to Google Sign-In…');
      if (signInWithGoogle) {
        await signInWithGoogle();
      } else {
        throw new Error('Google OAuth is not initialized in client.');
      }
    } catch (err: any) {
      console.error('Google OAuth Error:', err);
      const msg = err.msg || err.message || err.error_description || 'Google Sign-In failed';
      setAuthError(msg);
      toast(msg, true);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleFacebookAuth = async () => {
    try {
      setAuthBusy(true);
      setAuthError(null);
      toast('Redirecting to Facebook Sign-In…');
      if (signInWithFacebook) {
        await signInWithFacebook();
      } else {
        throw new Error('Facebook OAuth is not initialized in client.');
      }
    } catch (err: any) {
      console.error('Facebook OAuth Error:', err);
      const msg = err.msg || err.message || err.error_description || 'Facebook Sign-In failed';
      setAuthError(msg);
      toast(msg, true);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError(null);

    try {
      if (authMode === 'login') {
        if (!authEmail.trim() || !authPassword) {
          throw new Error('Please enter both your email address and password.');
        }
        if (!signIn) throw new Error('Authentication service unavailable');
        const res = await signIn(authEmail.trim(), authPassword);
        if (res?.error) throw res.error;
        toast('Welcome back ✦');
        go('app');
      } else {
        const fullName = authFullName.trim();
        if (!fullName) {
          throw new Error('Full name is strictly required for the guest manifest.');
        }
        const parts = fullName.split(/\s+/);
        const firstName = parts[0] || 'Guest';
        const lastName = parts.slice(1).join(' ') || 'Resident';

        if (!signUp) throw new Error('Registration service unavailable');
        const res = await signUp(authEmail.trim(), authPassword, {
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          phone: authPhone.trim(),
        });
        if (res?.error) throw res.error;

        if (res?.data?.session) {
          toast('Account created and verified! Welcome ✦');
          go('app');
        } else {
          const loginRes = await signIn?.(authEmail.trim(), authPassword);
          if (!loginRes?.error) {
            toast('Account registered successfully! Welcome ✦');
            go('app');
          } else {
            toast('Account created! Please sign in with your credentials.', false);
            setAuthMode('login');
          }
        }
      }
    } catch (err: any) {
      const msg = err.msg || err.message || 'Authentication failed. Please verify your credentials.';
      setAuthError(msg);
      toast(msg, true);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleMobileForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail) return toast('Please enter your account email', true);
    setRecoveryBusy(true);
    try {
      const res = await api.forgotPassword(recoveryEmail);
      toast(res.message || 'OTP verification code dispatched to your email!');
      setRecoveryStep(2);
    } catch (err: any) {
      toast(err.message, true);
    } finally {
      setRecoveryBusy(false);
    }
  };

  const handleMobileResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCode || recoveryCode.length !== 6) return toast('Enter the 6-digit verification code', true);
    if (!recoveryNewPassword || recoveryNewPassword.length < 6) return toast('New password must be at least 6 characters', true);
    setRecoveryBusy(true);
    try {
      const res = await api.resetPassword(recoveryEmail, recoveryCode, recoveryNewPassword);
      toast(res.message || 'Password reset successful! Please sign in.');
      setShowForgotModal(false);
      setRecoveryStep(1);
      setAuthEmail(recoveryEmail);
      setAuthPassword(recoveryNewPassword);
    } catch (err: any) {
      toast(err.message, true);
    } finally {
      setRecoveryBusy(false);
    }
  };

  const go = (next: typeof stage, mode?: 'signup' | 'login') => {
    if (mode) setAuthMode(mode);
    setAuthError(null);
    setMenuOpen(false);
    setStage(next);
  };

  // Ambient waves — Web Audio brown-noise synth, no external assets
  const toggleAmbientAudio = () => {
    if (ambientPlaying) {
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      setAmbientPlaying(false);
      return;
    }
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const size = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < size; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        data[i] = last * 3.5;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = ctx.createGain();
      gain.gain.value = 0.25;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
      audioCtxRef.current = ctx;
      setAmbientPlaying(true);
    } catch {
      setAmbientPlaying(false);
    }
  };

  // loading → intro after 2400ms
  useEffect(() => {
    if (stage !== 'loading') return;
    const t = setTimeout(() => setStage('intro'), 2400);
    return () => clearTimeout(t);
  }, [stage]);

  // Hero auto-crossfade every 7s
  useEffect(() => {
    if (stage !== 'app') return;
    const t = setInterval(() => setActiveScene((s) => (s + 1) % site.hero.scenes.length), 7000);
    return () => clearInterval(t);
  }, [stage]);

  // Close menu on Escape, release audio on unmount
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollTop = () => document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });

  // Active section tracking on main scroll for mobile navigation
  useEffect(() => {
    const scroller = document.getElementById('main-scroll');
    if (!scroller) return;

    const sections = [
      { id: 'booking-section', tab: 'Book' },
      { id: 'rooms-section', tab: 'Rooms' },
      { id: 'experiences-section', tab: 'Experiences' },
      { id: 'amenities-section', tab: 'Amenities' },
      { id: 'dining-section', tab: 'Dining' },
      { id: 'location-section', tab: 'Location' },
      { id: 'faq-section', tab: 'FAQ' },
    ];

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const top = scroller.scrollTop;
        if (top < 150) {
          setActiveTab('Home');
          return;
        }
        for (let i = sections.length - 1; i >= 0; i--) {
          const el = document.getElementById(sections[i].id);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= window.innerHeight * 0.45 && rect.bottom >= 100) {
              setActiveTab(sections[i].tab);
              break;
            }
          }
        }
      });
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  // Center active tab inside mobile nav bar
  useEffect(() => {
    if (!tabBarRef.current) return;
    const activeBtn = tabBarRef.current.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeTab]);

  const navTargets: Record<string, string> = {
    'Rooms & Suites': 'rooms-section',
    Experiences: 'experiences-section',
    Amenities: 'amenities-section',
    Dining: 'dining-section',
    Location: 'location-section',
    FAQ: 'faq-section',
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      toast('Please sign in to update your guest manifest.', true);
      go('auth', 'login');
      return;
    }
    const cleanPhone = to11Digits(profPhone);
    if (!cleanPhone || cleanPhone.length !== 11) {
      toast('Mobile number must be strictly 11 digits (e.g. 0917xxxxxxx)', true);
      return;
    }
    const cleanEmergency = profEmergency ? to11Digits(profEmergency) : '';
    if (profEmergency && cleanEmergency.length !== 11) {
      toast('Emergency contact must be 11 digits (e.g. 0918xxxxxxx)', true);
      return;
    }
    setProfSaving(true);
    try {
      const cleanFirst = profFirstName.replace(/[^a-zA-Z\s\-]/g, '').trim();
      const cleanLast = profLastName.replace(/[^a-zA-Z\s\-]/g, '').trim();
      const fullName = [cleanFirst, cleanLast].filter(Boolean).join(' ') || profile?.full_name || 'Guest Resident';
      const cleanCity = profCity.replace(/[^a-zA-Z\s\-]/g, '').trim();

      const updatePayload = {
        first_name: cleanFirst,
        last_name: cleanLast,
        full_name: fullName,
        phone: cleanPhone,
        address: profAddress.trim(),
        city: cleanCity,
        emergency_contact: cleanEmergency,
      };

      if (auth?.updateProfile) {
        await auth.updateProfile(updatePayload);
      } else {
        await api.updateMe(updatePayload);
      }
      toast('Guest Manifest updated and synchronized ✦');
    } catch (err: any) {
      toast(err.message || 'Failed to update manifest', true);
    } finally {
      setProfSaving(false);
    }
  };

  const handleSendContactMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactMessage.trim()) {
      toast('Please enter your inquiry or special request.', true);
      return;
    }
    setContactSending(true);
    try {
      toast(`✦ Special Request "${contactSubject}" transmitted to Front Desk!`, false);
      setContactMessage('');
      window.dispatchEvent(new CustomEvent('app:open-chat'));
    } catch (err: any) {
      toast(err.message || 'Failed to send message', true);
    } finally {
      setContactSending(false);
    }
  };

  const handleCancelBooking = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this reservation?')) return;
    try {
      await api.cancelReservation(id);
      toast('Reservation cancelled successfully');
      fetchMyBookings();
    } catch (err: any) {
      toast(err.message || 'Failed to cancel reservation', true);
    }
  };

  const checkAvailability = async () => {
    const nights = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000);
    if (!checkIn || !checkOut || nights < 1) {
      setQuote({ ok: false, text: 'Check-out must be at least one night after check-in.' });
      return;
    }
    if (checkIn < today) {
      setQuote({ ok: false, text: 'Check-in cannot be in the past.' });
      return;
    }

    const guestCount = parseInt(guests) || 2;
    setCheckingAvailability(true);
    try {
      const avail = await api.availability(checkIn, checkOut, guestCount);
      const chosen = (Array.isArray(avail) ? avail : []).find((r: any) => r.name.toLowerCase() === selectedRoom.toLowerCase())
        || (Array.isArray(avail) && avail.length > 0 ? avail[0] : null)
        || CANONICAL_ROOMS.find((c) => c.name.toLowerCase() === selectedRoom.toLowerCase());

      const rate = chosen?.rate_php || 4200;
      const units = chosen?.units_left ?? 1;

      if (units <= 0) {
        setQuote({
          ok: false,
          text: `${selectedRoom} is fully booked for those dates. Please select other dates or explore our other villas.`,
        });
      } else {
        setQuote({
          ok: true,
          text: `${chosen.name} · ${units} villa${units > 1 ? 's' : ''} available · ${nights} night${nights > 1 ? 's' : ''} — Total ${peso(rate * nights)} (30% downpayment: ${peso(Math.round(rate * nights * 0.3))})`,
        });
      }
    } catch (err: any) {
      const room = displayRooms.find((r) => r.name === selectedRoom) ?? displayRooms[0];
      setQuote({
        ok: !!room,
        text: room
          ? `${room.name} · ${nights} night${nights > 1 ? 's' : ''} — est. ${peso((room.rate_php || room.price || 4200) * nights)}`
          : 'Please select an available room.',
      });
    } finally {
      setCheckingAvailability(false);
    }
  };

  const openReservation = (roomName?: string, startWithCalendar = true) => {
    const targetName = roomName || selectedRoom;
    const roomMeta = displayRooms.find((r) => r.name?.toLowerCase() === targetName.toLowerCase())
      || displayRooms[0]
      || null;
    
    if (!roomMeta) {
      toast('No room available to book.', true);
      return;
    }

    setResRoom(roomMeta);
    setResConfirmed(null);
    setShowModalCalendar(startWithCalendar);
    setReservationModalOpen(true);
  };

  const handleConfirmReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      toast('Please sign in or register to secure your reservation voucher.', true);
      setReservationModalOpen(false);
      go('auth', 'login');
      return;
    }
    const cleanPhone = to11Digits(resPhone || profile?.phone || '');
    if (!cleanPhone || cleanPhone.length !== 11) {
      toast('Please enter an 11-digit mobile phone for SMS booking verification (09xxxxxxxxx)', true);
      return;
    }
    const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000));
    const targetRoomId = resRoom?.id || '';
    if (!targetRoomId) {
      toast('Please select an active room to reserve.', true);
      return;
    }
    const rate = resRoom?.rate_php || resRoom?.price || 4200;
    const totalPhp = nights * rate;
    const downpaymentPhp = Math.round(totalPhp * 0.3);

    setResSubmitting(true);
    try {
      const payload = {
        roomId: targetRoomId,
        room_id: targetRoomId,
        check_in: checkIn,
        check_out: checkOut,
        guests: parseInt(guests) || 2,
        notes: resNotes ? `${resNotes} [Payment: ${resPaymentMethod}]` : `Payment method: ${resPaymentMethod}`,
        phone: cleanPhone,
        guest_name: (resName || profile?.full_name || '').trim(),
        guest_email: profile?.email || '',
        payment_method: resPaymentMethod,
      };

      const result = await api.createReservation(payload);
      setResConfirmed({
        ...result,
        roomName: resRoom?.name || 'Villa',
        nights,
        total_php: totalPhp,
        downpayment_php: downpaymentPhp,
        payment_method: resPaymentMethod,
        guest_phone: cleanPhone,
        guest_name: resName || profile?.full_name || 'Guest Resident',
      });
      toast('Reservation Confirmed! Your Official Voucher is Ready ✦');
      fetchMyBookings();
    } catch (err: any) {
      toast(err.message || 'Reservation failed. Please check room availability.', true);
    } finally {
      setResSubmitting(false);
    }
  };

  // ========================================================================
  // STAGE 1 — LOADING
  // ========================================================================
  if (stage === 'loading') {
    return (
      <div className="jd-app">
        <main
          className="jd-stage flex flex-col items-center justify-center p-6 select-none animate-fade-in"
          aria-label="Loading Rock View Beach Resort"
        >
          <Logo size="lg" />
          <p className="mt-6 font-serif text-4xl font-medium text-white">{site.brand.name}</p>
          <span className="mt-1 text-xs uppercase tracking-[0.35em] text-cyan/80">{site.brand.sub}</span>
          <div className="mt-8 h-[2px] w-40 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-cyan animate-loadbar" />
          </div>
          <p className="mt-4 text-xs font-light tracking-wider text-white/50">{site.intro.loading}</p>
        </main>
      </div>
    );
  }

  // ========================================================================
  // STAGE 2 — INTRO
  // ========================================================================
  if (stage === 'intro') {
    return (
      <div className="jd-app">
        <main className="jd-stage animate-fade-in">
          {/* HERO */}
          <section className="relative flex min-h-[100dvh] flex-col overflow-hidden">
            <img
              src={site.intro.image}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover animate-kenburns"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-navy/30 via-navy/10 to-navy" />
            <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-navy/70 via-navy/20 to-transparent lg:block" />

            {/* Top bar */}
            <div className={`${WRAP} relative z-10 flex items-center justify-between pt-[calc(1.25rem+env(safe-area-inset-top))]`}>
              <Logo size="sm" />
              {session ? (
                <button
                  type="button"
                  onClick={() => go('app')}
                  className="rounded-full bg-cyan/20 border border-cyan/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan backdrop-blur hover:bg-cyan/30 transition cursor-pointer"
                >
                  Enter Resort →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => go('auth', 'login')}
                  className="rounded-full border border-white/25 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur hover:bg-white/10 transition cursor-pointer"
                >
                  {site.nav.signIn}
                </button>
              )}
            </div>

            <div className={`${WRAP} relative z-10 mt-auto pb-10 md:pb-16`}>
              <div className="max-w-xl">
                <Eyebrow>{`${site.brand.name} · ${site.brand.sub}`}</Eyebrow>
                <h1 className="mt-3 font-serif text-6xl md:text-7xl lg:text-8xl font-medium leading-[0.95] text-white">
                  {site.intro.title}
                  <br />
                  <em className="font-serif italic text-cyan">{site.intro.accent}</em>
                </h1>
                <p className="mt-5 max-w-md text-[15px] md:text-base font-light leading-relaxed text-white/80">
                  {site.intro.body}
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => go(session ? 'app' : 'auth', 'signup')}
                    className={`${BTN_PRIMARY} w-full py-4 sm:w-auto sm:px-10 cursor-pointer`}
                  >
                    {session ? 'Enter Resort ✦' : site.intro.button}
                  </button>
                  {!session && (
                    <button
                      type="button"
                      onClick={() => go('auth', 'login')}
                      className="py-2 text-xs tracking-wide text-white/70 hover:text-white transition sm:px-4 cursor-pointer"
                    >
                      {site.intro.haveAccount}{' '}
                      <span className="font-medium text-cyan underline underline-offset-4">{site.intro.login}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-10 flex flex-col items-center text-[11px] uppercase tracking-[0.25em] text-white/50 lg:items-start">
                <span className="text-base text-cyan animate-bounce">↓</span>
                <span className="mt-1">{site.intro.scrollHint}</span>
              </div>
            </div>
          </section>

          {/* HIGHLIGHTS */}
          <section className={`${WRAP} ${SECTION}`}>
            <Eyebrow>Sanctuary Highlights</Eyebrow>
            <SectionTitle title="Moments built for" accent="stillness." />
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {site.intro.highlights.map((h, i) => (
                <article key={h.title} className={`${CARD} group`}>
                  <div className="h-48 md:h-56 overflow-hidden">
                    <img
                      src={h.image}
                      alt={h.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex items-baseline gap-3">
                      <span className="font-serif text-lg italic text-cyan/70">0{i + 1}</span>
                      <h3 className="font-serif text-2xl font-medium text-white">{h.title}</h3>
                    </div>
                    <p className="mt-2 text-sm font-light leading-relaxed text-white/60">{h.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* STATS */}
          <section className={`${WRAP} pt-10 md:pt-14`}>
            <StatRow />
          </section>

          {/* ROOMS TEASER */}
          <section className={`${WRAP} ${SECTION}`}>
            <Eyebrow>{site.rooms.eyebrow}</Eyebrow>
            <SectionTitle title={site.rooms.title} />
            {displayRooms.length === 0 ? (
              <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center text-white/60">
                <p className="font-serif text-lg text-white">No Rooms Published</p>
                <p className="mt-1 text-sm font-light">Rooms are currently being updated. Please check back shortly.</p>
              </div>
            ) : (
              <div className={`${RAIL} mt-8 lg:grid-cols-4`}>
                {displayRooms.map((room) => (
                  <article
                    key={room.id || room.name}
                    className="group relative h-72 w-[78%] shrink-0 snap-start overflow-hidden rounded-3xl border border-white/10 sm:w-[46%] lg:w-auto"
                  >
                    <img
                      src={getRoomImageUrl(room)}
                      alt={room.name}
                      loading="lazy"
                      onError={handleImageError}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/30 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-cyan font-bold block mb-1">
                        ✦ {room.category || 'Villa'}
                      </span>
                      <h3 className="font-serif text-2xl font-medium leading-tight text-white">{formatRoomTitle(room.name)}</h3>
                      <p className="mt-1 font-serif text-lg text-cyan">
                        {peso(room.rate_php || room.price || 0)} <span className="font-sans text-[11px] text-white/60">/ night</span>
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* AMENITIES */}
          <section className={`${WRAP} ${SECTION}`}>
            <Eyebrow>{site.amenities.eyebrow}</Eyebrow>
            <SectionTitle title={site.amenities.title} />
            <AmenityGrid />
          </section>

          {/* REVIEW + OFFER */}
          <section className={`${WRAP} ${SECTION} grid gap-5 lg:grid-cols-2`}>
            <div className="flex flex-col rounded-3xl bg-sand p-7 md:p-10 text-navy">
              <span className="text-sm tracking-[0.3em] text-[#d9962b]">★★★★★</span>
              <p className="mt-4 font-serif text-2xl md:text-3xl italic leading-snug">
                "{site.reviews.items[0].quote}"
              </p>
              <div className="mt-auto flex items-center justify-between border-t border-navy/10 pt-5">
                <div className="mt-0">
                  <span className="block text-xs font-semibold">{site.reviews.items[0].name}</span>
                  <span className="block text-[11px] text-navy/60">{site.reviews.items[0].from}</span>
                </div>
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-navy/50">Verified guest</span>
              </div>
            </div>

            <div className="flex flex-col rounded-3xl bg-gradient-to-br from-cyan to-sky-600 p-7 md:p-10 text-navy shadow-[0_15px_35px_-10px_rgba(34,195,238,.4)]">
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-navy/70">
                {site.offers.items[0].tag} · Members
              </span>
              <h3 className="mt-2 font-serif text-3xl md:text-4xl font-medium leading-tight">{site.offers.items[0].title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-navy/80">{site.offers.items[0].body}</p>
              <button
                type="button"
                onClick={() => go('auth', 'signup')}
                className="mt-8 w-full rounded-full bg-navy py-4 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:brightness-125 active:scale-[.98] lg:mt-auto"
              >
                Sign up for privileges
              </button>
            </div>
          </section>

          {/* MINI FOOTER */}
          <footer className="mt-20 border-t border-white/10 bg-deep">
            <div className={`${WRAP} flex flex-col items-center py-14 text-center pb-[calc(3.5rem+env(safe-area-inset-bottom))]`}>
              <Logo size="sm" />
              <p className="mt-4 font-serif text-base italic text-white/60">{site.brand.tagline}</p>
              <div className="mt-5 flex gap-6 text-xs text-white/50">
                {site.footer.socials.map((s) => (
                  <span key={s} className="cursor-pointer transition hover:text-cyan">
                    {s}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => go('auth', 'login')}
                className="mt-6 text-xs font-semibold uppercase tracking-wider text-cyan underline underline-offset-4"
              >
                {site.intro.login}
              </button>
              <div className="mt-6 flex flex-wrap justify-center gap-4 text-[10px] text-white/35">
                {site.footer.legal.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>
              <p className="mt-3 max-w-md text-[10px] leading-relaxed text-white/35">{site.footer.copyright}</p>
            </div>
          </footer>
        </main>
      </div>
    );
  }

  // ========================================================================
  // STAGE 3 — AUTH (split screen on md+)
  // ========================================================================
  if (stage === 'auth') {
    const isSignup = authMode === 'signup';
    const copy = isSignup ? site.auth.signup : site.auth.login;

    return (
      <div className="jd-app">
        <main className="jd-stage animate-fade-in md:grid md:grid-cols-2" key={authMode}>
          {/* Visual panel (tablet / desktop) */}
          <aside className="relative hidden overflow-hidden md:sticky md:top-0 md:block md:h-[100dvh]">
            <img src={site.hero.scenes[0].image} alt="" className="absolute inset-0 h-full w-full object-cover animate-kenburns" />
            <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/30 to-navy/20" />
            <div className="absolute inset-x-0 bottom-0 p-10 lg:p-14">
              <Eyebrow>{site.hero.eyebrow}</Eyebrow>
              <p className="mt-4 max-w-md font-serif text-4xl lg:text-5xl leading-tight text-white">
                {site.hero.title}
                <br />
                <em className="italic text-cyan">{site.hero.accent}</em>
              </p>
            </div>
          </aside>

          <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] md:min-h-[100dvh] md:justify-center md:py-12 lg:max-w-lg lg:px-12">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => go('intro')}
                aria-label="Back"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/80 transition hover:bg-white/10 active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <Logo size="sm" />
            </div>

            <div className="mt-10">
              <Eyebrow>{isSignup ? 'New guest' : 'Returning guest'}</Eyebrow>
              <h1 className="mt-3 font-serif text-4xl md:text-5xl font-medium leading-tight text-white">{copy.title}</h1>
              <p className="mt-3 text-sm font-light leading-relaxed text-white/60">{copy.sub}</p>
            </div>

            {authError && (
              <div role="alert" className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
                <span className="font-semibold text-red-400">Notice: </span>
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="mt-8 flex flex-col gap-4">
              {isSignup && (
                <label className="flex flex-col gap-1.5">
                  <span className={LABEL}>Full name *</span>
                  <input
                    required
                    type="text"
                    autoComplete="name"
                    placeholder="Maria Santos"
                    value={authFullName}
                    onChange={(e) => setAuthFullName(e.target.value)}
                    disabled={authBusy}
                    className={FIELD}
                  />
                </label>
              )}
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Email *</span>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="name@email.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  disabled={authBusy}
                  className={FIELD}
                />
              </label>
              {isSignup && (
                <label className="flex flex-col gap-1.5">
                  <span className={LABEL}>Mobile (for SMS confirmations)</span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    placeholder="0917 123 4567"
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                    disabled={authBusy}
                    className={FIELD}
                  />
                </label>
              )}
              <label className="flex flex-col gap-1.5">
                <span className="flex items-center justify-between">
                  <span className={LABEL}>Password *</span>
                  {!isSignup && (
                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryEmail(authEmail || '');
                        setRecoveryStep(1);
                        setShowForgotModal(true);
                      }}
                      className="text-xs text-cyan hover:underline"
                    >
                      {site.auth.forgot}
                    </button>
                  )}
                </span>
                <input
                  required
                  type="password"
                  minLength={6}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  disabled={authBusy}
                  className={FIELD}
                />
              </label>

              <button
                type="submit"
                disabled={authBusy}
                className={`${BTN_PRIMARY} mt-3 w-full py-4 disabled:opacity-50 cursor-pointer`}
              >
                {authBusy ? 'Verifying…' : copy.cta}
              </button>
            </form>

            <div className="my-7 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-white/35">
              <span className="h-px flex-1 bg-white/10" />
              {site.auth.or}
              <span className="h-px flex-1 bg-white/10" />
            </div>

            {/* REAL GOOGLE & FACEBOOK OAUTH BUTTONS */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={authBusy}
                className="flex items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-xs font-medium text-white transition hover:bg-white/10 active:scale-[.98] disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Google
              </button>

              <button
                type="button"
                onClick={handleFacebookAuth}
                disabled={authBusy}
                className="flex items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-xs font-medium text-white transition hover:bg-white/10 active:scale-[.98] disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0 fill-[#1877F2]" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </button>
            </div>

            <button
              type="button"
              onClick={() => go('app')}
              className="mt-3 w-full rounded-2xl border border-white/10 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/5 active:scale-[.98]"
            >
              {site.auth.guest}
            </button>

            <p className="mt-auto pt-10 text-center text-xs text-white/60 md:mt-10 md:pt-0">
              {copy.switch}{' '}
              <button
                type="button"
                onClick={() => setAuthMode(isSignup ? 'login' : 'signup')}
                className="ml-1 font-semibold text-cyan underline underline-offset-4"
              >
                {copy.switchCta}
              </button>
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ========================================================================
  // STAGE 4 — APP
  // ========================================================================
  return (
    <div className="jd-app">
      <main id="main-scroll" className="jd-stage animate-fade-in">
        {/* 1. TICKER */}
        <aside
          aria-label="Resort announcements"
          className="overflow-hidden whitespace-nowrap bg-gradient-to-r from-cyan to-sky-500 pb-1.5 pt-[calc(0.375rem+env(safe-area-inset-top))] text-[10px] font-semibold uppercase tracking-[0.2em] text-navy"
        >
          <div className="inline-flex animate-ticker">
            {[...site.ticker, ...site.ticker, ...site.ticker, ...site.ticker].map((t, i) => (
              <span key={i} className="mx-4 inline-flex items-center gap-3">
                <span aria-hidden="true">✦</span>
                {t}
              </span>
            ))}
          </div>
        </aside>

        {/* 2. HEADER */}
        <header className="sticky top-0 z-40 border-b border-white/10 bg-navy/85 backdrop-blur-xl">
          <div className={`${WRAP} flex h-16 items-center justify-between gap-4`}>
            <button type="button" onClick={scrollTop} aria-label="Back to top">
              <Logo size="sm" />
            </button>

            <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
              {site.nav.links.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => scrollTo(navTargets[l])}
                  className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/70 transition hover:text-cyan cursor-pointer"
                >
                  {l}
                </button>
              ))}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('app:open-chat'))}
                className="flex items-center gap-1.5 rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-cyan transition hover:bg-cyan/20 cursor-pointer"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse" />
                AI Concierge
              </button>
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              {session ? (
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileTab('manifest');
                      setProfileModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-1 text-xs text-white hover:border-cyan/60 transition cursor-pointer"
                    title="Open Guest Profile & Manifest"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan text-[10px] font-bold text-navy">
                      {(profile?.first_name?.[0] || session.user?.email?.[0] || 'U').toUpperCase()}
                    </span>
                    <span className="max-w-[110px] truncate font-medium text-white/90">
                      {profile?.first_name || session.user?.user_metadata?.full_name?.split(' ')[0] || session.user?.email?.split('@')[0]}
                    </span>
                    <span className="text-[10px] text-cyan">✦</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileTab('bookings');
                      setProfileModalOpen(true);
                    }}
                    className="hidden md:inline-flex px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/70 transition hover:text-cyan cursor-pointer"
                  >
                    My Stays
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (signOut) await signOut();
                      toast('Signed out ✦');
                    }}
                    className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/60 transition hover:text-white cursor-pointer"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => go('auth', 'login')}
                  className="hidden px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/70 transition hover:text-white sm:inline-flex cursor-pointer"
                >
                  {site.nav.signIn}
                </button>
              )}
              <button
                type="button"
                onClick={() => openReservation(selectedRoom)}
                className="rounded-full bg-cyan px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-navy shadow-[0_4px_16px_-4px_rgba(34,195,238,.7)] transition hover:brightness-110 active:scale-95 cursor-pointer"
              >
                {site.nav.book}
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={menuOpen}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10 active:scale-95 lg:hidden"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* 3. HERO */}
        <section className="relative flex min-h-[640px] h-[88dvh] max-h-[920px] flex-col overflow-hidden select-none">
          {site.hero.scenes.map((sc, i) => (
            <img
              key={sc.label}
              src={sc.image}
              alt={i === activeScene ? sc.label : ''}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                activeScene === i ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-navy/30 via-navy/20 to-navy" />
          <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-navy/70 via-navy/10 to-transparent lg:block" />

          <div className={`${WRAP} relative z-10 flex justify-end pt-5`}>
            <button
              type="button"
              onClick={toggleAmbientAudio}
              aria-pressed={ambientPlaying}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-navy/70 px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-white backdrop-blur-md transition active:scale-95"
            >
              <span className={`h-2 w-2 rounded-full ${ambientPlaying ? 'bg-cyan animate-pulse' : 'bg-white/40'}`} />
              {site.hero.ambient}
            </button>
          </div>

          <div className={`${WRAP} relative z-10 mt-auto pb-32 md:pb-40`}>
            <div className="max-w-2xl">
              <Eyebrow>{site.hero.eyebrow}</Eyebrow>
              <h1 className="mt-3 font-serif text-[52px] md:text-7xl lg:text-8xl font-medium leading-[0.95] text-white">
                {site.hero.title}
                <br />
                <em className="font-serif italic text-cyan">{site.hero.accent}</em>
              </h1>
              <p className="mt-5 max-w-lg text-[15px] md:text-base font-light leading-relaxed text-white/80">
                {site.hero.body}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button type="button" onClick={() => scrollTo('booking-section')} className={BTN_PRIMARY}>
                  {site.hero.primary}
                </button>
                <button type="button" onClick={() => scrollTo('rooms-section')} className={BTN_GHOST}>
                  {site.hero.secondary}
                </button>
              </div>
              <div className="-mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
                {site.hero.scenes.map((sc, i) => (
                  <button
                    key={sc.label}
                    type="button"
                    onClick={() => setActiveScene(i)}
                    className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] transition ${
                      activeScene === i
                        ? 'border-cyan bg-cyan/20 font-medium text-cyan'
                        : 'border-white/15 bg-black/30 text-white/70 hover:border-white/30'
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 4. BOOKING CARD (overlaps hero) */}
        <section id="booking-section" className={`${WRAP} relative z-20 -mt-20 scroll-mt-24 md:-mt-24`}>
          <div className="rounded-3xl border border-white/15 bg-ink/90 p-5 shadow-2xl shadow-black/60 backdrop-blur-2xl sm:p-6 lg:p-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl md:text-3xl font-medium text-white">{site.booking.title}</h2>
              <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse" />
                Live rates
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1fr_1fr_1fr_1.5fr_auto]">
              <button
                type="button"
                onClick={() => setShowHeroCalendar((s) => !s)}
                className={`flex flex-col text-left gap-1 rounded-2xl border px-4 py-3 transition cursor-pointer ${
                  showHeroCalendar ? 'border-cyan bg-cyan/10' : 'border-white/10 bg-white/[0.04] hover:border-cyan/50'
                }`}
                title="Tap to select check-in date on marked calendar"
              >
                <span className={LABEL}>{site.booking.checkIn}</span>
                <span className="text-sm font-semibold text-white flex items-center justify-between">
                  {checkIn} <span className="text-xs text-cyan">📅</span>
                </span>
                <span className="text-[10px] text-cyan/70 font-medium">Tap for marked calendar</span>
              </button>

              <button
                type="button"
                onClick={() => setShowHeroCalendar((s) => !s)}
                className={`flex flex-col text-left gap-1 rounded-2xl border px-4 py-3 transition cursor-pointer ${
                  showHeroCalendar ? 'border-cyan bg-cyan/10' : 'border-white/10 bg-white/[0.04] hover:border-cyan/50'
                }`}
                title="Tap to select check-out date on marked calendar"
              >
                <span className={LABEL}>{site.booking.checkOut}</span>
                <span className="text-sm font-semibold text-white flex items-center justify-between">
                  {checkOut} <span className="text-xs text-cyan">📅</span>
                </span>
                <span className="text-[10px] text-cyan/70 font-medium">Tap for marked calendar</span>
              </button>

              <label className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <span className={LABEL}>{site.booking.guests}</span>
                <select
                  value={guests}
                  onChange={(e) => {
                    setGuests(e.target.value);
                    setQuote(null);
                  }}
                  className="w-full text-sm font-medium text-white outline-none"
                >
                  {['1 Guest', '2 Guests', '3 Guests', '4 Guests', '5+ Guests'].map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <span className={LABEL}>{site.booking.room}</span>
                <select
                  value={selectedRoom}
                  onChange={(e) => {
                    setSelectedRoom(e.target.value);
                    setQuote(null);
                  }}
                  className="w-full truncate text-sm font-medium text-white outline-none"
                >
                  {displayRooms.length === 0 ? (
                    <option value="">No rooms available</option>
                  ) : (
                    displayRooms.map((r) => (
                      <option key={r.id || r.name} value={r.name}>
                        {r.name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <button
                type="button"
                onClick={checkAvailability}
                disabled={checkingAvailability}
                className={`${BTN_PRIMARY} col-span-2 py-4 lg:col-span-1 lg:h-full lg:px-8 cursor-pointer flex items-center justify-center gap-2`}
              >
                {checkingAvailability ? (
                  <>
                    <span className="h-4 w-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />
                    <span>Checking…</span>
                  </>
                ) : (
                  site.booking.cta
                )}
              </button>
            </div>

            {/* Calendar Exploration Bar */}
            <div className="mt-3.5 flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-white/10">
              <span className="text-xs text-white/60">
                Want to check reserved dates across rooms?
              </span>
              <button
                type="button"
                onClick={() => setShowHeroCalendar((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-cyan hover:text-white transition cursor-pointer"
              >
                📅 {showHeroCalendar ? 'Hide Availability Calendar' : 'View Calendar (Check Reserved vs Open Dates)'}
              </button>
            </div>

            {showHeroCalendar && (
              <div className="mt-4 animate-fade-in">
                <AvailabilityCalendar
                  rooms={displayRooms}
                  initialCheckIn={checkIn}
                  initialCheckOut={checkOut}
                  isLightMode={false}
                  onSelectDates={(newIn, newOut) => {
                    setCheckIn(newIn);
                    setCheckOut(newOut);
                    setQuote(null);
                    toast(`✦ Dates selected: ${newIn} → ${newOut}`);
                  }}
                  onClose={() => setShowHeroCalendar(false)}
                />
              </div>
            )}

            {quote && (
              <div
                role="status"
                className={`mt-4 flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm animate-fade-in sm:flex-row sm:items-center sm:justify-between ${
                  quote.ok ? 'border-cyan/30 bg-cyan/10 text-white' : 'border-gold/40 bg-gold/10 text-gold'
                }`}
              >
                <span>
                  {quote.ok && <span className="mr-2 text-cyan">✦</span>}
                  {quote.text}
                </span>
                {quote.ok && (
                  <button
                    type="button"
                    onClick={() => openReservation(selectedRoom)}
                    className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-cyan underline underline-offset-4 cursor-pointer hover:brightness-120"
                  >
                    Continue to reserve →
                  </button>
                )}
              </div>
            )}

            <p className="mt-4 text-center text-[11px] font-light text-white/50">{site.booking.note}</p>
          </div>
        </section>

        {/* 5. STATS */}
        <section className={`${WRAP} pt-10 md:pt-14`}>
          <StatRow />
        </section>

        {/* 6. ROOMS */}
        <section id="rooms-section" className={`${WRAP} ${SECTION} scroll-mt-16`}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <Eyebrow>{site.rooms.eyebrow}</Eyebrow>
              <SectionTitle title={site.rooms.title} />
            </div>
            {displayRooms.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-white/50 font-medium">
                  ✦ Swipe to explore
                </span>
                <button
                  type="button"
                  onClick={() => scrollRoomsRail('left')}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/80 transition hover:border-cyan hover:bg-cyan/15 hover:text-cyan cursor-pointer active:scale-95 shadow-sm"
                  aria-label="Scroll left"
                  title="Scroll left"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => scrollRoomsRail('right')}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/80 transition hover:border-cyan hover:bg-cyan/15 hover:text-cyan cursor-pointer active:scale-95 shadow-sm"
                  aria-label="Scroll right"
                  title="Scroll right"
                >
                  ▶
                </button>
              </div>
            )}
          </div>

          {displayRooms.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center text-white/60">
              <p className="font-serif text-lg text-white">No Rooms Published</p>
              <p className="mt-1 text-sm font-light">Rooms are currently being updated. Please check back shortly.</p>
            </div>
          ) : (
            <div
              ref={roomsRailRef}
              className="mt-8 flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 pt-1 -mx-5 px-5 sm:-mx-8 sm:px-8 scrollbar-none no-scrollbar"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {displayRooms.map((room) => {
                const roomTitle = formatRoomTitle(room.name);
                const categoryLabel = room.category || 'Luxury Villa';
                const capacityGuests = room.capacity || 4;
                const priceNight = room.rate_php || room.price || 0;
                const downpayment = Math.round(priceNight * 0.3);
                const descriptionText =
                  room.description ||
                  room.meta ||
                  'Private coastal sanctuary featuring tranquil seaside ambiance, plush bedding, and direct beach trail access.';

                return (
                  <article
                    key={room.id || room.name}
                    className="group flex w-[88vw] max-w-[360px] sm:w-[380px] md:w-[410px] shrink-0 snap-start flex-col rounded-3xl border border-white/10 bg-[#0B1528]/95 backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-cyan/50 hover:shadow-2xl hover:shadow-cyan/10"
                  >
                    {/* Image Showcase with Luxury Overlays */}
                    <div className="relative h-60 w-full overflow-hidden bg-navy-dark">
                      <img
                        src={getRoomImageUrl(room)}
                        alt={roomTitle}
                        loading="lazy"
                        onError={handleImageError}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0B1528] via-black/20 to-black/40 pointer-events-none" />

                      {/* Top Badges */}
                      <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 pointer-events-none">
                        <span className="rounded-full border border-white/15 bg-black/60 px-3 py-1 font-mono text-[10px] font-semibold tracking-wider uppercase text-cyan backdrop-blur-md shadow-sm">
                          ✦ {categoryLabel}
                        </span>
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-950/80 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 backdrop-blur-md flex items-center gap-1.5 shadow-sm">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Available
                        </span>
                      </div>

                      {/* Bottom Price Tag */}
                      <div className="absolute bottom-3 left-3 rounded-2xl border border-white/15 bg-navy/90 px-3.5 py-1.5 backdrop-blur-md shadow-lg flex items-baseline gap-1.5">
                        <span className="font-serif text-lg font-bold text-cyan">
                          {peso(priceNight)}
                        </span>
                        <span className="font-sans text-[10px] text-white/60">/ night</span>
                        <span className="hidden sm:inline text-[9px] text-white/40 pl-1 border-l border-white/10">
                          DP: {peso(downpayment)}
                        </span>
                      </div>
                    </div>

                    {/* Card Content & Details */}
                    <div className="flex flex-1 flex-col justify-between p-5 sm:p-6 gap-4">
                      <div className="space-y-2.5">
                        {/* Title & Star Rating */}
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-serif text-xl sm:text-2xl font-medium tracking-wide text-white group-hover:text-cyan transition leading-tight">
                            {roomTitle}
                          </h3>
                          <span className="flex items-center gap-1 text-[11px] font-medium text-amber-300/90 shrink-0 pt-0.5">
                            ★ 4.9 <span className="text-white/40">(18)</span>
                          </span>
                        </div>

                        {/* Specs & Amenities Line */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/60">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 border border-white/5">
                            👥 Sleeps {capacityGuests}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 border border-white/5">
                            🛏️ Queen Suite
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 border border-white/5">
                            ❄️ Aircon
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 border border-white/5">
                            📶 Fast Wi-Fi
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-xs font-light leading-relaxed text-white/60 line-clamp-2">
                          {descriptionText}
                        </p>
                      </div>

                      {/* Professional Dual Action Footer */}
                      <div className="pt-3 border-t border-white/10 flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRoom(room.name);
                            openReservation(room.name, true);
                          }}
                          title={`Check calendar & reserved dates for ${roomTitle}`}
                          className="flex-1 py-2.5 px-3.5 rounded-xl border border-white/20 bg-white/5 hover:border-cyan hover:bg-cyan/10 text-xs font-semibold text-white/90 tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          📅 Check Dates
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRoom(room.name);
                            openReservation(room.name, false);
                          }}
                          title={`Reserve ${roomTitle}`}
                          className="flex-1 py-2.5 px-3.5 rounded-xl bg-cyan hover:bg-cyan-light text-navy font-bold text-xs tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-cyan/20 whitespace-nowrap"
                        >
                          Book Villa →
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* 7. EXPERIENCES (sand) */}
        <section id="experiences-section" className={`${WRAP} ${SECTION} scroll-mt-16`}>
          <div className="rounded-3xl bg-sand p-7 text-navy sm:p-10 lg:grid lg:grid-cols-[1fr_1.6fr] lg:gap-16 lg:p-14">
            <div>
              <Eyebrow light>{site.experiences.eyebrow}</Eyebrow>
              <SectionTitle title={site.experiences.title} light />
              <p className="mt-4 hidden max-w-xs text-sm font-light leading-relaxed text-navy/70 lg:block">
                {site.brand.tagline}
              </p>
            </div>
            <div className="mt-8 grid gap-x-10 sm:grid-cols-2 lg:mt-0">
              {site.experiences.items.map((exp, i) => (
                <div key={exp.title} className="border-t border-navy/10 py-5">
                  <div className="flex items-baseline gap-3">
                    <span className="font-serif text-lg italic text-sky-700/60">0{i + 1}</span>
                    <h3 className="font-serif text-xl font-medium">{exp.title}</h3>
                  </div>
                  <p className="mt-2 text-sm font-light leading-relaxed text-navy/70">{exp.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 8. AMENITIES */}
        <section id="amenities-section" className={`${WRAP} ${SECTION} scroll-mt-16`}>
          <Eyebrow>{site.amenities.eyebrow}</Eyebrow>
          <SectionTitle title={site.amenities.title} />
          <AmenityGrid />
        </section>

        {/* 9. GALLERY */}
        <section className={`${WRAP} ${SECTION}`}>
          <Eyebrow>{site.gallery.eyebrow}</Eyebrow>
          <SectionTitle title={site.gallery.title} />
          <div className="mt-8 grid h-[420px] grid-cols-2 grid-rows-3 gap-2.5 md:h-[480px] md:grid-cols-4 md:grid-rows-2 md:gap-4 lg:h-[560px]">
            {site.gallery.images.slice(0, 5).map((img, i) => (
              <div key={img} className={`overflow-hidden rounded-2xl ${i === 0 ? 'row-span-2 md:col-span-2' : ''}`}>
                <img
                  src={img}
                  alt={`${site.gallery.title} ${i + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-700 hover:scale-105"
                />
              </div>
            ))}
          </div>
        </section>

        {/* 10. REVIEWS */}
        <section className={`${WRAP} ${SECTION}`}>
          <Eyebrow>{site.reviews.eyebrow}</Eyebrow>
          <SectionTitle title={site.reviews.title} />
          <div className={`${RAIL} mt-8 lg:grid-cols-3 lg:gap-5`}>
            {site.reviews.items.map((rev) => (
              <figure
                key={rev.name}
                className="flex w-[85%] shrink-0 snap-start flex-col rounded-3xl border border-white/10 bg-ink p-6 sm:w-[60%] md:p-7 lg:w-auto"
              >
                <span className="text-sm tracking-[0.3em] text-gold">★★★★★</span>
                <blockquote className="mt-4 font-serif text-xl italic leading-relaxed text-white/90">"{rev.quote}"</blockquote>
                <figcaption className="mt-auto flex items-center gap-3 border-t border-white/10 pt-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan/40 bg-cyan/10 font-serif text-base text-cyan">
                    {rev.name[0]}
                  </span>
                  <span>
                    <span className="block text-xs font-medium text-white">{rev.name}</span>
                    <span className="block text-[11px] text-white/50">{rev.from}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* 11. LOCATION */}
        <section id="location-section" className={`${WRAP} ${SECTION} scroll-mt-16`}>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink p-6 sm:p-10 lg:grid lg:grid-cols-2 lg:items-center lg:gap-14 lg:p-14">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan/15 blur-3xl" />
            <div className="relative">
              <Eyebrow>{site.location.eyebrow}</Eyebrow>
              <SectionTitle title={site.location.title} />
              <p className="mt-4 text-sm md:text-[15px] font-light leading-relaxed text-white/70">{site.location.body}</p>
            </div>
            <div className="relative mt-8 lg:mt-0">
              <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                {site.location.facts.map(([val, desc]) => (
                  <div key={desc} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center sm:p-5">
                    <span className="block font-serif text-2xl md:text-3xl font-medium text-cyan">{val}</span>
                    <span className="mt-1 block text-[10px] md:text-xs leading-tight text-white/50">{desc}</span>
                  </div>
                ))}
              </div>
              <a
                href="https://maps.google.com/?q=Patar+Beach+Bolinao+Pangasinan"
                target="_blank"
                rel="noopener noreferrer"
                className={`${BTN_GHOST} mt-6 w-full gap-2`}
              >
                <PinIcon />
                {site.location.button}
              </a>
            </div>
          </div>
        </section>

        {/* 12. FAQ */}
        <section id="faq-section" className={`${WRAP} ${SECTION} scroll-mt-16 lg:grid lg:grid-cols-[1fr_1.6fr] lg:gap-16`}>
          <div>
            <Eyebrow>{site.faq.eyebrow}</Eyebrow>
            <SectionTitle title={site.faq.title} />
          </div>
          <div className="mt-8 flex flex-col gap-3 lg:mt-0">
            {site.faq.items.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q} className="overflow-hidden rounded-2xl border border-white/10 bg-ink">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left"
                  >
                    <span className="font-serif text-lg md:text-xl font-medium text-white">{item.q}</span>
                    <span
                      className={`shrink-0 text-2xl font-light leading-none text-cyan transition-transform duration-300 ${open ? 'rotate-45' : ''}`}
                    >
                      +
                    </span>
                  </button>
                  <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm font-light leading-relaxed text-white/60">{item.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* AI Concierge Direct Query Card */}
            <div className="mt-2 flex flex-col gap-4 rounded-2xl border border-cyan/25 bg-cyan/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-white">
                  <span className="h-2 w-2 rounded-full bg-cyan animate-pulse" />
                  Have more questions about your stay?
                </p>
                <p className="mt-1 text-xs text-white/60">
                  Our 24/7 AI Concierge can instantly answer room rates, amenities, beach guidelines, and group packages.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('app:open-chat'))}
                className="shrink-0 rounded-full bg-cyan px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-navy shadow-[0_4px_16px_rgba(34,195,238,.4)] transition hover:brightness-110 active:scale-95 cursor-pointer"
              >
                Ask AI Concierge ✦
              </button>
            </div>
          </div>
        </section>

        {/* 14. DINING */}
        <section id="dining-section" className={`${WRAP} ${SECTION} scroll-mt-16`}>
          <div className={`${CARD} md:grid md:grid-cols-2`}>
            <div className="relative h-60 sm:h-72 md:h-full md:min-h-[440px]">
              <img src={site.dining.image} alt={site.dining.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent md:bg-gradient-to-l" />
            </div>
            <div className="relative -mt-10 p-6 sm:p-8 md:mt-0 md:flex md:flex-col md:justify-center md:p-12">
              <Eyebrow>{site.dining.eyebrow}</Eyebrow>
              <SectionTitle title={site.dining.title} />
              <p className="mt-4 text-sm md:text-[15px] font-light leading-relaxed text-white/70">{site.dining.body}</p>
              <dl className="mt-6 divide-y divide-white/10 border-t border-white/10">
                {site.dining.hours.map(([meal, time]) => (
                  <div key={meal} className="flex items-center justify-between py-3 text-sm">
                    <dt className="text-white/80">{meal}</dt>
                    <dd className="font-serif text-lg text-cyan">{time}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* 15. CTA */}
        <section className={`${WRAP} ${SECTION}`}>
          <div className="relative flex min-h-[400px] flex-col items-center justify-center overflow-hidden rounded-3xl p-8 text-center md:min-h-[480px]">
            <img src={site.cta.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/60 to-navy/40" />
            <div className="relative max-w-xl">
              <Eyebrow>{site.cta.eyebrow}</Eyebrow>
              <h2 className="mt-3 font-serif text-4xl md:text-6xl font-medium leading-tight text-white">
                {site.cta.title}
                <br />
                <em className="italic text-cyan">{site.cta.accent}</em>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-sm md:text-base font-light leading-relaxed text-white/80">{site.cta.body}</p>
              <button type="button" onClick={() => scrollTo('booking-section')} className={`${BTN_PRIMARY} mt-8 px-10 py-4`}>
                {site.cta.button}
              </button>
            </div>
          </div>
        </section>

        {/* 16. FOOTER */}
        <footer className="relative mt-20 overflow-hidden border-t border-white/10 bg-deep md:mt-28">
          <span className="pointer-events-none absolute -bottom-4 left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-serif text-[80px] italic leading-none text-white/[0.03] md:-bottom-8 md:text-[160px] lg:text-[220px]">
            Rock View
          </span>

          <div className={`${WRAP} relative pb-[calc(8rem+env(safe-area-inset-bottom))] pt-16 lg:pb-16`}>
            <div className="grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <Logo size="md" />
                <p className="mt-5 max-w-sm text-sm font-light leading-relaxed text-white/60">{site.footer.about}</p>
                <div className="mt-5 flex gap-5 text-xs text-white/50">
                  {site.footer.socials.map((s) => (
                    <span key={s} className="cursor-pointer transition hover:text-cyan">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 lg:col-span-4">
                {site.footer.columns.map((col) => (
                  <div key={col.title}>
                    <span className="mb-4 block text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">
                      {col.title}
                    </span>
                    <ul className="flex flex-col gap-2.5 text-sm text-white/70">
                      {col.items.map((it) => (
                        <li
                          key={it}
                          onClick={() => {
                            if (it === 'Concierge Desk') {
                              window.dispatchEvent(new CustomEvent('app:open-chat'));
                            } else if (it === 'Direct Booking FAQ') {
                              scrollTo('faq-section');
                            } else if (it === 'Accommodations' || it === 'Rooms' || it === 'Rooms & Suites') {
                              scrollTo('rooms-section');
                            } else if (it === 'Dining & Grill') {
                              scrollTo('dining-section');
                            }
                          }}
                          className="cursor-pointer transition hover:text-cyan"
                        >
                          {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 lg:col-span-4">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan">
                  {site.footer.newsletter.title}
                </span>
                <p className="mt-2 text-sm font-light leading-relaxed text-white/60">{site.footer.newsletter.body}</p>
                {newsletterDone ? (
                  <p className="mt-4 text-sm text-cyan">✦ You're on the list. Watch for the next high tide.</p>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newsletterEmail) setNewsletterDone(true);
                    }}
                    className="mt-4 flex flex-col gap-2 sm:flex-row"
                  >
                    <input
                      required
                      type="email"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      placeholder={site.footer.newsletter.placeholder}
                      className="min-w-0 flex-1 rounded-full border border-white/10 bg-navy px-4 py-3 text-sm text-white outline-none focus:border-cyan/60"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-full bg-cyan px-5 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-navy transition hover:brightness-110"
                    >
                      {site.footer.newsletter.button}
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                {site.footer.badges.map((b) => (
                  <span key={b} className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[10px] text-gold">
                    ★ {b}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] text-white/45">
                {site.footer.payments.map((p) => (
                  <span key={p} className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center gap-4 border-t border-white/5 pt-6 text-[11px] text-white/40 md:flex-row md:justify-between">
              <p className="text-center md:text-left">{site.footer.copyright}</p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                {site.footer.legal.map((l) => (
                  <span key={l} className="cursor-pointer hover:text-white/70">
                    {l}
                  </span>
                ))}
                <a href="/admin" className="opacity-60 transition hover:opacity-100">
                  Portal
                </a>
                <button type="button" onClick={scrollTop} className="font-semibold uppercase tracking-[0.15em] text-cyan">
                  ↑ {site.footer.backToTop}
                </button>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* MENU OVERLAY (phones / tablets) */}
      {menuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-navy/95 backdrop-blur-2xl animate-fade-in lg:hidden"
        >
          <div className="mx-auto flex min-h-full max-w-md flex-col px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
            <div className="flex h-12 items-center justify-between">
              <Logo size="sm" />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <span className="mt-10 text-[10px] uppercase tracking-[0.3em] text-cyan">Explore the resort</span>
            <nav aria-label="Mobile" className="mt-4 flex flex-col">
              {site.nav.links.map((l, i) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => scrollTo(navTargets[l])}
                  className="flex items-baseline gap-4 border-b border-white/10 py-3.5 text-left font-serif text-3xl text-white transition hover:text-cyan"
                >
                  <span className="font-serif text-sm italic text-cyan/60">0{i + 1}</span>
                  {l}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  window.dispatchEvent(new CustomEvent('app:open-chat'));
                }}
                className="flex items-center justify-between border-b border-white/10 py-3.5 text-left font-serif text-2xl text-cyan transition hover:text-white cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan/20 text-xs text-cyan">✦</span>
                  AI Concierge
                </span>
                <span className="rounded-full bg-cyan/15 px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-widest text-cyan">
                  24/7 Live
                </span>
              </button>
            </nav>

            <div className="mt-auto flex flex-col gap-3 pt-8">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  scrollTo('booking-section');
                }}
                className={`${BTN_PRIMARY} w-full py-4 cursor-pointer`}
              >
                {site.nav.book}
              </button>
              {session ? (
                <div className="flex flex-col gap-2">
                  <div
                    onClick={() => {
                      setProfileTab('manifest');
                      setProfileModalOpen(true);
                      setMenuOpen(false);
                    }}
                    className="flex items-center gap-3 rounded-2xl border border-cyan/30 bg-cyan/10 p-3.5 text-white cursor-pointer hover:border-cyan/60 transition"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan text-xs font-bold text-navy">
                      {(profile?.first_name?.[0] || session.user?.email?.[0] || 'U').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white flex items-center gap-1.5">
                        <span>{profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : session.user?.user_metadata?.full_name || session.user?.email}</span>
                        <span className="text-[10px] text-cyan">✦</span>
                      </p>
                      <p className="truncate text-[10px] text-white/50">{session.user?.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileTab('manifest');
                        setProfileModalOpen(true);
                        setMenuOpen(false);
                      }}
                      className="rounded-xl border border-white/10 bg-white/5 py-2.5 text-[11px] font-medium text-white hover:bg-white/10 cursor-pointer"
                    >
                      Guest Manifest
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileTab('bookings');
                        setProfileModalOpen(true);
                        setMenuOpen(false);
                      }}
                      className="rounded-xl border border-cyan/30 bg-cyan/10 py-2.5 text-[11px] font-medium text-cyan hover:bg-cyan/20 cursor-pointer"
                    >
                      My Bookings
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (signOut) await signOut();
                      setMenuOpen(false);
                      toast('Signed out ✦');
                    }}
                    className={`${BTN_GHOST} w-full py-2.5 cursor-pointer text-white/60 hover:text-white`}
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    go('auth', 'login');
                  }}
                  className={`${BTN_GHOST} w-full py-4 cursor-pointer`}
                >
                  {site.nav.signIn}
                </button>
              )}
              <div className="mt-4 flex justify-center gap-5 text-xs text-white/50">
                {site.footer.socials.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 17. TAB BAR (hidden on desktop where the header nav takes over) */}
      <nav
        aria-label="Tab bar"
        className="fixed inset-x-3 sm:inset-x-6 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-lg lg:hidden"
      >
        <div className="relative flex items-center rounded-full border border-white/15 bg-ink/90 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
          {/* Subtle fade edge masks */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-4 rounded-l-full bg-gradient-to-r from-ink/90 to-transparent z-10" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-4 rounded-r-full bg-gradient-to-l from-ink/90 to-transparent z-10" />

          {/* Horizontally Scrollable Pills Container */}
          <div
            ref={tabBarRef}
            className="flex w-full items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth px-1 touch-pan-x"
          >
            {[
              { key: 'Home', label: 'Home', action: () => { setActiveTab('Home'); scrollTop(); } },
              { key: 'Rooms', label: 'Rooms', action: () => { setActiveTab('Rooms'); scrollTo('rooms-section'); } },
              { key: 'Book', label: 'Book', action: () => { setActiveTab('Book'); scrollTo('booking-section'); } },
              { key: 'Dining', label: 'Dining', action: () => { setActiveTab('Dining'); scrollTo('dining-section'); } },
              { key: 'Experiences', label: 'Experiences', action: () => { setActiveTab('Experiences'); scrollTo('experiences-section'); } },
              { key: 'Amenities', label: 'Amenities', action: () => { setActiveTab('Amenities'); scrollTo('amenities-section'); } },
              { key: 'Location', label: 'Location', action: () => { setActiveTab('Location'); scrollTo('location-section'); } },
              { key: 'FAQ', label: 'FAQ', action: () => { setActiveTab('FAQ'); scrollTo('faq-section'); } },
              {
                key: 'Profile',
                label: session ? (profile?.first_name || 'Account') : 'Sign In',
                action: () => {
                  setActiveTab('Profile');
                  if (session) {
                    setProfileTab('manifest');
                    setProfileModalOpen(true);
                  } else {
                    go('auth', 'login');
                  }
                },
              },
            ].map((tab) => {
              const isBook = tab.key === 'Book';
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  data-tab={tab.key}
                  type="button"
                  onClick={tab.action}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[11px] font-medium transition cursor-pointer ${
                    isBook
                      ? 'bg-gradient-to-r from-cyan to-sky-400 font-bold text-navy shadow-[0_3px_14px_rgba(34,195,238,0.45)]'
                      : isActive
                        ? 'bg-white/15 text-white font-semibold'
                        : 'text-white/65 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* GUEST PROFILE & MANIFEST MODAL */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/85 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-ink p-6 sm:p-8 shadow-2xl text-white my-8 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-cyan block">Guest Sanctuary</span>
                <h3 className="font-serif text-2xl sm:text-3xl font-medium text-white mt-1">
                  {profileTab === 'manifest' ? 'Guest Manifest & Profile' : profileTab === 'bookings' ? 'My Reservations & Stays' : 'Front Desk & Concierge'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                aria-label="Close profile modal"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Nav Tabs */}
            <div className="flex gap-2 p-1.5 mt-4 rounded-2xl bg-white/[0.04] border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setProfileTab('manifest')}
                className={`flex-1 py-2 px-3 rounded-xl font-medium transition cursor-pointer ${
                  profileTab === 'manifest' ? 'bg-cyan text-navy font-semibold shadow-sm' : 'text-white/60 hover:text-white'
                }`}
              >
                📋 Manifest
              </button>
              <button
                type="button"
                onClick={() => setProfileTab('bookings')}
                className={`flex-1 py-2 px-3 rounded-xl font-medium transition cursor-pointer ${
                  profileTab === 'bookings' ? 'bg-cyan text-navy font-semibold shadow-sm' : 'text-white/60 hover:text-white'
                }`}
              >
                📅 My Stays {myBookings.length > 0 && `(${myBookings.length})`}
              </button>
              <button
                type="button"
                onClick={() => setProfileTab('contact')}
                className={`flex-1 py-2 px-3 rounded-xl font-medium transition cursor-pointer ${
                  profileTab === 'contact' ? 'bg-cyan text-navy font-semibold shadow-sm' : 'text-white/60 hover:text-white'
                }`}
              >
                🛎️ Services
              </button>
            </div>

            {/* Modal Tab Body */}
            <div className="mt-5 overflow-y-auto pr-1 flex-1">
              {profileTab === 'manifest' && (
                <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-white/10 bg-white/[0.03]">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan/20 border border-cyan/40 text-cyan text-base font-bold font-serif">
                      {(profFirstName?.[0] || session?.user?.email?.[0] || 'G').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {profFirstName || profLastName ? `${profFirstName} ${profLastName}`.trim() : 'Guest Resident'}
                      </p>
                      <p className="text-xs text-white/50 truncate">{session?.user?.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-cyan/15 text-cyan border border-cyan/30">
                        {profile?.role === 'administrator' ? 'Resort Administrator' : 'Verified Resident'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className={LABEL}>First Name *</span>
                      <input
                        required
                        type="text"
                        value={profFirstName}
                        onChange={(e) => setProfFirstName(e.target.value)}
                        placeholder="Juan"
                        className={FIELD}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className={LABEL}>Last Name *</span>
                      <input
                        required
                        type="text"
                        value={profLastName}
                        onChange={(e) => setProfLastName(e.target.value)}
                        placeholder="Dela Cruz"
                        className={FIELD}
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className={LABEL}>Mobile Phone (11-Digit PH Format) *</span>
                    <input
                      required
                      type="tel"
                      maxLength={11}
                      value={profPhone}
                      onChange={(e) => setProfPhone(to11Digits(e.target.value))}
                      placeholder="09171234567"
                      className={FIELD}
                    />
                    <span className="text-[10px] text-white/40">Used for official booking voucher & front desk SMS updates</span>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className={LABEL}>Residential Address</span>
                      <input
                        type="text"
                        value={profAddress}
                        onChange={(e) => setProfAddress(e.target.value)}
                        placeholder="Street / Barangay"
                        className={FIELD}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className={LABEL}>City / Province</span>
                      <input
                        type="text"
                        value={profCity}
                        onChange={(e) => setProfCity(e.target.value)}
                        placeholder="Bolinao, Pangasinan"
                        className={FIELD}
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className={LABEL}>Emergency Contact (11-Digit Mobile)</span>
                    <input
                      type="tel"
                      maxLength={11}
                      value={profEmergency}
                      onChange={(e) => setProfEmergency(to11Digits(e.target.value))}
                      placeholder="09181234567"
                      className={FIELD}
                    />
                  </label>

                  {confirmDeleteProf ? (
                    <div className="pt-2 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center">
                      <b className="block text-sm text-rose-400 mb-1">⚠️ Permanently Delete Account?</b>
                      <p className="text-[11px] text-rose-200/80 mb-3">All your reservations, manifest profile, and account data will be permanently wiped.</p>
                      <div className="flex gap-2 justify-center">
                        <button
                          type="button"
                          disabled={deletingProf}
                          onClick={async () => {
                            setDeletingProf(true);
                            try {
                              if (deleteAccount) await deleteAccount();
                              setProfileModalOpen(false);
                            } catch (err: any) {
                              toast(err.message, true);
                            } finally {
                              setDeletingProf(false);
                              setConfirmDeleteProf(false);
                            }
                          }}
                          className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer"
                        >
                          {deletingProf ? 'Deleting…' : 'Yes, Delete Account'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteProf(false)}
                          className="border border-white/20 text-white/80 hover:text-white text-xs px-4 py-2 rounded-xl cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 grid grid-cols-3 gap-2">
                      <button
                        type="submit"
                        disabled={profSaving}
                        className={`${BTN_PRIMARY} py-3 text-center justify-center cursor-pointer text-xs font-semibold`}
                      >
                        {profSaving ? 'Saving…' : '💾 Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteProf(true)}
                        className="rounded-2xl border border-rose-500/40 bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 py-3 text-center font-semibold text-xs transition cursor-pointer"
                      >
                        🗑️ Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfileModalOpen(false)}
                        className={`${BTN_GHOST} py-3 text-center justify-center cursor-pointer text-white/70 hover:text-white text-xs font-semibold`}
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  )}
                </form>
              )}

              {profileTab === 'bookings' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-xs text-white/60">Your resort itinerary and booking vouchers</span>
                    <button
                      type="button"
                      onClick={fetchMyBookings}
                      disabled={loadingBookings}
                      className="text-[11px] text-cyan underline uppercase tracking-wider hover:brightness-120 cursor-pointer"
                    >
                      {loadingBookings ? 'Refreshing…' : 'Refresh'}
                    </button>
                  </div>

                  {loadingBookings ? (
                    <div className="py-12 text-center text-xs text-white/50">
                      <span className="inline-block h-5 w-5 border-2 border-cyan border-t-transparent rounded-full animate-spin mb-2" />
                      <p>Loading your reservations…</p>
                    </div>
                  ) : myBookings.length === 0 ? (
                    <div className="py-10 text-center rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                      <span className="font-serif text-3xl text-cyan">✦</span>
                      <p className="mt-2 text-sm font-medium text-white">No Active Reservations</p>
                      <p className="mt-1 text-xs text-white/50 max-w-xs mx-auto">
                        You have no booked stays currently. Explore our beachfront villas facing the Patar sunset.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileModalOpen(false);
                          scrollTo('rooms-section');
                        }}
                        className={`${BTN_PRIMARY} mt-5 py-2.5 px-6 text-[10px] cursor-pointer`}
                      >
                        Explore Rooms →
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {myBookings.map((b) => (
                        <div key={b.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-serif text-base font-medium text-white block">
                                {b.rooms?.name || 'Beachfront Room'}
                              </span>
                              <span className="text-[10px] uppercase tracking-wider text-cyan block mt-0.5">
                                Ref: JD-RES-{b.id?.slice(0, 8).toUpperCase()}
                              </span>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                              b.status === 'confirmed'
                                ? 'bg-cyan/15 text-cyan border-cyan/40'
                                : b.status === 'checked_in'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                                : b.status === 'cancelled'
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                                : 'bg-gold/15 text-gold border-gold/40'
                            }`}>
                              {b.status}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-white/70 py-2 border-y border-white/5">
                            <div>
                              <span className="text-[10px] uppercase text-white/40 block">Check-in</span>
                              <span className="font-medium text-white">{b.check_in}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-white/40 block">Check-out</span>
                              <span className="font-medium text-white">{b.check_out}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-white/40 block">Guests</span>
                              <span className="font-medium text-white">{b.guests || 2} Guests</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-white/40 block">Total Rate</span>
                              <span className="font-medium text-cyan">{peso(b.total_php || 0)}</span>
                            </div>
                          </div>

                          {['pending', 'confirmed'].includes(b.status) && (
                            <div className="mt-3 flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleCancelBooking(b.id)}
                                className="text-[10px] text-rose-300 hover:text-rose-200 underline uppercase tracking-wider cursor-pointer"
                              >
                                Cancel Stay
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {profileTab === 'contact' && (
                <div className="flex flex-col gap-4">
                  {/* Direct Contact Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <a
                      href="tel:+639175558899"
                      className="flex items-center gap-3 p-3.5 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-cyan/40 transition group"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan/15 text-cyan text-sm">
                        📞
                      </span>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-white/50 block">Front Desk Hotline</span>
                        <span className="text-xs font-semibold text-white group-hover:text-cyan transition">+63 917 555 8899</span>
                      </div>
                    </a>

                    <a
                      href="mailto:concierge@janddbeachhouse.ph"
                      className="flex items-center gap-3 p-3.5 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-cyan/40 transition group"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan/15 text-cyan text-sm">
                        ✉️
                      </span>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-white/50 block">Resort Concierge</span>
                        <span className="text-xs font-semibold text-white group-hover:text-cyan transition truncate block">concierge@jandd.ph</span>
                      </div>
                    </a>
                  </div>

                  {/* Resort Location Note */}
                  <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.02] text-xs text-white/70">
                    <p className="font-semibold text-white flex items-center gap-1.5">
                      <span>📍 Patar Beach, Bolinao, Pangasinan</span>
                    </p>
                    <p className="mt-1 text-[11px] text-white/50">
                      Check-in starts at 2:00 PM. Check-out is at 12:00 PM. Complimentary Wi-Fi, fresh coconut welcome drinks, and sunset bonfire.
                    </p>
                  </div>

                  {/* Request Form */}
                  <form onSubmit={handleSendContactMessage} className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className={LABEL}>Request Category</span>
                      <select
                        value={contactSubject}
                        onChange={(e) => setContactSubject(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-ink px-4 py-3 text-xs text-white outline-none focus:border-cyan/60"
                      >
                        <option value="Front Desk Inquiry">Front Desk General Inquiry</option>
                        <option value="Special Dietary Request">Special Dietary & Grill Requests</option>
                        <option value="Airport / Bus Terminal Transfer">Airport / Van Transfer Assistance</option>
                        <option value="Early Check-In / Late Check-Out">Early Check-In / Late Check-Out</option>
                        <option value="Romantic / Celebration Setup">Flower / Anniversary Room Setup</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className={LABEL}>Inquiry Details & Instructions *</span>
                      <textarea
                        required
                        rows={3}
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        placeholder="Please state any special instructions or arrival notes…"
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white outline-none focus:border-cyan/60 resize-none"
                      />
                    </label>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={contactSending}
                        className={`${BTN_PRIMARY} flex-1 py-3 text-[11px] cursor-pointer`}
                      >
                        {contactSending ? 'Transmitting…' : 'Send to Front Desk ✦'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileModalOpen(false);
                          window.dispatchEvent(new CustomEvent('app:open-chat'));
                        }}
                        className="px-4 py-3 rounded-full border border-cyan/40 bg-cyan/15 text-cyan text-[11px] font-semibold uppercase tracking-wider hover:bg-cyan hover:text-navy transition cursor-pointer"
                      >
                        AI Concierge
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RESERVATION CHECKOUT & OFFICIAL VOUCHER MODAL */}
      {reservationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-navy/85 backdrop-blur-md overflow-y-auto scrollbar-none animate-fade-in">
          <div className={`relative w-full ${showModalCalendar ? 'max-w-2xl' : 'max-w-lg'} rounded-2xl sm:rounded-3xl border border-white/10 bg-ink p-4 sm:p-7 shadow-2xl text-white my-auto max-h-[94vh] flex flex-col transition-all duration-300`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 sm:pb-4 border-b border-white/10">
              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.25em] text-cyan block truncate">Direct Booking Sanctuary</span>
                <h3 className="font-serif text-xl sm:text-2xl font-medium text-white mt-0.5 truncate">
                  {resConfirmed ? 'Official Booking Voucher' : 'Confirm Reservation'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReservationModalOpen(false);
                  setResConfirmed(null);
                }}
                aria-label="Close reservation modal"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="mt-3.5 sm:mt-4 overflow-y-auto scrollbar-none pr-0.5 flex-1">
              {resConfirmed ? (
                /* OFFICIAL CONFIRMED VOUCHER */
                <div className="flex flex-col gap-4 animate-fade-in">
                  <div className="rounded-2xl border border-cyan/40 bg-gradient-to-b from-cyan/15 via-ink to-ink p-4 sm:p-5 text-center relative overflow-hidden">
                    <span className="font-serif text-3xl sm:text-4xl text-cyan block">✦</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan mt-1 block">Rock View Beach Resort · Patar Bolinao</span>
                    <h4 className="font-serif text-xl sm:text-2xl font-medium text-white mt-1">Reservation Confirmed</h4>
                    <div className="mt-2.5 inline-block rounded-full bg-cyan px-3.5 py-1 font-mono text-[11px] font-bold tracking-widest text-navy">
                      REF: RV-RES-{resConfirmed.id ? resConfirmed.id.slice(0, 8).toUpperCase() : 'GUARANTEED'}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-left text-xs bg-white/[0.03] p-3 rounded-xl border border-white/10">
                      <div>
                        <span className="text-[9px] uppercase text-white/40 block">Guest Resident</span>
                        <span className="font-medium text-white truncate block">{resConfirmed.guest_name}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-white/40 block">Room</span>
                        <span className="font-medium text-cyan truncate block">{resConfirmed.roomName}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-white/40 block">Check-in</span>
                        <span className="font-medium text-white">{checkIn}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-white/40 block">Check-out</span>
                        <span className="font-medium text-white">{checkOut} ({resConfirmed.nights}N)</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-white/40 block">Total Est.</span>
                        <span className="font-medium text-white">{peso(resConfirmed.total_php)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-white/40 block">30% Downpayment</span>
                        <span className="font-medium text-cyan">{peso(resConfirmed.downpayment_php)}</span>
                      </div>
                    </div>

                    <p className="mt-3 text-[10px] sm:text-[11px] text-white/60 leading-relaxed">
                      We look forward to welcoming you! Present this digital voucher or SMS upon arrival at the Front Desk.
                    </p>
                  </div>

                  <div className="flex gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(`JD-RES-${resConfirmed.id ? resConfirmed.id.slice(0, 8).toUpperCase() : 'GUARANTEED'}`);
                        toast('Voucher Reference Copied to Clipboard ✦');
                      }}
                      className={`${BTN_GHOST} flex-1 py-3 text-xs`}
                    >
                      Copy Voucher Code
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReservationModalOpen(false);
                        setResConfirmed(null);
                        setProfileTab('bookings');
                        setProfileModalOpen(true);
                      }}
                      className={`${BTN_PRIMARY} flex-1 py-3 text-xs`}
                    >
                      View in My Stays
                    </button>
                  </div>
                </div>
              ) : (
                /* RESERVATION CHECKOUT FORM */
                <form onSubmit={handleConfirmReservation} className="flex flex-col gap-3.5 sm:gap-4">
                  {/* Selected Room Card Preview with Interactive Date Adjustment & Calendar */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 flex flex-col gap-3">
                    <div className="flex items-start sm:items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-serif text-lg sm:text-xl font-medium text-white block truncate">
                          {resRoom?.name || selectedRoom}
                        </span>
                        <span className="text-[11px] sm:text-xs text-white/60 block mt-0.5">
                          {checkIn} → {checkOut} ({Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000))} Nights) · {guests}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-serif text-base sm:text-lg text-cyan block font-semibold leading-tight">
                          {peso((resRoom?.rate_php || resRoom?.price || 4200) * Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000)))}
                        </span>
                        <span className="text-[10px] text-white/40 block mt-0.5">
                          30% DP: {peso(Math.round((resRoom?.rate_php || resRoom?.price || 4200) * Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000)) * 0.3))}
                        </span>
                      </div>
                    </div>

                    {/* Interactive Date Adjuster Bar - 2 columns adapting cleanly to phone screens */}
                    <div className="pt-2.5 border-t border-white/10 flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2 w-full">
                        <button
                          type="button"
                          onClick={() => setShowModalCalendar(true)}
                          className={`flex flex-col text-left gap-0.5 min-w-0 p-2.5 rounded-xl border transition cursor-pointer ${
                            showModalCalendar ? 'border-cyan bg-cyan/15 ring-1 ring-cyan/40' : 'border-white/15 bg-white/5 hover:border-white/30'
                          }`}
                          title="Tap to select check-in date on marked calendar"
                        >
                          <span className="text-[10px] uppercase tracking-wider text-cyan font-bold flex items-center justify-between">
                            Check-In <span>📅</span>
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-white truncate">
                            {checkIn}
                          </span>
                          <span className="text-[9px] text-white/50">
                            Tap to pick on calendar
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowModalCalendar(true)}
                          className={`flex flex-col text-left gap-0.5 min-w-0 p-2.5 rounded-xl border transition cursor-pointer ${
                            showModalCalendar ? 'border-cyan bg-cyan/15 ring-1 ring-cyan/40' : 'border-white/15 bg-white/5 hover:border-white/30'
                          }`}
                          title="Tap to select check-out date on marked calendar"
                        >
                          <span className="text-[10px] uppercase tracking-wider text-cyan font-bold flex items-center justify-between">
                            Check-Out <span>📅</span>
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-white truncate">
                            {checkOut}
                          </span>
                          <span className="text-[9px] text-white/50">
                            Tap to pick on calendar
                          </span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowModalCalendar((prev) => !prev)}
                        className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold tracking-wide transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          showModalCalendar
                            ? 'border-cyan/50 bg-cyan text-navy shadow-sm'
                            : 'border-cyan/40 bg-cyan/15 text-cyan hover:bg-cyan hover:text-navy'
                        }`}
                      >
                        📅 {showModalCalendar ? 'Hide Marked Calendar' : 'View Marked Calendar (🔴 Reserved vs 🟢 Open)'}
                      </button>
                    </div>

                    {/* Visual Availability Calendar with Reserved / Available Markings */}
                    {showModalCalendar && (
                      <div className="mt-1 animate-fade-in overflow-hidden">
                        <div className="mb-1.5 flex items-center justify-between px-1 text-[11px] font-medium text-cyan">
                          <span>✦ Tap dates below to set stay dates:</span>
                          <span className="text-[10px] text-white/70 font-normal">🔴 = Reserved · 🟢 = Open</span>
                        </div>
                        <AvailabilityCalendar
                          selectedRoomId={resRoom?.id}
                          rooms={displayRooms}
                          initialCheckIn={checkIn}
                          initialCheckOut={checkOut}
                          isLightMode={false}
                          onSelectDates={(newIn, newOut) => {
                            setCheckIn(newIn);
                            setCheckOut(newOut);
                            toast(`✦ Stay dates adjusted: ${newIn} → ${newOut}`);
                          }}
                          onClose={() => setShowModalCalendar(false)}
                        />
                      </div>
                    )}
                  </div>

                  {!session && (
                    <div className="rounded-2xl border border-gold/40 bg-gold/10 p-3 text-xs text-gold flex items-center justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-xs leading-tight">Sign in required to confirm</p>
                        <p className="text-[10px] text-white/70 mt-0.5 leading-tight">Register or log in to generate official voucher.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setReservationModalOpen(false);
                          go('auth', 'signup');
                        }}
                        className="shrink-0 px-3 py-1.5 rounded-full bg-cyan text-navy font-semibold text-[10px] uppercase tracking-wider hover:brightness-110 cursor-pointer"
                      >
                        Sign In
                      </button>
                    </div>
                  )}

                  {/* Guest Info */}
                  <label className="flex flex-col gap-1.5">
                    <span className={LABEL}>Guest Name for Manifest *</span>
                    <input
                      required
                      type="text"
                      value={resName}
                      onChange={(e) => setResName(e.target.value)}
                      placeholder="Full Name"
                      className={FIELD}
                    />
                  </label>

                  {/* Mobile & Email - Stacks smoothly on phone without squishing */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5 min-w-0">
                      <span className={LABEL}>Mobile Phone (11 Digits) *</span>
                      <input
                        required
                        type="tel"
                        maxLength={11}
                        value={resPhone}
                        onChange={(e) => setResPhone(to11Digits(e.target.value))}
                        placeholder="09171234567"
                        className={FIELD}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 min-w-0">
                      <span className={LABEL}>Email Address *</span>
                      <input
                        required
                        type="email"
                        value={resEmail}
                        onChange={(e) => setResEmail(e.target.value)}
                        placeholder="name@email.com"
                        className={FIELD}
                      />
                    </label>
                  </div>

                  {/* Payment Method Selector */}
                  <label className="flex flex-col gap-1.5">
                    <span className={LABEL}>Preferred Downpayment Method (30% Required)</span>
                    <div className="grid grid-cols-2 gap-2 mt-0.5">
                      {[
                        { name: 'GCash', tag: 'Fast / E-Wallet' },
                        { name: 'Maya', tag: 'Fast / E-Wallet' },
                        { name: 'Credit / Debit Card', tag: 'Visa / Mastercard' },
                        { name: 'Bank Transfer (BDO/BPI)', tag: 'Direct Deposit' },
                      ].map((pm) => (
                        <button
                          key={pm.name}
                          type="button"
                          onClick={() => setResPaymentMethod(pm.name)}
                          className={`p-2 sm:p-2.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between min-h-[52px] ${
                            resPaymentMethod === pm.name
                              ? 'border-cyan bg-cyan/15 text-white shadow-[0_0_15px_rgba(34,195,238,0.2)]'
                              : 'border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20'
                          }`}
                        >
                          <span className="block text-[11px] font-semibold leading-tight truncate w-full">{pm.name}</span>
                          <span className="text-[9px] text-white/40 block mt-0.5 truncate w-full">{pm.tag}</span>
                        </button>
                      ))}
                    </div>
                  </label>

                  {/* Special Requests */}
                  <label className="flex flex-col gap-1.5">
                    <span className={LABEL}>Special Requests & Expected Arrival Time</span>
                    <textarea
                      rows={2}
                      value={resNotes}
                      onChange={(e) => setResNotes(e.target.value)}
                      placeholder="e.g. ETA 3:00 PM, extra towels, barbecue grill setup…"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white outline-none focus:border-cyan/60 resize-none"
                    />
                  </label>

                  <div className="pt-1.5">
                    <button
                      type="submit"
                      disabled={resSubmitting}
                      className={`${BTN_PRIMARY} w-full py-3.5 sm:py-4 text-xs font-semibold uppercase tracking-[0.18em] cursor-pointer`}
                    >
                      {resSubmitting ? 'Confirming Reservation…' : 'Confirm Stay & Generate Voucher ✦'}
                    </button>
                    <p className="mt-1.5 text-center text-[10px] text-white/40">
                      No cancellation fee up to 48 hours before check-in. Instant confirmation.
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE FORGOT PASSWORD & OTP RECOVERY MODAL */}
      {showForgotModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/85 backdrop-blur-md animate-fade-in"
          onClick={() => setShowForgotModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl border border-white/15 bg-navy-deep p-6 md:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <span className="text-[10px] font-bold tracking-[0.2em] text-cyan uppercase">Account Security</span>
                <h3 className="font-serif text-xl font-medium text-white mt-0.5">Reset Password via OTP</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/70 hover:bg-white/10 cursor-pointer text-lg leading-none"
                aria-label="Close recovery modal"
              >
                ×
              </button>
            </div>

            {recoveryStep === 1 ? (
              <form onSubmit={handleMobileForgotPassword} className="mt-5 flex flex-col gap-4">
                <p className="text-xs font-light text-white/70 leading-relaxed">
                  Enter your registered account email. A secure 6-digit OTP verification code will be dispatched to your inbox via Google Mail / SMTP.
                </p>
                <label className="flex flex-col gap-1.5">
                  <span className={LABEL}>Account Email *</span>
                  <input
                    required
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="guest@gmail.com"
                    className={FIELD}
                  />
                </label>
                <button
                  type="submit"
                  disabled={recoveryBusy}
                  className={`${BTN_PRIMARY} mt-2 w-full py-3.5 text-xs font-semibold uppercase tracking-[0.16em] disabled:opacity-50 cursor-pointer`}
                >
                  {recoveryBusy ? 'Dispatching OTP…' : 'Send 6-Digit Email OTP ✦'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="text-xs text-white/50 hover:text-white/80 text-center py-1 cursor-pointer"
                >
                  ← Back to Sign In
                </button>
              </form>
            ) : (
              <form onSubmit={handleMobileResetPassword} className="mt-5 flex flex-col gap-4">
                <p className="text-xs font-light text-white/70 leading-relaxed">
                  Enter the 6-digit OTP verification code sent to <strong className="text-cyan">{recoveryEmail}</strong> and enter a new password.
                </p>
                <label className="flex flex-col gap-1.5">
                  <span className={LABEL}>6-Digit OTP Verification Code *</span>
                  <input
                    required
                    maxLength={6}
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.trim())}
                    placeholder="123456"
                    className={`${FIELD} text-center text-xl font-bold tracking-[0.3em] text-cyan`}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={LABEL}>New Password (min 6 characters) *</span>
                  <input
                    required
                    type="password"
                    minLength={6}
                    value={recoveryNewPassword}
                    onChange={(e) => setRecoveryNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className={FIELD}
                  />
                </label>
                <button
                  type="submit"
                  disabled={recoveryBusy}
                  className={`${BTN_PRIMARY} mt-2 w-full py-3.5 text-xs font-semibold uppercase tracking-[0.16em] disabled:opacity-50 cursor-pointer`}
                >
                  {recoveryBusy ? 'Updating Password…' : 'Verify OTP & Reset Password ✦'}
                </button>
                <div className="flex justify-between items-center pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setRecoveryStep(1)}
                    className="text-cyan hover:underline cursor-pointer"
                  >
                    Resend Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="text-white/50 hover:text-white/80 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// SHARED SECTIONS
// ==========================================================================
function StatRow() {
  return (
    <div className="mx-auto grid max-w-4xl grid-cols-3 divide-x divide-white/10 rounded-3xl border border-white/10 bg-ink px-2 py-6 text-center md:py-8">
      {site.stats.map((st) => (
        <div key={st.label} className="px-2">
          <span className="block font-serif text-3xl md:text-5xl font-medium text-cyan">{st.value}</span>
          <span className="mt-1.5 block text-[10px] md:text-xs uppercase leading-tight tracking-[0.2em] text-white/50">
            {st.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function AmenityGrid() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
      {site.amenities.items.map((a) => (
        <div
          key={a.label}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan/30 md:p-5"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan/30 bg-cyan/15 text-cyan">
            <AmenityIcon name={a.icon} />
          </span>
          <span className="text-xs md:text-sm font-medium text-white/80">{a.label}</span>
        </div>
      ))}
    </div>
  );
}
