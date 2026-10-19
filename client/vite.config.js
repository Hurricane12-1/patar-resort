import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: '../',
  envPrefix: ['VITE_', 'PUBLIC_'],
  server: {
    port: 5173,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '0',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Permitted-Cross-Domain-Policies': 'none',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: blob: https://images.unsplash.com https://res.cloudinary.com https://*.cloudinary.com https://*.supabase.co; connect-src 'self' https://*.supabase.co https://api.cloudinary.com https://res.cloudinary.com https://*.cloudinary.com ws: wss:; object-src 'none'; frame-ancestors 'none'; base-uri 'self';",
    },
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'https://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: process.env.VITE_BACKEND_URL || 'https://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: process.env.VITE_BACKEND_URL || 'https://localhost:8000',
        changeOrigin: true,
        ws: true,
        secure: false,
      },
    },
  },
  preview: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '0',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Permitted-Cross-Domain-Policies': 'none',
    },
  },
});
