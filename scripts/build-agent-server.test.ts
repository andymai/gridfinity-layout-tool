import { describe, expect, it } from 'vitest';
import { forbiddenIn } from './build-agent-server';

describe('forbiddenIn', () => {
  it('names browser app code in the server bundle', () => {
    expect(
      forbiddenIn({
        imports: ['zod', 'react', 'three/examples/jsm/loaders/STLLoader.js', 'node:fs'],
        moduleIds: ['/repo/src/agent/server.ts', '/repo/src/core/store/layout.ts'],
      })
    ).toEqual([
      'react',
      'three/examples/jsm/loaders/STLLoader.js',
      '/repo/src/core/store/layout.ts',
    ]);
  });

  it('passes a bundle of pure modules', () => {
    expect(
      forbiddenIn({ imports: ['zod'], moduleIds: ['/repo/src/shared/plan/drawerPlan.ts'] })
    ).toEqual([]);
  });
});
