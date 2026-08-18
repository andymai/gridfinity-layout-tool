import { describe, it, expect } from 'vitest';
import { collectTextFontFamilies } from './textFonts';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';

const params = (over: Partial<BinParams> = {}): BinParams => ({ ...DEFAULT_BIN_PARAMS, ...over });

describe('collectTextFontFamilies', () => {
  it('always includes the design default and the stencil', () => {
    const families = collectTextFontFamilies(params());
    expect(families.has(DEFAULT_BIN_PARAMS.textDefaults.font)).toBe(true);
    // Through-cut swaps to the stencil whatever the pick, and that decision is
    // made per style deep inside the builders.
    expect(families.has('allerta-stencil')).toBe(true);
  });

  it('picks up every layer a face can be overridden on', () => {
    const families = collectTextFontFamilies(
      params({
        surfaceText: {
          lidText: 'Lid',
          walls: { front: 'Front' },
          style: { font: 'poppins' },
          lidStyle: { font: 'barlow-condensed' },
          wallStyles: { front: { font: 'jetbrains-mono' } },
        },
        label: { ...DEFAULT_BIN_PARAMS.label, textStyle: { font: 'jetbrains-mono-bold' } },
      })
    );
    // Under-reporting is the dangerous direction: a face that never registers
    // makes `buildTextSolid` return null and the caption vanishes silently.
    for (const family of [
      'poppins',
      'barlow-condensed',
      'jetbrains-mono',
      'jetbrains-mono-bold',
    ] as const) {
      expect(families.has(family), family).toBe(true);
    }
  });

  it('picks up a per-cutout face', () => {
    const families = collectTextFontFamilies(
      params({
        cutouts: [
          {
            id: 'c1',
            shape: 'rectangle',
            width: 20,
            depth: 20,
            cutDepth: 5,
            x: 0,
            y: 0,
            rotation: 0,
            cornerRadius: 0,
            label: 'HI',
            engraveLabel: true,
            groupId: null,
            textStyle: { font: 'poppins' },
          },
        ],
      })
    );
    expect(families.has('poppins')).toBe(true);
  });
});
