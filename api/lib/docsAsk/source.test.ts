import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AskCorpus } from './corpus.js';

const corpus: AskCorpus = { version: 'v1', map: 'map', pages: {} };

describe('docsSource', () => {
  let dir: string;

  beforeEach(() => {
    vi.resetModules();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-ask-'));
    fs.mkdirSync(path.join(dir, 'ask', 'labels'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'ask', 'corpus.json'), JSON.stringify(corpus));
    fs.writeFileSync(path.join(dir, 'ask', 'labels', 'en.json'), JSON.stringify({ a: 'Fit grid' }));
    fs.writeFileSync(
      path.join(dir, 'ask', 'labels', 'de.json'),
      JSON.stringify({ a: 'Raster anpassen' })
    );
    vi.stubEnv('DOCS_ASK_CORPUS_DIR', dir);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads the corpus from its files, and each locale once', async () => {
    const { docsSource } = await import('./source.js');
    const source = await docsSource();
    expect(source.corpus.version).toBe('v1');
    expect(await source.labels('de')).toEqual({ a: 'Raster anpassen' });
    fs.rmSync(path.join(dir, 'ask', 'labels', 'de.json'));
    expect(await source.labels('de')).toEqual({ a: 'Raster anpassen' });
    expect(await docsSource()).toBe(source);
  });

  it('falls back to English for a locale the app does not have', async () => {
    const { docsSource } = await import('./source.js');
    const source = await docsSource();
    expect(source.locale('xx')).toBe('en');
    expect(await source.labels('xx')).toEqual({ a: 'Fit grid' });
  });

  it('fails without the files, then tries again on the next call', async () => {
    fs.rmSync(path.join(dir, 'ask', 'corpus.json'));
    const { docsSource } = await import('./source.js');
    await expect(docsSource()).rejects.toThrow(/ENOENT/);
    fs.writeFileSync(path.join(dir, 'ask', 'corpus.json'), JSON.stringify(corpus));
    expect((await docsSource()).corpus.version).toBe('v1');
  });
});
