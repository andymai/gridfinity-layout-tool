import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SnapshotEntry } from './SnapshotEntry';
import type { Snapshot } from '@/core/types';

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    id: 'layout-1-1000',
    layoutId: 'layout-1',
    timestamp: Date.now() - 120_000,
    preview: {
      drawerWidth: 10,
      drawerDepth: 8,
      drawerHeight: 12,
      binCount: 5,
      layerCount: 2,
    },
    ...overrides,
  };
}

const defaultProps = {
  onRestore: vi.fn(),
  onDelete: vi.fn(),
  onUpdateLabel: vi.fn(),
  isLast: false,
};

describe('SnapshotEntry', () => {
  it('renders snapshot metadata', () => {
    const snapshot = makeSnapshot({ label: 'My Snapshot' });

    render(<SnapshotEntry snapshot={snapshot} {...defaultProps} />);

    expect(screen.getByText('My Snapshot')).toBeInTheDocument();
    expect(screen.getByText(/5 bins/)).toBeInTheDocument();
    expect(screen.getByText(/2 layers/)).toBeInTheDocument();
  });

  it('shows auto-saved label when no user label', () => {
    const snapshot = makeSnapshot({ label: undefined });

    render(<SnapshotEntry snapshot={snapshot} {...defaultProps} />);

    expect(screen.getByText('Auto-saved')).toBeInTheDocument();
  });

  it('calls onRestore when restore button clicked', () => {
    const onRestore = vi.fn();
    const snapshot = makeSnapshot();

    render(<SnapshotEntry snapshot={snapshot} {...defaultProps} onRestore={onRestore} />);

    fireEvent.click(screen.getByRole('button', { name: /restore/i }));
    expect(onRestore).toHaveBeenCalledWith('layout-1-1000');
  });

  it('calls onDelete when trash button clicked', () => {
    const onDelete = vi.fn();
    const snapshot = makeSnapshot();

    render(<SnapshotEntry snapshot={snapshot} {...defaultProps} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith('layout-1-1000');
  });

  it('enters edit mode when label clicked', () => {
    const snapshot = makeSnapshot({ label: 'Old Label' });

    render(<SnapshotEntry snapshot={snapshot} {...defaultProps} />);

    fireEvent.click(screen.getByText('Old Label'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders timeline connector line when not last', () => {
    const snapshot = makeSnapshot();

    const { container } = render(
      <SnapshotEntry snapshot={snapshot} {...defaultProps} isLast={false} />
    );

    // Timeline dot always present
    expect(container.querySelector('.rounded-full')).toBeInTheDocument();
    // Timeline line present when not last
    expect(container.querySelector('.bg-stroke-subtle')).toBeInTheDocument();
  });

  it('hides timeline line when isLast', () => {
    const snapshot = makeSnapshot();

    const { container } = render(
      <SnapshotEntry snapshot={snapshot} {...defaultProps} isLast={true} />
    );

    // Timeline dot present
    expect(container.querySelector('.rounded-full')).toBeInTheDocument();
    // Timeline line hidden
    expect(container.querySelector('.bg-stroke-subtle')).not.toBeInTheDocument();
  });
});
