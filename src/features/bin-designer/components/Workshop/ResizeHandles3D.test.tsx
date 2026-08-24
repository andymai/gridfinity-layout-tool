import { describe, expect, it } from 'vitest';
import { ResizeHandles3D } from './ResizeHandles3D';

// Behavior is covered by resizeHandleConfig.test.ts (handle→param math) and
// the designer store scenarios; the R3F drag surface itself is exercised in
// the browser, matching the other Workshop scene components.
describe('ResizeHandles3D', () => {
  it('exports a function', () => {
    expect(typeof ResizeHandles3D).toBe('function');
  });
});
