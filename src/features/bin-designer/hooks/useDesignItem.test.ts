import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { SavedDesign } from '@/features/bin-designer/types';
import { useDesignItem } from './useDesignItem';

const design = {
  id: 'd1',
  name: 'Box',
  params: {
    ...DEFAULT_BIN_PARAMS,
    compartments: { ...DEFAULT_BIN_PARAMS.compartments, cells: [0, 0, 1, 2] },
  },
  createdAt: 0,
  updatedAt: 0,
} as unknown as SavedDesign;

function key(k: string) {
  return { key: k, preventDefault: vi.fn() } as unknown as ReactKeyboardEvent;
}

describe('useDesignItem', () => {
  it('counts distinct compartments and reports the footprint', () => {
    const { result } = renderHook(() =>
      useDesignItem({ design, onSelect: vi.fn(), onRename: vi.fn(), selectionActive: false })
    );
    expect(result.current.numCompartments).toBe(3);
    expect(result.current.footprint.width).toBe(DEFAULT_BIN_PARAMS.width);
  });

  it('loads on click and on Enter, or toggles selection in bulk mode', () => {
    const onSelect = vi.fn();
    const onToggleSelect = vi.fn();
    const plain = renderHook(() =>
      useDesignItem({ design, onSelect, onRename: vi.fn(), selectionActive: false, onToggleSelect })
    );
    plain.result.current.handleClick();
    const enter = key('Enter');
    plain.result.current.handleItemKeyDown(enter);
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(enter.preventDefault).toHaveBeenCalled();
    expect(onToggleSelect).not.toHaveBeenCalled();

    const bulk = renderHook(() =>
      useDesignItem({ design, onSelect, onRename: vi.fn(), selectionActive: true, onToggleSelect })
    );
    bulk.result.current.handleItemKeyDown(key(' '));
    expect(onToggleSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});
