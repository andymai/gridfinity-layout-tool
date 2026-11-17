import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LABEL_DEFAULT_FONT_FILE } from '../src/shared/webgl/labelFontData';
import { VENDORED_DIR, fallbackFontFile, readFontMeta } from './vendor-label-fonts';

describe('fallbackFontFile', () => {
  it('asks for the sans-serif, normal, 400 face when the font has it', () => {
    const meta = {
      id: 'latin',
      typeforms: { serif: { normal: [400] }, 'sans-serif': { italic: [400], normal: [300, 400] } },
    };
    expect(fallbackFontFile(meta)).toBe('font-files/latin/sans-serif.normal.400.woff');
  });

  it('falls back to the first category and style the font lists', () => {
    const meta = { id: 'tangut', typeforms: { serif: { italic: [400] } } };
    expect(fallbackFontFile(meta)).toBe('font-files/tangut/serif.italic.400.woff');
  });

  it('takes the nearest weight, and the lighter one on a tie', () => {
    const meta = { id: 'x', typeforms: { 'sans-serif': { normal: [300, 500, 900] } } };
    expect(fallbackFontFile(meta)).toBe('font-files/x/sans-serif.normal.300.woff');
  });
});

// The client fetches the index block of each character, the meta of each font
// that block names, and that font's file. All three must be here for any text.
describe('vendored label font data', () => {
  const metaDir = join(VENDORED_DIR, 'font-meta');

  it('has the index block for every code point', () => {
    const missing: string[] = [];
    for (let plane = 0; plane <= 16; plane++) {
      for (let block = 0; block < 256; block++) {
        const start = plane * 0x10000 + block * 0x100;
        const name = `codepoint-index/plane${plane}/${start.toString(16)}-${(start + 0xff).toString(16)}.json`;
        if (!existsSync(join(VENDORED_DIR, name))) missing.push(name);
      }
    }
    expect(missing).toEqual([]);
  });

  it('has the meta for every font an index block names', () => {
    const named = new Set<string>();
    const indexDir = join(VENDORED_DIR, 'codepoint-index');
    for (const plane of readdirSync(indexDir)) {
      for (const file of readdirSync(join(indexDir, plane))) {
        const [, langs] = JSON.parse(readFileSync(join(indexDir, plane, file), 'utf8')) as [
          number,
          Record<string, Record<string, string>>,
        ];
        for (const fonts of Object.values(langs)) {
          for (const id of Object.keys(fonts)) named.add(id);
        }
      }
    }
    expect(named.size).toBeGreaterThan(0);
    expect([...named].filter((id) => !existsSync(join(metaDir, `${id}.json`)))).toEqual([]);
  });

  it('carries the fonts’ license with them', () => {
    expect(readFileSync(join(VENDORED_DIR, 'font-files/LICENSE'), 'utf8')).toContain(
      'SIL Open Font License'
    );
  });

  it('has the default font that answers Latin text', () => {
    expect(existsSync(join(VENDORED_DIR, LABEL_DEFAULT_FONT_FILE))).toBe(true);
  });

  it('has the file the client asks for, for every font', () => {
    const missing = readdirSync(metaDir)
      .map((name) => fallbackFontFile(readFontMeta(join(metaDir, name))))
      .filter((file) => !existsSync(join(VENDORED_DIR, file)));
    expect(missing).toEqual([]);
  });
});
