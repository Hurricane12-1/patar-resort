export const IMG = {
  hero: 'https://res.cloudinary.com/juynm9ab/image/upload/jd_beach_house_accommodations/hero.jpg',
  suite: 'https://res.cloudinary.com/juynm9ab/image/upload/jd_beach_house_accommodations/suite.jpg',
  cottage: 'https://res.cloudinary.com/juynm9ab/image/upload/jd_beach_house_accommodations/cottage.jpg',
  villa: 'https://res.cloudinary.com/juynm9ab/image/upload/jd_beach_house_accommodations/villa.jpg',
  garden: 'https://res.cloudinary.com/juynm9ab/image/upload/jd_beach_house_accommodations/garden.jpg',
  bunk: 'https://res.cloudinary.com/juynm9ab/image/upload/jd_beach_house_accommodations/bunk.jpg',
  island: 'https://res.cloudinary.com/juynm9ab/image/upload/jd_beach_house_accommodations/island.jpg',
  room: 'https://res.cloudinary.com/juynm9ab/image/upload/jd_beach_house_accommodations/room.jpg',
};

/**
 * Returns a high-resolution, responsive room image based on type or slug.
 */
export const roomImg = (slugOrName?: string, category?: string): string => {
  const s = String(slugOrName || '').toLowerCase();
  const c = String(category || '').toLowerCase();

  if (s.includes('tour') || s.includes('island') || s.includes('hopping') || c.includes('tour') || c.includes('offer')) {
    return IMG.island;
  }
  if (s.includes('cottage') || s.includes('sunset') || s.includes('chason') || c.includes('cottage') || c.includes('cabana') || c.includes('pavilion')) {
    return IMG.cottage;
  }
  if (s.includes('suite') || s.includes('villa') || c.includes('suite') || c.includes('villa')) {
    return IMG.suite;
  }
  if (s.includes('garden') || c.includes('garden')) {
    return IMG.garden;
  }
  if (s.includes('bunk') || s.includes('dorm') || c.includes('dorm')) {
    return IMG.bunk;
  }
  return IMG.room;
};

export const roomGallery = (slugOrName?: string): string[] => {
  const primary = roomImg(slugOrName);
  return [primary, IMG.hero, IMG.suite, IMG.cottage].filter((v, i, a) => a.indexOf(v) === i);
};

/**
 * Resolves the room's uploaded image URL.
 * Automatically cleans dead legacy version hashes, checks image_url, images, and provides clean category fallbacks.
 */
export const getRoomImageUrl = (room: any): string => {
  if (!room) return IMG.cottage;
  if (typeof room === 'string' && room.trim()) {
    const raw = room.trim();
    if (raw.includes('jd_beach_house_accommodations') && raw.includes('/v1792209')) {
      return raw.replace(/\/v1792209\d{3}\//, '/');
    }
    return raw;
  }

  // 1. Direct explicit image_url
  if (room.image_url && typeof room.image_url === 'string' && room.image_url.trim()) {
    const raw = room.image_url.trim();
    if (raw.includes('jd_beach_house_accommodations') && raw.includes('/v1792209')) {
      return raw.replace(/\/v1792209\d{3}\//, '/');
    }
    return raw;
  }

  // 2. Direct image property
  if (room.image && typeof room.image === 'string' && room.image.trim()) {
    const raw = room.image.trim();
    if (raw.includes('jd_beach_house_accommodations') && raw.includes('/v1792209')) {
      return raw.replace(/\/v1792209\d{3}\//, '/');
    }
    return raw;
  }

  // 3. First item in images array
  if (Array.isArray(room.images) && room.images.length > 0 && typeof room.images[0] === 'string' && room.images[0].trim()) {
    const raw = room.images[0].trim();
    if (raw.includes('jd_beach_house_accommodations') && raw.includes('/v1792209')) {
      return raw.replace(/\/v1792209\d{3}\//, '/');
    }
    return raw;
  }

  // 4. Clean category-based resilient fallback
  return roomImg(room.slug || room.name, room.category || room.offering_type);
};

/**
 * Handles broken images gracefully by falling back to verified resort photography.
 */
export const handleImageError = (
  e: React.SyntheticEvent<HTMLImageElement, Event>
) => {
  const target = e.currentTarget;
  if (target.src === IMG.cottage || target.src === IMG.hero) {
    return;
  }
  target.src = IMG.cottage;
};
