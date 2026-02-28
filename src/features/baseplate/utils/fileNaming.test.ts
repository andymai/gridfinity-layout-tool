import { describe, expect, it } from 'vitest';
import { generateBaseplateFileName } from './fileNaming';

const baseParams = {
  width: 8,
  depth: 6,
  magnetHoles: false,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
};

describe('generateBaseplateFileName', () => {
  describe('descriptive style', () => {
    const config = { style: 'descriptive' as const, customName: '', format: 'stl' as const };

    it('generates basic descriptive name', () => {
      expect(generateBaseplateFileName(baseParams, 'stl', config)).toBe(
        'gridfinity-baseplate-8x6.stl'
      );
    });

    it('includes magnets suffix', () => {
      expect(generateBaseplateFileName({ ...baseParams, magnetHoles: true }, 'stl', config)).toBe(
        'gridfinity-baseplate-8x6-magnets.stl'
      );
    });

    it('includes padded suffix', () => {
      expect(generateBaseplateFileName({ ...baseParams, paddingLeft: 2 }, 'stl', config)).toBe(
        'gridfinity-baseplate-8x6-padded.stl'
      );
    });

    it('includes multiple features', () => {
      expect(
        generateBaseplateFileName(
          { ...baseParams, magnetHoles: true, paddingLeft: 1, connectorNubs: true },
          'step',
          config
        )
      ).toBe('gridfinity-baseplate-8x6-magnets-padded-connectors.step');
    });

    it('handles fractional dimensions', () => {
      expect(
        generateBaseplateFileName({ ...baseParams, width: 8.5, depth: 6 }, 'stl', config)
      ).toBe('gridfinity-baseplate-8.5x6.stl');
    });

    it('uses correct extension for 3mf', () => {
      expect(generateBaseplateFileName(baseParams, '3mf', config)).toBe(
        'gridfinity-baseplate-8x6.3mf'
      );
    });
  });

  describe('compact style', () => {
    const config = { style: 'compact' as const, customName: '', format: 'stl' as const };

    it('generates compact name', () => {
      expect(generateBaseplateFileName(baseParams, 'stl', config)).toBe('gf-bp-8x6.stl');
    });

    it('omits features in compact mode', () => {
      expect(generateBaseplateFileName({ ...baseParams, magnetHoles: true }, 'stl', config)).toBe(
        'gf-bp-8x6.stl'
      );
    });
  });

  describe('custom style', () => {
    it('uses custom name', () => {
      const config = {
        style: 'custom' as const,
        customName: 'my-baseplate',
        format: 'stl' as const,
      };
      expect(generateBaseplateFileName(baseParams, 'stl', config)).toBe('my-baseplate.stl');
    });

    it('sanitizes unsafe characters', () => {
      const config = {
        style: 'custom' as const,
        customName: 'my<baseplate>',
        format: 'stl' as const,
      };
      expect(generateBaseplateFileName(baseParams, 'stl', config)).toBe('my_baseplate_.stl');
    });

    it('falls back to default when empty', () => {
      const config = { style: 'custom' as const, customName: '', format: 'stl' as const };
      expect(generateBaseplateFileName(baseParams, 'stl', config)).toBe('gridfinity-baseplate.stl');
    });

    it('falls back when only underscores', () => {
      const config = { style: 'custom' as const, customName: '___', format: 'stl' as const };
      expect(generateBaseplateFileName(baseParams, 'stl', config)).toBe('gridfinity-baseplate.stl');
    });
  });
});
