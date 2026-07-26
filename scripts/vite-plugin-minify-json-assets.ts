import type { Plugin } from 'vite';

/**
 * Strip formatting whitespace from emitted `.json` assets.
 *
 * JSON reached via `?url` is copied verbatim, unlike JSON imported as a module
 * (which the JS minifier compacts). The committed ML models are pretty-printed
 * so retrain diffs stay reviewable, which would otherwise ship ~9 kB gzipped of
 * pure indentation.
 *
 * Vite hashes the source bytes, not these rewritten ones, so the emitted hash is
 * unchanged by this plugin. That is fine because the rewrite is a pure function
 * of the source and preserves the parsed value — a hash still identifies one
 * payload, which is what the service worker's CacheFirst rule relies on. Editing
 * this plugin's output format therefore needs a thought: it would change emitted
 * bytes without changing the URL.
 */
export function minifyJsonAssets(): Plugin {
  return {
    name: 'minify-json-assets',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        // Scoped to assets/ so this can't reach root-level emitted JSON such as
        // version.json, which the PWA smoke gate owns.
        if (file.type !== 'asset') continue;
        if (!file.fileName.startsWith('assets/') || !file.fileName.endsWith('.json')) continue;

        const source = typeof file.source === 'string' ? file.source : Buffer.from(file.source);
        const text = typeof source === 'string' ? source : source.toString('utf8');

        try {
          file.source = JSON.stringify(JSON.parse(text));
        } catch {
          // Not parseable as JSON — leave it exactly as emitted rather than
          // risk corrupting an asset that merely ends in `.json`.
        }
      }
    },
  };
}
