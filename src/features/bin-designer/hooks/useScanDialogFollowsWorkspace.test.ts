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
});
