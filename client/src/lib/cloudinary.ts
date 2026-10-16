/**
 * Cloudinary Media CDN & Intelligent Asset Storage Integration
 * Handles direct unsigned uploads, URL transformations, local fallback, and resort presets.
 */

import { api } from './api.ts';

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
  apiKey?: string;
  imageUrl?: string;
}

const STORAGE_KEY = 'jd_beach_house_cloudinary_config';

export const DEFAULT_CLOUDINARY_CONFIG: CloudinaryConfig = {
  cloudName: '',
  uploadPreset: '',
  apiKey: '',
  imageUrl: '',
};

export function getCloudinaryConfig(): CloudinaryConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CLOUDINARY_CONFIG, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_CLOUDINARY_CONFIG };
}

export function saveCloudinaryConfig(cfg: CloudinaryConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    window.dispatchEvent(new CustomEvent('cloudinary-config-updated', { detail: cfg }));
  } catch (err) {
    console.warn('[Cloudinary Config] Error saving to localStorage:', err);
  }
}

/**
 * Optimizes a Cloudinary URL with standard auto-format and auto-quality transforms.
 */
export function optimizeCloudinaryUrl(url: string, transforms = 'f_auto,q_auto,c_fill,w_1200'): string {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('/image/upload/')) return url;
  if (url.includes('/image/upload/' + transforms)) return url;
  try {
    const parts = url.split('/image/upload/');
    const remaining = parts[1].replace(/^[a-z0-9_,]+?\//i, '');
    return `${parts[0]}/image/upload/${transforms}/${remaining}`;
  } catch {
    return url;
  }
}

/**
 * Upload an image file directly to Cloudinary CDN, with automatic fallback to server upload.
 */
export async function uploadImageToCloudinary(
  file: File,
  configOverride?: Partial<CloudinaryConfig>
): Promise<{ url: string; publicId?: string; source: 'cloudinary' | 'server' | 'local' }> {
  const cfg = { ...getCloudinaryConfig(), ...configOverride };

  // 1. Attempt Direct Cloudinary Upload if cloudName and uploadPreset are explicitly configured
  if (cfg.cloudName && cfg.uploadPreset && !cfg.cloudName.includes('demo-') && cfg.cloudName !== 'jd-beach-house') {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', cfg.uploadPreset);
      if (cfg.apiKey) formData.append('api_key', cfg.apiKey);

      const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/image/upload`;
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.secure_url) {
          return {
            url: data.secure_url,
            publicId: data.public_id,
            source: 'cloudinary',
          };
        }
      }
      console.warn('[Cloudinary Upload] API responded with non-200:', res.status, await res.text().catch(() => ''));
    } catch (err) {
      console.warn('[Cloudinary Upload] Direct upload notice, falling back to server upload:', err);
    }
  }

  // 2. Reliable Backend Server Uploads Endpoint (/api/upload/image)
  try {
    const base64Data = await fileToBase64(file);
    const data = await api.uploadImage(base64Data, file.name);
    if (data?.url) {
      const serverUrl = window.location.origin.includes('5173') ? 'http://localhost:8000' : '';
      const fullUrl = data.url.startsWith('http') ? data.url : `${serverUrl}${data.url}`;
      return {
        url: fullUrl,
        publicId: data.filename,
        source: 'server',
      };
    }
  } catch (err) {
    console.warn('[Server Image Upload] Backend upload notice, using local data URL:', err);
  }

  // 3. Ultra-Resilient Fallback: Base64 Data URL
  const dataUrl = await fileToBase64(file);
  return {
    url: dataUrl,
    source: 'local',
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read file as data URL'));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Curated Scenic Patar Resort Presets for instant room customization.
 */
export const RESORT_PRESET_IMAGES = [
  {
    id: 'preset-villa',
    title: 'Oceanfront Sunset Villa',
    category: 'Villa',
    url: '/img/villa.jpg',
    description: 'Patar beachfront panoramic sunset balcony and private sundeck.',
  },
  {
    id: 'preset-suite',
    title: 'Family Coral Suite',
    category: 'Suite',
    url: '/img/suite.jpg',
    description: 'Spacious 2-bedroom suite with coastal living quarters.',
  },
  {
    id: 'preset-cottage',
    title: 'Deluxe Beach Cottage',
    category: 'Cottage',
    url: '/img/cottage.jpg',
    description: 'Traditional native cottage with veranda and lush coconut grove.',
  },
  {
    id: 'preset-garden',
    title: 'Tropical Garden Haven',
    category: 'Garden',
    url: '/img/garden.jpg',
    description: 'Private botanical garden oasis surrounded by native flora.',
  },
  {
    id: 'preset-rockview',
    title: 'Patar Rock View Villa',
    category: 'Villa',
    url: '/img/hero.jpg',
    description: 'Dramatic limestone coastal cliff and Patar beach vistas.',
  },
  {
    id: 'preset-island',
    title: 'Coastal Horizon Deck',
    category: 'Suite',
    url: '/img/island.jpg',
    description: 'Open-air sea terrace facing the turquoise West Philippine Sea.',
  },
  {
    id: 'preset-bunk',
    title: 'Ocean Bunk Quarters',
    category: 'Dorm',
    url: '/img/bunk.jpg',
    description: 'Modern beachside dormitory for group surf and travel squads.',
  },
];
