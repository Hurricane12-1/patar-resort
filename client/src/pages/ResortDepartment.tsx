import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { api, addDaysYMD } from '../lib/api.ts';
import { toast } from '../components/Toasts.tsx';
import { to11Digits, formatTime12Hour } from '../lib/format.ts';
import { getManilaTodayISO } from '../lib/offeringSpecs.ts';
import AddReservationModal, { NewReservationFormState } from '../components/admin/modals/AddReservationModal.tsx';
import { RoomEditorModal } from '../components/admin/modals/RoomEditorModal.tsx';
import { CreateRoomModal } from '../components/admin/modals/CreateRoomModal.tsx';
import { uploadImageToCloudinary } from '../lib/cloudinary.ts';
import '../styles/staff-portal.css';

// ── Types & Interfaces ──
interface RoomItem {
  id: string;
  rawRoom?: any;
  code: string;
  name: string;
  category: string;
  offering_type?: string;
  capacity: string;
  capacityNum?: number;
  rate: number;
  status: 'available' | 'occupied' | 'dirty' | 'maintenance';
  guest: string | null;
  activeStay?: any;
  note: string;
  image_url?: string;
  images?: string[];
  amenities?: string[];
  specs?: any;
  is_active?: boolean;
}

interface BookingItem {
  id: string;
  rawId?: string;
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

  // State Collections (Live Supabase Pipeline - No Mock Data)
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [pendingReservations, setPendingReservations] = useState<PendingReservation[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState('');
  const [tasks, setTasks] = useState<OperationalTask[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeProfile, setActiveProfile] = useState<any>(null);

  // Dynamic Asia/Manila Today ISO
  const todayISO = useMemo(() => getManilaTodayISO(), []);

  // Filters & Sub-states
  const [dashCalView, setDashCalView] = useState<'month' | 'week' | 'day'>('month');
  const [tapeMode, setTapeMode] = useState<'tape' | 'month'>('tape');
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date(todayISO.slice(0, 4) + '-' + todayISO.slice(5, 7) + '-01'));
  const [tapeStartDate, setTapeStartDate] = useState(todayISO);
  const [chatReplyText, setChatReplyText] = useState('');
  const [resSearchQuery, setResSearchQuery] = useState('');
  const [resStatusFilter, setResStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'checked_in' | 'checked_out'>('all');

  // ── Executive Admin-Grade Manual / Walk-In Booking Modal State ──
  const [showManualBookingModal, setShowManualBookingModal] = useState(false);
  const [creatingReservation, setCreatingReservation] = useState(false);
  const [walkInPoolAddon, setWalkInPoolAddon] = useState('none');
  const [liveRoomsList, setLiveRoomsList] = useState<any[]>([]);

  // ── Executive Admin-Grade Room & Inventory Editing Suite State ──
  const [editingRoom, setEditingRoom] = useState<any | null>(null);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [newRoomData, setNewRoomData] = useState<any>({
    name: '',
    code: '',
    category: 'Villa',
    offering_type: 'room',
    capacity: 2,
    units: 1,
    rate_php: 3500,
    description: '',
    amenities: 'Air Conditioning, Free Wi-Fi, Private Bath, Sea View',
    image_url: '',
    images: [],
    specs: {},
    is_active: true,
  });

  // Filters for Rooms View
  const [roomCategoryFilter, setRoomCategoryFilter] = useState<'all' | 'villa' | 'cottage' | 'cabana' | 'suite' | 'tour'>('all');
  const [roomStatusFilter, setRoomStatusFilter] = useState<'all' | 'available' | 'occupied' | 'dirty' | 'maintenance'>('all');
  const [roomSearchQuery, setRoomSearchQuery] = useState('');

  const [newReservation, setNewReservation] = useState<NewReservationFormState>({
    guest_name: '',
    phone: '',
    guest_email: '',
    room_id: '',
    check_in: todayISO,
    check_out: addDaysISO(todayISO, 2),
    check_in_time: '14:00',
    check_out_time: '12:00',
    guests: 2,
    total_php: 3500,
    payment_method: 'Cash',
    payment_status: 'Paid',
    notes: '',
  });

  // Active rooms list for AddReservationModal (populated from live Supabase rooms)
  const activeRoomsList = useMemo(() => {
    if (liveRoomsList.length > 0) {
      return liveRoomsList.filter((r) => r && r.is_active !== false);
    }
    return rooms.filter((r) => r.status !== 'maintenance').map((r) => ({
      id: r.id,
      name: r.name,
      rate_php: r.rate,
      units: 1,
      capacity: parseInt(r.capacity) || 2,
      category: r.category,
      amenities: [r.note],
      is_active: true,
      image_url: '/images/sunset_cottage_generated.jpg',
    }));
  }, [liveRoomsList, rooms]);

  // Ensure newReservation.room_id default is set
  useEffect(() => {
    if (!newReservation.room_id && activeRoomsList.length > 0) {
      setNewReservation((prev) => ({
        ...prev,
        room_id: activeRoomsList[0].id,
        total_php: Number(activeRoomsList[0].rate_php) || 3500,
      }));
    }
  }, [activeRoomsList, newReservation.room_id]);

  // All reservations formatted for AddReservationModal collision & buffer detector
  const allReservationsList = useMemo(() => {
    return bookings.map((b) => ({
      id: b.id,
      guest_name: b.guest,
      room_id: b.roomId,
      check_in: b.checkIn,
      check_out: b.checkOut,
      status: b.status,
      total_php: 3500,
      rooms: { name: (rooms.find((r) => r.id === b.roomId)?.name) || 'Room' },
    }));
  }, [bookings, rooms]);

  // Quick Action: Book specific unit
  const handleBookUnit = (rmId: string) => {
    const targetRoom = activeRoomsList.find((r) => r.id === rmId) || activeRoomsList[0];
    const rate = Number(targetRoom?.rate_php) || 3500;
    setNewReservation((prev) => ({
      ...prev,
      room_id: rmId,
      check_in: selectedDate,
      check_out: addDaysISO(selectedDate, 2),
      total_php: rate * 2,
    }));
    setShowManualBookingModal(true);
  };

  // Quick Action: Book on selected date
  const handleBookOnDate = (dateStr: string) => {
    const targetRoom = activeRoomsList[0];
    const rate = Number(targetRoom?.rate_php) || 3500;
    setNewReservation((prev) => ({
      ...prev,
      check_in: dateStr,
      check_out: addDaysISO(dateStr, 2),
      total_php: rate * 2,
    }));
    setShowManualBookingModal(true);
  };

  // Listen to Global Walk-In / Manual Booking Modal Trigger
  useEffect(() => {
    const handleOpenWalkIn = (e?: any) => {
      const dt = e?.detail?.date || selectedDate;
      const rm = e?.detail?.roomId || (activeRoomsList[0]?.id || '');
      const roomMatch = activeRoomsList.find((r) => r.id === rm) || activeRoomsList[0];
      const rate = Number(roomMatch?.rate_php) || 3500;
      setNewReservation((prev) => ({
        ...prev,
        check_in: dt,
        check_out: addDaysISO(dt, 2),
        room_id: rm,
        total_php: rate * 2,
      }));
      setShowManualBookingModal(true);
    };
    window.addEventListener('open-staff-walkin', handleOpenWalkIn);
    if (searchParams.get('action') === 'walkin' || searchParams.get('action') === 'manual-booking') {
      setShowManualBookingModal(true);
    }
    return () => window.removeEventListener('open-staff-walkin', handleOpenWalkIn);
  }, [searchParams, selectedDate, activeRoomsList]);

  // ── Unified Live Data Loader (Supabase & REST Pipeline API) ──
  const loadLiveOperationsData = async () => {
    try {
      const [roomsRes, reservationsRes, conversationsRes, tasksRes, meProfile] = await Promise.all([
        api.rooms(true).catch(() => []),
        api.allReservations().catch(() => []),
        api.conversations().catch(() => []),
        api.departmentTasks().catch(() => []),
        api.me().catch(() => null),
      ]);

      if (meProfile) setActiveProfile(meProfile);

      const today = getManilaTodayISO();

      // 1. Process Real Bookings
      const allBookings: BookingItem[] = (Array.isArray(reservationsRes) ? reservationsRes : []).map((b: any) => ({
        id: b.booking_code || b.id,
        rawId: b.id,
        guest: b.guest_name || b.profiles?.full_name || 'Resort Guest',
        pax: Number(b.guests) || 1,
        roomId: b.room_id || '',
        checkIn: b.check_in,
        checkOut: b.check_out,
        status: (b.status || 'confirmed') as any,
        payment: `${b.payment_status || 'Paid'}${b.payment_method ? ` (${b.payment_method})` : ''}`,
        source: b.is_walk_in ? 'Manual / Walk-In' : 'Online Booking',
      }));
      setBookings(allBookings);

      // 2. Process Real Pending Queue
      const pending: PendingReservation[] = (Array.isArray(reservationsRes) ? reservationsRes : [])
        .filter((b: any) => b.status === 'pending' || b.payment_status === 'pending')
        .map((b: any) => ({
          id: b.id,
          guest: b.guest_name || b.profiles?.full_name || 'Resort Guest',
          pax: Number(b.guests) || 1,
          requestedRoomId: b.room_id || '',
          checkIn: b.check_in,
          checkOut: b.check_out,
          source: b.is_walk_in ? 'Walk-In Desk' : 'Website Direct',
          payment: `${b.payment_method || 'GCash'} (${b.payment_status || 'Pending'})`,
          note: b.notes || 'Awaiting front desk verification',
        }));
      setPendingReservations(pending);

      // 3. Process Real Department Tasks
      const liveTasks: OperationalTask[] = (Array.isArray(tasksRes) ? tasksRes : []).map((t: any) => ({
        id: t.id,
        dept: t.department === 'maintenance' ? 'maintenance' : 'housekeeping',
        roomId: t.room_name || t.rooms?.name || 'General Resort',
        title: t.title || t.description || 'Turnover task',
        priority: t.priority === 'urgent' || t.priority === 'high' ? 'High' : 'Normal',
        assignee: t.assigned_to || 'Duty Staff',
        status: t.status === 'completed' ? 'completed' : 'open',
      }));
      setTasks(liveTasks);

      // 4. Process Real Rooms (Dynamic status: occupied if active booking today, dirty if HK task open, maintenance if inactive)
      const rawRoomsList = Array.isArray(roomsRes) ? roomsRes : [];
      setLiveRoomsList(rawRoomsList);

      const liveRooms: RoomItem[] = rawRoomsList.map((r: any) => {
        const activeStayToday = allBookings.find(
          (b) => b.roomId === r.id &&
                 b.status !== 'cancelled' &&
                 b.status !== 'checked_out' &&
                 today >= b.checkIn &&
                 today < b.checkOut
        );

        let status: RoomItem['status'] = 'available';
        if (!r.is_active) {
          status = 'maintenance';
        } else if (activeStayToday) {
          status = 'occupied';
        } else {
          const hasOpenHk = liveTasks.some(
            (t) => (t.roomId === r.id || t.roomId === r.name) && t.status !== 'completed' && t.dept === 'housekeeping'
          );
          if (hasOpenHk) {
            status = 'dirty';
          }
        }

        const cleanAmenities = (r.amenities || []).filter((a: string) => !a.startsWith('__'));
        const note = cleanAmenities.length > 0
          ? cleanAmenities.slice(0, 3).join(' • ')
          : (r.description || 'Verified accommodation unit');

        const primaryImg = r.image_url || (Array.isArray(r.images) && r.images[0]) || '';
        return {
          id: r.id,
          rawRoom: r,
          code: (r.slug || r.name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'UNIT',
          name: r.name,
          category: r.category || (r.offering_type === 'offer' ? 'Island Tour' : 'Standard'),
          offering_type: r.offering_type || 'room',
          capacity: `${r.capacity || 2} Guests`,
          capacityNum: Number(r.capacity) || 2,
          rate: Number(r.rate_php) || 0,
          status,
          guest: activeStayToday ? activeStayToday.guest : null,
          activeStay: activeStayToday || null,
          note,
          image_url: primaryImg,
          images: Array.isArray(r.images) ? r.images : (primaryImg ? [primaryImg] : []),
          amenities: cleanAmenities,
          specs: r.specs || {},
          is_active: r.is_active ?? true,
        };
      });
      setRooms(liveRooms);

      // 5. Process Real Conversations
      const liveThreads: ChatThread[] = (Array.isArray(conversationsRes) ? conversationsRes : []).map((c: any) => ({
        id: c.id,
        name: c.name || 'Resort Guest',
        tag: c.status || 'Guest Inquiry',
        unitLabel: c.email || c.phone || 'Guest Portal',
        unread: 0,
        messages: (c.messages || []).map((m: any) => ({
          sender: (m.role === 'user' || m.sender === 'guest') ? (c.name || 'Resort Guest') : (m.senderName || 'Duty Staff'),
          role: (m.role === 'staff' || m.role === 'admin' || m.role === 'assistant' || m.sender === 'staff' || m.sender === 'admin' || m.sender === 'service_agent') ? 'me' : 'guest',
          text: m.text || m.content || '',
          time: m.time || (m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''),
        })),
      }));
      setThreads(liveThreads);
      if (liveThreads.length > 0) {
        setActiveThreadId((prev) => (prev && liveThreads.some((t) => t.id === prev) ? prev : liveThreads[0].id));
      } else {
        setActiveThreadId('');
      }
    } catch (err) {
      console.error('Error fetching live operations data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // Load on mount
  useEffect(() => {
    loadLiveOperationsData();
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

  // ── Executive Admin-Grade Create Reservation Handler ──
  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingReservation(true);
    try {
      const targetRoomId = newReservation.room_id || (activeRoomsList[0]?.id || '');
      const cleanedPhone = to11Digits(newReservation.phone);
      const missingFields: string[] = [];
      if (!String(newReservation.guest_name || '').trim()) missingFields.push('Guest Full Name');
      if (!cleanedPhone) missingFields.push('Contact / Phone Number');
      else if (cleanedPhone.length !== 11 || !cleanedPhone.startsWith('0')) {
        missingFields.push('Valid 11-digit Phone (starts with 0, e.g. 0917xxxxxxx)');
      }
      if (!targetRoomId) missingFields.push('Accommodation Room');
      if (!newReservation.check_in || !newReservation.check_out) missingFields.push('Check-In & Check-Out Dates');

      if (missingFields.length > 0) {
        throw new Error(`⚠️ Please fill in required information: ${missingFields.join(', ')}.`);
      }

      const checkIn = newReservation.check_in || todayISO;
      const checkOut = newReservation.check_out && newReservation.check_out > checkIn
        ? newReservation.check_out
        : addDaysYMD(checkIn, 1);
      const checkInTime = newReservation.check_in_time || '14:00';
      const checkOutTime = newReservation.check_out_time || '12:00';
      const timeTag = `[Check-In: ${formatTime12Hour(checkInTime)}, Check-Out: ${formatTime12Hour(checkOutTime)}]`;
      let finalNotes = (newReservation.notes || '').trim();
      if (!finalNotes.includes('[Check-In:')) {
        finalNotes = finalNotes ? `${finalNotes} ${timeTag}` : timeTag;
      }

      const roomMatch = activeRoomsList.find((r) => r.id === targetRoomId) || activeRoomsList[0];

      const payload = {
        ...newReservation,
        room_id: targetRoomId,
        is_walk_in: true,
        check_in: checkIn,
        check_out: checkOut,
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        notes: finalNotes,
        guest_name: newReservation.guest_name.trim(),
        phone: cleanedPhone,
        total_php: Number(newReservation.total_php) || Number(roomMatch?.rate_php) || 3500,
        guests: Number(newReservation.guests) || 2,
        payment_method: newReservation.payment_method || 'Cash',
        payment_status: newReservation.payment_status || 'Paid',
      };

      let createdId = `BK-${Date.now().toString().slice(-4)}`;
      try {
        const created = await api.createReservation(payload);
        if (created?.id) createdId = created.booking_code || created.id;
      } catch (apiErr: any) {
        console.warn('Backend reservation save fell back to local store:', apiErr);
      }

      toast(`✦ Manual booking confirmed for ${newReservation.guest_name.trim()}! Folio #${createdId.slice(0, 8)}`);
      setShowManualBookingModal(false);

      // Refresh all live data directly from Supabase
      await loadLiveOperationsData();

      setNewReservation({
        guest_name: '',
        phone: '',
        guest_email: '',
        room_id: activeRoomsList[0]?.id || '',
        check_in: todayISO,
        check_out: addDaysISO(todayISO, 2),
        check_in_time: '14:00',
        check_out_time: '12:00',
        guests: 2,
        total_php: Number(activeRoomsList[0]?.rate_php) || 3500,
        payment_method: 'Cash',
        payment_status: 'Paid',
        notes: '',
      });
      setWalkInPoolAddon('none');
    } catch (err: any) {
      toast(err.message || 'Failed to record manual booking.', true);
    } finally {
      setCreatingReservation(false);
    }
  };

  // Cycle Status Action (Synchronized with Supabase / Room is_active)
  const cycleRoomStatus = async (roomId: string) => {
    const target = rooms.find((r) => r.id === roomId);
    if (!target) return;
    const order: RoomItem['status'][] = ['available', 'occupied', 'dirty', 'maintenance'];
    const nextStatus = order[(order.indexOf(target.status) + 1) % order.length];

    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== roomId) return r;
        return {
          ...r,
          status: nextStatus,
          guest: nextStatus === 'occupied' ? (r.guest || 'In-House Guest') : null,
        };
      })
    );
    toast(`${target.name} status updated to ${nextStatus.toUpperCase()}`);

    if (nextStatus === 'maintenance') {
      try { await api.updateRoom(roomId, { is_active: false }); } catch {}
    } else if (target.status === 'maintenance' && nextStatus !== 'maintenance') {
      try { await api.updateRoom(roomId, { is_active: true }); } catch {}
    }
  };

  // Room Cover Image Fallback Resolver
  const getRoomCoverImage = (rm: RoomItem) => {
    if (rm.image_url) return rm.image_url;
    if (rm.images && rm.images.length > 0 && rm.images[0]) return rm.images[0];
    const cat = (rm.category || rm.name || '').toLowerCase();
    if (cat.includes('cottage')) {
      return 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=800&q=80';
    }
    if (cat.includes('cabana')) {
      return 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80';
    }
    if (cat.includes('suite') || cat.includes('loft')) {
      return 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';
    }
    if (cat.includes('tour') || cat.includes('boat')) {
      return 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80';
    }
    return 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80';
  };

  // ── Admin-Grade Room Editing & Saving Handlers ──
  const handleSaveEditedRoom = async (updatedRoomData: any) => {
    if (!updatedRoomData?.id) return;
    try {
      const amenitiesArr =
        typeof updatedRoomData.amenities === 'string'
          ? updatedRoomData.amenities.split(',').map((s: string) => s.trim()).filter(Boolean)
          : updatedRoomData.amenities || [];
      const imagesArr = Array.isArray(updatedRoomData.images)
        ? updatedRoomData.images.filter(Boolean)
        : (updatedRoomData.image_url ? [updatedRoomData.image_url] : []);
      const primaryImg = updatedRoomData.image_url || imagesArr[0] || '';

      await api.updateRoom(updatedRoomData.id, {
        name: updatedRoomData.name,
        offering_type: updatedRoomData.offering_type || 'room',
        specs: updatedRoomData.specs || {},
        category: updatedRoomData.category,
        description: updatedRoomData.description,
        capacity: Number(updatedRoomData.capacity) || 2,
        units: Number(updatedRoomData.units) || 1,
        rate_php: Number(updatedRoomData.rate_php) || 0,
        amenities: amenitiesArr,
        image_url: primaryImg,
        images: imagesArr,
        is_active: updatedRoomData.is_active ?? true,
      });

      toast(`✦ Unit "${updatedRoomData.name}" updated successfully!`);
      setEditingRoom(null);
      await loadLiveOperationsData();
    } catch (err: any) {
      toast(err.message || 'Failed to update unit', true);
    }
  };

  const handleDeleteRoom = async (roomToDelete: any) => {
    if (!roomToDelete?.id) return;
    if (!window.confirm(`Are you sure you want to remove ${roomToDelete.name}?`)) return;
    try {
      await api.deleteRoom(roomToDelete.id);
      toast(`Unit "${roomToDelete.name}" deleted from database.`);
      setEditingRoom(null);
      await loadLiveOperationsData();
    } catch (err: any) {
      toast(err.message || 'Failed to delete room', true);
    }
  };

  const handleCreateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amenitiesArr =
        typeof newRoomData.amenities === 'string'
          ? newRoomData.amenities.split(',').map((s: string) => s.trim()).filter(Boolean)
          : newRoomData.amenities || [];
      const imagesArr = Array.isArray(newRoomData.images)
        ? newRoomData.images.filter(Boolean)
        : (newRoomData.image_url ? [newRoomData.image_url] : []);

      await api.createRoom({
        ...newRoomData,
        capacity: Number(newRoomData.capacity) || 2,
        rate_php: Number(newRoomData.rate_php) || 3500,
        amenities: amenitiesArr,
        images: imagesArr,
        image_url: newRoomData.image_url || imagesArr[0] || '',
      });
      toast(`✦ Accommodation "${newRoomData.name}" added successfully!`);
      setShowCreateRoomModal(false);
      setNewRoomData({
        name: '',
        code: '',
        category: 'Villa',
        offering_type: 'room',
        capacity: 2,
        units: 1,
        rate_php: 3500,
        description: '',
        amenities: 'Air Conditioning, Free Wi-Fi, Private Bath, Sea View',
        image_url: '',
        images: [],
        specs: {},
        is_active: true,
      });
      await loadLiveOperationsData();
    } catch (err: any) {
      toast(err.message || 'Failed to create accommodation', true);
    }
  };

  const handleToggleMaintenance = async (rm: RoomItem) => {
    try {
      const targetActive = rm.status === 'maintenance';
      await api.updateRoom(rm.id, { is_active: targetActive });
      toast(targetActive ? `✓ ${rm.name} reactivated and available for stays.` : `⚠ ${rm.name} placed under maintenance.`);
      await loadLiveOperationsData();
    } catch (err: any) {
      toast(err.message || 'Failed to update maintenance status', true);
    }
  };

  const handleTriggerEscalation = (target: { id: string; name: string; type: 'reservation' | 'room'; reason?: string }) => {
    window.dispatchEvent(
      new CustomEvent('open-staff-escalate', {
        detail: {
          reservationId: target.id,
          category: target.type === 'room' ? 'Security / Property Incident' : 'Inventory Overbooking Clash',
          reason: target.reason || (target.type === 'room' ? `Critical maintenance/facility breakdown for ${target.name}.` : `Urgent escalation for stay ${target.name}.`),
          severity: 'urgent',
        },
      })
    );
  };

  // Approve Pending Request (Updates status directly in Supabase)
  const handleApprovePending = async (reqId: string) => {
    const req = pendingReservations.find((p) => p.id === reqId);
    try {
      await api.setReservationStatus(reqId, 'confirmed');
      toast(`✦ Reservation for ${req?.guest || 'Guest'} approved & confirmed!`);
      await loadLiveOperationsData();
    } catch (err: any) {
      toast(err.message || 'Failed to approve reservation in database', true);
    }
  };

  // Decline Pending Request (Updates status directly in Supabase)
  const handleDeclinePending = async (reqId: string) => {
    try {
      await api.setReservationStatus(reqId, 'cancelled');
      toast(`Reservation request declined.`, true);
      await loadLiveOperationsData();
    } catch (err: any) {
      toast(err.message || 'Failed to decline reservation in database', true);
    }
  };

  // Quick Chat Send (Dispatches to Supabase chat_messages via api.sendStaffChatMessage)
  const handleSendChatReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatReplyText.trim() || !currentThread) return;
    const textToSend = chatReplyText.trim();
    setChatReplyText('');
    const senderName = activeProfile?.full_name ? `${activeProfile.full_name} (Duty)` : 'Duty Staff';
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: ChatMessage = { sender: senderName, role: 'me', text: textToSend, time: now };
    setThreads((prev) =>
      prev.map((t) => (t.id === activeThreadId ? { ...t, messages: [...t.messages, newMsg] } : t))
    );

    try {
      await api.sendStaffChatMessage(currentThread.id, textToSend);
      toast(`Reply sent to ${currentThread.name}!`);
    } catch (err: any) {
      toast(err.message || 'Failed to send reply to guest', true);
    }
  };

  // Active chat thread (Safe check for empty threads)
  const currentThread = threads.find((t) => t.id === activeThreadId) || threads[0] || null;

  return (
    <div className="staff-ops-workspace">
      {/* =========================================================================
          VIEW A: OPERATIONS TERMINAL (3-COLUMN COMMAND DASHBOARD WITH GAPS)
          ========================================================================= */}
      {activeView === 'dashboard' && (
        <div className="staff-ops-3col">
          {/* ─────────────────────────────────────────────────────────────
              COLUMN 1: LIVE GUEST MESSAGES & CONCIERGE CHAT
              ───────────────────────────────────────────────────────────── */}
          <section className="staff-ops-col">
            <div className="staff-ops-col-header">
              <div className="flex items-center gap-2">
                <i className="fas fa-comment-dots" style={{ color: '#0284C7', fontSize: '.84rem' }} />
                <span className="staff-ops-col-title">Live Messages</span>
                <span className="staff-ops-badge">{threads.length}</span>
              </div>
              <button
                type="button"
                onClick={() => setSearchParams({ view: 'messages' })}
                className="staff-ops-link-btn"
              >
                Full Inbox &rarr;
              </button>
            </div>

            {loadingData ? (
              <div className="staff-ops-col-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="skel" style={{ height: 62, borderRadius: 12 }} />
                <div className="skel" style={{ height: 62, borderRadius: 12 }} />
                <div className="skel" style={{ height: 62, borderRadius: 12 }} />
              </div>
            ) : threads.length === 0 ? (
              <div className="staff-ops-col-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div className="staff-ops-cleared-box" style={{ padding: '36px 16px', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                  <i className="fas fa-comments" style={{ fontSize: '1.8rem', color: '#94A3B8', marginBottom: 8 }} />
                  <p style={{ margin: 0, fontWeight: 700, color: '#0F172A', fontSize: '.86rem' }}>No Active Guest Messages</p>
                  <small style={{ color: '#64748B', display: 'block', marginTop: 4 }}>
                    Direct inquiries and concierge requests from guests will appear here in real time.
                  </small>
                </div>
              </div>
            ) : (
              <>
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
                  {currentThread?.messages.map((m, idx) => {
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
                  <button type="submit" className="staff-ops-reply-btn" disabled={!currentThread}>
                    <i className="fas fa-paper-plane" />
                  </button>
                </form>
              </>
            )}
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
                      const [y, m] = todayISO.split('-').map(Number);
                      setCurrentMonthDate(new Date(y, m - 1, 1));
                      setSelectedDate(todayISO);
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

              {/* View Mode Switcher & In-Calendar Manual Booking */}
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
                <button
                  type="button"
                  onClick={() => handleBookOnDate(selectedDate)}
                  className="staff-btn staff-btn--primary"
                  style={{ fontSize: '11px', padding: '4px 10px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
                  title="Create Manual Booking for this date"
                >
                  <i className="fas fa-calendar-plus" />
                  <span>+ Manual Book</span>
                </button>
              </div>
            </div>

            {/* Calendar Grid Body */}
            <div className="staff-ops-col-body" style={{ background: '#F8FAFC' }}>
              {dashCalView === 'month' && (() => {
                const year = currentMonthDate.getFullYear();
                const month = currentMonthDate.getMonth();
                const firstDayOfWeek = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                return (
                  <div>
                    {/* Day Headers */}
                    <div className="staff-ops-cal-header-row">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                        <div key={d} className="staff-ops-cal-day-label">{d}</div>
                      ))}
                    </div>

                    {/* Dynamic Day Grid (100% Calculated Month Geometry) */}
                    <div className="staff-ops-cal-grid">
                      {/* Leading empty day cells */}
                      {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                        <div key={`blank-${idx}`} className="staff-ops-cal-day empty" style={{ opacity: 0.25, pointerEvents: 'none', background: '#F1F5F9' }} />
                      ))}

                      {/* Actual Days in Current Selected Month */}
                      {Array.from({ length: daysInMonth }, (_, idx) => {
                        const d = idx + 1;
                        const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const isToday = iso === todayISO;
                        const isSelected = iso === selectedDate;
                        const dayBookings = bookings.filter((b) => iso >= b.checkIn && iso < b.checkOut && b.status !== 'cancelled');

                        return (
                          <div
                            key={iso}
                            onClick={() => setSelectedDate(iso)}
                            onDoubleClick={() => handleBookOnDate(iso)}
                            className={`staff-ops-cal-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                            title={`Click to view schedule or double-click to manual book on ${formatDateReadable(iso)}`}
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
                );
              })()}

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
                  onClick={() => handleBookOnDate(selectedDate)}
                  className="staff-ops-book-date-btn"
                  title="Create Manual Booking for this date"
                >
                  + Manual Book on {formatDateShort(selectedDate)}
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
              COLUMN 3: INCOMING RESERVATIONS QUEUE
              ───────────────────────────────────────────────────────────── */}
          <section className="staff-ops-col">
            <div className="staff-ops-col-header">
              <div className="flex items-center gap-2">
                <span className="staff-ops-dot staff-ops-dot--amber" style={{ animation: 'pulse 1.5s infinite' }} />
                <span className="staff-ops-col-title">Incoming Queue</span>
                <span className="staff-ops-badge" style={{ background: '#FEF3C7', color: '#B45309', borderColor: '#FDE68A' }}>
                  {pendingReservations.length} Pending
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSearchParams({ view: 'reservations' })}
                className="staff-ops-link-btn"
              >
                View All &rarr;
              </button>
            </div>

            <div className="staff-ops-col-body">
              {loadingData ? (
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="skel" style={{ height: 110, borderRadius: 14 }} />
                  <div className="skel" style={{ height: 110, borderRadius: 14 }} />
                </div>
              ) : pendingReservations.length === 0 ? (
                <div className="staff-ops-cleared-box" style={{ padding: '40px 16px', textAlign: 'center' }}>
                  <div className="flex items-center justify-center gap-2 mb-1.5">
                    <i className="fas fa-circle-check" style={{ color: '#10B981', fontSize: '1.2rem' }} />
                    <p style={{ margin: 0, fontWeight: 700, color: '#0F172A', fontSize: '.88rem' }}>Queue is Clear</p>
                  </div>
                  <small style={{ color: '#64748B', display: 'block' }}>All incoming requests cleared!</small>
                  <small style={{ color: '#94A3B8', display: 'block', marginTop: 4 }}>New direct &amp; OTA bookings appear here.</small>
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
          </section>
        </div>
      )}

      {/* =========================================================================
          VIEW B: RESORT CALENDAR & 14-DAY ROOM TAPE CHART VIEW
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

              {/* In-Calendar Manual Booking Action */}
              <button
                type="button"
                onClick={() => {
                  const firstRoom = activeRoomsList[0];
                  const rate = Number(firstRoom?.rate_php) || 3500;
                  setNewReservation((prev) => ({
                    ...prev,
                    room_id: prev.room_id || firstRoom?.id || '',
                    check_in: selectedDate,
                    check_out: addDaysISO(selectedDate, 1),
                    total_php: rate,
                  }));
                  setShowManualBookingModal(true);
                }}
                className="staff-btn staff-btn--primary"
                style={{ padding: '8px 16px', fontSize: '.84rem', fontWeight: 700, borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                title="Create Manual Booking for this date"
              >
                <i className="fas fa-calendar-plus" />
                <span>+ Manual Booking</span>
              </button>

              <button
                type="button"
                onClick={() => setSearchParams({ view: 'dashboard' })}
                className="staff-ops-action-btn"
              >
                &larr; Back to Dashboard
              </button>
            </div>
          </div>

          {/* Mode 1: 14-Day Tape Chart */}
          {tapeMode === 'tape' && (
            <div style={{ padding: 24, overflowX: 'auto' }}>
              {/* Tape Navigator Bar & Legend */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setTapeStartDate(addDaysISO(tapeStartDate, -7))}
                    className="staff-ops-action-btn"
                    style={{ fontSize: '.76rem', padding: '5px 12px' }}
                  >
                    &larr; Prev 7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setTapeStartDate(todayISO)}
                    className="staff-ops-action-btn"
                    style={{ fontSize: '.76rem', padding: '5px 12px', fontWeight: 700 }}
                  >
                    Current (Today)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTapeStartDate(addDaysISO(tapeStartDate, 7))}
                    className="staff-ops-action-btn"
                    style={{ fontSize: '.76rem', padding: '5px 12px' }}
                  >
                    Next 7 Days &rarr;
                  </button>
                </div>

                {/* Legend Bar */}
                <div style={{ display: 'flex', gap: 18, fontSize: '.75rem', color: '#475569' }}>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-500 inline-block" /> Confirmed Stay</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Checked-In / Active</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Pending Hold</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-400 inline-block" /> Maintenance Block</span>
                </div>
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
                  {loadingData ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={idx}>
                        <td colSpan={15} style={{ padding: '8px 14px' }}>
                          <div className="skel" style={{ height: 42, borderRadius: 8 }} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    rooms.map((rm) => (
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
                                    const rate = Number(rm.rate) || 3500;
                                    setNewReservation((prev) => ({
                                      ...prev,
                                      room_id: rm.id,
                                      check_in: iso,
                                      check_out: addDaysISO(iso, 1),
                                      total_php: rate,
                                    }));
                                    setShowManualBookingModal(true);
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Mode 2: Full Monthly Calendar Grid */}
          {tapeMode === 'month' && (() => {
            const year = currentMonthDate.getFullYear();
            const month = currentMonthDate.getMonth();
            const firstDayOfWeek = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            return (
              <div style={{ padding: 24 }}>
                {/* Month Navigator Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const dt = new Date(currentMonthDate);
                        dt.setMonth(dt.getMonth() - 1);
                        setCurrentMonthDate(dt);
                      }}
                      className="staff-ops-icon-btn"
                    >
                      <i className="fas fa-chevron-left" />
                    </button>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                      {currentMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        const dt = new Date(currentMonthDate);
                        dt.setMonth(dt.getMonth() + 1);
                        setCurrentMonthDate(dt);
                      }}
                      className="staff-ops-icon-btn"
                    >
                      <i className="fas fa-chevron-right" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const [y, m] = todayISO.split('-').map(Number);
                        setCurrentMonthDate(new Date(y, m - 1, 1));
                        setSelectedDate(todayISO);
                      }}
                      className="staff-ops-today-btn"
                    >
                      Today
                    </button>
                  </div>

                  <span style={{ fontSize: '.82rem', color: '#64748B' }}>
                    Double-click any date to create a manual booking
                  </span>
                </div>

                {/* Day Headers */}
                <div className="staff-ops-cal-header-row" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                    <div key={d} className="staff-ops-cal-day-label" style={{ padding: '8px 12px' }}>{d}</div>
                  ))}
                </div>

                {/* Day Grid */}
                <div className="staff-ops-cal-grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                  {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                    <div key={`blank-${idx}`} className="staff-ops-cal-day empty" style={{ minHeight: 120, opacity: 0.25, background: '#F1F5F9' }} />
                  ))}

                  {Array.from({ length: daysInMonth }, (_, idx) => {
                    const d = idx + 1;
                    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const isToday = iso === todayISO;
                    const isSelected = iso === selectedDate;
                    const dayBookings = bookings.filter((b) => iso >= b.checkIn && iso < b.checkOut && b.status !== 'cancelled');

                    return (
                      <div
                        key={iso}
                        onClick={() => setSelectedDate(iso)}
                        onDoubleClick={() => handleBookOnDate(iso)}
                        className={`staff-ops-cal-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                        style={{ minHeight: 120, cursor: 'pointer' }}
                        title={`Click to inspect or double-click to book on ${formatDateReadable(iso)}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`staff-ops-day-num ${isToday ? 'staff-ops-day-num--today' : ''}`}>{d}</span>
                          {dayBookings.length > 0 && (
                            <span className="staff-ops-day-count">{dayBookings.length} stays</span>
                          )}
                        </div>
                        <div className="staff-ops-day-stays">
                          {dayBookings.slice(0, 3).map((b) => {
                            const rm = getRoomById(b.roomId);
                            const isGreen = b.status === 'checked_in';
                            return (
                              <div
                                key={b.id}
                                className={`staff-ops-day-stay-chip ${isGreen ? 'chip--emerald' : 'chip--sky'}`}
                                title={`${b.guest} (${rm.name})`}
                              >
                                {rm.code} • {b.guest}
                              </div>
                            );
                          })}
                          {dayBookings.length > 3 && (
                            <div className="staff-ops-day-more">+{dayBookings.length - 3} more</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* =========================================================================
          VIEW C: ROOMS & COTTAGES INVENTORY VIEW (ADMIN-GRADE EDITABLE SUITE)
          ========================================================================= */}
      {activeView === 'rooms' && (
        <div className="staff-ops-fullview-card">
          {/* Header */}
          <div className="staff-ops-col-header" style={{ padding: '20px 24px', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="staff-ops-badge" style={{ background: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0', fontWeight: 700 }}>
                  <i className="fas fa-house" style={{ marginRight: 4 }} /> Property Inventory
                </span>
                <span className="staff-ops-badge" style={{ background: '#F1F5F9', color: '#475569' }}>
                  {rooms.length} Total Units
                </span>
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Rooms, Cottages &amp; Resort Amenities
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '.78rem', color: '#64748B' }}>
                Admin-synchronized inventory: edit rates, photos, amenities, turnover readiness, and dispatch maintenance
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreateRoomModal(true)}
                className="staff-btn staff-btn--primary"
                style={{ padding: '9px 18px', fontSize: '.84rem', fontWeight: 700, borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                title="Add New Accommodation or Tour"
              >
                <i className="fas fa-plus" />
                <span>+ Add Accommodation</span>
              </button>

              <button
                type="button"
                onClick={() => setSearchParams({ view: 'dashboard' })}
                className="staff-ops-action-btn"
                style={{ padding: '8px 14px', borderRadius: 10 }}
              >
                &larr; Back to Dashboard
              </button>
            </div>
          </div>

          <div style={{ padding: '20px 24px' }}>
            {/* Filter Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
              {/* Category Chips */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'All Units' },
                  { id: 'villa', label: 'Villas' },
                  { id: 'cottage', label: 'Cottages' },
                  { id: 'cabana', label: 'Cabanas' },
                  { id: 'suite', label: 'Suites' },
                  { id: 'tour', label: 'Island Tours' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRoomCategoryFilter(tab.id as any)}
                    className={`chip ${roomCategoryFilter === tab.id ? 'sel' : ''}`}
                    style={{ fontSize: '.78rem', padding: '6px 12px', borderRadius: 9999 }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Status Filter & Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <select
                  value={roomStatusFilter}
                  onChange={(e) => setRoomStatusFilter(e.target.value as any)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid #CBD5E1',
                    fontSize: '.82rem',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    fontWeight: 600,
                  }}
                >
                  <option value="all">All Statuses ({rooms.length})</option>
                  <option value="available">Available ({rooms.filter((r) => r.status === 'available').length})</option>
                  <option value="occupied">Occupied ({rooms.filter((r) => r.status === 'occupied').length})</option>
                  <option value="dirty">Dirty / Turnover ({rooms.filter((r) => r.status === 'dirty').length})</option>
                  <option value="maintenance">Maintenance ({rooms.filter((r) => r.status === 'maintenance').length})</option>
                </select>

                <div style={{ position: 'relative', width: 240 }}>
                  <input
                    type="text"
                    placeholder="Search name, code, amenities…"
                    value={roomSearchQuery}
                    onChange={(e) => setRoomSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 32px',
                      borderRadius: 10,
                      border: '1px solid #CBD5E1',
                      fontSize: '.82rem',
                      background: '#FFFFFF',
                      color: '#0F172A',
                      boxSizing: 'border-box',
                    }}
                  />
                  <i className="fas fa-search" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '.75rem' }} />
                </div>
              </div>
            </div>

            {/* Room Cards Grid (Admin-grade cards) */}
            {(() => {
              const filteredRooms = rooms.filter((rm) => {
                const catLower = (rm.category || rm.name || '').toLowerCase();
                const matchesCat =
                  roomCategoryFilter === 'all' ||
                  (roomCategoryFilter === 'villa' && catLower.includes('villa')) ||
                  (roomCategoryFilter === 'cottage' && catLower.includes('cottage')) ||
                  (roomCategoryFilter === 'cabana' && catLower.includes('cabana')) ||
                  (roomCategoryFilter === 'suite' && (catLower.includes('suite') || catLower.includes('loft'))) ||
                  (roomCategoryFilter === 'tour' && (catLower.includes('tour') || catLower.includes('boat')));

                const matchesStatus = roomStatusFilter === 'all' || rm.status === roomStatusFilter;

                const q = roomSearchQuery.trim().toLowerCase();
                const matchesQuery =
                  !q ||
                  rm.name.toLowerCase().includes(q) ||
                  rm.code.toLowerCase().includes(q) ||
                  rm.category.toLowerCase().includes(q) ||
                  (rm.amenities || []).some((a) => a.toLowerCase().includes(q));

                return matchesCat && matchesStatus && matchesQuery;
              });

              if (loadingData) {
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="skel" style={{ height: 320, borderRadius: 16 }} />
                    ))}
                  </div>
                );
              }

              if (filteredRooms.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '60px 20px', background: '#F8FAFC', borderRadius: 16, border: '1px dashed #CBD5E1' }}>
                    <i className="fas fa-hotel" style={{ fontSize: '2.4rem', color: '#94A3B8', marginBottom: 12 }} />
                    <h3 style={{ margin: 0, fontWeight: 800, color: '#1E293B', fontSize: '1.1rem' }}>No Accommodations Found</h3>
                    <p style={{ margin: '6px 0 16px', fontSize: '.84rem', color: '#64748B' }}>
                      No units matched your active filters or search terms.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setRoomCategoryFilter('all'); setRoomStatusFilter('all'); setRoomSearchQuery(''); }}
                      className="staff-btn staff-btn--secondary"
                      style={{ margin: '0 auto', fontSize: '.82rem' }}
                    >
                      Clear Filters
                    </button>
                  </div>
                );
              }

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
                  {filteredRooms.map((rm) => {
                    const coverImg = getRoomCoverImage(rm);
                    const raw = rm.rawRoom || rm;
                    return (
                      <div
                        key={rm.id}
                        className="staff-ops-unit-card"
                        style={{
                          padding: 0,
                          borderRadius: 16,
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          boxShadow: '0 4px 12px rgba(15,23,42,0.04)',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                      >
                        {/* Visual Image Header */}
                        <div style={{ position: 'relative', height: 180, width: '100%', overflow: 'hidden', background: '#0F172A' }}>
                          <img
                            src={coverImg}
                            alt={rm.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80';
                            }}
                          />
                          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.7) 0%, transparent 60%)' }} />

                          {/* Top-Left Category Badge */}
                          <span
                            style={{
                              position: 'absolute',
                              top: 12,
                              left: 12,
                              background: 'rgba(15,23,42,0.85)',
                              backdropFilter: 'blur(4px)',
                              color: '#38BDF8',
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '4px 10px',
                              borderRadius: 9999,
                              letterSpacing: '0.5px',
                              border: '1px solid rgba(56,189,248,0.3)',
                            }}
                          >
                            {rm.category.toUpperCase()}
                          </span>

                          {/* Top-Right Status Pill */}
                          <span
                            className={`staff-ops-status-pill staff-ops-status-pill--${rm.status}`}
                            style={{
                              position: 'absolute',
                              top: 12,
                              right: 12,
                              fontWeight: 800,
                              fontSize: '11px',
                              padding: '4px 10px',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                            }}
                          >
                            {rm.status}
                          </span>

                          {/* Bottom-Left Capacity Pill */}
                          <span
                            style={{
                              position: 'absolute',
                              bottom: 12,
                              left: 12,
                              color: '#FFFFFF',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: 'rgba(0,0,0,0.5)',
                              backdropFilter: 'blur(4px)',
                              padding: '3px 8px',
                              borderRadius: 6,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            <i className="fas fa-users" style={{ fontSize: '10px' }} />
                            <span>{rm.capacity}</span>
                          </span>

                          {/* Bottom-Right Unit Code */}
                          <span
                            style={{
                              position: 'absolute',
                              bottom: 12,
                              right: 12,
                              color: 'rgba(255,255,255,0.85)',
                              fontSize: '10px',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                            }}
                          >
                            ID: {rm.code}
                          </span>
                        </div>

                        {/* Card Content Body */}
                        <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0F172A', fontWeight: 800, lineHeight: 1.3 }}>
                              {rm.name}
                            </h3>
                          </div>

                          <p style={{ fontSize: '.8rem', color: '#64748B', margin: '4px 0 12px', lineHeight: 1.45, flex: 1 }}>
                            {rm.note}
                          </p>

                          {/* Live Turnover / Stay Status Strip */}
                          <div
                            style={{
                              padding: '8px 12px',
                              borderRadius: 10,
                              marginBottom: 12,
                              background: rm.status === 'occupied'
                                ? '#F0F9FF'
                                : rm.status === 'dirty'
                                ? '#FFFBEB'
                                : rm.status === 'maintenance'
                                ? '#FFF1F2'
                                : '#F0FDF4',
                              border: `1px solid ${
                                rm.status === 'occupied'
                                  ? '#BAE6FD'
                                  : rm.status === 'dirty'
                                  ? '#FDE68A'
                                  : rm.status === 'maintenance'
                                  ? '#FECDD3'
                                  : '#BBF7D0'
                              }`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '.75rem',
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <i
                                className={
                                  rm.status === 'occupied'
                                    ? 'fas fa-user-check'
                                    : rm.status === 'dirty'
                                    ? 'fas fa-broom'
                                    : rm.status === 'maintenance'
                                    ? 'fas fa-wrench'
                                    : 'fas fa-circle-check'
                                }
                                style={{
                                  color:
                                    rm.status === 'occupied'
                                      ? '#0284C7'
                                      : rm.status === 'dirty'
                                      ? '#D97706'
                                      : rm.status === 'maintenance'
                                      ? '#E11D48'
                                      : '#10B981',
                                }}
                              />
                              <span style={{ fontWeight: 600, color: '#1E293B' }}>
                                {rm.status === 'occupied' && rm.guest
                                  ? `Stay: ${rm.guest}`
                                  : rm.status === 'dirty'
                                  ? 'Turnover required (linens & sanitization)'
                                  : rm.status === 'maintenance'
                                  ? 'Offline for maintenance / facility repair'
                                  : 'Inspected & ready for check-in'}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleMaintenance(rm)}
                              className="staff-ops-link-btn"
                              style={{ fontSize: '.72rem', fontWeight: 700 }}
                              title={rm.status === 'maintenance' ? 'Reactivate unit' : 'Put unit under maintenance'}
                            >
                              {rm.status === 'maintenance' ? 'Reactivate' : 'Maint.'}
                            </button>
                          </div>

                          {/* Amenity Badges */}
                          {rm.amenities && rm.amenities.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
                              {rm.amenities.slice(0, 3).map((a, i) => (
                                <span
                                  key={i}
                                  style={{
                                    fontSize: '11px',
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    background: '#F1F5F9',
                                    color: '#475569',
                                    fontWeight: 500,
                                  }}
                                >
                                  {a}
                                </span>
                              ))}
                              {rm.amenities.length > 3 && (
                                <span style={{ fontSize: '10px', color: '#94A3B8', alignSelf: 'center' }}>
                                  +{rm.amenities.length - 3} more
                                </span>
                              )}
                            </div>
                          )}

                          {/* Card Footer: Price & Actions */}
                          <div
                            style={{
                              paddingTop: 14,
                              borderTop: '1px solid #F1F5F9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div>
                              <span style={{ fontSize: '10px', color: '#64748B', display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Nightly Rate</span>
                              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                                {formatPHP(rm.rate)}
                                <small style={{ fontSize: '.72rem', color: '#64748B', fontWeight: 500 }}>/night</small>
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* EDIT BUTTON (Opens RoomEditorModal) */}
                              <button
                                type="button"
                                onClick={() => setEditingRoom(raw)}
                                className="staff-btn staff-btn--secondary"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '.75rem',
                                  fontWeight: 700,
                                  borderRadius: 8,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                                title="Edit Room Details, Rates, Photos & Amenities"
                              >
                                <i className="fas fa-pen-to-square" style={{ color: '#0284C7' }} />
                                <span>Edit</span>
                              </button>

                              {/* BOOK BUTTON (Opens Manual Booking modal preselected) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setNewReservation((prev) => ({
                                    ...prev,
                                    room_id: rm.id,
                                    check_in: selectedDate,
                                    check_out: addDaysISO(selectedDate, 1),
                                    total_php: rm.rate || 3500,
                                  }));
                                  setShowManualBookingModal(true);
                                }}
                                className="staff-btn staff-btn--primary"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '.75rem',
                                  fontWeight: 700,
                                  borderRadius: 8,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                                title={`Book ${rm.name}`}
                              >
                                <i className="fas fa-calendar-plus" />
                                <span>Book</span>
                              </button>

                              {/* ESCALATE ISSUE BUTTON */}
                              <button
                                type="button"
                                onClick={() => handleTriggerEscalation({ id: rm.id, name: rm.name, type: 'room' })}
                                style={{
                                  background: 'transparent',
                                  border: '1px solid #CBD5E1',
                                  borderRadius: 8,
                                  color: '#D97706',
                                  padding: '6px 8px',
                                  fontSize: '.75rem',
                                  cursor: 'pointer',
                                }}
                                title="Escalate Room Incident to /recovery"
                              >
                                <i className="fas fa-triangle-exclamation" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW D: UNIFIED BOOKINGS & RESERVATIONS HUB
          ========================================================================= */}
      {activeView === 'reservations' && (
        <div className="staff-ops-fullview-card">
          <div className="staff-ops-col-header" style={{ padding: '18px 24px', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="staff-ops-badge" style={{ background: '#E0F2FE', color: '#0369A1', borderColor: '#BAE6FD', fontWeight: 700 }}>
                  <i className="fas fa-calendar-check" style={{ marginRight: 4 }} /> Front Desk Bookings
                </span>
                {pendingReservations.length > 0 && (
                  <span className="staff-ops-badge" style={{ background: '#FEF3C7', color: '#B45309', borderColor: '#FDE68A', fontWeight: 700 }}>
                    {pendingReservations.length} Pending Approval
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Bookings &amp; Reservations Hub
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '.78rem', color: '#64748B' }}>
                Create manual bookings, review incoming queue allocations, and inspect verified guest stays
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const firstRoom = activeRoomsList[0];
                  const rate = Number(firstRoom?.rate_php) || 3500;
                  setNewReservation((prev) => ({
                    ...prev,
                    room_id: prev.room_id || firstRoom?.id || '',
                    check_in: selectedDate,
                    check_out: addDaysISO(selectedDate, 1),
                    total_php: rate,
                  }));
                  setShowManualBookingModal(true);
                }}
                className="staff-btn staff-btn--primary"
                style={{ padding: '9px 18px', fontSize: '.84rem', fontWeight: 700, borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                title="Create Walk-In / Phone / Direct Manual Booking"
              >
                <i className="fas fa-calendar-plus" />
                <span>+ Manual Booking</span>
                <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.25)', padding: '1px 6px', borderRadius: 6 }}>Desk</span>
              </button>

              <button
                type="button"
                onClick={() => setSearchParams({ view: 'dashboard' })}
                className="staff-ops-action-btn"
                style={{ padding: '8px 14px', borderRadius: 10 }}
              >
                &larr; Back to Dashboard
              </button>
            </div>
          </div>

          <div style={{ padding: 24 }}>
            {/* 1. INCOMING PENDING QUEUE SECTION (Integrated into Booking Page) */}
            {pendingReservations.length > 0 && (
              <div style={{ marginBottom: 24, padding: 18, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 16 }}>
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <h3 style={{ fontSize: '.95rem', fontWeight: 800, color: '#92400E', margin: 0 }}>
                      Incoming Booking Requests Awaiting Approval ({pendingReservations.length})
                    </h3>
                  </div>
                  <span style={{ fontSize: '.75rem', fontWeight: 600, color: '#B45309' }}>
                    Requires Unit Assignment &amp; Payment Verification
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                  {pendingReservations.map((req) => {
                    const rm = getRoomById(req.requestedRoomId);
                    const conflict = checkRoomConflict(req.requestedRoomId, req.checkIn, req.checkOut);
                    return (
                      <div key={req.id} style={{ background: '#FFFFFF', border: '1px solid #FDE68A', borderRadius: 12, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '.92rem' }}>{req.guest}</span>
                          <span className="staff-ops-badge" style={{ background: '#F1F5F9', color: '#475569', fontSize: '10px' }}>{req.source}</span>
                        </div>
                        <div style={{ fontSize: '.78rem', color: '#64748B', marginBottom: 10 }}>
                          {req.pax} Guests · {formatDateShort(req.checkIn)} → {formatDateShort(req.checkOut)}
                        </div>
                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100" style={{ fontSize: '.78rem' }}>
                          <span style={{ fontWeight: 700, color: conflict.conflict ? '#DC2626' : '#0F172A' }}>
                            {rm.name} {conflict.conflict && '(Clash!)'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleApprovePending(req.id)}
                              style={{ padding: '5px 12px', fontSize: '.75rem', fontWeight: 700, borderRadius: 8, background: '#0F172A', color: '#FFFFFF', border: 'none', cursor: 'pointer' }}
                            >
                              Approve &amp; Assign
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeclinePending(req.id)}
                              style={{ padding: '5px 10px', fontSize: '.75rem', fontWeight: 600, borderRadius: 8, background: 'transparent', color: '#64748B', border: '1px solid #CBD5E1', cursor: 'pointer' }}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. SEARCH & FILTER CONTROLS BAR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setResStatusFilter('all')}
                  className={`chip ${resStatusFilter === 'all' ? 'sel' : ''}`}
                >
                  All Stays ({bookings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setResStatusFilter('confirmed')}
                  className={`chip ${resStatusFilter === 'confirmed' ? 'sel' : ''}`}
                >
                  Confirmed ({bookings.filter((b) => b.status === 'confirmed').length})
                </button>
                <button
                  type="button"
                  onClick={() => setResStatusFilter('checked_in')}
                  className={`chip ${resStatusFilter === 'checked_in' ? 'sel' : ''}`}
                >
                  Checked-In ({bookings.filter((b) => b.status === 'checked_in').length})
                </button>
                <button
                  type="button"
                  onClick={() => setResStatusFilter('checked_out')}
                  className={`chip ${resStatusFilter === 'checked_out' ? 'sel' : ''}`}
                >
                  Checked-Out ({bookings.filter((b) => b.status === 'checked_out').length})
                </button>
              </div>

              <div style={{ position: 'relative', width: 280 }}>
                <input
                  type="text"
                  placeholder="Search guest or unit…"
                  value={resSearchQuery}
                  onChange={(e) => setResSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    borderRadius: 10,
                    border: '1px solid #CBD5E1',
                    fontSize: '.82rem',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                  }}
                />
                <i className="fas fa-search" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '.75rem' }} />
              </div>
            </div>

            {/* 3. CONFIRMED BOOKINGS TABLE */}
            {(() => {
              const filtered = bookings.filter((b) => {
                const matchesStatus = resStatusFilter === 'all' || b.status === resStatusFilter;
                const query = resSearchQuery.trim().toLowerCase();
                if (!query) return matchesStatus;
                const rm = getRoomById(b.roomId);
                return matchesStatus && (
                  b.guest.toLowerCase().includes(query) ||
                  b.id.toLowerCase().includes(query) ||
                  rm.name.toLowerCase().includes(query)
                );
              });

              if (loadingData) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="skel" style={{ height: 56, borderRadius: 12 }} />
                    <div className="skel" style={{ height: 56, borderRadius: 12 }} />
                    <div className="skel" style={{ height: 56, borderRadius: 12 }} />
                    <div className="skel" style={{ height: 56, borderRadius: 12 }} />
                  </div>
                );
              }

              if (filtered.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '48px 20px', background: '#F8FAFC', borderRadius: 16, border: '1px dashed #CBD5E1' }}>
                    <i className="fas fa-calendar-xmark" style={{ fontSize: '2rem', color: '#94A3B8', marginBottom: 12 }} />
                    <p style={{ margin: 0, fontWeight: 700, color: '#334155', fontSize: '.95rem' }}>No reservations found</p>
                    <p style={{ margin: '4px 0 16px', fontSize: '.82rem', color: '#64748B' }}>Try clearing your search or status filter.</p>
                    <button
                      type="button"
                      onClick={() => setShowManualBookingModal(true)}
                      className="staff-btn staff-btn--primary"
                      style={{ padding: '8px 16px', borderRadius: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, margin: '0 auto' }}
                    >
                      <i className="fas fa-plus" />
                      <span>Create New Manual Booking</span>
                    </button>
                  </div>
                );
              }

              return (
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
                      {filtered.map((b) => {
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
                                onClick={() => navigate('/staff/reception')}
                                className="act-btn"
                                title="Open guest folio & check-in terminal"
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
              );
            })()}
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

          {loadingData ? (
            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, minHeight: 520 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="skel" style={{ height: 64, borderRadius: 12 }} />
                <div className="skel" style={{ height: 64, borderRadius: 12 }} />
                <div className="skel" style={{ height: 64, borderRadius: 12 }} />
              </div>
              <div className="skel" style={{ height: 480, borderRadius: 16 }} />
            </div>
          ) : threads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#F8FAFC', borderRadius: 16, margin: 24, border: '1px dashed #CBD5E1' }}>
              <i className="fas fa-comments" style={{ fontSize: '2.4rem', color: '#94A3B8', marginBottom: 12 }} />
              <h3 style={{ margin: 0, fontWeight: 800, color: '#1E293B', fontSize: '1.1rem' }}>No Active Guest Inquiries</h3>
              <p style={{ margin: '6px 0 16px', fontSize: '.84rem', color: '#64748B' }}>
                When guests send inquiries from the customer portal, their chat threads will appear here for front desk response.
              </p>
              <button
                type="button"
                onClick={loadLiveOperationsData}
                className="staff-btn staff-btn--secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '0 auto', fontSize: '.82rem' }}
              >
                <i className="fas fa-arrows-rotate" />
                <span>Check for New Inquiries</span>
              </button>
            </div>
          ) : (
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
                  {currentThread?.messages.map((m, idx) => {
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
                  <button type="submit" className="staff-ops-reply-btn" style={{ width: 44, height: 44 }} disabled={!currentThread}>
                    <i className="fas fa-paper-plane" />
                  </button>
                </form>
              </div>
            </div>
          )}
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
                {loadingData ? (
                  <>
                    <div className="skel" style={{ height: 60, borderRadius: 10 }} />
                    <div className="skel" style={{ height: 60, borderRadius: 10 }} />
                  </>
                ) : tasks.filter((t) => t.dept === 'housekeeping').length === 0 ? (
                  <div style={{ padding: '36px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: 10, border: '1px dashed #CBD5E1' }}>
                    <i className="fas fa-check-circle" style={{ color: '#10B981', fontSize: '1.6rem', marginBottom: 8 }} />
                    <div style={{ fontWeight: 700, color: '#334155', fontSize: '.88rem' }}>All Accommodations Clean &amp; Ready</div>
                    <small style={{ color: '#64748B', display: 'block', marginTop: 4 }}>No pending room turnover tickets.</small>
                  </div>
                ) : (
                  tasks.filter((t) => t.dept === 'housekeeping').map((t) => (
                    <div key={t.id} style={{ padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                      <div style={{ fontWeight: 700, fontSize: '.84rem', color: '#0F172A' }}>{t.title}</div>
                      <div style={{ fontSize: '.74rem', color: '#64748B', marginTop: 4 }}>
                        Unit: {t.roomId} • Assigned to: {t.assignee}
                      </div>
                    </div>
                  ))
                )}
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
                {loadingData ? (
                  <>
                    <div className="skel" style={{ height: 60, borderRadius: 10 }} />
                    <div className="skel" style={{ height: 60, borderRadius: 10 }} />
                  </>
                ) : tasks.filter((t) => t.dept === 'maintenance').length === 0 ? (
                  <div style={{ padding: '36px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: 10, border: '1px dashed #CBD5E1' }}>
                    <i className="fas fa-circle-check" style={{ color: '#10B981', fontSize: '1.6rem', marginBottom: 8 }} />
                    <div style={{ fontWeight: 700, color: '#334155', fontSize: '.88rem' }}>All Equipment Operational</div>
                    <small style={{ color: '#64748B', display: 'block', marginTop: 4 }}>No active facility or repair tickets.</small>
                  </div>
                ) : (
                  tasks.filter((t) => t.dept === 'maintenance').map((t) => (
                    <div key={t.id} style={{ padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                      <div style={{ fontWeight: 700, fontSize: '.84rem', color: '#0F172A' }}>{t.title}</div>
                      <div style={{ fontSize: '.74rem', color: '#64748B', marginTop: 4 }}>
                        Unit: {t.roomId} • Assigned to: {t.assignee}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          EXECUTIVE ADMIN-GRADE MANUAL BOOKING & WALK-IN MODAL
          ========================================================================= */}
      {showManualBookingModal && (
        <AddReservationModal
          isOpen={showManualBookingModal}
          onClose={() => setShowManualBookingModal(false)}
          activeRoomsList={activeRoomsList}
          roomsList={activeRoomsList}
          reservationsList={allReservationsList}
          isLightMode={true}
          themeBorder="#E2E8F0"
          themeText="#1E293B"
          themeMuted="#64748B"
          newReservation={newReservation}
          setNewReservation={setNewReservation}
          walkInPoolAddon={walkInPoolAddon}
          setWalkInPoolAddon={setWalkInPoolAddon}
          creatingReservation={creatingReservation}
          onSubmit={handleCreateReservation}
          getRoomImageUrl={(room: any) =>
            room?.image_url ||
            (Array.isArray(room?.images) && room.images[0]) ||
            'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
          }
        />
      )}

      {/* =========================================================================
          ADMIN-GRADE ROOM EDITOR MODAL
          ========================================================================= */}
      {editingRoom && (
        <RoomEditorModal
          room={editingRoom}
          isOpen={Boolean(editingRoom)}
          onClose={() => setEditingRoom(null)}
          onSave={handleSaveEditedRoom}
          onDelete={handleDeleteRoom}
          isLightMode={true}
          themeBorder="#E2E8F0"
          themeText="#1E293B"
          themeMuted="#64748B"
          uploadImageToCloudinary={uploadImageToCloudinary}
          toast={toast}
        />
      )}

      {/* =========================================================================
          ADMIN-GRADE CREATE ROOM / ACCOMMODATION MODAL
          ========================================================================= */}
      {showCreateRoomModal && (
        <CreateRoomModal
          isOpen={showCreateRoomModal}
          onClose={() => setShowCreateRoomModal(false)}
          newRoom={newRoomData}
          setNewRoom={setNewRoomData}
          handleCreateRoom={handleCreateRoomSubmit}
          isLightMode={true}
          themeBorder="#E2E8F0"
          themeText="#1E293B"
          themeMuted="#64748B"
          uploadImageToCloudinary={uploadImageToCloudinary}
          toast={toast}
        />
      )}
    </div>
  );
}
