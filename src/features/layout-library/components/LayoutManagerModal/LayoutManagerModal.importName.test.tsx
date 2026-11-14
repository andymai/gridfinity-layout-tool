import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type * as Storage from '@/core/storage';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/i18n';
import { _resetActiveTranslations } from '@/i18n/context';
import de from '@/i18n/locales/de.json';
import { createDefaultLayout } from '@/core/constants';
import { createLayoutEntry } from '@/core/storage';
import { useLibraryStore } from '@/core/store/library';
import { createTestLibrary, resetAllStores } from '@/test/testUtils';
import { LayoutManagerModal } from './LayoutManagerModal';

vi.unmock('@/i18n');

vi.mock('@/core/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof Storage>();
  const { err, storageQuotaExceeded } = await import('@/core/result');
  // The name is settled before storage runs, so the import can stop there.
  return {
    ...actual,
    createLayoutEntry: vi.fn().mockResolvedValue(err(storageQuotaExceeded())),
  };
});

describe('LayoutManagerModal import name, through the real translator', () => {
  beforeEach(() => {
    resetAllStores();
    useLibraryStore.setState({ library: createTestLibrary(), isLoaded: true });
  });

  afterEach(() => {
    _resetActiveTranslations();
  });

  it('adds the imported suffix in the active language', async () => {
    const layout = createDefaultLayout();
    layout.name = 'Werkbank';

    render(
      <LocaleProvider initialLocale="de">
        <LayoutManagerModal isOpen onClose={vi.fn()} />
      </LocaleProvider>
    );
    fireEvent.click(await screen.findByRole('button', { name: de['common.import'] }));
    fireEvent.change(screen.getByLabelText(de['layouts.layoutJson']), {
      target: { value: JSON.stringify(layout) },
    });
    fireEvent.click(await screen.findByRole('button', { name: de['layouts.importLayout'] }));

    await waitFor(() =>
      expect(createLayoutEntry).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Werkbank (importiert)' }),
        expect.anything(),
        expect.objectContaining({ name: 'Werkbank (importiert)' })
      )
    );
  });
});
