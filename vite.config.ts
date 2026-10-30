import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// GitHub Pages can't send response headers, so the CSP ships as a <meta> tag.
// Build-only: the dev server's HMR/preamble needs inline scripts and ws://.
// Hosts: Convex (data + auth), Google Maps (script, tiles, geocoding).
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://maps.googleapis.com https://maps.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site https://maps.googleapis.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const cspPlugin = {
  name: 'csp-meta',
  apply: 'build' as const,
  transformIndexHtml: () => [
    { tag: 'meta', injectTo: 'head-prepend' as const, attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP } },
  ],
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cspPlugin],
  base: '/phamlab-website/',
  resolve: {
    alias: {
      '@convex': path.resolve(import.meta.dirname, 'src/_generated'),
    },
  },
})
