import { describe, expect, it } from 'vitest';
import { deflateSync } from 'fflate';
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

  it('refuses a link that is too long or inflates past the cap', async () => {
    const tooLong = await decodePlanLink(`v1.${'A'.repeat(PLAN_LINK_MAX_CHARS)}`);
    expect(!isOk(tooLong) && tooLong.error).toEqual({ kind: 'malformed' });
    // A link inside the budget that inflates to 4 MB of valid JSON. Past the cap
    // it is refused as damaged; read in full it would fail only the schema.
    const bomb = deflateSync(
      new TextEncoder().encode(`{"title":"${'a'.repeat(4 * 1024 * 1024)}"}`)
    );
    const encoded = btoa(String.fromCharCode(...bomb))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(encoded.length).toBeLessThan(PLAN_LINK_MAX_CHARS);
    const decoded = await decodePlanLink(`v1.${encoded}`);
    expect(!isOk(decoded) && decoded.error).toEqual({ kind: 'malformed' });
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
