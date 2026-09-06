// @vitest-environment node
/**
 * Sub-stage breakdown of the shell (`base`) stage (investigation harness).
 *
 * `scrubPerfBreakdown` shows `base` is the largest stage on every slider that
 * moves `shellKey` — ~350ms on a height tick, ~680ms on a width tick — while a
 * shellKey-stable scrub (scoop radius) pays 7ms. This splits that cost into the
 * pieces shellStage actually runs, to say whether the win is in the box extrude,
 * the box↔lip fuse, or the socket.
 *
 * These four pieces are a SUBSET of the stage, so the total below is a lower
 * bound on `base` and the percentages are shares of the measured subset, not of
 * the stage. On the scrub harness's bin the real stage also builds compartment
 * cavity drawings, runs `collectOrigins`, applies spanning-divider clips and
 * takes the metadata-preserving cache clone — together the ~90ms this misses.
 *
 * Run it on an IDLE machine. Straight after a full test run the same fuse
 * measures ~340ms instead of ~230ms; the share holds, the absolute does not.
 *
 * Run:
 *   pnpm exec vitest run --config vitest.profile.config.ts shellStageBreakdown
 */
import { appendFileSync } from 'node:fs';
import { writeReport } from './reportTable';
import { describe, it, beforeAll } from 'vitest';
import { unwrap, fuse, translate } from 'brepjs';
import { initBrepjs } from './wasmInit';
import { buildBinBox, buildTopShape } from '../boxBuilder';
import { buildBaseSocket, DEFAULT_SOCKET_CELL_PLAN } from '../socketBuilder';
import { clearAllCaches } from '../shapeCache';

const OUT = process.env['PERF_OUT'] ?? '/tmp/perfbench/shell.txt';

beforeAll(async () => {
  await initBrepjs();
  writeReport(OUT, '');
}, 60_000);

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

interface Split {
  box: number;
  lip: number;
  fuse: number;
  socket: number;
}

/**
 * One shell build at `height`, timing each piece. Caches are left as the caller
 * set them, so a height sweep sees warm lip/socket caches and a cold box —
 * exactly the state a height scrub puts them in.
 */
function buildShellOnce(gridW: number, gridD: number, wallHeight: number): Split {
  const pitch = { x: 42, y: 42 };
  const wallThickness = 1.2;

  const t0 = performance.now();
  const box = buildBinBox(gridW, gridD, wallHeight, wallThickness, false, 0, pitch);
  const t1 = performance.now();

  const lipBase = buildTopShape(gridW, gridD, true, pitch);
  const t2 = performance.now();

  const top = translate(lipBase, [0, 0, wallHeight]);
  const body = unwrap(fuse(box, top));
  const t3 = performance.now();

  const socket = buildBaseSocket(
    gridW,
    gridD,
    true,
    false,
    3.25,
    2.4,
    1.5,
    true,
    DEFAULT_SOCKET_CELL_PLAN,
    pitch
  );
  const t4 = performance.now();

  // Every one of these is caller-owned: `buildBinBox`/`buildTopShape`/
  // `buildBaseSocket` return a CLONE on both the hit and the miss path (see
  // `createCloningAccessors` — the cache keeps the original), and `fuse` does
  // not consume its inputs, which is why `shellStage` registers its box with a
  // disposal scope rather than letting the fuse take it.
  box.delete();
  lipBase.delete();
  top.delete();
  body.delete();
  socket.delete();

  return { box: t1 - t0, lip: t2 - t1, fuse: t3 - t2, socket: t4 - t3 };
}

function sweep(label: string, gridW: number, gridD: number, heights: readonly number[]): void {
  clearAllCaches();
  const runs = heights.map((h) => buildShellOnce(gridW, gridD, h));
  const rest = runs.slice(1); // drop the cold first build
  const med = (pick: (s: Split) => number): number => median(rest.map(pick));
  const total = med((s) => s.box) + med((s) => s.lip) + med((s) => s.fuse) + med((s) => s.socket);
  const pct = (ms: number): string => `${((ms / total) * 100).toFixed(0)}%`;
  const line =
    `\n  ${label}\n` +
    `    cold first   ${runs[0].box.toFixed(0)}box ${runs[0].lip.toFixed(0)}lip ` +
    `${runs[0].fuse.toFixed(0)}fuse ${runs[0].socket.toFixed(0)}socket\n` +
    `    median tick  ${total.toFixed(0)}ms across the 4 measured pieces (lower bound on \`base\`)\n` +
    `      box        ${med((s) => s.box)
      .toFixed(0)
      .padStart(5)}ms  ${pct(med((s) => s.box))}\n` +
    `      lip        ${med((s) => s.lip)
      .toFixed(0)
      .padStart(5)}ms  ${pct(med((s) => s.lip))}\n` +
    `      fuse       ${med((s) => s.fuse)
      .toFixed(0)
      .padStart(5)}ms  ${pct(med((s) => s.fuse))}\n` +
    `      socket     ${med((s) => s.socket)
      .toFixed(0)
      .padStart(5)}ms  ${pct(med((s) => s.socket))}`;
  appendFileSync(OUT, line + '\n');
}

describe('shell stage sub-timings across a height sweep', () => {
  it('3x3 (matches the scrub harness bin)', () => {
    sweep('3×3 height 21→56mm', 3, 3, [21, 28, 35, 42, 49, 56]);
  }, 600_000);

  it('6x6 (large footprint)', () => {
    sweep('6×6 height 21→56mm', 6, 6, [21, 28, 35, 42, 49, 56]);
  }, 600_000);
});
