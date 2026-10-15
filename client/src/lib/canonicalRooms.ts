export interface CanonicalRoom {
  id: string;
  name: string;
  slug: string;
  category: 'Villa' | 'Suite' | 'Cottage' | 'Garden' | 'Dorm';
  description: string;
  capacity: number;
  units: number;
  rate_php: number;
  amenities: string[];
  is_active: boolean;
  rating_avg: number;
  rating_count: number;
}

export const CANONICAL_ROOMS: CanonicalRoom[] = [
  {
    id: 'ce7bccc2-0592-44ad-ab51-e3ef1091dba2',
    name: 'Oceanfront Sunset Villa',
    slug: 'oceanfront-sunset-villa',
    category: 'Villa',
    description: 'Sleeps 4 · Ocean View · King Bed · Balcony',
    capacity: 4,
    units: 2,
    rate_php: 6500,
    amenities: ['Air Conditioning', 'Free Wi-Fi', 'Private Bath', 'Sea View'],
    is_active: true,
    rating_avg: 4.9,
    rating_count: 28,
  },
  {
    id: '555434c0-a8c3-46ca-bd6e-51a6250d2e64',
    name: 'Deluxe Beach Cottage',
    slug: 'deluxe-beach-cottage',
    category: 'Cottage',
    description: 'Sleeps 2 · Garden Access · Queen Bed · Veranda',
    capacity: 2,
    units: 3,
    rate_php: 4200,
    amenities: ['Air Conditioning', 'Free Wi-Fi', 'Private Bath', 'Garden Access'],
    is_active: true,
    rating_avg: 4.8,
    rating_count: 34,
  },
  {
    id: '6ed1539a-21ef-4d6d-afc0-04d89f02c25d',
    name: 'Family Coral Suite',
    slug: 'family-coral-suite',
    category: 'Suite',
    description: 'Sleeps 6 · Two Bedrooms · Kitchenette · Terrace',
    capacity: 6,
    units: 2,
    rate_php: 8500,
    amenities: ['Air Conditioning', 'Free Wi-Fi', 'Private Bath', 'Two Bedrooms', 'Kitchenette', 'Terrace'],
    is_active: true,
    rating_avg: 5.0,
    rating_count: 19,
  },
  {
    id: 'a8f35476-c7cb-4832-a588-8f2af5de52d0',
    name: 'Secluded Palms Studio',
    slug: 'secluded-palms-studio',
    category: 'Cottage',
    description: 'Sleeps 2 · Tropical Courtyard · Queen Bed',
    capacity: 2,
    units: 4,
    rate_php: 3800,
    amenities: ['Air Conditioning', 'Free Wi-Fi', 'Private Bath', 'Tropical Courtyard'],
    is_active: true,
    rating_avg: 4.7,
    rating_count: 42,
  },
];
