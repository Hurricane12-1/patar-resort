import { useState, useEffect, useMemo, useRef } from 'react';
import { roomImg, roomGallery, IMG } from '../lib/images.ts';
import { RESORT_PRESET_IMAGES } from '../lib/cloudinary.ts';

interface RoomImageCarouselProps {
  images?: string[];
  roomName?: string;
  category?: string;
  slug?: string;
  height?: number | string;
  autoScroll?: boolean;
  interval?: number;
  badge?: React.ReactNode;
  showControls?: boolean;
  onImageClick?: (index: number) => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function RoomImageCarousel({
  images = [],
  roomName = 'Accommodation',
  category = 'Cottage',
  slug = '',
  height = 210,
  autoScroll = true,
  interval = 3500,
  badge,
  showControls = true,
  onImageClick,
  className = '',
  style = {},
}: RoomImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Compile rich gallery of images for this accommodation
  const carouselImages = useMemo(() => {
    const list: string[] = [];

    // 1. Custom uploaded or assigned images
    if (Array.isArray(images)) {
      for (const img of images) {
        if (img && typeof img === 'string' && img.trim() && !list.includes(img.trim())) {
          list.push(img.trim());
        }
      }
    }

    // 2. Slug-based images
    if (slug) {
      const g = roomGallery(slug);
      for (const img of g) {
        if (img && !list.includes(img)) list.push(img);
      }
    }

    // 3. Category fallback image
    const catLower = (category || '').toLowerCase();
    const catImg = (IMG as Record<string, string>)[catLower];
    if (catImg && !list.includes(catImg)) {
      list.push(catImg);
    }

    // 4. If still only 1 image or empty, augment with scenic resort presets for auto-scrolling richness
    if (list.length < 3) {
      const presets = RESORT_PRESET_IMAGES.filter((p) =>
        p.category.toLowerCase() === catLower || p.title.toLowerCase().includes(catLower)
      );
      for (const p of presets) {
        if (!list.includes(p.url)) list.push(p.url);
      }
      // General fallbacks if needed
      for (const fallback of [IMG.hero, IMG.island, IMG.suite]) {
        if (!list.includes(fallback) && list.length < 3) list.push(fallback);
      }
    }

    return list.filter(Boolean);
  }, [images, slug, category]);

  // Keep index within bounds if image list changes
  useEffect(() => {
    if (currentIndex >= carouselImages.length) {
      setCurrentIndex(0);
    }
  }, [carouselImages.length, currentIndex]);

  // Automatic scrolling cycle timer (pauses when user hovers to inspect)
  useEffect(() => {
    if (!autoScroll || carouselImages.length <= 1 || isHovered) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % carouselImages.length);
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoScroll, carouselImages.length, interval, isHovered]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + carouselImages.length) % carouselImages.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % carouselImages.length);
  };

  const currentSrc = carouselImages[currentIndex] || roomImg(slug) || IMG.hero;
  const isFailed = failedImages[currentSrc];
  const displaySrc = isFailed ? (roomImg(slug) || IMG.hero) : currentSrc;

  return (
    <div
      className={`room-image-carousel ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onImageClick?.(currentIndex)}
      style={{
        position: 'relative',
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: '14px 14px 0 0',
        overflow: 'hidden',
        background: '#0B132B',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* BACKGROUND IMAGE SLIDE WITH SMOOTH TRANSITION */}
      <img
        key={displaySrc}
        src={displaySrc}
        alt={`${roomName} - View ${currentIndex + 1}`}
        loading="lazy"
        onError={() => {
          setFailedImages((prev) => ({ ...prev, [currentSrc]: true }));
        }}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          animation: 'roomCarouselFadeIn 0.4s ease-out',
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: isHovered ? 'scale(1.03)' : 'scale(1)',
        }}
      />

      {/* TOP GRADIENT & BOTTOM GRADIENT SHADOW FOR LEGIBILITY */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.65) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* TOP LEFT BADGE (CATEGORY / STATUS) */}
      {badge && (
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 3 }}>
          {badge}
        </div>
      )}

      {/* TOP RIGHT PHOTO COUNTER PILL */}
      {carouselImages.length > 1 && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 3,
            background: 'rgba(2, 6, 23, 0.65)',
            backdropFilter: 'blur(6px)',
            color: '#F8FAFC',
            padding: '3px 9px',
            borderRadius: 20,
            fontSize: '.72rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
          title={`${carouselImages.length} photos in gallery (auto-scrolling every ${(interval / 1000).toFixed(1)}s)`}
        >
          <span>📷</span>
          <span>
            {currentIndex + 1} / {carouselImages.length}
          </span>
          {isHovered && <span style={{ color: '#38BDF8', fontSize: '.64rem' }}>⏸</span>}
        </div>
      )}

      {/* HOVER NAVIGATION CHEVRONS */}
      {showControls && carouselImages.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={handlePrev}
            style={{
              position: 'absolute',
              top: '50%',
              left: 8,
              transform: 'translateY(-50%)',
              zIndex: 4,
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              opacity: isHovered ? 1 : 0,
              transition: 'all 0.2s ease',
              fontSize: '1rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            ‹
          </button>

          <button
            type="button"
            aria-label="Next image"
            onClick={handleNext}
            style={{
              position: 'absolute',
              top: '50%',
              right: 8,
              transform: 'translateY(-50%)',
              zIndex: 4,
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              opacity: isHovered ? 1 : 0,
              transition: 'all 0.2s ease',
              fontSize: '1rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            ›
          </button>
        </>
      )}

      {/* BOTTOM DOT INDICATORS */}
      {carouselImages.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: 0,
            right: 0,
            zIndex: 3,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {carouselImages.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Jump to photo ${idx + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(idx);
              }}
              style={{
                width: currentIndex === idx ? 22 : 6,
                height: 6,
                borderRadius: 4,
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                background: currentIndex === idx ? '#38BDF8' : 'rgba(255, 255, 255, 0.45)',
                transition: 'all 0.25s ease',
                boxShadow: currentIndex === idx ? '0 0 8px rgba(56,189,248,0.7)' : 'none',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
