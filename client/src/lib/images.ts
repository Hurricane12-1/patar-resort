export const IMG = {
  hero: '/img/hero.jpg',
  suite: '/img/suite.jpg',
  cottage: '/img/cottage.jpg',
  villa: '/img/villa.jpg',
  garden: '/img/garden.jpg',
  bunk: '/img/bunk.jpg',
  island: '/img/island.jpg',
};

export const roomImg = (slug?: string) => {
  if (!slug) return '';
  const s = String(slug).toLowerCase();
  if (s.includes('villa') || s.includes('tev')) return IMG.villa;
  if (s.includes('suite') || s.includes('gel') || s.includes('sunset')) return IMG.suite;
  if (s.includes('cottage') || s.includes('cat') || s.includes('nipa')) return IMG.cottage;
  if (s.includes('garden') || s.includes('breeze')) return IMG.garden;
  if (s.includes('bunk') || s.includes('dorm')) return IMG.bunk;
  return '';
};

export const roomGallery = (slug?: string) => {
  const primary = roomImg(slug);
  return primary ? [primary] : [];
};

/**
 * High-resilience helper: Resolves the best available room image URL with multi-layer fallback.
 * Checks image_url, image, images array, slug-based images, category-based resort photos,
 * and always guarantees a valid scenic Patar beach house image.
 */
export const getRoomImageUrl = (room: any): string => {
  if (!room) return IMG.hero;
  if (typeof room === 'string' && room.trim()) return room.trim();

  // 1. Direct explicit image_url
  if (room.image_url && typeof room.image_url === 'string' && room.image_url.trim()) {
    return room.image_url.trim();
  }

  // 2. Direct image property
  if (room.image && typeof room.image === 'string' && room.image.trim()) {
    return room.image.trim();
  }

  // 3. First item in images array
  if (Array.isArray(room.images) && room.images.length > 0 && typeof room.images[0] === 'string' && room.images[0].trim()) {
    return room.images[0].trim();
  }

  // 4. By slug match
  const fromSlug = roomImg(room.slug);
  if (fromSlug) return fromSlug;

  // 5. By category match
  const cat = String(room.category || '').toLowerCase();
  if (cat.includes('villa')) return IMG.villa;
  if (cat.includes('suite') || cat.includes('gel')) return IMG.suite;
  if (cat.includes('cottage') || cat.includes('nipa')) return IMG.cottage;
  if (cat.includes('garden')) return IMG.garden;
  if (cat.includes('dorm') || cat.includes('bunk')) return IMG.bunk;

  // 6. Default scenic Patar cottage/hero
  return IMG.cottage || IMG.hero;
};

/**
 * Prevents broken images from displaying ugly browser error icons.
 * Replaces the failed src with a guaranteed scenic resort photo.
 */
export const handleImageError = (
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallback = IMG.cottage
) => {
  const target = e.currentTarget;
  if (target.src !== fallback && !target.src.endsWith(fallback)) {
    target.src = fallback;
  }
};

