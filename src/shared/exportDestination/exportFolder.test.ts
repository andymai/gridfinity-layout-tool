import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { err, ok } from '@/core/result';
import { useSettingsStore } from '@/core/store/settings';
import { resetAllStores } from '@/test/testUtils';
import { bytes, folderHandleDouble, inMemoryDb } from './folderDoubles.testUtils';
import {
  allowExportFolder,
  canPickFolder,
  forgetExportFolder,
  getFolderAccess,
  pickExportFolder,
  saveToExportFolder,
} from './exportFolder';

const folderDb = vi.hoisted((): { current: unknown } => ({ current: null }));

vi.mock('@/core/storage/backends/openSingleton', () => ({
  createDbAccessor: () => ({ get: () => Promise.resolve(folderDb.current) }),
}));

let db: ReturnType<typeof inMemoryDb>;

function stubPicker(picker: () => Promise<unknown>): void {
  vi.stubGlobal('window', { isSecureContext: true, showDirectoryPicker: picker });
}

beforeEach(() => {
  resetAllStores();
  db = inMemoryDb();
  folderDb.current = db;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('canPickFolder', () => {
  it('needs the picker and a secure context', () => {
    vi.stubGlobal('window', { isSecureContext: true, showDirectoryPicker: vi.fn() });
    expect(canPickFolder()).toBe(true);
    vi.stubGlobal('window', { isSecureContext: false, showDirectoryPicker: vi.fn() });
    expect(canPickFolder()).toBe(false);
    vi.stubGlobal('window', { isSecureContext: true });
    expect(canPickFolder()).toBe(false);
  });
});

describe('pickExportFolder and forgetExportFolder', () => {
  it('stores the picked handle and then its name, and forgets both', async () => {
    const { handle } = folderHandleDouble('prints');
    const picker = vi.fn(() => Promise.resolve(handle));
    stubPicker(picker);

    expect(await pickExportFolder()).toEqual(ok('prints'));
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ mode: 'readwrite' }));
    expect(db.rows.get('exportFolder')).toBe(handle);
    expect(useSettingsStore.getState().settings.exportFolderName).toBe('prints');

    await forgetExportFolder();
    expect(useSettingsStore.getState().settings.exportFolderName).toBeNull();
    expect(db.rows.has('exportFolder')).toBe(false);
  });

  it('changes nothing when the picker is dismissed', async () => {
    stubPicker(() => Promise.reject(new DOMException('The user aborted a request.', 'AbortError')));

    expect(await pickExportFolder()).toEqual(ok(null));
    expect(useSettingsStore.getState().settings.exportFolderName).toBeNull();
    expect(db.rows.has('exportFolder')).toBe(false);
  });

  it('keeps the old folder when the new handle cannot be stored', async () => {
    useSettingsStore.getState().updateSetting('exportFolderName', 'old');
    db.put.mockRejectedValueOnce(new DOMException('Quota exceeded.', 'QuotaExceededError'));
    stubPicker(() => Promise.resolve(folderHandleDouble('new').handle));

    expect(await pickExportFolder()).toEqual(err('storeFailed'));
    expect(useSettingsStore.getState().settings.exportFolderName).toBe('old');
  });

  it('fails without IndexedDB rather than keeping a folder it cannot reload', async () => {
    folderDb.current = null;
    stubPicker(() => Promise.resolve(folderHandleDouble('prints').handle));

    expect(await pickExportFolder()).toEqual(err('storeFailed'));
    expect(useSettingsStore.getState().settings.exportFolderName).toBeNull();
  });
});

describe('getFolderAccess', () => {
  it('reports the stored handle permission, including denied', async () => {
    db.rows.set('exportFolder', folderHandleDouble('prints', { permission: 'prompt' }).handle);
    expect(await getFolderAccess()).toBe('prompt');

    db.rows.set('exportFolder', folderHandleDouble('prints', { permission: 'denied' }).handle);
    expect(await getFolderAccess()).toBe('denied');
  });

  it('is missing when no handle was stored', async () => {
    expect(await getFolderAccess()).toBe('missing');
  });
});

describe('allowExportFolder', () => {
  it('asks the browser again', async () => {
    const { handle } = folderHandleDouble('prints', { permission: 'prompt', request: 'granted' });
    db.rows.set('exportFolder', handle);

    expect(await allowExportFolder()).toBe(true);
    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
  });
});

describe('saveToExportFolder', () => {
  it('writes the exact bytes and resolves the folder name', async () => {
    const { handle, files } = folderHandleDouble('prints');
    db.rows.set('exportFolder', handle);
    const stl = new Uint8Array([0, 1, 2, 250, 255]);

    expect(await saveToExportFolder(new Blob([stl]), 'bin.stl')).toEqual(ok('prints'));
    expect(files.get('bin.stl')).toEqual(stl);
    expect(handle.getFileHandle).toHaveBeenCalledWith('bin.stl', { create: true });
  });

  it('reads the handle on every save, so a folder changed elsewhere is used', async () => {
    const first = folderHandleDouble('prints');
    db.rows.set('exportFolder', first.handle);
    await saveToExportFolder(new Blob(['a']), 'a.stl');

    const second = folderHandleDouble('prints');
    db.rows.set('exportFolder', second.handle);
    await saveToExportFolder(new Blob(['b']), 'b.stl');

    expect(first.files.has('b.stl')).toBe(false);
    expect(second.files.get('b.stl')).toEqual(bytes('b'));
  });

  it('re-requests a lapsed permission before writing', async () => {
    const { handle, files } = folderHandleDouble('prints', { permission: 'prompt' });
    db.rows.set('exportFolder', handle);

    expect(await saveToExportFolder(new Blob(['x']), 'bin.stl')).toEqual(ok('prints'));
    expect(handle.requestPermission).toHaveBeenCalled();
    expect(files.has('bin.stl')).toBe(true);
  });

  it('is denied when the prompt cannot be shown or was refused', async () => {
    const lapsed = folderHandleDouble('prints', {
      permission: 'prompt',
      request: new DOMException('User activation is required.', 'SecurityError'),
    });
    db.rows.set('exportFolder', lapsed.handle);
    expect(await saveToExportFolder(new Blob(['x']), 'bin.stl')).toEqual(
      err({ reason: 'denied', folder: 'prints' })
    );
    expect(lapsed.files.size).toBe(0);

    db.rows.set('exportFolder', folderHandleDouble('prints', { permission: 'denied' }).handle);
    expect(await saveToExportFolder(new Blob(['x']), 'bin.stl')).toEqual(
      err({ reason: 'denied', folder: 'prints' })
    );
  });

  it('fails when the folder is gone or no handle is stored', async () => {
    expect(await saveToExportFolder(new Blob(['x']), 'bin.stl')).toEqual(err({ reason: 'failed' }));

    db.rows.set('exportFolder', folderHandleDouble('prints', { failWrites: true }).handle);
    expect(await saveToExportFolder(new Blob(['x']), 'bin.stl')).toEqual(
      err({ reason: 'failed', folder: 'prints' })
    );
  });

  it('keeps the latest export when two writes to one name overlap', async () => {
    const { handle, files } = folderHandleDouble('prints');
    db.rows.set('exportFolder', handle);
    const getFileHandle = handle.getFileHandle.getMockImplementation();
    let release = () => {};
    handle.getFileHandle.mockImplementationOnce(async (fileName: string) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return getFileHandle?.(fileName) ?? Promise.reject(new Error('no double'));
    });

    const older = saveToExportFolder(new Blob(['older']), 'bin.stl');
    const newer = saveToExportFolder(new Blob(['newer']), 'bin.stl');
    await vi.waitFor(() => expect(handle.getFileHandle).toHaveBeenCalledTimes(1));
    release();
    await Promise.all([older, newer]);

    expect(files.get('bin.stl')).toEqual(bytes('newer'));
  });
});
