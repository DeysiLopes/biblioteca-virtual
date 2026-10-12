import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/biblioteca-virtual/',
  define: {
    // Carimbo visível no header para identificar a versão em execução
    __BUILD_STAMP__: JSON.stringify(new Date().toISOString().slice(5, 16).replace('T', ' ')),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-ghost.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'Minha Biblioteca',
        short_name: 'Biblioteca',
        description: 'Estante interativa e diário de leitura',
        theme_color: '#150d15',
        background_color: '#150d15',
        display: 'standalone',
        orientation: 'any',
        start_url: '/biblioteca-virtual/',
        scope: '/biblioteca-virtual/',
        lang: 'pt-BR',
        categories: ['books', 'lifestyle'],
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,json}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(covers\.openlibrary\.org|books\.google\.com|images\.unsplash\.com)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'external-book-covers',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
});
