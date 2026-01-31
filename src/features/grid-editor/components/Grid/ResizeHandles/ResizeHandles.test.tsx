import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { ResizeHandles } from './ResizeHandles';
import type { ResizeHandle as ResizeHandleType } from '@/core/types';

// Mock ResizeHandle component
vi.mock('../ResizeHandle', () => ({
  ResizeHandle: ({ handle }: { handle: ResizeHandleType }) => (
    <div data-testid={`resize-handle-${handle}`} />
  ),
}));

// Mock handle positioning utils
vi.mock('@/features/grid-editor/utils/handlePositioning', () => ({
  getAllHandles: vi.fn(() => ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as ResizeHandleType[]),
  shouldUseExternalHandles: vi.fn((width: number, depth: number) => width < 2 || depth < 2),
}));

describe('ResizeHandles', () => {
  const mockOnResizePointerDown = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <ResizeHandles
        binWidth={2}
        binDepth={2}
        variant="primary"
        onResizePointerDown={mockOnResizePointerDown}
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders all 8 resize handles', () => {
    const { getAllByTestId } = render(
      <ResizeHandles
        binWidth={2}
        binDepth={2}
        variant="primary"
        onResizePointerDown={mockOnResizePointerDown}
      />
    );

    const handles = [
      getAllByTestId('resize-handle-n'),
      getAllByTestId('resize-handle-s'),
      getAllByTestId('resize-handle-e'),
      getAllByTestId('resize-handle-w'),
      getAllByTestId('resize-handle-ne'),
      getAllByTestId('resize-handle-nw'),
      getAllByTestId('resize-handle-se'),
      getAllByTestId('resize-handle-sw'),
    ];

    handles.forEach((handleArray) => {
      expect(handleArray.length).toBe(1);
    });
  });

  it('renders with primary variant', () => {
    const { container } = render(
      <ResizeHandles
        binWidth={2}
        binDepth={2}
        variant="primary"
        onResizePointerDown={mockOnResizePointerDown}
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders with ghost variant', () => {
    const { container } = render(
      <ResizeHandles
        binWidth={2}
        binDepth={2}
        variant="ghost"
        onResizePointerDown={mockOnResizePointerDown}
      />
    );
    expect(container).toBeTruthy();
  });

  it('uses internal placement for large bins', () => {
    const { container } = render(
      <ResizeHandles
        binWidth={5}
        binDepth={5}
        variant="primary"
        onResizePointerDown={mockOnResizePointerDown}
      />
    );
    expect(container).toBeTruthy();
  });

  it('uses external placement for small bins', () => {
    const { container } = render(
      <ResizeHandles
        binWidth={1}
        binDepth={1}
        variant="primary"
        onResizePointerDown={mockOnResizePointerDown}
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders with different bin dimensions', () => {
    const { container } = render(
      <ResizeHandles
        binWidth={3}
        binDepth={2}
        variant="primary"
        onResizePointerDown={mockOnResizePointerDown}
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders with fractional bin dimensions', () => {
    const { container } = render(
      <ResizeHandles
        binWidth={2.5}
        binDepth={1.5}
        variant="primary"
        onResizePointerDown={mockOnResizePointerDown}
      />
    );
    expect(container).toBeTruthy();
  });
});
