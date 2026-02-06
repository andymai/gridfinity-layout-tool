import { describe, it, expect } from 'vitest';
import { useViewportCamera, useViewportCameraStandalone } from './useViewportCamera';

describe('useViewportCamera', () => {
  it('exports useViewportCamera function', () => {
    expect(typeof useViewportCamera).toBe('function');
  });

  it('exports useViewportCameraStandalone function', () => {
    expect(typeof useViewportCameraStandalone).toBe('function');
  });
});
