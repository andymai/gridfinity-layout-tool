import { describe, it, expect, beforeEach } from 'vitest';
import { gridUnits, heightUnits, layerId } from '@/core/types';
import type { Mm } from '@/core/types';
import { INITIAL_GAP_FIT_STATE, useGapFitStore } from './gapFit';
import type { GapFitConstraint } from './gapFit';

const constraint: GapFitConstraint = {
  maxWidth: gridUnits(2.5),
  maxDepth: gridUnits(3),
  maxHeight: heightUnits(6),
  gridUnitMm: 42 as Mm,
  gridUnitMmY: 42 as Mm,
  heightUnitMm: 7 as Mm,
  targetPosition: { x: gridUnits(1), y: gridUnits(4), layerId: layerId('layer_1') },
};

describe('useGapFitStore', () => {
  beforeEach(() => {
    useGapFitStore.setState({ ...INITIAL_GAP_FIT_STATE });
  });

  it('starts with no constraint', () => {
    expect(useGapFitStore.getState().constraint).toBeNull();
  });

  it('setConstraint stores the handoff and clear removes it', () => {
    useGapFitStore.getState().setConstraint(constraint);
    expect(useGapFitStore.getState().constraint).toEqual(constraint);

    useGapFitStore.getState().clear();
    expect(useGapFitStore.getState().constraint).toBeNull();
  });

  it('a later setConstraint replaces the previous gap wholesale', () => {
    useGapFitStore.getState().setConstraint(constraint);
    const next: GapFitConstraint = {
      ...constraint,
      maxWidth: gridUnits(1),
      gridUnitMm: 42 as Mm,
      gridUnitMmY: 42 as Mm,
      heightUnitMm: 7 as Mm,
      targetPosition: { x: gridUnits(0), y: gridUnits(0), layerId: layerId('layer_2') },
    };
    useGapFitStore.getState().setConstraint(next);
    expect(useGapFitStore.getState().constraint).toEqual(next);
  });
});
