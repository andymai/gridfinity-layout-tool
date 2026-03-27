import { describe, it, expect, vi } from 'vitest';
import { isOk } from '@/core/result';
import { createCommand } from '../commands';

vi.mock('@/core/store/library', () => ({
  useLibraryStore: {
    getState: () => ({ library: { activeLayoutId: 'layout_1' } }),
  },
}));

const { uiHandlers } = await import('./uiHandlers');

describe('UI Handlers', () => {
  it('returns ok with empty events for all UI commands', () => {
    const commandTypes = Object.keys(uiHandlers) as Array<keyof typeof uiHandlers>;

    for (const type of commandTypes) {
      const cmd = createCommand(type, {
        page: 'test',
        modal: 'test',
        feature: 'test',
        layoutId: 'l1',
        shareId: 's1',
        error: 'e',
        step: 's',
        templateId: 't',
        format: 'json',
      } as never);
      const handler = uiHandlers[type];
      const result = handler(cmd);

      expect(isOk(result), `${type} should return ok`).toBe(true);
      if (isOk(result)) {
        expect(result.value.events, `${type} should produce no events`).toHaveLength(0);
        expect(result.value.value, `${type} should return undefined`).toBeUndefined();
      }
    }
  });

  it('handles all 10 UI command types', () => {
    expect(Object.keys(uiHandlers)).toHaveLength(10);
  });
});
