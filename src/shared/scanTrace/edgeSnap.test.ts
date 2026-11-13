import { describe, it, expect } from 'vitest';
import { isOk } from '@/core/result';
import { polylineCrosses } from '@/shared/utils/outlineSegments';
import { snapToEdges } from './edgeSnap';
import { buildToolTraceSoft, traceScene, type SceneReference } from './traceScene';
import {
  outlineError,
  renderPhoto,
  sampleRing,
  signedDistance,
  type Layer,
  type Rgb,
} from './testing/syntheticPhoto';
import type { ImageDataLike, Point } from './types';

const W = 960;
const H = 720;
const WHITE: Rgb = [238, 238, 232];
const WOOD: Rgb = [170, 135, 95];
const RED: Rgb = [200, 60, 40];
const STEEL: Rgb = [112, 117, 124];
const BLACK: Rgb = [40, 42, 46];

function arc(cx: number, cy: number, r: number, from: number, to: number, n = 24): Point[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

const turned = (points: readonly Point[], angle: number): Point[] =>
  points.map((p) => ({
    x: W / 2 + p.x * Math.cos(angle) - p.y * Math.sin(angle),
    y: H / 2 + p.x * Math.sin(angle) + p.y * Math.cos(angle),
  }));

// A wrench-like bar with round ends, 480 × 60 px.
const BAR = turned(
  [
    ...arc(210, 0, 30, -Math.PI / 2, Math.PI / 2),
    ...arc(-210, 0, 30, Math.PI / 2, (3 * Math.PI) / 2),
  ],
  0.3
);

// An L-shaped key with square corners and a notch.
const KEY = turned(
  [
    { x: -180, y: -90 },
    { x: 180, y: -90 },
    { x: 180, y: -50 },
    { x: 40, y: -50 },
    { x: 40, y: -30 },
    { x: 20, y: -30 },
    { x: 20, y: -50 },
    { x: -140, y: -50 },
    { x: -140, y: 110 },
    { x: -180, y: 110 },
  ],
  0.12
);

/** `p`, a point on `ring`, moved `by` pixels straight out from it. */
function outFrom(p: Point, ring: readonly Point[], by: number): Point {
  const dx =
    signedDistance({ x: p.x + 0.5, y: p.y }, ring) - signedDistance({ x: p.x - 0.5, y: p.y }, ring);
  const dy =
    signedDistance({ x: p.x, y: p.y + 0.5 }, ring) - signedDistance({ x: p.x, y: p.y - 0.5 }, ring);
  const length = Math.hypot(dx, dy) || 1;
  return { x: p.x + (by * dx) / length, y: p.y + (by * dy) / length };
}

/** `ring` as points two pixels apart, each moved `by` pixels straight out from it. */
const pushedOut = (ring: readonly Point[], by: number): Point[] =>
  sampleRing(ring, 2).map((p) => outFrom(p, ring, by));

const shadowOf = (tool: readonly Point[]): Layer => ({
  outline: tool.map((p) => ({ x: p.x + 5, y: p.y + 6 })),
  colour: [0, 0, 0],
  opacity: 0.3,
  soften: 4,
});

function photo(tool: readonly Point[], colour: Rgb, surface: Rgb, shadow = false): ImageDataLike {
  return renderPhoto({
    width: W,
    height: H,
    surface,
    layers: [...(shadow ? [shadowOf(tool)] : []), { outline: tool, colour }],
    blur: 1.2,
    noise: 3,
  });
}

// One pixel is one unit, so the trace's own outline can be read in pixels.
const RULER: SceneReference = {
  kind: 'ruler',
  ruler: { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, lengthMm: 100 },
};

function traced(image: ImageDataLike, snap: boolean): readonly Point[] {
  const scene = traceScene(image, { symmetrize: false, snap }, RULER);
  if (!isOk(scene)) throw new Error(scene.error.code);
  return scene.value.shapes[0].imagePoints;
}

const LOOKS = [
  ['a red tool on white', RED, WHITE],
  ['a steel tool on white', STEEL, WHITE],
  ['a black tool on wood', BLACK, WOOD],
] as const;

describe('an outline moved onto the edge it traced', () => {
  it.each(LOOKS)('sizes %s the same, however strongly it stands out', (_name, colour, surface) => {
    for (const tool of [BAR, KEY]) {
      const error = outlineError(traced(photo(tool, colour, surface), true), tool);
      expect(Math.abs(error.bias)).toBeLessThan(0.3);
      expect(error.meanAbs).toBeLessThan(0.35);
      expect(error.p95).toBeLessThan(0.8);
    }
  });

  it('does not shrink a dark tool on white, as one threshold on pixel values does', () => {
    const image = photo(BAR, BLACK, WHITE);
    expect(outlineError(traced(image, false), BAR).bias).toBeLessThan(-0.7);
    expect(Math.abs(outlineError(traced(image, true), BAR).bias)).toBeLessThan(0.3);
  });

  it('halves the error of the mask outline on every look', () => {
    for (const [, colour, surface] of LOOKS) {
      const image = photo(BAR, colour, surface);
      const before = outlineError(traced(image, false), BAR);
      const after = outlineError(traced(image, true), BAR);
      expect(after.meanAbs).toBeLessThan(before.meanAbs / 2);
      expect(after.p95).toBeLessThan(before.p95 / 2);
    }
  });

  it.each(LOOKS)('stays on the edge of %s beside its cast shadow', (_name, colour, surface) => {
    const error = outlineError(traced(photo(BAR, colour, surface, true), true), BAR);
    expect(Math.abs(error.bias)).toBeLessThan(0.3);
    expect(error.meanAbs).toBeLessThan(0.4);
    expect(error.p95).toBeLessThan(0.9);
  });
});

describe('a tool on a surface with a grain', () => {
  // Thin dark lines across the surface, as in wood, some passing close by the tool.
  const grain: Layer[] = Array.from({ length: 60 }, (_, i) => ({
    outline: [
      { x: 0, y: 12 * i },
      { x: W, y: 12 * i + 40 },
      { x: W, y: 12 * i + 42 },
      { x: 0, y: 12 * i + 2 },
    ],
    colour: [90, 60, 30] as const,
    opacity: 0.35,
  }));

  it('keeps the outline on the tool, not on a line of the grain beside it', () => {
    const image = renderPhoto({
      width: W,
      height: H,
      surface: WOOD,
      layers: [...grain, { outline: BAR, colour: BLACK }],
      blur: 1.2,
      noise: 3,
    });
    const error = outlineError(traced(image, true), BAR);
    expect(Math.abs(error.bias)).toBeLessThan(0.3);
    expect(error.meanAbs).toBeLessThan(0.4);
    expect(error.p95).toBeLessThan(0.9);
  });
});

describe('snapToEdges', () => {
  it('never folds an outline over itself where the mask left a spur', () => {
    // A mask grows spurs a few pixels long where a shadow or a glint crosses its threshold.
    const image = photo(BAR, STEEL, WHITE, true);
    const spurred = sampleRing(BAR, 1).map((p, i) => {
      const height = i >= 300 && i < 306 ? 4 : i >= 700 && i < 703 ? -3 : 0;
      return height === 0 ? p : outFrom(p, BAR, height);
    });
    expect(Math.max(...spurred.map((p) => signedDistance(p, BAR)))).toBeGreaterThan(3.5);
    const snapped = snapToEdges(image, spurred);
    expect(polylineCrosses(snapped)).toBe(false);
    expect(outlineError(snapped, BAR).p95).toBeLessThan(0.8);
  });

  it('moves the edge of a hole toward the tool around it', () => {
    const outer = arc(W / 2, H / 2, 120, 0, 2 * Math.PI, 96).slice(0, -1);
    const inner = arc(W / 2, H / 2, 60, 0, 2 * Math.PI, 96).slice(0, -1);
    const image = renderPhoto({
      width: W,
      height: H,
      surface: WHITE,
      layers: [
        { outline: outer, colour: RED },
        { outline: inner, colour: WHITE },
      ],
      blur: 1.2,
    });
    // A hole traced two pixels too small sits on the surface, inside the true edge.
    const small = arc(W / 2, H / 2, 58, 0, 2 * Math.PI, 96).slice(0, -1);
    expect(outlineError(small, inner).meanAbs).toBeGreaterThan(1.5);
    const error = outlineError(snapToEdges(image, small, { hole: true }), inner);
    expect(error.meanAbs).toBeLessThan(0.3);
  });

  it('pulls in an outline that sits several pixels off, as the model’s can', () => {
    const image = photo(BAR, RED, WHITE);
    const loose = pushedOut(BAR, 4);
    expect(outlineError(loose, BAR).meanAbs).toBeGreaterThan(3.5);
    expect(outlineError(snapToEdges(image, loose, { reach: 6 }), BAR).p95).toBeLessThan(0.8);
  });

  it('leaves an outline where it was when the photo shows no edge', () => {
    const blank = renderPhoto({ width: W, height: H, surface: WHITE, layers: [] });
    const snapped = snapToEdges(blank, KEY);
    expect(Math.max(...snapped.map((p) => Math.abs(signedDistance(p, KEY))))).toBeLessThan(1e-6);
  });

  it('moves the model’s outline too, when its mask is of the same photo', () => {
    const image = photo(BAR, BLACK, WOOD);
    // A soft mask whose half level lies three pixels outside the tool.
    const data = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        data[y * W + x] = Math.min(1, Math.max(0, 0.5 - (signedDistance({ x, y }, BAR) - 3) / 2));
      }
    }
    const scene = buildToolTraceSoft(
      { width: W, height: H, data },
      RULER,
      { symmetrize: false },
      image
    );
    if (!isOk(scene)) throw new Error(scene.error.code);
    const error = outlineError(scene.value.shapes[0].imagePoints, BAR);
    expect(Math.abs(error.bias)).toBeLessThan(0.3);
    expect(error.p95).toBeLessThan(0.9);
  });
});
