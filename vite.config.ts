import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // Exclude WASM module from Vite's dependency pre-bundling
    exclude: ['replicad-opencascadejs'],
  },
  worker: {
    format: 'es',
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Note: Don't use includeAssets here - icons are precached via globPatterns,
      // except manifest icons (icon-192, icon-512) which are excluded via globIgnores
      // since they're auto-added by vite-plugin-pwa from manifest.icons below.
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
        // Exclude manifest icons from glob - they're auto-added via manifest.icons
        // This prevents duplicate precache entries
        globIgnores: ['icons/icon-192.png', 'icons/icon-512.png'],
        // Prefix all cache names to prevent conflicts
        cacheId: 'gridfinity-v1',
        // Prevent accidentally precaching huge assets
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB per file
        // Force the new service worker to activate immediately
        skipWaiting: true,
        // Take control of pages that were controlled by an old SW
        clientsClaim: true,
        // Clean up old caches from previous versions
        cleanupOutdatedCaches: true,
        // SPA navigation fallback - serve index.html for all navigation requests
        navigateFallback: '/index.html',
        // Don't intercept these paths with navigation fallback
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/sitemap\.xml$/,
          /^\/robots\.txt$/,
          /^\/what-is-gridfinity(?:\/|$)/,
          /^\/guide(?:\/|$)/,
          /^\/privacy(?:\/|$)/,
          /^\/terms(?:\/|$)/,
        ],
        runtimeCaching: [
          {
            // Cache shared layout API responses for offline viewing
            urlPattern: /\/api\/share\/[a-zA-Z0-9]+$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'shared-layouts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
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
    ...(process.env.ANALYZE
      ? [
          visualizer({
            open: false,
            filename: 'bundle-analysis.html',
            gzipSize: true,
            template: 'treemap',
          }),
          visualizer({ open: false, filename: 'bundle-analysis.json', template: 'raw-data' }),
        ]
      : []),
  ],
  build: {
    // Generate source maps for error tracking (PostHog)
    // Use 'hidden' to generate .map files without adding sourceMappingURL comments
    // This prevents browsers from exposing source maps publicly while still allowing
    // manual upload to PostHog for error stack trace resolution
    sourcemap: 'hidden',
    // Three.js is ~720KB minified, which is expected for a 3D library
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        // Name the main entry consistently so we can measure it with size-limit
        entryFileNames: 'assets/main-[hash].js',
        // Name lazy-loaded feature chunks to avoid confusion with main bundle
        chunkFileNames(chunkInfo) {
          // Feature chunks from lazy imports get descriptive names
          if (chunkInfo.facadeModuleId?.includes('inspiration-gallery')) {
            return 'assets/inspiration-gallery-[hash].js';
          }
          // Default Vite chunk naming
          return 'assets/[name]-[hash].js';
        },
        // Use function-based manualChunks for more reliable splitting
        manualChunks(id) {
          // Three.js ecosystem - only loaded when 3D preview is used
          if (id.includes('node_modules/three/')) {
            return 'three';
          }
          if (id.includes('node_modules/@react-three/')) {
            return 'react-three';
          }
          // Liveblocks - only loaded when collaborative editing is used (Labs feature)
          if (id.includes('node_modules/@liveblocks/')) {
            return 'liveblocks';
          }
          // State management
          if (id.includes('node_modules/zustand/') || id.includes('node_modules/immer/')) {
            return 'state';
          }
          // Core React runtime - split out for better caching
          if (id.includes('node_modules/react-dom/') || id.includes('node_modules/react/')) {
            return 'react-vendor';
          }
          // Analytics - lazy loaded, keep separate
          if (id.includes('node_modules/posthog-js/')) {
            return 'analytics';
          }
        },
      },
    },
  },
});
