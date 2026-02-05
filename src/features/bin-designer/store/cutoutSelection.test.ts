import { describe, it, expect, beforeEach } from 'vitest';
import { useCutoutSelection } from './cutoutSelection';

describe('cutoutSelection store', () => {
  beforeEach(() => {
    useCutoutSelection.setState({ selectedIds: new Set() });
  });

  it('starts with empty selection', () => {
    expect(useCutoutSelection.getState().selectedIds.size).toBe(0);
  });

  it('sets selected IDs', () => {
    useCutoutSelection.getState().setSelectedIds(new Set(['a', 'b']));
    expect(useCutoutSelection.getState().selectedIds.size).toBe(2);
    expect(useCutoutSelection.getState().selectedIds.has('a')).toBe(true);
    expect(useCutoutSelection.getState().selectedIds.has('b')).toBe(true);
  });

  it('replaces selection on subsequent set', () => {
    useCutoutSelection.getState().setSelectedIds(new Set(['a']));
    useCutoutSelection.getState().setSelectedIds(new Set(['b']));
    expect(useCutoutSelection.getState().selectedIds.has('a')).toBe(false);
    expect(useCutoutSelection.getState().selectedIds.has('b')).toBe(true);
  });

  it('can clear selection', () => {
    useCutoutSelection.getState().setSelectedIds(new Set(['a', 'b']));
    useCutoutSelection.getState().setSelectedIds(new Set());
    expect(useCutoutSelection.getState().selectedIds.size).toBe(0);
  });
});
