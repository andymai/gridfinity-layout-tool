// Vitest 5 moved matcher augmentation from the global `jest.Matchers` namespace
// to `Matchers<R, T>`. jest-dom 7.0.1 still augments the old shapes, so its
// matcher types vanish from `expect(...)` under Vitest 5 (runtime is unaffected).
// Remove once testing-library/jest-dom#738 ships a Vitest 5 entry point.
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Matchers<R, T> extends TestingLibraryMatchers<unknown, R> {}
}
