/**
 * Tray bin scenarios — a bin whose underside is lid mating geometry.
 *
 * `assert: 'structural'` throughout rather than the bounding-box assertion the
 * other base styles use: a tray's skirt hangs below the bin body, so its total
 * height is deliberately greater than `height * heightUnitMm` and the shared
 * `assertBoundingBoxMatchesParams` would read that as a fault.
 */

import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_LID_CONFIG, DEFAULT_TRAY_BOTTOM } from '@/shared/types/bin';
import type { LidAttachment } from '@/shared/types/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const attachments: Array<{ attachment: LidAttachment; label: string }> = [
  { attachment: 'clickRails', label: 'click rails' },
  { attachment: 'friction', label: 'friction' },
  { attachment: 'magnetic', label: 'magnetic' },
];

function trayBase(attachment: LidAttachment, extraHeightMm = 0) {
  return {
    ...DEFAULT_BIN_PARAMS.base,
    style: 'lid' as const,
    trayBottom: { ...DEFAULT_TRAY_BOTTOM, attachment, extraHeightMm },
  };
}

export const trayBottom: ScenarioCase[] = [
  ...attachments.map(({ attachment, label }) =>
    defineScenario('tray bottom', `${label} tray bottom`, {
      assert: 'structural',
      params: {
        width: 2,
        depth: 2,
        height: 3,
        base: trayBase(attachment),
      },
    })
  ),

  defineScenario('tray bottom', 'extra height clears protruding contents', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 3,
      // The reporter's case: contents stick up past the bin below, so the
      // skirt lengthens to clear them.
      base: trayBase('clickRails', 12),
    },
  }),

  defineScenario('tray bottom', 'tray with compartments', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 2,
      base: trayBase('clickRails'),
      compartments: { cols: 3, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5] },
    },
  }),

  defineScenario('tray bottom', 'tray keeps its own stacking lip', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 3,
      // The tray's own lip is about its TOP, so a Gridfinity bin can still
      // stack on it. Independent of the lid it presents downward.
      base: { ...trayBase('clickRails'), stackingLip: true },
    },
  }),

  defineScenario('tray bottom', 'split tray keeps its lip on the real rim', {
    assert: 'structural',
    params: {
      width: 6,
      depth: 2,
      height: 3,
      // A tray's rim is `skirtDepth + totalHeight`, not `totalHeight`. Splitting
      // it used to fuse the lip ring partway down the outside of the wall.
      base: { ...trayBase('clickRails'), stackingLip: true },
    },
  }),

  defineScenario('tray bottom', 'tray carrying its own magnetic lid', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 3,
      base: { ...trayBase('clickRails'), stackingLip: true },
      // The retention pads hang off the rim, which the skirt raises.
      lid: { ...DEFAULT_LID_CONFIG, enabled: true, attachment: 'magnetic' as const },
    },
  }),

  defineScenario('tray bottom', 'non-square grid pitch', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 3,
      height: 2,
      gridUnitMm: 42,
      gridUnitMmY: 36,
      base: trayBase('clickRails'),
    },
  }),
];
