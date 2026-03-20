import { describe, it, expect } from 'vitest';
import { LayerLabel } from './LayerLabel';

describe('LayerLabel', () => {
  it('exports the component', () => {
    expect(LayerLabel).toBeDefined();
    expect(typeof LayerLabel).toBe('function');
  });
});
