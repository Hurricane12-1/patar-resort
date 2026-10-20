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
  createRoom: (body: any) => req('/rooms', { method: 'POST', body }),
  updateRoom: (id: string, body: any) => req(`/rooms/${id}`, { method: 'PATCH', body }),
  deleteRoom: async (id: string, hard = false) => {
    // 1. Try Express backend API
    try {
      const res = await req(`/rooms/${id}${hard ? '?hard=true' : ''}`, { method: 'DELETE' });
      if (res && (res.success || res.deleted_id)) return res;
    } catch {}

    // 2. Direct Supabase Admin/Authenticated fallback
    try {
      // Unlink any reservations referencing this room
      try { await supabase.from('reservations').update({ room_id: null }).eq('room_id', id); } catch {}
      try { await supabase.from('reviews').delete().eq('room_id', id); } catch {}
      try { await supabase.from('department_tasks').delete().eq('room_id', id); } catch {}

      // Attempt hard deletion first
      const { error: delErr } = await supabase.from('rooms').delete().eq('id', id);
      if (!delErr) return { success: true, deleted_id: id, permanent: true };

      // Fallback: soft deactivation
      const { error: updErr } = await supabase.from('rooms').update({ is_active: false }).eq('id', id);
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
  createReservation: (body: any) => req('/reservations', { method: 'POST', body }),
  myReservations: () => req('/reservations/mine'),
  cancelReservation: (id: string) => req(`/reservations/${id}/cancel`, { method: 'PATCH' }),
  deleteReservation: (id: string) => req(`/reservations/${id}`, { method: 'DELETE' }),
  allReservations: () => req('/reservations'),
  setReservationStatus: (id: string, status: string) => req(`/reservations/${id}/status`, { method: 'PATCH', body: { status } }),

  // Guest Reviews
  recentReviews: () => req('/reviews/recent'),
  addReview: (body: any) => req('/reviews', { method: 'POST', body }),

  // SMS & Notifications
  myNotifications: () => req('/notifications/mine'),
  markNotificationRead: (id: string) => req(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => req('/notifications/read-all', { method: 'POST' }),
  deleteNotification: (id: string) => req(`/notifications/${id}`, { method: 'DELETE' }),
  clearAllNotifications: () => req('/notifications', { method: 'DELETE' }),

  // Financial & Executive Analytics (Cached via Redis)
  analyticsOverview: () => req('/analytics/overview'),
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
