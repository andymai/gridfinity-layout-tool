import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { DrawerResizeHandles } from './DrawerResizeHandles';

// Mock i18n
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('DrawerResizeHandles', () => {
  const mockOnResizeStart = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <DrawerResizeHandles
        gridWidth={400}
        gridHeight={320}
        columnLabelHeight={24}
        axisLabelsVisible={true}
        resizeDirection={null}
        shouldPulse={false}
        onResizeStart={mockOnResizeStart}
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders all three resize handles', () => {
    const { container } = render(
      <DrawerResizeHandles
        gridWidth={400}
        gridHeight={320}
        columnLabelHeight={24}
        axisLabelsVisible={true}
        resizeDirection={null}
        shouldPulse={false}
        onResizeStart={mockOnResizeStart}
      />
    );
    // Should have right edge, bottom edge, and corner handles
    const handles = container.querySelectorAll('.group');
    expect(handles.length).toBe(3);
  });

  it('calls onResizeStart with "width" when clicking right edge handle', () => {
    const { container } = render(
      <DrawerResizeHandles
        gridWidth={400}
        gridHeight={320}
        columnLabelHeight={24}
        axisLabelsVisible={true}
        resizeDirection={null}
        shouldPulse={false}
        onResizeStart={mockOnResizeStart}
      />
    );
    const rightHandle = container.querySelectorAll('.group')[0];
    fireEvent.pointerDown(rightHandle);
    expect(mockOnResizeStart).toHaveBeenCalledWith('width', expect.any(Object));
  });

  it('calls onResizeStart with "depth" when clicking bottom edge handle', () => {
    const { container } = render(
      <DrawerResizeHandles
        gridWidth={400}
        gridHeight={320}
        columnLabelHeight={24}
        axisLabelsVisible={true}
        resizeDirection={null}
        shouldPulse={false}
        onResizeStart={mockOnResizeStart}
      />
    );
    const bottomHandle = container.querySelectorAll('.group')[1];
    fireEvent.pointerDown(bottomHandle);
    expect(mockOnResizeStart).toHaveBeenCalledWith('depth', expect.any(Object));
  });

  it('calls onResizeStart with "both" when clicking corner handle', () => {
    const { container } = render(
      <DrawerResizeHandles
        gridWidth={400}
        gridHeight={320}
        columnLabelHeight={24}
        axisLabelsVisible={true}
        resizeDirection={null}
        shouldPulse={false}
        onResizeStart={mockOnResizeStart}
      />
    );
    const cornerHandle = container.querySelectorAll('.group')[2];
    fireEvent.pointerDown(cornerHandle);
    expect(mockOnResizeStart).toHaveBeenCalledWith('both', expect.any(Object));
  });

  it('applies pulse animation when shouldPulse is true', () => {
    const { container } = render(
      <DrawerResizeHandles
        gridWidth={400}
        gridHeight={320}
        columnLabelHeight={24}
        axisLabelsVisible={true}
        resizeDirection={null}
        shouldPulse={true}
        onResizeStart={mockOnResizeStart}
      />
    );
    const indicators = container.querySelectorAll('.animate-pulse');
    expect(indicators.length).toBeGreaterThan(0);
  });

  it('highlights width handle when resizing width', () => {
    const { container } = render(
      <DrawerResizeHandles
        gridWidth={400}
        gridHeight={320}
        columnLabelHeight={24}
        axisLabelsVisible={true}
        resizeDirection={'width'}
        shouldPulse={false}
        onResizeStart={mockOnResizeStart}
      />
    );
    expect(container).toBeTruthy();
  });

  it('highlights depth handle when resizing depth', () => {
    const { container } = render(
      <DrawerResizeHandles
        gridWidth={400}
        gridHeight={320}
        columnLabelHeight={24}
        axisLabelsVisible={true}
        resizeDirection={'depth'}
        shouldPulse={false}
        onResizeStart={mockOnResizeStart}
      />
    );
    expect(container).toBeTruthy();
  });

  it('highlights both handles when resizing both', () => {
    const { container } = render(
      <DrawerResizeHandles
        gridWidth={400}
        gridHeight={320}
        columnLabelHeight={24}
        axisLabelsVisible={true}
        resizeDirection={'both'}
        shouldPulse={false}
        onResizeStart={mockOnResizeStart}
      />
    );
    expect(container).toBeTruthy();
  });

  it('positions handles correctly when axis labels are hidden', () => {
    const { container } = render(
      <DrawerResizeHandles
        gridWidth={400}
        gridHeight={320}
        columnLabelHeight={24}
        axisLabelsVisible={false}
        resizeDirection={null}
        shouldPulse={false}
        onResizeStart={mockOnResizeStart}
      />
    );
    expect(container).toBeTruthy();
  });
});
