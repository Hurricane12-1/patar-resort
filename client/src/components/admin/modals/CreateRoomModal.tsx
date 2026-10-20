import React, { useState, useRef } from 'react';
import { money } from '../../../lib/format';
import {
  uploadImageToCloudinary as defaultUploadToCloudinary,
} from '../../../lib/cloudinary';
import { toast as defaultToast } from '../../Toasts';

export interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  newRoom: any;
  setNewRoom: React.Dispatch<React.SetStateAction<any>>;
  handleCreateRoom?: (e: React.FormEvent) => Promise<void> | void;
  onSubmit?: (e: React.FormEvent) => Promise<void> | void;
  isLightMode: boolean;
  themeBorder: string;
  themeText?: string;
  themeMuted?: string;
  uploadImageToCloudinary?: (file: File) => Promise<{ url: string; source: string }>;
  toast?: (msg: string, isError?: boolean) => void;
}

const POPULAR_AMENITIES = [
  'Air Conditioning',
  'Free Wi-Fi',
  'Private Bath',
  'Sea View',
  'Rock View',
  'Balcony',
  'Kitchenette',
  'Garden Access',
  'Private Veranda',
];

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  newRoom,
  setNewRoom,
  handleCreateRoom,
  onSubmit,
  isLightMode,
  themeBorder,
  themeText: propThemeText,
  themeMuted: propThemeMuted,
  uploadImageToCloudinary = defaultUploadToCloudinary,
  toast = defaultToast,
}) => {
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const themeText = propThemeText || (isLightMode ? '#0F172A' : '#F8FAFC');
  const themeMuted = propThemeMuted || (isLightMode ? '#64748B' : '#94A3B8');

  const imagesList: string[] = Array.isArray(newRoom.images)
    ? newRoom.images.filter(Boolean)
    : newRoom.image_url
    ? [newRoom.image_url]
    : [];

  const featuredImageUrl =
    newRoom.image_url ||
    imagesList[0] ||
    '';

  const isCloudinaryFeatured = Boolean(featuredImageUrl && featuredImageUrl.includes('cloudinary.com'));

  const currentAmenities =
    typeof newRoom.amenities === 'string'
      ? newRoom.amenities
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : Array.isArray(newRoom.amenities)
      ? newRoom.amenities
      : [];

  const handleToggleAmenity = (amenity: string) => {
    const isSelected = currentAmenities.some((a: string) => a.toLowerCase() === amenity.toLowerCase());
    const nextList = isSelected
      ? currentAmenities.filter((a: string) => a.toLowerCase() !== amenity.toLowerCase())
      : [...currentAmenities, amenity];
    setNewRoom({ ...newRoom, amenities: nextList.join(', ') });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('Please upload a valid image file (JPG, PNG, WebP).', true);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast('Image file exceeds 5MB limit.', true);
      return;
    }

    try {
      setUploadingPhoto(true);
      toast('Uploading room photo to Cloudinary CDN…');
      const uploaded = await uploadImageToCloudinary(file);
      const url = uploaded.url;
      const nextImages = [...imagesList];
      if (!nextImages.includes(url)) nextImages.unshift(url);

      setNewRoom({
        ...newRoom,
        image_url: url,
        images: nextImages,
      });

      if (uploaded.source === 'cloudinary' || (url && url.includes('cloudinary.com'))) {
        toast('☁️ Photo uploaded to Cloudinary CDN & featured as room background detail!');
      } else {
        toast('✅ Room photo uploaded & set as featured background!');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to upload photo', true);
    } finally {
      setUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSetPrimary = (url: string) => {
    setNewRoom({
      ...newRoom,
      image_url: url,
    });
    toast('⭐ Set as featured room background photo');
  };

  const handleRemovePhoto = (idxToRemove: number) => {
    const filtered = imagesList.filter((_, idx) => idx !== idxToRemove);
    const nextPrimary = filtered.includes(newRoom.image_url) ? newRoom.image_url : filtered[0] || '';
    setNewRoom({
      ...newRoom,
      image_url: nextPrimary,
      images: filtered,
    });
    toast('🗑️ Removed photo from gallery');
  };

  const onFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitFn = handleCreateRoom || onSubmit;
    if (!submitFn) return;
    try {
      setSaving(true);
      await submitFn(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 12px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 650,
          background: isLightMode ? '#FFFFFF' : '#0F172A',
          borderRadius: 22,
          border: `1px solid ${themeBorder}`,
          boxShadow: '0 25px 60px -12px rgba(0,0,0,0.6)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* FEATURED CLOUDINARY IMAGE BACKGROUND DETAIL HERO */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 190,
            background: '#0B1120',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {featuredImageUrl ? (
            <img
              key={featuredImageUrl}
              src={featuredImageUrl}
              alt={newRoom.name || 'Featured Room Background'}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'brightness(0.84)',
                transition: 'all 0.35s ease',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(135deg, #0b1528 0%, #172554 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 8,
                color: 'rgba(255, 255, 255, 0.45)',
              }}
            >
              <i className="fas fa-camera" style={{ fontSize: '2.2rem' }} />
              <span style={{ fontSize: '.8rem', fontWeight: 600 }}>No Room Photo Uploaded Yet</span>
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(15,23,42,0.3) 0%, rgba(15,23,42,0.9) 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* Top Bar Over Featured Image */}
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 18,
              right: 18,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 3,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: 'rgba(14, 165, 233, 0.95)',
                  color: '#FFFFFF',
                  fontSize: '.68rem',
                  fontWeight: 800,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  boxShadow: '0 2px 8px rgba(14, 165, 233, 0.4)',
                }}
              >
                ✦ ROOM CATALOG
              </span>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: 'rgba(15, 23, 42, 0.78)',
                  color: '#F8FAFC',
                  fontSize: '.68rem',
                  fontWeight: 700,
                  backdropFilter: 'blur(6px)',
                  border: '1px solid rgba(255,255,255,0.22)',
                }}
              >
                {newRoom.category || 'Cottage'}
              </span>
              {isCloudinaryFeatured && (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: 'rgba(16, 185, 129, 0.9)',
                    color: '#FFFFFF',
                    fontSize: '.66rem',
                    fontWeight: 800,
                    letterSpacing: '.04em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <i className="fas fa-cloud" /> CLOUDINARY CDN FEATURED
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#FFFFFF',
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className="fas fa-xmark" />
            </button>
          </div>

          {/* Bottom Room Summary Over Featured Cloudinary Image */}
          <div
            style={{
              position: 'absolute',
              bottom: 14,
              left: 18,
              right: 18,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 12,
              zIndex: 3,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '.68rem',
                  color: '#38BDF8',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                }}
              >
                <i className="fas fa-image" style={{ marginRight: 5 }} />
                Cloudinary Image Background Detail
              </div>
              <h3
                style={{
                  margin: '2px 0 0',
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  textShadow: '0 2px 6px rgba(0,0,0,0.65)',
                }}
              >
                {newRoom.name?.trim() ? newRoom.name : 'Add New Room'}
              </h3>
              <div
                style={{
                  fontSize: '.74rem',
                  color: '#E2E8F0',
                  marginTop: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  <i className="fas fa-users" style={{ marginRight: 4 }} />
                  Sleeps {newRoom.capacity || 2} Guests
                </span>
                <span>•</span>
                <span>
                  <i className="fas fa-door-open" style={{ marginRight: 4 }} />
                  {newRoom.units || 1} Physical Unit{Number(newRoom.units || 1) > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div
                style={{
                  padding: '6px 14px',
                  borderRadius: 12,
                  background: 'rgba(16, 185, 129, 0.92)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '.9rem',
                  backdropFilter: 'blur(6px)',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                  border: '1px solid rgba(255,255,255,0.25)',
                }}
              >
                {money(Number(newRoom.rate_php) || 3500)}{' '}
                <span style={{ fontSize: '.68rem', fontWeight: 600 }}>/ night</span>
              </div>
            </div>
          </div>
        </div>

        {/* SCROLLABLE FORM BODY */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          <form onSubmit={onFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                Room Name *
              </label>
              <input
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: `1px solid ${themeBorder}`,
                  background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                  color: themeText,
                  fontWeight: 600,
                }}
                value={newRoom.name}
                onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                placeholder="e.g. Sunset Luxury Cottage"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Category *
                </label>
                <select
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#F8FAFC' : '#1E293B',
                    color: themeText,
                    fontWeight: 600,
                  }}
                  value={newRoom.category}
                  onChange={(e) => setNewRoom({ ...newRoom, category: e.target.value })}
                >
                  <option value="Cottage">Cottage</option>
                  <option value="Villa">Villa</option>
                  <option value="Suite">Suite</option>
                  <option value="Garden">Garden</option>
                  <option value="Dorm">Dorm</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Nightly Rate (₱) *
                </label>
                <input
                  required
                  type="number"
                  min={100}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                    color: themeText,
                    fontWeight: 700,
                  }}
                  value={newRoom.rate_php}
                  onChange={(e) => setNewRoom({ ...newRoom, rate_php: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Sleeps Capacity (Guests)
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  max={20}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                    color: themeText,
                  }}
                  value={newRoom.capacity}
                  onChange={(e) => setNewRoom({ ...newRoom, capacity: Number(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Total Physical Units
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  max={50}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                    color: themeText,
                  }}
                  value={newRoom.units}
                  onChange={(e) => setNewRoom({ ...newRoom, units: Number(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                Description
              </label>
              <textarea
                rows={2}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: `1px solid ${themeBorder}`,
                  background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                  color: themeText,
                }}
                value={newRoom.description}
                onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                placeholder="Describe view, ambiance, and special features…"
              />
            </div>

            {/* AMENITIES CHIPS + INPUT */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700 }}>
                  Amenities (comma separated)
                </label>
                <span style={{ fontSize: '.7rem', color: themeMuted }}>Click chips to toggle</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {POPULAR_AMENITIES.map((amenity) => {
                  const isSelected = currentAmenities.some(
                    (a: string) => a.toLowerCase() === amenity.toLowerCase()
                  );
                  return (
                    <button
                      key={amenity}
                      type="button"
                      onClick={() => handleToggleAmenity(amenity)}
                      style={{
                        fontSize: '.72rem',
                        padding: '3px 9px',
                        borderRadius: 8,
                        border: isSelected ? '1px solid #0EA5E9' : `1px solid ${themeBorder}`,
                        background: isSelected
                          ? 'rgba(14,165,233,0.16)'
                          : isLightMode
                          ? '#F1F5F9'
                          : 'rgba(255,255,255,0.05)',
                        color: isSelected ? '#0EA5E9' : themeText,
                        cursor: 'pointer',
                        fontWeight: isSelected ? 700 : 500,
                      }}
                    >
                      {isSelected ? (
                        <>
                          <i className="fas fa-check" style={{ marginRight: 4 }} />
                        </>
                      ) : (
                        '+ '
                      )}
                      {amenity}
                    </button>
                  );
                })}
              </div>
              <input
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: `1px solid ${themeBorder}`,
                  background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                  color: themeText,
                }}
                value={newRoom.amenities}
                onChange={(e) => setNewRoom({ ...newRoom, amenities: e.target.value })}
                placeholder="Air Conditioning, Free Wi-Fi, Private Bath, Sea View"
              />
            </div>

            {/* CLOUDINARY IMAGE BACKGROUND DETAIL & UPLOAD SECTION */}
            <div
              style={{
                background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.6)',
                border: `1px solid ${themeBorder}`,
                borderRadius: 14,
                padding: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <b style={{ fontSize: '.88rem', color: themeText, display: 'block' }}>
                    <i className="fas fa-camera" style={{ marginRight: 6, color: '#0EA5E9' }} />
                    Room Photo & Background Detail
                  </b>
                  <span style={{ fontSize: '.73rem', color: themeMuted }}>
                    Upload your custom room photos directly. You decide the featured room photo and gallery.
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '.68rem',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: 'rgba(14,165,233,0.12)',
                    color: '#0EA5E9',
                    border: '1px solid rgba(14,165,233,0.3)',
                  }}
                >
                  <i className="fas fa-bolt" style={{ marginRight: 4 }} />
                  Live Header Preview
                </span>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
              />

              <div
                onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
                style={{
                  border: `1.5px dashed ${
                    uploadingPhoto ? '#0EA5E9' : isLightMode ? '#93C5FD' : 'rgba(56, 189, 248, 0.35)'
                  }`,
                  borderRadius: 12,
                  padding: '16px 14px',
                  textAlign: 'center',
                  cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
                  background: isLightMode ? '#FFFFFF' : 'rgba(15, 23, 42, 0.5)',
                  marginBottom: 14,
                  transition: 'all 0.2s ease',
                }}
              >
                <i
                  className="fas fa-cloud-arrow-up"
                  style={{ fontSize: '1.5rem', display: 'block', marginBottom: 4, color: '#0EA5E9' }}
                />
                <span style={{ fontSize: '.84rem', fontWeight: 700, color: '#0EA5E9', display: 'block' }}>
                  {uploadingPhoto ? (
                    'Uploading to Cloudinary CDN...'
                  ) : (
                    <>
                      <i className="fas fa-folder-open" style={{ marginRight: 6 }} />
                      Upload Room Photo to Cloudinary CDN
                    </>
                  )}
                </span>
                <span style={{ fontSize: '.71rem', color: themeMuted }}>
                  Automatically sets as featured room background • JPG, PNG, WebP up to 5MB
                </span>
              </div>

              {/* UPLOADED / SELECTED GALLERY */}
              {imagesList.length > 0 && (
                <div>
                  <span
                    style={{
                      fontSize: '.71rem',
                      color: themeMuted,
                      fontWeight: 700,
                      display: 'block',
                      marginBottom: 6,
                      textTransform: 'uppercase',
                      letterSpacing: '.04em',
                    }}
                  >
                    Room Photo Gallery ({imagesList.length})
                  </span>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                      gap: 8,
                    }}
                  >
                    {imagesList.map((imgUrl: string, i: number) => {
                      const isPrimary = featuredImageUrl === imgUrl;
                      return (
                        <div
                          key={i}
                          style={{
                            position: 'relative',
                            borderRadius: 8,
                            overflow: 'hidden',
                            border: isPrimary ? '2px solid #0EA5E9' : `1px solid ${themeBorder}`,
                            background: '#0B132B',
                            aspectRatio: '16/10',
                          }}
                        >
                          <img
                            src={imgUrl}
                            alt={`Room Photo ${i + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          {isPrimary && (
                            <span
                              style={{
                                position: 'absolute',
                                top: 4,
                                left: 4,
                                background: '#0EA5E9',
                                color: '#FFF',
                                fontSize: '.58rem',
                                fontWeight: 800,
                                padding: '2px 5px',
                                borderRadius: 4,
                              }}
                            >
                              ★ Background
                            </span>
                          )}
                          <div style={{ position: 'absolute', bottom: 4, right: 4, display: 'flex', gap: 4 }}>
                            {!isPrimary && (
                              <button
                                type="button"
                                onClick={() => handleSetPrimary(imgUrl)}
                                style={{
                                  background: 'rgba(0,0,0,0.75)',
                                  border: 'none',
                                  color: '#FFF',
                                  borderRadius: 4,
                                  padding: '2px 5px',
                                  fontSize: '.62rem',
                                  cursor: 'pointer',
                                }}
                              >
                                Set BG
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(i)}
                              style={{
                                background: 'rgba(239,68,68,0.85)',
                                border: 'none',
                                color: '#FFF',
                                borderRadius: 4,
                                padding: '2px 5px',
                                fontSize: '.62rem',
                                cursor: 'pointer',
                              }}
                            >
                              <i className="fas fa-xmark" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 6,
                borderTop: `1px solid ${themeBorder}`,
                paddingTop: 14,
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '9px 18px',
                  borderRadius: 9999,
                  fontSize: '.82rem',
                  fontWeight: 600,
                  color: themeMuted,
                  background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${themeBorder}`,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || uploadingPhoto}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 24px',
                  borderRadius: 9999,
                  fontSize: '.82rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(14, 165, 233, 0.35)',
                  cursor: saving || uploadingPhoto ? 'not-allowed' : 'pointer',
                  opacity: saving || uploadingPhoto ? 0.7 : 1,
                }}
              >
                <i className="fas fa-floppy-disk" style={{ marginRight: 4 }} />
                {saving ? 'Saving Room…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
