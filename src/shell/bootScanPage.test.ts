// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '<div id="root"></div>';
});

/**
 * Load `bootScanPage` with the lazy chunk and stale-recovery mocked per test.
 * `vi.doMock` + `vi.resetModules` gives per-test control, including making the
 * dynamic `import('./scanBoot')` itself reject — the actual cause of the blank
 * page — which a hoisted `vi.mock` can't toggle.
 */
async function loadBoot(opts: {
  importRejects?: boolean;
  runThrows?: boolean;
  recovered?: boolean | 'reject';
}) {
  const runScanBoot = vi.fn(() => {
    if (opts.runThrows) throw new Error('boot failed');
  });
  const recoverStaleBundle = vi.fn(() =>
    opts.recovered === 'reject'
      ? Promise.reject(new Error('recovery unavailable'))
      : Promise.resolve(opts.recovered ?? false)
  );

  vi.doMock(
    './scanBoot',
    opts.importRejects
      ? () => {
          throw new Error('Failed to fetch dynamically imported module');
        }
      : () => ({ runScanBoot })
  );
  vi.doMock('@/shared/pwa/staleRecovery', () => ({ recoverStaleBundle }));

  const mod = await import('./bootScanPage');
  return { ...mod, runScanBoot, recoverStaleBundle };
}

const alert = () => document.querySelector('[role="alert"]');

describe('bootScanPage', () => {
  it('runs the scan boot and shows nothing extra on success', async () => {
    const { bootScanPage, runScanBoot, recoverStaleBundle } = await loadBoot({});
    await bootScanPage();
    expect(runScanBoot).toHaveBeenCalledTimes(1);
    expect(recoverStaleBundle).not.toHaveBeenCalled();
    expect(alert()).toBeNull();
  });

  it('recovers a stale bundle when the chunk import rejects', async () => {
    const { bootScanPage, recoverStaleBundle } = await loadBoot({
      importRejects: true,
      recovered: true,
    });
    await bootScanPage();
    expect(recoverStaleBundle).toHaveBeenCalledWith('scan_boot_chunk_load');
    // Recovery is reloading the page — no prompt.
    expect(alert()).toBeNull();
  });

  it('shows a reload prompt when the import rejects and recovery is skipped', async () => {
    const { bootScanPage, recoverStaleBundle } = await loadBoot({
      importRejects: true,
      recovered: false,
    });
    await bootScanPage();
    expect(recoverStaleBundle).toHaveBeenCalledWith('scan_boot_chunk_load');
    expect(alert()?.querySelector('button')?.textContent).toBe('Reload');
  });

  it('still shows the prompt if recovery itself rejects', async () => {
    const { bootScanPage } = await loadBoot({ importRejects: true, recovered: 'reject' });
    await bootScanPage();
    expect(alert()).not.toBeNull();
  });

  it('shows the prompt WITHOUT stale recovery when the loaded chunk throws at boot', async () => {
    // A runtime boot error is not a stale chunk, so it must not clear caches and
    // reload — just surface the prompt.
    const { bootScanPage, recoverStaleBundle } = await loadBoot({ runThrows: true });
    await bootScanPage();
    expect(recoverStaleBundle).not.toHaveBeenCalled();
    expect(alert()).not.toBeNull();
  });
});

describe('showScanBootError', () => {
  it('replaces a blank root with an alert and a reload control', async () => {
    const { showScanBootError } = await loadBoot({});
    showScanBootError();
    expect(alert()?.textContent).toContain('reload');
    expect(alert()?.querySelector('button')?.type).toBe('button');
  });

  it('is a no-op when there is no root element', async () => {
    const { showScanBootError } = await loadBoot({});
    document.body.innerHTML = '';
    expect(() => showScanBootError()).not.toThrow();
  });
});
