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
    ['cs', 'Vyplnit 2 mezery', 'Vyplnit 5 mezer'],
    ['pl', 'Wypełnij 2 luki', 'Wypełnij 5 luk'],
    ['uk', 'Заповнити 2 проміжки', 'Заповнити 5 проміжків'],
  ])('%s words 2 gaps apart from 5 gaps', (code, two, five) => {
    const strings = Object.fromEntries(locales)[`${code}.json`];
    const fill = (count: number) =>
      interpolate(lookupPlural(strings, code, 'layers.fillGaps', count) ?? '', { count });
    expect(fill(2)).toBe(two);
    expect(fill(5)).toBe(five);
  });
});
