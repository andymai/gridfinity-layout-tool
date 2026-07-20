import { describe, it, expect, vi } from 'vitest';

// Like SupportersScene, this drives a live r3f camera and can't render in jsdom;
// the fly-to behaviour is covered by the Playwright visual check. Here we just
// guard that the module imports cleanly and exports the component (r3f mocked so
// nothing touches a GPU context).
vi.mock('@react-three/fiber', () => ({ useFrame: vi.fn(), useThree: () => ({}) }));

import { CameraFocus } from './CameraFocus';

describe('CameraFocus', () => {
  it('exports a component', () => {
    expect(typeof CameraFocus).toBe('function');
  });
});
