import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/core/store/settings';
import { useToastStore } from '@/core/store/toast';
import { triggerDownload } from '@/shared/generation/exportUtils';
import { resetAllStores } from '@/test/testUtils';
import { deliverExport } from './deliverExport';
import { primeExportFolder } from './exportFolder';
import { bytes, folderHandleDouble, inMemoryDb } from './folderDoubles.testUtils';

const folderDb = vi.hoisted((): { current: unknown } => ({ current: null }));

vi.mock('@/core/storage/backends/openSingleton', () => ({
  createDbAccessor: () => ({ get: () => Promise.resolve(folderDb.current) }),
}));
vi.mock('@/shared/generation/exportUtils', () => ({ triggerDownload: vi.fn() }));

let db: ReturnType<typeof inMemoryDb>;
let fetchMock: ReturnType<typeof vi.fn>;

function useFolder(folder: ReturnType<typeof folderHandleDouble>): void {
  db.rows.set('exportFolder', folder.handle);
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
const activationExpired = new DOMException('User activation is required.', 'SecurityError');
let clock = Date.UTC(2026, 0, 1);

beforeEach(() => {
  // Toasts group exports seconds apart, so each test starts well after the last.
  clock += 60_000;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(clock);
  resetAllStores();
  vi.mocked(triggerDownload).mockReset();
  db = inMemoryDb();
  folderDb.current = db;
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
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

  it('never rejects, and says so when even the download fails', async () => {
    vi.mocked(triggerDownload).mockImplementation(() => {
      throw new Error('createObjectURL failed');
    });

    await expect(deliverExport(blob, 'bin.stl')).resolves.toBe(false);
    expect(toastMessages()).toEqual(["Couldn't save bin.stl. Try the export again."]);
  });

  it('writes into the chosen folder instead of downloading', async () => {
    const folder = folderHandleDouble('prints');
    useFolder(folder);

    await deliverExport(blob, 'bin.stl');

    expect(folder.files.get('bin.stl')).toEqual(bytes('solid bin'));
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

  it('keeps a failure toast when a later export succeeds', async () => {
    const folder = folderHandleDouble('prints', { failWrites: true });
    useFolder(folder);
    await deliverExport(blob, 'a.stl');

    useFolder(folderHandleDouble('prints'));
    await deliverExport(blob, 'b.stl');

    expect(toastMessages()).toEqual([
      "Couldn't save to prints, so it downloaded instead.",
      'Saved to prints/b.stl',
    ]);
  });

  describe('when the folder permission has lapsed', () => {
    it('uses the permission the click asked for, after the export has run', async () => {
      const folder = folderHandleDouble('prints', { permission: 'prompt', request: 'granted' });
      useFolder(folder);

      primeExportFolder();
      await vi.waitFor(() => expect(folder.handle.requestPermission).toHaveBeenCalledTimes(1));
      folder.state.request = activationExpired;
      await new Promise((resolve) => setTimeout(resolve, 10));
      await deliverExport(blob, 'bin.stl');

      expect(folder.files.get('bin.stl')).toEqual(bytes('solid bin'));
      expect(folder.handle.requestPermission).toHaveBeenCalledTimes(1);
      expect(triggerDownload).not.toHaveBeenCalled();
    });

    it('downloads without priming, and Allow again saves the file to the folder', async () => {
      const folder = folderHandleDouble('prints', {
        permission: 'prompt',
        request: activationExpired,
      });
      useFolder(folder);

      await deliverExport(blob, 'bin.stl');

      expect(triggerDownload).toHaveBeenCalledTimes(1);
      const toast = useToastStore.getState().toasts[0];
      expect(toast.message).toBe('No permission to save in prints, so it downloaded instead.');
      expect(toast.action?.label).toBe('Allow again');

      folder.state.request = 'granted';
      await toast.action?.onClick();

      expect(folder.files.get('bin.stl')).toEqual(bytes('solid bin'));
      expect(toastMessages()).toContain('Saved to prints/bin.stl');
    });

    it('says so again when Allow again is refused', async () => {
      const folder = folderHandleDouble('prints', { permission: 'prompt', request: 'denied' });
      useFolder(folder);
      await deliverExport(blob, 'bin.stl');

      await useToastStore.getState().toasts[0].action?.onClick();

      const toast = useToastStore.getState().toasts.at(-1);
      expect(toast?.message).toBe('No permission to save in prints, so it downloaded instead.');
      expect(toast?.action?.label).toBe('Settings');
      expect(folder.files.size).toBe(0);
    });
  });

  it('downloads first, then POSTs the file with its fields and header', async () => {
    useUrl();

    await deliverExport(blob, 'bin.stl');
    await vi.waitFor(() => expect(toastMessages()).toEqual(['Sent to nas.local']));

    expect(triggerDownload).toHaveBeenCalledWith(blob, 'bin.stl');
    expect(vi.mocked(triggerDownload).mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[0]
    );
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe('https://nas.local/upload');
    expect(init.credentials).toBe('omit');
    expect(init.redirect).toBe('manual');
    expect(init.headers).toEqual({ 'X-API-Key': 'secret' });
    const form = init.body as FormData;
    expect(await (form.get('file') as Blob).text()).toBe('solid bin');
    expect(form.get('filename')).toBe('bin.stl');
    expect(form.get('format')).toBe('stl');
    expect(form.get('source')).toBe('gridfinity-layout-tool');
  });

  it('resolves without waiting for the upload', async () => {
    useUrl();
    fetchMock.mockReturnValue(new Promise(() => {}));

    await deliverExport(blob, 'pending.stl');

    expect(triggerDownload).toHaveBeenCalledWith(blob, 'pending.stl');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('sends one file to one address in call order, so the latest upload lands last', async () => {
    useUrl();
    let release = (): void => undefined;
    const first = new Promise<Response>((resolve) => {
      release = () => resolve(new Response(null, { status: 200 }));
    });
    fetchMock
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(Promise.resolve(new Response(null, { status: 200 })));

    await deliverExport(blob, 'queued.stl');
    await deliverExport(new Blob(['newer']), 'queued.stl');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    release();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const sent = (call: number) =>
      ((fetchMock.mock.calls[call] as [URL, RequestInit])[1].body as FormData).get('file') as Blob;
    expect(await sent(0).text()).toBe('solid bin');
    expect(await sent(1).text()).toBe('newer');
  });

  it('keeps the download and names the problem when the upload fails', async () => {
    useUrl();
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    await deliverExport(blob, 'bin.stl');
    await vi.waitFor(() => expect(toastMessages()).toHaveLength(1));

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
    await vi.waitFor(() => expect(toastMessages()).toHaveLength(2));

    expect(folder.files.get('bin.stl')).toEqual(bytes('solid bin'));
    expect(triggerDownload).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toastMessages().sort()).toEqual(['Saved to prints/bin.stl', 'Sent to nas.local']);
  });
});
