import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { binHasText } from './binText';

const withParams = (over: Partial<BinParams>): BinParams => ({ ...DEFAULT_BIN_PARAMS, ...over });
const cut = (over: Partial<Cutout>): Cutout => over as Cutout;

describe('binHasText', () => {
  it('is false for a stock bin with no captions', () => {
    expect(binHasText(DEFAULT_BIN_PARAMS)).toBe(false);
  });

  it('is false for whitespace-only text', () => {
    expect(binHasText(withParams({ surfaceText: { lidText: '   ' } }))).toBe(false);
  });

  it('sees lid and wall text', () => {
    expect(binHasText(withParams({ surfaceText: { lidText: 'HELLO' } }))).toBe(true);
    expect(binHasText(withParams({ surfaceText: { walls: { left: 'X' } } }))).toBe(true);
  });

  it('sees compartment tab captions', () => {
    expect(
      binHasText(
        withParams({
          compartments: { ...DEFAULT_BIN_PARAMS.compartments, compartmentTexts: ['A'] },
        })
      )
    ).toBe(true);
  });

  it('sees spanning-tab row captions', () => {
    expect(
      binHasText(withParams({ label: { ...DEFAULT_BIN_PARAMS.label, rowTexts: ['Row'] } }))
    ).toBe(true);
  });

  it('sees engraved cutout labels but not plain cavity names', () => {
    expect(binHasText(withParams({ cutouts: [cut({ shape: 'text', label: 'T' })] }))).toBe(true);
    expect(
      binHasText(
        withParams({ cutouts: [cut({ shape: 'circle', engraveLabel: true, label: 'L' })] })
      )
    ).toBe(true);
    // A named cavity that does not engrave is editor metadata, not text.
    expect(
      binHasText(
        withParams({ cutouts: [cut({ shape: 'circle', engraveLabel: false, label: 'name' })] })
      )
    ).toBe(false);
  });

  it('sees per-instance array labels on an engraving cutout', () => {
    expect(
      binHasText(
        withParams({
          cutouts: [
            cut({
              shape: 'circle',
              engraveLabel: true,
              label: '',
              array: { labels: ['', 'A'] } as Cutout['array'],
            }),
          ],
        })
      )
    ).toBe(true);
  });

  it('sees engraved labels on lid cutouts', () => {
    expect(
      binHasText(
        withParams({
          lid: { ...DEFAULT_BIN_PARAMS.lid, cutouts: [cut({ shape: 'text', label: 'X' })] },
        })
      )
    ).toBe(true);
  });
});
