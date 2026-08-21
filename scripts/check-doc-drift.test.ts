import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  docFiles,
  isDangling,
  loadBaseline,
  referencesIn,
  wordCount,
  GROWTH_TOLERANCE,
} from './check-doc-drift';

const ROOT = join(import.meta.dirname, '..');
const read = (f: string): string => readFileSync(join(ROOT, f), 'utf8');

describe('doc drift gate', () => {
  it('finds the docs an agent actually reads', () => {
    const files = docFiles();
    expect(files).toContain('CLAUDE.md');
    expect(files).toContain('src/features/generation/README.md');
    expect(files.some((f) => f.startsWith('.claude/skills/'))).toBe(true);
    // content/ is user-facing SEO copy, not agent context, and must stay out.
    expect(files.some((f) => f.startsWith('content/'))).toBe(false);
  });

  it('covers every doc with a baseline, so none escapes the ratchet', () => {
    const { words } = loadBaseline();
    const uncovered = docFiles().filter((f) => words[f] === undefined);
    expect(uncovered).toEqual([]);
  });

  it('holds every doc within its budget', () => {
    const { words } = loadBaseline();
    const over = docFiles()
      .filter(
        (f) => words[f] !== undefined && wordCount(read(f)) > Math.ceil(words[f] * GROWTH_TOLERANCE)
      )
      .map((f) => `${f}: ${wordCount(read(f))} > ${words[f]}`);
    expect(over).toEqual([]);
  });

  it('has no dangling references in any doc', () => {
    const allowed = new Set(loadBaseline().allowedMissingRefs);
    const bad: string[] = [];
    for (const f of docFiles()) {
      for (const ref of referencesIn(read(f))) {
        if (!allowed.has(ref) && isDangling(ref)) bad.push(`${f}: ${ref}`);
      }
    }
    expect(bad).toEqual([]);
  });

  // An allowlist is the gate's own blind spot, so it gets the same treatment
  // as the docs: an entry that would now resolve on its own is drift.
  it('keeps no allowlist entry that has stopped being necessary', () => {
    const stale = loadBaseline().allowedMissingRefs.filter((ref) => !isDangling(ref));
    expect(stale).toEqual([]);
  });

  it('only treats plausible identifiers as references', () => {
    const refs = referencesIn(
      '`useBinGeometry` `a` `the quick brown` `foo/bar.ts` `MAX_LID_CUTOUTS`'
    );
    expect(refs).toContain('useBinGeometry');
    expect(refs).toContain('foo/bar.ts');
    expect(refs).toContain('MAX_LID_CUTOUTS');
    expect(refs).not.toContain('a');
    expect(refs).not.toContain('the quick brown');
  });
});
