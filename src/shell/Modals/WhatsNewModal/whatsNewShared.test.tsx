import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDestinationLabel, useEntryActivation } from './whatsNewShared';
import type { WhatsNewAction, WhatsNewEntry } from '@/features/whats-new';
import { useBinExampleGalleryStore } from '@/core/store/binExampleGallery';
import { useLabsStore } from '@/core/store/labs';
import { useViewStore } from '@/core/store/view';
import { resetAllStores } from '@/test/testUtils';

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
    useLabsStore.setState({ isDrawerOpen: false });
    window.history.pushState(null, '', '/');
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

  it('sends a Labs entry to the drawer, ignoring its own action', () => {
    // The feature the entry describes is unreachable until the flag is on, so
    // the switch outranks whatever destination the entry names.
    activateWith(entry({ labs: 'workshop', action: { kind: 'openTool', tool: 'baseplate' } }));
    expect(useLabsStore.getState().isDrawerOpen).toBe(true);
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

  it('labels a Labs entry for the drawer, not for its action', () => {
    const { result } = renderHook(() =>
      useDestinationLabel(entry({ labs: 'workshop', action: { kind: 'openTool', tool: 'layout' } }))
    );
    expect(result.current).toBe('Open Labs');
  });
});
