import { describe, expect, it } from 'vitest';
import { planInput } from '@/shared/plan/planInput';
import { encodePlanLink } from '@/shared/plan/planLink';
import { importPlanLink } from './planLinkImport';
import { PLAN_LINK_NEEDS_UPDATE } from './shareUrl';

const input = planInput.parse({
  title: 'Screw drawer',
  grid: { width: 4, depth: 3 },
  bins: [{ label: 'M3', width: 1, depth: 1, height: 3, count: 2 }],
});

describe('importPlanLink', () => {
  it('builds the planned layout and gives it fresh ids', async () => {
    const first = await importPlanLink(encodePlanLink(input));
    const second = await importPlanLink(encodePlanLink(input));
    expect(first.errors).toEqual([]);
    expect(first.layout?.name).toBe('Screw drawer');
    expect(first.layout?.bins.map((bin) => bin.label)).toEqual(['M3', 'M3']);
    expect(first.layout?.bins[0].id).not.toBe(second.layout?.bins[0].id);
  });

  it('asks for an update when the link is from a newer app', async () => {
    expect(await importPlanLink(`v9.${encodePlanLink(input).slice(3)}`)).toEqual({
      layout: null,
      errors: [PLAN_LINK_NEEDS_UPDATE],
    });
  });

  it('reports a damaged link', async () => {
    expect((await importPlanLink('v1.@@@')).errors).toEqual(['The plan link is damaged.']);
  });
});
