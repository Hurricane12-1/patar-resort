import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { usePageSettings, savePageSettings } from '../lib/pageSettings';
import { isValidPHMobile, to11Digits } from '../lib/format';
import { getManilaTodayISO, inferOfferingType, type OfferingType } from '../lib/offeringSpecs';
import { VoucherBarcode } from './receipt/VoucherBarcode';
import { toast } from './Toasts';
import {
  FALLBACK_ROOMS,
  computeStayPrice,
  fetchBookableRooms,
  isRoomFree,
  rangesOverlap,
  rankRoomsForParty,
  type ReservationWindow,
  type Room,
  type RoomFit,
} from '../lib/guestRooms';
import {
  CLIENT_DIRECT_ACCESS,
  PREVIEW_SCOPE,
  RESORT_CONTACT,
  accountScopeFor,
  loadGuestAccount,
  makeArrivalPin,
  makeBookingReference,
  paymentDbLabel,
  paymentDisplay,
  rememberBookingGuest,
  type GuestBooking,
  type GuestPaymentMethod,
} from '../lib/guestPortal';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================
export type { Room } from '../lib/guestRooms';

interface YearMonth {
  y: number;
  m: number; // 1-12
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const HERO_SLIDES = [
  {
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80',
    kicker: 'ROCK VIEW · BEACH RESORT',
    headline: 'Where days slow to the tide.',
    subcopy: "Barefoot luxury on Patar's quietest sand. Ten minutes from the Cape Bolinao lighthouse.",
    badge: 'Cape Bolinao Lighthouse Vista'
  },
  {
    image: '/images/rockview/20_resort_coastal_viewpoint.jpg',
    kicker: 'Patar Coastal Road · Bolinao, Pangasinan',
    headline: 'Where Limestone Cliffs Meet the Sea',
    subcopy: 'Private oceanfront villas perched above Bolinao’s sculpted coral coves—combining coastal sanctuary serenity with instant direct booking.',
    badge: 'Limestone Oceanfront'
  },
  {
    image: '/images/rockview/19_beachfront_sunbed_view.jpg',
    kicker: 'Patar Tidal Shore · Private Coral Steps',
    headline: 'Turquoise Coves Above Golden Reefs',
    subcopy: 'Dip into crystal waters overlooking Patar’s iconic tides. Unhurried afternoons, salted sea breezes, and direct stairway access to the cove.',
    badge: 'Patar Natural Tidal Pools'
  },
  {
    image: '/images/rockview/02_ocean_rock_formation_cliff.jpg',
    kicker: 'Natural Limestone Sculptures · Patar Shoreline',
    headline: 'Ancient Coral Arches Carved by Living Tides',
    subcopy: 'Experience Bolinao’s legendary rock formations right at your doorstep, where golden sunsets reflect on calm tidal pools.',
    badge: 'Patar Rock Formations'
  },
  {
    image: '/images/rockview/01_aerial_resort_pool_building.jpg',
    kicker: 'Historic Cape Bolinao · Emerald Bluffs',
    headline: 'A Restorative Haven Built for Stillness',
    subcopy: 'Breathe in the freshest sea breeze and unwind in unhurried silence, 50 steps from the sand and under a canopy of starlight.',
    badge: 'Emerald Cove Horizon'
  }
];

// Infants (under 2) stay free and never count toward room capacity.
const MAX_INFANTS = 4;

const FIT_TONE: Record<RoomFit, string> = {
  best: 'text-emerald-700',
  fits: 'text-[#6A6A6A]',
  booked: 'text-rose-700',
  'too-small': 'text-amber-700',
};

function fitLabel(fit: RoomFit, capacity: number, partySize: number, compact = false): string {
  if (fit === 'best') return 'Best match';
  if (fit === 'fits') return compact ? `Up to ${capacity}` : 'Available';
  if (fit === 'booked') return compact ? 'Booked' : 'Booked on your dates';
  if (capacity <= 0) return 'Capacity not set';
  return compact ? `Up to ${capacity}` : `Too small for ${partySize}`;
}

// =============================================================================
// DATE HELPERS
// =============================================================================
function parseLocal(isoStr: string): Date {
  if (!isoStr) return new Date();
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function fmtISO(y: number, m: number, d: number): string {
  return `${String(y)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function dateToISO(dt: Date): string {
  return fmtISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

function addDaysISO(isoStr: string, deltaDays: number): string {
  const dt = parseLocal(isoStr);
  dt.setDate(dt.getDate() + deltaDays);
  return dateToISO(dt);
}

function diffNights(startIso: string | null, endIso: string | null): number {
  if (!startIso || !endIso) return 0;
  const d1 = parseLocal(startIso);
  const d2 = parseLocal(endIso);
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 86400000));
}

function formatSlash(isoStr: string | null): string {
  if (!isoStr) return 'N/A';
  const [y, m, d] = isoStr.split('-').map(Number);
  return `${m}/${d}/${y}`;
}

function formatShortDate(isoStr: string | null): string {
  if (!isoStr) return 'N/A';
  const [, m, d] = isoStr.split('-').map(Number);
  return `${SHORT_MONTH_NAMES[m]} ${d}`;
}

function formatFullDate(isoStr: string | null): string {
  if (!isoStr) return 'N/A';
  const [y, m, d] = isoStr.split('-').map(Number);
  return `${SHORT_MONTH_NAMES[m]} ${d}, ${y}`;
}

function isWeekendNight(isoStr: string): boolean {
  const dow = parseLocal(isoStr).getDay(); // 5 = Fri, 6 = Sat
  return dow === 5 || dow === 6;
}

function formatPHP(amount: number): string {
  return '₱' + Math.round(amount || 0).toLocaleString('en-US');
}

function formatCompactRate(amount: number): string {
  const k = (amount || 0) / 1000;
  return '₱' + (Number.isInteger(k) ? k : k.toFixed(1)) + 'k';
}

function shiftYM(ym: YearMonth, delta: number): YearMonth {
  const total = ym.y * 12 + (ym.m - 1) + delta;
  return { y: Math.floor(total / 12), m: (total % 12) + 1 };
}

function fmtYM(ym: YearMonth): string {
  return `${ym.y}-${String(ym.m).padStart(2, '0')}`;
}

const EMPTY_ROOM: Room = {
  id: '',
  name: '',
  category: '',
  offering_type: 'room',
  rate_php: 0,
  capacity: 0,
  beds_count: 0,
  baths_count: 0,
  description: '',
  amenities: [],
  image_url: '',
  images: [],
};

// =============================================================================
// MAIN COMPONENT: MobileResortApp (Luxury Coastal Format in React TSX)
// =============================================================================
export default function MobileResortApp({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    customerSession,
    customerProfile,
    setAuthOpen,
    adminSession,
    adminProfile,
    isAdminAuthenticated,
    staffSession,
    staffProfile,
    isStaffAuthenticated,
  } = useAuth();
  const signedInGuest = Boolean(customerSession && customerProfile);
  // Booking tools (calendar & reservation sidebar) are visible when logged in or inside the guest portal
  const showBookingTools = Boolean(signedInGuest || embedded);

  const isStaffOrAdmin = Boolean(
    isAdminAuthenticated ||
    isStaffAuthenticated ||
    (adminProfile && ['administrator', 'admin', 'staff', 'superadmin'].includes(adminProfile.role)) ||
    (staffProfile && ['staff', 'receptionist', 'accounting', 'housekeeping', 'operations'].includes(staffProfile.role)) ||
    (typeof window !== 'undefined' && (sessionStorage.getItem('jd_admin_session') || sessionStorage.getItem('jd_staff_session')))
  );

  // Application Data States (Live Supabase)
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  // Visual multi-select: rooms the guest has toggled on. Booking uses selectedRoomIds[0] as the primary room.
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [activeLodgingCategory, setActiveLodgingCategory] = useState<'room' | 'cottage'>('room');
  const [reservations, setReservations] = useState<ReservationWindow[]>([]);
  const [dbStatus, setDbStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');
  const [dbStatusMessage, setDbStatusMessage] = useState<string>('Connecting…');

  // Active Hero Slide
  const [heroSlide, setHeroSlide] = useState<number>(0);
  // Admin-managed hero image & titles (Page Adjustment).
  const pageMedia = usePageSettings();
  const heroImageUrl = pageMedia.heroImageUrl || '/images/cliffside_hero_generated.jpg';

  // Auto-scroll / advance hero background images every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Scroll listener for seamless transparent-to-sticky navbar transition
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-rotate primary room bento photo
  const [bentoPhotoIdx, setBentoPhotoIdx] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setBentoPhotoIdx((prev) => (prev + 1) % 5);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Horizontal rooms showcase ref & auto-scroll
  const roomScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = roomScrollRef.current;
    if (!el) return;
    let isHovered = false;
    const onEnter = () => { isHovered = true; };
    const onLeave = () => { isHovered = false; };
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('touchstart', onEnter, { passive: true });
    el.addEventListener('touchend', onLeave);

    const interval = setInterval(() => {
      if (isHovered || !el) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 15) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: 320, behavior: 'smooth' });
      }
    }, 4000);

    return () => {
      clearInterval(interval);
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('touchstart', onEnter);
      el.removeEventListener('touchend', onLeave);
    };
  }, []);

  // FAQ Accordion State (from old site)
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Upfront Hero & Title Editor State (Admin / Staff)
  const [showHeroQuickEdit, setShowHeroQuickEdit] = useState<boolean>(false);
  const [quickHeadline, setQuickHeadline] = useState<string>('');
  const [quickSubtitle, setQuickSubtitle] = useState<string>('');
  const [quickKicker, setQuickKicker] = useState<string>('');
  const [quickHeroUrl, setQuickHeroUrl] = useState<string>('');
  const [quickSaving, setQuickSaving] = useState<boolean>(false);
  const [quickUploading, setQuickUploading] = useState<boolean>(false);
  const quickFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (showHeroQuickEdit) {
      setQuickHeadline(pageMedia.heroHeadline || '');
      setQuickSubtitle(pageMedia.heroSubtitle || '');
      setQuickKicker(pageMedia.heroKicker || '');
      setQuickHeroUrl(pageMedia.heroImageUrl || '');
    }
  }, [showHeroQuickEdit, pageMedia]);

  const handleSaveHeroUpfront = async () => {
    try {
      setQuickSaving(true);
      await savePageSettings({
        heroHeadline: quickHeadline.trim(),
        heroSubtitle: quickSubtitle.trim(),
        heroKicker: quickKicker.trim(),
        heroImageUrl: quickHeroUrl.trim(),
      });
      setShowHeroQuickEdit(false);
      toast('✓ Hero title & imagery updated upfront!');
    } catch (err: any) {
      toast(err?.message || 'Failed to update hero upfront', true);
    } finally {
      setQuickSaving(false);
    }
  };

  const handleResetHeroUpfront = async () => {
    try {
      setQuickSaving(true);
      await savePageSettings({
        heroHeadline: '',
        heroSubtitle: '',
        heroKicker: '',
        heroImageUrl: '',
      });
      setQuickHeadline('');
      setQuickSubtitle('');
      setQuickKicker('');
      setQuickHeroUrl('');
      setShowHeroQuickEdit(false);
      toast('Hero reset to default artwork and resort headlines.');
    } catch (err: any) {
      toast(err?.message || 'Failed to reset hero', true);
    } finally {
      setQuickSaving(false);
    }
  };

  const handleQuickImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (quickFileRef.current) quickFileRef.current.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      toast('Only JPG, PNG, WEBP or GIF images are allowed.', true);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast('Image exceeds 8MB limit.', true);
      return;
    }
    try {
      setQuickUploading(true);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read image'));
        reader.readAsDataURL(file);
      });
      const result: any = await api.uploadImage(dataUrl, file.name);
      const url = result?.url || dataUrl;
      setQuickHeroUrl(url);
      toast('Image uploaded. Click "Save & Publish Upfront" to apply.');
    } catch (err: any) {
      toast(err?.message || 'Image upload failed.', true);
    } finally {
      setQuickUploading(false);
    }
  };

  // Booking Dates & Selection (Defaults to N/A until selected)
  const [inlineYM, setInlineYM] = useState<YearMonth>({ y: 2026, m: 11 }); // Shangri-La dual view: Nov 2026
  const [popoverYM, setPopoverYM] = useState<YearMonth>({ y: 2026, m: 11 });
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<'checkin' | 'checkout'>('checkin');
  const [cardDrawer, setCardDrawer] = useState<'none' | 'calendar' | 'guests' | 'room'>('none');
  const [drawerCategory, setDrawerCategory] = useState<'all' | 'room' | 'cottage'>('all');

  // Close card drawer when clicking outside the reservation card
  useEffect(() => {
    if (cardDrawer === 'none') return;
    const handleClickOutside = (e: MouseEvent) => {
      const card = document.getElementById('reserve-card');
      if (card && !card.contains(e.target as Node)) {
        setCardDrawer('none');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [cardDrawer]);
  const [guests, setGuests] = useState({ adults: 2, children: 0, infants: 0 });
  // Auto-match assigns the best-fitting free room; picking a room yourself switches to manual.
  const [roomMode, setRoomMode] = useState<'auto' | 'manual'>('manual');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Modals
  const [showPhotoTour, setShowPhotoTour] = useState<boolean>(false);
  const [tourIndex, setTourIndex] = useState<number>(0);
  const [showReserveModal, setShowReserveModal] = useState<boolean>(false);
  const [reserveStep, setReserveStep] = useState<'form' | 'review' | 'success'>('form');
  const [reserveSubmitting, setReserveSubmitting] = useState<boolean>(false);
  const [calendarNotice, setCalendarNotice] = useState<string | null>(null);
  const [conflictToast, setConflictToast] = useState<{
    title: string;
    message: string;
    subtext?: string;
    roomName?: string;
    datesText?: string;
    breakdown?: Array<{ roomName: string; datesText: string }>;
    altRoom?: Room | null;
  } | null>(null);

  // Guest Reservation Form
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestRequests, setGuestRequests] = useState('');
  const [paymentChoice, setPaymentChoice] = useState('front-desk');
  const [savedPayments, setSavedPayments] = useState<GuestPaymentMethod[]>([]);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [savedBooking, setSavedBooking] = useState<GuestBooking | null>(null);
  const [bookingRef, setBookingRef] = useState('RV-BOL-2027-0000');
  const [smartPin, setSmartPin] = useState('#0000');

  // Segmented accommodations by category: Room vs Cottage
  const roomAccommodations = useMemo(
    () => rooms.filter((r) => inferOfferingType(r) === 'room'),
    [rooms]
  );
  const cottageAccommodations = useMemo(
    () => rooms.filter((r) => inferOfferingType(r) === 'cottage'),
    [rooms]
  );
  const displayedAccommodations = useMemo(() => {
    const list = activeLodgingCategory === 'cottage' ? cottageAccommodations : roomAccommodations;
    return list.length > 0 ? list : rooms;
  }, [activeLodgingCategory, roomAccommodations, cottageAccommodations, rooms]);

  // Active Selected Room Object
  const selectedRoom = useMemo(() => {
    if (selectedRoomId) {
      const match = rooms.find((r) => r.id === selectedRoomId);
      if (match) return match;
    }
    const inCategory = activeLodgingCategory === 'cottage' ? cottageAccommodations : roomAccommodations;
    return inCategory[0] || rooms[0] || EMPTY_ROOM;
  }, [rooms, selectedRoomId, activeLodgingCategory, cottageAccommodations, roomAccommodations]);

  // Synchronize category with currently active room IF explicitly chosen
  useEffect(() => {
    if (selectedRoomId) {
      const chosen = rooms.find((r) => r.id === selectedRoomId);
      if (chosen) {
        const type = inferOfferingType(chosen);
        setActiveLodgingCategory(type === 'cottage' ? 'cottage' : 'room');
      }
    }
  }, [selectedRoomId, rooms]);

  // Capacity counts adults and children only.
  const partySize = guests.adults + guests.children;

  // Earliest selectable check-in: today in Manila (the reservation API rejects past dates).
  const todayISO = useMemo(() => getManilaTodayISO(), []);

  // ---------------------------------------------------------------------------
  // 1. SUPABASE DATA FETCH & REALTIME SUBSCRIPTIONS
  // ---------------------------------------------------------------------------
  // Tracks bookings just completed in the current user session so they are
  // immediately recognized as `is_own: true` and never trigger a self-conflict warning.
  const justBookedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!signedInGuest) {
      justBookedRef.current.clear();
    }
  }, [signedInGuest, customerProfile?.id]);

  const fetchLiveReservations = useCallback(async () => {
    // Availability reflects every guest's bookings without leaking PII.
    // Simultaneously check the signed-in user's own reservations so their own
    // booked dates render as a normal white-highlighted "BOOKED" cell, while
    // other users see those dates as red "BOOKED".
    const ownIds = new Set<string>(justBookedRef.current);
    const ownKeys = new Set<string>(justBookedRef.current);
    const ownWindows: ReservationWindow[] = [];

    if (signedInGuest) {
      try {
        const mine = await api.myReservations();
        if (Array.isArray(mine)) {
          for (const m of mine) {
            if (!m || m.status === 'cancelled') continue;
            const idStr = String(m.id || '');
            const rId = String(m.room_id || '');
            const cIn = String(m.check_in || '').slice(0, 10);
            const cOut = String(m.check_out || '').slice(0, 10);
            if (idStr) ownIds.add(idStr);
            if (rId && cIn && cOut) {
              ownKeys.add(`${rId}:${cIn}:${cOut}`);
              ownWindows.push({
                id: idStr || `own-${rId}-${cIn}`,
                room_id: rId,
                check_in: cIn,
                check_out: cOut,
                status: m.status || 'confirmed',
                is_own: true,
              });
            }
          }
        }
      } catch {}
    }

    const mergeWithOwn = (rawList: Array<any>): ReservationWindow[] => {
      const result: ReservationWindow[] = [];
      const seenKeys = new Set<string>();
      for (const r of rawList) {
        if (!r || r.status === 'cancelled') continue;
        const rId = String(r.room_id || '');
        const cIn = String(r.check_in || '').slice(0, 10);
        const cOut = String(r.check_out || '').slice(0, 10);
        if (!rId || !cIn || !cOut) continue;
        const key = `${rId}:${cIn}:${cOut}`;
        const idStr = String(r.id || `avail-${rId}-${cIn}`);
        const isOwn = Boolean(
          signedInGuest && (r.is_own === true || (r.id && ownIds.has(String(r.id))) || ownKeys.has(key))
        );
        seenKeys.add(key);
        result.push({
          id: idStr,
          room_id: rId,
          check_in: cIn,
          check_out: cOut,
          status: r.status || 'confirmed',
          is_own: isOwn,
        });
      }
      for (const own of ownWindows) {
        const key = `${own.room_id}:${own.check_in}:${own.check_out}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          result.push(own);
        }
      }
      return result;
    };

    try {
      const calRes: any = await api.availabilityCalendar();
      if (calRes && Array.isArray(calRes.booked_ranges)) {
        setReservations(mergeWithOwn(calRes.booked_ranges));
        return;
      }
    } catch {}

    try {
      const { data, error } = await supabase
        .from('room_availability')
        .select('room_id, check_in, check_out, status');
      if (!error && Array.isArray(data)) {
        setReservations(mergeWithOwn(data));
        return;
      }
    } catch {
      /* view absent — fall back below */
    }
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, room_id, check_in, check_out, status')
        .neq('status', 'cancelled');
      if (!error && Array.isArray(data)) {
        setReservations(mergeWithOwn(data));
        return;
      }
    } catch (err: any) {
      console.warn('[Supabase Reservations] Fetch warning:', err?.message);
    }
    setReservations(mergeWithOwn([]));
  }, [signedInGuest, customerProfile?.id, customerProfile?.email]);

  const fetchLiveRooms = useCallback(async () => {
    try {
      // Active overnight rooms only (tours and offers share the rooms table); capacity comes straight from admin data.
      const mapped = await fetchBookableRooms();
      setRooms(mapped);
      setSelectedRoomId((current) => (current && mapped.some((m) => m.id === current) ? current : null));
      setSelectedRoomIds((current) => current.filter((id) => mapped.some((m) => m.id === id)));
      fetchLiveReservations();
      setDbStatus('connected');
      setDbStatusMessage('Live sync active');
    } catch (err: any) {
      console.warn('[Supabase Rooms] Fetch warning:', err?.message);
      setRooms([]);
      setDbStatus('offline');
      setDbStatusMessage('Database unreachable');
      fetchLiveReservations();
    }
  }, [fetchLiveReservations]);

  useEffect(() => {
    fetchLiveRooms();
    fetchLiveReservations();

    // Supabase Real-Time Channel: new bookings and admin room edits (capacity, rates) apply immediately
    const channel = supabase
      .channel('public:reservations_customer_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        fetchLiveReservations();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchLiveRooms();
      })
      .subscribe();

    // Realtime can be disabled per table, so also refresh when the tab regains focus and once a minute.
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchLiveRooms();
        fetchLiveReservations();
      }
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const roomPoll = window.setInterval(fetchLiveRooms, 60000);
    // Realtime on `reservations` only delivers rows the anon key may see, so poll
    // the availability view to catch other guests' bookings across accounts.
    const reservationPoll = window.setInterval(fetchLiveReservations, 30000);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearInterval(roomPoll);
      window.clearInterval(reservationPoll);
    };
  }, [fetchLiveRooms, fetchLiveReservations]);

  // "Book a stay" links from the guest dashboard land on the reservation card.
  useEffect(() => {
    if (location.hash !== '#reserve') return;
    const timer = window.setTimeout(() => {
      document.getElementById('reserve-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [location.hash]);

  // ---------------------------------------------------------------------------
  // 2. CALENDAR COMPUTATIONS, ROOM MATCHING & CONFLICT DETECTION
  // ---------------------------------------------------------------------------
  // Nights already taken for the currently selected room
  // A night is flagged red when ANY selected room is taken that night, so the
  // calendar reflects conflicts across every room in a multi-room selection.
  // When no room has been selected yet by the guest, no night is flagged red.
  const isBookedForSelected = useCallback(
    (isoStr: string) => {
      const ids = selectedRoomIds.length ? selectedRoomIds : (selectedRoomId ? [selectedRoomId] : []);
      if (ids.length === 0) return false;
      return ids.some((id) => {
        if (!id) return false;
        const roomObj = rooms.find((r) => r.id === id);
        if (!roomObj?.id) return false;
        return !isRoomFree(roomObj.id, isoStr, addDaysISO(isoStr, 1), reservations);
      });
    },
    [reservations, selectedRoomIds, selectedRoomId, rooms]
  );

  // What the calendars show as booked: Always reflects the currently selected room(s) directly
  const isDateBooked = useCallback(
    (isoStr: string) => {
      return isBookedForSelected(isoStr);
    },
    [isBookedForSelected]
  );

  // True when the date is booked for the selected room(s) AND belongs to the currently signed-in user
  const isOwnBookedForSelected = useCallback(
    (isoStr: string) => {
      if (!signedInGuest) return false;
      const ids = selectedRoomIds.length ? selectedRoomIds : (selectedRoomId ? [selectedRoomId] : []);
      if (ids.length === 0) return false;
      const nextIso = addDaysISO(isoStr, 1);
      let anyOwn = false;
      for (const id of ids) {
        if (!id) continue;
        const roomObj = rooms.find((r) => r.id === id);
        if (!roomObj?.id) continue;
        const overlapping = reservations.filter(
          (res) =>
            String(res.room_id) === String(roomObj.id) &&
            res.status !== 'cancelled' &&
            rangesOverlap(isoStr, nextIso, String(res.check_in).slice(0, 10), String(res.check_out).slice(0, 10))
        );
        if (overlapping.length > 0) {
          if (overlapping.some((res) => !res.is_own)) return false;
          anyOwn = true;
        }
      }
      return anyOwn;
    },
    [signedInGuest, reservations, selectedRoomIds, selectedRoomId, rooms]
  );

  // Check if a date is turnaround (checkout morning of another reservation)
  const isDateTurnaround = useCallback(
    (isoStr: string) => {
      const activeId = selectedRoomId || (selectedRoomIds.length > 0 ? selectedRoomIds[0] : null);
      if (!activeId) return false;
      return reservations.some((res) => {
        if (String(res.room_id) !== String(activeId)) return false;
        if (res.status === 'cancelled') return false;
        return isoStr === res.check_out;
      });
    },
    [reservations, selectedRoomId, selectedRoomIds]
  );

  // Rooms ranked for the party using live capacity. With only a check-in picked,
  // availability is judged on that first night.
  const rangeEnd = checkOut ?? (checkIn ? addDaysISO(checkIn, 1) : null);
  const roomRanking = useMemo(
    () => rankRoomsForParty(rooms, partySize, checkIn, rangeEnd, reservations),
    [rooms, partySize, checkIn, rangeEnd, reservations]
  );
  const maxCapacity = Math.max(1, roomRanking.maxCapacity);
  const bestFreeRoom = roomRanking.options.find((o) => o.fit === 'best')?.room ?? null;

  const drawerRoomCount = useMemo(
    () => roomRanking.options.filter((o) => inferOfferingType(o.room) === 'room').length,
    [roomRanking.options]
  );
  const drawerCottageCount = useMemo(
    () => roomRanking.options.filter((o) => inferOfferingType(o.room) === 'cottage').length,
    [roomRanking.options]
  );
  const filteredDrawerOptions = useMemo(() => {
    if (drawerCategory === 'all') return roomRanking.options;
    return roomRanking.options.filter((o) => inferOfferingType(o.room) === drawerCategory);
  }, [roomRanking.options, drawerCategory]);

  const formatStayRangeFriendly = useCallback((inISO: string, outISO: string) => {
    if (!inISO || !outISO) return '';
    const [y1, m1, d1] = inISO.split('-').map(Number);
    const [y2, m2, d2] = outISO.split('-').map(Number);
    const mName1 = MONTH_NAMES[m1]?.slice(0, 3) || `M${m1}`;
    const mName2 = MONTH_NAMES[m2]?.slice(0, 3) || `M${m2}`;
    if (y1 === y2 && m1 === m2) {
      return `${mName1} ${d1}–${d2}`;
    }
    if (y1 === y2) {
      return `${mName1} ${d1} – ${mName2} ${d2}`;
    }
    return `${mName1} ${d1}, ${y1} – ${mName2} ${d2}, ${y2}`;
  }, []);

  // Detailed conflict detection across every selected room for the current range with exact date breakdowns
  const detailedConflicts = useMemo(() => {
    if (showReserveModal || reserveSubmitting || reserveStep === 'success') return [];
    const activeEnd = checkOut ?? (checkIn ? addDaysISO(checkIn, 1) : null);
    if (!checkIn || !activeEnd) return [];
    const ids = selectedRoomIds.length ? selectedRoomIds : (selectedRoomId ? [selectedRoomId] : []);
    if (ids.length === 0) return [];
    return ids
      .map((id) => {
        const room = rooms.find((r) => r.id === id);
        if (!room) return null;
        const conflictingReservations = reservations.filter(
          (res) =>
            String(res.room_id) === String(room.id) &&
            res.status !== 'cancelled' &&
            !res.is_own &&
            !justBookedRef.current.has(String(res.id || '')) &&
            !justBookedRef.current.has(`${res.room_id}:${res.check_in}:${res.check_out}`) &&
            rangesOverlap(checkIn, activeEnd, res.check_in, res.check_out)
        );
        if (conflictingReservations.length === 0) return null;
        const formattedRanges = conflictingReservations.map(
          (res) => formatStayRangeFriendly(res.check_in, res.check_out)
        );
        return {
          room,
          conflictingReservations,
          formattedRanges,
        };
      })
      .filter((c): c is { room: Room; conflictingReservations: ReservationWindow[]; formattedRanges: string[] } => c !== null);
  }, [showReserveModal, reserveSubmitting, reserveStep, checkIn, checkOut, reservations, selectedRoomIds, selectedRoomId, rooms, formatStayRangeFriendly]);

  const hasRangeConflict = detailedConflicts.length > 0;
  const conflictRooms = useMemo(() => detailedConflicts.map((c) => c.room), [detailedConflicts]);

  const triggerCaution = useCallback(
    (roomName: string, datesText: string, altRoom?: Room | null, breakdown?: Array<{ roomName: string; datesText: string }>) => {
      setConflictToast({
        title: `Caution — ${roomName} is already booked!`,
        message: breakdown && breakdown.length > 1
          ? `Multiple selected accommodations are already booked on these dates:`
          : `This room (${roomName}) is already booked in date ${datesText}.`,
        subtext: altRoom
          ? `${altRoom.name} has open availability for your stay.`
          : 'Please select open dates or choose another accommodation.',
        roomName,
        datesText,
        breakdown: breakdown || [{ roomName, datesText }],
        altRoom: altRoom ?? null,
      });
    },
    []
  );

  // Pop a transient notification the moment a selected room clashes with the range.
  const detailedConflictKey = detailedConflicts.map((c) => `${c.room.id}:${c.formattedRanges.join('-')}`).join(';');
  useEffect(() => {
    if (reserveStep === 'success' || showReserveModal || !detailedConflictKey || detailedConflicts.length === 0) {
      setConflictToast(null);
      return;
    }

    if (detailedConflicts.length === 1) {
      const c = detailedConflicts[0];
      const dates = c.formattedRanges.length > 0
        ? c.formattedRanges.join(', ')
        : (checkIn && checkOut ? formatStayRangeFriendly(checkIn, checkOut) : 'selected dates');
      const otherSelected = selectedRoomIds.filter((id) => id !== c.room.id);
      const freeOtherNames = otherSelected.map((id) => rooms.find((r) => r.id === id)?.name).filter(Boolean);

      let sub = 'Pick an open date range or switch to an available room.';
      if (freeOtherNames.length > 0) {
        sub = `${freeOtherNames.join(', ')} is available on your dates, but ${c.room.name} is booked on dates ${dates}.`;
      } else if (bestFreeRoom) {
        sub = `${bestFreeRoom.name} has the same availability and is free for your whole stay.`;
      }

      setConflictToast({
        title: `Caution — ${c.room.name} is already booked!`,
        message: `This room (${c.room.name}) is already booked in date ${dates}.`,
        subtext: sub,
        roomName: c.room.name,
        datesText: dates,
        breakdown: [{ roomName: c.room.name, datesText: dates }],
        altRoom: bestFreeRoom,
      });
    } else {
      const breakdown = detailedConflicts.map((c) => ({
        roomName: c.room.name,
        datesText: c.formattedRanges.length > 0 ? c.formattedRanges.join(', ') : 'selected dates',
      }));
      setConflictToast({
        title: `Caution — Multiple Rooms Already Booked!`,
        message: `Multiple selected accommodations are booked on your dates:`,
        subtext: `Please adjust your dates or deselect the booked rooms.`,
        breakdown,
        altRoom: bestFreeRoom,
      });
    }

    const timer = window.setTimeout(() => setConflictToast(null), 8000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailedConflictKey]);

  const deselectBookedRooms = useCallback(() => {
    const activeEnd = checkOut ?? (checkIn ? addDaysISO(checkIn, 1) : null);
    if (!checkIn || !activeEnd) return;
    const openIds = selectedRoomIds.filter((id) => isRoomFree(id, checkIn, activeEnd, reservations));
    if (openIds.length > 0) {
      setSelectedRoomIds(openIds);
      setSelectedRoomId(openIds[0]);
    } else {
      setSelectedRoomIds([]);
      setSelectedRoomId(null);
    }
    setConflictToast(null);
  }, [checkIn, checkOut, selectedRoomIds, reservations]);

  // Booked nights count for currently active room in the displayed month
  const monthBookedNights = useMemo(() => {
    const daysInMonth = new Date(inlineYM.y, inlineYM.m, 0).getDate();
    const ids = selectedRoomIds.length ? selectedRoomIds : (selectedRoomId ? [selectedRoomId] : []);
    if (ids.length === 0) return 0;
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const isoStr = fmtISO(inlineYM.y, inlineYM.m, day);
      const isTaken = ids.some((id) => {
        const roomObj = rooms.find((r) => r.id === id);
        return roomObj ? !isRoomFree(roomObj.id, isoStr, addDaysISO(isoStr, 1), reservations) : false;
      });
      if (isTaken) count++;
    }
    return count;
  }, [inlineYM, selectedRoomIds, selectedRoomId, rooms, reservations]);

  const selectedCapacity = Number(selectedRoom.capacity) || 0;
  const selectedFits = selectedCapacity > 0 && selectedCapacity >= partySize;
  const reserveBlock: 'capacity' | 'dates' | null = !selectedFits ? 'capacity' : hasRangeConflict ? 'dates' : null;

  // Auto-match follows party size, dates, and live inventory changes only when explicitly enabled.
  useEffect(() => {
    if (roomMode !== 'auto') return;
    const best = roomRanking.best;
    if (best && best.id !== selectedRoomId) {
      setSelectedRoomId(best.id);
      setSelectedRoomIds([best.id]);
    }
  }, [roomMode, roomRanking, selectedRoomId]);

  // If capacities are lowered in the admin console, keep the party within the largest room.
  useEffect(() => {
    if (partySize <= maxCapacity) return;
    setGuests((g) => {
      const adults = Math.min(g.adults, maxCapacity);
      return { ...g, adults, children: Math.max(0, Math.min(g.children, maxCapacity - adults)) };
    });
  }, [partySize, maxCapacity]);

  const changeAdults = (delta: number) =>
    setGuests((g) => ({ ...g, adults: Math.max(1, Math.min(g.adults + delta, maxCapacity - g.children)) }));
  const changeChildren = (delta: number) =>
    setGuests((g) => ({ ...g, children: Math.max(0, Math.min(g.children + delta, maxCapacity - g.adults)) }));
  const changeInfants = (delta: number) =>
    setGuests((g) => ({ ...g, infants: Math.max(0, Math.min(g.infants + delta, MAX_INFANTS)) }));

  const chooseRoom = (roomId: string) => {
    setRoomMode('manual');
    setSelectedRoomId(roomId);
    setSelectedRoomIds([roomId]);

    const activeRangeEnd = checkOut ?? (checkIn ? addDaysISO(checkIn, 1) : null);
    if (checkIn && activeRangeEnd) {
      const conflictingRes = reservations.filter(
        (res) =>
          String(res.room_id) === String(roomId) &&
          res.status !== 'cancelled' &&
          rangesOverlap(checkIn, activeRangeEnd, res.check_in, res.check_out)
      );
      if (conflictingRes.length > 0) {
        const bookedRange = conflictingRes
          .map((r) => formatStayRangeFriendly(r.check_in, r.check_out))
          .join(', ');
        const targetRoom = rooms.find((r) => r.id === roomId);
        const name = targetRoom ? targetRoom.name : 'This room';
        const freeAlt = rooms.find((r) => r.id !== roomId && isRoomFree(r.id, checkIn, activeRangeEnd, reservations));
        triggerCaution(name, bookedRange, freeAlt ?? null);
      } else {
        setConflictToast(null);
      }
    } else {
      setConflictToast(null);
    }
  };

  const handleCategorySwitch = (category: 'room' | 'cottage') => {
    setActiveLodgingCategory(category);
    setDrawerCategory(category);
    const targetList = category === 'cottage' ? cottageAccommodations : roomAccommodations;
    if (targetList.length > 0 && selectedRoomId) {
      const isAlreadyInTarget = targetList.some((r) => r.id === selectedRoomId);
      if (!isAlreadyInTarget) {
        const bestInCat = roomRanking.options.find(
          (o) => targetList.some((t) => t.id === o.room.id) && o.fit === 'best'
        )?.room;
        const nextRoom = bestInCat || targetList[0];
        chooseRoom(nextRoom.id);
      }
    }
  };
  // Toggle a room in the multi-select list; booking uses the first still-selected room as primary.
  const toggleRoomSelect = (roomId: string) => {
    setRoomMode('manual');
    const next = selectedRoomIds.includes(roomId)
      ? selectedRoomIds.filter((id) => id !== roomId)
      : [...selectedRoomIds, roomId];
    setSelectedRoomIds(next);
    if (next.length) setSelectedRoomId(next[0]);
    else setSelectedRoomId(null);

    const activeRangeEnd = checkOut ?? (checkIn ? addDaysISO(checkIn, 1) : null);
    if (checkIn && activeRangeEnd) {
      const conflicted = next
        .map((id) => rooms.find((r) => r.id === id))
        .filter((r): r is Room => Boolean(r))
        .filter((r) => !isRoomFree(r.id, checkIn, activeRangeEnd, reservations));

      if (conflicted.length > 0) {
        if (conflicted.length === 1) {
          const room = conflicted[0];
          const conflictingRes = reservations.filter(
            (res) =>
              String(res.room_id) === String(room.id) &&
              res.status !== 'cancelled' &&
              rangesOverlap(checkIn, activeRangeEnd, res.check_in, res.check_out)
          );
          const range = conflictingRes
            .map((r) => formatStayRangeFriendly(r.check_in, r.check_out))
            .join(', ');
          const freeAlt = rooms.find((r) => !next.includes(r.id) && isRoomFree(r.id, checkIn, activeRangeEnd, reservations));
          triggerCaution(room.name, range || formatStayRangeFriendly(checkIn, activeRangeEnd), freeAlt ?? null);
        } else {
          const breakdown = conflicted.map((r) => {
            const conflictingRes = reservations.filter(
              (res) =>
                String(res.room_id) === String(r.id) &&
                res.status !== 'cancelled' &&
                rangesOverlap(checkIn, activeRangeEnd, res.check_in, res.check_out)
            );
            const range = conflictingRes
              .map((res) => formatStayRangeFriendly(res.check_in, res.check_out))
              .join(', ');
            return {
              roomName: r.name,
              datesText: range || formatStayRangeFriendly(checkIn, activeRangeEnd),
            };
          });
          setConflictToast({
            title: `Caution — Multiple Rooms Already Booked!`,
            message: `Multiple selected accommodations are booked on your dates:`,
            subtext: `Please adjust your dates or deselect the booked rooms.`,
            breakdown,
            altRoom: bestFreeRoom,
          });
        }
      } else {
        setConflictToast(null);
      }
    }
  };
  const enableAutoMatch = () => {
    setRoomMode('auto');
    const best = roomRanking.best;
    if (best) {
      setSelectedRoomId(best.id);
      setSelectedRoomIds([best.id]);
    }
  };

  const guestSummary = [
    `${guests.adults} adult${guests.adults === 1 ? '' : 's'}`,
    guests.children ? `${guests.children} ${guests.children === 1 ? 'child' : 'children'}` : '',
    guests.infants ? `${guests.infants} infant${guests.infants === 1 ? '' : 's'}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  // Total Nights and Price Breakdown
  const totalNights = useMemo(() => {
    return diffNights(checkIn, checkOut);
  }, [checkIn, checkOut]);

  // Every selected room adds to the bill. One room selected → same as before; several → summed.
  const pricedRooms = useMemo<Room[]>(() => {
    const picked = selectedRoomIds
      .map((id) => rooms.find((r) => r.id === id))
      .filter((r): r is Room => Boolean(r));
    return picked.length ? picked : [selectedRoom];
  }, [selectedRoomIds, rooms, selectedRoom]);

  const priceBreakdown = useMemo(
    () => {
      const summary = pricedRooms.reduce(
        (acc, room) => {
          const p = computeStayPrice(room.rate_php || 3500, checkIn, checkOut);
          return {
            baseRate: acc.baseRate + (room.rate_php || 3500),
            nights: p.nights,
            nightsTotal: acc.nightsTotal + p.nightsTotal,
            cleaningFee: acc.cleaningFee + p.cleaningFee,
            coastalFee: acc.coastalFee + p.coastalFee,
            taxWaived: acc.taxWaived + p.taxWaived,
            grandTotal: acc.grandTotal + p.grandTotal,
          };
        },
        { baseRate: 0, nights: 0, nightsTotal: 0, cleaningFee: 0, coastalFee: 0, taxWaived: 0, grandTotal: 0 }
      );
      const downpaymentRequired = Math.round(summary.grandTotal * 0.5);
      const remainingBalance = Math.max(0, summary.grandTotal - downpaymentRequired);
      return {
        ...summary,
        downpaymentRequired,
        remainingBalance,
      };
    },
    [pricedRooms, checkIn, checkOut]
  );

  // ---------------------------------------------------------------------------
  // 3. CALENDAR CLICK HANDLER (Tap-to-select and Tap-again-to-unselect)
  // ---------------------------------------------------------------------------
  const handleDateClick = (isoStr: string) => {
    if (isoStr < todayISO) return;

    // Tap-again-to-unselect check-in
    if (checkIn === isoStr && !checkOut) {
      setCheckIn(null);
      setActiveField('checkin');
      setCalendarNotice(null);
      return;
    }

    // Tap-again-to-unselect check-out
    if (checkOut === isoStr) {
      setCheckOut(null);
      setActiveField('checkout');
      setCalendarNotice(null);
      return;
    }

    // A later date completes the range; anything else starts a new range at this date.
    const pickingCheckout = Boolean(checkIn && !checkOut && isoStr > checkIn);
    const start = pickingCheckout ? (checkIn as string) : isoStr;
    const end = pickingCheckout ? isoStr : addDaysISO(isoStr, 1);

    const activeRoomId = selectedRoomId || (selectedRoomIds.length > 0 ? selectedRoomIds[0] : null);
    if (activeRoomId && !isRoomFree(activeRoomId, start, end, reservations)) {
      const conflictingRes = reservations.filter(
        (res) =>
          String(res.room_id) === String(activeRoomId) &&
          res.status !== 'cancelled' &&
          rangesOverlap(start, end, res.check_in, res.check_out)
      );
      const bookedRange = conflictingRes.length > 0
        ? formatStayRangeFriendly(conflictingRes[0].check_in, conflictingRes[0].check_out)
        : formatShortDate(isoStr);

      const isAllOwn = conflictingRes.length > 0 && conflictingRes.every((r) => r.is_own);
      if (isAllOwn) {
        setCalendarNotice(`You have already booked this accommodation for ${bookedRange}.`);
        return;
      }

      const roomName = rooms.find((r) => r.id === activeRoomId)?.name || 'This accommodation';
      const noticeMsg = pickingCheckout
        ? `Selected dates overlap an existing booking for ${roomName} (${bookedRange}).`
        : `${formatFullDate(isoStr)} is already booked for ${roomName} (${bookedRange}).`;

      setCalendarNotice(noticeMsg);
      const altCandidate = rooms.find(
        (r) => r.id !== activeRoomId && isRoomFree(r.id, start, end, reservations)
      ) || (bestFreeRoom && bestFreeRoom.id !== activeRoomId ? bestFreeRoom : null);
      triggerCaution(roomName, bookedRange, altCandidate);
      return;
    }
    setCalendarNotice(null);

    if (pickingCheckout) {
      setCheckOut(isoStr);
      setActiveField('checkin');
      setCardDrawer('none');
      return;
    }

    setCheckIn(isoStr);
    setCheckOut(null);
    setActiveField('checkout');
  };

  const clearDates = () => {
    setCheckIn(null);
    setCheckOut(null);
    setHoverDate(null);
    setActiveField('checkin');
    setCalendarNotice(null);
  };

  const applyQuickPreset = (preset: 'weekend' | 'stay3' | 'stay5') => {
    // Find next available span
    let start = todayISO < '2026-11-01' ? '2026-11-06' : todayISO;
    if (preset === 'weekend') {
      // Find upcoming Friday
      let dt = parseLocal(start);
      while (dt.getDay() !== 5) {
        dt.setDate(dt.getDate() + 1);
      }
      const fri = dateToISO(dt);
      const sun = addDaysISO(fri, 2);
      setCheckIn(fri);
      setCheckOut(sun);
    } else if (preset === 'stay3') {
      setCheckIn(start);
      setCheckOut(addDaysISO(start, 3));
    } else if (preset === 'stay5') {
      setCheckIn(start);
      setCheckOut(addDaysISO(start, 5));
    }
    setCardDrawer('none');
  };

  // ---------------------------------------------------------------------------
  // 4. MONTH GRID BUILDER (Single Big Calendar View)
  // ---------------------------------------------------------------------------
  const renderMonthGrid = (ym: YearMonth) => {
    const firstDow = new Date(ym.y, ym.m - 1, 1).getDay(); // 0..6
    const daysInMonth = new Date(ym.y, ym.m, 0).getDate();
    const cells = [];

    // Leading blanks
    for (let i = 0; i < firstDow; i++) {
      cells.push(<div key={`blank-${i}`} className="cal-cell-big cal-box-empty rounded-[8px]" />);
    }

    // Days 1..daysInMonth
    for (let day = 1; day <= daysInMonth; day++) {
      const isoStr = fmtISO(ym.y, ym.m, day);
      const isPast = isoStr < todayISO;
      const isBooked = isDateBooked(isoStr);
      const isOwnBooked = isBooked && isOwnBookedForSelected(isoStr);
      const isTurnaround = isDateTurnaround(isoStr);
      const isSelectedIn = isoStr === checkIn;
      const isSelectedOut = isoStr === checkOut;
      const isInRange = checkIn && checkOut && isoStr > checkIn && isoStr < checkOut;
      const isHoverRange = checkIn && !checkOut && hoverDate && isoStr > checkIn && isoStr <= hoverDate;
      const rate = isWeekendNight(isoStr)
        ? Math.round((selectedRoom.rate_php || 3500) * 1.15)
        : selectedRoom.rate_php || 3500;

      let cellClass = 'cal-box-open cursor-pointer';
      if (isPast) cellClass = 'cal-box-past';
      else if (isSelectedIn || isSelectedOut) cellClass = 'cal-box-selected';
      else if (hasRangeConflict && isInRange) cellClass = 'cal-box-conflict';
      else if (isInRange) cellClass = 'cal-box-range';
      else if (isHoverRange) cellClass = 'cal-box-hover';
      else if (isOwnBooked) cellClass = 'cal-box-own-booked';
      else if (isBooked) cellClass = 'cal-box-booked';
      else if (isTurnaround) cellClass = 'cal-box-turnaround';

      cells.push(
        <button
          key={isoStr}
          type="button"
          disabled={isPast}
          onClick={() => handleDateClick(isoStr)}
          onMouseEnter={() => !checkOut && setHoverDate(isoStr)}
          className={`cal-cell-big rounded-[8px] flex flex-col justify-between text-left transition ${cellClass}`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-sm sm:text-base font-bold leading-none">{day}</span>
            {isSelectedIn && (
              <span className="text-[10px] font-black uppercase bg-white text-black px-1.5 py-0.5 rounded-[4px] tracking-wider">
                IN
              </span>
            )}
            {isSelectedOut && (
              <span className="text-[10px] font-black uppercase bg-white text-black px-1.5 py-0.5 rounded-[4px] tracking-wider">
                OUT
              </span>
            )}
            {isBooked && !isSelectedIn && !isSelectedOut && (
              isOwnBooked ? (
                <span className="text-[9px] font-extrabold text-white bg-white/20 border border-white/50 px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider">
                  Booked
                </span>
              ) : (
                <span className="text-[9px] font-bold text-rose-400 uppercase">Booked</span>
              )
            )}
          </div>
          <span className="text-[11px] sm:text-xs font-semibold opacity-85 leading-none mt-1">
            {formatCompactRate(rate)}
          </span>
        </button>
      );
    }

    return cells;
  };

  // Compact Month Grid for Inline Card Drawer
  const renderPopoverMonthGrid = (ym: YearMonth) => {
    const firstDow = new Date(ym.y, ym.m - 1, 1).getDay();
    const daysInMonth = new Date(ym.y, ym.m, 0).getDate();
    const cells = [];

    for (let i = 0; i < firstDow; i++) {
      cells.push(<div key={`pop-blank-${i}`} className="cal-cell-compact cal-box-empty" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isoStr = fmtISO(ym.y, ym.m, day);
      const isPast = isoStr < todayISO;
      const isBooked = isDateBooked(isoStr);
      const isOwnBooked = isBooked && isOwnBookedForSelected(isoStr);
      const isSelectedIn = isoStr === checkIn;
      const isSelectedOut = isoStr === checkOut;
      const isInRange = checkIn && checkOut && isoStr > checkIn && isoStr < checkOut;

      let cellClass = 'cal-box-open cursor-pointer';
      if (isPast) cellClass = 'cal-box-past';
      else if (isSelectedIn || isSelectedOut) cellClass = 'cal-box-selected';
      else if (isInRange) cellClass = 'cal-box-range';
      else if (isOwnBooked) cellClass = 'cal-box-own-booked';
      else if (isBooked) cellClass = 'cal-box-booked';

      cells.push(
        <button
          key={`pop-${isoStr}`}
          type="button"
          disabled={isPast}
          onClick={() => handleDateClick(isoStr)}
          className={`cal-cell-compact rounded-[4px] flex items-center justify-center text-xs font-bold transition ${cellClass}`}
        >
          {day}
        </button>
      );
    }
    return cells;
  };

  // ---------------------------------------------------------------------------
  // 5. RESERVATION SUBMISSION
  // ---------------------------------------------------------------------------
  // Prefill contact details from the signed-in account, or from the guest details saved on this device.
  const prefillGuestDetails = () => {
    const account = loadGuestAccount(signedInGuest ? accountScopeFor(customerProfile) : PREVIEW_SCOPE);
    const deviceAccount = account && !account.isSample ? account : null;
    const source = signedInGuest
      ? {
          name: customerProfile?.full_name || [customerProfile?.first_name, customerProfile?.last_name].filter(Boolean).join(' '),
          email: customerProfile?.email || '',
          phone: to11Digits(customerProfile?.phone || ''),
        }
      : deviceAccount
        ? {
            name: `${deviceAccount.profile.firstName} ${deviceAccount.profile.lastName}`.trim(),
            email: deviceAccount.profile.email,
            phone: deviceAccount.profile.phone,
          }
        : null;
    if (source) {
      setGuestName((value) => value || source.name || '');
      setGuestEmail((value) => value || source.email || '');
      setGuestPhone((value) => value || source.phone || '');
    }
    if (deviceAccount?.profile.specialRequests) {
      setGuestRequests((value) => value || deviceAccount.profile.specialRequests);
    }
    const methods = deviceAccount ? deviceAccount.payments : [];
    setSavedPayments(methods);
    const preferred = methods.find((m) => m.isDefault) || methods[0];
    setPaymentChoice(preferred ? `saved:${preferred.id}` : 'front-desk');
  };

  const resolvePayment = (): { db: string; display: string } => {
    if (paymentChoice.startsWith('saved:')) {
      const method = savedPayments.find((m) => `saved:${m.id}` === paymentChoice);
      if (method) return { db: paymentDbLabel(method), display: paymentDisplay(method) };
    }
    if (paymentChoice === 'GCash' || paymentChoice === 'Maya') return { db: paymentChoice, display: paymentChoice };
    if (paymentChoice === 'Card') return { db: 'Card', display: 'Credit or debit card' };
    return { db: 'Cash', display: 'Pay at the front desk' };
  };

  const openReserve = () => {
    // Booking requires a signed-in account (the server enforces this too). Prompt sign-in / registration.
    if (!signedInGuest) {
      setAuthOpen?.(true);
      return;
    }
    if (!checkIn || !checkOut) {
      const cal = document.getElementById('calendar-section');
      if (cal) {
        cal.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        setCardDrawer('calendar');
        setActiveField(checkIn ? 'checkout' : 'checkin');
        document.getElementById('reserve-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }
    if (!selectedRoomId || selectedRoomIds.length === 0) {
      document.getElementById('reserve-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('Please choose a room or cottage to continue.', true);
      return;
    }
    if (reserveBlock) {
      document.getElementById('reserve-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('Selected accommodation or dates have a conflict. Please choose another stay.', true);
      return;
    }
    prefillGuestDetails();
    setReserveError(null);
    setReserveStep('form');
    setShowReserveModal(true);
  };

  // Step 1 of the safety rail: validate, then move to an explicit review screen.
  // Nothing is written to the resort or this device until the guest confirms on the review step.
  const handleReserveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkIn || !checkOut || reserveBlock || reserveSubmitting) return;
    const phone = to11Digits(guestPhone);
    if (!isValidPHMobile(phone)) {
      setReserveError('Enter an 11-digit Philippine mobile number starting with 09.');
      return;
    }
    if (!guestName.trim() || !guestEmail.trim()) {
      setReserveError('Please complete your name and email so we can issue your voucher.');
      return;
    }
    setReserveError(null);
    setReserveStep('review');
  };

  // Step 2 of the safety rail: only runs after the guest says yes on the review screen.
  const finalizeReservation = async () => {
    if (!checkIn || !checkOut || reserveBlock || reserveSubmitting) return;
    if (!signedInGuest) {
      setReserveError('Please sign in to complete your booking.');
      return;
    }
    const name = guestName.trim();
    const email = guestEmail.trim();
    const phone = to11Digits(guestPhone);
    if (!isValidPHMobile(phone)) {
      setReserveError('Enter an 11-digit Philippine mobile number starting with 09.');
      setReserveStep('form');
      return;
    }
    setReserveError(null);
    setReserveSubmitting(true);

    const reference = makeBookingReference(checkIn);
    const pin = makeArrivalPin();
    const payment = resolvePayment();
    const room = selectedRoom;
    const partyNote = [
      `${guests.adults} adult${guests.adults === 1 ? '' : 's'}`,
      `${guests.children} ${guests.children === 1 ? 'child' : 'children'}`,
      guests.infants ? `${guests.infants} infant${guests.infants === 1 ? '' : 's'} (not counted toward capacity)` : '',
    ]
      .filter(Boolean)
      .join(', ');
    const requestsNote = guestRequests.trim() ? ` · Requests: ${guestRequests.trim()}` : '';
    // The keypad PIN is deliberately not written to shared reservation notes.
    const notes = `Ref ${reference} · Online booking · ${partyNote} · Room ${roomMode === 'auto' ? 'auto-matched to party size' : 'chosen by guest'}${requestsNote}`;

    let savedRow: any = null;
    try {
      savedRow = await api.createReservation({
        room_id: room.id,
        guest_name: name,
        email,
        phone,
        check_in: checkIn,
        check_out: checkOut,
        guests: partySize,
        total_php: priceBreakdown.grandTotal,
        downpayment_php: priceBreakdown.downpaymentRequired,
        payment_method: payment.db,
        payment_status: 'unpaid',
        status: 'confirmed',
        notes,
        ...(signedInGuest && customerProfile?.id ? { guest_id: customerProfile.id } : {}),
      });
    } catch (err: any) {
      const message = String(err?.message || '').replace(/^⚠️\s*/, '');
      // Real conflicts and validation problems go back to the guest instead of being saved locally.
      if (/already reserved|in the past|required information/i.test(message)) {
        setReserveError(message);
        setReserveSubmitting(false);
        fetchLiveReservations();
        return;
      }
      setReserveError(message || 'Unable to complete reservation with server. Please try again.');
      setReserveSubmitting(false);
      fetchLiveReservations();
      return;
    }

    if (!savedRow || !savedRow.id) {
      setReserveError('Reservation could not be saved to resort database. Please try again.');
      setReserveSubmitting(false);
      return;
    }

    const record: GuestBooking = {
      id: String(savedRow.id),
      dbId: String(savedRow.id),
      reference,
      source: 'account',
      roomId: String(room.id),
      roomName: room.name,
      roomCategory: room.category || 'Room',
      roomImage: room.image_url || '/images/suite.jpg',
      roomCapacity: selectedCapacity,
      rate: room.rate_php || 3500,
      checkIn,
      checkOut,
      nights: totalNights,
      adults: guests.adults,
      children: guests.children,
      guests: partySize,
      nightsTotal: priceBreakdown.nightsTotal,
      cleaningFee: priceBreakdown.cleaningFee,
      coastalFee: priceBreakdown.coastalFee,
      total: priceBreakdown.grandTotal,
      status: 'confirmed',
      paymentMethod: payment.display,
      paymentStatus: 'unpaid',
      arrivalPin: pin,
      matchMode: roomMode,
      guestName: name,
      guestEmail: email,
      guestPhone: phone,
      notes,
      createdAt: new Date().toISOString(),
    };
    if (!signedInGuest) rememberBookingGuest({ name, email, phone });

    const newBookingKey = `${room.id}:${checkIn}:${checkOut}`;
    justBookedRef.current.add(String(savedRow.id));
    justBookedRef.current.add(newBookingKey);

    setConflictToast(null);
    setCalendarNotice(null);
    setCheckIn(null);
    setCheckOut(null);
    setHoverDate(null);
    setReservations((prev) => [
      ...prev.filter((r) => `${r.room_id}:${r.check_in}:${r.check_out}` !== newBookingKey),
      {
        id: String(savedRow.id),
        room_id: String(room.id),
        check_in: checkIn,
        check_out: checkOut,
        status: 'confirmed',
        is_own: true,
      },
    ]);

    setBookingRef(reference);
    setSmartPin(pin);
    setSavedBooking(record);
    setReserveSubmitting(false);
    setReserveStep('success');
    toast('✓ You have successfully booked your stay!');
    fetchLiveReservations();
  };

  // Gallery Photos for Bento Grid
  const galleryPhotos = selectedRoom.images && selectedRoom.images.length >= 5
    ? selectedRoom.images
    : [
        selectedRoom.image_url || '/images/chason_room_generated.jpg',
        '/images/rockview/03_deluxe_bedroom_swan_towels.jpg',
        '/images/sunset_cottage_generated.jpg',
        '/images/cliffside_hero_generated.jpg',
        '/images/rockview/02_ocean_rock_formation_cliff.jpg'
      ];

  return (
    <div className="bg-[#060B18] text-[#E8EEF7] min-h-screen selection:bg-cyan selection:text-[#060B18]">

      {/* =====================================================================
           HEADER: CLEAN SINGLE FIXED/STICKY DARK LUXURY HEADER (76px Height)
           ===================================================================== */}
      {!embedded && (
      <header className={`fixed top-0 inset-x-0 z-[100] h-[76px] transition-all duration-300 ${isScrolled ? 'bg-[#060B18]/90 backdrop-blur-md border-b border-white/10 shadow-lg' : 'bg-transparent border-b border-transparent'}`}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10 h-full flex items-center justify-between gap-4">
          
          {/* Left: Custom ROCK VIEW Emblem + Title (matching https://34ed5487.patar-resort.pages.dev/) */}
          <Link to="/" className="flex items-center gap-3 group" aria-label="Rock View Beach Resort">
            <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center border border-cyan/30 bg-gradient-to-br from-cyan/20 to-transparent transition-transform duration-300 group-hover:scale-105">
              <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" fill="none" aria-hidden="true">
                <circle cx="12" cy="8" r="3" fill="#f6b74a"/>
                <path d="M4 14C7 12 9 16 12 14C15 12 17 16 20 14" stroke="#22c3ee" strokeWidth="2" strokeLinecap="round"/>
                <path d="M4 18C7 16 9 20 12 18C15 16 17 20 20 18" stroke="#22c3ee" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7"/>
              </svg>
            </div>
            <div className="whitespace-nowrap leading-none">
              <span className="block font-serif text-xl font-medium text-white">Rock View</span>
              <span className="mt-1 block text-[9px] uppercase tracking-[0.25em] text-cyan/80">Beach Resort</span>
            </div>
          </Link>

          {/* Right: Only the Login Button */}
          <div className="flex items-center gap-3">
            <Link
              to={signedInGuest ? '/client' : '/client/login'}
              className="rounded-full border border-white/25 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur hover:bg-white/10 transition cursor-pointer flex items-center gap-2 shadow-xs"
            >
              <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.9">
                <circle cx="10" cy="6.5" r="3.2"/>
                <path d="M4 16.5c1.3-3 10.7-3 12 0" strokeLinecap="round"/>
              </svg>
              <span>{signedInGuest ? 'My account' : 'Sign in'}</span>
            </Link>
          </div>
        </div>
      </header>
      )}

      {/* =====================================================================
           HERO SECTION: EXACT ORIGINAL DESIGN (https://34ed5487.patar-resort.pages.dev/)
           ===================================================================== */}
      {!embedded && (
      <section className="relative flex min-h-[100dvh] flex-col justify-end overflow-hidden bg-[#060B18] text-white">
        {/* Auto-scrolling Hero Background Slides */}
        <div className="absolute inset-0 pointer-events-none">
          {HERO_SLIDES.map((slide, idx) => (
            <img
              key={idx}
              src={slide.image}
              alt={slide.headline}
              aria-hidden="true"
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-in-out ${
                heroSlide === idx
                  ? 'opacity-100 scale-100 z-10'
                  : 'opacity-0 scale-105 pointer-events-none z-0'
              }`}
              style={{ transition: 'opacity 1s ease-in-out, transform 8s ease-out' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ))}
          {/* Authentic Gradient Overlays matching https://34ed5487.patar-resort.pages.dev/ */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#060B18]/30 via-[#060B18]/10 to-[#060B18] z-10" />
          <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-[#060B18]/70 via-[#060B18]/20 to-transparent lg:block z-10" />
        </div>

        {/* Content Container - Matching exact original design from media_1794804629184_35433499.jpg */}
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10 relative z-10 mt-auto pb-10 md:pb-16 pt-32">
          <div className="max-w-xl text-left">
            <span className="block text-[11px] font-medium uppercase tracking-[0.28em] text-cyan">
              Rock View · Beach Resort
            </span>
            <h1 className="mt-3 font-serif text-6xl md:text-7xl lg:text-8xl font-medium leading-[0.95] text-white">
              Where days slow<br />
              <em className="font-serif italic text-cyan">to the tide.</em>
            </h1>
            <p className="mt-5 max-w-md text-[15px] md:text-base font-light leading-relaxed text-white/80">
              Barefoot luxury on Patar's quietest sand. Ten minutes from the Cape Bolinao lighthouse.
            </p>
            <div className="mt-5">
              <Link
                to={signedInGuest ? '/client' : '/client/login'}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-white/75 hover:text-white transition-colors duration-200 cursor-pointer group"
              >
                <span>Already have an account?</span>
                <span className="font-medium text-cyan underline underline-offset-4 decoration-cyan/60 group-hover:text-cyan-300 group-hover:decoration-cyan transition-colors">
                  {signedInGuest ? 'Go to your account' : 'Sign in'}
                </span>
                <span className="text-cyan text-xs transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </Link>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center text-[11px] uppercase tracking-[0.25em] text-white/50 lg:items-start">
            <span className="text-base text-cyan animate-bounce">↓</span>
            <span className="mt-1">Scroll to explore</span>
          </div>
        </div>
      </section>
      )}

      {/* =====================================================================
           SANCTUARY HIGHLIGHTS (From https://34ed5487.patar-resort.pages.dev/)
           ===================================================================== */}
      {!embedded && (
      <>
        <section className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10 pt-16 md:pt-24">
          <span className="block text-[11px] font-medium uppercase tracking-[0.28em] text-cyan font-bold">
            Sanctuary Highlights
          </span>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl font-medium leading-tight text-white">
            Moments built for<br />
            <em className="font-serif italic text-cyan">stillness.</em>
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <article className="rounded-3xl border border-white/10 bg-[#0B1426] overflow-hidden group transition duration-300 hover:border-cyan/40">
              <div className="h-48 md:h-56 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80"
                  alt="Quiet Sands of Patar"
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
              </div>
              <div className="p-6">
                <div className="flex items-baseline gap-3">
                  <span className="font-serif text-lg italic text-cyan font-semibold">01</span>
                  <h3 className="font-serif text-2xl font-medium text-white">Quiet Sands of Patar</h3>
                </div>
                <p className="mt-2 text-sm font-light leading-relaxed text-white/60">
                  Fifty steps from your pillow to the golden shore of Bolinao.
                </p>
              </div>
            </article>

            <article className="rounded-3xl border border-white/10 bg-[#0B1426] overflow-hidden group transition duration-300 hover:border-cyan/40">
              <div className="h-48 md:h-56 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80"
                  alt="Lanterns at Dusk"
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
              </div>
              <div className="p-6">
                <div className="flex items-baseline gap-3">
                  <span className="font-serif text-lg italic text-cyan font-semibold">02</span>
                  <h3 className="font-serif text-2xl font-medium text-white">Lanterns at Dusk</h3>
                </div>
                <p className="mt-2 text-sm font-light leading-relaxed text-white/60">
                  Nightly grilled seafood and unhurried conversations by the water.
                </p>
              </div>
            </article>

            <article className="rounded-3xl border border-white/10 bg-[#0B1426] overflow-hidden group transition duration-300 hover:border-cyan/40">
              <div className="h-48 md:h-56 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&q=80"
                  alt="The Historic Cape"
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
              </div>
              <div className="p-6">
                <div className="flex items-baseline gap-3">
                  <span className="font-serif text-lg italic text-cyan font-semibold">03</span>
                  <h3 className="font-serif text-2xl font-medium text-white">The Historic Cape</h3>
                </div>
                <p className="mt-2 text-sm font-light leading-relaxed text-white/60">
                  Dramatic coral bluffs and the beacon of Cape Bolinao lighthouse.
                </p>
              </div>
            </article>
          </div>
        </section>

        {/* =====================================================================
             ROOMS & SUITES SHOWCASE (Auto-Scrolling Accommodations Strip)
             ===================================================================== */}
        <section id="rooms-showcase" className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10 pt-16 md:pt-24 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="block text-[11px] font-medium uppercase tracking-[0.28em] text-cyan font-bold">
                Rooms &amp; Suites
              </span>
              <h2 className="mt-3 font-serif text-4xl md:text-5xl font-medium leading-tight text-white">
                Private Coastal Living
              </h2>
            </div>
            
            {/* Navigation Controls */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => roomScrollRef.current?.scrollBy({ left: -340, behavior: 'smooth' })}
                  aria-label="Scroll accommodations left"
                  className="w-10 h-10 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 text-white flex items-center justify-center transition cursor-pointer text-xl font-bold"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => roomScrollRef.current?.scrollBy({ left: 340, behavior: 'smooth' })}
                  aria-label="Scroll accommodations right"
                  className="w-10 h-10 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 text-white flex items-center justify-center transition cursor-pointer text-xl font-bold"
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          <div
            ref={roomScrollRef}
            className="flex gap-5 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory py-6 -mx-5 px-5 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0"
          >
            {/* Chason Room */}
            <article
              onClick={() => {
                const found = rooms.find((r) => r.name.toLowerCase().includes('chason'));
                if (found) {
                  chooseRoom(found.id);
                  handleCategorySwitch('room');
                }
                document.getElementById('booking-workspace')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group relative h-80 w-[280px] sm:w-[320px] shrink-0 snap-start overflow-hidden rounded-3xl border border-white/10 cursor-pointer transition hover:border-cyan/50 shadow-xl"
            >
              <img
                src="/images/chason_room_generated.jpg"
                alt="Chason Room"
                loading="lazy"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060B18] via-[#060B18]/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <span className="text-[10px] uppercase font-mono tracking-widest text-cyan font-bold block mb-1">
                  ✦ Air-Conditioned Room
                </span>
                <h3 className="font-serif text-2xl font-medium leading-tight text-white">
                  Chason Room
                </h3>
                <p className="mt-1 font-serif text-lg text-cyan">
                  ₱3,500 <span className="font-sans text-[11px] text-white/60">/ night</span>
                </p>
              </div>
            </article>

            {/* Sunset Cottage */}
            <article
              onClick={() => {
                const found = rooms.find((r) => r.name.toLowerCase().includes('sunset'));
                if (found) {
                  chooseRoom(found.id);
                  handleCategorySwitch('cottage');
                }
                document.getElementById('booking-workspace')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group relative h-80 w-[280px] sm:w-[320px] shrink-0 snap-start overflow-hidden rounded-3xl border border-white/10 cursor-pointer transition hover:border-cyan/50 shadow-xl"
            >
              <img
                src="/images/sunset_cottage_generated.jpg"
                alt="Sunset Cottage"
                loading="lazy"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060B18] via-[#060B18]/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <span className="text-[10px] uppercase font-mono tracking-widest text-cyan font-bold block mb-1">
                  ✦ Beachfront Cottage
                </span>
                <h3 className="font-serif text-2xl font-medium leading-tight text-white">
                  Sunset Cottage
                </h3>
                <p className="mt-1 font-serif text-lg text-cyan">
                  ₱3,500 <span className="font-sans text-[11px] text-white/60">/ night</span>
                </p>
              </div>
            </article>

            {/* Unit 3 */}
            <article
              onClick={() => {
                const found = rooms.find((r) => r.name.toLowerCase().includes('unit 3'));
                if (found) {
                  chooseRoom(found.id);
                  handleCategorySwitch('room');
                }
                document.getElementById('booking-workspace')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group relative h-80 w-[280px] sm:w-[320px] shrink-0 snap-start overflow-hidden rounded-3xl border border-white/10 cursor-pointer transition hover:border-cyan/50 shadow-xl"
            >
              <img
                src="/images/unit3_veranda.jpg"
                alt="Unit 3"
                loading="lazy"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060B18] via-[#060B18]/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <span className="text-[10px] uppercase font-mono tracking-widest text-cyan font-bold block mb-1">
                  ✦ Veranda Suite
                </span>
                <h3 className="font-serif text-2xl font-medium leading-tight text-white">
                  Unit 3
                </h3>
                <p className="mt-1 font-serif text-lg text-cyan">
                  ₱3,500 <span className="font-sans text-[11px] text-white/60">/ night</span>
                </p>
              </div>
            </article>

            {/* Unit 5 */}
            <article
              onClick={() => {
                const found = rooms.find((r) => r.name.toLowerCase().includes('unit 5'));
                if (found) {
                  chooseRoom(found.id);
                  handleCategorySwitch('room');
                }
                document.getElementById('booking-workspace')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group relative h-80 w-[280px] sm:w-[320px] shrink-0 snap-start overflow-hidden rounded-3xl border border-white/10 cursor-pointer transition hover:border-cyan/50 shadow-xl"
            >
              <img
                src="/images/unit5_suite.jpg"
                alt="Unit 5"
                loading="lazy"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060B18] via-[#060B18]/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <span className="text-[10px] uppercase font-mono tracking-widest text-cyan font-bold block mb-1">
                  ✦ Oceanfront Room
                </span>
                <h3 className="font-serif text-2xl font-medium leading-tight text-white">
                  Unit 5
                </h3>
                <p className="mt-1 font-serif text-lg text-cyan">
                  ₱3,500 <span className="font-sans text-[11px] text-white/60">/ night</span>
                </p>
              </div>
            </article>

            {/* Family Suite */}
            <article
              onClick={() => {
                const found = rooms.find((r) => r.name.toLowerCase().includes('family') || r.name.toLowerCase().includes('suite'));
                if (found) {
                  chooseRoom(found.id);
                  handleCategorySwitch('room');
                }
                document.getElementById('booking-workspace')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group relative h-80 w-[280px] sm:w-[320px] shrink-0 snap-start overflow-hidden rounded-3xl border border-white/10 cursor-pointer transition hover:border-cyan/50 shadow-xl"
            >
              <img
                src="/images/rockview/15_family_suite_bedroom_view.jpg"
                alt="Family Suite"
                loading="lazy"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060B18] via-[#060B18]/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <span className="text-[10px] uppercase font-mono tracking-widest text-cyan font-bold block mb-1">
                  ✦ Family Living
                </span>
                <h3 className="font-serif text-2xl font-medium leading-tight text-white">
                  Family Suite
                </h3>
                <p className="mt-1 font-serif text-lg text-cyan">
                  ₱4,500 <span className="font-sans text-[11px] text-white/60">/ night</span>
                </p>
              </div>
            </article>

            {/* Beachside Cottage Deck */}
            <article
              onClick={() => {
                handleCategorySwitch('cottage');
                document.getElementById('booking-workspace')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group relative h-80 w-[280px] sm:w-[320px] shrink-0 snap-start overflow-hidden rounded-3xl border border-white/10 cursor-pointer transition hover:border-cyan/50 shadow-xl"
            >
              <img
                src="/images/rockview/11_beachside_cottage_porch.jpg"
                alt="Beachside Cottage"
                loading="lazy"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060B18] via-[#060B18]/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <span className="text-[10px] uppercase font-mono tracking-widest text-cyan font-bold block mb-1">
                  ✦ Coastal Porch
                </span>
                <h3 className="font-serif text-2xl font-medium leading-tight text-white">
                  Seaside Cottage Porch
                </h3>
                <p className="mt-1 font-serif text-lg text-cyan">
                  ₱3,500 <span className="font-sans text-[11px] text-white/60">/ night</span>
                </p>
              </div>
            </article>
          </div>
        </section>
      </>
      )}

      {/* =====================================================================
           UNIFIED BOOKING WORKSPACE
           ===================================================================== */}
      <main id="booking-workspace" className="max-w-[1120px] mx-auto px-4 sm:px-6 pt-12 pb-16">

        {/* =====================================================================
             ROOM OVERVIEW WORKSPACE (Centered on Landing, 2-Col in Embedded/Logged-in)
             ===================================================================== */}
        <div className={showBookingTools ? "grid grid-cols-1 lg:grid-cols-12 gap-12 items-start" : "max-w-4xl mx-auto space-y-6"}>
          
          {/* LEFT / MAIN COLUMN */}
          <div className={showBookingTools ? "lg:col-span-7 xl:col-span-8" : "w-full"}>

            {/* 3 Property Highlights */}
            <div className="pb-6 border-b border-white/10 space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-cyan/15 border border-cyan/30 flex items-center justify-center text-cyan shrink-0 mt-0.5">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="5" y="3" width="14" height="18" rx="2"/>
                    <circle cx="9.5" cy="8.5" r="1"/><circle cx="14.5" cy="8.5" r="1"/>
                    <circle cx="9.5" cy="12.5" r="1"/><circle cx="14.5" cy="12.5" r="1"/>
                    <path d="M9.5 16.5h5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <h5 className="text-base font-semibold text-white">Self check-in &amp; Smart Arrival</h5>
                  <p className="text-sm text-white/65 mt-0.5 leading-relaxed font-light">Check yourself in seamlessly with verified keypad PIN issued upon booking.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-cyan/15 border border-cyan/30 flex items-center justify-center text-cyan shrink-0 mt-0.5">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 16c3-2 6 2 9 0s6 2 9 0M3 20c3-2 6 2 9 0s6 2 9 0M4 12l5.5-7L14 11l3-4 3 5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h5 className="text-base font-semibold text-white">Direct limestone cliff &amp; cove access</h5>
                  <p className="text-sm text-white/65 mt-0.5 leading-relaxed font-light">Private carved coral steps lead straight to crystal snorkeling waters, 4 minutes from Patar White Beach.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-cyan/15 border border-cyan/30 flex items-center justify-center text-cyan shrink-0 mt-0.5">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="4" width="18" height="17" rx="2"/>
                    <path d="M8 2v4M16 2v4M3 10h18" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <h5 className="text-base font-semibold text-white">Free cancellation within 5 hours of booking</h5>
                  <p className="text-sm text-white/65 mt-0.5 leading-relaxed font-light">Change your mind within 5 hours and cancel yourself from your dashboard. After that, the front desk handles cancellations.</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="py-6 border-b border-white/10">
              <div className="text-sm sm:text-base text-white/80 leading-relaxed space-y-4 font-light">
                <p>{selectedRoom.description}</p>
                <p className="text-xs sm:text-sm text-white/60">
                  Equipped with high-speed Wi-Fi, solar microgrid power backup, and complimentary tropical breakfast prepared daily by our local staff.
                </p>
              </div>
            </div>

            {/* =================================================================
                 SHANGRI-LA BORACAY DUAL-MONTH RECTANGULAR BOX CALENDAR
                 ================================================================= */}
            {showBookingTools && (
            <div id="calendar-section" className="py-7">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-[22px] font-semibold text-white">
                    Select stay dates
                  </h4>
                  <p className="text-sm text-white/60 mt-0.5">
                    Rock View Beach Resort · 2-night minimum on coastal weekends
                  </p>
                </div>

                {/* Step & Selection Indicator */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#0B1426] border border-white/10 text-xs font-semibold text-white">
                    <span className="w-2 h-2 rounded-xs bg-cyan"></span>
                    <span>
                      {!checkIn
                        ? 'Dates: N/A · Select check-in box'
                        : !checkOut
                        ? `Check-in: ${formatShortDate(checkIn)} · Select checkout box`
                        : `${formatShortDate(checkIn)} – ${formatShortDate(checkOut)} (${totalNights} ${totalNights === 1 ? 'night' : 'nights'} selected)`}
                    </span>
                  </div>
                  {(checkIn || checkOut) && (
                    <button
                      type="button"
                      onClick={clearDates}
                      className="text-xs font-semibold text-rose-400 hover:text-rose-300 underline cursor-pointer"
                    >
                      Reset to N/A
                    </button>
                  )}
                </div>
              </div>

              {/* Intelligent Caution Warning Popup Modal / Card */}
              {conflictToast && !showReserveModal && reserveStep !== 'success' && (
                <div
                  className="fixed inset-x-0 top-5 z-[70] flex justify-center px-4 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300"
                  role="alert"
                  aria-live="assertive"
                >
                  <div className="pointer-events-auto w-full max-w-lg rounded-2xl border-2 border-rose-300 bg-white/95 backdrop-blur-md p-4 sm:p-5 shadow-2xl ring-4 ring-rose-500/10">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md shadow-rose-500/30">
                        !
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="text-sm sm:text-base font-extrabold text-rose-950 tracking-tight">
                            {conflictToast.title}
                          </h5>
                          <button
                            onClick={() => setConflictToast(null)}
                            type="button"
                            className="p-1 rounded-lg text-rose-400 hover:text-rose-800 hover:bg-rose-50 transition cursor-pointer"
                            aria-label="Dismiss warning"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>

                        <p className="mt-1 text-xs sm:text-sm font-semibold text-rose-900 leading-snug">
                          {conflictToast.message}
                        </p>

                        {/* Breakdown for multiple rooms */}
                        {conflictToast.breakdown && conflictToast.breakdown.length > 1 && (
                          <div className="mt-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-2.5 space-y-1.5">
                            {conflictToast.breakdown.map((item, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs text-rose-950">
                                <span className="font-bold text-rose-600 shrink-0">•</span>
                                <div className="flex-1">
                                  <span className="font-bold text-rose-950">This room ({item.roomName})</span> is already booked in date{' '}
                                  <span className="inline-block px-1.5 py-0.5 rounded bg-rose-200/70 font-bold text-rose-900 border border-rose-300">
                                    {item.datesText}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {conflictToast.subtext && (
                          <p className="mt-1.5 text-xs text-rose-800/85 leading-relaxed">
                            {conflictToast.subtext}
                          </p>
                        )}

                        {/* Intelligent Quick Actions */}
                        <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-2 border-t border-rose-100">
                          {conflictToast.altRoom && conflictToast.altRoom.id !== selectedRoom.id && (
                            <button
                              type="button"
                              onClick={() => {
                                chooseRoom(conflictToast.altRoom!.id);
                                setConflictToast(null);
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs hover:shadow transition cursor-pointer flex items-center gap-1.5"
                            >
                              <span>Switch to {conflictToast.altRoom.name}</span>
                              <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded font-normal">Available</span>
                            </button>
                          )}

                          {selectedRoomIds.length > 1 && conflictToast.breakdown && conflictToast.breakdown.length > 0 && (
                            <button
                              type="button"
                              onClick={deselectBookedRooms}
                              className="px-3 py-1.5 rounded-lg border border-rose-300 bg-white hover:bg-rose-50 text-rose-800 text-xs font-bold transition cursor-pointer"
                            >
                              Deselect Booked Rooms
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              clearDates();
                              setConflictToast(null);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-rose-300 bg-white hover:bg-rose-50 text-rose-800 text-xs font-bold transition cursor-pointer"
                          >
                            Pick Open Dates
                          </button>

                          <button
                            type="button"
                            onClick={() => setConflictToast(null)}
                            className="px-2.5 py-1.5 rounded-lg text-rose-700 hover:text-rose-950 text-xs font-semibold cursor-pointer ml-auto"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Conflict Advisor Banner */}
              {hasRangeConflict && (
                <div className="mb-5 rounded-xl border-2 border-rose-300 bg-rose-50/90 p-4 sm:p-5 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-rose-600 text-white font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                      !
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm sm:text-[15px] font-bold text-rose-950">
                        Caution — already booked!
                      </div>
                      <p className="text-xs sm:text-sm text-rose-900/90 mt-1 leading-relaxed">
                        {detailedConflicts.length > 1
                          ? `Multiple selected accommodations are already booked on these dates:`
                          : `${conflictRooms[0]?.name ?? selectedRoom.name} is already booked on dates ${detailedConflicts[0]?.formattedRanges?.join(', ') || (checkIn && checkOut ? formatStayRangeFriendly(checkIn, checkOut) : 'selected dates')}.`}
                      </p>
                      {detailedConflicts.length > 1 && (
                        <div className="mt-2 space-y-1">
                          {detailedConflicts.map((c, i) => (
                            <div key={i} className="text-xs font-semibold text-rose-950 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 inline-block"></span>
                              <span>This room ({c.room.name}) is already booked in date {c.formattedRanges.join(', ')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {bestFreeRoom && roomMode !== 'auto' && (
                        <p className="mt-1.5 text-xs text-rose-900/80">
                          {bestFreeRoom.name} has the same availability and is open for your whole stay.
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {bestFreeRoom && roomMode !== 'auto' && (
                          <button
                            onClick={() => chooseRoom(bestFreeRoom.id)}
                            type="button"
                            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
                          >
                            Switch to {bestFreeRoom.name}
                          </button>
                        )}
                        {selectedRoomIds.length > 1 && (
                          <button
                            onClick={deselectBookedRooms}
                            type="button"
                            className="px-3 py-1.5 rounded-lg border border-rose-300 bg-white text-rose-700 text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
                          >
                            Keep only available rooms
                          </button>
                        )}
                        <button
                          onClick={enableAutoMatch}
                          type="button"
                          className="px-3 py-1.5 rounded-lg border border-rose-300 bg-white text-rose-700 text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
                        >
                          Auto-match empty room
                        </button>
                        <button
                          onClick={clearDates}
                          type="button"
                          className="px-3 py-1.5 rounded-lg border border-rose-300 bg-white text-rose-700 text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
                        >
                          Reset dates
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notice Banner */}
              {calendarNotice && (
                <div className="mb-5 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs sm:text-sm text-amber-950 flex items-center justify-between gap-3">
                  <span className="font-medium">{calendarNotice}</span>
                  <button onClick={() => setCalendarNotice(null)} type="button" className="text-xs font-bold underline cursor-pointer">
                    Dismiss
                  </button>
                </div>
              )}

              {/* Quick Preset Buttons & Month Jump */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pb-4 mb-5 border-b border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => applyQuickPreset('weekend')}
                    type="button"
                    className="px-3.5 py-1.5 rounded-xl border border-white/15 hover:border-cyan/50 hover:bg-white/10 bg-white/5 text-xs font-semibold text-white transition cursor-pointer"
                  >
                    Next Open Weekend
                  </button>
                  <button
                    onClick={() => applyQuickPreset('stay3')}
                    type="button"
                    className="px-3.5 py-1.5 rounded-xl border border-white/15 hover:border-cyan/50 hover:bg-white/10 bg-white/5 text-xs font-semibold text-white transition cursor-pointer"
                  >
                    3-Night Stay
                  </button>
                  <button
                    onClick={() => applyQuickPreset('stay5')}
                    type="button"
                    className="px-3.5 py-1.5 rounded-xl border border-white/15 hover:border-cyan/50 hover:bg-white/10 bg-white/5 text-xs font-semibold text-white transition cursor-pointer"
                  >
                    5-Night Retreat
                  </button>
                  <select
                    value={fmtYM(inlineYM)}
                    onChange={(e) => {
                      const [y, m] = e.target.value.split('-').map(Number);
                      setInlineYM({ y, m });
                    }}
                    aria-label="Jump to month"
                    className="px-3.5 py-1.5 rounded-xl border border-white/15 bg-[#0B1426] text-xs font-semibold text-white focus:outline-none focus:border-cyan cursor-pointer"
                  >
                    <option value="2026-11">November 2026</option>
                    <option value="2026-12">December 2026</option>
                    <option value="2027-01">January 2027</option>
                    <option value="2027-02">February 2027</option>
                    <option value="2027-03">March 2027</option>
                    <option value="2027-04">April 2027</option>
                    <option value="2027-05">May 2027</option>
                    <option value="2027-06">June 2027</option>
                  </select>
                </div>

                <button
                  onClick={clearDates}
                  type="button"
                  className="text-xs sm:text-sm font-semibold text-cyan underline hover:text-cyan/80 transition cursor-pointer"
                >
                  Clear dates
                </button>
              </div>

              {/* Single Large Calendar View */}
              <div>
                {/* Single Month Box Card */}
                <div className="cal-month-box p-4 sm:p-6 shadow-2xl border border-white/10 rounded-2xl bg-[#0B1426]" onMouseLeave={() => setHoverDate(null)}>
                  
                  {/* Big Month Navigation Header */}
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setInlineYM(shiftYM(inlineYM, -1))}
                        type="button"
                        aria-label="Previous month"
                        className="px-3 sm:px-4 h-9 sm:h-10 rounded-xl border border-white/15 hover:border-cyan/50 hover:bg-white/10 bg-white/5 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold text-white transition cursor-pointer"
                      >
                        ‹ Prev
                      </button>
                      <button
                        onClick={() => setInlineYM(shiftYM(inlineYM, 1))}
                        type="button"
                        aria-label="Next month"
                        className="px-3 sm:px-4 h-9 sm:h-10 rounded-xl border border-white/15 hover:border-cyan/50 hover:bg-white/10 bg-white/5 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold text-white transition cursor-pointer"
                      >
                        Next ›
                      </button>
                    </div>

                    <div className="text-center">
                      <h5 className="text-lg sm:text-2xl font-serif font-medium text-white tracking-tight">
                        {MONTH_NAMES[inlineYM.m]} {inlineYM.y}
                      </h5>
                    </div>

                    <span className="text-xs font-mono font-semibold text-cyan bg-cyan/10 px-3 py-1.5 rounded-lg border border-cyan/30 hidden sm:inline-block">
                      ₱ / night
                    </span>
                  </div>

                  {/* Weekday Labels (Sun - Sat) */}
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 mb-2 text-center">
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((w, i) => (
                      <div
                        key={i}
                        className={`py-2 rounded-lg bg-white/5 border border-white/10 text-xs sm:text-sm font-bold ${
                          i === 0 || i === 6 ? 'text-cyan' : 'text-white/80'
                        }`}
                      >
                        <span className="hidden md:inline">{w}</span>
                        <span className="md:hidden">{w.slice(0, 3)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Big Days Grid */}
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
                    {renderMonthGrid(inlineYM)}
                  </div>
                </div>

                {/* Calendar Legend with Live Room Availability Indication */}
                <div className="mt-5 rounded-xl border border-white/10 bg-[#0B1426] p-4 space-y-3">
                  {/* Top Live Status Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-white/10 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="font-bold text-white">
                        Live status for: <span className="underline decoration-cyan font-extrabold text-cyan">{selectedRoom.name}</span>
                      </span>
                    </div>

                    {hasRangeConflict ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40">
                        <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                        Selected stay conflicts with booked reservation
                      </span>
                    ) : checkIn && checkOut ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        Fully available for {formatShortDate(checkIn)} – {formatShortDate(checkOut)}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-white/60">
                        {monthBookedNights > 0
                          ? `${monthBookedNights} booked ${monthBookedNights === 1 ? 'night' : 'nights'} in ${MONTH_NAMES[inlineYM.m]} · ${Math.max(0, new Date(inlineYM.y, inlineYM.m, 0).getDate() - monthBookedNights)} nights open`
                          : `100% available in ${MONTH_NAMES[inlineYM.m]} ${inlineYM.y}`}
                      </span>
                    )}
                  </div>

                  {/* Legend Items */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/70">
                    <div className="flex flex-wrap items-center gap-3.5 sm:gap-5">
                      <span className="inline-flex items-center gap-1.5 font-medium text-white/90">
                        <span className="w-4 h-4 rounded-[4px] bg-white/10 border border-white/20 inline-block shadow-2xs"></span> Available Box
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-cyan">
                        <span className="w-4 h-4 rounded-[4px] bg-cyan border border-cyan inline-block"></span> Selected IN/OUT
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-medium text-white/90">
                        <span className="w-4 h-4 rounded-[4px] bg-cyan/20 border border-cyan/40 inline-block"></span> In-Stay Range
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                        <span className="w-4 h-4 rounded-[4px] cal-box-own-booked inline-block"></span> Your Booked Stay
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-medium text-rose-400">
                        <span className="w-4 h-4 rounded-[4px] cal-box-booked inline-block"></span> Booked Box
                      </span>
                      {hasRangeConflict && (
                        <span className="inline-flex items-center gap-1.5 font-bold text-rose-400">
                          <span className="w-4 h-4 rounded-[4px] cal-box-conflict inline-block"></span> Conflict Box
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#64748B]">Tap any open date to set stay range</span>
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>

          {/* RIGHT COLUMN (~35%): STICKY RESERVATION CARD */}
          {showBookingTools && (
          <aside
            id="reserve-card"
            className="lg:col-span-5 xl:col-span-4 self-start lg:sticky lg:top-24 scroll-mt-24 relative z-10"
            style={{ position: 'sticky', top: '96px', alignSelf: 'flex-start', zIndex: 10 }}
          >
            <div className="bg-[#0B1426] border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl text-white">
              
              {/* Price Header */}
              <div className="flex items-baseline justify-between gap-2 mb-5">
                <div>
                  <span className="font-serif text-3xl font-bold text-white tracking-tight">
                    {formatPHP(selectedRoom.rate_php || 3500)}
                  </span>
                  <span className="text-sm text-white/60 ml-1.5 font-light">/ night</span>
                </div>
                <span className="text-xs font-semibold text-[#F3D9A4] bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                  {(selectedRoom as any).reviews_count ? `★ ${(selectedRoom as any).rating_avg || '5.0'} · ${(selectedRoom as any).reviews_count} reviews` : '★ Direct Verified'}
                </span>
              </div>

              {/* 2x2 Unified Input Box */}
              <div className="border border-white/15 rounded-2xl mb-4 bg-white/5 overflow-hidden shadow-inner">
                <div className="grid grid-cols-2 divide-x divide-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setCardDrawer(cardDrawer === 'calendar' ? 'none' : 'calendar');
                      setActiveField('checkin');
                    }}
                    className={`text-left p-3 hover:bg-white/10 transition cursor-pointer ${
                      cardDrawer === 'calendar' && activeField === 'checkin' ? 'cal-input-active' : ''
                    }`}
                  >
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-white/50">
                      CHECK-IN
                    </span>
                    <span className="block text-sm text-white mt-0.5 font-semibold">
                      {formatSlash(checkIn)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCardDrawer(cardDrawer === 'calendar' ? 'none' : 'calendar');
                      setActiveField('checkout');
                    }}
                    className={`text-left p-3 hover:bg-white/10 transition cursor-pointer ${
                      cardDrawer === 'calendar' && activeField === 'checkout' ? 'cal-input-active' : ''
                    }`}
                  >
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-white/50">
                      CHECKOUT
                    </span>
                    <span className="block text-sm text-white mt-0.5 font-semibold">
                      {formatSlash(checkOut)}
                    </span>
                  </button>
                </div>

                {/* Guests Row */}
                <button
                  type="button"
                  onClick={() => setCardDrawer(cardDrawer === 'guests' ? 'none' : 'guests')}
                  aria-expanded={cardDrawer === 'guests'}
                  className={`w-full text-left p-3 border-t border-white/10 hover:bg-white/10 flex items-center justify-between transition cursor-pointer ${
                    cardDrawer === 'guests' ? 'cal-input-active' : ''
                  }`}
                >
                  <div>
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-white/50">
                      GUESTS
                    </span>
                    <span className="block text-sm text-white mt-0.5 font-semibold">
                      {partySize} {partySize === 1 ? 'guest' : 'guests'}
                      {guests.infants > 0 && `, ${guests.infants} ${guests.infants === 1 ? 'infant' : 'infants'}`}
                    </span>
                  </div>
                  <span className="text-xs text-white/60">▾</span>
                </button>

                {/* Room Row: auto-matched to the party, or the guest's own pick */}
                <button
                  type="button"
                  onClick={() => setCardDrawer(cardDrawer === 'room' ? 'none' : 'room')}
                  aria-expanded={cardDrawer === 'room'}
                  className={`w-full text-left p-3 border-t border-white/10 hover:bg-white/10 flex items-center justify-between gap-3 transition cursor-pointer ${
                    cardDrawer === 'room' ? 'cal-input-active' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <span className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-white/50">
                      ROOM
                      {selectedRoomIds.length === 0 ? (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-white/70 border border-white/10">NOT SELECTED</span>
                      ) : !selectedFits ? (
                        <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-rose-300 border border-rose-500/30">TOO SMALL</span>
                      ) : roomMode === 'auto' ? (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-emerald-300 border border-emerald-500/30">AUTO-MATCHED</span>
                      ) : (
                        <span className="rounded-full bg-cyan/20 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-cyan border border-cyan/30">YOUR PICK</span>
                      )}
                    </span>
                    <span className="block text-sm text-white mt-0.5 font-semibold truncate">
                      {selectedRoomIds.length === 0
                        ? 'Select accommodation · tap to choose'
                        : `${selectedRoom.name} · up to ${selectedCapacity} ${selectedCapacity === 1 ? 'guest' : 'guests'}`}
                    </span>
                  </div>
                  <span className="text-xs text-white/60 shrink-0">▾</span>
                </button>
              </div>

              {/* Inline Calendar Drawer */}
              {cardDrawer === 'calendar' && (
                <div className="mb-4 border border-white/15 rounded-2xl bg-[#060B18] p-4 shadow-xl text-white">
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
                    <button
                      onClick={() => setPopoverYM(shiftYM(popoverYM, -1))}
                      type="button"
                      className="w-7 h-7 rounded-lg border border-white/15 hover:border-cyan text-white text-xs font-bold cursor-pointer hover:bg-white/10 transition"
                    >
                      ‹
                    </button>
                    <span className="text-xs font-bold text-white tracking-wide">
                      {MONTH_NAMES[popoverYM.m]} {popoverYM.y}
                    </span>
                    <button
                      onClick={() => setPopoverYM(shiftYM(popoverYM, 1))}
                      type="button"
                      className="w-7 h-7 rounded-lg border border-white/15 hover:border-cyan text-white text-xs font-bold cursor-pointer hover:bg-white/10 transition"
                    >
                      ›
                    </button>
                  </div>
                  <div className="cal-grid-7-compact mb-1.5 text-center">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
                      <div key={i} className="text-[10px] font-bold text-white/50">{w}</div>
                    ))}
                  </div>
                  <div className="cal-grid-7-compact">
                    {renderPopoverMonthGrid(popoverYM)}
                  </div>
                </div>
              )}

              {/* Inline Guests Drawer */}
              {cardDrawer === 'guests' && (
                <div className="mb-4 border border-white/15 rounded-2xl bg-[#060B18] p-4 space-y-3.5 shadow-xl text-white">
                  {[
                    { key: 'adults', label: 'Adults', hint: 'Age 13+', value: guests.adults, onMinus: () => changeAdults(-1), onPlus: () => changeAdults(1), canMinus: guests.adults > 1, canPlus: partySize < maxCapacity },
                    { key: 'children', label: 'Children', hint: 'Ages 2–12', value: guests.children, onMinus: () => changeChildren(-1), onPlus: () => changeChildren(1), canMinus: guests.children > 0, canPlus: partySize < maxCapacity },
                    { key: 'infants', label: 'Infants', hint: 'Under 2 · not counted toward capacity', value: guests.infants, onMinus: () => changeInfants(-1), onPlus: () => changeInfants(1), canMinus: guests.infants > 0, canPlus: guests.infants < MAX_INFANTS },
                  ].map((row) => (
                    <div key={row.key} className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{row.label}</div>
                        <div className="text-xs text-white/60">{row.hint}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={row.onMinus}
                          disabled={!row.canMinus}
                          type="button"
                          aria-label={`Fewer ${row.label.toLowerCase()}`}
                          className="w-8 h-8 rounded-full border border-white/20 text-white flex items-center justify-center font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 hover:border-cyan transition"
                        >
                          −
                        </button>
                        <span className="w-4 text-center font-bold text-white" aria-live="polite">{row.value}</span>
                        <button
                          onClick={row.onPlus}
                          disabled={!row.canPlus}
                          type="button"
                          aria-label={`More ${row.label.toLowerCase()}`}
                          className="w-8 h-8 rounded-full border border-white/20 text-white flex items-center justify-center font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 hover:border-cyan transition"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                  <p className="border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/60">
                    Our largest room fits {maxCapacity} guests; for bigger groups, call the front desk.{' '}
                    {roomMode === 'auto' ? 'We match a room to your party automatically.' : `${selectedRoom.name} fits up to ${selectedCapacity}.`}
                  </p>
                  <button
                    onClick={() => setCardDrawer('none')}
                    type="button"
                    className="w-full py-2 rounded-xl bg-cyan text-[#060B18] text-xs font-bold hover:bg-cyan/90 cursor-pointer shadow-md transition"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Inline Room Drawer: auto-match or a manual pick, with live capacity and date availability */}
              {cardDrawer === 'room' && (
                <div className="mb-4 border border-white/15 rounded-2xl bg-[#060B18] p-4 shadow-xl text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Choose your room</div>
                      <div className="text-xs text-white/60 mt-0.5">
                        {partySize} {partySize === 1 ? 'guest' : 'guests'}
                        {checkIn && checkOut ? ` · ${formatShortDate(checkIn)} – ${formatShortDate(checkOut)}` : ' · add dates to check availability'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={roomMode === 'auto'}
                        onClick={() => {
                          if (roomMode === 'auto') {
                            setRoomMode('manual');
                            setSelectedRoomIds([]);
                            setSelectedRoomId(null);
                          } else {
                            enableAutoMatch();
                          }
                        }}
                        className="flex items-center gap-2 text-xs font-semibold text-white cursor-pointer shrink-0"
                      >
                        <span>Auto-match</span>
                        <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${roomMode === 'auto' ? 'bg-cyan' : 'bg-white/20'}`}>
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${roomMode === 'auto' ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCardDrawer('none')}
                        aria-label="Close room drawer"
                        className="h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold transition cursor-pointer shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-white/60">
                    {roomMode === 'auto'
                      ? `We pick the smallest open room that fits ${partySize} ${partySize === 1 ? 'guest' : 'guests'}. `
                      : selectedRoomIds.length > 0
                      ? 'You picked this accommodation. Tap any room to select or deselect, or turn on auto-match. '
                      : 'Tap any room to select it. Turn on auto-match to let us choose by party size. '}
                    Capacity follows the resort's live room settings; infants don't count.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-white/60">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-cyan bg-cyan/20" /> Selected</span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-rose-500/40 bg-rose-500/20" /> Already booked</span>
                    <span className="inline-flex items-center whitespace-nowrap text-white/40">Tap to select or deselect</span>
                  </div>

                  {/* Category Filter Dropdown */}
                  <div className="mt-2.5 mb-2 flex items-center justify-between gap-2.5 p-2 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white shrink-0">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan">Category</span>
                    </div>
                    <div className="relative flex-1">
                      <select
                        value={drawerCategory}
                        onChange={(e) => {
                          const val = e.target.value as 'all' | 'room' | 'cottage';
                          setDrawerCategory(val);
                          if (val !== 'all') {
                            handleCategorySwitch(val);
                          }
                        }}
                        aria-label="Filter category"
                        className="w-full appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-[#0B1426] border border-white/15 hover:border-cyan text-xs font-bold text-white shadow-xs focus:outline-none focus:border-cyan cursor-pointer transition"
                      >
                        <option value="all">All Units ({roomRanking.options.length})</option>
                        <option value="room">🛏️ Rooms ({drawerRoomCount})</option>
                        <option value="cottage">🏡 Cottages ({drawerCottageCount})</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-white/50">
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 space-y-2 max-h-72 overflow-y-auto no-scrollbar pr-0.5" role="group" aria-label="Accommodations">
                    {filteredDrawerOptions.length === 0 ? (
                      <div className="py-8 text-center text-xs text-white/50">
                        No {drawerCategory === 'room' ? 'rooms' : drawerCategory === 'cottage' ? 'cottages' : 'accommodations'} available.
                      </div>
                    ) : (
                      filteredDrawerOptions.map((option) => {
                        const isSelected = selectedRoomIds.includes(option.room.id);
                        const isBooked = option.fit === 'booked';
                        const isTooSmall = option.fit === 'too-small';
                        const disabled = isTooSmall;
                        const offering = inferOfferingType(option.room);
                        const toneClass = isBooked
                          ? 'border-rose-500/40 bg-rose-950/30 hover:border-rose-400 cursor-pointer'
                          : isSelected
                          ? 'border-cyan bg-cyan/15 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.4)] cursor-pointer'
                          : isTooSmall
                          ? 'border-white/5 opacity-40 cursor-not-allowed'
                          : 'border-white/10 bg-white/5 hover:border-white/25 cursor-pointer';
                        return (
                          <button
                            key={option.room.id}
                            type="button"
                            role="checkbox"
                            aria-checked={isSelected}
                            disabled={disabled}
                            onClick={() => {
                              if (isBooked) {
                                const activeRangeEnd = checkOut ?? (checkIn ? addDaysISO(checkIn, 1) : null);
                                const conflictingRes = (checkIn && activeRangeEnd)
                                  ? reservations.filter(
                                      (res) =>
                                        String(res.room_id) === String(option.room.id) &&
                                        res.status !== 'cancelled' &&
                                        rangesOverlap(checkIn, activeRangeEnd, res.check_in, res.check_out)
                                    )
                                  : [];
                                const range = conflictingRes.length > 0
                                  ? conflictingRes.map((r) => formatStayRangeFriendly(r.check_in, r.check_out)).join(', ')
                                  : (checkIn && checkOut ? formatStayRangeFriendly(checkIn, checkOut) : 'your selected dates');
                                triggerCaution(option.room.name, range, bestFreeRoom);
                              } else {
                                toggleRoomSelect(option.room.id);
                              }
                            }}
                            className={`w-full flex items-start gap-3 rounded-xl border p-2.5 text-left transition ${toneClass}`}
                          >
                            <img
                              src={option.room.image_url || '/images/cottage.jpg'}
                              alt=""
                              className="h-12 w-14 shrink-0 rounded-lg object-cover bg-slate-800 mt-0.5 border border-white/10"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1 pr-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-sm font-semibold text-white leading-snug break-words">
                                      {option.room.name}
                                    </span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
                                      offering === 'cottage'
                                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                                        : 'bg-white/10 text-white/80 border border-white/10'
                                    }`}>
                                      {offering === 'cottage' ? 'Cottage' : 'Room'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-white/60 mt-0.5">
                                    {option.capacity > 0 ? `Up to ${option.capacity} ${option.capacity === 1 ? 'guest' : 'guests'}` : 'Capacity not set'}
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <div className="text-xs font-semibold text-cyan">
                                    {formatPHP(option.room.rate_php || 3500)}
                                    <span className="font-normal text-white/50">/night</span>
                                  </div>
                                  <div className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold ${isBooked ? 'text-rose-400' : FIT_TONE[option.fit]}`}>
                                    {isBooked && (
                                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                                        <path d="M12 2 1 21h22L12 2zm0 13a1 1 0 110 2 1 1 0 010-2zm-1-7h2v5h-2V8z" />
                                      </svg>
                                    )}
                                    {fitLabel(option.fit, option.capacity, partySize)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-white/60">
                      <span className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                      {dbStatus === 'connected' ? 'Live room inventory' : 'Offline room list'}
                    </span>
                    <button
                      onClick={() => setCardDrawer('none')}
                      type="button"
                      className="px-4 py-1.5 rounded-lg bg-cyan text-[#060B18] text-xs font-bold cursor-pointer hover:bg-cyan/90 transition shadow-sm"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* Capacity and availability guidance */}
              {reserveBlock === 'capacity' && (
                <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-950/40 px-3.5 py-3 text-xs text-rose-200" role="status">
                  <p className="font-semibold">
                    {selectedRoom.name} fits up to {selectedCapacity} {selectedCapacity === 1 ? 'guest' : 'guests'}; your party has {partySize}.
                  </p>
                  <p className="mt-0.5 text-rose-300/80">
                    {bestFreeRoom ? `${bestFreeRoom.name} fits ${bestFreeRoom.capacity} and is open.` : 'Try a different room or fewer guests.'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {bestFreeRoom && (
                      <button type="button" onClick={() => chooseRoom(bestFreeRoom.id)} className="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-700 cursor-pointer shadow-xs">
                        Switch to {bestFreeRoom.name}
                      </button>
                    )}
                    <button type="button" onClick={enableAutoMatch} className="rounded-lg border border-rose-400/40 bg-white/10 px-3 py-1.5 font-semibold text-rose-200 hover:bg-white/20 cursor-pointer">
                      Auto-match a room
                    </button>
                  </div>
                </div>
              )}
              {reserveBlock === 'dates' && (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-950/40 px-3.5 py-3 text-xs text-amber-200" role="status">
                  <p className="font-semibold">
                    {bestFreeRoom
                      ? `${conflictRooms.map((r) => r.name).join(' and ') || selectedRoom.name} ${conflictRooms.length > 1 ? 'are' : 'is'} booked on some of these dates.`
                      : `No room for ${partySize} ${partySize === 1 ? 'guest' : 'guests'} is free for every night of these dates.`}
                  </p>
                  <p className="mt-0.5 text-amber-300/80">
                    {bestFreeRoom ? `${bestFreeRoom.name} is open for your whole stay.` : 'Pick different dates to see open rooms.'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {bestFreeRoom && (
                      <button type="button" onClick={() => chooseRoom(bestFreeRoom.id)} className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 cursor-pointer shadow-xs">
                        Switch to {bestFreeRoom.name}
                      </button>
                    )}
                    <button type="button" onClick={clearDates} className="rounded-lg border border-amber-400/40 bg-white/10 px-3 py-1.5 font-semibold text-amber-200 hover:bg-white/20 cursor-pointer">
                      Change dates
                    </button>
                  </div>
                </div>
              )}

              {/* Primary Blue Reserve CTA */}
              <button
                type="button"
                onClick={openReserve}
                className="btn-airbnb-reserve w-full h-12 rounded-xl text-[15px] font-bold tracking-wide cursor-pointer flex items-center justify-center shadow-lg shadow-cyan-500/20"
              >
                {!checkIn || !checkOut
                  ? 'Check availability'
                  : reserveBlock === 'capacity'
                  ? 'Choose a room that fits'
                  : reserveBlock === 'dates'
                  ? 'See open rooms'
                  : 'Reserve'}
              </button>

              <p className="text-center text-xs text-white/60 mt-3">
                You won’t be charged yet · Official digital voucher
              </p>

              {/* Fee Breakdown */}
              {checkIn && checkOut && totalNights > 0 ? (
                <div className="mt-5 pt-4 border-t border-white/10 space-y-2.5 text-sm text-white/80">
                  <div className="flex justify-between">
                    <span className="underline text-white/70">{formatPHP(selectedRoom.rate_php || 3500)} × {totalNights} nights{pricedRooms.length > 1 ? ` · ${pricedRooms.length} rooms` : ''}</span>
                    <span className="text-white font-medium">{formatPHP(priceBreakdown.nightsTotal)}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span className="underline">Resort Cleaning Fee</span>
                    <span className="text-white/90">{formatPHP(priceBreakdown.cleaningFee)}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span className="underline">Coastal Conservation Fee</span>
                    <span className="text-white/90">{formatPHP(priceBreakdown.coastalFee)}</span>
                  </div>
                  <div className="flex justify-between text-cyan font-medium">
                    <span>Direct Booking Tourism Tax</span>
                    <span className="text-cyan font-bold">Waived (₱0)</span>
                  </div>
                  <div className="pt-3 border-t border-white/10 flex justify-between font-bold text-base text-white">
                    <span>Total Stay Amount</span>
                    <span className="text-cyan font-serif text-xl font-bold">{formatPHP(priceBreakdown.grandTotal)}</span>
                  </div>
                  <div className="pt-2.5 border-t border-dashed border-white/10 space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold text-cyan bg-cyan/15 px-3 py-2 rounded-xl border border-cyan/40">
                      <span>50% Downpayment (Required)</span>
                      <span className="font-serif text-sm font-bold">{formatPHP(priceBreakdown.downpaymentRequired)}</span>
                    </div>
                    <div className="flex justify-between text-white/70 px-2.5">
                      <span>50% Balance on Check-in</span>
                      <span className="text-white font-semibold">{formatPHP(priceBreakdown.remainingBalance)}</span>
                    </div>
                    <p className="text-[10px] text-white/60 px-2.5 pt-0.5">
                      🛡️ <Link to="/policy" className="text-[#F3D9A4] underline hover:text-white">50% Downpayment Policy</Link> applies to lock reservation dates.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-5 pt-4 border-t border-white/10 text-center text-xs text-white/50">
                  <span>Stay dates default: <strong className="text-white">N/A</strong> · Select check-in and checkout to see pricing</span>
                </div>
              )}
            </div>
          </aside>
          )}
        </div>

        {/* =====================================================================
             RESORT COMFORTS (From https://34ed5487.patar-resort.pages.dev/)
             ===================================================================== */}
        <section id="amenities-section" className="mt-16 pt-12 border-t border-white/10">
          <span className="block text-[11px] font-medium uppercase tracking-[0.28em] text-cyan font-bold">
            Resort Comforts
          </span>
          <h2 className="mt-3 font-serif text-3xl sm:text-4xl md:text-5xl font-medium leading-tight text-white">
            Thoughtful Simplicity
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan/30 md:p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan/30 bg-cyan/15 text-cyan">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12c3-3 5 3 8 0s5 3 8 0 3-1 4 0M2 17c3-3 5 3 8 0s5 3 8 0 3-1 4 0" />
                </svg>
              </span>
              <span className="text-xs md:text-sm font-medium text-white/80">Beachfront Access</span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan/30 md:p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan/30 bg-cyan/15 text-cyan">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
                  <circle cx="12" cy="19" r="1" fill="currentColor" />
                </svg>
              </span>
              <span className="text-xs md:text-sm font-medium text-white/80">High-Speed Wi-Fi</span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan/30 md:p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan/30 bg-cyan/15 text-cyan">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9" />
                </svg>
              </span>
              <span className="text-xs md:text-sm font-medium text-white/80">All-Day Dining</span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan/30 md:p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan/30 bg-cyan/15 text-cyan">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 4h16l-8 9-8-9zM12 13v7M8 20h8" />
                </svg>
              </span>
              <span className="text-xs md:text-sm font-medium text-white/80">Sunset Bar</span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan/30 md:p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan/30 bg-cyan/15 text-cyan">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              </span>
              <span className="text-xs md:text-sm font-medium text-white/80">Shaded Cabanas</span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan/30 md:p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan/30 bg-cyan/15 text-cyan">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
                </svg>
              </span>
              <span className="text-xs md:text-sm font-medium text-white/80">Island Tours</span>
            </div>
          </div>
        </section>

        {/* =====================================================================
             "WHERE YOU'LL BE" — INTERACTIVE GOOGLE MAPS IFRAME OF BOLINAO
             ===================================================================== */}
        <section id="location-section" className="mt-16 pt-12 border-t border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
            <div>
              <span className="block text-[11px] font-medium uppercase tracking-[0.28em] text-cyan font-bold">
                Location &amp; Surrounds
              </span>
              <h4 className="font-serif text-3xl sm:text-4xl font-medium leading-tight text-white mt-1">
                Where you'll be
              </h4>
              <p className="text-sm text-white/60 mt-1">
                Patar Coastal Road, Bolinao, Pangasinan, Philippines
              </p>
            </div>
            <a
              href="https://www.google.com/maps/search/?api=1&query=Rock+View+Beach+Resort,+Patar+Road,+Bolinao,+Pangasinan"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan hover:underline transition shrink-0"
            >
              <span>Open in Google Maps</span>
              <span>↗</span>
            </a>
          </div>

          <div className="h-[360px] sm:h-[440px] rounded-2xl overflow-hidden border border-white/10 bg-[#0B1426] relative shadow-lg">
            <iframe
              title="Rock View Beach Resort Location Map"
              src="https://maps.google.com/maps?q=Rock+View+Beach+Resort,+Patar+Road,+Bolinao,+Pangasinan&t=&z=15&ie=UTF8&iwloc=&output=embed"
              className="w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>

          {/* Surrounding Landmark Distance Pills */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-white/80">
            <div className="p-3 rounded-xl bg-[#0B1426] border border-white/10">
              <span className="font-bold text-white block">Patar Rock Formations</span>
              <span className="text-[11px] text-white/50">Direct access · On site</span>
            </div>
            <div className="p-3 rounded-xl bg-[#0B1426] border border-white/10">
              <span className="font-bold text-white block">Patar White Beach</span>
              <span className="text-[11px] text-white/50">4 mins · 1.8 km</span>
            </div>
            <div className="p-3 rounded-xl bg-[#0B1426] border border-white/10">
              <span className="font-bold text-white block">Cape Bolinao Lighthouse</span>
              <span className="text-[11px] text-white/50">6 mins · 2.8 km</span>
            </div>
            <div className="p-3 rounded-xl bg-[#0B1426] border border-white/10">
              <span className="font-bold text-white block">Enchanted Cave</span>
              <span className="text-[11px] text-white/50">12 mins · 6.2 km</span>
            </div>
          </div>
        </section>
      </main>

      {!embedded && (
      <>
        {/* =====================================================================
             VISUAL JOURNAL: SHORE SCENES GALLERY (From https://34ed5487.patar-resort.pages.dev/)
             ===================================================================== */}
        <section className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10 pt-16">
          <div className="flex items-end justify-between mb-6">
            <div>
              <span className="block text-[11px] font-medium uppercase tracking-[0.28em] text-cyan font-bold">
                Visual Journal
              </span>
              <h3 className="mt-2 font-serif text-3xl sm:text-4xl font-medium leading-tight text-white">
                Scenes from the Shore
              </h3>
            </div>
            <span className="text-xs text-white/50 hidden sm:block font-mono">Patar Coral Ridge &amp; Living Coves</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 h-[380px] sm:h-[440px]">
            <div className="col-span-2 row-span-2 rounded-2xl overflow-hidden border border-white/10 group relative">
              <img
                src="/images/rockview/04_swimming_pool_deck_loungers.jpg"
                alt="Pool Deck Loungers"
                className="w-full h-full object-cover transition duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="text-[10px] uppercase tracking-widest text-cyan font-mono font-bold block">Sanctuary Pool</span>
                <p className="text-white text-sm font-medium mt-0.5">Sun-drenched loungers above the West Philippine Sea</p>
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden border border-white/10 group relative">
              <img
                src="/images/rockview/08_sunset_seashore_horizon.jpg"
                alt="Sunset Horizon"
                className="w-full h-full object-cover transition duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
              <span className="absolute bottom-3 left-3 text-[11px] font-medium text-white">Golden Hour Horizon</span>
            </div>

            <div className="rounded-2xl overflow-hidden border border-white/10 group relative">
              <img
                src="/images/rockview/02_ocean_rock_formation_cliff.jpg"
                alt="Coral Cliffs"
                className="w-full h-full object-cover transition duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
              <span className="absolute bottom-3 left-3 text-[11px] font-medium text-white">Carved Coral Cliffs</span>
            </div>

            <div className="rounded-2xl overflow-hidden border border-white/10 group relative">
              <img
                src="/images/rockview/10_coastal_waves_and_cliff_view.jpg"
                alt="Coastal Waves"
                className="w-full h-full object-cover transition duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
              <span className="absolute bottom-3 left-3 text-[11px] font-medium text-white">Living Tidal Coves</span>
            </div>

            <div className="rounded-2xl overflow-hidden border border-white/10 group relative">
              <img
                src="/images/rockview/14_resort_grounds_night_lighting.jpg"
                alt="Evening Ambiance"
                className="w-full h-full object-cover transition duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
              <span className="absolute bottom-3 left-3 text-[11px] font-medium text-white">Evening Lanterns</span>
            </div>
          </div>
        </section>

        {/* =====================================================================
             FREQUENTLY INQUIRED DETAILS (FAQ Accordion with 50% Downpayment Policy)
             ===================================================================== */}
        <section id="faq-section" className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10 pt-16">
          <span className="block text-[11px] font-medium uppercase tracking-[0.28em] text-cyan font-bold">
            Frequently Inquired
          </span>
          <h3 className="mt-2 font-serif text-3xl sm:text-4xl font-medium leading-tight text-white">
            Helpful Details
          </h3>

          <div className="mt-8 space-y-3.5">
            {[
              {
                q: "What is the reservation deposit requirement?",
                a: "To confirm and secure your reservation pass, a mandatory 50% reservation downpayment is required via GCash, Maya, or Online Bank Transfer. The remaining 50% balance is settled upon check-in at our front desk reception."
              },
              {
                q: "What are your check-in and check-out times?",
                a: "Check-in begins at 2:00 PM and check-out is at 12:00 PM noon. Early check-in or late check-out may be arranged with our concierge subject to room availability."
              },
              {
                q: "Can we bring our own food or cook on site?",
                a: "Yes! Guests are welcome to bring food and utilize our beachfront charcoal grilling stations free of charge. No corkage fee is charged for personal food items or beverages."
              },
              {
                q: "Is Patar beach swimmable and child-friendly?",
                a: "Yes, Patar features natural shallow limestone tidal pools and calm coral coves with gentle turquoise water, perfect for wading, swimming, and snorkeling at low and mid tides."
              },
              {
                q: "What is your cancellation and refund policy?",
                a: "Bookings cancelled within 5 hours of reservation receive a 100% full refund. Cancellations made 7 or more days prior to check-in receive an 80% refund of the downpayment. In case of government-issued storm signals, full rebooking without penalty is guaranteed."
              }
            ].map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/10 bg-[#0B1426] overflow-hidden transition"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition"
                  >
                    <span className="font-serif text-lg text-white font-medium">{item.q}</span>
                    <span className={`text-cyan text-xl font-bold shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`}>
                      +
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-sm text-white/70 leading-relaxed font-light border-t border-white/5 animate-fade-in">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </>
      )}

      {/* =====================================================================
           FOOTER: EDITORIAL DARK LUXURY FOOTER (From https://34ed5487.patar-resort.pages.dev/)
           ===================================================================== */}
      <footer className="mt-20 border-t border-white/10 bg-[#03060f]">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10 flex flex-col items-center py-14 text-center pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center border border-cyan/30 bg-gradient-to-br from-cyan/20 to-transparent">
              <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" fill="none" aria-hidden="true">
                <circle cx="12" cy="8" r="3" fill="#f6b74a"/>
                <path d="M4 14C7 12 9 16 12 14C15 12 17 16 20 14" stroke="#22c3ee" strokeWidth="2" strokeLinecap="round"/>
                <path d="M4 18C7 16 9 20 12 18C15 16 17 20 20 18" stroke="#22c3ee" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7"/>
              </svg>
            </div>
            <div className="whitespace-nowrap leading-none">
              <span className="block font-serif text-xl font-medium text-white">Rock View</span>
              <span className="mt-1 block text-[9px] uppercase tracking-[0.25em] text-cyan/80">Beach Resort</span>
            </div>
          </div>
          <p className="mt-4 font-serif text-base italic text-white/60">Where days slow to the tide.</p>
          <div className="mt-5 flex gap-6 text-xs text-white/50">
            <span className="cursor-pointer transition hover:text-cyan">Instagram</span>
            <span className="cursor-pointer transition hover:text-cyan">Facebook</span>
            <span className="cursor-pointer transition hover:text-cyan">TikTok</span>
          </div>
          <Link to="/client/login" className="mt-6 text-xs font-semibold uppercase tracking-wider text-cyan underline underline-offset-4">
            Sign in to account
          </Link>
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-white/60">
            <Link to="/policy" className="hover:text-cyan transition underline underline-offset-4">
              50% Downpayment Policy &amp; Rules
            </Link>
            <Link to="/policy#cancellation" className="hover:text-cyan transition underline underline-offset-4">
              Cancellation &amp; Rebooking
            </Link>
            <Link to="/policy#house-rules" className="hover:text-cyan transition underline underline-offset-4">
              Resort House Guidelines
            </Link>
            <Link to="/policy#privacy" className="hover:text-cyan transition underline underline-offset-4">
              Privacy &amp; Terms
            </Link>
          </div>
          <p className="mt-3 max-w-md text-[10px] leading-relaxed text-white/35">
            © 2026 Rock View Beach Resort. All rights reserved. Patar Beach, Bolinao, Pangasinan, Philippines.
          </p>
        </div>
      </footer>

      {/* =====================================================================
           MOBILE FIXED BOTTOM BAR
           ===================================================================== */}
      {showBookingTools && (
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#EBEBEB] px-5 py-3 flex items-center justify-between shadow-lg">
        <div>
          <span className="text-base font-bold text-[#222222]">
            {checkIn && checkOut ? formatPHP(priceBreakdown.grandTotal) : `${formatPHP(selectedRoom.rate_php || 3500)} / night`}
          </span>
          <span className="block text-[11px] text-[#6A6A6A]">
            {checkIn && checkOut ? `${totalNights} nights · ${selectedRoom.name}` : 'Select dates'}
          </span>
        </div>
        <button
          onClick={() => {
            if (!checkIn || !checkOut) {
              const el = document.getElementById('calendar-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            } else {
              openReserve();
            }
          }}
          type="button"
          className="btn-airbnb-reserve px-5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer"
        >
          {!checkIn || !checkOut ? 'Check Dates' : reserveBlock ? 'Review room' : 'Reserve'}
        </button>
      </div>
      )}



      {/* =====================================================================
           MODAL 2: FULL-SCREEN PHOTO TOUR MODAL
           ===================================================================== */}
      {showPhotoTour && (
        <div className="fixed inset-0 z-50 bg-[#FFFFFF] text-[#222222] flex flex-col animate-fade-in">
          <div className="h-16 px-4 sm:px-8 border-b border-[#EBEBEB] flex items-center justify-between">
            <button
              onClick={() => setShowPhotoTour(false)}
              type="button"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-[#F7F7F7] text-sm font-semibold cursor-pointer"
            >
              ‹ Back to listing
            </button>
            <span className="text-sm font-semibold">
              {tourIndex + 1} / {galleryPhotos.length}
            </span>
            <div className="w-16"></div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 flex flex-col items-center justify-center">
            <div className="w-full max-w-4xl h-[54vh] rounded-[12px] relative overflow-hidden shadow-md">
              <img
                src={galleryPhotos[tourIndex]}
                alt="Villa photo tour"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <h3 className="text-xl sm:text-2xl font-bold">
                  {selectedRoom.name} · View {tourIndex + 1}
                </h3>
                <p className="text-xs sm:text-sm text-white/85 mt-1">
                  Rock View Beach Resort · Patar Coastal Road, Bolinao
                </p>
              </div>
            </div>

            {/* Thumbnail Strip */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {galleryPhotos.map((photo, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTourIndex(i)}
                  className={`w-16 h-12 rounded-lg overflow-hidden border-2 transition cursor-pointer ${
                    tourIndex === i ? 'border-[#222222] scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={photo} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
           MODAL 3: RESERVATION CONFIRMATION & OFFICIAL RECEIPT MODAL
           ===================================================================== */}
      {showReserveModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reserve-modal-title"
        >
          <div className="bg-[#FFFFFF] rounded-2xl max-w-md w-full max-h-[92vh] border border-[#DDDDDD] shadow-2xl overflow-hidden animate-fade-in flex flex-col">
            <div className="px-6 py-4 border-b border-[#EBEBEB] flex items-center justify-between shrink-0">
              <h3 id="reserve-modal-title" className="text-lg font-bold text-[#222222]">
                {reserveStep === 'form'
                  ? 'Your Bolinao reservation'
                  : reserveStep === 'review'
                  ? 'Review & confirm'
                  : savedBooking?.dbId
                  ? 'Reservation confirmed'
                  : 'Booking saved on this device'}
              </h3>
              <button
                onClick={() => setShowReserveModal(false)}
                type="button"
                aria-label="Close"
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-sm font-bold flex items-center justify-center cursor-pointer text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto">
            {reserveStep === 'form' ? (
              <form onSubmit={handleReserveSubmit} className="p-6 space-y-4">
                <div className="border border-[#DDDDDD] rounded-xl p-4 space-y-2.5 text-sm">
                  <div className="flex items-center gap-3 pb-1">
                    <img
                      src={selectedRoom.image_url || '/images/cottage.jpg'}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover bg-slate-100 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-[#222222] truncate">{selectedRoom.name}</div>
                      <div className="text-xs text-[#6A6A6A]">
                        {selectedRoom.category} · up to {selectedCapacity} {selectedCapacity === 1 ? 'guest' : 'guests'}
                      </div>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                          roomMode === 'auto' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {roomMode === 'auto' ? `Auto-matched for ${partySize}` : 'Chosen by you'}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between gap-3 text-[#6A6A6A]">
                    <span>Dates</span>
                    <span className="font-semibold text-[#222222] text-right">
                      {formatFullDate(checkIn)} – {formatFullDate(checkOut)} ({totalNights} nights)
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 text-[#6A6A6A]">
                    <span>Guests</span>
                    <span className="font-semibold text-[#222222] text-right">{guestSummary}</span>
                  </div>
                  <div className="flex justify-between text-[#6A6A6A]">
                    <span>Cleaning &amp; Conservation Fee</span>
                    <span className="font-semibold text-[#222222]">{formatPHP(priceBreakdown.cleaningFee + priceBreakdown.coastalFee)}</span>
                  </div>
                  <div className="pt-2.5 border-t border-[#DDDDDD] flex justify-between font-bold text-base text-[#222222]">
                    <span>Total Stay Amount</span>
                    <span className="text-[#1D4ED8]">{formatPHP(priceBreakdown.grandTotal)}</span>
                  </div>
                  <div className="mt-2 p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs space-y-1">
                    <div className="flex justify-between font-bold text-sky-950">
                      <span>50% Downpayment Required</span>
                      <span>{formatPHP(priceBreakdown.downpaymentRequired)}</span>
                    </div>
                    <div className="flex justify-between text-sky-800 text-[11px]">
                      <span>50% Remaining Balance (Pay upon check-in)</span>
                      <span>{formatPHP(priceBreakdown.remainingBalance)}</span>
                    </div>
                    <p className="text-[10px] text-sky-700 pt-1 border-t border-sky-200/60">
                      🛡️ A 50% reservation deposit secures your booking window per <Link to="/policy" target="_blank" className="underline font-bold">Resort Policy</Link>.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="reserve-name" className="block text-xs font-semibold text-[#222222] mb-1">Primary Guest Full Name</label>
                    <input
                      id="reserve-name"
                      type="text"
                      required
                      autoComplete="name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#B0B0B0] text-sm focus:outline-none focus:border-[#222222]"
                    />
                  </div>
                  <div>
                    <label htmlFor="reserve-email" className="block text-xs font-semibold text-[#222222] mb-1">Email for Digital Voucher</label>
                    <input
                      id="reserve-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="guest@example.ph"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#B0B0B0] text-sm focus:outline-none focus:border-[#222222]"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="reserve-phone" className="block text-xs font-semibold text-[#222222]">
                        Philippine Mobile (SMS PIN alert)
                      </label>
                      <span className={`text-[11px] font-semibold transition-colors ${
                        guestPhone.length === 11 && guestPhone.startsWith('09')
                          ? 'text-emerald-600'
                          : guestPhone.length > 0 && !guestPhone.startsWith('09')
                          ? 'text-rose-600'
                          : guestPhone.length > 0
                          ? 'text-amber-600'
                          : 'text-[#717171]'
                      }`}>
                        {guestPhone.length === 11 && guestPhone.startsWith('09')
                          ? '✓ 11/11 digits'
                          : guestPhone.length > 0 && !guestPhone.startsWith('09')
                          ? 'Must start with 09'
                          : guestPhone.length > 0
                          ? `${guestPhone.length}/11 digits`
                          : '11 digits only (09...)'}
                      </span>
                    </div>
                    <input
                      id="reserve-phone"
                      type="tel"
                      required
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={11}
                      pattern="09[0-9]{9}"
                      value={guestPhone}
                      onChange={(e) => {
                        let digits = e.target.value.replace(/\D/g, '');
                        if (digits.startsWith('63') && digits.length >= 3) {
                          digits = '0' + digits.slice(2);
                        }
                        setGuestPhone(digits.slice(0, 11));
                        if (reserveError) setReserveError(null);
                      }}
                      placeholder="09171234567"
                      className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none ${
                        guestPhone.length === 11 && guestPhone.startsWith('09')
                          ? 'border-emerald-500 focus:border-emerald-600'
                          : guestPhone.length > 0 && (!guestPhone.startsWith('09') || guestPhone.length < 11)
                          ? 'border-amber-400 focus:border-amber-500'
                          : 'border-[#B0B0B0] focus:border-[#222222]'
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="reserve-payment" className="block text-xs font-semibold text-[#222222] mb-1">How you'll pay at the resort</label>
                    <select
                      id="reserve-payment"
                      value={paymentChoice}
                      onChange={(e) => setPaymentChoice(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-[#B0B0B0] bg-white text-sm focus:outline-none focus:border-[#222222] cursor-pointer"
                    >
                      {savedPayments.map((method) => (
                        <option key={method.id} value={`saved:${method.id}`}>
                          {`${paymentDisplay(method)}${method.isDefault ? ' (default)' : ''}`}
                        </option>
                      ))}
                      <option value="front-desk">Pay at the front desk</option>
                      <option value="GCash">GCash</option>
                      <option value="Maya">Maya</option>
                      <option value="Card">Credit or debit card</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="reserve-requests" className="block text-xs font-semibold text-[#222222] mb-1">
                      Special requests <span className="font-normal text-[#6A6A6A]">(optional)</span>
                    </label>
                    <textarea
                      id="reserve-requests"
                      rows={2}
                      maxLength={300}
                      value={guestRequests}
                      onChange={(e) => setGuestRequests(e.target.value)}
                      placeholder="Early arrival, extra pillows, celebrating a birthday…"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#B0B0B0] text-sm focus:outline-none focus:border-[#222222] resize-none"
                    />
                  </div>
                </div>

                {reserveError && (
                  <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-900">
                    {reserveError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={reserveSubmitting}
                  className="btn-airbnb-reserve w-full h-12 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  <span>Review reservation</span>
                </button>
                <p className="text-center text-xs text-[#6A6A6A]">
                  You won’t be charged yet · {signedInGuest ? 'Linked to your resident account' : 'Shows in your guest dashboard on this device'}
                </p>
              </form>
            ) : reserveStep === 'review' ? (
              <div className="p-6 space-y-4">
                <p className="text-sm text-[#6A6A6A]">
                  Please check everything below. Your dates are only held once you confirm.
                </p>

                <div className="border border-[#DDDDDD] rounded-xl p-4 space-y-2.5 text-sm">
                  <div className="flex items-center gap-3 pb-1">
                    <img
                      src={selectedRoom.image_url || '/images/cottage.jpg'}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover bg-slate-100 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-[#222222] truncate">{selectedRoom.name}</div>
                      <div className="text-xs text-[#6A6A6A]">
                        {selectedRoom.category} · up to {selectedCapacity} {selectedCapacity === 1 ? 'guest' : 'guests'}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between gap-3 text-[#6A6A6A]">
                    <span>Dates</span>
                    <span className="font-semibold text-[#222222] text-right">
                      {formatFullDate(checkIn)} – {formatFullDate(checkOut)} ({totalNights} nights)
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 text-[#6A6A6A]">
                    <span>Guests</span>
                    <span className="font-semibold text-[#222222] text-right">{guestSummary}</span>
                  </div>
                  <div className="pt-2.5 border-t border-[#DDDDDD] flex justify-between font-bold text-base text-[#222222]">
                    <span>Total Stay Amount</span>
                    <span className="text-[#1D4ED8]">{formatPHP(priceBreakdown.grandTotal)}</span>
                  </div>
                  <div className="mt-2 p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs space-y-1">
                    <div className="flex justify-between font-bold text-sky-950">
                      <span>50% Downpayment Required</span>
                      <span>{formatPHP(priceBreakdown.downpaymentRequired)}</span>
                    </div>
                    <div className="flex justify-between text-sky-800 text-[11px]">
                      <span>50% Remaining Balance (Pay upon check-in)</span>
                      <span>{formatPHP(priceBreakdown.remainingBalance)}</span>
                    </div>
                    <p className="text-[10px] text-sky-700 pt-1 border-t border-sky-200/60">
                      🛡️ A 50% reservation deposit secures your booking window per <Link to="/policy" target="_blank" className="underline font-bold">Resort Policy</Link>.
                    </p>
                  </div>
                </div>

                <div className="border border-[#DDDDDD] rounded-xl p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3 text-[#6A6A6A]">
                    <span>Primary guest</span>
                    <span className="font-semibold text-[#222222] text-right">{guestName.trim()}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-[#6A6A6A]">
                    <span>Email</span>
                    <span className="font-semibold text-[#222222] text-right break-all">{guestEmail.trim()}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-[#6A6A6A]">
                    <span>Mobile</span>
                    <span className="font-semibold text-[#222222] text-right">{to11Digits(guestPhone)}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-[#6A6A6A]">
                    <span>Payment</span>
                    <span className="font-semibold text-[#222222] text-right">{resolvePayment().display}</span>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-[#6A6A6A]">
                  You can cancel yourself free of charge within 5 hours of booking. After that, the front desk at {RESORT_CONTACT.phoneDisplay} handles cancellations.
                </p>

                {reserveError && (
                  <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-900">
                    {reserveError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setReserveError(null); setReserveStep('form'); }}
                    disabled={reserveSubmitting}
                    className="h-12 rounded-lg border border-[#DDDDDD] text-[#222222] text-sm font-semibold hover:bg-[#F7F7F7] transition cursor-pointer disabled:opacity-70"
                  >
                    Go back &amp; edit
                  </button>
                  <button
                    type="button"
                    onClick={finalizeReservation}
                    disabled={reserveSubmitting}
                    className="btn-airbnb-reserve h-12 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                  >
                    <span>{reserveSubmitting ? 'Finalizing…' : 'Confirm & book'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center space-y-4">
                <div
                  className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center text-xl font-bold border ${
                    savedBooking?.dbId ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'
                  }`}
                >
                  {savedBooking?.dbId ? '✓' : '!'}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-[#222222]">{savedBooking?.dbId ? 'You’re booked!' : 'Saved on this device'}</h4>
                  <p className="text-sm text-[#6A6A6A] mt-1">
                    {savedBooking
                      ? `${savedBooking.roomName} · ${formatFullDate(savedBooking.checkIn)} – ${formatFullDate(savedBooking.checkOut)}`
                      : ''}
                  </p>
                </div>

                <div className="bg-[#F7F7F7] border border-[#DDDDDD] rounded-xl p-4">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-[#6A6A6A]">Confirmation Reference</div>
                  <div className="font-mono text-lg font-extrabold text-[#222222] mt-1">
                    {bookingRef}
                  </div>
                  <div className="text-xs font-semibold text-emerald-700 mt-1">
                    Smart Keypad PIN: {smartPin} · active from {RESORT_CONTACT.checkInTime} on check-in day
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1.5 flex items-center justify-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${savedBooking?.dbId ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                    <span>{savedBooking?.dbId ? 'Recorded in the resort reservation system' : 'Not yet in the resort reservation system'}</span>
                  </div>
                </div>

                {/* Scannable receipt barcode + digital pass */}
                <VoucherBarcode reference={savedBooking?.reference || bookingRef} />

                {!savedBooking?.dbId && (
                  <p className="text-left text-xs leading-relaxed text-amber-950 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
                    We couldn’t reach the reservation system, so these dates aren’t held yet. Please call the front desk at {RESORT_CONTACT.phoneDisplay} to confirm your booking.
                  </p>
                )}

                <button
                  onClick={() => navigate('/client')}
                  type="button"
                  className="btn-airbnb-reserve w-full h-12 rounded-lg text-sm font-semibold cursor-pointer flex items-center justify-center"
                >
                  Go to my dashboard
                </button>
                <button
                  onClick={() => setShowReserveModal(false)}
                  type="button"
                  className="w-full py-3 rounded-lg border border-[#DDDDDD] text-[#222222] text-sm font-semibold hover:bg-[#F7F7F7] transition cursor-pointer"
                >
                  Back to the resort page
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          ADMIN UPFRONT HERO & TITLE QUICK EDIT MODAL
          =================================================================== */}
      {showHeroQuickEdit && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowHeroQuickEdit(false)}
        >
          <div
            className="w-full max-w-lg bg-[#FFFFFF] text-[#18222B] rounded-2xl shadow-2xl border border-[#E8E2D6] overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E2D6] bg-[#FBF9F5]">
              <div className="flex items-center gap-2.5">
                <i className="fas fa-pen-to-square text-[#0EA5E9]" />
                <h3 className="font-serif-luxury text-lg font-bold text-[#18222B]">
                  Edit Hero Upfront (Admin)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHeroQuickEdit(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#8A857B] hover:text-[#18222B] hover:bg-black/5 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#9E7E46] mb-1.5">
                  Hero Headline (Main Upfront Title)
                </label>
                <input
                  type="text"
                  value={quickHeadline}
                  onChange={(e) => setQuickHeadline(e.target.value)}
                  placeholder="Where Limestone Cliffs Meet the West Philippine Sea"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5CEBF] bg-[#FBF9F5] text-sm text-[#18222B] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#9E7E46] mb-1.5">
                  Hero Subtitle / Description
                </label>
                <textarea
                  rows={3}
                  value={quickSubtitle}
                  onChange={(e) => setQuickSubtitle(e.target.value)}
                  placeholder="Private oceanfront villas perched above Bolinao’s sculpted coral coves..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5CEBF] bg-[#FBF9F5] text-sm text-[#18222B] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] resize-vertical"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#9E7E46] mb-1.5">
                  Location Kicker / Top Badge
                </label>
                <input
                  type="text"
                  value={quickKicker}
                  onChange={(e) => setQuickKicker(e.target.value)}
                  placeholder="Patar Coastal Road · Bolinao, Pangasinan, Philippines"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5CEBF] bg-[#FBF9F5] text-sm text-[#18222B] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                />
              </div>

              <div className="pt-2 border-t border-[#E8E2D6]">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#9E7E46] mb-1.5">
                  Hero Background Image
                </label>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => quickFileRef.current?.click()}
                    disabled={quickUploading || quickSaving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0EA5E9] text-white text-xs font-bold hover:bg-[#0284C7] transition cursor-pointer"
                  >
                    <i className={quickUploading ? 'fas fa-spinner fa-spin' : 'fas fa-upload'} />
                    <span>{quickUploading ? 'Uploading…' : 'Upload Image'}</span>
                  </button>
                  <input
                    ref={quickFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleQuickImageUpload}
                    className="hidden"
                  />
                  {quickHeroUrl && (
                    <button
                      type="button"
                      onClick={() => setQuickHeroUrl('')}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                    >
                      Remove image
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={quickHeroUrl}
                  onChange={(e) => setQuickHeroUrl(e.target.value)}
                  placeholder="https://... or /uploads/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#D5CEBF] bg-[#FBF9F5] text-xs text-[#18222B] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[#E8E2D6] bg-[#FBF9F5] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetHeroUpfront}
                disabled={quickSaving || quickUploading}
                className="text-xs text-[#8A857B] hover:text-[#18222B] font-semibold underline cursor-pointer"
              >
                Reset to default
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowHeroQuickEdit(false)}
                  className="px-4 py-2 rounded-xl border border-[#D5CEBF] text-xs font-bold text-[#18222B] hover:bg-black/5 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveHeroUpfront}
                  disabled={quickSaving || quickUploading}
                  className="px-5 py-2 rounded-xl bg-[#18222B] text-white text-xs font-bold hover:bg-[#273644] transition cursor-pointer flex items-center gap-1.5"
                >
                  {quickSaving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-floppy-disk" />}
                  <span>{quickSaving ? 'Publishing…' : 'Save & Publish Upfront'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
