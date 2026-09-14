// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runScanBoot = vi.fn();
vi.mock('./scanBoot', () => ({ runScanBoot: () => runScanBoot() }));

const recoverStaleBundle = vi.fn();
vi.mock('@/shared/pwa/staleRecovery', () => ({
  recoverStaleBundle: (...args: unknown[]) => recoverStaleBundle(...args),
}));

import { bootScanPage, showScanBootError } from './bootScanPage';

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="root"></div>';
});

describe('bootScanPage', () => {
  it('runs the scan boot and shows nothing extra on success', async () => {
    await bootScanPage();
    expect(runScanBoot).toHaveBeenCalledTimes(1);
    expect(recoverStaleBundle).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows a reload prompt instead of a blank page when boot fails and recovery is skipped', async () => {
    runScanBoot.mockImplementation(() => {
      throw new Error('Failed to fetch dynamically imported module');
    });
    recoverStaleBundle.mockResolvedValue(false);

    await bootScanPage();

    expect(recoverStaleBundle).toHaveBeenCalledWith('scan_boot_chunk_load');
    const alert = document.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.querySelector('button')?.textContent).toBe('Reload');
  });

  it('leaves the page for the reload when a stale-bundle recovery is underway', async () => {
    runScanBoot.mockImplementation(() => {
      throw new Error('boom');
    });
    recoverStaleBundle.mockResolvedValue(true);

    await bootScanPage();

    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it('still shows the prompt if recovery itself rejects', async () => {
    runScanBoot.mockImplementation(() => {
      throw new Error('boom');
    });
    recoverStaleBundle.mockRejectedValue(new Error('recovery unavailable'));

    await bootScanPage();

    expect(document.querySelector('[role="alert"]')).not.toBeNull();
  });
});

describe('showScanBootError', () => {
  it('replaces a blank root with an alert and a reload control', () => {
    showScanBootError();
    const alert = document.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('reload');
    expect(alert?.querySelector('button')?.type).toBe('button');
  });

  it('is a no-op when there is no root element', () => {
    document.body.innerHTML = '';
    expect(() => showScanBootError()).not.toThrow();
  });
});
