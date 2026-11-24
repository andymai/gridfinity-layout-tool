import { describe, expect, it } from 'vitest';
import type { TFunction } from '@/i18n';
import type { ToolSetSpec } from '@/features/bin-designer/types';
import { groupDisplayNames, toolSetName } from './toolSetName';

const t = ((key: string, vars?: Record<string, string>) =>
  `${key}(${vars?.from ?? ''}-${vars?.to ?? ''})`) as unknown as TFunction;

const spec: ToolSetSpec = {
  family: 'combinationWrench',
  units: 'metric',
  sizes: ['13', '8', '10'],
  style: 'flat',
  clearanceMm: 0.4,
  labelSizeMm: 5,
  fingerChannel: true,
};

describe('toolSetName', () => {
  it('names the set by its smallest and largest size', () => {
    expect(toolSetName(spec, t)).toBe('binDesigner.toolSets.groupNameMetric(8-13)');
    expect(toolSetName({ ...spec, units: 'sae', sizes: ['1/2', '3/8'] }, t)).toBe(
      'binDesigner.toolSets.groupNameSae(3/8-1/2)'
    );
  });
});

describe('groupDisplayNames', () => {
  it('shows a typed name over the derived one, and keeps other groups', () => {
    const names = groupDisplayNames({ g1: 'Garage', other: 'Pens' }, { g1: spec, g2: spec }, t);
    expect(names).toEqual({
      g1: 'Garage',
      g2: 'binDesigner.toolSets.groupNameMetric(8-13)',
      other: 'Pens',
    });
  });
});
