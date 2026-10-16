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

async function req<T = any>(path: string, { method = 'GET', body }: { method?: string; body?: any } = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const adminTokenKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('jd_admin_token_key') || 'etc-34') : 'etc-34';
  if (adminTokenKey) {
    headers['x-admin-token-key'] = adminTokenKey;
  }

  const adminJwt = typeof localStorage !== 'undefined' ? localStorage.getItem('jd_admin_jwt') : null;
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  } else if (adminJwt) {
    headers['Authorization'] = `Bearer ${adminJwt}`;
  }

  // Double-Submit CSRF Token Protection Header
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
    if (match && match[1]) {
      headers['X-CSRF-Token'] = decodeURIComponent(match[1]);
    }
  }

  const endpoint = API_BASE ? `${API_BASE}/api${path}` : `/api${path}`;
  const res = await fetch(endpoint, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorBody.message || errorBody.error || `HTTP ${res.status} error`, errorBody);
  }

  if (res.status === 204) {
    return null as T;
  }

  return res.json() as Promise<T>;
}

export function normalizeRoom(room: any) {
  if (!room) return room;
  const rawAmenities = Array.isArray(room.amenities) ? room.amenities : [];
  const cleanAmenities: string[] = [];
  const images: string[] = [];

  for (const item of rawAmenities) {
    if (typeof item === 'string' && (item.startsWith('__img__:') || item.startsWith('img:'))) {
      const url = item.replace(/^(__img__|img):/, '').trim();
      if (url && !images.includes(url)) images.push(url);
    } else {
      cleanAmenities.push(item);
    }
  }

  const primaryImage = room.image_url || images[0] || '';
  const allImages = Array.isArray(room.images) && room.images.length > 0
    ? room.images
    : (images.length > 0 ? images : (primaryImage ? [primaryImage] : []));

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
  login: (credentials: { email: string; password: string }) => req('/auth/login', { method: 'POST', body: credentials }),
  adminLogin: (credentials: { email?: string; identity?: string; password: string; tokenIdKey?: string; position?: string }) =>
    req('/auth/admin-login', { method: 'POST', body: credentials }),
  me: () => req('/me'),
  updateMe: (body: any) => req('/me', { method: 'PATCH', body }),
  updatePassword: (password: string) => req('/me/password', { method: 'PATCH', body: { password } }),

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
  createRoom: (body: any) => req('/rooms', { method: 'POST', body }),
  updateRoom: (id: string, body: any) => req(`/rooms/${id}`, { method: 'PATCH', body }),
  deleteRoom: (id: string, hard = false) => req(`/rooms/${id}${hard ? '?hard=true' : ''}`, { method: 'DELETE' }),
  uploadImage: (image_data: string, filename?: string) =>
    req('/upload/image', { method: 'POST', body: { image_data, filename } }),
  availability: (check_in: string, check_out: string, guests: number) =>
    req(`/availability?check_in=${encodeURIComponent(check_in)}&check_out=${encodeURIComponent(check_out)}&guests=${guests}`),

  // Reservations Management
  createReservation: (body: any) => req('/reservations', { method: 'POST', body }),
  myReservations: () => req('/reservations/mine'),
  cancelReservation: (id: string) => req(`/reservations/${id}/cancel`, { method: 'PATCH' }),
  allReservations: () => req('/reservations'),
  setReservationStatus: (id: string, status: string) => req(`/reservations/${id}/status`, { method: 'PATCH', body: { status } }),

  // Guest Reviews
  recentReviews: () => req('/reviews/recent'),
  addReview: (body: any) => req('/reviews', { method: 'POST', body }),

  // SMS & Notifications
  myNotifications: () => req('/notifications/mine'),

  // Financial & Executive Analytics (Cached via Redis)
  analyticsOverview: () => req('/analytics/overview'),
  exportAnalyticsCSV: () => {
    const url = API_BASE ? `${API_BASE}/api/analytics/export` : '/api/analytics/export';
    window.open(url, '_blank');
  },

  // Audit Auto Logger API
  auditLogs: (params = '') => req(`/audit-logs${params ? `?${params}` : ''}`),
  logAuditEvent: (body: any) => req('/audit-logs', { method: 'POST', body }),

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
  departmentInventory: () => req('/department/inventory'),
  createInventoryItem: (body: any) => req('/department/inventory', { method: 'POST', body }),
  updateInventoryItem: (id: string, body: any) => req(`/department/inventory/${id}`, { method: 'PATCH', body }),
  deleteInventoryItem: (id: string) => req(`/department/inventory/${id}`, { method: 'DELETE' }),

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
