import { describe, it, expect } from 'vitest';
import { isOk, isErr } from '@/core/result';
import { parseSvgString } from './svgParser';

function svgWrap(content: string, width = 100, height = 100): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`;
}

describe('parseSvgString', () => {
  describe('error handling', () => {
    it('returns SVG_PARSE_FAILED for malformed XML', () => {
      const result = parseSvgString('<not-xml<>');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('SVG_PARSE_FAILED');
      }
    });

    it('returns SVG_UNSUPPORTED when no <svg> root', () => {
      const result = parseSvgString('<div xmlns="http://www.w3.org/1999/xhtml"><p>hello</p></div>');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('SVG_UNSUPPORTED');
      }
    });

    it('returns SVG_NO_SHAPES for SVG with only text', () => {
      const result = parseSvgString(svgWrap('<text x="10" y="10">Hello</text>'));
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('SVG_NO_SHAPES');
      }
    });

    it('returns SVG_NO_SHAPES for empty SVG', () => {
      const result = parseSvgString(svgWrap(''));
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('SVG_NO_SHAPES');
      }
    });
  });

  describe('rect conversion', () => {
    it('converts a simple rect to rectangle cutout spec', () => {
      const result = parseSvgString(svgWrap('<rect x="10" y="20" width="30" height="40"/>'));
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value).toHaveLength(1);
      const spec = result.value[0];
      expect(spec.shape).toBe('rectangle');
      expect(spec.width).toBe(30);
      expect(spec.depth).toBe(40);
      // SVG Y=20, height=40 → bottom edge in SVG is at Y=60
      // Y-flip: cutout y = viewBoxHeight(100) - (svgY + height) = 100 - 60 = 40
      expect(spec.y).toBe(40);
      expect(spec.x).toBe(10);
    });

    it('preserves corner radius from rx attribute', () => {
      const result = parseSvgString(svgWrap('<rect x="0" y="0" width="20" height="20" rx="3"/>'));
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value[0].cornerRadius).toBe(3);
    });

    it('uses ry when rx is absent (SVG spec fallback)', () => {
      const result = parseSvgString(svgWrap('<rect x="0" y="0" width="20" height="20" ry="4"/>'));
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value[0].cornerRadius).toBe(4);
    });

    it('uses max(rx, ry) for elliptical corner approximation', () => {
      const result = parseSvgString(
        svgWrap('<rect x="0" y="0" width="20" height="20" rx="2" ry="5"/>')
      );
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value[0].cornerRadius).toBe(5);
    });

    it('clamps corner radius to half the smaller dimension', () => {
      const result = parseSvgString(svgWrap('<rect x="0" y="0" width="10" height="20" rx="8"/>'));
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value[0].cornerRadius).toBe(5); // min(10,20)/2 = 5
    });

    it('skips rects with zero dimensions', () => {
      const result = parseSvgString(svgWrap('<rect x="0" y="0" width="0" height="20"/>'));
      expect(isErr(result)).toBe(true);
    });
  });

  describe('circle conversion', () => {
    it('converts a circle to circle cutout spec', () => {
      const result = parseSvgString(svgWrap('<circle cx="50" cy="50" r="20"/>'));
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const spec = result.value[0];
      expect(spec.shape).toBe('circle');
      expect(spec.width).toBe(40);
      expect(spec.depth).toBe(40);
      // center at (50, 50) with r=20 → x = 50-20 = 30
      expect(spec.x).toBe(30);
      // Y-flip: cutout y = 100 - (50+20) = 30
      expect(spec.y).toBe(30);
    });

    it('skips circles with zero radius', () => {
      const result = parseSvgString(svgWrap('<circle cx="50" cy="50" r="0"/>'));
      expect(isErr(result)).toBe(true);
    });
  });

  describe('ellipse conversion', () => {
    it('converts an ellipse to circle cutout spec with different width/depth', () => {
      const result = parseSvgString(svgWrap('<ellipse cx="50" cy="50" rx="20" ry="10"/>'));
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const spec = result.value[0];
      expect(spec.shape).toBe('circle');
      expect(spec.width).toBe(40);
      expect(spec.depth).toBe(20);
    });
  });

  describe('polygon conversion', () => {
    it('converts a polygon to path cutout spec', () => {
      const result = parseSvgString(svgWrap('<polygon points="10,10 90,10 50,90"/>'));
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const spec = result.value[0];
      expect(spec.shape).toBe('path');
      expect(spec.path).toBeDefined();
      expect(spec.path).toHaveLength(3);
      // All points should have null handles (straight segments)
      if (!spec.path) return;
      for (const pt of spec.path) {
        expect(pt.handleIn).toBeNull();
        expect(pt.handleOut).toBeNull();
      }
    });
  });

  describe('path conversion', () => {
    it('converts a simple closed path with line segments', () => {
      const d = 'M 10 10 L 90 10 L 90 90 L 10 90 Z';
      const result = parseSvgString(svgWrap(`<path d="${d}"/>`));
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const spec = result.value[0];
      expect(spec.shape).toBe('path');
      expect(spec.path).toBeDefined();
      // After Z removes duplicate endpoint, we get 4 points
      if (!spec.path) return;
      expect(spec.path.length).toBeGreaterThanOrEqual(3);
    });

    it('converts a cubic bezier path preserving handles', () => {
      // Closed bezier path with curves that have non-zero area
      const d = 'M 10 10 C 10 50 50 90 90 90 L 90 10 Z';
      const result = parseSvgString(svgWrap(`<path d="${d}"/>`));
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const spec = result.value[0];
      expect(spec.shape).toBe('path');
      expect(spec.path).toBeDefined();

      // First point should have handleOut (from the C command's cp1)
      if (!spec.path) return;
      const firstPt = spec.path[0];
      expect(firstPt.handleOut).not.toBeNull();

      // Second point (end of C command) should have handleIn
      const secondPt = spec.path[1];
      expect(secondPt.handleIn).not.toBeNull();
    });

    it('splits multi-contour paths into separate specs', () => {
      const d = 'M 10 10 L 40 10 L 40 40 Z M 60 60 L 90 60 L 90 90 Z';
      const result = parseSvgString(svgWrap(`<path d="${d}"/>`));
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value.length).toBe(2);
    });
  });

  describe('transforms', () => {
    it('applies translate transform to rect', () => {
      const result = parseSvgString(
        svgWrap('<rect x="0" y="0" width="20" height="20" transform="translate(10, 10)"/>')
      );
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const spec = result.value[0];
      expect(spec.shape).toBe('rectangle');
      expect(spec.x).toBe(10);
      // Y-flip: 100 - (10 + 20) = 70
      expect(spec.y).toBe(70);
    });

    it('applies group transform to nested elements', () => {
      const svg = svgWrap(
        '<g transform="translate(20, 0)"><rect x="0" y="0" width="10" height="10"/></g>'
      );
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // Rect at x=0 + group translate(20,0) = x=20
      expect(result.value[0].x).toBe(20);
    });
  });

  describe('viewBox handling', () => {
    it('uses viewBox for coordinate mapping', () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect x="0" y="0" width="100" height="100"/></svg>`;
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const spec = result.value[0];
      expect(spec.width).toBe(100);
      expect(spec.depth).toBe(100);
    });

    it('falls back to width/height when viewBox has zero dimensions', () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 0 100"><rect x="10" y="10" width="30" height="30"/></svg>`;
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // Should fall back to width=100, height=100 (not zero-width viewBox)
      const spec = result.value[0];
      expect(spec.width).toBe(30);
      // Y-flip uses height=100: y = 100 - (10 + 30) = 60
      expect(spec.y).toBe(60);
    });

    it('falls back to width/height when viewBox has negative dimensions', () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 -50 -50"><rect x="10" y="10" width="30" height="30"/></svg>`;
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const spec = result.value[0];
      expect(spec.width).toBe(30);
    });

    it('handles viewBox with non-zero origin', () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 10 80 80"><rect x="10" y="10" width="20" height="20"/></svg>`;
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // Rect at x=10, viewBox minX=10 → effective x = 0
      expect(result.value[0].x).toBe(0);
    });
  });

  describe('multiple elements', () => {
    it('converts multiple elements into separate specs', () => {
      const svg = svgWrap(
        '<rect x="0" y="0" width="20" height="20"/>' + '<circle cx="60" cy="60" r="10"/>'
      );
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value).toHaveLength(2);
      expect(result.value[0].shape).toBe('rectangle');
      expect(result.value[1].shape).toBe('circle');
    });
  });

  describe('non-rendered containers', () => {
    it('ignores shapes inside <defs>', () => {
      const svg = svgWrap(
        '<defs><rect id="template" x="0" y="0" width="20" height="20"/></defs>' +
          '<circle cx="50" cy="50" r="10"/>'
      );
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value).toHaveLength(1);
      expect(result.value[0].shape).toBe('circle');
    });

    it('ignores shapes inside <clipPath>', () => {
      const svg = svgWrap(
        '<clipPath id="clip"><rect x="0" y="0" width="50" height="50"/></clipPath>' +
          '<rect x="10" y="10" width="30" height="30"/>'
      );
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value).toHaveLength(1);
    });

    it('returns SVG_NO_SHAPES when all shapes are inside defs', () => {
      const svg = svgWrap('<defs><rect x="0" y="0" width="20" height="20"/></defs>');
      const result = parseSvgString(svg);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('SVG_NO_SHAPES');
      }
    });
  });

  describe('viewBox with transforms', () => {
    it('does not double-apply viewBox offset for transformed circle', () => {
      // Non-zero viewBox origin + rotation transform
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="50 50 100 100">
        <circle cx="100" cy="100" r="10" transform="rotate(45 100 100)"/>
      </svg>`;
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const spec = result.value[0];
      // Center should be at (50,50) in viewBox-adjusted coords, not shifted by extra viewBox offset
      const centerX = spec.x + spec.width / 2;
      const centerY = spec.y + spec.depth / 2;
      expect(centerX).toBeCloseTo(50, 0);
      expect(centerY).toBeCloseTo(50, 0);
    });

    it('does not double-apply viewBox offset for transformed ellipse', () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="50 50 100 100">
        <ellipse cx="100" cy="100" rx="10" ry="5" transform="rotate(45 100 100)"/>
      </svg>`;
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const spec = result.value[0];
      const centerX = spec.x + spec.width / 2;
      const centerY = spec.y + spec.depth / 2;
      expect(centerX).toBeCloseTo(50, 0);
      expect(centerY).toBeCloseTo(50, 0);
    });
  });

  // Issue #1643 — "wrong scale" failure mode.
  // SVGs from drawing tools (Inkscape, Illustrator) commonly carry physical
  // dimensions (mm/in) with a much larger viewBox; importing them at 1:1
  // produced cutouts orders of magnitude too large.
  describe('physical units (issue #1643)', () => {
    it('scales user units → mm when SVG declares physical width/height in mm', () => {
      // Inkscape-style: 100mm canvas with 800-unit viewBox (10x oversampling)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 800 800">
        <rect x="0" y="0" width="80" height="80"/>
      </svg>`;
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // 80 user units * (100mm / 800) = 10mm
      expect(result.value[0].width).toBeCloseTo(10, 5);
      expect(result.value[0].depth).toBeCloseTo(10, 5);
    });

    it('scales when SVG declares dimensions in inches', () => {
      // 1in = 25.4mm; viewBox 100x100 → user-unit = 0.254mm
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1in" height="1in" viewBox="0 0 100 100">
        <rect x="0" y="0" width="50" height="50"/>
      </svg>`;
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value[0].width).toBeCloseTo(12.7, 3);
    });

    it('keeps unitless width/height at 1:1 (preserves historical behavior)', () => {
      // Without physical units we can't know the intended physical scale —
      // current contract is 1 user unit = 1 mm, leave as-is.
      const result = parseSvgString(svgWrap('<rect x="0" y="0" width="42" height="42"/>'));
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value[0].width).toBe(42);
    });

    it('scales path point coordinates and handles', () => {
      // Real curves must scale uniformly so the visual shape is preserved
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="50mm" height="50mm" viewBox="0 0 100 100">
        <path d="M 0 0 C 50 0 50 100 100 100"/>
      </svg>`;
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      const spec = result.value[0];
      expect(spec.shape).toBe('path');
      // Path is open (no Z) — pathPointsToSpec needs ≥2 anchors and produces a spec
      expect(spec.path).toBeDefined();
      // Bbox spans the full curve, scaled 50/100 = 0.5
      expect(spec.width).toBeCloseTo(50, 1);
      expect(spec.depth).toBeCloseTo(50, 1);
    });

    it('falls back to identity for genuinely non-square SVGs (avoids silent distortion)', () => {
      // 200mm × 100mm with viewBox 200x200 → sx=1, sy=0.5 — uniform scaling
      // would silently shrink the canvas, so we keep user units instead.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200mm" height="100mm" viewBox="0 0 200 200">
        <rect x="0" y="0" width="100" height="100"/>
      </svg>`;
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      // Identity scale → cutout matches the source attribute (100 user units)
      expect(result.value[0].width).toBe(100);
      expect(result.value[0].depth).toBe(100);
    });

    it('absorbs sub-percent sx/sy drift from real-world exports as a single scalar', () => {
      // Tools occasionally export 100mm × 99.95mm with viewBox 100x100 due to
      // float rounding — that's still effectively uniform, so apply the average.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="99.95mm" viewBox="0 0 100 100">
        <rect x="0" y="0" width="100" height="100"/>
      </svg>`;
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      // (1 + 0.9995) / 2 = 0.99975 ≈ 1
      expect(result.value[0].width).toBeCloseTo(99.975, 2);
    });

    it('does not apply physical scaling when no explicit viewBox is present', () => {
      // The fallback viewBox is parseFloat'd from width/height and silently
      // drops unit suffixes — `width="1in"` would yield viewBox.width=1 and
      // a wildly wrong 25.4 mm/unit scale. Skip scaling when there's no real
      // viewBox to anchor it against.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1in" height="1in">
        <rect x="0" y="0" width="50" height="50"/>
      </svg>`;
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      // Identity scale → cutout matches the source attribute (50 user units)
      expect(result.value[0].width).toBe(50);
    });

    it('falls back to identity when only one of width/height has units', () => {
      // Mixed/incomplete physical sizing → don't attempt to scale
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100" viewBox="0 0 200 200">
        <rect x="0" y="0" width="50" height="50"/>
      </svg>`;
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value[0].width).toBe(50);
    });
  });

  // Issue #1643 — fixtures resembling real-world editor output.
  describe('real-world fixtures (issue #1643)', () => {
    it('parses an Inkscape-style heart icon at the declared physical size', () => {
      // Heart silhouette in a 25mm × 25mm icon authored in Inkscape
      // (viewBox 100 × 100 → user-unit scale = 0.25)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="25mm" height="25mm" viewBox="0 0 100 100">
        <path d="M 50 30 C 50 10 80 10 80 35 C 80 60 50 80 50 90 C 50 80 20 60 20 35 C 20 10 50 10 50 30 Z"/>
      </svg>`;
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const spec = result.value[0];
      expect(spec.shape).toBe('path');
      // 25mm canvas → bbox should fit comfortably under 25mm in both axes
      expect(spec.width).toBeLessThanOrEqual(25);
      expect(spec.depth).toBeLessThanOrEqual(25);
      // Heart has real area in both axes (>10mm at 25mm canvas)
      expect(spec.width).toBeGreaterThan(10);
      expect(spec.depth).toBeGreaterThan(10);
    });

    it('parses a multi-contour SVG (icon set) into multiple specs', () => {
      // Three icon glyphs side-by-side, e.g. a custom set
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="20mm" viewBox="0 0 60 20">
        <circle cx="10" cy="10" r="8"/>
        <rect x="22" y="2" width="16" height="16" rx="2"/>
        <polygon points="50,2 58,18 42,18"/>
      </svg>`;
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value).toHaveLength(3);
      // 1mm-per-user-unit physical scale, so dimensions equal the source attrs
      expect(result.value[0].width).toBe(16); // circle dia
      expect(result.value[1].width).toBe(16); // rect width
    });

    it('handles nested group transforms with physical scaling combined', () => {
      // A logo with a rotated group inside a translated group, in a physically
      // sized SVG — the most common "wrong scale + wrong shape" combo
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40mm" height="40mm" viewBox="0 0 80 80">
        <g transform="translate(40 40)">
          <g transform="rotate(45)">
            <rect x="-10" y="-10" width="20" height="20"/>
          </g>
        </g>
      </svg>`;
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const spec = result.value[0];
      // Rotation forces the rect through the rasterize path, producing a path
      expect(spec.shape).toBe('path');
      // Diamond inscribed in a 20-unit square has bbox ≈ 28.28 user units;
      // physically scaled by 40/80 = 0.5 → bbox ≈ 14.14mm.
      expect(spec.width).toBeCloseTo(14.142, 1);
      expect(spec.depth).toBeCloseTo(14.142, 1);
    });
  });

  // Issue #1643 — anchor-only bounds clipped curves whose handles extend
  // beyond the anchor extents. `pathPointsToSpec` now uses flattened bezier
  // bounds so the spec bbox tracks the visible curve.
  describe('bezier bounds (issue #1643)', () => {
    it('reflects curve extent (not just anchors) in the bbox', () => {
      // Two anchors at the same SVG y=50 with control handles pulled to
      // y=30 and y=70. Anchor-only bounds → depth=0 → spec rejected as
      // degenerate. Flattened bounds capture the curve dipping ~5 units
      // off the anchor line in cutout space.
      const svg = svgWrap('<path d="M 0 50 C 25 30 25 70 50 50 Z"/>');
      const result = parseSvgString(svg);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      const spec = result.value[0];
      expect(spec.shape).toBe('path');
      expect(spec.width).toBeCloseTo(50, 0);
      expect(spec.depth).toBeGreaterThan(0);
    });
  });
});
