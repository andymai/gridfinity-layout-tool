import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHOTS } from './index';

const DOCS = path.resolve(import.meta.dirname, '../../../apps/docs');

function pageIds(): Set<string> {
  const ids = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md'))
        for (const [, id] of fs
          .readFileSync(full, 'utf8')
          .matchAll(/<Screenshot\s[^>]*\bid="([^"]+)"/g))
          ids.add(id);
    }
  };
  walk(DOCS);
  return ids;
}

describe('docs capture shots', () => {
  const ids = SHOTS.map((s) => s.id);

  it('fill a <Screenshot> on a page, once each', () => {
    const onPages = pageIds();
    expect(ids.filter((id) => !onPages.has(id))).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('can recapture every captured entry', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(DOCS, 'media/manifest.json'), 'utf8')
    ) as Record<string, { kind: string }>;
    const byId = new Map(SHOTS.map((s) => [s.id, s.kind]));
    for (const [id, entry] of Object.entries(manifest)) expect(byId.get(id), id).toBe(entry.kind);
  });
});
