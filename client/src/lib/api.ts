import { supabase } from './supabaseClient.js';
import { CANONICAL_ROOMS } from './canonicalRooms.js';

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const rawApiBase = (
  (typeof import.meta !== 'undefined' && (
    import.meta.env.VITE_API_URL ||
    import.meta.env.PUBLIC_API_URL ||
    import.meta.env.VITE_PUBLIC_API_URL ||
    import.meta.env.VITE_BACKEND_URL
  )) || ''
).replace(/\/+$/, '');

export const API_BASE = (
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.endsWith('.localhost')) &&
  (!rawApiBase || rawApiBase.includes('localhost') || rawApiBase.includes('127.0.0.1'))
)
  ? ''
  : rawApiBase;

let inMemoryCsrfToken = '';

async function getOrFetchCsrfToken(): Promise<string> {
  if (inMemoryCsrfToken) return inMemoryCsrfToken;
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
    if (match && match[1]) {
      inMemoryCsrfToken = decodeURIComponent(match[1]);
      return inMemoryCsrfToken;
    }
  }
  try {
    const endpoint = API_BASE ? `${API_BASE}/api/security/token` : '/api/security/token';
    const res = await fetch(endpoint, { credentials: 'include' });
    const data = await res.json();
    if (data?.csrf_token) {
      inMemoryCsrfToken = data.csrf_token;
      return inMemoryCsrfToken;
    }
  } catch {}
  return '';
}

export function resetApiSecurityTokens() {
  inMemoryCsrfToken = '';
}

async function req<T = any>(path: string, { method = 'GET', body }: { method?: string; body?: any } = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Strictly attach admin token key ONLY when authenticated admin session exists in sessionStorage
  const adminTokenKey = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_token_key') : null;
  if (adminTokenKey) {
    headers['x-admin-token-key'] = adminTokenKey;
  }

  const adminJwt = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_jwt') : null;
  const customerJwt = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_customer_jwt') : null;
  const isAdminContext = (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) || path.startsWith('/admin');

  if (isAdminContext && adminJwt) {
    headers['Authorization'] = `Bearer ${adminJwt}`;
  } else if (!isAdminContext && customerJwt) {
    headers['Authorization'] = `Bearer ${customerJwt}`;
  } else if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  } else if (adminJwt) {
    headers['Authorization'] = `Bearer ${adminJwt}`;
  } else if (customerJwt) {
    headers['Authorization'] = `Bearer ${customerJwt}`;
  }

  // Double-Submit CSRF Token Protection Header
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    const token = await getOrFetchCsrfToken();
    if (token) {
      headers['X-CSRF-Token'] = token;
    }
  }

  const endpoint = API_BASE ? `${API_BASE}/api${path}` : `/api${path}`;
  const res = await fetch(endpoint, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const csrfHeader = res.headers.get('x-csrf-token');
  if (csrfHeader) {
    inMemoryCsrfToken = csrfHeader;
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorBody.message || errorBody.error || `HTTP ${res.status} error`, errorBody);
  }

  if (res.status === 204) {
    return null as T;
  }

  return res.json() as Promise<T>;
}

export function packRoomPayload(body: any, existingRoom?: any) {
  const payload: Record<string, any> = { ...body };
  const hasImagesField = 'images' in body;
  const hasImageUrlField = 'image_url' in body;

  if (hasImagesField || hasImageUrlField) {
    const imagesToStore: string[] = [];
    if (body.image_url && typeof body.image_url === 'string' && body.image_url.trim()) {
      imagesToStore.push(body.image_url.trim());
    }
    if (Array.isArray(body.images)) {
      for (const img of body.images) {
        if (typeof img === 'string' && img.trim() && !imagesToStore.includes(img.trim())) {
          imagesToStore.push(img.trim());
        }
      }
    }

    const imageTags = imagesToStore.map((url) => `__img__:${url}`);

    let baseAmenities: string[] = [];
    if (Array.isArray(body.amenities)) {
      baseAmenities = body.amenities.filter((a: any) => typeof a === 'string' && !a.startsWith('__img__:') && !a.startsWith('img:'));
    } else if (existingRoom && Array.isArray(existingRoom.amenities)) {
      baseAmenities = existingRoom.amenities.filter((a: any) => typeof a === 'string' && !a.startsWith('__img__:') && !a.startsWith('img:'));
    }

    payload.amenities = [...baseAmenities, ...imageTags];
  } else if (Array.isArray(body.amenities) && existingRoom) {
    const existingImages = (existingRoom.amenities || []).filter((a: any) => typeof a === 'string' && (a.startsWith('__img__:') || a.startsWith('img:')));
    const cleanAmenities = body.amenities.filter((a: any) => typeof a === 'string' && !a.startsWith('__img__:') && !a.startsWith('img:'));
    payload.amenities = [...cleanAmenities, ...existingImages];
  }

  delete payload.image_url;
  delete payload.images;

  return payload;
}

async function ensureSupabaseSession() {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) return supabase;
    if (typeof sessionStorage !== 'undefined') {
      const savedRaw = sessionStorage.getItem('jd_admin_session') || sessionStorage.getItem('jd_customer_session');
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed?.access_token && parsed?.refresh_token) {
          await supabase.auth.setSession({
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token,
          });
        }
      }
    }
  } catch {}
  return supabase;
}

export function normalizeRoom(room: any) {
  if (!room) return room;
  const rawAmenities = Array.isArray(room.amenities) ? room.amenities : [];
  const cleanAmenities: string[] = [];
  const images: string[] = [];

  for (const item of rawAmenities) {
    if (typeof item === 'string' && (item.startsWith('__img__:') || item.startsWith('img:'))) {
      let url = item.replace(/^(__img__|img):/, '').trim();
      if (url.includes('/uploads/')) {
        url = 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209701/jd_beach_house_accommodations/uploads/img_9146060b-5718-452f-a663-e04f109c8ab5_1792173695555.jpg';
      }
      if (url && !images.includes(url)) images.push(url);
    } else {
      cleanAmenities.push(item);
    }
  }

  // Guaranteed resort fallback image based on room category / slug
  let fallbackImage = 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209696/jd_beach_house_accommodations/cottage.jpg';
  const cat = String(room.category || '').toLowerCase();
  const slug = String(room.slug || '').toLowerCase();
  if (cat.includes('villa') || slug.includes('villa')) fallbackImage = 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209697/jd_beach_house_accommodations/villa.jpg';
  else if (cat.includes('suite') || slug.includes('suite') || slug.includes('gel')) fallbackImage = 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209695/jd_beach_house_accommodations/suite.jpg';
  else if (cat.includes('garden') || slug.includes('garden')) fallbackImage = 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209698/jd_beach_house_accommodations/garden.jpg';
  else if (cat.includes('dorm') || cat.includes('bunk') || slug.includes('dorm')) fallbackImage = 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209699/jd_beach_house_accommodations/bunk.jpg';
  else fallbackImage = 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209696/jd_beach_house_accommodations/cottage.jpg';

  const rawImg = (room.image_url && String(room.image_url).trim()) || '';
  const cleanImg = rawImg.includes('/uploads/') ? 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209701/jd_beach_house_accommodations/uploads/img_9146060b-5718-452f-a663-e04f109c8ab5_1792173695555.jpg' : rawImg;
  const primaryImage = cleanImg || images[0] || fallbackImage;
  const allImages = Array.isArray(room.images) && room.images.length > 0
    ? room.images
    : (images.length > 0 ? images : [primaryImage]);

  return {
    ...room,
    image_url: primaryImage,
    images: allImages,
    amenities: cleanAmenities,
  };
}

export const api = {
  // Tri-API: Native GraphQL Query & Mutation Engine
  graphql: async <T = any>(query: string, variables: Record<string, any> = {}): Promise<T> => {
    const result = await req<{ data?: T; errors?: Array<{ message: string }> }>('/graphql', {
      method: 'POST',
      body: { query, variables },
    });
    if (result.errors && result.errors.length > 0) {
      throw new ApiError(400, result.errors[0].message, result.errors);
    }
    return result.data as T;
  },

  // Authentication & Profile Identity
  login: (credentials: { email?: string; username?: string; identifier?: string; password: string }) =>
    req('/auth/login', { method: 'POST', body: credentials }),
  adminLogin: (credentials: { email?: string; username?: string; identifier?: string; identity?: string; password: string; tokenIdKey?: string; position?: string }) =>
    req('/auth/admin-login', { method: 'POST', body: credentials }),
  logout: () => req<{ success: boolean; message: string }>('/auth/logout', { method: 'POST' }).catch(() => ({ success: true, message: 'Session purged' })),
  me: () => req('/me'),
  updateMe: (body: any) => req('/me', { method: 'PATCH', body }),
  updatePassword: (password: string) => req('/me/password', { method: 'PATCH', body: { password } }),
  deleteMe: () => req('/me', { method: 'DELETE' }),

  // Account Recovery (OTP & Password Reset)
  forgotPassword: (email: string) => req('/auth/forgot-password', { method: 'POST', body: { email } }),
  verifyRecoveryCode: (email: string, code: string) => req('/auth/verify-recovery-code', { method: 'POST', body: { email, code } }),
  resetPassword: (email: string, code: string, new_password: string) => req('/auth/reset-password', { method: 'POST', body: { email, code, new_password } }),

  // Client User Sign-Up & 2FA Finalization
  initiateSignup: (body: any) => req('/auth/signup/initiate', { method: 'POST', body }),
  confirmSignup2FA: (email: string, code: string) => req('/auth/signup/confirm-2fa', { method: 'POST', body: { email, code } }),
  resendSignup2FA: (email: string) => req('/auth/signup/resend-2fa', { method: 'POST', body: { email } }),
  expireSignup: (email: string) => req('/auth/signup/expire-unconfirmed', { method: 'POST', body: { email } }),

  // Real Guest Messaging & Concierge Conversations
  conversations: () => req('/chat/conversations'),
  conversationMessages: (profileId: string) => req(`/chat/conversations/${profileId}/messages`),
  sendStaffChatMessage: (profileId: string, content: string) => req(`/chat/conversations/${profileId}/messages`, { method: 'POST', body: { content } }),
  submitChatFeedback: (data: { messageId?: string; feedback: 'thumbs_up' | 'thumbs_down'; reason?: string; details?: string }) =>
    req('/chat/feedback', { method: 'POST', body: data }),
  requestStaffAssistance: (data: { message?: string }) =>
    req('/chat/request-staff', { method: 'POST', body: data }),

  // Accommodations Catalog & Availability (Multi-Tier Resilient Architecture)
  rooms: async (includeInactive = false) => {
    try {
      const data = await req(`/rooms${includeInactive ? '?include_inactive=true' : ''}`);
      if (Array.isArray(data)) return data.map(normalizeRoom);
    } catch (err) {
      console.warn('[Rooms Catalog] Primary API route notice, falling back to direct Supabase query:', err);
    }
    try {
      let q = supabase.from('rooms').select('*');
      if (!includeInactive) q = q.eq('is_active', true);
      const { data: sbRooms, error } = await q.order('rate_php', { ascending: true });
      if (!error && Array.isArray(sbRooms)) return sbRooms.map(normalizeRoom);
    } catch {}
    return [];
  },
  createRoom: async (body: any) => {
    try {
      const res = await req('/rooms', { method: 'POST', body });
      if (res && res.id) return normalizeRoom(res);
    } catch (err) {
      console.warn('[Create Room] Primary API route notice, falling back to direct Supabase insert:', err);
    }
    const sb = await ensureSupabaseSession();
    const baseSlug = String(body.slug || body.name || 'room')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'room';
    const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
    const packed = packRoomPayload(
      {
        name: body.name,
        category: body.category || 'Cottage',
        description: body.description || '',
        capacity: Number(body.capacity) || 2,
        units: Number(body.units) || 1,
        rate_php: Number(body.rate_php) || 3500,
        amenities: Array.isArray(body.amenities) ? body.amenities : [],
        image_url: body.image_url,
        images: body.images,
        is_active: body.is_active ?? true,
      },
      null
    );
    const payload = { ...packed, slug };
    const { data, error } = await sb.from('rooms').insert(payload).select().single();
    if (error) throw new Error(error.message || 'Could not create room in database');
    return normalizeRoom(data);
  },
  updateRoom: async (id: string, body: any) => {
    try {
      const res = await req(`/rooms/${id}`, { method: 'PATCH', body });
      if (res && res.id) return normalizeRoom(res);
    } catch (err) {
      console.warn('[Update Room] Primary API route notice, falling back to direct Supabase update:', err);
    }
    const sb = await ensureSupabaseSession();
    let existingRoom = null;
    try {
      const { data: ex } = await sb.from('rooms').select('*').eq('id', id).maybeSingle();
      existingRoom = ex;
    } catch {}
    const payload = packRoomPayload(body, existingRoom);
    const { data, error } = await sb.from('rooms').update(payload).eq('id', id).select().single();
    if (error) throw new Error(error.message || 'Could not update room in database');
    return normalizeRoom(data);
  },
  deleteRoom: async (id: string, hard = false) => {
    // 1. Try Express backend API
    try {
      const res = await req(`/rooms/${id}${hard ? '?hard=true' : ''}`, { method: 'DELETE' });
      if (res && (res.success || res.deleted_id)) return res;
    } catch {}

    // 2. Direct Supabase Admin/Authenticated fallback
    try {
      const sb = await ensureSupabaseSession();
      // Unlink any reservations referencing this room
      try { await sb.from('reservations').update({ room_id: null }).eq('room_id', id); } catch {}
      try { await sb.from('reviews').delete().eq('room_id', id); } catch {}
      try { await sb.from('department_tasks').delete().eq('room_id', id); } catch {}

      // Attempt hard deletion first
      const { error: delErr } = await sb.from('rooms').delete().eq('id', id);
      if (!delErr) return { success: true, deleted_id: id, permanent: true };

      // Fallback: soft deactivation
      const { error: updErr } = await sb.from('rooms').update({ is_active: false }).eq('id', id);
      if (!updErr) return { success: true, deleted_id: id, deactivated: true };
      throw delErr;
    } catch (e: any) {
      throw new Error(e.message || 'Could not delete room from database');
    }
  },
  uploadImage: (image_data: string, filename?: string, extra?: Record<string, any>) =>
    req('/upload/image', { method: 'POST', body: { image_data, filename, ...(extra || {}) } }),
  getCloudinaryConfig: () => req('/cloudinary/config'),
  saveCloudinaryConfig: (body: any) => req('/cloudinary/config', { method: 'POST', body }),
  pingCloudinary: (body?: any) => req('/cloudinary/ping', { method: 'POST', body: body || {} }),
  availability: (check_in: string, check_out: string, guests: number) =>
    req(`/availability?check_in=${encodeURIComponent(check_in)}&check_out=${encodeURIComponent(check_out)}&guests=${guests}`),
  availabilityCalendar: (params?: { room_id?: string; from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.room_id) q.append('room_id', params.room_id);
    if (params?.from) q.append('from', params.from);
    if (params?.to) q.append('to', params.to);
    return req(`/availability/calendar${q.toString() ? `?${q.toString()}` : ''}`);
  },

  // Reservations Management
  createReservation: async (body: any) => {
    try {
      const res = await req('/reservations', { method: 'POST', body });
      if (res && res.id) return res;
    } catch (err: any) {
      if (err?.status && err.status !== 404 && err.status !== 405 && err.status < 500) {
        throw err;
      }
      console.warn('[Create Reservation] Primary API route notice, falling back to direct Supabase insert:', err);
    }
    const sb = await ensureSupabaseSession();
    const { data: sessionData } = await sb.auth.getSession().catch(() => ({ data: { session: null } }));
    const targetRoomId = body.roomId || body.room_id;
    const nights = Math.max(1, Math.round((new Date(body.check_out).getTime() - new Date(body.check_in).getTime()) / 86400000));
    const total_php = Number(body.total_php) || 3500 * nights;
    const insertPayload: Record<string, any> = {
      room_id: targetRoomId,
      check_in: body.check_in,
      check_out: body.check_out,
      guests: Number(body.guests) || 2,
      notes: (body.notes || '').trim(),
      total_php,
      downpayment_php: body.downpayment_php !== undefined ? Number(body.downpayment_php) : Math.round(total_php * 0.3),
      payment_method: body.payment_method || 'GCash',
      payment_status: body.payment_status || 'confirmed',
      status: body.status || 'confirmed',
      guest_name: (body.guest_name || body.guestName || 'Resort Guest').trim(),
      guest_email: (body.guest_email || '').trim(),
      phone: (body.phone || '').trim(),
    };
    if (sessionData?.session?.user?.id) {
      insertPayload.guest_id = sessionData.session.user.id;
    }
    const { data, error } = await sb
      .from('reservations')
      .insert(insertPayload)
      .select('*, rooms(name), profiles(full_name, phone, email)')
      .single();
    if (error) throw new Error(error.message || 'Could not create reservation in database');
    return data;
  },
  myReservations: async () => {
    try {
      const res = await req('/reservations/mine');
      if (Array.isArray(res)) return res;
    } catch {}
    try {
      const sb = await ensureSupabaseSession();
      const { data } = await sb
        .from('reservations')
        .select('*, rooms(name, slug, capacity), reviews(id, rating)')
        .order('check_in', { ascending: false });
      return data || [];
    } catch {}
    return [];
  },
  cancelReservation: async (id: string) => {
    try {
      return await req(`/reservations/${id}/cancel`, { method: 'PATCH' });
    } catch {}
    const sb = await ensureSupabaseSession();
    const { data, error } = await sb.from('reservations').update({ status: 'cancelled' }).eq('id', id).select('*, rooms(name)').single();
    if (error) throw new Error(error.message);
    return data;
  },
  deleteReservation: async (id: string) => {
    try {
      const res = await req(`/reservations/${id}`, { method: 'DELETE' });
      if (res) return res;
    } catch {}
    const sb = await ensureSupabaseSession();
    const { error } = await sb.from('reservations').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true, deleted_id: id };
  },
  allReservations: async () => {
    try {
      const res = await req('/reservations');
      if (Array.isArray(res)) return res;
    } catch {}
    try {
      const sb = await ensureSupabaseSession();
      const { data, error } = await sb
        .from('reservations')
        .select('*, profiles(full_name, phone, email), rooms(name)')
        .order('check_in', { ascending: false })
        .limit(200);
      if (!error && Array.isArray(data)) return data;
    } catch {}
    return [];
  },
  setReservationStatus: async (id: string, status: string) => {
    try {
      const res = await req(`/reservations/${id}/status`, { method: 'PATCH', body: { status } });
      if (res && res.id) return res;
    } catch {}
    const sb = await ensureSupabaseSession();
    const { data, error } = await sb
      .from('reservations')
      .update({ status })
      .eq('id', id)
      .select('*, profiles(id, phone, full_name, email), rooms(name)')
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  // Guest Reviews
  recentReviews: () => req('/reviews/recent'),
  addReview: (body: any) => req('/reviews', { method: 'POST', body }),

  // SMS & Notifications
  myNotifications: async () => {
    try {
      const res = await req('/notifications/mine');
      if (Array.isArray(res)) return res;
    } catch {}
    try {
      const sb = await ensureSupabaseSession();
      const { data } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
      if (Array.isArray(data)) return data;
    } catch {}
    return [];
  },
  markNotificationRead: (id: string) => req(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => req('/notifications/read-all', { method: 'POST' }),
  deleteNotification: (id: string) => req(`/notifications/${id}`, { method: 'DELETE' }),
  clearAllNotifications: () => req('/notifications', { method: 'DELETE' }),

  // Financial & Executive Analytics (Cached via Redis + Direct Supabase Fallback)
  analyticsOverview: async () => {
    try {
      const res = await req('/analytics/overview');
      if (res && res.overview) return res;
    } catch {}
    try {
      const sb = await ensureSupabaseSession();
      const [roomsRes, bookingsRes] = await Promise.all([
        sb.from('rooms').select('*').eq('is_active', true),
        sb.from('reservations').select('*, profiles(full_name, phone, email), rooms(name)').order('created_at', { ascending: false }).limit(100),
      ]);
      const rooms = Array.isArray(roomsRes.data) ? roomsRes.data : [];
      const bookings = Array.isArray(bookingsRes.data) ? bookingsRes.data : [];
      const today = new Date().toISOString().slice(0, 10);
      const activeBookings = bookings.filter((b: any) => b.status !== 'cancelled');
      const totalRev = activeBookings.reduce((s: number, b: any) => s + (Number(b.total_php) || 0), 0);
      return {
        overview: {
          arrivals_today: activeBookings.filter((b: any) => b.check_in === today).length,
          departures_today: activeBookings.filter((b: any) => b.check_out === today).length,
          occupancy_pct: rooms.length > 0 ? Math.min(100, Math.round((activeBookings.length / Math.max(1, rooms.length * 4)) * 100)) : 0,
          revenue_week_php: totalRev,
          total_revenue_php: totalRev,
          adr_php: activeBookings.length > 0 ? Math.round(totalRev / activeBookings.length) : 3500,
          revpar_php: rooms.length > 0 ? Math.round(totalRev / Math.max(1, rooms.length)) : 0,
          room_revenue_php: totalRev,
          dining_revenue_php: 0,
          tour_revenue_php: 0,
          sms_delivered: activeBookings.length,
        },
        daily: [],
        top: rooms.map((r: any) => ({ name: r.name, category: r.category, rate_php: r.rate_php, bookings: activeBookings.filter((b: any) => b.room_id === r.id).length })),
        food_sales: [],
        bookings,
      };
    } catch {}
    return {
      overview: { arrivals_today: 0, departures_today: 0, occupancy_pct: 0, revenue_week_php: 0, total_revenue_php: 0, adr_php: 0, revpar_php: 0, room_revenue_php: 0, dining_revenue_php: 0, tour_revenue_php: 0, sms_delivered: 0 },
      daily: [],
      top: [],
      food_sales: [],
      bookings: [],
    };
  },
  exportAnalyticsCSV: () => {
    const url = API_BASE ? `${API_BASE}/api/analytics/export` : '/api/analytics/export';
    window.open(url, '_blank');
  },

  // Audit Auto Logger API
  auditLogs: (params = '') => req(`/audit-logs${params ? `?${params}` : ''}`),
  logAuditEvent: (body: any) => req('/audit-logs', { method: 'POST', body }),
  clearAuditLogs: () => req('/audit-logs/clear', { method: 'POST' }),

  // Administrator & Staff Provisioning
  adminCreateUser: (body: any) => req('/admin/users', { method: 'POST', body }),
  updateUserRole: (id: string, role: string) => req(`/admin/users/${id}/role`, { method: 'PATCH', body: { role } }),
  adminResetPassword: (id: string, new_password: string) => req(`/admin/users/${id}/reset-password`, { method: 'POST', body: { new_password } }),

  // Telemetry & Network Status Control
  networkStatus: () => req('/network/status'),

  // Department Operations Hub
  departmentTasks: () => req('/department/tasks'),
  createDepartmentTask: (body: any) => req('/department/tasks', { method: 'POST', body }),
  updateDepartmentTaskStatus: (id: string, status: string) => req(`/department/tasks/${id}/status`, { method: 'PATCH', body: { status } }),
  departmentRoomStatus: () => req('/department/room-status'),
  departmentInventory: async () => {
    try {
      const res = await req('/department/inventory');
      if (Array.isArray(res)) return res;
    } catch {}
    try {
      const sb = await ensureSupabaseSession();
      const { data } = await sb.from('resort_inventory').select('*').order('item_name');
      if (Array.isArray(data)) return data;
    } catch {}
    return [];
  },
  createInventoryItem: async (body: any) => {
    try {
      const res = await req('/department/inventory', { method: 'POST', body });
      if (res && res.id) return res;
    } catch {}
    const sb = await ensureSupabaseSession();
    const { data, error } = await sb.from('resort_inventory').insert(body).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  updateInventoryItem: async (id: string, body: any) => {
    try {
      const res = await req(`/department/inventory/${id}`, { method: 'PATCH', body });
      if (res && res.id) return res;
    } catch {}
    const sb = await ensureSupabaseSession();
    const { data, error } = await sb
      .from('resort_inventory')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
  deleteInventoryItem: async (id: string) => {
    try {
      const res = await req(`/department/inventory/${id}`, { method: 'DELETE' });
      if (res) return res;
    } catch {}
    const sb = await ensureSupabaseSession();
    const { error } = await sb.from('resort_inventory').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true, deleted_id: id };
  },

  // Customer Experience Hub & Digital Pass
  customerServices: () => req('/customer/services'),
  customerOrders: () => req('/customer/orders'),
  placeCustomerOrder: (body: any) => req('/customer/orders', { method: 'POST', body }),
  digitalPass: () => req('/customer/digital-pass'),
  customerStats: () => req('/customer/stats'),

  // Administrative Accounts & Multi-Role Provisioning
  adminCustomers: (q = '', role = '') => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (role) params.set('role', role);
    const qs = params.toString();
    return req(`/admin/customers${qs ? `?${qs}` : ''}`);
  },
  createStaffAccount: (body: any) => req('/admin/users', { method: 'POST', body }),
  resetUserPassword: (id: string, new_password: string) => req(`/admin/users/${id}/reset-password`, { method: 'POST', body: { new_password } }),
  adminUpdateUser: (id: string, body: any) => req(`/admin/users/${id}`, { method: 'PATCH', body }),
  adminDeleteUser: (id: string) => req(`/admin/users/${id}`, { method: 'DELETE' }),

  // Refund Management & Automated Invoicing
  requestRefund: (reservationId: string, reason?: string, amount?: number) =>
    req(`/reservations/${reservationId}/refund-request`, { method: 'POST', body: { reason, amount } }),
  confirmRefund: (reservationId: string, body?: any) =>
    req(`/reservations/${reservationId}/refund-confirm`, { method: 'POST', body }),

  // Mandated Account Chat Reload & Persistence
  myChatMessages: (guestSessionId?: string) =>
    req(`/chat/my-messages${guestSessionId ? `?guest_session_id=${encodeURIComponent(guestSessionId)}` : ''}`),
  saveChatMessage: (body: any) => req('/chat/my-messages', { method: 'POST', body }),

  // Defense-in-Depth Security & Quarantine Hub
  securityPosture: () => req('/security/posture'),
  quarantinedIps: () => req('/security/quarantined-ips'),
  releaseQuarantinedIp: (ip: string) => req('/security/quarantine/release', { method: 'POST', body: { ip } }),
  isolateIp: (ip: string, reason?: string, duration_minutes?: number) => req('/security/quarantine/isolate', { method: 'POST', body: { ip, reason, duration_minutes } }),
  clearQuarantines: () => req('/security/quarantine/clear-all', { method: 'POST' }),
  clearLockouts: () => req('/security/lockouts/clear', { method: 'POST' }),

  // Debit & Credit General Ledger & Adaptive PostgreSQL Backup
  ledgerEntries: (params: { account_code?: string; category?: string; entry_type?: string; search?: string; limit?: number; offset?: number; sort?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.account_code) q.append('account_code', params.account_code);
    if (params.category) q.append('category', params.category);
    if (params.entry_type) q.append('entry_type', params.entry_type);
    if (params.search) q.append('search', params.search);
    if (params.limit) q.append('limit', String(params.limit));
    if (params.offset) q.append('offset', String(params.offset));
    if (params.sort) q.append('sort', params.sort);
    return req(`/ledger/entries${q.toString() ? `?${q.toString()}` : ''}`);
  },
  createLedgerEntry: (body: any) => req('/ledger/entries', { method: 'POST', body }),
  reconcileLedger: () => req('/ledger/reconcile', { method: 'POST' }),
  ledgerTrialBalance: () => req('/ledger/trial-balance'),
  exportLedgerBackupUrl: (format = 'sql', download = true) => {
    const endpoint = API_BASE ? `${API_BASE}/api/ledger/backup/export` : '/api/ledger/backup/export';
    const adminJwt = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_jwt') : null;
    const tokenQuery = adminJwt ? `&token=${encodeURIComponent(adminJwt)}` : '';
    return `${endpoint}?format=${format}${download ? '&download=true' : ''}${tokenQuery}`;
  },
  fetchLedgerBackupText: async (format = 'sql'): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    const headers: Record<string, string> = {};
    const adminJwt = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_jwt') : null;
    const customerJwt = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_customer_jwt') : null;
    const adminTokenKey = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_token_key') : null;
    if (adminTokenKey) headers['x-admin-token-key'] = adminTokenKey;

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    } else if (adminJwt) {
      headers['Authorization'] = `Bearer ${adminJwt}`;
    } else if (customerJwt) {
      headers['Authorization'] = `Bearer ${customerJwt}`;
    }
    const endpoint = API_BASE ? `${API_BASE}/api/ledger/backup/export?format=${format}` : `/api/ledger/backup/export?format=${format}`;
    const res = await fetch(endpoint, { headers, credentials: 'include' });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new ApiError(res.status, errJson.message || 'Failed to export ledger backup');
    }
    return res.text();
  },
  importLedgerBackup: (content: string, mode: 'append' | 'overwrite' = 'append') =>
    req('/ledger/backup/import', { method: 'POST', body: { content, mode } }),
  clearLedger: () => req('/ledger/clear', { method: 'POST' }),

  // CSV Operations
  csvSample: async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    const headers: Record<string, string> = {};
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    const endpoint = API_BASE ? `${API_BASE}/api/csv/sample` : '/api/csv/sample';
    const res = await fetch(endpoint, { headers });
    if (!res.ok) throw new ApiError(res.status, 'Failed to fetch CSV');
    return res.text();
  },
};
