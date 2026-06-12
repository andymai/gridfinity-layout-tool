// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useBinDefaultsStore } from './binDefaults';
import { saveDefaultParams, clearDefaultParams } from '../storage/defaultParamsStorage';
import { DEFAULT_BIN_PARAMS } from '../constants';
import { resetAllStores } from '@/test/testUtils';

describe('useBinDefaultsStore', () => {
  beforeEach(() => {
    // resetAllStores() covers the shared stores; binDefaults (a feature store)
    // and localStorage are reset explicitly since it does not touch them.
    resetAllStores();
    localStorage.clear();
    useBinDefaultsStore.setState({ hasCustomDefault: false });
  });

  it('markSaved / markCleared flip the reactive flag', () => {
    useBinDefaultsStore.getState().markSaved();
    expect(useBinDefaultsStore.getState().hasCustomDefault).toBe(true);
    useBinDefaultsStore.getState().markCleared();
    expect(useBinDefaultsStore.getState().hasCustomDefault).toBe(false);
  });

  it('refresh re-reads the flag from storage', () => {
    saveDefaultParams(DEFAULT_BIN_PARAMS);
    useBinDefaultsStore.getState().refresh();
    expect(useBinDefaultsStore.getState().hasCustomDefault).toBe(true);

    clearDefaultParams();
    useBinDefaultsStore.getState().refresh();
    expect(useBinDefaultsStore.getState().hasCustomDefault).toBe(false);
  });
});
