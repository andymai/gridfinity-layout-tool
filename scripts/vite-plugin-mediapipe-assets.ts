import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Self-hosts the MediaPipe tasks-vision WASM runtime for the phone scan flow.
 *
 * `FilesetResolver.forVisionTasks()` fetches its runtime by URL from a base
 * path, so the files must sit at a stable origin path. Rather than commit ~22MB
 * of WASM to the repo, this copies the fileset from the pinned npm package into
 * `public/models/tasks-vision/` at build start — version-locked to the dep,
 * gitignored, served normally in dev and emitted into dist on build. The
 * `magic_touch.tflite` model is committed (it isn't published to npm).
 */
const WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
] as const;

export function mediapipeAssetsPlugin(): Plugin {
  return {
    name: 'mediapipe-assets',
    buildStart() {
      const require = createRequire(import.meta.url);
      const outDir = join(process.cwd(), 'public', 'models', 'tasks-vision');
      mkdirSync(outDir, { recursive: true });
      for (const file of WASM_FILES) {
        cpSync(require.resolve(`@mediapipe/tasks-vision/${file}`), join(outDir, file));
      }
    },
  };
}
