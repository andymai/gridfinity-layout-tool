import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { interpolate } from '../interpolate';
import { lookupPlural } from '../plural';

const locales = readdirSync(__dirname)
  .filter((file) => file.endsWith('.json') && file !== 'en.json')
  .map((file): [string, Record<string, string>] => [
    file,
    JSON.parse(readFileSync(join(__dirname, file), 'utf-8')) as Record<string, string>,
  ]);

describe('translated strings', () => {
  it.each(locales)('%s names the layer limit', (_file, strings) => {
    expect(interpolate(strings['layers.maxLayersReached'], { max: 10 })).toContain('10');
  });
});

describe('plural families', () => {
  it.each([
    ['cs', 'layers.fillGaps', 'Vyplnit 2 mezery', 'Vyplnit 5 mezer'],
    ['pl', 'layers.fillGaps', 'Wypełnij 2 luki', 'Wypełnij 5 luk'],
    ['uk', 'layers.fillGaps', 'Заповнити 2 проміжки', 'Заповнити 5 проміжків'],
    [
      'cs',
      'layers.fillGapsTitle',
      'Vyplnit 2 prázdné buňky biny 1×1',
      'Vyplnit 5 prázdných buněk biny 1×1',
    ],
    [
      'pl',
      'layers.fillGapsTitle',
      'Wypełnij 2 puste komórki binami 1×1',
      'Wypełnij 5 pustych komórek binami 1×1',
    ],
    [
      'uk',
      'layers.fillGapsTitle',
      'Заповнити 2 порожні клітинки бінами 1×1',
      'Заповнити 5 порожніх клітинок бінами 1×1',
    ],
  ])('%s words %s for 2 apart from 5', (code, key, two, five) => {
    const strings = Object.fromEntries(locales)[`${code}.json`];
    const fill = (count: number) =>
      interpolate(lookupPlural(strings, code, key, count) ?? '', { count });
    expect(fill(2)).toBe(two);
    expect(fill(5)).toBe(five);
  });
});
