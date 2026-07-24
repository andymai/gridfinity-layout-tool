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

function volOf(solid: ReturnType<typeof buildLabelPlate>): number {
  const r = measureVolume(solid);
  if (!isOk(r)) throw new Error('measureVolume failed');
  return r.value;
}

/** Material the v1 channels remove from a 1U plate: 0 when they were dropped. */
function channelVolumeRemoved(text: string, opts: LabelPlateBuildOptions): number {
  const withChannels = buildLabelPlate({ widthU: 1, text }, opts);
  const without = buildLabelPlate({ widthU: 1, text }, { ...opts, v1Channels: false });
  try {
    return volOf(without) - volOf(withChannels);
  } finally {
    withChannels.delete();
    without.delete();
  }
}

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
    // Sharp T-channels remove exactly 3 × (1.0·0.2·11 + 2.0·0.6·10.6)
    // = 44.76mm³; the four r0.5 end flares per layer add
    // 3 × 4 × (1−π/4)·0.5² × (0.2 + 0.6) ≈ 0.52mm³ on top. A sharp-cornered
    // regression lands at 44.76 and fails the lower bound.
    const removed = channelVolumeRemoved('', OPTS);
    expect(removed).toBeGreaterThan(45.1);
    expect(removed).toBeLessThan(45.45);
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

  // The middle channel runs through x=0, right under the text, and the roof
  // over its cavity is 0.4mm. A default-depth engraving cut its floor exactly
  // onto that roof, leaving a zero-thickness membrane that printed as an open
  // hole through the middle of the label.
  it('drops the v1 channels from a debossed plate rather than punching through', () => {
    expect(channelVolumeRemoved('SCREWS', OPTS)).toBeCloseTo(0, 3);
  });

  it('keeps the v1 channels on an embossed plate, which only adds material', () => {
    expect(channelVolumeRemoved('SCREWS', { ...OPTS, textMode: 'emboss' })).toBeGreaterThan(45);
  });

  // An icon-only plate centers its silhouette at x=0 — the same spot as the
  // middle v1 channel — so it punches through exactly like the text did.
  it('drops the v1 channels for a debossed icon with no text', () => {
    const withFlag = buildLabelPlate({ widthU: 1, text: '', icon: 'bolt' }, OPTS);
    const without = buildLabelPlate(
      { widthU: 1, text: '', icon: 'bolt' },
      { ...OPTS, v1Channels: false }
    );
    try {
      expect(volOf(withFlag)).toBeCloseTo(volOf(without), 3);
    } finally {
      withFlag.delete();
      without.delete();
    }
  });

  // 2U/3U never carry channels, so the drop rule must not perturb them.
  it('leaves wider plates identical regardless of the v1 flag', () => {
    for (const widthU of [2, 3] as const) {
      const withFlag = buildLabelPlate({ widthU, text: 'SCREWS' }, OPTS);
      const without = buildLabelPlate({ widthU, text: 'SCREWS' }, { ...OPTS, v1Channels: false });
      try {
        expect(volOf(withFlag)).toBeCloseTo(volOf(without), 3);
      } finally {
        withFlag.delete();
        without.delete();
      }
    }
  });

  // Guards the verticalFit: 'inkBox' opt-in at the plate level — under the
  // font's line box an all-caps run inks only ~54% of the 7.8mm band.
  it('sizes embossed glyphs to fill the plate text band', () => {
    const solid = buildLabelPlate({ widthU: 1, text: 'Kabel' }, { ...OPTS, textMode: 'emboss' });
    try {
      const m = mesh(solid, { tolerance: 0.05, angularTolerance: 10 });
      const v = new Float32Array(m.vertices);
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < v.length; i += 3) {
        if (v[i + 2] <= LABEL_PLATE_THICKNESS_MM + 1e-3) continue;
        if (v[i + 1] < minY) minY = v[i + 1];
        if (v[i + 1] > maxY) maxY = v[i + 1];
      }
      expect(maxY - minY).toBeGreaterThan(6);
      expect((minY + maxY) / 2).toBeCloseTo(0, 1);
    } finally {
      solid.delete();
    }
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
