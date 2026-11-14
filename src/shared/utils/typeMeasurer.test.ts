// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { getFont, loadFont } from 'brepjs/text';
import { createTypeMeasurer, type GlyphFont } from './typeMeasurer';

const FONT_DIR = resolve(import.meta.dirname, '..', 'fonts', 'assets');

let font: GlyphFont;

beforeAll(async () => {
  const buf = readFileSync(resolve(FONT_DIR, 'AtkinsonHyperlegible-Regular.ttf'));
  await loadFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), 'atkinson');
  font = getFont('atkinson') as GlyphFont;
});

describe('createTypeMeasurer', () => {
  it('measures a face that registers after an earlier miss', () => {
    const registry: { font?: GlyphFont } = {};
    const measurer = createTypeMeasurer(() => registry.font);

    expect(measurer.run('M4', 'atkinson')).toBeNull();
    expect(measurer.vertical('atkinson')).toBeNull();
    expect(measurer.stem('M4', 'atkinson')).toBeNull();
    expect(measurer.outline('M4', 'atkinson')).toBeNull();

    registry.font = font;

    expect(measurer.run('M4', 'atkinson')).not.toBeNull();
    expect(measurer.vertical('atkinson')).not.toBeNull();
    expect(measurer.stem('M4', 'atkinson')).not.toBeNull();
    expect(measurer.outline('M4', 'atkinson')).not.toBeNull();
  });

  it('keeps memoizing once the face is there', () => {
    const measurer = createTypeMeasurer(() => font);
    expect(measurer.run('M4', 'atkinson')).toBe(measurer.run('M4', 'atkinson'));
    expect(measurer.vertical('atkinson')).toBe(measurer.vertical('atkinson'));
    expect(measurer.outline('M4', 'atkinson')).toBe(measurer.outline('M4', 'atkinson'));
  });
});
