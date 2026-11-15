import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { setPageSettingsCache } from '../../lib/pageSettings';

export interface PageAdjustmentViewProps {
  isLightMode: boolean;
  themeCardBg: string;
  themeBorder: string;
  themeShadow: string;
  themeText: string;
  themeMuted: string;
  toast: (msg: string, isError?: boolean) => void;
}

const MAX_BYTES = 5 * 1024 * 1024;

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
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.getPageSettings();
        if (active) setHeroUrl(res?.settings?.heroImageUrl || '');
      } catch {
        /* keep empty */
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
      toast('Image exceeds the 5MB limit.', true);
      return;
    }
    try {
      setUploading(true);
      const dataUrl = await fileToDataUrl(file);
      const result: any = await api.uploadImage(dataUrl, file.name);
      const url = result?.url || '';
      if (!url) throw new Error('Upload did not return a URL');
      setHeroUrl(url);
      toast('Image uploaded. Click Save to publish it to the landing page.');
    } catch (err: any) {
      toast(err?.message || 'Image upload failed.', true);
    } finally {
      setUploading(false);
    }
  };

  const persist = async (value: string) => {
    try {
      setSaving(true);
      const res: any = await api.savePageSettings({ heroImageUrl: value });
      const next = res?.settings || { heroImageUrl: value };
      setPageSettingsCache(next);
      setHeroUrl(next.heroImageUrl || '');
      toast(value ? 'Landing hero image published.' : 'Hero image reset to default artwork.');
    } catch (err: any) {
      toast(err?.message || 'Could not save page settings.', true);
    } finally {
      setSaving(false);
    }
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
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <i className="fas fa-image" style={{ fontSize: 20, color: '#0EA5E9' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: themeText }}>Page Adjustment</h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: themeMuted }}>
              Change the imagery shown on the public landing page. Changes publish live after you save.
            </p>
          </div>
        </div>
      </div>

      <div style={card}>
        <span style={label}>Landing Hero Image</span>
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: themeMuted, lineHeight: 1.5 }}>
          Shown as the full-width background behind the headline. Leave empty to use the built-in
          vector artwork. Recommended: a wide landscape photo (at least 1600&times;900).
        </p>

        {/* Live preview */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 7',
            borderRadius: 12,
            overflow: 'hidden',
            border: `1px solid ${themeBorder}`,
            background: 'linear-gradient(135deg,#131E29,#254259 40%,#9E6A4B 75%,#D99B66)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          {heroUrl ? (
            <img
              src={heroUrl}
              alt="Hero preview"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>
              {loading ? 'Loading…' : 'Default vector artwork (no custom image set)'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || saving}
            style={{ ...btn('#0EA5E9'), opacity: uploading || saving ? 0.6 : 1 }}
          >
            <i className="fas fa-upload" style={{ marginRight: 8 }} />
            {uploading ? 'Uploading…' : 'Upload image'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
          {heroUrl && (
            <button
              type="button"
              onClick={() => persist('')}
              disabled={saving || uploading}
              style={{ ...btn('transparent', '#F43F5E'), border: '1px solid #F43F5E' }}
            >
              <i className="fas fa-rotate-left" style={{ marginRight: 8 }} />
              Reset to default
            </button>
          )}
        </div>

        <span style={label}>Or paste an image URL</span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={heroUrl}
            onChange={(e) => setHeroUrl(e.target.value)}
            placeholder="https://res.cloudinary.com/… or /uploads/…"
            style={{ ...input, flex: 1, minWidth: 220 }}
          />
          <button
            type="button"
            onClick={() => persist(heroUrl.trim())}
            disabled={saving || uploading}
            style={{ ...btn('#16A34A'), opacity: saving || uploading ? 0.6 : 1 }}
          >
            {saving ? 'Saving…' : 'Save & publish'}
          </button>
        </div>

        <p style={{ margin: '16px 0 0', fontSize: 11.5, color: themeMuted, lineHeight: 1.5 }}>
          <i className="fas fa-shield-halved" style={{ marginRight: 6, color: '#16A34A' }} />
          Secured: only administrators can publish images. The server accepts HTTPS Cloudinary/resort
          URLs or <code>/uploads</code> and <code>/images</code> paths only — external or script URLs are rejected.
        </p>
      </div>
    </div>
  );
};

export default PageAdjustmentView;
