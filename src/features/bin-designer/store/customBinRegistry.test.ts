// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadRegistry,
  upsertRegistryEntry,
  removeRegistryEntry,
  rebuildRegistry,
  registryEdgeFields,
  registryHeightFields,
  registryOverhangFields,
  type CustomBinRef,
} from './customBinRegistry';
import { designId } from '@/core/types';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';

function makeRef(id: string, name: string = 'Test Bin'): CustomBinRef {
  return {
    id: designId(id),
    name,
    width: 2,
    depth: 2,
    height: 3,
    updatedAt: '2026-01-22T00:00:00.000Z',
  };
}

describe('customBinRegistry', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadRegistry', () => {
    it('returns empty array when no data stored', () => {
      expect(loadRegistry()).toEqual([]);
    });

    it('returns stored entries', () => {
      const refs = [makeRef('bin-1'), makeRef('bin-2')];
      localStorage.setItem('gridfinity-custom-bins-v1', JSON.stringify(refs));
      expect(loadRegistry()).toEqual(refs);
    });

    it('handles corrupted data gracefully', () => {
      localStorage.setItem('gridfinity-custom-bins-v1', 'not json');
      expect(loadRegistry()).toEqual([]);
    });

    it('handles non-array data gracefully', () => {
      localStorage.setItem('gridfinity-custom-bins-v1', JSON.stringify({ foo: 'bar' }));
      expect(loadRegistry()).toEqual([]);
    });

    it('round-trips the optional kind field and drops unknown kinds', () => {
      const mixed = [
        { ...makeRef('mesh-1'), kind: 'importedMesh' },
        { ...makeRef('rack-1'), kind: 'toolRack' },
        { ...makeRef('bad-1'), kind: 'hologram' },
        makeRef('bin-1'),
      ];
      localStorage.setItem('gridfinity-custom-bins-v1', JSON.stringify(mixed));
      const loaded = loadRegistry();
      expect(loaded.find((r) => r.id === 'mesh-1')?.kind).toBe('importedMesh');
      expect(loaded.find((r) => r.id === 'rack-1')?.kind).toBe('toolRack');
      // Unknown kind is stripped, entry itself survives (kind is advisory).
      expect(loaded.find((r) => r.id === 'bad-1')?.kind).toBeUndefined();
      expect(loaded.find((r) => r.id === 'bin-1')?.kind).toBeUndefined();
    });

    it('drops entries that are missing or have wrong-typed fields', () => {
      const mixed = [
        makeRef('bin-1'),
        { id: 'bin-2', name: 'No dimensions' },
        { id: 42, name: 'Numeric id', width: 1, depth: 1, height: 1, updatedAt: 'x' },
        null,
        'not an object',
        makeRef('bin-3'),
      ];
      localStorage.setItem('gridfinity-custom-bins-v1', JSON.stringify(mixed));
      const loaded = loadRegistry();
      expect(loaded.map((r) => r.id)).toEqual(['bin-1', 'bin-3']);
    });

    it('preserves valid fractional-edge fields and drops invalid ones', () => {
      const refs = [
        {
          id: 'bin-1',
          name: 'Edged',
          width: 1.5,
          depth: 2,
          height: 3,
          fractionalEdgeX: 'start',
          fractionalEdgeY: 'nonsense',
          fractionalEdgeManualX: true,
          updatedAt: '2026-01-22T00:00:00.000Z',
        },
      ];
      localStorage.setItem('gridfinity-custom-bins-v1', JSON.stringify(refs));
      const loaded = loadRegistry();
      expect(loaded[0].fractionalEdgeX).toBe('start');
      expect('fractionalEdgeY' in loaded[0]).toBe(false);
      expect(loaded[0].fractionalEdgeManualX).toBe(true);
    });

    it('strips legacy thumbnail field from stored entries', () => {
      const legacyRefs = [
        {
          id: 'bin-1',
          name: 'Old Bin',
          width: 2,
          depth: 2,
          height: 3,
          thumbnail: 'data:image/webp;base64,AAAA',
          updatedAt: '2026-01-22T00:00:00.000Z',
        },
      ];
      localStorage.setItem('gridfinity-custom-bins-v1', JSON.stringify(legacyRefs));
      const loaded = loadRegistry();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('bin-1');
      expect('thumbnail' in loaded[0]).toBe(false);
    });
  });

  describe('upsertRegistryEntry', () => {
    it('adds new entry to empty registry', () => {
      upsertRegistryEntry(makeRef('bin-1'));
      expect(loadRegistry()).toHaveLength(1);
      expect(loadRegistry()[0].id).toBe('bin-1');
    });

    it('adds new entry alongside existing', () => {
      upsertRegistryEntry(makeRef('bin-1'));
      upsertRegistryEntry(makeRef('bin-2'));
      expect(loadRegistry()).toHaveLength(2);
    });

    it('updates existing entry by id', () => {
      upsertRegistryEntry(makeRef('bin-1', 'Original'));
      upsertRegistryEntry(makeRef('bin-1', 'Updated'));
      const registry = loadRegistry();
      expect(registry).toHaveLength(1);
      expect(registry[0].name).toBe('Updated');
    });

    it('preserves other entries when updating', () => {
      upsertRegistryEntry(makeRef('bin-1', 'First'));
      upsertRegistryEntry(makeRef('bin-2', 'Second'));
      upsertRegistryEntry(makeRef('bin-1', 'Updated First'));
      const registry = loadRegistry();
      expect(registry).toHaveLength(2);
      expect(registry[0].name).toBe('Updated First');
      expect(registry[1].name).toBe('Second');
    });
  });

  describe('removeRegistryEntry', () => {
    it('removes entry by id', () => {
      upsertRegistryEntry(makeRef('bin-1'));
      upsertRegistryEntry(makeRef('bin-2'));
      removeRegistryEntry('bin-1');
      const registry = loadRegistry();
      expect(registry).toHaveLength(1);
      expect(registry[0].id).toBe('bin-2');
    });

    it('no-ops for unknown id', () => {
      upsertRegistryEntry(makeRef('bin-1'));
      removeRegistryEntry('unknown');
      expect(loadRegistry()).toHaveLength(1);
    });

    it('handles empty registry gracefully', () => {
      removeRegistryEntry('anything');
      expect(loadRegistry()).toEqual([]);
    });
  });

  describe('rebuildRegistry', () => {
    it('replaces entire registry', () => {
      upsertRegistryEntry(makeRef('old-1'));
      upsertRegistryEntry(makeRef('old-2'));

      const newRefs = [makeRef('new-1'), makeRef('new-2'), makeRef('new-3')];
      rebuildRegistry(newRefs);

      const registry = loadRegistry();
      expect(registry).toHaveLength(3);
      expect(registry.map((r) => r.id)).toEqual(['new-1', 'new-2', 'new-3']);
    });

    it('can clear registry by passing empty array', () => {
      upsertRegistryEntry(makeRef('bin-1'));
      rebuildRegistry([]);
      expect(loadRegistry()).toEqual([]);
    });
  });

  describe('persistence', () => {
    it('uses correct localStorage key', () => {
      upsertRegistryEntry(makeRef('bin-1'));
      const raw = localStorage.getItem('gridfinity-custom-bins-v1');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw ?? '[]') as Array<{ id: string }>;
      expect(parsed[0].id).toBe('bin-1');
    });
  });

  describe('registryEdgeFields', () => {
    it('projects the fractional-edge fields out of full params', () => {
      expect(
        registryEdgeFields({
          fractionalEdgeX: 'start',
          fractionalEdgeY: 'end',
          fractionalEdgeManualX: true,
          fractionalEdgeManualY: false,
        })
      ).toEqual({
        fractionalEdgeX: 'start',
        fractionalEdgeY: 'end',
        fractionalEdgeManualX: true,
        fractionalEdgeManualY: false,
      });
    });
  });

  describe('geometry metadata', () => {
    // Thirteen call sites upsert this registry and most carry only a name or a
    // thumbnail. An upsert replaces the whole entry, so before the carry-forward
    // an autosave erased the assembled rise on the very next designer edit and
    // every linked bin silently fell back to plain-bin height.
    it('keeps the assembled rise when an update omits it', () => {
      upsertRegistryEntry({ ...makeRef('d1'), assembledRiseMm: 64.3, socketless: false });
      upsertRegistryEntry({ ...makeRef('d1', 'Renamed') });

      const stored = loadRegistry()[0];
      expect(stored?.name).toBe('Renamed');
      expect(stored?.assembledRiseMm).toBe(64.3);
      expect(stored?.socketless).toBe(false);
    });

    it('takes a fresh rise when the writer supplies one', () => {
      upsertRegistryEntry({ ...makeRef('d1'), assembledRiseMm: 64.3 });
      upsertRegistryEntry({ ...makeRef('d1'), assembledRiseMm: 92.1 });

      expect(loadRegistry()[0]?.assembledRiseMm).toBe(92.1);
    });

    it('leaves a new entry without a rise alone', () => {
      upsertRegistryEntry(makeRef('d1'));
      expect(loadRegistry()[0]?.assembledRiseMm).toBeUndefined();
    });

    it('drops a stored rise that is not a usable number', () => {
      localStorage.setItem(
        'gridfinity-custom-bins-v1',
        JSON.stringify([{ ...makeRef('d1'), assembledRiseMm: 'tall' }])
      );
      expect(loadRegistry()[0]?.assembledRiseMm).toBeUndefined();
    });

    it('projects the rise and the socket flag off full params', () => {
      const socketed = registryHeightFields(DEFAULT_BIN_PARAMS);
      expect(socketed.assembledRiseMm).toBeGreaterThan(0);
      expect(socketed.socketless).toBe(false);

      // A flat base has no foot, so it neither nests nor seats on a plate.
      const flat = registryHeightFields({
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
      });
      expect(flat.socketless).toBe(true);
    });
  });

  describe('design overhang', () => {
    const OVER = { left: 61.5, right: 42, front: 0, back: 0 };

    it('projects the overhang off full params, outward-clamped', () => {
      const fields = registryOverhangFields({
        ...DEFAULT_BIN_PARAMS,
        overhang: { left: 61.5, right: 42, front: -5, back: 0, enabled: true },
      });
      expect(fields.overhangMm).toEqual(OVER);
    });

    it('projects nothing when the design has no overhang', () => {
      expect(registryOverhangFields(DEFAULT_BIN_PARAMS).overhangMm).toBeUndefined();
    });

    it('projects nothing when the overhang is turned off', () => {
      const fields = registryOverhangFields({
        ...DEFAULT_BIN_PARAMS,
        overhang: { ...OVER, enabled: false },
      });
      expect(fields.overhangMm).toBeUndefined();
    });

    // A custom shape defines its own footprint, so `deriveDimensions` suppresses
    // the overhang there and the registry must agree.
    it('projects nothing for a partial cell mask', () => {
      const fields = registryOverhangFields({
        ...DEFAULT_BIN_PARAMS,
        overhang: { ...OVER, enabled: true },
        cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] },
      });
      expect(fields.overhangMm).toBeUndefined();
    });

    it('keeps the overhang when an update omits it', () => {
      upsertRegistryEntry({ ...makeRef('d1'), overhangMm: OVER });
      upsertRegistryEntry({ ...makeRef('d1', 'Renamed') });

      expect(loadRegistry()[0]?.overhangMm).toEqual(OVER);
    });

    // The projector writes an explicit `undefined` for a design that lost its
    // overhang, which has to CLEAR the field — the carry-forward tests key
    // presence, not value, for exactly this.
    it('clears the overhang when a re-save removed it', () => {
      upsertRegistryEntry({ ...makeRef('d1'), overhangMm: OVER });
      upsertRegistryEntry({
        ...makeRef('d1'),
        ...registryOverhangFields(DEFAULT_BIN_PARAMS),
      });

      expect(loadRegistry()[0]?.overhangMm).toBeUndefined();
    });

    it('takes a fresh overhang when the writer supplies one', () => {
      upsertRegistryEntry({ ...makeRef('d1'), overhangMm: OVER });
      upsertRegistryEntry({ ...makeRef('d1'), overhangMm: { ...OVER, left: 10 } });

      expect(loadRegistry()[0]?.overhangMm?.left).toBe(10);
    });

    it.each([
      { label: 'non-numeric sides', stored: { left: 'wide', right: 1, front: 0, back: 0 } },
      { label: 'all zero', stored: { left: 0, right: 0, front: 0, back: 0 } },
      { label: 'not an object', stored: 42 },
    ])('drops a stored overhang with $label', ({ stored }) => {
      localStorage.setItem(
        'gridfinity-custom-bins-v1',
        JSON.stringify([{ ...makeRef('d1'), overhangMm: stored }])
      );
      const back = loadRegistry()[0]?.overhangMm;
      // A partly-valid record keeps its usable sides; a useless one is dropped.
      if (back) expect(back.left).toBe(0);
      else expect(back).toBeUndefined();
    });
  });
});
