import { afterEach, describe, expect, it, vi } from 'vitest';
import { planInput } from '@/shared/plan/planInput';
import { isOk } from '@/core/result';
import { encodePlanLink } from '@/shared/plan/planLink';
import { importPlanLink } from './planLinkImport';
import { PLAN_LINK_NEEDS_UPDATE } from './shareUrl';

const plan = planInput.parse({
  title: 'Screw drawer',
  grid: { width: 4, depth: 3 },
  bins: [{ label: 'M3', width: 1, depth: 1, height: 3, count: 2 }],
});

const built = encodePlanLink(plan);
if (!isOk(built)) throw new Error('plan too large');
const link = built.value;

describe('importPlanLink', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds the planned layout and gives it fresh ids', async () => {
    const first = await importPlanLink(link);
    const second = await importPlanLink(link);
    expect(first.errors).toEqual([]);
    expect(first.layout?.name).toBe('Screw drawer');
    expect(first.layout?.bins.map((bin) => bin.label)).toEqual(['M3', 'M3']);
    expect(first.layout?.bins[0].id).not.toBe(second.layout?.bins[0].id);
  });

  it('asks for an update when the link is from a newer app', async () => {
    expect(await importPlanLink(`v9.${link.slice(3)}`)).toEqual({
      layout: null,
      errors: [PLAN_LINK_NEEDS_UPDATE],
    });
  });

  it('asks for a browser update where plan links cannot inflate', async () => {
    vi.stubGlobal('DecompressionStream', undefined);
    expect((await importPlanLink(link)).errors).toEqual([
      'This browser cannot open plan links. Update the browser and try again.',
    ]);
  });

  it('reports a damaged link', async () => {
    expect((await importPlanLink('v1.@@@')).errors).toEqual(['The plan link is damaged.']);
  });
});
