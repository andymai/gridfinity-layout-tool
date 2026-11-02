/**
 * @vitest-environment-options {"url": "https://gridfinitylayouttool.com/"}
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/core/store/settings';
import { resetExportFolderCacheForTests } from '@/shared/exportDestination/exportFolder';
import {
  inMemoryDbAccessor,
  folderHandleDouble,
} from '@/shared/exportDestination/folderDoubles.testUtils';
import { resetAllStores } from '@/test/testUtils';
import { ExportsTab } from './ExportsTab';

const fakeDb = vi.hoisted((): { current: unknown } => ({ current: null }));

vi.mock('@/core/storage/backends/openSingleton', () => ({
  createDbAccessor: () => fakeDb.current,
}));

type PickerWindow = Window & { showDirectoryPicker?: unknown };

let rows: Map<string, unknown>;
let fetchMock: ReturnType<typeof vi.fn>;
let picker: ReturnType<typeof vi.fn>;

function settings() {
  return useSettingsStore.getState().settings;
}

async function turnOnUrl(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('switch', { name: 'Send to a URL' }));
}

beforeEach(() => {
  resetAllStores();
  resetExportFolderCacheForTests();
  const db = inMemoryDbAccessor();
  rows = db.rows;
  fakeDb.current = db.accessor;
  fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  picker = vi.fn();
  (window as PickerWindow).showDirectoryPicker = picker;
  // jsdom leaves isSecureContext undefined even on an https URL.
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
});

afterEach(() => {
  delete (window as PickerWindow).showDirectoryPicker;
  vi.unstubAllGlobals();
});

describe('ExportsTab', () => {
  it('starts with both destinations off, each one line', () => {
    render(<ExportsTab />);

    expect(screen.getByText('Save to a folder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose folder' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Send to a URL' })).not.toBeChecked();
    expect(screen.queryByLabelText('Address')).not.toBeInTheDocument();
  });

  it('shows the URL fields when switched on and saves what is typed', async () => {
    const user = userEvent.setup();
    render(<ExportsTab />);
    await turnOnUrl(user);

    await user.type(screen.getByLabelText('Address'), 'https://nas.local/upload');
    await user.type(screen.getByLabelText('Header (optional)'), 'X-API-Key');
    await user.type(screen.getByLabelText('Header value'), 'secret');

    expect(settings().exportUrlEnabled).toBe(true);
    expect(settings().exportUrl).toBe('https://nas.local/upload');
    expect(settings().exportUrlHeaderName).toBe('X-API-Key');
    expect(settings().exportUrlHeaderValue).toBe('secret');
    expect(screen.getByLabelText('Header value')).toHaveAttribute('type', 'password');
    expect(screen.getByText(/stored in this browser only/)).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Send to a URL' }));
    expect(settings().exportUrlEnabled).toBe(false);
    expect(screen.queryByLabelText('Address')).not.toBeInTheDocument();
  });

  it('says what is wrong with an address while it is typed', async () => {
    const user = userEvent.setup();
    render(<ExportsTab />);
    await turnOnUrl(user);
    const address = screen.getByLabelText('Address');

    await user.type(address, 'nas.local');
    expect(screen.getByText(/Enter a full address/)).toBeInTheDocument();
    expect(address).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Send test file' })).toBeDisabled();

    await user.clear(address);
    await user.type(address, 'ftp://nas.local');
    expect(screen.getByText(/has to start with http:\/\/ or https:\/\//)).toBeInTheDocument();
  });

  it('warns that this https page will likely be blocked from an http address', async () => {
    const user = userEvent.setup();
    render(<ExportsTab />);
    await turnOnUrl(user);

    await user.type(screen.getByLabelText('Address'), 'http://nas.local/upload');

    expect(screen.getByText(/browser will likely block an http:\/\/ address/)).toBeInTheDocument();
  });

  it('flags a header name the browser would refuse', async () => {
    const user = userEvent.setup();
    render(<ExportsTab />);
    await turnOnUrl(user);

    await user.type(screen.getByLabelText('Header (optional)'), 'API Key');

    expect(screen.getByText(/only letters, numbers and dashes/)).toBeInTheDocument();
  });

  it('shows the test result next to the button', async () => {
    const user = userEvent.setup();
    render(<ExportsTab />);
    await turnOnUrl(user);
    await user.type(screen.getByLabelText('Address'), 'https://nas.local/upload');

    await user.click(screen.getByRole('button', { name: 'Send test file' }));
    expect(await screen.findByText('Test file sent to nas.local.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Test file sent to nas.local.');
    const form = (fetchMock.mock.calls[0] as [URL, RequestInit])[1].body as FormData;
    expect(form.get('format')).toBe('txt');

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await user.click(screen.getByRole('button', { name: 'Send test file' }));
    expect(
      await screen.findByText(
        'Upload to nas.local failed (HTTP 401). Check the header in Settings.'
      )
    ).toBeInTheDocument();
  });

  it('explains the folder option when this browser cannot pick folders', () => {
    delete (window as PickerWindow).showDirectoryPicker;
    render(<ExportsTab />);

    expect(
      screen.getByText('Saving to a folder needs Chrome or Edge over HTTPS.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose folder' })).not.toBeInTheDocument();
  });

  it('shows the chosen folder with Change and Forget', async () => {
    const user = userEvent.setup();
    picker.mockResolvedValue(folderHandleDouble('prints').handle);
    render(<ExportsTab />);

    await user.click(screen.getByRole('button', { name: 'Choose folder' }));

    expect(await screen.findByText('prints')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
    expect(settings().exportFolderName).toBe('prints');

    await user.click(screen.getByRole('button', { name: 'Forget' }));
    expect(await screen.findByRole('button', { name: 'Choose folder' })).toBeInTheDocument();
    expect(settings().exportFolderName).toBeNull();
  });

  it('offers Allow again when the folder permission lapsed', async () => {
    const user = userEvent.setup();
    const folder = folderHandleDouble('prints', { permission: 'prompt', request: 'granted' });
    rows.set('exportFolder', folder.handle);
    useSettingsStore.getState().updateSetting('exportFolderName', 'prints');
    render(<ExportsTab />);

    await user.click(await screen.findByRole('button', { name: 'Allow again' }));

    expect(folder.handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Allow again' })).not.toBeInTheDocument()
    );
  });
});
