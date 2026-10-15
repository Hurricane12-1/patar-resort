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

/**
 * Client Canonical Rooms Definition
 * All mock seed rooms removed. All room catalog data is strictly provisioned by the Administrator in the database.
 */
export const CANONICAL_ROOMS: CanonicalRoom[] = [];
