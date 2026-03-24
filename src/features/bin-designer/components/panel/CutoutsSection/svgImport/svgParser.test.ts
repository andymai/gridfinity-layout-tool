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
});
