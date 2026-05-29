import { useReducer, useMemo } from 'react';

export interface SelectionState {
  /** Whether bulk-selection mode is active. */
  active: boolean;
  selected: ReadonlySet<string>;
}

export type SelectionAction =
  | { type: 'ENTER' }
  | { type: 'EXIT' }
  | { type: 'TOGGLE'; id: string }
  | { type: 'SELECT_ALL'; ids: readonly string[] }
  | { type: 'PRUNE'; ids: readonly string[] };

export const initialSelectionState: SelectionState = {
  active: false,
  selected: new Set(),
};

export function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case 'ENTER':
      return { active: true, selected: new Set() };
    case 'EXIT':
      return initialSelectionState;
    case 'TOGGLE': {
      const next = new Set(state.selected);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, selected: next };
    }
    case 'SELECT_ALL':
      return { ...state, selected: new Set(action.ids) };
    case 'PRUNE': {
      const keep = new Set(action.ids);
      return { ...state, selected: new Set([...state.selected].filter((id) => keep.has(id))) };
    }
  }
}

export interface DesignSelection {
  active: boolean;
  selectedIds: ReadonlySet<string>;
  count: number;
  isSelected: (id: string) => boolean;
  enter: () => void;
  exit: () => void;
  toggle: (id: string) => void;
  selectAll: (ids: readonly string[]) => void;
  prune: (ids: readonly string[]) => void;
}

/** Bulk-selection state for the designs manager. */
export function useDesignSelection(): DesignSelection {
  const [state, dispatch] = useReducer(selectionReducer, initialSelectionState);

  return useMemo(
    () => ({
      active: state.active,
      selectedIds: state.selected,
      count: state.selected.size,
      isSelected: (id: string) => state.selected.has(id),
      enter: () => dispatch({ type: 'ENTER' }),
      exit: () => dispatch({ type: 'EXIT' }),
      toggle: (id: string) => dispatch({ type: 'TOGGLE', id }),
      selectAll: (ids: readonly string[]) => dispatch({ type: 'SELECT_ALL', ids }),
      prune: (ids: readonly string[]) => dispatch({ type: 'PRUNE', ids }),
    }),
    [state]
  );
}
