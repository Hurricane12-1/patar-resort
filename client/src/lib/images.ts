export const IMG = {
  hero: '/images/hero.jpg',
  suite: '/images/suite.jpg',
  cottage: '/images/cottage.jpg',
  villa: '/images/villa.jpg',
  garden: '/images/garden.jpg',
  bunk: '/images/bunk.jpg',
  island: '/images/island.jpg',
  room: '/images/room.jpg',
};

export const REMOTE_IMG = {
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
 * Normalizes any image URL. If it's a default Cloudinary asset from jd_beach_house_accommodations,
 * maps it directly to the local static asset in /images/ so it loads instantly with 100% offline & local resilience.
 */
function normalizeLocalOrRemote(url: string, slugOrName?: string, category?: string): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return roomImg(slugOrName, category);
  }
  const clean = url.trim();

  // If already a local path, return as is
  if (clean.startsWith('/images/')) return clean;

  // Intercept standard Cloudinary presets and map to ultra-fast local photography
  if (clean.includes('jd_beach_house_accommodations')) {
    const match = clean.match(/jd_beach_house_accommodations\/(?:v\d+\/)?([a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp))/i);
    if (match && match[1]) {
      const filename = match[1].toLowerCase();
      if ((IMG as Record<string, string>)[filename.replace(/\.[^.]+$/, '')]) {
        return `/images/${filename}`;
      }
    }
    // General keyword mapping for jd_beach_house_accommodations
    if (clean.includes('cottage')) return IMG.cottage;
    if (clean.includes('suite')) return IMG.suite;
    if (clean.includes('villa')) return IMG.villa;
    if (clean.includes('island')) return IMG.island;
    if (clean.includes('garden')) return IMG.garden;
    if (clean.includes('bunk')) return IMG.bunk;
    if (clean.includes('hero')) return IMG.hero;
    return IMG.room;
  }

  return clean;
}

/**
 * Returns a high-resolution, responsive room image based on type or slug.
 */
export const roomImg = (slugOrName?: string, category?: string): string => {
  const s = String(slugOrName || '').toLowerCase();
  const c = String(category || '').toLowerCase();

  if (s.includes('tour') || s.includes('island') || s.includes('hopping') || c.includes('tour') || c.includes('offer')) {
    return IMG.island;
  }
  if (s.includes('cottage') || s.includes('sunset') || s.includes('chason') || s.includes('unit 3') || c.includes('cottage') || c.includes('cabana') || c.includes('pavilion')) {
    return IMG.cottage;
  }
  if (s.includes('suite') || s.includes('villa') || s.includes('unit 5') || c.includes('suite') || c.includes('villa')) {
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
 * Automatically maps standard resort assets to guaranteed local files in /images/,
 * checks image_url, images, and provides clean category fallbacks.
 */
export const getRoomImageUrl = (room: any): string => {
  if (!room) return IMG.cottage;

  if (typeof room === 'string' && room.trim()) {
    return normalizeLocalOrRemote(room);
  }

  // 1. Direct explicit image_url
  if (room.image_url && typeof room.image_url === 'string' && room.image_url.trim()) {
    return normalizeLocalOrRemote(room.image_url, room.slug || room.name, room.category || room.offering_type);
  }

  // 2. Direct image property
  if (room.image && typeof room.image === 'string' && room.image.trim()) {
    return normalizeLocalOrRemote(room.image, room.slug || room.name, room.category || room.offering_type);
  }

  // 3. First item in images array
  if (Array.isArray(room.images) && room.images.length > 0 && typeof room.images[0] === 'string' && room.images[0].trim()) {
    return normalizeLocalOrRemote(room.images[0], room.slug || room.name, room.category || room.offering_type);
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
  const step = parseInt(target.dataset.fallbackStep || '0', 10);
  if (step >= 3) return;
  target.dataset.fallbackStep = String(step + 1);

  const alt = (target.alt || '').toLowerCase();
  let localFallback = IMG.cottage;
  if (alt.includes('tour') || alt.includes('island') || alt.includes('hopping')) {
    localFallback = IMG.island;
  } else if (alt.includes('suite') || alt.includes('unit 5') || alt.includes('villa')) {
    localFallback = IMG.suite;
  } else if (alt.includes('cottage') || alt.includes('sunset') || alt.includes('chason') || alt.includes('unit 3')) {
    localFallback = IMG.cottage;
  } else if (alt.includes('garden')) {
    localFallback = IMG.garden;
  } else {
    localFallback = IMG.room;
  }

  if (step === 0) {
    target.src = localFallback;
  } else if (step === 1) {
    target.src = REMOTE_IMG.cottage;
  } else {
    // Guaranteed inline SVG fallback that never fails
    target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="%230F172A"/><text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle" fill="%2338BDF8" font-family="sans-serif" font-size="20" font-weight="bold">Rock View Beach Resort</text><text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" fill="%2394A3B8" font-family="sans-serif" font-size="14">Private Coastal Living</text></svg>';
  }
};
