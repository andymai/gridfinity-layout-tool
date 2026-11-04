import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { canStartScan, startScan } from './startScan';

describe('startScan', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('switches a divided bin to Custom Cutouts and opens the editor with scanning up', () => {
    const before = useDesignerStore.getState();
    expect(before.params.style).not.toBe('solid');
    const undoDepth = before.history.past.length;

    startScan('interior_link');

    const s = useDesignerStore.getState();
    expect(s.params.style).toBe('solid');
    expect(s.params.base.solid).toBe(true);
    expect(s.ui.interiorCard).toBe('solid');
    expect(s.ui.cutoutEditorOpen).toBe(true);
    expect(s.ui.cutoutTarget).toBe('bin');
    expect(s.ui.scanDialogSource).toBe('interior_link');
    expect(s.history.past.length).toBe(undoDepth + 1);
  });

  it('leaves a Custom Cutouts bin as it is', () => {
    startScan('card');
    const params = useDesignerStore.getState().params;
    const undoDepth = useDesignerStore.getState().history.past.length;

    startScan('card');

    expect(useDesignerStore.getState().params).toBe(params);
    expect(useDesignerStore.getState().history.past.length).toBe(undoDepth);
  });
});

describe('canStartScan', () => {
  it('is true for a default bin, which switches to Custom Cutouts cleanly', () => {
    expect(canStartScan(DEFAULT_BIN_PARAMS)).toBe(true);
  });

  it('is false when an interior lightweight floor rules cutouts out', () => {
    expect(
      canStartScan({
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true, lightweightMode: 'interior' },
      })
    ).toBe(false);
  });
});

describe('scan dialog state', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('closes with the editor, and with a switch to the bento workspace', () => {
    const s = useDesignerStore.getState();
    s.openScanDialog('header');
    s.setCutoutEditorOpen(false);
    expect(useDesignerStore.getState().ui.scanDialogSource).toBeNull();

    s.openScanDialog('header');
    s.setBentoWorkspaceOpen(true);
    expect(useDesignerStore.getState().ui.scanDialogSource).toBeNull();
    expect(useDesignerStore.getState().ui.cutoutEditorOpen).toBe(false);
  });

  it('opens on the bin even when the editor was on the lid', () => {
    const s = useDesignerStore.getState();
    s.setCutoutEditorOpen(true, 'lid');
    s.openScanDialog('toolbar');
    expect(useDesignerStore.getState().ui.cutoutTarget).toBe('bin');
    s.closeScanDialog();
    expect(useDesignerStore.getState().ui.scanDialogSource).toBeNull();
    expect(useDesignerStore.getState().ui.cutoutEditorOpen).toBe(true);
  });
});
