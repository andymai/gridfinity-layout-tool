import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOk } from '@/core/result';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityDesign } from '@/shared/types/community';

const saveDesign = vi.fn();
const setActiveDesignId = vi.fn();
vi.mock('@/features/bin-designer/storage/DesignerStorage', () => ({
  saveDesign: (...a: unknown[]) => saveDesign(...a),
  setActiveDesignId: (...a: unknown[]) => setActiveDesignId(...a),
}));

const loadDesign = vi.fn();
vi.mock('@/features/bin-designer/store/designer', () => ({
  useDesignerStore: { getState: () => ({ loadDesign }) },
}));

const updateSettings = vi.fn();
vi.mock('@/core/store', () => ({
  useSettingsStore: {
    getState: () => ({ settings: { dismissedHints: ['existing'] }, updateSettings }),
  },
}));

import { communityToDesign, lineageFromParent } from './communityToDesign';

const params = { width: 2, depth: 3, height: 6 } as unknown as BinParams;

function communityDesign(overrides: Partial<CommunityDesign> = {}): CommunityDesign {
  return {
    id: 'Parent123456',
    authorPublicId: 'a'.repeat(32),
    authorName: 'Jo',
    name: 'Screw Bin',
    description: 'Bin for screws',
    category: 'tools',
    techniques: ['scoop'],
    params,
    metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
    lineage: null,
    thumbnails: ['https://blob.example/t0.webp'],
    meshUrl: 'https://blob.example/mesh.glb',
    photos: [],
    featured: false,
    createdAt: 1000,
    updatedAt: 1000,
    status: 'live',
    ...overrides,
  };
}

describe('lineageFromParent', () => {
  it('roots at the parent itself when the parent is an original', () => {
    expect(lineageFromParent(communityDesign())).toEqual({
      parentId: 'Parent123456',
      rootId: 'Parent123456',
      parentName: 'Screw Bin',
      parentAuthorName: 'Jo',
      rootAuthorName: 'Jo',
    });
  });

  it('carries the root chain when the parent is itself a remix', () => {
    const design = communityDesign({
      lineage: {
        parentId: 'Grandparent1',
        rootId: 'Root12345678',
        parentName: 'Older Bin',
        parentAuthorName: 'Sam',
        rootAuthorName: 'Root Author',
      },
    });
    expect(lineageFromParent(design)).toEqual({
      parentId: 'Parent123456',
      rootId: 'Root12345678',
      parentName: 'Screw Bin',
      parentAuthorName: 'Jo',
      rootAuthorName: 'Root Author',
    });
  });
});

describe('communityToDesign', () => {
  beforeEach(() => {
    saveDesign.mockReset();
    setActiveDesignId.mockReset();
    loadDesign.mockReset();
    updateSettings.mockReset();
  });

  it('saves a fresh design with lineage and no publishedId, then activates it', async () => {
    const design = communityDesign();
    const saved = { id: 'design_new', name: design.name, params };
    saveDesign.mockResolvedValue({ ok: true, value: saved });

    const result = await communityToDesign(design);

    expect(isOk(result)).toBe(true);
    const arg = saveDesign.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.id).toBeUndefined();
    expect(arg.params).toEqual(params);
    expect(arg.thumbnail).toBeNull();
    expect(arg.lineage).toEqual(lineageFromParent(design));
    expect('publishedId' in arg).toBe(false);
    expect(setActiveDesignId).toHaveBeenCalledWith('design_new');
    expect(loadDesign).toHaveBeenCalledWith(saved);
  });

  it('saves an assembly through the descriptor migration gate', async () => {
    const design = {
      ...communityDesign(),
      params: undefined,
      kind: 'assembly' as const,
      envelope: {
        width: 2,
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
      } as unknown as CommunityDesign['envelope'],
      structure: {
        kind: 'assembly',
        schemaVersion: 1,
        base: { floorThickness: 2 },
        mirrorAxis: 'x',
        parts: [
          {
            id: 'p1',
            type: 'post',
            params: { diameter: 8, height: 40 },
            transform: { x: 42, y: 42, seatZ: 0, rotZDeg: 0 },
            children: [],
          },
        ],
      } as unknown as CommunityDesign['structure'],
    };
    saveDesign.mockResolvedValue({ ok: true, value: { id: 'design_asm', name: design.name } });

    const result = await communityToDesign(design);

    expect(isOk(result)).toBe(true);
    const arg = saveDesign.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.kind).toBe('assembly');
    expect(arg.params).toBeUndefined();
    expect(arg.envelope).toMatchObject({ width: 2, depth: 2 });
    // Migration ran: the structure is the descriptor's parsed copy, with the
    // part surviving intact.
    const structure = arg.structure as { kind: string; parts: unknown[] };
    expect(structure.kind).toBe('assembly');
    expect(structure.parts).toHaveLength(1);
  });

  it('leaves the remix banner alone for a plain remix', async () => {
    saveDesign.mockResolvedValue({ ok: true, value: { id: 'design_new' } });
    await communityToDesign(communityDesign());
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('pre-dismisses the remix banner for an owner duplicate', async () => {
    saveDesign.mockResolvedValue({ ok: true, value: { id: 'design_new' } });
    await communityToDesign(communityDesign(), { ownDuplicate: true });
    expect(updateSettings).toHaveBeenCalledWith({
      dismissedHints: ['existing', 'remix-banner:design_new'],
    });
  });

  it('does not activate or load when save fails', async () => {
    saveDesign.mockResolvedValue({ ok: false, error: { code: 'x', message: 'fail' } });
    const result = await communityToDesign(communityDesign());
    expect(isOk(result)).toBe(false);
    expect(setActiveDesignId).not.toHaveBeenCalled();
    expect(loadDesign).not.toHaveBeenCalled();
  });
});
