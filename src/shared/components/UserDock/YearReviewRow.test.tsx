// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ok } from '@/core/result';
import type { DesignSummary } from '@/core/storage/designStorePort';
import { useLibraryStore } from '@/core/store/library';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useSyncStatusStore } from '@/core/sync/status';
import { resetAllStores } from '@/test/testUtils';
import { markYearReviewSeen, resetDockRowCache } from '@/shared/yearReview/dockRow';
import { resetYearReviewDesignCheck } from './useYearReviewRow';
import { YearReviewRow } from './YearReviewRow';
import { UserDock } from './UserDock';

const listDesignSummaries = vi.fn();
vi.mock('@/core/storage/designStorePort', () => ({
  getDesignStorePort: () => ({ listDesignSummaries }),
}));
vi.mock('@/core/sync/signOut', () => ({ runSignOut: vi.fn() }));
vi.mock('@/core/sync/adapters/layoutAdapter', () => ({ layoutAdapter: {} }));
vi.mock('@/features/bin-designer/sync/designAdapter', () => ({ designAdapter: {} }));

const IN_WINDOW = new Date(2026, 11, 5, 12);
const BEFORE_WINDOW = new Date(2026, 10, 27, 12);
const IN_2026 = new Date(2026, 4, 2).getTime();

function design(overrides: Partial<DesignSummary> = {}): DesignSummary {
  return {
    id: 'd1' as DesignSummary['id'],
    name: 'Untitled Bin',
    createdAt: new Date(IN_2026).toISOString(),
    updatedAt: new Date(IN_2026).toISOString(),
    thumbnail: null,
    remixed: false,
    untouched: false,
    versionDates: [],
    ...overrides,
  };
}

function setLayout(createdAt: number, bins: number): void {
  useLibraryStore.setState((s) => ({
    library: {
      ...s.library,
      entries: [
        {
          id: 'l1' as never,
          name: 'Drawer',
          createdAt,
          modifiedAt: createdAt,
          preview: {
            drawerWidth: 5 as never,
            drawerDepth: 5 as never,
            drawerHeight: 1 as never,
            binCount: bins,
            layerCount: 1,
            binMap: Array.from({ length: bins }, (_, x) => ({ x, y: 0, w: 1, d: 1 })),
          },
        },
      ],
    },
  }));
}

const row = () => screen.queryByRole('button', { name: 'Your 2026 is ready.' });
const idle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 120));
  });

describe('YearReviewRow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(IN_WINDOW);
    localStorage.clear();
    resetDockRowCache();
    resetYearReviewDesignCheck();
    resetAllStores();
    useSessionStore.setState({ status: 'anonymous', user: null });
    useSyncStatusStore.getState().reset();
    listDesignSummaries.mockReset();
    listDesignSummaries.mockResolvedValue(ok([]));
    setLayout(IN_2026, 0);
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows for a drawer started in 2026 that holds a bin', () => {
    setLayout(IN_2026, 2);
    render(<YearReviewRow />);
    expect(row()).toBeInTheDocument();
  });

  it('stays hidden before the window opens', () => {
    vi.setSystemTime(BEFORE_WINDOW);
    setLayout(IN_2026, 2);
    render(<YearReviewRow />);
    expect(row()).not.toBeInTheDocument();
    expect(listDesignSummaries).not.toHaveBeenCalled();
  });

  it('stays hidden for a fresh library: an empty drawer and the untouched default design', async () => {
    listDesignSummaries.mockResolvedValue(ok([design({ untouched: true })]));
    render(<YearReviewRow />);
    await waitFor(() => expect(listDesignSummaries).toHaveBeenCalled());
    await act(async () => {});
    expect(row()).not.toBeInTheDocument();
  });

  it('does not count a drawer from an earlier year', async () => {
    setLayout(new Date(2025, 5, 1).getTime(), 4);
    render(<YearReviewRow />);
    await waitFor(() => expect(listDesignSummaries).toHaveBeenCalled());
    await act(async () => {});
    expect(row()).not.toBeInTheDocument();
  });

  it('shows for a 2026 design', async () => {
    listDesignSummaries.mockResolvedValue(ok([design()]));
    render(<YearReviewRow />);
    await waitFor(() => expect(row()).toBeInTheDocument());
    expect(listDesignSummaries).toHaveBeenCalledWith({ thumbnails: false });
  });

  it('reads the design store once per page load, however often docks mount', async () => {
    const { unmount } = render(
      <>
        <YearReviewRow />
        <YearReviewRow />
      </>
    );
    await idle();
    unmount();
    render(<YearReviewRow />);
    await idle();
    expect(listDesignSummaries).toHaveBeenCalledTimes(1);
    expect(row()).not.toBeInTheDocument();
  });

  it('waits for the first pull before it reads a signed-in user’s designs', async () => {
    useSessionStore.setState({ status: 'authenticated' });
    useSyncStatusStore.setState({ state: 'syncing' });
    listDesignSummaries.mockResolvedValue(ok([design()]));
    render(<YearReviewRow />);
    await idle();
    expect(listDesignSummaries).not.toHaveBeenCalled();
    act(() => useSyncStatusStore.getState().succeed('pull'));
    await waitFor(() => expect(row()).toBeInTheDocument());
  });

  it('does not take a finished push for the first pull', async () => {
    useSessionStore.setState({ status: 'authenticated' });
    useSyncStatusStore.setState({ state: 'syncing' });
    render(<YearReviewRow />);
    act(() => useSyncStatusStore.getState().succeed());
    await idle();
    listDesignSummaries.mockResolvedValue(ok([design()]));
    act(() => useSyncStatusStore.getState().succeed('pull'));
    await waitFor(() => expect(row()).toBeInTheDocument());
  });

  it('reads again once sync recovers, when the first read ran while sync was down', async () => {
    useSessionStore.setState({ status: 'authenticated' });
    useSyncStatusStore.setState({ state: 'offline' });
    render(<YearReviewRow />);
    await waitFor(() => expect(listDesignSummaries).toHaveBeenCalledTimes(1));
    await idle();
    expect(row()).not.toBeInTheDocument();
    listDesignSummaries.mockResolvedValue(ok([design()]));
    act(() => useSyncStatusStore.getState().succeed('pull'));
    await waitFor(() => expect(row()).toBeInTheDocument());
  });

  it('appears at midnight on 1 December in a tab left open', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2026, 10, 30, 23, 59));
    setLayout(IN_2026, 2);
    render(<YearReviewRow />);
    expect(row()).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2 * 60_000));
    expect(row()).toBeInTheDocument();
  });

  it('checks the date again when a sleeping tab becomes visible', () => {
    vi.setSystemTime(BEFORE_WINDOW);
    setLayout(IN_2026, 2);
    render(<YearReviewRow />);
    expect(row()).not.toBeInTheDocument();
    vi.setSystemTime(IN_WINDOW);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(row()).toBeInTheDocument();
  });

  it('gives both buttons a 44 px target on touch screens', () => {
    setLayout(IN_2026, 1);
    render(<YearReviewRow />);
    expect(row()).toHaveClass('pointer-coarse:min-h-[44px]');
    expect(screen.getByRole('button', { name: 'Hide Your 2026' })).toHaveClass(
      'pointer-coarse:min-h-[44px]',
      'pointer-coarse:min-w-[44px]'
    );
  });

  it('remembers a yes, so the next load needs no check', () => {
    setLayout(IN_2026, 1);
    render(<YearReviewRow />);
    cleanup();
    setLayout(IN_2026, 0);
    resetDockRowCache();
    render(<YearReviewRow />);
    expect(row()).toBeInTheDocument();
    expect(listDesignSummaries).not.toHaveBeenCalled();
  });

  it('opens Your 2026 from the dock and drops the dot', () => {
    setLayout(IN_2026, 1);
    const onOpen = vi.fn();
    render(<YearReviewRow onOpen={onOpen} />);
    expect(screen.getByTestId('year-review-dot')).toHaveClass('bg-accent');
    fireEvent.click(screen.getByRole('button', { name: 'Your 2026 is ready.' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/your-2026');
    expect(window.location.search).toBe('?from=dock');
    expect(screen.getByTestId('year-review-dot')).not.toHaveClass('bg-accent');
  });

  it('drops the dot when the user opened Your 2026 another way', () => {
    setLayout(IN_2026, 1);
    render(<YearReviewRow />);
    act(() => markYearReviewSeen());
    expect(screen.getByTestId('year-review-dot')).not.toHaveClass('bg-accent');
  });

  it('hides for good with the x', () => {
    setLayout(IN_2026, 1);
    render(<YearReviewRow />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide Your 2026' }));
    expect(row()).not.toBeInTheDocument();
    cleanup();
    resetDockRowCache();
    render(<YearReviewRow />);
    expect(row()).not.toBeInTheDocument();
  });

  it('sits above the dock, and not on the collapsed rail', () => {
    setLayout(IN_2026, 1);
    const { unmount } = render(<UserDock />);
    expect(row()).toBeInTheDocument();
    unmount();
    render(<UserDock variant="compact" />);
    expect(row()).not.toBeInTheDocument();
  });
});
