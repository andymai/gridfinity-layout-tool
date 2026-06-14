import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import wasm from 'vite-plugin-wasm';
import { visualizer } from 'rollup-plugin-visualizer';
import { fileURLToPath, URL } from 'node:url';
import { versionPlugin } from './scripts/vite-plugin-version';

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
    // Exclude WASM modules from Vite's dependency pre-bundling. Pre-bundling the
    // Emscripten ESM glue can break its WASM instantiation, and a stale pre-bundle
    // is one way the kernel asset URL goes wrong; keep every geometry kernel out.
    exclude: ['brepjs-opencascade', 'brepkit-wasm', 'occt-wasm', 'manifold-3d'],
  },
  worker: {
    format: 'es',
    plugins: () => [wasm()] as PluginOption[],
  },
  plugins: [
    wasm(),
    react(),
    tailwindcss(),
    versionPlugin(),
    VitePWA({
      // 'prompt' so the smoke gate (src/shared/pwa/smokeGate.ts) controls activation.
      // With 'autoUpdate' the new SW would auto-skip-waiting on install, defeating the gate.
      registerType: 'prompt',
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
          // smokeBoot is loaded only via `?smoke=1`. Real users never need it, and
          // precaching it adds the same hash-mismatch risk that bit wwwMigration.
          'assets/smokeBoot-*.js',
          // version.json is fetched by the PWA smoke gate to verify a fresh deploy is
          // reachable. Must always hit the network — precaching would mask stale CDN.
          'version.json',
        ],
        // Prefix all cache names to prevent conflicts
        cacheId: 'gridfinity-v1',
        // Prevent accidentally precaching huge assets
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB per file
        // Don't auto-skip-waiting — the smoke gate sends SKIP_WAITING manually
        // after a hidden-iframe smoke against the new bundle passes.
        skipWaiting: false,
        // Don't claim existing tabs on activation — keep them on the old SW until they
        // reload, so an in-flight session is unaffected by a brand-new (potentially
        // broken) bundle's runtime caching strategy.
        clientsClaim: false,
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
        // Rolldown's native chunking API. The Rollup-compat `manualChunks`
        // function only hints at names — Rolldown still co-located the shared
        // eager react-dom with the lazy three.js/drei stack, forcing the whole
        // ~360 kB 3D chunk onto first paint. `advancedChunks` groups are honored
        // deterministically: react-vendor (eager) is split from the lazy 3D stack
        // (three core + renderers, grouped together). Higher priority wins.
        advancedChunks: {
          groups: [
            // Pin foundational constants/types into a leaf chunk that imports
            // nothing from other app chunks. Many modules read these at module-init
            // time (Zod schemas, store creators), so a leaf chunk guarantees they
            // evaluate before dependents — avoiding chunk-level static-import cycles
            // that leave imported bindings undefined. See #1466.
            {
              name: 'core-foundation',
              priority: 100,
              test: (id: string) =>
                id.endsWith('/src/core/constants.ts') ||
                id.endsWith('/src/core/types.ts') ||
                id.includes('packages/branded-types/src/'),
            },
            // Core React runtime — eager, shared by every UI chunk. HIGHEST vendor
            // priority so the shared react-dom is pinned here and NOT absorbed into
            // the lazy 3D chunk (which would force the whole 3D stack onto first
            // paint, since every UI chunk needs react-dom).
            {
              name: 'react-vendor',
              priority: 95,
              test: /[\\/]node_modules[\\/](?:react|react-dom|scheduler|use-sync-external-store|react-reconciler)[\\/]/,
            },
            // State management — eager. Priority ABOVE three-render because drei
            // also depends on zustand; without this, the shared zustand module gets
            // placed in the 3D chunk and the eager app stores then import it from
            // there, dragging three-render onto first paint.
            { name: 'state', priority: 92, test: /[\\/]node_modules[\\/](?:zustand|immer)[\\/]/ },
            // 3D stack (three core + fiber/drei/troika/three-stdlib) — only loaded
            // when a 3D preview mounts. three core and the renderers are always
            // loaded together, so keeping them in ONE chunk avoids duplicating
            // three's modules across two lazy chunks.
            {
              name: 'three-render',
              priority: 90,
              test: /[\\/]node_modules[\\/](?:three[\\/]|@react-three[\\/]|three-stdlib[\\/]|troika-[^\\/]+[\\/]|bidi-js[\\/]|webgl-sdf-generator[\\/]|maath[\\/]|meshline[\\/]|camera-controls[\\/]|stats\.js[\\/]|stats-gl[\\/]|suspend-react[\\/]|its-fine[\\/]|react-use-measure[\\/]|tunnel-rat[\\/]|@use-gesture[\\/]|potpack[\\/])/,
            },
            // Liveblocks — only loaded when collaborative editing is active (Labs).
            { name: 'liveblocks', priority: 80, test: /[\\/]node_modules[\\/]@liveblocks[\\/]/ },
          ],
        },
        // Note: posthog-js is dynamically imported in src/shared/analytics/posthog.ts
        // so it automatically gets its own chunk without needing chunk config.
      },
    },
  },
});
