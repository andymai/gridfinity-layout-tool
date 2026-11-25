import { describe, expect, it } from 'vitest';
import { planInput } from '@/shared/plan/planInput';
import { planHandle, runPlanLayout } from './planLayout';

const context = { origin: 'https://example.test' };
const plan = planInput.parse({
  grid: { width: 2, depth: 2, height: 6 },
  bins: [
    { label: 'Big', width: 2, depth: 2, height: 3 },
    { label: 'Extra', width: 1, depth: 1, height: 3 },
  ],
});

describe('runPlanLayout', () => {
  it('reports the stash with its reasons and links to the door origin', () => {
    const result = runPlanLayout(plan, context);
    expect(result.content).toContain(
      'In the stash, not placed: Extra (no room left on its layer).'
    );
    expect(result.plan?.stashed).toEqual([{ label: 'Extra', reason: 'no room left on its layer' }]);
    expect(result.plan?.link).toMatch(/^https:\/\/example\.test\/#plan=v1\./);
  });

  it('names a plan by its content', () => {
    expect(planHandle(plan)).toBe(planHandle(planInput.parse(JSON.parse(JSON.stringify(plan)))));
    expect(planHandle(plan)).not.toBe(planHandle({ ...plan, title: 'Other' }));
  });

  it('refuses a plan too large for a link', () => {
    const rich = planInput.parse({
      grid: { width: 20, depth: 20 },
      bins: Array.from({ length: 60 }, (_, i) => ({
        label: `Bin ${i + 1}`,
        width: 1,
        depth: 1,
        height: 3,
        items: Array.from(
          { length: 20 },
          (_, k) => `Part ${i}-${k} ${(i * 7919 + k * 104729).toString(36)}`
        ),
      })),
    });
    const result = runPlanLayout(rich, context);
    expect(result.isError).toBe(true);
    expect(result.content).toContain('too large for a link');
  });
});
