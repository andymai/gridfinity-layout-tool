import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import wasm from 'vite-plugin-wasm';
import { visualizer } from 'rollup-plugin-visualizer';
import { fileURLToPath, URL } from 'node:url';
import { versionPlugin } from './scripts/vite-plugin-version';
import { contentRoutesPlugin } from './scripts/vite-plugin-content-routes';
import { mediapipeAssetsPlugin } from './scripts/vite-plugin-mediapipe-assets';
import { minifyJsonAssets } from './scripts/vite-plugin-minify-json-assets';

// The prerendered content pages, mirroring the rewrites in vercel.json. They are
// standalone static HTML, reachable from search rather than from inside the app,
// so they are deliberately kept out of the precache: bundling all 85 of them into
// every install put 85 requests on each cold load and 12 more on each deploy that
// touched content. Being out of the precache means navigation to one has to be
// denied the SPA fallback, or the service worker answers it with the app shell.
const CONTENT_LOCALES = 'cs|de|es|fr|ko|nb|nl|pl|pt-BR|sv|uk|zh-CN';
const CONTENT_SLUGS = [
  'what-is-gridfinity',
  'guide',
  'privacy',
  'terms',
  'gridfinity-generator',
  'gridfinity-bin-generator',
  'gridfinity-baseplate-generator',
  'gridfinity-calculator',
  'gridfinity-sizes',
  'gridfinity-tool-drawer',
  'gridfinity-kitchen-drawer',
  'gridfinity-software',
  'gridfinity-cutout-generator',
].join('|');
// Two anchorings of one route set. A workbox urlPattern must be a RegExp value,
// never a closure: vite-plugin-pwa serializes the service worker by stringifying
// functions, so an identifier referenced from inside one resolves to nothing at
// runtime and every matching navigation throws.
const CONTENT_ROUTE_SOURCE = `/(?:(?:${CONTENT_LOCALES})/)?(?:${CONTENT_SLUGS})(?:[/?#]|$)`;
// NavigationRoute tests its denylist against the pathname, so this one anchors.
const CONTENT_ROUTE = new RegExp(`^${CONTENT_ROUTE_SOURCE}`);
// RegExpRoute tests against the full href, where a leading ^ could never match.
const CONTENT_ROUTE_HREF = new RegExp(CONTENT_ROUTE_SOURCE);

// Chunks reachable from the entry by static import, i.e. the ones the app needs
// to boot. Collected from the bundle graph so the precache can hold the boot
// graph and nothing else: precaching every emitted chunk downloads all ~190 of
// them on install, including the designer, community and baseplate code that a
// given visitor may never open, which is the code splitting paid for twice.
const eagerChunks = new Set<string>();

const collectEagerChunks = (): PluginOption => ({
  name: 'collect-eager-chunks',
  generateBundle(_options, bundle) {
    eagerChunks.clear();
    const walk = (fileName: string): void => {
      if (eagerChunks.has(fileName)) return;
      const chunk = bundle[fileName];
      if (!chunk || chunk.type !== 'chunk') return;
      eagerChunks.add(fileName);
      for (const imported of chunk.imports) walk(imported);
    };
    for (const chunk of Object.values(bundle)) {
      if (chunk.type === 'chunk' && chunk.isEntry) walk(chunk.fileName);
    }
  },
});

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
    contentRoutesPlugin(),
    mediapipeAssetsPlugin(),
    minifyJsonAssets(),
    collectEagerChunks(),
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
        // html is absent by design: only the app shell is precached, and the
        // prerendered content pages are runtime-cached on first visit (see
        // CONTENT_ROUTE above and the 'content-pages' rule below).
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}', 'index.html'],
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
          // MediaPipe segmenter runtime is phone-scan-only and large. Keep its WASM
          // loader .js out of every user's precache; it's runtime-cached on first scan.
          'models/tasks-vision/*.js',
          // The MediaPipe JS chunk (~130KB) is only used by the /scan phone route.
          // Don't precache it for every (desktop) user; it lazy-loads on first scan.
          'assets/vision_bundle-*.js',
          // Social cards. Only ever requested by a link unfurler reading the meta
          // tags, never by a browser rendering the app, so shipping 1.5 MB of them
          // to every install buys nothing.
          'og/**',
          'og-image.png',
          'og-image.svg',
          // Imagery and styles belonging to the prerendered content pages, which
          // are themselves no longer precached. kofi-cup.png stays: the supporters
          // panel and the export prompt render it inside the app.
          'images/landing/**',
          'images/serp/**',
          'content*.css',
          'calculator.js',
          // Draco decoder, fetched by GlbViewer only when a GLB preview mounts.
          // Same reasoning as the MediaPipe segmenter above.
          'draco/**',
        ],
        // Hold the boot graph, drop the rest. globPatterns cannot express "only
        // the chunks the entry statically imports" because the hashed names are
        // not known until the bundle exists, so the filtering happens here, against
        // the graph collected in generateBundle. A lazy chunk left out is fetched
        // and runtime-cached the first time its route is opened; the tradeoff is
        // that a route never visited online is not available offline.
        manifestTransforms: [
          (entries) => {
            const manifest = entries.filter(
              (entry) => !/^assets\/.*\.js$/.test(entry.url) || eagerChunks.has(entry.url)
            );
            return { manifest, warnings: [] };
          },
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
          CONTENT_ROUTE,
          /^\/storage-bridge\.html$/,
        ],
        runtimeCaching: [
          {
            // The prerendered content pages, cached on first visit rather than
            // precached for everyone. NetworkFirst because they are SEO surfaces
            // whose copy is edited far more often than the app shell, and a stale
            // one served from CacheFirst would outlive the deploy that fixed it.
            urlPattern: CONTENT_ROUTE_HREF,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'content-pages',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          {
            // Lazy route chunks, which the precache no longer carries. Cached on
            // first use so a route stays available offline once it has been opened.
            // CacheFirst is safe for the same reason it is on .wasm below: the
            // filenames are content-hashed, so a new build is a new URL and a stale
            // copy is unreachable rather than wrong. maxEntries is generous because
            // the whole point is that a given visitor only ever pulls their subset.
            urlPattern: /\/assets\/.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lazy-chunks',
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
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
            // The phone scan segmenter assets (tflite model + tasks-vision runtime)
            // live at stable, non-hashed /models/ paths. StaleWhileRevalidate (not
            // CacheFirst) serves the cached copy instantly for fast/offline repeat
            // scans while revalidating in the background — so a model or runtime bump
            // (the WASM filename is fixed, only its bytes change) can't strand users
            // on a stale copy or skew the WASM against a freshly-hashed JS loader.
            // Listed before the generic .wasm rule so the runtime WASM lands here.
            urlPattern: /\/models\/(interactive-segmenter|tasks-vision)\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'scan-segmenter',
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          {
            // The Draco decoder, which only a GLB preview pulls. Its own cache
            // so it is not competing for a slot with the geometry kernels
            // below — it is three orders of magnitude smaller than occt-wasm
            // and nothing about the two is related.
            urlPattern: /\/draco\/.*\.wasm$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'draco-decoder',
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
            // Cache WASM binaries (content-hashed, immutable) after first use.
            // CacheFirst is safe because new deploys produce new hashes.
            //
            // Three kernels ship (occt-wasm ~22MB, brepkit ~5MB, manifold
            // ~0.5MB), so a budget of three is a budget with no headroom: a
            // deploy that rehashes any one of them adds a fourth entry and the
            // LRU has to drop something. Six leaves room for a deploy's
            // superseded copies to coexist with the current ones, and the
            // shorter max-age lets the superseded ones fall out rather than
            // sitting for a year. Getting this wrong is expensive in exactly
            // one direction — evicting a live occt-wasm costs a 22MB refetch
            // on the next designer open.
            urlPattern: /\.wasm$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-binaries',
              expiration: {
                maxEntries: 6,
                maxAgeSeconds: 60 * 60 * 24 * 60, // 60 days
                purgeOnQuotaError: true,
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          {
            // Committed ML model weights, fetched on demand rather than bundled.
            // Same reasoning as the .wasm rule: content-hashed and immutable, so
            // CacheFirst can never strand a user on stale weights — a retrain
            // emits a new hash and therefore a new URL. Deliberately NOT
            // precached (json is absent from globPatterns): most users never
            // open a feature that needs them, so they are cached on first use.
            // Same-origin only without an explicit origin check: workbox's
            // RegExpRoute ignores a cross-origin URL unless the pattern matches
            // from index 0, which this one cannot. Same as the .wasm rule.
            urlPattern: /\/assets\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ml-models',
              expiration: {
                maxEntries: 6,
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
    // Down-level syntax to browsers we still support. Vite 7+/8 defaults to
    // 'baseline-widely-available' (Chrome 107 / Firefox 104 / Safari 16.0), which
    // leaves post-Safari-16 syntax — most notably class `static { }` blocks
    // (Safari 16.4+) — in emitted chunks. Safari 15.6 then hits a hard parse-time
    // SyntaxError when a lazy import() pulls such a chunk (e.g. /baseplate), crashing
    // the page. This explicit target makes esbuild/oxc transpile those forms so the
    // browsers below can parse the output. Keep es2020 as the floor for native
    // optional-chaining / nullish-coalescing without further down-leveling.
    target: ['es2020', 'safari15', 'chrome87', 'firefox78', 'edge88'],
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
                id.includes('/src/core/types/') ||
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
            // Liveblocks deliberately has NO group. Pinning it to a named chunk made
            // that chunk a static import of the entry, so index.html modulepreloaded
            // 240 kB of collaboration client on every first paint even though nothing
            // eager imports @liveblocks — only the lazy CollabProvider subtree does.
            // Ungrouped, rolldown folds it into the lazy chunk that needs it, with no
            // duplication (total JS is unchanged either way).
          ],
        },
        // Note: posthog-js is dynamically imported in src/shared/analytics/posthog/
        // so it automatically gets its own chunk without needing chunk config.
      },
    },
  },
});
