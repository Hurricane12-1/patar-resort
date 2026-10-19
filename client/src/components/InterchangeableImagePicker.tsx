import { useState } from 'react';
import { toast } from './Toasts.tsx';
import { IconCrown, IconBriefcase, IconShield, IconBuilding } from './AdminIcons.tsx';

export function InterchangeableImagePicker({ currentImageUrl, onImageSelect, isLightMode = false }) {
  const [customUrlInput, setCustomUrlInput] = useState('');

  // Preset interchangeable initial badge presets (Zero Mock Unsplash URLs)
  const presetInitialAvatars = [
    { id: 'badge-1', label: 'Administrator', initials: 'A', bg: 'linear-gradient(135deg, #0284C7, #0EA5E9)' },
    { id: 'badge-2', label: 'Rock View Reserve', initials: 'RV', bg: 'linear-gradient(135deg, #2563EB, #38BDF8)' },
    { id: 'badge-3', label: 'General Manager', initials: 'GM', bg: 'linear-gradient(135deg, #059669, #10B981)' },
    { id: 'badge-4', label: 'Security Chief', initials: 'SC', bg: 'linear-gradient(135deg, #DC2626, #F43F5E)' },
    { id: 'badge-5', label: 'Operations Lead', initials: 'OL', bg: 'linear-gradient(135deg, #7C3AED, #A855F7)' },
    { id: 'badge-6', label: 'Front Desk', initials: 'FD', bg: 'linear-gradient(135deg, #D97706, #F59E0B)' },
  ];

  const presetSvgAvatars = [
    { key: 'crown', label: 'Executive Crown', icon: <IconCrown size={22} color="#F59E0B" /> },
    { key: 'manager', label: 'General Manager', icon: <IconBriefcase size={22} color="#38BDF8" /> },
    { key: 'security', label: 'Security Chief', icon: <IconShield size={22} color="#F43F5E" /> },
    { key: 'operations', label: 'Operations Lead', icon: <IconBuilding size={22} color="#8B5CF6" /> },
  ];

  // Handle local file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('Please upload a valid image file (PNG, JPG, WebP).', true);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast('Image file exceeds 2MB limit.', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImageSelect(reader.result);
        toast('👑 Uploaded and selected custom profile image!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCustomUrlSubmit = (e) => {
    e.preventDefault();
    const clean = customUrlInput.trim();
    if (!clean || !/^https?:\/\//i.test(clean)) {
      toast('Please enter a valid HTTP/HTTPS image URL.', true);
      return;
    }
    onImageSelect(clean);
    toast('🌐 Custom image URL set successfully!');
    setCustomUrlInput('');
  };

  const themeText = isLightMode ? '#0F172A' : '#F8FAFC';
  const themeMuted = isLightMode ? '#64748B' : '#94A3B8';
  const themeBorder = isLightMode ? '#E2E8F0' : 'rgba(255, 255, 255, 0.1)';

  return (
    <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <b style={{ fontSize: '.95rem', color: themeText, display: 'block' }}>🖼️ Interchangeable Avatar & Badge Selector</b>
          <span style={{ fontSize: '.78rem', color: themeMuted }}>Select a monogram initial badge, vector emblem, upload a picture, or enter a real image URL.</span>
        </div>
      </div>

      {/* 1. INITIAL MONOGRAM BADGES (ZERO MOCK UNSPLASH) */}
      <b style={{ fontSize: '.78rem', color: themeMuted, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 10 }}>
        MONOGRAM INITIAL BADGES
      </b>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(68px, 1fr))', gap: 10, marginBottom: 18 }}>
        {presetInitialAvatars.map((item) => {
          const badgeVal = `initials:${item.initials}`;
          const isSelected = currentImageUrl === badgeVal;
          return (
            <div
              key={item.id}
              onClick={() => {
                onImageSelect(badgeVal);
                toast(`👑 Interchanged avatar to: ${item.label} (${item.initials})`);
              }}
              style={{
                position: 'relative',
                borderRadius: 12,
                cursor: 'pointer',
                background: item.bg,
                color: '#FFF',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: isSelected ? '2px solid #FFF' : `1px solid ${themeBorder}`,
                boxShadow: isSelected ? '0 0 14px rgba(56,189,248,0.6)' : 'none',
                transition: 'all 0.2s ease',
                aspectRatio: '1',
              }}
            >
              <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{item.initials}</span>
              <span style={{ fontSize: '.6rem', opacity: 0.85, fontWeight: 600 }}>{item.label.split(' ')[0]}</span>
            </div>
          );
        })}
      </div>

      {/* 2. VECTOR SVG AVATARS */}
      <b style={{ fontSize: '.78rem', color: themeMuted, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 10 }}>
        OR SELECT VECTOR EMBLEM
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
              background: currentImageUrl === `svg:${opt.key}` ? 'rgba(56,189,248,0.15)' : isLightMode ? '#FFF' : '#0F172A',
              border: currentImageUrl === `svg:${opt.key}` ? '1.5px solid #0EA5E9' : `1px solid ${themeBorder}`,
              color: themeText,
              fontSize: '.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>

      {/* 3. LOCAL FILE UPLOAD & CUSTOM URL INPUT */}
      <b style={{ fontSize: '.78rem', color: themeMuted, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 10 }}>
        UPLOAD CUSTOM PROFILE PICTURE OR PASTE LIVE URL
      </b>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 8,
            background: isLightMode ? '#FFF' : '#0F172A',
            border: `1px solid ${themeBorder}`,
            color: themeText,
            fontSize: '.78rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          📁 Browse Local File…
          <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>

        <form onSubmit={handleCustomUrlSubmit} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 240 }}>
          <input
            type="url"
            placeholder="https://your-domain.com/avatar.jpg"
            value={customUrlInput}
            onChange={(e) => setCustomUrlInput(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '.78rem',
              borderRadius: 8,
              background: isLightMode ? '#FFF' : '#0F172A',
              border: `1px solid ${themeBorder}`,
              color: themeText,
              outline: 'none',
            }}
          />
          <button type="submit" className="btn btn-sky btn-sm">Set URL</button>
        </form>
      </div>
    </div>
  );
}
