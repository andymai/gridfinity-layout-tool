import { describe, expect, it } from 'vitest';
import { isOk } from '@/core/result';
import { buildPlanLayout } from '@/shared/plan/buildPlanLayout';
import { planInput } from '@/shared/plan/planInput';
import { createValidators, formatErrors } from './loadSchemas';

describe('planned layouts', () => {
  it('pass the published layout schema', () => {
    const built = buildPlanLayout(
      planInput.parse({
        drawer: { width: 40, depth: 30, height: 8, unit: 'cm' },
        categories: ['Screws'],
        bins: [
          {
            label: 'M3',
            width: 1,
            depth: 1,
            height: 3,
            category: 'Screws',
            items: ['M3x8'],
            count: 3,
          },
          { label: 'Too tall', width: 1, depth: 1, height: 20 },
        ],
      })
    );
    if (!isOk(built)) throw new Error('plan failed');
    const { layout } = createValidators();
    const valid = layout(built.value.layout) as boolean;
    expect(valid ? [] : formatErrors(layout.errors ?? [])).toEqual([]);
  });
});
