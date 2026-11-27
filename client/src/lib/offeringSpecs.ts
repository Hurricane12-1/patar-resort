/**
 * Client-side offering types, structured specifications, and Asia/Manila date helpers.
 * Strictly adheres to the two-tier resort accommodation taxonomy:
 *   1. Rooms: overnight stays
 *   2. Cottages: day-use open-air rentals
 * Island Tours and non-lodging activities are decoupled into the separate AddOnService entity.
 */

export const ALLOWED_LODGING_CATEGORIES = ['Room', 'Villa', 'Suite', 'Cottage', 'Cabana', 'Offer', 'Event'] as const;
export type LodgingCategory = (typeof ALLOWED_LODGING_CATEGORIES)[number];

export function normalizeCategoryName(raw: string): string {
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

export type OfferingType = 'room' | 'villa' | 'suite' | 'cottage' | 'cabana' | 'offer' | 'event';

export interface OfferingSpecs {
  // Room / Villa / Suite specifications
  bed_config?: string;
  bathroom_type?: string;
  view_type?: string;
  check_in_out?: string;
  // Cottage / Cabana / Event specifications
  cottage_style?: string;
  usage_mode?: string;
  beachfront_proximity?: string;
  seating_tables?: string;
  grilling_area?: boolean;
  power_outlet?: boolean;
  // Tour / Offer specifications
  duration?: string;
  offer_subtype?: string;
  destinations?: string;
  inclusions?: string;
  // Shared rate semantics
  pricing_mode?: 'per_night' | 'per_stay' | 'per_group' | 'per_pax';
  [key: string]: unknown;
}

export interface AddOnService {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  capacity?: number;
  units?: number;
  rate_php: number;
  pricing_mode?: 'per_group' | 'per_pax';
  duration?: string;
  destinations?: string;
  inclusions?: string;
  image_url?: string;
  is_active: boolean;
}

export const RESORT_ACTIVITIES_AND_TOURS: AddOnService[] = [
  {
    id: 'addon-island-hopping-001',
    name: 'Patar & Hundred Islands Hopping Tour',
    slug: 'patar-island-hopping-tour',
    category: 'Island Tour',
    description: 'Guided motorized bangka island hopping across Bolinao coral reefs, coastal coves, and calm turquoise sandbars.',
    capacity: 10,
    units: 6,
    rate_php: 2800,
    pricing_mode: 'per_group',
    duration: '4 Hours (Half Day)',
    destinations: 'Patar Reef Sanctuary, Sandbar Cove, Sea Cave Overlook',
    inclusions: 'Private Motorized Bangka, Boatman/Guide, Life Vests, Snorkel Masks',
    image_url: 'https://res.cloudinary.com/juynm9ab/image/upload/jd_beach_house_accommodations/island.jpg',
    is_active: true,
  },
];

export const OFFERING_TYPES: OfferingType[] = ['room', 'villa', 'suite', 'cottage', 'cabana', 'offer', 'event'];

export const DB_SAFE_CATEGORIES = ['Standard', 'Cottage'] as const;

export const ROOM_CATEGORIES = ['Room', 'Standard Room', 'Deluxe Room', 'Family Room'] as const;
export const VILLA_CATEGORIES = ['Villa', 'Oceanfront Villa', 'Cliffside Villa', 'Grand Villa'] as const;
export const SUITE_CATEGORIES = ['Suite', 'Sunset Loft Suite', 'Seaview Suite', 'Executive Penthouse'] as const;
export const COTTAGE_CATEGORIES = ['Cottage', 'Beachfront Cottage', 'Family Cottage', 'Open-Air Kubo'] as const;
export const CABANA_CATEGORIES = ['Cabana', 'Garden Cabana', 'Poolside Cabana', 'Shaded Daybed Cabana'] as const;
export const OFFER_CATEGORIES = ['Island Tour', 'Boat Charter', 'Snorkeling Excursion', 'Water Activity'] as const;
export const EVENT_CATEGORIES = ['Event Pavilion', 'Sunset Function Hall', 'Beach Gazebo Venue'] as const;

export function toDbSafeCategory(displayCategory: string, offeringType: string = 'room'): string {
  const clean = String(displayCategory || '').trim().toLowerCase();
  if (clean === 'cottage' || clean === 'cottages' || clean === 'cabana' || offeringType === 'cottage' || offeringType === 'cabana') {
    return 'Cottage';
  }
  return 'Standard';
}

export const DEFAULT_SPECS_BY_TYPE: Record<OfferingType, OfferingSpecs> = {
  room: {
    bed_config: '1 Queen Bed',
    bathroom_type: 'Private En-Suite',
    view_type: 'Coastal / Garden View',
    check_in_out: '02:00 PM / 12:00 PM',
    pricing_mode: 'per_night',
  },
  villa: {
    bed_config: '2 King Beds + Living Area',
    bathroom_type: 'Private Ocean En-Suite + Tub',
    view_type: 'Panoramic Sunset & Ocean View',
    check_in_out: '02:00 PM / 12:00 PM',
    pricing_mode: 'per_night',
  },
  suite: {
    bed_config: '1 King Bed + Lounge Suite',
    bathroom_type: 'Luxury Marble Bath & Rain Shower',
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
  return getManilaTodayISO(now);
}

/** The database holds many kinds (villa, suite, cabana, event). The resort only has Rooms and Cottages, so everything resolves to one of those two. */
export function inferOfferingType(item: any = {}): OfferingType {
  const detailed = inferDetailedOfferingType(item);
  return detailed === 'cottage' || detailed === 'cabana' || detailed === 'event' ? 'cottage' : 'room';
}

/** False for tours and event venues that were saved in the rooms table. They are not places a guest sleeps or rents. */
export function isRoomOrCottage(item: any = {}): boolean {
  const detailed = inferDetailedOfferingType(item);
  return detailed !== 'offer' && detailed !== 'event';
}

function inferDetailedOfferingType(item: any = {}): OfferingType {
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
      if (OFFERING_TYPES.includes(parsed as OfferingType)) return parsed as OfferingType;
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

export function getDefaultSpecs(type: OfferingType): OfferingSpecs {
  return { ...(DEFAULT_SPECS_BY_TYPE[type] || DEFAULT_SPECS_BY_TYPE.room) };
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

  const rawCategory = displayCategory || itemMeta?.category || '';
  const effectiveCategory = normalizeCategoryName(rawCategory);
  const effectiveMeta = { ...itemMeta, category: effectiveCategory };
  const offering_type: OfferingType = explicitType || inferOfferingType({ ...effectiveMeta, amenities: arr });
  const specs = sanitizeSpecsForType(offering_type, { ...(parsedSpecs || {}), ...(itemMeta?.specs || {}) });

  return { offering_type, displayCategory: effectiveCategory, specs, imgList, cleanAmenities };
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
  const resolvedCategory = normalizeCategoryName(String(category || existingParsed.displayCategory || 'Room').trim());

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

export function getOfferingLabel(type: string): string {
  switch (String(type || '').toLowerCase()) {
    case 'villa': return 'Villa';
    case 'suite': return 'Suite';
    case 'cottage': return 'Cottage';
    case 'cabana': return 'Cabana';
    case 'offer':
    case 'tour': return 'Island Tour & Offer';
    case 'event': return 'Event Pavilion';
    case 'room':
    default: return 'Room';
  }
}

export function formatOfferingBadge(type: string, category?: string): string {
  const t = getOfferingLabel(type);
  const c = String(category || '').trim();
  if (!c || c.toLowerCase() === t.toLowerCase() || t.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(t.toLowerCase())) {
    return t;
  }
  return `${t} · ${c}`;
}

export function getRateUnitSuffix(type: string, specs: OfferingSpecs = {}): string {
  const t = String(type || '').toLowerCase();
  if (t === 'offer' || t === 'tour') return '/ charter';
  if (t === 'event') return '/ event';
  if (t === 'cottage' || t === 'cabana') {
    return String(specs?.usage_mode || '').toLowerCase().includes('day use only') ? '/ day' : '/ night';
  }
  return '/ night';
}

export function calculateOfferingTotal({
  rate_php,
  nights = 1,
}: {
  rate_php: number;
  nights?: number;
  guests?: number;
  offering_type?: string;
  specs?: OfferingSpecs;
}): number {
  const rate = Math.max(0, Number(rate_php) || 0);
  return Math.round(rate * Math.max(1, Number(nights) || 1));
}

export function formatSpecHighlights(item: any): { label: string; value: string }[] {
  const type = inferOfferingType(item);
  const specs: OfferingSpecs = sanitizeSpecsForType(type, item?.specs || {});
  if (type === 'villa' || type === 'suite') {
    return [
      { label: 'Beds', value: String(specs.bed_config || '1 King Bed') },
      { label: 'Bath', value: String(specs.bathroom_type || 'Luxury En-Suite') },
      { label: 'View', value: String(specs.view_type || 'Panoramic Ocean View') },
    ];
  }
  if (type === 'cottage' || type === 'cabana') {
    return [
      { label: 'Style', value: String(specs.cottage_style || (type === 'cabana' ? 'Shaded Cabana' : 'Open-Air Nipa Cottage')) },
      { label: 'Usage', value: String(specs.usage_mode || 'Day Use & Overnight') },
      { label: 'Shoreline', value: String(specs.beachfront_proximity || 'Steps from Shoreline') },
      { label: 'Amenities', value: specs.grilling_area ? 'Grill & Table Ready' : String(specs.seating_tables || 'Shaded Seating') },
    ];
  }
  if (type === 'offer') {
    return [
      { label: 'Duration', value: String(specs.duration || '4 Hours (Half Day)') },
      { label: 'Pier', value: String(specs.beachfront_proximity || 'Boat Pier #1') },
      { label: 'Gear', value: 'Life Vests & Snorkels' },
      { label: 'Guide', value: 'Licensed Local Boatman' },
    ];
  }
  if (type === 'event') {
    return [
      { label: 'Capacity', value: 'Up to 50 Guests' },
      { label: 'Location', value: String(specs.beachfront_proximity || 'Beachfront Lawn') },
      { label: 'Seating', value: 'Banquet Ready' },
      { label: 'Outlets', value: 'Sound & Lighting Ready' },
    ];
  }
  return [
    { label: 'Beds', value: String(specs.bed_config || '1 Queen Bed') },
    { label: 'Bath', value: String(specs.bathroom_type || 'Private En-Suite') },
    ...(specs.view_type ? [{ label: 'View', value: String(specs.view_type) }] : []),
  ];
}

export function resolveReservationOfferingType(reservation: any): OfferingType {
  const detailed = resolveDetailedReservationType(reservation);
  return detailed === 'cottage' || detailed === 'cabana' || detailed === 'event' ? 'cottage' : 'room';
}

function resolveDetailedReservationType(reservation: any): OfferingType {
  const notes = String(reservation?.notes || '');
  const tagMatch = notes.match(/\[BookingType:\s*(room|villa|suite|cottage|cabana|offer|tour|event)\]/i);
  if (tagMatch) {
    const matched = tagMatch[1].toLowerCase();
    if (matched === 'tour') return 'offer';
    return matched as OfferingType;
  }

  const direct = String(reservation?.offering_type || '').toLowerCase();
  if (direct) {
    if (direct === 'tour') return 'offer';
    if (OFFERING_TYPES.includes(direct as OfferingType)) return direct as OfferingType;
  }

  if (reservation?.rooms) {
    return inferOfferingType(reservation.rooms);
  }
  if (reservation?.room_name) {
    return inferOfferingType({ name: reservation.room_name, category: reservation.category });
  }
  return 'room';
}
