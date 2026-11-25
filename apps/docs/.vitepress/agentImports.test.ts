import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// ESLint ignores apps/docs, so this test keeps the tool handlers, which only
// the server bundle may hold, out of the docs site.
const FORBIDDEN = /from ['"]@\/agent\/(tools|server)(\/|['"])/;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'dist' || entry.name === 'cache' || entry.name.startsWith('.')) return [];
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.(ts|vue)$/.test(entry.name) ? [file] : [];
  });
}

describe('docs site imports', () => {
  it('never imports the agent tool handlers or the server entry', () => {
    const offenders = sourceFiles(path.resolve(import.meta.dirname)).filter((file) =>
      FORBIDDEN.test(fs.readFileSync(file, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });
});
