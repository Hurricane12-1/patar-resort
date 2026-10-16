import { Router } from 'express';
import { asyncH } from '../middleware/errors.js';
import { authenticate, requireStaffOrAdmin } from '../middleware/auth.js';
import { admin } from '../lib/supabase.js';

const r = Router();

// In-memory telemetry buffer for real-time visitor tracking (capped to protect heap)
const MAX_LIVE_VISITORS = 10000;
const liveVisitors = new Map(); // sessionId -> timestamp
let lastCleanupTs = 0;

function cleanupStaleVisitors(force = false) {
  const now = Date.now();
  if (!force && now - lastCleanupTs < 10000) return; // Throttle cleanup to at most once every 10s
  lastCleanupTs = now;
  for (const [id, ts] of liveVisitors.entries()) {
    if (now - ts > 180000) liveVisitors.delete(id);
  }
}

r.post('/telemetry/ping', (req, res) => {
  const sessionId = req.body?.session_id || req.ip || `vis-${Math.random()}`;
  if (liveVisitors.size >= MAX_LIVE_VISITORS && !liveVisitors.has(sessionId)) {
    // Evict oldest visitor
    const oldestKey = liveVisitors.keys().next().value;
    if (oldestKey) liveVisitors.delete(oldestKey);
  }
  liveVisitors.set(sessionId, Date.now());
  cleanupStaleVisitors();

  res.json({ active_now: liveVisitors.size });
});

r.get('/telemetry/stats', asyncH(async (_req, res) => {
  cleanupStaleVisitors(true);

  const [checkedInRes, roomsRes] = await Promise.all([
    admin.from('reservations').select('guests').eq('status', 'checked_in'),
    admin.from('rooms').select('capacity, units').eq('is_active', true),
  ]);

  const checkedInGuests = (checkedInRes.data || []).reduce((acc, r) => acc + (r.guests || 1), 0);
  const totalCapacity = (roomsRes.data || []).reduce((acc, r) => acc + (r.capacity * r.units), 0);
  const densityPct = totalCapacity > 0 ? Math.min(100, Math.round((checkedInGuests / totalCapacity) * 100)) : 0;

  res.json({
    active_online_visitors: liveVisitors.size,
    unique_visitors_today: Math.max(liveVisitors.size, 1),
    checked_in_guests_on_grounds: checkedInGuests,
    occupancy_density_pct: densityPct,
    peak_visitor_hour: '2:00 PM - 5:00 PM (Patar Sunset Check-In)',
  });
}));

r.get('/telemetry/predictions', authenticate, requireStaffOrAdmin, asyncH(async (req, res) => {
  const preset = String(req.query.scenario || 'normal');

  let multiplier = 1.0;
  let scenarioLabel = 'Standard Seasonal Baseline';
  if (preset === 'surge') { multiplier = 1.45; scenarioLabel = 'Peak Summer & Holiday Surge (+45%)'; }
  if (preset === 'weekend') { multiplier = 1.25; scenarioLabel = 'Long Weekend Visitors (+25%)'; }
  if (preset === 'rainy') { multiplier = 0.65; scenarioLabel = 'Tropical Rain / Monsoon Slowdown (-35%)'; }

  // Fetch rooms and historical reservations from Supabase
  const [roomsRes, histRes] = await Promise.all([
    admin.from('rooms').select('rate_php, units, capacity').eq('is_active', true),
    admin.from('reservations').select('check_in, check_out, guests, total_php, status, room_id')
      .in('status', ['confirmed', 'checked_in', 'checked_out'])
      .gte('check_in', new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10))
      .order('check_in', { ascending: false })
      .limit(200),
  ]);

  const rooms = roomsRes.data || [];
  const history = histRes.data || [];
  const totalUnits = rooms.reduce((sum, r) => sum + r.units, 0) || 10;
  const avgRate = rooms.length > 0
    ? Math.round(rooms.reduce((sum, r) => sum + r.rate_php, 0) / rooms.length)
    : 2500;

  // Compute historical day-of-week occupancy from real reservation data
  const dayOccupancy = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const h of history) {
    const checkIn = new Date(h.check_in);
    const nights = Math.max(1, Math.round((new Date(h.check_out) - new Date(h.check_in)) / 86400000));
    for (let n = 0; n < nights; n++) {
      const stayDay = new Date(checkIn.getTime() + n * 86400000);
      const dow = stayDay.getDay();
      const guests = h.guests || 1;
      const occContrib = Math.min(100, Math.round((guests / Math.max(1, totalUnits)) * 100));
      dayOccupancy[dow].push(occContrib);
    }
  }

  // Average occupancy per day-of-week from historical data
  const avgDayOcc = {};
  for (let dow = 0; dow < 7; dow++) {
    const samples = dayOccupancy[dow];
    avgDayOcc[dow] = samples.length > 0
      ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
      : (dow === 0 || dow === 6 ? 65 : 40);
  }

  // Dynamic confidence score based on historical data volume
  const dataPoints = history.length;
  const confidenceScore = Math.min(98, Math.max(50, Math.round(50 + (dataPoints / 200) * 48)));

  const forecast = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() + (i + 1) * 86400000);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dow = d.getDay();
    const isWknd = dow === 0 || dow === 6;
    const baseOcc = avgDayOcc[dow];
    const occPct = Math.min(100, Math.round(baseOcc * multiplier));
    const projectedRev = Math.round((occPct / 100) * totalUnits * avgRate);

    return {
      day: dayName,
      date: d.toISOString().slice(0, 10),
      projected_occupancy_pct: occPct,
      projected_revenue_php: projectedRev,
      recommended_pricing: isWknd ? '+15% Weekend Surge' : 'Standard Rate',
      recommended_staffing: occPct > 80 ? '8 Staff (High Demand)' : '5 Staff (Standard)',
    };
  });

  const avgOcc = Math.round(forecast.reduce((a, f) => a + f.projected_occupancy_pct, 0) / forecast.length);
  const projected30dRev = Math.round((avgOcc / 100) * totalUnits * avgRate * 30);

  res.json({
    scenario: scenarioLabel,
    confidence_score_pct: confidenceScore,
    data_points_analyzed: dataPoints,
    projected_30d_revenue_php: projected30dRev,
    projected_avg_occupancy_pct: avgOcc,
    forecast,
  });
}));

export default r;
