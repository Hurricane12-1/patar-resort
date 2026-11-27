import React, { useState, useRef, useEffect } from 'react';
import { money } from '../../../lib/format';
import { OfferingSpecsFields } from './OfferingSpecsFields';
import {
  OfferingType,
  inferOfferingType,
  sanitizeSpecsForType,
  getDefaultSpecs,
} from '../../../lib/offeringSpecs';
import type { UnitStatus } from '../../../lib/unitStatus';

export interface RoomEditorModalProps {
  room: any | null;
  isOpen?: boolean;
  onClose: () => void;
  onSave: (updatedRoom: any) => Promise<void> | void;
  onDelete?: (room: any) => void;
  rateLocked?: boolean;
  unitStatus?: UnitStatus;
  isLightMode: boolean;
  themeBorder: string;
  themeText: string;
  themeMuted: string;
  uploadImageToCloudinary: (file: File) => Promise<{ url: string; source: string }>;
  toast: (msg: string, isError?: boolean) => void;
}

export const RoomEditorModal: React.FC<RoomEditorModalProps> = ({
  room,
  isOpen = true,
  onClose,
  onSave,
  onDelete,
  rateLocked = false,
  unitStatus,
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
  const [newAmenityInput, setNewAmenityInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (room) {
      const amenitiesStr = Array.isArray(room.amenities)
        ? room.amenities.filter((a: any) => typeof a === 'string' && a.trim() && !a.startsWith('__')).join(', ')
        : (room.amenities || '');
      const imagesArr = Array.isArray(room.images)
        ? [...room.images]
        : (room.image_url ? [room.image_url] : []);

      const detectedType: OfferingType = room.offering_type || inferOfferingType(room);
      setFormData({
        ...room,
        offering_type: detectedType,
        specs: sanitizeSpecsForType(detectedType, room.specs || {}),
        amenities: amenitiesStr,
        images: imagesArr,
        image_url: room.image_url || imagesArr[0] || '',
      });
    } else {
      setFormData(null);
    }
  }, [room]);

  if (!room || !isOpen || !formData) return null;

  const currentAmenities: string[] = typeof formData.amenities === 'string'
    ? formData.amenities
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s && !s.startsWith('__'))
    : (Array.isArray(formData.amenities) ? formData.amenities.filter((a: any) => typeof a === 'string' && a.trim() && !a.startsWith('__')) : []);

  const handleAddAmenity = () => {
    const trimmed = newAmenityInput.trim();
    if (!trimmed) return;
    const toAdd = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    const existingLower = currentAmenities.map((a: string) => a.toLowerCase());
    const nextList = [...currentAmenities];
    for (const item of toAdd) {
      if (!existingLower.includes(item.toLowerCase())) {
        nextList.push(item);
        existingLower.push(item.toLowerCase());
      }
    }
    setFormData({ ...formData, amenities: nextList.join(', ') });
    setNewAmenityInput('');
  };

  const handleRemoveAmenity = (indexToRemove: number) => {
    const nextList = currentAmenities.filter((_: string, idx: number) => idx !== indexToRemove);
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
      toast('Uploading photo…');
      const uploaded = await uploadImageToCloudinary(file);
      const url = uploaded.url;
      const currentList = Array.isArray(formData.images) ? [...formData.images] : [];
      if (!currentList.includes(url)) currentList.unshift(url);

      setFormData({
        ...formData,
        image_url: url,
        images: currentList,
      });

      toast('Photo uploaded.');
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
    '';

  const STATUS_PILLS: Record<UnitStatus, { label: string; background: string }> = {
    booked: { label: 'Booked', background: '#BE123C' },
    available: { label: 'Available', background: '#047857' },
    offline: { label: 'Offline', background: '#475569' },
  };
  const statusPill = unitStatus ? STATUS_PILLS[unitStatus] : null;

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
        {/* Room photo header */}
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
          {featuredImageUrl ? (
            <img
              key={featuredImageUrl}
              src={featuredImageUrl}
              alt={formData.name || 'Room Background Detail'}
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
              }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(15,23,42,0.4) 0%, rgba(15,23,42,0.9) 100%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'absolute', inset: 0, zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <button
              type="button"
              onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              aria-label={featuredImageUrl ? 'Change photo' : 'Add photo'}
              style={{
                pointerEvents: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                background: 'rgba(15, 23, 42, 0.78)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                backdropFilter: 'blur(4px)',
                fontSize: '.82rem',
                fontWeight: 700,
                cursor: uploadingPhoto ? 'wait' : 'pointer',
              }}
            >
              {uploadingPhoto ? <span className="photo-upload-spinner" aria-hidden="true" /> : <i className="fas fa-camera" />}
              {uploadingPhoto ? 'Uploading…' : featuredImageUrl ? 'Change photo' : 'Add photo'}
            </button>
          </div>

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {statusPill && (
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: 20,
                    background: statusPill.background,
                    color: '#FFFFFF',
                    fontSize: '.68rem',
                    fontWeight: 800,
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {statusPill.label}
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
                  {formData.units || 1} Unit{Number(formData.units || 1) > 1 ? 's' : ''}
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
        {/* SECTION A: LISTING DETAILS & TYPE-SPECIFIC SPECIFICATIONS */}
          <OfferingSpecsFields
            offeringType={(formData.offering_type || 'room') as OfferingType}
            onOfferingTypeChange={(nextType, nextCategory, nextSpecs) => {
              setFormData({
                ...formData,
                offering_type: nextType,
                category: nextCategory,
                specs: nextSpecs,
              });
            }}
            specs={formData.specs || getDefaultSpecs((formData.offering_type || 'room') as OfferingType)}
            onSpecsChange={(nextSpecs) => setFormData({ ...formData, specs: nextSpecs })}
            isLightMode={isLightMode}
            themeBorder={themeBorder}
            themeText={themeText}
            themeMuted={themeMuted}
            idPrefix="edit-room"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
              {formData.offering_type === 'cottage'
                ? 'Cottage Name *'
                : 'Room Name *'}
            </label>
            <input
              required
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
            <div>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                {formData.offering_type === 'cottage'
                  ? 'Cottage Rate (₱) *'
                  : 'Nightly Rate (₱) *'}
              </label>
              <input
                required
                type="number"
                min={50}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                value={formData.rate_php ?? ''}
                onChange={(e) => setFormData({ ...formData, rate_php: e.target.value })}
                disabled={rateLocked}
                title={rateLocked ? 'Only an administrator can change the rate' : undefined}
              />
              {rateLocked && (
                <p style={{ margin: '4px 0 0', fontSize: '.72rem', color: themeMuted }}>
                  Only an administrator changes the rate. Send a price change request.
                </p>
              )}
            </div>
            <div>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Available Units *</label>
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

          {/* AMENITIES: DYNAMIC MANUAL ADD & TAGS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700 }}>
                Amenities ({currentAmenities.length})
                <span style={{ display: 'block', fontWeight: 500, fontSize: '.72rem', marginTop: 2 }}>
                  What the room offers, such as Air Conditioning, Wi-Fi or a jacuzzi. Beds, bath and view are set above.
                </span>
              </label>
              {currentAmenities.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, amenities: '' })}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#EF4444',
                    fontSize: '.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Input row with + Add button */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <input
                type="text"
                placeholder="Type an amenity name (e.g. Hot Jacuzzi, Beach Umbrella)…"
                value={newAmenityInput}
                onChange={(e) => setNewAmenityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAmenity();
                  }
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: `1px solid ${themeBorder}`,
                  background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                  color: themeText,
                  fontSize: '.84rem',
                }}
              />
              <button
                type="button"
                onClick={handleAddAmenity}
                disabled={!newAmenityInput.trim()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid #0284C7',
                  background: newAmenityInput.trim() ? '#0284C7' : (isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.1)'),
                  color: newAmenityInput.trim() ? '#FFFFFF' : (isLightMode ? '#94A3B8' : '#64748B'),
                  fontWeight: 700,
                  fontSize: '.82rem',
                  cursor: newAmenityInput.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s ease',
                }}
              >
                <i className="fas fa-plus" /> Add
              </button>
            </div>

            {/* Tag Chips of currently added amenities with remove buttons */}
            {currentAmenities.length === 0 ? (
              <div style={{
                padding: '12px 14px',
                borderRadius: 8,
                border: `1px dashed ${themeBorder}`,
                background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)',
                color: themeMuted,
                fontSize: '.78rem',
                textAlign: 'center',
              }}>
                No amenities added yet. Type an amenity name above and click <b>+ Add</b>.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {currentAmenities.map((amenity, idx) => (
                  <span
                    key={`${amenity}-${idx}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 8,
                      fontSize: '.76rem',
                      fontWeight: 600,
                      background: isLightMode ? '#E0F2FE' : 'rgba(14,165,233,0.15)',
                      color: isLightMode ? '#0369A1' : '#38BDF8',
                      border: `1px solid ${isLightMode ? '#BAE6FD' : 'rgba(56,189,248,0.3)'}`,
                    }}
                  >
                    <i className="fas fa-check" style={{ fontSize: '.68rem' }} />
                    <span>{amenity}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAmenity(idx)}
                      title={`Remove ${amenity}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: isLightMode ? '#0369A1' : '#38BDF8',
                        cursor: 'pointer',
                        padding: '0 2px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        opacity: 0.7,
                        transition: 'opacity 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                    >
                      <i className="fas fa-xmark" style={{ fontSize: '.75rem' }} />
                    </button>
                  </span>
                ))}
              </div>
            )}
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
                  {uploadingPhoto ? 'Uploading…' : <><i className="fas fa-folder-open" style={{ marginRight: 6 }} />Choose Image to Upload</>}
                </span>
              </div>
              <span style={{ fontSize: '.74rem', color: themeMuted }}>
                JPG, PNG or WebP, up to 5MB
              </span>
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
                          onError={(e) => { e.currentTarget.src = 'https://res.cloudinary.com/juynm9ab/image/upload/jd_beach_house_accommodations/room.jpg'; }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
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
