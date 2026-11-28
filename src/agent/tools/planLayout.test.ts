import { describe, expect, it } from 'vitest';
import { isOk } from '@/core/result';
import { buildPlanLayout } from '@/shared/plan/buildPlanLayout';
import { planInput } from '@/shared/plan/planInput';
import { PLAN_HASH_PREFIX, decodePlanLink } from '@/shared/plan/planLink';
import type { Layout } from '@/core/types';
import { runDrawerFit } from './drawerFit';
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

  it('names the categories with their colors when the plan gives them', () => {
    const result = runPlanLayout(
      planInput.parse({ ...plan, categories: ['Meters', 'Probes'] }),
      context
    );
    expect(result.content).toContain(
      'Categories and their colors: Meters (coral), Probes (orange).'
    );
  });

  it('names a plan by its content', () => {
    expect(planHandle(plan)).toBe(planHandle(planInput.parse(JSON.parse(JSON.stringify(plan)))));
    expect(planHandle(plan)).not.toBe(planHandle({ ...plan, title: 'Other' }));
  });

  it('says when a plan holds the drawer alone', () => {
    const result = runPlanLayout(
      planInput.parse({ drawer: { width: 560, depth: 470, height: 95, unit: 'mm' }, bins: [] }),
      context
    );
    expect(result.content).toBe(
      [
        'Planned "Drawer plan" on a 13 x 11 unit grid.',
        'Drawer 560 x 470 x 95 mm: the baseplate pads 7 mm at each side and 4 mm at the front and the back.',
        'No bins: the plan opens the empty drawer.',
        'Free on layer 1: 143 of 143 grid cells.',
      ].join('\n')
    );
    expect(result.plan).toMatchObject({ grid: { width: 13, depth: 11 }, bins: [], stashed: [] });
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

// A drawer-size answer gives the grid from drawer_fit and ends with this plan,
// so the link must open the grid that drawer_fit's text names.
describe('the drawer of a drawer-size answer', () => {
  const drawers = [
    { width: 52, depth: 44, height: 8, unit: 'cm' },
    { width: 380, depth: 510, unit: 'mm' },
    { width: 15, depth: 21, unit: 'in' },
    { width: 11.5, depth: 17, height: 3, unit: 'in' },
    { width: 330, depth: 400, unit: 'mm' },
  ] as const;

  function gridIn(content: string, name: string): [number, number] | null {
    const match = new RegExp(`${name} grid: ([\\d.]+) x ([\\d.]+) units`).exec(content);
    return match ? [Number(match[1]), Number(match[2])] : null;
  }

  async function opened(link: string): Promise<Layout> {
    const decoded = await decodePlanLink(link.split(PLAN_HASH_PREFIX)[1] ?? '');
    if (!isOk(decoded)) throw new Error(JSON.stringify(decoded.error));
    const built = buildPlanLayout(decoded.value);
    if (!isOk(built)) throw new Error(JSON.stringify(built.error));
    return built.value.layout;
  }

  it.each(drawers)(
    'opens the grid that drawer_fit names for $width x $depth $unit',
    async (drawer) => {
      // drawer_fit takes mm or inches, so the model gives it centimeters times 10.
      const scale = drawer.unit === 'cm' ? 10 : 1;
      const height = 'height' in drawer ? drawer.height : undefined;
      const fit = runDrawerFit(
        {
          widthMm: drawer.width * scale,
          depthMm: drawer.depth * scale,
          ...(height === undefined ? {} : { heightMm: height * scale }),
          unit: drawer.unit === 'in' ? 'in' : 'mm',
        },
        context
      );
      const measured = /^Drawer: ([\d.]+) x ([\d.]+)(?: x ([\d.]+))? mm\.$/m.exec(fit.content);
      const choices = [
        { halfGrid: false, grid: gridIn(fit.content, 'Whole-unit') },
        { halfGrid: true, grid: gridIn(fit.content, 'Half-unit') },
      ];
      expect(choices[0].grid).not.toBeNull();
      for (const { halfGrid, grid } of choices) {
        if (grid === null) continue;
        const run = runPlanLayout(
          planInput.parse({ drawer, bins: [], ...(halfGrid ? { halfGrid } : {}) }),
          context
        );
        expect(run.plan?.grid).toEqual({ width: grid[0], depth: grid[1] });
        expect(run.content).toContain(`on a ${grid[0]} x ${grid[1]} unit grid`);
        const layout = await opened(run.plan?.link ?? '');
        expect([layout.drawer.width, layout.drawer.depth]).toEqual(grid);
        expect(layout.drawer.measuredMm).toEqual({
          width: Number(measured?.[1]),
          depth: Number(measured?.[2]),
          ...(measured?.[3] === undefined ? {} : { height: Number(measured[3]) }),
        });
        expect(layout.bins).toEqual([]);
      }
    }
  );
});
