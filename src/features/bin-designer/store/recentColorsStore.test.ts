import { describe, it, expect, beforeEach } from 'vitest';
import { useRecentColorsStore } from './recentColorsStore';

describe('recentColorsStore', () => {
  beforeEach(() => {
    useRecentColorsStore.setState({ recentColors: [] });
  });

  it('prepends newly remembered colors (most-recent first)', () => {
    useRecentColorsStore.getState().remember('#111111');
    useRecentColorsStore.getState().remember('#222222');
    expect(useRecentColorsStore.getState().recentColors).toEqual(['#222222', '#111111']);
  });

  it('dedupes case-insensitively and moves a repeat to the front', () => {
    useRecentColorsStore.getState().remember('#aabbcc');
    useRecentColorsStore.getState().remember('#333333');
    useRecentColorsStore.getState().remember('#AABBCC');
    expect(useRecentColorsStore.getState().recentColors).toEqual(['#aabbcc', '#333333']);
  });

  it('caps the list at 8 entries', () => {
    for (let i = 0; i < 12; i++) {
      useRecentColorsStore.getState().remember(`#0000${i.toString(16).padStart(2, '0')}`);
    }
    expect(useRecentColorsStore.getState().recentColors).toHaveLength(8);
  });
});
