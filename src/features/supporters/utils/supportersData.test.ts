import { describe, it, expect } from 'vitest';
import { buildSupporterBins, getSupporterCount } from './supportersData';
import supportersData from '../data/supporters.json';

describe('supportersData', () => {
  it('counts named + anonymous supporters', () => {
    expect(getSupporterCount()).toBe(supportersData.named.length + supportersData.anonymousCount);
  });

  it('builds one bin per supporter', () => {
    const bins = buildSupporterBins(() => 0);
    expect(bins).toHaveLength(getSupporterCount());
  });

  it('renders anonymous supporters as null-named bins', () => {
    const bins = buildSupporterBins(() => 0);
    expect(bins.filter((b) => b.name === null)).toHaveLength(supportersData.anonymousCount);
    expect(bins.filter((b) => b.name !== null)).toHaveLength(supportersData.named.length);
  });

  it('never emits an email address as a name', () => {
    const bins = buildSupporterBins(() => 0);
    for (const bin of bins) {
      expect(bin.name ?? '').not.toContain('@');
    }
  });

  it('shuffles deterministically for a given RNG', () => {
    const a = buildSupporterBins(() => 0.5).map((b) => b.id);
    const b = buildSupporterBins(() => 0.5).map((b) => b.id);
    expect(a).toEqual(b);
  });

  it('assigns unique ids', () => {
    const bins = buildSupporterBins(() => 0);
    expect(new Set(bins.map((b) => b.id)).size).toBe(bins.length);
  });
});
