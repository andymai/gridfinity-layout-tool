import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/core/store/settings';
import { resetAllStores } from '@/test/testUtils';
import { inMemoryDbAccessor, folderHandleDouble } from './folderDoubles.testUtils';
import {
  allowExportFolder,
  canPickFolder,
  forgetExportFolder,
  getFolderAccess,
  pickExportFolder,
  resetExportFolderCacheForTests,
  saveToExportFolder,
} from './exportFolder';

const fakeDb = vi.hoisted((): { current: unknown } => ({ current: null }));

vi.mock('@/core/storage/backends/openSingleton', () => ({
  createDbAccessor: () => fakeDb.current,
}));

let rows: Map<string, unknown>;

beforeEach(() => {
  resetAllStores();
  resetExportFolderCacheForTests();
  const db = inMemoryDbAccessor();
  rows = db.rows;
  fakeDb.current = db.accessor;
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
  it('stores the picked handle and its name, then forgets both', async () => {
    const { handle } = folderHandleDouble('prints');
    const picker = vi.fn(async () => handle);
    vi.stubGlobal('window', { isSecureContext: true, showDirectoryPicker: picker });

    expect(await pickExportFolder()).toBe('prints');
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ mode: 'readwrite' }));
    expect(useSettingsStore.getState().settings.exportFolderName).toBe('prints');
    expect(rows.get('exportFolder')).toBe(handle);

    await forgetExportFolder();
    expect(useSettingsStore.getState().settings.exportFolderName).toBeNull();
    expect(rows.has('exportFolder')).toBe(false);
  });

  it('changes nothing when the picker is dismissed', async () => {
    const picker = vi.fn(async () => {
      throw new DOMException('The user aborted a request.', 'AbortError');
    });
    vi.stubGlobal('window', { isSecureContext: true, showDirectoryPicker: picker });

    expect(await pickExportFolder()).toBeNull();
    expect(useSettingsStore.getState().settings.exportFolderName).toBeNull();
  });
});

describe('getFolderAccess', () => {
  it('reads the handle back from IndexedDB after a reload', async () => {
    rows.set('exportFolder', folderHandleDouble('prints', { permission: 'prompt' }).handle);
    expect(await getFolderAccess()).toBe('prompt');
  });

  it('is missing when no handle was stored', async () => {
    expect(await getFolderAccess()).toBe('missing');
  });
});

describe('allowExportFolder', () => {
  it('asks the browser again', async () => {
    const { handle } = folderHandleDouble('prints', { permission: 'prompt', request: 'granted' });
    rows.set('exportFolder', handle);

    expect(await allowExportFolder()).toBe(true);
    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
  });
});

describe('saveToExportFolder', () => {
  it('writes the file into the folder', async () => {
    const { handle, files } = folderHandleDouble('prints');
    rows.set('exportFolder', handle);

    expect(await saveToExportFolder(new Blob(['solid bin']), 'bin.stl')).toBe('saved');
    expect(files.get('bin.stl')).toBe('solid bin');
    expect(handle.getFileHandle).toHaveBeenCalledWith('bin.stl', { create: true });
  });

  it('re-requests a lapsed permission before writing', async () => {
    const { handle, files } = folderHandleDouble('prints', { permission: 'prompt' });
    rows.set('exportFolder', handle);

    expect(await saveToExportFolder(new Blob(['x']), 'bin.stl')).toBe('saved');
    expect(handle.requestPermission).toHaveBeenCalled();
    expect(files.has('bin.stl')).toBe(true);
  });

  it('is denied when the prompt cannot be shown', async () => {
    const { handle, files } = folderHandleDouble('prints', {
      permission: 'prompt',
      request: new DOMException('User activation is required.', 'SecurityError'),
    });
    rows.set('exportFolder', handle);

    expect(await saveToExportFolder(new Blob(['x']), 'bin.stl')).toBe('denied');
    expect(files.size).toBe(0);
  });

  it('fails when the folder is gone or no handle is stored', async () => {
    expect(await saveToExportFolder(new Blob(['x']), 'bin.stl')).toBe('failed');

    resetExportFolderCacheForTests();
    rows.set('exportFolder', folderHandleDouble('prints', { failWrites: true }).handle);
    expect(await saveToExportFolder(new Blob(['x']), 'bin.stl')).toBe('failed');
  });
});
