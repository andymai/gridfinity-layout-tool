import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadFont, getFont } from 'brepjs/text';
import {
  createTypeMeasurer,
  planTypeBlock,
  planMinStemMm,
  type GlyphFont,
  type TypeMeasurer,
  type TypePlanOptions,
} from './typePlan';
import { DEFAULT_TEXT_STYLE_DEFAULTS, TEXT_PRESETS } from '@/shared/types/bin';
import type { TextStyleDefaults } from '@/shared/types/bin';

const FONT_DIR = 'src/shared/fonts/assets';
const FONT_FILES: Record<string, string> = {
  atkinson: `${FONT_DIR}/AtkinsonHyperlegible-Regular.ttf`,
  'atkinson-bold': `${FONT_DIR}/AtkinsonHyperlegible-Bold.ttf`,
  'jetbrains-mono': `${FONT_DIR}/JetBrainsMono-Regular.ttf`,
  'barlow-condensed': `${FONT_DIR}/BarlowCondensed-SemiBold.ttf`,
};

let measurer: TypeMeasurer;

beforeAll(async () => {
  for (const [family, file] of Object.entries(FONT_FILES)) {
    const buf = readFileSync(file);
    await loadFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), family);
  }
  measurer = createTypeMeasurer((family) => getFont(family) as GlyphFont | undefined);
});

const HOST = { width: 60, depth: 20 };

function plan(
  text: string,
  style: Partial<TextStyleDefaults>,
  extra: Partial<TypePlanOptions> = {}
) {
  return planTypeBlock(
    {
      text,
      style: { ...DEFAULT_TEXT_STYLE_DEFAULTS, ...style },
      host: HOST,
      ...extra,
    },
    measurer
  );
}

describe('createTypeMeasurer', () => {
  it('reads the declared cap height rather than guessing from the ascender', () => {
    const vertical = measurer.vertical('atkinson');
    expect(vertical).not.toBeNull();
    // Atkinson Hyperlegible declares sCapHeight 668 at 1000 upem.
    expect(vertical?.capHeight).toBeCloseTo(0.668, 5);
  });

  it('distributes kerning across per-glyph advances so pen positions sum to the kerned width', () => {
    const run = measurer.run('HELLO', 'atkinson');
    expect(run).not.toBeNull();
    const summed = run?.advances.reduce((a, b) => a + b, 0) ?? 0;
    expect(summed).toBeCloseTo(run?.advance ?? -1, 6);
  });
});

describe('planTypeBlock anchoring', () => {
  it('flushes the INK to the margin on a bottom-left anchor, not the advance box', () => {
    const result = plan('HEX', {
      anchor: 'bottom-left',
      margin: 3,
      sizeMode: 'fixed',
      fixedSize: 6,
    });
    expect(result).not.toBeNull();
    const line = result?.lines[0];
    // H is neither round nor pointed, so no optical allowance applies and the
    // ink lands exactly on the margin.
    expect(line?.inkMinX).toBeCloseTo(-HOST.width / 2 + 3, 5);
  });

  it('lets a round leading glyph overhang the margin slightly', () => {
    const straight = plan('HEX', {
      anchor: 'bottom-left',
      margin: 3,
      sizeMode: 'fixed',
      fixedSize: 6,
    });
    const round = plan('OHM', {
      anchor: 'bottom-left',
      margin: 3,
      sizeMode: 'fixed',
      fixedSize: 6,
    });
    expect(round?.lines[0].inkMinX).toBeLessThan(straight?.lines[0].inkMinX ?? 0);
  });

  it('centres on the ink box so an asymmetric string is not visually off-centre', () => {
    const result = plan('J17.', { anchor: 'center', sizeMode: 'fixed', fixedSize: 6 });
    expect(result).not.toBeNull();
    const line = result?.lines[0];
    expect((line?.inkMinX ?? 0) + (line?.inkMaxX ?? 0)).toBeCloseTo(0, 5);
  });

  it('shares one baseline between a caps run and a descender run at the same size', () => {
    const caps = plan('HELLO', { anchor: 'bottom-left', sizeMode: 'fixed', fixedSize: 6 });
    const desc = plan('happy', { anchor: 'bottom-left', sizeMode: 'fixed', fixedSize: 6 });
    expect(caps?.lines[0].baselineY).toBeCloseTo(desc?.lines[0].baselineY ?? -1, 6);
  });

  it('applies the offset nudge on top of the anchored position', () => {
    const base = plan('HEX', { anchor: 'bottom-left', sizeMode: 'fixed', fixedSize: 6 });
    const moved = plan('HEX', {
      anchor: 'bottom-left',
      sizeMode: 'fixed',
      fixedSize: 6,
      offset: { x: 2, y: 1.5 },
    });
    expect((moved?.lines[0].inkMinX ?? 0) - (base?.lines[0].inkMinX ?? 0)).toBeCloseTo(2, 6);
    expect((moved?.lines[0].baselineY ?? 0) - (base?.lines[0].baselineY ?? 0)).toBeCloseTo(1.5, 6);
  });
});

describe('planTypeBlock type controls', () => {
  it('widens the advance by tracking on every gap but not after the last glyph', () => {
    const flat = plan('HEXNUT', { sizeMode: 'fixed', fixedSize: 6, tracking: 0 });
    const tracked = plan('HEXNUT', { sizeMode: 'fixed', fixedSize: 6, tracking: 0.1 });
    const gaps = 5;
    expect((tracked?.lines[0].advance ?? 0) - (flat?.lines[0].advance ?? 0)).toBeCloseTo(
      0.1 * 6 * gaps,
      5
    );
  });

  it('upper-cases at render time without touching the stored string', () => {
    const result = plan('m3 hex', { textCase: 'upper', sizeMode: 'fixed', fixedSize: 6 });
    expect(result?.lines[0].text).toBe('M3 HEX');
  });

  it('leaves an all-caps word alone under title case', () => {
    const result = plan('din 934 bolt', { textCase: 'title', sizeMode: 'fixed', fixedSize: 5 });
    expect(result?.lines[0].text).toBe('Din 934 Bolt');
  });

  it('renders an authored second line smaller when lineScale is set', () => {
    const result = plan('M3 HEX NUTS\nDIN 934', {
      sizeMode: 'fixed',
      fixedSize: 6,
      lineScale: 0.6,
    });
    expect(result?.lines).toHaveLength(2);
    expect(result?.lines[0].fontSize).toBeCloseTo(6, 6);
    expect(result?.lines[1].fontSize).toBeCloseTo(3.6, 6);
    expect(result?.lines[1].baselineY).toBeLessThan(result?.lines[0].baselineY ?? 0);
  });

  it('keeps a wrapped line at the primary size, since it is the same phrase', () => {
    const narrow = planTypeBlock(
      {
        text: 'STAINLESS WASHERS ASSORTED',
        style: { ...DEFAULT_TEXT_STYLE_DEFAULTS, sizeMode: 'fixed', fixedSize: 6, lineScale: 0.5 },
        host: { width: 40, depth: 24 },
      },
      measurer
    );
    expect(narrow?.wrapped).toBe(true);
    expect(narrow?.lines.length).toBeGreaterThan(1);
    for (const line of narrow?.lines ?? []) expect(line.fontSize).toBeCloseTo(6, 6);
  });
});

describe('planTypeBlock sizing', () => {
  it('honours a fixed size that fits rather than only shrinking below auto-fit', () => {
    const result = plan('M3', { sizeMode: 'fixed', fixedSize: 8 });
    expect(result?.fontSize).toBeCloseTo(8, 6);
    expect(result?.shrunk).toBe(false);
  });

  it('wraps before shrinking, and reports shrinking when wrapping is not enough', () => {
    const wrapped = planTypeBlock(
      {
        text: 'LONG CAPTION HERE',
        style: { ...DEFAULT_TEXT_STYLE_DEFAULTS, sizeMode: 'fixed', fixedSize: 8 },
        // Wide enough that wrapping is the binding fix and tall enough that
        // three lines plus the datum floor genuinely fit, so the assertion is
        // about the cascade rather than about a knife-edge host.
        host: { width: 44, depth: 30 },
      },
      measurer
    );
    expect(wrapped?.wrapped).toBe(true);
    expect(wrapped?.shrunk).toBe(false);
    expect(wrapped?.fontSize).toBeCloseTo(8, 6);

    const shrunk = planTypeBlock(
      {
        text: 'UNBREAKABLE',
        style: { ...DEFAULT_TEXT_STYLE_DEFAULTS, sizeMode: 'fixed', fixedSize: 12 },
        host: { width: 40, depth: 14 },
      },
      measurer
    );
    expect(shrunk?.shrunk).toBe(true);
    expect(shrunk?.fontSize).toBeLessThan(12);
  });

  it('snaps an auto-fitted size down onto the type scale, never up', () => {
    const free = plan('M3 HEX', { sizeMode: 'auto', maxFontSize: 40 });
    const snapped = plan('M3 HEX', { sizeMode: 'auto', maxFontSize: 40, snapToScale: true });
    expect(snapped?.fontSize).toBeLessThanOrEqual(free?.fontSize ?? 0);
    expect([2.5, 3, 3.5, 4, 5, 6, 8, 10, 12, 16, 20, 26, 32]).toContain(snapped?.fontSize);
  });

  it('lets a shared group size win over the style, still subject to the fit', () => {
    const result = plan('M3', { sizeMode: 'fixed', fixedSize: 12 }, { sharedSizeMm: 5 });
    expect(result?.fontSize).toBeCloseTo(5, 6);
  });

  it('keeps an anchored block inside the host it was fitted to', () => {
    // The bug the specimen sheet caught: the fit budgeted `capTop - inkBottom`
    // while the bottom anchor additionally reserved the font descender, so a
    // caption with no descenders was lifted clean out of the top of its host.
    // Asserted across every anchor and both caption shapes, because the two
    // that overflow are exactly the ones nobody thinks to check.
    for (const anchor of [
      'top-left',
      'top',
      'top-right',
      'left',
      'center',
      'right',
      'bottom-left',
      'bottom',
      'bottom-right',
    ] as const) {
      for (const text of ['M3', 'happy jg']) {
        const host = { width: 64, depth: 20 };
        const result = planTypeBlock(
          {
            text,
            style: { ...DEFAULT_TEXT_STYLE_DEFAULTS, anchor, margin: 3, maxFontSize: 40 },
            host,
          },
          measurer
        );
        expect(result, `${anchor} / ${text}`).not.toBeNull();
        if (!result) continue;
        expect(result.maxY, `${anchor} / ${text} top`).toBeLessThanOrEqual(host.depth / 2 + 1e-6);
        expect(result.minY, `${anchor} / ${text} bottom`).toBeGreaterThanOrEqual(
          -host.depth / 2 - 1e-6
        );
        expect(result.maxX, `${anchor} / ${text} right`).toBeLessThanOrEqual(host.width / 2 + 1e-6);
        expect(result.minX, `${anchor} / ${text} left`).toBeGreaterThanOrEqual(
          -host.width / 2 - 1e-6
        );
      }
    }
  });

  it('returns null rather than a degenerate plan when the floor will not fit', () => {
    const result = planTypeBlock(
      {
        text: 'WAY TOO LONG FOR THIS HOST',
        style: { ...DEFAULT_TEXT_STYLE_DEFAULTS, minFontSize: 6 },
        host: { width: 8, depth: 4 },
      },
      measurer
    );
    expect(result).toBeNull();
  });
});

describe('stem width', () => {
  it('measures a narrower stem for smaller type', () => {
    const big = plan('HEX', { sizeMode: 'fixed', fixedSize: 12 });
    const small = plan('HEX', { sizeMode: 'fixed', fixedSize: 3 });
    const bigStem = big ? planMinStemMm(big, measurer) : null;
    const smallStem = small ? planMinStemMm(small, measurer) : null;
    expect(bigStem).not.toBeNull();
    expect(smallStem).not.toBeNull();
    expect(smallStem ?? 0).toBeLessThan(bigStem ?? 0);
    expect((bigStem ?? 0) / (smallStem ?? 1)).toBeCloseTo(4, 1);
  });

  it('reports the bold cut as the wider stem at the same size, which is what makes it the fix', () => {
    const regular = plan('HEX', { font: 'atkinson', sizeMode: 'fixed', fixedSize: 6 });
    const bold = plan('HEX', { font: 'atkinson-bold', sizeMode: 'fixed', fixedSize: 6 });
    expect(regular).not.toBeNull();
    expect(bold).not.toBeNull();
    const regularStem = regular ? planMinStemMm(regular, measurer) : null;
    const boldStem = bold ? planMinStemMm(bold, measurer) : null;
    expect(boldStem ?? 0).toBeGreaterThan(regularStem ?? 0);
  });

  it('reads a condensed face as narrower at the same size, which is why it fits more', () => {
    const normal = plan('HEXNUTS', { font: 'atkinson', sizeMode: 'fixed', fixedSize: 6 });
    const condensed = plan('HEXNUTS', {
      font: 'barlow-condensed',
      sizeMode: 'fixed',
      fixedSize: 6,
    });
    expect(condensed?.lines[0].advance ?? Infinity).toBeLessThan(normal?.lines[0].advance ?? 0);
  });
});

describe('the engineering preset', () => {
  it('anchors bottom-left at a fixed size with open tracking and upper case', () => {
    const result = planTypeBlock(
      { text: 'm3 hex nuts', style: TEXT_PRESETS.engineering, host: HOST },
      measurer
    );
    expect(result?.lines[0].text).toBe('M3 HEX NUTS');
    expect(result?.fontSize).toBeCloseTo(6, 6);
    expect(result?.lines[0].trackingMm).toBeGreaterThan(0);
    expect(result?.lines[0].baselineY).toBeLessThan(0);
  });
});
