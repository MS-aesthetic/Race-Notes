import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';
import {requireCloudConfig} from './scripts/viteRequireCloudConfig';

export default defineConfig(() => {
  return {
    plugins: [
      // Must stay first: aborts `vite build` when Supabase env vars are absent,
      // instead of silently emitting a bundle in which no sign-in method works.
      requireCloudConfig(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['pwa-192x192.png', 'pwa-512x512.png', 'maskable-icon.png'],
        // WS-S: the FCM service worker is a separate, self-registered SW. Keep it
        // out of the Workbox precache manifest so the two never conflict.
        workbox: {
          globIgnores: ['**/firebase-messaging-sw.js'],
          globPatterns: ['**/*.{js,css,html,woff2}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        manifest: {
          name: 'CREW CHIEF',
          short_name: 'Crew Chief',
          description: 'CREW CHIEF — dirt track setup notes, run logging, and pit checklists for race weekends.',
          theme_color: '#131313',
          background_color: '#131313',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'maskable-icon.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
