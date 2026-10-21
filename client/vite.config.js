import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function sriBuildPlugin() {
  return {
    name: 'vite-plugin-sri-build',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      try {
        const distDir = path.resolve(process.cwd(), 'dist');
        const indexPath = path.join(distDir, 'index.html');
        if (!fs.existsSync(indexPath)) return;
        let html = fs.readFileSync(indexPath, 'utf8');

        // Inject sha384 integrity onto built <script ... src="/assets/..."> tags
        html = html.replace(/<script\b([^>]*?\bsrc="(\/assets\/[^"]+)"[^>]*)><\/script>/g, (full, attrs, relPath) => {
          if (attrs.includes('integrity=')) return full;
          const filePath = path.join(distDir, relPath.replace(/^\//, ''));
          if (!fs.existsSync(filePath)) return full;
          const hash = crypto.createHash('sha384').update(fs.readFileSync(filePath)).digest('base64');
          return `<script${attrs} integrity="sha384-${hash}"></script>`;
        });

        // Inject sha384 integrity onto built <link rel="stylesheet" ... href="/assets/..."> tags
        html = html.replace(/<link\b([^>]*?\bhref="(\/assets\/[^"]+\.css)"[^>]*)>/g, (full, attrs, relPath) => {
          if (attrs.includes('integrity=')) return full;
          const filePath = path.join(distDir, relPath.replace(/^\//, ''));
          if (!fs.existsSync(filePath)) return full;
          const hash = crypto.createHash('sha384').update(fs.readFileSync(filePath)).digest('base64');
          return `<link${attrs} integrity="sha384-${hash}">`;
        });

        fs.writeFileSync(indexPath, html, 'utf8');
      } catch (err) {
        console.warn('[SRI Build Plugin Warning]', err?.message);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), sriBuildPlugin()],
  envDir: '../',
  envPrefix: ['VITE_', 'PUBLIC_'],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'https://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: process.env.VITE_BACKEND_URL || 'https://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: process.env.VITE_BACKEND_URL || 'https://localhost:4000',
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
