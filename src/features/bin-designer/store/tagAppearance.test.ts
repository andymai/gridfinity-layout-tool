// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { isOk } from '@/core/result';
import {
  useTagAppearanceStore,
  tagAppearanceKey,
  tagTint,
  TAG_APPEARANCE_STORAGE_KEY,
} from './tagAppearance';

beforeEach(() => {
  localStorage.clear();
  useTagAppearanceStore.setState({ appearances: {} });
});

describe('tagAppearanceKey', () => {
  it('lowercases and trims so appearance follows case-insensitive tag identity', () => {
    expect(tagAppearanceKey(' Kitchen ')).toBe('kitchen');
  });
});

describe('tagTint', () => {
  it('appends an alpha suffix to 6-digit hex colors', () => {
    expect(tagTint('#f87171')).toBe('#f8717145');
  });

  it('passes non-hex values through untouched', () => {
    expect(tagTint('red')).toBe('red');
  });
});

describe('useTagAppearanceStore', () => {
  it('sets a color and persists it under the lowercased key', () => {
    const result = useTagAppearanceStore.getState().setTagAppearance('Kitchen', {
      color: '#f87171',
    });
    expect(isOk(result)).toBe(true);
    expect(useTagAppearanceStore.getState().appearances.kitchen).toEqual({ color: '#f87171' });
    const stored = JSON.parse(localStorage.getItem(TAG_APPEARANCE_STORAGE_KEY) ?? '{}') as Record<
      string,
      unknown
    >;
    expect(stored.kitchen).toEqual({ color: '#f87171' });
  });

  it('merges patches: setting an icon keeps the color', () => {
    const store = useTagAppearanceStore.getState();
    store.setTagAppearance('kitchen', { color: '#f87171' });
    useTagAppearanceStore.getState().setTagAppearance('kitchen', { icon: '🔧' });
    expect(useTagAppearanceStore.getState().appearances.kitchen).toEqual({
      color: '#f87171',
      icon: '🔧',
    });
  });

  it('null clears a single field and drops the entry when nothing is left', () => {
    useTagAppearanceStore.getState().setTagAppearance('kitchen', { color: '#f87171', icon: '🔧' });
    useTagAppearanceStore.getState().setTagAppearance('kitchen', { icon: null });
    expect(useTagAppearanceStore.getState().appearances.kitchen).toEqual({ color: '#f87171' });
    useTagAppearanceStore.getState().setTagAppearance('kitchen', { color: null });
    expect(useTagAppearanceStore.getState().appearances.kitchen).toBeUndefined();
  });

  it('clearTagAppearance removes the entry and persists the removal', () => {
    useTagAppearanceStore.getState().setTagAppearance('kitchen', { icon: '🔧' });
    useTagAppearanceStore.getState().clearTagAppearance('Kitchen');
    expect(useTagAppearanceStore.getState().appearances.kitchen).toBeUndefined();
    const stored = JSON.parse(localStorage.getItem(TAG_APPEARANCE_STORAGE_KEY) ?? '{}') as Record<
      string,
      unknown
    >;
    expect(stored.kitchen).toBeUndefined();
  });
});
