import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { ResizeHandle } from './ResizeHandle';
import type { ResizeHandle as ResizeHandleType } from '@/core/types';

// Mock handle positioning utils
vi.mock('@/features/grid-editor/utils/handlePositioning', () => ({
  getHandlePosition: vi.fn((handle: ResizeHandleType) => ({
    left: handle === 'w' ? 0 : handle === 'e' ? '100%' : '50%',
    top: handle === 'n' ? 0 : handle === 's' ? '100%' : '50%',
    right: undefined,
    bottom: undefined,
    width: handle === 'w' || handle === 'e' ? 8 : 16,
    height: handle === 'n' || handle === 's' ? 8 : 16,
    minWidth: 8,
    minHeight: 8,
    transform: 'translate(-50%, -50%)',
    cursor: `${handle}-resize`,
  })),
  getHandleVisual: vi.fn((handle: ResizeHandleType) => ({
    width: handle.length === 2 ? 12 : 8,
    height: handle.length === 2 ? 12 : 8,
    minWidth: 8,
    minHeight: 8,
  })),
  isCornerHandle: vi.fn((handle: ResizeHandleType) => handle.length === 2),
}));

describe('ResizeHandle', () => {
  const mockOnPointerDown = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders without crashing for edge handle', () => {
    const { container } = render(
      <ResizeHandle
        handle="e"
        placement="internal"
        variant="primary"
        onPointerDown={mockOnPointerDown}
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders without crashing for corner handle', () => {
    const { container } = render(
      <ResizeHandle
        handle="se"
        placement="internal"
        variant="primary"
        onPointerDown={mockOnPointerDown}
      />
    );
    expect(container).toBeTruthy();
  });

  it('calls onPointerDown when clicked', () => {
    const { container } = render(
      <ResizeHandle
        handle="e"
        placement="internal"
        variant="primary"
        onPointerDown={mockOnPointerDown}
      />
    );
    const handle = container.querySelector('.resize-handle');
    fireEvent.pointerDown(handle!);
    expect(mockOnPointerDown).toHaveBeenCalledWith(expect.any(Object), 'e');
  });

  it('renders all 8 handle types', () => {
    const handles: ResizeHandleType[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

    handles.forEach((handle) => {
      const { container } = render(
        <ResizeHandle
          handle={handle}
          placement="internal"
          variant="primary"
          onPointerDown={mockOnPointerDown}
        />
      );
      expect(container.querySelector('.resize-handle')).toBeTruthy();
    });
  });

  it('renders with ghost variant', () => {
    const { container } = render(
      <ResizeHandle
        handle="e"
        placement="internal"
        variant="ghost"
        onPointerDown={mockOnPointerDown}
      />
    );
    expect(container.querySelector('.resize-handle')).toBeTruthy();
  });

  it('renders with external placement', () => {
    const { container } = render(
      <ResizeHandle
        handle="e"
        placement="external"
        variant="primary"
        onPointerDown={mockOnPointerDown}
      />
    );
    expect(container.querySelector('.resize-handle')).toBeTruthy();
  });

  it('renders resize-handle-indicator element', () => {
    const { container } = render(
      <ResizeHandle
        handle="e"
        placement="internal"
        variant="primary"
        onPointerDown={mockOnPointerDown}
      />
    );
    expect(container.querySelector('.resize-handle-indicator')).toBeTruthy();
  });

  it('has correct aria attributes for primary variant', () => {
    const { container } = render(
      <ResizeHandle
        handle="e"
        placement="internal"
        variant="primary"
        onPointerDown={mockOnPointerDown}
      />
    );
    const handle = container.querySelector('.resize-handle');
    expect(handle?.getAttribute('role')).toBe('slider');
    expect(handle?.getAttribute('aria-label')).toBeTruthy();
  });

  it('does not have aria attributes for ghost variant', () => {
    const { container } = render(
      <ResizeHandle
        handle="e"
        placement="internal"
        variant="ghost"
        onPointerDown={mockOnPointerDown}
      />
    );
    const handle = container.querySelector('.resize-handle');
    expect(handle?.getAttribute('role')).toBeNull();
    expect(handle?.getAttribute('aria-label')).toBeNull();
  });
});
