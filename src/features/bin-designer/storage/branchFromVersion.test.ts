// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/shared/analytics/posthog', () => ({ trackDesignCreated: () => {} }));

import { saveDesign, loadDesign, branchFromVersion, deleteDesign } from './DesignerStorage';
import { createDesignVersion } from './DesignVersionService';
import { closeDesignerDb } from './designerDb';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import { expectOk, expectErr } from '@/test/testUtils';
import { designId } from '@/core/types';

const PARENT = designId('design_branch_parent');

async function seedParent() {
  return expectOk(
    await saveDesign({
      id: PARENT,
      name: 'Router Bit Holder',
      params: { ...DEFAULT_BIN_PARAMS, width: 4 },
      thumbnail: 'data:image/png;base64,PARENT',
      exportFileNameConfig: null,
      tags: ['workshop'],
    })
  );
}

async function seedVersion(width: number, name = '0.2 mm') {
  return expectOk(
    await createDesignVersion(
      PARENT,
      name,
      { name: 'Router Bit Holder', params: { ...DEFAULT_BIN_PARAMS, width } },
      null
    )
  ).version;
}

describe('branchFromVersion', () => {
  beforeEach(async () => {
    closeDesignerDb();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('gridfinity-designer-v1');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error(req.error?.message ?? 'delete failed'));
    });
  });

  it('seeds the branch from the version, not the parent’s current state', async () => {
    await seedParent();
    const version = await seedVersion(1);

    const branch = expectOk(await branchFromVersion(PARENT, version.id, '0.3 mm trial'));

    // The parent is at width 4; branching from "0.2 mm" must reproduce THAT.
    expect(branch.params?.width).toBe(1);
    expect(branch.name).toBe('0.3 mm trial');
  });

  it('records where the branch came from', async () => {
    await seedParent();
    const version = await seedVersion(1, 'printed successfully');

    const branch = expectOk(await branchFromVersion(PARENT, version.id, 'trial'));

    expect(branch.parentDesignId).toBe(PARENT);
    expect(branch.parentVersionId).toBe(version.id);
    expect(branch.parentVersionName).toBe('printed successfully');
  });

  it('gets its own id and leaves the parent alone', async () => {
    const parent = await seedParent();
    const version = await seedVersion(1);

    const branch = expectOk(await branchFromVersion(PARENT, version.id, 'trial'));

    expect(branch.id).not.toBe(parent.id);
    expect(expectOk(await loadDesign(PARENT)).params?.width).toBe(4);
  });

  it('carries the parent’s tags forward', async () => {
    await seedParent();
    const version = await seedVersion(1);

    const branch = expectOk(await branchFromVersion(PARENT, version.id, 'trial'));

    expect(branch.tags).toEqual(['workshop']);
  });

  // The parent's thumbnail renders the state the branch was taken AWAY from.
  it('starts with no thumbnail rather than the parent’s', async () => {
    await seedParent();
    const version = await seedVersion(1);

    const branch = expectOk(await branchFromVersion(PARENT, version.id, 'trial'));

    expect(branch.thumbnail).toBeNull();
  });

  // A branch is a new, unpublished design.
  it('does not carry the parent’s published id', async () => {
    expectOk(
      await saveDesign({
        id: PARENT,
        name: 'Router Bit Holder',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
        publishedId: 'community123',
      })
    );
    const version = await seedVersion(1);

    const branch = expectOk(await branchFromVersion(PARENT, version.id, 'trial'));

    expect(branch.publishedId).toBeUndefined();
  });

  // saveDesign rebuilds the record field by field, so a field it does not name
  // is dropped. Autosave omits the lineage on every write after the first.
  it('keeps its parent link across a later save', async () => {
    await seedParent();
    const version = await seedVersion(1);
    const branch = expectOk(await branchFromVersion(PARENT, version.id, 'trial'));

    expectOk(
      await saveDesign({
        id: branch.id,
        name: 'trial',
        params: { ...DEFAULT_BIN_PARAMS, width: 3 },
        thumbnail: null,
        exportFileNameConfig: null,
      })
    );

    const reloaded = expectOk(await loadDesign(branch.id));
    expect(reloaded.parentDesignId).toBe(PARENT);
    expect(reloaded.parentVersionId).toBe(version.id);
  });

  // `readDesignVersion` returns any version by id, so without a membership
  // check a mismatched pair would seed the branch from unrelated content and
  // still stamp it as this design's child.
  it('refuses a version belonging to a different design', async () => {
    await seedParent();
    const other = expectOk(
      await saveDesign({
        name: 'Other design',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
      })
    );
    const foreign = expectOk(
      await createDesignVersion(other.id, 'theirs', { name: 'Other design' }, null)
    ).version;

    const result = await branchFromVersion(PARENT, foreign.id, 'trial');

    expect(expectErr(result).code).toBe('STORAGE_NOT_FOUND');
  });

  it('reports a missing parent', async () => {
    expect(expectErr(await branchFromVersion(PARENT, 'nope', 'trial')).code).toBe(
      'STORAGE_NOT_FOUND'
    );
  });

  it('reports a missing version', async () => {
    await seedParent();
    expect(expectErr(await branchFromVersion(PARENT, 'nope', 'trial')).code).toBe(
      'STORAGE_NOT_FOUND'
    );
  });

  // Deleting the origin must not take the branch with it: a branch is
  // independent, and its content no longer lives anywhere else.
  it('survives the deletion of the design it came from', async () => {
    await seedParent();
    const version = await seedVersion(1);
    const branch = expectOk(await branchFromVersion(PARENT, version.id, 'trial'));

    expectOk(await deleteDesign(PARENT));

    const reloaded = expectOk(await loadDesign(branch.id));
    expect(reloaded.params?.width).toBe(1);
    // The pointer is kept rather than cleared: the row still reads correctly,
    // and the library treats a parent it cannot resolve as a root.
    expect(reloaded.parentDesignId).toBe(PARENT);
  });
});
