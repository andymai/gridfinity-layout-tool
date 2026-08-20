import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { DEFAULT_LID_HINGE_CONFIG, LID_HINGE_PIN_MM } from '@/features/bin-designer/types/lid';
import { hingePinSegments } from '../LidMesh/lidAnchorZ';
import { lidHingePose } from '../LidMesh/lidAnchorZ';
import type { BinParams, LidRailSide } from '@/features/bin-designer/types';

/**
 * The component is three `<mesh>` props over `hingePinSegments`, so the
 * placement is what is worth testing — a rod on the wrong axis or off the
 * hinge line is invisible in a static render and obvious the moment the lid
 * swings.
 */
function hinged(side: LidRailSide, over: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    ...over,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'hinge',
      hinge: { ...DEFAULT_LID_HINGE_CONFIG, side },
    },
  };
}

describe('hingePinSegments', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: DEFAULT_BIN_PARAMS });
  });

  it('produces nothing for a lid that is not hinged', () => {
    expect(hingePinSegments(DEFAULT_BIN_PARAMS)).toEqual([]);
  });

  it('lays the pin ON the hinge axis, not near it', () => {
    // The pin has to be coaxial with the barrel the lid turns about. Anywhere
    // else and the preview is drawing a joint the geometry does not have.
    for (const side of ['back', 'front', 'left', 'right'] as const) {
      const params = hinged(side);
      const pose = lidHingePose(params, 0);
      const [seg] = hingePinSegments(params);
      expect(seg).toBeDefined();
      if (!seg || !pose) continue;
      expect(seg.centre[2]).toBeCloseTo(pose.pivot[2], 6);
      // The cross coordinate is the axis's; the along coordinate is the run's
      // midpoint, which is the bin's centre on an unobstructed wall.
      const cross = seg.alongX ? seg.centre[1] : seg.centre[0];
      const poseCross = seg.alongX ? pose.pivot[1] : pose.pivot[0];
      expect(cross).toBeCloseTo(poseCross, 6);
    }
  });

  it('runs along the wall the hinge is on', () => {
    expect(hingePinSegments(hinged('back'))[0].alongX).toBe(true);
    expect(hingePinSegments(hinged('left'))[0].alongX).toBe(false);
  });

  it('is the diameter of real filament', () => {
    expect(hingePinSegments(hinged('back'))[0].radiusMm).toBeCloseTo(LID_HINGE_PIN_MM / 2, 6);
  });

  it('draws one rod per run when a cutout splits the wall', () => {
    // Two barrels that do not share an axis segment take two pins — the same
    // statement the panel and the export dialog make about lengths.
    const off = { ...DEFAULT_BIN_PARAMS.walls.left, enabled: false };
    const params = hinged('back', {
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: off,
        back: { ...off, enabled: true, width: 30, depth: 60 },
        left: off,
        right: off,
      },
    });
    const segs = hingePinSegments(params);
    expect(segs).toHaveLength(2);
    expect(segs[0].centre[0]).not.toBeCloseTo(segs[1].centre[0], 3);
  });
});
