import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RestoreDialog } from './RestoreDialog';
import type { Snapshot } from '@/core/types';

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    id: 'layout-1-1000',
    layoutId: 'layout-1',
    timestamp: Date.now(),
    preview: {
      drawerWidth: 10,
      drawerDepth: 8,
      drawerHeight: 12,
      binCount: 3,
      layerCount: 1,
    },
    ...overrides,
  };
}

describe('RestoreDialog', () => {
  it('renders nothing when snapshot is null', () => {
    const { container } = render(
      <RestoreDialog snapshot={null} onReplace={vi.fn()} onCreateCopy={vi.fn()} onClose={vi.fn()} />
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders dialog with snapshot metadata', () => {
    const snapshot = makeSnapshot({ label: 'Before refactor' });

    render(
      <RestoreDialog
        snapshot={snapshot}
        onReplace={vi.fn()}
        onCreateCopy={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Before refactor')).toBeInTheDocument();
    expect(screen.getByText(/3 bins/)).toBeInTheDocument();
  });

  it('calls onReplace when Restore clicked', () => {
    const onReplace = vi.fn();
    const snapshot = makeSnapshot();

    render(
      <RestoreDialog
        snapshot={snapshot}
        onReplace={onReplace}
        onCreateCopy={vi.fn()}
        onClose={vi.fn()}
      />
    );

    // The dialog has a "Restore" button in the header and footer — we want the footer one
    const buttons = screen.getAllByText('Restore');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onReplace).toHaveBeenCalled();
  });

  it('calls onCreateCopy when Create copy clicked', () => {
    const onCreateCopy = vi.fn();
    const snapshot = makeSnapshot();

    render(
      <RestoreDialog
        snapshot={snapshot}
        onReplace={vi.fn()}
        onCreateCopy={onCreateCopy}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Create as new layout'));
    expect(onCreateCopy).toHaveBeenCalled();
  });
});
