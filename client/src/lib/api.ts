import { supabase } from './supabaseClient.js';

// MOCK FALLBACK DATASETS WHEN BACKEND IS ABSENT OR OFFLINE
const FALLBACK_ROOMS = [
  { id: '1', name: 'Habagat Sea-View Suite', slug: 'habagat-suite', category: 'Suite', description: 'Front suite with private balcony hanging over the turquoise ocean.', capacity: 3, units: 4, rate_php: 2950, rating_avg: 4.9, rating_count: 38, amenities: ['AC', 'Sea view', 'Balcony', 'Breakfast'] },
  { id: '2', name: 'Nipa Cove Cottage', slug: 'nipa-cove', category: 'Cottage', description: 'Native nipa cottage steps from the sand with fan cooling and hammock porch.', capacity: 2, units: 6, rate_php: 1450, rating_avg: 4.8, rating_count: 52, amenities: ['Fan', 'Hot shower', 'WiFi', 'Porch'] },
  { id: '3', name: 'Duyan Family Villa', slug: 'duyan-villa', category: 'Villa', description: 'Two-bedroom family villa with private outdoor hammock deck & barbecue grill.', capacity: 6, units: 3, rate_php: 4800, rating_avg: 5.0, rating_count: 24, amenities: ['AC', 'Kitchenette', 'Grill deck', 'WiFi'] },
  { id: '4', name: 'Garden Breeze Room', slug: 'garden-breeze', category: 'Garden', description: 'Air-conditioned room looking out onto lush mango gardens.', capacity: 2, units: 8, rate_php: 1850, rating_avg: 4.9, rating_count: 41, amenities: ['AC', 'WiFi', 'Hot shower', 'Breakfast'] },
  { id: '5', name: 'Backpacker Bunk Suite', slug: 'backpacker-bunk', category: 'Dorm', description: 'Cozy air-conditioned shared bunk suite steps away from Tambak beach front.', capacity: 1, units: 12, rate_php: 750, rating_avg: 4.7, rating_count: 65, amenities: ['AC', 'Lockers', 'Shared Bath', 'WiFi'] },
];

export const FALLBACK_ANALYTICS = {
  overview: {
    arrivals_today: 4,
    departures_today: 3,
    occupancy_pct: 78,
    revenue_week_php: 148500,
    total_revenue_php: 245800,
    adr_php: 2250,
    revpar_php: 1530,
    room_revenue_php: 198000,
    dining_revenue_php: 32500,
    tour_revenue_php: 15300,
    sms_delivered: 142
  },
  daily: [
    { day: '2026-08-01', nights_sold: 14, is_forecast: false },
    { day: '2026-08-02', nights_sold: 16, is_forecast: false },
    { day: '2026-08-03', nights_sold: 15, is_forecast: false },
    { day: '2026-08-04', nights_sold: 18, is_forecast: false },
    { day: '2026-08-05', nights_sold: 17, is_forecast: true },
    { day: '2026-08-06', nights_sold: 19, is_forecast: true },
    { day: '2026-08-07', nights_sold: 20, is_forecast: true }
  ],
  top: [
    { id: '1', name: 'Habagat Sea-View Suite', stays: 38 },
    { id: '2', name: 'Nipa Cove Cottage', stays: 52 },
    { id: '3', name: 'Duyan Family Villa', stays: 24 },
    { id: '4', name: 'Garden Breeze Room', stays: 41 }
  ],
  food_sales: [
    { id: 'f1', name: 'Grilled Bolinao Bangus Feast', category: 'Seafood', orders: 142, revenue_php: 63900, trend: 'popular', growth: '+24%' },
    { id: 'f2', name: 'Fresh Buko Juice & Watermelon', category: 'Beverages', orders: 218, revenue_php: 39240, trend: 'popular', growth: '+31%' },
    { id: 'f3', name: 'Patar Seafood Sinigang Platter', category: 'Platters', orders: 86, revenue_php: 55900, trend: 'trending', growth: '+18%' },
    { id: 'f4', name: 'Garlic Butter Beach Shrimps', category: 'Seafood', orders: 110, revenue_php: 57200, trend: 'trending', growth: '+15%' },
    { id: 'f5', name: 'Crispy Pork Bagnet & Sauce', category: 'Snacks', orders: 94, revenue_php: 35720, trend: 'steady', growth: '+8%' },
  ],
  bookings: [
    {
      id: 'res-101',
      check_in: '2026-08-04',
      check_out: '2026-08-07',
      total_php: 8850,
      status: 'confirmed',
      profiles: { full_name: 'Juan Dela Cruz', phone: '+63 917 555 0192' },
      rooms: { name: 'Habagat Sea-View Suite' }
    },
    {
      id: 'res-102',
      check_in: '2026-08-04',
      check_out: '2026-08-06',
      total_php: 2900,
      status: 'checked_in',
      profiles: { full_name: 'Maria Clara Santos', phone: '+63 918 222 4910' },
      rooms: { name: 'Nipa Cove Cottage' }
    },
    {
      id: 'res-103',
      check_in: '2026-08-05',
      check_out: '2026-08-08',
      total_php: 14400,
      status: 'confirmed',
      profiles: { full_name: 'Carlos Mendoza', phone: '+63 920 888 1234' },
      rooms: { name: 'Duyan Family Villa' }
    }
  ]
};

const FALLBACK_USERS = [
  { id: 'usr-1', full_name: 'Johannes Von Shicksal', phone: '+63 900 555 0001', address: 'Tambak Beach Road', city: 'Bolinao', stays_count: 0, orders_count: 0, total_spent_php: 0, role: 'administrator' },
  { id: 'usr-2', full_name: 'Elena Santos Ramos', phone: '+63 900 555 0002', address: 'Patar Road', city: 'Bolinao', stays_count: 0, orders_count: 0, total_spent_php: 0, role: 'receptionist' },
  { id: 'usr-3', full_name: 'Carlos Mendoza Ledger', phone: '+63 900 555 0003', address: 'Town Center', city: 'Bolinao', stays_count: 0, orders_count: 0, total_spent_php: 0, role: 'accounting' },
  { id: 'usr-4', full_name: 'Juan Dela Cruz', phone: '+63 917 555 0192', address: 'Session Road', city: 'Baguio City', stays_count: 3, orders_count: 5, total_spent_php: 14750, role: 'customer' },
  { id: 'usr-5', full_name: 'Maria Clara Santos', phone: '+63 918 222 4910', address: 'Ayala Avenue', city: 'Makati City', stays_count: 2, orders_count: 3, total_spent_php: 7200, role: 'customer' }
];

const FALLBACK_PASS = {
  active: true,
  room_name: 'Habagat Sea-View Suite',
  check_in: '2026-08-04',
  check_out: '2026-08-07',
  pass_code: 'JD-8842-KEY',
  rfid_key: 'RFID-SEA-04'
};

const FALLBACK_SERVICES = [
  { id: 'svc-1', name: 'Grilled Bolinao Bangus Feast', category: 'Kitchen & Dining', price_php: 450, icon: '🐟' },
  { id: 'svc-2', name: 'Fresh Buko Juice & Watermelon', category: 'Kitchen & Dining', price_php: 180, icon: '🥥' },
  { id: 'svc-3', name: 'Guided Patar Outrigger Tour', category: 'Tours & Island', price_php: 1200, icon: '⛵' },
  { id: 'svc-4', name: 'Sunset Beach Hammock Setup', category: 'Concierge', price_php: 0, icon: '🌅' }
];

const FALLBACK_ORDERS = [
  { id: 'ord-1', category: 'Kitchen & Dining', item_name: 'Grilled Bolinao Bangus Feast', price_php: 450, status: 'delivered', created_at: new Date().toISOString() },
  { id: 'ord-2', category: 'Concierge', item_name: 'Sunset Beach Hammock Setup', price_php: 0, status: 'in_progress', created_at: new Date().toISOString() }
];

const FALLBACK_TASKS = [
  { id: 'tsk-1', department: 'housekeeping', title: 'Turn-down service & fresh linen', room_name: 'Habagat Sea-View Suite', priority: 'high', assigned_to: 'Maria', status: 'in_progress', created_at: new Date().toISOString() },
  { id: 'tsk-2', department: 'kitchen', title: 'Prepare 4x Grilled Bangus breakfasts', room_name: 'Duyan Family Villa', priority: 'normal', assigned_to: 'Chef Lito', status: 'pending', created_at: new Date().toISOString() },
  { id: 'tsk-3', department: 'tours', title: 'Outrigger boat safety inspection', room_name: 'Patar Wharf', priority: 'normal', assigned_to: 'Kuya Ben', status: 'completed', created_at: new Date().toISOString() }
];

const FALLBACK_ROOM_STATUS = [
  { id: 'rm-1', name: 'Habagat Sea-View Suite', category: 'Suite', occupied_units: 3, units: 4, housekeeping_status: 'clean_ready' },
  { id: 'rm-2', name: 'Nipa Cove Cottage', category: 'Cottage', occupied_units: 4, units: 6, housekeeping_status: 'turn_down' },
  { id: 'rm-3', name: 'Duyan Family Villa', category: 'Villa', occupied_units: 2, units: 3, housekeeping_status: 'clean_ready' },
  { id: 'rm-4', name: 'Garden Breeze Room', category: 'Garden', occupied_units: 5, units: 8, housekeeping_status: 'clean_ready' }
];

const FALLBACK_INVENTORY = [
  { id: 'inv-1', item_name: 'Linen Bedsheets & Pillowcases', category: 'housekeeping', stock_qty: 45, unit: 'sets', reorder_at: 15 },
  { id: 'inv-2', item_name: 'Fresh Bolinao Bangus Fish', category: 'kitchen', stock_qty: 28, unit: 'kg', reorder_at: 10 },
  { id: 'inv-3', item_name: 'Outrigger Life Vests', category: 'tours', stock_qty: 22, unit: 'pcs', reorder_at: 10 },
  { id: 'inv-4', item_name: 'Beach Lantern Fuel Oil', category: 'maintenance', stock_qty: 4, unit: 'liters', reorder_at: 5 }
];

const FALLBACK_REVIEWS = [
  { id: 'rev-1', rating: 5, comment: 'The sunset from the Habagat Suite balcony is magical. Best bangus breakfast in Pangasinan!', profiles: { full_name: 'Juan Dela Cruz' }, rooms: { name: 'Habagat Sea-View Suite' } },
  { id: 'rev-2', rating: 5, comment: 'Quiet beach, cold breeze, and lantern lights at night. We will definitely come back.', profiles: { full_name: 'Maria Clara Santos' }, rooms: { name: 'Nipa Cove Cottage' } },
  { id: 'rev-3', rating: 5, comment: 'Excellent staff assistance and fast SMS notifications for every request.', profiles: { full_name: 'Carlos Mendoza' }, rooms: { name: 'Duyan Family Villa' } }
];

async function req(path, { method = 'GET', body, fallback } = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: {} }));
    const res = await fetch(`/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      if (fallback !== undefined) return fallback;
      const e = await res.json().catch(() => ({}));
      throw new Error(e.message || `Request failed (${res.status})`);
    }
    return res.status === 204 ? null : res.json();
  } catch (err) {
    if (fallback !== undefined) {
      console.warn(`[J & D Beach House API Fallback] Serving mock data for /api${path}:`, err.message);
      return fallback;
    }
    throw err;
  }
}

export const api = {
  me: () => req('/me'),
  updateMe: (b) => req('/me', { method: 'PATCH', body: b }),
  updatePassword: (password) => req('/me/password', { method: 'PATCH', body: { password } }),
  rooms: () => req('/rooms', { fallback: FALLBACK_ROOMS }),
  availability: (check_in, check_out, guests) =>
    req(`/availability?check_in=${check_in}&check_out=${check_out}&guests=${guests}`, { fallback: FALLBACK_ROOMS }),
  createReservation: (b) => req('/reservations', { method: 'POST', body: b, fallback: { id: 'res-new', rooms: { name: 'Habagat Sea-View Suite' }, check_in: b.check_in, check_out: b.check_out, total_php: 8850 } }),
  myReservations: () => req('/reservations/mine', { fallback: FALLBACK_ANALYTICS.bookings }),
  cancelReservation: (id) => req(`/reservations/${id}/cancel`, { method: 'PATCH', fallback: { id, status: 'cancelled' } }),
  allReservations: () => req('/reservations', { fallback: FALLBACK_ANALYTICS.bookings }),
  setReservationStatus: (id, status) => req(`/reservations/${id}/status`, { method: 'PATCH', body: { status }, fallback: { id, status } }),
  recentReviews: () => req('/reviews/recent', { fallback: FALLBACK_REVIEWS }),
  addReview: (b) => req('/reviews', { method: 'POST', body: b }),
  myNotifications: () => req('/notifications/mine', { fallback: [{ id: 'nt-1', status: 'sent', body: 'Welcome to J & D Beach House! Check-in keycode sent to your phone.', created_at: new Date().toISOString() }] }),
  analyticsOverview: () => req('/analytics/overview', { fallback: FALLBACK_ANALYTICS }),
  fullDiveAnalytics: (range = '30d') => req(`/analytics/full-dive?range=${range}`, { fallback: FALLBACK_ANALYTICS }),
  exportAnalyticsCSV: () => window.open('/api/analytics/export', '_blank'),

  // Telemetry Tracking & Predictive Occupancy Forecasts
  telemetryStats: () => req('/telemetry/stats', { fallback: { total_pings: 1482, active_users: 12 } }),
  telemetryPredictions: (scenario = 'normal') => req(`/telemetry/predictions?scenario=${scenario}`, { fallback: FALLBACK_ANALYTICS.daily }),

  // Department Operations Hub
  departmentTasks: () => req('/department/tasks', { fallback: FALLBACK_TASKS }),
  createDepartmentTask: (b) => req('/department/tasks', { method: 'POST', body: b, fallback: { id: `tsk-${Date.now()}`, ...b, status: 'pending', created_at: new Date().toISOString() } }),
  updateDepartmentTaskStatus: (id, status) => req(`/department/tasks/${id}/status`, { method: 'PATCH', body: { status }, fallback: { id, status } }),
  departmentRoomStatus: () => req('/department/room-status', { fallback: FALLBACK_ROOM_STATUS }),
  departmentInventory: () => req('/department/inventory', { fallback: FALLBACK_INVENTORY }),

  // Customer Experience Hub & Stats
  customerServices: () => req('/customer/services', { fallback: FALLBACK_SERVICES }),
  customerOrders: () => req('/customer/orders', { fallback: FALLBACK_ORDERS }),
  placeCustomerOrder: (b) => req('/customer/orders', { method: 'POST', body: b, fallback: { id: `ord-${Date.now()}`, ...b, status: 'in_progress', created_at: new Date().toISOString() } }),
  digitalPass: () => req('/customer/digital-pass', { fallback: FALLBACK_PASS }),
  customerStats: () => req('/customer/stats', { fallback: { stays_count: 3, orders_count: 5, active_orders_count: 1, total_spent_php: 14750 } }),

  // Administrative Accounts, Multi-Role Provisioning & Account Recovery
  adminCustomers: (q = '') => req(`/admin/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`, { fallback: FALLBACK_USERS }),
  createStaffAccount: (b) => req('/admin/users', { method: 'POST', body: b, fallback: { id: `usr-${Date.now()}`, ...b } }),
  updateUserRole: (id, role) => req(`/admin/users/${id}/role`, { method: 'PATCH', body: { role }, fallback: { id, role } }),
  resetUserPassword: (id, new_password) => req(`/admin/users/${id}/reset-password`, { method: 'POST', body: { new_password }, fallback: { success: true } }),
};
