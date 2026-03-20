import { describe, it, expect } from 'vitest';
import { ExplodedLayerGroup } from './ExplodedLayerGroup';

describe('ExplodedLayerGroup', () => {
  it('exports the component', () => {
    expect(ExplodedLayerGroup).toBeDefined();
    expect(typeof ExplodedLayerGroup).toBe('function');
  });
});
