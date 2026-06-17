import { describe, it, expect } from 'vitest';
import { CutoutLabel3D } from './CutoutLabel3D';

/**
 * CutoutLabel3D is an R3F component that renders drei <Text> and reads the
 * designer store. R3F components can't be rendered in jsdom, so we assert the
 * export contract here; placement logic is covered in
 * `@/shared/utils/cutoutLabel.test.ts` and color logic in `cutoutLabelColor.test.ts`.
 */
describe('CutoutLabel3D', () => {
  it('exports a function component', () => {
    expect(typeof CutoutLabel3D).toBe('function');
    expect(CutoutLabel3D.name).toBe('CutoutLabel3D');
  });
});
