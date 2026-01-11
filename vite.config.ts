import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.svg', 'icons/*.png'],
      manifest: {
        name: 'Gridfinity Layout Tool',
        short_name: 'Gridfinity',
        description: 'Design Gridfinity drawer layouts for 3D printing',
        theme_color: '#0f0f12',
        background_color: '#0f0f12',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Force the new service worker to activate immediately
        skipWaiting: true,
        // Take control of pages that were controlled by an old SW
        clientsClaim: true,
        // Clean up old caches from previous versions
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    // Three.js is ~720KB minified, which is expected for a 3D library
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate three.js ecosystem into its own chunk (only loaded when 3D preview is used)
          'three': ['three'],
          'react-three': ['@react-three/fiber', '@react-three/drei'],
          // Core React runtime
          'react-vendor': ['react', 'react-dom'],
          // State management
          'state': ['zustand', 'immer'],
        },
      },
    },
  },
})
