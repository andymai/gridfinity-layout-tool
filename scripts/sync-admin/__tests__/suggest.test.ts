import { describe, it, expect } from 'vitest';
import { suggestFor, categoryOf, SUGGEST_CATEGORIES } from '../lib/suggest';
import { expectedEnvelopeDelta } from '../lib/delta';
import type { Finding } from '../lib/types';

describe('suggestFor', () => {
  it('drift suggestion encodes the recomputed sizeBytes and guards on modifiedAt', () => {
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
    const out = suggestFor(finding).join('\n');
    const expected = blobSize - expectedEnvelopeDelta('layouts', modifiedAt);
    expect(out).toContain(`${expected}`);
    expect(out).toContain(`'users:u1:index:layouts'`);
    // Stale-modifiedAt guard and indexUpdatedAt bump are both wired.
    expect(out).toContain('stale-modifiedAt');
    expect(out).toContain(`'users:u1:indexUpdatedAt'`);
  });

  it('drift suggestion is empty when blobSize would yield a negative recomputed size', () => {
    const finding: Finding = {
      kind: 'sanitization_drift',
      uid: 'u1',
      itemKind: 'layouts',
      id: 'l1',
      severity: 'warn',
      detail: '',
      data: { blobSize: 10, modifiedAt: 1_780_000_000_000 },
    };
    expect(suggestFor(finding)).toEqual([]);
  });

  it('drift suggestion handles modifiedAt === 0', () => {
    const finding: Finding = {
      kind: 'sanitization_drift',
      uid: 'u1',
      itemKind: 'layouts',
      id: 'l1',
      severity: 'warn',
      detail: '',
      data: { blobSize: 1000, modifiedAt: 0 },
    };
    // Should not silently treat 0 as missing — should compute against expected envelope.
    expect(suggestFor(finding)).not.toEqual([]);
  });

  it('orphan blob suggestion preflight-checks the index before deleting the blob', () => {
    const finding: Finding = {
      kind: 'orphan_blob',
      uid: 'u1',
      itemKind: 'designs',
      id: 'd1',
      severity: 'error',
      detail: '',
    };
    const out = suggestFor(finding).join('\n');
    expect(out).toContain('vercel blob rm');
    expect(out).toContain('users/u1/designs/d1.json');
    // Preflight guard against an item that got re-uploaded between audit and remediation.
    expect(out).toContain('redis-cli');
    expect(out).toContain('HGET');
  });

  it('missing blob suggestion emits HDEL guarded on audited modifiedAt', () => {
    const finding: Finding = {
      kind: 'missing_blob',
      uid: 'u1',
      itemKind: 'layouts',
      id: 'l1',
      severity: 'error',
      detail: '',
      data: { modifiedAt: 1_780_000_000_000, sizeBytes: 100 },
    };
    const out = suggestFor(finding).join('\n');
    expect(out).toContain('HDEL');
    expect(out).toContain('stale-modifiedAt');
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
    ['index_size_undercount', 'drift'],
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
