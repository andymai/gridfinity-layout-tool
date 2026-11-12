import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { interpolate } from '../interpolate';

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
