import { describe, it, expect } from 'vitest';
import { CutoutSocketFootprint } from './CutoutSocketFootprint';

/**
 * An R3F component that renders drei <Text> and Three shape meshes, which
 * jsdom cannot mount, the same reason `CutoutLabel3D` asserts only its export
 * contract here. The layout it draws is covered in
 * `cutoutSocketFootprintLayout.test.ts` and the placement it is given in
 * `@/shared/utils/cutoutLabelSocketPlan.test.ts`.
 */
describe('CutoutSocketFootprint', () => {
  it('exports a function component', () => {
    expect(typeof CutoutSocketFootprint).toBe('function');
    expect(CutoutSocketFootprint.name).toBe('CutoutSocketFootprint');
  });
});
