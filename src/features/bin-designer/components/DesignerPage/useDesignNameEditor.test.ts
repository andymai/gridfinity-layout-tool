// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type * as DesignerStorageModule from '@/features/bin-designer/storage/DesignerStorage';

const saveDesignSpy = vi.fn();

vi.mock('@/features/bin-designer/storage/DesignerStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof DesignerStorageModule>();
  return {
    ...actual,
    saveDesign: (...args: Parameters<typeof actual.saveDesign>) => {
      saveDesignSpy(...args);
      return actual.saveDesign(...args);
    },
  };
});

import { useDesignNameEditor } from './useDesignNameEditor';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import {
  closeDesignerDb,
  loadDesign,
  saveDesign,
} from '@/features/bin-designer/storage/DesignerStorage';
import {
  loadRegistry,
  registryAssemblyEntry,
  registryEdgeFields,
  upsertRegistryEntry,
  type CustomBinRef,
} from '@/features/bin-designer/store/customBinRegistry';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { SavedDesign } from '@/features/bin-designer/types';
import { createDefaultEnvelope } from '@/shared/items/defaultEnvelope';
import type { ImportedMeshStructure } from '@/shared/types/item';
import { expectOk } from '@/test/testUtils';

async function resetDesignerDb(): Promise<void> {
  closeDesignerDb();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('gridfinity-designer-v1');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(new Error(req.error?.message ?? 'delete failed'));
  });
}

async function openPreviousBin(): Promise<void> {
  const bin = expectOk(
    await saveDesign({
      name: 'Big bin',
      params: { ...DEFAULT_BIN_PARAMS, width: 5, depth: 4, height: 9 },
      thumbnail: null,
      exportFileNameConfig: null,
    })
  );
  useDesignerStore.getState().loadDesign(bin);
}

function registryEntry(id: string): CustomBinRef | undefined {
  return loadRegistry().find((ref) => ref.id === id);
}

function renameFromHeader(name: string): void {
  const { result } = renderHook(() => useDesignNameEditor());
  act(() => {
    result.current.startEditing();
  });
  act(() => {
    result.current.setEditNameValue(name);
  });
  act(() => {
    result.current.handleNameSubmit();
  });
}

async function saveWorkshopDesign(): Promise<SavedDesign> {
  const store = useDesignerStore.getState();
  store.newDesign('assembly');
  store.addAssemblyPart(
    'block',
    null,
    { x: 0, y: 42, seatZ: 0, rotZDeg: 0 },
    { width: 40, depth: 20, height: 20 }
  );
  const { envelope, structure } = useDesignerStore.getState();
  if (!envelope || structure?.kind !== 'assembly') throw new Error('no Workshop build');
  return expectOk(
    await saveDesign({
      name: 'Plier holder',
      kind: 'assembly',
      envelope,
      structure,
      thumbnail: null,
      exportFileNameConfig: null,
    })
  );
}

async function saveImportedDesign(): Promise<SavedDesign> {
  const structure: ImportedMeshStructure = {
    kind: 'importedMesh',
    heightUnits: 3,
    asset: {
      name: 'widget',
      data: 'AAAA',
      triangleCount: 4,
      sizeMm: { x: 83.5, y: 41.5, z: 21 },
      outlines: [],
    },
  };
  const envelope = {
    ...createDefaultEnvelope(DEFAULT_BIN_PARAMS.featureColors),
    width: 2,
    depth: 1,
  };
  const saved = expectOk(
    await saveDesign({
      name: 'widget',
      kind: 'importedMesh',
      envelope,
      structure,
      thumbnail: null,
      exportFileNameConfig: null,
    })
  );
  upsertRegistryEntry({
    id: saved.id,
    name: saved.name,
    width: envelope.width,
    depth: envelope.depth,
    height: structure.heightUnits,
    kind: 'importedMesh',
    ...registryEdgeFields({}),
    updatedAt: saved.updatedAt,
  });
  return saved;
}

describe('useDesignNameEditor', () => {
  beforeEach(async () => {
    await resetDesignerDb();
    localStorage.clear();
    saveDesignSpy.mockClear();
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  describe('renaming a design that is not a bin', () => {
    it('keeps a Workshop design size and geometry on its registry entry', async () => {
      const workshop = await saveWorkshopDesign();
      const entry = registryAssemblyEntry(workshop);
      if (!entry) throw new Error('no assembly entry');
      upsertRegistryEntry(entry);
      const before = registryEntry(workshop.id);
      expect(before?.overhangMm).toBeDefined();

      await openPreviousBin();
      useDesignerStore.getState().loadDesign(workshop);
      expect(useDesignerStore.getState().params.width).toBe(5);

      renameFromHeader('Pliers, renamed');

      await waitFor(() => expect(registryEntry(workshop.id)?.name).toBe('Pliers, renamed'));
      expect(registryEntry(workshop.id)).toEqual({ ...before, name: 'Pliers, renamed' });
      const stored = expectOk(await loadDesign(workshop.id));
      expect(stored.name).toBe('Pliers, renamed');
      expect(stored.kind).toBe('assembly');
      expect(stored.envelope).toEqual(workshop.envelope);
      expect(stored.structure).toEqual(workshop.structure);
      expect(stored.params).toBeUndefined();
    });

    it('keeps an imported-STL design size on its registry entry', async () => {
      const imported = await saveImportedDesign();
      const before = registryEntry(imported.id);

      await openPreviousBin();
      useDesignerStore.getState().loadDesign(imported);
      expect(useDesignerStore.getState().params.width).toBe(5);

      renameFromHeader('Widget, renamed');

      await waitFor(() => expect(registryEntry(imported.id)?.name).toBe('Widget, renamed'));
      expect(registryEntry(imported.id)).toEqual({ ...before, name: 'Widget, renamed' });
      const stored = expectOk(await loadDesign(imported.id));
      expect(stored.name).toBe('Widget, renamed');
      expect(stored.kind).toBe('importedMesh');
      expect(stored.envelope).toEqual(imported.envelope);
      expect(stored.structure).toEqual(imported.structure);
      expect(stored.params).toBeUndefined();
    });

    it('names an unsaved Workshop build without storing it as a bin', async () => {
      await openPreviousBin();
      useDesignerStore.getState().newDesign('assembly');
      saveDesignSpy.mockClear();

      renameFromHeader('Workbench');

      expect(useDesignerStore.getState().designName).toBe('Workbench');
      expect(saveDesignSpy).not.toHaveBeenCalled();
      expect(useDesignerStore.getState().currentDesignId).toBeNull();
    });
  });

  describe('renaming a bin', () => {
    it('rewrites the registry entry from the open params', async () => {
      await openPreviousBin();
      const id = useDesignerStore.getState().currentDesignId;
      if (!id) throw new Error('no bin open');

      renameFromHeader('Big bin, renamed');

      await waitFor(() => expect(registryEntry(id)?.name).toBe('Big bin, renamed'));
      expect(registryEntry(id)).toMatchObject({ width: 5, depth: 4, height: 9 });
    });
  });
});
