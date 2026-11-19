import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBinResizedListener } from './useBinResizedListener';
import { useLinkingStore } from '../store';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { emitSyncEvent, onSyncEvent } from '@/shared/events/syncEventBus';
import type { DesignSavedEvent } from '@/shared/events/syncEventBus';
import * as MutationsContext from '@/shared/contexts/MutationsContext';
import * as UseCustomBins from '@/features/bin-designer/hooks/useCustomBins';
import { binId, designId, gridUnits, heightUnits } from '@/core/types';
import { ok } from '@/core/result';
import { useLayoutStore, useToastStore } from '@/core/store';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { registerLinkedSlantResolver } from '@/shared/utils/placedSlant';
import { loadDesign, saveDesign, updateDesignParams } from '@/features/bin-designer/storage';
import { err } from '@/core/result';
import { loadRegistry, upsertRegistryEntry } from '@/features/bin-designer/store/customBinRegistry';
import type * as StorageModule from '@/features/bin-designer/storage';
import { commandBus, createCqrsMutations } from '@/core/cqrs';
import { STAGING_ID } from '@/core/constants';
import type { LinkedSlantFacts } from '@/shared/utils/placedSlant';

vi.mock('@/shared/contexts/MutationsContext', () => ({
  useMutations: vi.fn(),
}));

vi.mock('@/features/bin-designer/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof StorageModule>()),
  loadDesign: vi.fn(),
  saveDesign: vi.fn(),
  updateDesignParams: vi.fn(),
}));

vi.mock('@/features/bin-designer/hooks/useCustomBins', () => ({
  useCustomBins: vi.fn(),
}));

const DESIGN = designId('design-1');

describe('useBinResizedListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(MutationsContext.useMutations).mockReturnValue({ updateBin: vi.fn() } as never);
    vi.mocked(UseCustomBins.useCustomBins).mockReturnValue([
      { id: DESIGN, name: 'Drawer Bin', width: 2, depth: 2, height: 4, updatedAt: '' },
    ]);
    useLinkingStore.setState({ pendingDesignerUpdated: null });
    useDesignerStore.setState({ currentDesignId: DESIGN, params: { ...DEFAULT_BIN_PARAMS } });
  });

  it('keeps the resized bin with the notice, so Edit Design opens on that placement', () => {
    const { unmount } = renderHook(() => useBinResizedListener());

    emitSyncEvent({
      type: 'bin-resized',
      binId: binId('bin-7'),
      linkedDesignId: DESIGN,
      newDimensions: { width: 3, depth: 2, height: 4 },
      previousDimensions: { width: 2, depth: 2, height: 4 },
    });

    expect(useLinkingStore.getState().pendingDesignerUpdated).toEqual({
      binId: 'bin-7',
      designId: DESIGN,
      designName: 'Drawer Bin',
    });
    unmount();
  });

  it.each([
    ['in storage', null],
    ['open in the designer', DESIGN],
  ])(
    "refuses the resize of a design %s when a sibling's support would not fit",
    async (_where, open) => {
      const setParams = vi.fn();
      useToastStore.setState({ toasts: [] });
      useDesignerStore.setState({ currentDesignId: open, setParams });
      vi.mocked(loadDesign).mockResolvedValue(
        ok({ id: DESIGN, name: 'Pens', params: { ...DEFAULT_BIN_PARAMS } }) as never
      );
      registerLinkedSlantResolver(() => ({
        config: { angleDeg: 45, side: 'back', endSupport: true },
        width: 2,
        depth: 1,
        height: 6,
      }));
      const linked = (id: string, x: number, height: number) =>
        createTestBin({
          id: binId(id),
          x: gridUnits(x),
          width: gridUnits(2),
          height: heightUnits(height),
          linkedDesignId: DESIGN,
        });
      useLayoutStore.setState({
        layout: createTestLayout({
          bins: [
            linked('bin-7', 0, 12),
            linked('sibling', 3, 6),
            createTestBin({
              id: binId('behind'),
              x: gridUnits(3),
              y: gridUnits(2),
              width: gridUnits(2),
            }),
          ],
        }),
      });
      const { unmount } = renderHook(() => useBinResizedListener());

      emitSyncEvent({
        type: 'bin-resized',
        binId: binId('bin-7'),
        linkedDesignId: DESIGN,
        newDimensions: { width: 2, depth: 1, height: 12 },
        previousDimensions: { width: 2, depth: 2, height: 4 },
      });

      await vi.waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
      expect(updateDesignParams).not.toHaveBeenCalled();
      expect(setParams).not.toHaveBeenCalled();
      registerLinkedSlantResolver(null);
      unmount();
    }
  );

  it.each([
    ['puts the design back', true],
    ['registers the stored size when putting it back fails', false],
  ])(
    'checks again once the design has saved, and %s if a bin took the cells meanwhile',
    async (_what, restores) => {
      useDesignerStore.setState({ currentDesignId: null });
      useToastStore.setState({ toasts: [] });
      localStorage.clear();
      upsertRegistryEntry({
        id: DESIGN,
        name: 'Pens',
        width: 2,
        depth: 1,
        height: 6,
        updatedAt: 'then',
      });
      registerLinkedSlantResolver(() => ({
        config: { angleDeg: 45, side: 'back', endSupport: true },
        width: 2,
        depth: 1,
        height: 6,
      }));
      const params = { ...DEFAULT_BIN_PARAMS };
      vi.mocked(loadDesign).mockResolvedValue(
        ok({ id: DESIGN, name: 'Pens', updatedAt: 'then', params }) as never
      );
      let finishSave: (result: unknown) => void = () => undefined;
      vi.mocked(updateDesignParams)
        .mockReturnValueOnce(
          new Promise((resolve) => {
            finishSave = resolve;
          }) as never
        )
        .mockResolvedValue(
          (restores
            ? ok({ id: DESIGN, name: 'Pens', updatedAt: 'now' })
            : err({ code: 'STORAGE_WRITE_FAILED', message: 'full' })) as never
        );
      const resizedBin = createTestBin({
        id: binId('bin-7'),
        width: gridUnits(2),
        height: heightUnits(12),
        linkedDesignId: DESIGN,
      });
      useLayoutStore.setState({ layout: createTestLayout({ bins: [resizedBin] }) });
      const { unmount } = renderHook(() => useBinResizedListener());

      emitSyncEvent({
        type: 'bin-resized',
        binId: binId('bin-7'),
        linkedDesignId: DESIGN,
        newDimensions: { width: 2, depth: 1, height: 12 },
        previousDimensions: { width: 2, depth: 2, height: 4 },
      });

      await vi.waitFor(() => expect(updateDesignParams).toHaveBeenCalledTimes(1));
      const late = createTestBin({ id: binId('late'), y: gridUnits(2), width: gridUnits(2) });
      useLayoutStore.setState({ layout: createTestLayout({ bins: [resizedBin, late] }) });
      finishSave(ok({ id: DESIGN, name: 'Pens', updatedAt: 'now' }));

      await vi.waitFor(() => expect(updateDesignParams).toHaveBeenCalledTimes(2));
      expect(vi.mocked(updateDesignParams).mock.calls[1][1]).toBe(params);
      await vi.waitFor(() =>
        expect(loadRegistry()[0]).toMatchObject(
          restores ? { height: 6, updatedAt: 'then' } : { height: 12, updatedAt: 'now' }
        )
      );
      await vi.waitFor(() =>
        expect(useToastStore.getState().toasts).toHaveLength(restores ? 1 : 2)
      );
      registerLinkedSlantResolver(null);
      unmount();
    }
  );

  describe('the cascade to siblings', () => {
    const BACK = { angleDeg: 45, side: 'back' as const, endSupport: true };
    let facts: LinkedSlantFacts = {};
    const linked = (id: string, x: number, y: number, width: number, depth: number) =>
      createTestBin({
        id: binId(id),
        x: gridUnits(x),
        y: gridUnits(y),
        width: gridUnits(width),
        depth: gridUnits(depth),
        height: heightUnits(6),
        linkedDesignId: DESIGN,
      });
    const bin = (id: string) => useLayoutStore.getState().layout.bins.find((b) => b.id === id);

    // Made 1x3, `ahead` would stand its support on the cell `behind` covers
    // until `behind` has narrowed too; the layout lists `ahead` first.
    beforeEach(() => {
      useDesignerStore.setState({ currentDesignId: null });
      useToastStore.setState({ toasts: [] });
      localStorage.clear();
      facts = { config: BACK, width: 2, depth: 1, height: 6 };
      registerLinkedSlantResolver(() => facts);
      vi.mocked(loadDesign).mockResolvedValue(
        ok({
          id: DESIGN,
          name: 'Pens',
          updatedAt: 'then',
          params: { ...DEFAULT_BIN_PARAMS },
        }) as never
      );
      vi.mocked(updateDesignParams).mockImplementation(async () => {
        facts = { config: BACK, width: 1, depth: 3, height: 6 };
        return ok({ id: DESIGN, name: 'Pens', updatedAt: 'now' }) as never;
      });
      useLayoutStore.setState({
        layout: createTestLayout({
          drawer: { width: gridUnits(8), depth: gridUnits(8), height: heightUnits(20) },
          bins: [
            linked('resized', 6, 0, 1, 3),
            linked('ahead', 1, 0, 2, 1),
            linked('behind', 0, 3, 2, 1),
            // Placement ignores the stash, so ordering must too.
            { ...linked('stashed', 0, 2, 2, 1), layerId: STAGING_ID },
          ],
        }),
      });
    });

    const resize = (): void =>
      emitSyncEvent({
        type: 'bin-resized',
        binId: binId('resized'),
        linkedDesignId: DESIGN,
        newDimensions: { width: 1, depth: 3, height: 6 },
        previousDimensions: { width: 2, depth: 2, height: 4 },
      });

    it('resizes every sibling, in an order where none waits on another', async () => {
      vi.mocked(MutationsContext.useMutations).mockReturnValue(createCqrsMutations(commandBus));
      const { unmount } = renderHook(() => useBinResizedListener());

      resize();

      await vi.waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
      expect(useToastStore.getState().toasts[0].type).toBe('success');
      for (const id of ['ahead', 'behind', 'stashed'])
        expect(bin(id)).toMatchObject({ width: 1, depth: 3 });
      registerLinkedSlantResolver(null);
      unmount();
    });

    it('says which siblings kept their size instead of reporting success', async () => {
      const updateBin = vi.fn((id: string) =>
        id === 'ahead'
          ? err({ code: 'VALIDATION_COLLISION', message: 'taken' } as never)
          : ok(undefined)
      );
      vi.mocked(MutationsContext.useMutations).mockReturnValue({ updateBin } as never);
      const { unmount } = renderHook(() => useBinResizedListener());

      resize();

      await vi.waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
      const [toast] = useToastStore.getState().toasts;
      expect(toast.type).toBe('info');
      expect(toast.message).toBe(
        'Updated design and 2 linked bins. 1 bin kept its old size because there was no room'
      );
      const order = updateBin.mock.calls.map(([id]) => id);
      expect(order.indexOf('behind')).toBeLessThan(order.indexOf('ahead'));
      registerLinkedSlantResolver(null);
      unmount();
    });
  });

  describe('an imported model', () => {
    const IMPORTED = designId('imported-1');
    const envelope = { width: 2, depth: 2, gridUnitMm: 42 };
    const structure = { kind: 'importedMesh' as const, heightUnits: 4 };

    beforeEach(() => {
      useDesignerStore.setState({ currentDesignId: null });
      useToastStore.setState({ toasts: [] });
      localStorage.clear();
      vi.mocked(UseCustomBins.useCustomBins).mockReturnValue([
        {
          id: IMPORTED,
          name: 'Scanned tray',
          width: 2,
          depth: 2,
          height: 4,
          kind: 'importedMesh',
          updatedAt: '',
        },
      ]);
      vi.mocked(loadDesign).mockResolvedValue(
        ok({
          id: IMPORTED,
          name: 'Scanned tray',
          updatedAt: 'then',
          kind: 'importedMesh',
          envelope,
          structure,
        }) as never
      );
      vi.mocked(saveDesign).mockImplementation(
        async (design) => ok({ ...design, updatedAt: 'now' }) as never
      );
    });

    it('keeps the new size as the design footprint, so the layout does not size it back', async () => {
      const saved: DesignSavedEvent[] = [];
      const off = onSyncEvent<DesignSavedEvent>('design-saved', (e) => saved.push(e));
      const { unmount } = renderHook(() => useBinResizedListener());

      emitSyncEvent({
        type: 'bin-resized',
        binId: binId('bin-1'),
        linkedDesignId: IMPORTED,
        newDimensions: { width: 3, depth: 2, height: 5 },
        previousDimensions: { width: 2, depth: 2, height: 4 },
      });

      await vi.waitFor(() => expect(saved).toHaveLength(1));
      expect(vi.mocked(saveDesign).mock.calls[0][0]).toMatchObject({
        envelope: { ...envelope, width: 3, depth: 2 },
        structure: { ...structure, heightUnits: 5 },
      });
      expect(updateDesignParams).not.toHaveBeenCalled();
      expect(loadRegistry().find((r) => r.id === IMPORTED)).toMatchObject({
        width: 3,
        depth: 2,
        height: 5,
        kind: 'importedMesh',
      });
      expect(saved[0]).toMatchObject({
        designId: IMPORTED,
        dimensions: { width: 3, depth: 2, height: 5 },
      });
      off();
      unmount();
    });

    const savedEvents = (): { events: DesignSavedEvent[]; off: () => void } => {
      const events: DesignSavedEvent[] = [];
      const off = onSyncEvent<DesignSavedEvent>('design-saved', (e) => events.push(e));
      return { events, off };
    };

    it('keeps a quarter-turned placement turned, in the design axes', async () => {
      vi.mocked(loadDesign).mockResolvedValue(
        ok({
          id: IMPORTED,
          name: 'Scanned tray',
          updatedAt: 'then',
          kind: 'importedMesh',
          envelope: { ...envelope, width: 2, depth: 3 },
          structure,
        }) as never
      );
      const { events, off } = savedEvents();
      const { unmount } = renderHook(() => useBinResizedListener());

      emitSyncEvent({
        type: 'bin-resized',
        binId: binId('bin-1'),
        linkedDesignId: IMPORTED,
        newDimensions: { width: 3, depth: 2, height: 6 },
        previousDimensions: { width: 3, depth: 2, height: 4 },
      });

      await vi.waitFor(() => expect(events).toHaveLength(1));
      expect(vi.mocked(saveDesign).mock.calls[0][0]).toMatchObject({
        envelope: { width: 2, depth: 3 },
        structure: { heightUnits: 6 },
      });
      expect(events[0].dimensions).toEqual({ width: 2, depth: 3, height: 6 });
      off();
      unmount();
    });

    it('keeps the footprint within the limits that sync accepts', async () => {
      const { events, off } = savedEvents();
      const { unmount } = renderHook(() => useBinResizedListener());

      emitSyncEvent({
        type: 'bin-resized',
        binId: binId('bin-1'),
        linkedDesignId: IMPORTED,
        newDimensions: { width: 20, depth: 2, height: 4 },
        previousDimensions: { width: 2, depth: 2, height: 4 },
      });

      await vi.waitFor(() => expect(events).toHaveLength(1));
      expect(events[0].dimensions).toEqual({ width: 16, depth: 2, height: 4 });
      off();
      unmount();
    });

    it('saves a resize that lands during a save, and announces only the newest', async () => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      vi.mocked(saveDesign).mockImplementationOnce(async (design) => {
        await gate;
        return ok({ ...design, updatedAt: 'now' }) as never;
      });
      const { events, off } = savedEvents();
      const { unmount } = renderHook(() => useBinResizedListener());
      const resize = (width: number, from: number): void =>
        emitSyncEvent({
          type: 'bin-resized',
          binId: binId('bin-1'),
          linkedDesignId: IMPORTED,
          newDimensions: { width, depth: 2, height: 4 },
          previousDimensions: { width: from, depth: 2, height: 4 },
        });

      resize(3, 2);
      await vi.waitFor(() => expect(saveDesign).toHaveBeenCalledTimes(1));
      resize(4, 3);
      release();

      await vi.waitFor(() => expect(events).toHaveLength(1));
      expect(saveDesign).toHaveBeenCalledTimes(2);
      expect(events[0].dimensions).toEqual({ width: 4, depth: 2, height: 4 });
      expect(loadRegistry().find((r) => r.id === IMPORTED)?.width).toBe(4);
      off();
      unmount();
    });

    it('keeps a turned placement turned across resizes that wait for a save', async () => {
      // Storage that remembers each write, so every load sees the one before.
      let stored = {
        id: IMPORTED,
        name: 'Scanned tray',
        updatedAt: 'then',
        kind: 'importedMesh',
        envelope: { ...envelope, width: 2, depth: 3 },
        structure,
      };
      vi.mocked(loadDesign).mockImplementation(async () => ok(stored) as never);
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let first = true;
      vi.mocked(saveDesign).mockImplementation(async (design) => {
        if (first) {
          first = false;
          await gate;
        }
        stored = { ...(design as unknown as typeof stored), updatedAt: 'now' };
        return ok(stored) as never;
      });
      const { events, off } = savedEvents();
      const { unmount } = renderHook(() => useBinResizedListener());
      const resize = (width: number, from: number): void =>
        emitSyncEvent({
          type: 'bin-resized',
          binId: binId('bin-1'),
          linkedDesignId: IMPORTED,
          newDimensions: { width, depth: 2, height: 4 },
          previousDimensions: { width: from, depth: 2, height: 4 },
        });

      resize(4, 3);
      await vi.waitFor(() => expect(saveDesign).toHaveBeenCalledTimes(1));
      resize(5, 4);
      resize(6, 5);
      release();

      await vi.waitFor(() => expect(events).toHaveLength(1));
      expect(stored.envelope).toMatchObject({ width: 2, depth: 6 });
      expect(events[0].dimensions).toEqual({ width: 2, depth: 6, height: 4 });
      off();
      unmount();
    });

    it('decides the turn for each bin when two placements wait for one save', async () => {
      let stored = {
        id: IMPORTED,
        name: 'Scanned tray',
        updatedAt: 'then',
        kind: 'importedMesh',
        envelope: { ...envelope, width: 2, depth: 3 },
        structure,
      };
      vi.mocked(loadDesign).mockImplementation(async () => ok(stored) as never);
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let first = true;
      vi.mocked(saveDesign).mockImplementation(async (design) => {
        if (first) {
          first = false;
          await gate;
        }
        stored = { ...(design as unknown as typeof stored), updatedAt: 'now' };
        return ok(stored) as never;
      });
      const { events, off } = savedEvents();
      const { unmount } = renderHook(() => useBinResizedListener());

      emitSyncEvent({
        type: 'bin-resized',
        binId: binId('bin-upright'),
        linkedDesignId: IMPORTED,
        newDimensions: { width: 2, depth: 3, height: 5 },
        previousDimensions: { width: 2, depth: 3, height: 4 },
      });
      await vi.waitFor(() => expect(saveDesign).toHaveBeenCalledTimes(1));
      emitSyncEvent({
        type: 'bin-resized',
        binId: binId('bin-turned'),
        linkedDesignId: IMPORTED,
        newDimensions: { width: 3, depth: 2, height: 6 },
        previousDimensions: { width: 3, depth: 2, height: 4 },
      });
      release();

      await vi.waitFor(() => expect(events).toHaveLength(1));
      expect(stored.envelope).toMatchObject({ width: 2, depth: 3 });
      expect(events[0].dimensions).toEqual({ width: 2, depth: 3, height: 6 });
      off();
      unmount();
    });

    it("decides a waiting sibling's turn against the design as the run found it", async () => {
      let stored = {
        id: IMPORTED,
        name: 'Scanned tray',
        updatedAt: 'then',
        kind: 'importedMesh',
        envelope: { ...envelope, width: 2, depth: 3 },
        structure,
      };
      vi.mocked(loadDesign).mockImplementation(async () => ok(stored) as never);
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const envelopes: { width: number; depth: number }[] = [];
      let first = true;
      vi.mocked(saveDesign).mockImplementation(async (design) => {
        if (first) {
          first = false;
          await gate;
        }
        stored = { ...(design as unknown as typeof stored), updatedAt: 'now' };
        envelopes.push({ width: stored.envelope.width, depth: stored.envelope.depth });
        return ok(stored) as never;
      });
      const { events, off } = savedEvents();
      const { unmount } = renderHook(() => useBinResizedListener());

      emitSyncEvent({
        type: 'bin-resized',
        binId: binId('bin-upright'),
        linkedDesignId: IMPORTED,
        newDimensions: { width: 4, depth: 3, height: 4 },
        previousDimensions: { width: 2, depth: 3, height: 4 },
      });
      await vi.waitFor(() => expect(saveDesign).toHaveBeenCalledTimes(1));
      emitSyncEvent({
        type: 'bin-resized',
        binId: binId('bin-turned'),
        linkedDesignId: IMPORTED,
        newDimensions: { width: 3, depth: 2, height: 6 },
        previousDimensions: { width: 3, depth: 2, height: 4 },
      });
      release();

      await vi.waitFor(() => expect(events).toHaveLength(1));
      expect(envelopes).toEqual([
        { width: 4, depth: 3 },
        { width: 2, depth: 3 },
      ]);
      off();
      unmount();
    });

    it('updates the footprint in the designer too, when the designer holds that model', async () => {
      useDesignerStore.setState({
        currentDesignId: IMPORTED,
        itemKind: 'importedMesh',
        envelope: { ...envelope } as never,
        structure: { ...structure } as never,
      });
      const { unmount } = renderHook(() => useBinResizedListener());

      emitSyncEvent({
        type: 'bin-resized',
        binId: binId('bin-1'),
        linkedDesignId: IMPORTED,
        newDimensions: { width: 3, depth: 3, height: 6 },
        previousDimensions: { width: 2, depth: 2, height: 4 },
      });

      await vi.waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
      const designer = useDesignerStore.getState();
      expect(designer.envelope).toMatchObject({ width: 3, depth: 3 });
      expect(designer.structure).toMatchObject({ heightUnits: 6 });
      expect(useLinkingStore.getState().pendingDesignerUpdated).toBeNull();
      useDesignerStore.setState({ itemKind: 'bin', envelope: null, structure: null });
      unmount();
    });
  });
});
