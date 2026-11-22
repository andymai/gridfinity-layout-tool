import { describe, it, expect } from 'vitest';
import { LibraryGhost3D } from './LibraryGhost3D';

/**
 * An R3F component, which jsdom cannot mount, so only its export contract is
 * checked here. Where it lands is `placementCentre`, covered in
 * `libraryPlacement.test.ts`.
 */
describe('LibraryGhost3D', () => {
  it('exports a function component', () => {
    expect(typeof LibraryGhost3D).toBe('function');
    expect(LibraryGhost3D.name).toBe('LibraryGhost3D');
  });
});
