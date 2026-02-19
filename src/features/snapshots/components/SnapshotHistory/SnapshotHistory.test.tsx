import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SnapshotHistory } from './SnapshotHistory';
import { useSnapshotStore } from '@/core/store/snapshots';
import { useLayoutStore } from '@/core/store/layout';
import { useToastStore } from '@/core/store/toast';
import { resetAllStores, createTestLayout } from '@/test/testUtils';
import { layoutId } from '@/core/types';
import type { Snapshot } from '@/core/types';

// Mock SnapshotService to prevent real IndexedDB calls
vi.mock('@/core/storage/SnapshotService');

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    id: 'layout-1-1000',
    layoutId: 'layout-1',
    timestamp: Date.now() - 120_000, // 2 min ago
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

describe('SnapshotHistory', () => {
  let addSnapshotSpy: ReturnType<typeof vi.fn>;
  let softRemoveSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetAllStores();
    useLayoutStore.setState({
      layout: createTestLayout({
        bins: [
          {
            id: 'bin-1' as never,
            x: 0,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            layerId: 'layer1' as never,
            category: 'cat1' as never,
            label: '',
            notes: '',
          },
        ],
      }),
      activeLayoutId: layoutId('layout-1'),
    });

    addSnapshotSpy = vi.fn().mockResolvedValue(undefined);
    softRemoveSpy = vi.fn();

    useSnapshotStore.setState({
      snapshots: [],
      isLoading: false,
      loadForLayout: vi.fn().mockResolvedValue(undefined),
      addSnapshot: addSnapshotSpy,
      removeSnapshot: vi.fn().mockResolvedValue(undefined),
      softRemove: softRemoveSpy,
      reinsert: vi.fn(),
      updateLabel: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('renders empty state when no snapshots', () => {
    render(<SnapshotHistory />);

    expect(screen.getByTestId('snapshot-empty')).toBeInTheDocument();
  });

  it('renders clock icon in empty state', () => {
    render(<SnapshotHistory />);

    const emptyState = screen.getByTestId('snapshot-empty');
    expect(emptyState.querySelector('svg')).toBeInTheDocument();
  });

  it('renders "Create snapshot now" button in empty state for non-empty layout', () => {
    render(<SnapshotHistory />);

    expect(screen.getByTestId('create-snapshot-now')).toBeInTheDocument();
  });

  it('creates snapshot when "Create snapshot now" is clicked', () => {
    render(<SnapshotHistory />);

    fireEvent.click(screen.getByTestId('create-snapshot-now'));

    expect(addSnapshotSpy).toHaveBeenCalledWith(
      'layout-1',
      expect.objectContaining({ bins: expect.any(Array) as unknown })
    );
  });

  it('hides "Create snapshot now" for empty layouts', () => {
    useLayoutStore.setState({ layout: createTestLayout() }); // bins: []

    render(<SnapshotHistory />);

    expect(screen.queryByTestId('create-snapshot-now')).not.toBeInTheDocument();
  });

  it('renders snapshot entries when snapshots exist', () => {
    useSnapshotStore.setState({
      snapshots: [
        makeSnapshot({ id: 'layout-1-2000', timestamp: Date.now() - 60_000 }),
        makeSnapshot({ id: 'layout-1-1000', timestamp: Date.now() - 120_000 }),
      ],
    });

    render(<SnapshotHistory />);

    expect(screen.getByTestId('snapshot-history')).toBeInTheDocument();
    expect(screen.getAllByTestId('snapshot-entry')).toHaveLength(2);
  });

  it('shows "Save checkpoint" button when snapshots exist', () => {
    useSnapshotStore.setState({
      snapshots: [makeSnapshot()],
    });

    render(<SnapshotHistory />);

    expect(screen.getByTestId('save-checkpoint')).toBeInTheDocument();
  });

  it('creates labeled snapshot when "Save checkpoint" is clicked', () => {
    useSnapshotStore.setState({
      snapshots: [makeSnapshot()],
    });

    render(<SnapshotHistory />);

    fireEvent.click(screen.getByTestId('save-checkpoint'));

    expect(addSnapshotSpy).toHaveBeenCalledWith(
      'layout-1',
      expect.any(Object) as unknown,
      expect.any(String) as unknown // label (formatted date)
    );
  });

  it('shows loading spinner when loading', () => {
    useSnapshotStore.setState({ isLoading: true });

    render(<SnapshotHistory />);

    expect(screen.queryByTestId('snapshot-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('snapshot-history')).not.toBeInTheDocument();
  });

  it('loads snapshots for active layout on mount', () => {
    const loadForLayout = vi.fn().mockResolvedValue(undefined);
    useSnapshotStore.setState({ loadForLayout });

    render(<SnapshotHistory />);

    expect(loadForLayout).toHaveBeenCalledWith('layout-1');
  });

  it('soft-removes snapshot from UI when delete is triggered', () => {
    useSnapshotStore.setState({
      snapshots: [makeSnapshot({ id: 'layout-1-1000' })],
    });

    render(<SnapshotHistory />);

    const entry = screen.getByTestId('snapshot-entry');
    fireEvent.click(within(entry).getByRole('button', { name: /delete/i }));

    expect(softRemoveSpy).toHaveBeenCalledWith('layout-1-1000');
  });

  it('shows undo toast when snapshot is deleted', () => {
    useSnapshotStore.setState({
      snapshots: [makeSnapshot({ id: 'layout-1-1000' })],
    });

    render(<SnapshotHistory />);

    const entry = screen.getByTestId('snapshot-entry');
    fireEvent.click(within(entry).getByRole('button', { name: /delete/i }));

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].action?.label).toBe('Undo');
  });
});
