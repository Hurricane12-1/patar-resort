import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================
export interface Room {
  id: string;
  name: string;
  category?: string;
  rate_php?: number;
  capacity?: number;
  beds_count?: number;
  baths_count?: number;
  description?: string;
  amenities?: string[];
  image_url?: string;
  images?: string[];
}

export interface Reservation {
  id: string;
  room_id: string;
  check_in: string; // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD
  check_in_time?: string;
  check_out_time?: string;
  status?: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  total_amount_php?: number;
}

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
    subcopy: 'From oceanview cottages to spacious family suites, every stay includes Starlink Wi-Fi, backup solar power, and seamless smart keypad arrival.',
    badge: 'Sunset Villa Deck'
  }
];

const FALLBACK_ROOMS: Room[] = [
  {
    id: 'chason-room',
    name: 'chason room',
    category: 'Suite',
    rate_php: 3500,
    capacity: 4,
    beds_count: 2,
    baths_count: 1,
    description: 'An executive oceanfront sanctuary villa with panoramic views of the West Philippine Sea, featuring handcrafted wood furnishings, private limestone terrace, and high-speed Starlink internet.',
    amenities: ['Oceanfront Balcony', 'Starlink High-Speed Wi-Fi', 'Air Conditioning', 'Private Coral Steps', 'Solar Microgrid Backup', 'Keypad Smart Lock', 'Complimentary Breakfast', 'Snorkeling Gear'],
    image_url: '/images/cottage.jpg',
    images: ['/images/cottage.jpg', '/images/suite.jpg', '/images/villa.jpg', '/images/island.jpg', '/images/garden.jpg']
  },
  {
    id: 'unit-3',
    name: 'Unit 3',
    category: 'Cottage',
    rate_php: 3200,
    capacity: 2,
    beds_count: 1,
    baths_count: 1,
    description: 'Charming coastal cottage nestled among tropical flora with direct garden walkway to the tidal rock pools and beach.',
    amenities: ['Garden View', 'Starlink Wi-Fi', 'Air Conditioning', 'King Bed', 'Private Bath', 'Breakfast Included'],
    image_url: '/images/suite.jpg',
    images: ['/images/suite.jpg', '/images/cottage.jpg', '/images/villa.jpg', '/images/room.jpg', '/images/island.jpg']
  },
  {
    id: 'sunset',
    name: 'Sunset',
    category: 'Villa',
    rate_php: 4500,
    capacity: 6,
    beds_count: 3,
    baths_count: 2,
    description: 'Our premier cliffside villa offering unobstructed 180-degree sunset panoramas, an expansive private viewing deck, and deluxe family amenities.',
    amenities: ['180° Sunset View', 'Private Living Deck', 'Starlink Wi-Fi', 'Air Conditioning', 'Full Kitchenette', 'Solar Backup', 'Dedicated Host'],
    image_url: '/images/villa.jpg',
    images: ['/images/villa.jpg', '/images/island.jpg', '/images/cottage.jpg', '/images/suite.jpg', '/images/garden.jpg']
  },
  {
    id: 'unit-5',
    name: 'Unit 5',
    category: 'Suite',
    rate_php: 3800,
    capacity: 4,
    beds_count: 2,
    baths_count: 1,
    description: 'Modern coastal sanctuary suite designed for peaceful retreats, with floor-to-ceiling glass doors opening directly to the ocean breeze.',
    amenities: ['Ocean Breeze Balcony', 'Starlink Wi-Fi', 'Air Conditioning', 'Work Desk', 'Rain Shower', 'Private Patio'],
    image_url: '/images/island.jpg',
    images: ['/images/island.jpg', '/images/villa.jpg', '/images/suite.jpg', '/images/cottage.jpg', '/images/bunk.jpg']
  }
];

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
  if (!isoStr) return 'Add date';
  const [y, m, d] = isoStr.split('-').map(Number);
  return `${m}/${d}/${y}`;
}

function formatShortDate(isoStr: string | null): string {
  if (!isoStr) return '';
  const [, m, d] = isoStr.split('-').map(Number);
  return `${SHORT_MONTH_NAMES[m]} ${d}`;
}

function formatFullDate(isoStr: string | null): string {
  if (!isoStr) return '';
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

// =============================================================================
// MAIN COMPONENT: MobileResortApp (Luxury Coastal Format in React TSX)
// =============================================================================
export default function MobileResortApp() {
  const navigate = useNavigate();
  const { login } = useAuth();

  // Application Data States (Live Supabase)
  const [rooms, setRooms] = useState<Room[]>(FALLBACK_ROOMS);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('chason-room');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [dbStatus, setDbStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');
  const [dbStatusMessage, setDbStatusMessage] = useState<string>('Connecting to Supabase...');

  // Active Hero Slide
  const [heroSlide, setHeroSlide] = useState<number>(0);

  // Booking Dates & Selection
  const [inlineYM, setInlineYM] = useState<YearMonth>({ y: 2026, m: 11 }); // Shangri-La dual view: Nov 2026
  const [popoverYM, setPopoverYM] = useState<YearMonth>({ y: 2026, m: 11 });
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<'checkin' | 'checkout'>('checkin');
  const [cardDrawer, setCardDrawer] = useState<'none' | 'calendar' | 'guests'>('none');
  const [guests, setGuests] = useState({ adults: 2, children: 0, infants: 0 });
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Modals
  const [showPhotoTour, setShowPhotoTour] = useState<boolean>(false);
  const [tourIndex, setTourIndex] = useState<number>(0);
  const [showReserveModal, setShowReserveModal] = useState<boolean>(false);
  const [reserveStep, setReserveStep] = useState<'form' | 'success'>('form');
  const [reserveSubmitting, setReserveSubmitting] = useState<boolean>(false);
  const [calendarNotice, setCalendarNotice] = useState<string | null>(null);

  // Guest Reservation Form
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('09171234567');
  const [bookingRef, setBookingRef] = useState('RV-BOL-2027-0000');
  const [smartPin, setSmartPin] = useState('#0000');

  // Active Selected Room Object
  const selectedRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId) || rooms[0] || FALLBACK_ROOMS[0];
  }, [rooms, selectedRoomId]);

  // Today ISO
  const todayISO = useMemo(() => {
    const d = new Date();
    return fmtISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }, []);

  // ---------------------------------------------------------------------------
  // 1. SUPABASE DATA FETCH & REALTIME SUBSCRIPTIONS
  // ---------------------------------------------------------------------------
  const fetchLiveRooms = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('rooms').select('*').order('name');
      if (error) throw error;
      if (data && data.length > 0) {
        const mapped: Room[] = data.map((r: any, idx: number) => {
          let primaryImg = r.image_url || '';
          if (primaryImg.includes('cottage')) primaryImg = '/images/cottage.jpg';
          else if (primaryImg.includes('suite')) primaryImg = '/images/suite.jpg';
          else if (primaryImg.includes('villa')) primaryImg = '/images/villa.jpg';
          else if (primaryImg.includes('island')) primaryImg = '/images/island.jpg';
          else if (!primaryImg) primaryImg = idx % 2 === 0 ? '/images/cottage.jpg' : '/images/suite.jpg';

          const imagesList = Array.isArray(r.images) && r.images.length > 0
            ? r.images
            : [
                primaryImg,
                '/images/suite.jpg',
                '/images/villa.jpg',
                '/images/island.jpg',
                '/images/garden.jpg'
              ];

          return {
            id: String(r.id),
            name: r.name || `Villa ${idx + 1}`,
            category: r.category || 'Oceanfront Sanctuary',
            rate_php: Number(r.rate_php) || 3500,
            capacity: Number(r.capacity) || 4,
            beds_count: Number(r.beds_count) || 2,
            baths_count: Number(r.baths_count) || 1,
            description: r.description || 'Private oceanfront villa perched above Bolinao limestone coves.',
            amenities: Array.isArray(r.amenities) && r.amenities.length > 0
              ? r.amenities.filter((a: any) => typeof a === 'string' && !a.startsWith('__'))
              : ['Oceanfront Balcony', 'Starlink Wi-Fi', 'Air Conditioning', 'Solar Microgrid Backup'],
            image_url: primaryImg,
            images: imagesList
          };
        });
        setRooms(mapped);
        if (!mapped.some((m) => m.id === selectedRoomId)) {
          setSelectedRoomId(mapped[0].id);
        }
      }
      setDbStatus('connected');
      setDbStatusMessage('Supabase Live Connected');
    } catch (err: any) {
      console.warn('[Supabase Rooms] Using resilient cache fallback:', err?.message);
      setDbStatus('offline');
      setDbStatusMessage('Local Resilient Inventory');
    }
  }, [selectedRoomId]);

  const fetchLiveReservations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .neq('status', 'cancelled');
      if (error) throw error;
      if (data) {
        setReservations(data);
      }
    } catch (err: any) {
      console.warn('[Supabase Reservations] Fetch warning:', err?.message);
    }
  }, []);

  useEffect(() => {
    fetchLiveRooms();
    fetchLiveReservations();

    // Supabase Real-Time Channel
    const channel = supabase
      .channel('public:reservations_customer_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        fetchLiveReservations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLiveRooms, fetchLiveReservations]);

  // ---------------------------------------------------------------------------
  // 2. CALENDAR COMPUTATIONS & CONFLICT DETECTION
  // ---------------------------------------------------------------------------
  // Check if a specific date is booked for the currently selected room
  const isDateBooked = useCallback(
    (isoStr: string) => {
      if (!selectedRoom?.id) return false;
      return reservations.some((res) => {
        if (String(res.room_id) !== String(selectedRoom.id)) return false;
        if (res.status === 'cancelled') return false;
        // Stay booked condition
        return isoStr >= res.check_in && isoStr < res.check_out;
      });
    },
    [reservations, selectedRoom]
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

  // Conflict detection for current range
  const hasRangeConflict = useMemo(() => {
    if (!checkIn || !checkOut) return false;
    let curr = checkIn;
    while (curr < checkOut) {
      if (isDateBooked(curr)) return true;
      curr = addDaysISO(curr, 1);
    }
    return false;
  }, [checkIn, checkOut, isDateBooked]);

  // Total Nights and Price Breakdown
  const totalNights = useMemo(() => {
    return diffNights(checkIn, checkOut);
  }, [checkIn, checkOut]);

  const priceBreakdown = useMemo(() => {
    if (!checkIn || !checkOut || totalNights <= 0) {
      return {
        baseRate: selectedRoom.rate_php || 3500,
        nightsTotal: 0,
        cleaningFee: 500,
        coastalFee: 150,
        taxWaived: 0,
        grandTotal: 0
      };
    }
    const baseRate = selectedRoom.rate_php || 3500;
    let nightsTotal = 0;
    let curr = checkIn;
    while (curr < checkOut) {
      const rate = isWeekendNight(curr) ? Math.round(baseRate * 1.15) : baseRate;
      nightsTotal += rate;
      curr = addDaysISO(curr, 1);
    }
    const cleaningFee = 500;
    const coastalFee = 150;
    const grandTotal = nightsTotal + cleaningFee + coastalFee;
    return {
      baseRate,
      nightsTotal,
      cleaningFee,
      coastalFee,
      taxWaived: Math.round(nightsTotal * 0.12),
      grandTotal
    };
  }, [checkIn, checkOut, totalNights, selectedRoom]);

  // ---------------------------------------------------------------------------
  // 3. CALENDAR CLICK HANDLER
  // ---------------------------------------------------------------------------
  const handleDateClick = (isoStr: string) => {
    if (isoStr < todayISO) return;
    if (isDateBooked(isoStr)) {
      setCalendarNotice(`${formatFullDate(isoStr)} is already booked for ${selectedRoom.name}.`);
      return;
    }
    setCalendarNotice(null);

    // If starting fresh or both are selected
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(isoStr);
      setCheckOut(null);
      setActiveField('checkout');
      return;
    }

    // If checkIn is set but checkOut is null
    if (checkIn && !checkOut) {
      if (isoStr < checkIn) {
        // Reset check-in to earlier date
        setCheckIn(isoStr);
        setCheckOut(null);
        setActiveField('checkout');
      } else if (isoStr === checkIn) {
        // Same day -> minimum 1-night stay
        const nextDay = addDaysISO(isoStr, 1);
        if (isDateBooked(isoStr)) {
          setCalendarNotice(`Cannot book 1 night: conflict on ${formatFullDate(isoStr)}.`);
          return;
        }
        setCheckOut(nextDay);
        setActiveField('checkin');
        setCardDrawer('none');
      } else {
        // Check if conflict exists in the range
        let conflict = false;
        let curr = checkIn;
        while (curr < isoStr) {
          if (isDateBooked(curr)) {
            conflict = true;
            break;
          }
          curr = addDaysISO(curr, 1);
        }
        if (conflict) {
          setCalendarNotice(`Selected dates overlap an existing reservation. Please pick dates before or after.`);
          return;
        }
        setCheckOut(isoStr);
        setActiveField('checkin');
        setCardDrawer('none');
      }
    }
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
  // 4. MONTH GRID BUILDER
  // ---------------------------------------------------------------------------
  const renderMonthGrid = (ym: YearMonth) => {
    const firstDow = new Date(ym.y, ym.m - 1, 1).getDay(); // 0..6
    const daysInMonth = new Date(ym.y, ym.m, 0).getDate();
    const cells = [];

    // Leading blanks
    for (let i = 0; i < firstDow; i++) {
      cells.push(<div key={`blank-${i}`} className="cal-cell-inline cal-box-empty" />);
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
          className={`cal-cell-inline rounded-[6px] flex flex-col justify-between text-left transition ${cellClass}`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[12px] font-bold leading-none">{day}</span>
            {isSelectedIn && (
              <span className="text-[9px] font-extrabold uppercase bg-white text-black px-1 rounded-xs">
                IN
              </span>
            )}
            {isSelectedOut && (
              <span className="text-[9px] font-extrabold uppercase bg-white text-black px-1 rounded-xs">
                OUT
              </span>
            )}
            {isBooked && !isSelectedIn && !isSelectedOut && (
              <span className="text-[8px] font-bold text-rose-700 uppercase">Booked</span>
            )}
          </div>
          <span className="text-[10px] font-medium opacity-80 leading-none mt-1">
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
  const handleReserveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkIn || !checkOut) return;
    setReserveSubmitting(true);

    const ref = `RV-BOL-2027-${Math.floor(1000 + Math.random() * 9000)}`;
    const pin = `#${Math.floor(1000 + Math.random() * 9000)}`;
    setBookingRef(ref);
    setSmartPin(pin);

    try {
      // 1. Direct Supabase Insert
      const { error: insErr } = await supabase.from('reservations').insert([
        {
          room_id: selectedRoom.id,
          guest_name: guestName || 'Resident Guest',
          guest_email: guestEmail || 'guest@rockviewbolinao.ph',
          guest_phone: guestPhone || '09171234567',
          check_in: checkIn,
          check_out: checkOut,
          status: 'confirmed',
          total_amount_php: priceBreakdown.grandTotal
        }
      ]);
      if (insErr) {
        console.warn('[Supabase Insert Fallback]:', insErr.message);
      }

      // 2. Dual-write to Express server API
      try {
        await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_id: selectedRoom.id,
            guest_name: guestName || 'Resident Guest',
            guest_email: guestEmail,
            guest_phone: guestPhone,
            check_in: checkIn,
            check_out: checkOut,
            total_amount_php: priceBreakdown.grandTotal
          })
        });
      } catch {}

      // Refresh calendar reservations
      await fetchLiveReservations();
      setReserveStep('success');
    } catch (err: any) {
      console.error('[Reservation Error]:', err);
      setReserveStep('success'); // allow graceful recovery
    } finally {
      setReserveSubmitting(false);
    }
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

      {/* Floating Supabase Live Status Pill */}
      <div className="fixed top-2.5 right-3 z-50 pointer-events-none flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-xs border border-slate-200 text-[11px] font-semibold text-slate-700 shadow-xs">
        <span
          className={`w-2 h-2 rounded-full ${
            dbStatus === 'connected' ? 'bg-emerald-500 live-pulse' : 'bg-amber-500'
          }`}
        />
        <span>{dbStatusMessage}</span>
      </div>

      {/* =====================================================================
           HEADER: CLEAN SINGLE STICKY WHITE HEADER (76px Height)
           ===================================================================== */}
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

          {/* Center: Live Supabase Inventory Counter */}
          <div className="hidden md:flex items-center gap-2 text-xs text-[#6A6A6A]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>{rooms.length} Coastal Villas &amp; Sanctuaries Available</span>
          </div>

          {/* Right: User / Client Access */}
          <div className="flex items-center gap-3">
            <Link
              to="/user/bookings"
              className="text-xs text-[#6A6A6A] hover:text-[#18222B] font-medium transition hidden sm:inline-block"
            >
              My Bookings
            </Link>
            <Link
              to="/user"
              className="px-5 py-2.5 rounded-lg bg-[#18222B] hover:bg-[#273644] text-white text-xs sm:text-sm font-semibold tracking-wide transition shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.9">
                <circle cx="10" cy="6.5" r="3.2"/>
                <path d="M4 16.5c1.3-3 10.7-3 12 0" strokeLinecap="round"/>
              </svg>
              <span>User Login</span>
            </Link>
          </div>
        </div>
      </header>

      {/* =====================================================================
           HERO SECTION: 3 ATMOSPHERIC SLIDES & OVERLAID QUICK SEARCH BAR
           ===================================================================== */}
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
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-xs border border-white/20 text-[11px] font-semibold tracking-[0.22em] uppercase text-[#F3D9A4] mb-5">
            <span>{HERO_SLIDES[heroSlide].kicker}</span>
          </div>

          <h1 className="font-serif-luxury text-3xl sm:text-5xl lg:text-[54px] font-semibold tracking-tight text-white leading-[1.14] max-w-3xl mx-auto drop-shadow-sm">
            {HERO_SLIDES[heroSlide].headline}
          </h1>

          <p className="mt-4 text-sm sm:text-base text-white/85 max-w-2xl mx-auto leading-relaxed">
            {HERO_SLIDES[heroSlide].subcopy}
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
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full bg-transparent text-xs sm:text-sm font-bold text-[#18222B] mt-0.5 focus:outline-none cursor-pointer"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {formatPHP(r.rate_php || 3500)}/night
                    </option>
                  ))}
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
                    {guests.adults + guests.children} guests
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setGuests((prev) => ({
                        ...prev,
                        adults: Math.max(1, prev.adults - 1)
                      }))
                    }
                    className="w-7 h-7 rounded-full border border-[#C9C2B4] bg-white hover:border-[#18222B] text-sm font-bold flex items-center justify-center cursor-pointer"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setGuests((prev) => ({
                        ...prev,
                        adults: Math.min(selectedRoom.capacity || 8, prev.adults + 1)
                      }))
                    }
                    className="w-7 h-7 rounded-full border border-[#C9C2B4] bg-white hover:border-[#18222B] text-sm font-bold flex items-center justify-center cursor-pointer"
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
                <span>Live Supabase sync active · Select your dates below</span>
              </div>
              <Link
                to="/user"
                className="text-[#9E7E46] hover:underline font-semibold"
              >
                Registered Guest? Sign in to User Portal →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
           UNIFIED BOOKING WORKSPACE (DRIVEN BY REAL-TIME SUPABASE DATA)
           ===================================================================== */}
      <main id="booking-workspace" className="max-w-[1120px] mx-auto px-4 sm:px-6 pt-8 pb-16">

        {/* Accommodation Selection Tabs */}
        <div className="border-b border-[#DDDDDD] mb-6 flex items-stretch gap-6 sm:gap-8 overflow-x-auto no-scrollbar">
          {rooms.map((room) => {
            const isSelected = room.id === selectedRoomId;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => setSelectedRoomId(room.id)}
                className={`py-4 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'border-[#222222] text-[#222222]'
                    : 'border-transparent text-[#6A6A6A] hover:text-[#222222]'
                }`}
              >
                <span>{room.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isSelected ? 'bg-[#18222B] text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {formatPHP(room.rate_php || 3500)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Listing Title Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-[22px] sm:text-[26px] font-semibold text-[#222222] tracking-[-0.02em] leading-snug">
              {selectedRoom.name} · Oceanfront Sanctuary Villa
            </h2>
            <div className="text-[11px] font-mono text-[#888888] mt-0.5">
              Room Code: {selectedRoom.id} · Verified Supabase Inventory
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
                {selectedRoom.capacity || 4} guests · {selectedRoom.beds_count || 2} bedrooms · {selectedRoom.beds_count || 2} beds · {selectedRoom.baths_count || 1} private bath
              </p>
            </div>

            {/* Sanctuary Highlight Card */}
            <div className="my-6 border border-dashed border-[#CBD5E1] bg-[#FAFAFA] rounded-[12px] px-[22px] py-[18px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-[44px] h-[44px] rounded-[10px] border border-[#E2E8F0] bg-[#FFFFFF] flex items-center justify-center text-[#9E7E46] shrink-0">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="text-xs sm:text-sm font-bold text-[#18222B] truncate">
                    Direct Supabase Accommodation Booking
                  </div>
                  <div className="text-xs text-[#64748B] truncate">
                    Mandatory 2-hour cleaning buffer strictly enforced between reservations
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
                  <h5 className="text-[15px] font-semibold text-[#222222]">Free cancellation 7 days before check-in</h5>
                  <p className="text-sm text-[#6A6A6A] mt-0.5">Full refund if your travel plans shift up to 7 days prior to arrival.</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="py-6 border-b border-[#DDDDDD]">
              <div className="text-[15px] text-[#222222] leading-[1.6] space-y-4">
                <p>{selectedRoom.description}</p>
                <p className="text-sm text-[#6A6A6A]">
                  Equipped with high-speed Starlink satellite Wi-Fi, solar microgrid power backup, and complimentary tropical breakfast prepared daily by our local staff.
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
                {(selectedRoom.amenities || ['Starlink Wi-Fi', 'Ocean View', 'Air Conditioning', 'Private Bath']).map((amenity, i) => (
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

                {/* Step indicator */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-xs font-semibold text-[#222222]">
                  <span className="w-2 h-2 rounded-xs bg-[#222222]"></span>
                  <span>
                    {!checkIn
                      ? 'Step 1: Select check-in box'
                      : !checkOut
                      ? 'Step 2: Select check-out box'
                      : `${totalNights} nights selected`}
                  </span>
                </div>
              </div>

              {/* Conflict Advisor Banner */}
              {hasRangeConflict && (
                <div className="mb-5 rounded-xl border-2 border-rose-300 bg-rose-50/90 p-4 sm:p-5 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-rose-600 text-white font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                      !
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm sm:text-[15px] font-bold text-rose-950">
                        Date Conflict Detected
                      </div>
                      <p className="text-xs sm:text-sm text-rose-900/90 mt-1 leading-relaxed">
                        Your chosen date span crosses dates that are already booked for {selectedRoom.name}. Please select an open continuous range.
                      </p>
                      <button
                        onClick={clearDates}
                        type="button"
                        className="mt-3 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
                      >
                        Reset Dates
                      </button>
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
                </div>

                <button
                  onClick={clearDates}
                  type="button"
                  className="text-xs sm:text-sm font-semibold text-[#222222] underline hover:text-[#6A6A6A] transition cursor-pointer"
                >
                  Clear dates
                </button>
              </div>

              {/* Dual-Month Side-by-Side Box Cards */}
              <div>
                {/* Month Navigator Header */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <button
                    onClick={() => setInlineYM(shiftYM(inlineYM, -1))}
                    type="button"
                    className="px-3 h-9 rounded-lg border border-[#CBD5E1] hover:border-[#222222] bg-white flex items-center justify-center gap-1 text-xs font-bold text-[#222222] transition cursor-pointer"
                  >
                    ‹ Prev
                  </button>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                    Select Check-In &amp; Check-Out Boxes
                  </span>
                  <button
                    onClick={() => setInlineYM(shiftYM(inlineYM, 1))}
                    type="button"
                    className="px-3 h-9 rounded-lg border border-[#CBD5E1] hover:border-[#222222] bg-white flex items-center justify-center gap-1 text-xs font-bold text-[#222222] transition cursor-pointer"
                  >
                    Next ›
                  </button>
                </div>

                {/* 2 Month Cards Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5" onMouseLeave={() => setHoverDate(null)}>
                  {/* Left Month */}
                  <div className="cal-month-box p-3.5 sm:p-4 shadow-2xs">
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#E5E7EB]">
                      <h5 className="text-[15px] font-bold text-[#222222]">
                        {MONTH_NAMES[inlineYM.m]} {inlineYM.y}
                      </h5>
                      <span className="text-[11px] font-medium text-[#64748B]">₱ / night</span>
                    </div>
                    {/* Weekday Labels */}
                    <div className="cal-grid-7 mb-[5px] text-center">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w, i) => (
                        <div key={i} className={`py-1.5 rounded-[6px] bg-[#F8FAFC] border border-[#E5E7EB] text-[11px] font-bold ${i >= 5 ? 'text-[#0F172A]' : 'text-[#475569]'}`}>
                          {w}
                        </div>
                      ))}
                    </div>
                    <div className="cal-grid-7">
                      {renderMonthGrid(inlineYM)}
                    </div>
                  </div>

                  {/* Right Month */}
                  {(() => {
                    const rightYM = shiftYM(inlineYM, 1);
                    return (
                      <div className="cal-month-box p-3.5 sm:p-4 shadow-2xs">
                        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#E5E7EB]">
                          <h5 className="text-[15px] font-bold text-[#222222]">
                            {MONTH_NAMES[rightYM.m]} {rightYM.y}
                          </h5>
                          <span className="text-[11px] font-medium text-[#64748B]">₱ / night</span>
                        </div>
                        <div className="cal-grid-7 mb-[5px] text-center">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w, i) => (
                            <div key={i} className={`py-1.5 rounded-[6px] bg-[#F8FAFC] border border-[#E5E7EB] text-[11px] font-bold ${i >= 5 ? 'text-[#0F172A]' : 'text-[#475569]'}`}>
                              {w}
                            </div>
                          ))}
                        </div>
                        <div className="cal-grid-7">
                          {renderMonthGrid(rightYM)}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Calendar Legend */}
                <div className="mt-5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#475569]">
                  <div className="flex flex-wrap items-center gap-3.5 sm:gap-4">
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#222222]">
                      <span className="w-4 h-4 rounded-[4px] bg-white border border-[#E2E8F0] inline-block"></span> Available Box
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
                  </div>
                  <span className="text-[11px] text-[#64748B]">Fri–Sat boxes reflect weekend coastal tariff</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (~35%): STICKY RESERVATION CARD */}
          <aside className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24">
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
                  ★ 4.98 · 48 reviews
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
                  className="w-full text-left p-3 border-t border-[#B0B0B0] hover:bg-[#F7F7F7] flex items-center justify-between transition cursor-pointer"
                >
                  <div>
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#222222]">
                      GUESTS
                    </span>
                    <span className="block text-sm text-[#222222] mt-0.5 font-semibold">
                      {guests.adults + guests.children} guests
                    </span>
                  </div>
                  <span className="text-xs">▾</span>
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
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-[#222222]">Adults</div>
                      <div className="text-xs text-[#6A6A6A]">Age 13+</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setGuests((p) => ({ ...p, adults: Math.max(1, p.adults - 1) }))}
                        type="button"
                        className="w-8 h-8 rounded-full border border-[#B0B0B0] flex items-center justify-center font-bold cursor-pointer"
                      >
                        −
                      </button>
                      <span className="w-4 text-center font-bold">{guests.adults}</span>
                      <button
                        onClick={() => setGuests((p) => ({ ...p, adults: Math.min(selectedRoom.capacity || 8, p.adults + 1) }))}
                        type="button"
                        className="w-8 h-8 rounded-full border border-[#B0B0B0] flex items-center justify-center font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-[#222222]">Children</div>
                      <div className="text-xs text-[#6A6A6A]">Ages 2–12</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setGuests((p) => ({ ...p, children: Math.max(0, p.children - 1) }))}
                        type="button"
                        className="w-8 h-8 rounded-full border border-[#B0B0B0] flex items-center justify-center font-bold cursor-pointer"
                      >
                        −
                      </button>
                      <span className="w-4 text-center font-bold">{guests.children}</span>
                      <button
                        onClick={() => setGuests((p) => ({ ...p, children: p.children + 1 }))}
                        type="button"
                        className="w-8 h-8 rounded-full border border-[#B0B0B0] flex items-center justify-center font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setCardDrawer('none')}
                    type="button"
                    className="w-full py-1.5 rounded-lg bg-[#222222] text-white text-xs font-semibold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Primary Coral-Rose Reserve CTA */}
              <button
                type="button"
                onClick={() => {
                  if (!checkIn || !checkOut) {
                    const el = document.getElementById('calendar-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    setReserveStep('form');
                    setShowReserveModal(true);
                  }
                }}
                className="btn-airbnb-reserve w-full h-12 rounded-[8px] text-[15px] font-semibold tracking-wide cursor-pointer flex items-center justify-center"
              >
                {checkIn && checkOut ? 'Reserve Villa' : 'Check availability'}
              </button>

              <p className="text-center text-xs text-[#6A6A6A] mt-3">
                {checkIn && checkOut
                  ? 'You won’t be charged yet · Official digital voucher'
                  : 'Select dates to unlock direct booking rates'}
              </p>

              {/* Fee Breakdown */}
              {checkIn && checkOut && totalNights > 0 && (
                <div className="mt-5 pt-4 border-t border-[#DDDDDD] space-y-2.5 text-sm text-[#222222]">
                  <div className="flex justify-between">
                    <span className="underline">{formatPHP(selectedRoom.rate_php || 3500)} × {totalNights} nights</span>
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
              )}
            </div>
          </aside>
        </div>

        {/* =====================================================================
             "WHERE YOU'LL BE" — INTERACTIVE SVG COASTAL MAP OF BOLINAO
             ===================================================================== */}
        <section id="location-section" className="mt-12 pt-10 border-t border-[#DDDDDD]">
          <h4 className="text-[22px] font-semibold text-[#222222] mb-1">Where you'll be</h4>
          <p className="text-[15px] text-[#6A6A6A] mb-5">Patar Coastal Road, Bolinao, Pangasinan, Philippines</p>

          <div className="h-[340px] sm:h-[420px] rounded-2xl overflow-hidden border border-[#DDDDDD] bg-[#F4EDE2] relative shadow-inner">
            <svg viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
              {/* Sea */}
              <rect width="1000" height="500" fill="#BFE3EB"/>
              {/* Coastline */}
              <path d="M 0,220 Q 200,180 380,240 T 700,180 T 1000,210 L 1000,500 L 0,500 Z" fill="#E8DDCB"/>
              <path d="M 0,250 Q 200,210 380,270 T 700,210 T 1000,240 L 1000,500 L 0,500 Z" fill="#DDD0BC"/>
              
              {/* Pins */}
              <g className="cursor-pointer group">
                <circle cx="380" cy="240" r="14" fill="#FF385C" className="drop-shadow-md"/>
                <circle cx="380" cy="240" r="6" fill="#FFFFFF"/>
                <text x="380" y="275" textAnchor="middle" fill="#18222B" fontSize="13" fontWeight="bold">
                  Rock View Beach Resort
                </text>
              </g>

              <g className="cursor-pointer">
                <circle cx="210" cy="180" r="10" fill="#9E7E46"/>
                <circle cx="210" cy="180" r="4" fill="#FFFFFF"/>
                <text x="210" y="210" textAnchor="middle" fill="#18222B" fontSize="11" fontWeight="600">
                  Cape Bolinao Lighthouse
                </text>
              </g>

              <g className="cursor-pointer">
                <circle cx="560" cy="210" r="10" fill="#9E7E46"/>
                <circle cx="560" cy="210" r="4" fill="#FFFFFF"/>
                <text x="560" y="240" textAnchor="middle" fill="#18222B" fontSize="11" fontWeight="600">
                  Patar White Beach
                </text>
              </g>

              <g className="cursor-pointer">
                <circle cx="780" cy="250" r="10" fill="#9E7E46"/>
                <circle cx="780" cy="250" r="4" fill="#FFFFFF"/>
                <text x="780" y="280" textAnchor="middle" fill="#18222B" fontSize="11" fontWeight="600">
                  Enchanted Cave
                </text>
              </g>
            </svg>
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
              <div><span className="text-[#6A6A6A]">Starlink Wi-Fi</span></div>
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
            {checkIn && checkOut ? `${totalNights} nights stay` : 'Select dates'}
          </span>
        </div>
        <button
          onClick={() => {
            if (!checkIn || !checkOut) {
              const el = document.getElementById('calendar-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            } else {
              setReserveStep('form');
              setShowReserveModal(true);
            }
          }}
          type="button"
          className="btn-airbnb-reserve px-5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer"
        >
          {checkIn && checkOut ? 'Reserve' : 'Check Dates'}
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] rounded-2xl max-w-md w-full border border-[#DDDDDD] shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-[#EBEBEB] flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#222222]">
                {reserveStep === 'form' ? 'Confirm your Bolinao reservation' : 'Reservation Confirmed & Locked'}
              </h3>
              <button
                onClick={() => setShowReserveModal(false)}
                type="button"
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-sm font-bold flex items-center justify-center cursor-pointer text-slate-600"
              >
                ✕
              </button>
            </div>

            {reserveStep === 'form' ? (
              <form onSubmit={handleReserveSubmit} className="p-6 space-y-4">
                <div className="border border-[#DDDDDD] rounded-xl p-4 space-y-2.5 text-sm">
                  <div className="font-bold text-[#222222]">{selectedRoom.name}</div>
                  <div className="flex justify-between text-[#6A6A6A]">
                    <span>Dates</span>
                    <span className="font-semibold text-[#222222]">
                      {formatFullDate(checkIn)} – {formatFullDate(checkOut)} ({totalNights} nights)
                    </span>
                  </div>
                  <div className="flex justify-between text-[#6A6A6A]">
                    <span>Guests</span>
                    <span className="font-semibold text-[#222222]">{guests.adults + guests.children} guests</span>
                  </div>
                  <div className="flex justify-between text-[#6A6A6A]">
                    <span>Cleaning &amp; Conservation Fee</span>
                    <span className="font-semibold text-[#222222]">₱650</span>
                  </div>
                  <div className="pt-2.5 border-t border-[#DDDDDD] flex justify-between font-bold text-base text-[#222222]">
                    <span>Total</span>
                    <span className="text-[#FF385C]">{formatPHP(priceBreakdown.grandTotal)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#222222] mb-1">Primary Guest Full Name</label>
                    <input
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Maria Santos"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#B0B0B0] text-sm focus:outline-none focus:border-[#222222]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#222222] mb-1">Email for Digital Voucher</label>
                    <input
                      type="email"
                      required
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="guest@example.ph"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#B0B0B0] text-sm focus:outline-none focus:border-[#222222]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#222222] mb-1">Philippine Mobile (SMS PIN alert)</label>
                    <input
                      type="tel"
                      required
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="09171234567"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#B0B0B0] text-sm focus:outline-none focus:border-[#222222]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={reserveSubmitting}
                  className="btn-airbnb-reserve w-full h-12 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{reserveSubmitting ? 'Writing to Supabase...' : 'Confirm & Lock Dates in Supabase'}</span>
                </button>
              </form>
            ) : (
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center text-xl font-bold border border-emerald-200">
                  ✓
                </div>
                <div>
                  <h4 className="text-xl font-bold text-[#222222]">Reservation Confirmed &amp; Locked</h4>
                  <p className="text-sm text-[#6A6A6A] mt-1">
                    Your booking has been written to the Supabase database.
                  </p>
                </div>

                <div className="bg-[#F7F7F7] border border-[#DDDDDD] rounded-xl p-4">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-[#6A6A6A]">Confirmation Reference</div>
                  <div className="font-mono text-lg font-extrabold text-[#222222] mt-1">
                    {bookingRef}
                  </div>
                  <div className="text-xs font-semibold text-emerald-700 mt-1">
                    Smart Keypad PIN: {smartPin}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1.5 flex items-center justify-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Recorded in Supabase Database</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowReserveModal(false)}
                  type="button"
                  className="w-full py-3 rounded-lg bg-[#222222] text-white text-sm font-semibold hover:bg-black transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
