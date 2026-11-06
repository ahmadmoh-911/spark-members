import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

let version = 'dev';
try { version = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* no git */ }

// BASE: '/' for a custom domain, '/<repo>/' for GitHub Pages project sites.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand/logo-dark.png', 'brand/logo-white.png', 'brand/apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'طلاب سبارك',
        short_name: 'سبارك',
        description: 'عضويات طلاب سبارك للابتكار والإبداع، ستورياتهم ودوراتهم.',
        lang: 'ar',
        dir: 'rtl',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#FFFFFF',
        theme_color: '#FFFFFF',
        icons: [
          { src: 'brand/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'brand/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/\/p\//],
        globPatterns: ['**/*.{js,css,html,png,woff2}'],
        // offline: the last version of public data and photos stays readable without internet
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) => request.method === 'GET' && url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/'),
            handler: 'NetworkFirst',
            options: { cacheName: 'spark-api', networkTimeoutSeconds: 6, expiration: { maxEntries: 300, maxAgeSeconds: 14 * 24 * 3600 }, cacheableResponse: { statuses: [200] } },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/storage/v1/object/public/') && !/\.(mp4|webm|mov)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'spark-media', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 24 * 3600, purgeOnQuotaError: true }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('googleusercontent.com'),
            handler: 'CacheFirst',
            options: { cacheName: 'spark-avatars', expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 3600, purgeOnQuotaError: true }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
});
