import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import { to11Digits } from '../../lib/format';
import { getManilaTodayISO } from '../../lib/offeringSpecs';
import { FALLBACK_ROOMS, fetchBookableRooms, type Room } from '../../lib/guestRooms';
import {
  GUEST_BOOKINGS_STORAGE_KEY,
  PREVIEW_SCOPE,
  accountScopeFor,
  applyReservationRow,
  clearPreviewData,
  createSampleAccount,
  createSampleBookings,
  emptyProfile,
  loadDeviceBookings,
  loadGuestAccount,
  mapReservationRow,
  saveDeviceBookings,
  saveGuestAccount,
  splitName,
  type GuestAccount,
  type GuestBooking,
  type GuestPaymentMethod,
  type GuestProfile,
  type GuestRequest,
} from '../../lib/guestPortal';

export type PortalMode = 'preview' | 'account';

export const PROBLEM_TOPIC = 'Problem during my stay';

export interface RoomSnapshot {
  name: string;
  category: string;
  image: string;
  capacity: number;
}

export interface NewPaymentMethod {
  type: GuestPaymentMethod['type'];
  label: string;
  brand?: string;
  holder: string;
  last4: string;
  expiry?: string;
  makeDefault: boolean;
}

export interface GuestPortalValue {
  mode: PortalMode;
  today: string;
  account: GuestAccount;
  displayName: string;
  firstName: string;
  initials: string;
  bookings: GuestBooking[];
  loading: boolean;
  liveRooms: boolean;
  roomFor: (booking: GuestBooking) => RoomSnapshot;
  cancelBooking: (booking: GuestBooking) => Promise<void>;
  saveProfile: (patch: Partial<GuestProfile>) => Promise<void>;
  addPaymentMethod: (input: NewPaymentMethod) => void;
  removePaymentMethod: (id: string) => void;
  setDefaultPaymentMethod: (id: string) => void;
  submitRequest: (input: { bookingId?: string; topic: string; message: string }) => Promise<GuestRequest>;
  changePassword?: (password: string) => Promise<void>;
  signOut?: () => Promise<void>;
  resetPreview: () => void;
}

const GuestPortalContext = createContext<GuestPortalValue | null>(null);

function resolveAccount(scope: string, signedIn: boolean, customerProfile: any): GuestAccount {
  const stored = loadGuestAccount(scope);
  if (!signedIn) {
    if (stored) return stored;
    const sample = createSampleAccount();
    saveGuestAccount(scope, sample);
    return sample;
  }
  // Signed-in residents: name, email, and phone come from their account; the rest stays on this device.
  const base: GuestAccount = stored || {
    isSample: false,
    profile: { ...emptyProfile(), memberSince: customerProfile?.created_at || new Date().toISOString() },
    payments: [],
    requests: [],
  };
  const names = splitName(customerProfile?.full_name || '');
  return {
    ...base,
    isSample: false,
    profile: {
      ...base.profile,
      firstName: customerProfile?.first_name || names.first || base.profile.firstName,
      lastName: customerProfile?.last_name || names.last || base.profile.lastName,
      email: customerProfile?.email || base.profile.email,
      phone: customerProfile?.phone ? to11Digits(customerProfile.phone) : base.profile.phone,
    },
  };
}

export function GuestPortalProvider({ children }: { children: ReactNode }) {
  const { customerSession, customerProfile, updateProfile, updatePassword, signOutCustomer } = useAuth();
  const signedIn = Boolean(customerSession && customerProfile);
  const mode: PortalMode = signedIn ? 'account' : 'preview';
  const scope = signedIn ? accountScopeFor(customerProfile) : PREVIEW_SCOPE;
  const profileId = String(customerProfile?.id || '');
  const profileEmail = String(customerProfile?.email || '').trim().toLowerCase();
  const today = useMemo(() => getManilaTodayISO(), []);

  const [account, setAccount] = useState<GuestAccount>(() => resolveAccount(scope, signedIn, customerProfile));
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsReady, setRoomsReady] = useState(false);
  const [liveRooms, setLiveRooms] = useState(false);
  const [bookings, setBookings] = useState<GuestBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAccount(resolveAccount(scope, signedIn, customerProfile));
  }, [scope, signedIn, customerProfile]);

  const commitAccount = useCallback(
    (next: GuestAccount) => {
      setAccount(next);
      saveGuestAccount(scope, next);
    },
    [scope]
  );

  const loadRooms = useCallback(async () => {
    try {
      const live = await fetchBookableRooms();
      setRooms(live.length ? live : FALLBACK_ROOMS);
      setLiveRooms(live.length > 0);
    } catch {
      setRooms((prev) => (prev.length ? prev : FALLBACK_ROOMS));
      setLiveRooms(false);
    } finally {
      setRoomsReady(true);
    }
  }, []);

  const loadBookings = useCallback(
    async (roomList: Room[]) => {
      if (signedIn) {
        let rows: any[] = [];
        try {
          const result = await api.myReservations();
          rows = Array.isArray(result) ? result : [];
        } catch {
          rows = [];
        }
        // The fallback query can return other guests' rows, so keep only this resident's reservations.
        const mine = rows.filter((row) => {
          const rowEmail = String(row.email || row.guest_email || '').trim().toLowerCase();
          return (profileId && String(row.guest_id || '') === profileId) || (profileEmail && rowEmail === profileEmail);
        });
        const fromAccount = mine.map((row) => mapReservationRow(row, roomList));
        const device = loadDeviceBookings().filter(
          (b) => b.source === 'device' && profileEmail && b.guestEmail.trim().toLowerCase() === profileEmail
        );
        const merged = fromAccount.map((b) => {
          const local = device.find((d) => d.dbId && d.dbId === b.dbId);
          if (!local) return b;
          const splitMatches = local.adults + local.children === b.guests;
          return {
            ...b,
            reference: local.reference || b.reference,
            arrivalPin: local.arrivalPin,
            matchMode: local.matchMode,
            paymentMethod: local.paymentMethod || b.paymentMethod,
            adults: splitMatches ? local.adults : b.adults,
            children: splitMatches ? local.children : b.children,
          };
        });
        const syncedIds = new Set(fromAccount.map((b) => b.dbId));
        const deviceOnly = device.filter((d) => !d.dbId || !syncedIds.has(d.dbId));
        setBookings([...merged, ...deviceOnly]);
      } else {
        let device = loadDeviceBookings();
        if (!device.length && roomList.length) {
          device = createSampleBookings(roomList, today);
          saveDeviceBookings(device);
        }
        const syncedIds = device.map((b) => b.dbId).filter(Boolean) as string[];
        if (syncedIds.length) {
          try {
            const { data } = await supabase
              .from('reservations')
              .select('id, status, payment_status, check_in, check_out, guests, total_php')
              .in('id', syncedIds);
            if (Array.isArray(data) && data.length) {
              device = device.map((b) => {
                const row = data.find((r: any) => String(r.id) === b.dbId);
                return row ? applyReservationRow(b, row) : b;
              });
              saveDeviceBookings(device);
            }
          } catch {
            // Keep the copy saved on this device.
          }
        }
        setBookings(device);
      }
      setLoading(false);
    },
    [signedIn, profileId, profileEmail, today]
  );

  // Latest values for realtime and storage listeners.
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;
  const loadBookingsRef = useRef(loadBookings);
  loadBookingsRef.current = loadBookings;

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (roomsReady) loadBookings(rooms);
  }, [roomsReady, rooms, loadBookings]);

  useEffect(() => {
    let timer: number | undefined;
    const scheduleReload = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => loadBookingsRef.current(roomsRef.current), 400);
    };
    const channel = supabase
      .channel(`guest-portal-${scope}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => loadRooms())
      .subscribe();
    // Bookings made in another tab (for example on the landing page) show up straight away.
    const onStorage = (event: StorageEvent) => {
      if (event.key === GUEST_BOOKINGS_STORAGE_KEY) scheduleReload();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadRooms();
        scheduleReload();
      }
    };
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      supabase.removeChannel(channel);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [scope, loadRooms]);

  const roomFor = useCallback(
    (booking: GuestBooking): RoomSnapshot => {
      const room = rooms.find((r) => String(r.id) === String(booking.roomId));
      return {
        name: room?.name || booking.roomName,
        category: room?.category || booking.roomCategory,
        image: room?.image_url || booking.roomImage || '/images/suite.jpg',
        capacity: Number(room?.capacity) || booking.roomCapacity,
      };
    },
    [rooms]
  );

  const cancelBooking = useCallback(async (booking: GuestBooking) => {
    if (booking.dbId) {
      await api.cancelReservation(booking.dbId);
    }
    const matches = (b: GuestBooking) => b.id === booking.id || Boolean(booking.dbId && b.dbId === booking.dbId);
    const markCancelled = (b: GuestBooking): GuestBooking => (matches(b) ? { ...b, status: 'cancelled' } : b);
    setBookings((list) => list.map(markCancelled));
    saveDeviceBookings(loadDeviceBookings().map(markCancelled));
  }, []);

  const saveProfile = useCallback(
    async (patch: Partial<GuestProfile>) => {
      const nextProfile = { ...account.profile, ...patch };
      const touchesAccount = 'firstName' in patch || 'lastName' in patch || 'phone' in patch;
      if (signedIn && touchesAccount) {
        await updateProfile({
          first_name: nextProfile.firstName.trim(),
          last_name: nextProfile.lastName.trim(),
          full_name: `${nextProfile.firstName} ${nextProfile.lastName}`.trim(),
          phone: nextProfile.phone,
        });
      }
      commitAccount({ ...account, isSample: false, profile: nextProfile });
    },
    [account, signedIn, updateProfile, commitAccount]
  );

  const addPaymentMethod = useCallback(
    (input: NewPaymentMethod) => {
      const makeDefault = input.makeDefault || account.payments.length === 0;
      const method: GuestPaymentMethod = {
        id: `pm-${Date.now().toString(36)}`,
        type: input.type,
        label: input.label,
        brand: input.brand,
        holder: input.holder.trim(),
        last4: input.last4,
        expiry: input.expiry,
        isDefault: makeDefault,
        addedAt: new Date().toISOString(),
      };
      const existing = makeDefault ? account.payments.map((p) => ({ ...p, isDefault: false })) : account.payments;
      commitAccount({ ...account, isSample: false, payments: [...existing, method] });
    },
    [account, commitAccount]
  );

  const removePaymentMethod = useCallback(
    (id: string) => {
      const remaining = account.payments.filter((p) => p.id !== id);
      if (remaining.length && !remaining.some((p) => p.isDefault)) {
        remaining[0] = { ...remaining[0], isDefault: true };
      }
      commitAccount({ ...account, isSample: false, payments: remaining });
    },
    [account, commitAccount]
  );

  const setDefaultPaymentMethod = useCallback(
    (id: string) => {
      commitAccount({ ...account, isSample: false, payments: account.payments.map((p) => ({ ...p, isDefault: p.id === id })) });
    },
    [account, commitAccount]
  );

  const submitRequest = useCallback(
    async ({ bookingId, topic, message }: { bookingId?: string; topic: string; message: string }) => {
      const booking = bookings.find((b) => b.id === bookingId);
      const request: GuestRequest = {
        id: `req-${Date.now().toString(36)}`,
        bookingId: booking?.id,
        bookingRef: booking?.reference,
        roomName: booking ? roomFor(booking).name : undefined,
        topic,
        message: message.trim(),
        createdAt: new Date().toISOString(),
        delivery: 'device',
      };
      let disputed = false;
      // Preview requests stay on this device; signed-in residents' requests reach the staff and recovery queues.
      if (signedIn) {
        try {
          if (topic === PROBLEM_TOPIC && booking?.dbId) {
            const note = `[CLIENT_DISPUTE] ${request.message}`;
            const { error } = await supabase
              .from('reservations')
              .update({ status: 'disputed', notes: booking.notes ? `${booking.notes}\n${note}` : note })
              .eq('id', booking.dbId);
            disputed = !error;
          }
          const { error } = await supabase.from('audit_logs').insert({
            action: topic === PROBLEM_TOPIC ? 'CLIENT_DISPUTE_FILED' : 'CLIENT_HELP_REQUEST',
            actor_id: profileId || null,
            actor_email: profileEmail || account.profile.email,
            actor_role: 'customer',
            details: {
              reservation_id: booking?.dbId || 'unspecified',
              reference: booking?.reference || null,
              topic,
              description: request.message,
              source_namespace: '/client',
              target_namespace: topic === PROBLEM_TOPIC ? '/recovery' : '/staff',
            },
          });
          if (!error || disputed) request.delivery = 'sent';
        } catch {
          // Saved on this device; the guest can still call or text the front desk.
        }
      }
      commitAccount({ ...account, requests: [request, ...account.requests].slice(0, 20) });
      if (disputed && booking) {
        setBookings((list) => list.map((b) => (b.id === booking.id ? { ...b, status: 'disputed' } : b)));
      }
      return request;
    },
    [bookings, roomFor, signedIn, profileId, profileEmail, account, commitAccount]
  );

  const resetPreview = useCallback(() => {
    clearPreviewData();
    const sample = createSampleAccount();
    saveGuestAccount(PREVIEW_SCOPE, sample);
    setAccount(sample);
    const samples = createSampleBookings(rooms, today);
    saveDeviceBookings(samples);
    setBookings(samples);
  }, [rooms, today]);

  const value = useMemo<GuestPortalValue>(() => {
    const { firstName, lastName, email } = account.profile;
    const displayName = `${firstName} ${lastName}`.trim() || (email ? email.split('@')[0] : '') || 'Guest';
    const initials =
      displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'G';
    return {
      mode,
      today,
      account,
      displayName,
      firstName: firstName || displayName.split(' ')[0],
      initials,
      bookings,
      loading,
      liveRooms,
      roomFor,
      cancelBooking,
      saveProfile,
      addPaymentMethod,
      removePaymentMethod,
      setDefaultPaymentMethod,
      submitRequest,
      changePassword: signedIn
        ? async (password: string) => {
            await updatePassword(password);
          }
        : undefined,
      signOut: signedIn
        ? async () => {
            await signOutCustomer();
          }
        : undefined,
      resetPreview,
    };
  }, [
    mode,
    today,
    account,
    bookings,
    loading,
    liveRooms,
    roomFor,
    cancelBooking,
    saveProfile,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
    submitRequest,
    signedIn,
    updatePassword,
    signOutCustomer,
    resetPreview,
  ]);

  return <GuestPortalContext.Provider value={value}>{children}</GuestPortalContext.Provider>;
}

export function useGuestPortal(): GuestPortalValue {
  const ctx = useContext(GuestPortalContext);
  if (!ctx) throw new Error('useGuestPortal must be used inside GuestPortalProvider');
  return ctx;
}
