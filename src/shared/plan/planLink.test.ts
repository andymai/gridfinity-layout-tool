import { describe, expect, it } from 'vitest';
import { isOk } from '@/core/result';
import { PLAN_LINK_MAX_CHARS, decodePlanLink, encodePlanLink, planLinkUrl } from './planLink';
import { planInput } from './planInput';

const input = planInput.parse({
  title: 'Screw drawer',
  drawer: { width: 15.5, depth: 21, unit: 'in' },
  bins: [{ label: 'M3', width: 1, depth: 1, height: 3, count: 4 }],
});

describe('plan links', () => {
  it('round-trips a plan', async () => {
    const decoded = await decodePlanLink(encodePlanLink(input));
    expect(isOk(decoded) && decoded.value).toEqual(input);
    expect(planLinkUrl('https://example.test', input)).toMatch(
      /^https:\/\/example\.test\/#plan=v1\./
    );
  });

  it('names a link from a newer app version apart from a damaged one', async () => {
    const newer = await decodePlanLink(`v2.${encodePlanLink(input).slice(3)}`);
    expect(!isOk(newer) && newer.error).toEqual({ kind: 'newer-version', version: 2 });
    const damaged = await decodePlanLink('v1.not!base64');
    expect(!isOk(damaged) && damaged.error).toEqual({ kind: 'malformed' });
  });

  it('checks a decoded plan like any input', async () => {
    const tampered = encodePlanLink({ ...input, bins: [] });
    const decoded = await decodePlanLink(tampered);
    expect(!isOk(decoded) && decoded.error.kind).toBe('invalid');
  });

  it('keeps a 60-bin plan with labels inside the link budget', () => {
    const big = planInput.parse({
      grid: { width: 20, depth: 20 },
      categories: ['Screws', 'Nuts', 'Washers', 'Tools'],
      bins: Array.from({ length: 60 }, (_, i) => ({
        label: `Part ${i + 1} label`,
        width: 1 + (i % 3),
        depth: 1,
        height: 3,
        category: ['Screws', 'Nuts', 'Washers', 'Tools'][i % 4],
      })),
    });
    expect(encodePlanLink(big).length).toBeLessThan(PLAN_LINK_MAX_CHARS);
  });
});
