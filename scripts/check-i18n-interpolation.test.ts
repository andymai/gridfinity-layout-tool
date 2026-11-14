import { describe, expect, it } from 'vitest';

import { findLocalePlaceholderMismatches, parseEnglishStrings } from './check-i18n-interpolation';

const EN = parseEnglishStrings(`const en = {
  'gallery.yourSize': '(yours: {size})',
  'mobile.contextMenu.stashAndGrid': '{stash} in stash, {grid} on grid',
  'lid.wallCutouts': 'Wall cutouts remove the lip they cut through.',
  'lid.wallCutoutsDetail':
    'The click rail on {sides} stops short of each window.',
  'layers.clearBins_one': 'Clear {count} bin',
  'layers.clearBins_other': 'Clear {count} bins',
  'supporters.credits.people_one': 'person',
  'supporters.credits.people_other': 'people',
  'help.tip.quickOpen': "Use Ctrl/{cmd}+O to open the layout manager's list",
};`);

describe('findLocalePlaceholderMismatches', () => {
  it('passes a locale that keeps every placeholder, in any order', () => {
    expect(
      findLocalePlaceholderMismatches(EN, {
        'gallery.yourSize': '(tvoje: {size})',
        'mobile.contextMenu.stashAndGrid': 'Raster: {grid}, Stash: {stash}',
        'lid.wallCutouts': 'Výřezy ve stěnách odstraní lem, kterým procházejí.',
        'lid.wallCutoutsDetail': 'Kolejnice na {sides} končí před každým oknem.',
        'layers.clearBins_one': 'Vyčistit {count} bin',
        'layers.clearBins_few': 'Vyčistit {count} biny',
        'layers.clearBins_other': 'Vyčistit {count} binů',
        'supporters.credits.people_one': 'člověk',
        'supporters.credits.people_other': 'lidé',
        'help.tip.quickOpen': 'Použij Ctrl/{cmd}+O',
      })
    ).toEqual([]);
  });

  it('fails a string that drops a placeholder', () => {
    expect(
      findLocalePlaceholderMismatches(EN, {
        'gallery.yourSize': 'Ihre Größe',
        'mobile.contextMenu.stashAndGrid': 'Stash und Raster',
      })
    ).toEqual([
      { key: 'gallery.yourSize', expected: ['size'], actual: [] },
      { key: 'mobile.contextMenu.stashAndGrid', expected: ['grid', 'stash'], actual: [] },
    ]);
  });

  it('fails both strings when a placeholder moves to the neighbouring key', () => {
    expect(
      findLocalePlaceholderMismatches(EN, {
        'lid.wallCutouts': 'Wandausschnitte ({sides}) entfernen den Stapelrand.',
        'lid.wallCutoutsDetail': 'Der Deckel verliert dort den Halt.',
      })
    ).toEqual([
      { key: 'lid.wallCutouts', expected: [], actual: ['sides'] },
      { key: 'lid.wallCutoutsDetail', expected: ['sides'], actual: [] },
    ]);
  });

  it('fails a placeholder that en.ts does not have', () => {
    expect(findLocalePlaceholderMismatches(EN, { 'gallery.yourSize': '(din: {sise})' })).toEqual([
      { key: 'gallery.yourSize', expected: ['size'], actual: ['sise'] },
    ]);
  });

  it('holds every plural form, including ones English lacks, to the en.ts _other form', () => {
    expect(
      findLocalePlaceholderMismatches(EN, {
        'layers.clearBins_one': 'Wyczyść bin',
        'layers.clearBins_few': 'Wyczyść biny',
        'layers.clearBins_many': 'Wyczyść {count} binów',
        'layers.clearBins_other': 'Wyczyść {count} binów',
      })
    ).toEqual([
      { key: 'layers.clearBins_few', expected: ['count'], actual: [] },
      { key: 'layers.clearBins_one', expected: ['count'], actual: [] },
    ]);
  });

  it('fails a plural form that prints {count} where en.ts leaves the number to the caller', () => {
    expect(
      findLocalePlaceholderMismatches(EN, {
        'supporters.credits.people_one': '{count} osoba',
        'supporters.credits.people_other': 'osoby',
      })
    ).toEqual([{ key: 'supporters.credits.people_one', expected: [], actual: ['count'] }]);
  });

  it('skips keys en.ts does not define and values that are not strings', () => {
    expect(
      findLocalePlaceholderMismatches(EN, {
        'removed.key': 'Stale {thing}',
        'gallery.yourSize': 42,
      })
    ).toEqual([]);
  });
});
