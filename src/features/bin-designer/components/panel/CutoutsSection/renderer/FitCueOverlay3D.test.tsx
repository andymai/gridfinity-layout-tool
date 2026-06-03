import { describe, it, expect } from 'vitest';
import { FitCueOverlay3D } from './FitCueOverlay3D';

describe('FitCueOverlay3D', () => {
  it('exports a component', () => {
    expect(FitCueOverlay3D).toBeDefined();
    expect(typeof FitCueOverlay3D).toBe('function');
  });
});
