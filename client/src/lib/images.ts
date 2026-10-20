export const IMG = {
  hero: 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209694/jd_beach_house_accommodations/hero.jpg',
  suite: 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209695/jd_beach_house_accommodations/suite.jpg',
  cottage: 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209696/jd_beach_house_accommodations/cottage.jpg',
  villa: 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209697/jd_beach_house_accommodations/villa.jpg',
  garden: 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209698/jd_beach_house_accommodations/garden.jpg',
  bunk: 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209699/jd_beach_house_accommodations/bunk.jpg',
  island: 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209700/jd_beach_house_accommodations/island.jpg',
};

export const roomImg = (_slug?: string) => {
  return '';
};

export const roomGallery = (_slug?: string) => {
  return [];
};

/**
 * Resolves the room's uploaded image URL.
 * Checks image_url, image, and images array. Returns empty string if none provided.
 */
export const getRoomImageUrl = (room: any): string => {
  if (!room) return '';
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

  return '';
};

/**
 * Handles broken images gracefully without forcing preset images.
 */
export const handleImageError = (
  e: React.SyntheticEvent<HTMLImageElement, Event>
) => {
  const target = e.currentTarget;
  target.style.opacity = '0';
};

