import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as i18n from '@/i18n';
import { useLayoutStore, useLibraryStore, useToastStore } from '@/core/store';
import { loadLayoutAsync } from '@/core/storage';
import type * as Storage from '@/core/storage';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { baseplateDesignId, layoutId } from '@/core/types';
import {
  createTestBin,
  createTestLayout,
  createTestLibrary,
  resetAllStores,
} from '@/test/testUtils';
import { useDrawerLinkImport } from './useDrawerLinkImport';

const seeded = vi.hoisted(() => ({ value: false }));
vi.mock('@/core/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof Storage>()),
  wasLibrarySeededThisLoad: () => seeded.value,
}));
import type { DrawerLinkImportOptions } from './useDrawerLinkImport';

const EXISTING = layoutId('existing-layout');

function seed(firstVisit: boolean, bins = 0): void {
  seeded.value = firstVisit;
  useLibraryStore.getState().initLibrary(createTestLibrary(EXISTING));
  const bin = createTestBin();
  useLayoutStore
    .getState()
    .importLayout(createTestLayout({ bins: bins > 0 ? [bin] : [] }), EXISTING, 'init');
}

function open(url: string, options: Partial<DrawerLinkImportOptions> = {}) {
  window.history.replaceState(null, '', url);
  return renderHook(() =>
    useDrawerLinkImport({ disabled: false, syncLayoutUrl: true, ...options })
  );
}

const toasts = () =>
  useToastStore.getState().toasts.map((t) => ({ message: t.message, type: t.type }));

/** The success toast is the hook's last step, after the URL rewrite. */
const opened = () => waitFor(() => expect(toasts().some((t) => t.type === 'success')).toBe(true));

describe('useDrawerLinkImport', () => {
  beforeEach(() => {
    resetAllStores();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('reports no drawer link and leaves everything alone on a plain URL', () => {
    seed(false);
    const { result } = open('/');
    expect(result.current).toBe(false);
    expect(useLibraryStore.getState().library.entries).toHaveLength(1);
  });

  it('opens a new layout sized to the drawer, keeping existing work', async () => {
    seed(false, 1);
    const { result } = open('/?drawer=297x525x60&name=IKEA%20Alex');
    expect(result.current).toBe(true);

    await waitFor(() => expect(useLibraryStore.getState().library.entries).toHaveLength(2));
    await opened();
    const { layout, activeLayoutId } = useLayoutStore.getState();
    expect(activeLayoutId).not.toBe(EXISTING);
    expect(layout.name).toBe('IKEA Alex');
    expect(layout.drawer).toMatchObject({
      width: 7,
      depth: 12,
      measuredMm: { width: 297, depth: 525, height: 60 },
    });
    expect(layout.baseplateParams).toMatchObject({ paddingLeft: 1.5, paddingFront: 10.5 });

    const stored = await loadLayoutAsync(activeLayoutId ?? EXISTING);
    expect(stored?.drawer.measuredMm).toEqual({ width: 297, depth: 525, height: 60 });
    expect(window.location.pathname).toBe(`/l/${activeLayoutId}/ikea-alex`);
    expect(window.location.search).toBe('');
    expect(toasts()).toContainEqual({
      message: 'Layout sized to your drawer: a 7 × 12 grid',
      type: 'success',
    });
  });

  it('sizes the empty layout a first visit seeded instead of adding a second one', async () => {
    seed(true);
    open('/?drawer=297x525');

    await waitFor(() =>
      expect(useLibraryStore.getState().library.entries[0]?.name).toBe('Drawer 297 × 525 mm')
    );
    await opened();
    expect(useLayoutStore.getState().layout.drawer.width).toBe(7);
    const { entries } = useLibraryStore.getState().library;
    expect(entries).toHaveLength(1);
    expect(useLayoutStore.getState().activeLayoutId).toBe(EXISTING);
  });

  it('leaves an empty layout this load did not seed, such as a migrated one, untouched', async () => {
    seed(false);
    open('/?drawer=297x525');

    await waitFor(() => expect(useLibraryStore.getState().library.entries).toHaveLength(2));
    await opened();
    expect(useLibraryStore.getState().library.entries[0]?.name).toBe('Test Layout');
    expect(useLayoutStore.getState().activeLayoutId).not.toBe(EXISTING);
  });

  it('stays on /baseplate and only drops the query when the planner URL is not wanted', async () => {
    seed(false, 1);
    open('/baseplate?drawer=414x318', { syncLayoutUrl: false });

    await waitFor(() => expect(useLibraryStore.getState().library.entries).toHaveLength(2));
    await opened();
    expect(window.location.pathname).toBe('/baseplate');
    expect(window.location.search).toBe('');
  });

  it('warns and changes nothing for a size the planner cannot open', async () => {
    seed(false, 1);
    open('/?drawer=30x525');

    await waitFor(() =>
      expect(toasts()).toContainEqual({
        message: "That drawer link has a size the planner can't open",
        type: 'error',
      })
    );
    expect(useLibraryStore.getState().library.entries).toHaveLength(1);
    expect(window.location.search).toBe('');
  });

  it('warns about a malformed size', () => {
    seed(false, 1);
    open('/?drawer=wide');
    expect(toasts()).toContainEqual({
      message: "That drawer link has a size the planner can't open",
      type: 'error',
    });
  });

  it('waits for translations before naming and opening the layout', async () => {
    seed(false, 1);
    const locale = {
      locale: 'en' as const,
      setLocale: vi.fn(),
      t: (k: string) => k,
      isLoading: false,
    };
    const useLocale = vi.spyOn(i18n, 'useLocale').mockReturnValue({ ...locale, isReady: false });
    const { rerender } = open('/?drawer=297x525');
    expect(useLibraryStore.getState().library.entries).toHaveLength(1);
    expect(window.location.search).toBe('?drawer=297x525');

    useLocale.mockReturnValue({ ...locale, isReady: true });
    rerender();
    await waitFor(() => expect(useLibraryStore.getState().library.entries).toHaveLength(2));
    await opened();
    expect(useLayoutStore.getState().layout.name).toBe('Drawer 297 × 525 mm');
  });

  it('keeps a baseplate design linked before the link applies, and pads it', async () => {
    seed(true);
    const design = baseplateDesignId('design-before');
    useLayoutStore.getState().setActiveBaseplateLocal(design, DEFAULT_BASEPLATE_PARAMS);
    open('/baseplate?drawer=297x525', { syncLayoutUrl: false });

    await waitFor(() =>
      expect(useLibraryStore.getState().library.entries[0]?.name).toBe('Drawer 297 × 525 mm')
    );
    await opened();
    const { layout } = useLayoutStore.getState();
    expect(layout.activeBaseplateId).toBe(design);
    expect(layout.baseplateParams).toMatchObject({ paddingLeft: 1.5, paddingFront: 10.5 });
    expect((await loadLayoutAsync(EXISTING))?.activeBaseplateId).toBe(design);
  });

  it('does not undo a baseplate design the initializer links while the layout saves', async () => {
    seed(true);
    open('/baseplate?drawer=297x525', { syncLayoutUrl: false });

    expect(useLayoutStore.getState().layout.drawer.width).toBe(7);
    const design = baseplateDesignId('design-during');
    const padded = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
    useLayoutStore.getState().setActiveBaseplateLocal(design, padded);

    await waitFor(() =>
      expect(useLibraryStore.getState().library.entries[0]?.name).toBe('Drawer 297 × 525 mm')
    );
    await opened();
    expect(useLayoutStore.getState().layout.activeBaseplateId).toBe(design);
  });

  it('drops a link that arrived while disabled instead of applying it after a route change', async () => {
    seed(false, 1);
    window.history.replaceState(null, '', '/designer?drawer=297x525');
    const { result, rerender } = renderHook(
      ({ disabled }: { disabled: boolean }) =>
        useDrawerLinkImport({ disabled, syncLayoutUrl: true }),
      { initialProps: { disabled: true } }
    );
    window.history.replaceState(null, '', '/');
    rerender({ disabled: false });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toBe(false);
    expect(useLibraryStore.getState().library.entries).toHaveLength(1);
  });

  it('saves the outgoing layout before switching, so an unsaved edit survives', async () => {
    seed(false, 1);
    const edited = { ...useLayoutStore.getState().layout, name: 'Edited, not yet saved' };
    useLayoutStore.getState().importLayout(edited, EXISTING, 'init');
    open('/?drawer=297x525');

    await waitFor(() => expect(useLibraryStore.getState().library.entries).toHaveLength(2));
    await opened();
    expect((await loadLayoutAsync(EXISTING))?.name).toBe('Edited, not yet saved');
  });

  it('yields the URL to a share link or collaboration session', () => {
    seed(false, 1);
    open('/?drawer=297x525', { disabled: true });
    expect(window.location.search).toBe('?drawer=297x525');
    expect(useLibraryStore.getState().library.entries).toHaveLength(1);
  });
});
