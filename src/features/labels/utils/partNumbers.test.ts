import { describe, expect, it } from 'vitest';
import { looksLikePartNumber, normalizePartNumber, vendorOfPartNumber } from './partNumbers';

describe('vendorOfPartNumber', () => {
  it.each(['91290A113', '6100K134', '47065T101', '1346K17', ' 98019a350 '])(
    'recognises McMaster-Carr format %s',
    (token) => {
      expect(vendorOfPartNumber(token)).toBe('mcmaster');
    }
  );

  it.each(['M3x8', '100', 'A113', '91290A113X', '300x200', '2020X500', 'Socket head screw'])(
    'rejects %s',
    (token) => {
      expect(vendorOfPartNumber(token)).toBeNull();
    }
  );
});

describe('looksLikePartNumber', () => {
  it.each(['91290A113', '296-1234-ND', 'C12345', 'M3x8'])('accepts %s', (cell) => {
    expect(looksLikePartNumber(cell)).toBe(true);
  });

  it.each(['100', '12.34', '$9.81', 'Each', 'two words 12', ''])('rejects %s', (cell) => {
    expect(looksLikePartNumber(cell)).toBe(false);
  });
});

describe('normalizePartNumber', () => {
  it('upper-cases a recognised supplier part number only', () => {
    expect(normalizePartNumber(' 91290a113 ')).toBe('91290A113');
    expect(normalizePartNumber('c12345')).toBe('c12345');
  });
});
