export interface CanonicalRoom {
  id: string;
  name: string;
  slug: string;
  offering_type?: 'room' | 'cottage' | 'offer';
  category: 'Room' | 'Villa' | 'Suite' | 'Cottage' | 'Cabana' | 'Pavilion' | 'Garden' | 'Dorm' | 'Island Tour' | 'Tour' | 'Water Activity' | 'Package' | 'Offer' | string;
  description: string;
  capacity: number;
  units: number;
  rate_php: number;
  amenities: string[];
  specs?: Record<string, any>;
  is_active: boolean;
  rating_avg: number;
  rating_count: number;
}

export const CANONICAL_ROOMS: CanonicalRoom[] = [];
