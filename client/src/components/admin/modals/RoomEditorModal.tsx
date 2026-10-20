import React, { useState, useRef, useEffect } from 'react';
import { money } from '../../../lib/format';
import { getCategoryDefaultCloudinaryImage, RESORT_PRESET_IMAGES } from '../../../lib/cloudinary';

export interface RoomEditorModalProps {
  room: any | null;
  isOpen?: boolean;
  onClose: () => void;
  onSave: (updatedRoom: any) => Promise<void> | void;
  onDelete?: (room: any) => void;
  isLightMode: boolean;
  themeBorder: string;
  themeText: string;
  themeMuted: string;
  uploadImageToCloudinary: (file: File) => Promise<{ url: string; source: string }>;
  toast: (msg: string, isError?: boolean) => void;
}

const POPULAR_AMENITIES = [
  'Air Conditioning',
  'Free Wi-Fi',
  'Private Bath',
  'Sea View',
  'Balcony',
  'Kitchenette',
  'Garden Access',
  'Rock View',
  'Private Veranda',
];

export const RoomEditorModal: React.FC<RoomEditorModalProps> = ({
  room,
  isOpen = true,
  onClose,
  onSave,
  onDelete,
  isLightMode,
  themeBorder,
  themeText,
  themeMuted,
  uploadImageToCloudinary,
  toast,
}) => {
  const [formData, setFormData] = useState<any>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (room) {
      const amenitiesStr = Array.isArray(room.amenities)
        ? room.amenities.join(', ')
        : (room.amenities || '');
      const imagesArr = Array.isArray(room.images)
        ? [...room.images]
        : (room.image_url ? [room.image_url] : []);

      setFormData({
        ...room,
        amenities: amenitiesStr,
        images: imagesArr,
        image_url: room.image_url || imagesArr[0] || '',
      });
    } else {
      setFormData(null);
    }
  }, [room]);

  if (!room || !isOpen || !formData) return null;

  const currentAmenities = typeof formData.amenities === 'string'
    ? formData.amenities.split(',').map((s: string) => s.trim()).filter(Boolean)
    : (Array.isArray(formData.amenities) ? formData.amenities : []);

  const handleToggleAmenity = (amenity: string) => {
    const isSelected = currentAmenities.some((a: string) => a.toLowerCase() === amenity.toLowerCase());
    let nextList: string[];
    if (isSelected) {
      nextList = currentAmenities.filter((a: string) => a.toLowerCase() !== amenity.toLowerCase());
    } else {
      nextList = [...currentAmenities, amenity];
    }
    setFormData({ ...formData, amenities: nextList.join(', ') });
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
      toast('Uploading photo to Cloudinary…');
      const uploaded = await uploadImageToCloudinary(file);
      const url = uploaded.url;
      const currentList = Array.isArray(formData.images) ? [...formData.images] : [];
      if (!currentList.includes(url)) currentList.unshift(url);

      setFormData({
        ...formData,
        image_url: url,
        images: currentList,
      });

      if (uploaded.source === 'cloudinary' || (uploaded.url && uploaded.url.includes('cloudinary.com'))) {
        toast('☁️ Room photo uploaded to Cloudinary CDN & synchronized!');
      } else {
        toast('✅ Room photo uploaded & saved successfully!');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to upload photo', true);
    } finally {
      setUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSetPrimary = (url: string) => {
    setFormData({
      ...formData,
      image_url: url,
    });
    toast('⭐ Set as primary showcase photo');
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    if (!Array.isArray(formData.images)) return;
    const filtered = formData.images.filter((_: string, idx: number) => idx !== indexToRemove);
    const newPrimary = filtered.includes(formData.image_url)
      ? formData.image_url
      : (filtered[0] || '');
    setFormData({
      ...formData,
      image_url: newPrimary,
      images: filtered,
    });
    toast('🗑️ Removed photo from gallery');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const amenitiesArr = typeof formData.amenities === 'string'
        ? formData.amenities.split(',').map((s: string) => s.trim()).filter(Boolean)
        : (formData.amenities || []);
      const imagesArr = Array.isArray(formData.images)
        ? formData.images.filter(Boolean)
        : (formData.image_url ? [formData.image_url] : []);
      const primaryImg = formData.image_url || imagesArr[0] || '';

      await onSave({
        ...formData,
        capacity: Number(formData.capacity),
        units: Number(formData.units),
        rate_php: Number(formData.rate_php),
        amenities: amenitiesArr,
        image_url: primaryImg,
        images: imagesArr,
      });
    } catch (err: any) {
      toast(err.message || 'Failed to update accommodation', true);
    } finally {
      setSaving(false);
    }
  };

  const featuredImageUrl =
    formData.image_url ||
    (Array.isArray(formData.images) && formData.images[0]) ||
    getCategoryDefaultCloudinaryImage(formData.category, formData.name);

  const isCloudinaryFeatured = featuredImageUrl.includes('cloudinary.com');

  const handleSelectPreset = (presetUrl: string, presetTitle: string) => {
    const currentList = Array.isArray(formData.images) ? [...formData.images] : [];
    if (!currentList.includes(presetUrl)) currentList.unshift(presetUrl);
    setFormData({
      ...formData,
      image_url: presetUrl,
      images: currentList,
    });
    toast(`☁️ Featured "${presetTitle}" Cloudinary image as background detail`);
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
          maxWidth: 660,
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
            height: 185,
            background: '#0B1120',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <img
            key={featuredImageUrl}
            src={featuredImageUrl}
            alt={formData.name || 'Room Background Detail'}
            onError={(e) => {
              e.currentTarget.src =
                'https://res.cloudinary.com/juynm9ab/image/upload/v1792209696/jd_beach_house_accommodations/cottage.jpg';
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'brightness(0.84)',
              transition: 'all 0.35s ease',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(15,23,42,0.4) 0%, rgba(15,23,42,0.9) 100%)',
              pointerEvents: 'none',
            }}
          />

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
                }}
              >
                ✦ ROOM DETAILS &amp; PHOTO MANAGEMENT
              </span>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: 'rgba(15, 23, 42, 0.78)',
                  color: '#F8FAFC',
                  fontSize: '.68rem',
                  fontWeight: 700,
                  border: '1px solid rgba(255,255,255,0.22)',
                }}
              >
                {formData.category || 'Cottage'}
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
                Edit {formData.name}
              </h3>
              <div
                style={{
                  fontSize: '.74rem',
                  color: '#E2E8F0',
                  marginTop: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>
                  <i className="fas fa-users" style={{ marginRight: 4 }} />
                  Sleeps {formData.capacity || 2} Guests
                </span>
                <span>•</span>
                <span>
                  <i className="fas fa-door-open" style={{ marginRight: 4 }} />
                  {formData.units || 1} Physical Unit{Number(formData.units || 1) > 1 ? 's' : ''}
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
                  border: '1px solid rgba(255,255,255,0.25)',
                }}
              >
                {money(Number(formData.rate_php) || 3500)}{' '}
                <span style={{ fontSize: '.68rem', fontWeight: 600 }}>/ night</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* SECTION A: ROOM DETAILS */}
          <div>
            <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Room Name *</label>
            <input
              required
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Nightly Rate (₱) *</label>
              <input
                required
                type="number"
                min={100}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                value={formData.rate_php ?? ''}
                onChange={(e) => setFormData({ ...formData, rate_php: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Available Physical Units *</label>
              <input
                required
                type="number"
                min={1}
                max={50}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                value={formData.units ?? ''}
                onChange={(e) => setFormData({ ...formData, units: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Category</label>
              <select
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
                value={formData.category || 'Cottage'}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="Cottage">Cottage</option>
                <option value="Villa">Villa</option>
                <option value="Suite">Suite</option>
                <option value="Garden">Garden</option>
                <option value="Dorm">Dorm</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Sleeps Capacity (Guests)</label>
              <input
                type="number"
                min={1}
                max={20}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                value={formData.capacity ?? ''}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Description</label>
            <textarea
              rows={2}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700 }}>Amenities</label>
              <span style={{ fontSize: '.72rem', color: themeMuted }}>Click to toggle popular amenities</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {POPULAR_AMENITIES.map((amenity) => {
                const isSelected = currentAmenities.some((a: string) => a.toLowerCase() === amenity.toLowerCase());

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
                      background: isSelected ? 'rgba(14,165,233,0.18)' : isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.05)',
                      color: isSelected ? '#0EA5E9' : themeText,
                      cursor: 'pointer',
                      fontWeight: isSelected ? 700 : 500,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isSelected ? <><i className="fas fa-check" style={{ marginRight: 4 }} /></> : '+ '}{amenity}
                  </button>
                );
              })}
            </div>

            <input
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
              value={formData.amenities || ''}
              onChange={(e) => setFormData({ ...formData, amenities: e.target.value })}
              placeholder="e.g. Air Conditioning, Free Wi-Fi, Private Bath, Sea View"
            />
          </div>

          {/* SECTION B: ROOM PHOTOS & IMAGE UPLOAD */}
          <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.6)', border: `1px solid ${themeBorder}`, borderRadius: 14, padding: 18 }}>
            <div style={{ marginBottom: 14 }}>
              <b style={{ fontSize: '.92rem', color: themeText, display: 'block' }}>
                <i className="fas fa-camera" style={{ marginRight: 6 }} />Room Photo / Upload Image
              </b>
              <span style={{ fontSize: '.75rem', color: themeMuted }}>Upload room photos directly from your device (JPG, PNG, WebP up to 5MB).</span>
            </div>

            {/* UPLOAD DROPZONE / BUTTON */}
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
                border: `1.5px dashed ${uploadingPhoto ? '#0EA5E9' : (isLightMode ? '#CBD5E1' : 'rgba(148, 163, 184, 0.25)')}`,
                borderRadius: 14,
                padding: '22px 18px',
                textAlign: 'center',
                cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
                background: isLightMode ? '#FFFFFF' : 'rgba(15, 23, 42, 0.5)',
                marginBottom: 16,
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              onMouseEnter={(e) => {
                if (!uploadingPhoto) {
                  e.currentTarget.style.borderColor = '#0EA5E9';
                  e.currentTarget.style.background = isLightMode ? '#F0F9FF' : 'rgba(14, 165, 233, 0.06)';
                }
              }}
              onMouseLeave={(e) => {
                if (!uploadingPhoto) {
                  e.currentTarget.style.borderColor = isLightMode ? '#CBD5E1' : 'rgba(148, 163, 184, 0.25)';
                  e.currentTarget.style.background = isLightMode ? '#FFFFFF' : 'rgba(15, 23, 42, 0.5)';
                }
              }}
            >
              <i className="fas fa-cloud-arrow-up" style={{ fontSize: "1.8rem", display: "block", marginBottom: 2, color: "#0EA5E9" }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '.86rem', fontWeight: 700, color: '#0EA5E9' }}>
                  {uploadingPhoto ? 'Uploading to Cloudinary CDN...' : <><i className="fas fa-folder-open" style={{ marginRight: 6 }} />Choose Image to Upload</>}
                </span>
              </div>
              <span style={{ fontSize: '.74rem', color: themeMuted }}>
                Cloudinary CDN delivery • JPG, PNG, WebP up to 5MB
              </span>
            </div>

            {/* QUICK-SELECT CLOUDINARY RESORT PRESET BACKGROUNDS */}
            <div style={{ marginBottom: 14 }}>
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
                Or Feature an Existing Cloudinary Resort Image:
              </span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))',
                  gap: 8,
                }}
              >
                {RESORT_PRESET_IMAGES.map((preset) => {
                  const isActive = featuredImageUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.url, preset.title)}
                      title={`Feature ${preset.title}`}
                      style={{
                        position: 'relative',
                        padding: 0,
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: isActive ? '2px solid #0EA5E9' : `1px solid ${themeBorder}`,
                        aspectRatio: '16/10',
                        cursor: 'pointer',
                        background: '#0F172A',
                        boxShadow: isActive ? '0 0 0 2px rgba(14,165,233,0.3)' : 'none',
                      }}
                    >
                      <img
                        src={preset.url}
                        alt={preset.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(180deg, transparent 35%, rgba(2,6,23,0.85) 100%)',
                          display: 'flex',
                          alignItems: 'flex-end',
                          padding: '3px 5px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '.58rem',
                            color: '#FFFFFF',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {preset.category}
                        </span>
                      </div>
                      {isActive && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 3,
                            right: 3,
                            background: '#0EA5E9',
                            color: '#FFF',
                            fontSize: '.55rem',
                            fontWeight: 800,
                            padding: '1px 4px',
                            borderRadius: 4,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CURRENT UPLOADED PHOTOS GALLERY */}
            {Array.isArray(formData.images) && formData.images.length > 0 ? (
              <div>
                <span style={{ fontSize: '.74rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 8, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  Uploaded Room Photos ({formData.images.length})
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                  {formData.images.map((imgUrl: string, i: number) => {
                    const isPrimary = formData.image_url === imgUrl || (!formData.image_url && i === 0);
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
                          boxShadow: isPrimary ? '0 0 0 2px rgba(14,165,233,0.3)' : 'none',
                        }}
                      >
                        <img
                          src={imgUrl}
                          alt={`Photo ${i + 1}`}
                          onError={(e) => { e.currentTarget.src = 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209696/jd_beach_house_accommodations/cottage.jpg'; }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {imgUrl.includes('cloudinary.com') && (
                          <span style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(56, 189, 248, 0.9)', color: '#0F172A', fontSize: '.58rem', fontWeight: 800, padding: '2px 5px', borderRadius: 4 }}>
                            <i className="fas fa-cloud" style={{ marginRight: 3 }} />CDN
                          </span>
                        )}
                        {isPrimary && (
                          <span style={{ position: 'absolute', top: 4, left: 4, background: '#0EA5E9', color: '#FFF', fontSize: '.6rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>
                            <i className="fas fa-star" style={{ marginRight: 3 }} />Primary
                          </span>
                        )}
                        <div style={{ position: 'absolute', bottom: 4, right: 4, display: 'flex', gap: 4 }}>
                          {!isPrimary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(imgUrl)}
                              title="Set as primary showcase image"
                              style={{ background: 'rgba(0,0,0,0.7)', border: 'none', color: '#FFF', borderRadius: 4, padding: '2px 6px', fontSize: '.68rem', cursor: 'pointer' }}
                            >
                              <i className="fas fa-star" style={{ marginRight: 3 }} />Set Primary
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(i)}
                            title="Remove photo"
                            style={{ background: 'rgba(239,68,68,0.85)', border: 'none', color: '#FFF', borderRadius: 4, padding: '2px 6px', fontSize: '.68rem', cursor: 'pointer' }}
                          >
                            <i className="fas fa-xmark" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ padding: '14px', textAlign: 'center', background: isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px dashed ${themeBorder}` }}>
                <small style={{ color: themeMuted }}>No images uploaded yet. Click the upload button above to add a photo.</small>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, borderTop: `1px solid ${themeBorder}`, paddingTop: 16 }}>
            {onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(formData)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 18px',
                  borderRadius: 9999,
                  fontSize: '.82rem',
                  fontWeight: 700,
                  color: '#EF4444',
                  background: isLightMode ? '#FEF2F2' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${isLightMode ? '#FECACA' : 'rgba(239, 68, 68, 0.3)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isLightMode ? '#FEE2E2' : 'rgba(239, 68, 68, 0.22)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isLightMode ? '#FEF2F2' : 'rgba(239, 68, 68, 0.12)';
                }}
                title="Remove accommodation"
              >
                Remove
              </button>
            ) : <div />}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = themeText;
                  e.currentTarget.style.borderColor = isLightMode ? '#94A3B8' : '#64748B';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = themeMuted;
                  e.currentTarget.style.borderColor = themeBorder;
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
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
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!saving) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(14, 165, 233, 0.45)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!saving) {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(14, 165, 233, 0.35)';
                  }
                }}
              >
                <i className="fas fa-floppy-disk" style={{ marginRight: 6 }} />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};
