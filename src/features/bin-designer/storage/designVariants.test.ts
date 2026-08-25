// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/shared/analytics/posthog', () => ({ trackDesignCreated: () => {} }));

import {
  saveDesign,
  loadDesign,
  listDesigns,
  deleteDesign,
  updateDesignParams,
  createVariant,
  updateVariantOverrides,
  detachVariant,
} from './DesignerStorage';
import { closeDesignerDb } from './designerDb';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { BinParams, Cutout } from '../types';
import { expectOk, expectErr } from '@/test/testUtils';
import { designId } from '@/core/types';

const PARENT = designId('design_variant_parent');

function bit(id: string, over: Partial<Cutout> = {}): Cutout {
  return {
    id,
    shape: 'circle',
    x: 10,
    y: 10,
    width: 6.35,
    depth: 6.35,
    cutDepth: 10,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...over,
  };
}

function parentParams(over: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, height: 6, cutouts: [bit('bit')], ...over };
}

async function seedParent(params = parentParams()) {
  return expectOk(
    await saveDesign({
      id: PARENT,
      name: 'Router Bit Holder',
      params,
      thumbnail: null,
      exportFileNameConfig: null,
    })
  );
}

describe('design variants', () => {
  beforeEach(async () => {
    closeDesignerDb();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('gridfinity-designer-v1');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error(req.error?.message ?? 'delete failed'));
    });
  });

  describe('createVariant', () => {
    it('materializes params so every existing consumer reads a complete design', async () => {
      await seedParent();

      const variant = expectOk(
        await createVariant(PARENT, '1/2" Shank', { cutouts: { bit: { width: 12.7 } } })
      );

      expect(variant.params?.cutouts?.[0].width).toBe(12.7);
      // Everything unclaimed came from the parent.
      expect(variant.params?.height).toBe(6);
    });

    it('records both the family link and the live link', async () => {
      await seedParent();

      const variant = expectOk(await createVariant(PARENT, '1/2"', { dimensions: { width: 4 } }));

      expect(variant.parentDesignId).toBe(PARENT);
      expect(variant.variantOf).toBe(PARENT);
      expect(variant.overrides).toEqual({ dimensions: { width: 4 } });
    });

    it('refuses a parent that is not a bin design', async () => {
      expectOk(
        await saveDesign({
          id: PARENT,
          name: 'Rack',
          kind: 'toolRack',
          envelope: { widthMm: 84 } as never,
          structure: { kind: 'toolRack' } as never,
          thumbnail: null,
          exportFileNameConfig: null,
        })
      );

      expect(expectErr(await createVariant(PARENT, 'v', {})).code).toBe('STORAGE_CORRUPTED');
    });
  });

  describe('propagation', () => {
    it('rewrites a variant when the parent is saved', async () => {
      await seedParent();
      const variant = expectOk(
        await createVariant(PARENT, '1/2"', { cutouts: { bit: { width: 12.7 } } })
      );

      // The reporter's exact case: the shared pocket grows, the shank does not.
      expectOk(
        await updateDesignParams(PARENT, parentParams({ height: 12, cutouts: [bit('bit')] }))
      );

      const reloaded = expectOk(await loadDesign(variant.id));
      expect(reloaded.params?.height).toBe(12);
      expect(reloaded.params?.cutouts?.[0].width).toBe(12.7);
    });

    it('rewrites every variant, not just the first', async () => {
      await seedParent();
      const quarter = expectOk(
        await createVariant(PARENT, '1/4"', { cutouts: { bit: { width: 6.35 } } })
      );
      const half = expectOk(
        await createVariant(PARENT, '1/2"', { cutouts: { bit: { width: 12.7 } } })
      );

      expectOk(await updateDesignParams(PARENT, parentParams({ height: 9 })));

      expect(expectOk(await loadDesign(quarter.id)).params?.height).toBe(9);
      expect(expectOk(await loadDesign(half.id)).params?.height).toBe(9);
    });

    it('leaves designs that are not variants of this parent alone', async () => {
      await seedParent();
      const unrelated = expectOk(
        await saveDesign({
          name: 'Unrelated',
          params: parentParams({ height: 3 }),
          thumbnail: null,
          exportFileNameConfig: null,
        })
      );

      expectOk(await updateDesignParams(PARENT, parentParams({ height: 12 })));

      expect(expectOk(await loadDesign(unrelated.id)).params?.height).toBe(3);
    });

    // This is the hazard the materialized model creates, stated as a test: a
    // variant's params is a cache, so anything outside the override surface is
    // rewritten from the parent. It is why those controls must be disabled.
    it('discards a variant’s edit to a field it does not own', async () => {
      await seedParent();
      const variant = expectOk(
        await createVariant(PARENT, '1/2"', { cutouts: { bit: { width: 12.7 } } })
      );
      // An edit to `height`, which the variant does not claim.
      expectOk(await saveDesign({ ...variant, params: { ...variant.params!, height: 20 } }));

      expectOk(await updateDesignParams(PARENT, parentParams({ height: 6 })));

      expect(expectOk(await loadDesign(variant.id)).params?.height).toBe(6);
    });

    it('keeps a claimed value when the parent moves the same field', async () => {
      await seedParent();
      const variant = expectOk(await createVariant(PARENT, 'tall', { dimensions: { height: 6 } }));

      expectOk(await updateDesignParams(PARENT, parentParams({ height: 12 })));

      expect(expectOk(await loadDesign(variant.id)).params?.height).toBe(6);
    });

    // The parent's own save must not fail because a variant could not be written.
    it('still saves the parent when it has no variants', async () => {
      await seedParent();
      const saved = expectOk(await updateDesignParams(PARENT, parentParams({ height: 12 })));
      expect(saved.params?.height).toBe(12);
    });
  });

  describe('updateVariantOverrides', () => {
    it('rebuilds params from the parent, not from the variant’s own params', async () => {
      await seedParent(parentParams({ height: 9 }));
      const variant = expectOk(
        await createVariant(PARENT, '1/2"', { cutouts: { bit: { width: 12.7 } } })
      );

      const updated = expectOk(
        await updateVariantOverrides(variant.id, { cutouts: { bit: { width: 8 } } })
      );

      expect(updated.params?.cutouts?.[0].width).toBe(8);
      expect(updated.params?.height).toBe(9);
    });

    it('refuses a design that is not a variant', async () => {
      const plain = await seedParent();
      expect(expectErr(await updateVariantOverrides(plain.id, {})).code).toBe('STORAGE_CORRUPTED');
    });
  });

  describe('detachVariant', () => {
    it('keeps the params it had and stops tracking the parent', async () => {
      await seedParent();
      const variant = expectOk(
        await createVariant(PARENT, '1/2"', { cutouts: { bit: { width: 12.7 } } })
      );

      const detached = expectOk(await detachVariant(variant.id));
      expect(detached.variantOf).toBeUndefined();
      expect(detached.overrides).toBeUndefined();
      expect(detached.params?.cutouts?.[0].width).toBe(12.7);

      expectOk(await updateDesignParams(PARENT, parentParams({ height: 12 })));
      expect(expectOk(await loadDesign(variant.id)).params?.height).toBe(6);
    });

    // saveDesign falls back to the STORED value for both fields, so a detach
    // routed through it would restore what it was trying to remove.
    it('stays detached across a later save', async () => {
      await seedParent();
      const variant = expectOk(await createVariant(PARENT, '1/2"', { dimensions: { width: 4 } }));
      expectOk(await detachVariant(variant.id));

      expectOk(
        await saveDesign({
          id: variant.id,
          name: 'renamed',
          params: parentParams(),
          thumbnail: null,
          exportFileNameConfig: null,
        })
      );

      expect(expectOk(await loadDesign(variant.id)).variantOf).toBeUndefined();
    });
  });

  it('reports a detach of something that does not exist through the Result channel', async () => {
    const result = await detachVariant(designId('design_missing'));
    expect(expectErr(result).code).toBe('STORAGE_NOT_FOUND');
  });

  it('lists a variant like any other design', async () => {
    await seedParent();
    await createVariant(PARENT, '1/2"', { dimensions: { width: 4 } });

    const all = expectOk(await listDesigns());
    expect(all).toHaveLength(2);
  });

  // A variant holds its own complete params, so it is still a usable design.
  it('survives the deletion of its parent', async () => {
    await seedParent();
    const variant = expectOk(
      await createVariant(PARENT, '1/2"', { cutouts: { bit: { width: 12.7 } } })
    );

    expectOk(await deleteDesign(PARENT));

    const reloaded = expectOk(await loadDesign(variant.id));
    expect(reloaded.params?.cutouts?.[0].width).toBe(12.7);
  });
});
