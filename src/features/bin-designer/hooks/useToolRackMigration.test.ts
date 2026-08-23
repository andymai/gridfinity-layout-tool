import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ok } from '@/core/result';
import { designId } from '@/core/types';

const listDesignsMock = vi.fn();
const saveDesignMock = vi.fn();

vi.mock('@/features/bin-designer/storage/DesignerStorage', () => ({
  listDesigns: () => listDesignsMock(),
  saveDesign: (input: unknown) => saveDesignMock(input),
}));

import { useToolRackMigration } from './useToolRackMigration';

const rackDesign = {
  id: designId('design_1_rack01'),
  name: 'My rack',
  kind: 'toolRack',
  thumbnail: null,
  exportFileNameConfig: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  envelope: {
    width: 4,
    depth: 2,
    gridUnitMm: 42,
    heightUnitMm: 7,
    attachment: {
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2.4,
      screwHoles: false,
      screwDiameter: 3,
    },
    featureColors: { enabled: false },
  },
  structure: {
    kind: 'toolRack',
    floorThickness: 2,
    finAngleDeg: 20,
    finThickness: 3,
    finHeight: 25,
    finCount: 6,
    slotPitch: 16,
    slotInsetMm: 8,
    backRail: { enabled: true, height: 10, thickness: 3 },
  },
};

describe('useToolRackMigration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('converts saved racks to assemblies, keeping id and name', async () => {
    listDesignsMock.mockResolvedValueOnce(ok([rackDesign]));
    saveDesignMock.mockResolvedValueOnce(ok({ ...rackDesign, kind: 'assembly' }));
    renderHook(() => useToolRackMigration());
    await waitFor(() => expect(saveDesignMock).toHaveBeenCalledTimes(1));
    const saved = saveDesignMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(saved.id).toBe(rackDesign.id);
    expect(saved.name).toBe('My rack');
    expect(saved.kind).toBe('assembly');
    expect((saved.structure as { kind: string }).kind).toBe('assembly');
  });

  it('keeps the done-flag unset when a save fails, so the next visit retries', async () => {
    listDesignsMock.mockResolvedValue(ok([rackDesign]));
    saveDesignMock.mockResolvedValueOnce({ ok: false, error: { message: 'nope' } });
    const first = renderHook(() => useToolRackMigration());
    await waitFor(() => expect(saveDesignMock).toHaveBeenCalledTimes(1));
    first.unmount();
    saveDesignMock.mockResolvedValueOnce(ok({ ...rackDesign, kind: 'assembly' }));
    renderHook(() => useToolRackMigration());
    await waitFor(() => expect(saveDesignMock).toHaveBeenCalledTimes(2));
  });

  it('leaves bins, assemblies, and imported meshes untouched', async () => {
    listDesignsMock.mockResolvedValueOnce(
      ok([
        { ...rackDesign, id: designId('design_1_bin111'), kind: undefined, params: {} },
        { ...rackDesign, id: designId('design_1_asm111'), kind: 'assembly' },
        { ...rackDesign, id: designId('design_1_mesh11'), kind: 'importedMesh' },
      ])
    );
    renderHook(() => useToolRackMigration());
    await waitFor(() => expect(listDesignsMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(saveDesignMock).not.toHaveBeenCalled();
  });
});
