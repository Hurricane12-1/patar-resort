import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from './Toasts.tsx';
import { money, fmtDate } from '../lib/format.ts';
import { supabase } from '../lib/supabaseClient.ts';

export interface CalendarStay {
  id: string;
  unitId: string;
  roomId?: string;
  assignedUnitId?: string;
  assignedUnitNumber?: number;
  unitName: string;
  guestName: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  checkInTime?: string;
  checkOutTime?: string;
  status: 'confirmed' | 'pending' | 'checked_in' | 'checked_out' | 'cancelled';
  totalPhp?: number;
  phone?: string;
  email?: string;
  notes?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  colorType?: 'green' | 'orange' | 'purple' | 'gray' | 'blue';
}

export interface UnitInfo {
  id: string;
  roomId: string;
  unitNumber: number;
  name: string;
  label: string;
  ratePhp: number;
}

interface AvailabilityCalendarProps {
  selectedRoomId?: string;
  rooms?: any[];
  bookings?: any[];
  initialCheckIn?: string;
  initialCheckOut?: string;
  onSelectDates?: (
    checkIn: string,
    checkOut: string,
    roomId?: string,
    unitInfo?: UnitInfo
  ) => void;
  onRoomChange?: (roomId: string) => void;
  onSelectBooking?: (booking: any) => void;
  onNewBooking?: () => void;
  onViewList?: () => void;
  isLightMode?: boolean;
  onClose?: () => void;
  mode?: 'timeline' | 'picker';
}

export default function AvailabilityCalendar({
  selectedRoomId,
  rooms = [],
  bookings = [],
  onSelectDates,
  onRoomChange,
  onSelectBooking,
  onNewBooking,
  onViewList,
  isLightMode = true,
}: AvailabilityCalendarProps) {
  // Live states fetched directly from Supabase
  const [liveRooms, setLiveRooms] = useState<any[]>([]);
  const [liveBookings, setLiveBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Dynamic today's date
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // 14-day rolling window starting 3 days before today
  const [windowStartDateStr, setWindowStartDateStr] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return d.toISOString().slice(0, 10);
  });

  const [activeTab, setActiveTab] = useState<'calendar' | 'list'>('calendar');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'checked_in' | 'checked_out' | 'cancelled'>('all');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>(selectedRoomId || 'all');
  const [selectedCell, setSelectedCell] = useState<{ unitId: string; dateStr: string } | null>(null);
  const [activeDetailStay, setActiveDetailStay] = useState<CalendarStay | null>(null);
  const [searchListQuery, setSearchListQuery] = useState('');

  // Synchronize room filter if parent prop changes
  useEffect(() => {
    if (selectedRoomId) {
      setSelectedRoomFilter(selectedRoomId);
    }
  }, [selectedRoomId]);

  // Real-Time Supabase Fetcher
  const fetchRealtimeData = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Fetch Rooms directly from Supabase
      const { data: dbRooms, error: rErr } = await supabase
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: true });

      if (rErr) throw rErr;
      if (dbRooms) {
        setLiveRooms(dbRooms);
      }

      // 2. Fetch Reservations with associated relations from Supabase
      const { data: dbReservations, error: bErr } = await supabase
        .from('reservations')
        .select('*, rooms(id, name, rate_php), profiles(id, full_name, email, phone)')
        .order('check_in', { ascending: true });

      if (bErr) throw bErr;
      if (dbReservations) {
        setLiveBookings(dbReservations);
      }
    } catch (err: any) {
      console.warn('[Realtime Calendar Notice]:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to real-time postgres changes
  useEffect(() => {
    fetchRealtimeData();

    const channel = supabase
      .channel('realtime:availability_pms_calendar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        fetchRealtimeData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRealtimeData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRealtimeData]);

  // Combine live rooms with prop rooms if live is empty
  const effectiveRooms = useMemo(() => {
    if (liveRooms.length > 0) return liveRooms;
    if (rooms && rooms.length > 0) return rooms;
    return [];
  }, [liveRooms, rooms]);

  // Combine live bookings with prop bookings if live is empty
  const effectiveBookings = useMemo(() => {
    if (liveBookings.length > 0) return liveBookings;
    if (bookings && bookings.length > 0) return bookings;
    return [];
  }, [liveBookings, bookings]);

  // Map rooms into Units (expanding physical units if room.units > 1, optionally filtered by selected room)
  const units = useMemo(() => {
    const list: UnitInfo[] = [];

    const roomsToRender = selectedRoomFilter && selectedRoomFilter !== 'all'
      ? effectiveRooms.filter((r) => r.id === selectedRoomFilter)
      : effectiveRooms;

    const sourceRooms = roomsToRender.length > 0 ? roomsToRender : effectiveRooms;

    sourceRooms.forEach((r, idx) => {
      const numUnits = Math.max(1, Number(r.units) || 1);
      if (numUnits > 1) {
        for (let u = 1; u <= numUnits; u++) {
          list.push({
            id: `${r.id}__u${u}`,
            roomId: r.id,
            unitNumber: u,
            name: `${r.name} - Unit ${u}`,
            label: `${r.name} (Unit ${u})`,
            ratePhp: r.rate_php || 3500,
          });
        }
      } else {
        list.push({
          id: r.id,
          roomId: r.id,
          unitNumber: 1,
          name: r.name || `Unit ${idx + 1}`,
          label: r.name || `Unit ${idx + 1}`,
          ratePhp: r.rate_php || 3500,
        });
      }
    });

    return list;
  }, [effectiveRooms, selectedRoomFilter]);

  // Real-time stays transformed directly from Supabase with deterministic unit bin-packing
  // Ensures reservations only reflect on their assigned unit and leave available units free
  const allStays = useMemo(() => {
    const staysList: CalendarStay[] = [];

    // Process each room individually so units are packed correctly
    effectiveRooms.forEach((r) => {
      const numUnits = Math.max(1, Number(r.units) || 1);
      const roomBookings = effectiveBookings.filter((b: any) => b.room_id === r.id);

      if (roomBookings.length === 0) return;

      // Separate active and cancelled reservations
      const activeBookings = roomBookings
        .filter((b: any) => b.status !== 'cancelled')
        .sort((a: any, b: any) => {
          const cA = (a.check_in || '').slice(0, 10);
          const cB = (b.check_in || '').slice(0, 10);
          if (cA !== cB) return cA.localeCompare(cB);
          return (a.id || '').localeCompare(b.id || '');
        });

      const cancelledBookings = roomBookings.filter((b: any) => b.status === 'cancelled');

      // Timeline tracker for each physical unit: array of booked date intervals
      const unitTimelines: { checkIn: string; checkOut: string; bookingId: string }[][] = Array.from(
        { length: numUnits },
        () => []
      );
      const assignedUnitMap = new Map<string, number>(); // bookingId -> 1-based unitNumber

      // Pass 1: Bookings with an explicitly designated unit in notes (e.g. "[Unit 2]" or "Unit 2")
      activeBookings.forEach((b: any) => {
        const noteMatch = (b.notes || '').match(/\[?(?:Unit\s*|u)(\d+)\]?/i);
        if (noteMatch) {
          const reqUnit = parseInt(noteMatch[1], 10);
          if (reqUnit >= 1 && reqUnit <= numUnits) {
            const cin = (b.check_in || '').slice(0, 10);
            const cout = (b.check_out || '').slice(0, 10);
            const timeline = unitTimelines[reqUnit - 1];
            // Check for collision: interval overlap if cin < cout2 && cout > cin2
            const hasCollision = timeline.some((t) => cin < t.checkOut && cout > t.checkIn);
            if (!hasCollision) {
              timeline.push({ checkIn: cin, checkOut: cout, bookingId: b.id });
              assignedUnitMap.set(b.id, reqUnit);
            }
          }
        }
      });

      // Pass 2: Bin-pack remaining active bookings into the first available unit with no date overlap
      activeBookings.forEach((b: any) => {
        if (assignedUnitMap.has(b.id)) return; // already assigned in Pass 1

        const cin = (b.check_in || '').slice(0, 10);
        const cout = (b.check_out || '').slice(0, 10);

        // Find the first unit that has no overlapping interval
        let targetUnitIndex = -1;
        for (let u = 0; u < numUnits; u++) {
          const hasCollision = unitTimelines[u].some((t) => cin < t.checkOut && cout > t.checkIn);
          if (!hasCollision) {
            targetUnitIndex = u;
            break;
          }
        }

        // If all units have overlap (overbooking fallback), choose unit with fewest active bookings
        if (targetUnitIndex === -1) {
          let minOverlapIdx = 0;
          let minCount = unitTimelines[0].length;
          for (let u = 1; u < numUnits; u++) {
            if (unitTimelines[u].length < minCount) {
              minCount = unitTimelines[u].length;
              minOverlapIdx = u;
            }
          }
          targetUnitIndex = minOverlapIdx;
        }

        unitTimelines[targetUnitIndex].push({ checkIn: cin, checkOut: cout, bookingId: b.id });
        assignedUnitMap.set(b.id, targetUnitIndex + 1);
      });

      // Pass 3: Cancelled bookings (assign to preferred unit or unit 1 without blocking unit timeline)
      cancelledBookings.forEach((b: any) => {
        const noteMatch = (b.notes || '').match(/\[?(?:Unit\s*|u)(\d+)\]?/i);
        let uNum = 1;
        if (noteMatch) {
          const reqUnit = parseInt(noteMatch[1], 10);
          if (reqUnit >= 1 && reqUnit <= numUnits) uNum = reqUnit;
        }
        assignedUnitMap.set(b.id, uNum);
      });

      // Build CalendarStay objects for all bookings of this room
      roomBookings.forEach((b: any, bIdx: number) => {
        const assignedUnitNum = assignedUnitMap.get(b.id) || 1;
        const assignedUnitId = numUnits > 1 ? `${r.id}__u${assignedUnitNum}` : r.id;
        const assignedUnitName = numUnits > 1 ? `${r.name} - Unit ${assignedUnitNum}` : (r.name || 'Accommodation');

        let color: 'green' | 'orange' | 'purple' | 'gray' = 'green';
        if (b.status === 'pending') color = 'orange';
        else if (b.status === 'checked_out') color = 'purple';
        else if (b.status === 'cancelled') color = 'gray';

        const checkIn = (b.check_in || '').slice(0, 10);
        const checkOut = (b.check_out || '').slice(0, 10);

        staysList.push({
          id: b.id || `res-${r.id}-${bIdx}`,
          unitId: assignedUnitId,
          roomId: r.id,
          assignedUnitId,
          assignedUnitNumber: assignedUnitNum,
          unitName: assignedUnitName,
          guestName: b.guest_name || b.profiles?.full_name || 'Guest',
          checkIn,
          checkOut,
          checkInTime: '2:00 PM',
          checkOutTime: '12:00 PM',
          status: (b.status || 'confirmed') as CalendarStay['status'],
          totalPhp: b.total_php || r.rate_php || 3500,
          phone: b.phone || b.profiles?.phone || '',
          email: b.guest_email || b.profiles?.email || '',
          notes: b.notes || '',
          paymentStatus: b.payment_status || 'unpaid',
          paymentMethod: b.payment_method || 'Cash',
          colorType: color,
        });
      });
    });

    // Also include any bookings for rooms not currently found in effectiveRooms (safety fallback)
    const knownRoomIds = new Set(effectiveRooms.map((r) => r.id));
    effectiveBookings.forEach((b: any, idx: number) => {
      if (!b.room_id || !knownRoomIds.has(b.room_id)) {
        const checkIn = (b.check_in || '').slice(0, 10);
        const checkOut = (b.check_out || '').slice(0, 10);
        let color: 'green' | 'orange' | 'purple' | 'gray' = 'green';
        if (b.status === 'pending') color = 'orange';
        else if (b.status === 'checked_out') color = 'purple';
        else if (b.status === 'cancelled') color = 'gray';

        staysList.push({
          id: b.id || `orphan-${idx}`,
          unitId: b.room_id || `orphan-${idx}`,
          roomId: b.room_id || '',
          assignedUnitId: b.room_id || `orphan-${idx}`,
          assignedUnitNumber: 1,
          unitName: b.rooms?.name || 'Accommodation',
          guestName: b.guest_name || b.profiles?.full_name || 'Guest',
          checkIn,
          checkOut,
          checkInTime: '2:00 PM',
          checkOutTime: '12:00 PM',
          status: (b.status || 'confirmed') as CalendarStay['status'],
          totalPhp: b.total_php || 3500,
          phone: b.phone || b.profiles?.phone || '',
          email: b.guest_email || b.profiles?.email || '',
          notes: b.notes || '',
          paymentStatus: b.payment_status || 'unpaid',
          paymentMethod: b.payment_method || 'Cash',
          colorType: color,
        });
      }
    });

    return staysList;
  }, [effectiveBookings, effectiveRooms]);

  // Generate 14-day array starting from windowStartDateStr
  const daysArray = useMemo(() => {
    const days: { dateStr: string; dayNum: number; dayOfWeek: string; isToday: boolean }[] = [];
    const cur = new Date(windowStartDateStr + 'T00:00:00');

    for (let i = 0; i < 14; i++) {
      const dStr = cur.toISOString().slice(0, 10);
      const dayNum = cur.getDate();
      const dayOfWeek = cur.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      days.push({
        dateStr: dStr,
        dayNum,
        dayOfWeek,
        isToday: dStr === todayStr,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [windowStartDateStr, todayStr]);

  const windowEndDateStr = daysArray[13]?.dateStr || windowStartDateStr;

  // Formatted date range: e.g. "Oct 17 – Oct 30, 2026"
  const dateRangeLabel = useMemo(() => {
    const startD = new Date(windowStartDateStr + 'T00:00:00');
    const endD = new Date(windowEndDateStr + 'T00:00:00');

    const startMonth = startD.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endD.toLocaleDateString('en-US', { month: 'short' });
    const startDay = startD.getDate();
    const endDay = endD.getDate();
    const year = endD.getFullYear();

    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
  }, [windowStartDateStr, windowEndDateStr]);

  // Real-time metrics computed 100% from Supabase records
  const metrics = useMemo(() => {
    const arriving = allStays.filter((s) => s.checkIn === todayStr && s.status !== 'cancelled').length;
    const departing = allStays.filter((s) => s.checkOut === todayStr && s.status !== 'cancelled').length;
    const staysInView = allStays.filter(
      (s) => s.checkIn <= windowEndDateStr && s.checkOut >= windowStartDateStr && s.status !== 'cancelled'
    ).length;

    const counts = {
      all: allStays.length,
      confirmed: allStays.filter((s) => s.status === 'confirmed').length,
      pending: allStays.filter((s) => s.status === 'pending').length,
      checked_in: allStays.filter((s) => s.status === 'checked_in').length,
      checked_out: allStays.filter((s) => s.status === 'checked_out').length,
      cancelled: allStays.filter((s) => s.status === 'cancelled').length,
    };

    return {
      arriving,
      departing,
      staysInView,
      counts,
    };
  }, [allStays, todayStr, windowStartDateStr, windowEndDateStr]);

  // Filtered stays by status
  const visibleStays = useMemo(() => {
    if (statusFilter === 'all') return allStays;
    return allStays.filter((s) => s.status === statusFilter);
  }, [allStays, statusFilter]);

  // Navigation handlers
  const handlePrevWindow = () => {
    const cur = new Date(windowStartDateStr + 'T00:00:00');
    cur.setDate(cur.getDate() - 7);
    setWindowStartDateStr(cur.toISOString().slice(0, 10));
  };

  const handleNextWindow = () => {
    const cur = new Date(windowStartDateStr + 'T00:00:00');
    cur.setDate(cur.getDate() + 7);
    setWindowStartDateStr(cur.toISOString().slice(0, 10));
  };

  const handleTodayClick = () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    setWindowStartDateStr(d.toISOString().slice(0, 10));
    setSelectedCell(null);
  };

  // Export CSV handler with live Supabase data
  const handleExportCsv = () => {
    const headers = ['Unit', 'Guest Name', 'Check-in', 'Check-out', 'Status', 'Total (PHP)', 'Phone', 'Payment Status'];
    const rows = visibleStays.map((s) => [
      `"${s.unitName}"`,
      `"${s.guestName}"`,
      `"${s.checkIn}"`,
      `"${s.checkOut}"`,
      `"${s.status}"`,
      s.totalPhp || 3500,
      `"${s.phone || ''}"`,
      `"${s.paymentStatus || 'unpaid'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Supabase_Reservations_${windowStartDateStr}_to_${windowEndDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('📥 Real-time reservations schedule exported to CSV!');
  };

  // Empty cell click handler
  const handleCellClick = (unitId: string, dateStr: string) => {
    setSelectedCell({ unitId, dateStr });
    const nextDay = new Date(dateStr + 'T00:00:00');
    nextDay.setDate(nextDay.getDate() + 1);
    const coutStr = nextDay.toISOString().slice(0, 10);

    const matchedUnit = units.find((u) => u.id === unitId || u.roomId === unitId);
    toast(`Selected ${matchedUnit?.name || 'Unit'} on ${fmtDate(dateStr)}. Click "+ New booking" to reserve.`);

    if (onSelectDates) {
      onSelectDates(dateStr, coutStr, matchedUnit?.roomId || unitId, matchedUnit);
    }
  };

  // Booking pill click handler
  const handleBookingClick = (stay: CalendarStay) => {
    setActiveDetailStay(stay);
    if (onSelectBooking) {
      onSelectBooking(stay);
    }
  };

  // Tab switch
  const handleTabChange = (tab: 'calendar' | 'list') => {
    setActiveTab(tab);
    if (tab === 'list' && onViewList) {
      onViewList();
    }
  };

  return (
    <div
      style={{
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: isLightMode ? '#1E293B' : '#F1F5F9',
        width: '100%',
      }}
    >
      {/* 1. TOP BAR: Calendar/List Switcher & Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {/* Left Segmented Control */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: isLightMode ? '#F1F5F9' : '#1E293B',
            padding: 4,
            borderRadius: 12,
            border: `1px solid ${isLightMode ? '#E2E8F0' : '#334155'}`,
          }}
        >
          <button
            type="button"
            onClick={() => handleTabChange('calendar')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 18px',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontWeight: activeTab === 'calendar' ? 700 : 500,
              background: activeTab === 'calendar' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'calendar' ? '#0F172A' : '#64748B',
              border: 'none',
              boxShadow: activeTab === 'calendar' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <i className="far fa-calendar-alt" style={{ fontSize: '0.9rem', color: activeTab === 'calendar' ? '#4F46E5' : '#64748B' }} />
            <span>Calendar</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('list')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 18px',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontWeight: activeTab === 'list' ? 700 : 500,
              background: activeTab === 'list' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'list' ? '#0F172A' : '#64748B',
              border: 'none',
              boxShadow: activeTab === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <i className="fas fa-list-ul" style={{ fontSize: '0.85rem' }} />
            <span>List</span>
          </button>
        </div>

        {/* Right Actions: Export & New Booking */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={handleExportCsv}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              borderRadius: 10,
              background: isLightMode ? '#FFFFFF' : '#1E293B',
              color: isLightMode ? '#334155' : '#F1F5F9',
              border: `1px solid ${isLightMode ? '#CBD5E1' : '#475569'}`,
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease',
            }}
          >
            <i className="fas fa-download" style={{ fontSize: '0.82rem' }} />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onNewBooking) {
                onNewBooking();
              } else if (onSelectDates) {
                const nextDay = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
                onSelectDates(todayStr, nextDay, units[0]?.roomId || '');
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 20px',
              borderRadius: 10,
              background: '#4F46E5',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.35)',
              transition: 'all 0.15s ease',
            }}
          >
            <i className="fas fa-plus" style={{ fontSize: '0.8rem' }} />
            <span>New booking</span>
          </button>
        </div>
      </div>

      {/* 2. REAL-TIME STATUS FILTER BAR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: isLightMode ? '#F8FAFC' : '#0F172A',
          padding: '6px 10px',
          borderRadius: 16,
          border: `1px solid ${isLightMode ? '#E2E8F0' : '#1E293B'}`,
          marginBottom: 16,
          overflowX: 'auto',
        }}
      >
        {(
          [
            { key: 'all', label: 'All', count: metrics.counts.all },
            { key: 'confirmed', label: 'Confirmed', count: metrics.counts.confirmed },
            { key: 'pending', label: 'Pending', count: metrics.counts.pending },
            { key: 'checked_in', label: 'Checked in', count: metrics.counts.checked_in },
            { key: 'checked_out', label: 'Checked out', count: metrics.counts.checked_out },
            { key: 'cancelled', label: 'Cancelled', count: metrics.counts.cancelled },
          ] as const
        ).map((item) => {
          const isActive = statusFilter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setStatusFilter(item.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 16px',
                borderRadius: 10,
                border: isActive ? `1px solid ${isLightMode ? '#E2E8F0' : '#334155'}` : '1px solid transparent',
                background: isActive ? (isLightMode ? '#FFFFFF' : '#1E293B') : 'transparent',
                color: isActive ? '#4F46E5' : '#64748B',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{item.label}</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 9999,
                  background: isActive ? '#EEF2FF' : isLightMode ? '#F1F5F9' : '#334155',
                  color: isActive ? '#4F46E5' : '#94A3B8',
                }}
              >
                {item.count}
              </span>
            </button>
          );
        })}

        {/* Accommodation Dropdown Filter */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, paddingLeft: 12 }}>
          <label style={{ fontSize: '0.78rem', color: isLightMode ? '#64748B' : '#94A3B8', fontWeight: 600 }}>
            <i className="fas fa-filter" style={{ marginRight: 4 }} /> Unit / Room:
          </label>
          <select
            value={selectedRoomFilter}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedRoomFilter(val);
              if (onRoomChange) onRoomChange(val);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: `1px solid ${isLightMode ? '#CBD5E1' : '#334155'}`,
              background: isLightMode ? '#FFFFFF' : '#1E293B',
              color: isLightMode ? '#1E293B' : '#F1F5F9',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="all">All Accommodations ({effectiveRooms.reduce((sum, r) => sum + (Number(r.units) || 1), 0)} units)</option>
            {effectiveRooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.units || 1} unit{(Number(r.units) || 1) > 1 ? 's' : ''})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. CALENDAR VIEW (TIMELINE PMS MATRIX) */}
      {activeTab === 'calendar' ? (
        <div
          style={{
            background: isLightMode ? '#FFFFFF' : '#0F172A',
            border: `1px solid ${isLightMode ? '#E2E8F0' : '#1E293B'}`,
            borderRadius: 18,
            boxShadow: isLightMode ? '0 4px 20px -2px rgba(0, 0, 0, 0.05)' : '0 8px 30px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}
        >
          {/* Header Bar: Navigation, Date Range, and Real-Time Summary Metrics */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              padding: '18px 24px',
              borderBottom: `1px solid ${isLightMode ? '#F1F5F9' : '#1E293B'}`,
            }}
          >
            {/* Left Controls: < Today > and Date Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={handlePrevWindow}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: `1px solid ${isLightMode ? '#E2E8F0' : '#334155'}`,
                  background: isLightMode ? '#FFFFFF' : '#1E293B',
                  color: isLightMode ? '#475569' : '#CBD5E1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
                title="Previous 7 days"
              >
                <i className="fas fa-chevron-left" />
              </button>

              <button
                type="button"
                onClick={handleTodayClick}
                style={{
                  padding: '7px 16px',
                  borderRadius: 8,
                  border: `1px solid ${isLightMode ? '#E2E8F0' : '#334155'}`,
                  background: isLightMode ? '#FFFFFF' : '#1E293B',
                  color: isLightMode ? '#334155' : '#F1F5F9',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Today
              </button>

              <button
                type="button"
                onClick={handleNextWindow}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: `1px solid ${isLightMode ? '#E2E8F0' : '#334155'}`,
                  background: isLightMode ? '#FFFFFF' : '#1E293B',
                  color: isLightMode ? '#475569' : '#CBD5E1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
                title="Next 7 days"
              >
                <i className="fas fa-chevron-right" />
              </button>

              <h2
                style={{
                  margin: 0,
                  marginLeft: 10,
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: isLightMode ? '#0F172A' : '#F8FAFC',
                }}
              >
                {dateRangeLabel}
              </h2>
              {loading && <span style={{ fontSize: '0.75rem', color: '#4F46E5', marginLeft: 6 }}>⏳ Syncing...</span>}
            </div>

            {/* Right Summary Metrics (100% computed from real Supabase records) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: '0.85rem', color: '#64748B' }}>
              <div>
                <strong style={{ color: isLightMode ? '#0F172A' : '#F8FAFC', fontWeight: 800 }}>{metrics.arriving}</strong>{' '}
                <span>arriving today</span>
              </div>
              <div>
                <strong style={{ color: isLightMode ? '#0F172A' : '#F8FAFC', fontWeight: 800 }}>{metrics.departing}</strong>{' '}
                <span>departing</span>
              </div>
              <div>
                <strong style={{ color: isLightMode ? '#0F172A' : '#F8FAFC', fontWeight: 800 }}>{metrics.staysInView}</strong>{' '}
                <span>stays in view</span>
              </div>
            </div>
          </div>

          {/* Timeline Grid Container */}
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <div style={{ minWidth: 1050 }}>
              {/* HEADER ROW: UNIT + 14 DAYS */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '150px repeat(14, minmax(0, 1fr))',
                  borderBottom: `1px solid ${isLightMode ? '#E2E8F0' : '#1E293B'}`,
                  background: isLightMode ? '#FAFAFA' : '#111827',
                }}
              >
                {/* UNIT Header */}
                <div
                  style={{
                    padding: '12px 18px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#94A3B8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'flex',
                    alignItems: 'center',
                    borderRight: `1px solid ${isLightMode ? '#F1F5F9' : '#1E293B'}`,
                  }}
                >
                  ACCOMMODATION / UNIT
                </div>

                {/* 14 Day Columns */}
                {daysArray.map((day) => (
                  <div
                    key={day.dateStr}
                    style={{
                      textAlign: 'center',
                      padding: '8px 2px',
                      borderRight: `1px solid ${isLightMode ? '#F1F5F9' : '#1E293B'}`,
                      background: day.isToday ? (isLightMode ? 'rgba(79, 70, 229, 0.03)' : 'rgba(79, 70, 229, 0.12)') : 'transparent',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: day.isToday ? 800 : 700,
                        color: day.isToday ? '#4F46E5' : '#64748B',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {day.dayOfWeek}
                    </div>

                    {/* Day Number: Today has filled purple circle */}
                    {day.isToday ? (
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: '#4F46E5',
                          color: '#FFFFFF',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '2px auto 0',
                          boxShadow: '0 1px 3px rgba(79, 70, 229, 0.4)',
                        }}
                      >
                        {day.dayNum}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: isLightMode ? '#1E293B' : '#CBD5E1',
                          marginTop: 3,
                        }}
                      >
                        {day.dayNum}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* UNIT ROWS FROM SUPABASE */}
              {units.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#94A3B8', fontSize: '0.88rem' }}>
                  No accommodations found in Supabase. Please configure rooms in Room Management.
                </div>
              ) : (
                units.map((unit) => {
                  // Find real stays from Supabase that belong to this exact physical unit and overlap with visible window
                  const unitStays = visibleStays.filter((s) => {
                    const matchUnit = s.assignedUnitId ? s.assignedUnitId === unit.id : (s.unitId === unit.id);
                    if (!matchUnit) return false;
                    return s.checkIn <= windowEndDateStr && s.checkOut >= windowStartDateStr;
                  });

                  return (
                    <div
                      key={unit.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '150px repeat(14, minmax(0, 1fr))',
                        minHeight: 52,
                        borderBottom: `1px solid ${isLightMode ? '#F1F5F9' : '#1E293B'}`,
                        position: 'relative',
                      }}
                    >
                      {/* Unit / Room Name Cell */}
                      <div
                        style={{
                          padding: '14px 18px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: isLightMode ? '#334155' : '#CBD5E1',
                          display: 'flex',
                          alignItems: 'center',
                          borderRight: `1px solid ${isLightMode ? '#F1F5F9' : '#1E293B'}`,
                          background: isLightMode ? '#FFFFFF' : '#0F172A',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={unit.label}
                      >
                        {unit.name}
                      </div>

                      {/* 14 Day Grid Slots */}
                      {daysArray.map((day) => {
                        const isCellSelected = selectedCell?.unitId === unit.id && selectedCell?.dateStr === day.dateStr;

                        return (
                          <div
                            key={day.dateStr}
                            onClick={() => handleCellClick(unit.id, day.dateStr)}
                            style={{
                              borderRight: `1px solid ${isLightMode ? '#F8FAFC' : '#1E293B'}`,
                              background: day.isToday
                                ? isLightMode
                                  ? 'rgba(79, 70, 229, 0.02)'
                                  : 'rgba(79, 70, 229, 0.08)'
                                : 'transparent',
                              position: 'relative',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 2,
                            }}
                          >
                            {/* Selection Outline Box */}
                            {isCellSelected && (
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 4,
                                  border: '1.5px solid #6366F1',
                                  background: 'rgba(99, 102, 241, 0.06)',
                                  borderRadius: 4,
                                  pointerEvents: 'none',
                                  zIndex: 1,
                                }}
                              />
                            )}
                          </div>
                        );
                      })}

                      {/* OVERLAID REAL-TIME BOOKING BARS */}
                      {unitStays.map((stay) => {
                        const startIdx = daysArray.findIndex((d) => d.dateStr === stay.checkIn);
                        const endIdx = daysArray.findIndex((d) => d.dateStr === stay.checkOut);

                        let effectiveStart = startIdx >= 0 ? startIdx : 0;
                        let effectiveEnd = endIdx >= 0 ? endIdx : 14;

                        if (stay.checkIn < windowStartDateStr) effectiveStart = 0;
                        if (stay.checkOut > windowEndDateStr) effectiveEnd = 14;

                        const spanDays = Math.max(1, effectiveEnd - effectiveStart);

                        // Real status styling
                        let pillBg = '#E8F8F0';
                        let pillText = '#065F46';
                        let borderAccent = '#10B981';

                        if (stay.status === 'pending') {
                          pillBg = '#FEF9C3';
                          pillText = '#92400E';
                          borderAccent = '#F59E0B';
                        } else if (stay.status === 'checked_out') {
                          pillBg = '#EEF2FF';
                          pillText = '#4338CA';
                          borderAccent = '#6366F1';
                        } else if (stay.status === 'cancelled') {
                          pillBg = '#F1F5F9';
                          pillText = '#475569';
                          borderAccent = '#94A3B8';
                        }

                        const leftPercent = (effectiveStart / 14) * 100;
                        const widthPercent = (spanDays / 14) * 100;

                        return (
                          <div
                            key={stay.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBookingClick(stay);
                            }}
                            style={{
                              position: 'absolute',
                              left: `calc(150px + ${leftPercent}% + 2px)`,
                              width: `calc(${widthPercent}% - 4px)`,
                              top: 8,
                              height: 36,
                              borderRadius: 6,
                              background: pillBg,
                              color: pillText,
                              borderLeft: `3.5px solid ${borderAccent}`,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '0 8px',
                              cursor: 'pointer',
                              zIndex: 10,
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.12)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                            }}
                            title={`${stay.guestName} (${stay.checkIn} to ${stay.checkOut}) · Status: ${stay.status} · Total: ${money(stay.totalPhp || 0)}`}
                          >
                            <span style={{ fontWeight: 700, marginRight: 5 }}>{stay.guestName}</span>
                            {spanDays >= 2 && (
                              <span style={{ fontSize: '0.7rem', opacity: 0.85, fontWeight: 500 }}>
                                {fmtDate(stay.checkIn)} → {fmtDate(stay.checkOut)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        /* 4. REAL-TIME LIST VIEW MODE */
        <div
          style={{
            background: isLightMode ? '#FFFFFF' : '#0F172A',
            border: `1px solid ${isLightMode ? '#E2E8F0' : '#1E293B'}`,
            borderRadius: 18,
            boxShadow: isLightMode ? '0 4px 20px -2px rgba(0, 0, 0, 0.05)' : '0 8px 30px rgba(0,0,0,0.4)',
            overflow: 'hidden',
            padding: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Real-Time Supabase Reservations Ledger</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                Showing {visibleStays.length} reservation records directly from PostgreSQL.
              </p>
            </div>
            <input
              type="text"
              placeholder="Search guest or unit..."
              value={searchListQuery}
              onChange={(e) => setSearchListQuery(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: `1px solid ${isLightMode ? '#CBD5E1' : '#334155'}`,
                background: isLightMode ? '#FFFFFF' : '#1E293B',
                color: isLightMode ? '#0F172A' : '#F8FAFC',
                fontSize: '0.82rem',
                minWidth: 220,
              }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: isLightMode ? '#F8FAFC' : '#1E293B', color: '#64748B', borderBottom: `1px solid ${isLightMode ? '#E2E8F0' : '#334155'}` }}>
                  <th style={{ padding: '10px 14px' }}>Unit / Room</th>
                  <th style={{ padding: '10px 14px' }}>Guest Name</th>
                  <th style={{ padding: '10px 14px' }}>Stay Dates</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                  <th style={{ padding: '10px 14px' }}>Payment</th>
                  <th style={{ padding: '10px 14px' }}>Total Amount</th>
                  <th style={{ padding: '10px 14px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleStays
                  .filter((s) => {
                    if (!searchListQuery) return true;
                    const q = searchListQuery.toLowerCase();
                    return s.guestName.toLowerCase().includes(q) || s.unitName.toLowerCase().includes(q);
                  })
                  .map((stay) => (
                    <tr
                      key={stay.id}
                      style={{ borderBottom: `1px solid ${isLightMode ? '#F1F5F9' : '#1E293B'}` }}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 700 }}>{stay.unitName}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div>
                          <strong style={{ display: 'block' }}>{stay.guestName}</strong>
                          {stay.phone && <small style={{ color: '#64748B', fontSize: '0.72rem' }}>{stay.phone}</small>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#64748B' }}>
                        {stay.checkIn} → {stay.checkOut}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: 9999,
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            textTransform: 'capitalize',
                            background:
                              stay.status === 'checked_in'
                                ? '#E8F8F0'
                                : stay.status === 'pending'
                                ? '#FEF9C3'
                                : stay.status === 'checked_out'
                                ? '#EEF2FF'
                                : '#F1F5F9',
                            color:
                              stay.status === 'checked_in'
                                ? '#065F46'
                                : stay.status === 'pending'
                                ? '#92400E'
                                : stay.status === 'checked_out'
                                ? '#4338CA'
                                : '#475569',
                          }}
                        >
                          {stay.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: stay.paymentStatus === 'paid' ? '#10B981' : '#F59E0B' }}>
                          {stay.paymentStatus || 'unpaid'} ({stay.paymentMethod || 'Cash'})
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                        {money(stay.totalPhp || 3500)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <button
                          type="button"
                          onClick={() => handleBookingClick(stay)}
                          style={{
                            padding: '4px 12px',
                            borderRadius: 6,
                            border: `1px solid ${isLightMode ? '#CBD5E1' : '#334155'}`,
                            background: 'transparent',
                            color: '#4F46E5',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. STAY DETAILS MODAL (Real Supabase Record) */}
      {activeDetailStay && (
        <div
          onClick={() => setActiveDetailStay(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isLightMode ? '#FFFFFF' : '#0F172A',
              border: `1px solid ${isLightMode ? '#E2E8F0' : '#334155'}`,
              borderRadius: 16,
              maxWidth: 440,
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase' }}>
                  {activeDetailStay.unitName}
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.25rem', fontWeight: 800 }}>
                  {activeDetailStay.guestName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveDetailStay(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  color: '#94A3B8',
                }}
              >
                <i className="fas fa-xmark" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: isLightMode ? '#F8FAFC' : '#1E293B', borderRadius: 8 }}>
                <span style={{ color: '#64748B' }}>Status</span>
                <strong style={{ textTransform: 'capitalize', color: '#4F46E5' }}>{activeDetailStay.status.replace('_', ' ')}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: isLightMode ? '#F8FAFC' : '#1E293B', borderRadius: 8 }}>
                <span style={{ color: '#64748B' }}>Check-in</span>
                <strong>{activeDetailStay.checkIn}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: isLightMode ? '#F8FAFC' : '#1E293B', borderRadius: 8 }}>
                <span style={{ color: '#64748B' }}>Check-out</span>
                <strong>{activeDetailStay.checkOut}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: isLightMode ? '#F8FAFC' : '#1E293B', borderRadius: 8 }}>
                <span style={{ color: '#64748B' }}>Contact Phone</span>
                <strong>{activeDetailStay.phone || 'N/A'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: isLightMode ? '#F8FAFC' : '#1E293B', borderRadius: 8 }}>
                <span style={{ color: '#64748B' }}>Payment Method</span>
                <strong>{activeDetailStay.paymentMethod || 'GCash'} ({activeDetailStay.paymentStatus || 'unpaid'})</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: isLightMode ? '#F8FAFC' : '#1E293B', borderRadius: 8 }}>
                <span style={{ color: '#64748B' }}>Total Booking</span>
                <strong style={{ color: '#10B981', fontSize: '1rem' }}>{money(activeDetailStay.totalPhp || 3500)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setActiveDetailStay(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: `1px solid ${isLightMode ? '#CBD5E1' : '#334155'}`,
                  background: isLightMode ? '#FFFFFF' : '#1E293B',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveDetailStay(null);
                  if (onNewBooking) onNewBooking();
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#4F46E5',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + New Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
