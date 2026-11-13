import React, { useState, useEffect, useRef, useCallback } from 'react';
import site from '../content/site.json';
import { useAuth, to11Digits, isValidPHMobile } from '../context/AuthContext.tsx';
import {
  api,
  extractBookingTimes,
  normalizeTo24Hour,
  parseBookingTimeMs,
  isBookingCollisionWithGap,
  TWO_HOURS_MS,
} from '../lib/api.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { CANONICAL_ROOMS } from '../lib/canonicalRooms.ts';
import { toast } from './Toasts.tsx';
import { getRoomImageUrl, handleImageError } from '../lib/images.ts';
import AvailabilityCalendar from './AvailabilityCalendar.tsx';
import {
  getManilaTodayISO,
  getMinGuestCheckInISO,
  addDaysISO,
  inferOfferingType,
  getOfferingLabel,
  formatOfferingBadge,
  getRateUnitSuffix,
  calculateOfferingTotal,
  formatSpecHighlights,
  resolveReservationOfferingType,
  OfferingType,
} from '../lib/offeringSpecs';
import { VoucherModal, LuxuryResortVoucher, ReceiptActions, normalizeVoucherData, VoucherData } from './receipt';
import ResortSectionBoundary from './resort/ResortSectionBoundary.tsx';
import ResortHeroBooking from './resort/ResortHeroBooking.tsx';
import ResortRoomsRail from './resort/ResortRoomsRail.tsx';
import ResortExperiences from './resort/ResortExperiences.tsx';
import ResortAmenities from './resort/ResortAmenities.tsx';
import ResortDining from './resort/ResortDining.tsx';
import ResortReviews from './resort/ResortReviews.tsx';
import ResortLocationFaq from './resort/ResortLocationFaq.tsx';
import ResortFooter from './resort/ResortFooter.tsx';

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
        <i className="fas fa-umbrella-beach text-cyan text-sm" />
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
  switch (name) {
    case 'wifi':
      return <i className="fas fa-wifi text-xs" />;
    case 'utensils':
      return <i className="fas fa-utensils text-xs" />;
    case 'cocktail':
      return <i className="fas fa-martini-glass text-xs" />;
    case 'sun':
      return <i className="fas fa-sun text-xs" />;
    case 'compass':
      return <i className="fas fa-compass text-xs" />;
    default:
      return <i className="fas fa-water text-xs" />;
  }
}

function PinIcon() {
  return <i className="fas fa-location-dot w-4 h-4 text-xs inline-flex items-center justify-center text-cyan" aria-hidden="true" />;
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
      // Query param stage override: /?stage=app allows direct app viewing
      const s = new URLSearchParams(window.location.search).get('stage');
      if (s === 'intro' || s === 'auth' || s === 'app') return s as any;
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
  const today = getManilaTodayISO();
  const minCheckInDate = getMinGuestCheckInISO();
  const [checkIn, setCheckIn] = useState(minCheckInDate);
  const [checkOut, setCheckOut] = useState(addDaysISO(minCheckInDate, 1));
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [offeringFilter, setOfferingFilter] = useState<'all' | OfferingType>('all');
  const [stayBookingFilter, setStayBookingFilter] = useState<'all' | OfferingType>('all');
  const [guests, setGuests] = useState('2 Guests');
  const [selectedRoom, setSelectedRoom] = useState(site.rooms.items[0]?.name ?? '');
  const [quote, setQuote] = useState<{ ok: boolean; text: string } | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [bookedRanges, setBookedRanges] = useState<any[]>([]);

  const refreshAvailabilityData = useCallback(async () => {
    try {
      const [roomsData, calData] = await Promise.all([
        api.rooms(),
        api.availabilityCalendar(),
      ]);
      if (Array.isArray(roomsData)) {
        setRooms(roomsData);
        if (roomsData.length > 0 && !selectedRoom) {
          setSelectedRoom(roomsData[0].name);
        }
      }
      if (calData && Array.isArray(calData.booked_ranges)) {
        setBookedRanges(calData.booked_ranges);
      }
    } catch {}
  }, [selectedRoom]);

  useEffect(() => {
    refreshAvailabilityData();
  }, [refreshAvailabilityData]);

  // Real-time synchronization when bookings or rooms change
  useEffect(() => {
    const channelName = `mobile_app_avail_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        refreshAvailabilityData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        refreshAvailabilityData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshAvailabilityData]);

  // 1. Check if room is occupied on today's live date
  const isRoomOccupiedToday = useCallback((room: any): boolean => {
    if (!room) return false;
    if (room.is_locked_now) return true;
    if (room.units_available_now !== undefined && room.units_available_now <= 0) return true;
    const totalUnits = Number(room.units) || 1;
    const nowMs = Date.now();
    const activeToday = bookedRanges.filter((b) => {
      if (b.room_id !== room.id || b.status === 'cancelled') return false;
      const bTimes = extractBookingTimes(b);
      const bStart = parseBookingTimeMs(b.check_in, bTimes.check_in_time);
      const bEnd = parseBookingTimeMs(b.check_out, bTimes.check_out_time);
      return nowMs >= bStart && nowMs < bEnd;
    }).length;
    return activeToday >= totalUnits;
  }, [bookedRanges]);

  // 2. Check if room is occupied / fully reserved across requested stay dates and specific times (with mandatory 2-hour gap buffer)
  const isRoomOccupiedForDates = useCallback((
    room: any,
    inDate: string,
    outDate: string,
    inTime: string = checkInTime,
    outTime: string = checkOutTime,
    preferredUnit?: number | null
  ): boolean => {
    if (!room || !inDate || !outDate || outDate <= inDate) return false;
    const totalUnits = Math.max(1, Number(room.units) || 1);
    const startMs = parseBookingTimeMs(inDate, inTime || '14:00');
    const endMs = parseBookingTimeMs(outDate, outTime || '12:00');
    if (endMs <= startMs) return true;

    // Filter bookedRanges for this room
    const roomBookings = bookedRanges.filter(
      (b) => (b.room_id === room.id || !b.room_id) && b.status !== 'cancelled'
    );
    if (roomBookings.length === 0) return false;

    // Check collisions with mandatory 2-hour turnaround buffer
    const colliding = roomBookings.filter((b) => {
      const times = extractBookingTimes(b);
      const bStart = parseBookingTimeMs(b.check_in, times.check_in_time);
      const bEnd = parseBookingTimeMs(b.check_out, times.check_out_time);
      return isBookingCollisionWithGap(startMs, endMs, bStart, bEnd, TWO_HOURS_MS);
    });

    if (colliding.length === 0) return false;

    // If a specific unit is checked
    if (preferredUnit) {
      return colliding.some((c) => {
        const uMatch = (c.notes || '').match(/\[?(?:Unit\s*|u)(\d+)\]?/i);
        if (uMatch && parseInt(uMatch[1], 10) === preferredUnit) return true;
        if (!uMatch && preferredUnit === 1 && totalUnits === 1) return true;
        return false;
      });
    }

    // Check taken units
    const takenUnits = new Set<number>();
    let unassignedCount = 0;
    for (const c of colliding) {
      const uMatch = (c.notes || '').match(/\[?(?:Unit\s*|u)(\d+)\]?/i);
      if (uMatch) {
        const u = parseInt(uMatch[1], 10);
        if (u >= 1 && u <= totalUnits) takenUnits.add(u);
      } else {
        unassignedCount++;
      }
    }

    return (takenUnits.size + unassignedCount >= totalUnits) || (colliding.length >= totalUnits);
  }, [bookedRanges, checkInTime, checkOutTime]);

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
  const [calendarTarget, setCalendarTarget] = useState<'checkIn' | 'checkOut'>('checkIn');
  const [showHeroCalendar, setShowHeroCalendar] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherData | null>(null);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyTab, setPolicyTab] = useState<'cancellation' | 'checkin' | 'rules' | 'privacy'>('cancellation');

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
        // 1. Mandatory Website Policy Agreement Check
        if (!termsAccepted) {
          setAuthError('You must review and accept the Website Terms of Stay and Privacy Policy before creating an account.');
          setShowPolicyModal(true);
          toast('⚠️ Please review and accept the Website Policy to continue.', true);
          return;
        }

        // 2. Full Name Validation
        const fullName = authFullName.trim();
        if (!fullName || fullName.length < 2) {
          throw new Error('Full name is strictly required for the guest manifest.');
        }
        const parts = fullName.split(/\s+/).filter(Boolean);
        const firstName = parts[0] || 'Guest';
        const lastName = parts.slice(1).join(' ') || 'Resident';

        // 3. Strict 11-Digit Philippine Mobile Limitation
        const cleanPhone = authPhone.trim().replace(/\D/g, '');
        if (!cleanPhone) {
          throw new Error('Mobile phone number is strictly required for SMS reservation confirmations.');
        }
        if (cleanPhone.length !== 11 || !cleanPhone.startsWith('09')) {
          throw new Error('Mobile number must strictly be an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567).');
        }

        // 4. Password Security Requirement
        if (!authPassword || authPassword.length < 8) {
          throw new Error('Password must be at least 8 characters long for account security.');
        }
        if (!/[a-zA-Z]/.test(authPassword) || !/[0-9]/.test(authPassword)) {
          throw new Error('Password must contain both letters and numbers for account security.');
        }

        const cleanEmail = authEmail.trim().toLowerCase();

        // 5. Anti-Duplication Check: Email & Phone Number
        try {
          const { data: dupCustEmail } = await supabase
            .from('customers')
            .select('id, email')
            .ilike('email', cleanEmail)
            .maybeSingle();

          if (dupCustEmail) {
            throw new Error(`An account with the email "${cleanEmail}" already exists. Please sign in or use forgot password.`);
          }

          const { data: dupProfEmail } = await supabase
            .from('profiles')
            .select('id, email')
            .ilike('email', cleanEmail)
            .maybeSingle();

          if (dupProfEmail) {
            throw new Error(`An account with the email "${cleanEmail}" already exists. Please sign in or use forgot password.`);
          }
        } catch (dupEmailErr: any) {
          if (dupEmailErr.message?.includes('already exists')) throw dupEmailErr;
        }

        try {
          const { data: dupCustPhone } = await supabase
            .from('customers')
            .select('id, phone')
            .eq('phone', cleanPhone)
            .maybeSingle();

          if (dupCustPhone) {
            throw new Error(`Mobile number "${cleanPhone}" is already registered to an existing customer account. Please sign in or use another number.`);
          }

          const { data: dupProfPhone } = await supabase
            .from('profiles')
            .select('id, phone')
            .eq('phone', cleanPhone)
            .maybeSingle();

          if (dupProfPhone) {
            throw new Error(`Mobile number "${cleanPhone}" is already registered to an existing customer account. Please sign in or use another number.`);
          }
        } catch (dupPhoneErr: any) {
          if (dupPhoneErr.message?.includes('already registered')) throw dupPhoneErr;
        }

        if (!signUp) throw new Error('Registration service unavailable');
        const res = await signUp(cleanEmail, authPassword, {
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          phone: cleanPhone,
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
    if (!cleanPhone || cleanPhone.length !== 11 || !cleanPhone.startsWith('09')) {
      toast('Mobile number must be strictly an 11-digit Philippine mobile number starting with 09 (e.g. 0917xxxxxxx)', true);
      return;
    }
    const cleanEmergency = profEmergency ? to11Digits(profEmergency) : '';
    if (profEmergency && (cleanEmergency.length !== 11 || !cleanEmergency.startsWith('09'))) {
      toast('Emergency contact must be strictly an 11-digit Philippine mobile number starting with 09 (e.g. 0918xxxxxxx)', true);
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

      const targetRoomObj = displayRooms.find((r) => r.name.toLowerCase() === selectedRoom.toLowerCase()) || chosen;
      const isOccupied = units <= 0 || (targetRoomObj && isRoomOccupiedForDates(targetRoomObj, checkIn, checkOut));

      if (isOccupied) {
        setQuote({
          ok: false,
          text: `⚠️ ${selectedRoom} is fully occupied for those dates (${checkIn} → ${checkOut}). Please select other dates on the calendar or explore our other villas.`,
        });
      } else {
        setQuote({
          ok: true,
          text: (() => {
            const oType = inferOfferingType(chosen);
            const totalEst = calculateOfferingTotal({
              rate_php: rate,
              nights,
              guests: guestCount,
              offering_type: oType,
              specs: chosen?.specs || {},
            });
            const unitText = oType === 'offer' ? `Tour Date (${checkIn})` : `${nights} night${nights > 1 ? 's' : ''}`;
            return `${chosen.name} (${getOfferingLabel(oType)}) · ${units} slot${units > 1 ? 's' : ''}/unit${units > 1 ? 's' : ''} open · ${unitText}: Total ${peso(totalEst)} (30% downpayment: ${peso(Math.round(totalEst * 0.3))})`;
          })(),
        });
      }
    } catch (err: any) {
      const room = displayRooms.find((r) => r.name === selectedRoom) ?? displayRooms[0];
      const isOccupied = room && isRoomOccupiedForDates(room, checkIn, checkOut);
      if (isOccupied) {
        setQuote({
          ok: false,
          text: `⚠️ ${room?.name || selectedRoom} is fully occupied from ${checkIn} to ${checkOut}. Please select open dates on the calendar.`,
        });
      } else {
        setQuote({
          ok: !!room,
          text: room
            ? `${room.name} · ${nights} night${nights > 1 ? 's' : ''} — est. ${peso((room.rate_php || room.price || 4200) * nights)}`
            : 'Please select an available room.',
        });
      }
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

  const handleResetCalendarSelection = () => {
    setCheckIn('');
    setCheckOut('');
    setQuote(null);
    setCalendarTarget('checkIn');
    toast('✦ Calendar selection cleared: Ready to pick Check-In.');
  };

  const handleConfirmReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      toast('Please sign in or register to secure your reservation voucher.', true);
      setReservationModalOpen(false);
      go('auth', 'login');
      return;
    }

    if (!termsAccepted) {
      toast('⚠️ Please review and accept the Resort Terms of Stay and Cancellation Policy to confirm.', true);
      return;
    }

    const targetRoomId = resRoom?.id || '';
    if (!targetRoomId) {
      toast('Please select an active room to reserve.', true);
      return;
    }

    if (!checkIn || !checkOut || checkOut <= checkIn) {
      toast('Please select valid stay dates (check-out must be after check-in).', true);
      return;
    }

    if (isRoomOccupiedForDates(resRoom, checkIn, checkOut, checkInTime, checkOutTime)) {
      toast('⚠️ That accommodation is already reserved for that time slot. A mandatory 2-hour preparation gap is required between stays. Please pick another time or date.', true);
      setShowModalCalendar(true);
      return;
    }

    const cleanGuestName = (resName || profile?.full_name || '').trim();
    if (!cleanGuestName || cleanGuestName.length < 2) {
      toast('Please enter the primary guest name for the official manifest.', true);
      return;
    }

    const cleanPhone = to11Digits(resPhone || profile?.phone || '');
    if (!cleanPhone || cleanPhone.length !== 11 || !cleanPhone.startsWith('09')) {
      toast('Mobile phone must strictly be an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567).', true);
      return;
    }

    const cleanEmail = (resEmail || profile?.email || session?.user?.email || '').trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast('Please enter a valid email address to receive your official voucher.', true);
      return;
    }

    if (!resPaymentMethod) {
      toast('Please choose a preferred downpayment method.', true);
      return;
    }

    const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000));
    const offeringType = inferOfferingType(resRoom);
    const rate = resRoom?.rate_php || resRoom?.price || 4200;
    const guestQty = parseInt(guests) || 2;
    const totalPhp = calculateOfferingTotal({
      rate_php: rate,
      nights,
      guests: guestQty,
      offering_type: offeringType,
      specs: resRoom?.specs || {},
    });
    const downpaymentPhp = Math.round(totalPhp * 0.3);

    setResSubmitting(true);
    try {
      const payload = {
        roomId: targetRoomId,
        room_id: targetRoomId,
        offering_type: offeringType,
        check_in: checkIn,
        check_out: checkOut,
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        guests: parseInt(guests) || 2,
        notes: resNotes ? `${resNotes} [Payment: ${resPaymentMethod}]` : `Payment method: ${resPaymentMethod}`,
        phone: cleanPhone,
        guest_name: cleanGuestName,
        guestName: cleanGuestName,
        guest_email: cleanEmail,
        email: cleanEmail,
        payment_method: resPaymentMethod,
        terms_accepted: true,
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
      refreshAvailabilityData();
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

          {/* MODULAR ACCOMMODATIONS PREVIEW & BOOKING RAIL */}
          <ResortSectionBoundary sectionName="Accommodations Preview">
            <ResortRoomsRail
              rooms={displayRooms}
              checkIn={checkIn}
              checkOut={checkOut}
              checkInTime={checkInTime}
              checkOutTime={checkOutTime}
              isRoomOccupiedForDates={isRoomOccupiedForDates}
              isRoomOccupiedToday={isRoomOccupiedToday}
              onOpenReservation={(roomName, startWithCalendar) => {
                if (roomName) setSelectedRoom(roomName);
                setStage('app');
                setTimeout(() => {
                  openReservation(roomName, startWithCalendar);
                }, 50);
              }}
              onSelectRoom={(roomName) => {
                setSelectedRoom(roomName);
                setStage('app');
              }}
              eyebrow={site.rooms.eyebrow}
              title={site.rooms.title}
            />
          </ResortSectionBoundary>

          {/* AMENITIES */}
          <section className={`${WRAP} ${SECTION}`}>
            <Eyebrow>{site.amenities.eyebrow}</Eyebrow>
            <SectionTitle title={site.amenities.title} />
            <AmenityGrid />
          </section>

          {/* GUEST REVIEWS */}
          <section className={`${WRAP} ${SECTION} grid gap-5 lg:grid-cols-2`}>
            {site.reviews.items.slice(0, 2).map((rev) => (
              <div key={rev.name} className="flex flex-col rounded-3xl bg-sand p-7 md:p-10 text-navy shadow-sm">
                <span className="text-sm tracking-[0.2em] text-[#d9962b]">
                  <i className="fas fa-star" /><i className="fas fa-star" /><i className="fas fa-star" /><i className="fas fa-star" /><i className="fas fa-star" />
                </span>
                <p className="mt-4 font-serif text-2xl md:text-3xl italic leading-snug">
                  "{rev.quote}"
                </p>
                <div className="mt-auto flex items-center justify-between border-t border-navy/10 pt-5">
                  <div className="mt-0">
                    <span className="block text-xs font-semibold">{rev.name}</span>
                    <span className="block text-[11px] text-navy/60">{rev.from}</span>
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-navy/50">Verified guest</span>
                </div>
              </div>
            ))}
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
    const renderAuthModals = () => (
    <>
      {/* RESORT TERMS OF STAY & CANCELLATION POLICY MODAL */}
      {showPolicyModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-navy/90 backdrop-blur-md animate-fade-in overflow-y-auto"
          onClick={() => setShowPolicyModal(false)}
        >
          <div
            className="relative w-full max-w-xl rounded-2xl sm:rounded-3xl border border-white/15 bg-ink p-5 sm:p-7 shadow-2xl text-white my-auto max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-3 sm:pb-4 border-b border-white/10 gap-3">
              <div>
                <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.2em] text-cyan block">
                  Rock View Beach Resort · Patar, Bolinao
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-medium text-white mt-0.5">
                  Terms of Stay & Resort Policies
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition cursor-pointer"
                aria-label="Close policy modal"
              >
                <i className="fas fa-xmark" />
              </button>
            </div>

            {/* Policy Navigation Tabs */}
            <div className="flex items-center gap-1.5 pt-3 pb-2 border-b border-white/5 overflow-x-auto scrollbar-none">
              {[
                { id: 'cancellation', label: 'Refunds & Cancellation', icon: 'fa-money-bill-transfer' },
                { id: 'checkin', label: 'Check-In & Payment', icon: 'fa-clock' },
                { id: 'rules', label: 'House Rules & Eco', icon: 'fa-umbrella-beach' },
                { id: 'privacy', label: 'Manifest & Privacy', icon: 'fa-shield-halved' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPolicyTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                    policyTab === tab.id
                      ? 'bg-cyan text-slate-950 font-semibold shadow-sm'
                      : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <i className={`fas ${tab.icon} text-[10px]`} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Policy Tab Content */}
            <div className="mt-4 overflow-y-auto scrollbar-none flex-1 pr-1 text-xs text-white/80 leading-relaxed flex flex-col gap-3.5">
              {policyTab === 'cancellation' && (
                <div className="flex flex-col gap-3 animate-fade-in">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
                    <h4 className="font-semibold text-emerald-400 text-sm flex items-center gap-2 mb-1">
                      <i className="fas fa-circle-check" /> 100% Full Refund Window
                    </h4>
                    <p className="text-white/80 text-[11px]">
                      Cancellations made <strong>7 days or more</strong> prior to the official check-in date receive a full 100% refund of the downpayment deposit, processed within 3 to 5 business days via your original payment channel (GCash, Maya, or Bank Transfer).
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3">
                    <h4 className="font-semibold text-amber-300 text-sm flex items-center gap-2 mb-1">
                      <i className="fas fa-clock-rotate-left" /> 50% Refund Window (3 to 6 Days)
                    </h4>
                    <p className="text-white/80 text-[11px]">
                      Cancellations submitted between <strong>3 to 6 days</strong> prior to check-in are eligible for a 50% refund, or you may opt for a <strong>free rebooking</strong> of your stay dates within 6 months.
                    </p>
                  </div>

                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3">
                    <h4 className="font-semibold text-rose-300 text-sm flex items-center gap-2 mb-1">
                      <i className="fas fa-ban" /> Within 72 Hours & No-Show
                    </h4>
                    <p className="text-white/80 text-[11px]">
                      Cancellations within <strong>72 hours of check-in</strong> are non-refundable due to reserved inventory, but date rebooking is allowed subject to room availability and seasonal rate adjustment.
                    </p>
                  </div>

                  <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3">
                    <h4 className="font-semibold text-sky-300 text-sm flex items-center gap-2 mb-1">
                      <i className="fas fa-cloud-bolt" /> Severe Weather & Force Majeure Guarantee
                    </h4>
                    <p className="text-white/80 text-[11px]">
                      If the Philippine Atmospheric, Geophysical and Astronomical Services Administration (PAGASA) raises an official typhoon or storm signal over Pangasinan or local maritime authorities suspend sea travel, guests are entitled to a <strong>100% full refund or free rebooking without penalty</strong>.
                    </p>
                  </div>
                </div>
              )}

              {policyTab === 'checkin' && (
                <div className="flex flex-col gap-3 animate-fade-in">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <h4 className="font-semibold text-white text-sm flex items-center gap-2 mb-1">
                      <i className="fas fa-door-open text-cyan" /> Operating Hours
                    </h4>
                    <ul className="list-disc list-inside text-[11px] text-white/70 space-y-1">
                      <li><strong>Standard Check-In:</strong> 2:00 PM onwards</li>
                      <li><strong>Standard Check-Out:</strong> Strictly 12:00 PM (Noon)</li>
                      <li>Early arrivals may drop luggage with the Front Desk and relax by the beach while rooms are prepared.</li>
                      <li>Late check-outs after 12:00 PM are subject to room availability and half-day rate rules.</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <h4 className="font-semibold text-white text-sm flex items-center gap-2 mb-1">
                      <i className="fas fa-credit-card text-emerald-400" /> Downpayment & Payment Rules
                    </h4>
                    <ul className="list-disc list-inside text-[11px] text-white/70 space-y-1">
                      <li>A <strong>30% downpayment</strong> is required upon reservation to lock your accommodation and generate your official digital voucher pass.</li>
                      <li>Payment options include GCash, Maya, Visa/Mastercard, and BDO/BPI Bank Transfer.</li>
                      <li>The remaining <strong>70% balance</strong> is settled at the Front Desk upon physical arrival.</li>
                    </ul>
                  </div>
                </div>
              )}

              {policyTab === 'rules' && (
                <div className="flex flex-col gap-3 animate-fade-in">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <h4 className="font-semibold text-white text-sm flex items-center gap-2 mb-1">
                      <i className="fas fa-volume-xmark text-cyan" /> Quiet Sanctuary Hours
                    </h4>
                    <p className="text-[11px] text-white/70">
                      To preserve the tranquil ambiance of Patar Beach, quiet hours are observed from <strong>10:00 PM to 7:00 AM</strong>. Loud music, videoke, and excessive noise are prohibited during these hours.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <h4 className="font-semibold text-white text-sm flex items-center gap-2 mb-1">
                      <i className="fas fa-ban-smoking text-rose-400" /> Non-Smoking Policy
                    </h4>
                    <p className="text-[11px] text-white/70">
                      All indoor suites, villas, cottages, and enclosed restrooms are strictly non-smoking. Designated outdoor smoking spaces are provided on resort grounds. A ₱3,000 cleaning fee applies for indoor smoking violations.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <h4 className="font-semibold text-white text-sm flex items-center gap-2 mb-1">
                      <i className="fas fa-water text-cyan" /> Patar Beach Clean Sand Pledge
                    </h4>
                    <p className="text-[11px] text-white/70">
                      Rock View observes a strict "Leave No Trace" policy along the white sand coast. Littering, bringing single-use plastic bottles onto the tidal reef, or disturbing marine life is strictly prohibited.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <h4 className="font-semibold text-white text-sm flex items-center gap-2 mb-1">
                      <i className="fas fa-paw text-amber-400" /> Pet Policy
                    </h4>
                    <p className="text-[11px] text-white/70">
                      Well-behaved small pets on leash are welcome in designated ground-level beach cottages with prior coordination with the concierge. Pets must be supervised at all times.
                    </p>
                  </div>
                </div>
              )}

              {policyTab === 'privacy' && (
                <div className="flex flex-col gap-3 animate-fade-in">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <h4 className="font-semibold text-white text-sm flex items-center gap-2 mb-1">
                      <i className="fas fa-id-card text-emerald-400" /> Tourism Manifest Compliance
                    </h4>
                    <p className="text-[11px] text-white/70">
                      Under local tourism regulations (Municipality of Bolinao) and DOT guidelines, all arriving resident guests must be registered on the official resort manifest. Valid government-issued photo ID is requested at front-desk check-in.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <h4 className="font-semibold text-white text-sm flex items-center gap-2 mb-1">
                      <i className="fas fa-user-shield text-cyan" /> Data Privacy Act (RA 10173)
                    </h4>
                    <p className="text-[11px] text-white/70">
                      Your personal data (Full Name, Philippine Mobile Number, Email Address) is securely handled in compliance with Republic Act No. 10173 (Data Privacy Act of 2012). It is strictly used to process your reservation voucher, send SMS check-in updates, and maintain stay manifests. We never sell or distribute your data.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Action */}
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
              <span className="text-[10px] text-white/50 hidden sm:inline">
                Rock View Beach Resort · Official Guest Agreement
              </span>
              <button
                type="button"
                onClick={() => {
                  setTermsAccepted(true);
                  setShowPolicyModal(false);
                  toast('✦ Terms of Stay and Cancellation Policy accepted.');
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan text-slate-950 font-semibold text-xs tracking-wider uppercase hover:brightness-110 transition cursor-pointer flex items-center justify-center gap-2 shadow-md"
              >
                <i className="fas fa-check" />
                <span>I Understand & Agree</span>
              </button>
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

      
    </>
  );

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
                <i className="fas fa-arrow-left text-sm" aria-hidden="true" />
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

            {isSignup && (
              <div className={`mt-5 rounded-2xl border p-4 transition-all ${
                termsAccepted
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-cyan/30 bg-cyan/[0.04]'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                      termsAccepted ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan/20 text-cyan'
                    }`}>
                      <i className={`fas ${termsAccepted ? 'fa-circle-check' : 'fa-shield-halved'} text-sm`} />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold tracking-wide text-white">
                        Website Terms of Stay & Privacy Policy
                      </h4>
                      <p className="mt-0.5 text-[11px] text-white/60 leading-snug">
                        Required before account entry: RA 10173 compliance, 11-digit mobile verification, and house rules.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowPolicyModal(true)}
                    className="text-xs text-cyan hover:underline font-medium inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fas fa-file-contract text-xs" />
                    <span>Read Full Policy</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTermsAccepted((prev) => {
                        const next = !prev;
                        toast(next ? '✦ Website Terms & Policy accepted.' : 'Policy acceptance revoked.');
                        return next;
                      });
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      termsAccepted
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-cyan text-slate-950 hover:brightness-110 shadow-md active:scale-95'
                    }`}
                  >
                    <i className={`fas ${termsAccepted ? 'fa-check' : 'fa-handshake'}`} />
                    <span>{termsAccepted ? 'Policy Accepted ✓' : 'Accept Policy'}</span>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="mt-6 flex flex-col gap-4">
              {isSignup && (
                <label className="flex flex-col gap-1.5">
                  <span className={LABEL}>Full name *</span>
                  <input
                    required
                    type="text"
                    maxLength={60}
                    autoComplete="name"
                    placeholder="e.g. Maria Santos"
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
                  <div className="flex items-center justify-between">
                    <span className={LABEL}>Mobile Phone (11-Digit PH Format) *</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      authPhone.length === 11 && authPhone.startsWith('09')
                        ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                        : 'bg-white/10 text-white/60'
                    }`}>
                      {authPhone.length}/11 digits
                    </span>
                  </div>
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    pattern="09[0-9]{9}"
                    maxLength={11}
                    autoComplete="tel"
                    placeholder="09XXXXXXXXX"
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    disabled={authBusy}
                    className={`${FIELD} font-mono tracking-wider`}
                  />
                  <span className="text-[11px] leading-tight">
                    {authPhone.length === 11 && authPhone.startsWith('09') ? (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <i className="fas fa-circle-check text-[10px]" /> Valid 11-digit Philippine Mobile Number
                      </span>
                    ) : authPhone.length > 0 && !authPhone.startsWith('09') ? (
                      <span className="text-rose-400 font-medium flex items-center gap-1">
                        <i className="fas fa-triangle-exclamation text-[10px]" /> Philippine mobile numbers must start with 09
                      </span>
                    ) : authPhone.length > 0 ? (
                      <span className="text-cyan font-medium">
                        Enter {11 - authPhone.length} more digit{11 - authPhone.length > 1 ? 's' : ''} to complete 11 digits
                      </span>
                    ) : (
                      <span className="text-white/40">
                        Strict 11-digit mobile requirement (e.g. 09171234567) for official guest manifest
                      </span>
                    )}
                  </span>
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
                  minLength={8}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  disabled={authBusy}
                  className={FIELD}
                />
                {isSignup && (
                  <span className="text-[10px] text-white/50">
                    Must be at least 8 characters with letters & numbers for account security
                  </span>
                )}
              </label>

              {isSignup && (
                <label className="flex items-start gap-2.5 text-xs text-white/75 cursor-pointer mt-1 select-none">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 rounded border-white/30 text-cyan focus:ring-cyan h-4 w-4"
                  />
                  <span className="leading-snug text-[11px]">
                    I have read, understood, and accept the{' '}
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setShowPolicyModal(true); }}
                      className="text-cyan underline hover:text-cyan/80"
                    >
                      Website Terms of Stay & Privacy Policy
                    </button>
                    .
                  </span>
                </label>
              )}

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
                <i className="fab fa-google text-amber-400 text-sm shrink-0" />
                Google
              </button>

              <button
                type="button"
                onClick={handleFacebookAuth}
                disabled={authBusy}
                className="flex items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-xs font-medium text-white transition hover:bg-white/10 active:scale-[.98] disabled:opacity-50 cursor-pointer"
              >
                <i className="fab fa-facebook text-[#1877F2] text-sm shrink-0" />
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
        {renderAuthModals()}
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
                <i className="fas fa-bars text-sm" aria-hidden="true" />
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

        {/* 4. MODULAR BOOKING BAR & AVAILABILITY ENGINE */}
        <ResortSectionBoundary sectionName="Hero Booking & Availability">
          <ResortHeroBooking
            checkIn={checkIn}
            checkOut={checkOut}
            setCheckIn={setCheckIn}
            setCheckOut={setCheckOut}
            checkInTime={checkInTime}
            checkOutTime={checkOutTime}
            setCheckInTime={setCheckInTime}
            setCheckOutTime={setCheckOutTime}
            guests={guests}
            setGuests={setGuests}
            selectedRoom={selectedRoom}
            setSelectedRoom={setSelectedRoom}
            displayRooms={displayRooms}
            bookedRanges={bookedRanges}
            isRoomOccupiedForDates={isRoomOccupiedForDates}
            isRoomOccupiedToday={isRoomOccupiedToday}
            checkAvailability={checkAvailability}
            checkingAvailability={checkingAvailability}
            quote={quote}
            setQuote={setQuote}
            onOpenReservation={openReservation}
            onResetCalendarSelection={handleResetCalendarSelection}
            showHeroCalendar={showHeroCalendar}
            setShowHeroCalendar={setShowHeroCalendar}
            siteBooking={site.booking}
          />
        </ResortSectionBoundary>

        {/* 5. MODULAR ACCOMMODATIONS & 2-HOUR BUFFER RAIL */}
        <ResortSectionBoundary sectionName="Accommodations & Offers Rail">
          <ResortRoomsRail
            rooms={displayRooms}
            checkIn={checkIn}
            checkOut={checkOut}
            checkInTime={checkInTime}
            checkOutTime={checkOutTime}
            isRoomOccupiedForDates={isRoomOccupiedForDates}
            isRoomOccupiedToday={isRoomOccupiedToday}
            onOpenReservation={openReservation}
            onSelectRoom={setSelectedRoom}
            eyebrow={site.rooms.eyebrow}
            title={site.rooms.title}
          />
        </ResortSectionBoundary>

        {/* 7. MODULAR EXPERIENCES */}
        <ResortSectionBoundary sectionName="Curated Experiences">
          <ResortExperiences
            eyebrow={site.experiences.eyebrow}
            title={site.experiences.title}
            tagline={site.brand.tagline}
            items={site.experiences.items}
            offerRooms={displayRooms}
            onSelectRoom={setSelectedRoom}
            onOpenReservation={openReservation}
          />
        </ResortSectionBoundary>

        {/* 8. MODULAR AMENITIES */}
        <ResortSectionBoundary sectionName="Resort Amenities">
          <ResortAmenities
            eyebrow={site.amenities.eyebrow}
            title={site.amenities.title}
            items={site.amenities.items}
          />
        </ResortSectionBoundary>

        {/* 9. GALLERY */}
        <ResortSectionBoundary sectionName="Sanctuary Gallery">
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
                    onError={handleImageError}
                    className="h-full w-full object-cover transition duration-700 hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </section>
        </ResortSectionBoundary>

        {/* 10. MODULAR REVIEWS */}
        <ResortSectionBoundary sectionName="Guest Reviews">
          <ResortReviews
            eyebrow={site.reviews.eyebrow}
            title={site.reviews.title}
            items={site.reviews.items}
          />
        </ResortSectionBoundary>

        {/* 11 & 12. MODULAR LOCATION & FAQ */}
        <ResortSectionBoundary sectionName="Location & Policies FAQ">
          <ResortLocationFaq
            locationEyebrow={site.location.eyebrow}
            locationTitle={site.location.title}
            locationBody={site.location.body}
            locationFacts={site.location.facts}
            locationButton={site.location.button}
            faqEyebrow={site.faq.eyebrow}
            faqTitle={site.faq.title}
            faqItems={site.faq.items}
          />
        </ResortSectionBoundary>

        {/* 14. MODULAR DINING */}
        <ResortSectionBoundary sectionName="Seaside Dining">
          <ResortDining
            eyebrow={site.dining.eyebrow}
            title={site.dining.title}
            body={site.dining.body}
            image={site.dining.image}
            hours={site.dining.hours}
          />
        </ResortSectionBoundary>

        {/* 15. CTA */}
        <ResortSectionBoundary sectionName="Direct Booking Invitation">
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
                <button type="button" onClick={() => scrollTo('booking-section')} className={`${BTN_PRIMARY} mt-8 px-10 py-4 cursor-pointer`}>
                  {site.cta.button}
                </button>
              </div>
            </div>
          </section>
        </ResortSectionBoundary>

        {/* 16. MODULAR BRAND FOOTER */}
        <ResortSectionBoundary sectionName="Resort Brand Footer">
          <ResortFooter
            about={site.footer.about}
            socials={site.footer.socials}
            columns={site.footer.columns}
            newsletter={site.footer.newsletter}
            badges={site.footer.badges}
            payments={site.footer.payments}
            legal={site.footer.legal}
            copyright={site.footer.copyright}
            backToTop={site.footer.backToTop}
            onScrollTo={scrollTo}
            onScrollTop={scrollTop}
          />
        </ResortSectionBoundary>
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
                <i className="fas fa-xmark text-sm" aria-hidden="true" />
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
                <i className="fas fa-xmark" />
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
                <><i className="fas fa-clipboard-list" style={{ marginRight: 6 }} />Manifest</>
              </button>
              <button
                type="button"
                onClick={() => setProfileTab('bookings')}
                className={`flex-1 py-2 px-3 rounded-xl font-medium transition cursor-pointer ${
                  profileTab === 'bookings' ? 'bg-cyan text-navy font-semibold shadow-sm' : 'text-white/60 hover:text-white'
                }`}
              >
                <><i className="fas fa-calendar-alt" style={{ marginRight: 6 }} />My Stays</> {myBookings.length > 0 && `(${myBookings.length})`}
              </button>
              <button
                type="button"
                onClick={() => setProfileTab('contact')}
                className={`flex-1 py-2 px-3 rounded-xl font-medium transition cursor-pointer ${
                  profileTab === 'contact' ? 'bg-cyan text-navy font-semibold shadow-sm' : 'text-white/60 hover:text-white'
                }`}
              >
                <><i className="fas fa-bell-concierge" style={{ marginRight: 6 }} />Services</>
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
                    <div className="flex items-center justify-between gap-1">
                      <span className={LABEL}>Mobile Phone (11-Digit PH Format) *</span>
                      <span
                        className={`text-[10px] font-semibold tracking-wide whitespace-nowrap transition-colors duration-200 ${
                          profPhone.length === 11 && /^09\d{9}$/.test(profPhone)
                            ? 'text-emerald-400'
                            : profPhone.length > 0
                              ? 'text-amber-400'
                              : 'text-white/40'
                        }`}
                      >
                        {profPhone.length === 11 && /^09\d{9}$/.test(profPhone) ? (
                          <><i className="fas fa-circle-check text-[9px] mr-1" />11/11 PH Mobile</>
                        ) : (
                          `${profPhone.length}/11 digits`
                        )}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        required
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        maxLength={11}
                        minLength={11}
                        pattern="^09[0-9]{9}$"
                        title="Must be an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567)"
                        value={profPhone}
                        onChange={(e) => setProfPhone(to11Digits(e.target.value))}
                        placeholder="09171234567"
                        className={`${FIELD} pr-8 ${
                          profPhone.length === 11 && /^09\d{9}$/.test(profPhone)
                            ? '!border-emerald-500/70 focus:!border-emerald-400 !bg-emerald-950/20'
                            : profPhone.length > 0 && (!profPhone.startsWith('09') || profPhone.length < 11)
                              ? '!border-amber-500/70 focus:!border-amber-400 !bg-amber-950/20'
                              : ''
                        }`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs">
                        {profPhone.length === 11 && /^09\d{9}$/.test(profPhone) ? (
                          <i className="fas fa-check text-emerald-400" />
                        ) : profPhone.length > 0 && !profPhone.startsWith('09') ? (
                          <i className="fas fa-triangle-exclamation text-amber-400" />
                        ) : (
                          <span className="text-[10px] font-mono text-white/30">PH</span>
                        )}
                      </div>
                    </div>
                    {profPhone.length > 0 && !profPhone.startsWith('09') ? (
                      <span className="text-[10px] text-amber-300 flex items-center gap-1 mt-0.5">
                        <i className="fas fa-circle-info text-[9px]" />
                        Philippine mobile numbers must start with 09 (e.g. 09171234567)
                      </span>
                    ) : profPhone.length > 0 && profPhone.length < 11 ? (
                      <span className="text-[10px] text-amber-300/80 flex items-center gap-1 mt-0.5">
                        <i className="fas fa-circle-info text-[9px]" />
                        Enter {11 - profPhone.length} more digit{11 - profPhone.length > 1 ? 's' : ''} to reach 11-digit PH mobile ruling
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/40">Used for official booking voucher & front desk SMS updates</span>
                    )}
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
                    <div className="flex items-center justify-between gap-1">
                      <span className={LABEL}>Emergency Contact (11-Digit Mobile)</span>
                      {profEmergency.length > 0 && (
                        <span
                          className={`text-[10px] font-semibold tracking-wide whitespace-nowrap transition-colors duration-200 ${
                            profEmergency.length === 11 && /^09\d{9}$/.test(profEmergency)
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {profEmergency.length === 11 && /^09\d{9}$/.test(profEmergency) ? (
                            <><i className="fas fa-circle-check text-[9px] mr-1" />11/11 PH Mobile</>
                          ) : (
                            `${profEmergency.length}/11 digits`
                          )}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        maxLength={11}
                        pattern="^09[0-9]{9}$"
                        title="Must be an 11-digit Philippine mobile number starting with 09 (e.g. 09181234567)"
                        value={profEmergency}
                        onChange={(e) => setProfEmergency(to11Digits(e.target.value))}
                        placeholder="09181234567"
                        className={`${FIELD} pr-8 ${
                          profEmergency.length === 11 && /^09\d{9}$/.test(profEmergency)
                            ? '!border-emerald-500/70 focus:!border-emerald-400 !bg-emerald-950/20'
                            : profEmergency.length > 0 && (!profEmergency.startsWith('09') || profEmergency.length < 11)
                              ? '!border-amber-500/70 focus:!border-amber-400 !bg-amber-950/20'
                              : ''
                        }`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs">
                        {profEmergency.length === 11 && /^09\d{9}$/.test(profEmergency) ? (
                          <i className="fas fa-check text-emerald-400" />
                        ) : profEmergency.length > 0 && !profEmergency.startsWith('09') ? (
                          <i className="fas fa-triangle-exclamation text-amber-400" />
                        ) : (
                          <span className="text-[10px] font-mono text-white/30">PH</span>
                        )}
                      </div>
                    </div>
                  </label>

                  {confirmDeleteProf ? (
                    <div className="pt-2 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center">
                      <b className="block text-sm text-rose-400 mb-1"><i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} />Permanently Delete Account?</b>
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
                        {profSaving ? 'Saving…' : <><i className="fas fa-floppy-disk" style={{ marginRight: 4 }} />Save</>}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteProf(true)}
                        className="rounded-2xl border border-rose-500/40 bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 py-3 text-center font-semibold text-xs transition cursor-pointer"
                      >
                        <><i className="fas fa-trash-can" style={{ marginRight: 4 }} />Delete</>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfileModalOpen(false)}
                        className={`${BTN_GHOST} py-3 text-center justify-center cursor-pointer text-white/70 hover:text-white text-xs font-semibold`}
                      >
                        <><i className="fas fa-xmark" style={{ marginRight: 4 }} />Cancel</>
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
                      <div className="flex flex-wrap gap-1.5">
                        {([
                          { key: 'all' as const, label: `All (${myBookings.length})` },
                          { key: 'room' as const, label: `Rooms (${myBookings.filter((b) => resolveReservationOfferingType(b) === 'room').length})` },
                          { key: 'cottage' as const, label: `Cottages (${myBookings.filter((b) => resolveReservationOfferingType(b) === 'cottage').length})` },
                        ]).map((tab) => (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => setStayBookingFilter(tab.key)}
                            className={`rounded-full px-3 py-1 text-[10px] font-semibold border transition cursor-pointer ${
                              stayBookingFilter === tab.key
                                ? 'bg-[#006699] text-white border-cyan/50'
                                : 'bg-white/5 text-white/70 border-white/10 hover:text-white'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                      {myBookings
                        .filter((b) => stayBookingFilter === 'all' || resolveReservationOfferingType(b) === stayBookingFilter)
                        .map((b) => (
                        <div key={b.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="inline-block rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan mb-1">
                                {getOfferingLabel(resolveReservationOfferingType(b))}
                              </span>
                              <span className="font-serif text-base font-medium text-white block">
                                {b.rooms?.name || 'Beachfront Room'}
                              </span>
                              <span className="text-[10px] uppercase tracking-wider text-cyan block mt-0.5">
                                Ref: RV-RES-{b.id?.slice(0, 8).toUpperCase()}
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

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedVoucher(normalizeVoucherData(b));
                                setShowVoucherModal(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sky-400/40 bg-sky-950/40 hover:bg-sky-900/60 text-sky-300 text-[11px] font-semibold tracking-wide transition cursor-pointer"
                            >
                              <i className="fas fa-receipt" />
                              <span>View & Save Voucher</span>
                            </button>
                            {['pending', 'confirmed'].includes(b.status) && (
                              <button
                                type="button"
                                onClick={() => handleCancelBooking(b.id)}
                                className="text-[10px] text-rose-300 hover:text-rose-200 underline uppercase tracking-wider cursor-pointer"
                              >
                                Cancel Stay
                              </button>
                            )}
                          </div>
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
                      href="mailto:concierge@rockviewresort.ph"
                      className="flex items-center gap-3 p-3.5 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-cyan/40 transition group"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan/15 text-cyan text-sm">
                        ✉️
                      </span>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-white/50 block">Resort Concierge</span>
                        <span className="text-xs font-semibold text-white group-hover:text-cyan transition truncate block">concierge@rockviewresort.ph</span>
                      </div>
                    </a>
                  </div>

                  {/* Resort Location Note */}
                  <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.02] text-xs text-white/70">
                    <p className="font-semibold text-white flex items-center gap-1.5">
                      <span><i className="fas fa-location-dot" style={{ marginRight: 6 }} />Patar Beach, Bolinao, Pangasinan</span>
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
                <i className="fas fa-xmark" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="mt-3.5 sm:mt-4 overflow-y-auto scrollbar-none pr-0.5 flex-1">
              {resConfirmed ? (
                /* OFFICIAL CONFIRMED VOUCHER */
                <div className="flex flex-col gap-4 animate-fade-in">
                  <LuxuryResortVoucher voucher={normalizeVoucherData(resConfirmed)} />
                  <ReceiptActions
                    voucher={normalizeVoucherData(resConfirmed)}
                    onClose={() => {
                      setReservationModalOpen(false);
                      setResConfirmed(null);
                    }}
                    onViewBookings={() => {
                      setReservationModalOpen(false);
                      setResConfirmed(null);
                      setProfileTab('bookings');
                      setProfileModalOpen(true);
                    }}
                  />
                </div>
              ) : (
                /* RESERVATION CHECKOUT FORM */
                <form onSubmit={handleConfirmReservation} className="flex flex-col gap-3.5 sm:gap-4">
                  {/* Selected Room Card Preview with Interactive Date Adjustment & Calendar */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 flex flex-col gap-3">
                    <div className="flex items-start sm:items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="inline-block rounded-full bg-cyan/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan mb-1">
                          {getOfferingLabel(inferOfferingType(resRoom))}
                        </span>
                        <span className="font-serif text-lg sm:text-xl font-medium text-white block truncate">
                          {resRoom?.name || selectedRoom}
                        </span>
                        <span className="text-[11px] sm:text-xs text-white/60 block mt-0.5">
                          {inferOfferingType(resRoom) === 'offer'
                            ? `Tour Date: ${checkIn} · ${guests}`
                            : `${checkIn} → ${checkOut} (${Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000))} Nights) · ${guests}`}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-serif text-base sm:text-lg text-cyan block font-semibold leading-tight">
                          {(() => {
                            const modalType = inferOfferingType(resRoom);
                            const modalNights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000));
                            const modalTotal = calculateOfferingTotal({
                              rate_php: resRoom?.rate_php || resRoom?.price || 4200,
                              nights: modalNights,
                              guests: parseInt(guests) || 2,
                              offering_type: modalType,
                              specs: resRoom?.specs || {},
                            });
                            return (
                              <>
                                <span>{peso(modalTotal)}</span>
                                <span className="text-[10px] text-white/40 block mt-0.5">
                                  30% DP: {peso(Math.round(modalTotal * 0.3))}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Occupancy Alert Banner if room is reserved for chosen dates */}
                    {isRoomOccupiedForDates(resRoom, checkIn, checkOut) && (
                      <div className="rounded-xl border border-rose-500/50 bg-rose-950/60 p-3 text-xs text-rose-200 flex items-start gap-2.5 animate-fade-in shadow-md">
                        <i className="fas fa-triangle-exclamation text-rose-400 text-sm mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <strong className="block text-rose-300 font-semibold mb-0.5">Villa Occupied for Selected Dates</strong>
                          <p className="text-[11px] leading-relaxed text-rose-200/90">
                            <strong>{resRoom?.name || 'This villa'}</strong> is already reserved for these dates ({checkIn} → {checkOut}). Please pick open dates using the calendar below.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Interactive Date Adjuster Bar - 2 columns with active Selection Target & Direct Pickers */}
                    <div className="pt-2.5 border-t border-white/10 flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2 w-full">
                        <button
                          type="button"
                          onClick={() => {
                            setCalendarTarget('checkIn');
                            setShowModalCalendar(true);
                          }}
                          className={`flex flex-col text-left gap-0.5 min-w-0 p-2.5 rounded-xl border transition cursor-pointer ${
                            showModalCalendar && calendarTarget === 'checkIn'
                              ? 'border-cyan bg-cyan/20 ring-2 ring-cyan/60 shadow-[0_0_15px_rgba(34,195,238,0.3)]'
                              : 'border-white/15 bg-white/5 hover:border-white/30'
                          }`}
                          title="Tap to select check-in date on marked calendar"
                        >
                          <span className="text-[10px] uppercase tracking-wider text-cyan font-bold flex items-center justify-between">
                            Check-In <i className="fas fa-calendar-alt" style={{ marginLeft: 4 }} />
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-white truncate">
                            {checkIn}
                          </span>
                          <span className="text-[9px] text-white/60">
                            {showModalCalendar && calendarTarget === 'checkIn' ? '✦ Picking Check-In below' : 'Tap to select'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCalendarTarget('checkOut');
                            setShowModalCalendar(true);
                          }}
                          className={`flex flex-col text-left gap-0.5 min-w-0 p-2.5 rounded-xl border transition cursor-pointer ${
                            showModalCalendar && calendarTarget === 'checkOut'
                              ? 'border-cyan bg-cyan/20 ring-2 ring-cyan/60 shadow-[0_0_15px_rgba(34,195,238,0.3)]'
                              : 'border-white/15 bg-white/5 hover:border-white/30'
                          }`}
                          title="Tap to select check-out date on marked calendar"
                        >
                          <span className="text-[10px] uppercase tracking-wider text-cyan font-bold flex items-center justify-between">
                            Check-Out <i className="fas fa-calendar-alt" style={{ marginLeft: 4 }} />
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-white truncate">
                            {checkOut}
                          </span>
                          <span className="text-[9px] text-white/60">
                            {showModalCalendar && calendarTarget === 'checkOut' ? '✦ Picking Check-Out below' : 'Tap to select'}
                          </span>
                        </button>
                      </div>

                      {/* Direct HTML5 Date Pickers */}
                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        <label className="flex flex-col gap-1 min-w-0">
                          <span className="text-[10px] uppercase tracking-wider text-white/60 font-medium">
                            {inferOfferingType(resRoom) === 'offer' ? 'Tour Date *' : 'Check-In Date *'}
                          </span>
                          <input
                            type="date"
                            min={minCheckInDate}
                            value={checkIn}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) return;
                              setCheckIn(val);
                              if (inferOfferingType(resRoom) === 'offer' || val >= checkOut) {
                                setCheckOut(addDaysISO(val, 1));
                              }
                            }}
                            className="w-full rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan [color-scheme:dark]"
                          />
                        </label>

                        <label className="flex flex-col gap-1 min-w-0">
                          <span className="text-[10px] uppercase tracking-wider text-white/60 font-medium">Check-Out Date *</span>
                          <input
                            type="date"
                            min={new Date(new Date(checkIn).getTime() + 86400000).toISOString().slice(0, 10)}
                            value={checkOut}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) return;
                              if (val <= checkIn) {
                                toast('Check-out must be after check-in date.', true);
                                return;
                              }
                              setCheckOut(val);
                            }}
                            className="w-full rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan [color-scheme:dark]"
                          />
                        </label>
                      </div>

                      {/* Specific Check-In & Check-Out Time Pickers (with 2-Hour Gap Enforcement) */}
                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        <label className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-white/60 font-medium">Check-In Time</span>
                            <span className="text-[9px] text-cyan font-mono">{checkInTime}</span>
                          </div>
                          <select
                            value={checkInTime}
                            onChange={(e) => setCheckInTime(e.target.value)}
                            className="w-full rounded-xl border border-white/15 bg-[#0B1528] px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan"
                          >
                            <option value="08:00">08:00 AM (Early Day)</option>
                            <option value="09:00">09:00 AM</option>
                            <option value="10:00">10:00 AM</option>
                            <option value="11:00">11:00 AM</option>
                            <option value="12:00">12:00 PM (Noon)</option>
                            <option value="13:00">01:00 PM</option>
                            <option value="14:00">02:00 PM (Standard Check-in)</option>
                            <option value="15:00">03:00 PM</option>
                            <option value="16:00">04:00 PM</option>
                            <option value="17:00">05:00 PM</option>
                            <option value="18:00">06:00 PM (Sunset / Evening)</option>
                            <option value="19:00">07:00 PM</option>
                            <option value="20:00">08:00 PM</option>
                          </select>
                        </label>

                        <label className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-white/60 font-medium">Check-Out Time</span>
                            <span className="text-[9px] text-cyan font-mono">{checkOutTime}</span>
                          </div>
                          <select
                            value={checkOutTime}
                            onChange={(e) => setCheckOutTime(e.target.value)}
                            className="w-full rounded-xl border border-white/15 bg-[#0B1528] px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan"
                          >
                            <option value="08:00">08:00 AM (Early Departure)</option>
                            <option value="09:00">09:00 AM</option>
                            <option value="10:00">10:00 AM</option>
                            <option value="11:00">11:00 AM</option>
                            <option value="12:00">12:00 PM (Standard Check-out)</option>
                            <option value="13:00">01:00 PM</option>
                            <option value="14:00">02:00 PM (Extended Stay)</option>
                            <option value="15:00">03:00 PM</option>
                            <option value="16:00">04:00 PM</option>
                            <option value="17:00">05:00 PM (Day Tour End)</option>
                          </select>
                        </label>
                      </div>

                      {/* Quick Duration Preset Pills & Reset Button */}
                      <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto scrollbar-none">
                        <span className="text-[10px] text-white/40 shrink-0 font-medium">Nights:</span>
                        {[1, 2, 3, 4, 5, 7].map((numNights) => {
                          const currentNights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
                          const isActive = currentNights === numNights;
                          return (
                            <button
                              key={numNights}
                              type="button"
                              onClick={() => {
                                const inTime = new Date(checkIn).getTime();
                                const newOut = new Date(inTime + numNights * 86400000).toISOString().slice(0, 10);
                                setCheckOut(newOut);
                                toast(`✦ Stay duration set to ${numNights} night${numNights > 1 ? 's' : ''} (${checkIn} → ${newOut})`);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                                isActive
                                  ? 'bg-cyan text-navy font-bold shadow-sm'
                                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10'
                              }`}
                            >
                              {numNights} Night${numNights > 1 ? 's' : ''}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={handleResetCalendarSelection}
                          className="ml-auto px-2.5 py-1 rounded-lg text-[10px] font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition cursor-pointer flex items-center gap-1 shrink-0"
                          title="Reset stay selection and dates to default"
                        >
                          <i className="fas fa-rotate-left text-[9px] text-cyan" />
                          <span>Reset</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowModalCalendar((prev) => !prev)}
                        className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold tracking-wide transition cursor-pointer flex items-center justify-center gap-1.5 mt-0.5 ${
                          showModalCalendar
                            ? 'border-cyan/50 bg-cyan text-navy shadow-sm'
                            : 'border-cyan/40 bg-cyan/15 text-cyan hover:bg-cyan hover:text-navy'
                        }`}
                      >
                        <i className="fas fa-calendar-alt" style={{ marginRight: 6 }} />
                        {showModalCalendar ? 'Hide Marked Calendar' : 'View Marked Calendar (Interactive Visual Grid)'}
                      </button>
                    </div>

                    {/* Visual Availability Calendar with Reserved / Available Markings & Target Selection */}
                    {showModalCalendar && (
                      <div className="mt-2 animate-fade-in overflow-hidden">
                        <div className="mb-2 flex items-center justify-between px-1 text-xs font-medium text-cyan">
                          <div className="flex items-center gap-2">
                            <i className="fas fa-calendar-alt text-cyan/80" />
                            <span>
                              Selecting: <strong className="text-white font-semibold underline underline-offset-4 tracking-wide">{calendarTarget === 'checkIn' ? 'Check-In Date' : 'Check-Out Date'}</strong>
                            </span>
                          </div>
                          <span className="text-[11px] text-white/50 font-normal">
                            Tap to select · Tap again to unselect
                          </span>
                        </div>
                        <AvailabilityCalendar
                          selectedRoomId={resRoom?.id}
                          rooms={displayRooms}
                          bookings={bookedRanges}
                          initialCheckIn={checkIn}
                          initialCheckOut={checkOut}
                          selectionTarget={calendarTarget}
                          isLightMode={false}
                          onReset={handleResetCalendarSelection}
                          onSelectDates={(newIn, newOut) => {
                            if (!newIn && !newOut) {
                              handleResetCalendarSelection();
                              return;
                            }
                            if (newIn && !newOut) {
                              setCheckIn(newIn);
                              setCheckOut('');
                              setCalendarTarget('checkOut');
                              return;
                            }
                            setCheckIn(newIn);
                            setCheckOut(newOut);
                            if (calendarTarget === 'checkIn') {
                              setCalendarTarget('checkOut');
                              toast(`✦ Check-in set to ${newIn}. Now tap your check-out date on the calendar (or tap ${newIn} to unselect).`);
                            } else {
                              const nights = Math.max(1, Math.round((new Date(newOut).getTime() - new Date(newIn).getTime()) / 86400000));
                              toast(`✦ Stay updated: ${newIn} → ${newOut} (${nights} Night${nights > 1 ? 's' : ''})`);
                            }
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
                    <div className="flex items-center justify-between gap-1">
                      <span className={LABEL}>Guest Name for Manifest *</span>
                      {resName.trim().length >= 2 ? (
                        <span className="text-[10px] font-semibold text-emerald-400">
                          <i className="fas fa-circle-check text-[9px] mr-1" />Verified Name
                        </span>
                      ) : resName.trim().length > 0 ? (
                        <span className="text-[10px] text-amber-400">Min 2 characters</span>
                      ) : (
                        <span className="text-[10px] text-rose-400 font-medium">Required</span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        required
                        type="text"
                        minLength={2}
                        value={resName}
                        onChange={(e) => setResName(e.target.value)}
                        placeholder="Full Name (e.g. Juan Dela Cruz)"
                        className={`${FIELD} pr-8 ${
                          resName.trim().length >= 2
                            ? '!border-emerald-500/70 focus:!border-emerald-400 !bg-emerald-950/20'
                            : resName.trim().length > 0
                              ? '!border-amber-500/70 focus:!border-amber-400 !bg-amber-950/20'
                              : ''
                        }`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs">
                        {resName.trim().length >= 2 ? (
                          <i className="fas fa-check text-emerald-400" />
                        ) : null}
                      </div>
                    </div>
                  </label>

                  {/* Mobile & Email - Stacks smoothly on phone without squishing */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={LABEL}>Mobile Phone (11 Digits) *</span>
                        <span
                          className={`text-[10px] font-semibold tracking-wide whitespace-nowrap transition-colors duration-200 ${
                            resPhone.length === 11 && /^09\d{9}$/.test(resPhone)
                              ? 'text-emerald-400'
                              : resPhone.length > 0
                                ? 'text-amber-400'
                                : 'text-white/40'
                          }`}
                        >
                          {resPhone.length === 11 && /^09\d{9}$/.test(resPhone) ? (
                            <><i className="fas fa-circle-check text-[9px] mr-1" />11/11 PH Mobile</>
                          ) : (
                            `${resPhone.length}/11 digits`
                          )}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          required
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel"
                          maxLength={11}
                          minLength={11}
                          pattern="^09[0-9]{9}$"
                          title="Must be strictly an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567)"
                          value={resPhone}
                          onChange={(e) => setResPhone(to11Digits(e.target.value))}
                          placeholder="09171234567"
                          className={`${FIELD} pr-8 ${
                            resPhone.length === 11 && /^09\d{9}$/.test(resPhone)
                              ? '!border-emerald-500/70 focus:!border-emerald-400 !bg-emerald-950/20'
                              : resPhone.length > 0 && (!resPhone.startsWith('09') || resPhone.length < 11)
                                ? '!border-amber-500/70 focus:!border-amber-400 !bg-amber-950/20'
                                : ''
                          }`}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs">
                          {resPhone.length === 11 && /^09\d{9}$/.test(resPhone) ? (
                            <i className="fas fa-check text-emerald-400" />
                          ) : resPhone.length > 0 && !resPhone.startsWith('09') ? (
                            <i className="fas fa-triangle-exclamation text-amber-400" />
                          ) : (
                            <span className="text-[10px] font-mono text-white/30">PH</span>
                          )}
                        </div>
                      </div>
                      {resPhone.length > 0 && !resPhone.startsWith('09') ? (
                        <span className="text-[10px] text-amber-300 flex items-center gap-1 mt-0.5 animate-fade-in">
                          <i className="fas fa-circle-info text-[9px]" />
                          Philippine mobile numbers must start with 09 (e.g. 09171234567)
                        </span>
                      ) : resPhone.length > 0 && resPhone.length < 11 ? (
                        <span className="text-[10px] text-amber-300/80 flex items-center gap-1 mt-0.5 animate-fade-in">
                          <i className="fas fa-circle-info text-[9px]" />
                          Enter {11 - resPhone.length} more digit{11 - resPhone.length > 1 ? 's' : ''} to reach 11-digit PH mobile ruling
                        </span>
                      ) : resPhone.length === 11 && /^09\d{9}$/.test(resPhone) ? (
                        <span className="text-[10px] text-emerald-400/90 flex items-center gap-1 mt-0.5 animate-fade-in">
                          <i className="fas fa-circle-check text-[9px]" />
                          Valid Philippine mobile — ready for SMS voucher updates
                        </span>
                      ) : null}
                    </label>
                    <label className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={LABEL}>Email Address *</span>
                        {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resEmail) ? (
                          <span className="text-[10px] font-semibold text-emerald-400">
                            <i className="fas fa-circle-check text-[9px] mr-1" />Voucher Target
                          </span>
                        ) : resEmail.length > 0 ? (
                          <span className="text-[10px] text-amber-400">Invalid email</span>
                        ) : (
                          <span className="text-[10px] text-rose-400 font-medium">Required</span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          required
                          type="email"
                          value={resEmail}
                          onChange={(e) => setResEmail(e.target.value)}
                          placeholder="name@email.com"
                          className={`${FIELD} pr-8 ${
                            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resEmail)
                              ? '!border-emerald-500/70 focus:!border-emerald-400 !bg-emerald-950/20'
                              : resEmail.length > 0
                                ? '!border-amber-500/70 focus:!border-amber-400 !bg-amber-950/20'
                                : ''
                          }`}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs">
                          {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resEmail) ? (
                            <i className="fas fa-check text-emerald-400" />
                          ) : null}
                        </div>
                      </div>
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

                  {/* Resort Terms & Policy Accordion / Quick Highlights */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-3.5 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan flex items-center gap-1.5">
                        <i className="fas fa-shield-halved text-xs text-cyan" />
                        Resort Terms & Booking Policy
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPolicyModal(true)}
                        className="text-[10px] text-cyan hover:underline font-medium cursor-pointer inline-flex items-center gap-1"
                      >
                        Read Full Policy <i className="fas fa-arrow-up-right-from-square text-[8px]" />
                      </button>
                    </div>

                    {/* Quick Policy Highlights Badges */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-emerald-300 flex flex-col gap-0.5">
                        <span className="font-semibold flex items-center gap-1">
                          <i className="fas fa-check-circle text-[9px]" /> 100% Free Refund
                        </span>
                        <span className="text-emerald-300/70 text-[9px] leading-tight">
                          Cancel 7+ days before check-in for full downpayment refund
                        </span>
                      </div>
                      <div className="rounded-lg bg-cyan/10 border border-cyan/20 p-2 text-cyan flex flex-col gap-0.5">
                        <span className="font-semibold flex items-center gap-1">
                          <i className="fas fa-clock text-[9px]" /> Check-In: 2 PM · Out: 12 PM
                        </span>
                        <span className="text-cyan/70 text-[9px] leading-tight">
                          Standard stay times; free luggage drop-off anytime
                        </span>
                      </div>
                      <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-white/80 flex flex-col gap-0.5">
                        <span className="font-semibold flex items-center gap-1 text-white">
                          <i className="fas fa-umbrella-beach text-[9px] text-amber-400" /> Eco & House Rules
                        </span>
                        <span className="text-white/50 text-[9px] leading-tight">
                          10 PM quiet hours · Non-smoking rooms · Patar Clean Sand Pledge
                        </span>
                      </div>
                      <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-white/80 flex flex-col gap-0.5">
                        <span className="font-semibold flex items-center gap-1 text-white">
                          <i className="fas fa-cloud-bolt text-[9px] text-sky-400" /> Storm Protection
                        </span>
                        <span className="text-white/50 text-[9px] leading-tight">
                          100% refund or free date move if PAGASA storm signal raised
                        </span>
                      </div>
                    </div>

                    {/* Agreement Checkbox */}
                    <label
                      className={`flex items-start gap-2.5 cursor-pointer select-none text-left rounded-xl border p-2.5 transition mt-0.5 ${
                        termsAccepted
                          ? 'border-emerald-500/40 bg-emerald-950/20'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/10 text-cyan focus:ring-cyan focus:ring-offset-0 cursor-pointer accent-cyan shrink-0"
                      />
                      <div className="text-[11px] text-white/80 leading-snug">
                        <span>I have read and agree to the </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowPolicyModal(true);
                          }}
                          className="font-semibold text-cyan hover:underline cursor-pointer inline-flex items-center gap-0.5"
                        >
                          Resort Terms of Stay, Cancellation & Refund Policy
                        </button>
                        <span> and agree to register for the official guest manifest.</span>
                      </div>
                    </label>
                  </div>

                  <div className="pt-1.5">
                    {isRoomOccupiedForDates(resRoom, checkIn, checkOut, checkInTime, checkOutTime) ? (
                      <button
                        type="button"
                        onClick={() => setShowModalCalendar(true)}
                        className="w-full py-3.5 sm:py-4 rounded-xl border border-rose-500/50 bg-rose-950/70 text-rose-200 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer hover:bg-rose-950/90 transition shadow-lg"
                      >
                        <i className="fas fa-clock text-rose-400" />
                        <span>Time Slot Reserved (2-Hour Gap Required) — Pick Other Time</span>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={resSubmitting}
                        className={`${BTN_PRIMARY} w-full py-3.5 sm:py-4 text-xs font-semibold uppercase tracking-[0.18em] cursor-pointer`}
                      >
                        {resSubmitting ? 'Confirming Reservation…' : 'Confirm Stay & Generate Voucher ✦'}
                      </button>
                    )}
                    <p className="mt-1.5 text-center text-[10px] text-white/40">
                      100% refund up to 7 days before check-in · Direct booking guarantee · Official digital voucher
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

            {renderAuthModals()}

      {/* 11. STANDALONE LUXURY VOUCHER & FOLIO MODAL */}
      <VoucherModal
        voucher={selectedVoucher}
        isOpen={showVoucherModal}
        onClose={() => {
          setShowVoucherModal(false);
          setSelectedVoucher(null);
        }}
      />
    </div>
  );
}

// ==========================================================================
// SHARED SECTIONS
// ==========================================================================
function StatRow() {
  return null;
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
