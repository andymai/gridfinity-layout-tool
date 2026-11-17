import { describe, expect, it } from 'vitest';
import { parseLabelList } from './parseLabelList';

describe('parseLabelList', () => {
  it('returns nothing for blank input', () => {
    expect(parseLabelList('  \n\n \r\n')).toEqual([]);
  });

  it('makes one label per typed line', () => {
    expect(parseLabelList('M3 screws\nWashers\n')).toEqual([
      { name: 'M3 screws', detail: '' },
      { name: 'Washers', detail: '' },
    ]);
  });

  it('splits a leading or trailing supplier part number into the detail', () => {
    expect(
      parseLabelList('91290a113 Socket head screw M3 x 8\nHex nut M3 90592A085\r\nM3x8 screws')
    ).toEqual([
      { name: 'Socket head screw M3 x 8', detail: '91290A113' },
      { name: 'Hex nut M3', detail: '90592A085' },
      { name: 'M3x8 screws', detail: '' },
    ]);
  });

  it('prints a bare part number as the name', () => {
    expect(parseLabelList('91290a113')).toEqual([{ name: '91290A113', detail: '' }]);
  });

  it('reads spreadsheet rows, skipping a header and the price and quantity columns', () => {
    const pasted = [
      'Part number\tDescription\tQty\tPrice',
      '91290A113\tBlack-Oxide Alloy Steel Socket Head Screw, M3 x 0.5 mm Thread, 8 mm Long\t100\t$9.81',
      '93475A210\tWasher for M3 Screw Size\t100\t$2.11',
    ].join('\n');
    expect(parseLabelList(pasted)).toEqual([
      {
        name: 'Black-Oxide Alloy Steel Socket Head Screw, M3 x 0.5 mm Thread, 8 mm Long',
        detail: '91290A113',
      },
      { name: 'Washer for M3 Screw Size', detail: '93475A210' },
    ]);
  });

  it('keeps a first row whose part number cell is empty', () => {
    expect(parseLabelList('Spacers\t\nScrews\t91290A113\nNuts\t90592A085')).toEqual([
      { name: 'Spacers', detail: '' },
      { name: 'Screws', detail: '91290A113' },
      { name: 'Nuts', detail: '90592A085' },
    ]);
  });

  it('keeps columns in place when a row starts with an empty cell', () => {
    const pasted = 'Bin\tPart\tDescription\n\t91290A113\tSocket head screw\nA2\t90592A085\tHex nut';
    expect(parseLabelList(pasted)).toEqual([
      { name: 'Socket head screw', detail: '91290A113' },
      { name: 'Hex nut', detail: '90592A085' },
    ]);
  });

  it('reads a size as part of the name, not a part number', () => {
    expect(parseLabelList('Plywood 300x200')).toEqual([{ name: 'Plywood 300x200', detail: '' }]);
  });

  it('prefers a supplier column over a size column', () => {
    const pasted = 'M3x8\t91290A113\tSocket head screw\nM3x10\t91290A115\tSocket head screw';
    expect(parseLabelList(pasted).map((label) => label.detail)).toEqual(['91290A113', '91290A115']);
  });

  it('reads the first two text columns as name and detail when none holds part numbers', () => {
    expect(parseLabelList('Screws\t40\tdrawer 1\nNuts\t\tdrawer 2\n\t12\t')).toEqual([
      { name: 'Screws', detail: 'drawer 1' },
      { name: 'Nuts', detail: 'drawer 2' },
    ]);
  });

  it('uses the part number as the name when a row has no text', () => {
    expect(parseLabelList('91290A113\t100\n91290A115\t50')).toEqual([
      { name: '91290A113', detail: '' },
      { name: '91290A115', detail: '' },
    ]);
  });
});
