import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useScanDialogFollowsWorkspace } from './useScanDialogFollowsWorkspace';

describe('useScanDialogFollowsWorkspace', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('keeps the dialog while the workspace shows, and closes it once it stops', () => {
    useDesignerStore.getState().openScanDialog('header');
    const { rerender } = renderHook(({ shown }) => useScanDialogFollowsWorkspace(shown, false), {
      initialProps: { shown: true },
    });
    expect(useDesignerStore.getState().ui.scanDialogSource).toBe('header');

    rerender({ shown: false });
    expect(useDesignerStore.getState().ui.scanDialogSource).toBeNull();
  });

  it('closes the phone flow once the window widens past it', () => {
    useDesignerStore.getState().openPhoneScan('card');
    const { rerender } = renderHook(({ phone }) => useScanDialogFollowsWorkspace(false, phone), {
      initialProps: { phone: true },
    });
    expect(useDesignerStore.getState().ui.phoneScanSource).toBe('card');

    rerender({ phone: false });
    expect(useDesignerStore.getState().ui.phoneScanSource).toBeNull();
  });

  it('closes the dialog and the phone flow when the designer is left', () => {
    useDesignerStore.getState().openScanDialog('palette', true);
    useDesignerStore.getState().openPhoneScan('card');
    const { unmount } = renderHook(() => useScanDialogFollowsWorkspace(true, true));
    unmount();
    expect(useDesignerStore.getState().ui.scanDialogSource).toBeNull();
    expect(useDesignerStore.getState().ui.growBinForScan).toBe(false);
    expect(useDesignerStore.getState().ui.phoneScanSource).toBeNull();
  });

  it('closes the tool set dialog with the workspace, and when the designer is left', () => {
    useDesignerStore.getState().openToolSetDialog(null);
    const { rerender, unmount } = renderHook(
      ({ shown }) => useScanDialogFollowsWorkspace(shown, false),
      { initialProps: { shown: true } }
    );
    expect(useDesignerStore.getState().ui.toolSetDialog).toEqual({ setId: null });
    rerender({ shown: false });
    expect(useDesignerStore.getState().ui.toolSetDialog).toBeNull();

    rerender({ shown: true });
    act(() => useDesignerStore.getState().openToolSetDialog('g1'));
    expect(useDesignerStore.getState().ui.toolSetDialog).toEqual({ setId: 'g1' });
    unmount();
    expect(useDesignerStore.getState().ui.toolSetDialog).toBeNull();
  });
});
