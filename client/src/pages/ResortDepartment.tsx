import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { toast } from '../components/Toasts.tsx';
import '../styles/staff-portal.css';

// ── Types & Interfaces ──
interface RoomItem {
  id: string;
  code: string;
  name: string;
  category: string;
  capacity: string;
  rate: number;
  status: 'available' | 'occupied' | 'dirty' | 'maintenance';
  guest: string | null;
  note: string;
}

interface BookingItem {
  id: string;
  guest: string;
  pax: number;
  roomId: string;
  checkIn: string;
  checkOut: string;
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  payment: string;
  source: string;
}

interface PendingReservation {
  id: string;
  guest: string;
  pax: number;
  requestedRoomId: string;
  checkIn: string;
  checkOut: string;
  source: string;
  payment: string;
  note: string;
}

interface ChatMessage {
  sender: string;
  role: 'guest' | 'staff' | 'me';
  text: string;
  time: string;
}

interface ChatThread {
  id: string;
  name: string;
  tag: string;
  unitLabel: string;
  unread: number;
  messages: ChatMessage[];
}

interface OperationalTask {
  id: string;
  dept: 'housekeeping' | 'maintenance';
  roomId: string;
  title: string;
  priority: 'High' | 'Normal';
  assignee: string;
  status: 'open' | 'completed';
}

// ── Default Mock State for Full Interactive Experience ──
const INITIAL_ROOMS: RoomItem[] = [
  { id: 'rm-101', code: '101', name: 'Cliffside Ocean Villa 101', category: 'Villa', capacity: '4 Guests', rate: 8500, status: 'occupied', guest: 'Marco & Elena Santos', note: 'Panoramic sea deck • Late checkout 1PM' },
  { id: 'rm-102', code: '102', name: 'Beachfront Family Cottage 102', category: 'Cottage', capacity: '6 Guests', rate: 6200, status: 'available', guest: null, note: 'Direct sand access • Inspected & ready' },
  { id: 'rm-103', code: '103', name: 'Garden Cabana 103', category: 'Cabana', capacity: '2 Guests', rate: 3800, status: 'dirty', guest: null, note: 'Checkout completed • Needs fresh linens' },
  { id: 'rm-201', code: '201', name: 'Sunset Loft Suite 201', category: 'Suite', capacity: '3 Guests', rate: 7400, status: 'occupied', guest: 'D. Takahashi', note: 'Upper cliff terrace • Breakfast included' },
  { id: 'rm-202', code: '202', name: 'Coral Reef Villa 202', category: 'Villa', capacity: '4 Guests', rate: 8900, status: 'maintenance', guest: null, note: 'Split-AC compressor servicing until Nov 19' },
  { id: 'tour-01', code: 'BOAT', name: 'Patar Island Hopping Boat Tour', category: 'Tour Charter', capacity: '10 Pax', rate: 4500, status: 'available', guest: null, note: 'Outrigger boat #1 • Morning & sunset slots' }
];

const INITIAL_BOOKINGS: BookingItem[] = [
  { id: 'BK-9041', guest: 'Marco & Elena Santos', pax: 4, roomId: 'rm-101', checkIn: '2026-11-16', checkOut: '2026-11-19', status: 'checked_in', payment: 'Paid (GCash)', source: 'Direct Web' },
  { id: 'BK-9042', guest: 'D. Takahashi', pax: 2, roomId: 'rm-201', checkIn: '2026-11-15', checkOut: '2026-11-18', status: 'checked_in', payment: 'Paid (Card)', source: 'Agoda' },
  { id: 'BK-9045', guest: 'Atty. Clarissa Lim', pax: 5, roomId: 'rm-102', checkIn: '2026-11-19', checkOut: '2026-11-22', status: 'confirmed', payment: '50% Deposit', source: 'Direct Web' },
  { id: 'BK-9048', guest: 'Reyes Family Outing', pax: 8, roomId: 'tour-01', checkIn: '2026-11-18', checkOut: '2026-11-19', status: 'confirmed', payment: 'Paid (Cash)', source: 'Front Desk' },
  { id: 'BK-9052', guest: 'Kevin & Bea Mendoza', pax: 2, roomId: 'rm-103', checkIn: '2026-11-20', checkOut: '2026-11-23', status: 'confirmed', payment: '50% Deposit', source: 'Booking.com' }
];

const INITIAL_PENDING: PendingReservation[] = [
  { id: 'REQ-301', guest: 'Sofia Vergara-Cruz', pax: 4, requestedRoomId: 'rm-102', checkIn: '2026-11-17', checkOut: '2026-11-19', source: 'Website Direct', payment: 'GCash Receipt Attached', note: 'Arriving around 2:30 PM from Manila. Requesting baby crib.' },
  { id: 'REQ-302', guest: 'Miguel Alcantara', pax: 2, requestedRoomId: 'rm-103', checkIn: '2026-11-18', checkOut: '2026-11-20', source: 'Airbnb', payment: 'Pre-Authorized', note: 'Anniversary trip, would love sunset dinner table reservation.' },
  { id: 'REQ-303', guest: 'Bolinao Dive Club (6 Pax)', pax: 6, requestedRoomId: 'tour-01', checkIn: '2026-11-20', checkOut: '2026-11-21', source: 'Instagram DM', payment: 'Pay on Arrival', note: 'Private morning boat charter to Patar Rock Formations.' }
];

const INITIAL_THREADS: ChatThread[] = [
  {
    id: 'th-1',
    name: 'Sofia Vergara-Cruz',
    tag: 'Guest Inquiry',
    unitLabel: 'Req: Beachfront Cottage 102',
    unread: 2,
    messages: [
      { sender: 'Sofia Vergara-Cruz', role: 'guest', text: 'Hi Rock View Resort! We just submitted our booking for Beachfront Family Cottage 102 today (Nov 17–19).', time: '12:42 PM' },
      { sender: 'Sofia Vergara-Cruz', role: 'guest', text: 'Is early luggage drop-off possible around 1:15 PM before check-in?', time: '12:44 PM' }
    ]
  },
  {
    id: 'th-2',
    name: 'Housekeeping Dispatch',
    tag: 'Internal Ops',
    unitLabel: 'Staff Channel',
    unread: 0,
    messages: [
      { sender: 'Ate Marites (HK Lead)', role: 'staff', text: 'Beachfront Cottage 102 is sanitized and inspected—ready for afternoon guests.', time: '11:20 AM' },
      { sender: 'Camille Reyes', role: 'me', text: 'Noted, thank you! Please prioritize Garden Cabana 103 turnover next.', time: '11:25 AM' }
    ]
  },
  {
    id: 'th-3',
    name: 'Marco Santos (Villa 101)',
    tag: 'In-House Guest',
    unitLabel: 'Cliffside Ocean Villa 101',
    unread: 0,
    messages: [
      { sender: 'Marco Santos', role: 'guest', text: 'Good afternoon! Can we reserve the Patar Island Hopping boat for tomorrow morning?', time: '10:50 AM' }
    ]
  },
  {
    id: 'th-4',
    name: 'Capt. Jun (Boat Pier)',
    tag: 'Boat Tours',
    unitLabel: 'Outrigger #1',
    unread: 0,
    messages: [
      { sender: 'Capt. Jun', role: 'staff', text: 'Sea condition is calm today. Outrigger #1 fueled and ready at the pier.', time: '09:15 AM' }
    ]
  }
];

const INITIAL_TASKS: OperationalTask[] = [
  { id: 'TSK-11', dept: 'housekeeping', roomId: 'rm-103', title: 'Full turnover & fresh beach towels after checkout', priority: 'High', assignee: 'Ate Marites', status: 'open' },
  { id: 'TSK-12', dept: 'housekeeping', roomId: 'rm-101', title: 'Afternoon turndown service & extra bottled water', priority: 'Normal', assignee: 'Jessa D.', status: 'open' },
  { id: 'TSK-13', dept: 'maintenance', roomId: 'rm-202', title: 'Replace split-type AC capacitor & test cooling', priority: 'High', assignee: 'Kuya Benjie', status: 'open' }
];

// Helper Date Formatters
function formatPHP(amount: number) {
  return '₱' + Number(amount || 0).toLocaleString('en-PH');
}

function formatDateShort(isoStr: string) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateReadable(isoStr: string) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function addDaysISO(isoStr: string, days: number) {
  const [y, m, d] = isoStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export default function ResortDepartment() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active View Tab: 'dashboard' (3 cols) | 'calendar' | 'rooms' | 'reservations' | 'messages' | 'housekeeping'
  const activeView = (searchParams.get('view') as any) || 'dashboard';

  // State Collections
  const [rooms, setRooms] = useState<RoomItem[]>(INITIAL_ROOMS);
  const [bookings, setBookings] = useState<BookingItem[]>(INITIAL_BOOKINGS);
  const [pendingReservations, setPendingReservations] = useState<PendingReservation[]>(INITIAL_PENDING);
  const [threads, setThreads] = useState<ChatThread[]>(INITIAL_THREADS);
  const [activeThreadId, setActiveThreadId] = useState('th-1');
  const [tasks, setTasks] = useState<OperationalTask[]>(INITIAL_TASKS);

  // Filters & Sub-states
  const [dashRoomFilter, setDashRoomFilter] = useState<'all' | 'available' | 'occupied' | 'attention'>('all');
  const [dashCalView, setDashCalView] = useState<'month' | 'week' | 'day'>('month');
  const [tapeMode, setTapeMode] = useState<'tape' | 'month'>('tape');
  const [selectedDate, setSelectedDate] = useState('2026-11-17');
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(2026, 10, 1));
  const [tapeStartDate, setTapeStartDate] = useState('2026-11-15');
  const [chatReplyText, setChatReplyText] = useState('');

  // Walk-in Modal State
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInForm, setWalkInForm] = useState({
    guest: '',
    pax: 2,
    phone: '',
    checkIn: '2026-11-17',
    checkOut: '2026-11-19',
    roomId: 'rm-102',
    notes: '',
  });

  // Listen to Global Walk-In Modal Trigger
  useEffect(() => {
    const handleOpenWalkIn = (e?: any) => {
      const dt = e?.detail?.date || selectedDate;
      const rm = e?.detail?.roomId || 'rm-102';
      setWalkInForm((prev) => ({ ...prev, checkIn: dt, checkOut: addDaysISO(dt, 2), roomId: rm }));
      setShowWalkInModal(true);
    };
    window.addEventListener('open-staff-walkin', handleOpenWalkIn);
    if (searchParams.get('action') === 'walkin') {
      setShowWalkInModal(true);
    }
    return () => window.removeEventListener('open-staff-walkin', handleOpenWalkIn);
  }, [searchParams, selectedDate]);

  // Load Live Data from Supabase / API
  useEffect(() => {
    let isLive = true;
    api.frontDeskOverview()
      .then((res: any) => {
        if (!isLive || !res) return;
        if (Array.isArray(res.bookings) && res.bookings.length > 0) {
          // Merge active bookings
          const liveBookings: BookingItem[] = res.bookings.map((b: any) => ({
            id: b.id,
            guest: b.guest_name || b.guest || 'Guest',
            pax: b.pax || 2,
            roomId: b.room_id || 'rm-101',
            checkIn: b.check_in || b.checkIn,
            checkOut: b.check_out || b.checkOut,
            status: b.status || 'confirmed',
            payment: b.payment_status || 'Paid',
            source: b.source || 'Direct Web',
          }));
          setBookings(liveBookings);
        }
      })
      .catch(() => {});

    api.departmentTasks()
      .then((tList: any) => {
        if (!isLive || !Array.isArray(tList) || tList.length === 0) return;
        const mapped: OperationalTask[] = tList.map((t: any) => ({
          id: t.id,
          dept: t.department === 'maintenance' ? 'maintenance' : 'housekeeping',
          roomId: t.room_name || 'rm-103',
          title: t.title || 'Turnover task',
          priority: t.priority === 'urgent' || t.priority === 'high' ? 'High' : 'Normal',
          assignee: t.assigned_to || 'Duty Staff',
          status: t.status === 'completed' ? 'completed' : 'open',
        }));
        setTasks(mapped);
      })
      .catch(() => {});

    return () => { isLive = false; };
  }, []);

  // Helper Room Resolver
  const getRoomById = (roomId: string) => {
    return rooms.find((r) => r.id === roomId) || { id: roomId, code: '—', name: 'Unassigned Unit', category: 'Standard', capacity: '—', rate: 0, status: 'available' as const, guest: null, note: '' };
  };

  // Conflict Checker
  const checkRoomConflict = (roomId: string, checkIn: string, checkOut: string) => {
    const rm = getRoomById(roomId);
    if (rm.status === 'maintenance') {
      return { conflict: true, reason: `${rm.name} is currently under Maintenance.` };
    }
    const overlap = bookings.find((b) => {
      if (b.roomId !== roomId || b.status === 'cancelled') return false;
      return checkIn < b.checkOut && checkOut > b.checkIn;
    });
    if (overlap) {
      return {
        conflict: true,
        reason: `Overlaps with ${overlap.guest} (${formatDateShort(overlap.checkIn)} – ${formatDateShort(overlap.checkOut)})`,
      };
    }
    return { conflict: false, reason: 'Unit is clear and ready for stay.' };
  };

  // Cycle Status Action
  const cycleRoomStatus = (roomId: string) => {
    const order: RoomItem['status'][] = ['available', 'occupied', 'dirty', 'maintenance'];
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== roomId) return r;
        const nextStatus = order[(order.indexOf(r.status) + 1) % order.length];
        toast(`${r.name} status updated to ${nextStatus.toUpperCase()}`);
        return {
          ...r,
          status: nextStatus,
          guest: nextStatus === 'occupied' ? (r.guest || 'Walk-In Guest') : null,
        };
      })
    );
  };

  // Approve Pending Request
  const handleApprovePending = (reqId: string) => {
    const req = pendingReservations.find((p) => p.id === reqId);
    if (!req) return;
    const newBooking: BookingItem = {
      id: `BK-${Date.now().toString().slice(-4)}`,
      guest: req.guest,
      pax: req.pax,
      roomId: req.requestedRoomId,
      checkIn: req.checkIn,
      checkOut: req.checkOut,
      status: 'confirmed',
      payment: req.payment,
      source: req.source,
    };
    setBookings((prev) => [newBooking, ...prev]);
    setPendingReservations((prev) => prev.filter((p) => p.id !== reqId));
    toast(`✦ Reservation for ${req.guest} approved & assigned!`);
  };

  // Decline Pending Request
  const handleDeclinePending = (reqId: string) => {
    const req = pendingReservations.find((p) => p.id === reqId);
    setPendingReservations((prev) => prev.filter((p) => p.id !== reqId));
    toast(`Reservation request ${reqId} declined.`, true);
  };

  // Quick Chat Send
  const handleSendChatReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatReplyText.trim()) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg: ChatMessage = { sender: 'Camille Reyes (Duty)', role: 'me', text: chatReplyText.trim(), time: now };
    setThreads((prev) =>
      prev.map((t) => (t.id === activeThreadId ? { ...t, messages: [...t.messages, newMsg] } : t))
    );
    setChatReplyText('');
  };

  // Create Walk-in Booking
  const handleCreateWalkIn = (e: React.FormEvent) => {
    e.preventDefault();
    const conflict = checkRoomConflict(walkInForm.roomId, walkInForm.checkIn, walkInForm.checkOut);
    if (conflict.conflict) {
      toast(`Cannot book: ${conflict.reason}`, true);
      return;
    }
    const newBooking: BookingItem = {
      id: `BK-${Date.now().toString().slice(-4)}`,
      guest: walkInForm.guest,
      pax: Number(walkInForm.pax),
      roomId: walkInForm.roomId,
      checkIn: walkInForm.checkIn,
      checkOut: walkInForm.checkOut,
      status: 'checked_in',
      payment: 'Paid (Front Desk)',
      source: 'Walk-In',
    };
    setBookings((prev) => [newBooking, ...prev]);
    // Set room to occupied
    setRooms((prev) =>
      prev.map((r) => (r.id === walkInForm.roomId ? { ...r, status: 'occupied', guest: walkInForm.guest } : r))
    );
    setShowWalkInModal(false);
    toast(`✦ Walk-In check-in confirmed for ${walkInForm.guest}!`);
  };

  // Filtered Rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (dashRoomFilter === 'available') return r.status === 'available';
      if (dashRoomFilter === 'occupied') return r.status === 'occupied';
      if (dashRoomFilter === 'attention') return r.status === 'dirty' || r.status === 'maintenance';
      return true;
    });
  }, [rooms, dashRoomFilter]);

  // Active chat thread
  const currentThread = threads.find((t) => t.id === activeThreadId) || threads[0];

  return (
    <div className="staff-ops-workspace">
      {/* =========================================================================
          VIEW A: OPERATIONS TERMINAL (3-COLUMN COMMAND DASHBOARD WITH GAPS)
          ========================================================================= */}
      {activeView === 'dashboard' && (
        <div className="staff-ops-3col">
          {/* ─────────────────────────────────────────────────────────────
              COLUMN 1: UNITS & TOURS QUICK STATUS PANEL
              ───────────────────────────────────────────────────────────── */}
          <section className="staff-ops-col">
            <div className="staff-ops-col-header">
              <div className="flex items-center gap-2">
                <span className="staff-ops-col-title">Units &amp; Tours</span>
                <span className="staff-ops-badge">{filteredRooms.length}</span>
              </div>
              <button
                type="button"
                onClick={() => setSearchParams({ view: 'rooms' })}
                className="staff-ops-link-btn"
              >
                Manage All &rarr;
              </button>
            </div>

            {/* Filter Pills */}
            <div style={{ padding: '12px 14px 4px' }}>
              <div className="staff-ops-filter-bar">
                <button
                  type="button"
                  className={`staff-ops-pill-btn ${dashRoomFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setDashRoomFilter('all')}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`staff-ops-pill-btn ${dashRoomFilter === 'available' ? 'active' : ''}`}
                  onClick={() => setDashRoomFilter('available')}
                >
                  Ready
                </button>
                <button
                  type="button"
                  className={`staff-ops-pill-btn ${dashRoomFilter === 'occupied' ? 'active' : ''}`}
                  onClick={() => setDashRoomFilter('occupied')}
                >
                  In-Use
                </button>
                <button
                  type="button"
                  className={`staff-ops-pill-btn ${dashRoomFilter === 'attention' ? 'active' : ''}`}
                  onClick={() => setDashRoomFilter('attention')}
                >
                  Alert
                </button>
              </div>
            </div>

            {/* Listings Scroll Area */}
            <div className="staff-ops-col-body">
              {filteredRooms.map((room) => (
                <div key={room.id} className="staff-ops-unit-card">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div style={{ minWidth: 0 }}>
                      <div className="staff-ops-unit-name">{room.name}</div>
                      <div className="staff-ops-unit-cat">{room.category} • {room.capacity}</div>
                    </div>
                    <span className={`staff-ops-status-pill staff-ops-status-pill--${room.status}`}>
                      {room.status === 'available' && 'Available'}
                      {room.status === 'occupied' && 'Occupied'}
                      {room.status === 'dirty' && 'Dirty / Turnover'}
                      {room.status === 'maintenance' && 'Maintenance'}
                    </span>
                  </div>

                  <div className="staff-ops-unit-note">
                    {room.guest ? (
                      <span><strong style={{ color: '#0369A1' }}>Guest:</strong> {room.guest}</span>
                    ) : (
                      room.note
                    )}
                  </div>

                  <div className="staff-ops-unit-foot">
                    <span className="staff-ops-unit-price">
                      {formatPHP(room.rate)}
                      <small>/night</small>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => cycleRoomStatus(room.id)}
                        className="staff-ops-action-btn"
                        title="Advance room status"
                      >
                        Cycle Status
                      </button>
                      {room.status === 'available' && (
                        <button
                          type="button"
                          onClick={() => {
                            setWalkInForm((p) => ({ ...p, roomId: room.id, checkIn: selectedDate }));
                            setShowWalkInModal(true);
                          }}
                          className="staff-ops-book-btn"
                        >
                          Book
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ─────────────────────────────────────────────────────────────
              COLUMN 2: INTERACTIVE OPERATIONS CALENDAR & DATE INSPECTOR
              ───────────────────────────────────────────────────────────── */}
          <section className="staff-ops-col">
            {/* Calendar Controls Toolbar */}
            <div className="staff-ops-col-header" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div className="flex items-center gap-2.5">
                <div className="staff-ops-btn-group">
                  <button
                    type="button"
                    onClick={() => {
                      const dt = new Date(currentMonthDate);
                      dt.setMonth(dt.getMonth() - 1);
                      setCurrentMonthDate(dt);
                    }}
                    className="staff-ops-icon-btn"
                    title="Previous Month"
                  >
                    <i className="fas fa-chevron-left" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentMonthDate(new Date(2026, 10, 1));
                      setSelectedDate('2026-11-17');
                    }}
                    className="staff-ops-today-btn"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const dt = new Date(currentMonthDate);
                      dt.setMonth(dt.getMonth() + 1);
                      setCurrentMonthDate(dt);
                    }}
                    className="staff-ops-icon-btn"
                    title="Next Month"
                  >
                    <i className="fas fa-chevron-right" />
                  </button>
                </div>
                <div>
                  <h2 className="staff-ops-cal-title">
                    {currentMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h2>
                  <p className="staff-ops-cal-subtitle">All villas, cottages &amp; island tours</p>
                </div>
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center gap-2">
                <div className="staff-ops-btn-group">
                  <button
                    type="button"
                    className={`staff-ops-mode-btn ${dashCalView === 'month' ? 'active' : ''}`}
                    onClick={() => setDashCalView('month')}
                  >
                    Month
                  </button>
                  <button
                    type="button"
                    className={`staff-ops-mode-btn ${dashCalView === 'week' ? 'active' : ''}`}
                    onClick={() => setDashCalView('week')}
                  >
                    Week
                  </button>
                  <button
                    type="button"
                    className={`staff-ops-mode-btn ${dashCalView === 'day' ? 'active' : ''}`}
                    onClick={() => setDashCalView('day')}
                  >
                    Day
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSearchParams({ view: 'calendar' })}
                  className="staff-ops-tape-btn"
                  title="Open Full Tape Chart"
                >
                  <i className="fas fa-table-list" />
                  <span>Tape</span>
                </button>
              </div>
            </div>

            {/* Calendar Grid Body */}
            <div className="staff-ops-col-body" style={{ background: '#F8FAFC' }}>
              {dashCalView === 'month' && (
                <div>
                  {/* Day Headers */}
                  <div className="staff-ops-cal-header-row">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <div key={d} className="staff-ops-cal-day-label">{d}</div>
                    ))}
                  </div>

                  {/* Day Grid */}
                  <div className="staff-ops-cal-grid">
                    {/* Leading blanks for Nov 2026 (Starts on Sunday = 0 blanks) */}
                    {Array.from({ length: 30 }, (_, idx) => {
                      const d = idx + 1;
                      const iso = `2026-11-${String(d).padStart(2, '0')}`;
                      const isToday = iso === '2026-11-17';
                      const isSelected = iso === selectedDate;
                      const dayBookings = bookings.filter((b) => iso >= b.checkIn && iso < b.checkOut && b.status !== 'cancelled');

                      return (
                        <div
                          key={d}
                          onClick={() => setSelectedDate(iso)}
                          className={`staff-ops-cal-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`staff-ops-day-num ${isToday ? 'staff-ops-day-num--today' : ''}`}>{d}</span>
                            {dayBookings.length > 0 && (
                              <span className="staff-ops-day-count">{dayBookings.length}</span>
                            )}
                          </div>
                          <div className="staff-ops-day-stays">
                            {dayBookings.slice(0, 2).map((b) => {
                              const rm = getRoomById(b.roomId);
                              const isGreen = b.status === 'checked_in';
                              return (
                                <div
                                  key={b.id}
                                  className={`staff-ops-day-stay-chip ${isGreen ? 'chip--emerald' : 'chip--sky'}`}
                                  title={`${b.guest} (${rm.name})`}
                                >
                                  {rm.code} • {b.guest.split(' ')[0]}
                                </div>
                              );
                            })}
                            {dayBookings.length > 2 && (
                              <div className="staff-ops-day-more">+{dayBookings.length - 2} more</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {dashCalView === 'week' && (
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 7 }, (_, i) => addDaysISO(selectedDate, i)).map((iso) => {
                    const active = bookings.filter((b) => iso >= b.checkIn && iso < b.checkOut && b.status !== 'cancelled');
                    const isSel = iso === selectedDate;
                    return (
                      <div
                        key={iso}
                        onClick={() => setSelectedDate(iso)}
                        className={`staff-ops-cal-day ${isSel ? 'selected' : ''}`}
                        style={{ minHeight: 180 }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '.76rem', color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: 4 }}>
                          {formatDateShort(iso)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                          {active.map((b) => {
                            const rm = getRoomById(b.roomId);
                            return (
                              <div key={b.id} className="staff-ops-day-stay-chip chip--sky" style={{ padding: '3px 6px' }}>
                                {rm.code}: {b.guest}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748B', marginTop: 'auto', paddingTop: 6 }}>
                          {active.length}/{rooms.length} booked
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {dashCalView === 'day' && (
                <div style={{ padding: '10px 0' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '.9rem', color: '#0F172A' }}>
                    Active Stays on {formatDateReadable(selectedDate)}
                  </h4>
                  {bookings.filter((b) => selectedDate >= b.checkIn && selectedDate < b.checkOut && b.status !== 'cancelled').length === 0 ? (
                    <p style={{ color: '#64748B', fontSize: '.84rem' }}>No active bookings on this date.</p>
                  ) : (
                    bookings
                      .filter((b) => selectedDate >= b.checkIn && selectedDate < b.checkOut && b.status !== 'cancelled')
                      .map((b) => {
                        const rm = getRoomById(b.roomId);
                        return (
                          <div key={b.id} className="staff-ops-unit-card" style={{ marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, color: '#0F172A' }}>{b.guest} ({b.pax} Pax)</div>
                            <div style={{ fontSize: '.76rem', color: '#0284C7' }}>{rm.name} • {formatDateShort(b.checkIn)} &rarr; {formatDateShort(b.checkOut)}</div>
                          </div>
                        );
                      })
                  )}
                </div>
              )}
            </div>

            {/* Selected Date Inspector Strip */}
            <div className="staff-ops-inspector-strip">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="staff-ops-dot staff-ops-dot--sky" />
                  <span className="staff-ops-inspector-title">
                    Schedule for <strong style={{ color: '#0284C7' }}>{formatDateReadable(selectedDate)}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setWalkInForm((p) => ({ ...p, checkIn: selectedDate, checkOut: addDaysISO(selectedDate, 2) }));
                    setShowWalkInModal(true);
                  }}
                  className="staff-ops-book-date-btn"
                >
                  + Book on Date
                </button>
              </div>

              <div className="staff-ops-inspector-events">
                {bookings.filter((b) => selectedDate >= b.checkIn && selectedDate < b.checkOut && b.status !== 'cancelled').length === 0 ? (
                  <span className="staff-ops-no-events">No stays scheduled for {formatDateShort(selectedDate)}.</span>
                ) : (
                  bookings
                    .filter((b) => selectedDate >= b.checkIn && selectedDate < b.checkOut && b.status !== 'cancelled')
                    .map((b) => {
                      const rm = getRoomById(b.roomId);
                      return (
                        <div key={b.id} className="staff-ops-event-pill">
                          <span className={`staff-ops-dot ${b.status === 'checked_in' ? 'staff-ops-dot--emerald' : 'staff-ops-dot--sky'}`} />
                          <strong>{rm.code}:</strong>
                          <span>{b.guest}</span>
                          <small>({formatDateShort(b.checkIn)}–{formatDateShort(b.checkOut)})</small>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </section>

          {/* ─────────────────────────────────────────────────────────────
              COLUMN 3: SPLIT STACK (INCOMING QUEUE + LIVE MESSAGES)
              ───────────────────────────────────────────────────────────── */}
          <section className="staff-ops-stack-col">
            {/* TOP CARD: Incoming Reservations Queue */}
            <div className="staff-ops-stack-card" style={{ minHeight: 280 }}>
              <div className="staff-ops-col-header">
                <div className="flex items-center gap-2">
                  <span className="staff-ops-dot staff-ops-dot--amber" style={{ animation: 'pulse 1.5s infinite' }} />
                  <span className="staff-ops-col-title">Incoming Queue</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSearchParams({ view: 'reservations' })}
                  className="staff-ops-pending-btn"
                >
                  {pendingReservations.length} Pending &rarr;
                </button>
              </div>

              <div className="staff-ops-col-body">
                {pendingReservations.length === 0 ? (
                  <div className="staff-ops-cleared-box">
                    <p>All incoming requests cleared!</p>
                    <small>New direct &amp; OTA bookings appear here.</small>
                  </div>
                ) : (
                  pendingReservations.map((req) => {
                    const rm = getRoomById(req.requestedRoomId);
                    const conflict = checkRoomConflict(req.requestedRoomId, req.checkIn, req.checkOut);

                    return (
                      <div key={req.id} className="staff-ops-pending-card">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="staff-ops-pending-guest">{req.guest}</div>
                            <div className="staff-ops-pending-meta">{req.pax} Pax • {req.source}</div>
                          </div>
                          <span className="staff-ops-date-badge">
                            {formatDateShort(req.checkIn)}–{formatDateShort(req.checkOut)}
                          </span>
                        </div>

                        <div className="staff-ops-conflict-row">
                          <span className="truncate">{rm.name}</span>
                          {conflict.conflict ? (
                            <span className="staff-ops-badge--conflict">Conflict</span>
                          ) : (
                            <span className="staff-ops-badge--clear">Clear</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleApprovePending(req.id)}
                            className="staff-ops-approve-btn"
                          >
                            Approve &amp; Assign
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeclinePending(req.id)}
                            className="staff-ops-decline-btn"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* BOTTOM CARD: Live Messages & Guest Feed */}
            <div className="staff-ops-stack-card" style={{ minHeight: 290 }}>
              <div className="staff-ops-col-header">
                <div className="flex items-center gap-2">
                  <i className="fas fa-comment-dots" style={{ color: '#0284C7', fontSize: '.84rem' }} />
                  <span className="staff-ops-col-title">Live Messages</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSearchParams({ view: 'messages' })}
                  className="staff-ops-link-btn"
                >
                  Full Inbox &rarr;
                </button>
              </div>

              {/* Thread Selector Pills */}
              <div className="staff-ops-threads-bar">
                {threads.map((t) => {
                  const isActive = t.id === activeThreadId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveThreadId(t.id)}
                      className={`staff-ops-thread-tab ${isActive ? 'active' : ''}`}
                    >
                      <span className="truncate">{t.name.split(' ')[0]}</span>
                      {t.unread > 0 && <span className="staff-ops-unread-dot" />}
                    </button>
                  );
                })}
              </div>

              {/* Chat Feed */}
              <div className="staff-ops-chat-feed">
                {currentThread.messages.map((m, idx) => {
                  const isMe = m.role === 'me';
                  return (
                    <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`staff-ops-bubble ${isMe ? 'staff-ops-bubble--me' : 'staff-ops-bubble--guest'}`}>
                        {!isMe && <div className="staff-ops-bubble-sender">{m.sender}</div>}
                        <p>{m.text}</p>
                      </div>
                      <span className="staff-ops-bubble-time">{m.time}</span>
                    </div>
                  );
                })}
              </div>

              {/* Quick Reply Form */}
              <form onSubmit={handleSendChatReply} className="staff-ops-quick-reply-form">
                <input
                  type="text"
                  placeholder="Reply to thread…"
                  value={chatReplyText}
                  onChange={(e) => setChatReplyText(e.target.value)}
                  className="staff-ops-reply-input"
                />
                <button type="submit" className="staff-ops-reply-btn">
                  <i className="fas fa-paper-plane" />
                </button>
              </form>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          VIEW B: 14-DAY ROOM TAPE CHART VIEW
          ========================================================================= */}
      {activeView === 'calendar' && (
        <div className="staff-ops-fullview-card">
          <div className="staff-ops-col-header" style={{ padding: '18px 24px', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Resort Calendar &amp; 14-Day Room Tape Chart
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '.78rem', color: '#64748B' }}>
                Visual occupancy timeline across all villas, beachfront cottages, cabanas, and tours
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="staff-ops-btn-group">
                <button
                  type="button"
                  className={`staff-ops-mode-btn ${tapeMode === 'tape' ? 'active' : ''}`}
                  onClick={() => setTapeMode('tape')}
                >
                  14-Day Tape Chart
                </button>
                <button
                  type="button"
                  className={`staff-ops-mode-btn ${tapeMode === 'month' ? 'active' : ''}`}
                  onClick={() => setTapeMode('month')}
                >
                  Monthly Calendar
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSearchParams({ view: 'dashboard' })}
                className="staff-ops-action-btn"
              >
                &larr; Back to Dashboard
              </button>
            </div>
          </div>

          <div style={{ padding: 24, overflowX: 'auto' }}>
            {/* Legend Bar */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 16, fontSize: '.75rem', color: '#475569' }}>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-500 inline-block" /> Confirmed Stay</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Checked-In / Active</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Pending Hold</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-400 inline-block" /> Maintenance Block</span>
            </div>

            {/* Tape Chart Table */}
            <table className="staff-ops-tape-table">
              <thead>
                <tr>
                  <th style={{ width: 220, textAlign: 'left', padding: '10px 14px' }}>Unit &amp; Category</th>
                  {Array.from({ length: 14 }, (_, i) => addDaysISO(tapeStartDate, i)).map((iso) => (
                    <th key={iso} style={{ textAlign: 'center', padding: '8px 6px', minWidth: 64 }}>
                      <div style={{ fontSize: '10px', color: '#64748B' }}>{formatDateShort(iso)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map((rm) => (
                  <tr key={rm.id}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0F172A', borderRight: '1px solid #E2E8F0' }}>
                      <div>{rm.name}</div>
                      <small style={{ color: '#64748B', fontWeight: 500 }}>{formatPHP(rm.rate)}/night</small>
                    </td>
                    {Array.from({ length: 14 }, (_, i) => addDaysISO(tapeStartDate, i)).map((iso) => {
                      const stay = bookings.find((b) => b.roomId === rm.id && iso >= b.checkIn && iso < b.checkOut && b.status !== 'cancelled');
                      const isStart = stay && stay.checkIn === iso;
                      return (
                        <td key={iso} style={{ padding: 4, textAlign: 'center', borderRight: '1px solid #F1F5F9' }}>
                          {stay ? (
                            <div className={`staff-ops-tape-block ${stay.status === 'checked_in' ? 'block--emerald' : 'block--sky'}`}>
                              {isStart ? stay.guest.split(' ')[0] : '•••'}
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setWalkInForm((p) => ({ ...p, roomId: rm.id, checkIn: iso }));
                                setShowWalkInModal(true);
                              }}
                              className="staff-ops-tape-empty"
                              title={`Click to book ${rm.name} on ${iso}`}
                            >
                              +
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW C: ROOMS & COTTAGES INVENTORY VIEW
          ========================================================================= */}
      {activeView === 'rooms' && (
        <div className="staff-ops-fullview-card">
          <div className="staff-ops-col-header" style={{ padding: '18px 24px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Rooms, Cottages &amp; Resort Amenities
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '.78rem', color: '#64748B' }}>
                Live property availability, turnover readiness, and nightly rates
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSearchParams({ view: 'dashboard' })}
              className="staff-ops-action-btn"
            >
              &larr; Back to Dashboard
            </button>
          </div>

          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {rooms.map((rm) => (
              <div key={rm.id} className="staff-ops-unit-card" style={{ padding: 18 }}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0F172A', fontWeight: 800 }}>{rm.name}</h3>
                    <div style={{ fontSize: '.78rem', color: '#64748B', marginTop: 2 }}>{rm.category} • {rm.capacity}</div>
                  </div>
                  <span className={`staff-ops-status-pill staff-ops-status-pill--${rm.status}`}>
                    {rm.status}
                  </span>
                </div>

                <p style={{ fontSize: '.82rem', color: '#475569', margin: '8px 0 16px' }}>{rm.note}</p>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="staff-ops-unit-price">{formatPHP(rm.rate)}<small>/night</small></span>
                  <button
                    type="button"
                    onClick={() => cycleRoomStatus(rm.id)}
                    className="staff-ops-action-btn"
                  >
                    Cycle Status
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW D: RESERVATIONS QUEUE VIEW
          ========================================================================= */}
      {activeView === 'reservations' && (
        <div className="staff-ops-fullview-card">
          <div className="staff-ops-col-header" style={{ padding: '18px 24px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Reservations Queue &amp; Check-In Ledger
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '.78rem', color: '#64748B' }}>
                Incoming bookings, confirmed allocations, and payment verification
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSearchParams({ view: 'dashboard' })}
              className="staff-ops-action-btn"
            >
              &larr; Back to Dashboard
            </button>
          </div>

          <div style={{ padding: 24 }}>
            {/* Table */}
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Guest &amp; Pax</th>
                    <th>Assigned Unit</th>
                    <th>Check-In / Out</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const rm = getRoomById(b.roomId);
                    return (
                      <tr key={b.id}>
                        <td><code>{b.id}</code></td>
                        <td>
                          <b>{b.guest}</b>
                          <div><small>{b.pax} Guests</small></div>
                        </td>
                        <td>{rm.name}</td>
                        <td>{formatDateShort(b.checkIn)} &rarr; {formatDateShort(b.checkOut)}</td>
                        <td><span className="tag">{b.payment}</span></td>
                        <td>
                          <span className={`pill ${b.status}`}>{b.status.replace('_', ' ')}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => {
                              navigate('/staff/reception');
                            }}
                            className="act-btn"
                          >
                            Open in Desk
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW E: GUEST MESSAGES FULL VIEW
          ========================================================================= */}
      {activeView === 'messages' && (
        <div className="staff-ops-fullview-card" style={{ minHeight: 600 }}>
          <div className="staff-ops-col-header" style={{ padding: '18px 24px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Resort Messaging Hub &amp; Guest Communications
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '.78rem', color: '#64748B' }}>
                Direct front desk inquiries, boat charter dispatch, and concierge requests
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSearchParams({ view: 'dashboard' })}
              className="staff-ops-action-btn"
            >
              &larr; Back to Dashboard
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', minHeight: 520 }}>
            {/* Thread List */}
            <div style={{ borderRight: '1px solid #E2E8F0', padding: 16, background: '#F8FAFC' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {threads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveThreadId(t.id)}
                    className={`staff-ops-unit-card ${t.id === activeThreadId ? 'selected' : ''}`}
                    style={{ textAlign: 'left', cursor: 'pointer', padding: 12, margin: 0 }}
                  >
                    <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '.86rem' }}>{t.name}</div>
                    <div style={{ fontSize: '.72rem', color: '#0284C7', marginTop: 2 }}>{t.unitLabel}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation Area */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {currentThread.messages.map((m, idx) => {
                  const isMe = m.role === 'me';
                  return (
                    <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`staff-ops-bubble ${isMe ? 'staff-ops-bubble--me' : 'staff-ops-bubble--guest'}`} style={{ maxWidth: '75%' }}>
                        {!isMe && <div className="staff-ops-bubble-sender">{m.sender}</div>}
                        <p>{m.text}</p>
                      </div>
                      <span className="staff-ops-bubble-time">{m.time}</span>
                    </div>
                  );
                })}
              </div>

              {/* Quick Template Pills */}
              <div style={{ padding: '8px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8, overflowX: 'auto', background: '#F8FAFC' }}>
                <button
                  type="button"
                  onClick={() => setChatReplyText('Check-in starts at 2:00 PM. Early luggage drop-off at Front Desk is complimentary!')}
                  className="staff-ops-action-btn"
                  style={{ fontSize: '.72rem' }}
                >
                  Check-in 2PM
                </button>
                <button
                  type="button"
                  onClick={() => setChatReplyText('Our Patar Beach & Cape Bolinao boat tour departs at 8:30 AM from the resort pier.')}
                  className="staff-ops-action-btn"
                  style={{ fontSize: '.72rem' }}
                >
                  Boat Tour Info
                </button>
                <button
                  type="button"
                  onClick={() => setChatReplyText('Housekeeping has been dispatched to your villa and will arrive in 10 minutes.')}
                  className="staff-ops-action-btn"
                  style={{ fontSize: '.72rem' }}
                >
                  Housekeeping ETA
                </button>
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendChatReply} style={{ padding: 16, borderTop: '1px solid #E2E8F0', display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  placeholder="Type a response to guest…"
                  value={chatReplyText}
                  onChange={(e) => setChatReplyText(e.target.value)}
                  className="staff-ops-reply-input"
                  style={{ flex: 1 }}
                />
                <button type="submit" className="staff-ops-reply-btn" style={{ width: 44, height: 44 }}>
                  <i className="fas fa-paper-plane" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW F: HOUSEKEEPING & MAINTENANCE BOARD
          ========================================================================= */}
      {activeView === 'housekeeping' && (
        <div className="staff-ops-fullview-card">
          <div className="staff-ops-col-header" style={{ padding: '18px 24px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Housekeeping Turnovers &amp; Maintenance Tickets
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '.78rem', color: '#64748B' }}>
                Turnover workflows, linen refreshes, and room repair dispatch
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSearchParams({ view: 'dashboard' })}
              className="staff-ops-action-btn"
            >
              &larr; Back to Dashboard
            </button>
          </div>

          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Housekeeping Column */}
            <div className="staff-ops-unit-card" style={{ padding: 20 }}>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#0F172A', fontWeight: 800 }}>
                  <i className="fas fa-sparkles" style={{ color: '#0D9488', marginRight: 8 }} />
                  Housekeeping Turnovers
                </h3>
                <span className="staff-ops-badge">
                  {tasks.filter((t) => t.dept === 'housekeeping' && t.status === 'open').length} Open
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tasks.filter((t) => t.dept === 'housekeeping').map((t) => (
                  <div key={t.id} style={{ padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                    <div style={{ fontWeight: 700, fontSize: '.84rem', color: '#0F172A' }}>{t.title}</div>
                    <div style={{ fontSize: '.74rem', color: '#64748B', marginTop: 4 }}>
                      Unit: {t.roomId} • Assigned to: {t.assignee}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Maintenance Column */}
            <div className="staff-ops-unit-card" style={{ padding: 20 }}>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#0F172A', fontWeight: 800 }}>
                  <i className="fas fa-wrench" style={{ color: '#E11D48', marginRight: 8 }} />
                  Maintenance &amp; Room Locks
                </h3>
                <span className="staff-ops-badge">
                  {tasks.filter((t) => t.dept === 'maintenance' && t.status === 'open').length} Open
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tasks.filter((t) => t.dept === 'maintenance').map((t) => (
                  <div key={t.id} style={{ padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                    <div style={{ fontWeight: 700, fontSize: '.84rem', color: '#0F172A' }}>{t.title}</div>
                    <div style={{ fontSize: '.74rem', color: '#64748B', marginTop: 4 }}>
                      Unit: {t.roomId} • Assigned to: {t.assignee}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: + WALK-IN BOOKING (WITH REAL-TIME CONFLICT ENGINE)
          ========================================================================= */}
      {showWalkInModal && (
        <div className="modal-overlay" onClick={() => setShowWalkInModal(false)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="label" style={{ color: '#0284C7', fontWeight: 700 }}>Direct Reception Walk-In</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '2px 0 0', color: '#0F172A' }}>
                  New Walk-In Booking
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWalkInModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', color: '#64748B', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateWalkIn} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label>GUEST FULL NAME</label>
                <input
                  required
                  placeholder="e.g. Maria Santos"
                  value={walkInForm.guest}
                  onChange={(e) => setWalkInForm({ ...walkInForm, guest: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>PARTY SIZE (PAX)</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    required
                    value={walkInForm.pax}
                    onChange={(e) => setWalkInForm({ ...walkInForm, pax: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label>PHONE / CONTACT</label>
                  <input
                    placeholder="0917-000-0000"
                    value={walkInForm.phone}
                    onChange={(e) => setWalkInForm({ ...walkInForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>CHECK-IN DATE</label>
                  <input
                    type="date"
                    required
                    value={walkInForm.checkIn}
                    onChange={(e) => setWalkInForm({ ...walkInForm, checkIn: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>CHECK-OUT DATE</label>
                  <input
                    type="date"
                    required
                    value={walkInForm.checkOut}
                    onChange={(e) => setWalkInForm({ ...walkInForm, checkOut: e.target.value })}
                  />
                </div>
              </div>

              <div className="field">
                <label>ASSIGN ACCOMMODATION / TOUR</label>
                <select
                  value={walkInForm.roomId}
                  onChange={(e) => setWalkInForm({ ...walkInForm, roomId: e.target.value })}
                >
                  {rooms.map((rm) => {
                    const check = checkRoomConflict(rm.id, walkInForm.checkIn, walkInForm.checkOut);
                    return (
                      <option key={rm.id} value={rm.id} disabled={check.conflict}>
                        {rm.name} ({formatPHP(rm.rate)}/night) {check.conflict ? `— [CONFLICT]` : '— [AVAILABLE]'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(false)}
                  className="staff-ops-action-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="staff-btn staff-btn--primary"
                  style={{ padding: '8px 20px', borderRadius: 8, fontWeight: 700 }}
                >
                  Confirm Walk-In &amp; Assign &rarr;
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
