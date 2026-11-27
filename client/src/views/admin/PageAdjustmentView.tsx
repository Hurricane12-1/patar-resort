import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { savePageSettings, setPageSettingsCache, loadPageSettings, type PageMedia } from '../../lib/pageSettings';

export interface PageAdjustmentViewProps {
  isLightMode: boolean;
  themeCardBg: string;
  themeBorder: string;
  themeShadow: string;
  themeText: string;
  themeMuted: string;
  toast: (msg: string, isError?: boolean) => void;
}

const MAX_BYTES = 8 * 1024 * 1024;

const DEFAULT_HEADLINE = 'Where Limestone Cliffs Meet the West Philippine Sea';
const DEFAULT_SUBTITLE =
  'Private oceanfront villas perched above Bolinao’s sculpted coral coves—combining coastal sanctuary serenity with instant, conflict-free direct booking.';
const DEFAULT_KICKER = 'Patar Coastal Road · Bolinao, Pangasinan, Philippines';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export const PageAdjustmentView: React.FC<PageAdjustmentViewProps> = ({
  themeCardBg,
  themeBorder,
  themeShadow,
  themeText,
  themeMuted,
  toast,
}) => {
  const [heroUrl, setHeroUrl] = useState('');
  const [headline, setHeadline] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [kicker, setKicker] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cached = await loadPageSettings();
        if (active) {
          setHeroUrl(cached.heroImageUrl || '');
          setHeadline(cached.heroHeadline || '');
          setSubtitle(cached.heroSubtitle || '');
          setKicker(cached.heroKicker || '');
        }
      } catch {
        /* keep defaults */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      toast('Only JPG, PNG, WEBP or GIF images are allowed.', true);
      return;
    }
    if (file.size > MAX_BYTES) {
      toast('Image exceeds the 8MB limit.', true);
      return;
    }
    try {
      setUploading(true);
      const dataUrl = await fileToDataUrl(file);
      const result: any = await api.uploadImage(dataUrl, file.name);
      const url = result?.url || dataUrl;
      setHeroUrl(url);
      toast('Image uploaded. Click "Save & Publish" to update the landing page.');
    } catch (err: any) {
      toast(err?.message || 'Image upload failed.', true);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (override?: Partial<PageMedia>) => {
    try {
      setSaving(true);
      const payload: PageMedia = {
        heroImageUrl: override?.heroImageUrl !== undefined ? override.heroImageUrl : heroUrl.trim(),
        heroHeadline: override?.heroHeadline !== undefined ? override.heroHeadline : headline.trim(),
        heroSubtitle: override?.heroSubtitle !== undefined ? override.heroSubtitle : subtitle.trim(),
        heroKicker: override?.heroKicker !== undefined ? override.heroKicker : kicker.trim(),
      };
      await savePageSettings(payload);
      toast('✓ Landing hero title & imagery published live!');
    } catch (err: any) {
      toast(err?.message || 'Could not save page adjustment.', true);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setHeroUrl('');
    setHeadline('');
    setSubtitle('');
    setKicker('');
    await handleSave({ heroImageUrl: '', heroHeadline: '', heroSubtitle: '', heroKicker: '' });
    toast('Hero reset to default artwork and resort headlines.');
  };

  const card: React.CSSProperties = {
    background: themeCardBg,
    border: `1px solid ${themeBorder}`,
    borderRadius: 16,
    padding: 24,
    boxShadow: themeShadow,
    color: themeText,
  };

  const label: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: themeMuted,
    marginBottom: 8,
  };

  const input: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: `1px solid ${themeBorder}`,
    background: 'transparent',
    color: themeText,
    fontSize: 13,
  };

  const btn = (bg: string, fg = '#fff'): React.CSSProperties => ({
    padding: '10px 16px',
    borderRadius: 10,
    border: 'none',
    background: bg,
    color: fg,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  });

  const effectiveHeadline = headline.trim() || DEFAULT_HEADLINE;
  const effectiveSubtitle = subtitle.trim() || DEFAULT_SUBTITLE;
  const effectiveKicker = kicker.trim() || DEFAULT_KICKER;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Banner */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <i className="fas fa-heading" style={{ fontSize: 22, color: '#0EA5E9' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: themeText }}>
              Hero Titles & Landing Imagery (Page Adjustment)
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: themeMuted }}>
              Change the headline title, subtitle description, location kicker, and background imagery shown upfront on the public landing page.
            </p>
          </div>
        </div>
      </div>

      {/* Live Preview Card */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={label}>Live Upfront Preview</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '3px 8px', borderRadius: 6 }}>
            Real-time Rendering
          </span>
        </div>

        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 7',
            borderRadius: 14,
            overflow: 'hidden',
            border: `1px solid ${themeBorder}`,
            background: 'linear-gradient(135deg,#131E29,#254259 40%,#9E6A4B 75%,#D99B66)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '24px 20px',
            boxSizing: 'border-box',
          }}
        >
          {heroUrl ? (
            <img
              src={heroUrl}
              alt="Hero preview"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(24,34,43,0.85))',
            }}
          />

          <div style={{ position: 'relative', zIndex: 2, maxWidth: 640 }}>
            <div
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: 9999,
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255,255,255,0.25)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#F3D9A4',
                marginBottom: 10,
              }}
            >
              {effectiveKicker}
            </div>
            <h1
              style={{
                margin: '0 0 8px',
                fontSize: 'clamp(18px, 3.5vw, 28px)',
                fontWeight: 700,
                color: '#FFFFFF',
                lineHeight: 1.2,
                fontFamily: 'serif',
                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              }}
            >
              {effectiveHeadline}
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 'clamp(11px, 2vw, 13px)',
                color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.4,
                textShadow: '0 1px 4px rgba(0,0,0,0.6)',
              }}
            >
              {effectiveSubtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Editor Controls */}
      <div style={card}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Headline */}
          <div>
            <label style={label}>Hero Headline (Upfront Main Title)</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder={DEFAULT_HEADLINE}
              style={input}
            />
            <span style={{ fontSize: 11, color: themeMuted, marginTop: 4, display: 'block' }}>
              Displayed prominently as the main headline on the public resort homepage.
            </span>
          </div>

          {/* Subtitle */}
          <div>
            <label style={label}>Hero Subtitle / Description</label>
            <textarea
              rows={3}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder={DEFAULT_SUBTITLE}
              style={{ ...input, resize: 'vertical' }}
            />
            <span style={{ fontSize: 11, color: themeMuted, marginTop: 4, display: 'block' }}>
              Detailed oceanfront villa description under the headline.
            </span>
          </div>

          {/* Kicker */}
          <div>
            <label style={label}>Location Kicker / Top Badge</label>
            <input
              type="text"
              value={kicker}
              onChange={(e) => setKicker(e.target.value)}
              placeholder={DEFAULT_KICKER}
              style={input}
            />
          </div>

          {/* Background Image */}
          <div style={{ borderTop: `1px solid ${themeBorder}`, paddingTop: 16 }}>
            <span style={label}>Hero Background Image</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || saving}
                style={{ ...btn('#0EA5E9'), opacity: uploading || saving ? 0.6 : 1 }}
              >
                <i className={uploading ? 'fas fa-spinner fa-spin' : 'fas fa-upload'} />
                {uploading ? 'Uploading…' : 'Upload custom photo'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFile}
                style={{ display: 'none' }}
              />
              {(heroUrl || headline || subtitle || kicker) && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving || uploading}
                  style={{ ...btn('transparent', '#F43F5E'), border: '1px solid #F43F5E' }}
                >
                  <i className="fas fa-rotate-left" />
                  Reset all to defaults
                </button>
              )}
            </div>

            <span style={{ ...label, fontSize: 11 }}>Or Paste Image URL</span>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={heroUrl}
                onChange={(e) => setHeroUrl(e.target.value)}
                placeholder="Paste the image link here"
                style={{ ...input, flex: 1, minWidth: 260 }}
              />
            </div>
          </div>

          {/* Action Button */}
          <div style={{ borderTop: `1px solid ${themeBorder}`, paddingTop: 16 }}>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || uploading}
              style={{
                ...btn('#16A34A'),
                width: '100%',
                justifyContent: 'center',
                padding: '12px 20px',
                fontSize: 14,
                opacity: saving || uploading ? 0.6 : 1,
              }}
            >
              <i className={saving ? 'fas fa-spinner fa-spin' : 'fas fa-cloud-arrow-up'} />
              {saving ? 'Publishing Changes…' : 'Save & Publish Upfront'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageAdjustmentView;
