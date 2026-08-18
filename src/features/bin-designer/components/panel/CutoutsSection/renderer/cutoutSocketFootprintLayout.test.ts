import { describe, it, expect } from 'vitest';
import {
  ICON_BAND_MM,
  ICON_GAP_MM,
  TEXT_BAND_MM,
  TEXT_MARGIN_MM,
  roundedRectShape,
  socketCaptionLayout,
} from './cutoutSocketFootprintLayout';

/** 1U and 2U plate widths, the two the editor draws most. */
const PLATE_1U = 36;
const PLATE_2U = 78;

describe('socketCaptionLayout', () => {
  it('centres a caption on a plate with no icon', () => {
    const { captionCenter, captionSpan } = socketCaptionLayout(PLATE_1U, false, 'M4');

    expect(captionCenter).toBe(0);
    expect(captionSpan).toBe(PLATE_1U - 2 * TEXT_MARGIN_MM);
  });

  // The icon takes the leading end of the readable band, so the caption has to
  // give up that width AND shift out of it. A caption that only narrowed
  // would sit under the icon.
  it('yields the leading band to an icon and shifts clear of it', () => {
    const plain = socketCaptionLayout(PLATE_1U, false, 'M4');
    const withIcon = socketCaptionLayout(PLATE_1U, true, 'M4');

    expect(withIcon.captionSpan).toBe(plain.captionSpan - ICON_BAND_MM - ICON_GAP_MM);
    expect(withIcon.captionCenter).toBeGreaterThan(0);
    expect(withIcon.captionCenter - withIcon.captionSpan / 2).toBeGreaterThanOrEqual(
      withIcon.iconCenter + ICON_BAND_MM / 2
    );
  });

  it('caps the font at the plate’s readable height for a short caption', () => {
    expect(socketCaptionLayout(PLATE_2U, false, 'M4').fontSize).toBe(TEXT_BAND_MM);
  });

  it('shrinks the font as the caption lengthens', () => {
    const short = socketCaptionLayout(PLATE_1U, false, 'M4').fontSize;
    const long = socketCaptionLayout(PLATE_1U, false, 'M4 SOCKET CAP SCREW').fontSize;

    expect(long).toBeGreaterThan(0);
    expect(long).toBeLessThan(short);
  });

  it('draws no caption for an empty or blank one', () => {
    expect(socketCaptionLayout(PLATE_1U, false, '').fontSize).toBe(0);
    expect(socketCaptionLayout(PLATE_1U, false, '   ').fontSize).toBe(0);
  });

  // A plate narrower than its own margins plus icon has nowhere to put text;
  // a negative span would flip the caption inside out.
  it('never reports a negative caption span', () => {
    expect(socketCaptionLayout(6, true, 'M4').captionSpan).toBe(0);
    expect(socketCaptionLayout(6, true, 'M4').fontSize).toBe(0);
  });
});

describe('roundedRectShape', () => {
  it('spans the requested footprint', () => {
    const box = roundedRectShape(36, 11, 0.5)
      .getPoints(16)
      .reduce(
        (acc, p) => ({
          minX: Math.min(acc.minX, p.x),
          maxX: Math.max(acc.maxX, p.x),
          minY: Math.min(acc.minY, p.y),
          maxY: Math.max(acc.maxY, p.y),
        }),
        { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
      );

    expect(box.maxX - box.minX).toBeCloseTo(36, 4);
    expect(box.maxY - box.minY).toBeCloseTo(11, 4);
    expect(box.minX).toBeCloseTo(-18, 4);
  });

  // A radius wider than half the short side would invert the corner arcs.
  it('clamps the corner radius to half the short side', () => {
    const points = roundedRectShape(10, 4, 50).getPoints(16);

    expect(points.every((p) => Math.abs(p.x) <= 5.0001 && Math.abs(p.y) <= 2.0001)).toBe(true);
  });
});
