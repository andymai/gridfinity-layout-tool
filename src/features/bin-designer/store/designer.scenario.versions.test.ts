import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { DesignVersionContent } from '@/features/bin-designer/types';

describe('DesignerStore - restoreVersion', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  function versionOf(width: number, name = 'Router Bit Holder'): DesignVersionContent {
    const { params } = useDesignerStore.getState();
    return { name, params: { ...params, width } };
  }

  it('replaces params with the stored version', () => {
    const stored = versionOf(4);
    useDesignerStore.getState().setParams({ width: 2 });

    useDesignerStore.getState().restoreVersion(stored);

    expect(useDesignerStore.getState().params.width).toBe(4);
  });

  it('restores the design name the version was saved under', () => {
    const stored = versionOf(3, 'Named At Capture');
    useDesignerStore.getState().setDesignName('Renamed Since');

    useDesignerStore.getState().restoreVersion(stored);

    expect(useDesignerStore.getState().designName).toBe('Named At Capture');
  });

  // A restore that cannot be undone is the one edit in the designer that
  // silently destroys work.
  it('is reversible with a single undo', () => {
    useDesignerStore.getState().setParams({ width: 5 });
    const stored = versionOf(1);

    useDesignerStore.getState().restoreVersion(stored);
    expect(useDesignerStore.getState().params.width).toBe(1);

    useDesignerStore.getState().undo();
    expect(useDesignerStore.getState().params.width).toBe(5);
  });

  // loadDesign clears history because it switches designs; a restore stays
  // within one design and must not.
  it('keeps the undo history that preceded it', () => {
    useDesignerStore.getState().setParams({ width: 3 });
    useDesignerStore.getState().setParams({ width: 4 });
    const before = useDesignerStore.getState().history.past.length;

    useDesignerStore.getState().restoreVersion(versionOf(9));

    expect(useDesignerStore.getState().history.past.length).toBe(before + 1);
  });

  it('leaves the open design id alone', () => {
    useDesignerStore.getState().setCurrentDesignId('design_abc');

    useDesignerStore.getState().restoreVersion(versionOf(2));

    expect(useDesignerStore.getState().currentDesignId).toBe('design_abc');
  });

  // The preview is keyed on the epoch; without a bump it keeps rendering the
  // params the restore just replaced.
  it('bumps the generation epoch so the preview rebuilds', () => {
    const before = useDesignerStore.getState().generation.epoch;

    useDesignerStore.getState().restoreVersion(versionOf(2));

    expect(useDesignerStore.getState().generation.epoch).toBeGreaterThan(before);
  });

  it('flags the thumbnail as stale', () => {
    useDesignerStore.getState().setNeedsThumbnailUpdate(false);

    useDesignerStore.getState().restoreVersion(versionOf(2));

    expect(useDesignerStore.getState().needsThumbnailUpdate).toBe(true);
  });

  // A half-grid design opened into a 1u UI cannot represent its own state.
  it('derives half-grid mode from the restored params', () => {
    const stored = versionOf(2.5);

    useDesignerStore.getState().restoreVersion(stored);

    expect(useDesignerStore.getState().ui.halfGridMode).toBe(true);
  });
});
