/**
 * Client-side offering types, structured specifications, and Asia/Manila date helpers.
 * Mirrors server/src/lib/offeringSpecs.js so room, cottage, and island tour/offer handling matches cleanly.
 */

export type OfferingType = 'room' | 'cottage' | 'offer';

export interface OfferingSpecs {
  // Room specifications
  bed_config?: string;
  bathroom_type?: string;
  climate_control?: string;
  floor_wing?: string;
  view_type?: string;
  check_in_out?: string;
  // Cottage specifications
  cottage_style?: string;
  usage_mode?: string;
  beachfront_proximity?: string;
  seating_tables?: string;
  grilling_area?: boolean;
  power_outlet?: boolean;
  // Island Tour / Offer specifications
  offer_subtype?: string;
  duration?: string;
  destinations?: string;
  departure_schedule?: string;
  inclusions?: string;
  boat_or_equipment?: string;
  min_participants?: number;
  // Shared rate semantics
  pricing_mode?: 'per_night' | 'per_stay' | 'per_group' | 'per_pax';
  [key: string]: unknown;
}

export const OFFERING_TYPES: OfferingType[] = ['room', 'cottage', 'offer'];

export const DB_SAFE_CATEGORIES = ['Villa', 'Suite', 'Cottage', 'Standard', 'Dorm'];

export const ROOM_CATEGORIES = ['Room', 'Standard', 'Suite', 'Villa', 'Garden', 'Dorm'];
export const COTTAGE_CATEGORIES = ['Cottage', 'Cabana', 'Pavilion'];
export const OFFER_CATEGORIES = ['Island Tour', 'Tour', 'Water Activity', 'Package', 'Offer'];

export function toDbSafeCategory(displayCategory: string, offeringType: OfferingType = 'room'): string {
  const clean = String(displayCategory || '').trim();
  const matched = DB_SAFE_CATEGORIES.find((c) => c.toLowerCase() === clean.toLowerCase());
  if (matched) return matched;
  if (offeringType === 'cottage') return 'Cottage';
  if (offeringType === 'offer') return 'Standard';
  return 'Suite';
}

export const DEFAULT_SPECS_BY_TYPE: Record<OfferingType, OfferingSpecs> = {
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

export function getManilaTodayISO(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = String(isoDate || getManilaTodayISO()).slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, (d || 1) + Number(days || 0)));
  return dt.toISOString().slice(0, 10);
}

export function getMinGuestCheckInISO(now = new Date()): string {
  return addDaysISO(getManilaTodayISO(now), 1);
}

export function inferOfferingType(item: any = {}): OfferingType {
  const rawType = String(item?.offering_type || '').toLowerCase().trim() as OfferingType;
  if (OFFERING_TYPES.includes(rawType)) return rawType;

  const rawAmenities = Array.isArray(item?.amenities) ? item.amenities : [];
  for (const tag of rawAmenities) {
    if (typeof tag === 'string' && tag.startsWith('__type__:')) {
      const parsed = tag.slice('__type__:'.length).toLowerCase().trim() as OfferingType;
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

export function getDefaultSpecs(type: OfferingType): OfferingSpecs {
  return { ...DEFAULT_SPECS_BY_TYPE[OFFERING_TYPES.includes(type) ? type : 'room'] };
}

export function sanitizeSpecsForType(type: OfferingType, rawSpecs: Record<string, any> = {}): OfferingSpecs {
  const defaults = getDefaultSpecs(type);
  const cleaned: OfferingSpecs = { ...defaults };

  if (rawSpecs && typeof rawSpecs === 'object') {
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
  }

  if (type === 'offer') {
    cleaned.pricing_mode = cleaned.pricing_mode === 'per_pax' ? 'per_pax' : 'per_group';
    cleaned.min_participants = Math.max(1, Number(cleaned.min_participants) || 1);
  }
  return cleaned;
}

export function parseOfferingTags(rawAmenities: any[] = [], itemMeta: any = {}) {
  const arr = Array.isArray(rawAmenities) ? rawAmenities : [];
  let explicitType: OfferingType | '' = '';
  let displayCategory = '';
  let parsedSpecs: Record<string, any> | null = null;
  const imgList: string[] = [];
  const cleanAmenities: string[] = [];

  for (const entry of arr) {
    if (typeof entry !== 'string') continue;
    if (entry.startsWith('__img__:')) {
      const url = entry.slice('__img__:'.length).trim();
      if (url && !imgList.includes(url)) imgList.push(url);
    } else if (entry.startsWith('__type__:')) {
      const t = entry.slice('__type__:'.length).trim().toLowerCase() as OfferingType;
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
  const offering_type: OfferingType = explicitType || inferOfferingType({ ...effectiveMeta, amenities: arr });
  const specs = sanitizeSpecsForType(offering_type, { ...(parsedSpecs || {}), ...(itemMeta?.specs || {}) });

  return { offering_type, displayCategory: displayCategory || itemMeta?.category || '', specs, imgList, cleanAmenities };
}

export function packOfferingAmenities({
  offering_type,
  category,
  specs,
  amenities,
  existingAmenities,
  images,
  image_url,
}: {
  offering_type?: OfferingType;
  category?: string;
  specs?: OfferingSpecs;
  amenities?: string[];
  existingAmenities?: string[];
  images?: string[];
  image_url?: string;
}) {
  const existingParsed = parseOfferingTags(existingAmenities || []);
  const resolvedType: OfferingType = offering_type && OFFERING_TYPES.includes(offering_type)
    ? offering_type
    : existingParsed.offering_type;
  const resolvedCategory = String(category || existingParsed.displayCategory || '').trim();

  const baseClean = Array.isArray(amenities)
    ? amenities.filter((a) => typeof a === 'string' && !a.startsWith('__'))
    : existingParsed.cleanAmenities;

  const uniqueImgs: string[] = [];
  const pushImg = (u?: string) => {
    const clean = typeof u === 'string' ? u.trim() : '';
    if (clean && !uniqueImgs.includes(clean)) uniqueImgs.push(clean);
  };
  if (Array.isArray(images)) images.forEach(pushImg);
  else if (typeof image_url === 'string' && image_url.trim()) pushImg(image_url);
  else existingParsed.imgList.forEach(pushImg);

  const sanitizedSpecs = sanitizeSpecsForType(resolvedType, specs || existingParsed.specs);

  return {
    offering_type: resolvedType,
    displayCategory: resolvedCategory,
    dbCategory: toDbSafeCategory(resolvedCategory, resolvedType),
    specs: sanitizedSpecs,
    amenities: [
      ...baseClean,
      ...uniqueImgs.map((u) => `__img__:${u}`),
      `__type__:${resolvedType}`,
      ...(resolvedCategory ? [`__cat__:${resolvedCategory}`] : []),
      `__spec__:${encodeURIComponent(JSON.stringify(sanitizedSpecs))}`,
    ],
  };
}

export function getOfferingLabel(type: OfferingType): string {
  if (type === 'cottage') return 'Cottage';
  if (type === 'offer') return 'Island Tour / Offer';
  return 'Room';
}

export function getRateUnitSuffix(type: OfferingType, specs: OfferingSpecs = {}): string {
  if (type === 'offer') {
    return specs?.pricing_mode === 'per_pax' ? '/ guest' : '/ trip';
  }
  if (type === 'cottage') {
    return String(specs?.usage_mode || '').toLowerCase().includes('day use only') ? '/ day' : '/ night';
  }
  return '/ night';
}

export function calculateOfferingTotal({
  rate_php,
  nights = 1,
  guests = 1,
  offering_type = 'room',
  specs = {},
}: {
  rate_php: number;
  nights?: number;
  guests?: number;
  offering_type?: OfferingType;
  specs?: OfferingSpecs;
}): number {
  const rate = Math.max(0, Number(rate_php) || 0);
  if (offering_type === 'offer') {
    if (specs?.pricing_mode === 'per_pax') {
      return Math.round(rate * Math.max(1, Number(guests) || 1));
    }
    return Math.round(rate);
  }
  return Math.round(rate * Math.max(1, Number(nights) || 1));
}

export function formatSpecHighlights(item: any): { label: string; value: string }[] {
  const type: OfferingType = inferOfferingType(item);
  const specs: OfferingSpecs = sanitizeSpecsForType(type, item?.specs || {});
  if (type === 'offer') {
    return [
      { label: 'Offer', value: String(specs.offer_subtype || 'Island Hopping Tour') },
      { label: 'Duration', value: String(specs.duration || '4 Hours') },
      { label: 'Route', value: String(specs.destinations || 'Patar Reef & Sandbar') },
      { label: 'Pricing', value: specs.pricing_mode === 'per_pax' ? 'Per Guest' : 'Flat Group / Boat' },
    ];
  }
  if (type === 'cottage') {
    return [
      { label: 'Style', value: String(specs.cottage_style || 'Open-Air Nipa Cottage') },
      { label: 'Usage', value: String(specs.usage_mode || 'Day Use & Overnight') },
      { label: 'Shoreline', value: String(specs.beachfront_proximity || 'Steps from Shoreline') },
      { label: 'Amenities', value: specs.grilling_area ? 'Grill & Table Ready' : String(specs.seating_tables || 'Shaded Seating') },
    ];
  }
  return [
    { label: 'Beds', value: String(specs.bed_config || '1 Queen Bed') },
    { label: 'Bath', value: String(specs.bathroom_type || 'Private En-Suite') },
    { label: 'Cooling', value: String(specs.climate_control || 'Split Air-Conditioned') },
    { label: 'Wing', value: String(specs.floor_wing || 'Main Wing') },
  ];
}

export function resolveReservationOfferingType(reservation: any): OfferingType {
  const notes = String(reservation?.notes || '');
  const tagMatch = notes.match(/\[BookingType:\s*(room|cottage|offer)\]/i);
  if (tagMatch) return tagMatch[1].toLowerCase() as OfferingType;

  const direct = String(reservation?.offering_type || '').toLowerCase();
  if (OFFERING_TYPES.includes(direct as OfferingType)) return direct as OfferingType;

  if (reservation?.rooms) {
    return inferOfferingType(reservation.rooms);
  }
  if (reservation?.room_name) {
    return inferOfferingType({ name: reservation.room_name, category: reservation.category });
  }
  return 'room';
}
