import { describe, expect, it } from 'vitest';

import { TECHNIQUE_CONFIG } from './exampleTechniques';
import type { ExampleTechnique } from './exampleTechniques';

const ALL_TECHNIQUES: readonly ExampleTechnique[] = [
  'compartments',
  'wallCutouts',
  'scoop',
  'labelTab',
  'slotted',
  'lid',
  'handles',
  'customShape',
  'wallPattern',
  'knifeSlots',
  'workshop',
];

describe('TECHNIQUE_CONFIG', () => {
  it('has an entry for every ExampleTechnique member', () => {
    for (const technique of ALL_TECHNIQUES) {
      expect(TECHNIQUE_CONFIG[technique]).toBeDefined();
    }
  });

  it('every labelKey follows the binExamples.technique.<name> convention', () => {
    for (const technique of ALL_TECHNIQUES) {
      expect(TECHNIQUE_CONFIG[technique].labelKey).toBe(`binExamples.technique.${technique}`);
    }
  });

  it('has exactly the 11 known technique keys, no more', () => {
    expect(Object.keys(TECHNIQUE_CONFIG).sort()).toEqual([...ALL_TECHNIQUES].sort());
  });
});
