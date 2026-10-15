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
