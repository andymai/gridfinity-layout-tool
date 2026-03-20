import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CollabCursor } from './CollabCursor';
import type { UserPresence } from '@/liveblocks.config';
import type { InterpolatedPosition } from '@/shared/hooks/useInterpolatedPresence';
import { resetAllStores } from '@/test/testUtils';

describe('CollabCursor', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  const mockPresence: UserPresence = {
    cursor: { x: 0.5, y: 0.5 },
    name: 'Test User',
    color: '#ff0000',
    interaction: { type: 'idle' },
  };

  const mockPosition: InterpolatedPosition = {
    x: 100,
    y: 200,
    opacity: 1,
  };

  it('renders without crashing', () => {
    render(<CollabCursor presence={mockPresence} position={mockPosition} />);
  });

  it('displays user name', () => {
    render(<CollabCursor presence={mockPresence} position={mockPosition} />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('applies correct position transform', () => {
    const { container } = render(<CollabCursor presence={mockPresence} position={mockPosition} />);
    const cursorElement = container.querySelector('[aria-hidden="true"]');
    expect(cursorElement).toHaveStyle({ transform: 'translate(100px, 200px)' });
  });

  it('applies correct color', () => {
    const { container } = render(<CollabCursor presence={mockPresence} position={mockPosition} />);
    const cursorElement = container.querySelector('[aria-hidden="true"]');
    expect(cursorElement).toHaveStyle({ color: '#ff0000' });
  });

  it('applies correct opacity', () => {
    const { container } = render(<CollabCursor presence={mockPresence} position={mockPosition} />);
    const cursorElement = container.querySelector('[aria-hidden="true"]');
    expect(cursorElement).toHaveStyle({ opacity: '1' });
  });

  it('does not show activity text when idle', () => {
    const idlePresence = { ...mockPresence, interaction: { type: 'idle' as const } };
    render(<CollabCursor presence={idlePresence} position={mockPosition} />);
    expect(screen.queryByText(/Drawing|Moving|Resizing|Selecting/)).not.toBeInTheDocument();
  });

  it('shows "Drawing..." when interaction is drawing', () => {
    const drawingPresence: UserPresence = {
      ...mockPresence,
      interaction: { type: 'drawing', start: { x: 0, y: 0 }, current: { x: 1, y: 1 } },
    };
    render(<CollabCursor presence={drawingPresence} position={mockPosition} />);
    expect(screen.getByText('Drawing...')).toBeInTheDocument();
  });

  it('shows "Moving..." when interaction is dragging', () => {
    const draggingPresence: UserPresence = {
      ...mockPresence,
      interaction: { type: 'dragging', binIds: ['bin1'], delta: { x: 1, y: 1 } },
    };
    render(<CollabCursor presence={draggingPresence} position={mockPosition} />);
    expect(screen.getByText('Moving...')).toBeInTheDocument();
  });

  it('shows "Resizing..." when interaction is resizing', () => {
    const resizingPresence: UserPresence = {
      ...mockPresence,
      interaction: { type: 'resizing', binIds: ['bin1'], handle: 'se' },
    };
    render(<CollabCursor presence={resizingPresence} position={mockPosition} />);
    expect(screen.getByText('Resizing...')).toBeInTheDocument();
  });

  it('shows "Selecting..." when interaction is selecting', () => {
    const selectingPresence: UserPresence = {
      ...mockPresence,
      interaction: { type: 'selecting', start: { x: 0, y: 0 }, current: { x: 1, y: 1 } },
    };
    render(<CollabCursor presence={selectingPresence} position={mockPosition} />);
    expect(screen.getByText('Selecting...')).toBeInTheDocument();
  });

  it('renders with partial opacity', () => {
    const fadingPosition: InterpolatedPosition = { x: 100, y: 200, opacity: 0.5 };
    const { container } = render(
      <CollabCursor presence={mockPresence} position={fadingPosition} />
    );
    const cursorElement = container.querySelector('[aria-hidden="true"]');
    expect(cursorElement).toHaveStyle({ opacity: '0.5' });
  });

  it('is aria-hidden for accessibility', () => {
    const { container } = render(<CollabCursor presence={mockPresence} position={mockPosition} />);
    const cursorElement = container.querySelector('[aria-hidden="true"]');
    expect(cursorElement).toBeInTheDocument();
  });
});
