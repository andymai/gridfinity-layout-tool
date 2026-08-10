import { describe, it, expect } from 'vitest';
import { buildCalibrationSheetSvg, type CalibrationSheetLabels } from './calibrationSheetSvg';
import {
  detectCalibrationGrid,
  calibrationNodes,
  CALIBRATION_MARKER_MM,
  CALIBRATION_PITCH_MM,
} from '@/shared/scanTrace';
import { applyHomography } from '@/shared/scanTrace/perspective';
import type { ImageDataLike, Point } from '@/shared/scanTrace';

const LABELS: CalibrationSheetLabels = {
  title: 'Calibration sheet',
  printHint: 'Print at 100%',
  placeHint: 'Place the tool inside the frame',
};

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The marker squares the sheet actually prints, in page millimetres. */
function markerRects(svg: string): Rect[] {
  const rects: Rect[] = [];
  const pattern = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"\/>/g;
  for (const m of svg.matchAll(pattern)) {
    rects.push({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) });
  }
  return rects;
}

describe('buildCalibrationSheetSvg', () => {
  const svg = buildCalibrationSheetSvg(LABELS);

  it('declares real-world page units so a 100% print is to scale', () => {
    expect(svg).toContain('width="210mm"');
    expect(svg).toContain('height="297mm"');
    expect(svg).toContain('viewBox="0 0 210 297"');
  });

  it('prints one square per lattice node, at the size the detector expects', () => {
    const rects = markerRects(svg);
    expect(rects).toHaveLength(calibrationNodes().length);
    for (const rect of rects) {
      expect(rect.w).toBe(CALIBRATION_MARKER_MM);
      expect(rect.h).toBe(CALIBRATION_MARKER_MM);
    }
  });

  it("spaces the markers at the detector's pitch", () => {
    const xs = [...new Set(markerRects(svg).map((r) => r.x))].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i] - xs[i - 1]).toBeCloseTo(CALIBRATION_PITCH_MM, 6);
    }
  });

  // One file has to print correctly on A4 (210×297) and US Letter (216×279) at
  // 100%, so nothing may rely on the 18mm of height A4 has and Letter doesn't.
  it('keeps every printed element inside US Letter as well as A4', () => {
    const rects = markerRects(svg);
    expect(Math.min(...rects.map((r) => r.x))).toBeGreaterThan(10);
    expect(Math.min(...rects.map((r) => r.y))).toBeGreaterThan(10);
    expect(Math.max(...rects.map((r) => r.x + r.w))).toBeLessThan(210 - 10);

    const ys = [...svg.matchAll(/\sy="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys)).toBeLessThan(279 - 11);
  });

  it('draws a ruler exactly 100mm long', () => {
    const bar = /<path d="M(\d+(?:\.\d+)?) (\d+(?:\.\d+)?) h(\d+(?:\.\d+)?)/.exec(svg);
    expect(bar).not.toBeNull();
    expect(Number(bar?.[3])).toBe(100);
  });

  it('escapes label text rather than emitting it raw', () => {
    const hostile = buildCalibrationSheetSvg({ ...LABELS, title: '<b>Tom & "Jerry"</b>' });
    expect(hostile).toContain('&lt;b&gt;Tom &amp; &quot;Jerry&quot;&lt;/b&gt;');
    expect(hostile).not.toContain('<b>');
  });
});

// The printable and the detector share constants, but sharing constants is not
// the same as agreeing. Photograph what the sheet prints and measure it back.
describe('the printed sheet round-trips through the detector', () => {
  const W = 620;
  const H = 800;

  function camera(p: Point): Point {
    const x = p.x - 105;
    const y = p.y - 130;
    const tilt = 0.18;
    const xc = x;
    const yc = Math.cos(tilt) * y;
    const zc = Math.sin(tilt) * y + 780;
    return { x: (2500 * xc) / zc + W / 2, y: (2500 * yc) / zc + H / 2 };
  }

  function photograph(rects: readonly Rect[]): ImageDataLike {
    const quads = rects.map((r) =>
      [
        { x: r.x, y: r.y },
        { x: r.x + r.w, y: r.y },
        { x: r.x + r.w, y: r.y + r.h },
        { x: r.x, y: r.y + r.h },
      ].map(camera)
    );
    const inside = (p: Point, poly: readonly Point[]): boolean => {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i];
        const b = poly[j];
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
          hit = !hit;
        }
      }
      return hit;
    };
    const boxes = quads.map((q) => ({
      minX: Math.min(...q.map((p) => p.x)),
      maxX: Math.max(...q.map((p) => p.x)),
      minY: Math.min(...q.map((p) => p.y)),
      maxY: Math.max(...q.map((p) => p.y)),
    }));

    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let v = 245;
        for (let i = 0; i < quads.length; i++) {
          const b = boxes[i];
          if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
          if (inside({ x, y }, quads[i])) {
            v = 20;
            break;
          }
        }
        const o = (y * W + x) * 4;
        data[o] = data[o + 1] = data[o + 2] = v;
        data[o + 3] = 255;
      }
    }
    return { width: W, height: H, data };
  }

  it('measures a known distance on the printed page to true millimetres', () => {
    const rects = markerRects(buildCalibrationSheetSvg(LABELS));
    const grid = detectCalibrationGrid(photograph(rects));
    expect(grid).not.toBeNull();
    if (!grid) return;
    expect(grid.markers).toHaveLength(calibrationNodes().length);

    // Two points 130mm apart on the page, inside the marker frame.
    const a = applyHomography(grid.homography, camera({ x: 50, y: 70 }));
    const b = applyHomography(grid.homography, camera({ x: 100, y: 190 }));
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(130, 0);
  });
});
