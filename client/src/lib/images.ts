export const IMG = {
  hero: '/img/hero.jpg',
  suite: '/img/suite.jpg',
  cottage: '/img/cottage.jpg',
  villa: '/img/villa.jpg',
  garden: '/img/garden.jpg',
  bunk: '/img/bunk.jpg',
  island: '/img/island.jpg',
};

const BY_SLUG = {
  'nipa-cove': IMG.cottage,
  'garden-breeze': IMG.garden,
  'habagat-suite': IMG.suite,
  'sunset-pavilion': IMG.suite,
  'duyan-villa': IMG.villa,
  'backpacker-bunk': IMG.bunk,
  'unit-tev': IMG.villa,
  'unit-gel': IMG.suite,
  'unit-cat': IMG.cottage,
};

export const roomImg = (slug) => {
  if (!slug) return IMG.hero;
  if (BY_SLUG[slug]) return BY_SLUG[slug];
  const s = String(slug).toLowerCase();
  if (s.includes('villa') || s.includes('tev')) return IMG.villa;
  if (s.includes('suite') || s.includes('gel') || s.includes('sunset')) return IMG.suite;
  if (s.includes('cottage') || s.includes('cat') || s.includes('nipa')) return IMG.cottage;
  if (s.includes('garden') || s.includes('breeze')) return IMG.garden;
  if (s.includes('bunk') || s.includes('dorm')) return IMG.bunk;
  return IMG.hero;
};

export const roomGallery = (slug) => {
  const primary = roomImg(slug);
  return [
    primary,
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80',
  ];
};
