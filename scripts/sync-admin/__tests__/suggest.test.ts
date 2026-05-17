import { describe, it, expect } from 'vitest';
import { suggestFor, categoryOf, SUGGEST_CATEGORIES } from '../lib/suggest';
import { expectedEnvelopeDelta } from '../lib/delta';
import type { Finding } from '../lib/types';

describe('suggestFor', () => {
  it('drift suggestion encodes the recomputed sizeBytes', () => {
    const modifiedAt = 1_780_000_000_000;
    const blobSize = 1000;
    const finding: Finding = {
      kind: 'sanitization_drift',
      uid: 'u1',
      itemKind: 'layouts',
      id: 'l1',
      severity: 'warn',
      detail: '',
      data: { indexSize: 1500, blobSize, modifiedAt },
    };
    const lines = suggestFor(finding);
    const expected = blobSize - expectedEnvelopeDelta('layouts', modifiedAt);
    expect(lines.join('\n')).toContain(`${expected}`);
    expect(lines.join('\n')).toContain(`'users:u1:index:layouts'`);
  });

  it('orphan blob suggestion emits `vercel blob rm`', () => {
    const finding: Finding = {
      kind: 'orphan_blob',
      uid: 'u1',
      itemKind: 'designs',
      id: 'd1',
      severity: 'error',
      detail: '',
    };
    const lines = suggestFor(finding);
    expect(lines.some((l) => l.startsWith('vercel blob rm'))).toBe(true);
    expect(lines.join('\n')).toContain('users/u1/designs/d1.json');
  });

  it('missing blob suggestion emits HDEL', () => {
    const finding: Finding = {
      kind: 'missing_blob',
      uid: 'u1',
      itemKind: 'layouts',
      id: 'l1',
      severity: 'error',
      detail: '',
    };
    expect(suggestFor(finding).join('\n')).toContain('HDEL');
  });

  it("escapes single quotes via the '\\'' bash idiom", () => {
    const finding: Finding = {
      kind: 'orphan_blob',
      uid: "u'1",
      itemKind: 'layouts',
      id: "id'odd",
      severity: 'error',
      detail: '',
    };
    const out = suggestFor(finding).join('\n');
    // Every literal apostrophe from the input must be wrapped as `'\''`.
    expect(out).toContain(`'u'\\''1'`);
    expect(out).toContain(`id'\\''odd`);
  });
});

describe('categoryOf', () => {
  it.each([
    ['sanitization_drift', 'drift'],
    ['orphan_blob', 'orphans'],
    ['tombstone_with_blob', 'orphans'],
    ['missing_blob', 'orphans'],
    ['stale_tombstone', 'stale-tombstones'],
    ['malformed_index_entry', 'malformed'],
  ] as const)('%s -> %s', (kind, expected) => {
    expect(categoryOf({ kind, uid: '', severity: 'warn', detail: '' } as Finding)).toBe(expected);
  });

  it('returns undefined for findings with no fix category', () => {
    expect(
      categoryOf({ kind: 'envelope_invalid', uid: '', severity: 'error', detail: '' } as Finding)
    ).toBeUndefined();
  });

  it('SUGGEST_CATEGORIES enumerates the public list', () => {
    expect(SUGGEST_CATEGORIES).toEqual(['drift', 'orphans', 'stale-tombstones', 'malformed']);
  });
});
