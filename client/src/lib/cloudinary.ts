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
  cloudName: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) || 'juynm9ab',
  uploadPreset: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET) || 'jd_beach_house_preset',
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_API_KEY) || '551438838453596',
  imageUrl: '',
};

export function getCloudinaryConfig(): CloudinaryConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CLOUDINARY_CONFIG,
        ...parsed,
        cloudName: parsed.cloudName || DEFAULT_CLOUDINARY_CONFIG.cloudName,
        uploadPreset: parsed.uploadPreset || DEFAULT_CLOUDINARY_CONFIG.uploadPreset,
        apiKey: parsed.apiKey || DEFAULT_CLOUDINARY_CONFIG.apiKey,
      };
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
 * Preserves the /v<version>/ prefix to prevent Cloudinary 400 'Invalid transformation parameter' errors.
 */
export function optimizeCloudinaryUrl(url: string, transforms = 'c_fill,w_1200'): string {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('/image/upload/')) return url;
  if (url.includes('/image/upload/' + transforms)) return url;
  try {
    const parts = url.split('/image/upload/');
    const base = parts[0];
    const afterUpload = parts[1];

    // Detect version tag if present (e.g. v1792451892 or v1)
    const versionMatch = afterUpload.match(/(v\d+)\//);
    const version = versionMatch ? versionMatch[1] : 'v1';

    let publicPath = afterUpload;
    if (versionMatch) {
      publicPath = afterUpload.slice(afterUpload.indexOf(versionMatch[0]) + versionMatch[0].length);
    } else {
      publicPath = afterUpload.replace(/^(?:[a-z0-9_,]+?\/?)+?(?=[a-z0-9_.-]+(?:\/|$))/i, '');
    }

    return `${base}/image/upload/${transforms}/${version}/${publicPath.replace(/^\/+/, '')}`;
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
    const data = await api.uploadImage(base64Data, file.name, {
      cloud_name: cfg.cloudName,
      api_key: cfg.apiKey || '551438838453596',
    });
    if (data?.url) {
      const isCloudinary = data.source === 'cloudinary' || data.url.includes('cloudinary.com');
      const serverUrl = window.location.origin.includes('5173') ? 'http://localhost:8000' : '';
      const fullUrl = data.url.startsWith('http') ? data.url : `${serverUrl}${data.url}`;
      return {
        url: fullUrl,
        publicId: data.public_id || data.filename,
        source: isCloudinary ? 'cloudinary' : 'server',
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
    url: 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209697/jd_beach_house_accommodations/villa.jpg',
    description: 'Patar beachfront panoramic sunset balcony and private sundeck.',
  },
  {
    id: 'preset-suite',
    title: 'Family Coral Suite',
    category: 'Suite',
    url: 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209695/jd_beach_house_accommodations/suite.jpg',
    description: 'Spacious 2-bedroom suite with coastal living quarters.',
  },
  {
    id: 'preset-cottage',
    title: 'Deluxe Beach Cottage',
    category: 'Cottage',
    url: 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209696/jd_beach_house_accommodations/cottage.jpg',
    description: 'Traditional native cottage with veranda and lush coconut grove.',
  },
  {
    id: 'preset-garden',
    title: 'Tropical Garden Haven',
    category: 'Garden',
    url: 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209698/jd_beach_house_accommodations/garden.jpg',
    description: 'Private botanical garden oasis surrounded by native flora.',
  },
  {
    id: 'preset-rockview',
    title: 'Patar Rock View Villa',
    category: 'Villa',
    url: 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209694/jd_beach_house_accommodations/hero.jpg',
    description: 'Dramatic limestone coastal cliff and Patar beach vistas.',
  },
  {
    id: 'preset-island',
    title: 'Coastal Horizon Deck',
    category: 'Suite',
    url: 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209700/jd_beach_house_accommodations/island.jpg',
    description: 'Open-air sea terrace facing the turquoise West Philippine Sea.',
  },
  {
    id: 'preset-bunk',
    title: 'Ocean Bunk Quarters',
    category: 'Dorm',
    url: 'https://res.cloudinary.com/juynm9ab/image/upload/v1792209699/jd_beach_house_accommodations/bunk.jpg',
    description: 'Modern beachside dormitory for group surf and travel squads.',
  },
];
