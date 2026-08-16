// @vitest-environment node
/**
 * Per-icon emboss/deboss sweep against a real plate (follow-up): every
 * icon in the catalog must build into a valid plate solid in both text modes,
 * stay inside the plate footprint, and carry TEXT-tagged faces for paint_color.
 *
 * Split out of `labelPlateIcons.test.ts` because it is the expensive tier —
 * two plate booleans per icon — and grows linearly with the catalog. Keeping it
 * in its own file lets the sharded generators job schedule it independently.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume, mesh } from 'brepjs';
import { isOk } from '@/core/result';
import { DEFAULT_TEXT_STYLE_DEFAULTS } from '@/features/bin-designer/types/text';
import {
  LABEL_PLATE_ICONS,
  LABEL_PLATE_HEIGHT_MM,
  LABEL_PLATE_THICKNESS_MM,
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { boundingBox } from './__kernel-tests__/meshAssertions';
import { FeatureTag } from './featureTags';
import { buildLabelPlate, exportLabelPlates } from './labelPlateBuilder';
import type { LabelPlateBuildOptions } from './labelPlateBuilder';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

const OPTS: LabelPlateBuildOptions = {
  textMode: 'emboss',
  textDepthMm: 0.4,
  textDefaults: DEFAULT_TEXT_STYLE_DEFAULTS,
  v1Channels: false,
};

const vol = (s: Parameters<typeof measureVolume>[0]): number => {
  const r = measureVolume(s);
  if (!isOk(r)) throw new Error('measureVolume failed');
  return r.value;
};

describe('labelPlateIcons on a plate', () => {
  const TEST_TIMEOUT_MS = 300_000;

  it(
    'builds every icon in both modes without leaving the plate footprint',
    () => {
      const blank = buildLabelPlate({ widthU: 1, text: '' }, OPTS);
      const blankVol = vol(blank);
      blank.delete();

      for (const icon of LABEL_PLATE_ICONS) {
        for (const textMode of ['emboss', 'deboss'] as const) {
          const plate = buildLabelPlate({ widthU: 1, text: '', icon }, { ...OPTS, textMode });
          try {
            const v = vol(plate);
            // The icon must actually land: raised silhouette adds volume,
            // recessed removes it. A silent fallback to a plain plate
            // (failed boolean) would equal blankVol and fail both bounds.
            if (textMode === 'emboss') {
              expect(v, `${icon} ${textMode}`).toBeGreaterThan(blankVol + 0.5);
            } else {
              expect(v, `${icon} ${textMode}`).toBeLessThan(blankVol - 0.5);
            }
            const m = mesh(plate, { tolerance: 0.05, angularTolerance: 10 });
            const bbox = boundingBox(new Float32Array(m.vertices));
            expect(bbox.maxX - bbox.minX, icon).toBeCloseTo(labelPlateWidthMm(1), 1);
            expect(bbox.maxY - bbox.minY, icon).toBeCloseTo(LABEL_PLATE_HEIGHT_MM, 1);
            const expectedTop =
              textMode === 'emboss'
                ? LABEL_PLATE_THICKNESS_MM + OPTS.textDepthMm
                : LABEL_PLATE_THICKNESS_MM;
            expect(bbox.maxZ, `${icon} ${textMode}`).toBeCloseTo(expectedTop, 1);
          } finally {
            plate.delete();
          }
        }
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    'tags icon faces TEXT so paint_color colors them with the text',
    async () => {
      const { faceGroups } = await exportLabelPlates(
        [{ widthU: 1, text: '', icon: 'nut' }],
        OPTS,
        'stl'
      );
      const textIndexCount = (faceGroups ?? [])
        .filter((g) => g.tag === FeatureTag.TEXT)
        .reduce((sum, g) => sum + g.count, 0);
      expect(textIndexCount).toBeGreaterThan(0);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'renders icon and text side by side on a wide plate',
    async () => {
      const { data } = await exportLabelPlates(
        [{ widthU: 2, text: 'M3×12', icon: 'bolt' }],
        OPTS,
        'stl'
      );
      expect(data.byteLength).toBeGreaterThan(1000);
    },
    TEST_TIMEOUT_MS
  );
});
