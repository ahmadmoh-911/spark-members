import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE: '/' for a custom domain, '/<repo>/' for GitHub Pages project sites.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand/logo-dark.png', 'brand/logo-white.png'],
      manifest: {
        name: 'طلاب سبارك',
        short_name: 'سبارك',
        description: 'عضويات طلاب سبارك للابتكار والإبداع، ستورياتهم ودوراتهم.',
        lang: 'ar',
        dir: 'rtl',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#EDF1F7',
        theme_color: '#134F96',
        icons: [
          { src: 'brand/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'brand/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{js,css,html,png,woff2}'],
        runtimeCaching: [],
      },
    }),
  ],
});
