import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/core/store/settings';
import { useToastStore } from '@/core/store/toast';
import { triggerDownload } from '@/shared/generation/exportUtils';
import { resetAllStores } from '@/test/testUtils';
import { deliverExport } from './deliverExport';
import { resetExportFolderCacheForTests } from './exportFolder';
import { inMemoryDbAccessor, folderHandleDouble } from './folderDoubles.testUtils';

const fakeDb = vi.hoisted((): { current: unknown } => ({ current: null }));

vi.mock('@/core/storage/backends/openSingleton', () => ({
  createDbAccessor: () => fakeDb.current,
}));
vi.mock('@/shared/generation/exportUtils', () => ({ triggerDownload: vi.fn() }));

let rows: Map<string, unknown>;
let fetchMock: ReturnType<typeof vi.fn>;

function useFolder(folder: ReturnType<typeof folderHandleDouble>): void {
  rows.set('exportFolder', folder.handle);
  useSettingsStore.getState().updateSetting('exportFolderName', folder.handle.name);
}

function useUrl(): void {
  useSettingsStore.getState().updateSettings({
    exportUrlEnabled: true,
    exportUrl: 'https://nas.local/upload',
    exportUrlHeaderName: 'X-API-Key',
    exportUrlHeaderValue: 'secret',
  });
}

function toastMessages(): string[] {
  return useToastStore.getState().toasts.map((toast) => toast.message);
}

const blob = new Blob(['solid bin']);
let clock = Date.UTC(2026, 0, 1);

beforeEach(() => {
  // Toasts group exports seconds apart, so each test starts well after the last.
  clock += 60_000;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(clock);
  resetAllStores();
  resetExportFolderCacheForTests();
  vi.mocked(triggerDownload).mockClear();
  const db = inMemoryDbAccessor();
  rows = db.rows;
  fakeDb.current = db.accessor;
  fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('deliverExport', () => {
  it('only downloads, synchronously, when both destinations are off', () => {
    void deliverExport(blob, 'bin.stl');

    expect(triggerDownload).toHaveBeenCalledWith(blob, 'bin.stl');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(toastMessages()).toEqual([]);
  });

  it('writes into the chosen folder instead of downloading', async () => {
    const folder = folderHandleDouble('prints');
    useFolder(folder);

    await deliverExport(blob, 'bin.stl');

    expect(folder.files.get('bin.stl')).toBe('solid bin');
    expect(triggerDownload).not.toHaveBeenCalled();
    expect(toastMessages()).toEqual(['Saved to prints/bin.stl']);
  });

  it('counts saves in a row in one toast', async () => {
    useFolder(folderHandleDouble('prints'));

    await deliverExport(blob, 'a.stl');
    await deliverExport(blob, 'b.stl');
    await deliverExport(blob, 'c.stl');

    expect(toastMessages()).toEqual(['Saved 3 files to prints']);
  });

  it('falls back to a download when the folder write fails', async () => {
    useFolder(folderHandleDouble('prints', { failWrites: true }));

    await deliverExport(blob, 'bin.stl');

    expect(triggerDownload).toHaveBeenCalledWith(blob, 'bin.stl');
    expect(toastMessages()).toEqual(["Couldn't save to prints, so it downloaded instead."]);
  });

  it('downloads when permission lapsed, and Allow again saves the file to the folder', async () => {
    const folder = folderHandleDouble('prints', {
      permission: 'prompt',
      request: new DOMException('User activation is required.', 'SecurityError'),
    });
    useFolder(folder);

    await deliverExport(blob, 'bin.stl');

    expect(triggerDownload).toHaveBeenCalledTimes(1);
    const toast = useToastStore.getState().toasts[0];
    expect(toast.message).toBe('No permission to save in prints, so it downloaded instead.');
    expect(toast.action?.label).toBe('Allow again');

    folder.state.request = 'granted';
    await toast.action?.onClick();

    expect(folder.files.get('bin.stl')).toBe('solid bin');
    expect(toastMessages()).toEqual(['Saved to prints/bin.stl']);
  });

  it('downloads first, then POSTs the file with its fields and header', async () => {
    useUrl();

    await deliverExport(blob, 'bin.stl');

    expect(triggerDownload).toHaveBeenCalledWith(blob, 'bin.stl');
    expect(vi.mocked(triggerDownload).mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[0]
    );
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe('https://nas.local/upload');
    expect(init.credentials).toBe('omit');
    expect(init.headers).toEqual({ 'X-API-Key': 'secret' });
    const form = init.body as FormData;
    expect(form.get('filename')).toBe('bin.stl');
    expect(form.get('format')).toBe('stl');
    expect(form.get('source')).toBe('gridfinity-layout-tool');
    expect(form.get('file')).toBeInstanceOf(Blob);
    expect(toastMessages()).toEqual(['Sent to nas.local']);
  });

  it('never holds the download back for a slow upload', () => {
    useUrl();
    fetchMock.mockReturnValue(new Promise(() => {}));

    void deliverExport(blob, 'bin.stl');

    expect(triggerDownload).toHaveBeenCalledWith(blob, 'bin.stl');
  });

  it('keeps the download and names the problem when the upload fails', async () => {
    useUrl();
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    await deliverExport(blob, 'bin.stl');

    expect(triggerDownload).toHaveBeenCalledWith(blob, 'bin.stl');
    const toast = useToastStore.getState().toasts[0];
    expect(toast.type).toBe('error');
    expect(toast.message).toBe(
      'Upload to nas.local failed (HTTP 401). Check the header in Settings.'
    );
    expect(toast.action?.label).toBe('Settings');
  });

  it('says so when the URL is switched on but not valid', async () => {
    useSettingsStore.getState().updateSettings({ exportUrlEnabled: true, exportUrl: 'nas' });

    await deliverExport(blob, 'bin.stl');

    expect(triggerDownload).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(toastMessages()).toEqual(['Not sent: the export address in Settings is not valid.']);
  });

  it('with both on, saves to the folder without downloading and sends to the URL', async () => {
    const folder = folderHandleDouble('prints');
    useFolder(folder);
    useUrl();

    await deliverExport(blob, 'bin.stl');

    expect(folder.files.get('bin.stl')).toBe('solid bin');
    expect(triggerDownload).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toastMessages().sort()).toEqual(['Saved to prints/bin.stl', 'Sent to nas.local']);
  });
});
