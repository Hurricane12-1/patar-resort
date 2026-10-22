import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useAuth, generateAccountEmail, isSystemOwnerEmail } from '../context/AuthContext';
import { api, API_BASE, addDaysYMD } from '../lib/api';
import { formatTime12Hour } from '../lib/format';
import { supabase } from '../lib/supabaseClient';
import { uploadImageToCloudinary } from '../lib/cloudinary';
import { toast } from '../components/Toasts';

export const emptyAnalytics = {
  overview: {
    arrivals_today: 0,
    departures_today: 0,
    occupancy_pct: 0,
    revenue_week_php: 0,
    total_revenue_php: 0,
    adr_php: 0,
    revpar_php: 0,
    room_revenue_php: 0,
    dining_revenue_php: 0,
    tour_revenue_php: 0,
    sms_delivered: 0,
  },
  daily: [],
  top: [],
  food_sales: [],
  bookings: [],
};

export function useAdminState() {
  const {
    session,
    profile,
    adminSession,
    adminProfile,
    adminSignIn,
    signOut,
    signOutAdmin,
    deleteAccount,
    updateProfile,
    updatePassword,
    refreshProfile,
  } = useAuth();

  // Strict Isolation: Admin State MUST ONLY rely on explicit employee admin session
  // Customer public sessions (Google, Facebook, guest) CAN NEVER access the administrator portal!
  const currentAdminSession = adminSession;
  const currentAdminProfile = adminProfile;
  const user = currentAdminSession?.user;

  const [data, setData] = useState<any>(emptyAnalytics);
  const [loading, setLoading] = useState(false);

  // Authentication State
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  // Live database profile role validation: strictly verified employee administrator only
  const isAdministrator = Boolean(
    adminSession &&
      adminProfile &&
      (['administrator', 'admin'].includes(adminProfile?.role))
  );

  // Navigation & Theme
  const getInitialActiveTab = (): string => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '').trim();
      const validTabs = ['overview', 'ledger', 'inventory', 'conversations', 'settings', 'audit', 'accounts', 'notifications', 'csv'];
      if (validTabs.includes(hash)) {
        return hash;
      }
      const saved = localStorage.getItem('jd_admin_active_tab');
      if (saved && validTabs.includes(saved)) {
        return saved;
      }
    }
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialActiveTab);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('jd_admin_active_tab', activeTab);
        if (window.location.pathname.includes('/admin')) {
          const currentHash = window.location.hash.replace('#', '');
          if (currentHash !== activeTab) {
            window.history.replaceState(null, '', `#${activeTab}`);
          }
        }
      } catch {}
    }
  }, [activeTab]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      const validTabs = ['overview', 'ledger', 'inventory', 'conversations', 'settings', 'audit', 'accounts', 'notifications', 'csv'];
      if (validTabs.includes(hash) && hash !== activeTab) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeTab]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('jd_admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_sidebar_collapsed', String(sidebarCollapsed));
    } catch {}
  }, [sidebarCollapsed]);

  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  const [isLightMode, setIsLightMode] = useState(() => {
    const saved = localStorage.getItem('admin_theme_v2');
    if (saved === 'dark') return false;
    localStorage.removeItem('admin_theme_light');
    localStorage.setItem('admin_theme_v2', 'light');
    return true;
  });

  const toggleThemeMode = () => {
    const nextMode = !isLightMode;
    setIsLightMode(nextMode);
    localStorage.setItem('admin_theme_v2', nextMode ? 'light' : 'dark');
    toast(nextMode ? '☀️ Executive White Theme Activated' : '🌙 Dark Luxury Mode Activated');
  };

  const themeBg = isLightMode ? '#F8FAFC' : '#020617';
  const themeSidebarBg = isLightMode ? '#FFFFFF' : 'rgba(15, 23, 42, 0.95)';
  const themeHeaderBg = isLightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.9)';
  const themeCardBg = isLightMode ? '#FFFFFF' : 'rgba(15, 23, 42, 0.85)';
  const themeText = isLightMode ? '#0F172A' : '#F8FAFC';
  const themeMuted = isLightMode ? '#64748B' : '#94A3B8';
  const themeBorder = isLightMode ? '#E2E8F0' : 'rgba(255, 255, 255, 0.1)';
  const themeShadow = isLightMode ? '0 4px 20px rgba(0, 0, 0, 0.05)' : 'none';

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [viewingNotification, setViewingNotification] = useState<any>(null);

  const unreadNotifsCount = notifications.filter((n: any) => !n.is_read).length;

  const handleMarkNotifRead = async (id: string) => {
    setNotifications((prev: any[]) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    toast('✓ Notification marked as read');
    try {
      await api.markNotificationRead(id);
    } catch (err: any) {
      console.warn(err);
    }
  };

  const handleMarkAllNotifsRead = async () => {
    setNotifications((prev: any[]) => prev.map((n) => ({ ...n, is_read: true })));
    toast('✓ All notifications moved to Read');
    try {
      await api.markAllNotificationsRead();
    } catch (err: any) {
      console.warn(err);
    }
  };

  const handleDeleteNotif = async (id: string) => {
    setNotifications((prev: any[]) => prev.filter((n) => n.id !== id));
    toast('🗑️ Notification deleted');
    try {
      await api.deleteNotification(id);
    } catch (err: any) {
      console.warn(err);
    }
  };

  const handleClearAllNotifs = async () => {
    if (!notifications.length) return;
    const ok = window.confirm('Are you sure you want to permanently clear all notifications?');
    if (!ok) return;
    setNotifications([]);
    toast('🗑️ All notifications cleared');
    try {
      await api.clearAllNotifications();
    } catch (err: any) {
      console.warn(err);
    }
  };

  const handleClearReadNotifs = async () => {
    const readOnes = notifications.filter((n: any) => n.is_read);
    if (!readOnes.length) return toast('No read notifications to clear');
    setNotifications((prev: any[]) => prev.filter((n) => !n.is_read));
    toast('🧹 Cleared all read notifications');
    try {
      await Promise.all(readOnes.map((n) => api.deleteNotification(n.id).catch(() => {})));
    } catch (err: any) {
      console.warn(err);
    }
  };

  // Reservations State
  const [reservationsList, setReservationsList] = useState<any[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [receiptModalBooking, setReceiptModalBooking] = useState<any>(null);
  const [timelineBooking, setTimelineBooking] = useState<any>(null);
  const [reservationToRemove, setReservationToRemove] = useState<any>(null);
  const [removingReservation, setRemovingReservation] = useState(false);
  const defaultReservationDraft = {
    guest_name: '',
    phone: '',
    guest_email: '',
    room_id: '',
    check_in: new Date().toISOString().slice(0, 10),
    check_out: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    check_in_time: '14:00',
    check_out_time: '12:00',
    guests: 2,
    total_php: 3500,
    payment_method: 'GCash',
    payment_status: 'confirmed',
    notes: 'Direct Front Desk walk-in entry',
  };

  const [showAddReservationModal, setShowAddReservationModal] = useState<boolean>(() => {
    try {
      return localStorage.getItem('jd_admin_show_add_reservation') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_show_add_reservation', String(showAddReservationModal));
    } catch {}
  }, [showAddReservationModal]);

  const [creatingReservation, setCreatingReservation] = useState(false);

  const [walkInPoolAddon, setWalkInPoolAddon] = useState<string>(() => {
    try {
      return localStorage.getItem('jd_admin_draft_pool_addon') || 'none';
    } catch {
      return 'none';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_draft_pool_addon', walkInPoolAddon);
    } catch {}
  }, [walkInPoolAddon]);

  const [newReservation, setNewReservation] = useState(() => {
    try {
      const saved = localStorage.getItem('jd_admin_draft_reservation');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...defaultReservationDraft, ...parsed };
        }
      }
    } catch {}
    return defaultReservationDraft;
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_draft_reservation', JSON.stringify(newReservation));
    } catch {}
  }, [newReservation]);

  const refreshReservations = useCallback(async () => {
    setLoadingReservations(true);
    try {
      const res = await api.allReservations();
      if (Array.isArray(res)) {
        setReservationsList(
          res.map((b: any) => ({
            ...b,
            nights:
              b.nights ||
              Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000)),
          }))
        );
      }
    } catch (e: any) {
      toast(`Could not load reservations: ${e.message}`, true);
    } finally {
      setLoadingReservations(false);
    }
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.setReservationStatus(id, status);
      toast(`Reservation marked as ${status.replace('_', ' ')}`);
      setReservationsList((prev: any[]) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
      setData((x: any) => ({
        ...x,
        bookings: (x.bookings || []).map((b: any) => (b.id === id ? { ...b, status } : b)),
      }));
    } catch (e: any) {
      toast(e.message, true);
    }
  };

  const handleConfirmRemoveReservation = async () => {
    if (!reservationToRemove?.id) return;
    setRemovingReservation(true);
    try {
      await api.deleteReservation(reservationToRemove.id);
      setReservationsList((prev) => prev.filter((r) => r.id !== reservationToRemove.id));
      toast(`Booking folio #${reservationToRemove.id.slice(0, 8)} removed successfully`);
      setReservationToRemove(null);
    } catch (err: any) {
      toast(`Remove failed: ${err.message || 'Error removing reservation'}`, true);
    } finally {
      setRemovingReservation(false);
    }
  };

  // Rooms and Inventory State
  const [roomsList, setRoomsList] = useState<any[]>([]);
  const activeRoomsList = useMemo(
    () => (Array.isArray(roomsList) ? roomsList : []).filter((r: any) => r && r.is_active !== false),
    [roomsList]
  );
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [loadingRoomsAndInv, setLoadingRoomsAndInv] = useState(false);
  const defaultRoomDraft = {
    name: '',
    category: 'Cottage',
    description: '',
    capacity: 2,
    units: 1,
    rate_php: 3500,
    amenities: 'Air Conditioning, Free Wi-Fi, Private Bath, Sea View',
    image_url: '',
    images: [] as string[],
  };

  const [showCreateRoomModal, setShowCreateRoomModal] = useState<boolean>(() => {
    try {
      return localStorage.getItem('jd_admin_show_create_room') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_show_create_room', String(showCreateRoomModal));
    } catch {}
  }, [showCreateRoomModal]);

  const [newRoom, setNewRoom] = useState<{
    name: string;
    category: string;
    description: string;
    capacity: number;
    units: number;
    rate_php: number;
    amenities: string;
    image_url: string;
    images: string[];
  }>(() => {
    try {
      const saved = localStorage.getItem('jd_admin_draft_room');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...defaultRoomDraft, ...parsed };
        }
      }
    } catch {}
    return defaultRoomDraft;
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_draft_room', JSON.stringify(newRoom));
    } catch {}
  }, [newRoom]);

  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [uploadingRoomPhoto, setUploadingRoomPhoto] = useState(false);
  const [roomToRemove, setRoomToRemove] = useState<any>(null);
  const [removingRoom, setRemovingRoom] = useState(false);

  const defaultSupplyDraft = {
    item_name: '',
    category: 'housekeeping',
    stock_qty: 20,
    unit: 'pcs',
    reorder_at: 10,
  };

  const [showCreateSupplyModal, setShowCreateSupplyModal] = useState<boolean>(() => {
    try {
      return localStorage.getItem('jd_admin_show_create_supply') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_show_create_supply', String(showCreateSupplyModal));
    } catch {}
  }, [showCreateSupplyModal]);

  const [newSupply, setNewSupply] = useState(() => {
    try {
      const saved = localStorage.getItem('jd_admin_draft_supply');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...defaultSupplyDraft, ...parsed };
        }
      }
    } catch {}
    return defaultSupplyDraft;
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_draft_supply', JSON.stringify(newSupply));
    } catch {}
  }, [newSupply]);
  const [supplyToRemove, setSupplyToRemove] = useState<any>(null);
  const [removingSupply, setRemovingSupply] = useState(false);

  const refreshRoomsAndInventory = useCallback(() => {
    setLoadingRoomsAndInv(true);
    Promise.all([api.rooms(true), api.departmentInventory()])
      .then(([r, inv]) => {
        setRoomsList(Array.isArray(r) ? r : []);
        setInventoryList(Array.isArray(inv) ? inv : []);
      })
      .catch((e) => toast(e.message, true))
      .finally(() => setLoadingRoomsAndInv(false));
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amenitiesArr = newRoom.amenities
        ? newRoom.amenities.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const imagesArr = Array.isArray(newRoom.images)
        ? newRoom.images.filter(Boolean)
        : (newRoom.image_url ? [newRoom.image_url] : []);
      const primaryImg = newRoom.image_url || imagesArr[0] || '';

      const created = await api.createRoom({
        name: newRoom.name,
        category: newRoom.category,
        description: newRoom.description,
        capacity: Number(newRoom.capacity),
        units: Number(newRoom.units),
        rate_php: Number(newRoom.rate_php),
        amenities: amenitiesArr,
        image_url: primaryImg,
        images: imagesArr,
      });
      setRoomsList((prev) => [...prev, created]);
      setShowCreateRoomModal(false);
      try {
        localStorage.removeItem('jd_admin_draft_room');
        localStorage.setItem('jd_admin_show_create_room', 'false');
      } catch {}
      setNewRoom(defaultRoomDraft);
      toast(`✦ Room "${created.name}" created successfully!`);
    } catch (err: any) {
      toast(err.message, true);
    }
  };

  const handleSaveEditedRoom = async (updatedRoomData: any) => {
    if (!updatedRoomData?.id) return;
    const amenitiesArr =
      typeof updatedRoomData.amenities === 'string'
        ? updatedRoomData.amenities.split(',').map((s: string) => s.trim()).filter(Boolean)
        : updatedRoomData.amenities || [];
    const imagesArr = Array.isArray(updatedRoomData.images)
      ? updatedRoomData.images.filter(Boolean)
      : (updatedRoomData.image_url ? [updatedRoomData.image_url] : []);
    const primaryImg = updatedRoomData.image_url || imagesArr[0] || '';

    const updated = await api.updateRoom(updatedRoomData.id, {
      name: updatedRoomData.name,
      category: updatedRoomData.category,
      description: updatedRoomData.description,
      capacity: Number(updatedRoomData.capacity),
      units: Number(updatedRoomData.units),
      rate_php: Number(updatedRoomData.rate_php),
      amenities: amenitiesArr,
      image_url: primaryImg,
      images: imagesArr,
    });

    setRoomsList((prev) => prev.map((r) => (r.id === updatedRoomData.id ? { ...r, ...updated } : r)));
    setEditingRoom(null);
    toast(`✦ Room "${updatedRoomData.name}" updated successfully!`);
  };

  const handleUpdateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;
    try {
      await handleSaveEditedRoom(editingRoom);
    } catch (err: any) {
      toast(err.message, true);
    }
  };

  const handleRoomPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingRoom) return;

    if (!file.type.startsWith('image/')) {
      toast('Please upload a valid image file (JPG, PNG, WebP).', true);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast('Image file exceeds 5MB limit.', true);
      return;
    }

    try {
      setUploadingRoomPhoto(true);
      toast('Uploading photo…');
      const uploaded = await uploadImageToCloudinary(file);
      const url = uploaded.url;
      const currentList = Array.isArray(editingRoom.images) ? [...editingRoom.images] : [];
      if (!currentList.includes(url)) currentList.push(url);
      const primaryUrl = editingRoom.image_url || url;

      setEditingRoom({
        ...editingRoom,
        image_url: primaryUrl,
        images: currentList,
      });

      if (uploaded.source === 'cloudinary' || (uploaded.url && uploaded.url.includes('cloudinary.com'))) {
        toast('☁️ Room photo uploaded to Cloudinary CDN & synchronized!');
      } else {
        toast('✅ Room photo uploaded & saved successfully!');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to upload photo', true);
    } finally {
      setUploadingRoomPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleAddPhotoUrl = (url: string) => {
    if (!editingRoom || !url.trim()) return;
    const cleanUrl = url.trim();
    const currentList = Array.isArray(editingRoom.images) ? [...editingRoom.images] : [];
    if (!currentList.includes(cleanUrl)) currentList.push(cleanUrl);
    setEditingRoom({
      ...editingRoom,
      image_url: editingRoom.image_url || cleanUrl,
      images: currentList,
    });
    toast('🖼️ Added photo to room gallery');
  };

  const handleAddPresetPhoto = (presetUrl: string) => {
    if (!editingRoom) return;
    const currentList = Array.isArray(editingRoom.images) ? [...editingRoom.images] : [];
    if (!currentList.includes(presetUrl)) currentList.push(presetUrl);
    setEditingRoom({
      ...editingRoom,
      image_url: editingRoom.image_url || presetUrl,
      images: currentList,
    });
    toast('✨ Added scenic resort preset photo');
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    if (!editingRoom || !Array.isArray(editingRoom.images)) return;
    const filtered = editingRoom.images.filter((_, idx) => idx !== indexToRemove);
    const newPrimary = filtered.includes(editingRoom.image_url) ? editingRoom.image_url : filtered[0] || '';
    setEditingRoom({
      ...editingRoom,
      image_url: newPrimary,
      images: filtered,
    });
    toast('🗑️ Removed photo from gallery');
  };

  const handleSetPrimaryPhoto = (url: string) => {
    if (!editingRoom) return;
    setEditingRoom({
      ...editingRoom,
      image_url: url,
    });
    toast('⭐ Set as primary showcase photo');
  };

  const handleToggleRoomActive = async (room: any) => {
    try {
      const nextActive = !room.is_active;
      await api.updateRoom(room.id, { is_active: nextActive });
      setRoomsList((prev) => prev.map((r) => (r.id === room.id ? { ...r, is_active: nextActive } : r)));
      toast(nextActive ? `✅ ${room.name} marked Active` : `⏸️ ${room.name} placed in Maintenance`);
    } catch (err: any) {
      toast(err.message, true);
    }
  };

  const handleConfirmRemoveRoom = async () => {
    if (!roomToRemove?.id) return;
    const targetRoom = roomToRemove;
    setRemovingRoom(true);
    try {
      await api.deleteRoom(targetRoom.id, true);
      setRoomsList((prev) => prev.filter((r) => r.id !== targetRoom.id));
      if (editingRoom?.id === targetRoom.id) setEditingRoom(null);
      toast(`Room "${targetRoom.name}" removed successfully`);
      setRoomToRemove(null);
      refreshRoomsAndInventory();
    } catch (err: any) {
      toast(`Remove failed: ${err.message || 'Error removing room'}`, true);
    } finally {
      setRemovingRoom(false);
    }
  };

  const handleCreateSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createInventoryItem({
        item_name: newSupply.item_name,
        category: newSupply.category,
        stock_qty: Number(newSupply.stock_qty),
        unit: newSupply.unit,
        reorder_at: Number(newSupply.reorder_at),
      });
      setInventoryList((prev) => [...prev, created]);
      setShowCreateSupplyModal(false);
      try {
        localStorage.removeItem('jd_admin_draft_supply');
        localStorage.setItem('jd_admin_show_create_supply', 'false');
      } catch {}
      setNewSupply(defaultSupplyDraft);
      toast(`✦ Supply "${created.item_name}" registered`);
    } catch (err: any) {
      toast(err.message, true);
    }
  };

  const handleAdjustSupplyStock = async (item: any, delta: number) => {
    const nextQty = Math.max(0, (item.stock_qty || 0) + delta);
    try {
      const updated = await api.updateInventoryItem(item.id, { stock_qty: nextQty });
      setInventoryList((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, stock_qty: nextQty, updated_at: updated.updated_at } : i))
      );
      toast(`Stock for ${item.item_name}: ${nextQty} ${item.unit}`);
    } catch (err: any) {
      toast(err.message, true);
    }
  };

  const handleConfirmRemoveSupply = async () => {
    if (!supplyToRemove?.id) return;
    setRemovingSupply(true);
    try {
      await api.deleteInventoryItem(supplyToRemove.id);
      setInventoryList((prev) => prev.filter((i) => i.id !== supplyToRemove.id));
      toast(`Supply item "${supplyToRemove.item_name}" removed`);
      setSupplyToRemove(null);
    } catch (err: any) {
      toast(`Remove failed: ${err.message || 'Error removing supply item'}`, true);
    } finally {
      setRemovingSupply(false);
    }
  };

  // Unified Bookings merged across analytics overview and live reservations list
  const allBookings = useMemo(() => {
    const map = new Map<string, any>();
    for (const b of data?.bookings || []) {
      if (b && b.id) map.set(b.id, b);
    }
    for (const b of reservationsList || []) {
      if (b && b.id) map.set(b.id, { ...map.get(b.id), ...b });
    }
    return Array.from(map.values()).map((b: any) => ({
      ...b,
      nights:
        b.nights ||
        Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000)),
    }));
  }, [reservationsList, data?.bookings]);

  // Check room booking locks
  const isModalRoomLocked = useMemo(() => {
    const targetRoomId = newReservation.room_id || activeRoomsList[0]?.id;
    if (!targetRoomId || !newReservation.check_in) return false;
    const cin = String(newReservation.check_in).slice(0, 10);
    const rawCout = String(newReservation.check_out || '').slice(0, 10);
    const cout = rawCout > cin ? rawCout : addDaysYMD(cin, 1);

    const room = roomsList.find((r) => r.id === targetRoomId) || activeRoomsList[0];
    const totalUnits = Math.max(1, Number(room?.units) || 1);
    const overlapping = allBookings.filter((b: any) => {
      const status = String(b.status || '').toLowerCase();
      if (['cancelled', 'rejected', 'checked_out'].includes(status)) return false;
      const bCin = String(b.check_in || '').slice(0, 10);
      const bCoutRaw = String(b.check_out || '').slice(0, 10);
      const bCout = bCoutRaw > bCin ? bCoutRaw : addDaysYMD(bCin, 1);
      const sameRoom = b.room_id === targetRoomId || activeRoomsList.length <= 1;
      return sameRoom && bCin < cout && bCout > cin;
    });
    let night = cin;
    while (night < cout) {
      const busy = overlapping.filter((b: any) => {
        const bCin = String(b.check_in || '').slice(0, 10);
        const bCoutRaw = String(b.check_out || '').slice(0, 10);
        const bCout = bCoutRaw > bCin ? bCoutRaw : addDaysYMD(bCin, 1);
        return bCin <= night && bCout > night;
      }).length;
      if (busy >= totalUnits) return true;
      night = addDaysYMD(night, 1);
    }
    return false;
  }, [newReservation.room_id, newReservation.check_in, newReservation.check_out, roomsList, activeRoomsList, allBookings]);

  const isSelectedUnitTaken = useMemo(() => {
    const m = (newReservation.notes || '').match(/\[?(?:Unit\s*|u)(\d+)\]?/i);
    const targetRoomId = newReservation.room_id || activeRoomsList[0]?.id;
    if (!m || !targetRoomId || !newReservation.check_in) return false;
    const uNum = parseInt(m[1], 10);
    const cin = String(newReservation.check_in).slice(0, 10);
    const rawCout = String(newReservation.check_out || '').slice(0, 10);
    const cout = rawCout > cin ? rawCout : addDaysYMD(cin, 1);

    return allBookings.some((b: any) => {
      const status = String(b.status || '').toLowerCase();
      if (['cancelled', 'rejected', 'checked_out'].includes(status)) return false;
      const bCin = String(b.check_in || '').slice(0, 10);
      const bCoutRaw = String(b.check_out || '').slice(0, 10);
      const bCout = bCoutRaw > bCin ? bCoutRaw : addDaysYMD(bCin, 1);
      if (!(bCin < cout && bCout > cin)) return false;
      const bMatch = (b.notes || '').match(/\[?(?:Unit\s*|u)(\d+)\]?/i);
      if (bMatch && parseInt(bMatch[1], 10) === uNum) return true;
      if (!bMatch && uNum === 1 && (b.room_id === targetRoomId || activeRoomsList.length <= 1)) return true;
      return false;
    });
  }, [newReservation.notes, newReservation.room_id, newReservation.check_in, newReservation.check_out, activeRoomsList, allBookings]);

  const autoReloadLive = useCallback(async () => {
    if (!isAdministrator) return;
    try {
      const [freshAnalytics, freshReservations, freshNotifs, freshRooms, freshInv, freshConvs] = await Promise.all([
        api.analyticsOverview().catch(() => null),
        api.allReservations().catch(() => null),
        api.myNotifications().catch(() => null),
        api.rooms(true).catch(() => null),
        api.departmentInventory().catch(() => null),
        api.conversations().catch(() => null),
      ]);

      if (freshAnalytics) setData(freshAnalytics);
      if (Array.isArray(freshReservations)) {
        setReservationsList(
          freshReservations.map((b: any) => ({
            ...b,
            nights:
              b.nights ||
              Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000)),
          }))
        );
      }
      if (Array.isArray(freshNotifs)) setNotifications(freshNotifs);
      if (Array.isArray(freshRooms)) setRoomsList(freshRooms);
      if (Array.isArray(freshInv)) setInventoryList(freshInv);
      if (Array.isArray(freshConvs)) setGuestConversations(freshConvs);
    } catch {
      // Background silent catch
    }
  }, [isAdministrator]);

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingReservation(true);
    try {
      if (activeRoomsList.length === 0) {
        throw new Error("There's no present room around. Please create and activate a room in Room Management first.");
      }
      const targetRoomId = newReservation.room_id || activeRoomsList[0]?.id;
      const missingFields: string[] = [];
      if (!String(newReservation.guest_name || '').trim()) missingFields.push('Guest Full Name');
      if (!String(newReservation.phone || '').trim()) missingFields.push('Contact / Phone Number');
      if (!targetRoomId) missingFields.push('Accommodation Room');
      if (!newReservation.check_in || !newReservation.check_out) missingFields.push('Check-In & Check-Out Dates');
      if (!newReservation.guests || Number(newReservation.guests) < 1) missingFields.push('Number of Guests');

      if (missingFields.length > 0) {
        throw new Error(`⚠️ Please fill in the required blank information: ${missingFields.join(', ')}.`);
      }

      const roomMatch = activeRoomsList.find((r: any) => r.id === targetRoomId) || activeRoomsList[0];
      if (!roomMatch) {
        throw new Error('The selected room is absent or inactive. Please select a valid active accommodation.');
      }
      if (isModalRoomLocked) {
        throw new Error('⚠️ Already Booked: All units for this accommodation are already reserved on the selected dates.');
      }
      if (isSelectedUnitTaken) {
        const m = (newReservation.notes || '').match(/\[?(?:Unit\s*|u)(\d+)\]?/i);
        throw new Error(`⚠️ Already Booked: Unit ${m ? m[1] : ''} is already reserved on these dates. Please pick another unit or date.`);
      }
      const checkIn = newReservation.check_in || '2026-10-20';
      const checkOut =
        newReservation.check_out && newReservation.check_out > checkIn
          ? newReservation.check_out
          : addDaysYMD(checkIn, 1);
      const checkInTime = newReservation.check_in_time || '14:00';
      const checkOutTime = newReservation.check_out_time || '12:00';
      const timeTag = `[Check-In: ${formatTime12Hour(checkInTime)}, Check-Out: ${formatTime12Hour(checkOutTime)}]`;
      let finalNotes = (newReservation.notes || '').trim();
      if (!finalNotes.includes('[Check-In:')) {
        finalNotes = finalNotes ? `${finalNotes} ${timeTag}` : timeTag;
      }

      const created = await api.createReservation({
        ...newReservation,
        room_id: targetRoomId,
        check_in: checkIn,
        check_out: checkOut,
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        notes: finalNotes,
        guest_name: newReservation.guest_name.trim(),
        phone: newReservation.phone.trim(),
        total_php: Number(newReservation.total_php) || Number(roomMatch.rate_php) || 3500,
        guests: Number(newReservation.guests) || 2,
      });
      if (created && created.id) {
        setReservationsList((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      }
      toast('✦ New reservation recorded and added to Ledger!');
      setShowAddReservationModal(false);
      try {
        localStorage.removeItem('jd_admin_draft_reservation');
        localStorage.removeItem('jd_admin_draft_pool_addon');
        localStorage.setItem('jd_admin_show_add_reservation', 'false');
      } catch {}
      setNewReservation({
        ...defaultReservationDraft,
        room_id: activeRoomsList[0]?.id || '',
        total_php: Number(activeRoomsList[0]?.rate_php) || 3500,
      });
      setWalkInPoolAddon('none');
      refreshReservations();
      autoReloadLive();
    } catch (err: any) {
      toast(err.message || 'Failed to record reservation', true);
    } finally {
      setCreatingReservation(false);
    }
  };

  // General Ledger State
  const [ledgerEntriesList, setLedgerEntriesList] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [trialBalance, setTrialBalance] = useState<any>(null);
  const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([]);

  const [ledgerSubView, setLedgerSubView] = useState<'stay_folios' | 'availability' | 'debit_credit'>(() => {
    try {
      const saved = localStorage.getItem('jd_admin_ledger_subview');
      if (saved && ['stay_folios', 'availability', 'debit_credit'].includes(saved)) {
        return saved as 'stay_folios' | 'availability' | 'debit_credit';
      }
    } catch {}
    return 'availability';
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_ledger_subview', ledgerSubView);
    } catch {}
  }, [ledgerSubView]);

  const [ledgerAccountFilter, setLedgerAccountFilter] = useState(() => {
    try {
      return localStorage.getItem('jd_admin_ledger_account_filter') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_ledger_account_filter', ledgerAccountFilter);
    } catch {}
  }, [ledgerAccountFilter]);

  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState(() => {
    try {
      return localStorage.getItem('jd_admin_ledger_category_filter') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_ledger_category_filter', ledgerCategoryFilter);
    } catch {}
  }, [ledgerCategoryFilter]);

  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | 'debit' | 'credit'>(() => {
    try {
      const saved = localStorage.getItem('jd_admin_ledger_type_filter');
      if (saved && ['all', 'debit', 'credit'].includes(saved)) {
        return saved as 'all' | 'debit' | 'credit';
      }
    } catch {}
    return 'all';
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_ledger_type_filter', ledgerTypeFilter);
    } catch {}
  }, [ledgerTypeFilter]);

  const [ledgerSearch, setLedgerSearch] = useState(() => {
    try {
      return localStorage.getItem('jd_admin_ledger_search') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_ledger_search', ledgerSearch);
    } catch {}
  }, [ledgerSearch]);

  const defaultJournalDraft = {
    mode: 'pair',
    debit_account_code: '1010',
    credit_account_code: '4010',
    amount_php: 1000,
    particulars: '',
    category: 'REVENUE',
    reference_id: '',
  };

  const [showAddJournalModal, setShowAddJournalModal] = useState<boolean>(() => {
    try {
      return localStorage.getItem('jd_admin_show_add_journal') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_show_add_journal', String(showAddJournalModal));
    } catch {}
  }, [showAddJournalModal]);

  const [postingJournal, setPostingJournal] = useState(false);
  const [journalForm, setJournalForm] = useState(() => {
    try {
      const saved = localStorage.getItem('jd_admin_draft_journal');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...defaultJournalDraft, ...parsed };
        }
      }
    } catch {}
    return defaultJournalDraft;
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_draft_journal', JSON.stringify(journalForm));
    } catch {}
  }, [journalForm]);

  const [showBackupModal, setShowBackupModal] = useState<boolean>(() => {
    try {
      return localStorage.getItem('jd_admin_show_backup_modal') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_show_backup_modal', String(showBackupModal));
    } catch {}
  }, [showBackupModal]);

  const [backupTab, setBackupTab] = useState<'export' | 'import' | 'notation' | 'auto'>(() => {
    try {
      const saved = localStorage.getItem('jd_admin_backup_tab');
      if (saved && ['export', 'import', 'notation', 'auto'].includes(saved)) {
        return saved as any;
      }
    } catch {}
    return 'export';
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_backup_tab', backupTab);
    } catch {}
  }, [backupTab]);
  const [exportFormat, setExportFormat] = useState<'sql' | 'json' | 'csv'>('sql');
  const [previewSqlText, setPreviewSqlText] = useState('');
  const [loadingPreviewSql, setLoadingPreviewSql] = useState(false);
  const [importContent, setImportContent] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'overwrite'>('append');
  const [importingBackup, setImportingBackup] = useState(false);
  const [reconcilingLedger, setReconcilingLedger] = useState(false);

  const refreshLedgerEntries = useCallback(async () => {
    setLoadingLedger(true);
    try {
      const res = await api.ledgerEntries({
        account_code: ledgerAccountFilter || undefined,
        category: ledgerCategoryFilter || undefined,
        entry_type: ledgerTypeFilter !== 'all' ? ledgerTypeFilter : undefined,
        search: ledgerSearch || undefined,
      });
      if (res?.data && Array.isArray(res.data)) {
        setLedgerEntriesList(res.data);
      }
      if (res?.trial_balance) {
        setTrialBalance(res.trial_balance);
      }
      if (res?.chart_of_accounts && Array.isArray(res.chart_of_accounts)) {
        setChartOfAccounts(res.chart_of_accounts);
      }
    } catch (err: any) {
      console.warn('Failed to load ledger entries:', err);
    } finally {
      setLoadingLedger(false);
    }
  }, [ledgerAccountFilter, ledgerCategoryFilter, ledgerTypeFilter, ledgerSearch]);

  const handleReconcileLedger = async () => {
    setReconcilingLedger(true);
    try {
      const res = await api.reconcileLedger();
      const count = res?.data?.new_entries_posted || 0;
      toast(`✦ Reconciliation complete: ${count} journal entries posted & synchronized!`);
      await refreshLedgerEntries();
    } catch (err: any) {
      toast(`Reconciliation error: ${err.message}`, true);
    } finally {
      setReconcilingLedger(false);
    }
  };

  const handlePostJournalEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setPostingJournal(true);
    try {
      if (!journalForm.particulars.trim()) {
        throw new Error('Please enter particulars / description for the journal entry.');
      }
      if (!journalForm.amount_php || Number(journalForm.amount_php) <= 0) {
        throw new Error('Transaction amount must be greater than zero.');
      }
      await api.createLedgerEntry(journalForm);
      toast('✦ Double-entry journal voucher recorded in General Ledger!');
      setShowAddJournalModal(false);
      try {
        localStorage.removeItem('jd_admin_draft_journal');
        localStorage.setItem('jd_admin_show_add_journal', 'false');
      } catch {}
      setJournalForm(defaultJournalDraft);
      await refreshLedgerEntries();
    } catch (err: any) {
      toast(err.message, true);
    } finally {
      setPostingJournal(false);
    }
  };

  const handleDownloadExport = async (format: 'sql' | 'json' | 'csv') => {
    try {
      toast(`Exporting ${format.toUpperCase()} database backup…`);
      const content = await api.fetchLedgerBackupText(format);
      const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `rockview_ledger_backup_${dateStamp}.${format}`;
      const mimeTypes: Record<string, string> = {
        sql: 'application/sql',
        json: 'application/json',
        csv: 'text/csv',
      };
      const blob = new Blob([content], { type: `${mimeTypes[format] || 'text/plain'};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`✦ ${format.toUpperCase()} database backup downloaded successfully!`);
    } catch (err: any) {
      toast(`Export failed: ${err.message}`, true);
    }
  };

  const handleExecuteImport = async () => {
    if (!importContent.trim()) {
      toast('Please upload a file or paste content to import.', true);
      return;
    }
    setImportingBackup(true);
    try {
      const res = await api.importLedgerBackup(importContent, importMode);
      const count = res?.data?.imported_count ?? res?.imported_count ?? 0;
      const fmt = res?.data?.detected_format ?? res?.detected_format ?? 'adaptive';
      toast(`✦ Successfully imported ${count} records via adaptive ${String(fmt).toUpperCase()} engine!`);
      setImportContent('');
      setShowBackupModal(false);
      await Promise.all([refreshLedgerEntries(), refreshReservations()]);
    } catch (err: any) {
      toast(`Import failed: ${err.message}`, true);
    } finally {
      setImportingBackup(false);
    }
  };

  // Staff and User Accounts State
  const [users, setUsers] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      return localStorage.getItem('jd_admin_search_query') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_search_query', searchQuery);
    } catch {}
  }, [searchQuery]);

  const [roleFilter, setRoleFilter] = useState(() => {
    try {
      return localStorage.getItem('jd_admin_role_filter') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_role_filter', roleFilter);
    } catch {}
  }, [roleFilter]);

  const defaultStaffDraft = {
    first_name: '',
    middle_name: '',
    last_name: '',
    full_name: '',
    email: '',
    password: '',
    phone: '',
    role: 'receptionist',
  };

  const [showCreateModal, setShowCreateModal] = useState<boolean>(() => {
    try {
      return localStorage.getItem('jd_admin_show_create_staff') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_show_create_staff', String(showCreateModal));
    } catch {}
  }, [showCreateModal]);

  const [newStaff, setNewStaff] = useState(() => {
    try {
      const saved = localStorage.getItem('jd_admin_draft_staff');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...defaultStaffDraft, ...parsed };
        }
      }
    } catch {}
    return defaultStaffDraft;
  });

  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_draft_staff', JSON.stringify(newStaff));
    } catch {}
  }, [newStaff]);

  const [creatingStaff, setCreatingStaff] = useState(false);

  const [recoveryTarget, setRecoveryTarget] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPass, setResettingPass] = useState(false);

  const [editingUser, setEditingUser] = useState<any>(null);
  const [savingUser, setSavingUser] = useState(false);

  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const fetchUsers = useCallback(() => {
    if (activeTab === 'accounts') {
      setSearchingUsers(true);
      api
        .adminCustomers(searchQuery, roleFilter)
        .then((uData) => {
          if (Array.isArray(uData)) setUsers(uData);
        })
        .catch((e) => toast(e.message, true))
        .finally(() => setSearchingUsers(false));
    }
  }, [activeTab, searchQuery, roleFilter]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.updateUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      toast(`User role updated to ${newRole} ✦`);
    } catch (err: any) {
      toast(err.message, true);
    }
  };

  const handleProvisionStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingStaff(true);
    try {
      const full_name =
        [newStaff.first_name, newStaff.middle_name, newStaff.last_name].filter(Boolean).join(' ') ||
        newStaff.full_name ||
        'Staff User';
      const targetEmail =
        newStaff.email || generateAccountEmail(newStaff.first_name, newStaff.middle_name, newStaff.last_name, users.length + 1, true, newStaff.role);
      const created = await api.createStaffAccount({ ...newStaff, full_name, email: targetEmail });
      toast(`Staff Account Created for ${created.full_name || full_name} (${created.role}) ✦`);
      setUsers((prev) => [created, ...prev]);
      setShowCreateModal(false);
      try {
        localStorage.removeItem('jd_admin_draft_staff');
        localStorage.setItem('jd_admin_show_create_staff', 'false');
      } catch {}
      setNewStaff(defaultStaffDraft);
    } catch (err: any) {
      toast(err.message, true);
    } finally {
      setCreatingStaff(false);
    }
  };

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryTarget || !newPassword) return;
    setResettingPass(true);
    try {
      await api.resetUserPassword(recoveryTarget.id, newPassword);
      toast(`Password Reset & SMS Recovery Ping sent to ${recoveryTarget.full_name} ✦`);
      setRecoveryTarget(null);
      setNewPassword('');
    } catch (err: any) {
      toast(err.message, true);
    } finally {
      setResettingPass(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingUser(true);
    try {
      const full_name =
        [editingUser.first_name, editingUser.middle_name, editingUser.last_name].filter(Boolean).join(' ') ||
        editingUser.full_name;
      const isCustomer = !editingUser.role || editingUser.role === 'customer';
      const payload = {
        full_name,
        first_name: editingUser.first_name,
        middle_name: editingUser.middle_name,
        last_name: editingUser.last_name,
        phone: editingUser.phone,
        username: editingUser.username,
        role: isCustomer ? 'customer' : editingUser.role,
      };
      const updated = await api.adminUpdateUser(editingUser.id, payload);
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, ...updated, full_name } : u)));
      toast(`Profile updated for ${full_name || 'Account'} ✦`);
      setEditingUser(null);
    } catch (err: any) {
      toast(err.message, true);
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    try {
      await api.adminDeleteUser(userToDelete.id);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      toast(`Account permanently deleted for ${userToDelete.full_name || userToDelete.email} ✦`);
      setUserToDelete(null);
    } catch (err: any) {
      toast(err.message, true);
    } finally {
      setDeletingUser(false);
    }
  };

  // Audit Logs & Security Posture
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditAutoRefresh, setAuditAutoRefresh] = useState(true);
  const [securityPosture, setSecurityPosture] = useState<any>(null);

  const fetchAuditLogs = useCallback(() => {
    setLoadingAudit(true);
    const params = new URLSearchParams();
    params.append('limit', '200');

    api
      .auditLogs(params.toString())
      .then((res) => {
        if (res && Array.isArray(res.logs)) {
          setAuditLogs(res.logs);
        }
      })
      .catch((err) => {
        console.warn('[Audit Logs] Fetch notice:', err.message);
      })
      .finally(() => setLoadingAudit(false));
  }, []);

  const fetchSecurityPosture = useCallback(() => {
    api
      .securityPosture()
      .then((res) => {
        if (res) setSecurityPosture(res);
      })
      .catch((err) => {
        console.warn('[Security Posture] Fetch notice:', err.message);
      });
  }, []);

  const handleUnbanIp = async (ip: string) => {
    try {
      await api.releaseQuarantinedIp(ip);
      toast(`🟢 IP ${ip} successfully released from quarantine`);
      fetchSecurityPosture();
      fetchAuditLogs();
    } catch (err: any) {
      toast(err.message, true);
    }
  };

  // Refund State
  const [refundTarget, setRefundTarget] = useState<any>(null);
  const [refundMode, setRefundMode] = useState('request');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('GCash');
  const [refundRefNum, setRefundRefNum] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget) return;
    setSubmittingRefund(true);
    try {
      const amountNum = Number(refundAmount) || refundTarget.downpayment_php || refundTarget.total_php || 0;
      if (refundMode === 'request') {
        const res = await api.requestRefund(refundTarget.id, refundReason, amountNum);
        toast(res.message || 'Refund request registered and in-process email dispatched ✦');
      } else {
        const res = await api.confirmRefund(refundTarget.id, {
          amount: amountNum,
          refund_method: refundMethod,
          reference_number: refundRefNum || `REF-${Date.now().toString().slice(-6)}`,
          cancel_booking: true,
        });
        toast(res.message || 'Refund confirmed and confirmation email dispatched ✦');
      }
      setRefundTarget(null);
      setRefundReason('');
      setRefundAmount('');
      setRefundRefNum('');
      setReservationsList((prev) =>
        prev.map((r) =>
          r.id === refundTarget.id
            ? {
                ...r,
                payment_status: refundMode === 'confirm' ? 'refunded' : 'refund_pending',
                status: refundMode === 'confirm' ? 'cancelled' : r.status,
              }
            : r
        )
      );
      refreshReservations();
      autoReloadLive();
    } catch (err: any) {
      toast(err.message, true);
    } finally {
      setSubmittingRefund(false);
    }
  };

  // Admin Forgot Password
  const [showAdminForgotModal, setShowAdminForgotModal] = useState(false);
  const [adminRecoveryStep, setAdminRecoveryStep] = useState(1);
  const [adminRecoveryEmail, setAdminRecoveryEmail] = useState('');
  const [adminRecoveryCode, setAdminRecoveryCode] = useState('');
  const [adminRecoveryNewPass, setAdminRecoveryNewPass] = useState('');
  const [adminRecoveryBusy, setAdminRecoveryBusy] = useState(false);

  const handleAdminForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminRecoveryEmail) return toast('Please enter your administrator account email', true);
    setAdminRecoveryBusy(true);
    try {
      const res = await api.forgotPassword(adminRecoveryEmail);
      toast(res.message || 'OTP verification code dispatched to your email!');
      setAdminRecoveryStep(2);
    } catch (err: any) {
      toast(err.message, true);
    } finally {
      setAdminRecoveryBusy(false);
    }
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminRecoveryCode || adminRecoveryCode.length !== 6) return toast('Enter the 6-digit verification code', true);
    if (!adminRecoveryNewPass || adminRecoveryNewPass.length < 6) return toast('New password must be at least 6 characters', true);
    setAdminRecoveryBusy(true);
    try {
      const res = await api.resetPassword(adminRecoveryEmail, adminRecoveryCode, adminRecoveryNewPass);
      toast(res.message || 'Password reset successfully! Please sign in with your new credentials.');
      setShowAdminForgotModal(false);
      setAdminRecoveryStep(1);
      setAdminEmail(adminRecoveryEmail);
      setAdminPass(adminRecoveryNewPass);
    } catch (err: any) {
      toast(err.message, true);
    } finally {
      setAdminRecoveryBusy(false);
    }
  };

  // Profile Settings
  const defaultAdminName =
    currentAdminProfile?.full_name ||
    [currentAdminProfile?.first_name, currentAdminProfile?.last_name].filter(Boolean).join(' ') ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    'Julian Nygel De Leon';
  const defaultAdminTitle =
    currentAdminProfile?.title || currentAdminProfile?.position || 'General Manager & System Administrator';
  const defaultAdminDomain =
    currentAdminProfile?.domain_account ||
    (currentAdminProfile?.email?.endsWith('@janddbeachhouse.ph')
      ? currentAdminProfile.email
      : 'admin@janddbeachhouse.ph');
  const defaultAdminAvatar =
    currentAdminProfile?.avatar_url ||
    currentAdminProfile?.picture ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    '';

  const [adminProfileState, setAdminProfileState] = useState({
    fullName: defaultAdminName,
    title: defaultAdminTitle,
    avatarKey: 'crown',
    customAvatarUrl: defaultAdminAvatar,
    email: currentAdminProfile?.email || user?.email || 'admin@janddbeachhouse.ph',
    domainAccount: defaultAdminDomain,
    phone: currentAdminProfile?.phone || user?.user_metadata?.phone || '09171234567',
    department: currentAdminProfile?.department || 'Executive Operations & IT',
    employeeId: currentAdminProfile?.employee_id || 'JD-ADM-001',
    statusBio: currentAdminProfile?.status_bio || 'Executive resort administration & active defense security.',
    location: 'Brgy. Patar, Bolinao, Pangasinan',
    refreshRate: '5',
    smsNotifications: true,
    telemetryStream: true,
    twoFactorAuth: true,
    sessionTimeout: '30',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (currentAdminProfile) {
      const resolvedName =
        currentAdminProfile.full_name ||
        [currentAdminProfile.first_name, currentAdminProfile.last_name].filter(Boolean).join(' ') ||
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name;
      const resolvedTitle = currentAdminProfile.title || currentAdminProfile.position;
      const resolvedAvatar =
        currentAdminProfile.avatar_url ||
        currentAdminProfile.picture ||
        user?.user_metadata?.avatar_url ||
        user?.user_metadata?.picture;
      const resolvedDomain =
        currentAdminProfile.domain_account ||
        (currentAdminProfile.email?.endsWith('@janddbeachhouse.ph')
          ? currentAdminProfile.email
          : 'admin@janddbeachhouse.ph');
      setAdminProfileState((prev) => ({
        ...prev,
        fullName: resolvedName || prev.fullName,
        title: resolvedTitle || prev.title,
        avatarKey: prev.avatarKey || 'crown',
        customAvatarUrl: resolvedAvatar || prev.customAvatarUrl,
        email: currentAdminProfile.email || user?.email || prev.email,
        domainAccount: resolvedDomain || prev.domainAccount,
        phone: currentAdminProfile.phone || prev.phone,
        department: currentAdminProfile.department || prev.department,
        employeeId: currentAdminProfile.employee_id || prev.employeeId,
        statusBio: currentAdminProfile.status_bio || prev.statusBio,
      }));
    }
  }, [currentAdminProfile, user]);

  useEffect(() => {
    if (refreshProfile) refreshProfile();
    api
      .me()
      .then((fresh) => {
        if (fresh && fresh.id) {
          const freshName = fresh.full_name || [fresh.first_name, fresh.last_name].filter(Boolean).join(' ');
          const freshDomain =
            fresh.domain_account ||
            (fresh.email?.endsWith('@janddbeachhouse.ph') ? fresh.email : 'admin@janddbeachhouse.ph');
          setAdminProfileState((prev) => ({
            ...prev,
            fullName: freshName || prev.fullName,
            title: fresh.title || fresh.position || prev.title,
            customAvatarUrl: fresh.avatar_url || prev.customAvatarUrl,
            email: fresh.email || prev.email,
            domainAccount: freshDomain || prev.domainAccount,
            phone: fresh.phone || prev.phone,
            department: fresh.department || prev.department,
            employeeId: fresh.employee_id || prev.employeeId,
            statusBio: fresh.status_bio || prev.statusBio,
          }));
        }
      })
      .catch(() => {});
  }, [refreshProfile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Please select an image file (JPG, PNG, WebP)', true);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast('Image file exceeds 8MB maximum size limit', true);
      return;
    }
    setUploadingAvatar(true);
    try {
      toast('Uploading executive avatar to Cloudinary CDN...');
      const uploaded = await uploadImageToCloudinary(file);
      if (uploaded?.url) {
        setAdminProfileState((prev) => ({ ...prev, customAvatarUrl: uploaded.url }));
        if (updateProfile) {
          await updateProfile({ avatar_url: uploaded.url });
        } else {
          await api.updateMe({ avatar_url: uploaded.url });
        }
        toast('📸 Executive profile picture uploaded to Cloudinary CDN & saved! ✦');
      } else {
        throw new Error('Upload returned empty image URL');
      }
    } catch (err: any) {
      toast(`Avatar upload failed: ${err.message || 'Error uploading photo'}`, true);
    } finally {
      setUploadingAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      setAdminProfileState((prev) => ({ ...prev, customAvatarUrl: '' }));
      if (updateProfile) {
        await updateProfile({ avatar_url: '' });
      } else {
        await api.updateMe({ avatar_url: '' });
      }
      toast('Profile picture removed successfully');
    } catch (err: any) {
      toast(`Remove failed: ${err.message || 'Error removing photo'}`, true);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      if (!adminProfileState.fullName?.trim()) {
        throw new Error('Please enter your full name.');
      }
      const updatePayload: any = {
        full_name: adminProfileState.fullName.trim(),
        title: adminProfileState.title.trim(),
        phone: adminProfileState.phone.trim(),
        avatar_url: adminProfileState.customAvatarUrl || '',
      };

      if (updateProfile) {
        await updateProfile(updatePayload);
      } else {
        await api.updateMe(updatePayload);
      }

      if (adminProfileState.newPassword) {
        if (adminProfileState.newPassword.length < 6) {
          throw new Error('New password must be at least 6 characters.');
        }
        if (adminProfileState.newPassword !== adminProfileState.confirmPassword) {
          throw new Error('New passwords do not match.');
        }
        await api.updatePassword(adminProfileState.newPassword);
        setAdminProfileState((prev) => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }));
      }

      toast('⚙️ Executive Profile & Control Settings saved to database! ✦');
    } catch (err: any) {
      toast(err.message || 'Could not save profile settings', true);
    } finally {
      setSavingSettings(false);
    }
  };

  // Conversations & Modals
  const [guestConversations, setGuestConversations] = useState<any[]>([]);
  const [activeChatGuest, setActiveChatGuest] = useState<any>(null);
  const [selectedPanelGuest, setSelectedPanelGuest] = useState<any>(null);
  const [showKeywordsModal, setShowKeywordsModal] = useState(false);
  const [showGlossaryModal, setShowGlossaryModal] = useState(false);

  // Authenticate Admin
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthenticating(true);
    setAuthError('');
    try {
      if (!adminEmail.trim() || !adminPass) {
        throw new Error('Please enter administrator username or email, and password.');
      }
      const res = await adminSignIn(adminEmail.trim(), adminPass);
      if (res?.error) throw res.error;
      toast('✦ Administrator credentials verified. Loading control center…');
    } catch (err: any) {
      const rawMsg = err?.message || (typeof err === 'string' ? err : '');
      const cleanMsg = (!rawMsg || rawMsg === '{}' || rawMsg === '[object Object]')
        ? 'Invalid administrator credentials. Please check your username and password.'
        : rawMsg;
      setAuthError(cleanMsg);
      toast(cleanMsg, true);
    } finally {
      setAuthenticating(false);
    }
  };

  // Realtime Telemetry SSE Stream & Subscriptions
  useEffect(() => {
    if (isAdministrator) {
      let live = true;
      let es: EventSource | null = null;

      api
        .analyticsOverview()
        .then((d) => live && setData(d))
        .catch((e) => toast(e.message, true))
        .finally(() => live && setLoading(false));

      refreshReservations();
      refreshRoomsAndInventory();
      refreshLedgerEntries();

      api
        .myNotifications()
        .then((n) => live && setNotifications(n))
        .catch(() => {});

      api
        .conversations()
        .then((conv) => live && Array.isArray(conv) && setGuestConversations(conv))
        .catch(() => {});

      const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      if (API_BASE || isLocal) {
        supabase.auth.getSession().then(({ data: authData }) => {
          const token =
            (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_jwt') : null) ||
            localStorage.getItem('jd_admin_jwt') ||
            authData?.session?.access_token;
          const key =
            (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_token_key') : null) ||
            localStorage.getItem('jd_admin_token_key') ||
            'etc-34';
          if (token) {
            const streamUrl = API_BASE
              ? `${API_BASE}/api/analytics/stream?token=${encodeURIComponent(token)}&admin_token_key=${encodeURIComponent(key)}`
              : `/api/analytics/stream?token=${encodeURIComponent(token)}&admin_token_key=${encodeURIComponent(key)}`;
            try {
              es = new EventSource(streamUrl);
              es.onmessage = (e) => {
                if (!live) return;
                try {
                  const ov = JSON.parse(e.data);
                  setData((prev: any) => (prev ? { ...prev, overview: ov } : prev));
                } catch {}
              };
              es.onerror = () => {
                if (es) {
                  es.close();
                  es = null;
                }
              };
            } catch {}
          }
        });
      }

      return () => {
        live = false;
        if (es) es.close();
      };
    } else {
      setLoading(false);
    }
  }, [isAdministrator, profile, refreshReservations, refreshRoomsAndInventory, refreshLedgerEntries]);

  // Auto-reload every 20s
  useEffect(() => {
    if (!isAdministrator) return;
    const interval = setInterval(() => {
      autoReloadLive();
    }, 20000);
    return () => clearInterval(interval);
  }, [isAdministrator, autoReloadLive]);

  // Tab dynamic load effects
  useEffect(() => {
    if (activeTab === 'inventory') {
      refreshRoomsAndInventory();
    }
    if (activeTab === 'ledger') {
      refreshReservations();
      refreshLedgerEntries();
      if (roomsList.length === 0) {
        api.rooms(false).then((r: any) => setRoomsList(Array.isArray(r) ? r : [])).catch(() => {});
      }
    }
    if (activeTab === 'notifications') {
      api.myNotifications().then((n: any) => Array.isArray(n) && setNotifications(n)).catch(() => {});
    }
    if (activeTab === 'accounts') {
      fetchUsers();
    }
    if (activeTab === 'audit') {
      fetchAuditLogs();
      fetchSecurityPosture();
    }
  }, [
    activeTab,
    refreshRoomsAndInventory,
    refreshReservations,
    refreshLedgerEntries,
    fetchUsers,
    fetchAuditLogs,
    fetchSecurityPosture,
    roomsList.length,
  ]);

  // October Metrics
  const octoberSalesData = useMemo(() => {
    const daysInOct = 31;
    const days = [];
    for (let day = 1; day <= daysInOct; day++) {
      const dStr = `2026-10-${String(day).padStart(2, '0')}`;
      let revOnDay = 0;
      let bookingsOnDay = 0;
      allBookings.forEach((b: any) => {
        if (b.status === 'cancelled') return;
        if (b.check_in <= dStr && b.check_out >= dStr) {
          const nights = Math.max(
            1,
            Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000)
          );
          const dailyRate = (Number(b.total_php) || 0) / nights;
          revOnDay += dailyRate;
          bookingsOnDay += 1;
        }
      });
      const apiDaily = data?.daily?.find((d: any) => d.date === dStr);
      if (apiDaily && apiDaily.revenue_php > 0) {
        revOnDay = Math.max(revOnDay, Number(apiDaily.revenue_php));
        bookingsOnDay = Math.max(bookingsOnDay, Number(apiDaily.bookings));
      }
      days.push({
        date: dStr,
        day,
        label: `Oct ${day}`,
        revenue: Math.round(revOnDay),
        value: bookingsOnDay,
      });
    }
    return days;
  }, [allBookings, data?.daily]);

  return {
    session,
    profile,
    currentAdminSession,
    currentAdminProfile,
    user,
    signOut,
    signOutAdmin,
    deleteAccount,
    updatePassword,
    isAdministrator,
    loading,
    data,
    setData,
    allBookings,
    octoberSalesData,

    // Auth Form
    adminEmail,
    setAdminEmail,
    adminPass,
    setAdminPass,
    authError,
    authenticating,
    handleAdminLogin,

    // Theme & Navigation
    isLightMode,
    toggleThemeMode,
    activeTab,
    setActiveTab,
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarHidden,
    setSidebarHidden,
    sidebarMobileOpen,
    setSidebarMobileOpen,
    themeBg,
    themeSidebarBg,
    themeHeaderBg,
    themeCardBg,
    themeText,
    themeMuted,
    themeBorder,
    themeShadow,

    // Notifications
    notifications,
    setNotifications,
    unreadNotifsCount,
    viewingNotification,
    setViewingNotification,
    handleMarkNotifRead,
    handleMarkAllNotifsRead,
    handleDeleteNotif,
    handleClearAllNotifs,
    handleClearReadNotifs,

    // Reservations
    reservationsList,
    setReservationsList,
    loadingReservations,
    refreshReservations,
    updateStatus,
    receiptModalBooking,
    setReceiptModalBooking,
    timelineBooking,
    setTimelineBooking,
    reservationToRemove,
    setReservationToRemove,
    removingReservation,
    handleConfirmRemoveReservation,
    showAddReservationModal,
    setShowAddReservationModal,
    creatingReservation,
    walkInPoolAddon,
    setWalkInPoolAddon,
    newReservation,
    setNewReservation,
    handleCreateReservation,

    // Ledger
    ledgerEntriesList,
    loadingLedger,
    trialBalance,
    chartOfAccounts,
    ledgerSubView,
    setLedgerSubView,
    refreshLedgerEntries,
    reconcilingLedger,
    handleReconcileLedger,
    showAddJournalModal,
    setShowAddJournalModal,
    postingJournal,
    journalForm,
    setJournalForm,
    handlePostJournalEntry,
    showBackupModal,
    setShowBackupModal,
    backupTab,
    setBackupTab,
    exportFormat,
    setExportFormat,
    previewSqlText,
    setPreviewSqlText,
    loadingPreviewSql,
    setLoadingPreviewSql,
    importContent,
    setImportContent,
    importMode,
    setImportMode,
    importingBackup,
    handleDownloadExport,
    handleExecuteImport,

    // Rooms & Inventory
    roomsList,
    setRoomsList,
    activeRoomsList,
    inventoryList,
    loadingRoomsAndInv,
    refreshRoomsAndInventory,
    showCreateRoomModal,
    setShowCreateRoomModal,
    newRoom,
    setNewRoom,
    handleCreateRoom,
    editingRoom,
    setEditingRoom,
    uploadingRoomPhoto,
    handleSaveEditedRoom,
    handleUpdateRoomSubmit,
    handleRoomPhotoUpload,
    handleAddPhotoUrl,
    handleAddPresetPhoto,
    handleRemovePhoto,
    handleSetPrimaryPhoto,
    handleToggleRoomActive,
    roomToRemove,
    setRoomToRemove,
    removingRoom,
    handleConfirmRemoveRoom,
    showCreateSupplyModal,
    setShowCreateSupplyModal,
    newSupply,
    setNewSupply,
    handleCreateSupply,
    handleAdjustSupplyStock,
    supplyToRemove,
    setSupplyToRemove,
    removingSupply,
    handleConfirmRemoveSupply,

    // Staff & Users
    users,
    searchingUsers,
    searchQuery,
    setSearchQuery,
    fetchUsers,
    handleRoleChange,
    showCreateModal,
    setShowCreateModal,
    newStaff,
    setNewStaff,
    creatingStaff,
    handleProvisionStaff,
    recoveryTarget,
    setRecoveryTarget,
    newPassword,
    setNewPassword,
    resettingPass,
    handlePasswordRecovery,
    editingUser,
    setEditingUser,
    savingUser,
    handleUpdateUser,
    userToDelete,
    setUserToDelete,
    deletingUser,
    handleDeleteUser,

    // Security & Audit
    auditLogs,
    setAuditLogs,
    loadingAudit,
    fetchAuditLogs,
    auditAutoRefresh,
    setAuditAutoRefresh,
    securityPosture,
    handleUnbanIp,

    // Refund
    refundTarget,
    setRefundTarget,
    refundMode,
    setRefundMode,
    refundAmount,
    setRefundAmount,
    refundMethod,
    setRefundMethod,
    refundRefNum,
    setRefundRefNum,
    refundReason,
    setRefundReason,
    submittingRefund,
    handleRefundSubmit,

    // Forgot Password
    showAdminForgotModal,
    setShowAdminForgotModal,
    adminRecoveryStep,
    setAdminRecoveryStep,
    adminRecoveryEmail,
    setAdminRecoveryEmail,
    adminRecoveryCode,
    setAdminRecoveryCode,
    adminRecoveryNewPass,
    setAdminRecoveryNewPass,
    adminRecoveryBusy,
    handleAdminForgotPassword,
    handleAdminResetPassword,

    // Profile & Settings
    adminProfileState,
    setAdminProfileState,
    uploadingAvatar,
    savingSettings,
    handleAvatarUpload,
    handleRemoveAvatar,
    handleSaveSettings,

    // Conversations & Glossary
    guestConversations,
    activeChatGuest,
    setActiveChatGuest,
    selectedPanelGuest,
    setSelectedPanelGuest,
    showKeywordsModal,
    setShowKeywordsModal,
    showGlossaryModal,
    setShowGlossaryModal,
  };
}

export type AdminState = ReturnType<typeof useAdminState>;
