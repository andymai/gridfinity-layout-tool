import { describe, expect, it } from 'vitest';
import { forbiddenIn } from './build-agent-server';

describe('forbiddenIn', () => {
  it('names browser app code in the server bundle', () => {
    expect(
      forbiddenIn({
        imports: ['zod', 'react', 'three/examples/jsm/loaders/STLLoader.js', 'node:fs'],
        dynamicImports: [],
        moduleIds: ['/repo/src/agent/server.ts', '/repo/src/core/store/layout.ts'],
      })
    ).toEqual([
      'react',
      'three/examples/jsm/loaders/STLLoader.js',
      '/repo/src/core/store/layout.ts',
    ]);
  });

  it('names a browser package that is imported lazily', () => {
    expect(
      forbiddenIn({ imports: ['zod'], dynamicImports: ['posthog-js'], moduleIds: [] })
    ).toEqual(['posthog-js']);
  });

  it('passes a bundle of pure modules', () => {
    expect(
      forbiddenIn({
        imports: ['zod'],
        dynamicImports: [],
        moduleIds: ['/repo/src/shared/plan/drawerPlan.ts'],
      })
    ).toEqual([]);
  });
});
