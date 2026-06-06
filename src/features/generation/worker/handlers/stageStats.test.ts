import { describe, it, expect } from 'vitest';
import { stageStats } from './stageStats';
import type { PerfSnapshot } from '../../bridge/types';

function snapshot(stages: { name: string; ms: number }[]): PerfSnapshot {
  return {
    totalMs: stages.reduce((s, e) => s + e.ms, 0),
    stages,
    featureBuilders: [],
    wallPatternSubsteps: [],
    hexCenterCount: 0,
    patternCutToolCount: 0,
  };
}

describe('stageStats', () => {
  it('prefixes each stage with stage_ and counts one occurrence', () => {
    expect(
      stageStats(
        snapshot([
          { name: 'base', ms: 100 },
          { name: 'features', ms: 50 },
        ])
      )
    ).toEqual({
      stage_base: { totalMs: 100, count: 1 },
      stage_features: { totalMs: 50, count: 1 },
    });
  });

  it('accumulates stages that share a name (translate + tessellate both report as merge)', () => {
    // Regression guard: overwriting per key would drop the translate timing.
    expect(
      stageStats(
        snapshot([
          { name: 'merge', ms: 30 }, // translateStage
          { name: 'merge', ms: 70 }, // tessellateStage
        ])
      )
    ).toEqual({ stage_merge: { totalMs: 100, count: 2 } });
  });

  it('returns an empty object for a snapshot with no stages', () => {
    expect(stageStats(snapshot([]))).toEqual({});
  });
});
