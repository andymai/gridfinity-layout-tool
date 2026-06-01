import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOk } from '@/core/result';

const saveDesign = vi.fn();
const setActiveDesignId = vi.fn();
vi.mock('@/features/bin-designer/storage/DesignerStorage', () => ({
  saveDesign: (...a: unknown[]) => saveDesign(...a),
  setActiveDesignId: (...a: unknown[]) => setActiveDesignId(...a),
}));

import { exampleToDesign } from './exampleToDesign';
import { EXAMPLE_DESIGNS } from '@/features/bin-designer/data/examples';

describe('exampleToDesign', () => {
  beforeEach(() => {
    saveDesign.mockReset();
    setActiveDesignId.mockReset();
  });

  it('saves a new design (no id) from example params and activates it', async () => {
    const example = EXAMPLE_DESIGNS[0];
    saveDesign.mockResolvedValue({
      ok: true,
      value: { id: 'design_new', name: example.id, params: example.params },
    });

    const result = await exampleToDesign(example, (k) => k);

    expect(isOk(result)).toBe(true);
    const arg = saveDesign.mock.calls[0][0];
    expect(arg.id).toBeUndefined(); // fresh design — never overwrites
    expect(arg.params).toEqual(example.params);
    expect(arg.thumbnail).toBeNull(); // background regen makes the real thumbnail
    expect(setActiveDesignId).toHaveBeenCalledWith('design_new');
  });

  it('does not activate when save fails', async () => {
    const example = EXAMPLE_DESIGNS[0];
    saveDesign.mockResolvedValue({ ok: false, error: { code: 'x', message: 'fail' } });
    const result = await exampleToDesign(example, (k) => k);
    expect(isOk(result)).toBe(false);
    expect(setActiveDesignId).not.toHaveBeenCalled();
  });
});
