/**
 * Captures the user docs' screenshots and clips into apps/docs/media/, one per
 * theme, and records each in apps/docs/media/manifest.json.
 *
 * Usage: run the dev server, then `pnpm run capture:docs [id,...]`.
 * BASE_URL picks the dev server (default http://localhost:5173). Frames stay
 * under node_modules/.cache/docs-capture/<id>/ for review.
 */

import { resolve } from 'node:path';
import type { Theme } from '../feature-tips/stage';
import { encodeShot, readManifest, writeManifest } from './encode';
import { openDocsSession, SCALE } from './session';
import type { TakeResult } from './session';
import { SHOTS } from './shots';

const ROOT = process.cwd();
const OUT = resolve(ROOT, 'apps/docs/media');
const MANIFEST = resolve(OUT, 'manifest.json');
const WORK = resolve(ROOT, 'node_modules/.cache/docs-capture');
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((a) => a.startsWith('-'))) {
    throw new Error('usage: capture:docs [id,id,...]');
  }
  const ids = args[0]?.split(',');
  const shots = ids ? SHOTS.filter((s) => ids.includes(s.id)) : SHOTS;
  if (ids && shots.length !== ids.length) {
    const known = new Set(SHOTS.map((s) => s.id));
    throw new Error(`no shot named ${ids.filter((id) => !known.has(id)).join(', ')}`);
  }

  const failed: string[] = [];
  for (const shot of shots) {
    const started = Date.now();
    try {
      const takes = {} as Record<Theme, TakeResult>;
      for (const theme of ['light', 'dark'] as Theme[]) {
        const session = await openDocsSession(BASE, theme, shot);
        try {
          await shot.take(session);
          takes[theme] = session.result();
        } finally {
          await session.close();
        }
      }
      const { light, dark } = takes;
      if (light.frames.length !== dark.frames.length) {
        throw new Error(`themes differ: ${light.frames.length} vs ${dark.frames.length} frames`);
      }
      if (shot.kind === 'still' && light.frames.length !== 1) {
        throw new Error(`a still recorded ${light.frames.length} frames`);
      }
      const entry = encodeShot(shot.id, shot.kind, takes, SCALE, WORK, OUT);
      // Read per shot: a long run must not drop entries another run wrote meanwhile.
      const manifest = readManifest(MANIFEST);
      manifest[shot.id] = entry;
      writeManifest(MANIFEST, manifest);
      const seconds = ((Date.now() - started) / 1000).toFixed(0);
      console.log(`${shot.id}: ${shot.kind}, ${light.frames.length} frames in ${seconds} s`);
    } catch (e) {
      failed.push(shot.id);
      console.error(`${shot.id}: FAILED`, e);
    }
  }
  if (failed.length > 0) throw new Error(`failed: ${failed.join(', ')}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
