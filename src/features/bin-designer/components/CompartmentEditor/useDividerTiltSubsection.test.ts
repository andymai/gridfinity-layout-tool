import { describe, it, expect } from 'vitest';
import { getEndpointLabelKeys, rowKeyOf } from './useDividerTiltSubsection';

describe('useDividerTiltSubsection helpers', () => {
  it('rowKeyOf joins compartment IDs in canonical order with a dash', () => {
    expect(rowKeyOf(0, 1)).toBe('0-1');
    expect(rowKeyOf(2, 7)).toBe('2-7');
  });

  it('rowKeyOf normalizes argument order so callers can pass the pair either way', () => {
    expect(rowKeyOf(7, 2)).toBe('2-7');
    expect(rowKeyOf(1, 0)).toBe('0-1');
  });

  it('getEndpointLabelKeys returns Bottom/Top for vertical dividers', () => {
    expect(getEndpointLabelKeys('vertical')).toEqual({
      start: 'endpointBottom',
      end: 'endpointTop',
    });
  });

  it('getEndpointLabelKeys returns Left/Right for horizontal dividers', () => {
    expect(getEndpointLabelKeys('horizontal')).toEqual({
      start: 'endpointLeft',
      end: 'endpointRight',
    });
  });
});
