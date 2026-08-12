import { describe, it, expect, beforeEach } from 'vitest';
import {
  BENTO_DOCK_DEFAULT_WIDTH,
  BENTO_DOCK_MAX_WIDTH,
  BENTO_DOCK_MIN_WIDTH,
  loadBentoDockCollapsed,
  loadBentoDockWidth,
  saveBentoDockCollapsed,
  saveBentoDockWidth,
} from './bentoDockStorage';

describe('bentoDockStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips width (rounded) and collapsed', () => {
    saveBentoDockWidth(301.6);
    saveBentoDockCollapsed(true);

    expect(loadBentoDockWidth()).toBe(302);
    expect(loadBentoDockCollapsed()).toBe(true);
  });

  it('falls back to defaults when nothing is stored', () => {
    expect(loadBentoDockWidth()).toBe(BENTO_DOCK_DEFAULT_WIDTH);
    expect(loadBentoDockCollapsed()).toBe(false);
  });

  it('rejects out-of-range and garbage widths', () => {
    localStorage.setItem('gridfinity-bento-dock-width', String(BENTO_DOCK_MAX_WIDTH + 100));
    expect(loadBentoDockWidth()).toBe(BENTO_DOCK_DEFAULT_WIDTH);

    localStorage.setItem('gridfinity-bento-dock-width', String(BENTO_DOCK_MIN_WIDTH - 1));
    expect(loadBentoDockWidth()).toBe(BENTO_DOCK_DEFAULT_WIDTH);

    localStorage.setItem('gridfinity-bento-dock-width', 'wide');
    expect(loadBentoDockWidth()).toBe(BENTO_DOCK_DEFAULT_WIDTH);
  });

  it('uses keys distinct from the cutout inspector dock', () => {
    saveBentoDockWidth(300);
    expect(localStorage.getItem('gridfinity-cutout-inspector-width')).toBeNull();
    expect(localStorage.getItem('gridfinity-bento-dock-width')).toBe('300');
  });
});
