// @vitest-environment node
/**
 * Kernel tests for plate hardware icons (#2666 follow-up): every icon in the
 * catalog must build into a valid plate solid in both text modes, stay inside
 * the plate footprint, and carry TEXT-tagged faces for paint_color mapping.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume } from 'brepjs';
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
import { mesh } from 'brepjs';
import { FeatureTag } from './featureTags';
import {
  ICON_MAX_WIDTH_MM,
  TEXT_BAND_MM,
  buildLabelPlate,
  exportLabelPlates,
} from './labelPlateBuilder';
import { measureIconBox } from './labelPlateIcons';
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

describe('labelPlateIcons', () => {
  const TEST_TIMEOUT_MS = 120_000;

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

  // Icons are fitted by their own silhouette bounds, not the shared +/-5 design
  // frame: the side-view fasteners only ink 52-68% of that frame vertically, so
  // a frame-relative box rendered a bolt at ~2/3 the visual weight of a washer
  // and left both dwarfed by the (now ink-fitted) text.
  it('fits every icon to the readable band or the width cap', () => {
    for (const icon of LABEL_PLATE_ICONS) {
      const box = measureIconBox(icon, TEXT_BAND_MM, ICON_MAX_WIDTH_MM);
      expect(box, icon).not.toBeNull();
      if (!box) continue;
      expect(box.heightMm, icon).toBeLessThanOrEqual(TEXT_BAND_MM + 1e-6);
      expect(box.widthMm, icon).toBeLessThanOrEqual(ICON_MAX_WIDTH_MM + 1e-6);
      // Every icon is as large as the box allows — one axis is always at its
      // limit, so none can render at an arbitrary fraction of the band.
      const fillsBand = Math.abs(box.heightMm - TEXT_BAND_MM) < 1e-6;
      const widthCapped = Math.abs(box.widthMm - ICON_MAX_WIDTH_MM) < 1e-6;
      expect(fillsBand || widthCapped, icon).toBe(true);
    }
  });

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
