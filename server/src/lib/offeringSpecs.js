/**
 * Shared accommodation classification, type-specific specifications, and PH date helpers.
 * Strictly adheres to the two-tier resort accommodation taxonomy:
 *   1. Rooms: overnight stays
 *   2. Cottages: day-use open-air rentals
 * Island Tours and non-lodging activities are decoupled into the separate AddOnService entity.
 */

export const ALLOWED_LODGING_CATEGORIES = ['Room', 'Villa', 'Suite', 'Cottage', 'Cabana', 'Offer', 'Event'];

export const OFFERING_TYPES = ['room', 'villa', 'suite', 'cottage', 'cabana', 'offer', 'event'];

export const DB_SAFE_CATEGORIES = ['Standard', 'Cottage'];

export function normalizeCategoryName(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'Room';
  const lower = s.toLowerCase();
  if (lower === 'rooms') return 'Room';
  if (lower === 'villas') return 'Villa';
  if (lower === 'suites') return 'Suite';
  if (lower === 'cottages') return 'Cottage';
  if (lower === 'cabanas') return 'Cabana';
  if (lower === 'offers') return 'Offer';
  if (lower === 'events') return 'Event';
  return s;
}

export const ROOM_CATEGORIES = ['Room', 'Standard Room', 'Deluxe Room', 'Family Room'];
export const VILLA_CATEGORIES = ['Villa', 'Oceanfront Villa', 'Cliffside Villa', 'Grand Villa'];
export const SUITE_CATEGORIES = ['Suite', 'Sunset Loft Suite', 'Seaview Suite', 'Executive Penthouse'];
export const COTTAGE_CATEGORIES = ['Cottage', 'Beachfront Cottage', 'Family Cottage', 'Open-Air Kubo'];
export const CABANA_CATEGORIES = ['Cabana', 'Garden Cabana', 'Poolside Cabana', 'Shaded Daybed Cabana'];
export const OFFER_CATEGORIES = ['Island Tour', 'Boat Charter', 'Snorkeling Excursion', 'Water Activity'];
export const EVENT_CATEGORIES = ['Event Pavilion', 'Sunset Function Hall', 'Beach Gazebo Venue'];

export function toDbSafeCategory(displayCategory, offeringType = 'room') {
  const clean = String(displayCategory || '').trim().toLowerCase();
  if (clean === 'cottage' || clean === 'cottages' || clean === 'cabana' || offeringType === 'cottage' || offeringType === 'cabana') {
    return 'Cottage';
  }
  return 'Standard';
}

export const DEFAULT_SPECS_BY_TYPE = {
  room: {
    bed_config: '1 Queen Bed',
    bathroom_type: 'Private En-Suite',
    climate_control: 'Split Air-Conditioned',
    floor_wing: 'Main Wing',
    view_type: 'Coastal / Garden View',
    check_in_out: '02:00 PM / 12:00 PM',
    pricing_mode: 'per_night',
  },
  villa: {
    bed_config: '2 King Beds + Living Area',
    bathroom_type: 'Private Ocean En-Suite + Tub',
    climate_control: 'Dual Split Inverter AC',
    floor_wing: 'Cliffside Oceanfront Wing',
    view_type: 'Panoramic Sunset & Ocean View',
    check_in_out: '02:00 PM / 12:00 PM',
    pricing_mode: 'per_night',
  },
  suite: {
    bed_config: '1 King Bed + Lounge Suite',
    bathroom_type: 'Luxury Marble Bath & Rain Shower',
    climate_control: 'Silent Inverter Air-Conditioned',
    floor_wing: 'Upper Terrace Wing',
    view_type: 'Unobstructed Sea View Deck',
    check_in_out: '02:00 PM / 12:00 PM',
    pricing_mode: 'per_night',
  },
  cottage: {
    cottage_style: 'Open-Air Nipa Cottage',
    usage_mode: 'Day Use & Overnight',
    beachfront_proximity: 'Steps from Shoreline',
    seating_tables: 'Hardwood Table & Benches',
    grilling_area: true,
    power_outlet: true,
    pricing_mode: 'per_night',
  },
  cabana: {
    cottage_style: 'Shaded Poolside / Garden Cabana',
    usage_mode: 'Day Use & Evening Rental',
    beachfront_proximity: 'Boardwalk & Poolside Area',
    seating_tables: 'Lounge Daybeds & Cocktail Table',
    grilling_area: false,
    power_outlet: true,
    pricing_mode: 'per_night',
  },
  offer: {
    duration: '4 Hours (Half Day)',
    offer_subtype: 'Guided Island Hopping Tour',
    destinations: 'Patar Reef Sanctuary, Sandbar Cove, Sea Caves',
    inclusions: 'Private Bangka Boat, Licensed Boatman, Life Vests, Snorkels',
    beachfront_proximity: 'Direct Outrigger Boat Pier',
    pricing_mode: 'per_group',
  },
  event: {
    cottage_style: 'Beachfront Covered Function Pavilion',
    usage_mode: 'Banquet & Group Gathering (Up to 50 pax)',
    beachfront_proximity: 'Direct Oceanfront Lawn',
    seating_tables: 'Banquet Dining Tables & Chairs',
    grilling_area: true,
    power_outlet: true,
    pricing_mode: 'per_stay',
  },
};

/**
 * Decoupled AddOnService / Activity entity outside the lodging taxonomy.
 * Island Tours must never be treated as rooms or cottages.
 */
export const RESORT_ACTIVITIES_AND_TOURS = [
  {
    id: 'addon-island-hopping-001',
    name: 'Patar & Hundred Islands Hopping Tour',
    slug: 'patar-island-hopping-tour',
    category: 'Island Tour',
    description: 'Guided motorized bangka island hopping across Bolinao coral reefs, coastal coves, and calm turquoise sandbars.',
    capacity: 10,
    units: 6,
    rate_php: 2800,
    is_active: true,
    amenities: ['Motorized Boat', 'Local Guide', 'Life Vests', 'Snorkel Gear', 'Cooler Box'],
    image_url: 'https://res.cloudinary.com/juynm9ab/image/upload/jd_beach_house_accommodations/island.jpg',
    specs: {
      offer_subtype: 'Island Hopping Tour',
      duration: '4 Hours (Half Day)',
      destinations: 'Patar Reef Sanctuary, Sandbar Cove, Sea Cave Overlook',
      departure_schedule: '08:00 AM Daily',
      inclusions: 'Private Motorized Bangka, Boatman/Guide, Life Vests, Snorkel Masks',
      boat_or_equipment: 'Private Outrigger Bangka Boat',
      pricing_mode: 'per_group',
      min_participants: 2,
    },
  },
];

export function getManilaTodayISO(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDaysISO(isoDate, days) {
  const [y, m, d] = String(isoDate || getManilaTodayISO()).slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, (d || 1) + Number(days || 0)));
  return dt.toISOString().slice(0, 10);
}

export function getMinGuestCheckInISO(now = new Date()) {
  return addDaysISO(getManilaTodayISO(now), 1);
}

export function inferOfferingType(item = {}) {
  const rawType = String(item?.offering_type || '').toLowerCase().trim();
  if (rawType === 'villa') return 'villa';
  if (rawType === 'suite') return 'suite';
  if (rawType === 'cabana') return 'cabana';
  if (rawType === 'cottage') return 'cottage';
  if (rawType === 'offer' || rawType === 'tour') return 'offer';
  if (rawType === 'event') return 'event';
  if (rawType === 'room') return 'room';

  const rawAmenities = Array.isArray(item?.amenities) ? item.amenities : [];
  for (const tag of rawAmenities) {
    if (typeof tag === 'string' && tag.startsWith('__type__:')) {
      const parsed = tag.slice('__type__:'.length).toLowerCase().trim();
      if (parsed === 'tour') return 'offer';
      if (OFFERING_TYPES.includes(parsed)) return parsed;
    }
  }

  const cat = String(item?.category || '').toLowerCase();
  const name = String(item?.name || item?.room_name || '').toLowerCase();

  if (/\b(villa)\b/i.test(cat) || /\b(villa)\b/i.test(name)) {
    return 'villa';
  }
  if (/\b(suite|loft|penthouse)\b/i.test(cat) || /\b(suite|loft|penthouse)\b/i.test(name)) {
    return 'suite';
  }
  if (/\b(cabana)\b/i.test(cat) || /\b(cabana)\b/i.test(name)) {
    return 'cabana';
  }
  if (/\b(cottage|kubo|nipa|bamboo)\b/i.test(cat) || /\b(cottage|kubo|nipa|bamboo)\b/i.test(name)) {
    return 'cottage';
  }
  if (/\b(tour|island|boat|charter|hopping|snorkeling|dive|excursion|offer|bangka)\b/i.test(cat) || /\b(tour|island|boat|charter|hopping|snorkeling|dive|excursion|offer|bangka)\b/i.test(name)) {
    return 'offer';
  }
  if (/\b(event|pavilion|hall|function)\b/i.test(cat) || /\b(event|pavilion|hall|function)\b/i.test(name)) {
    return 'event';
  }

  return 'room';
}

export function getDefaultSpecs(type) {
  const key = OFFERING_TYPES.includes(type) ? type : 'room';
  return { ...DEFAULT_SPECS_BY_TYPE[key] };
}

export function sanitizeSpecsForType(type, rawSpecs = {}) {
  const defaults = getDefaultSpecs(type);
  if (!rawSpecs || typeof rawSpecs !== 'object') return defaults;

  const cleaned = { ...defaults };
  for (const [k, v] of Object.entries(rawSpecs)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'boolean') {
      cleaned[k] = v;
    } else if (typeof v === 'number' && !Number.isNaN(v)) {
      cleaned[k] = v;
    } else {
      const s = String(v).trim();
      if (s.length > 0) cleaned[k] = s;
    }
  }
  if (type === 'offer') {
    cleaned.pricing_mode = cleaned.pricing_mode === 'per_pax' ? 'per_pax' : 'per_group';
    cleaned.min_participants = Math.max(1, Number(cleaned.min_participants) || 1);
  }
  return cleaned;
}

export function parseOfferingTags(rawAmenities = [], itemMeta = {}) {
  const arr = Array.isArray(rawAmenities) ? rawAmenities : [];
  let explicitType = '';
  let displayCategory = '';
  let parsedSpecs = null;
  const imgList = [];
  const cleanAmenities = [];

  for (const entry of arr) {
    if (typeof entry !== 'string') continue;
    if (entry.startsWith('__img__:')) {
      const url = entry.slice('__img__:'.length).trim();
      if (url && !imgList.includes(url)) imgList.push(url);
    } else if (entry.startsWith('__type__:')) {
      const t = entry.slice('__type__:'.length).trim().toLowerCase();
      if (OFFERING_TYPES.includes(t)) explicitType = t;
    } else if (entry.startsWith('__cat__:')) {
      const c = entry.slice('__cat__:'.length).trim();
      if (c) displayCategory = c;
    } else if (entry.startsWith('__spec__:')) {
      const encoded = entry.slice('__spec__:'.length).trim();
      try {
        parsedSpecs = JSON.parse(decodeURIComponent(encoded));
      } catch {
        try {
          parsedSpecs = JSON.parse(encoded);
        } catch {
          parsedSpecs = null;
        }
      }
    } else if (entry.trim()) {
      cleanAmenities.push(entry.trim());
    }
  }

  const rawCategory = displayCategory || itemMeta?.category || '';
  const effectiveCategory = normalizeCategoryName(rawCategory);
  const effectiveMeta = { ...itemMeta, category: effectiveCategory };
  const offering_type = explicitType || inferOfferingType({ ...effectiveMeta, amenities: arr });
  const specs = sanitizeSpecsForType(offering_type, { ...(parsedSpecs || {}), ...(itemMeta?.specs || {}) });

  return {
    offering_type,
    displayCategory: effectiveCategory,
    specs,
    imgList,
    cleanAmenities,
  };
}

export function packOfferingAmenities({ offering_type, category, specs, amenities, existingAmenities, images, image_url }) {
  const existingParsed = parseOfferingTags(existingAmenities || []);
  const resolvedType = OFFERING_TYPES.includes(String(offering_type || '').toLowerCase())
    ? String(offering_type).toLowerCase()
    : (existingParsed.offering_type || 'room');
  const resolvedCategory = normalizeCategoryName(String(category || existingParsed.displayCategory || 'Room').trim());

  const baseClean = Array.isArray(amenities)
    ? amenities.filter((a) => typeof a === 'string' && !a.startsWith('__'))
    : existingParsed.cleanAmenities;

  const uniqueImgs = [];
  const pushImg = (u) => {
    const clean = typeof u === 'string' ? u.trim() : '';
    if (clean && !uniqueImgs.includes(clean)) uniqueImgs.push(clean);
  };
  if (Array.isArray(images)) images.forEach(pushImg);
  else if (typeof image_url === 'string' && image_url.trim()) pushImg(image_url);
  else existingParsed.imgList.forEach(pushImg);

  const sanitizedSpecs = sanitizeSpecsForType(resolvedType, specs || existingParsed.specs);
  const packed = [
    ...baseClean,
    ...uniqueImgs.map((u) => `__img__:${u}`),
    `__type__:${resolvedType}`,
    ...(resolvedCategory ? [`__cat__:${resolvedCategory}`] : []),
    `__spec__:${encodeURIComponent(JSON.stringify(sanitizedSpecs))}`,
  ];

  return {
    offering_type: resolvedType,
    displayCategory: resolvedCategory,
    dbCategory: toDbSafeCategory(resolvedCategory, resolvedType),
    specs: sanitizedSpecs,
    amenities: packed,
  };
}

export function getRateUnitLabel(offering_type, specs = {}) {
  if (offering_type === 'offer') {
    return specs?.pricing_mode === 'per_pax' ? 'per guest' : 'per trip';
  }
  if (offering_type === 'cottage') {
    return String(specs?.usage_mode || '').toLowerCase().includes('day use only') ? 'per day' : 'per night';
  }
  return 'per night';
}

export function calculateOfferingTotal({ rate_php, nights = 1, guests = 1, offering_type = 'room', specs = {} }) {
  const rate = Math.max(0, Number(rate_php) || 0);
  if (offering_type === 'offer') {
    if (specs?.pricing_mode === 'per_pax') {
      return Math.round(rate * Math.max(1, Number(guests) || 1));
    }
    return Math.round(rate);
  }
  return Math.round(rate * Math.max(1, Number(nights) || 1));
}

export function enrichReservationOffering(reservation = {}) {
  const room = reservation?.rooms || {};
  const notes = String(reservation?.notes || '');
  const typeTagMatch = notes.match(/\[BookingType:\s*(room|cottage|offer)\]/i);

  let parsed = { offering_type: 'room', specs: getDefaultSpecs('room') };
  if (room && (room.amenities || room.category || room.name || room.offering_type)) {
    parsed = parseOfferingTags(room.amenities || [], room);
  }

  const offering_type = typeTagMatch
    ? typeTagMatch[1].toLowerCase()
    : (OFFERING_TYPES.includes(String(reservation?.offering_type || '').toLowerCase())
      ? String(reservation.offering_type).toLowerCase()
      : parsed.offering_type);

  const labels = {
    room: 'Room Accommodation',
    cottage: 'Cottage Rental',
  };

  return {
    ...reservation,
    offering_type,
    offering_label: labels[offering_type] || 'Room Accommodation',
    specs: parsed.specs,
    rate_unit: getRateUnitLabel(offering_type, parsed.specs),
  };
}

export const TWO_HOURS_MS = 2 * 60 * 60 * 1000; // 7,200,000 ms mandatory gap

export function normalizeTo24Hour(timeStr, defaultTime = '14:00') {
  if (!timeStr) return defaultTime;
  const clean = String(timeStr).trim();
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2];
    const ampm = ampmMatch[3].toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return `${String(parseInt(match24[1], 10)).padStart(2, '0')}:${match24[2]}`;
  }
  return defaultTime;
}

export function extractBookingTimes(booking) {
  let cinTime = booking?.check_in_time || null;
  let coutTime = booking?.check_out_time || null;

  const notes = String(booking?.notes || '');
  const match = notes.match(/\[Check-In:\s*([0-9]{1,2}:[0-9]{2}(?:\s*[AaPp][Mm])?),\s*Check-Out:\s*([0-9]{1,2}:[0-9]{2}(?:\s*[AaPp][Mm])?)\]/i);
  if (match) {
    if (!cinTime) cinTime = match[1].trim();
    if (!coutTime) coutTime = match[2].trim();
  }
  return {
    check_in_time: normalizeTo24Hour(cinTime, '14:00'),
    check_out_time: normalizeTo24Hour(coutTime, '12:00'),
  };
}

export function parseBookingTimeMs(dateStr, timeStr = '12:00') {
  const normTime = normalizeTo24Hour(timeStr, '12:00');
  const d = new Date(`${dateStr}T${normTime}:00+08:00`);
  return d.getTime();
}

export function isBookingCollisionWithGap(startA, endA, startB, endB, gapMs = TWO_HOURS_MS) {
  return (startA < endB + gapMs) && (startB < endA + gapMs);
}
