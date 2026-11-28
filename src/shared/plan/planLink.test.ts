import { describe, expect, it } from 'vitest';
import { deflateSync } from 'fflate';
import { isOk } from '@/core/result';
import { PLAN_LINK_MAX_CHARS, decodePlanLink, encodePlanLink, planLinkUrl } from './planLink';
import type { PlanInput } from './planInput';

function encoded(plan: PlanInput): string {
  const result = encodePlanLink(plan);
  if (!isOk(result)) throw new Error(`plan too large: ${result.error.chars}`);
  return result.value;
}
import { planInput } from './planInput';

const input = planInput.parse({
  title: 'Screw drawer',
  drawer: { width: 15.5, depth: 21, unit: 'in' },
  bins: [{ label: 'M3', width: 1, depth: 1, height: 3, count: 4 }],
});

describe('plan links', () => {
  it('round-trips a plan', async () => {
    const decoded = await decodePlanLink(encoded(input));
    expect(isOk(decoded) && decoded.value).toEqual(input);
    const url = planLinkUrl('https://example.test', input);
    expect(isOk(url) && url.value).toMatch(/^https:\/\/example\.test\/#plan=v1\./);
  });

  // An app from before v2 cannot read a drawer without bins or with halfGrid,
  // so only those plans carry v2; it then asks to update.
  it('marks a drawer without bins, or with halfGrid, as v2, and reads both versions', async () => {
    const drawer = planInput.parse({ drawer: { width: 52, depth: 44, unit: 'cm' }, bins: [] });
    const half = planInput.parse({ ...input, halfGrid: true });
    expect(encoded(input)).toMatch(/^v1\./);
    expect(encoded(drawer)).toMatch(/^v2\./);
    expect(encoded(half)).toMatch(/^v2\./);
    for (const plan of [input, drawer, half]) {
      const decoded = await decodePlanLink(encoded(plan));
      expect(isOk(decoded) && decoded.value).toEqual(plan);
    }
  });

  it('names a link from a newer app version apart from a damaged one', async () => {
    const newer = await decodePlanLink(`v3.${encoded(input).slice(3)}`);
    expect(!isOk(newer) && newer.error).toEqual({ kind: 'newer-version', version: 3 });
    const damaged = await decodePlanLink('v1.not!base64');
    expect(!isOk(damaged) && damaged.error).toEqual({ kind: 'malformed' });
  });

  it('checks a decoded plan like any input', async () => {
    const tampered = encoded({ ...input, bins: [{ ...input.bins[0], width: 1.25 }] });
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

  it('refuses to write a link that the decoder would reject', () => {
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
    const result = encodePlanLink(rich);
    expect(!isOk(result) && result.error.kind).toBe('too-large');
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
    expect(encoded(big).length).toBeLessThan(PLAN_LINK_MAX_CHARS);
  });
});
