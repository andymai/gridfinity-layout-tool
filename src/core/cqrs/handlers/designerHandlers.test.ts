import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOk } from '@/core/result';
import { createCommand } from '../commands';
import { resetVersionCounters } from './index';

vi.mock('@/core/store/library', () => ({
  useLibraryStore: {
    getState: () => ({ library: { activeLayoutId: 'layout_1' } }),
  },
}));

const { handleDesignerSave } = await import('./designerHandlers');

describe('Designer Handlers', () => {
  beforeEach(() => {
    resetVersionCounters();
  });

  describe('handleDesignerSave', () => {
    it('produces designer.saved event', () => {
      const cmd = createCommand('designer.save', {
        designId: 'design_1',
        data: { width: 2, depth: 2 },
      });
      const result = handleDesignerSave(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events).toHaveLength(1);
        expect(result.value.events[0].type).toBe('designer.saved');
        expect(result.value.events[0].payload).toEqual({ designId: 'design_1' });
      }
    });
  });
});
