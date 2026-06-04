import { describe, it, expect, beforeEach } from 'vitest';
import {
  INSPECTOR_DEFAULT_WIDTH,
  INSPECTOR_MAX_WIDTH,
  INSPECTOR_MIN_WIDTH,
  loadInspectorCollapsed,
  loadInspectorWidth,
  saveInspectorCollapsed,
  saveInspectorWidth,
} from './inspectorDockStorage';

describe('inspectorDockStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the default width when nothing is stored', () => {
    expect(loadInspectorWidth()).toBe(INSPECTOR_DEFAULT_WIDTH);
  });

  it('round-trips a valid width (rounded)', () => {
    saveInspectorWidth(301.6);
    expect(loadInspectorWidth()).toBe(302);
  });

  it('rejects out-of-range widths and falls back to default', () => {
    saveInspectorWidth(INSPECTOR_MAX_WIDTH + 100);
    expect(loadInspectorWidth()).toBe(INSPECTOR_DEFAULT_WIDTH);
    saveInspectorWidth(INSPECTOR_MIN_WIDTH - 100);
    expect(loadInspectorWidth()).toBe(INSPECTOR_DEFAULT_WIDTH);
  });

  it('defaults collapsed to false and round-trips true/false', () => {
    expect(loadInspectorCollapsed()).toBe(false);
    saveInspectorCollapsed(true);
    expect(loadInspectorCollapsed()).toBe(true);
    saveInspectorCollapsed(false);
    expect(loadInspectorCollapsed()).toBe(false);
  });
});
