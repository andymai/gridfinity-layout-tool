import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FPS } from '../feature-tips/encode';
import type { Theme } from '../feature-tips/stage';
import type { TakeResult, Viewport } from './session';

/** The fade back to frame 0 at the end of a clip, so the loop has no jump. */
const LOOP_FADE_S = 0.4;

export interface MediaEntry {
  kind: 'still' | 'clip';
  /** CSS px the docs show it at. */
  width: number;
  height: number;
}

export type Manifest = Record<string, MediaEntry>;

function ffmpeg(args: string[]): void {
  const run = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (run.error) throw new Error(`could not run ffmpeg: ${run.error.message}`);
  if (run.status !== 0) throw new Error(`ffmpeg exited ${run.status}`);
}

const even = (n: number): number => Math.round(n / 2) * 2;

function webp(src: string, out: string, size: Viewport, scale: number): void {
  ffmpeg([
    '-i',
    src,
    '-vf',
    `scale=${even(size.width * scale)}:${even(size.height * scale)}:flags=lanczos`,
    '-c:v',
    'libwebp',
    '-quality',
    '88',
    '-compression_level',
    '6',
    out,
  ]);
}

/**
 * Writes `<id>.<theme>.webp` and, for a clip, `<id>.<theme>.mp4` whose poster
 * is the webp. The H.264 encode is tagged and converted as BT.709, as the tips
 * are: an untagged clip decodes as BT.601 and its flat UI colours shift.
 */
export function encodeShot(
  id: string,
  kind: MediaEntry['kind'],
  takes: Record<Theme, TakeResult>,
  scale: number,
  workDir: string,
  outDir: string
): MediaEntry {
  mkdirSync(outDir, { recursive: true });
  const size = takes.light.size;
  for (const theme of ['light', 'dark'] as Theme[]) {
    const take = takes[theme];
    const dir = join(workDir, id, theme);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    take.frames.forEach((f, i) => writeFileSync(join(dir, `${String(i).padStart(4, '0')}.png`), f));
    const posterPng = join(dir, `${String(take.poster).padStart(4, '0')}.png`);
    webp(posterPng, join(outDir, `${id}.${theme}.webp`), size, scale);
    if (kind === 'still') continue;

    const seconds = take.frames.length / FPS;
    if (seconds < LOOP_FADE_S * 2)
      throw new Error(`${id}: a ${seconds.toFixed(2)} s clip is too short to loop`);
    const scaleTo = `scale=${even(size.width * scale)}:${even(size.height * scale)}:flags=lanczos`;
    ffmpeg([
      '-framerate',
      String(FPS),
      '-i',
      join(dir, '%04d.png'),
      '-loop',
      '1',
      '-framerate',
      String(FPS),
      '-t',
      String(LOOP_FADE_S),
      '-i',
      join(dir, '0000.png'),
      '-filter_complex',
      `[0:v]${scaleTo},format=rgb24,settb=AVTB[a];[1:v]${scaleTo},format=rgb24,settb=AVTB[b];` +
        `[a][b]xfade=transition=fade:duration=${LOOP_FADE_S}:offset=${(seconds - LOOP_FADE_S).toFixed(3)},` +
        'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-c:v',
      'libx264',
      '-preset',
      'veryslow',
      '-crf',
      '22',
      '-tune',
      'animation',
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
  }
  return { kind, width: size.width, height: size.height };
}

export function readManifest(file: string): Manifest {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Manifest) : {};
}

export function writeManifest(file: string, manifest: Manifest): void {
  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))
  );
  writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
}
