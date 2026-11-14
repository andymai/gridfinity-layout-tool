import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDestinationLabel, useEntryActivation } from './whatsNewShared';
import type { WhatsNewAction, WhatsNewEntry } from '@/features/whats-new';
import { useBinExampleGalleryStore } from '@/core/store/binExampleGallery';
import { useViewStore } from '@/core/store/view';
import { resetAllStores } from '@/test/testUtils';
import { useScanLaunchStore } from '@/core/store/scanLaunch';

function entry(overrides: Partial<WhatsNewEntry> = {}): WhatsNewEntry {
  return { id: 'e', date: '2026-08-24', title: { en: 'An entry' }, ...overrides };
}

function activateWith(subject: WhatsNewEntry): { closed: boolean } {
  const state = { closed: false };
  const { result } = renderHook(() =>
    useEntryActivation(() => {
      state.closed = true;
    })
  );
  act(() => result.current(subject));
  return state;
}

describe('useEntryActivation', () => {
  beforeEach(() => {
    resetAllStores();
    useScanLaunchStore.setState({ request: null });
    window.history.pushState(null, '', '/');
  });

  it('starts a new bin from a scan when opened outside the designer', () => {
    activateWith(entry({ action: { kind: 'scanTool' } }));
    expect(window.location.pathname).toBe('/designer');
    expect(useScanLaunchStore.getState().request).toMatchObject({
      source: 'whats_new',
      newBin: true,
    });
  });

  it('scans into the open bin when opened inside the designer', () => {
    window.history.pushState(null, '', '/designer');
    activateWith(entry({ action: { kind: 'scanTool' } }));
    expect(useScanLaunchStore.getState().request).toMatchObject({ newBin: false });
  });

  it.each([
    ['/designer', { kind: 'openTool', tool: 'designer' }],
    ['/baseplate', { kind: 'openTool', tool: 'baseplate' }],
    ['/', { kind: 'openTool', tool: 'layout' }],
  ] as [string, WhatsNewAction][])('routes %s in-app', (pathname, action) => {
    activateWith(entry({ action }));
    expect(window.location.pathname).toBe(pathname);
  });

  it('opens the baseplate library', () => {
    activateWith(entry({ action: { kind: 'openModal', modal: 'baseplateLibrary' } }));
    expect(useViewStore.getState().showBaseplateLibrary).toBe(true);
  });

  it('opens the print list', () => {
    activateWith(entry({ action: { kind: 'openModal', modal: 'print' } }));
    expect(useViewStore.getState().printModalOpen).toBe(true);
  });

  it('opens the design gallery', () => {
    activateWith(entry({ action: { kind: 'openModal', modal: 'designGallery' } }));
    expect(useBinExampleGalleryStore.getState().isOpen).toBe(true);
  });

  it('sends a Labs entry to the Labs settings tab, ignoring its own action', () => {
    // The feature the entry describes is unreachable until the flag is on, so
    // the switch outranks whatever destination the entry names.
    const opened = vi.fn();
    window.addEventListener('open-settings-modal', opened);
    activateWith(entry({ labs: 'places', action: { kind: 'openTool', tool: 'baseplate' } }));
    window.removeEventListener('open-settings-modal', opened);

    expect((opened.mock.calls[0][0] as CustomEvent).detail).toEqual({ tab: 'labs' });
    expect(window.location.pathname).toBe('/');
  });

  it('closes the modal even when an entry has nowhere to go', () => {
    expect(activateWith(entry()).closed).toBe(true);
  });
});

describe('useDestinationLabel', () => {
  it('has no label for an entry with no destination', () => {
    const { result } = renderHook(() => useDestinationLabel(entry()));
    expect(result.current).toBeNull();
  });

  it('labels a scan entry with the action it takes', () => {
    const { result } = renderHook(() =>
      useDestinationLabel(entry({ action: { kind: 'scanTool' } }))
    );
    expect(result.current).toBe('Scan a tool');
  });

  it('labels a Labs entry for Labs, not for its action', () => {
    const { result } = renderHook(() =>
      useDestinationLabel(entry({ labs: 'places', action: { kind: 'openTool', tool: 'layout' } }))
    );
    expect(result.current).toBe('Open Labs');
  });
});
