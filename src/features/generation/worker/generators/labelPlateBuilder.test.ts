// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import { isErr, isOk, loadFont, measureVolume, mesh } from 'brepjs';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { boundingBox } from './__kernel-tests__/meshAssertions';
import { DEFAULT_TEXT_STYLE_DEFAULTS } from '@/features/bin-designer/types/text';
import {
  LABEL_PLATE_HEIGHT_MM,
  LABEL_PLATE_THICKNESS_MM,
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import { FeatureTag } from './featureTags';
import { buildLabelPlate, buildLabelPlates, exportLabelPlates } from './labelPlateBuilder';
import type { LabelPlateBuildOptions } from './labelPlateBuilder';

const OPTS: LabelPlateBuildOptions = {
  textMode: 'deboss',
  textDepthMm: 0.4,
  textDefaults: DEFAULT_TEXT_STYLE_DEFAULTS,
  v1Channels: true,
};

function volumeAndBBox(spec: Parameters<typeof buildLabelPlate>[0]) {
  const solid = buildLabelPlate(spec, OPTS);
  try {
    const m = mesh(solid, { tolerance: 0.05, angularTolerance: 10 });
    const vertices = new Float32Array(m.vertices);
    return { bbox: boundingBox(vertices), triangles: m.triangles.length / 3 };
  } finally {
    solid.delete();
  }
}

beforeAll(async () => {
  await initBrepjs();
  const buffer = readFileSync(
    resolve(__dirname, '../assets/fonts/AtkinsonHyperlegible-Regular.ttf')
  );
  const result = await loadFont(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    'atkinson'
  );
  if (isErr(result)) throw new Error(`Font load failed: ${result.error.message}`);
}, 60_000);

describe('labelPlateBuilder', () => {
  it('builds a 1U plate to the pinned interchange footprint', () => {
    const { bbox } = volumeAndBBox({ widthU: 1, text: '' });
    expect(bbox.maxX - bbox.minX).toBeCloseTo(labelPlateWidthMm(1), 1);
    expect(bbox.maxY - bbox.minY).toBeCloseTo(LABEL_PLATE_HEIGHT_MM, 1);
    expect(bbox.maxZ - bbox.minZ).toBeCloseTo(LABEL_PLATE_THICKNESS_MM, 1);
    expect(bbox.minZ).toBeCloseTo(0, 3);
  });

  it('flares the v1 channel ends with the standard r0.5 lead-in', () => {
    const withChannels = buildLabelPlate({ widthU: 1, text: '' }, OPTS);
    const without = buildLabelPlate({ widthU: 1, text: '' }, { ...OPTS, v1Channels: false });
    try {
      const volOf = (s: typeof withChannels): number => {
        const r = measureVolume(s);
        if (!isOk(r)) throw new Error('measureVolume failed');
        return r.value;
      };
      const removed = volOf(without) - volOf(withChannels);
      // Sharp T-channels remove exactly 3 × (1.0·0.2·11 + 2.0·0.6·10.6)
      // = 44.76mm³; the four r0.5 end flares per layer add
      // 3 × 4 × (1−π/4)·0.5² × (0.2 + 0.6) ≈ 0.52mm³ on top. A sharp-cornered
      // regression lands at 44.76 and fails the lower bound.
      expect(removed).toBeGreaterThan(45.1);
      expect(removed).toBeLessThan(45.45);
    } finally {
      withChannels.delete();
      without.delete();
    }
  });

  it('builds 2U and 3U plates without v1 channels', () => {
    for (const widthU of [2, 3] as const) {
      const { bbox } = volumeAndBBox({ widthU, text: '' });
      expect(bbox.maxX - bbox.minX).toBeCloseTo(labelPlateWidthMm(widthU), 1);
    }
  });

  it('carries debossed text without changing the footprint', () => {
    const { bbox } = volumeAndBBox({ widthU: 1, text: 'SCREWS' });
    expect(bbox.maxX - bbox.minX).toBeCloseTo(labelPlateWidthMm(1), 1);
    expect(bbox.maxZ - bbox.minZ).toBeCloseTo(LABEL_PLATE_THICKNESS_MM, 1);
  });

  it('raises embossed text above the plate top', () => {
    const solid = buildLabelPlate({ widthU: 1, text: 'M3' }, { ...OPTS, textMode: 'emboss' });
    try {
      const m = mesh(solid, { tolerance: 0.05, angularTolerance: 10 });
      const bbox = boundingBox(new Float32Array(m.vertices));
      expect(bbox.maxZ).toBeCloseTo(LABEL_PLATE_THICKNESS_MM + OPTS.textDepthMm, 1);
    } finally {
      solid.delete();
    }
  });

  it('honors explicit sheet positions', () => {
    const pieces = buildLabelPlates(
      [
        { widthU: 1, text: '', position: [-50, 20] },
        { widthU: 1, text: '', position: [50, -20] },
      ],
      OPTS
    );
    try {
      const boxes = pieces.map((p) => {
        const m = mesh(p, { tolerance: 0.05, angularTolerance: 10 });
        return boundingBox(new Float32Array(m.vertices));
      });
      expect((boxes[0].minX + boxes[0].maxX) / 2).toBeCloseTo(-50, 1);
      expect((boxes[0].minY + boxes[0].maxY) / 2).toBeCloseTo(20, 1);
      expect((boxes[1].minX + boxes[1].maxX) / 2).toBeCloseTo(50, 1);
    } finally {
      for (const p of pieces) p.delete();
    }
  });

  it('lays out multiple plates without overlap', () => {
    const pieces = buildLabelPlates(
      [
        { widthU: 1, text: 'A' },
        { widthU: 2, text: 'B' },
      ],
      OPTS
    );
    try {
      const boxes = pieces.map((p) => {
        const m = mesh(p, { tolerance: 0.05, angularTolerance: 10 });
        return boundingBox(new Float32Array(m.vertices));
      });
      expect(boxes[0].maxY).toBeLessThan(boxes[1].minY);
    } finally {
      for (const p of pieces) p.delete();
    }
  });

  it('exports a parseable STL', async () => {
    const { data, fileName } = await exportLabelPlates([{ widthU: 1, text: 'BOLTS' }], OPTS, 'stl');
    expect(fileName).toBe('label_plates.stl');
    expect(data.byteLength).toBeGreaterThan(1000);
  });

  it('tags text faces in the export faceGroups for paint_color mapping', async () => {
    for (const textMode of ['deboss', 'emboss'] as const) {
      const { data, faceGroups } = await exportLabelPlates(
        [{ widthU: 1, text: 'BOLTS' }],
        { ...OPTS, textMode },
        'stl'
      );
      const groups = faceGroups ?? [];
      const textIndexCount = groups
        .filter((g) => g.tag === FeatureTag.TEXT)
        .reduce((sum, g) => sum + g.count, 0);
      expect(textIndexCount, textMode).toBeGreaterThan(0);
      // Groups must cover the STL exactly (80-byte header + 4-byte count +
      // 50 bytes per triangle) or the 3MF material indices would misalign.
      const totalIndexCount = groups.reduce((sum, g) => sum + g.count, 0);
      expect(totalIndexCount / 3, textMode).toBe((data.byteLength - 84) / 50);
    }
  });

  it('emits no TEXT face groups for blank plates', async () => {
    const { faceGroups } = await exportLabelPlates([{ widthU: 1, text: '' }], OPTS, 'stl');
    expect((faceGroups ?? []).some((g) => g.tag === FeatureTag.TEXT)).toBe(false);
  });
});
