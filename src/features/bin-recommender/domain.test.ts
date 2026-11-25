import { describe, expect, it } from 'vitest';
import { suggestBinSize } from './domain';

describe('suggestBinSize', () => {
  it('answers from labels only, never from the drawer prior', () => {
    expect(suggestBinSize('zzqx blorp')).toBeNull();
    expect(suggestBinSize('Screwdrivers')?.source).toMatch(/^(label|embed)$/);
  });
});
