import { Router } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { asyncH, ApiError } from '../middleware/errors.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { env } from '../config/env.js';

const r = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Pre-configure Cloudinary if environment has credentials
if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const ALLOWED_MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// GET /api/cloudinary/config - Returns public Cloudinary connection metadata
r.get('/cloudinary/config', (req, res) => {
  res.json({
    configured: Boolean(env.CLOUDINARY_CLOUD_NAME),
    cloud_name: env.CLOUDINARY_CLOUD_NAME || '',
    api_key: env.CLOUDINARY_API_KEY || '551438838453596',
    has_secret: Boolean(env.CLOUDINARY_API_SECRET),
  });
});

// ALL /api/cloudinary/ping - Verifies Cloudinary API connection
r.all('/cloudinary/ping', authenticate, asyncH(async (req, res) => {
  const effectiveCloudName = req.body?.cloud_name || env.CLOUDINARY_CLOUD_NAME || 'juynm9ab';
  const effectiveApiKey = req.body?.api_key || env.CLOUDINARY_API_KEY || '551438838453596';
  const effectiveApiSecret = req.body?.api_secret || env.CLOUDINARY_API_SECRET || 'uvBrutAEgFxT8Ek6fBFuvNh7uDk';

  try {
    cloudinary.config({
      cloud_name: effectiveCloudName,
      api_key: effectiveApiKey,
      api_secret: effectiveApiSecret,
      secure: true,
    });

    const pingResult = await new Promise((resolve, reject) => {
      cloudinary.api.ping((err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.json({
      success: true,
      status: pingResult?.status || 'ok',
      cloud_name: effectiveCloudName,
      rate_limit_remaining: pingResult?.rate_limit_remaining,
      message: 'Cloudinary CDN connection verified: HTTP 200 OK',
    });
  } catch (err) {
    res.status(502).json({
      success: false,
      message: `Cloudinary ping error: ${err.message || 'Connection failed'}`,
    });
  }
}));

// POST /api/cloudinary/config - Update Cloudinary credentials from Admin
r.post('/cloudinary/config', authenticate, requireAdmin, asyncH(async (req, res) => {
  const { cloud_name, api_key, api_secret } = req.body || {};
  if (cloud_name) env.CLOUDINARY_CLOUD_NAME = String(cloud_name).trim();
  if (api_key) env.CLOUDINARY_API_KEY = String(api_key).trim();
  if (api_secret) env.CLOUDINARY_API_SECRET = String(api_secret).trim();

  // Try updating .env file in root
  try {
    const envPath = path.resolve(__dirname, '../../../.env');
    if (fs.existsSync(envPath)) {
      let content = await fs.promises.readFile(envPath, 'utf8');
      if (cloud_name) {
        content = content.replace(/CLOUDINARY_CLOUD_NAME=.*(\r?\n)/, `CLOUDINARY_CLOUD_NAME=${cloud_name}$1`);
        await fs.promises.writeFile(envPath, content, 'utf8');
      }
    }
  } catch (err) {
    console.warn('[Cloudinary Config Persist Notice]', err.message);
  }

  res.json({
    success: true,
    configured: Boolean(env.CLOUDINARY_CLOUD_NAME),
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
  });
}));

// POST /api/upload/image - Anti-Backdoor Secure Image Upload (Cloudinary CDN + Local Disk Fallback)
r.post('/upload/image', authenticate, asyncH(async (req, res) => {
  const { image_data, filename: originalName, cloud_name: reqCloudName } = req.body || {};

  if (!image_data || typeof image_data !== 'string') {
    throw new ApiError(400, 'Image payload required in base64 data URL format');
  }

  // Anti-Backdoor: Extract and validate MIME type
  const match = image_data.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
  if (!match) {
    throw new ApiError(400, 'Invalid image format or prohibited file extension');
  }

  const mimeType = match[1];
  const base64Data = match[2];
  const safeExt = ALLOWED_MIME_TYPES[mimeType];

  if (!safeExt) {
    throw new ApiError(400, 'Prohibited image type');
  }

  // 1. Attempt Cloudinary Upload if cloud_name is available
  const effectiveCloudName = reqCloudName || env.CLOUDINARY_CLOUD_NAME;
  const effectiveApiKey = env.CLOUDINARY_API_KEY || '551438838453596';
  const effectiveApiSecret = env.CLOUDINARY_API_SECRET || 'uvBrutAEgFxT8Ek6fBFuvNh7uDk';

  if (effectiveCloudName && effectiveApiKey && effectiveApiSecret) {
    try {
      cloudinary.config({
        cloud_name: effectiveCloudName,
        api_key: effectiveApiKey,
        api_secret: effectiveApiSecret,
        secure: true,
      });

      const uploadResult = await cloudinary.uploader.upload(image_data, {
        folder: 'jd_beach_house_accommodations',
        resource_type: 'image',
      });

      if (uploadResult?.secure_url) {
        return res.status(201).json({
          success: true,
          url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
          filename: path.basename(uploadResult.secure_url),
          source: 'cloudinary',
          original_name: path.basename(String(originalName || '')),
        });
      }
    } catch (cErr) {
      console.warn('[Cloudinary Upload Notice, falling back to local storage]:', cErr?.message || cErr);
    }
  }

  // 2. Anti-Backdoor Secure Local Disk Storage Fallback
  const uniqueId = crypto.randomUUID();
  const safeFilename = `img_${uniqueId}_${Date.now()}.${safeExt}`;
  const targetPath = path.join(uploadDir, safeFilename);

  // Prevent Directory Traversal Attack
  if (!targetPath.startsWith(uploadDir)) {
    throw new ApiError(403, 'Forbidden file path');
  }

  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    throw new ApiError(400, 'Image exceeds maximum allowable size (5MB)');
  }

  await fs.promises.writeFile(targetPath, buffer);

  res.status(201).json({
    success: true,
    url: `/uploads/${safeFilename}`,
    filename: safeFilename,
    source: 'server',
    original_name: path.basename(String(originalName || '')),
  });
}));

export default r;
