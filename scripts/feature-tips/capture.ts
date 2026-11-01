/**
 * Captures the bin designer's feature-tip clips into
 * src/features/bin-designer/data/featureTips/clips/, one H.264 loop and one poster
 * per theme.
 *
 * Usage: run the dev server, then `pnpm run capture:feature-tips [id,...]`.
 * BASE_URL picks the dev server (default http://localhost:5173). Each tip's
 * frames are kept under node_modules/.cache/feature-tips/<id>/ for review.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { encodeClip } from './encode';
import { openStage } from './stage';
import type { Theme } from './stage';
import { TIPS_3D } from './tips3d';
import { TIPS_UI } from './tipsUi';

const ROOT = process.cwd();
const OUT = resolve(ROOT, 'src/features/bin-designer/data/featureTips/clips');
const WORK = resolve(ROOT, 'node_modules/.cache/feature-tips');
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
/** CSS px at 2x: the 4:3 frame every clip is rendered in before the downscale. */
const FRAME = { width: 640, height: 480 };
const TIPS = [...TIPS_3D, ...TIPS_UI];

function cardSurfaces(): Record<Theme, string> {
  const token = (file: string): string => {
    const match = /--bg-elevated:\s*(#[0-9a-fA-F]{6})/.exec(
      readFileSync(resolve(ROOT, file), 'utf8')
    );
    if (!match?.[1]) throw new Error(`no --bg-elevated in ${file}`);
    return match[1];
  };
  return { dark: token('src/index.css'), light: token('src/shell/styles/themes.css') };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((a) => a.startsWith('-'))) {
    throw new Error('usage: capture:feature-tips [id,id,...]');
  }
  const ids = args[0]?.split(',');
  const tips = ids ? TIPS.filter((t) => ids.includes(t.id)) : TIPS;
  if (ids && tips.length !== ids.length) throw new Error(`unknown tip in ${ids.join(',')}`);

  const stage = await openStage(BASE, FRAME, cardSurfaces());
  try {
    for (const tip of tips) {
      const started = Date.now();
      const { frames, poster } = await tip.capture({ stage, base: BASE });
      encodeClip(tip.id, frames, poster, WORK, OUT);
      console.log(
        `${tip.id}: ${frames.length} frames in ${((Date.now() - started) / 1000).toFixed(0)} s`
      );
    }
  } finally {
    await stage.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
