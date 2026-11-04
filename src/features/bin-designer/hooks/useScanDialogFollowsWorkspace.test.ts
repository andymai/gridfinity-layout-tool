import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useScanDialogFollowsWorkspace } from './useScanDialogFollowsWorkspace';

describe('useScanDialogFollowsWorkspace', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('keeps the dialog while the workspace shows, and closes it once it stops', () => {
    useDesignerStore.getState().openScanDialog('header');
    const { rerender } = renderHook(({ shown }) => useScanDialogFollowsWorkspace(shown), {
      initialProps: { shown: true },
    });
    expect(useDesignerStore.getState().ui.scanDialogSource).toBe('header');

    rerender({ shown: false });
    expect(useDesignerStore.getState().ui.scanDialogSource).toBeNull();
  });

  it('closes the dialog and the phone flow when the designer is left', () => {
    useDesignerStore.getState().openScanDialog('palette', true);
    useDesignerStore.getState().openPhoneScan('card');
    const { unmount } = renderHook(() => useScanDialogFollowsWorkspace(true));
    unmount();
    expect(useDesignerStore.getState().ui.scanDialogSource).toBeNull();
    expect(useDesignerStore.getState().ui.growBinForScan).toBe(false);
    expect(useDesignerStore.getState().ui.phoneScanSource).toBeNull();
  });
});
