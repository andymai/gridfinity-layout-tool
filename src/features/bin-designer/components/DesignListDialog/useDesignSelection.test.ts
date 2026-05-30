import { describe, it, expect } from 'vitest';
import { selectionReducer, initialSelectionState } from './useDesignSelection';

describe('selectionReducer', () => {
  it('starts inactive with an empty selection', () => {
    expect(initialSelectionState.active).toBe(false);
    expect(initialSelectionState.selected.size).toBe(0);
  });

  it('ENTER activates selection mode with an empty selection', () => {
    const entered = selectionReducer(initialSelectionState, { type: 'ENTER' });
    expect(entered.active).toBe(true);
    expect(entered.selected.size).toBe(0);
  });

  it('TOGGLE adds then removes an id', () => {
    const s1 = selectionReducer({ active: true, selected: new Set() }, { type: 'TOGGLE', id: 'a' });
    expect([...s1.selected]).toEqual(['a']);
    const s2 = selectionReducer(s1, { type: 'TOGGLE', id: 'a' });
    expect(s2.selected.size).toBe(0);
  });

  it('SELECT_ALL replaces the selection with the given ids', () => {
    const s = selectionReducer(
      { active: true, selected: new Set(['x']) },
      { type: 'SELECT_ALL', ids: ['a', 'b', 'c'] }
    );
    expect([...s.selected].sort()).toEqual(['a', 'b', 'c']);
  });

  it('EXIT clears the selection and leaves selection mode', () => {
    const s = selectionReducer({ active: true, selected: new Set(['a', 'b']) }, { type: 'EXIT' });
    expect(s.active).toBe(false);
    expect(s.selected.size).toBe(0);
  });

  it('PRUNE drops ids no longer present (e.g. after deletes)', () => {
    const s = selectionReducer(
      { active: true, selected: new Set(['a', 'b', 'c']) },
      { type: 'PRUNE', ids: ['a', 'c'] }
    );
    expect([...s.selected].sort()).toEqual(['a', 'c']);
  });
});
