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
    kicker: 'Patar Coastal Road · Bolinao, Pangasinan, Philippines',
    headline: 'Where Limestone Cliffs Meet the West Philippine Sea',
    subcopy: 'Private oceanfront villas perched above Bolinao’s sculpted coral coves—combining coastal sanctuary serenity with instant, conflict-free direct booking.',
    badge: 'Cape Bolinao Lighthouse Vista'
  },
  {
    kicker: '4 Minutes to Patar White Beach · Private Coral Steps',
    headline: 'Sculpted Coral Coves & Golden-Hour Verandas',
    subcopy: 'Step directly from your cantilevered limestone terrace into crystal snorkeling lagoons, followed by sunset dining curated by our coastal hospitality staff.',
    badge: 'Patar Natural Tidal Pools'
  },
  {
    kicker: 'Punta Piedra Ridge · Pristine Oceanfront Living',
    headline: 'Panoramic Horizons & Five-Star Sanctuary Serenity',
    subcopy: 'From oceanview cottages to spacious family suites, every stay includes Wi-Fi, backup solar power, and seamless smart keypad arrival.',
    badge: 'Sunset Villa Deck'
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

function getInitialReservations(roomsList: Room[]): ReservationWindow[] {
  const chason = roomsList.find((r) => /chason/i.test(r.name)) || roomsList[0];
  const sunset = roomsList.find((r) => /sunset/i.test(r.name)) || roomsList.find((r) => /unit\s*5/i.test(r.name));
  const list: ReservationWindow[] = [];
  if (chason) {
    list.push({
      id: `res-chason-nov2026`,
      room_id: String(chason.id),
      check_in: '2026-11-17',
      check_out: '2026-11-28',
      status: 'confirmed',
    });
  }
  if (sunset && sunset.id !== chason?.id) {
    list.push({
      id: `res-sunset-nov2026`,
      room_id: String(sunset.id),
      check_in: '2026-11-13',
      check_out: '2026-11-14',
      status: 'confirmed',
    });
  }
  return list;
}

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

  const isStaffOrAdmin = Boolean(
    isAdminAuthenticated ||
    isStaffAuthenticated ||
    (adminProfile && ['administrator', 'admin', 'staff', 'superadmin'].includes(adminProfile.role)) ||
    (staffProfile && ['staff', 'receptionist', 'accounting', 'housekeeping', 'operations'].includes(staffProfile.role)) ||
    (typeof window !== 'undefined' && (sessionStorage.getItem('jd_admin_session') || sessionStorage.getItem('jd_staff_session')))
  );

  // Application Data States (Live Supabase)
  const [rooms, setRooms] = useState<Room[]>(FALLBACK_ROOMS);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('chason-room');
  // Visual multi-select: rooms the guest has toggled on. Booking uses selectedRoomIds[0] as the primary room.
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(['chason-room']);
  const [activeLodgingCategory, setActiveLodgingCategory] = useState<'room' | 'cottage'>('room');
  const [reservations, setReservations] = useState<ReservationWindow[]>(() => getInitialReservations(FALLBACK_ROOMS));
  const [dbStatus, setDbStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');
  const [dbStatusMessage, setDbStatusMessage] = useState<string>('Connecting…');

  // Active Hero Slide
  const [heroSlide, setHeroSlide] = useState<number>(0);
  // Admin-managed hero image & titles (Page Adjustment).
  const pageMedia = usePageSettings();
  const heroImageUrl = pageMedia.heroImageUrl || '';

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
  const [guests, setGuests] = useState({ adults: 2, children: 0, infants: 0 });
  // Auto-match assigns the best-fitting free room; picking a room yourself switches to manual.
  const [roomMode, setRoomMode] = useState<'auto' | 'manual'>('auto');
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

  // Active Selected Room Object
  const selectedRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId) || rooms[0] || FALLBACK_ROOMS[0];
  }, [rooms, selectedRoomId]);

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

  // Synchronize category with currently active room
  useEffect(() => {
    if (selectedRoom) {
      const type = inferOfferingType(selectedRoom);
      setActiveLodgingCategory(type);
    }
  }, [selectedRoom]);

  // Capacity counts adults and children only.
  const partySize = guests.adults + guests.children;

  // Earliest selectable check-in: today in Manila (the reservation API rejects past dates).
  const todayISO = useMemo(() => getManilaTodayISO(), []);

  // ---------------------------------------------------------------------------
  // 1. SUPABASE DATA FETCH & REALTIME SUBSCRIPTIONS
  // ---------------------------------------------------------------------------
  const fetchLiveReservations = useCallback(async (currentRooms?: Room[]) => {
    // Availability must reflect EVERY guest's bookings, not just the signed-in
    // user's. Row-level security keeps `reservations` owner-only, so read the
    // PII-free `room_availability` view (room_id + dates only) which exposes all
    // active stays. Fall back to the table where the view isn't present.
    const activeRooms = currentRooms || rooms;
    const baseline = getInitialReservations(activeRooms);

    try {
      const { data, error } = await supabase
        .from('room_availability')
        .select('room_id, check_in, check_out, status');
      if (!error && Array.isArray(data) && data.length > 0) {
        const live = data.map((r: any, i: number) => ({
          id: `avail-${r.room_id}-${r.check_in}-${i}`,
          room_id: String(r.room_id),
          check_in: r.check_in,
          check_out: r.check_out,
          status: r.status,
        }));
        const merged = [...baseline];
        for (const res of live) {
          if (!merged.some((m) => m.room_id === res.room_id && m.check_in === res.check_in && m.check_out === res.check_out)) {
            merged.push(res);
          }
        }
        setReservations(merged);
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
      if (!error && Array.isArray(data) && data.length > 0) {
        const live = data.map((r: any) => ({
          id: String(r.id),
          room_id: String(r.room_id),
          check_in: r.check_in,
          check_out: r.check_out,
          status: r.status,
        }));
        const merged = [...baseline];
        for (const res of live) {
          if (!merged.some((m) => m.room_id === res.room_id && m.check_in === res.check_in && m.check_out === res.check_out)) {
            merged.push(res);
          }
        }
        setReservations(merged);
        return;
      }
    } catch (err: any) {
      console.warn('[Supabase Reservations] Fetch warning:', err?.message);
    }
    setReservations(baseline);
  }, [rooms]);

  const fetchLiveRooms = useCallback(async () => {
    try {
      // Active overnight rooms only (tours and offers share the rooms table); capacity comes straight from admin data.
      const mapped = await fetchBookableRooms();
      if (mapped.length > 0) {
        setRooms(mapped);
        const chasonRoom = mapped.find((m) => /chason/i.test(m.name)) || mapped[0];
        setSelectedRoomId((current) => (mapped.some((m) => m.id === current) ? current : chasonRoom.id));
        setSelectedRoomIds((current) => {
          const valid = current.filter((id) => mapped.some((m) => m.id === id));
          return valid.length > 0 ? valid : [chasonRoom.id];
        });
        fetchLiveReservations(mapped);
      }
      setDbStatus('connected');
      setDbStatusMessage('Live sync active');
    } catch (err: any) {
      console.warn('[Supabase Rooms] Using resilient cache fallback:', err?.message);
      setDbStatus('offline');
      setDbStatusMessage('Local Resilient Inventory');
      fetchLiveReservations(FALLBACK_ROOMS);
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
  const isBookedForSelected = useCallback(
    (isoStr: string) => {
      const ids = selectedRoomIds.length ? selectedRoomIds : [selectedRoom.id];
      return ids.some((id) => {
        const roomObj = rooms.find((r) => r.id === id) || selectedRoom;
        return !isRoomFree(roomObj.id, isoStr, addDaysISO(isoStr, 1), reservations);
      });
    },
    [reservations, selectedRoomIds, selectedRoom, rooms]
  );

  // What the calendars show as booked: Always reflects the currently selected room(s) directly
  const isDateBooked = useCallback(
    (isoStr: string) => {
      return isBookedForSelected(isoStr);
    },
    [isBookedForSelected]
  );

  // Check if a date is turnaround (checkout morning of another reservation)
  const isDateTurnaround = useCallback(
    (isoStr: string) => {
      if (!selectedRoom?.id) return false;
      return reservations.some((res) => {
        if (String(res.room_id) !== String(selectedRoom.id)) return false;
        if (res.status === 'cancelled') return false;
        return isoStr === res.check_out;
      });
    },
    [reservations, selectedRoom]
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
    const activeEnd = checkOut ?? (checkIn ? addDaysISO(checkIn, 1) : null);
    if (!checkIn || !activeEnd) return [];
    const ids = selectedRoomIds.length ? selectedRoomIds : [selectedRoom.id];
    return ids
      .map((id) => {
        const room = rooms.find((r) => r.id === id);
        if (!room) return null;
        const conflictingReservations = reservations.filter(
          (res) =>
            String(res.room_id) === String(room.id) &&
            res.status !== 'cancelled' &&
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
  }, [checkIn, checkOut, reservations, selectedRoomIds, selectedRoom.id, rooms, formatStayRangeFriendly]);

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
    if (!detailedConflictKey || detailedConflicts.length === 0) {
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
    } else if (bestFreeRoom) {
      setSelectedRoomIds([bestFreeRoom.id]);
      setSelectedRoomId(bestFreeRoom.id);
    }
    setConflictToast(null);
  }, [checkIn, checkOut, selectedRoomIds, reservations, bestFreeRoom]);

  // Booked nights count for currently active room in the displayed month
  const monthBookedNights = useMemo(() => {
    const daysInMonth = new Date(inlineYM.y, inlineYM.m, 0).getDate();
    const ids = selectedRoomIds.length ? selectedRoomIds : [selectedRoom.id];
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const isoStr = fmtISO(inlineYM.y, inlineYM.m, day);
      const isTaken = ids.some((id) => {
        const roomObj = rooms.find((r) => r.id === id) || selectedRoom;
        return !isRoomFree(roomObj.id, isoStr, addDaysISO(isoStr, 1), reservations);
      });
      if (isTaken) count++;
    }
    return count;
  }, [inlineYM, selectedRoomIds, selectedRoom, rooms, reservations]);

  const selectedCapacity = Number(selectedRoom.capacity) || 0;
  const selectedFits = selectedCapacity > 0 && selectedCapacity >= partySize;
  const reserveBlock: 'capacity' | 'dates' | null = !selectedFits ? 'capacity' : hasRangeConflict ? 'dates' : null;

  // Auto-match follows party size, dates, and live inventory changes.
  useEffect(() => {
    const best = roomRanking.best;
    if (roomMode === 'auto' && best && best.id !== selectedRoomId) {
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
    const targetList = category === 'cottage' ? cottageAccommodations : roomAccommodations;
    if (targetList.length > 0 && !targetList.some((r) => r.id === selectedRoomId)) {
      const bestInCat = roomRanking.options.find(
        (o) => targetList.some((t) => t.id === o.room.id) && o.fit === 'best'
      )?.room;
      const nextRoom = bestInCat || targetList[0];
      chooseRoom(nextRoom.id);
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
    setSelectedRoomIds(selectedRoomId ? [selectedRoomId] : []);
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
    () =>
      pricedRooms.reduce(
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
      ),
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

    if (!isRoomFree(selectedRoom.id, start, end, reservations)) {
      const conflictingRes = reservations.filter(
        (res) =>
          String(res.room_id) === String(selectedRoom.id) &&
          res.status !== 'cancelled' &&
          rangesOverlap(start, end, res.check_in, res.check_out)
      );
      const bookedRange = conflictingRes.length > 0
        ? formatStayRangeFriendly(conflictingRes[0].check_in, conflictingRes[0].check_out)
        : formatShortDate(isoStr);

      const noticeMsg = pickingCheckout
        ? `Selected dates overlap an existing booking for ${selectedRoom.name} (${bookedRange}).`
        : `${formatFullDate(isoStr)} is already booked for ${selectedRoom.name} (${bookedRange}).`;

      setCalendarNotice(noticeMsg);
      const altCandidate = rooms.find(
        (r) => r.id !== selectedRoom.id && isRoomFree(r.id, start, end, reservations)
      ) || (bestFreeRoom && bestFreeRoom.id !== selectedRoom.id ? bestFreeRoom : null);
      triggerCaution(selectedRoom.name, bookedRange, altCandidate);
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
              <span className="text-[9px] font-bold text-rose-700 uppercase">Booked</span>
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
      const isSelectedIn = isoStr === checkIn;
      const isSelectedOut = isoStr === checkOut;
      const isInRange = checkIn && checkOut && isoStr > checkIn && isoStr < checkOut;

      let cellClass = 'cal-box-open cursor-pointer';
      if (isPast) cellClass = 'cal-box-past';
      else if (isSelectedIn || isSelectedOut) cellClass = 'cal-box-selected';
      else if (isInRange) cellClass = 'cal-box-range';
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
    if (reserveBlock) {
      setCardDrawer('room');
      document.getElementById('reserve-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        downpayment_php: 0,
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

    setBookingRef(reference);
    setSmartPin(pin);
    setSavedBooking(record);
    await fetchLiveReservations();
    setReserveSubmitting(false);
    setReserveStep('success');
  };

  // Gallery Photos for Bento Grid
  const galleryPhotos = selectedRoom.images && selectedRoom.images.length >= 5
    ? selectedRoom.images
    : [
        selectedRoom.image_url || '/images/cottage.jpg',
        '/images/suite.jpg',
        '/images/villa.jpg',
        '/images/island.jpg',
        '/images/garden.jpg'
      ];

  return (
    <div className="bg-[#FFFFFF] text-[#222222] min-h-screen selection:bg-[#222222] selection:text-[#FFFFFF]">

      {/* =====================================================================
           HEADER: CLEAN SINGLE STICKY WHITE HEADER (76px Height)
           ===================================================================== */}
      {!embedded && (
      <header className="sticky top-0 z-40 h-[76px] bg-[#FFFFFF] border-b border-[#EBEBEB]">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">
          
          {/* Left: Custom ROCK VIEW Geometric Cliff-and-Wave Emblem + Title */}
          <Link to="/" className="flex items-center gap-3 group" aria-label="ROCK VIEW Bolinao">
            <svg viewBox="0 0 40 40" className="w-9 h-9 text-[#9E7E46] shrink-0 transition-transform duration-300 group-hover:scale-105" fill="none">
              <rect x="2" y="2" width="36" height="36" rx="8" stroke="currentColor" stroke-width="1.6"/>
              <path d="M7 26L15.5 11.5C16 10.7 17.1 10.7 17.6 11.5L22.2 19.2L25.4 14.5C25.9 13.8 26.9 13.8 27.4 14.5L33 26" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="28" cy="10" r="2.2" fill="currentColor" fill-opacity="0.75"/>
              <path d="M6 30.5C10.5 28.4 15 32.6 20 30.5C25 28.4 29.5 32.6 34 30.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <div>
              <div className="font-serif-luxury text-lg sm:text-xl font-bold tracking-[0.14em] text-[#18222B] leading-none">
                ROCK VIEW
              </div>
              <div className="text-[9px] sm:text-[10px] font-semibold tracking-[0.22em] text-[#9E7E46] uppercase mt-1">
                BOLINAO, PANGASINAN
              </div>
            </div>
          </Link>

          {/* Right: User / Client Access */}
          <div className="flex items-center gap-3">
            {signedInGuest && (
              <Link
                to="/user/bookings"
                className="text-xs text-[#6A6A6A] hover:text-[#18222B] font-medium transition hidden sm:inline-block"
              >
                My Bookings
              </Link>
            )}
            <Link
              to={signedInGuest ? '/user/bookings' : '/client/login'}
              className="px-5 py-2.5 rounded-lg bg-[#18222B] hover:bg-[#273644] text-white text-xs sm:text-sm font-semibold tracking-wide transition shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.9">
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
           HERO SECTION: 3 ATMOSPHERIC SLIDES & OVERLAID QUICK SEARCH BAR
           ===================================================================== */}
      {!embedded && (
      <section className="relative overflow-hidden bg-[#18222B] text-white">
        {/* Animated Background Vector Art */}
        <div className="absolute inset-0 pointer-events-none">
          <svg viewBox="0 0 1440 620" preserveAspectRatio="xMidYMid slice" className="w-full h-full" fill="none">
            <defs>
              <linearGradient id="heroSkyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#131E29"/>
                <stop offset="38%" stopColor="#254259"/>
                <stop offset="72%" stopColor="#9E6A4B"/>
                <stop offset="100%" stopColor="#D99B66"/>
              </linearGradient>
              <radialGradient id="heroSunGlow" cx="50%" cy="52%" r="36%">
                <stop offset="0%" stopColor="#FFF2CC" stopOpacity="0.88"/>
                <stop offset="45%" stopColor="#F4B860" stopOpacity="0.38"/>
                <stop offset="100%" stopColor="#F4B860" stopOpacity="0"/>
              </radialGradient>
              <linearGradient id="heroSeaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1A3B4C"/>
                <stop offset="50%" stopColor="#132B38"/>
                <stop offset="100%" stopColor="#0D1D26"/>
              </linearGradient>
            </defs>
            <rect width="1440" height="620" fill="url(#heroSkyGrad)"/>
            <circle cx="720" cy="315" r="240" fill="url(#heroSunGlow)" className="animate-sun-glow"/>
            <circle cx="720" cy="315" r="56" fill="#FFF7DF" fillOpacity="0.85"/>
            <rect x="0" y="325" width="1440" height="295" fill="url(#heroSeaGrad)"/>
            <g className="animate-wave-slow">
              <path d="M560 350 Q 720 342, 880 350" stroke="#FFE3A3" strokeWidth="2.5" strokeOpacity="0.55" strokeLinecap="round"/>
              <path d="M610 378 Q 720 370, 830 378" stroke="#FFD07B" strokeWidth="2" strokeOpacity="0.42" strokeLinecap="round"/>
              <path d="M0 405 Q 240 390, 480 405 T 960 405 T 1440 405" stroke="#64A6BD" strokeWidth="1.5" strokeOpacity="0.3"/>
            </g>
            {/* Cape Bolinao Silhouette */}
            <path d="M1140 326 L1240 315 L1440 318 L1440 342 L1140 342 Z" fill="#131D24"/>
            <rect x="1212" y="274" width="8" height="42" fill="#1C2933"/>
            <polygon points="1210,274 1222,274 1216,265" fill="#FFE8A3"/>
            <circle cx="1216" cy="270" r="14" fill="#FFF3C4" fillOpacity="0.35"/>
          </svg>
          {heroImageUrl && (
            <img
              src={heroImageUrl}
              alt="Rock View Resort"
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/20 to-[#18222B]/85"></div>
        </div>

        {/* Hero Slide Controls */}
        <button
          onClick={() => setHeroSlide((prev) => (prev === 0 ? HERO_SLIDES.length - 1 : prev - 1))}
          type="button"
          aria-label="Previous slide"
          className="hidden sm:flex absolute left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/35 hover:bg-black/55 border border-white/25 text-white items-center justify-center backdrop-blur-xs transition cursor-pointer"
        >
          ‹
        </button>
        <button
          onClick={() => setHeroSlide((prev) => (prev === HERO_SLIDES.length - 1 ? 0 : prev + 1))}
          type="button"
          aria-label="Next slide"
          className="hidden sm:flex absolute right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/35 hover:bg-black/55 border border-white/25 text-white items-center justify-center backdrop-blur-xs transition cursor-pointer"
        >
          ›
        </button>

        {/* Content Container */}
        <div className="relative z-10 max-w-[1120px] mx-auto px-4 sm:px-6 pt-14 pb-16 sm:pt-20 sm:pb-20 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-xs border border-white/20 text-[11px] font-semibold tracking-[0.22em] uppercase text-[#F3D9A4]">
              <span>{heroSlide === 0 && pageMedia.heroKicker ? pageMedia.heroKicker : HERO_SLIDES[heroSlide].kicker}</span>
            </div>
            {isStaffOrAdmin && (
              <button
                type="button"
                onClick={() => setShowHeroQuickEdit(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#18222B]/85 hover:bg-[#18222B] border border-[#D4B475]/80 text-[#F3D9A4] text-[11px] font-bold backdrop-blur-md transition shadow-md cursor-pointer hover:scale-105 active:scale-95"
                title="Admin: Change headline and background image upfront"
              >
                <i className="fas fa-pen-to-square text-[10px]" />
                <span>Edit Hero Upfront (Admin)</span>
              </button>
            )}
          </div>

          <h1 className="font-serif-luxury text-3xl sm:text-5xl lg:text-[54px] font-semibold tracking-tight text-white leading-[1.14] max-w-3xl mx-auto drop-shadow-sm">
            {heroSlide === 0 && pageMedia.heroHeadline ? pageMedia.heroHeadline : HERO_SLIDES[heroSlide].headline}
          </h1>

          <p className="mt-4 text-sm sm:text-base text-white/85 max-w-2xl mx-auto leading-relaxed">
            {heroSlide === 0 && pageMedia.heroSubtitle ? pageMedia.heroSubtitle : HERO_SLIDES[heroSlide].subcopy}
          </p>

          {/* Dots */}
          <div className="mt-5 flex items-center justify-center gap-2">
            {HERO_SLIDES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setHeroSlide(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  heroSlide === idx ? 'w-6 bg-[#D4B475]' : 'w-2 bg-white/40 hover:bg-white/75'
                }`}
              />
            ))}
          </div>

          {/* Overlaid Frosted Quick-Search & Availability Bar */}
          <div className="mt-8 max-w-4xl mx-auto bg-white/95 backdrop-blur-md text-[#222222] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.32)] border border-white/60 p-3 sm:p-4 text-left">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              
              {/* Accommodation Selector */}
              <div className="md:col-span-4 px-3 py-2 rounded-xl bg-[#F8F7F4] border border-[#E5E0D5]">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#9E7E46]">
                  Select Accommodation
                </label>
                <select
                  value={roomMode === 'auto' ? '__auto' : selectedRoomId}
                  onChange={(e) => (e.target.value === '__auto' ? enableAutoMatch() : chooseRoom(e.target.value))}
                  aria-label="Select accommodation"
                  className="w-full bg-transparent text-xs sm:text-sm font-bold text-[#18222B] mt-0.5 focus:outline-none cursor-pointer"
                >
                  <option value="__auto">
                    {`Best match for ${partySize} ${partySize === 1 ? 'guest' : 'guests'}${roomRanking.best ? ` — ${roomRanking.best.name}` : ''}`}
                  </option>
                  <optgroup label="Rooms">
                    {roomRanking.options
                      .filter((option) => inferOfferingType(option.room) === 'room')
                      .map((option) => (
                        <option key={option.room.id} value={option.room.id} disabled={!option.fitsParty}>
                          {`${option.room.name} — up to ${option.capacity} · ${formatPHP(option.room.rate_php || 3500)}/night${
                            option.fit === 'booked' ? ' · booked on your dates' : option.fit === 'too-small' ? ' · too small' : ''
                          }`}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Cottages">
                    {roomRanking.options
                      .filter((option) => inferOfferingType(option.room) === 'cottage')
                      .map((option) => (
                        <option key={option.room.id} value={option.room.id} disabled={!option.fitsParty}>
                          {`${option.room.name} — up to ${option.capacity} · ${formatPHP(option.room.rate_php || 3500)}/night${
                            option.fit === 'booked' ? ' · booked on your dates' : option.fit === 'too-small' ? ' · too small' : ''
                          }`}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              {/* Stay Dates */}
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('calendar-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="md:col-span-3 px-3 py-2 rounded-xl bg-[#F8F7F4] hover:bg-[#F0EDE6] border border-[#E5E0D5] text-left transition cursor-pointer"
              >
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#9E7E46]">
                  Stay Dates
                </span>
                <span className="block text-xs sm:text-sm font-bold text-[#18222B] mt-0.5 truncate">
                  {checkIn && checkOut
                    ? `${formatShortDate(checkIn)} – ${formatShortDate(checkOut)} (${totalNights}n)`
                    : checkIn
                    ? `${formatShortDate(checkIn)} (Select Out)`
                    : 'Select stay dates'}
                </span>
              </button>

              {/* Party Size Stepper */}
              <div className="md:col-span-3 px-3 py-2 rounded-xl bg-[#F8F7F4] border border-[#E5E0D5] flex items-center justify-between">
                <div>
                  <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#9E7E46]">
                    Party Size
                  </span>
                  <span className="block text-xs sm:text-sm font-bold text-[#18222B] mt-0.5">
                    {partySize} {partySize === 1 ? 'guest' : 'guests'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => changeAdults(-1)}
                    disabled={guests.adults <= 1}
                    aria-label="Remove a guest"
                    className="w-7 h-7 rounded-full border border-[#C9C2B4] bg-white hover:border-[#18222B] text-sm font-bold flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => changeAdults(1)}
                    disabled={partySize >= maxCapacity}
                    aria-label="Add a guest"
                    title={partySize >= maxCapacity ? `Our largest room fits ${maxCapacity} guests` : undefined}
                    className="w-7 h-7 rounded-full border border-[#C9C2B4] bg-white hover:border-[#18222B] text-sm font-bold flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Check Availability CTA */}
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('calendar-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="btn-gold-luxury w-full h-12 rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-xs px-3 cursor-pointer"
                >
                  Check Availability
                </button>
              </div>
            </div>

            {/* Live Status Line */}
            <div className="mt-2.5 pt-2 border-t border-[#ECE7DD] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-semibold text-emerald-700 flex items-center gap-1.5">
                <span>✓</span>
                <span>Live availability · Select your dates below</span>
              </div>
              <Link
                to={signedInGuest ? '/client' : '/client/login'}
                className="text-[#9E7E46] hover:underline font-semibold"
              >
                {signedInGuest ? 'Open your guest dashboard →' : 'Registered Guest? Sign in to User Portal →'}
              </Link>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* =====================================================================
           UNIFIED BOOKING WORKSPACE
           ===================================================================== */}
      <main id="booking-workspace" className="max-w-[1120px] mx-auto px-4 sm:px-6 pt-8 pb-16">

        {/* Accommodation Selection Tabs by Category */}
        <div className="mb-6 space-y-3">
          {/* Two Categories: Room & Cottage */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="inline-flex items-center p-1 bg-[#F5F2EB] rounded-2xl border border-[#E5E0D5]">
              <button
                type="button"
                onClick={() => handleCategorySwitch('room')}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeLodgingCategory === 'room'
                    ? 'bg-[#18222B] text-white shadow-xs'
                    : 'text-[#6A6A6A] hover:text-[#222222]'
                }`}
              >
                <span>🛏️ Rooms</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  activeLodgingCategory === 'room' ? 'bg-white/20 text-white' : 'bg-[#EAE6DF] text-[#6A6A6A]'
                }`}>
                  {roomAccommodations.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleCategorySwitch('cottage')}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeLodgingCategory === 'cottage'
                    ? 'bg-[#18222B] text-white shadow-xs'
                    : 'text-[#6A6A6A] hover:text-[#222222]'
                }`}
              >
                <span>🏡 Cottages</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  activeLodgingCategory === 'cottage' ? 'bg-white/20 text-white' : 'bg-[#EAE6DF] text-[#6A6A6A]'
                }`}>
                  {cottageAccommodations.length}
                </span>
              </button>
            </div>

            <div className="text-xs text-[#888888] font-medium hidden sm:flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {activeLodgingCategory === 'room'
                  ? 'Air-conditioned rooms & suites for overnight sanctuary stays'
                  : 'Open-air beachfront nipa cottages for day use & coastal relaxation'}
              </span>
            </div>
          </div>

          {/* Accommodation Selection Sub-Tabs for Active Category */}
          <div className="border-b border-[#DDDDDD] flex items-stretch gap-6 sm:gap-8 overflow-x-auto no-scrollbar">
            {displayedAccommodations.map((room) => {
              const isSelected = room.id === selectedRoomId;
              const option = roomRanking.options.find((o) => o.room.id === room.id);
              const activeRangeEnd = checkOut ?? (checkIn ? addDaysISO(checkIn, 1) : null);
              const roomConflicts = (checkIn && activeRangeEnd)
                ? reservations.filter(
                    (res) =>
                      String(res.room_id) === String(room.id) &&
                      res.status !== 'cancelled' &&
                      rangesOverlap(checkIn, activeRangeEnd, res.check_in, res.check_out)
                  )
                : [];
              const isBookedOnDates = roomConflicts.length > 0;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => chooseRoom(room.id)}
                  aria-pressed={isSelected}
                  className={`py-4 text-sm font-semibold whitespace-nowrap transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                    isBookedOnDates && isSelected
                      ? 'border-rose-500 text-rose-950 bg-rose-50/70 rounded-t-lg'
                      : isSelected
                      ? 'border-[#222222] text-[#222222]'
                      : isBookedOnDates
                      ? 'border-transparent text-rose-700/80 hover:text-rose-950 hover:bg-rose-50/30'
                      : 'border-transparent text-[#6A6A6A] hover:text-[#222222]'
                  }`}
                >
                  <span>{room.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isSelected ? 'bg-[#18222B] text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {formatPHP(room.rate_php || 3500)}
                  </span>
                  {isBookedOnDates ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 animate-pulse">
                      <span className="text-rose-600">⚠️</span> Booked
                    </span>
                  ) : checkIn ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <span>✓</span> Available
                    </span>
                  ) : option ? (
                    <span className={`text-[11px] font-semibold ${FIT_TONE[option.fit]}`}>
                      {fitLabel(option.fit, option.capacity, partySize, true)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Listing Title Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-[22px] sm:text-[26px] font-semibold text-[#222222] tracking-[-0.02em] leading-snug">
              {selectedRoom.name} · {inferOfferingType(selectedRoom) === 'cottage' ? 'Beachfront Coastal Cottage' : 'Oceanfront Sanctuary Villa'}
            </h2>
            <div className="text-[11px] font-mono text-[#888888] mt-0.5">
              {inferOfferingType(selectedRoom) === 'cottage' ? 'Cottage' : 'Room'} Code: {selectedRoom.id} · Verified live inventory
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Link copied to clipboard!');
                }
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#F7F7F7] text-sm font-semibold text-[#222222] underline transition cursor-pointer"
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M10 3v9.5M6.5 6.5L10 3l3.5 3.5M4 12v4a1 1 0 001 1h10a1 1 0 001-1v-4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Share
            </button>
            <button
              type="button"
              onClick={() => setIsSaved(!isSaved)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#F7F7F7] text-sm font-semibold text-[#222222] underline transition cursor-pointer"
            >
              <svg viewBox="0 0 20 20" className={`w-4 h-4 transition-colors ${isSaved ? 'text-rose-600 fill-rose-600' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M10 17.2s-6.2-4-6.2-8.7A3.6 3.6 0 0110 5.8a3.6 3.6 0 016.2 2.7c0 4.7-6.2 8.7-6.2 8.7z" strokeLinejoin="round"/>
              </svg>
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>

        {/* 1+4 Bento Media Grid */}
        <section className="relative mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 h-[280px] sm:h-[360px] md:h-[420px] rounded-[12px] overflow-hidden">
            
            {/* Slot 0 (Hero Image) */}
            <div
              onClick={() => {
                setTourIndex(0);
                setShowPhotoTour(true);
              }}
              className="coastal-slot slot-sky-sunset h-full p-5 flex flex-col justify-between cursor-pointer group"
            >
              <img
                src={galleryPhotos[0]}
                alt="Primary Oceanfront View"
                className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 z-0" />
              <div className="relative z-10 flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-xs text-white text-xs font-medium">
                  Oceanfront Living Deck
                </span>
              </div>
              <div className="relative z-10 text-white">
                <p className="text-sm font-medium drop-shadow-xs">
                  Direct coastal sanctuary view in Bolinao, Pangasinan
                </p>
              </div>
            </div>

            {/* 2x2 Secondary Grid */}
            <div className="hidden md:grid grid-cols-2 grid-rows-2 gap-2 h-full">
              {galleryPhotos.slice(1, 5).map((imgUrl, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setTourIndex(idx + 1);
                    setShowPhotoTour(true);
                  }}
                  className="coastal-slot slot-lagoon-teal p-3.5 flex flex-col justify-between cursor-pointer group"
                >
                  <img
                    src={imgUrl}
                    alt={`Resort View ${idx + 2}`}
                    className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/15 z-0" />
                  <span className="relative z-10 self-start px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-xs text-white text-[11px] font-medium">
                    {idx === 0 ? 'Sunset Veranda' : idx === 1 ? 'Sanctuary Suite' : idx === 2 ? 'Horizon Vantage' : 'Coral Steps'}
                  </span>
                  <span className="relative z-10 text-white text-xs font-medium truncate">
                    {selectedRoom.name} Interior &amp; Grounds
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Right Floating Action */}
          <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
            <button
              onClick={() => {
                setTourIndex(0);
                setShowPhotoTour(true);
              }}
              type="button"
              className="px-4 py-2 rounded-lg bg-[#FFFFFF] hover:bg-[#F7F7F7] text-[#222222] text-xs font-semibold border border-[#222222] shadow-sm flex items-center gap-2 transition cursor-pointer"
            >
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-[#222222]" fill="currentColor">
                <circle cx="3" cy="3" r="1.3"/><circle cx="8" cy="3" r="1.3"/><circle cx="13" cy="3" r="1.3"/>
                <circle cx="3" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="13" cy="8" r="1.3"/>
                <circle cx="3" cy="13" r="1.3"/><circle cx="8" cy="13" r="1.3"/><circle cx="13" cy="13" r="1.3"/>
              </svg>
              Show all photos
            </button>
          </div>
        </section>

        {/* =====================================================================
             TWO-COLUMN WORKSPACE: 65% LEFT NARRATIVE / 35% RIGHT STICKY CARD
             ===================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* LEFT COLUMN (~65%) */}
          <div className="lg:col-span-7 xl:col-span-8">
            
            {/* Specs Header */}
            <div className="pb-6 border-b border-[#DDDDDD]">
              <h3 className="text-[20px] sm:text-[22px] font-semibold text-[#222222] leading-snug">
                Coastal Accommodation in Bolinao, Pangasinan
              </h3>
              <p className="text-[15px] text-[#222222] mt-1">
                Up to {selectedCapacity} guests · {selectedRoom.beds_count || 2} bedrooms · {selectedRoom.beds_count || 2} beds · {selectedRoom.baths_count || 1} private bath
              </p>
            </div>

            {/* Sanctuary Highlight Card */}
            <div className="my-6 border border-dashed border-[#CBD5E1] bg-[#FAFAFA] rounded-[12px] px-[22px] py-[18px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-[44px] h-[44px] rounded-[10px] border border-[#FDE68A] bg-[#FEF3C7] flex items-center justify-center text-[#D97706] shrink-0">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#F59E0B" stroke="#D97706" strokeWidth="1.2">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="text-xs sm:text-sm font-bold text-[#18222B]">
                    Guest Favorite · Highly Rated Stay
                  </div>
                  <div className="text-xs text-[#64748B]">
                    “Breathtaking sea views, immaculate coastal villas, and wonderfully peaceful atmosphere.”
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-5 sm:pl-5 sm:border-l border-[#E2E8F0] shrink-0">
                <div className="text-center min-w-[52px]">
                  <div className="text-base font-bold text-[#18222B] leading-none">4.9 ★</div>
                  <div className="text-[11px] font-medium text-[#64748B] mt-1.5">Rating</div>
                </div>
                <div className="h-8 w-px bg-[#E2E8F0]"></div>
                <div className="text-center min-w-[52px]">
                  <div className="text-base font-bold text-[#18222B] leading-none">{rooms.length}</div>
                  <div className="text-[11px] font-medium text-[#64748B] mt-1.5">Villas</div>
                </div>
              </div>
            </div>

            {/* 3 Property Highlights */}
            <div className="py-6 border-t border-b border-[#DDDDDD] space-y-5">
              <div className="flex items-start gap-4">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#222222] shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="5" y="3" width="14" height="18" rx="2"/>
                  <circle cx="9.5" cy="8.5" r="1"/><circle cx="14.5" cy="8.5" r="1"/>
                  <circle cx="9.5" cy="12.5" r="1"/><circle cx="14.5" cy="12.5" r="1"/>
                  <path d="M9.5 16.5h5" strokeLinecap="round"/>
                </svg>
                <div>
                  <h5 className="text-[15px] font-semibold text-[#222222]">Self check-in &amp; Smart Arrival</h5>
                  <p className="text-sm text-[#6A6A6A] mt-0.5">Check yourself in seamlessly with verified keypad PIN issued upon booking.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#222222] shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M3 16c3-2 6 2 9 0s6 2 9 0M3 20c3-2 6 2 9 0s6 2 9 0M4 12l5.5-7L14 11l3-4 3 5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div>
                  <h5 className="text-[15px] font-semibold text-[#222222]">Direct limestone cliff &amp; cove access</h5>
                  <p className="text-sm text-[#6A6A6A] mt-0.5">Private carved coral steps lead straight to crystal snorkeling waters, 4 minutes from Patar White Beach.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#222222] shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="3" y="4" width="18" height="17" rx="2"/>
                  <path d="M8 2v4M16 2v4M3 10h18" strokeLinecap="round"/>
                </svg>
                <div>
                  <h5 className="text-[15px] font-semibold text-[#222222]">Free cancellation within 5 hours of booking</h5>
                  <p className="text-sm text-[#6A6A6A] mt-0.5">Change your mind within 5 hours and cancel yourself from your dashboard. After that, the front desk handles cancellations.</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="py-6 border-b border-[#DDDDDD]">
              <div className="text-[15px] text-[#222222] leading-[1.6] space-y-4">
                <p>{selectedRoom.description}</p>
                <p className="text-sm text-[#6A6A6A]">
                  Equipped with high-speed Wi-Fi, solar microgrid power backup, and complimentary tropical breakfast prepared daily by our local staff.
                </p>
              </div>
            </div>

            {/* Bedroom Cards */}
            <div className="py-7 border-b border-[#DDDDDD]">
              <h4 className="text-[22px] font-semibold text-[#222222] mb-5">Where you'll sleep</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-[#DDDDDD] bg-[#FAFAFA] space-y-2">
                  <div className="w-6 h-6 text-[#18222B]">🛏️</div>
                  <div className="text-sm font-bold text-[#18222B]">Primary Bedroom</div>
                  <div className="text-xs text-[#6A6A6A]">1 Queen Bed · Ocean View</div>
                </div>
                <div className="p-4 rounded-xl border border-[#DDDDDD] bg-[#FAFAFA] space-y-2">
                  <div className="w-6 h-6 text-[#18222B]">🛋️</div>
                  <div className="text-sm font-bold text-[#18222B]">Living Suite</div>
                  <div className="text-xs text-[#6A6A6A]">1 Daybed · Private Veranda</div>
                </div>
                <div className="p-4 rounded-xl border border-[#DDDDDD] bg-[#FAFAFA] space-y-2">
                  <div className="w-6 h-6 text-[#18222B]">🌅</div>
                  <div className="text-sm font-bold text-[#18222B]">Viewing Deck</div>
                  <div className="text-xs text-[#6A6A6A]">2 Teak Loungers · Sunset Vantage</div>
                </div>
              </div>
            </div>

            {/* Amenities Grid */}
            <div className="py-7 border-b border-[#DDDDDD]">
              <h4 className="text-[22px] font-semibold text-[#222222] mb-5">What this place offers</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-[15px] text-[#222222]">
                {(selectedRoom.amenities || ['Wi-Fi', 'Ocean View', 'Air Conditioning', 'Private Bath']).map((amenity, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-5 h-5 text-[#9E7E46]">✦</span>
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* =================================================================
                 SHANGRI-LA BORACAY DUAL-MONTH RECTANGULAR BOX CALENDAR
                 ================================================================= */}
            <div id="calendar-section" className="py-7">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-[22px] font-semibold text-[#222222]">
                    Select stay dates
                  </h4>
                  <p className="text-sm text-[#6A6A6A] mt-0.5">
                    Rock View Beach Resort · 2-night minimum on coastal weekends
                  </p>
                </div>

                {/* Step & Selection Indicator */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-xs font-semibold text-[#222222]">
                    <span className="w-2 h-2 rounded-xs bg-[#222222]"></span>
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
                      className="text-xs font-semibold text-rose-600 hover:text-rose-800 underline cursor-pointer"
                    >
                      Reset to N/A
                    </button>
                  )}
                </div>
              </div>

              {/* Intelligent Caution Warning Popup Modal / Card */}
              {conflictToast && (
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
              <div className="flex flex-wrap items-center justify-between gap-2.5 pb-4 mb-5 border-b border-[#EBEBEB]">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => applyQuickPreset('weekend')}
                    type="button"
                    className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] hover:border-[#222222] bg-white text-xs font-semibold text-[#222222] transition cursor-pointer"
                  >
                    Next Open Weekend
                  </button>
                  <button
                    onClick={() => applyQuickPreset('stay3')}
                    type="button"
                    className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] hover:border-[#222222] bg-white text-xs font-semibold text-[#222222] transition cursor-pointer"
                  >
                    3-Night Stay
                  </button>
                  <button
                    onClick={() => applyQuickPreset('stay5')}
                    type="button"
                    className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] hover:border-[#222222] bg-white text-xs font-semibold text-[#222222] transition cursor-pointer"
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
                    className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] hover:border-[#222222] bg-[#F8FAFC] text-xs font-semibold text-[#222222] focus:outline-none focus:border-[#222222] cursor-pointer"
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
                  className="text-xs sm:text-sm font-semibold text-[#222222] underline hover:text-[#6A6A6A] transition cursor-pointer"
                >
                  Clear dates
                </button>
              </div>

              {/* Single Large Calendar View */}
              <div>
                {/* Single Month Box Card */}
                <div className="cal-month-box p-4 sm:p-6 shadow-sm border border-[#DDDDDD] rounded-2xl bg-white" onMouseLeave={() => setHoverDate(null)}>
                  
                  {/* Big Month Navigation Header */}
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E5E7EB]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setInlineYM(shiftYM(inlineYM, -1))}
                        type="button"
                        aria-label="Previous month"
                        className="px-3 sm:px-4 h-9 sm:h-10 rounded-xl border border-[#CBD5E1] hover:border-[#222222] hover:bg-[#F8FAFC] bg-white flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold text-[#222222] transition cursor-pointer"
                      >
                        ‹ Prev
                      </button>
                      <button
                        onClick={() => setInlineYM(shiftYM(inlineYM, 1))}
                        type="button"
                        aria-label="Next month"
                        className="px-3 sm:px-4 h-9 sm:h-10 rounded-xl border border-[#CBD5E1] hover:border-[#222222] hover:bg-[#F8FAFC] bg-white flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold text-[#222222] transition cursor-pointer"
                      >
                        Next ›
                      </button>
                    </div>

                    <div className="text-center">
                      <h5 className="text-lg sm:text-2xl font-bold text-[#222222] tracking-tight">
                        {MONTH_NAMES[inlineYM.m]} {inlineYM.y}
                      </h5>
                    </div>

                    <span className="text-xs font-semibold text-[#64748B] bg-[#F1F5F9] px-3 py-1.5 rounded-lg border border-[#E2E8F0] hidden sm:inline-block">
                      ₱ / night
                    </span>
                  </div>

                  {/* Weekday Labels (Sun - Sat) */}
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 mb-2 text-center">
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((w, i) => (
                      <div
                        key={i}
                        className={`py-2 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] text-xs sm:text-sm font-bold ${
                          i === 0 || i === 6 ? 'text-[#0F172A]' : 'text-[#475569]'
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
                <div className="mt-5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4 space-y-3">
                  {/* Top Live Status Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-[#E2E8F0] text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="font-bold text-[#0F172A]">
                        Live status for: <span className="underline decoration-indigo-400 font-extrabold">{selectedRoom.name}</span>
                      </span>
                    </div>

                    {hasRangeConflict ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-300">
                        <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                        Selected stay conflicts with booked reservation
                      </span>
                    ) : checkIn && checkOut ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                        Fully available for {formatShortDate(checkIn)} – {formatShortDate(checkOut)}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-[#64748B]">
                        {monthBookedNights > 0
                          ? `${monthBookedNights} booked ${monthBookedNights === 1 ? 'night' : 'nights'} in ${MONTH_NAMES[inlineYM.m]} · ${Math.max(0, new Date(inlineYM.y, inlineYM.m, 0).getDate() - monthBookedNights)} nights open`
                          : `100% available in ${MONTH_NAMES[inlineYM.m]} ${inlineYM.y}`}
                      </span>
                    )}
                  </div>

                  {/* Legend Items */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#475569]">
                    <div className="flex flex-wrap items-center gap-3.5 sm:gap-5">
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#222222]">
                        <span className="w-4 h-4 rounded-[4px] bg-white border border-[#E2E8F0] inline-block shadow-2xs"></span> Available Box
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#222222]">
                        <span className="w-4 h-4 rounded-[4px] bg-[#222222] border border-[#222222] inline-block"></span> Selected IN/OUT
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#0F172A]">
                        <span className="w-4 h-4 rounded-[4px] bg-[#F1F5F9] border border-[#CBD5E1] inline-block"></span> In-Stay Range
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-medium text-rose-700">
                        <span className="w-4 h-4 rounded-[4px] cal-box-booked inline-block"></span> Booked Box
                      </span>
                      {hasRangeConflict && (
                        <span className="inline-flex items-center gap-1.5 font-bold text-rose-800">
                          <span className="w-4 h-4 rounded-[4px] cal-box-conflict inline-block"></span> Conflict Box
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#64748B]">Tap any open date to set stay range</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (~35%): STICKY RESERVATION CARD */}
          <aside
            id="reserve-card"
            className="lg:col-span-5 xl:col-span-4 self-start lg:sticky lg:top-24 scroll-mt-24"
            style={{ position: 'sticky', top: '96px', alignSelf: 'flex-start' }}
          >
            <div className="bg-[#FFFFFF] border border-[#DDDDDD] rounded-[12px] p-6 shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
              
              {/* Price Header */}
              <div className="flex items-baseline justify-between gap-2 mb-5">
                <div>
                  <span className="text-[22px] font-bold text-[#222222]">
                    {formatPHP(selectedRoom.rate_php || 3500)}
                  </span>
                  <span className="text-[15px] text-[#222222] ml-1">/ night</span>
                </div>
                <span className="text-xs font-semibold text-[#6A6A6A]">
                  {selectedRoom.reviews_count ? `★ ${selectedRoom.rating_avg || '5.0'} · ${selectedRoom.reviews_count} reviews` : '★ Direct Verified'}
                </span>
              </div>

              {/* 2x2 Unified Input Box */}
              <div className="border border-[#B0B0B0] rounded-[8px] mb-4 bg-white overflow-hidden">
                <div className="grid grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCardDrawer(cardDrawer === 'calendar' ? 'none' : 'calendar');
                      setActiveField('checkin');
                    }}
                    className={`text-left p-3 hover:bg-[#F7F7F7] transition cursor-pointer ${
                      cardDrawer === 'calendar' && activeField === 'checkin' ? 'cal-input-active' : ''
                    }`}
                  >
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#222222]">
                      CHECK-IN
                    </span>
                    <span className="block text-sm text-[#222222] mt-0.5 font-semibold">
                      {formatSlash(checkIn)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCardDrawer(cardDrawer === 'calendar' ? 'none' : 'calendar');
                      setActiveField('checkout');
                    }}
                    className={`text-left p-3 border-l border-[#B0B0B0] hover:bg-[#F7F7F7] transition cursor-pointer ${
                      cardDrawer === 'calendar' && activeField === 'checkout' ? 'cal-input-active' : ''
                    }`}
                  >
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#222222]">
                      CHECKOUT
                    </span>
                    <span className="block text-sm text-[#222222] mt-0.5 font-semibold">
                      {formatSlash(checkOut)}
                    </span>
                  </button>
                </div>

                {/* Guests Row */}
                <button
                  type="button"
                  onClick={() => setCardDrawer(cardDrawer === 'guests' ? 'none' : 'guests')}
                  aria-expanded={cardDrawer === 'guests'}
                  className={`w-full text-left p-3 border-t border-[#B0B0B0] hover:bg-[#F7F7F7] flex items-center justify-between transition cursor-pointer ${
                    cardDrawer === 'guests' ? 'cal-input-active' : ''
                  }`}
                >
                  <div>
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#222222]">
                      GUESTS
                    </span>
                    <span className="block text-sm text-[#222222] mt-0.5 font-semibold">
                      {partySize} {partySize === 1 ? 'guest' : 'guests'}
                      {guests.infants > 0 && `, ${guests.infants} ${guests.infants === 1 ? 'infant' : 'infants'}`}
                    </span>
                  </div>
                  <span className="text-xs">▾</span>
                </button>

                {/* Room Row: auto-matched to the party, or the guest's own pick */}
                <button
                  type="button"
                  onClick={() => setCardDrawer(cardDrawer === 'room' ? 'none' : 'room')}
                  aria-expanded={cardDrawer === 'room'}
                  className={`w-full text-left p-3 border-t border-[#B0B0B0] hover:bg-[#F7F7F7] flex items-center justify-between gap-3 transition cursor-pointer ${
                    cardDrawer === 'room' ? 'cal-input-active' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <span className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-[#222222]">
                      ROOM
                      {!selectedFits ? (
                        <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-rose-700">TOO SMALL</span>
                      ) : roomMode === 'auto' ? (
                        <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-emerald-700">AUTO-MATCHED</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-slate-600">YOUR PICK</span>
                      )}
                    </span>
                    <span className="block text-sm text-[#222222] mt-0.5 font-semibold truncate">
                      {selectedRoom.name} · up to {selectedCapacity} {selectedCapacity === 1 ? 'guest' : 'guests'}
                    </span>
                  </div>
                  <span className="text-xs shrink-0">▾</span>
                </button>
              </div>

              {/* Inline Calendar Drawer */}
              {cardDrawer === 'calendar' && (
                <div className="mb-4 border border-[#DDDDDD] rounded-[12px] bg-[#FFFFFF] p-3.5 shadow-sm">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#EBEBEB]">
                    <button
                      onClick={() => setPopoverYM(shiftYM(popoverYM, -1))}
                      type="button"
                      className="w-7 h-7 rounded border border-[#CBD5E1] text-xs font-bold cursor-pointer"
                    >
                      ‹
                    </button>
                    <span className="text-xs font-bold text-[#222222]">
                      {MONTH_NAMES[popoverYM.m]} {popoverYM.y}
                    </span>
                    <button
                      onClick={() => setPopoverYM(shiftYM(popoverYM, 1))}
                      type="button"
                      className="w-7 h-7 rounded border border-[#CBD5E1] text-xs font-bold cursor-pointer"
                    >
                      ›
                    </button>
                  </div>
                  <div className="cal-grid-7-compact mb-1 text-center">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
                      <div key={i} className="text-[10px] font-bold text-slate-500">{w}</div>
                    ))}
                  </div>
                  <div className="cal-grid-7-compact">
                    {renderPopoverMonthGrid(popoverYM)}
                  </div>
                </div>
              )}

              {/* Inline Guests Drawer */}
              {cardDrawer === 'guests' && (
                <div className="mb-4 border border-[#DDDDDD] rounded-[12px] bg-[#FFFFFF] p-4 space-y-3.5 shadow-sm">
                  {[
                    { key: 'adults', label: 'Adults', hint: 'Age 13+', value: guests.adults, onMinus: () => changeAdults(-1), onPlus: () => changeAdults(1), canMinus: guests.adults > 1, canPlus: partySize < maxCapacity },
                    { key: 'children', label: 'Children', hint: 'Ages 2–12', value: guests.children, onMinus: () => changeChildren(-1), onPlus: () => changeChildren(1), canMinus: guests.children > 0, canPlus: partySize < maxCapacity },
                    { key: 'infants', label: 'Infants', hint: 'Under 2 · not counted toward capacity', value: guests.infants, onMinus: () => changeInfants(-1), onPlus: () => changeInfants(1), canMinus: guests.infants > 0, canPlus: guests.infants < MAX_INFANTS },
                  ].map((row) => (
                    <div key={row.key} className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#222222]">{row.label}</div>
                        <div className="text-xs text-[#6A6A6A]">{row.hint}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={row.onMinus}
                          disabled={!row.canMinus}
                          type="button"
                          aria-label={`Fewer ${row.label.toLowerCase()}`}
                          className="w-8 h-8 rounded-full border border-[#B0B0B0] flex items-center justify-center font-bold cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                        >
                          −
                        </button>
                        <span className="w-4 text-center font-bold" aria-live="polite">{row.value}</span>
                        <button
                          onClick={row.onPlus}
                          disabled={!row.canPlus}
                          type="button"
                          aria-label={`More ${row.label.toLowerCase()}`}
                          className="w-8 h-8 rounded-full border border-[#B0B0B0] flex items-center justify-center font-bold cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                  <p className="border-t border-[#EBEBEB] pt-3 text-[11px] leading-relaxed text-[#6A6A6A]">
                    Our largest room fits {maxCapacity} guests; for bigger groups, call the front desk.{' '}
                    {roomMode === 'auto' ? 'We match a room to your party automatically.' : `${selectedRoom.name} fits up to ${selectedCapacity}.`}
                  </p>
                  <button
                    onClick={() => setCardDrawer('none')}
                    type="button"
                    className="w-full py-1.5 rounded-lg bg-[#222222] text-white text-xs font-semibold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Inline Room Drawer: auto-match or a manual pick, with live capacity and date availability */}
              {cardDrawer === 'room' && (
                <div className="mb-4 border border-[#DDDDDD] rounded-[12px] bg-[#FFFFFF] p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#222222]">Choose your room</div>
                      <div className="text-xs text-[#6A6A6A] mt-0.5">
                        {partySize} {partySize === 1 ? 'guest' : 'guests'}
                        {checkIn && checkOut ? ` · ${formatShortDate(checkIn)} – ${formatShortDate(checkOut)}` : ' · add dates to check availability'}
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={roomMode === 'auto'}
                      onClick={() => (roomMode === 'auto' ? setRoomMode('manual') : enableAutoMatch())}
                      className="flex items-center gap-2 text-xs font-semibold text-[#222222] cursor-pointer shrink-0"
                    >
                      <span>Auto-match</span>
                      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${roomMode === 'auto' ? 'bg-[#18222B]' : 'bg-[#CBD5E1]'}`}>
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${roomMode === 'auto' ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                      </span>
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[#6A6A6A]">
                    {roomMode === 'auto'
                      ? `We pick the smallest open room that fits ${partySize} ${partySize === 1 ? 'guest' : 'guests'}. `
                      : 'You picked this room. Turn on auto-match to let us choose by party size. '}
                    Capacity follows the resort's live room settings; infants don't count.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-[#64748B]">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-[#93C5FD] bg-[#EFF6FF]" /> Selected</span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-[#FCA5A5] bg-[#FEF2F2]" /> Already booked</span>
                    <span className="inline-flex items-center whitespace-nowrap text-[#94A3B8]">Tap to select or deselect</span>
                  </div>
                  <div className="mt-2 space-y-2 max-h-72 overflow-y-auto no-scrollbar pr-0.5" role="group" aria-label="Rooms">
                    {roomRanking.options.map((option) => {
                      const isSelected = selectedRoomIds.includes(option.room.id);
                      const isBooked = option.fit === 'booked';
                      const isTooSmall = option.fit === 'too-small';
                      const disabled = isTooSmall;
                      const toneClass = isBooked
                        ? 'border-[#FCA5A5] bg-[#FEF2F2] hover:border-rose-400 cursor-pointer'
                        : isSelected
                        ? 'border-[#93C5FD] bg-[#EFF6FF] shadow-[inset_0_0_0_1px_#93C5FD] cursor-pointer'
                        : isTooSmall
                        ? 'border-[#E2E8F0] opacity-55 cursor-not-allowed'
                        : 'border-[#E2E8F0] hover:border-[#94A3B8] cursor-pointer';
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
                          className={`w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition ${toneClass}`}
                        >
                          <img src={option.room.image_url || '/images/cottage.jpg'} alt="" className="h-12 w-14 shrink-0 rounded-lg object-cover bg-slate-100" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="truncate text-sm font-semibold text-[#222222]">{option.room.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
                                  inferOfferingType(option.room) === 'cottage'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {inferOfferingType(option.room) === 'cottage' ? 'Cottage' : 'Room'}
                                </span>
                              </span>
                              <span className="shrink-0 text-xs font-semibold text-[#222222]">
                                {formatPHP(option.room.rate_php || 3500)}
                                <span className="font-normal text-[#6A6A6A]">/night</span>
                              </span>
                            </span>
                            <span className="mt-0.5 flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-[#6A6A6A]">
                                {option.capacity > 0 ? `Up to ${option.capacity} ${option.capacity === 1 ? 'guest' : 'guests'}` : 'Capacity not set'}
                              </span>
                              <span className={`inline-flex items-center gap-1 font-semibold ${isBooked ? 'text-[#DC2626]' : FIT_TONE[option.fit]}`}>
                                {isBooked && (
                                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                                    <path d="M12 2 1 21h22L12 2zm0 13a1 1 0 110 2 1 1 0 010-2zm-1-7h2v5h-2V8z" />
                                  </svg>
                                )}
                                {fitLabel(option.fit, option.capacity, partySize)}
                              </span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#64748B]">
                      <span className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {dbStatus === 'connected' ? 'Live room inventory' : 'Offline room list'}
                    </span>
                    <button
                      onClick={() => setCardDrawer('none')}
                      type="button"
                      className="px-4 py-1.5 rounded-lg bg-[#222222] text-white text-xs font-semibold cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* Capacity and availability guidance */}
              {reserveBlock === 'capacity' && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-950" role="status">
                  <p className="font-semibold">
                    {selectedRoom.name} fits up to {selectedCapacity} {selectedCapacity === 1 ? 'guest' : 'guests'}; your party has {partySize}.
                  </p>
                  <p className="mt-0.5 text-rose-900/80">
                    {bestFreeRoom ? `${bestFreeRoom.name} fits ${bestFreeRoom.capacity} and is open.` : 'Try a different room or fewer guests.'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {bestFreeRoom && (
                      <button type="button" onClick={() => chooseRoom(bestFreeRoom.id)} className="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-700 cursor-pointer">
                        Switch to {bestFreeRoom.name}
                      </button>
                    )}
                    <button type="button" onClick={enableAutoMatch} className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer">
                      Auto-match a room
                    </button>
                  </div>
                </div>
              )}
              {reserveBlock === 'dates' && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-950" role="status">
                  <p className="font-semibold">
                    {bestFreeRoom
                      ? `${conflictRooms.map((r) => r.name).join(' and ') || selectedRoom.name} ${conflictRooms.length > 1 ? 'are' : 'is'} booked on some of these dates.`
                      : `No room for ${partySize} ${partySize === 1 ? 'guest' : 'guests'} is free for every night of these dates.`}
                  </p>
                  <p className="mt-0.5 text-amber-900/80">
                    {bestFreeRoom ? `${bestFreeRoom.name} is open for your whole stay.` : 'Pick different dates to see open rooms.'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {bestFreeRoom && (
                      <button type="button" onClick={() => chooseRoom(bestFreeRoom.id)} className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 cursor-pointer">
                        Switch to {bestFreeRoom.name}
                      </button>
                    )}
                    <button type="button" onClick={clearDates} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold text-amber-800 hover:bg-amber-100 cursor-pointer">
                      Change dates
                    </button>
                  </div>
                </div>
              )}

              {/* Primary Blue Reserve CTA */}
              <button
                type="button"
                onClick={openReserve}
                className="btn-airbnb-reserve w-full h-12 rounded-[8px] text-[15px] font-semibold tracking-wide cursor-pointer flex items-center justify-center"
              >
                {!checkIn || !checkOut
                  ? 'Check availability'
                  : reserveBlock === 'capacity'
                  ? 'Choose a room that fits'
                  : reserveBlock === 'dates'
                  ? 'See open rooms'
                  : 'Reserve'}
              </button>

              <p className="text-center text-xs text-[#6A6A6A] mt-3">
                You won’t be charged yet · Official digital voucher
              </p>

              {/* Fee Breakdown */}
              {checkIn && checkOut && totalNights > 0 ? (
                <div className="mt-5 pt-4 border-t border-[#DDDDDD] space-y-2.5 text-sm text-[#222222]">
                  <div className="flex justify-between">
                    <span className="underline">{formatPHP(selectedRoom.rate_php || 3500)} × {totalNights} nights{pricedRooms.length > 1 ? ` · ${pricedRooms.length} rooms` : ''}</span>
                    <span>{formatPHP(priceBreakdown.nightsTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[#6A6A6A]">
                    <span className="underline">Resort Cleaning Fee</span>
                    <span>{formatPHP(priceBreakdown.cleaningFee)}</span>
                  </div>
                  <div className="flex justify-between text-[#6A6A6A]">
                    <span className="underline">Coastal Conservation Fee</span>
                    <span>{formatPHP(priceBreakdown.coastalFee)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Direct Booking Tourism Tax</span>
                    <span>Waived (₱0)</span>
                  </div>
                  <div className="pt-3 border-t border-[#DDDDDD] flex justify-between font-bold text-base text-[#222222]">
                    <span>Total before taxes</span>
                    <span>{formatPHP(priceBreakdown.grandTotal)}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-5 pt-4 border-t border-[#DDDDDD] text-center text-xs text-[#6A6A6A]">
                  <span>Stay dates default: <strong className="text-[#222222]">N/A</strong> · Select check-in and checkout to see pricing</span>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* =====================================================================
             "WHERE YOU'LL BE" — INTERACTIVE GOOGLE MAPS IFRAME OF BOLINAO
             ===================================================================== */}
        <section id="location-section" className="mt-12 pt-10 border-t border-[#DDDDDD]">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
            <div>
              <h4 className="text-[22px] font-semibold text-[#222222]">Where you'll be</h4>
              <p className="text-[15px] text-[#6A6A6A] mt-0.5">Patar Coastal Road, Bolinao, Pangasinan, Philippines</p>
            </div>
            <a
              href="https://www.google.com/maps/search/?api=1&query=Rock+View+Beach+Resort,+Patar+Road,+Bolinao,+Pangasinan"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#222222] hover:text-[#9E7E46] transition underline shrink-0"
            >
              <span>Open in Google Maps</span>
              <span>↗</span>
            </a>
          </div>

          <div className="h-[360px] sm:h-[440px] rounded-2xl overflow-hidden border border-[#DDDDDD] bg-[#F4EDE2] relative shadow-sm">
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
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-[#475569]">
            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="font-bold text-[#222222] block">Patar Rock Formations</span>
              <span className="text-[11px] text-[#64748B]">Direct access · On site</span>
            </div>
            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="font-bold text-[#222222] block">Patar White Beach</span>
              <span className="text-[11px] text-[#64748B]">4 mins · 1.8 km</span>
            </div>
            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="font-bold text-[#222222] block">Cape Bolinao Lighthouse</span>
              <span className="text-[11px] text-[#64748B]">6 mins · 2.8 km</span>
            </div>
            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="font-bold text-[#222222] block">Enchanted Cave</span>
              <span className="text-[11px] text-[#64748B]">12 mins · 6.2 km</span>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================================
           FOOTER: PURE WHITE LUXURY FOOTER
           ===================================================================== */}
      <footer className="border-t border-[#EBEBEB] bg-[#FFFFFF] py-12 text-[#222222]">
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-start justify-between gap-8">
          <div className="space-y-3 max-w-sm">
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 40 40" className="w-8 h-8 text-[#9E7E46]" fill="none">
                <rect x="2" y="2" width="36" height="36" rx="8" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M7 26L15.5 11.5C16 10.7 17.1 10.7 17.6 11.5L22.2 19.2L25.4 14.5C25.9 13.8 26.9 13.8 27.4 14.5L33 26" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div className="font-serif-luxury text-lg font-bold text-[#18222B]">ROCK VIEW</div>
            </div>
            <p className="text-xs text-[#6A6A6A] leading-relaxed">
              Coastal Sanctuary &amp; Perched Oceanfront Villas. Brgy. Patar, Bolinao, Pangasinan, Philippines. Direct booking with SMS confirmation.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-xs">
            <div className="space-y-2">
              <div className="font-bold text-[#18222B] uppercase tracking-wider">Sanctuary</div>
              <div><a href="#booking-workspace" className="text-[#6A6A6A] hover:underline">Villas</a></div>
              <div><a href="#calendar-section" className="text-[#6A6A6A] hover:underline">Availability</a></div>
              <div><a href="#location-section" className="text-[#6A6A6A] hover:underline">Patar Beach</a></div>
            </div>

            <div className="space-y-2">
              <div className="font-bold text-[#18222B] uppercase tracking-wider">Hospitality</div>
              <div><span className="text-[#6A6A6A]">Wi-Fi</span></div>
              <div><span className="text-[#6A6A6A]">Solar Microgrid</span></div>
              <div><span className="text-[#6A6A6A]">Keypad Entry</span></div>
            </div>

            <div className="space-y-2">
              <div className="font-bold text-[#18222B] uppercase tracking-wider">Portals</div>
              <div><Link to="/user" className="text-[#6A6A6A] hover:underline">User / Member</Link></div>
              <div><Link to="/staff/login" className="text-[#6A6A6A] hover:underline">Staff Operations</Link></div>
              <div><Link to="/admin" className="text-[#6A6A6A] hover:underline">Governance Admin</Link></div>
            </div>
          </div>
        </div>

        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 pt-8 mt-8 border-t border-[#F0F0F0] flex flex-col sm:flex-row items-center justify-between text-xs text-[#888888]">
          <div>© 2026–2027 Rock View Beach Resort. All rights reserved.</div>
          <div className="flex gap-4 mt-2 sm:mt-0">
            <span>Bolinao, Pangasinan</span>
            <span>·</span>
            <span>Direct Reservation System</span>
          </div>
        </div>
      </footer>

      {/* =====================================================================
           MOBILE FIXED BOTTOM BAR
           ===================================================================== */}
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
                    <span>Total</span>
                    <span className="text-[#1D4ED8]">{formatPHP(priceBreakdown.grandTotal)}</span>
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
                      placeholder="e.g. Maria Santos"
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
                    <span>Total</span>
                    <span className="text-[#1D4ED8]">{formatPHP(priceBreakdown.grandTotal)}</span>
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
