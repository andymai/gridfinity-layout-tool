import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import wasm from 'vite-plugin-wasm';
import { visualizer } from 'rollup-plugin-visualizer';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@gridfinity/branded-types': fileURLToPath(
        new URL('./packages/branded-types/src/index.ts', import.meta.url)
      ),
    },
  },
  optimizeDeps: {
    // Exclude WASM module from Vite's dependency pre-bundling
    exclude: ['brepjs-opencascade', 'brepkit-wasm'],
  },
  worker: {
    format: 'es',
    plugins: () => [wasm()] as PluginOption[],
  },
  plugins: [
    wasm(),
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
        globIgnores: [
          'icons/icon-192.png',
          'icons/icon-512.png',
          'storage-bridge.html',
          // wwwMigration is a one-shot dynamic import (www → canonical migration).
          // Precaching it causes SW install failures when the hash changes between
          // deployments: the new SW's manifest still references the old hash which
          // 404s, leaving the old SW in control and blocking the fix from reaching users.
          'assets/wwwMigration-*.js',
        ],
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
          /^\/storage-bridge\.html$/,
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
            // Cache WASM binaries (content-hashed, immutable) after first use.
            // CacheFirst is safe because new deploys produce new hashes.
            urlPattern: /\.wasm$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-binaries',
              expiration: {
                maxEntries: 4,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [200],
              },
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
    // Disable asset inlining to ensure pthread worker files are emitted as separate files
    // (required for Emscripten multi-threaded WASM to work with dynamic imports)
    assetsInlineLimit: 0,
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
          // Pin foundational constants/types into a dedicated leaf chunk that
          // imports nothing from other app chunks. Many modules read these at
          // module-init time (Zod schemas, store creators, etc); keeping them
          // in a leaf chunk guarantees they are fully evaluated before any
          // dependent chunk runs, eliminating chunk-level static-import cycles
          // that would otherwise leave imported bindings undefined. See #1466.
          if (
            id.endsWith('/src/core/constants.ts') ||
            id.endsWith('/src/core/types.ts') ||
            id.includes('packages/branded-types/src/')
          ) {
            return 'core-foundation';
          }
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
          // Note: posthog-js is dynamically imported in src/shared/analytics/posthog.ts
          // so it automatically gets its own chunk without needing manualChunks config
        },
      },
    },
  },
});
