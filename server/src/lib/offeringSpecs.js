/**
 * Shared offering classification, type-specific specifications, and PH date helpers.
 * Specifications are packed inside the rooms.amenities text[] column using prefixed tags
 * (__type__:<type> and __spec__:<encoded-json>) so Supabase schemas require no DDL changes.
 */

export const OFFERING_TYPES = ['room', 'cottage', 'offer'];

export const DB_SAFE_CATEGORIES = ['Villa', 'Suite', 'Cottage', 'Standard', 'Dorm'];

export const ROOM_CATEGORIES = ['Room', 'Standard', 'Suite', 'Villa', 'Garden', 'Dorm'];
export const COTTAGE_CATEGORIES = ['Cottage', 'Cabana', 'Pavilion'];
export const OFFER_CATEGORIES = ['Island Tour', 'Tour', 'Water Activity', 'Package', 'Offer'];

export function toDbSafeCategory(displayCategory, offeringType = 'room') {
  const clean = String(displayCategory || '').trim();
  const matched = DB_SAFE_CATEGORIES.find((c) => c.toLowerCase() === clean.toLowerCase());
  if (matched) return matched;
  if (offeringType === 'cottage') return 'Cottage';
  if (offeringType === 'offer') return 'Standard';
  return 'Suite';
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
  cottage: {
    cottage_style: 'Open-Air Nipa Cottage',
    usage_mode: 'Day Use & Overnight',
    beachfront_proximity: 'Steps from Shoreline',
    seating_tables: 'Hardwood Table & Benches',
    grilling_area: true,
    power_outlet: true,
    pricing_mode: 'per_night',
  },
  offer: {
    offer_subtype: 'Island Hopping Tour',
    duration: '4 Hours (Half Day)',
    destinations: 'Patar Coral Garden, Sandbar, Limestone Caves',
    departure_schedule: '08:00 AM Daily',
    inclusions: 'Motorized Bangka Boat, Boatman/Guide, Life Vests, Snorkel Mask',
    boat_or_equipment: 'Outrigger Bangka Boat',
    pricing_mode: 'per_group',
    min_participants: 2,
  },
};

export const DEFAULT_ISLAND_TOUR_SEED = {
  name: 'Patar & Hundred Islands Hopping Tour',
  slug: 'patar-island-hopping-tour',
  category: 'Island Tour',
  offering_type: 'offer',
  description: 'Guided motorized bangka island hopping across Bolinao coral reefs, coastal coves, and calm turquoise sandbars.',
  capacity: 10,
  units: 6,
  rate_php: 2800,
  is_active: true,
  amenities: ['Motorized Boat', 'Local Guide', 'Life Vests', 'Snorkel Gear', 'Cooler Box'],
  image_url: 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209700/jd_beach_house_accommodations/island.jpg',
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
};

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
  if (OFFERING_TYPES.includes(rawType)) return rawType;

  const rawAmenities = Array.isArray(item?.amenities) ? item.amenities : [];
  for (const tag of rawAmenities) {
    if (typeof tag === 'string' && tag.startsWith('__type__:')) {
      const parsed = tag.slice('__type__:'.length).toLowerCase().trim();
      if (OFFERING_TYPES.includes(parsed)) return parsed;
    }
  }

  const cat = String(item?.category || '').toLowerCase();
  const name = String(item?.name || '').toLowerCase();
  const slug = String(item?.slug || '').toLowerCase();
  const combined = `${cat} ${name} ${slug}`;

  if (/\b(tour|island|hopping|offer|package|snorkel|kayak|banana\s*boat|jet\s*ski|cruise|excursion|activity)\b/i.test(combined)) {
    return 'offer';
  }
  if (/\b(cottage|kubo|cabana|pavilion|nipa)\b/i.test(cat) || /\b(cottage|kubo|cabana|pavilion|nipa)\b/i.test(name)) {
    return 'cottage';
  }
  if (/\b(room|villa|suite|garden|dorm|bunk|quad|studio)\b/i.test(name) || ['room', 'villa', 'suite', 'garden', 'dorm'].includes(cat)) {
    return 'room';
  }
  if (cat === 'cottage') return 'cottage';
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

  const effectiveMeta = { ...itemMeta, category: displayCategory || itemMeta?.category };
  const offering_type = explicitType || inferOfferingType({ ...effectiveMeta, amenities: arr });
  const specs = sanitizeSpecsForType(offering_type, { ...(parsedSpecs || {}), ...(itemMeta?.specs || {}) });

  return {
    offering_type,
    displayCategory: displayCategory || itemMeta?.category || '',
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
  const resolvedCategory = String(category || existingParsed.displayCategory || '').trim();

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
    offer: 'Island Tour / Offer',
  };

  return {
    ...reservation,
    offering_type,
    offering_label: labels[offering_type] || 'Room Accommodation',
    specs: parsed.specs,
    rate_unit: getRateUnitLabel(offering_type, parsed.specs),
  };
}
