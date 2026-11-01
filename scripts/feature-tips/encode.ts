import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Theme, ThemeFrames } from './stage';

export const FPS = 30;
export const OUTPUT = { width: 560, height: 420 };
/** Every frame is rendered at this size, then downscaled to OUTPUT. */
export const FRAME_PX = { width: 1280, height: 960 };

function ffmpeg(args: string[]): void {
  const run = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (run.error) throw new Error(`could not run ffmpeg: ${run.error.message}`);
  if (run.status !== 0) throw new Error(`ffmpeg exited ${run.status}`);
}

/**
 * Writes `<id>.<theme>.mp4` and `<id>.<theme>.webp`, the poster shown before
 * it plays: the clip's payoff frame, since frame 0 is usually the "before".
 *
 * Frames are rendered at 2x and downscaled here. The encode is tagged BT.709
 * and converted with that matrix: an untagged clip this small is decoded as
 * BT.601, which shifts the flat surface colour off the card's and shows a
 * seam around the video.
 */
export function encodeClip(
  id: string,
  frames: readonly ThemeFrames[],
  poster: number,
  workDir: string,
  outDir: string
): void {
  mkdirSync(outDir, { recursive: true });
  for (const theme of ['light', 'dark'] as Theme[]) {
    const dir = join(workDir, id, theme);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    frames.forEach((f, i) =>
      writeFileSync(join(dir, `${String(i).padStart(4, '0')}.png`), f[theme])
    );
    const scale = `scale=${OUTPUT.width}:${OUTPUT.height}:flags=lanczos`;
    ffmpeg([
      '-framerate',
      String(FPS),
      '-i',
      join(dir, '%04d.png'),
      '-vf',
      `${scale}:out_color_matrix=bt709:out_range=tv,format=yuv420p`,
      '-c:v',
      'libx264',
      '-preset',
      'veryslow',
      '-crf',
      '18',
      '-g',
      String(FPS * 2),
      '-colorspace',
      'bt709',
      '-color_primaries',
      'bt709',
      '-color_trc',
      'bt709',
      '-movflags',
      '+faststart',
      '-an',
      join(outDir, `${id}.${theme}.mp4`),
    ]);
    ffmpeg([
      '-i',
      join(dir, `${String(poster).padStart(4, '0')}.png`),
      '-vf',
      scale,
      '-c:v',
      'libwebp',
      '-quality',
      '82',
      join(outDir, `${id}.${theme}.webp`),
    ]);
  }
}
