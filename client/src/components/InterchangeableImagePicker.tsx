import { useState } from 'react';
import { toast } from './Toasts.tsx';
import { IconCrown, IconBriefcase, IconTelemetry, IconShield, IconBuilding } from './AdminIcons.tsx';

export function InterchangeableImagePicker({ currentImageUrl, onImageSelect, isLightMode = false }) {
  const [customUrlInput, setCustomUrlInput] = useState('');

  // Preset interchangeable avatar & resort profile image gallery
  const presetImages = [
    {
      id: 'img-1',
      title: 'Executive General Manager',
      category: 'Executive Portrait',
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    },
    {
      id: 'img-2',
      title: 'Operations Director',
      category: 'Executive Portrait',
      url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    },
    {
      id: 'img-3',
      title: 'Security & Telemetry Chief',
      category: 'Executive Portrait',
      url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    },
    {
      id: 'img-4',
      title: 'Resort Beachfront Sunset',
      category: 'Resort Asset',
      url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=300&q=80',
    },
    {
      id: 'img-5',
      title: 'Luxury Ocean Villa',
      category: 'Resort Asset',
      url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=300&q=80',
    },
    {
      id: 'img-6',
      title: 'Penthouse Panorama',
      category: 'Resort Asset',
      url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=300&q=80',
    },
  ];

  const presetSvgAvatars = [
    { key: 'crown', label: 'Executive Crown', icon: <IconCrown size={22} color="#F59E0B" /> },
    { key: 'manager', label: 'General Manager', icon: <IconBriefcase size={22} color="#38BDF8" /> },
    { key: 'tech', label: 'Tech Director', icon: <IconTelemetry size={22} color="#10B981" /> },
    { key: 'security', label: 'Security Chief', icon: <IconShield size={22} color="#F43F5E" /> },
    { key: 'operations', label: 'Operations Lead', icon: <IconBuilding size={22} color="#8B5CF6" /> },
  ];

  // Handle local file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('Please select a valid image file (PNG, JPG, WEBP)', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result;
      if (typeof dataUrl === 'string') {
        onImageSelect(dataUrl);
        toast('🖼️ Interchangeable profile image updated from local file ✦');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCustomUrlSubmit = (e) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;
    onImageSelect(customUrlInput.trim());
    setCustomUrlInput('');
    toast('🖼️ Interchangeable profile image updated from custom URL ✦');
  };

  const themeBorder = isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.1)';
  const themeText = isLightMode ? '#0F172A' : '#F8FAFC';
  const themeMuted = isLightMode ? '#64748B' : '#94A3B8';

  return (
    <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <b style={{ fontSize: '.95rem', color: themeText, display: 'block' }}>🖼️ Interchangeable Image & Avatar Selector</b>
          <span style={{ fontSize: '.78rem', color: themeMuted }}>Select a preset photo, vector avatar, upload a file, or enter an image URL to instantly interchange your profile picture.</span>
        </div>
      </div>

      {/* 1. INTERCHANGEABLE PRESET PHOTO GALLERY */}
      <b style={{ fontSize: '.78rem', color: themeMuted, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 10 }}>
        PRESET INTERCHANGEABLE HIGH-RES GALLERY
      </b>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 18 }}>
        {presetImages.map((img) => {
          const isSelected = currentImageUrl === img.url;
          return (
            <div
              key={img.id}
              onClick={() => {
                onImageSelect(img.url);
                toast(`🖼️ Interchanged image to: ${img.title}`);
              }}
              style={{
                position: 'relative',
                borderRadius: 12,
                overflow: 'hidden',
                cursor: 'pointer',
                border: isSelected ? '2px solid #0EA5E9' : `1px solid ${themeBorder}`,
                boxShadow: isSelected ? '0 0 12px rgba(56,189,248,0.4)' : 'none',
                transition: 'all 0.2s ease',
                aspectRatio: '1',
              }}
            >
              <img src={img.url} alt={img.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 60%)', display: 'flex', alignItems: 'flex-end', padding: 6 }}>
                <span style={{ fontSize: '.65rem', color: '#FFF', fontWeight: 600, lineHeight: 1.1 }}>{img.title.split(' ')[0]}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. VECTOR SVG AVATARS */}
      <b style={{ fontSize: '.78rem', color: themeMuted, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 10 }}>
        OR SELECT VECTOR SVG AVATAR
      </b>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        {presetSvgAvatars.map((opt) => (
          <button
            type="button"
            key={opt.key}
            onClick={() => {
              onImageSelect(`svg:${opt.key}`);
              toast(`👑 Interchanged avatar to ${opt.label}`);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 10,
              border: currentImageUrl === `svg:${opt.key}` ? '2px solid #0EA5E9' : `1px solid ${themeBorder}`,
              background: currentImageUrl === `svg:${opt.key}` ? 'rgba(56,189,248,0.2)' : isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.8)',
              color: themeText,
              cursor: 'pointer',
              fontSize: '.82rem',
            }}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>

      {/* 3. LOCAL FILE UPLOADER & CUSTOM URL */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 6 }}>UPLOAD LOCAL IMAGE FILE</label>
          <label className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', cursor: 'pointer', border: `1px solid ${themeBorder}`, padding: '8px 14px', fontSize: '.84rem', background: isLightMode ? '#FFF' : undefined, color: themeText }}>
            📁 Browse Image File…
            <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>

        <div>
          <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 6 }}>OR PASTE IMAGE URL</label>
          <form onSubmit={handleCustomUrlSubmit} style={{ display: 'flex', gap: 8 }}>
            <input
              type="url"
              placeholder="https://..."
              value={customUrlInput}
              onChange={(e) => setCustomUrlInput(e.target.value)}
              style={{ flex: 1, padding: '7px 10px', fontSize: '.82rem', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : undefined, color: themeText }}
            />
            <button type="submit" className="btn btn-sky btn-sm" style={{ padding: '0 12px' }}>Apply</button>
          </form>
        </div>
      </div>
    </div>
  );
}
