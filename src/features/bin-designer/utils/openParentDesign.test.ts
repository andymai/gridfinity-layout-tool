import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok } from '@/core/result';
import { designId } from '@/core/types';
import * as DesignerStorage from '@/features/bin-designer/storage/DesignerStorage';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  _resetDesignSaveGate,
  registerOpenDesignFlush,
  trackDesignWrite,
} from '@/features/bin-designer/hooks/designSaveGate';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { SavedDesign } from '../types';
import { openParentDesign } from './openParentDesign';

vi.mock('@/features/bin-designer/storage/DesignerStorage');

const parent: SavedDesign = {
  id: designId('parent'),
  name: 'Parent',
  params: { ...DEFAULT_BIN_PARAMS, width: 3 },
  thumbnail: null,
  exportFileNameConfig: null,
  createdAt: '2026-01-22T00:00:00.000Z',
  updatedAt: '2026-01-22T00:00:00.000Z',
};

describe('openParentDesign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetDesignSaveGate();
    useDesignerStore.setState({ currentDesignId: 'variant' });
    vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(ok(parent));
  });

  it("reads the parent only after the variant's edits have landed", async () => {
    const order: string[] = [];
    let land = (): void => {};
    trackDesignWrite(
      new Promise<boolean>((resolve) => {
        land = () => {
          order.push('landed');
          resolve(true);
        };
      })
    );
    vi.mocked(DesignerStorage.loadDesign).mockImplementation(() => {
      order.push('read');
      return Promise.resolve(ok(parent));
    });

    const opening = openParentDesign(designId('parent'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual([]);
    land();
    await opening;

    expect(order).toEqual(['landed', 'read']);
    expect(useDesignerStore.getState().currentDesignId).toBe('parent');
  });

  it('drops the parent when another design opened while the saves landed', async () => {
    let land = (): void => {};
    trackDesignWrite(
      new Promise<boolean>((resolve) => {
        land = () => resolve(true);
      })
    );

    const opening = openParentDesign(designId('parent'));
    useDesignerStore.setState({ currentDesignId: 'elsewhere' });
    land();
    await opening;

    expect(DesignerStorage.loadDesign).not.toHaveBeenCalled();
    expect(useDesignerStore.getState().currentDesignId).toBe('elsewhere');
  });

  it('stays on the variant when its edits could not be saved', async () => {
    registerOpenDesignFlush(() => {
      trackDesignWrite(Promise.resolve(false));
    });

    await openParentDesign(designId('parent'));

    expect(DesignerStorage.loadDesign).not.toHaveBeenCalled();
    expect(useDesignerStore.getState().currentDesignId).toBe('variant');
  });
});
