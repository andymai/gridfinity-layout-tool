import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOk } from '@/core/result';
import { createCommand } from '../commands';
import { layerId, categoryId } from '@/core/types';
import type { Drawer } from '@/core/types';
import { resetVersionCounters } from './index';

// --- Mocks ---

const drawer: Drawer = { width: 6, depth: 4, height: 7 };

const mockStore = {
  layout: {
    bins: [],
    layers: [{ id: layerId('layer_1'), name: 'Layer 1', height: 3 }],
    categories: [{ id: categoryId('cat_1'), name: 'Default', color: '#808080' }],
    drawer,
    name: 'Test Layout',
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    baseplateParams: undefined as { style: string } | undefined,
    version: '1.0',
  },
  updateDrawer: vi.fn(),
  setName: vi.fn(),
  setPrintBedSize: vi.fn(),
  setGridUnitMm: vi.fn(),
  setHeightUnitMm: vi.fn(),
  setBaseplateParams: vi.fn(),
};

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: { getState: () => mockStore },
}));

vi.mock('@/core/store/library', () => ({
  useLibraryStore: {
    getState: () => ({ library: { activeLayoutId: 'layout_1' } }),
  },
}));

const {
  handleUpdateDrawer,
  handleSetName,
  handleSetPrintBedSize,
  handleSetGridUnitMm,
  handleSetHeightUnitMm,
  handleSetBaseplateParams,
} = await import('./drawerHandlers');

describe('Drawer Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetVersionCounters();
    Object.assign(drawer, { width: 6, depth: 4, height: 7 });
    mockStore.layout.name = 'Test Layout';
    mockStore.layout.printBedSize = 256;
    mockStore.layout.gridUnitMm = 42;
    mockStore.layout.heightUnitMm = 7;
    mockStore.layout.baseplateParams = undefined;
  });

  describe('handleUpdateDrawer', () => {
    it('captures previous drawer values and produces drawer.updated event', () => {
      const cmd = createCommand('drawer.update', { width: 10, depth: 8 });
      const result = handleUpdateDrawer(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const event = result.value.events[0];
        expect(event.type).toBe('drawer.updated');
        if (event.type === 'drawer.updated') {
          expect(event.payload.changes).toEqual({ width: 10, depth: 8 });
          expect(event.payload.previous).toEqual({ width: 6, depth: 4 });
        }
      }
    });
  });

  describe('handleSetName', () => {
    it('captures previous name and produces layout.nameSet event', () => {
      const cmd = createCommand('layout.setName', { name: 'New Name' });
      const result = handleSetName(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const event = result.value.events[0];
        expect(event.type).toBe('layout.nameSet');
        if (event.type === 'layout.nameSet') {
          expect(event.payload.name).toBe('New Name');
          expect(event.payload.previousName).toBe('Test Layout');
        }
      }
    });
  });

  describe('handleSetPrintBedSize', () => {
    it('captures previous size and produces layout.printBedSizeSet event', () => {
      const cmd = createCommand('layout.setPrintBedSize', { size: 300 });
      const result = handleSetPrintBedSize(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const event = result.value.events[0];
        expect(event.type).toBe('layout.printBedSizeSet');
        if (event.type === 'layout.printBedSizeSet') {
          expect(event.payload.size).toBe(300);
          expect(event.payload.previousSize).toBe(256);
        }
      }
    });
  });

  describe('handleSetGridUnitMm', () => {
    it('captures previous mm and produces layout.gridUnitMmSet event', () => {
      const cmd = createCommand('layout.setGridUnitMm', { mm: 35 });
      const result = handleSetGridUnitMm(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const event = result.value.events[0];
        expect(event.type).toBe('layout.gridUnitMmSet');
        if (event.type === 'layout.gridUnitMmSet') {
          expect(event.payload.mm).toBe(35);
          expect(event.payload.previousMm).toBe(42);
        }
      }
    });
  });

  describe('handleSetHeightUnitMm', () => {
    it('captures previous mm and produces layout.heightUnitMmSet event', () => {
      const cmd = createCommand('layout.setHeightUnitMm', { mm: 14 });
      const result = handleSetHeightUnitMm(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const event = result.value.events[0];
        expect(event.type).toBe('layout.heightUnitMmSet');
        if (event.type === 'layout.heightUnitMmSet') {
          expect(event.payload.mm).toBe(14);
          expect(event.payload.previousMm).toBe(7);
        }
      }
    });
  });

  describe('handleSetBaseplateParams', () => {
    it('captures undefined previous params', () => {
      const params = { style: 'weighted' } as never;
      const cmd = createCommand('layout.setBaseplateParams', { params });
      const result = handleSetBaseplateParams(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const event = result.value.events[0];
        expect(event.type).toBe('layout.baseplateParamsSet');
        if (event.type === 'layout.baseplateParamsSet') {
          expect(event.payload.previousParams).toBeUndefined();
        }
      }
    });
  });
});
