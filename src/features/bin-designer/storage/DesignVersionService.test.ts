// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/shared/analytics/posthog', () => ({ trackDesignCreated: () => {} }));
import {
  createDesignVersion,
  listDesignVersions,
  readDesignVersion,
  renameDesignVersion,
  setDesignVersionPinned,
  deleteDesignVersion,
  deleteVersionsForDesign,
} from './DesignVersionService';
import { closeDesignerDb } from './designerDb';
import { saveDesign, deleteDesign } from './DesignerStorage';
import { MAX_VERSIONS_PER_DESIGN } from '../types';
import type { DesignVersionContent, DesignVersionOrigin } from '../types';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import { expectOk, expectErr } from '@/test/testUtils';
import { designId } from '@/core/types';

const DESIGN = designId('design_versions_test');
const OTHER = designId('design_versions_other');

function content(overrides: Partial<DesignVersionContent> = {}): DesignVersionContent {
  return { name: 'Router Bit Holder', params: DEFAULT_BIN_PARAMS, ...overrides };
}

/**
 * `createdAt` is an ISO string compared lexicographically, so two versions
 * written inside the same millisecond sort arbitrarily. Every ordering
 * assertion below depends on distinct timestamps, so saves are spaced.
 */
async function save(name: string, origin: DesignVersionOrigin = 'manual') {
  const result = expectOk(await createDesignVersion(DESIGN, name, content(), null, origin));
  await new Promise((r) => setTimeout(r, 2));
  return result;
}

describe('DesignVersionService', () => {
  beforeEach(async () => {
    closeDesignerDb();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('gridfinity-designer-v1');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error(req.error?.message ?? 'Failed to delete database'));
    });
  });

  describe('create and list', () => {
    it('stores a version and returns it without the compressed body', async () => {
      const { version, evicted } = await save('0.2 mm — tight');

      expect(version.name).toBe('0.2 mm — tight');
      expect(version.designId).toBe(DESIGN);
      expect(version.origin).toBe('manual');
      expect(evicted).toEqual([]);
      // The summary is what the history list holds; the body stays in IndexedDB.
      expect('content' in version).toBe(false);
    });

    it('lists newest first', async () => {
      await save('first');
      await save('second');
      await save('third');

      const versions = expectOk(await listDesignVersions(DESIGN));
      expect(versions.map((v) => v.name)).toEqual(['third', 'second', 'first']);
    });

    it('keeps each design’s versions separate', async () => {
      await save('mine');
      expectOk(await createDesignVersion(OTHER, 'theirs', content(), null));

      expect(expectOk(await listDesignVersions(DESIGN)).map((v) => v.name)).toEqual(['mine']);
      expect(expectOk(await listDesignVersions(OTHER)).map((v) => v.name)).toEqual(['theirs']);
    });
  });

  describe('read', () => {
    it('round-trips the stored content through compression', async () => {
      const { version } = expectOk(
        await createDesignVersion(DESIGN, 'named', content({ name: 'Renamed Design' }), null)
      );

      const restored = expectOk(await readDesignVersion(version.id));
      expect(restored.name).toBe('Renamed Design');
      expect(restored.params).toEqual(DEFAULT_BIN_PARAMS);
    });

    // A non-bin design carries envelope/structure and no params at all. A record
    // shaped around BinParams would have stored nothing for these.
    it('round-trips a non-bin item kind', async () => {
      const { version } = expectOk(
        await createDesignVersion(
          DESIGN,
          'rack',
          {
            name: 'Chisel Rack',
            kind: 'toolRack',
            envelope: { widthMm: 84 },
            structure: { slots: 3 },
          },
          null
        )
      );

      const restored = expectOk(await readDesignVersion(version.id));
      expect(restored.kind).toBe('toolRack');
      expect(restored.envelope).toEqual({ widthMm: 84 });
      expect(restored.structure).toEqual({ slots: 3 });
      expect(restored.params).toBeUndefined();
    });

    it('reports a missing version rather than throwing', async () => {
      const error = expectErr(await readDesignVersion('nope'));
      expect(error.code).toBe('STORAGE_NOT_FOUND');
    });
  });

  describe('eviction', () => {
    it('drops the oldest version once the design is at its ceiling', async () => {
      for (let i = 0; i < MAX_VERSIONS_PER_DESIGN; i++) await save(`v${i}`);

      const { evicted } = await save('one too many');

      expect(evicted.map((v) => v.name)).toEqual(['v0']);
      const versions = expectOk(await listDesignVersions(DESIGN));
      expect(versions).toHaveLength(MAX_VERSIONS_PER_DESIGN);
      expect(versions.some((v) => v.name === 'v0')).toBe(false);
      expect(versions.some((v) => v.name === 'one too many')).toBe(true);
    });

    // The user named one of these and not the other.
    it('drops automatic pre-restore captures before anything named', async () => {
      await save('oldest but named');
      for (let i = 0; i < MAX_VERSIONS_PER_DESIGN - 2; i++) await save(`filler${i}`);
      await save('a newer automatic copy', 'pre-restore');

      const { evicted } = await save('one too many');

      expect(evicted.map((v) => v.name)).toEqual(['a newer automatic copy']);
      const names = expectOk(await listDesignVersions(DESIGN)).map((v) => v.name);
      expect(names).toContain('oldest but named');
    });

    it('never evicts a pinned version', async () => {
      const { version: first } = await save('pin me');
      expectOk(await setDesignVersionPinned(first.id, true));
      for (let i = 0; i < MAX_VERSIONS_PER_DESIGN - 1; i++) await save(`filler${i}`);

      const { evicted } = await save('one too many');

      expect(evicted.map((v) => v.name)).toEqual(['filler0']);
      const names = expectOk(await listDesignVersions(DESIGN)).map((v) => v.name);
      expect(names).toContain('pin me');
    });

    // Refusing the save would block the user at the exact moment they are trying
    // to preserve something, which is worse than exceeding a soft cap by one.
    it('still saves when every existing version is pinned', async () => {
      for (let i = 0; i < MAX_VERSIONS_PER_DESIGN; i++) {
        const { version } = await save(`pinned${i}`);
        expectOk(await setDesignVersionPinned(version.id, true));
      }

      const { evicted } = await save('one too many');

      expect(evicted).toEqual([]);
      expect(expectOk(await listDesignVersions(DESIGN))).toHaveLength(MAX_VERSIONS_PER_DESIGN + 1);
    });
  });

  describe('mutate and delete', () => {
    it('renames a version without touching its content', async () => {
      const { version } = await save('typo');

      const renamed = expectOk(await renameDesignVersion(version.id, 'fixed'));
      expect(renamed.name).toBe('fixed');
      expect(expectOk(await readDesignVersion(version.id)).params).toEqual(DEFAULT_BIN_PARAMS);
    });

    it('toggles pinned in both directions', async () => {
      const { version } = await save('v');

      expect(expectOk(await setDesignVersionPinned(version.id, true)).pinned).toBe(true);
      expect(expectOk(await setDesignVersionPinned(version.id, false)).pinned).toBe(false);
    });

    it('reports a missing version on rename', async () => {
      expect(expectErr(await renameDesignVersion('nope', 'x')).code).toBe('STORAGE_NOT_FOUND');
    });

    it('deletes one version and leaves the rest', async () => {
      const { version: a } = await save('a');
      await save('b');

      expectOk(await deleteDesignVersion(a.id));

      expect(expectOk(await listDesignVersions(DESIGN)).map((v) => v.name)).toEqual(['b']);
    });

    // Versions outlive their design otherwise: unreachable rows keyed to an id
    // nothing can load.
    it('drops a design’s versions when the design itself is deleted', async () => {
      const design = expectOk(
        await saveDesign({
          name: 'Router Bit Holder',
          params: DEFAULT_BIN_PARAMS,
          thumbnail: null,
          exportFileNameConfig: null,
        })
      );
      expectOk(await createDesignVersion(design.id, 'v1', content(), null));
      expectOk(await createDesignVersion(design.id, 'v2', content(), null));

      expectOk(await deleteDesign(design.id));

      expect(expectOk(await listDesignVersions(design.id))).toEqual([]);
    });

    it('drops every version of a design and only that design', async () => {
      await save('a');
      await save('b');
      expectOk(await createDesignVersion(OTHER, 'theirs', content(), null));

      expect(expectOk(await deleteVersionsForDesign(DESIGN))).toBe(2);

      expect(expectOk(await listDesignVersions(DESIGN))).toEqual([]);
      expect(expectOk(await listDesignVersions(OTHER))).toHaveLength(1);
    });
  });
});
