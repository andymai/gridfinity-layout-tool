import { describe, it, expect, vi } from 'vitest';

// The scene is a WebGL component that can't render in jsdom; its behavioural
// logic is covered by the pure util tests (layout, label fitting) and by the
// Playwright visual check. Here we just guard that the module imports cleanly
// and exports a component (the r3f/drei surfaces are mocked so nothing touches
// a GPU context).
vi.mock('@react-three/fiber', () => ({ useFrame: vi.fn(), useThree: () => ({}) }));
vi.mock('@react-three/drei', () => ({ RoundedBox: () => null, ContactShadows: () => null }));

import { SupportersScene } from './SupportersScene';

describe('SupportersScene', () => {
  it('exports a component', () => {
    expect(typeof SupportersScene).toBe('function');
  });
});
