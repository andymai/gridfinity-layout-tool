import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { LocaleProvider, useLocale } from '@/i18n';
import { _resetActiveTranslations } from '@/i18n/context';
import { ok, isOk } from '@/core/result';
import { CONSTRAINTS, createDefaultLayout } from '@/core/constants';
import { useLibraryStore } from '@/core/store/library';
import { duplicateEntry } from '@/core/cqrs/v2/domain/library/duplicateEntry';
import { makeEntry, makeLibrary } from '@/core/cqrs/v2/domain/library/_testHelpers';
import { layoutId } from '@/core/types';
import { duplicateLayoutEntry } from './LayoutManager';
import { layoutCopyName } from './layoutNames';
import * as backend from './backend';

vi.unmock('@/i18n');

vi.mock('./backend', () => ({
  saveSyncGeneric: vi.fn(),
  saveAsync: vi.fn(),
  loadAsync: vi.fn(),
  deleteAsync: vi.fn(),
}));

vi.mock('./backends/indexedDB', () => ({
  saveLibraryIndex: vi.fn().mockResolvedValue(undefined),
  loadLibraryIndex: vi.fn().mockResolvedValue(null),
}));

vi.mock('./librarySync', () => ({
  notifyLibraryChanged: vi.fn(),
}));

describe('copy names, through the real translator in German', () => {
  beforeAll(async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocaleProvider initialLocale="de">{children}</LocaleProvider>
    );
    const { result, unmount } = renderHook(() => useLocale(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    unmount();
  });

  afterAll(() => {
    _resetActiveTranslations();
  });

  it('adds the translated suffix and keeps the name within the limit', () => {
    expect(layoutCopyName('Werkbank')).toBe('Werkbank (Kopie)');
    expect(layoutCopyName('A'.repeat(CONSTRAINTS.NAME_MAX_LENGTH))).toHaveLength(
      CONSTRAINTS.NAME_MAX_LENGTH
    );
  });

  it('stores a duplicated layout under the translated name', async () => {
    const source = createDefaultLayout();
    source.name = 'Werkbank';
    vi.mocked(backend.loadAsync).mockResolvedValue(source);
    vi.mocked(backend.saveAsync).mockResolvedValue(ok(undefined));
    const library = makeLibrary({ entries: [makeEntry('source', 'Werkbank')] });

    const result = await duplicateLayoutEntry('source', library);

    if (!isOk(result)) throw new Error('duplicate failed');
    expect(result.value.layout.name).toBe('Werkbank (Kopie)');
    expect(result.value.entry.name).toBe('Werkbank (Kopie)');
    expect(vi.mocked(backend.saveAsync)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ name: 'Werkbank (Kopie)' })
    );
  });

  it('names the entry of the duplicate command with the translated suffix', () => {
    const library = makeLibrary({ entries: [makeEntry('source', 'Werkbank')] });

    const result = duplicateEntry.handle({ sourceLayoutId: 'source' }, { aggregate: library });

    if (!isOk(result)) throw new Error('duplicate failed');
    expect(result.value.event.payload.entry.name).toBe('Werkbank (Kopie)');
  });

  it('names the entry of the library store duplicate with the translated suffix', () => {
    useLibraryStore.setState({
      library: makeLibrary({ entries: [makeEntry('source', 'Werkbank')] }),
    });

    const copy = useLibraryStore
      .getState()
      .duplicateEntry(makeEntry('source', 'Werkbank'), layoutId('copy'));

    expect(copy.name).toBe('Werkbank (Kopie)');
  });
});
